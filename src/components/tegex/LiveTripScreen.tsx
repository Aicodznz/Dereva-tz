import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Shield, Clock, Navigation2, MapPin } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';

interface LiveTripScreenProps {
  ride: Ride;
}

export const LiveTripScreen: React.FC<LiveTripScreenProps> = ({ ride }) => {
  const { distance, eta } = useDriverTracking(ride.driverLocation, ride.destination);
  
  // Progress calculation
  const progress = useMemo(() => {
    if (!ride.routeCoords || ride.routeCoords.length === 0 || !ride.driverLocation) return 0;
    // Simple progress based on distance to destination vs total distance
    // In real app, we'd find closest point on route
    return 65; // Mocking 65% for visual
  }, [ride.driverLocation, ride.routeCoords]);

  const carIcon = useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="relative bg-[#1D9E75] w-12 h-12 rounded-2xl shadow-[0_0_30px_rgba(29,158,117,0.4)] flex items-center justify-center border-2 border-white">
             <span class="text-2xl">🚗</span>
             <div class="absolute -bottom-1 w-2 h-2 bg-white rounded-full"></div>
           </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  }), []);

  const destPin = useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-6 h-6 bg-[#D85A30] rounded-full border-2 border-white shadow-lg flex items-center justify-center">
             <MapPin className="w-3 h-3 text-white" />
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  }), []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-[#0a0a0f] flex flex-col"
    >
      <div className="flex-1 relative z-0">
        <MapContainer 
          center={ride.driverLocation || ride.pickup} 
          zoom={16} 
          className="h-full w-full grayscale contrast-[1.1] brightness-[0.9]"
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={ride.destination} icon={destPin} />
          {ride.driverLocation && (
            <>
              <Marker position={ride.driverLocation} icon={carIcon} />
              {ride.routeCoords && (
                 <Polyline 
                   positions={ride.routeCoords.map(c => [c.lat, c.lng]) as [number, number][]} 
                   color="#1D9E75" 
                   weight={6} 
                   opacity={0.8}
                 />
              )}
            </>
          )}
        </MapContainer>

        {/* Status Pill */}
        <div className="absolute top-8 left-6 z-[60]">
          <div className="bg-[#1D9E75] text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Safari Inaendelea</span>
          </div>
        </div>

        {/* SOS Button */}
        <button className="absolute top-8 right-6 w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-2xl z-[60] active:scale-90 transition-transform">
           <Shield className="w-6 h-6" />
        </button>
      </div>

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-8 pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[60]"
      >
        <div className="w-12 h-1.5 bg-[#1e1e2e] rounded-full mx-auto mb-8" />
        
        <div className="flex items-center justify-between mb-8">
           <div className="space-y-1">
              <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">Unakokwenda</p>
              <h3 className="text-sm font-black text-[#f0eeff] italic truncate max-w-[200px]">
                {ride.destination.address}
              </h3>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">ETA</p>
              <h3 className="text-2xl font-black text-[#1D9E75] italic tracking-tighter">
                {eta ? `${eta.minutes}:${eta.seconds.toString().padStart(2, '0')}` : '00:00'}
              </h3>
           </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3 mb-8">
           <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-[#6b6b8a]">
              <span>Trip Progress</span>
              <span>{progress}%</span>
           </div>
           <div className="h-3 bg-[#0a0a0f] rounded-full overflow-hidden border border-[#1e1e2e]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-[#1D9E75] to-[#7F77DD]"
              />
           </div>
        </div>

        <div className="flex items-center justify-between p-5 bg-[#0a0a0f] rounded-3xl border border-[#1e1e2e]">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#111118] rounded-xl flex items-center justify-center">
                 <Navigation2 className="w-5 h-5 text-[#1D9E75]" />
              </div>
              <div>
                 <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest">Distance Left</p>
                 <h4 className="text-xs font-black text-[#f0eeff] italic">
                   {distance ? distance.toFixed(1) : '0.0'} km
                 </h4>
              </div>
           </div>
           <button className="text-[10px] font-black text-red-500 uppercase tracking-widest">
             SOS Dharura
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
