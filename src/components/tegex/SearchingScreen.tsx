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

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onTimeout();
    }, 5 * 60 * 1000); // 5 minutes timeout
    return () => clearTimeout(timeout);
  }, [onTimeout]);

  if (!ride) return null;

  return (
    <motion.div 
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="absolute inset-0 z-[100] bg-[#0a0a0f] flex flex-col items-center p-6 pt-20 overflow-hidden"
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
        <p className="text-[#6b6b8a] text-sm font-medium">Hii inaweza kuchukua sekunde chache</p>
      </div>

      {/* Summary Card */}
      <div className="absolute bottom-8 left-6 right-6 space-y-6">
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-[32px] p-6 shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-[#1D9E75] mt-1.5 shrink-0" />
              <p className="text-xs font-bold text-[#f0eeff] truncate">{ride.pickup.address}</p>
            </div>
            <div className="w-px h-4 bg-[#1e1e2e] ml-1" />
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-[#D85A30] mt-1.5 shrink-0" />
              <p className="text-xs font-bold text-[#f0eeff] truncate">{ride.destination.address}</p>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-[#1e1e2e] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {ride.vehicleType === 'mini' ? '🚗' : ride.vehicleType === 'bajaj' ? '🛺' : '🏍️'}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">{ride.vehicleType}</p>
                <p className="text-sm font-black text-[#f0eeff]">Usafiri wa Haraka</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">Gharama</p>
              <p className="text-lg font-black text-[#7F77DD]">TZS {ride.fare.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onCancel}
          className="w-full text-sm font-black text-[#D85A30] hover:text-[#D85A30]/80 transition-colors py-2 uppercase tracking-widest"
        >
          Ghairi Safari
        </button>
      </div>
    </motion.div>
  );
};
