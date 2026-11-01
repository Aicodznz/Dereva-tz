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

  const getCalcDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const tripDistKm = ride.distance && Number(ride.distance) > 0 
    ? Number(ride.distance) 
    : (ride.pickup?.lat && ride.destination?.lat 
        ? getCalcDistanceKm(Number(ride.pickup.lat), Number(ride.pickup.lng), Number(ride.destination.lat), Number(ride.destination.lng)) 
        : 3.0);

  const pickupDistKm = (ride as any).distanceToPickup && Number((ride as any).distanceToPickup) > 0
    ? Number((ride as any).distanceToPickup)
    : 0.5;

  return (
    <div className="fixed inset-x-0 bottom-2 z-[99999] px-3 pointer-events-none flex justify-center">
      <motion.div 
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className={`w-full max-w-[380px] pointer-events-auto rounded-2xl border px-3 py-2 space-y-2 shadow-2xl backdrop-blur-md transition-all duration-200 ${
          isDark 
            ? 'bg-[#111118]/98 border-neutral-800 text-white shadow-black/80' 
            : 'bg-white/98 border-neutral-200/90 text-neutral-850 shadow-neutral-400/40'
        }`}
      >
        {/* Header: Compact Integrated Countdown Timer & Earning Info */}
        <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200/40 dark:border-neutral-800/60">
          <div className="flex items-center gap-2">
            {/* Small Sleek Circular Timer */}
            <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle 
                  cx="14" cy="14" r="11" 
                  stroke={isDark ? '#1f1f2e' : '#f1f5f9'} 
                  strokeWidth="2.5" 
                  fill="none" 
                />
                <motion.circle 
                  cx="14" cy="14" r="11" 
                  stroke="#7F77DD" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="69.11"
                  animate={{ strokeDashoffset: 69.11 * (1 - timeLeft / 15) }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </svg>
              <span className={`absolute text-[11px] font-black italic font-mono ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                {timeLeft}
              </span>
            </div>

            {/* Title Details */}
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black tracking-wide uppercase ${
                isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-600 text-white'
              }`}>
                ⚡ OMBI JIPYA!
              </span>
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tight">
                Ombi la safari
              </span>
            </div>
          </div>

          {/* Fare Badge */}
          <div className="text-right">
            <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block leading-none">MAOKOTO</span>
            <span className="text-[15px] font-black italic text-emerald-500 dark:text-emerald-400 tracking-tight leading-none">
              TZS {(ride?.fare ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Customer & Trip Meta Row */}
        <div className={`flex items-center justify-between px-2 py-1.5 rounded-xl border ${
          isDark ? 'bg-[#0a0a0f]/50 border-neutral-800/60' : 'bg-neutral-50 border-neutral-200/80'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-indigo-500 shrink-0 bg-neutral-200 dark:bg-neutral-800">
              <img 
                src={ride.customerInfo?.photo || ride.customerInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId || 'Mteja'}`} 
                alt={ride.customerInfo?.name || "Mteja"} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-black italic uppercase text-neutral-850 dark:text-white truncate max-w-[110px]">
                  {ride.customerInfo?.name || "Mteja wetu"}
                </span>
                <span className="text-[9.5px] font-black text-amber-500">
                  ★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9.5px] font-black text-neutral-700 dark:text-neutral-300 bg-neutral-200/70 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              {tripDistKm.toFixed(1)} km • ~{ride.duration || '20'} dk
            </span>
            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase">
              {ride.vehicleType === 'bike' ? 'PIKIPIKI' : ride.vehicleType === 'bajaj' ? 'BAJAJI' : 'GARI'}
            </span>
          </div>
        </div>

        {/* Compact Vertical Route Details */}
        <div className={`relative px-2.5 py-1.5 rounded-xl border space-y-1.5 ${
          isDark 
            ? 'bg-[#0a0a0f]/40 border-neutral-850/50' 
            : 'bg-neutral-50/50 border-neutral-200/60'
        }`}>
          {/* Pickup Address */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[11px] font-bold text-neutral-800 dark:text-neutral-100 truncate flex-1 leading-tight">
              {ride.pickup.address}
              <span className="text-[9px] font-normal text-neutral-400 dark:text-neutral-500 ml-1">({pickupDistKm.toFixed(1)} km)</span>
            </p>
          </div>

          {/* Destination Address */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
              <Navigation className="w-2 h-2 text-indigo-500 rotate-45" />
            </div>
            <p className="text-[11px] font-bold text-neutral-800 dark:text-neutral-100 truncate flex-1 leading-tight">
              {ride.destination.address}
              <span className="text-[9px] font-normal text-neutral-400 dark:text-neutral-500 ml-1">({tripDistKm.toFixed(1)} km)</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-0.5">
          <button 
            type="button"
            onClick={onDecline}
            className={`w-[80px] h-9 rounded-xl border hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-black text-xs active:scale-95 transition-all flex items-center justify-center shrink-0 ${
              isDark ? 'border-red-500/20' : 'border-red-500/20'
            }`}
          >
            KATAA
          </button>
          
          <button 
            type="button"
            onClick={onAccept}
            className="flex-1 h-9 rounded-xl bg-gradient-to-r from-[#7F77DD] to-indigo-600 hover:brightness-105 text-white font-black text-xs tracking-wide active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md group"
          >
            <span>KUBALI SAFARI</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Mini Safety Footer Badge */}
        <div className="flex items-center justify-center gap-1 text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tight">
          <Shield className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
          <span>Usalama wako ni muhimu kwetu • Papo Hapo Super App</span>
        </div>
      </motion.div>
    </div>
  );
}
