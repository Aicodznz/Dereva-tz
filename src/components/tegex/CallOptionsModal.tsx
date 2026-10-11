import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, Smartphone, X, ShieldCheck, Sparkles } from 'lucide-react';
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
    <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 text-white p-5 shadow-2xl relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border border-teal-500/40 bg-neutral-800">
              <img
                src={targetUser.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.id}`}
                alt={targetUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h4 className="text-sm font-black italic uppercase leading-none">{targetUser.name}</h4>
              <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider mt-0.5">
                {targetUser.role === 'driver' ? 'Dereva Wako' : 'Mteja / Abiria'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2.5 my-4">
          {/* Option 1: In-App Voice Call (Free WebRTC) */}
          <button
            onClick={() => {
              onStartInAppCall('audio');
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl bg-teal-600/15 hover:bg-teal-600/25 border border-teal-500/40 flex items-center justify-between group transition-all text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shadow-md">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black uppercase text-teal-300">Simu ya Sauti (In-App VoIP)</p>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[8px] font-black uppercase">
                    Bure
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 font-medium">
                  WebRTC HD Call · Bila salio la simu wala kutoa namba yako
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-teal-400 opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Option 2: In-App Video Call (WebRTC Video) */}
          <button
            onClick={() => {
              onStartInAppCall('video');
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-between group transition-all text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black uppercase text-indigo-300">Video Call ya Moja kwa Moja</p>
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[8px] font-black uppercase">
                    HD Video
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 font-medium">
                  Onana uso kwa uso kutambua eneo na dereva/mteja
                </p>
              </div>
            </div>
          </button>

          {/* Option 3: Standard Cellular Phone Call (tel:) */}
          <button
            onClick={() => {
              onCallCellPhone();
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 flex items-center justify-between group transition-all text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-700 text-neutral-300 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-neutral-200">Piga Simu ya Kawaida (GSM)</p>
                <p className="text-[10px] text-neutral-400 font-medium">
                  Piga namba ya simu ya mkononi kupitia laini yako
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-1.5 text-[9.5px] text-neutral-500 font-medium text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
          <span>Mawasiliano yanalindwa na mfumo wa WebRTC wa Papo Hapo</span>
        </div>
      </motion.div>
    </div>
  );
};
