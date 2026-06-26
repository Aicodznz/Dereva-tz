import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation2, X } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useTheme } from 'next-themes';

interface SearchingScreenProps {
  ride: Ride | null;
  onCancel: () => void;
  onTimeout: () => void;
  isMinimized?: boolean;
  isSpectator?: boolean;
}

export const SearchingScreen: React.FC<SearchingScreenProps> = ({ ride, onCancel, onTimeout, isMinimized, isSpectator }) => {
  const [dots, setDots] = useState('');
  const [statusIndex, setStatusIndex] = useState(0);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

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
      className="absolute inset-0 flex flex-col items-center bg-transparent pointer-events-none z-[100]"
    >
      <div className="flex-1 w-full flex flex-col items-center p-6 pt-24 pb-32 overflow-y-auto no-scrollbar pointer-events-none">
        {/* Top Ride Details Card */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              className={`w-full max-w-sm border rounded-[32px] p-5 shadow-2xl z-20 shrink-0 mb-8 pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white border-neutral-200/80'}`}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-0.5">UNATOKEA</p>
                    <p className={`text-sm font-bold truncate leading-tight ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>{ride?.pickup?.address || "Eneo lako..."}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                    <Navigation2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-0.5">UNAKWENDA</p>
                    <p className={`text-sm font-bold truncate leading-tight ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>{ride?.destination?.address || "Andika..."}</p>
                  </div>
                </div>

                <div className={`pt-3 border-t flex items-center justify-between ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'}`}>
                      {ride?.vehicleType === 'mini' ? '🚗' : ride?.vehicleType === 'bajaj' ? '🛺' : '🏍️'}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">{ride?.vehicleType || 'Gari'}</p>
                      <p className={`text-xs font-black italic ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-700'}`}>Usafiri wa Haraka</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">GHARAMA</p>
                    <p className="text-lg font-black text-indigo-500">TZS {ride?.fare?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Bottom Status & Cancel */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-sm space-y-5 mt-4 shrink-0 pb-10 pointer-events-auto"
            >
              <div className="text-center">
                <h2 className="text-xl font-black text-indigo-600 drop-shadow-sm mb-3 tracking-tight italic uppercase animate-pulse">
                  Utafutaji unaendelea{dots}
                </h2>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={statusIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`px-6 py-2 backdrop-blur-xl rounded-full border inline-block mb-4 shadow-md ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'}`}
                  >
                    <p className={`text-[9px] font-black uppercase tracking-[0.2em] italic ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-700'}`}>
                      {ride ? statuses[statusIndex] : "Inatayarisha..."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {!isSpectator && (
                <button 
                  onClick={onCancel}
                  className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-[24px] font-black italic uppercase text-sm tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <X className="w-6 h-6 stroke-[3]" />
                  GHAIRI SAFARI
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
