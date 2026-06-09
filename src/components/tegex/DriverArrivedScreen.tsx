import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Phone, MessageSquare, Star, Clock, Navigation2 } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';

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
              className="absolute top-0 inset-x-4 z-[70] bg-[#1D9E75] p-4 rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-4 animate-bounce pointer-events-auto"
            >
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🚗</div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-white italic uppercase tracking-tighter leading-none mb-1">Dereva Amefika!</h4>
                <p className="text-[10px] font-bold text-white/80 uppercase whitespace-nowrap">
                  {ride.driverInfo?.vehicle.model} · {ride.driverInfo?.vehicle.plate}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating ETA Chip */}
        {eta && !isArrived && showDetails && (
          <div 
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#111118]/90 backdrop-blur-xl border border-[#1e1e2e] rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl z-[60] pointer-events-auto"
          >
            <Clock className="w-3 h-3 text-[#7F77DD]" />
            <span className="text-[10px] font-black text-[#f0eeff] uppercase tracking-widest whitespace-nowrap">
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
            className={`absolute bottom-0 left-0 right-0 w-full bg-[#0A0C14]/95 backdrop-blur-[20px] rounded-t-[40px] border-t border-white/10 p-8 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] z-[60] transition-all touch-none pointer-events-auto ${isArrived ? 'ring-4 ring-[#00E5A0]/20' : ''}`}
          >
            <div className="relative flex items-center justify-center mb-6">
              <div className="w-12 h-1.5 bg-white/10 rounded-full cursor-grab active:cursor-grabbing" />
              <button 
                onClick={() => setIsCollapsed(true)}
                className="absolute right-0 text-[10px] font-black uppercase text-[#8A8FA8] hover:text-white tracking-[0.15em] px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full transition-colors pointer-events-auto"
              >
                Ficha Maelezo
              </button>
            </div>
        
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#00E5A0] bg-[#080A12] flex items-center justify-center shadow-[0_0_12px_rgba(0,229,160,0.2)]">
                  {ride.driverInfo?.photo ? (
                    <img src={ride.driverInfo.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-xl font-bold text-[#00E5A0] font-heading">{ride.driverInfo?.name?.charAt(0) || 'D'}</div>
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase text-white font-heading tracking-wide leading-none mb-1">
                    {ride.driverInfo?.name || "Dereva Swahili"}
                  </h4>
                  <p className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wider">
                    {ride.driverInfo?.vehicle.model} · <span className="text-[#00E5A0] font-mono">{ride.driverInfo?.vehicle.plate}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end justify-center bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5 text-yellow-400">
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
                  className="h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all text-white pointer-events-auto hover:bg-white/10"
                >
                  <Phone className="w-4 h-4 text-[#00E5A0]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] font-heading">Call</span>
                </button>
                <button 
                  onClick={onMessage} 
                  className="h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all text-white pointer-events-auto hover:bg-white/10"
                >
                  <MessageSquare className="w-4 h-4 text-[#00E5A0]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] font-heading">Chat</span>
                </button>
                <button 
                  onClick={onCancel || (() => {})} 
                  className="h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all text-red-400 pointer-events-auto hover:bg-red-500/20"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] font-heading">✕ Cancel</span>
                </button>
              </div>
            )}

            <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all duration-500 ${isArrived ? 'bg-[#00E5A0]/10 border-[#00E5A0]/30 shadow-[0_4px_20px_rgba(0,229,160,0.1)]' : 'bg-[#080A12] border-white/5'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isArrived ? 'bg-[#00E5A0]/20 animate-bounce' : 'bg-white/5'}`}>
                  {isArrived ? '🎉' : '🟢'}
                </div>
                <div>
                  <p className="text-[8px] font-black text-[#8A8FA8] uppercase tracking-widest mb-0.5">Hali ya Safari</p>
                  <h4 className={`text-xs font-black uppercase font-heading tracking-wide transition-colors ${isArrived ? 'text-[#00E5A0]' : 'text-white'}`}>
                    {isArrived ? 'Dereva Amefika!' : 'Anakuja Kukuchukua'}
                  </h4>
                </div>
              </div>
              {!isArrived && distance !== null && (
                <div className="text-right">
                  <p className="text-[8px] font-black text-[#8A8FA8] uppercase tracking-widest mb-0.5">Umbali</p>
                  <h4 className="text-xs font-black text-white px-2 py-0.5 bg-white/5 rounded border border-white/5 inline-block font-mono tracking-wide">{distance.toFixed(1)} km · {eta?.minutes} min</h4>
                </div>
              )}
              {isArrived && onImComing && !isSpectator && (
                <button 
                  onClick={onImComing}
                  className="px-6 h-10 bg-[#00E5A0] rounded-full text-[10px] font-black uppercase tracking-[0.1em] text-[#0A0C14] hover:brightness-110 active:scale-95 transition-all"
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
              className="bg-[#1D9E75] hover:bg-[#16815f] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-2xl font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-95 whitespace-nowrap"
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
