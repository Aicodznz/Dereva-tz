import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Shield, Clock, Navigation2, MapPin, MessageSquare, Star, Trash2, Users, Package, Sparkles, CheckCircle2, Home } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useRouting } from '../../hooks/useRouting';
import { toast } from 'sonner';
import { useTheme } from '../../ThemeContext';
import { Navigation3DHudOverlay } from '../map/Navigation3DHudOverlay';
import { ShareTripModal } from '../common/ShareTripModal';

interface LiveTripScreenProps {
  ride: Ride;
  onMessage?: () => void;
  onCancel?: () => void;
  onGoHome?: () => void;
  user?: any;
  profile?: any;
  isMinimized?: boolean;
  isSpectator?: boolean;
}

const isValidLoc = (loc: any) => loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng);

const MapControl = ({ position, target }: { position: { lat: number, lng: number } | any, target: { lat: number, lng: number } | any }) => {
  const map = useMap();
  const lastFitRef = React.useRef<{ lat: number, lng: number } | null>(null);

  React.useEffect(() => {
    const hasPos = isValidLoc(position);
    const hasTgt = isValidLoc(target);

    if (hasPos && hasTgt) {
      const latLngPos = L.latLng(position.lat, position.lng);
      
      // Smooth travel follow matching the driver's exact coordinates
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.6, easeLinearity: 0.25 });

      const distFromLastFit = lastFitRef.current ? latLngPos.distanceTo(lastFitRef.current) : 1000;
      if (distFromLastFit > 400) {
        const bounds = L.latLngBounds([
          [position.lat, position.lng],
          [target.lat, target.lng]
        ]);
        map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 1.5 });
        lastFitRef.current = { lat: position.lat, lng: position.lng };
      }
    } else if (hasPos) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.6, easeLinearity: 0.25 });
    } else if (hasTgt) {
      map.panTo([target.lat, target.lng], { animate: true, duration: 0.6, easeLinearity: 0.25 });
    }
  }, [position?.lat, position?.lng, target?.lat, target?.lng, map]);
  return null;
};

export const LiveTripScreen: React.FC<LiveTripScreenProps> = ({ 
  ride, 
  onMessage, 
  onCancel, 
  onGoHome,
  user,
  profile,
  isMinimized, 
  isSpectator = false 
}) => {
  const isArriving = ride.status !== 'on_trip';
  const targetLocation = isArriving ? ride.pickup : ride.destination;
  const { distance, eta } = useDriverTracking(ride.driverLocation, targetLocation);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const showDetails = !isMinimized && !isCollapsed;

  // Active viewer calculations (supporting both legacy timestamps and modern name objects)
  const { activeViewersCount, activeViewerNames } = useMemo(() => {
    const viewersMap = (ride as any).viewers || {};
    const now = Date.now();
    const names: string[] = [];

    Object.entries(viewersMap).forEach(([_, val]) => {
      if (typeof val === 'number') {
        if ((now - val) < 35000) {
          names.push("Mgeni");
        }
      } else if (val && typeof val === 'object') {
        const lastActive = (val as any).lastActive;
        const name = (val as any).name;
        if (typeof lastActive === 'number' && (now - lastActive) < 35000) {
          names.push(name || "Mgeni");
        }
      }
    });

    return {
      activeViewersCount: names.length,
      activeViewerNames: names,
    };
  }, [ride]);

  // Progress calculation - Map dynamically based on ride stages and live tracking distance
  const progress = useMemo(() => {
    // 1. Completed (FIKA)
    if (ride.status === 'completed') {
      return 100;
    }
    
    // 2. On Trip (PO MAP)
    if (ride.status === 'on_trip') {
      const rem = distance !== null ? distance : (ride.distance || 0);
      const total = (ride as any).initialDistance || Math.max(rem, (ride as any).totalDistance || ride.distance || 5);
      const ratio = total > 0 ? Math.max(0, Math.min(1, (total - rem) / total)) : 0.5;
      // Map ratio (0 to 1) to progress range [65%, 95%]
      return 65 + Math.round(ratio * 30);
    }
    
    // 3. Driver Arrived (PATA to PO MAP transition)
    if (ride.status === 'driver_arrived') {
      return 58;
    }
    
    // 4. Driver accepted & Arriving (PATA)
    if (ride.status === 'accepted' || isArriving) {
      const rem = distance !== null ? distance : 1.5;
      const totalPickup = 2.5;
      const ratio = Math.max(0, Math.min(1, (totalPickup - rem) / totalPickup));
      // Map ratio (0 to 1) to progress range [28%, 54%]
      return 28 + Math.round(ratio * 26);
    }
    
    // 5. Searching (TAFUTA)
    return 12;
  }, [distance, ride.status, ride.distance, isArriving, (ride as any).initialDistance, (ride as any).totalDistance]);

  const pickupTuple: [number, number] = useMemo(() => {
    return ride.driverLocation 
      ? [ride.driverLocation.lat, ride.driverLocation.lng] 
      : [ride.pickup.lat, ride.pickup.lng];
  }, [ride.driverLocation?.lat, ride.driverLocation?.lng, ride.pickup?.lat, ride.pickup?.lng]);

  const destTuple: [number, number] = useMemo(() => {
    return targetLocation 
      ? [targetLocation.lat, targetLocation.lng] 
      : [ride.destination.lat, ride.destination.lng];
  }, [targetLocation?.lat, targetLocation?.lng, ride.destination?.lat, ride.destination?.lng]);

  const routing = useRouting(pickupTuple, destTuple, true, (ride as any).stops);

  const statusText = isArriving ? 'Dereva anakuja...' : 'Safari Inaendelea';
  const targetLabel = isArriving ? 'Eneo la Pickup' : 'Unakokwenda';
  const distanceLabel = isArriving ? 'Umbali kwa Dereva' : 'Distance Left';

  const userAvatar = profile?.photoURL || user?.photoURL || (ride as any).customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || ride.customerId || 'Customer'}`;
  const userName = profile?.name || user?.displayName || (ride as any).customerInfo?.name || "Mteja";

  return (
    <div 
      className="absolute inset-0 bg-transparent z-50 pointer-events-none"
    >
      {/* Top Header Bar for Customer: Home / Back Button on Left & Profile Picture on Right */}
      <div className="absolute top-4 inset-x-4 z-[60] flex items-center justify-between pointer-events-none">
        {/* Left: Home Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={onGoHome || (() => { window.location.href = '/'; })}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl border backdrop-blur-xl transition-all cursor-pointer pointer-events-auto ${
            theme === 'dark' 
              ? 'bg-[#0B1220]/90 border-white/15 text-white shadow-black/40 hover:bg-[#111c33]' 
              : 'bg-white/95 border-neutral-200/80 text-neutral-800 shadow-neutral-300/40 hover:bg-neutral-50'
          }`}
          title="Rudi Nyumbani"
        >
          <Home className="w-5 h-5 text-indigo-500" />
        </motion.button>

        {/* Right: Customer Profile Picture */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className="pointer-events-auto flex items-center gap-2"
        >
          <div 
            className="relative w-11 h-11 rounded-full border-2 border-indigo-500/80 shadow-xl overflow-hidden bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer"
            title={`Wasifu wako: ${userName}`}
          >
            <img 
              src={userAvatar} 
              alt={userName} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            {/* Online Indicator Badge */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
          </div>
        </motion.div>
      </div>

      {/* Bottom Sheet Card */}
      <AnimatePresence>
        {showDetails && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 400 }}
            dragElastic={0.05}
            dragMomentum={false}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100) {
                setIsCollapsed(true);
              }
            }}
            className={`absolute bottom-4 left-4 right-4 max-w-[390px] md:mx-auto rounded-[24px] border p-3 pb-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)] z-[60] transition-all touch-none pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'}`}
          >
            {/* Header: Status and Drag Handle */}
            <div className="relative flex items-center justify-between mb-2 select-none">
              <div className="flex items-center gap-1.5">
                <div className={`border px-2 py-0.5 rounded-full flex items-center gap-1 animate-fade ${theme === 'dark' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/60' : 'bg-emerald-50 text-emerald-700 border-emerald-500/20'}`}>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-wider leading-none">{statusText}</span>
                </div>

                {activeViewersCount > 0 && (
                  <div 
                    title={activeViewerNames.join(", ")}
                    className={`relative group border px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm cursor-help ${theme === 'dark' ? 'bg-blue-950/20 text-blue-400 border-blue-900/40' : 'bg-blue-50 text-blue-700 border-blue-400/20'}`}
                  >
                    <span className="text-[8.5px] leading-none">👁️</span>
                    <span className="text-[8px] font-black uppercase tracking-wider leading-none">
                      {activeViewersCount} {activeViewersCount === 1 ? 'Anatazama' : 'Wanatazama'}
                    </span>
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block border rounded-xl px-3 py-2 text-[10px] font-medium whitespace-nowrap shadow-xl z-50 ${theme === 'dark' ? 'bg-[#161622] border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'}`}>
                      Inatazamwa na: <span className="text-indigo-500 font-bold">{activeViewerNames.join(", ")}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={`w-8 h-1 rounded-full cursor-grab active:cursor-grabbing absolute left-1/2 -translate-x-1/2 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

              <button 
                onClick={() => setIsCollapsed(true)}
                className={`text-[8.5px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-full transition-colors pointer-events-auto ${theme === 'dark' ? 'text-neutral-400 bg-neutral-900 hover:bg-neutral-850 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200'}`}
              >
                Ficha Maelezo
              </button>
            </div>

            {/* Combined compact Driver details & destination/ETA */}
            {ride.driverInfo && (
              <div className={`p-2.5 rounded-xl border mb-2 select-none transition-all ${theme === 'dark' ? 'bg-[#161622]/60 border-neutral-800/80 hover:bg-neutral-800/20' : 'bg-neutral-50/80 border-neutral-200/50 hover:bg-neutral-100'}`}>
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left Side: Driver and Vehicle */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-500 relative bg-neutral-100 dark:bg-neutral-800 shrink-0">
                      <img 
                        src={ride.driverInfo.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.driverId}`} 
                        alt="Driver" 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white rounded-full shadow-md" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className={`text-xs font-black uppercase font-heading truncate leading-none ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800'}`}>
                          {ride.driverInfo.name || 'Dereva'}
                        </h4>
                        <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          <span className="text-[8.5px] font-black font-mono leading-none">{ride.driverInfo.rating || '4.9'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="bg-amber-400 text-neutral-950 px-1.5 py-0.2 rounded font-mono font-black text-[9.5px] border border-amber-500">
                          TZ {ride.driverInfo.vehicle?.plate || 'T 842 DKP'}
                        </span>
                        <span className={`text-[8.5px] font-bold uppercase truncate ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}`}>
                          {ride.driverInfo.vehicle?.model || 'Toyota IST'} {ride.driverInfo.vehicle?.color ? `• ${ride.driverInfo.vehicle.color}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Destination & ETA */}
                  <div className="text-right flex flex-col items-end shrink-0 max-w-[45%]">
                    <div className="flex items-center gap-1">
                      <span className={`text-[7.5px] font-black text-neutral-400 uppercase tracking-widest leading-none`}>{targetLabel}:</span>
                      <span className={`text-[9px] font-bold uppercase truncate max-w-[90px] leading-none ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>
                        {targetLocation.address}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/60' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                        ETA
                      </span>
                      <span className={`text-xs font-black font-mono tracking-wider ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {eta ? `${eta.minutes}:${eta.seconds.toString().padStart(2, '0')}` : '00:00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pickup Note / Landmark if customer provided one */}
                {(ride.pickupNote || (ride as any).pickupNotes) && (
                  <div className="mt-2 pt-2 border-t border-neutral-200/40 dark:border-neutral-800/60 flex items-center gap-1.5 text-[9.5px]">
                    <span className="shrink-0 text-indigo-500 font-bold">📍 Maelekezo:</span>
                    <span className="truncate italic text-neutral-600 dark:text-neutral-300">
                      "{ride.pickupNote || (ride as any).pickupNotes}"
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* PapoShare Along-the-Way Waypoint Sequence (for Pooled Rides) */}
            {(ride.shareMode === 'share' || (ride.waypoints && ride.waypoints.length > 0)) && (
              <div className={`p-2.5 rounded-xl border mb-2 select-none ${theme === 'dark' ? 'bg-[#161622]/80 border-purple-900/40' : 'bg-purple-50/70 border-purple-200/70'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider">
                      PapoShare • Vituo Vya Kushusha
                    </span>
                  </div>
                  <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Okoa TZS {ride.sharedSavings?.toLocaleString() || '1,500'}
                  </span>
                </div>

                {/* Waypoints Sequence List */}
                <div className="space-y-1.5">
                  {(ride.waypoints || [
                    { id: '1', riderName: 'Wewe (Mteja A)', type: 'pickup', note: 'Kituo Kikuu', status: 'completed' },
                    { id: '2', riderName: 'Neema Mwajuma (B)', type: 'pickup', note: 'Njiani', status: 'pending' },
                    { id: '3', riderName: 'Neema Mwajuma (B)', type: 'dropoff', note: 'Shusha B', status: 'pending' },
                    { id: '4', riderName: 'Wewe (Mteja A)', type: 'dropoff', note: 'Shusha A', status: 'pending' },
                  ]).map((wp: any, idx: number) => {
                    const isCompleted = wp.status === 'completed';
                    return (
                      <div key={wp.id || idx} className="flex items-center justify-between text-[9px] font-bold">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-purple-500/20 text-purple-600 dark:text-purple-300'}`}>
                            {idx + 1}
                          </span>
                          <span className={`truncate ${isCompleted ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                            {wp.type === 'pickup' ? '🟢 Chukua' : '🔴 Shusha'} {wp.riderName}
                          </span>
                        </div>
                        <span className="text-[7.5px] font-black uppercase text-neutral-400 shrink-0 ml-1">
                          {wp.note || ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 pt-1.5 border-t border-purple-200/50 dark:border-purple-900/40 flex items-center justify-between text-[8px] text-purple-700 dark:text-purple-300 font-semibold">
                  <span>⏱️ Detour Budget: Max {ride.maxDetourBudgetMinutes || 3} min</span>
                  <span className="italic">Njia Imepangwa Kuzuia Foleni</span>
                </div>
              </div>
            )}

            {/* Intermediate Trip Stops (Vituo vya Safari) */}
            {ride.stops && Array.isArray(ride.stops) && ride.stops.length > 0 && (
              <div className={`p-2.5 rounded-xl border mb-2 select-none ${theme === 'dark' ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/70 border-amber-200/60'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">📍</span>
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Vituo vya Safari ({ride.stops.length})
                    </span>
                  </div>
                  <span className="text-[7.5px] font-bold text-amber-600/80 uppercase">Njiani</span>
                </div>
                <div className="space-y-1">
                  {ride.stops.map((stop: any, idx: number) => (
                    <div key={stop.id || idx} className="flex items-center gap-2 text-[9px] font-bold">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[7.5px] font-black shrink-0 shadow-sm">
                        {idx + 1}
                      </span>
                      <span className="truncate text-neutral-700 dark:text-neutral-200">
                        {stop.address || `Kituo #${idx + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Boda Boda "PapoSend Njiani" (Parcel Add-on Along-the-Way) */}
            {ride.parcelAddon && (
              <div className={`p-2.5 rounded-xl border mb-2 select-none flex items-center justify-between ${theme === 'dark' ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9.5px] font-black text-amber-700 dark:text-amber-300 uppercase">
                      PapoSend Mzigo Njiani: {ride.parcelAddon.packageType}
                    </p>
                    <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-semibold">
                      Kuelekea {ride.parcelAddon.delivery?.address || 'kituo cha mbele'}
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  +TZS {ride.parcelAddon.bonusEarningsTZS?.toLocaleString() || '2,500'}
                </span>
              </div>
            )}

            {/* Slim, Modern Trip Progress Bar */}
            <div className="mb-2 select-none pointer-events-auto">
              <div className={`relative h-8 rounded-xl border overflow-hidden p-1.5 flex flex-col justify-center ${theme === 'dark' ? 'bg-[#161622]/40 border-neutral-800/80 shadow-[0_4px_12px_rgba(0,0,0,0.1)]' : 'bg-neutral-50 border-neutral-200/60 shadow-sm'}`}>
                {/* Slim Road Line */}
                <div className={`w-full h-1 rounded-full relative overflow-visible flex items-center ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                  {/* Origin Point Marker */}
                  <div className="absolute left-0 -translate-x-1/2 -top-1.5 text-[8.5px] z-10">📍</div>
                  
                  {/* Destination Point Marker */}
                  <div className="absolute right-0 translate-x-1/2 -top-1.5 text-[8.5px] z-10">🏁</div>

                  {/* Route highlight */}
                  <div 
                    className="absolute left-0 h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" 
                    style={{ width: `${progress}%` }} 
                  />

                  {/* Hand-guided animating vehicle marker icon */}
                  <motion.div 
                    className="absolute -top-3.5 h-5 w-5 z-20 flex items-center justify-center select-none"
                    style={{ left: `calc(${progress}% - 10px)` }}
                    animate={{ 
                      y: [0, -1, 0],
                      scale: [1, 1.02, 1]
                    }}
                    transition={{ 
                      y: { repeat: Infinity, duration: 0.3, ease: "easeInOut" },
                      scale: { repeat: Infinity, duration: 0.4, ease: "easeInOut" }
                    }}
                  >
                    {ride.vehicleType === 'bike' ? (
                      <span className="text-xs" style={{ transform: 'scaleX(-1)' }}>🏍️</span>
                    ) : ride.vehicleType === 'bajaj' ? (
                      <span className="text-xs" style={{ transform: 'scaleX(-1)' }}>🛺</span>
                    ) : (
                      <span className="text-[10px]" style={{ transform: 'scaleX(-1)' }}>🚗</span>
                    )}
                  </motion.div>
                </div>

                {/* Swahili Translation HUD updates info */}
                <div className="flex justify-between items-center mt-1 font-black text-[7px] uppercase tracking-wider text-neutral-400">
                  <span>{isArriving ? 'Pikapu' : 'Mwanzo'}</span>
                  <span className={`font-black font-mono px-1 py-0.2 rounded border text-[6.5px] ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-500/20 text-emerald-700'}`}>
                    {progress}% YA SAFARI
                  </span>
                  <span>{isArriving ? 'Kufika' : 'Mwisho'}</span>
                </div>
              </div>

              {/* Status checkpoint steps badges - Small and clean */}
              <div className="flex justify-between items-center px-1 mt-0.5">
                {[
                  { label: 'OMBA', active: true },
                  { label: 'PATA', active: !!ride.driverId },
                  { label: 'SAFARINI', active: ride.status === 'on_trip' },
                  { label: 'FIKA', active: ride.status === 'completed' }
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center">
                    <div className={`w-1.5 h-1.5 rounded-full border transition-all duration-500 ${s.active ? 'bg-emerald-500 border-emerald-500 shadow-sm' : (theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-100 border-neutral-200')}`} />
                    <span className={`text-[5px] font-black uppercase tracking-widest mt-0.5 ${s.active ? (theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800') : 'text-neutral-500'}`}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unified Quick Actions & Distance Panel Footer */}
            <div className={`grid grid-cols-4 gap-1.5 mt-2 pt-2 border-t ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-100'}`}>
              {/* Distance Left Panel */}
              <div className={`col-span-1 rounded-xl p-1 border flex flex-col items-center justify-center text-center select-none ${theme === 'dark' ? 'bg-[#161622]/40 border-neutral-800/80' : 'bg-neutral-50 border-neutral-200/60'}`}>
                <Navigation2 className="w-3 h-3 text-indigo-500 mb-0.5" />
                <span className="text-[6px] font-black text-neutral-400 uppercase tracking-wider leading-none mb-0.5">{distanceLabel}</span>
                <span className={`text-[8.5px] font-black font-mono leading-none ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                  {distance ? distance.toFixed(1) : (ride.distance || '0.0')} km
                </span>
              </div>

              {/* Share Trip Button */}
              <button 
                onClick={() => setShowShareModal(true)}
                className={`col-span-1 border rounded-xl flex flex-col items-center justify-center text-center transition-all p-1 active:scale-95 cursor-pointer pointer-events-auto ${theme === 'dark' ? 'bg-[#161622]/40 border-neutral-800/80 hover:bg-neutral-800 text-neutral-300' : 'bg-neutral-50 border-neutral-200/60 hover:bg-neutral-100 text-neutral-800'}`}
              >
                <span className="text-xs mb-0.5">🔗</span>
                <span className="text-[7px] font-black uppercase tracking-widest text-neutral-400">Share</span>
              </button>

              {/* Chat Button */}
              {onMessage ? (
                <button 
                  onClick={onMessage}
                  className={`col-span-1 border rounded-xl flex flex-col items-center justify-center text-center transition-all p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-400 hover:bg-indigo-950/40' : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100/80 text-indigo-600'}`}
                >
                  <MessageSquare className="w-3 h-3 text-indigo-500 mb-0.5" />
                  <span className="text-[7px] font-black uppercase tracking-widest">Chat</span>
                </button>
              ) : (
                <div className="col-span-1" />
              )}

              {/* SOS safety Button (hidden for spectator viewers) */}
              {!isSpectator && (
                <button 
                  onClick={() => toast.error("SOS Aleriti ya Dharura imetumwa kwa kituo cha usalama!")}
                  className={`col-span-1 border rounded-xl flex flex-col items-center justify-center text-center transition-all p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-red-950/20 border-red-900/40 text-red-400 hover:bg-red-950/40' : 'bg-red-50 border-red-100 text-red-650 hover:bg-red-100'}`}
                >
                  <Shield className="w-3 h-3 text-red-500 mb-0.5" />
                  <span className="text-[7px] font-black uppercase tracking-widest">SOS</span>
                </button>
              )}
            </div>

            {/* Simulate Route Deviation Button has been removed from customer view as requested */}

            {/* Cancel Safari Action inside bottom details sheet */}
            {!isSpectator && onCancel && (
              <button
                onClick={onCancel}
                className={`w-full mt-2 h-8 border rounded-xl flex items-center justify-center gap-1 font-black tracking-wider text-[8px] uppercase transition-all active:scale-95 cursor-pointer pointer-events-auto ${theme === 'dark' ? 'bg-red-950/10 border-red-900/30 text-red-400 hover:bg-red-950/30' : 'bg-red-50 border-red-100 hover:bg-red-100 text-red-650'}`}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
                <span>GHAIRI SAFARI</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showDetails && !isMinimized && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[70] pointer-events-auto"
          >
            <button 
              onClick={() => setIsCollapsed(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-95 whitespace-nowrap"
            >
              <span>Onesha Maelezo</span>
              <span className="text-base text-white/80 animate-bounce">▲</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal Component */}
      <ShareTripModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        rideId={ride.id || "TGX-8821"}
        pickupAddress={ride.pickup.address}
        dropoffAddress={ride.destination.address}
        driverName={ride.driverInfo?.name}
        vehiclePlate={ride.driverInfo?.vehicle?.plate}
        vehicleModel={ride.driverInfo?.vehicle?.model}
      />
    </div>
  );
};
