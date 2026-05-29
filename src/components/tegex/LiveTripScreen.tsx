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
  const [showShareModal, setShowShareModal] = React.useState(false);
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
              <div className="bg-[#1D9E75]/10 text-[#00E5A0] border border-[#00E5A0]/20 px-3 py-1 rounded-full flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#00E5A0] rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-wider leading-none">{statusText}</span>
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

            {/* Trip Status Steps Progress Bar */}
            <div className="flex justify-between items-center mb-6 px-1 select-none">
              {[
                { label: 'SEARCH', active: true },
                { label: 'FOUND', active: !!ride.driverId },
                { label: 'ON TRIP', active: ride.status === 'on_trip' },
                { label: 'ARRIVED', active: ride.status === 'completed' }
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 ${s.active ? 'bg-[#00E5A0] border-[#00E5A0] shadow-[0_0_12px_#00E5A0]' : 'bg-white/5 border-white/10'}`} />
                    <span className={`text-[6.5px] font-black uppercase tracking-[0.15em] ${s.active ? 'text-white' : 'text-[#8A8FA8]'}`}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 h-[2px] mb-3 mx-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: arr[i+1].active ? '100%' : '0%' }}
                        className="h-full bg-[#00E5A0]"
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
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

              {/* SOS safety Button */}
              <button 
                onClick={() => toast.error("SOS Aleriti ya Dharura imetumwa kwa kituo cha usalama!")}
                className="col-span-1 bg-red-650/15 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-2xl flex flex-col items-center justify-center text-center transition-all p-2 active:scale-95 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-red-500 mb-1" />
                <span className="text-[8px] font-black uppercase tracking-widest text-red-400">SOS</span>
              </button>
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
