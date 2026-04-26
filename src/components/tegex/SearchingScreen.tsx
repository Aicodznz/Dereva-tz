import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, X } from 'lucide-react';
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
      className="flex-1 w-full bg-[#0a0a0f] flex flex-col items-center p-6 pt-20 overflow-hidden relative z-[100]"
    >
      <div className="relative flex items-center justify-center w-full aspect-square max-w-[300px]">
        {/* Radar Rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeOut"
            }}
            className="absolute border-2 border-[#7F77DD] rounded-full w-full h-full"
          />
        ))}
        
        {/* Center Pin */}
        <div className="relative z-10 w-12 h-12 bg-[#1D9E75] rounded-full border-4 border-white shadow-[0_0_20px_rgba(29,158,117,0.5)] flex items-center justify-center">
          <MapPin className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="mt-12 text-center space-y-2">
        <h2 className="text-2xl font-black text-[#f0eeff]">Inatafuta Dereva Karibu Nawe{dots}</h2>
        <motion.p 
          key={statusIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[#6b6b8a] text-sm font-medium min-h-[40px] px-8"
        >
          {ride ? statuses[statusIndex] : "Inatayarisha utafutaji wa haraka..."}
        </motion.p>
      </div>

      {/* Summary Card */}
      <div className="absolute bottom-8 left-6 right-6 space-y-6">
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-[32px] p-6 shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1D9E75] mt-1.5 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none mb-1">Unatokea</p>
                <p className="text-xs font-bold text-[#f0eeff] truncate">{ride?.pickup.address || "Tafadhali subiri..."}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D85A30] mt-1.5 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none mb-1">Unakwenda</p>
                <p className="text-xs font-bold text-[#f0eeff] truncate">{ride?.destination.address || "Tafadhali subiri..."}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-[#1e1e2e] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {ride?.vehicleType === 'mini' ? '🚗' : ride?.vehicleType === 'bajaj' ? '🛺' : '🏍️'}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">{ride?.vehicleType || 'Taxi'}</p>
                <p className="text-xs font-black text-[#f0eeff]">Usafiri wa Haraka</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">Gharama</p>
              <p className="text-lg font-black text-[#7F77DD]">TZS {ride?.fare?.toLocaleString() || "0"}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onCancel}
          className="w-full h-14 bg-[#0a0a0f] border border-[#1e1e2e] text-[#f0eeff] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform"
        >
          Ghairi Safari
        </button>
      </div>
    </div>
  );
};
