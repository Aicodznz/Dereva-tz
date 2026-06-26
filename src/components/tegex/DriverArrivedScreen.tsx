import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Phone, MessageSquare, Star, Clock, Navigation2 } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useTheme } from 'next-themes';

interface DriverArrivedScreenProps {
  ride: Ride;
  onCall: () => void;
  onMessage: () => void;
  onImComing?: () => void;
  onCancel?: () => void;
  isMinimized?: boolean;
  isSpectator?: boolean;
}

const MapControl = ({ position, target }: { position: { lat: number, lng: number } | any, target: { lat: number, lng: number } | any }) => {
  const map = useMap();
  const lastFitRef = React.useRef<{ lat: number, lng: number } | null>(null);

  React.useEffect(() => {
    if (position && target) {
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
    } else if (position) {
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
            className={`absolute bottom-0 left-0 right-0 w-full rounded-t-[40px] border-t p-8 pb-12 shadow-[0_-15px_35px_rgba(0,0,0,0.08)] z-[60] transition-all touch-none pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'} ${isArrived ? 'ring-4 ring-emerald-500/10' : ''}`}
          >
            <div className="relative flex items-center justify-center mb-6">
              <div className={`w-12 h-1.5 rounded-full cursor-grab active:cursor-grabbing ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
              <button 
                onClick={() => setIsCollapsed(true)}
                className={`absolute right-0 text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full transition-colors pointer-events-auto ${theme === 'dark' ? 'text-neutral-400 bg-neutral-900 hover:bg-neutral-850 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200'}`}
              >
                Ficha Maelezo
              </button>
            </div>
        
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-500 bg-neutral-50 flex items-center justify-center shadow-sm">
                  {ride.driverInfo?.photo ? (
                    <img src={ride.driverInfo.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-xl font-bold text-emerald-600 font-heading">{ride.driverInfo?.name?.charAt(0) || 'D'}</div>
                  )}
                </div>
                <div>
                  <h4 className={`text-xl font-black uppercase font-heading tracking-wide leading-none mb-1 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800'}`}>
                    {ride.driverInfo?.name || "Dereva Swahili"}
                  </h4>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {ride.driverInfo?.vehicle.model} · <span className="text-indigo-400 font-mono font-black">{ride.driverInfo?.vehicle.plate}</span>
                  </p>
                </div>
              </div>
              <div className={`flex flex-col items-end justify-center px-3 py-1.5 rounded-xl border ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-100'}`}>
                <div className="flex items-center gap-1.5 text-yellow-500">
                  <Star className="w-4.5 h-4.5 fill-current" />
                  <span className="text-sm font-black font-mono">{ride.driverInfo?.rating || "4.8"}</span>
                </div>
              </div>
            </div>

            {/* Premium Pill Action Buttons Row */}
            {!isSpectator && (
              <div className="grid grid-cols-3 gap-3 mb-8">
                <button 
                  onClick={onCall} 
                  className={`h-12 border rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-[#161622] border-neutral-800 text-neutral-200 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'}`}
                >
                  <Phone className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] font-heading">Call</span>
                </button>
                <button 
                  onClick={onMessage} 
                  className={`h-12 border rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-[#161622] border-neutral-800 text-neutral-200 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'}`}
                >
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] font-heading">Chat</span>
                </button>
                <button 
                  onClick={onCancel || (() => {})} 
                  className={`h-12 border rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all pointer-events-auto ${theme === 'dark' ? 'bg-red-950/20 border-red-900/40 text-red-400 hover:bg-red-950/40' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] font-heading">✕ Cancel</span>
                </button>
              </div>
            )}

            <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all duration-500 ${
              isArrived 
                ? (theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.05)]') 
                : (theme === 'dark' ? 'bg-[#161622] border-neutral-800' : 'bg-neutral-50 border-neutral-200/60')
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isArrived ? 'bg-emerald-100 animate-bounce' : (theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200/50')}`}>
                  {isArrived ? '🎉' : '🟢'}
                </div>
                <div>
                  <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Hali ya Safari</p>
                  <h4 className={`text-xs font-black uppercase font-heading tracking-wide transition-colors ${isArrived ? 'text-emerald-500' : (theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700')}`}>
                    {isArrived ? 'Dereva Amefika!' : 'Anakuja Kukuchukua'}
                  </h4>
                </div>
              </div>
              {!isArrived && distance !== null && (
                <div className="text-right">
                  <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Umbali</p>
                  <h4 className={`text-xs font-black px-2 py-0.5 rounded border inline-block font-mono tracking-wide ${theme === 'dark' ? 'text-neutral-300 bg-neutral-900 border-neutral-800' : 'text-neutral-700 bg-neutral-100 border-neutral-200'}`}>{distance.toFixed(1)} km · {eta?.minutes} min</h4>
                </div>
              )}
              {isArrived && onImComing && !isSpectator && (
                <button 
                  onClick={onImComing}
                  className="px-6 h-10 bg-emerald-600 hover:bg-emerald-700 rounded-full text-[10px] font-black uppercase tracking-[0.1em] text-white hover:brightness-110 active:scale-95 transition-all"
                >
                  Nimeingia Garini
                </button>
              )}
            </div>
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
