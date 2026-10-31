import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Phone, MessageSquare, MapPin, Navigation2, CheckCircle2, ArrowRight, ChevronUp, ChevronDown, Map as MapIcon, RotateCcw } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';

interface DriverTripSheetProps {
  ride: Ride;
  onArrive: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export default function DriverTripSheet({ 
  ride, 
  onArrive, 
  onStart, 
  onComplete, 
  onCall, 
  onMessage, 
  isMinimized, 
  onToggleMinimize 
}: DriverTripSheetProps) {
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
    if (isArriving) return 0; 
    const travelled = Math.max(0, ride.distance - distance);
    const p = Math.round((travelled / ride.distance) * 100);
    return Math.min(100, Math.max(0, p));
  }, [distance, ride.distance, isArriving]);

  const waypointsQuery = (isOnTrip && ride.stops && Array.isArray(ride.stops) && ride.stops.length > 0)
    ? `&waypoints=${ride.stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number').map(s => `${s.lat},${s.lng}`).join('|')}`
    : '';

  const googleMapsUrl = ride.driverLocation 
    ? `https://www.google.com/maps/dir/?api=1&origin=${ride.driverLocation.lat},${ride.driverLocation.lng}&destination=${targetLocation.lat},${targetLocation.lng}${waypointsQuery}`
    : `https://www.google.com/maps/dir/?api=1&destination=${targetLocation.lat},${targetLocation.lng}${waypointsQuery}`;

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

  const handleSimulateDetour = async () => {
    if (!ride || !ride.driverLocation) return;
    const devLat = ride.driverLocation.lat + 0.0022;
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
      toast.success("Njia imebadilishwa! Antway inaanza kuongoza upya.", { icon: "🔄" });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed bottom-2 inset-x-0 z-[1000] px-2.5 pointer-events-none flex justify-center">
      <motion.div 
        initial={{ y: 250 }} 
        animate={{ y: isMinimized ? 'calc(100% - 38px)' : 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 140 }}
        className="w-full max-w-[370px] pointer-events-auto rounded-[20px] border border-neutral-200/70 dark:border-neutral-800/80 px-3 pt-1.5 pb-2.5 space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl bg-white/95 dark:bg-[#111118]/95 text-neutral-850 dark:text-white transition-all duration-300"
      >
        {/* Compact Drag Handle & Status Header */}
        <div 
          className="flex flex-col items-center justify-center cursor-pointer group select-none"
          onClick={onToggleMinimize}
        >
          {/* Minimal Drag Pill */}
          <div className={`w-8 h-1 rounded-full transition-all duration-300 mb-1 ${isMinimized ? 'bg-indigo-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-700 group-hover:bg-[#7F77DD]'}`} />
          
          {/* Single-Row Status Badge & Minimize Toggle */}
          <div className="w-full flex items-center justify-between px-0.5">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-black text-[8.5px] tracking-wider uppercase ${
              isArriving 
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                : isArrived 
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {isArriving ? '⚡ KUMFUATA MTEJA' : isArrived ? '⚡ UMEFIKA KWA MTEJA' : '⚡ SAFARI INAENDELEA'}
            </span>

            <div className="flex items-center gap-1 text-[8px] font-black uppercase text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors">
              <span>{isMinimized ? 'Fungua' : 'Shusha'}</span>
              {isMinimized ? <ChevronUp className="w-3 h-3 text-[#7F77DD]" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </div>
        </div>

        {isMinimized ? (
          /* Minimized Compact Strip */
          <div 
            className="flex items-center justify-between bg-neutral-50/60 dark:bg-[#0a0a0f]/60 px-2.5 py-1.5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 cursor-pointer" 
            onClick={onToggleMinimize}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-neutral-800 overflow-hidden border border-neutral-300 dark:border-neutral-700 shrink-0">
                <img 
                  src={ride.customerInfo?.photo || ride.customerInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
                  alt={ride.customerInfo?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-neutral-850 dark:text-white uppercase truncate leading-tight">
                  {ride.customerInfo?.name || "Mteja"}
                </h3>
                <p className="text-[9px] font-bold text-emerald-600 dark:text-[#00FF88] leading-none">
                  TZS {(ride.fare || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[8.5px] font-mono font-bold text-neutral-400">
                {distance !== null ? `${distance.toFixed(1)} km` : ''}
              </span>
              <Navigation2 className="w-3.5 h-3.5 text-[#7F77DD] animate-bounce" />
            </div>
          </div>
        ) : (
          <>
            {/* Streamlined Customer & Quick Action Row */}
            <div className="flex justify-between items-center bg-neutral-50/50 dark:bg-[#0a0a0f]/40 px-2 py-1.5 rounded-xl border border-neutral-200/40 dark:border-neutral-800/40">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 overflow-hidden border border-neutral-300 dark:border-neutral-700 shrink-0 shadow-xs">
                  <img 
                    src={ride.customerInfo?.photo || ride.customerInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
                    alt={ride.customerInfo?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <h3 className="text-xs font-black text-neutral-850 dark:text-white truncate">
                      {ride.customerInfo?.name || "Mteja"}
                    </h3>
                    <span className="text-[8.5px] font-bold text-amber-500 shrink-0">
                      ★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-emerald-600 dark:text-[#00FF88] leading-tight">
                    TZS {(ride.fare || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {/* Quick Communication & Map Buttons */}
              <div className="flex gap-1 shrink-0">
                <a 
                  href={googleMapsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 active:scale-90 transition-transform" 
                  title="Google Maps"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                </a>
                <button 
                  type="button" 
                  onClick={onCall || (() => window.open(`tel:${ride.customerInfo?.phone || '0700000000'}`))} 
                  className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 active:scale-90 transition-transform cursor-pointer" 
                  title="Piga simu"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={onMessage}
                  className="w-7 h-7 rounded-lg bg-[#7F77DD]/10 border border-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD] active:scale-90 transition-transform cursor-pointer"
                  title="Tuma ujumbe"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Distance / Progress Section */}
            {(isOnTrip || isArriving) && (
              <div className="space-y-0.5 px-0.5">
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider">
                  <span className="text-neutral-400 dark:text-neutral-500">
                    {isOnTrip ? 'Safarni...' : 'Kumfuata Mteja...'}
                  </span>
                  <span className="text-[#7F77DD] font-bold">
                    {distance !== null ? `${distance.toFixed(1)} km` : (ride.distance?.toFixed(1) || '0.0')} imebaki
                  </span>
                </div>
                <div className="h-1 bg-neutral-100 dark:bg-[#0a0a0f] rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-850">
                  <motion.div 
                    className="h-full bg-emerald-500 dark:bg-[#1D9E75]"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Compact Addresses */}
            <div className="bg-neutral-50/40 dark:bg-[#0a0a0f]/30 border border-neutral-200/50 dark:border-neutral-800/40 rounded-xl p-2 space-y-1 text-left">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 ${isArriving || isArrived ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-neutral-400'} rounded-full shrink-0`} />
                <p className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 truncate leading-tight flex-1">
                  <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase mr-1">PICKUP:</span>
                  {ride.pickup.address}
                </p>
              </div>

              {ride.stops && Array.isArray(ride.stops) && ride.stops.map((stop: any, idx: number) => (
                <div key={stop.id || idx} className="flex items-center gap-2 min-w-0 pl-0.5">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                  <p className="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 truncate leading-tight flex-1">
                    <span className="text-[7px] font-black text-amber-600 uppercase mr-1">KITUO #{idx + 1}:</span>
                    {stop.address}
                  </p>
                </div>
              ))}

              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 ${isOnTrip ? 'bg-orange-500 ring-2 ring-orange-500/20' : 'bg-neutral-400'} rounded-full shrink-0`} />
                <p className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 truncate leading-tight flex-1">
                  <span className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase mr-1">DEST:</span>
                  {ride.destination.address}
                </p>
              </div>
            </div>

            {/* Waiting Timer for Arrived */}
            {isArrived && (
              <div className="flex items-center justify-between px-2.5 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  <p className="text-[8.5px] font-black text-amber-500 uppercase">Mteja Anasubiri...</p>
                </div>
                <p className="text-xs font-mono font-black text-amber-500">{formatTimer(waitTimer)}</p>
              </div>
            )}

            {/* Action Buttons (Compact & Zero Scrolling Required) */}
            {isArriving && (
              <button 
                onClick={onArrive}
                className="w-full h-9.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 text-white font-black uppercase text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>NIMEFIKA</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {isArrived && (
              <button 
                onClick={onStart}
                className="w-full h-9.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#1D9E75] hover:brightness-105 text-white font-black uppercase text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>ANZA SAFARI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {isOnTrip && (
              <div className="flex items-center gap-1.5 pt-0.5">
                {/* Secondary Detour Tool Button */}
                <button
                  type="button"
                  onClick={handleSimulateDetour}
                  title="Badilisha Njia / Simulate Detour"
                  className="h-9.5 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[8.5px] font-black uppercase flex items-center gap-1 active:scale-95 transition-all shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden xs:inline">Detour</span>
                </button>
                
                {/* Primary Finish Button */}
                <button 
                  type="button"
                  onClick={onComplete}
                  className="flex-1 h-9.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-105 text-white font-black uppercase text-xs shadow-[0_4px_16px_rgba(234,88,12,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>MALIZA SAFARI</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
