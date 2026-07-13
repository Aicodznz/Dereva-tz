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
    <div className="fixed inset-0 z-[1000] pointer-events-none flex flex-col justify-between p-4 pb-6 pt-20">
      {/* Top Banner and Timer Circle */}
      <div className="flex flex-col items-center justify-start pointer-events-auto mt-2 text-center w-full">
        {/* New Request Badge */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`px-4 py-1.5 rounded-full italic font-black text-[10px] tracking-widest shadow-md uppercase transition-all duration-300 ${
            isDark 
              ? 'bg-[#7F77DD]/20 border border-[#7F77DD]/30 text-indigo-300' 
              : 'bg-[#7F77DD] text-white'
          }`}
        >
          ⚡ OMBI JIPYA!
        </motion.div>

        {/* Circular Countdown Progress */}
        <div className="relative w-28 h-28 mt-4 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle 
              cx="56" cy="56" r="46" 
              stroke={isDark ? '#1e1e2e' : '#e2e8f0'} 
              strokeWidth="7" 
              fill="none" 
            />
            <motion.circle 
              cx="56" cy="56" r="46" 
              stroke="#7F77DD" 
              strokeWidth="7" 
              strokeLinecap="round"
              fill="none"
              strokeDasharray="289"
              animate={{ strokeDashoffset: 289 * (1 - timeLeft / 15) }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1.5">
            <span className={`text-4xl font-black italic font-mono leading-none tracking-tighter ${isDark ? 'text-white' : 'text-neutral-850'}`}>
              {timeLeft}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400 mt-1 leading-none">
              sekunde
            </span>
          </div>
        </div>

        {/* Informational Sub-badge */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`mt-4 px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md transition-all duration-300 ${
            isDark 
              ? 'bg-[#111118]/80 border-neutral-800/80 text-white' 
              : 'bg-white/95 border-neutral-200/50 text-neutral-800'
          }`}
        >
          <p className="text-xs font-black uppercase tracking-wider italic leading-none">
            Ombi la safari limepokelewa
          </p>
        </motion.div>
      </div>

      {/* Bottom Sheet Details Panel */}
      <motion.div 
        initial={{ y: 250, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 250, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className={`w-full max-w-sm mx-auto pointer-events-auto rounded-[32px] border shadow-2xl p-5 space-y-4 backdrop-blur-xl transition-all duration-300 ${
          isDark 
            ? 'bg-[#111118]/95 border-neutral-800/80 text-white shadow-black/60' 
            : 'bg-white/95 border-neutral-200/60 text-neutral-850 shadow-neutral-300/30'
        }`}
      >
        {/* Horizontal Metrics Panel */}
        <div className={`grid grid-cols-3 gap-1 p-3 rounded-[20px] text-center border ${
          isDark 
            ? 'bg-[#0a0a0f]/60 border-neutral-850/60' 
            : 'bg-neutral-50/80 border-neutral-150'
        }`}>
          <div className="flex flex-col items-center justify-center">
            <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">UMBALI</span>
            <span className="text-[13px] font-black text-neutral-800 dark:text-white">{(ride as any).distanceToPickup?.toFixed(1) || '0.5'} km</span>
          </div>
          <div className="h-6 w-px bg-neutral-250 dark:bg-neutral-800 self-center" />
          <div className="flex flex-col items-center justify-center">
            <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">MUDA</span>
            <span className="text-[13px] font-black text-neutral-800 dark:text-white">~{ride.duration || '22'} dk</span>
          </div>
          <div className="h-6 w-px bg-neutral-250 dark:bg-neutral-800 self-center" />
          <div className="flex flex-col items-center justify-center">
            <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">NAFASI</span>
            <span className="text-[13px] font-black text-neutral-800 dark:text-white">1 Mtu</span>
          </div>
        </div>

        {/* Connected Pickup & Destination Addresses */}
        <div className={`relative p-4 rounded-2xl border space-y-4 ${
          isDark 
            ? 'bg-[#0a0a0f]/30 border-neutral-850/40' 
            : 'bg-neutral-50/30 border-neutral-150/60'
        }`}>
          {/* Pickup Address */}
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm border border-emerald-500/10">
              <MapPin className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-1">Sehemu ya kupakia</p>
              <p className="text-sm font-black text-neutral-800 dark:text-white leading-tight truncate">{ride.pickup.address}</p>
              <p className="text-[9.5px] font-bold text-neutral-400 dark:text-neutral-500 mt-1">
                 {(ride as any).distanceToPickup?.toFixed(1) || '0.5'} km kutoka kwako
              </p>
            </div>
          </div>

          {/* Dotted Connection Line */}
          <div className="absolute left-[29px] top-12 bottom-12 w-0.5 border-l-2 border-dashed border-neutral-250 dark:border-neutral-800 z-0" />

          {/* Destination Address */}
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 shadow-sm border border-indigo-500/10">
              <Navigation className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-1">Sehemu ya kutokea</p>
              <p className="text-sm font-black text-neutral-800 dark:text-white leading-tight truncate">{ride.destination.address}</p>
            </div>
          </div>
        </div>

        {/* Customer & Category Grid Info */}
        <div className="grid grid-cols-2 gap-3">
           <div className={`p-3 rounded-2xl flex items-center gap-2.5 border ${
             isDark 
               ? 'bg-[#0a0a0f]/40 border-neutral-850/50' 
               : 'bg-neutral-50/50 border-neutral-150'
           }`}>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="overflow-hidden">
                 <p className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-0.5">Mteja</p>
                 <p className="text-xs font-black text-neutral-800 dark:text-white flex items-center gap-1">
                   ★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}
                 </p>
              </div>
           </div>
           <div className={`p-3 rounded-2xl flex items-center gap-2.5 border ${
             isDark 
               ? 'bg-[#0a0a0f]/40 border-neutral-850/50' 
               : 'bg-neutral-50/50 border-neutral-150'
           }`}>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                 <p className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-0.5">Aina</p>
                 <p className="text-xs font-black text-neutral-800 dark:text-white uppercase italic leading-none">
                   {ride.vehicleType === 'bike' ? 'PIKIPIKI' : ride.vehicleType === 'bajaj' ? 'BAJAJI' : 'GARI'}
                 </p>
              </div>
           </div>
        </div>

        {/* Estimated Earnings Section */}
        <div className="flex items-center justify-between px-2.5 py-0.5">
           <div className="flex flex-col text-left">
             <p className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest italic leading-none">MAOKOTO:</p>
             <span className="text-[9.5px] font-bold text-neutral-400 dark:text-neutral-500 mt-1 leading-none">Pesa taslimu</span>
           </div>
           <h3 className="text-2xl font-black italic text-neutral-850 dark:text-white tracking-tighter leading-none">
             TZS {(ride?.fare ?? 0).toLocaleString()}
           </h3>
        </div>

        {/* Action Call buttons */}
        <div className="flex gap-3 pt-1">
          <button 
            onClick={onDecline}
            className={`flex-1 h-14 rounded-2xl border-2 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-black uppercase text-[11px] tracking-wider active:scale-95 transition-all flex flex-col items-center justify-center leading-tight shadow-sm ${
              isDark ? 'border-red-500/20' : 'border-red-500/15'
            }`}
          >
            <span className="text-sm font-black italic">KATAA</span>
            <span className="text-[8px] font-bold opacity-75">Ombi hili</span>
          </button>
          <button 
            onClick={onAccept}
            className="flex-[2] h-14 rounded-2xl bg-gradient-to-r from-[#7F77DD] to-indigo-600 hover:brightness-105 hover:shadow-[0_8px_24px_rgba(127,119,221,0.5)] text-white font-black uppercase tracking-wider active:scale-95 transition-all flex flex-col items-center justify-center leading-tight shadow-[0_8px_20px_rgba(127,119,221,0.35)] group"
          >
            <div className="flex items-center gap-1.5 justify-center">
              <span className="text-sm font-black italic">KUBALI SAFARI</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[8px] font-extrabold text-indigo-100/90 leading-none mt-0.5">Kuanza safari</span>
          </button>
        </div>

        {/* Safety Footer badge */}
        <div className="flex items-center justify-center gap-2 pt-2.5 border-t border-neutral-150 dark:border-neutral-850/60">
          <Shield className="w-5 h-5 text-emerald-500 fill-emerald-500/10 shrink-0" />
          <div className="flex flex-col text-left">
             <span className="text-[10px] font-black text-neutral-750 dark:text-neutral-300 uppercase leading-none">Usalama wako ni muhimu kwetu</span>
             <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase mt-0.5 leading-none">Papo Hapo Super App</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
