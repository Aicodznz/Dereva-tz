import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Phone, MessageSquare, Star, Clock, Navigation2, Share2, KeyRound } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useTheme } from '../../ThemeContext';
import { RidePinDisplay } from '../common/RidePinVerification';
import { ShareTripModal } from '../common/ShareTripModal';

interface DriverArrivedScreenProps {
  ride: Ride;
  onCall: () => void;
  onMessage: () => void;
  onImComing?: () => void;
  onCancel?: () => void;
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
      const latLngTarget = L.latLng(target.lat, target.lng);
      const totalDist = latLngPos.distanceTo(latLngTarget);

      // Smooth flying to the driver's current position to show movement
      map.flyTo([position.lat, position.lng], map.getZoom(), { duration: 0.8 });

      // Only refit bounds if significantly changed to avoid jumpy zoom
      const distFromLastFit = lastFitRef.current ? latLngPos.distanceTo(lastFitRef.current) : 1000;
      if (distFromLastFit > 100) {
        const bounds = L.latLngBounds([
          [position.lat, position.lng],
          [target.lat, target.lng]
        ]);
        map.fitBounds(bounds, { padding: [80, 80], animate: true, duration: 1.5 });
        lastFitRef.current = { lat: position.lat, lng: position.lng };
      }
    } else if (hasPos) {
      map.flyTo([position.lat, position.lng], 16, { duration: 0.5 });
    }
  }, [position?.lat, position?.lng, target?.lat, target?.lng, map]);
  return null;
};

export const DriverArrivedScreen: React.FC<DriverArrivedScreenProps> = ({ ride, onCall, onMessage, onImComing, onCancel, isMinimized, isSpectator }) => {
  const { distance, eta } = useDriverTracking(ride.driverLocation, ride.pickup);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const showDetails = !isMinimized && !isCollapsed;

  const isArrived = ride.status === 'driver_arrived';

  return (
    <div 
      className={`absolute inset-0 bg-transparent z-50 pointer-events-none ${isArrived ? 'animate-haptic' : ''}`}
    >
      {/* Top Floating Content (HUD) */}
      <div className="absolute top-0 inset-x-0 pointer-events-none">
        {/* Top Notification Banner */}
        <AnimatePresence>
          {isArrived && showDetails && (
            <motion.div 
              initial={{ y: -100 }}
              animate={{ y: 80 }}
              exit={{ y: -100 }}
              className="absolute top-0 inset-x-4 z-[70] bg-emerald-600 p-4 rounded-2xl shadow-xl border border-emerald-500/30 flex items-center gap-4 animate-bounce pointer-events-auto"
            >
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🚗</div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-white italic uppercase tracking-tighter leading-none mb-1">Dereva Amefika!</h4>
                <p className="text-[10px] font-bold text-white/90 uppercase whitespace-nowrap">
                  {ride.driverInfo?.vehicle.model} · {ride.driverInfo?.vehicle.plate}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating ETA Chip */}
        {eta && !isArrived && showDetails && (
          <div 
            className={`absolute top-24 left-1/2 -translate-x-1/2 border rounded-full px-4 py-2 flex items-center gap-2 shadow-md z-[60] pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200'}`}
          >
            <Clock className="w-3 h-3 text-indigo-500" />
            <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
              Dereva anakuja — {eta.minutes} min {eta.seconds} sec
            </span>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
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
            className={`absolute bottom-0 left-0 right-0 w-full rounded-t-[32px] border-t p-5 pb-8 shadow-[0_-15px_35px_rgba(0,0,0,0.15)] z-[60] transition-all touch-none pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'} ${isArrived ? 'ring-2 ring-emerald-500/20' : ''}`}
          >
            <div className="relative flex items-center justify-center mb-4">
              <div className={`w-10 h-1 rounded-full cursor-grab active:cursor-grabbing ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
              <button 
                onClick={() => setIsCollapsed(true)}
                className={`absolute right-0 text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full transition-colors pointer-events-auto ${theme === 'dark' ? 'text-neutral-400 bg-neutral-900 hover:bg-neutral-850 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200'}`}
              >
                Ficha Maelezo
              </button>
            </div>
        
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-emerald-500 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shadow-md shrink-0">
                    {ride.driverInfo?.photo ? (
                      <img src={ride.driverInfo.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="text-xl font-black text-emerald-600 font-heading">{ride.driverInfo?.name?.charAt(0) || 'D'}</div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[10px]" title="Dereva Aliyethibitishwa">
                    ✓
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className={`text-base font-black uppercase font-heading tracking-wide leading-none truncate ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800'}`}>
                      {ride.driverInfo?.name || "Dereva Swahili"}
                    </h4>
                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 shrink-0">
                      🛡️ VERIFIED
                    </span>
                  </div>

                  {/* Tanzanian Plate & Vehicle Color / Model Display */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="inline-flex items-center gap-1 bg-amber-400 text-neutral-950 px-2 py-0.5 rounded-md font-mono font-black text-[11px] shadow-xs border border-amber-500 tracking-wider">
                      <span className="text-[8px] font-bold opacity-75">TZ</span>
                      <span>{ride.driverInfo?.vehicle.plate || "T 842 DKP"}</span>
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase truncate ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      {ride.driverInfo?.vehicle.model || "Toyota IST"} {ride.driverInfo?.vehicle.color ? `• ${ride.driverInfo.vehicle.color}` : "• Nyeupe"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`flex flex-col items-end justify-center px-2.5 py-1.5 rounded-xl border shrink-0 ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200/80 shadow-xs'}`}>
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-black font-mono">{ride.driverInfo?.rating || "4.9"}</span>
                </div>
                <span className="text-[7.5px] font-bold text-neutral-400 uppercase">500+ Safari</span>
              </div>
            </div>

            {/* Customer Pickup Note / Landmark if entered */}
            {(ride.pickupNote || (ride as any).pickupNotes) && (
              <div className={`mb-3 p-2.5 rounded-xl border flex items-start gap-2 ${
                theme === 'dark' ? 'bg-indigo-950/30 border-indigo-900/50 text-indigo-200' : 'bg-indigo-50/70 border-indigo-200/70 text-indigo-950'
              }`}>
                <span className="text-sm shrink-0">📍</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Maelekezo ya Ziada kwa Dereva:
                  </p>
                  <p className="text-[11px] font-semibold italic mt-0.5 leading-snug">
                    "{ride.pickupNote || (ride as any).pickupNotes}"
                  </p>
                </div>
              </div>
            )}

            {/* Elegant, Modern Countdown & Pickup Info Container directly below profile pic */}
            <div className={`mb-4 p-3 rounded-xl border transition-all duration-300 text-left ${
              theme === 'dark' 
                ? 'bg-[#161622]/40 border-neutral-800/80 shadow-[0_4px_12px_rgba(0,0,0,0.1)]' 
                : 'bg-neutral-50 border-neutral-200/60 shadow-sm'
            }`}>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {isArrived ? 'HALI YA SAFARI' : 'DEREVA ATAKUJA BAADA YA'}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {distance !== null ? `${distance.toFixed(1)} km imebaki` : ''}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <div className={`px-2.5 py-1 rounded-lg font-mono font-black tracking-widest text-xs ${
                    isArrived 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                  }`}>
                    {isArrived ? (
                      <span className="animate-pulse">DEREVA KASHAFIKA!</span>
                    ) : eta ? (
                      `[ ${eta.minutes.toString().padStart(2, '0')}:${eta.seconds.toString().padStart(2, '0')} ]`
                    ) : (
                      '--:--'
                    )}
                  </div>
                  {!isArrived && (
                    <span className={`text-[8px] font-semibold italic ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      countdown
                    </span>
                  )}
                </div>

                <div className="h-[1px] w-full bg-neutral-200/10 dark:bg-white/5 my-0.5" />

                <div className="flex items-center gap-1.5 text-left min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isArrived ? 'bg-emerald-500 animate-ping' : 'bg-indigo-500'}`} />
                  <p className={`text-[10.5px] truncate leading-none ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    <span className={`font-black text-[8px] uppercase tracking-wider mr-1 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>KUTOKA:</span>
                    <span className="font-bold">{ride.pickup.address}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Ride Verification PIN Display Badge */}
            {!isSpectator && (
              <div className="mb-3 pointer-events-auto">
                <RidePinDisplay pin={(ride as any).verificationPin || "4821"} />
              </div>
            )}
 
             {/* Premium Pill Action Buttons Row */}
             {!isSpectator && (
               <div className="grid grid-cols-4 gap-2">
                 <button 
                   onClick={onCall} 
                   className={`h-10 border rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-[#161622] border-neutral-800 text-neutral-200 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'}`}
                 >
                   <Phone className="w-3.5 h-3.5 text-emerald-500" />
                   <span className="text-[9px] font-black uppercase tracking-[0.08em] font-heading">Call</span>
                 </button>
                 <button 
                   onClick={onMessage} 
                   className={`h-10 border rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-[#161622] border-neutral-800 text-neutral-200 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'}`}
                 >
                   <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                   <span className="text-[9px] font-black uppercase tracking-[0.08em] font-heading">Chat</span>
                 </button>
                 <button 
                   onClick={() => setShowShareModal(true)} 
                   className={`h-10 border rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-[#161622] border-neutral-800 text-neutral-200 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'}`}
                 >
                   <Share2 className="w-3.5 h-3.5 text-teal-400" />
                   <span className="text-[9px] font-black uppercase tracking-[0.08em] font-heading">Share</span>
                 </button>
                 <button 
                   onClick={onCancel || (() => {})} 
                   className={`h-10 border rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-red-950/20 border-red-900/40 text-red-400 hover:bg-red-950/40' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'}`}
                 >
                   <span className="text-[9px] font-black uppercase tracking-[0.08em] font-heading">✕ Cancel</span>
                 </button>
               </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Trip Modal (placed outside draggable sheet so touches and clicks work reliably) */}
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

      {/* Haptic Simulation Effect */}
      {isArrived && (
        <style>{`
          @keyframes vhaptic {
            0% { transform: translate(0, 0); }
            25% { transform: translate(2px, 0); }
            50% { transform: translate(0, 0); }
            75% { transform: translate(-2px, 0); }
            100% { transform: translate(0, 0); }
          }
          .animate-haptic { animation: vhaptic 0.1s linear infinite; }
        `}</style>
      )}
    </div>
  );
};
