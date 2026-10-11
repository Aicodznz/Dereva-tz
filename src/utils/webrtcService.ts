import { db } from '../firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { callAudio } from './callAudio';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'declined' | 'busy';

export interface CallParticipant {
  id: string;
  name: string;
  photo?: string;
  role: 'driver' | 'passenger';
  phone?: string;
}

export interface CallSession {
  id: string;
  rideId: string;
  caller: CallParticipant;
  receiver: CallParticipant;
  callType: CallType;
  status: CallStatus;
  startedAt?: any;
  endedAt?: any;
  offer?: any;
  answer?: any;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// Generates fallback media stream in case user has no mic/camera or permissions blocked in iframe
export function createSyntheticStream(withVideo: boolean = false): MediaStream {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const dst = audioCtx.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();
    const audioTrack = dst.stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
    }

    let videoTrack: MediaStreamTrack | null = null;
    if (withVideo) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('WebRTC Live Stream', 180, 240);
      }
      const canvasStream = canvas.captureStream(15);
      videoTrack = canvasStream.getVideoTracks()[0];
    }

    const stream = new MediaStream();
    if (audioTrack) stream.addTrack(audioTrack);
    if (videoTrack) stream.addTrack(videoTrack);
    return stream;
  } catch {
    return new MediaStream();
  }
}

export class WebRTCManager {
  public pc: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  public activeCallId: string | null = null;
  public currentFacingMode: 'user' | 'environment' = 'user';
  private unsubDoc: Unsubscribe | null = null;
  private unsubCandidates: Unsubscribe | null = null;

  // Obtain local media with graceful fallback
  public async getLocalMedia(callType: CallType): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video' ? {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        } : false,
      };

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.localStream = stream;
        return stream;
      }
    } catch (err) {
      console.warn('[WebRTC] Media permission denied or hardware not found, fallback to synthetic stream:', err);
    }

    // Graceful fallback stream so UI functions smoothly without hardware errors
    const fallback = createSyntheticStream(callType === 'video');
    this.localStream = fallback;
    return fallback;
  }

  // Caller initiates call
  public async createCall(
    rideId: string,
    caller: CallParticipant,
    receiver: CallParticipant,
    callType: CallType,
    onRemoteStream: (stream: MediaStream) => void,
    onStateChange: (status: CallStatus) => void
  ): Promise<string> {
    this.cleanup();

    const callDocRef = doc(collection(db, 'calls'));
    this.activeCallId = callDocRef.id;

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);

    // Setup local media
    const stream = await this.getLocalMedia(callType);
    stream.getTracks().forEach((track) => {
      if (this.pc) this.pc.addTrack(track, stream);
    });

    // Handle remote tracks
    this.pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        if (this.remoteStream) {
          this.remoteStream.addTrack(track);
        }
      });
      onRemoteStream(this.remoteStream);
    };

    // Push caller ICE candidates to subcollection
    const callerCandidatesCol = collection(db, 'calls', this.activeCallId, 'callerCandidates');
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidatesCol, event.candidate.toJSON()).catch(() => {});
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      if (this.pc.connectionState === 'connected') {
        callAudio.playConnectedChime();
        onStateChange('connected');
      } else if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
        onStateChange('ended');
      }
    };

    // Create SDP Offer
    const offerDesc = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    });
    await this.pc.setLocalDescription(offerDesc);

    const callData = {
      id: this.activeCallId,
      rideId,
      caller,
      receiver,
      callType,
      status: 'ringing',
      offer: {
        type: offerDesc.type,
        sdp: offerDesc.sdp,
      },
      createdAt: serverTimestamp(),
    };

    await setDoc(callDocRef, callData);
    callAudio.startOutgoingRinging();
    onStateChange('ringing');

    // Listen for Answer and Status changes
    this.unsubDoc = onSnapshot(callDocRef, async (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (data.status === 'declined' || data.status === 'ended') {
        callAudio.playEndTone();
        onStateChange(data.status);
        this.cleanup();
        return;
      }

      if (!this.pc?.currentRemoteDescription && data.answer) {
        const answerDesc = new RTCSessionDescription(data.answer);
        await this.pc?.setRemoteDescription(answerDesc);
        callAudio.playConnectedChime();
        onStateChange('connected');
      }
    });

    // Listen for Receiver ICE candidates
    const receiverCandidatesCol = collection(db, 'calls', this.activeCallId, 'receiverCandidates');
    this.unsubCandidates = onSnapshot(receiverCandidatesCol, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidateData = change.doc.data();
          try {
            await this.pc?.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch {}
        }
      });
    });

    return this.activeCallId;
  }

  // Receiver answers call
  public async answerCall(
    callId: string,
    callType: CallType,
    onRemoteStream: (stream: MediaStream) => void,
    onStateChange: (status: CallStatus) => void
  ): Promise<void> {
    this.cleanupPeerOnly();
    this.activeCallId = callId;
    callAudio.stopAll();

    const callDocRef = doc(db, 'calls', callId);
    const callSnap = await getDoc(callDocRef);
    if (!callSnap.exists()) {
      throw new Error('Call does not exist');
    }
    const callData = callSnap.data();

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);

    const stream = await this.getLocalMedia(callType);
    stream.getTracks().forEach((track) => {
      if (this.pc) this.pc.addTrack(track, stream);
    });

    this.pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        if (this.remoteStream) {
          this.remoteStream.addTrack(track);
        }
      });
      onRemoteStream(this.remoteStream);
    };

    const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(receiverCandidatesCol, event.candidate.toJSON()).catch(() => {});
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      if (this.pc.connectionState === 'connected') {
        callAudio.playConnectedChime();
        onStateChange('connected');
      } else if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
        onStateChange('ended');
      }
    };

    // Set Remote Offer
    const offerDesc = new RTCSessionDescription(callData.offer);
    await this.pc.setRemoteDescription(offerDesc);

    // Create Answer
    const answerDesc = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answerDesc);

    await updateDoc(callDocRef, {
      answer: {
        type: answerDesc.type,
        sdp: answerDesc.sdp,
      },
      status: 'connected',
      connectedAt: serverTimestamp(),
    });

    callAudio.playConnectedChime();
    onStateChange('connected');

    // Listen for Caller ICE Candidates
    const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
    this.unsubCandidates = onSnapshot(callerCandidatesCol, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidateData = change.doc.data();
          try {
            await this.pc?.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch {}
        }
      });
    });

    // Listen for call ending from caller
    this.unsubDoc = onSnapshot(callDocRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.status === 'ended' || data.status === 'declined') {
        callAudio.playEndTone();
        onStateChange(data.status);
        this.cleanup();
      }
    });
  }

  // End or hang up call
  public async endCall(callId?: string) {
    callAudio.playEndTone();
    const targetId = callId || this.activeCallId;
    if (targetId) {
      try {
        await updateDoc(doc(db, 'calls', targetId), {
          status: 'ended',
          endedAt: serverTimestamp(),
        });
      } catch {}
    }
    this.cleanup();
  }

  // Decline call
  public async declineCall(callId: string) {
    callAudio.stopAll();
    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'declined',
        endedAt: serverTimestamp(),
      });
    } catch {}
    this.cleanup();
  }

  // Toggle microphone
  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  // Toggle video track
  public toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  // Switch between front and back camera (flip camera)
  public async switchCamera(): Promise<'user' | 'environment'> {
    if (!this.localStream) return this.currentFacingMode;
    const currentVideoTrack = this.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) return this.currentFacingMode;
    const nextFacing = this.currentFacingMode === 'user' ? 'environment' : 'user';
    this.currentFacingMode = nextFacing;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (newTrack) {
          if (this.pc) {
            const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(newTrack);
            }
          }
          currentVideoTrack.stop();
          this.localStream.removeTrack(currentVideoTrack);
          this.localStream.addTrack(newTrack);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Camera flip not supported or single camera:', err);
    }
    return this.currentFacingMode;
  }

  // Cleanup peer connection and listeners without stopping local tracks yet
  private cleanupPeerOnly() {
    callAudio.stopAll();
    if (this.unsubDoc) {
      this.unsubDoc();
      this.unsubDoc = null;
    }
    if (this.unsubCandidates) {
      this.unsubCandidates();
      this.unsubCandidates = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  // Full cleanup of media streams, sockets, and timers
  public cleanup() {
    this.cleanupPeerOnly();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    this.activeCallId = null;
  }
}

export const webrtcService = new WebRTCManager();
