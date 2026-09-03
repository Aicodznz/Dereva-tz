import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  MapPin, 
  Navigation, 
  Clock, 
  Phone, 
  Share2, 
  Copy, 
  Check, 
  Car, 
  Users, 
  AlertTriangle, 
  ArrowLeft, 
  RefreshCw, 
  Compass, 
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Search
} from 'lucide-react';
import { Ride, LatLng } from '../../types/trip.types';
import { createDriverMarkerIcon, createGoogleMapsDestinationIcon } from '../../utils/driverMarker';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { generateSimulatedRoads, interpolatePoints } from '../../hooks/useRouting';
import { toast } from 'sonner';

// Custom Map Auto-Updater Component
function MapAutoBounds({
  driverLoc,
  pickupLoc,
  destLoc,
  autoFollow
}: {
  driverLoc: LatLng | null;
  pickupLoc: LatLng | null;
  destLoc: LatLng | null;
  autoFollow: boolean;
}) {
  const map = useMap();
  const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!autoFollow) return;

    const points: [number, number][] = [];
    if (driverLoc && typeof driverLoc.lat === 'number' && typeof driverLoc.lng === 'number') {
      points.push([driverLoc.lat, driverLoc.lng]);
    }
    if (destLoc && typeof destLoc.lat === 'number' && typeof destLoc.lng === 'number') {
      points.push([destLoc.lat, destLoc.lng]);
    }
    if (points.length === 0 && pickupLoc && typeof pickupLoc.lat === 'number') {
      points.push([pickupLoc.lat, pickupLoc.lng]);
    }

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true, duration: 1 });
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    }
  }, [driverLoc?.lat, driverLoc?.lng, destLoc?.lat, destLoc?.lng, pickupLoc?.lat, pickupLoc?.lng, autoFollow, map]);

  return null;
}

// Pickup Pin Icon
const pickupPinIcon = L.divIcon({
  className: 'custom-pickup-pin',
  html: `
    <div class="relative flex items-center justify-center select-none" style="transform: translate(-50%, -100%);">
      <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black ring-4 ring-emerald-500/20 animate-pulse">
        📍
      </div>
      <div class="w-3 h-1.5 bg-black/40 rounded-full filter blur-[1px] -mt-1"></div>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

export default function PublicLiveTripTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ rideId?: string }>();
  const navigate = useNavigate();

  const queryRideId = params.rideId || searchParams.get('rideId') || '';
  const [rideId, setRideId] = useState<string>(queryRideId);
  const [inputRideId, setInputRideId] = useState<string>('');

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(true);
  const [activeViewerCount, setActiveViewerCount] = useState<number>(1);
  const [showSosModal, setShowSosModal] = useState<boolean>(false);

  // Sync rideId when query or params change
  useEffect(() => {
    if (queryRideId && queryRideId !== rideId) {
      setRideId(queryRideId);
    }
  }, [queryRideId]);

  // Firebase Real-time Listener for Ride Document
  useEffect(() => {
    if (!rideId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setError(null);

    const docRef = doc(db, 'rides', rideId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        setIsLoading(false);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedRide = { id: docSnap.id, ...data } as Ride;
          setRide(loadedRide);
          setNotFound(false);

          // Calculate active viewers in the last 60 seconds
          if (data.viewers && typeof data.viewers === 'object') {
            const now = Date.now();
            const count = Object.values(data.viewers).filter((v: any) => {
              if (!v) return false;
              const last = typeof v === 'number' ? v : v.lastActive;
              return last && now - last < 60000;
            }).length;
            setActiveViewerCount(Math.max(1, count));
          }
        } else {
          setRide(null);
          setNotFound(true);
        }
      },
      (err) => {
        console.error('Error tracking ride:', err);
        setIsLoading(false);
        setError(err.message || 'Hitilafu ya kupakua taarifa za safari');
      }
    );

    return () => unsubscribe();
  }, [rideId]);

  // Spectator ping registration so driver & customer see viewers
  useEffect(() => {
    if (!rideId) return;

    let viewerId = sessionStorage.getItem(`ride_viewer_${rideId}`);
    if (!viewerId) {
      viewerId = `viewer_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(`ride_viewer_${rideId}`, viewerId);
    }

    const docRef = doc(db, 'rides', rideId);
    const ping = async () => {
      try {
        await updateDoc(docRef, {
          [`viewers.${viewerId}`]: {
            lastActive: Date.now(),
            name: 'Mshiriki wa WhatsApp',
          },
        });
      } catch (e) {
        // Ignored if permissions or ride finished
      }
    };

    ping();
    const interval = setInterval(ping, 20000);

    return () => {
      clearInterval(interval);
      try {
        updateDoc(docRef, {
          [`viewers.${viewerId}`]: deleteField(),
        }).catch(() => {});
      } catch (e) {}
    };
  }, [rideId]);

  // Driver real-time position with fallbacks
  const currentDriverPos: LatLng | null = useMemo(() => {
    if (ride?.driverLocation && typeof ride.driverLocation.lat === 'number' && typeof ride.driverLocation.lng === 'number') {
      return ride.driverLocation;
    }
    if (ride?.pickup && typeof ride.pickup.lat === 'number') {
      return { lat: ride.pickup.lat, lng: ride.pickup.lng };
    }
    return null;
  }, [ride?.driverLocation, ride?.pickup]);

  // Target location for ETA calculation (Pickup if arriving, Destination if on trip)
  const isArriving = ride?.status === 'accepted' || ride?.status === 'driver_arriving' || ride?.status === 'driver_arrived';
  const targetLocation = isArriving ? ride?.pickup : ride?.destination;

  // Real-time ETA and Distance
  const { distance: liveDistanceKm, eta: liveEta } = useDriverTracking(
    currentDriverPos || undefined,
    targetLocation ? { lat: targetLocation.lat, lng: targetLocation.lng } : undefined
  );

  // Compute polyline route coordinates
  const routePoints = useMemo(() => {
    if (ride?.routeCoords && Array.isArray(ride.routeCoords) && ride.routeCoords.length > 1) {
      return ride.routeCoords.map((c: any) => [c.lat || c[0], c.lng || c[1]] as [number, number]);
    }
    if (ride?.pickup && ride?.destination) {
      return generateSimulatedRoads(
        [ride.pickup.lat, ride.pickup.lng],
        [ride.destination.lat, ride.destination.lng]
      );
    }
    return [];
  }, [ride?.routeCoords, ride?.pickup, ride?.destination]);

  // Handle manual ride search submission
  const handleSearchRide = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputRideId.trim();
    if (!clean) return;
    setRideId(clean);
    setSearchParams({ rideId: clean });
  };

  // Copy share URL
  const handleCopyLink = async () => {
    const url = window.location.href;
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        success = true;
      } catch (e) {
        console.warn('Clipboard API failed, using fallback:', e);
      }
    }
    if (!success) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
    }
    setCopied(true);
    toast.success('Link ya safari imenakiliwa!');
    setTimeout(() => setCopied(false), 2500);
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    if (!ride) return;
    const text = `🚗 Fuatilia safari yangu ya Tegex kwa muda wote (Real-time Tracking):\n📍 Kutoka: ${ride.pickup?.address || 'Eneo la kuanzia'}\n🏁 Kwenda: ${ride.destination?.address || 'Eneo la marudio'}\n🚘 Gari: ${ride.driverInfo?.vehicle?.model || (ride as any).preferredDriverPlate || 'Gari la Safari'}\n\nLink ya live tracking: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Format Status label and styles
  const statusInfo = useMemo(() => {
    if (!ride) return { label: 'Inapakia...', color: 'bg-neutral-600', text: 'text-neutral-300', icon: '⏳' };
    switch (ride.status) {
      case 'pending':
        return { label: 'Inatafuta Dereva Karibu...', color: 'bg-amber-500', text: 'text-amber-400', icon: '🔍' };
      case 'accepted':
      case 'driver_arriving':
        return { label: 'Dereva Anakuja Eneo la Kuanzia', color: 'bg-indigo-600', text: 'text-indigo-400', icon: '🚗' };
      case 'driver_arrived':
        return { label: 'Dereva Amefika Eneo la Pickup', color: 'bg-teal-600', text: 'text-teal-400', icon: '📍' };
      case 'on_trip':
        return { label: 'Safari Inaendelea kuelekea Marudio', color: 'bg-emerald-600', text: 'text-emerald-400', icon: '🟢' };
      case 'completed':
        return { label: 'Safari Imekamilika Salama', color: 'bg-green-700', text: 'text-green-400', icon: '✅' };
      case 'cancelled':
        return { label: 'Safari Imeghairiwa', color: 'bg-rose-600', text: 'text-rose-400', icon: '⚠️' };
      default:
        return { label: 'Safari Inaendelea', color: 'bg-emerald-600', text: 'text-emerald-400', icon: '🟢' };
    }
  }, [ride?.status]);

  // Driver details
  const driverName = ride?.driverInfo?.name || (ride as any)?.preferredDriverName || 'Dereva wa Tegex';
  const driverPhone = ride?.driverInfo?.phone || (ride as any)?.preferredDriverPhone || '';
  const vehicleModel = ride?.driverInfo?.vehicle?.model || (ride as any)?.preferredDriverPlate || 'Toyota Ist';
  const vehiclePlate = ride?.driverInfo?.vehicle?.plate || (ride as any)?.preferredDriverPlate || 'T 256 CUP';
  const vehicleColor = ride?.driverInfo?.vehicle?.color || 'Nyeupe';
  const vehicleType = ride?.vehicleType || 'car';
  const driverRating = ride?.driverInfo?.rating || 4.9;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a10] text-white flex flex-col font-sans select-none">
      
      {/* Top Floating Glass Header */}
      <header className="absolute top-0 left-0 right-0 z-[1000] p-3 sm:p-4 pointer-events-none">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 pointer-events-auto">
          
          {/* Brand & Live Indicator */}
          <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-xl px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl">
            <button
              onClick={() => navigate('/taxi')}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white mr-1"
              title="Rudi PapoRide"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-black tracking-wider uppercase text-white">TEGEX LIVE</h1>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 uppercase tracking-tight border border-emerald-500/30">
                    Real-time
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 font-medium">Ufuatiliaji wa Safari</p>
              </div>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2">
            {/* Live Spectator Count Badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-black/80 backdrop-blur-xl px-3 py-2 rounded-2xl border border-white/10 text-xs font-bold text-neutral-300 shadow-xl">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeViewerCount} Wanafuatilia</span>
            </div>

            {/* Auto-Follow Toggle */}
            <button
              onClick={() => setAutoFollow(!autoFollow)}
              className={`px-3 py-2 rounded-2xl border flex items-center gap-1.5 text-xs font-black shadow-xl transition-all active:scale-95 ${
                autoFollow 
                  ? 'bg-emerald-600/90 border-emerald-400 text-white' 
                  : 'bg-black/80 border-white/10 text-neutral-300 hover:bg-white/10'
              }`}
              title={autoFollow ? 'Kamera inafuata gari' : 'Gonga ili kufuata gari'}
            >
              <Compass className={`w-3.5 h-3.5 ${autoFollow ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{autoFollow ? 'Inafuata' : 'Fungua'}</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all"
              title="Tuma WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Emergency SOS Button */}
            <button
              onClick={() => setShowSosModal(true)}
              className="h-10 px-3 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all border border-rose-400/40"
              title="Msaada wa Dharura"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>SOS</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Map Canvas */}
      <div className="relative w-full h-full flex-1">
        {currentDriverPos || (ride?.pickup && typeof ride.pickup.lat === 'number') ? (
          <MapContainer
            center={[
              currentDriverPos?.lat || ride?.pickup?.lat || -6.7924,
              currentDriverPos?.lng || ride?.pickup?.lng || 39.2083
            ]}
            zoom={15}
            zoomControl={false}
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {/* Auto Map Bounds Adjuster */}
            <MapAutoBounds
              driverLoc={currentDriverPos}
              pickupLoc={ride?.pickup ? { lat: ride.pickup.lat, lng: ride.pickup.lng } : null}
              destLoc={ride?.destination ? { lat: ride.destination.lat, lng: ride.destination.lng } : null}
              autoFollow={autoFollow}
            />

            {/* Route Polyline */}
            {routePoints.length > 0 && (
              <>
                {/* Background glow path */}
                <Polyline
                  positions={routePoints}
                  pathOptions={{
                    color: '#10B981',
                    weight: 8,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Core route path */}
                <Polyline
                  positions={routePoints}
                  pathOptions={{
                    color: '#059669',
                    weight: 5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}

            {/* Pickup Marker */}
            {ride?.pickup && typeof ride.pickup.lat === 'number' && (
              <Marker
                position={[ride.pickup.lat, ride.pickup.lng]}
                icon={pickupPinIcon}
              />
            )}

            {/* Destination Marker */}
            {ride?.destination && typeof ride.destination.lat === 'number' && (
              <Marker
                position={[ride.destination.lat, ride.destination.lng]}
                icon={createGoogleMapsDestinationIcon(ride.destination.address?.split(',')[0] || 'Mwisho')}
              />
            )}

            {/* Real-time Moving Driver Marker */}
            {currentDriverPos && (
              <Marker
                position={[currentDriverPos.lat, currentDriverPos.lng]}
                icon={createDriverMarkerIcon(
                  driverName.substring(0, 2).toUpperCase(),
                  true,
                  (ride?.driverLocation as any)?.heading || 0,
                  vehicleType,
                  'light',
                  (ride?.driverLocation as any)?.heading,
                  isArriving ? 'Kuelekea Eneo la Abiria' : 'Kuelekea Marudio'
                )}
              />
            )}
          </MapContainer>
        ) : (
          /* Empty / Initial Map Placeholder */
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0d16] p-6 text-center">
            {isLoading ? (
              <div className="space-y-4">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <span className="w-16 h-16 rounded-full bg-emerald-500/20 animate-ping absolute" />
                  <span className="w-10 h-10 rounded-full bg-emerald-500/40 flex items-center justify-center text-xl">
                    🛰️
                  </span>
                </div>
                <h3 className="text-base font-black uppercase tracking-wider text-white">Inaunganisha na Setilaiti ya Safari...</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Tunasoma viwianishi vya ramani na GPS ya gari kwa wakati halisi. Tafadhali subiri sekunde chache.
                </p>
              </div>
            ) : notFound ? (
              <div className="max-w-md w-full bg-[#13131e] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl mx-auto border border-amber-500/20">
                  ⚠️
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase text-white">Safari Hii Haipatikani</h3>
                  <p className="text-xs text-neutral-400">
                    Namba ya safari <span className="font-mono text-emerald-400 font-bold">{rideId}</span> haipo, imekwisha muda wake, au imefutwa baada ya kukamilika.
                  </p>
                </div>

                {/* Search / Lookup Input */}
                <form onSubmit={handleSearchRide} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Weka ID ya safari (mf. TGX-123456)..."
                      value={inputRideId}
                      onChange={(e) => setInputRideId(e.target.value)}
                      className="w-full h-12 bg-neutral-900 border border-neutral-700 rounded-2xl px-4 text-xs font-bold text-white placeholder:text-neutral-500 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase text-white flex items-center gap-1 transition-all"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Tafuta
                    </button>
                  </div>
                </form>

                <button
                  onClick={() => navigate('/taxi')}
                  className="w-full h-11 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider text-white transition-all"
                >
                  Nenda Ukurasa Mkuu wa PapoRide
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Bottom Floating Live HUD / Trip Card */}
      {ride && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-3 sm:p-4 pointer-events-none">
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="max-w-2xl mx-auto bg-[#10101a]/95 backdrop-blur-2xl border border-white/15 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto"
          >
            {/* Drag / Toggle Header */}
            <div 
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="px-5 py-3.5 flex items-center justify-between cursor-pointer border-b border-white/10 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse shrink-0`} />
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate flex items-center gap-1.5">
                    <span>{statusInfo.icon}</span>
                    <span className="truncate">{statusInfo.label}</span>
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Live Distance & ETA */}
                {liveEta && liveDistanceKm !== null && !['completed', 'cancelled'].includes(ride.status) && (
                  <div className="bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-right">
                    <div className="text-[11px] font-black text-emerald-400 font-mono leading-none">
                      {liveEta.minutes} min
                    </div>
                    <div className="text-[9px] text-neutral-400 font-medium leading-none mt-0.5">
                      {liveDistanceKm.toFixed(1)} km
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="w-7 h-7 rounded-full bg-white/5 text-neutral-400 flex items-center justify-center"
                >
                  {isDetailsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Expandable Details Body */}
            <AnimatePresence>
              {isDetailsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-5 space-y-4 overflow-hidden"
                >
                  {/* Driver and Vehicle Row */}
                  <div className="flex items-center justify-between gap-4 p-3.5 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl shrink-0">
                        {vehicleType === 'bike' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-black text-white truncate">{driverName}</h3>
                          <span className="text-[10px] text-amber-400 font-bold flex items-center">
                            ★ {driverRating.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 font-semibold truncate">
                          {vehicleModel} • {vehicleColor}
                        </p>
                        <div className="inline-block mt-1 bg-black/60 border border-white/20 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-mono font-black uppercase tracking-wider">
                          {vehiclePlate}
                        </div>
                      </div>
                    </div>

                    {/* Driver Call Button */}
                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone}`}
                        className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 uppercase tracking-wider"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Piga Simu</span>
                      </a>
                    )}
                  </div>

                  {/* Route Addresses (Matches WhatsApp message layout) */}
                  <div className="space-y-2 text-xs bg-black/40 p-3.5 rounded-2xl border border-white/5">
                    {/* Pickup */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-500/20" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Kutoka (Pickup)</span>
                        <p className="font-bold text-neutral-200 line-clamp-2 leading-tight mt-0.5">
                          {ride.pickup?.address || 'Eneo la Kuanzia'}
                        </p>
                      </div>
                    </div>

                    {/* Divider dotted line */}
                    <div className="ml-1.5 pl-3 border-l-2 border-dashed border-neutral-700 h-2.5" />

                    {/* Destination */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0 ring-4 ring-rose-500/20" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Kwenda (Destination)</span>
                        <p className="font-bold text-neutral-200 line-clamp-2 leading-tight mt-0.5">
                          {ride.destination?.address || 'Eneo la Marudio'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={handleCopyLink}
                      className="flex-1 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Imenakiliwa!' : 'Nakili Link'}</span>
                    </button>

                    <button
                      onClick={handleWhatsAppShare}
                      className="flex-1 h-10 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Shiriki WhatsApp</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Emergency SOS Modal */}
      <AnimatePresence>
        {showSosModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-[#12121c] border border-rose-500/40 rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-500">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white">Msaada wa Dharura (SOS)</h3>
                  <p className="text-xs text-neutral-400">Piga simu za dharura kwa usalama wako au wa msafiri</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <a
                  href="tel:112"
                  className="w-full p-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl flex items-center justify-between font-black text-xs uppercase tracking-wider transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4" />
                    <span>Polisi Tanzania (Dharura)</span>
                  </div>
                  <span className="text-base font-mono">112</span>
                </a>

                <a
                  href="tel:114"
                  className="w-full p-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl flex items-center justify-between font-black text-xs uppercase tracking-wider transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4" />
                    <span>Zimamoto & Ambulensi</span>
                  </div>
                  <span className="text-base font-mono">114</span>
                </a>

                {driverPhone && (
                  <a
                    href={`tel:${driverPhone}`}
                    className="w-full p-3.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-between font-black text-xs uppercase tracking-wider transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4" />
                      <span>Piga Simu kwa Dereva ({driverName})</span>
                    </div>
                    <span className="text-xs font-mono">{driverPhone}</span>
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="w-full h-11 bg-white/10 hover:bg-white/15 rounded-2xl text-xs font-bold text-neutral-300 transition-colors"
              >
                Funga
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
