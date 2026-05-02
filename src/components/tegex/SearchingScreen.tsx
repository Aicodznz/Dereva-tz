import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation2, X } from 'lucide-react';
import { Ride } from '../../types/trip.types';

interface SearchingScreenProps {
  ride: Ride | null;
  onCancel: () => void;
  onTimeout: () => void;
}

export const SearchingScreen: React.FC<SearchingScreenProps> = ({ ride, onCancel, onTimeout }) => {
  const [dots, setDots] = useState('');
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    `Inatafuta madereva wa ${ride?.vehicleType === 'mini' ? 'Gari' : ride?.vehicleType === 'bajaj' ? 'Bajaji' : 'Pikipiki'} Karibu Nawe...`,
    "Inachambua madereva walio karibu nawe...",
    "Tunatuma ombi lako kwa dereva mwenye usafiri husika...",
    "Tafadhali subiri kidogo, tunakutafutia dereva bora..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % statuses.length);
    }, 3000);
    return () => clearInterval(statusInterval);
  }, [statuses.length]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onTimeout();
    }, 5 * 60 * 1000); // 5 minutes timeout
    return () => clearTimeout(timeout);
  }, [onTimeout]);

  return (
    <div 
      className="h-full w-full bg-[#0a0a0f]/95 backdrop-blur-3xl flex flex-col items-center p-6 pt-32 pb-32 overflow-y-auto relative z-[100] pointer-events-auto no-scrollbar"
    >
      {/* Top Ride Details Card */}
      <motion.div 
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full bg-[#111118]/90 border border-white/10 rounded-[32px] p-5 shadow-2xl z-20 shrink-0 mb-8"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <MapPin className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-0.5">UNATOKEA</p>
              <p className="text-sm font-bold text-white truncate leading-tight">{ride?.pickup?.address || "Eneo lako..."}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/30">
              <Navigation2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-0.5">UNAKWENDA</p>
              <p className="text-sm font-bold text-white truncate leading-tight">{ride?.destination?.address || "Andika..."}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-xl border border-white/5">
                {ride?.vehicleType === 'mini' ? '🚗' : ride?.vehicleType === 'bajaj' ? '🛺' : '🏍️'}
              </div>
              <div>
                <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">{ride?.vehicleType || 'Gari'}</p>
                <p className="text-xs font-black text-white italic">Usafiri wa Haraka</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">GHARAMA</p>
              <p className="text-lg font-black text-[#7F77DD]">TZS {ride?.fare?.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Center Radar - Non-flex container to avoid pushing */}
      <div className="flex flex-col items-center justify-center w-full py-6 shrink-0">
        <div className="relative flex items-center justify-center w-full aspect-square max-w-[140px]">
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8 }}
                className="absolute border border-[#7F77DD]/40 rounded-full w-full h-full"
              />
            ))}
          </div>
          <div className="relative z-10 w-12 h-12 bg-emerald-500 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Bottom Status & Cancel */}
      <div className="w-full space-y-5 mt-4 shrink-0 pb-10">
        <div className="text-center">
          <h2 className="text-xl font-black text-white drop-shadow-xl mb-3 tracking-tight">
            Inatafuta Dereva{dots}
          </h2>
          <AnimatePresence mode="wait">
            <motion.div 
              key={statusIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-2 bg-[#7F77DD]/20 backdrop-blur-xl rounded-full border border-[#7F77DD]/40 inline-block mb-4"
            >
              <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] italic">
                {ride ? statuses[statusIndex] : "Inatayarisha..."}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <button 
          onClick={onCancel}
          className="w-full h-16 bg-white text-black rounded-[24px] font-black italic uppercase text-sm tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <X className="w-6 h-6 stroke-[3]" />
          GHAIRI SAFARI
        </button>
      </div>
    </div>
  );
};
