import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Phone, MessageSquare, MapPin, Navigation2, CheckCircle2, ArrowRight, ChevronUp, ChevronDown, Map as MapIcon } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';

interface DriverTripSheetProps {
  ride: Ride;
  onArrive: () => void;
  onStart: () => void;
  onComplete: () => void;
  onMessage?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export default function DriverTripSheet({ ride, onArrive, onStart, onComplete, onMessage, isMinimized, onToggleMinimize }: DriverTripSheetProps) {
  const isArriving = ride.status === 'accepted' || ride.status === 'driver_arriving';
  const isArrived = ride.status === 'driver_arrived';
  const isOnTrip = ride.status === 'on_trip';

  const targetLocation = useMemo(() => {
    if (isOnTrip) return ride.destination;
    return ride.pickup;
  }, [isOnTrip, ride.pickup, ride.destination]);

  const { distance, eta } = useDriverTracking(ride.driverLocation, targetLocation);

  const progress = useMemo(() => {
    if (!ride.distance || distance === null) return 0;
    // For pickup, we don't have a starting 'total distance' easily available in the ride object
    // except specifically for the trip portion. 
    if (isArriving) return 0; 
    const travelled = Math.max(0, ride.distance - distance);
    const p = Math.round((travelled / ride.distance) * 100);
    return Math.min(100, Math.max(0, p));
  }, [distance, ride.distance, isArriving]);

  const googleMapsUrl = ride.driverLocation 
    ? `https://www.google.com/maps/dir/?api=1&origin=${ride.driverLocation.lat},${ride.driverLocation.lng}&destination=${targetLocation.lat},${targetLocation.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${targetLocation.lat},${targetLocation.lng}`;

  const [waitTimer, setWaitTimer] = React.useState(0);
  
  React.useEffect(() => {
    let interval: any;
    if (isArrived) {
      interval = setInterval(() => {
        setWaitTimer(prev => prev + 1);
      }, 1000);
    } else {
      setWaitTimer(0);
    }
    return () => clearInterval(interval);
  }, [isArrived]);

  const formatTimer = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-4 inset-x-0 z-[1000] px-4 pointer-events-none flex justify-center">
      <motion.div 
        initial={{ y: 300 }} 
        animate={{ y: isMinimized ? 'calc(100% - 60px)' : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        className="w-full max-w-[390px] pointer-events-auto rounded-[24px] border border-neutral-200/50 dark:border-neutral-800/80 p-4 space-y-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/95 dark:bg-[#111118]/95 text-neutral-850 dark:text-white transition-all duration-300"
      >
        {/* Compact Drag Handle & Minimize Toggle */}
        <div 
           className="flex flex-col items-center justify-center cursor-pointer group py-1"
           onClick={onToggleMinimize}
        >
           <div className={`w-12 h-1 rounded-full transition-all duration-300 mb-1.5 ${isMinimized ? 'bg-indigo-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-800 group-hover:bg-[#7F77DD]'}`} />
           <p className="text-[7.5px] font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-[0.25em]">
             {isMinimized ? 'GUSA KUONA SAFARI' : 'SHUSHA KUONA RAMANI'}
           </p>
        </div>

        {/* Status Badge */}
        <div className="text-center">
          <span className={`inline-block px-2.5 py-1 rounded-full italic font-black text-[9px] tracking-widest uppercase ${
            isArriving 
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
              : isArrived 
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isArriving ? '⚡ UNAKOPITA KUMFUATA MTEJA' : isArrived ? '⚡ UMEFIKA KWA MTEJA' : '⚡ SAFARI INAENDELEA'}
          </span>
        </div>

        {isMinimized ? (
          <div className="flex items-center justify-between bg-neutral-50/50 dark:bg-[#0a0a0f]/60 p-2.5 rounded-xl border border-neutral-150 dark:border-neutral-850/50 cursor-pointer" onClick={onToggleMinimize}>
             <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 overflow-hidden border border-neutral-200 dark:border-neutral-800">
                   <img 
                      src={ride.customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
                      alt={ride.customerInfo?.name}
                      className="w-full h-full object-cover"
                   />
                </div>
                <div className="min-w-0">
                   <h3 className="text-xs font-black italic text-neutral-800 dark:text-white uppercase truncate">{ride.customerInfo?.name}</h3>
                   <p className="text-[9px] font-bold text-emerald-600 dark:text-[#00FF88]">TZS {(ride.fare || 0).toLocaleString()}</p>
                </div>
             </div>
             <div className="flex items-center gap-2 shrink-0">
                <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">MTEJA</span>
                <Navigation2 className="w-4 h-4 text-[#7F77DD] animate-bounce" />
             </div>
          </div>
        ) : (
          <>
            {/* Customer & Actions Row */}
            <div className="flex justify-between items-center bg-neutral-50/30 dark:bg-[#0a0a0f]/30 p-2.5 rounded-2xl border border-neutral-150 dark:border-neutral-850/30">
              <div className="flex items-center gap-2.5 min-w-0">
                 <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 overflow-hidden border border-neutral-200 dark:border-neutral-800 shrink-0 shadow-sm">
                    <img 
                       src={ride.customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
                       alt={ride.customerInfo?.name}
                       className="w-full h-full object-cover"
                    />
                 </div>
                 <div className="min-w-0">
                    <h3 className="text-sm font-black italic text-neutral-850 dark:text-white leading-none truncate">{ride.customerInfo?.name || "Mteja"}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[9px] font-black text-amber-500">★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}</span>
                       <span className="text-[10px] font-bold text-emerald-600 dark:text-[#00FF88] italic">TZS {(ride.fare || 0).toLocaleString()}</span>
                    </div>
                 </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-1.5 shrink-0">
                 <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 active:scale-90 transition-transform" title="Google Maps">
                    <MapIcon className="w-4 h-4" />
                 </a>
                 <a href={`tel:${ride.customerInfo?.phone || '0700000000'}`} className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 active:scale-90 transition-transform">
                    <Phone className="w-4 h-4" />
                 </a>
                 <button 
                   onClick={onMessage}
                   className="w-9 h-9 rounded-xl bg-[#7F77DD]/10 border border-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD] active:scale-90 transition-transform"
                 >
                    <MessageSquare className="w-4 h-4" />
                 </button>
              </div>
            </div>

            {/* Distance / Progress Section */}
            {(isOnTrip || isArriving) && (
              <div className="space-y-1 px-1">
                 <div className="flex justify-between items-center text-[8.5px] font-black uppercase tracking-wider">
                    <span className="text-neutral-400 dark:text-neutral-500">
                      {isOnTrip ? 'Safarni...' : 'Njia ya kufuata mteja...'}
                    </span>
                    <span className="text-[#7F77DD] italic font-bold">
                      {distance?.toFixed(1) || (ride.distance?.toFixed(1) || '0.0')} km imebaki
                    </span>
                 </div>
                 <div className="h-1.5 bg-neutral-100 dark:bg-[#0a0a0f] rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-850">
                    <motion.div 
                       className="h-full bg-emerald-500 dark:bg-[#1D9E75]"
                       initial={{ width: '0%' }}
                       animate={{ width: `${progress}%` }}
                    />
                 </div>
              </div>
            )}

            {/* Compact Addresses */}
            <div className="bg-neutral-50/20 dark:bg-[#0a0a0f]/20 border border-neutral-150 dark:border-neutral-850 rounded-2xl p-3 space-y-2 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2 h-2 ${isArriving || isArrived ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-300 dark:bg-neutral-800'} rounded-full shrink-0`} />
                <div className="min-w-0 flex-1">
                   <p className="text-[11.5px] font-bold text-neutral-700 dark:text-neutral-200 truncate leading-none">
                     <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase mr-1">PICKUP:</span>
                     {ride.pickup.address}
                   </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2 h-2 ${isOnTrip ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-neutral-300 dark:bg-neutral-800'} rounded-full shrink-0`} />
                <div className="min-w-0 flex-1">
                   <p className="text-[11.5px] font-bold text-neutral-700 dark:text-neutral-200 truncate leading-none">
                     <span className="text-[8px] font-black text-neutral-400 dark:text-neutral-500 uppercase mr-1">DEST:</span>
                     {ride.destination.address}
                   </p>
                </div>
              </div>
            </div>

            {/* Waiting Timer for Arrived */}
            {isArrived && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5 rounded-xl border border-amber-500/20">
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    <p className="text-[9px] font-black text-amber-500 uppercase italic">Mteja Anasubiri...</p>
                 </div>
                 <p className="text-xs font-black italic font-mono text-amber-500">{formatTimer(waitTimer)} →</p>
              </div>
            )}

            {/* Action Trigger Buttons */}
            {isArriving && (
              <button 
                onClick={onArrive}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 text-white font-black uppercase italic text-xs shadow-[0_6px_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                NIMEFIKA <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {isArrived && (
              <button 
                onClick={onStart}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-[#1D9E75] hover:brightness-105 text-white font-black uppercase italic text-xs shadow-[0_6px_20px_rgba(29,158,117,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                ANZA SAFARI <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {isOnTrip && (
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    if (!ride || !ride.driverLocation) return;
                    const devLat = ride.driverLocation.lat + 0.0022; // shift driver off-route
                    const devLng = ride.driverLocation.lng - 0.0022;
                    
                    try {
                      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
                      const { db } = await import('../../firebase');
                      const { toast } = await import('sonner');
                      await updateDoc(doc(db, 'rides', ride.id), {
                        driverLocation: { lat: devLat, lng: devLng },
                        hasDeviated: true,
                        isRerouting: true,
                        navigationMessage: "Dereva amebadilisha njia! Antway inatafuta njia mbadala...",
                        updatedAt: serverTimestamp()
                      });
                      toast.success("Njia imebadilishwa! Antway inaanza kuongoza upya.", {
                        icon: "🔄"
                      });
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="w-full h-10 border rounded-xl flex items-center justify-center gap-1.5 font-black tracking-wider text-[8.5px] uppercase transition-all active:scale-95 cursor-pointer bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:brightness-105"
                >
                  <span>🔄 BADILISHA NJIA (SIMULATE DETOUR)</span>
                </button>
                
                <button 
                  onClick={onComplete}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-105 text-white font-black uppercase italic text-xs shadow-[0_6px_20px_rgba(216,90,48,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  MALIZA SAFARI <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
