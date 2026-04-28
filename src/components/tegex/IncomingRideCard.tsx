import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, Zap, Map as MapIcon, X, Star, User, ArrowRight } from 'lucide-react';
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
      className="fixed bottom-4 inset-x-4 z-[1000] bg-[#111118] border-2 border-[#7F77DD]/30 p-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
    >
      <div className="flex flex-col gap-5">
        <div className="text-center space-y-1">
          <div className="bg-[#7F77DD] text-white text-[10px] font-black px-4 py-1 rounded-full italic inline-block tracking-widest shadow-[0_4px_12px_rgba(127,119,221,0.4)]">
            ⚡ OMBI JIPYA!
          </div>
        </div>

        <div className="flex items-center justify-center py-2">
          <div className="relative w-24 h-24">
             <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="44" stroke="#1e1e2e" strokeWidth="6" fill="none" />
                <motion.circle 
                  cx="48" cy="48" r="44" stroke="#7F77DD" strokeWidth="6" fill="none"
                  initial={{ pathLength: 1 }}
                  animate={{ pathLength: 0 }}
                  transition={{ duration: 15, ease: "linear" }}
                />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center text-4xl font-black italic text-white font-mono">
               [{timeLeft}]
             </div>
          </div>
        </div>

        <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-3xl p-6 space-y-4">
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold shrink-0">📍</div>
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-black text-white leading-tight">{ride.pickup.address}</p>
                <p className="text-[10px] font-bold text-neutral-600 mt-1">
                   {(ride as any).distanceToPickup?.toFixed(1) || '0.5'} km kutoka kwako · ~{ride.duration || '22'} dak safari
                </p>
             </div>
          </div>
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold shrink-0">🏁</div>
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-black text-white leading-tight">{ride.destination.address}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-4 rounded-2xl flex items-center gap-3">
              <User className="w-5 h-5 text-[#7F77DD]" />
              <div>
                 <p className="text-[9px] font-black text-neutral-500 uppercase">Mteja</p>
                 <p className="text-xs font-black text-white">★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}</p>
              </div>
           </div>
           <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-4 rounded-2xl flex items-center gap-3">
              <Car className="w-5 h-5 text-[#7F77DD]" />
              <div>
                 <p className="text-[9px] font-black text-neutral-500 uppercase">AINA</p>
                 <p className="text-xs font-black text-white uppercase italic">{ride.vehicleType === 'bike' ? 'PIKIPIKI' : ride.vehicleType === 'bajaj' ? 'BAJAJI' : 'GARI'}</p>
              </div>
           </div>
        </div>

        <div className="flex items-center justify-between px-2">
           <p className="text-xs font-black text-neutral-500 uppercase tracking-widest italic">MAOKOTO:</p>
           <h3 className="text-3xl font-black italic text-[#f0eeff] tracking-tighter">TZS {(ride?.fare ?? 0).toLocaleString()}</h3>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onDecline}
            className="flex-1 h-16 rounded-2xl border-2 border-red-500/20 bg-red-500/5 text-red-500 font-black uppercase italic text-sm active:scale-95 transition-transform"
          >
            KATAA
          </button>
          <button 
            onClick={onAccept}
            className="flex-[2] h-16 rounded-2xl bg-[#7F77DD] text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(127,119,221,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2 group"
          >
            KUBALI <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
