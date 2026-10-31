import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Shield, Clock, Navigation2, MapPin, MessageSquare, Star, Trash2, Users, Package, Sparkles, CheckCircle2, Home, Heart, Phone } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { useRouting } from '../../hooks/useRouting';
import { toast } from 'sonner';
import { useTheme } from '../../ThemeContext';
import { Navigation3DHudOverlay } from '../map/Navigation3DHudOverlay';
import { ShareTripModal } from '../common/ShareTripModal';
import { PapoShareSplitFareModal } from '../rider/PapoShareSplitFareModal';
import { 
  getLocalFavoriteDrivers, 
  saveCustomerFavoriteDriver, 
  removeCustomerFavoriteDriver 
} from '../../utils/customerPreferences';

interface LiveTripScreenProps {
  ride: Ride;
  onCall?: () => void;
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
  onCall,
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
  const [showSplitFareModal, setShowSplitFareModal] = React.useState(false);
  const showDetails = !isMinimized && !isCollapsed;

  const [isFavDriver, setIsFavDriver] = React.useState(() => {
    const list = getLocalFavoriteDrivers();
    return list.some(d => (ride.driverId && d.driverId === ride.driverId) || (ride.driverInfo?.phone && d.phone === ride.driverInfo.phone));
  });

  const toggleFavDriver = async () => {
    if (!ride.driverInfo?.name) {
      toast.error('Taarifa za dereva hazijapatikana');
      return;
    }
    if (isFavDriver) {
      const list = getLocalFavoriteDrivers();
      const match = list.find(d => (ride.driverId && d.driverId === ride.driverId) || (ride.driverInfo?.phone && d.phone === ride.driverInfo.phone));
      if (match) {
        await removeCustomerFavoriteDriver(match.id, ride.customerId);
        setIsFavDriver(false);
        toast.info(`${ride.driverInfo.name} ameondolewa kwenye madereva unaowapenda.`);
      }
    } else {
      await saveCustomerFavoriteDriver({
        driverId: ride.driverId,
        name: ride.driverInfo.name,
        phone: ride.driverInfo.phone || '0700000000',
        photo: ride.driverInfo.photo,
        vehicleType: ride.vehicleType || 'mini',
        vehiclePlate: ride.driverInfo.vehicle?.plate || 'T 842 DKP',
        vehicleModel: ride.driverInfo.vehicle?.model || 'Toyota IST',
        vehicleColor: ride.driverInfo.vehicle?.color,
        rating: ride.driverInfo.rating || 5,
        notes: 'Dereva mstaarabu na anayejali abiria.',
      }, ride.customerId);
      setIsFavDriver(true);
      toast.success(`${ride.driverInfo.name} amehifadhiwa kwenye Madereva Ninaowapenda! ❤️`);
    }
  };

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

        {/* Center: Real-Time Live Driver Tracking Beacon */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`pointer-events-auto px-3.5 py-1.5 rounded-2xl border backdrop-blur-xl shadow-lg flex items-center gap-2 select-none ${
            theme === 'dark'
              ? 'bg-[#0B1220]/90 border-emerald-500/30 text-emerald-300 shadow-emerald-950/40'
              : 'bg-white/95 border-emerald-500/30 text-emerald-800 shadow-neutral-300/30'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <div className="flex flex-col text-left">
            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-none">
              Ufuatiliaji Live
            </span>
            <span className="text-[10px] font-mono font-black text-neutral-800 dark:text-neutral-100 leading-tight">
              {eta ? `ETA: ${eta.minutes}m ${eta.seconds.toString().padStart(2, '0')}s` : 'Safarini'} • {distance ? `${distance.toFixed(1)} km` : 'Njiani'}
            </span>
          </div>
        </motion.div>

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
            className={`absolute bottom-3 left-3 right-3 max-w-[390px] md:mx-auto rounded-2xl border p-2.5 pb-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.18)] z-[60] transition-all touch-none pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'}`}
          >
            {/* Centered Top Drag Pill */}
            <div className="flex justify-center -mt-1 mb-1.5 select-none">
              <div className={`w-8 h-1 rounded-full cursor-grab active:cursor-grabbing ${theme === 'dark' ? 'bg-neutral-700/80' : 'bg-neutral-300'}`} />
            </div>

            {/* Header: Status, Live ETA & Collapse Button in one single compact row */}
            <div className="flex items-center justify-between mb-2 select-none gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`border px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${theme === 'dark' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/60' : 'bg-emerald-50 text-emerald-700 border-emerald-500/20'}`}>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[7.5px] font-black uppercase tracking-wider leading-none">{statusText}</span>
                </div>

                {/* Compact ETA & Distance Pill */}
                <div className={`px-2 py-0.5 rounded-full border flex items-center gap-1 text-[8px] font-mono font-black ${theme === 'dark' ? 'bg-indigo-950/30 border-indigo-800/50 text-indigo-300' : 'bg-indigo-50 border-indigo-200/80 text-indigo-700'}`}>
                  <span>ETA {eta ? `${eta.minutes}:${eta.seconds.toString().padStart(2, '0')}` : '00:00'}</span>
                  <span>•</span>
                  <span>{distance ? `${distance.toFixed(1)} km` : (ride.distance ? `${ride.distance} km` : '0.1 km')}</span>
                </div>

                {activeViewersCount > 0 && (
                  <div 
                    title={activeViewerNames.join(", ")}
                    className={`border px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${theme === 'dark' ? 'bg-blue-950/20 text-blue-400 border-blue-900/40' : 'bg-blue-50 text-blue-700 border-blue-400/20'}`}
                  >
                    <span className="text-[7.5px] leading-none">👁️ {activeViewersCount}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsCollapsed(true)}
                className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors shrink-0 ${theme === 'dark' ? 'text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800' : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/60'}`}
              >
                Ficha Maelezo
              </button>
            </div>

            {/* Compact Driver & Destination Strip */}
            {ride.driverInfo && (
              <div className={`p-2 rounded-xl border mb-2 select-none transition-all ${theme === 'dark' ? 'bg-[#161622]/80 border-neutral-800/90' : 'bg-neutral-50/90 border-neutral-200/70'}`}>
                <div className="flex items-center justify-between gap-2">
                  {/* Driver Photo */}
                  <div className="w-8 h-8 rounded-xl overflow-hidden border border-emerald-500 relative bg-neutral-100 dark:bg-neutral-800 shrink-0 shadow-2xs">
                    <img 
                      src={ride.driverInfo.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.driverId}`} 
                      alt="Driver" 
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  {/* Driver Name, Rating, Vehicle & Destination */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={`text-[11px] font-black uppercase truncate leading-tight ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
                        {ride.driverInfo.name || 'Dereva'}
                      </h4>
                      <div className="flex items-center gap-0.5 text-amber-500 shrink-0 bg-amber-500/10 px-1 py-0.2 rounded-full border border-amber-500/20">
                        <Star className="w-2 h-2 fill-amber-500 text-amber-500" />
                        <span className="text-[7.5px] font-black font-mono leading-none">{ride.driverInfo.rating || '4.9'}</span>
                      </div>
                      <span className="bg-amber-400 text-neutral-950 px-1 py-0.2 rounded font-mono font-black text-[8px] border border-amber-500 leading-none">
                        TZ {ride.driverInfo.vehicle?.plate || 'T 842 DKP'}
                      </span>
                      <span className={`text-[8px] font-bold uppercase truncate ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {ride.driverInfo.vehicle?.model || 'IST'}
                      </span>
                    </div>

                    {/* Destination Address */}
                    <div className="flex items-center gap-1 mt-0.5 text-[9px] text-neutral-600 dark:text-neutral-300">
                      <span className="text-[10px] shrink-0">📍</span>
                      <span className="truncate font-medium">{targetLocation.address}</span>
                    </div>
                  </div>

                  {/* Favorite Driver Heart Button */}
                  <button
                    type="button"
                    onClick={toggleFavDriver}
                    className={`p-1 rounded-full border transition-all active:scale-90 shrink-0 ${
                      isFavDriver
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                        : 'border-transparent text-neutral-400 hover:text-rose-500'
                    }`}
                    title={isFavDriver ? 'Dereva Mpendwa' : 'Hifadhi Dereva Huyu'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFavDriver ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Ultra-Slim Progress Line */}
            <div className="mb-2 select-none px-0.5">
              <div className={`w-full h-1.5 rounded-full relative overflow-visible flex items-center ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                {/* Progress Fill */}
                <div 
                  className="absolute left-0 h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-700" 
                  style={{ width: `${progress}%` }} 
                />
                {/* Moving Vehicle Icon */}
                <div 
                  className="absolute -top-2.5 h-4 w-4 z-20 flex items-center justify-center text-[10px] select-none"
                  style={{ left: `calc(${progress}% - 8px)` }}
                >
                  🚗
                </div>
              </div>
              <div className="flex justify-between items-center mt-1 text-[7px] font-black uppercase tracking-wider text-neutral-400">
                <span>{isArriving ? 'Kituo Chako' : 'Mwanzo'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{progress}% YA SAFARI</span>
                <span>{isArriving ? 'Kufika' : 'Mwisho'}</span>
              </div>
            </div>

            {/* Quick Actions & Cancel Button in a Single Compact Row */}
            <div className="grid grid-cols-6 gap-1 border-t pt-1.5 border-neutral-100 dark:border-neutral-800/60">
              {/* Call */}
              {onCall ? (
                <button 
                  onClick={onCall}
                  className={`border rounded-lg flex flex-col items-center justify-center text-center p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}
                  title="Piga simu kwa dereva"
                >
                  <Phone className="w-2.5 h-2.5 text-emerald-500 mb-0.5" />
                  <span className="text-[6.5px] font-black uppercase tracking-wider">Call</span>
                </button>
              ) : <div />}

              {/* Chat */}
              {onMessage ? (
                <button 
                  onClick={onMessage}
                  className={`border rounded-lg flex flex-col items-center justify-center text-center p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}
                  title="Tuma ujumbe"
                >
                  <MessageSquare className="w-2.5 h-2.5 text-indigo-500 mb-0.5" />
                  <span className="text-[6.5px] font-black uppercase tracking-wider">Chat</span>
                </button>
              ) : <div />}

              {/* Share */}
              <button 
                onClick={() => setShowShareModal(true)}
                className={`border rounded-lg flex flex-col items-center justify-center text-center p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-[#161622]/40 border-neutral-800/80 text-neutral-300' : 'bg-neutral-50 border-neutral-200/60 text-neutral-800'}`}
                title="Shiriki safari"
              >
                <span className="text-[9px] leading-none mb-0.5">🔗</span>
                <span className="text-[6.5px] font-black uppercase tracking-wider text-neutral-400">Share</span>
              </button>

              {/* Gawana (Split Fare) */}
              <button 
                onClick={() => setShowSplitFareModal(true)}
                className={`border rounded-lg flex flex-col items-center justify-center text-center p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-purple-950/20 border-purple-900/40 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700'}`}
                title="Gawana nauli"
              >
                <Users className="w-2.5 h-2.5 text-purple-500 mb-0.5" />
                <span className="text-[6.5px] font-black uppercase tracking-wider">Gawana</span>
              </button>

              {/* SOS safety */}
              {!isSpectator ? (
                <button 
                  onClick={() => toast.error("SOS Aleriti ya Dharura imetumwa kwa kituo cha usalama!")}
                  className={`border rounded-lg flex flex-col items-center justify-center text-center p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}
                  title="Dharura / SOS"
                >
                  <Shield className="w-2.5 h-2.5 text-red-500 mb-0.5" />
                  <span className="text-[6.5px] font-black uppercase tracking-wider">SOS</span>
                </button>
              ) : <div />}

              {/* Ghairi Safari */}
              {!isSpectator && onCancel ? (
                <button
                  onClick={onCancel}
                  className={`border rounded-lg flex flex-col items-center justify-center text-center p-1 active:scale-95 cursor-pointer ${theme === 'dark' ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}
                  title="Ghairi safari hii"
                >
                  <Trash2 className="w-2.5 h-2.5 text-red-500 mb-0.5" />
                  <span className="text-[6.5px] font-black uppercase tracking-wider">Ghairi</span>
                </button>
              ) : <div />}
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

      {/* PapoShare Carpool & Split Fare Modal */}
      <PapoShareSplitFareModal
        isOpen={showSplitFareModal}
        onClose={() => setShowSplitFareModal(false)}
        baseFare={ride.fare || 8000}
        pickupAddress={ride.pickup.address}
        destinationAddress={ride.destination.address}
        rideId={ride.id}
        theme={theme}
      />
    </div>
  );
};
