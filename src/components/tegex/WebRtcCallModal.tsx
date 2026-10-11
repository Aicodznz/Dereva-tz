import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  ShieldCheck,
  Minimize2,
  Maximize2,
  Sparkles,
  Wifi,
} from 'lucide-react';
import {
  webrtcService,
  CallParticipant,
  CallType,
  CallStatus,
} from '../../utils/webrtcService';
import { callAudio } from '../../utils/callAudio';

interface WebRtcCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  currentUser: CallParticipant;
  otherUser: CallParticipant;
  initialCallType?: CallType;
  isIncoming?: boolean;
  incomingCallId?: string;
}

export const WebRtcCallModal: React.FC<WebRtcCallModalProps> = ({
  isOpen,
  onClose,
  rideId,
  currentUser,
  otherUser,
  initialCallType = 'audio',
  isIncoming = false,
  incomingCallId,
}) => {
  const [callType, setCallType] = useState<CallType>(initialCallType);
  const [callStatus, setCallStatus] = useState<CallStatus>(isIncoming ? 'ringing' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialCallType === 'video');
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize or respond to call
  useEffect(() => {
    if (!isOpen) {
      webrtcService.cleanup();
      callAudio.stopAll();
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
      return;
    }

    setCallType(initialCallType);
    setIsVideoEnabled(initialCallType === 'video');

    if (isIncoming && incomingCallId) {
      setCallStatus('ringing');
      callAudio.startIncomingRingtone();
    } else {
      // Outgoing call initiation
      setCallStatus('calling');
      webrtcService
        .createCall(
          rideId,
          currentUser,
          otherUser,
          initialCallType,
          (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          },
          (status) => {
            setCallStatus(status);
            if (status === 'connected') {
              startTimer();
            } else if (status === 'ended' || status === 'declined') {
              stopTimer();
              setTimeout(() => onClose(), 1500);
            }
          }
        )
        .then(() => {
          if (localVideoRef.current && webrtcService.localStream) {
            localVideoRef.current.srcObject = webrtcService.localStream;
          }
        })
        .catch((err) => {
          console.error('[WebRTC] Call error:', err);
          setCallStatus('ended');
          setTimeout(() => onClose(), 1200);
        });
    }

    return () => {
      webrtcService.cleanup();
      callAudio.stopAll();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isIncoming, incomingCallId, rideId]);

  // Attach local stream when available
  useEffect(() => {
    if (localVideoRef.current && webrtcService.localStream) {
      localVideoRef.current.srcObject = webrtcService.localStream;
    }
    if (remoteVideoRef.current && webrtcService.remoteStream) {
      remoteVideoRef.current.srcObject = webrtcService.remoteStream;
    }
  }, [callStatus, isVideoEnabled]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleAnswer = async () => {
    if (!incomingCallId) return;
    try {
      setCallStatus('connected');
      await webrtcService.answerCall(
        incomingCallId,
        callType,
        (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        },
        (status) => {
          setCallStatus(status);
          if (status === 'connected') {
            startTimer();
          } else if (status === 'ended' || status === 'declined') {
            stopTimer();
            setTimeout(() => onClose(), 1500);
          }
        }
      );
      if (localVideoRef.current && webrtcService.localStream) {
        localVideoRef.current.srcObject = webrtcService.localStream;
      }
      startTimer();
    } catch (e) {
      console.error('[WebRTC] Answer error:', e);
      handleHangup();
    }
  };

  const handleHangup = async () => {
    stopTimer();
    setCallStatus('ended');
    await webrtcService.endCall(incomingCallId || undefined);
    setTimeout(() => onClose(), 800);
  };

  const handleDecline = async () => {
    if (incomingCallId) {
      await webrtcService.declineCall(incomingCallId);
    }
    onClose();
  };

  const handleToggleMute = () => {
    const isNowActive = webrtcService.toggleMute();
    setIsMuted(!isNowActive);
  };

  const handleToggleVideo = () => {
    const active = webrtcService.toggleVideo();
    setIsVideoEnabled(active);
    if (!active) {
      setCallType('audio');
    } else {
      setCallType('video');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  // Minimized PiP View
  if (isMinimized) {
    return (
      <motion.div
        drag
        dragElastic={0.1}
        className="fixed bottom-24 right-4 z-[9999] bg-neutral-900/95 text-white border border-teal-500/40 rounded-2xl p-3 shadow-2xl flex items-center gap-3 backdrop-blur-md cursor-grab active:cursor-grabbing"
      >
        <div className="relative">
          <img
            src={otherUser.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.id}`}
            alt={otherUser.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-teal-400"
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-neutral-900 animate-pulse" />
        </div>
        <div className="min-w-0 pr-1">
          <p className="text-xs font-black truncate">{otherUser.name}</p>
          <p className="text-[10px] text-teal-400 font-mono font-bold">
            {callStatus === 'connected' ? formatDuration(callDuration) : 'Inapiga...'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200"
            title="Panua"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleHangup}
            className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white"
            title="Kata"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
      {/* Hidden/Pip Videos */}
      <audio ref={remoteVideoRef as any} autoPlay playsInline />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={callType === 'video' ? 'absolute inset-0 w-full h-full object-cover' : 'hidden'}
      />
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={
          callType === 'video'
            ? 'absolute top-6 right-6 w-28 h-40 sm:w-36 sm:h-52 object-cover rounded-2xl border-2 border-teal-400/80 shadow-2xl z-30'
            : 'hidden'
        }
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="relative z-20 w-full max-w-sm rounded-[32px] overflow-hidden bg-neutral-950/90 border border-neutral-800 text-white shadow-2xl p-6 flex flex-col items-center justify-between min-h-[520px]"
      >
        {/* Top Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>WebRTC VoIP Encrypted</span>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 transition-colors"
            title="Punguza Dirisha"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Center Calling Avatar & Info */}
        <div className="flex flex-col items-center text-center my-auto w-full">
          <div className="relative mb-5">
            {/* Pulse Rings */}
            {callStatus === 'ringing' || callStatus === 'calling' ? (
              <>
                <div className="absolute -inset-4 rounded-full bg-teal-500/20 animate-ping opacity-60" />
                <div className="absolute -inset-8 rounded-full bg-teal-500/10 animate-pulse" />
              </>
            ) : null}

            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-teal-500/60 bg-neutral-900 shadow-2xl relative z-10">
              <img
                src={
                  otherUser.photo ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.id}`
                }
                alt={otherUser.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="absolute -bottom-2 -right-2 z-20 p-2 rounded-full bg-teal-600 text-white shadow-lg border border-neutral-900">
              {callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </div>
          </div>

          <h3 className="text-xl font-black italic tracking-wide text-white uppercase">
            {otherUser.name}
          </h3>

          <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mt-1">
            {otherUser.role === 'driver' ? '🚗 Dereva Wako' : '👤 Mteja / Abiria'}
          </p>

          {/* Status Badge */}
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                callStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : callStatus === 'ringing' || callStatus === 'calling'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-200">
              {callStatus === 'calling' && 'Inaita dereva / mteja...'}
              {callStatus === 'ringing' && (isIncoming ? 'Simu Inaingia...' : 'Inalia (Ringing)...')}
              {callStatus === 'connected' && `Imeunganishwa · ${formatDuration(callDuration)}`}
              {callStatus === 'ended' && 'Simu Imekatika'}
              {callStatus === 'declined' && 'Simu Imekataliwa'}
            </span>
          </div>

          {callStatus === 'connected' && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-400/90 font-mono">
              <Wifi className="w-3 h-3" />
              <span>HD Voice · 0% Makato ya Salio</span>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="w-full mt-auto pt-6">
          {/* Incoming Call Answer / Decline Row */}
          {isIncoming && callStatus === 'ringing' ? (
            <div className="flex items-center justify-around w-full px-4">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={handleDecline}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-[10px] font-bold uppercase text-red-400 mt-1">Kata</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={handleAnswer}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer animate-bounce"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-[10px] font-bold uppercase text-emerald-400 mt-1">Pokea</span>
              </div>
            </div>
          ) : (
            /* Active Call In-Progress Controls */
            <div className="flex items-center justify-around w-full">
              {/* Mic Toggle */}
              <button
                onClick={handleToggleMute}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isMuted ? 'Washa Kipaza' : 'Zima Kipaza'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Video Upgrade / Toggle */}
              <button
                onClick={handleToggleVideo}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isVideoEnabled
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-neutral-300'
                }`}
                title={isVideoEnabled ? 'Zima Video' : 'Washa Video Call'}
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              {/* Hangup Red Button */}
              <button
                onClick={handleHangup}
                className="w-14 h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
                title="Kata Simu"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
