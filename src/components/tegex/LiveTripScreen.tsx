import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Shield, Clock, Navigation2, MapPin, MessageSquare, Star } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { toast } from 'sonner';

interface LiveTripScreenProps {
  ride: Ride;
  onMessage?: () => void;
  isMinimized?: boolean;
}

const MapControl = ({ position, target }: { position: { lat: number, lng: number } | any, target: { lat: number, lng: number } | any }) => {
  const map = useMap();
  const lastFitRef = React.useRef<{ lat: number, lng: number } | null>(null);

  React.useEffect(() => {
    if (position && target) {
      const latLngPos = L.latLng(position.lat, position.lng);
      
      // Smooth travel follow
      map.flyTo([position.lat, position.lng], map.getZoom(), { duration: 0.8 });

      const distFromLastFit = lastFitRef.current ? latLngPos.distanceTo(lastFitRef.current) : 1000;
      if (distFromLastFit > 150) {
        const bounds = L.latLngBounds([
          [position.lat, position.lng],
          [target.lat, target.lng]
        ]);
        map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 1.5 });
        lastFitRef.current = { lat: position.lat, lng: position.lng };
      }
    } else if (position) {
      map.flyTo([position.lat, position.lng], 16, { duration: 0.5 });
    } else if (target) {
      map.flyTo([target.lat, target.lng], 14, { duration: 0.5 });
    }
  }, [position?.lat, position?.lng, target?.lat, target?.lng, map]);
  return null;
};

export const LiveTripScreen: React.FC<LiveTripScreenProps> = ({ ride, onMessage, isMinimized }) => {
  const isArriving = ride.status !== 'on_trip';
  const targetLocation = isArriving ? ride.pickup : ride.destination;
  const { distance, eta } = useDriverTracking(ride.driverLocation, targetLocation);
  
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const showDetails = !isMinimized && !isCollapsed;

  // Progress calculation
  const progress = useMemo(() => {
    if (!ride.distance || distance === null) return 0;
    if (isArriving) return 0;
    const travelled = Math.max(0, ride.distance - distance);
    const p = Math.round((travelled / ride.distance) * 100);
    return Math.min(100, Math.max(0, p));
  }, [distance, ride.distance, isArriving]);

  const statusText = isArriving ? 'Dereva anakuja...' : 'Safari Inaendelea';
  const targetLabel = isArriving ? 'Eneo la Pickup' : 'Unakokwenda';
  const distanceLabel = isArriving ? 'Umbali kwa Dereva' : 'Distance Left';

  return (
    <div 
      className="absolute inset-0 bg-transparent z-50 pointer-events-none"
    >
      {/* Top Floating Content (HUD) */}
      <div className="absolute top-0 inset-x-0 pointer-events-none">
        {/* Status Pill */}
        <AnimatePresence>
          {showDetails && (
            <motion.div 
              initial={{ x: -100 }}
              animate={{ x: 0 }}
              exit={{ x: -100 }}
              className="absolute top-24 left-6 z-[60] pointer-events-auto"
            >
              <div className="bg-[#1D9E75] text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{statusText}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Driver Info Card - Modern Floating */}
        <AnimatePresence>
          {showDetails && ride.driverInfo && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute top-40 inset-x-6 z-[60] glass-morphism rounded-[24px] p-4 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 relative">
                    <img src={ride.driverInfo.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.driverId}`} alt="Driver" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#00FF88] border-2 border-[#111118] rounded-full" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white italic uppercase">{ride.driverInfo.name || 'Dereva'}</h4>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-[10px] font-black text-white/70">{ride.driverInfo.rating || '4.8'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[#00FF88] uppercase tracking-widest">{ride.driverInfo.vehicle.plate || 'T 123 ABC'}</p>
                  <p className="text-[9px] font-bold text-white/50 uppercase">{ride.driverInfo.vehicle?.model || 'Mini'}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                <button 
                  onClick={() => toast.info("Link ya safari imenakiliwa!")}
                  className="flex-1 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Share Trip</span>
                </button>
                {onMessage && (
                  <button 
                    onClick={onMessage}
                    className="w-12 h-10 bg-[#00FF88]/10 text-[#00FF88] rounded-xl flex items-center justify-center border border-[#00FF88]/20"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SOS Button */}
        <AnimatePresence>
          {showDetails && (
            <motion.button 
              initial={{ x: 100 }}
              animate={{ x: 0 }}
              exit={{ x: 100 }}
              className="absolute top-24 right-6 w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-2xl z-[60] active:scale-90 transition-transform pointer-events-auto"
            >
               <Shield className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>
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
            className="absolute bottom-0 left-0 right-0 w-full bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-8 pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[60] touch-none pointer-events-auto"
          >
            <div className="relative flex items-center justify-center mb-6">
              <div className="w-12 h-1.5 bg-[#1e1e2e] rounded-full cursor-grab active:cursor-grabbing" />
              <button 
                onClick={() => setIsCollapsed(true)}
                className="absolute right-0 text-[10px] font-black uppercase text-[#6b6b8a] hover:text-white tracking-widest px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors pointer-events-auto"
              >
                Ficha Maelezo
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-8">
               <div className="space-y-1">
                  <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">{targetLabel}</p>
                  <h3 className="text-sm font-black text-[#f0eeff] italic truncate max-w-[200px]">
                    {targetLocation.address}
                  </h3>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">ETA</p>
                  <h3 className="text-2xl font-black text-[#1D9E75] italic tracking-tighter">
                    {eta ? `${eta.minutes}:${eta.seconds.toString().padStart(2, '0')}` : '00:00'}
                  </h3>
               </div>
            </div>

            {/* Trip Status Steps */}
            <div className="flex justify-between items-center mb-8 px-2">
              {[
                { label: 'SEARCH', active: true },
                { label: 'FOUND', active: !!ride.driverId },
                { label: 'ON TRIP', active: ride.status === 'on_trip' },
                { label: 'ARRIVED', active: ride.status === 'completed' }
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${s.active ? 'bg-[#00FF88] border-[#00FF88] shadow-[0_0_8px_#00FF88]' : 'bg-white/5 border-white/10'}`} />
                    <span className={`text-[7px] font-black uppercase tracking-widest ${s.active ? 'text-white' : 'text-[#6b6b8a]'}`}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 h-[2px] mb-4 mx-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: arr[i+1].active ? '100%' : '0%' }}
                        className="h-full bg-[#00FF88]"
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center justify-between p-5 bg-[#0a0a0f] rounded-3xl border border-[#1e1e2e]">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#111118] rounded-xl flex items-center justify-center">
                     <Navigation2 className="w-5 h-5 text-[#1D9E75]" />
                  </div>
                  <div>
                     <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest">{distanceLabel}</p>
                     <h4 className="text-xs font-black text-[#f0eeff] italic">
                       {distance ? distance.toFixed(1) : (ride.distance || '0.0')} km
                     </h4>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                 {onMessage && (
                   <button 
                     onClick={onMessage}
                     className="w-10 h-10 bg-[#111118] border border-[#1e1e2e] rounded-xl flex items-center justify-center text-[#1D9E75] active:scale-90 transition-transform"
                   >
                     <MessageSquare className="w-4 h-4" />
                   </button>
                 )}
                 <button className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                   SOS Dharura
                 </button>
               </div>
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
    </div>
  );
};
