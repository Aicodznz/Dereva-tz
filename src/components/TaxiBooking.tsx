import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  ArrowLeft, MapPin, Search, Navigation2, Clock, Star, 
  ChevronRight, X as CloseX, Phone, MessageSquare, 
  Car, Activity, ShieldCheck, User,
  CheckCircle2, DollarSign, Zap, Layers, Trophy,
  ArrowRight, RefreshCw, RotateCw
} from 'lucide-react';
import Chat from './Chat';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  doc, updateDoc, addDoc, collection, serverTimestamp, 
  query, where, onSnapshot, limit, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useRouting } from '../hooks/useRouting';
import { useCreateRide } from '../hooks/useCreateRide';
import { useTripFlow } from '../hooks/useTripFlow';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useNearbyDrivers } from '../hooks/useNearbyDrivers';

// --- SCREENS ---
import { SearchingScreen } from './tegex/SearchingScreen';
import { DriverFoundScreen } from './tegex/DriverFoundScreen';
import { DriverArrivedScreen } from './tegex/DriverArrivedScreen';
import { LiveTripScreen } from './tegex/LiveTripScreen';
import { TripCompleteScreen } from './tegex/TripCompleteScreen';
import { RatingScreen } from './tegex/RatingScreen';

// --- UTILITIES ---

interface NominatimAddress {
  shop?: string;
  amenity?: string;
  building?: string;
  office?: string;
  tourism?: string;
  point_of_interest?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  region?: string;
}

function formatAddress(result: { address?: NominatimAddress }): string {
  if (!result || !result.address) return "Eneo Halijapatikana";
  const addr = result.address;
  
  let primary = addr.shop || addr.amenity || addr.building || addr.office || addr.tourism || addr.point_of_interest;
  let secondary = addr.road || addr.suburb || addr.neighbourhood;
  let tertiary = addr.city || addr.town || addr.village || addr.county;

  let label = "";
  if (primary && secondary) {
    label = `${primary}, ${secondary}`;
  } else if (primary) {
    label = primary;
  } else if (secondary && tertiary) {
    label = `${secondary}, ${tertiary}`;
  } else if (secondary) {
    label = secondary;
  } else {
    label = tertiary || "Unknown Location";
  }

  return label.length > 35 ? label.substring(0, 32) + "..." : label;
}

const BajajSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l2-4h14l2 4" />
    <path d="M3 11h18v7H3z" />
    <path d="M5 18v2M19 18v2" />
    <path d="M12 7v4" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="16" cy="18" r="1.5" />
  </svg>
);

const BikeSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="18" r="3" />
    <circle cx="19" cy="18" r="3" />
    <path d="M12 18V9c0-2 2-2 2-2" />
    <path d="M8 18l3-9h4l3 9" />
    <path d="M12 13h4" />
    <path d="M7 6l2-3h5l1 3" />
  </svg>
);

const MapEvents = ({ onMapClick, onInteraction }: { onMapClick: (e: L.LeafletMouseEvent) => void, onInteraction?: () => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
    dragstart() {
      if (onInteraction) onInteraction();
    },
    zoomstart() {
      if (onInteraction) onInteraction();
    }
  });
  return null;
};

const MapControl = ({ position, step, targetPos, autoFollow }: { position: [number, number], step: string, targetPos?: [number, number], autoFollow: boolean }) => {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!position || !autoFollow) return;

    const currentPos = L.latLng(position[0], position[1]);
    const lastPos = lastCenterRef.current ? L.latLng(lastCenterRef.current[0], lastCenterRef.current[1]) : null;

    // Only update view if position changed significantly (e.g., more than 15 meters)
    if (!lastPos || currentPos.distanceTo(lastPos) > 15) {
      if (['arriving', 'on_trip', 'found'].includes(step) && targetPos) {
        const bounds = L.latLngBounds([position, targetPos]);
        map.fitBounds(bounds, { 
          padding: [80, 80], 
          maxZoom: 20,
          animate: true, 
          duration: 1.2 
        });
      } else if (['arriving', 'on_trip'].includes(step)) {
        map.panTo(position, { animate: true, duration: 1.2 });
      } else {
        map.setView(position, 15, { animate: true });
      }
      lastCenterRef.current = position;
    }
  }, [position?.[0], position?.[1], step, targetPos?.[0], targetPos?.[1], map, autoFollow]);
  return null;
};

// --- TYPES ---

type BookingStep = 'home' | 'map' | 'searching' | 'found' | 'arriving' | 'on_trip' | 'completed' | 'rating' | 'timeout';

interface RideOption {
  id: string;
  name: string;
  icon: any;
  sub: string;
  price: number;
  eta: string;
  image: string;
  vehicleType: 'mini' | 'bajaj' | 'bike';
  discount?: string;
}

// --- MAIN COMPONENT ---

export default function TaxiBooking() {
  const { user, profile, signInGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState<BookingStep>('home');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [settingMode, setSettingMode] = useState<'pickup' | 'destination'>('pickup');
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);

  const [pickupPos, setPickupPos] = useState<[number, number]>([-6.7721, 39.2326]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8235, 39.2695]);
  const [pickup, setPickup] = useState('Tafuta eneo lako...');
  const [destination, setDestination] = useState('');

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const checkTheme = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    checkTheme();
    return () => observer.disconnect();
  }, []);

  const mapTileUrl = theme === 'dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lng}`);
      if (!response.ok) throw new Error(`Reverse geocoding failed with status ${response.status}`);
      const data = await response.json();
      return formatAddress(data);
    } catch (error) {
      console.error("Reverse geocoding failed, trying fallback:", error);
      try {
        const bdcResponse = await fetch(`/api/geo/bdc-reverse?lat=${lat}&lon=${lng}`);
        if (!bdcResponse.ok) {
           const errorData = await bdcResponse.json().catch(() => ({}));
           throw new Error(errorData.error || `BDC failed with status ${bdcResponse.status}`);
        }
        const bdcData = await bdcResponse.json();
        return bdcData.locality || bdcData.city || bdcData.principalSubdivision || "Unknown Area";
      } catch (bdcErr) {
        return "Unknown Area";
      }
    }
  };

  const handleCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setPickupPos([lat, lng]);
          setSettingMode('pickup');
          const addr = await reverseGeocode(lat, lng);
          if (addr && addr !== "Unknown Area") {
             setPickup(addr);
          }
          toast.success("Location updated");
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast.error("Imeshindwa kupata eneo lako. Hakikisha GPS imewashwa.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Auto-detect current location
  useEffect(() => {
    handleCurrentLocation();
  }, []);

  const { routeCoords, totalDistance, totalDuration } = useRouting(pickupPos, destPos);

  const { createRide, isLoading: isCreatingRide } = useCreateRide();
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide, cancelRide, deleteRide } = useTripFlow(rideId);
  const [driverLivePos, setDriverLivePos] = useState<{lat: number, lng: number} | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Persistence: Look for active rides on mount
  useEffect(() => {
    if (!user) {
      setIsRestoring(false);
      return;
    }
    
    console.log("[TaxiBooking] Checking for active rides for user:", user.uid);
    const ridesRef = collection(db, 'rides');
    const q = query(
      ridesRef,
      where('customerId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted', 'driver_arriving', 'driver_arrived', 'on_trip'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const ride = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
        console.log("[TaxiBooking] Found persisting active ride:", ride.id, "status:", ride.status);
        setRideId(ride.id);
        
        // Immediate step transition logic if possible
        if (ride.status === 'on_trip') setStep('on_trip');
        else if (ride.status === 'driver_arrived') setStep('arriving');
        else if (ride.status === 'accepted' || ride.status === 'driver_arriving') setStep('found');
        else if (ride.status === 'pending') setStep('searching');
        else if (ride.status === 'completed') setStep('rating');
      }
      setIsRestoring(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
      setIsRestoring(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Live Tracking: Synchronize specialized states from the active ride
  useEffect(() => {
    if (activeRide) {
       if (activeRide.pickup) {
         setPickupPos([activeRide.pickup.lat, activeRide.pickup.lng]);
         setPickup(activeRide.pickup.address || pickup);
       }
       if (activeRide.destination) {
         setDestPos([activeRide.destination.lat, activeRide.destination.lng]);
         setDestination(activeRide.destination.address || destination);
       }
       
       if (activeRide.driverLocation && ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip'].includes(activeRide.status)) {
          console.log("[TaxiBooking] Syncing driver location from ride doc:", activeRide.driverLocation);
          setDriverLivePos(activeRide.driverLocation);
          
          const target = (activeRide.status === 'on_trip') ? activeRide.destination : activeRide.pickup;
          const dist = L.latLng(activeRide.driverLocation.lat, activeRide.driverLocation.lng)
                        .distanceTo(L.latLng(target.lat, target.lng));
          setLiveDistance(dist / 1000); // km
       } else if (activeRide?.status === 'completed') {
          setStep('rating');
       }
    }
  }, [activeRide?.driverLocation?.lat, activeRide?.driverLocation?.lng, activeRide?.status, activeRide?.pickup?.lat, activeRide?.destination?.lat]);

  // Optional: Also listen to the independent driver doc for even more frequent or "idle" updates
  useEffect(() => {
    if (activeRide?.driverId && ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip'].includes(activeRide.status)) {
      const unsub = onSnapshot(doc(db, 'drivers', activeRide.driverId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const pos = data.location || data.currentPosition;
          if (pos && (!driverLivePos || pos.lat !== driverLivePos.lat || pos.lng !== driverLivePos.lng)) {
            setDriverLivePos(pos);
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `drivers/${activeRide.driverId}`);
      });
      return () => unsub();
    }
  }, [activeRide?.driverId, activeRide?.status]);
  useMatchmaking(activeRide as any);

  const [driverRouteCoords, setDriverRouteCoords] = useState<[number, number][]>([]);

  // Driver Route: Fetch route from driver to target
  useEffect(() => {
    const fetchDriverRoute = async () => {
      if (!driverLivePos || !activeRide) return;
      const target = (activeRide.status === 'on_trip') ? activeRide.destination : activeRide.pickup;
      
      try {
        const coords = `${driverLivePos.lng},${driverLivePos.lat};${target.lng},${target.lat}`;
        const response = await fetch(`/api/geo/route?coords=${coords}`);
        if (!response.ok) throw new Error(`Driver routing failed with status ${response.status}`);
        const data = await response.json();
        if (data.routes?.[0]) {
          setDriverRouteCoords(data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]));
        }
      } catch (e) {
        console.error("Driver routing failed", e);
      }
    };

    if (driverLivePos && ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip'].includes(activeRide?.status || '')) {
      fetchDriverRoute();
    } else {
      setDriverRouteCoords([]);
    }
  }, [driverLivePos, activeRide?.status]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchTimer, setSearchTimer] = useState<any>(null);

  const { drivers } = useNearbyDrivers();

  const getDriverIcon = (type: string) => {
    let ringColor = '#ef4444'; // Red Papo Hapo
    let markerHtml = '';

    if (type === 'bike') {
      markerHtml = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/>
          <path d="M12 18V9c0-2 2-2 2-2"/><path d="M8 18l3-9h4l3 9"/><path d="M12 13h4"/>
        </svg>
      `;
    } else if (type === 'bajaj') {
      markerHtml = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11l2-4h14l2 4"/><path d="M3 11h18v7H3z"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>
        </svg>
      `;
    } else {
      markerHtml = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="10" width="22" height="8" rx="2"/><path d="M7 10l3-6h4l3 6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
        </svg>
      `;
    }

    return L.divIcon({
      className: 'driver-marker-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 bg-red-500/20 rounded-full animate-ping"></div>
          <div class="w-10 h-10 bg-red-600 border-2 border-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/40 transition-all">
            ${markerHtml}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  const StartPin = React.useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="bg-[#111118]/90 backdrop-blur-md border border-white/10 rounded-xl px-2 py-1 mb-1 shadow-2xl">
          <p class="text-[9px] font-black text-emerald-400 uppercase whitespace-nowrap tracking-widest">PICKUP MTEJA</p>
        </div>
        <div class="bg-emerald-500 text-white w-9 h-9 rounded-full border-4 border-[#111118] shadow-2xl flex items-center justify-center font-black text-lg marker-pulse-green">A</div>
        <div class="w-1 h-2.5 bg-emerald-500 rounded-full -mt-0.5 shadow-lg"></div>
      </div>
    `,
    iconSize: [110, 70],
    iconAnchor: [55, 70]
  }), []);

  const EndPin = React.useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="bg-[#111118]/90 backdrop-blur-md border border-white/10 rounded-xl px-2 py-1 mb-1 shadow-2xl">
          <p class="text-[9px] font-black text-orange-400 uppercase whitespace-nowrap tracking-widest">DESTINATION</p>
        </div>
        <div class="bg-orange-500 text-white w-9 h-9 rounded-full border-4 border-[#111118] shadow-2xl flex items-center justify-center font-black text-lg marker-pulse-orange">B</div>
        <div class="w-1 h-2.5 bg-orange-500 rounded-full -mt-0.5 shadow-lg"></div>
      </div>
    `,
    iconSize: [110, 70],
    iconAnchor: [55, 70]
  }), []);

  const geocodeAddress = (query: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Search failed with status ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          setSuggestions(data.map((item: any) => ({
            display_name: formatAddress(item),
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
          })));
        }
      } catch (error) {
        console.error("Geocoding search failed", error);
      }
    }, 1000); // Increased to 1s
    setSearchTimer(timer);
  };

  const selectSuggestion = (suggestion: any) => {
    const pos: [number, number] = [suggestion.lat, suggestion.lon];
    if (settingMode === 'pickup') {
      setPickupPos(pos);
      setPickup(suggestion.display_name);
    } else {
      setDestPos(pos);
      setDestination(suggestion.display_name);
    }
    setSuggestions([]);
  };

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    // Strictly disable selecting locations if any ride activity is happening
    if (rideId || activeRide || ['searching', 'found', 'arriving', 'on_trip'].includes(step)) {
      console.log("Map interaction blocked: Active ride in progress");
      return;
    }
    const { lat, lng } = e.latlng;
    const addr = await reverseGeocode(lat, lng);
    
    if (settingMode === 'pickup') {
      setPickupPos([lat, lng]);
      setPickup(addr);
    } else {
      setDestPos([lat, lng]);
      setDestination(addr);
    }
  };

  const confirmBooking = async () => {
    console.log("Confirming booking for ride option:", selectedRide?.id);
    if (!selectedRide || !destination) {
       toast.error("Tafadhali chagua unapoenda");
       return;
    }
    
    try {
      setStep('searching'); 
      console.log("Starting ride creation flow...");
      
      if (routeCoords.length === 0) {
        console.warn("No route coordinates found. Attempting to proceed anyway but performance might be degraded.");
      }

      const formattedCoords = routeCoords.map(c => ({ lat: c[0], lng: c[1] }));
      
      // Ensure user is signed in for the demo
      let activeUser = auth.currentUser;
      if (!activeUser) {
        console.log("No user found, signing in as guest for demo...");
        try {
          await signInGuest();
          // We must get the fresh user from auth since the state variable won't update until next render
          activeUser = auth.currentUser;
        } catch (e) {
          console.error("Guest sign in failed", e);
        }
      }
      
      if (!activeUser) {
        toast.error("Hujajisajili. Tafadhali jaribu tena.");
        setStep('map');
        return;
      }

      console.log("Current authorized user ID:", activeUser.uid);
      
      let customerName = "Mteja";
      if (profile?.displayName) {
        customerName = profile.displayName;
      } else if (activeUser.displayName) {
        customerName = activeUser.displayName;
      } else if (activeUser.email) {
        const part = activeUser.email.split('@')[0];
        customerName = part.charAt(0).toUpperCase() + part.slice(1);
      }
      
      const customerInfo = {
        name: customerName,
        rating: 5.0,
        avatar: profile?.photoURL || activeUser.photoURL || null,
        photo: profile?.photoURL || activeUser.photoURL || undefined,
        phone: profile?.phoneNumber || ""
      };

      const id = await createRide(
        activeUser.uid,
        customerInfo,
        { lat: pickupPos[0], lng: pickupPos[1], address: pickup },
        { lat: destPos[0], lng: destPos[1], address: destination },
        selectedRide.id as any,
        selectedRide.price,
        totalDistance / 1000,
        Math.ceil(totalDuration / 60),
        formattedCoords
      );
      
      if (id) {
        console.log("Ride created successfully. ID:", id);
        setRideId(id);
      } else {
        console.error("Ride creation failed - createRide returned null");
        setStep('map');
        toast.error("Imeshindwa kuunda safari. Angalia usalama wa akaunti yako au salio.");
      }
    } catch (error: any) {
      console.error("Critical error in confirmBooking:", error);
      setStep('map');
      toast.error(`Itilafu: ${error.message || "Tatizo la kiufundi limejitokeza"}`);
    }
  };

  useEffect(() => {
    if (!activeRide) return;
    
    const currentStatus = activeRide.status;
    console.log(`[TaxiBooking] Status Sync: ${currentStatus} | Current Step: ${step} | RideID: ${activeRide.id}`);
    
    // Auto-transition based on ride status - check for multiple positive statuses
    const isFound = currentStatus === 'accepted' || currentStatus === 'driver_arriving' || currentStatus === 'driver_arrived' || currentStatus === 'on_trip';
    
    if (isFound) {
      if (step === 'searching' || step === 'map' || step === 'home') {
        console.log(`[TaxiBooking] --> Transitioning to appropriate active screen based on status: ${currentStatus}`);
        
        if (currentStatus === 'accepted' || currentStatus === 'driver_arriving') {
          setStep('found');
        } else if (currentStatus === 'driver_arrived') {
          setStep('arriving');
        } else if (currentStatus === 'on_trip') {
          setStep('on_trip');
        }
      }
    }
    
    if (currentStatus === 'driver_arrived') {
      if (step !== 'arriving' && step !== 'on_trip' && step !== 'completed') {
        setStep('arriving');
      }
    } else if (currentStatus === 'on_trip') {
      if (step !== 'on_trip' && step !== 'completed') {
        setStep('on_trip');
      }
    } else if (currentStatus === 'completed' || currentStatus === 'rated') {
      // If payment is already confirmed by driver, skip the payment screen and go to rating
      if (activeRide.paymentStatus === 'paid' && step !== 'rating') {
        setStep('rating');
      } else if (step !== 'rating' && step !== 'completed') {
        console.log("[TaxiBooking] --> Transitioning to COMPLETED screen");
        setStep('completed');
      }
    } else if (currentStatus === 'cancelled') {
      if (step !== 'home') {
        toast.info("Safari imeghairiwa");
        setStep('home');
        setRideId(null);
      }
    }
  }, [activeRide?.status, activeRide?.id, step, rideId]);

  const handleTimeout = () => {
    deleteRide();
    setStep('timeout');
  };

  const handleRetry = () => {
    setStep('map');
    setRideId(null);
  };

  const handlePayment = async (method: string) => {
    if (!rideId || !user || !activeRide) return;
    try {
      await addDoc(collection(db, 'payments'), {
        rideId,
        customerId: user.uid,
        driverId: activeRide.driverId,
        amount: activeRide.fare,
        method,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setStep('rating');
    } catch (err) {
      console.error(err);
      toast.error("Malipo yameshindwa");
    }
  };

  const handleRating = async (ratingValue: number, feedback: string[]) => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        rating: ratingValue,
        feedback,
        rated: true,
        updatedAt: serverTimestamp()
      });
      toast.success("Asante kwa maoni yako!");
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const rideOptions: RideOption[] = [
    { id: 'mini', name: 'Gari', icon: Car, sub: 'Max 4 Siti', price: 2800, eta: '4', vehicleType: 'mini', image: '🚗', discount: 'PUNGUZO 3K' },
    { id: 'bajaj', name: 'Bajaji', icon: BajajSVG, sub: '3 Siti', price: 1500, eta: '5', vehicleType: 'bajaj', image: '🛺' },
    { id: 'bike', name: 'Pikipiki', icon: BikeSVG, sub: 'Usafiri Salama', price: 800, eta: '3', vehicleType: 'bike', image: '🏍️' }
  ];

  return (
    <div className="max-w-md mx-auto bg-green-500/5 w-full flex flex-col relative overflow-hidden font-sans text-[#f0eeff] border-x border-[#1e1e2e] h-[100dvh]">
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      
      {/* DEBUG FLAG */}
      <div className="hidden">DEBUG_RENDER_ACTIVE_{step}</div>
      
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-[#7F77DD]/10 blur-[100px] rounded-full" />
      </div>

      <div className="flex-1 flex flex-col relative z-10 h-full overflow-hidden"> 
        {/* Foundation Map Layer - Visible during the whole journey */}
        <AnimatePresence mode="popLayout">
          {(['map', 'searching', 'found', 'arriving', 'on_trip'].includes(step)) && !isRestoring && (
            <motion.div 
              key="foundation-map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0 h-full w-full"
            >
                <div className="absolute top-6 left-6 right-6 z-[60] flex items-center justify-between pointer-events-none">
                  {step === 'map' && (
                    <button onClick={() => setStep('home')} className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white pointer-events-auto"><ArrowLeft className="w-6 h-6" /></button>
                  )}
                  {step !== 'map' && <div className="w-12" />}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setIsMapFullscreen(!isMapFullscreen);
                        if (!isMapFullscreen) setAutoFollow(true);
                      }} 
                      className={`w-12 h-12 ${isMapFullscreen ? 'bg-[#7F77DD] text-white' : 'bg-[#111118]/90 text-white'} backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-all pointer-events-auto`}
                      title={isMapFullscreen ? "Onesha Maelezo" : "Ramani tupu"}
                    >
                       {isMapFullscreen ? <Layers className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
                    </button>
                    {!autoFollow && step !== 'home' && (
                      <button 
                        onClick={() => setAutoFollow(true)}
                        className="w-12 h-12 bg-[#1D9E75] text-white backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-all pointer-events-auto"
                      >
                        <RotateCw size={24} className="animate-spin-slow" />
                      </button>
                    )}
                    <button onClick={() => navigate('/taxi/history')} className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white pointer-events-auto"><Clock className="w-6 h-6" /></button>
                  </div>
               </div>

               <style>{`.leaflet-container { height: 100% !important; width: 100% !important; background: #ffffff !important; } .custom-div-icon { background: none; border: none; } .animate-spin-slow { animation: spin 3s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
               <MapContainer 
                 center={pickupPos} 
                 zoom={15} 
                 maxZoom={22}
                 preferCanvas={true}
                 className="h-full w-full" 
                 zoomControl={false} 
                 touchZoom={true} 
                 doubleClickZoom={true} 
                 scrollWheelZoom={true} 
                 dragging={true}
               >
                 <TileLayer 
                   url={mapTileUrl}
                   maxZoom={22}
                   maxNativeZoom={19}
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                 />
                 <MapEvents onMapClick={handleMapClick} onInteraction={() => setAutoFollow(false)} />
                 <MapControl 
                   position={
                     ['arriving', 'on_trip', 'found'].includes(step) && driverLivePos 
                       ? [driverLivePos.lat, driverLivePos.lng] 
                       : (settingMode === 'pickup' ? pickupPos : destPos)
                   } 
                   step={step} 
                   autoFollow={autoFollow}
                   targetPos={
                     ['arriving', 'found'].includes(step) ? pickupPos :
                     step === 'on_trip' ? destPos :
                     undefined
                   }
                 />
                 {activeRide?.status !== 'on_trip' && <Marker position={pickupPos} icon={StartPin} />}
                 <Marker position={destPos} icon={EndPin} />
                 
                 {/* Assigned Driver Marker */}
                 {(driverLivePos || activeRide?.driverLocation) && (
                   <Marker 
                     key={`active-driver-${activeRide?.driverId || 'presence'}`}
                     position={[
                       driverLivePos?.lat || activeRide?.driverLocation?.lat || 0,
                       driverLivePos?.lng || activeRide?.driverLocation?.lng || 0
                     ]} 
                     icon={getDriverIcon(activeRide?.vehicleType || 'mini')}
                   />
                 )}

                 {/* Nearby Drivers - Only show in map step */}
                 {step === 'map' && drivers
                   .filter(d => (!selectedRide || d.vehicleType === selectedRide.vehicleType) && d.id !== activeRide?.driverId)
                   .map(driver => (
                   <Marker 
                     key={driver.id} 
                     position={[driver.lat, driver.lng]} 
                     icon={getDriverIcon(driver.vehicleType)}
                   />
                 ))}

                 {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#7F77DD" weight={4} opacity={0.6} dashArray="8, 12" />}
                 
                 {/* Driver Tracking Route */}
                 {driverRouteCoords.length > 0 && ['accepted', 'driver_arriving', 'on_trip'].includes(activeRide?.status || '') && (
                   <>
                     {/* Outer Glow */}
                     <Polyline 
                       positions={driverRouteCoords} 
                     color={activeRide?.status === 'on_trip' ? "#00FF88" : "#8B5CF6"} 
                     weight={12} 
                     opacity={0.25} 
                     lineCap="round"
                     />
                     {/* Path Border */}
                     <Polyline 
                       positions={driverRouteCoords} 
                       color={activeRide?.status === 'on_trip' ? "#059669" : "#7C3AED"} 
                       weight={12} 
                       opacity={0.3} 
                     />
                     {/* Main Route Line */}
                     <Polyline 
                       positions={driverRouteCoords} 
                     color={activeRide?.status === 'on_trip' ? "#00FF88" : "#A78BFA"} 
                     weight={5} 
                     opacity={0.9} 
                     lineCap="round"
                     lineJoin="round"
                     />
                     {/* Core white highlight */}
                     <Polyline 
                       positions={driverRouteCoords} 
                       color="#ffffff" 
                       weight={2} 
                       opacity={0.8} 
                     />
                   </>
                 )}
               </MapContainer>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 'home' && !isRestoring && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col px-6 pt-12 pb-24 space-y-8 overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-black italic tracking-tighter text-white">TEKSI-PAPA 🚕</h1>
                  <p className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-widest mt-1">Usafiri wa haraka na uhakika</p>
                </div>
                <button 
                  onClick={() => navigate('/taxi/history')}
                  className="w-12 h-12 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shadow-lg active:scale-95 transition-all text-white"
                >
                  <Clock size={20} />
                </button>
              </div>

              <div className="bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8 shadow-2xl space-y-6">
                 <div className="space-y-4">
                    <div className="bg-[#0a0a0f] rounded-2xl border border-[#1e1e2e] p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => { console.log("Manual pickup click"); setStep('map'); }}>
                      <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75]"><MapPin className="w-5 h-5" /></div>
                      <div className="flex-1 overflow-hidden">
                         <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-wider mb-1">Unatokea</p>
                         <p className="text-sm font-bold text-[#f0eeff] truncate">{pickup}</p>
                      </div>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-2xl border border-[#1e1e2e] p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => { console.log("Manual dest click"); setStep('map'); }}>
                      <div className="w-10 h-10 rounded-xl bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD]"><Search className="w-5 h-5" /></div>
                      <div className="flex-1 overflow-hidden">
                         <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-wider mb-1">Unakwenda wapi?</p>
                         <p className={`text-sm font-bold truncate ${destination ? 'text-[#f0eeff]' : 'text-[#6b6b8a]'}`}>{destination || "Andika hapa unapoenda"}</p>
                      </div>
                    </div>
                 </div>
                 <button onClick={() => { console.log("Order now click"); setStep('map'); }} className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black tracking-[0.2em] text-xs shadow-2xl shadow-white/5 active:scale-95 transition-all">AGIZA USAFIRI SASA</button>
              </div>
            </motion.div>
          )}
          {step === 'map' && (
            <motion.div 
              key="map-ui"
              initial={{ y: "100%" }}
              animate={{ y: isMapFullscreen ? "calc(100% - 90px)" : (isMinimized ? "calc(100% - 110px)" : 0) }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 z-[60] bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-5 pb-10 space-y-4 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
            >
               <div 
                 className="w-full h-10 flex items-center justify-center cursor-pointer group -mt-4 relative"
                 onClick={() => {
                   if (isMapFullscreen) {
                     setIsMapFullscreen(false);
                     setIsMinimized(false);
                   } else if (isMinimized) {
                     setIsMinimized(false);
                   } else {
                     setIsMinimized(true);
                   }
                 }}
               >
                  <div className={`w-16 h-2 rounded-full transition-all duration-300 shadow-lg ${isMinimized || isMapFullscreen ? 'bg-[#7F77DD] animate-bounce' : 'bg-neutral-800 group-hover:bg-neutral-600'}`} />
               </div>
               
               {(!isMinimized && !isMapFullscreen) && (
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-5"
                 >
                   <div className="bg-[#0a0a0f]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-[#7F77DD] opacity-30" />
                      <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${settingMode === 'pickup' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 text-[#6b6b8a]'}`}>
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                               <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest mb-1">UNATOKEA</p>
                               <input 
                                 type="text" 
                                 value={pickup} 
                                 onChange={(e) => { setPickup(e.target.value); geocodeAddress(e.target.value); }} 
                                 onFocus={() => setSettingMode('pickup')}
                                 placeholder="Tafuta eneo lako..."
                                 className="w-full bg-transparent text-sm font-bold text-white border-none outline-none p-0 placeholder:text-neutral-700 italic" 
                               />
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCurrentLocation(); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-emerald-500/10 text-emerald-500 active:scale-90 transition-all"
                            >
                               <Navigation2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="h-px bg-white/5" />

                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${settingMode === 'destination' ? 'bg-red-500 text-white shadow-lg' : 'bg-white/5 text-[#6b6b8a]'}`}>
                              <Search className="w-5 h-5" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest mb-1">UNAKWENDA WAPI?</p>
                                <input 
                                  type="text" 
                                  value={destination} 
                                  onChange={(e) => { setDestination(e.target.value); geocodeAddress(e.target.value); }} 
                                  onFocus={() => setSettingMode('destination')}
                                  className="w-full bg-transparent text-sm font-bold text-white border-none outline-none p-0 placeholder:text-neutral-700 italic" 
                                  placeholder="Andika hapa unapoenda" 
                                />
                            </div>
                          </div>
                      </div>

                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-[100] bg-[#111118]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                          {suggestions.map((s, i) => (
                            <button key={`suggest-${s.display_name}-${i}`} onClick={() => selectSuggestion(s)} className="w-full text-left p-4 hover:bg-white/5 flex items-center gap-4 border-b border-white/5 last:border-0 group">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#7f77dd] group-hover:bg-[#7f77dd]/20 transition-colors">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold text-white truncate">{s.display_name}</p>
                                <p className="text-[10px] text-[#6b6b8a] truncate mt-0.5">Andika hapa kuchagua eneo hili</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                   </div>

                   <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                      {rideOptions.map((ride) => (
                        <button 
                          key={ride.id} 
                          onClick={() => setSelectedRide(ride)} 
                          className={`shrink-0 w-32 p-5 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 relative overflow-hidden group ${
                            selectedRide?.id === ride.id 
                            ? 'bg-[#7F77DD]/10 border-[#7F77DD] shadow-[0_0_20px_rgba(127,119,221,0.2)]' 
                            : 'bg-[#111118] border-white/5 opacity-60 hover:opacity-100 hover:border-white/10'
                          }`}
                        >
                          {selectedRide?.id === ride.id && (
                            <motion.div layoutId="active-bg" className="absolute inset-0 bg-[#7F77DD]/10 pointer-events-none" />
                          )}
                          <div className={`text-4xl transition-transform duration-300 ${selectedRide?.id === ride.id ? 'scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'group-hover:scale-105'}`}>{ride.image}</div>
                          <div className="text-center">
                            <h4 className={`text-[10px] font-black uppercase tracking-wider ${selectedRide?.id === ride.id ? 'text-[#7F77DD]' : 'text-[#6b6b8a]'}`}>{ride.name}</h4>
                            <h3 className="text-xs font-black text-white italic mt-1">TZS {ride.price.toLocaleString()}</h3>
                          </div>
                        </button>
                      ))}
                   </div>

                   <button 
                    onClick={() => { console.log("Confirm button click"); confirmBooking(); }} 
                    disabled={isCreatingRide || !destination} 
                    className="w-full h-16 bg-white text-[#0a0a0f] rounded-3xl font-black italic uppercase text-xs tracking-[0.2em] flex items-center justify-between px-10 disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-2xl relative overflow-hidden group"
                   >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <span className="relative z-10">{destination ? (selectedRide ? 'THIBITISHA USAFIRI' : 'CHAGUA USAFIRI') : 'WEKA UNAPOKWENDA'}</span>
                      <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                   </button>
                 </motion.div>
               )}

               {(isMinimized || isMapFullscreen) && (
                 <div className="py-2 flex flex-col items-center justify-center gap-1 opacity-80">
                   <div className="w-8 h-8 rounded-full bg-[#7F77DD]/20 flex items-center justify-center mb-1">
                      <ChevronRight className="w-4 h-4 text-[#7F77DD] -rotate-90" />
                   </div>
                   <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Bofya hapa kuendelea</p>
                 </div>
               )}
            </motion.div>
          )}

          {step === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-transparent pointer-events-none"
            >
              <SearchingScreen 
                ride={activeRide as any} 
                onCancel={() => { console.log("Cancel from searching"); cancelRide(); setStep('map'); setRideId(null); }} 
                onTimeout={handleTimeout}
                isMinimized={isMapFullscreen}
              />
            </motion.div>
          )}

          {step === 'found' && (
            <motion.div
              key="found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-transparent pointer-events-none"
            >
              <DriverFoundScreen 
                onNext={() => setStep('found')} 
                isMinimized={isMapFullscreen}
              />
            </motion.div>
          )}

          {step === 'arriving' && activeRide && (
             <motion.div key="arriving" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-transparent pointer-events-none">
                <DriverArrivedScreen 
                  ride={{ ...activeRide, driverLocation: driverLivePos || activeRide.driverLocation } as any} 
                  onCall={() => window.open(`tel:${activeRide.driverInfo?.phone}`)} 
                  onMessage={() => {
                    if (activeRide.driverId) {
                      setSearchParams({ to: activeRide.driverId });
                      setIsChatOpen(true);
                    }
                  }}
                  onImComing={() => {
                    updateDoc(doc(db, 'rides', rideId!), { status: 'on_trip', updatedAt: serverTimestamp() });
                  }}
                  isMinimized={isMapFullscreen}
                />
             </motion.div>
          )}

          {step === 'on_trip' && activeRide && (
            <motion.div key="on_trip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-transparent pointer-events-none">
              <LiveTripScreen 
                ride={{ ...activeRide, driverLocation: driverLivePos || activeRide.driverLocation, distance: liveDistance || activeRide.distance } as any} 
                onMessage={() => {
                  if (activeRide.driverId) {
                    setSearchParams({ to: activeRide.driverId });
                    setIsChatOpen(true);
                  }
                }}
                isMinimized={isMapFullscreen}
              />
            </motion.div>
          )}

          {step === 'completed' && activeRide && (
            <motion.div key="completed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[80] bg-[#0a0a0f]">
              <TripCompleteScreen ride={activeRide as any} onPay={handlePayment} />
            </motion.div>
          )}

          {step === 'rating' && activeRide && (
            <motion.div key="rating" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[80] bg-[#0a0a0f]">
              <RatingScreen 
                ride={activeRide as any} 
                onSubmit={handleRating} 
                onSkip={() => navigate('/')} 
              />
            </motion.div>
          )}
        </AnimatePresence>

            {step === 'timeout' && (
          <div 
            className="absolute inset-0 z-[100] bg-[#0a0a0f] flex flex-col items-center justify-center p-8 text-center"
          >
             <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-8 border border-red-500/30">
                <CloseX className="w-10 h-10" />
             </div>
             <h2 className="text-2xl font-black text-[#f0eeff] mb-4">Hakuna Dereva Karibu Nawe Sasa Hivi</h2>
             <p className="text-[#6b6b8a] text-sm font-bold mb-12">Samahani, madereva wetu wote wako mbali kwa sasa. Tafadhali jaribu tena baada ya muda mfupi.</p>
             
             <div className="w-full space-y-4">
                <button 
                  onClick={handleRetry}
                  className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform"
                >
                  Jaribu Tena
                </button>
                <button 
                  onClick={() => { setStep('home'); setRideId(null); }}
                  className="w-full text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest py-4 transition-colors hover:text-[#f0eeff]"
                >
                  Ghairi
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isChatOpen && activeRide && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute inset-x-0 bottom-0 top-[72px] z-[200] bg-[#0a0a0f] p-4 pt-12"
          >
             <button 
               onClick={() => setIsChatOpen(false)}
               className="absolute top-4 right-4 w-10 h-10 bg-[#111118] border border-[#1e1e2e] rounded-xl flex items-center justify-center z-[210] active:scale-95 transition-transform"
             >
               <CloseX className="w-6 h-6 text-[#f0eeff]" />
             </button>
             <Chat onBack={() => setIsChatOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { font-family: inherit; }
        .custom-div-icon { background: none; border: none; }
      `}</style>
    </div>
  );
}
