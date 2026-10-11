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
  VolumeX,
  ShieldCheck,
  ChevronDown,
  Maximize2,
  RotateCw,
  Wifi,
  Sparkles,
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
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isSwappedVideo, setIsSwappedVideo] = useState(false);
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
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
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
            }
          },
          (status) => {
            setCallStatus(status);
            if (status === 'connected') {
              startTimer();
            } else if (status === 'ended' || status === 'declined') {
              stopTimer();
              setTimeout(() => onClose(), 1200);
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

  // Attach media streams when elements or state change
  useEffect(() => {
    if (localVideoRef.current && webrtcService.localStream) {
      localVideoRef.current.srcObject = webrtcService.localStream;
    }
    if (remoteVideoRef.current && webrtcService.remoteStream) {
      remoteVideoRef.current.srcObject = webrtcService.remoteStream;
    }
    if (remoteAudioRef.current && webrtcService.remoteStream) {
      remoteAudioRef.current.srcObject = webrtcService.remoteStream;
    }
  }, [callStatus, isVideoEnabled, isSwappedVideo]);

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
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        },
        (status) => {
          setCallStatus(status);
          if (status === 'connected') {
            startTimer();
          } else if (status === 'ended' || status === 'declined') {
            stopTimer();
            setTimeout(() => onClose(), 1200);
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
    setTimeout(() => onClose(), 600);
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

  const handleFlipCamera = async () => {
    if (isFlippingCamera) return;
    setIsFlippingCamera(true);
    await webrtcService.switchCamera();
    if (localVideoRef.current && webrtcService.localStream) {
      localVideoRef.current.srcObject = webrtcService.localStream;
    }
    setTimeout(() => setIsFlippingCamera(false), 500);
  };

  const handleToggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = next ? 1.0 : 0.3;
      }
      return next;
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  // Minimized Floating PiP Pill
  if (isMinimized) {
    return (
      <motion.div
        drag
        dragElastic={0.1}
        className="fixed bottom-24 right-4 z-[9999] bg-neutral-900/95 text-white border border-teal-500/50 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 backdrop-blur-xl cursor-grab active:cursor-grabbing"
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
          <p className="text-xs font-black truncate max-w-[100px]">{otherUser.name}</p>
          <p className="text-[10px] text-teal-400 font-mono font-bold">
            {callStatus === 'connected' ? formatDuration(callDuration) : 'Inapiga...'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 cursor-pointer"
            title="Panua"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleHangup}
            className="p-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            title="Kata"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  const isVideoModeActive = callType === 'video' && isVideoEnabled;

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black overflow-hidden flex flex-col select-none touch-none">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* FULLSCREEN MAIN BACKGROUND: Video or Luxurious Audio Gradient */}
      {isVideoModeActive ? (
        <div className="absolute inset-0 w-full h-full bg-neutral-950 overflow-hidden">
          {/* Main Remote Video Stream (or swapped local stream) */}
          <video
            ref={isSwappedVideo ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={isSwappedVideo}
            className="w-full h-full object-cover"
          />

          {/* Fallback avatar if remote camera hasn't sent video yet */}
          {callStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl mb-4 animate-pulse">
                <img
                  src={otherUser.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.id}`}
                  alt={otherUser.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-white text-sm font-black uppercase tracking-wider">
                Inaunganisha Video ya Moja kwa Moja...
              </p>
            </div>
          )}
        </div>
      ) : (
        /* AUDIO CALL: Fullscreen Immersive Gradient & Animated Acoustics */
        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-slate-950 via-[#0d131f] to-neutral-950 flex flex-col items-center justify-center overflow-hidden">
          {/* Subtle Ambient Radial Glows */}
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Central Acoustic Avatar with Pulses */}
          <div className="relative flex items-center justify-center mb-8">
            {callStatus === 'connected' ? (
              <>
                <div className="absolute -inset-10 rounded-full border border-teal-500/20 animate-ping opacity-40 duration-1000" />
                <div className="absolute -inset-6 rounded-full bg-teal-500/10 animate-pulse" />
              </>
            ) : (
              <>
                <div className="absolute -inset-8 rounded-full bg-amber-500/15 animate-ping opacity-50 duration-1000" />
                <div className="absolute -inset-4 rounded-full bg-teal-500/10 animate-pulse" />
              </>
            )}

            <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-white/20 shadow-[0_0_60px_rgba(20,184,166,0.3)] bg-neutral-900 relative z-10">
              <img
                src={otherUser.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.id}`}
                alt={otherUser.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Participant Details */}
          <div className="flex flex-col items-center text-center z-10 px-6">
            <h2 className="text-2xl sm:text-3xl font-black italic tracking-wide text-white uppercase drop-shadow-md">
              {otherUser.name}
            </h2>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-xs font-black uppercase tracking-wider mt-2">
              <span>{otherUser.role === 'driver' ? '🚗 Dereva Wako' : '👤 Mteja / Abiria'}</span>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  callStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="text-xs font-black uppercase tracking-widest text-neutral-300 font-mono">
                {callStatus === 'calling' && 'Inaita dereva / mteja...'}
                {callStatus === 'ringing' && (isIncoming ? 'Simu Inaingia...' : 'Inalia (Ringing)...')}
                {callStatus === 'connected' && `Imeunganishwa · ${formatDuration(callDuration)}`}
                {callStatus === 'ended' && 'Simu Imekatika'}
                {callStatus === 'declined' && 'Simu Imekataliwa'}
              </span>
            </div>

            {callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 mt-3 text-[11px] text-teal-400 font-medium">
                <Wifi className="w-3.5 h-3.5" />
                <span>HD Voice · 0% Makato ya Salio (Bure)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PICTURE-IN-PICTURE (PiP) LOCAL CAMERA (Top-Left, Exactly like image.png) */}
      {isVideoModeActive && (
        <motion.div
          drag
          dragConstraints={{ left: 10, right: 260, top: 20, bottom: 480 }}
          dragElastic={0.1}
          onClick={() => setIsSwappedVideo((prev) => !prev)}
          className="absolute top-10 left-4 sm:top-12 sm:left-6 w-24 h-36 sm:w-28 sm:h-44 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl z-40 bg-neutral-900 cursor-pointer active:scale-95 transition-transform"
          title="Gusa kubadilisha video ya mbele"
        >
          <video
            ref={isSwappedVideo ? remoteVideoRef : localVideoRef}
            autoPlay
            playsInline
            muted={!isSwappedVideo}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[8px] font-black uppercase text-white/90">
            {isSwappedVideo ? otherUser.name.split(' ')[0] : 'Wewe'}
          </div>
        </motion.div>
      )}

      {/* TOP HEADER OVERLAY (Matching image.png: Minimize Chevron on left, Duration in center) */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-6 pb-8 px-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-auto">
        {/* Minimize Button (Left ChevronDown like image.png) */}
        <button
          onClick={() => setIsMinimized(true)}
          className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/10"
          title="Punguza Dirisha"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Center Title & Duration (like image.png timestamp) */}
        <div className="flex flex-col items-center text-center">
          <p className="text-sm sm:text-base font-black text-white tracking-wider drop-shadow-md">
            {callStatus === 'connected' ? formatDuration(callDuration) : 'Papo Hapo WebRTC'}
          </p>
          {isVideoModeActive && (
            <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider drop-shadow-xs">
              {otherUser.name} · {otherUser.role === 'driver' ? 'Dereva' : 'Mteja'}
            </p>
          )}
        </div>

        {/* Right Encrypted Badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-[9px] font-bold text-teal-300">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden xs:inline">Encrypted</span>
        </div>
      </div>

      {/* BOTTOM FLOATING CONTROLS (Exact clean circular layout from image.png) */}
      <div className="absolute bottom-0 left-0 right-0 z-40 pb-8 pt-10 px-6 flex flex-col items-center bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-auto">
        {isIncoming && callStatus === 'ringing' ? (
          /* Incoming Call Actions: Decline (Red) & Answer (Green) */
          <div className="flex items-center justify-center gap-14 w-full">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleDecline}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl active:scale-95 transition-all cursor-pointer"
                title="Kata"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs font-black uppercase text-red-400 tracking-wider">Kata</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAnswer}
                className="w-18 h-18 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-95 transition-all cursor-pointer animate-bounce"
                title="Pokea"
              >
                <Phone className="w-8 h-8" />
              </button>
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Pokea</span>
            </div>
          </div>
        ) : (
          /* Active Call Controls: Matching image.png circular buttons row */
          <div className="flex items-center justify-center gap-4 sm:gap-6 w-full max-w-sm">
            {/* 1. Mic Button (White circle when active, Red when muted - like image.png) */}
            <button
              onClick={handleToggleMute}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-500/90 text-white border-2 border-red-400 shadow-red-500/30'
                  : 'bg-white text-neutral-900 hover:bg-neutral-100 shadow-white/20'
              }`}
              title={isMuted ? 'Washa Kipaza' : 'Zima Kipaza'}
            >
              {isMuted ? <MicOff className="w-6 h-6 stroke-[2.5]" /> : <Mic className="w-6 h-6 stroke-[2.5]" />}
            </button>

            {/* 2. End Call Red Button (Center, prominent red circle - like image.png) */}
            <button
              onClick={handleHangup}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_35px_rgba(220,38,38,0.5)] active:scale-95 transition-all cursor-pointer"
              title="Kata Simu"
            >
              <PhoneOff className="w-7 h-7 stroke-[2.5]" />
            </button>

            {/* 3. Video / Camera Button (White circle when video on, translucent when off - like image.png) */}
            <button
              onClick={handleToggleVideo}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all cursor-pointer ${
                isVideoEnabled
                  ? 'bg-white text-neutral-900 hover:bg-neutral-100 shadow-white/20'
                  : 'bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/20'
              }`}
              title={isVideoEnabled ? 'Zima Video' : 'Washa Video Call'}
            >
              {isVideoEnabled ? <Video className="w-6 h-6 stroke-[2.5]" /> : <VideoOff className="w-6 h-6 stroke-[2.5]" />}
            </button>

            {/* 4. Camera Flip (Front/Back camera) - only in video mode */}
            {isVideoEnabled && (
              <button
                onClick={handleFlipCamera}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                  isFlippingCamera ? 'rotate-180 transition-transform duration-500' : ''
                }`}
                title="Geuza Kamera (Front/Back)"
              >
                <RotateCw className="w-5 h-5 stroke-[2.2]" />
              </button>
            )}

            {/* 5. Speaker Toggle Button */}
            <button
              onClick={handleToggleSpeaker}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                isSpeakerOn
                  ? 'bg-black/50 text-white'
                  : 'bg-red-500/30 text-red-300 border-red-400/40'
              }`}
              title={isSpeakerOn ? 'Spika Imewashwa' : 'Spika Imezimwa'}
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5 stroke-[2.2]" /> : <VolumeX className="w-5 h-5 stroke-[2.2]" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
