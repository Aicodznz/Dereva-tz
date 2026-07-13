import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Star, User, ArrowRight, Car, Shield, Navigation } from 'lucide-react';
import { Ride } from '../../types/ride.types';

interface IncomingRideCardProps {
  ride: Ride;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout: () => void;
  theme?: 'light' | 'dark';
}

export default function IncomingRideCard({ ride, onAccept, onDecline, onTimeout, theme = 'dark' }: IncomingRideCardProps) {
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

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-x-0 bottom-4 z-[99999] px-4 pointer-events-none flex justify-center">
      <motion.div 
        initial={{ y: 150, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 150, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 200 }}
        className={`w-full max-w-[390px] pointer-events-auto rounded-[24px] border p-4 space-y-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 ${
          isDark 
            ? 'bg-[#111118]/95 border-neutral-800/80 text-white shadow-black/60' 
            : 'bg-white/95 border-neutral-200/60 text-neutral-850 shadow-neutral-300/30'
        }`}
      >
        {/* Header: Compact Integrated Countdown Timer & Earning Info */}
        <div className="flex items-center justify-between border-b border-neutral-200/30 dark:border-neutral-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            {/* Small Elegant Circular Timer */}
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle 
                  cx="24" cy="24" r="19" 
                  stroke={isDark ? '#1a1a26' : '#f1f5f9'} 
                  strokeWidth="4" 
                  fill="none" 
                />
                <motion.circle 
                  cx="24" cy="24" r="19" 
                  stroke="#7F77DD" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="119.38"
                  animate={{ strokeDashoffset: 119.38 * (1 - timeLeft / 15) }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pt-0.5">
                <span className={`text-[15px] font-black italic font-mono leading-none tracking-tighter ${isDark ? 'text-white' : 'text-neutral-800'}`}>
                  {timeLeft}
                </span>
              </div>
            </div>

            {/* Title Details */}
            <div className="text-left">
              <span className={`inline-block px-1.5 py-0.5 rounded-md italic font-black text-[8px] tracking-wider uppercase ${
                isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-600 text-white'
              }`}>
                ⚡ OMBI JIPYA!
              </span>
              <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mt-0.5 leading-tight">
                Ombi la safari limepokelewa
              </p>
            </div>
          </div>

          {/* Large Price Badge */}
          <div className="text-right">
            <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-0.5 leading-none">MAOKOTO</span>
            <span className="text-[17px] font-black italic text-emerald-500 dark:text-emerald-400 tracking-tighter leading-none">
              TZS {(ride?.fare ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Compact Vertical Route Details */}
        <div className={`relative p-3 rounded-xl border space-y-3 ${
          isDark 
            ? 'bg-[#0a0a0f]/40 border-neutral-850/50' 
            : 'bg-neutral-50/40 border-neutral-150/80'
        }`}>
          {/* Pickup Address */}
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-[12px] font-black text-neutral-800 dark:text-neutral-100 leading-tight truncate">
                {ride.pickup.address}
              </p>
              <p className="text-[8.5px] font-bold text-neutral-400 dark:text-neutral-500 mt-0.5 leading-none">
                Kupakia • {(ride as any).distanceToPickup?.toFixed(1) || '0.5'} km kutoka kwako
              </p>
            </div>
          </div>

          {/* Simple Dotted line */}
          <div className="absolute left-[21px] top-[26px] bottom-[26px] w-0.5 border-l border-dashed border-neutral-300 dark:border-neutral-800 z-0" />

          {/* Destination Address */}
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="w-5 h-5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/10">
              <Navigation className="w-2.5 h-2.5 text-indigo-500 rotate-45" />
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-[12px] font-black text-neutral-800 dark:text-neutral-100 leading-tight truncate">
                {ride.destination.address}
              </p>
              <p className="text-[8.5px] font-bold text-neutral-400 dark:text-neutral-500 mt-0.5 leading-none">
                Kushusha
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic 4-Column Metric Row */}
        <div className={`grid grid-cols-4 gap-1 p-2 rounded-xl text-center border ${
          isDark 
            ? 'bg-[#0a0a0f]/30 border-neutral-850/30' 
            : 'bg-neutral-50/20 border-neutral-150/40'
        }`}>
          <div>
            <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block leading-none mb-0.5">UMBALI</span>
            <span className="text-[11px] font-black text-neutral-800 dark:text-white leading-none">
              {(ride as any).distanceToPickup?.toFixed(1) || '0.5'} km
            </span>
          </div>
          <div className="border-r border-neutral-200/30 dark:border-neutral-800/40 my-0.5" />
          <div>
            <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block leading-none mb-0.5">MUDA</span>
            <span className="text-[11px] font-black text-neutral-800 dark:text-white leading-none">
              ~{ride.duration || '22'} dk
            </span>
          </div>
          <div className="border-r border-neutral-200/30 dark:border-neutral-800/40 my-0.5" />
          <div>
            <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block leading-none mb-0.5">MTEJA</span>
            <span className="text-[11px] font-black text-neutral-800 dark:text-white leading-none flex items-center justify-center gap-0.5">
              ★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}
            </span>
          </div>
          <div className="border-r border-neutral-200/30 dark:border-neutral-800/40 my-0.5" />
          <div>
            <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block leading-none mb-0.5">AINA</span>
            <span className="text-[11px] font-black text-neutral-800 dark:text-white uppercase italic leading-none">
              {ride.vehicleType === 'bike' ? 'PIKIPIKI' : ride.vehicleType === 'bajaj' ? 'BAJAJI' : 'GARI'}
            </span>
          </div>
        </div>

        {/* Sized-Down Action Buttons */}
        <div className="flex gap-2.5 pt-0.5">
          <button 
            onClick={onDecline}
            className={`w-[110px] h-11 rounded-xl border hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-black uppercase text-[10px] tracking-wider active:scale-95 transition-all flex flex-col items-center justify-center leading-tight shrink-0 ${
              isDark ? 'border-red-500/20' : 'border-red-500/15'
            }`}
          >
            <span className="text-xs font-black italic">KATAA</span>
          </button>
          
          <button 
            onClick={onAccept}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7F77DD] to-indigo-600 hover:brightness-105 text-white font-black uppercase tracking-wider active:scale-95 transition-all flex flex-col items-center justify-center leading-tight shadow-[0_6px_16px_rgba(127,119,221,0.3)] group"
          >
            <div className="flex items-center gap-1 justify-center">
              <span className="text-xs font-black italic">KUBALI SAFARI</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>

        {/* Mini Safety Footer Badge */}
        <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-neutral-200/20 dark:border-neutral-850/60">
          <Shield className="w-4 h-4 text-emerald-500 fill-emerald-500/10 shrink-0" />
          <p className="text-[8px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Usalama wako ni muhimu kwetu • Papo Hapo Super App
          </p>
        </div>
      </motion.div>
    </div>
  );
}
