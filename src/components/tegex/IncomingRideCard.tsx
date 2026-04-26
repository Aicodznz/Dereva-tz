import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, Zap, Map as MapIcon, X, Star } from 'lucide-react';
import { Ride } from '../../types/ride.types';

interface IncomingRideCardProps {
  ride: Ride;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout: () => void;
}

export default function IncomingRideCard({ ride, onAccept, onDecline, onTimeout }: IncomingRideCardProps) {
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeout();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <motion.div 
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-[#111118] border-t border-[#1e1e2e] p-6 pb-12 rounded-t-[40px] shadow-[0_-20px_60px_rgba(127,119,221,0.3)]"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <div className="relative">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="30" stroke="#1e1e2e" strokeWidth="4" fill="none" />
                <motion.circle 
                  cx="32" cy="32" r="30" stroke="#7F77DD" strokeWidth="4" fill="none"
                  initial={{ pathLength: 1 }}
                  animate={{ pathLength: 0 }}
                  transition={{ duration: 15, ease: "linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xl font-black italic text-[#7F77DD]">
                {timeLeft}
              </div>
            </div>
            <div>
              <div className="bg-[#7F77DD]/20 text-[#7F77DD] text-[10px] font-black px-3 py-1 rounded-full mb-1 italic inline-block tracking-widest border border-[#7F77DD]/30">
                ⚡ OMBI JIPYA!
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter -mt-1 leading-none text-white font-mono">
                {ride.vehicleType === 'mini' ? 'TEGEX MINI' : ride.vehicleType === 'bajaj' ? 'TEGEX BAJAJ' : 'TEGEX BODA'}
              </h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-neutral-500">MAPATO</p>
            <h3 className="text-2xl font-black italic text-emerald-500 leading-none">TZS {ride.fare.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-3xl p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="mt-1 w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <div className="flex-1 overflow-hidden">
              <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Pickup</p>
              <p className="text-sm font-bold truncate leading-tight text-white">{ride.pickup.address}</p>
            </div>
          </div>
          
          <div className="relative h-4 ml-[5px]">
            <div className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-emerald-500 to-orange-500 dashed" />
          </div>

          <div className="flex items-start gap-4">
            <div className="mt-1 w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
            <div className="flex-1 overflow-hidden">
              <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Mwisho</p>
              <p className="text-sm font-bold truncate leading-tight text-white">{ride.destination.address}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-around py-4 bg-[#0a0a0f]/50 border-y border-[#1e1e2e] rounded-2xl">
          <div className="flex flex-col items-center">
            <MapIcon className="w-5 h-5 text-[#7F77DD] mb-1" />
            <p className="text-[10px] font-black uppercase italic text-neutral-400">{ride.distance?.toFixed(1) || '12.4'} KM</p>
          </div>
          <div className="w-px h-8 bg-[#1e1e2e]" />
          <div className="flex flex-col items-center">
            <Clock className="w-5 h-5 text-[#7F77DD] mb-1" />
            <p className="text-[10px] font-black uppercase italic text-neutral-400">~{ride.duration || '22'} DAK</p>
          </div>
          <div className="w-px h-8 bg-[#1e1e2e]" />
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1">
               <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
               <p className="text-xs font-black text-white">{ride.customerInfo?.rating?.toFixed(1) || '5.0'}</p>
            </div>
            <p className="text-[8px] font-black uppercase text-neutral-500">RATING</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onDecline}
            className="w-[30%] h-16 rounded-2xl border-2 border-red-500/20 bg-red-500/5 text-red-500 font-black uppercase italic text-sm active:scale-95 transition-transform"
          >
            Kataa
          </button>
          <button 
            onClick={onAccept}
            className="flex-1 h-16 rounded-2xl bg-[#7F77DD] text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(127,119,221,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Kubali <Zap className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
