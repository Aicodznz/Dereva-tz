import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Shield, Clock, Navigation2, MapPin, MessageSquare, Star, Trash2 } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { toast } from 'sonner';

interface LiveTripScreenProps {
  ride: Ride;
  onMessage?: () => void;
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

export const LiveTripScreen: React.FC<LiveTripScreenProps> = ({ ride, onMessage, onCancel, isMinimized, isSpectator = false }) => {
  const isArriving = ride.status !== 'on_trip';
  const targetLocation = isArriving ? ride.pickup : ride.destination;
  const { distance, eta } = useDriverTracking(ride.driverLocation, targetLocation);
  
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

  const statusText = isArriving ? 'Dereva anakuja...' : 'Safari Inaendelea';
  const targetLabel = isArriving ? 'Eneo la Pickup' : 'Unakokwenda';
  const distanceLabel = isArriving ? 'Umbali kwa Dereva' : 'Distance Left';

  return (
    <div 
      className="absolute inset-0 bg-transparent z-50 pointer-events-none"
    >
      {/* Top Floating Content (HUD) */}
      <div className="absolute top-0 inset-x-0 pointer-events-none">
        {/* Keeping top area entirely empty and clean for the map */}
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
            className="absolute bottom-0 left-0 right-0 w-full bg-[#0A0C14]/95 backdrop-blur-[20px] rounded-t-[40px] border-t border-white/10 p-8 pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] z-[60] touch-none pointer-events-auto"
          >
            <div className="relative flex items-center justify-between mb-5 select-none">
              <div className="flex items-center gap-2">
                <div className="bg-[#1D9E75]/10 text-[#00E5A0] border border-[#00E5A0]/20 px-3 py-1 rounded-full flex items-center gap-2 animate-fade">
                  <div className="w-1.5 h-1.5 bg-[#00E5A0] rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none">{statusText}</span>
                </div>

                {activeViewersCount > 0 && (
                  <div 
                    title={activeViewerNames.join(", ")}
                    className="relative group bg-blue-500/10 text-blue-400 border border-blue-400/20 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(59,130,246,0.15)] cursor-help"
                  >
                    <span className="text-[10px] leading-none">👁️</span>
                    <span className="text-[9.5px] font-black uppercase tracking-wider leading-none">
                      {activeViewersCount} {activeViewersCount === 1 ? 'Anatazama' : 'Wanatazama'}
                    </span>
                    {/* Floating elegant tooltip on hover to see exact Swahili Names */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#111118]/95 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white whitespace-nowrap shadow-2xl z-50">
                      Inatazamwa na: <span className="text-[#00E5A0] font-bold">{activeViewerNames.join(", ")}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-12 h-1.5 bg-white/10 rounded-full cursor-grab active:cursor-grabbing absolute left-1/2 -translate-x-1/2" />

              <button 
                onClick={() => setIsCollapsed(true)}
                className="text-[10px] font-black uppercase text-[#8A8FA8] hover:text-white tracking-[0.12em] px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full transition-colors pointer-events-auto"
              >
                Ficha Maelezo
              </button>
            </div>

            {ride.driverInfo && (
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 mb-5 select-none hover:bg-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00E5A0] relative bg-[#080A12]">
                    <img 
                      src={ride.driverInfo.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.driverId}`} 
                      alt="Driver" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#00E5A0] border-2 border-[#0A0C14] rounded-full shadow-lg" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase font-heading leading-tight">{ride.driverInfo.name || 'Dereva'}</h4>
                    <div className="flex items-center gap-1 mt-1 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20 w-fit">
                      <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-[10px] font-black text-yellow-400 font-mono tracking-wide leading-none">{ride.driverInfo.rating || '4.8'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-black text-[#00E5A0] uppercase tracking-wider font-mono bg-[#00E5A0]/10 px-2 py-0.5 rounded border border-[#00E5A0]/20">
                    {ride.driverInfo.vehicle.plate || 'T 123 ABC'}
                  </span>
                  <span className="text-[9px] font-bold text-[#8A8FA8] uppercase tracking-wider mt-1.5">
                    {ride.driverInfo.vehicle?.model || 'Mini'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-5 select-none">
               <div className="space-y-1 max-w-[65%]">
                  <p className="text-[10px] font-black text-[#8A8FA8] uppercase tracking-[0.1em] font-heading">{targetLabel}</p>
                  <h3 className="text-xs font-black text-white uppercase tracking-wide truncate font-sans">
                    {targetLocation.address}
                  </h3>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-[#8A8FA8] uppercase tracking-[0.1em] font-heading">ETA</p>
                  <h3 className="text-xl font-black text-[#00E5A0] font-mono tracking-wider bg-[#00E5A0]/5 px-3 py-1 rounded-lg border border-[#00E5A0]/10 inline-block shadow-[0_0_12px_rgba(0,229,160,0.05)]">
                    {eta ? `${eta.minutes}:${eta.seconds.toString().padStart(2, '0')}` : '00:00'}
                  </h3>
               </div>
            </div>
            {/* Trip Status Steps Progress Bar with Animating Scenic Road Waypoints */}
            <div className="mb-6 select-none pointer-events-auto">
              {/* Simulated Scenic Road Progress Map (motion/react animations) */}
              <div className="relative h-16 bg-neutral-950/60 rounded-2xl border border-white/5 overflow-hidden p-3 flex flex-col justify-end">
                {/* Scenic Details (Floating Trees & Skyscrapers) */}
                <div className="absolute inset-x-0 top-1 h-6 opacity-30 flex justify-between px-4 select-none pointer-events-none text-xs">
                  <span>🏢</span>
                  <span>🌳</span>
                  <span>🏢</span>
                  <span>🌳</span>
                  <span>🌴</span>
                  <span>🏠</span>
                </div>

                {/* The Animated Road Line */}
                <div className="w-full h-1.5 bg-neutral-800 rounded-full relative overflow-visible flex items-center">
                  
                  {/* Origin Point Flag */}
                  <div className="absolute left-0 -translate-x-1/2 -top-3.5 text-xs font-black z-10 filter drop-shadow">
                    📍
                  </div>

                  {/* Destination Point Flag */}
                  <div className="absolute right-0 translate-x-1/2 -top-3.5 text-xs font-black z-10 filter drop-shadow">
                    🏁
                  </div>

                  {/* Red/Green route progress highlight line */}
                  <div 
                    className="absolute left-0 h-full bg-gradient-to-r from-orange-500 to-[#00E5A0] rounded-full" 
                    style={{ width: `${progress}%` }} 
                  />

                  {/* Hand-guided animating vehicle marker icon */}
                  <motion.div 
                    className="absolute -top-5 h-8 w-8 z-20 flex flex-col items-center justify-center select-none"
                    style={{ left: `calc(${progress}% - 16px)` }}
                    animate={{ 
                      y: [0, -1.5, 0],
                      scale: [1, 1.02, 1]
                    }}
                    transition={{ 
                      y: { repeat: Infinity, duration: 0.28, ease: "easeInOut" },
                      scale: { repeat: Infinity, duration: 0.38, ease: "easeInOut" }
                    }}
                  >
                    {ride.vehicleType === 'bike' ? (
                      <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] inline-block" style={{ transform: 'scaleX(-1)' }}>🏍️</span>
                    ) : ride.vehicleType === 'bajaj' ? (
                      <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] inline-block" style={{ transform: 'scaleX(-1)' }}>🛺</span>
                    ) : (
                      <span className="text-lg filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] inline-block" style={{ transform: 'scaleX(-1)' }}>🚗</span>
                    )}

                    {/* Back smoke puff emissions if transit speed is nonzero */}
                    {progress > 0 && progress < 100 && (
                      <motion.div 
                        className="w-1.5 h-1.5 bg-white/20 rounded-full blur-[1px] absolute -left-1 bottom-1.5"
                        animate={{ scale: [1, 2.2, 0], opacity: [0.65, 0.2, 0], x: [-2, -8] }}
                        transition={{ repeat: Infinity, duration: 0.35 }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Swahili Translation HUD updates info */}
                <div className="flex justify-between items-center mt-2 font-bold text-[8px] uppercase tracking-wider text-neutral-400">
                  <span>{isArriving ? 'Kituo cha Dereva' : 'Mwanzo'}</span>
                  <span className="text-[#00E5A0] font-black font-mono bg-[#00E5A0]/10 px-1.5 py-0.5 rounded border border-[#00E5A0]/20">
                    {progress}% ya Safari
                  </span>
                  <span>{isArriving ? 'Kituo chako' : 'Mwisho'}</span>
                </div>
              </div>

              {/* Status checkpoint steps badges */}
              <div className="flex justify-between items-center px-1">
                {[
                  { label: 'TAFUTA', active: true },
                  { label: 'PATA', active: !!ride.driverId },
                  { label: 'PO MAP', active: ride.status === 'on_trip' },
                  { label: 'FIKA', active: ride.status === 'completed' }
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center gap-0.5">
                    <div className={`w-2 h-2 rounded-full border transition-all duration-500 ${s.active ? 'bg-[#00E5A0] border-[#00E5A0] shadow-[0_0_8px_#00E5A0]' : 'bg-white/5 border-white/10'}`} />
                    <span className={`text-[6px] font-black uppercase tracking-widest ${s.active ? 'text-white' : 'text-[#8A8FA8]'}`}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unified Quick Actions & Distance Panel Footer */}
            <div className="grid grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/5">
              {/* Distance Left Panel */}
              <div className="col-span-1 bg-white/5 rounded-2xl p-2.5 border border-white/5 flex flex-col items-center justify-center text-center select-none">
                <Navigation2 className="w-4 h-4 text-[#00E5A0] mb-1" />
                <span className="text-[7px] font-black text-[#8A8FA8] uppercase tracking-wider mb-0.5">{distanceLabel}</span>
                <span className="text-[10px] font-black text-white font-mono leading-none">
                  {distance ? distance.toFixed(1) : (ride.distance || '0.0')} km
                </span>
              </div>

              {/* Share Trip Button */}
              <button 
                onClick={() => setShowShareModal(true)}
                className="col-span-1 bg-white/5 border border-white/5 hover:bg-white/10 text-white rounded-2xl flex flex-col items-center justify-center text-center transition-all p-2 active:scale-95 cursor-pointer pointer-events-auto"
              >
                <span className="text-[14px] mb-0.5">🔗</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-[#8a8fa8] hover:text-white">Share</span>
              </button>

              {/* Chat Button */}
              {onMessage ? (
                <button 
                  onClick={onMessage}
                  className="col-span-1 bg-[#00E5A0]/5 border border-[#00E5A0]/10 hover:bg-[#00E5A0]/10 text-[#00E5A0] rounded-2xl flex flex-col items-center justify-center text-center transition-all p-2 active:scale-95 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-[#00E5A0] mb-1" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#00E5A0]">Chat</span>
                </button>
              ) : (
                <div className="col-span-1" />
              )}

              {/* SOS safety Button (hidden for spectator viewers) */}
              {!isSpectator ? (
                <button 
                  onClick={() => toast.error("SOS Aleriti ya Dharura imetumwa kwa kituo cha usalama!")}
                  className="col-span-1 bg-red-650/15 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-2xl flex flex-col items-center justify-center text-center transition-all p-2 active:scale-95 cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-red-500 mb-1" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-red-400">SOS</span>
                </button>
              ) : (
                <div className="col-span-1" />
              )}
            </div>

            {/* Cancel Safari Action inside bottom details sheet */}
            {!isSpectator && onCancel && (
              <button
                onClick={onCancel}
                className="w-full mt-3.5 h-11 bg-red-600/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center gap-2 font-black tracking-widest text-[10px] uppercase transition-all active:scale-95 cursor-pointer pointer-events-auto"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
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
              className="bg-[#1D9E75] hover:bg-[#16815f] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-2xl font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-95 whitespace-nowrap"
            >
              <span>Onesha Maelezo</span>
              <span className="text-base text-white/80 animate-bounce">▲</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal Dialog */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="bg-[#111118] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Shiriki Safari</h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors text-xs"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#8a8fa8] leading-relaxed">
                Ndugu au rafiki anaweza kufuatilia safari yako kwa wakati halisi kupitia kiungo hiki:
              </p>

              <div className="space-y-2">
                <input 
                  type="text" 
                  readOnly 
                  value={window.location.origin + "/taxi?rideId=" + ride.id}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-[#00E5A0] font-mono text-center select-all focus:outline-none focus:border-[#00E5A0]/50 text-xs"
                />
                <p className="text-[10px] text-center text-white/40 italic">
                  Gusa kiungo hapo juu ili kukichagua na kukopi
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    const shareUrl = window.location.origin + "/taxi?rideId=" + ride.id;
                    const showSuccessToast = () => {
                      toast.success("Kiungo kimenakiliwa!", {
                        description: "Sasa unaweza kumtumia mtu yeyote ashiriki safari yako."
                      });
                    };

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(shareUrl)
                        .then(() => {
                          showSuccessToast();
                          setShowShareModal(false);
                        })
                        .catch(() => {
                          // Fallback manual copy attempt
                          try {
                            const input = document.createElement("input");
                            input.value = shareUrl;
                            document.body.appendChild(input);
                            input.select();
                            document.execCommand("copy");
                            document.body.removeChild(input);
                            showSuccessToast();
                            setShowShareModal(false);
                          } catch (err) {
                            toast.error("Tafadhali chagua na kunakili kiungo manually");
                          }
                        });
                    } else {
                      try {
                        const input = document.createElement("input");
                        input.value = shareUrl;
                        document.body.appendChild(input);
                        input.select();
                        document.execCommand("copy");
                        document.body.removeChild(input);
                        showSuccessToast();
                        setShowShareModal(false);
                      } catch (err) {
                        toast.error("Tafadhali chagua na kunakili kiungo manually");
                      }
                    }
                  }}
                  className="w-full bg-[#00E5A0] hover:bg-[#00c585] text-[#0a0a0f] py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                >
                  Kopi Kiungo 🔗
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
