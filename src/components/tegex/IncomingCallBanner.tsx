import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Video, Maximize2, Bell, ShieldCheck } from 'lucide-react';
import { CallParticipant, CallType } from '../../utils/webrtcService';
import { callNotificationService } from '../../utils/callNotificationService';

interface IncomingCallBannerProps {
  isOpen: boolean;
  caller: CallParticipant;
  callType: CallType;
  onAnswer: () => void;
  onDecline: () => void;
  onExpand: () => void;
}

export const IncomingCallBanner: React.FC<IncomingCallBannerProps> = ({
  isOpen,
  caller,
  callType,
  onAnswer,
  onDecline,
  onExpand,
}) => {
  const [notificationPerm, setNotificationPerm] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (callNotificationService.isSupported()) {
      setNotificationPerm(callNotificationService.getPermission());
    }
  }, [isOpen]);

  const handleRequestPermission = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await callNotificationService.requestPermission();
    setNotificationPerm(result);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[10000] w-[94vw] max-w-md rounded-[28px] bg-[#0c1017]/95 border border-emerald-500/40 text-white p-3.5 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl ring-1 ring-white/10 select-none"
      >
        {/* Top Floating Notification Tag */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px]">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Simu Inayoingia Papo Hapo</span>
          </div>

          <div className="flex items-center gap-1 text-neutral-400 font-medium">
            <ShieldCheck className="w-3 h-3 text-teal-400" />
            <span>Salama & Bure</span>
          </div>
        </div>

        {/* Main Caller Row */}
        <div className="flex items-center gap-3">
          {/* Avatar with Pulsing Halo */}
          <div
            onClick={onExpand}
            className="relative cursor-pointer shrink-0"
            title="Panua Skrini Nzima"
          >
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md bg-neutral-900">
              <img
                src={caller.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${caller.id}`}
                alt={caller.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0c1017] flex items-center justify-center">
              {callType === 'video' ? (
                <Video className="w-2.5 h-2.5 text-white" />
              ) : (
                <Phone className="w-2.5 h-2.5 text-white" />
              )}
            </span>
          </div>

          {/* Caller Details */}
          <div
            onClick={onExpand}
            className="min-w-0 flex-1 cursor-pointer"
            title="Panua Skrini Nzima"
          >
            <h4 className="text-sm sm:text-base font-black text-white italic tracking-wide uppercase truncate">
              {caller.name}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9.5px] font-bold text-neutral-200 uppercase tracking-wider">
                {caller.role === 'driver' ? '🚗 Dereva Wako' : '👤 Mteja / Abiria'}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold animate-pulse">
                {callType === 'video' ? '🎥 Video' : '📞 Sauti'}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons on Notification */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Decline Button (Red) */}
            <button
              type="button"
              onClick={onDecline}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-90 transition-all cursor-pointer"
              title="Kata Simu"
            >
              <PhoneOff className="w-5 h-5 stroke-[2.3]" />
            </button>

            {/* Answer Button (Green) - "Call from Notification" */}
            <button
              type="button"
              onClick={onAnswer}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-90 transition-all cursor-pointer animate-bounce"
              title="Pokea Simu kutoka Taarifa (Answer Call)"
            >
              <Phone className="w-6 h-6 stroke-[2.3]" />
            </button>

            {/* Expand / Maximize Button */}
            <button
              type="button"
              onClick={onExpand}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition-all cursor-pointer ml-0.5 hidden xs:flex"
              title="Panua Skrini Nzima"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Optional System Notification Permission Prompt Bar */}
        {notificationPerm === 'default' && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-neutral-300">
            <span className="flex items-center gap-1.5 truncate">
              <Bell className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Pokea simu hata app ikiwa imefungwa / screen imezimwa?</span>
            </span>
            <button
              type="button"
              onClick={handleRequestPermission}
              className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold shrink-0 cursor-pointer transition-colors"
            >
              Ruhusu
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
