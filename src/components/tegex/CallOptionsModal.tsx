import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, Smartphone, X, ShieldCheck, Sparkles, ChevronRight } from 'lucide-react';
import { CallParticipant, CallType } from '../../utils/webrtcService';

interface CallOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: CallParticipant;
  onStartInAppCall: (type: CallType) => void;
  onCallCellPhone: () => void;
}

export const CallOptionsModal: React.FC<CallOptionsModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onStartInAppCall,
  onCallCellPhone,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-sm sm:max-w-md rounded-[32px] bg-[#0e1017]/95 border border-white/15 text-white p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative select-none ring-1 ring-white/10"
      >
        {/* Subtle Drag Handle on Mobile */}
        <div className="w-10 h-1.5 rounded-full bg-neutral-700/80 mx-auto mb-4 sm:hidden" />

        {/* Header Profile Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-emerald-400/60 bg-neutral-900 shadow-lg shadow-emerald-500/10">
                <img
                  src={targetUser.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.id}`}
                  alt={targetUser.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0e1017] animate-pulse" />
            </div>

            <div className="text-left min-w-0">
              <h3 className="text-base font-black italic tracking-wide text-white uppercase truncate">
                {targetUser.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9.5px] font-black uppercase tracking-wider">
                  {targetUser.role === 'driver' ? '🚗 Dereva Wako' : '👤 Mteja / Abiria'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 transition-all cursor-pointer active:scale-95"
            title="Funga"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-3 my-4">
          {/* Option 1: In-App Voice Call (Free) */}
          <button
            type="button"
            onClick={() => {
              onStartInAppCall('audio');
              onClose();
            }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-emerald-950/20 hover:from-emerald-900/50 hover:to-teal-900/30 border border-emerald-500/40 hover:border-emerald-400/70 flex items-center justify-between group transition-all text-left cursor-pointer active:scale-[0.98] shadow-md shadow-emerald-950/20"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <Phone className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-emerald-300">
                    Simu ya Sauti (Ndani ya App)
                  </p>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[8px] font-black uppercase tracking-wider shrink-0">
                    Bure
                  </span>
                </div>
                <p className="text-[10.5px] text-neutral-300 font-medium mt-0.5 leading-snug">
                  Sauti safi ya HD · Bila salio la simu wala kufichua namba yako
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-400/60 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </button>

          {/* Option 2: In-App Video Call (HD Video) */}
          <button
            type="button"
            onClick={() => {
              onStartInAppCall('video');
              onClose();
            }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/20 hover:from-indigo-900/50 hover:to-purple-900/30 border border-indigo-500/40 hover:border-indigo-400/70 flex items-center justify-between group transition-all text-left cursor-pointer active:scale-[0.98] shadow-md shadow-indigo-950/20"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <Video className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-indigo-300">
                    Video Call ya Moja kwa Moja
                  </p>
                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 text-[8px] font-black uppercase tracking-wider shrink-0">
                    HD Video
                  </span>
                </div>
                <p className="text-[10.5px] text-neutral-300 font-medium mt-0.5 leading-snug">
                  Onana uso kwa uso kutambua eneo na dereva/mteja mara moja
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-indigo-400/60 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </button>

          {/* Option 3: Standard Cellular Phone Call (GSM) */}
          <button
            type="button"
            onClick={() => {
              onCallCellPhone();
              onClose();
            }}
            className="w-full p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 flex items-center justify-between group transition-all text-left cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800 text-neutral-300 flex items-center justify-center shrink-0 group-hover:bg-neutral-700 transition-colors">
                <Smartphone className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-neutral-200">
                  Piga Simu ya Kawaida (GSM)
                </p>
                <p className="text-[10.5px] text-neutral-400 font-medium mt-0.5 leading-snug">
                  Piga namba ya simu ya mkononi kupitia laini yako ya simu
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-neutral-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
          </button>
        </div>

        {/* Footer Security Badge */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 font-medium text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Mawasiliano yanalindwa kwa usalama wa hali ya juu (End-to-End Encrypted)</span>
        </div>
      </motion.div>
    </div>
  );
};
