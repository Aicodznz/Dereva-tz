import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, onSnapshot, updateDoc, deleteField, getDoc } from 'firebase/firestore';
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
  ChevronUp,
  ChevronDown,
  Sparkles,
  Search,
  Play
} from 'lucide-react';
import { Ride, LatLng } from '../../types/trip.types';
import { createDriverMarkerIcon, createGoogleMapsDestinationIcon } from '../../utils/driverMarker';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { generateSimulatedRoads } from '../../hooks/useRouting';
import { toast } from 'sonner';

// Helper to safely extract coordinates from any possible structure
function parseLatLng(loc: any): LatLng | null {
  if (!loc) return null;
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)) {
    return { lat: loc.lat, lng: loc.lng };
  }
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude) && !isNaN(loc.longitude)) {
    return { lat: loc.latitude, lng: loc.longitude };
  }
  if (Array.isArray(loc) && loc.length >= 2 && typeof loc[0] === 'number' && typeof loc[1] === 'number') {
    return { lat: loc[0], lng: loc[1] };
  }
  return null;
}

// Map Auto Bounds & Invalidate Size Controller
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
  const hasInitializedRef = useRef(false);

  // Invalidate size once mounted so Leaflet gets full viewport
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (!autoFollow) return;

    const points: [number, number][] = [];
    if (driverLoc) points.push([driverLoc.lat, driverLoc.lng]);
    if (destLoc) points.push([destLoc.lat, destLoc.lng]);
    if (points.length === 0 && pickupLoc) points.push([pickupLoc.lat, pickupLoc.lng]);

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16, animate: hasInitializedRef.current });
      hasInitializedRef.current = true;
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: hasInitializedRef.current });
      hasInitializedRef.current = true;
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

// Demo fallback trip (used when testing or if link expired)
const DEMO_FALLBACK_RIDE: any = {
  id: 'm51O3JxwZcoUZXYnP7WL',
  status: 'on_trip',
  customerId: 'demo_customer',
  pickup: {
    lat: -6.7924,
    lng: 39.2083,
    address: 'Nelson Mandela Road, Mabibo Relini, Ubungo, Dar es Salaam'
  },
  destination: {
    lat: -6.7724,
    lng: 39.2383,
    address: 'Police Quarters, Mikocheni, Kinondoni, Dar es Salaam'
  },
  vehicleType: 'car',
  fare: 7800,
  distance: 6.6,
  duration: 14,
  driverInfo: {
    name: 'Amy Tzee',
    phone: '0712345678',
    photo: '',
    rating: 5.0,
    vehicle: {
      model: 'Toyota Ist',
      plate: 'T 256 CUP',
      color: 'Nyeusi'
    }
  },
  driverLocation: {
    lat: -6.7870,
    lng: 39.2150
  }
};

export default function PublicLiveTripTracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ rideId?: string }>();
  const navigate = useNavigate();

  const queryRideId = params.rideId || searchParams.get('rideId') || '';
  const [rideId, setRideId] = useState<string>(queryRideId);
  const [inputRideId, setInputRideId] = useState<string>('');

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(queryRideId));
  const [notFound, setNotFound] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(true);
  const [activeViewerCount, setActiveViewerCount] = useState<number>(1);
  const [showSosModal, setShowSosModal] = useState<boolean>(false);
  const [simulatedOffset, setSimulatedOffset] = useState<number>(0);

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
      setNotFound(true);
      return;
    }

    setIsLoading(true);
    setNotFound(false);

    let unsubStand: (() => void) | null = null;
    let unsubTaxi: (() => void) | null = null;
    let isCancelled = false;

    // Helper to check localStorage if firestore doesn't have it
    const checkLocalFallback = () => {
      try {
        const storedActive = localStorage.getItem('paporide_active_ride') || localStorage.getItem('active_ride');
        if (storedActive) {
          const parsed = JSON.parse(storedActive);
          if (parsed && (parsed.id === rideId || !rideId)) {
            setRide(parsed);
            setNotFound(false);
            setIsLoading(false);
            return true;
          }
        }
      } catch (e) {}
      return false;
    };

    const docRef = doc(db, 'rides', rideId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (isCancelled) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedRide = { id: docSnap.id, ...data } as Ride;
          setRide(loadedRide);
          setNotFound(false);
          setIsLoading(false);

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
          // Fallback 1: Check 'taxi_rides' collection
          const taxiDocRef = doc(db, 'taxi_rides', rideId);
          unsubTaxi = onSnapshot(
            taxiDocRef,
            (tSnap) => {
              if (isCancelled) return;
              if (tSnap.exists()) {
                const tData = tSnap.data();
                setRide({ id: tSnap.id, ...tData } as Ride);
                setNotFound(false);
                setIsLoading(false);
              } else {
                // Fallback 2: Check 'stand_pooling_routes'
                const standRef = doc(db, 'stand_pooling_routes', rideId);
                unsubStand = onSnapshot(
                  standRef,
                  (sSnap) => {
                    if (isCancelled) return;
                    if (sSnap.exists()) {
                      const sData = sSnap.data() as any;
                      const mappedRide: any = {
                        id: sSnap.id,
                        status: sData.status === 'started' ? 'on_trip' : sData.status === 'completed' ? 'completed' : 'accepted',
                        pickup: {
                          name: sData.standLocation?.name || 'Stendi',
                          lat: sData.standLocation?.lat || -6.7924,
                          lng: sData.standLocation?.lng || 39.2083,
                          address: sData.standLocation?.name || 'Stendi'
                        },
                        destination: {
                          name: sData.destination?.name || 'Kituo cha Mwisho',
                          lat: sData.destination?.lat || -6.7724,
                          lng: sData.destination?.lng || 39.2383,
                          address: sData.destination?.name || 'Kituo cha Mwisho'
                        },
                        driverId: sData.driverId,
                        driverName: sData.driverName,
                        driverPhone: sData.driverPhone,
                        driverRating: sData.driverRating || 4.9,
                        vehicleModel: sData.vehicleModel || 'Toyota Ist',
                        vehiclePlate: sData.vehiclePlate || 'T 256 CUP',
                        vehicleType: sData.vehicleType || 'taxi',
                        driverLocation: sData.driverLocation,
                        routeCoords: sData.routeCoords,
                        fare: sData.fixedPricePerSeat || 1500,
                        serviceType: 'stendi',
                        createdAt: sData.createdAt
                      };
                      setRide(mappedRide);
                      setNotFound(false);
                      setIsLoading(false);
                    } else {
                      // Check localStorage before declaring not found
                      const foundLocal = checkLocalFallback();
                      if (!foundLocal) {
                        setRide(null);
                        setNotFound(true);
                        setIsLoading(false);
                      }
                    }
                  },
                  () => {
                    if (!isCancelled) {
                      const foundLocal = checkLocalFallback();
                      if (!foundLocal) {
                        setRide(null);
                        setNotFound(true);
                        setIsLoading(false);
                      }
                    }
                  }
                );
              }
            },
            () => {
              if (!isCancelled) {
                const foundLocal = checkLocalFallback();
                if (!foundLocal) {
                  setRide(null);
                  setNotFound(true);
                  setIsLoading(false);
                }
              }
            }
          );
        }
      },
      () => {
        if (!isCancelled) {
          const foundLocal = checkLocalFallback();
          if (!foundLocal) {
            setRide(null);
            setNotFound(true);
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
      if (unsubTaxi) unsubTaxi();
      if (unsubStand) unsubStand();
    };
  }, [rideId]);

  // Spectator ping registration so driver & customer see viewers
  useEffect(() => {
    if (!rideId || notFound) return;

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
            name: 'Mshiriki wa Safari',
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
  }, [rideId, notFound]);

  // Parse pickup and destination coordinates cleanly
  const pickupCoord = useMemo(() => {
    return parseLatLng(ride?.pickup) || (ride ? { lat: -6.7924, lng: 39.2083 } : null);
  }, [ride?.pickup, ride]);

  const destCoord = useMemo(() => {
    return parseLatLng(ride?.destination) || (ride ? { lat: -6.7724, lng: 39.2383 } : null);
  }, [ride?.destination, ride]);

  // Smooth simulation interval for live moving driver when driverLocation updates or simulated
  useEffect(() => {
    if (!ride) return;
    const interval = setInterval(() => {
      setSimulatedOffset((prev) => (prev + 1) % 100);
    }, 3000);
    return () => clearInterval(interval);
  }, [ride]);

  // Driver real-time position with fallbacks
  const currentDriverPos: LatLng | null = useMemo(() => {
    const rawDriver = parseLatLng(ride?.driverLocation);
    if (rawDriver) return rawDriver;

    if (pickupCoord && destCoord) {
      // If ride is on trip, interpolate slightly between pickup and destination
      const isTrip = ride?.status === 'on_trip';
      const factor = isTrip ? Math.min(0.85, 0.2 + (simulatedOffset * 0.006)) : 0.05;
      return {
        lat: pickupCoord.lat + (destCoord.lat - pickupCoord.lat) * factor,
        lng: pickupCoord.lng + (destCoord.lng - pickupCoord.lng) * factor,
      };
    }

    if (pickupCoord) return pickupCoord;
    return { lat: -6.7924, lng: 39.2083 };
  }, [ride?.driverLocation, pickupCoord, destCoord, ride?.status, simulatedOffset]);

  // Target location for ETA calculation (Pickup if arriving, Destination if on trip)
  const isArriving = ride?.status === 'accepted' || ride?.status === 'driver_arriving' || ride?.status === 'driver_arrived';
  const targetLocation = isArriving ? pickupCoord : destCoord;

  // Real-time ETA and Distance
  const { distance: liveDistanceKm, eta: liveEta } = useDriverTracking(
    currentDriverPos || undefined,
    targetLocation || undefined
  );

  // Compute polyline route coordinates
  const routePoints = useMemo(() => {
    if (ride?.routeCoords && Array.isArray(ride.routeCoords) && ride.routeCoords.length > 1) {
      return ride.routeCoords
        .map((c: any) => {
          const p = parseLatLng(c);
          return p ? [p.lat, p.lng] as [number, number] : null;
        })
        .filter(Boolean) as [number, number][];
    }
    if (pickupCoord && destCoord) {
      return generateSimulatedRoads(
        [pickupCoord.lat, pickupCoord.lng],
        [destCoord.lat, destCoord.lng]
      );
    }
    return [];
  }, [ride?.routeCoords, pickupCoord, destCoord]);

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
        console.warn('Clipboard API failed:', e);
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
    toast.success('Link ya live tracking imenakiliwa!');
    setTimeout(() => setCopied(false), 2500);
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    const pickupAddr = (ride?.pickup as any)?.address || (ride as any)?.pickupAddress || 'Eneo la kuanzia';
    const destAddr = (ride?.destination as any)?.address || (ride as any)?.destinationAddress || 'Eneo la marudio';
    const driverV = ride?.driverInfo?.vehicle?.model || (ride as any)?.vehicleModel || 'Gari la Safari';
    const plate = ride?.driverInfo?.vehicle?.plate || (ride as any)?.vehiclePlate || 'T 256 CUP';

    const text = `🚗 Fuatilia safari yangu ya Tegex kwa muda wote (Real-time Tracking):\n📍 Kutoka: ${pickupAddr}\n🏁 Kwenda: ${destAddr}\n🚘 Gari: ${driverV} (${plate})\n\nLink ya live tracking: ${window.location.href}`;
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

  // Driver details extraction
  const driverName = ride?.driverInfo?.name || (ride as any)?.driverName || (ride as any)?.preferredDriverName || 'Amy Tzee';
  const driverPhone = ride?.driverInfo?.phone || (ride as any)?.driverPhone || (ride as any)?.preferredDriverPhone || '0712345678';
  const vehicleModel = ride?.driverInfo?.vehicle?.model || (ride as any)?.vehicleModel || (ride as any)?.preferredDriverPlate || 'Toyota Ist';
  const vehiclePlate = ride?.driverInfo?.vehicle?.plate || (ride as any)?.vehiclePlate || (ride as any)?.preferredDriverPlate || 'T 256 CUP';
  const vehicleColor = ride?.driverInfo?.vehicle?.color || 'Nyeusi';
  const vehicleType = ride?.vehicleType || 'car';
  const driverRating = ride?.driverInfo?.rating || (ride as any)?.driverRating || 5.0;

  // Center map coords
  const mapCenterLat = currentDriverPos?.lat || pickupCoord?.lat || -6.7924;
  const mapCenterLng = currentDriverPos?.lng || pickupCoord?.lng || 39.2083;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a10] text-white flex flex-col font-sans select-none">
      
      {/* 1. Base Map Container - ALWAYS rendered across entire viewport so never pitch black */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer
          center={[mapCenterLat, mapCenterLng]}
          zoom={15}
          zoomControl={false}
          className="w-full h-full z-0"
        >
          {/* Fast, reliable Google Maps Tile Layer */}
          <TileLayer
            key="google-maps-live-tracker"
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            attribution="&copy; Google Maps"
            maxZoom={20}
            maxNativeZoom={19}
          />

          {/* Auto Map Bounds Adjuster */}
          <MapAutoBounds
            driverLoc={currentDriverPos}
            pickupLoc={pickupCoord}
            destLoc={destCoord}
            autoFollow={autoFollow}
          />

          {/* Route Polyline */}
          {routePoints.length > 0 && (
            <>
              {/* Outer glow line */}
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
              {/* Main solid route line */}
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
          {pickupCoord && (
            <Marker
              position={[pickupCoord.lat, pickupCoord.lng]}
              icon={pickupPinIcon}
            />
          )}

          {/* Destination Marker */}
          {destCoord && (
            <Marker
              position={[destCoord.lat, destCoord.lng]}
              icon={createGoogleMapsDestinationIcon(
                (ride?.destination as any)?.address?.split(',')[0] || (ride as any)?.destinationAddress?.split(',')[0] || 'Mwisho'
              )}
            />
          )}

          {/* Real-time Moving Driver Marker */}
          {currentDriverPos && (
            <Marker
              position={[currentDriverPos.lat, currentDriverPos.lng]}
              icon={createDriverMarkerIcon(
                driverName.substring(0, 2).toUpperCase(),
                true,
                (ride?.driverLocation as any)?.heading || (simulatedOffset * 3.6),
                vehicleType,
                'light',
                (ride?.driverLocation as any)?.heading || (simulatedOffset * 3.6),
                isArriving ? 'Kuelekea Eneo la Abiria' : 'Kuelekea Marudio'
              )}
            />
          )}
        </MapContainer>
      </div>

      {/* 2. Top Floating Glass Header */}
      <header className="absolute top-0 left-0 right-0 z-[1000] p-3 sm:p-4 pointer-events-none">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 pointer-events-auto">
          
          {/* Brand & Live Indicator */}
          <div className="flex items-center gap-2.5 bg-black/85 backdrop-blur-xl px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl">
            <button
              onClick={() => navigate('/taxi')}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white mr-1 active:scale-95"
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
                <p className="text-[10px] text-neutral-400 font-medium leading-none">Ufuatiliaji wa Safari</p>
              </div>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2">
            {/* Live Spectator Count Badge */}
            <div className="hidden xs:flex items-center gap-1.5 bg-black/85 backdrop-blur-xl px-3 py-2 rounded-2xl border border-white/10 text-xs font-bold text-neutral-300 shadow-xl">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeViewerCount} Wanafuatilia</span>
            </div>

            {/* Auto-Follow Toggle */}
            <button
              onClick={() => setAutoFollow(!autoFollow)}
              className={`px-3 py-2 rounded-2xl border flex items-center gap-1.5 text-xs font-black shadow-xl transition-all active:scale-95 ${
                autoFollow 
                  ? 'bg-emerald-600/90 border-emerald-400 text-white' 
                  : 'bg-black/85 border-white/10 text-neutral-300 hover:bg-white/10'
              }`}
              title={autoFollow ? 'Kamera inafuata gari' : 'Gonga ili kufuata gari'}
            >
              <Compass className={`w-3.5 h-3.5 ${autoFollow ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{autoFollow ? 'Inafuata' : 'Fungua'}</span>
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
              className="h-10 px-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all border border-rose-400/40"
              title="Msaada wa Dharura"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>SOS</span>
            </button>
          </div>

        </div>
      </header>

      {/* 3. Loading Overlay (semi-transparent over map) */}
      {isLoading && (
        <div className="absolute inset-0 z-[800] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121c] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <span className="w-16 h-16 rounded-full bg-emerald-500/20 animate-ping absolute" />
              <span className="w-10 h-10 rounded-full bg-emerald-500/40 flex items-center justify-center text-xl">
                🛰️
              </span>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Inaunganisha na Safari Live...</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Tunasoma viwianishi vya ramani na GPS ya gari kwa wakati halisi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Not Found / Expired Modal Overlay over Map */}
      {!isLoading && notFound && (
        <div className="absolute inset-0 z-[800] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full bg-[#12121c]/95 border border-white/15 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl pointer-events-auto"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl mx-auto border border-amber-500/20">
              ⚠️
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black uppercase text-white">Safari Hii Haipatikani au Imemalizika</h3>
              <p className="text-xs text-neutral-400">
                Namba ya safari <span className="font-mono text-emerald-400 font-bold">{rideId || 'haipo'}</span> haipo kwenye mfumo au imekamilika.
              </p>
            </div>

            {/* Quick Demo Preview Button */}
            <button
              onClick={() => {
                setRide(DEMO_FALLBACK_RIDE);
                setNotFound(false);
                toast.success('Mfano wa safari ya moja kwa moja umefunguliwa!');
              }}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Tazama Demo ya Safari Live</span>
            </button>

            {/* Search / Lookup Input */}
            <form onSubmit={handleSearchRide} className="space-y-2 pt-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Weka ID nyingine ya safari..."
                  value={inputRideId}
                  onChange={(e) => setInputRideId(e.target.value)}
                  className="w-full h-11 bg-neutral-900 border border-neutral-700 rounded-xl px-4 text-xs font-bold text-white placeholder:text-neutral-500 focus:border-emerald-500 outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1 bottom-1 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black uppercase text-white flex items-center gap-1 transition-all"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Tafuta</span>
                </button>
              </div>
            </form>

            <button
              onClick={() => navigate('/taxi')}
              className="w-full h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 transition-all"
            >
              Rudi Ukurasa Mkuu wa PapoRide
            </button>
          </motion.div>
        </div>
      )}

      {/* 5. Bottom Floating Live HUD / Trip Card */}
      {ride && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-3 sm:p-4 pointer-events-none">
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="max-w-2xl mx-auto bg-[#10101a]/95 backdrop-blur-2xl border border-white/15 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto"
          >
            {/* Header / Click to Toggle Expand */}
            <div 
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="px-4 py-3 flex items-center justify-between cursor-pointer border-b border-white/10 hover:bg-white/5 transition-colors"
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
                  className="w-7 h-7 rounded-full bg-white/5 text-neutral-400 flex items-center justify-center hover:bg-white/10 transition-colors"
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
                  className="p-4 sm:p-5 space-y-3.5 overflow-hidden"
                >
                  {/* Driver and Vehicle Row */}
                  <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">
                        {vehicleType === 'bike' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs sm:text-sm font-black text-white truncate">{driverName}</h3>
                          <span className="text-[10px] text-amber-400 font-bold flex items-center">
                            ★ {Number(driverRating).toFixed(1)}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-300 font-semibold truncate">
                          {vehicleModel} • {vehicleColor}
                        </p>
                        <div className="inline-block mt-0.5 bg-black/60 border border-white/20 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-mono font-black uppercase tracking-wider">
                          {vehiclePlate}
                        </div>
                      </div>
                    </div>

                    {/* Driver Call Button */}
                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone}`}
                        className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 uppercase tracking-wider"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Piga Simu</span>
                      </a>
                    )}
                  </div>

                  {/* Route Addresses */}
                  <div className="space-y-1.5 text-xs bg-black/40 p-3 rounded-2xl border border-white/5">
                    {/* Pickup */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-500/20" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider block">Kutoka (Pickup)</span>
                        <p className="font-bold text-neutral-200 line-clamp-1 leading-tight text-xs">
                          {(ride.pickup as any)?.address || (ride as any)?.pickupAddress || 'Nelson Mandela Road, Mabibo Relini'}
                        </p>
                      </div>
                    </div>

                    {/* Divider dotted line */}
                    <div className="ml-1 pl-3 border-l-2 border-dashed border-neutral-700 h-2" />

                    {/* Destination */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0 ring-4 ring-rose-500/20" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider block">Kwenda (Destination)</span>
                        <p className="font-bold text-neutral-200 line-clamp-1 leading-tight text-xs">
                          {(ride.destination as any)?.address || (ride as any)?.destinationAddress || 'Police Quarters, Mikocheni'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      onClick={handleCopyLink}
                      className="flex-1 h-9 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Imenakiliwa!' : 'Nakili Link'}</span>
                    </button>

                    <button
                      onClick={handleWhatsAppShare}
                      className="flex-1 h-9 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Shiriki WhatsApp</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* 6. Emergency SOS Modal */}
      <AnimatePresence>
        {showSosModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-[#12121c] border border-rose-500/40 rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-500">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-white">Msaada wa Dharura (SOS)</h3>
                  <p className="text-xs text-neutral-400">Piga simu za dharura kwa usalama wako au wa msafiri</p>
                </div>
              </div>

              <div className="space-y-2">
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
                className="w-full h-10 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold text-neutral-300 transition-colors"
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
