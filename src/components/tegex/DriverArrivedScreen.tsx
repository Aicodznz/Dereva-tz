import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Phone, MessageSquare, Star, Clock, Navigation2 } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';

interface DriverArrivedScreenProps {
  ride: Ride;
  onCall: () => void;
  onMessage: () => void;
  onImComing?: () => void;
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

export const DriverArrivedScreen: React.FC<DriverArrivedScreenProps> = ({ ride, onCall, onMessage, onImComing }) => {
  const { distance, eta } = useDriverTracking(ride.driverLocation, ride.pickup);
  
  const isArrived = ride.status === 'driver_arrived';

  const userPin = useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="relative w-8 h-8 flex items-center justify-center">
             <div class="absolute inset-0 bg-[#1D9E75]/30 rounded-full animate-ping"></div>
             <div class="w-4 h-4 bg-[#1D9E75] rounded-full border-2 border-white shadow-xl"></div>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }), []);

  const driverPin = useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="relative bg-white w-10 h-10 rounded-2xl shadow-2xl flex items-center justify-center border-2 border-[#7F77DD]">
             <span class="text-xl">🚗</span>
             <div class="absolute -top-1 -right-1 w-4 h-4 bg-[#7F77DD] rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white">
               ${ride.driverInfo?.name?.charAt(0) || 'D'}
             </div>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  }), [ride.driverInfo]);

  return (
    <div 
      className={`flex-1 w-full bg-[#0a0a0f] flex flex-col relative z-50 ${isArrived ? 'animate-haptic' : ''}`}
    >
      {/* Top Notification Banner */}
      <AnimatePresence>
        {isArrived && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 24 }}
            className="absolute top-0 inset-x-4 z-[70] bg-[#1D9E75] p-4 rounded-2xl shadow-2xl border-2 border-white/20 flex items-center gap-4 animate-bounce"
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

      {/* Map Layer */}
      <div className="flex-1 relative z-0 min-h-[300px]">
        <MapContainer 
          center={ride.pickup} 
          zoom={15} 
          className="h-full w-full grayscale contrast-[1.1] brightness-[0.9]"
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapControl position={ride.driverLocation} target={ride.pickup} />
          <Marker position={ride.pickup} icon={userPin} />
          {ride.driverLocation && (
            <>
              <Marker position={ride.driverLocation} icon={driverPin} />
              <Polyline 
                positions={[ride.driverLocation, ride.pickup]} 
                color="#7F77DD" 
                weight={4} 
                dashArray="10, 15"
                opacity={0.6}
              />
            </>
          )}
        </MapContainer>

        {/* Floating ETA Chip */}
        {eta && !isArrived && (
          <div 
            className="absolute top-8 left-1/2 -translate-x-1/2 bg-[#111118]/90 backdrop-blur-xl border border-[#1e1e2e] rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl z-[60]"
          >
            <Clock className="w-3 h-3 text-[#7F77DD]" />
            <span className="text-[10px] font-black text-[#f0eeff] uppercase tracking-widest whitespace-nowrap">
              Dereva anakuja — {eta.minutes} min {eta.seconds} sec
            </span>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <motion.div 
        drag="y"
        dragConstraints={{ top: 0, bottom: 400 }}
        dragElastic={0.05}
        dragMomentum={false}
        className={`bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-8 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[60] transition-colors duration-500 touch-none ${isArrived ? 'ring-4 ring-[#1D9E75]/20' : ''}`}
      >
        <div className="w-12 h-1.5 bg-[#1e1e2e] rounded-full mx-auto mb-8 cursor-grab active:cursor-grabbing" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#7F77DD]/30 bg-[#0a0a0f] flex items-center justify-center text-xl font-black text-[#7F77DD]">
              {ride.driverInfo?.photo ? <img src={ride.driverInfo.photo} className="w-full h-full object-cover" /> : ride.driverInfo?.name?.charAt(0) || 'D'}
            </div>
            <div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter leading-none mb-1">
                {ride.driverInfo?.name || "Dereva Swahili"}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">
                  {ride.driverInfo?.vehicle.model} · {ride.driverInfo?.vehicle.plate}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-[#D85A30]">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-xs font-black">{ride.driverInfo?.rating || "4.8"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button onClick={onCall} className="h-14 bg-[#1e1e2e] border border-[#2e2e3e] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
            <Phone className="w-5 h-5 text-[#f0eeff]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f0eeff]">Piga Simu</span>
          </button>
          <button onClick={onMessage} className="h-14 bg-[#1e1e2e] border border-[#2e2e3e] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
            <MessageSquare className="w-5 h-5 text-[#f0eeff]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f0eeff]">Tuma Ujumbe</span>
          </button>
        </div>

        <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all duration-500 ${isArrived ? 'bg-[#1D9E75]/10 border-[#1D9E75]/30' : 'bg-[#0a0a0f] border-[#1e1e2e]'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isArrived ? 'bg-[#1D9E75]/20 animate-bounce' : 'bg-[#111118]'}`}>
              {isArrived ? '🎉' : '🟢'}
            </div>
            <div>
              <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest mb-0.5">Status</p>
              <h4 className={`text-xs font-black italic uppercase transition-colors ${isArrived ? 'text-[#1D9E75]' : 'text-[#f0eeff]'}`}>
                {isArrived ? 'Dereva Amefika!' : 'Anakuja Kukuchukua'}
              </h4>
            </div>
          </div>
          {!isArrived && distance !== null && (
            <div className="text-right">
              <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest mb-0.5">Distance</p>
              <h4 className="text-xs font-black text-[#f0eeff] italic">{distance.toFixed(1)} km · {eta?.minutes} dak</h4>
            </div>
          )}
          {isArrived && (
            <button 
              onClick={onImComing}
              className="px-6 h-10 bg-[#1D9E75] rounded-full text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
            >
              Nimeingia Garini
            </button>
          )}
        </div>
      </motion.div>

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
