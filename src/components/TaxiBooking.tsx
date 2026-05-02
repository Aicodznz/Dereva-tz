import React, { useState, useEffect } from 'react';
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
import { db, auth } from '../firebase';
import { 
  doc, updateDoc, addDoc, collection, serverTimestamp, 
  query, where, onSnapshot, limit, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
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

const MapEvents = ({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
  });
  return null;
};

const MapControl = ({ position, step, targetPos }: { position: [number, number], step: string, targetPos?: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      if (['arriving', 'on_trip', 'found'].includes(step) && targetPos) {
        const bounds = L.latLngBounds([position, targetPos]);
        map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 1.5 });
      } else if (['arriving', 'on_trip'].includes(step)) {
        map.panTo(position, { animate: true, duration: 1.5 });
      } else {
        map.setView(position, 15);
      }
    }
  }, [position?.[0], position?.[1], step, targetPos?.[0], targetPos?.[1], map]);
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

  const [step, setStep] = useState<BookingStep>('home');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [settingMode, setSettingMode] = useState<'pickup' | 'destination'>('pickup');
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);

  const [pickupPos, setPickupPos] = useState<[number, number]>([-6.7721, 39.2326]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8235, 39.2695]);
  const [pickup, setPickup] = useState('Tafuta eneo lako...');
  const [destination, setDestination] = useState('');

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'Accept-Language': 'sw,en' }
      });
      const data = await response.json();
      return formatAddress(data);
    } catch (error) {
      return "Unknown Area";
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
    });

    return () => unsubscribe();
  }, [user]);

  // Live Tracking: Synchronize specialized states from the active ride
  useEffect(() => {
    if (activeRide?.driverLocation && ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip'].includes(activeRide.status)) {
       console.log("[TaxiBooking] Syncing driver location from ride doc:", activeRide.driverLocation);
       setDriverLivePos(activeRide.driverLocation);
       
       const target = (activeRide.status === 'on_trip') ? activeRide.destination : activeRide.pickup;
       const dist = L.latLng(activeRide.driverLocation.lat, activeRide.driverLocation.lng)
                     .distanceTo(L.latLng(target.lat, target.lng));
       setLiveDistance(dist / 1000); // km
    } else if (activeRide?.status === 'completed') {
       setStep('rating');
    }
  }, [activeRide?.driverLocation?.lat, activeRide?.driverLocation?.lng, activeRide?.status]);

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
      });
      return () => unsub();
    }
  }, [activeRide?.driverId, activeRide?.status]);
  useMatchmaking(activeRide as any);

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
      html: `<div class="bg-emerald-500 text-white w-7 h-7 rounded-full border-[3px] border-white shadow-xl flex items-center justify-center font-black text-[10px]">A</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
  }), []);

  const EndPin = React.useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="bg-red-500 text-white w-7 h-7 rounded-full border-[3px] border-white shadow-xl flex items-center justify-center font-black text-[10px]">B</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  }), []);

  const geocodeAddress = (query: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
          headers: { 'Accept-Language': 'en' }
        });
        const data = await response.json();
        setSuggestions(data.map((item: any) => ({
          display_name: formatAddress(item),
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon)
        })));
      } catch (error) {
        console.error("Geocoding search failed", error);
      }
    }, 600);
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
        photo: profile?.photoURL || activeUser.photoURL || null,
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
    <div className="max-w-md mx-auto bg-green-500/5 w-full flex flex-col relative overflow-hidden font-sans text-[#f0eeff] border-x border-[#1e1e2e] h-[calc(100svh-72px)] min-h-[500px]">
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
               <div className="absolute top-6 left-6 right-6 z-[60] flex items-center justify-between">
                  {step === 'map' && (
                    <button onClick={() => setStep('home')} className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white"><ArrowLeft className="w-6 h-6" /></button>
                  )}
                  {step !== 'map' && <div className="w-12" />}
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsMapFullscreen(!isMapFullscreen)} 
                      className={`w-12 h-12 ${isMapFullscreen ? 'bg-red-500 text-white' : 'bg-[#111118]/90 text-white'} backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-all`}
                    >
                       {isMapFullscreen ? <RotateCw className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
                    </button>
                    <button onClick={() => navigate('/taxi/history')} className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white"><Clock className="w-6 h-6" /></button>
                  </div>
               </div>

               <style>{`.leaflet-container { height: 100% !important; width: 100% !important; background: #0a0a0f !important; } .custom-div-icon { background: none; border: none; }`}</style>
               <MapContainer center={pickupPos} zoom={15} className="h-full w-full grayscale contrast-[1.1] brightness-[0.9]" zoomControl={false}>
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 <MapEvents onMapClick={handleMapClick} />
                 <MapControl 
                   position={settingMode === 'pickup' ? pickupPos : destPos} 
                   step={step} 
                   targetPos={
                     ['arriving', 'found'].includes(step) ? pickupPos :
                     step === 'on_trip' ? destPos :
                     undefined
                   }
                 />
                 <Marker position={pickupPos} icon={StartPin} />
                 <Marker position={destPos} icon={EndPin} />
                 
                 {/* Assigned Driver Marker */}
                 {(driverLivePos || activeRide?.driverLocation) && (
                   <Marker 
                     key={`active-driver-${activeRide?.driverId || 'presence'}`}
                     position={[driverLivePos?.lat || activeRide!.driverLocation!.lat, driverLivePos?.lng || activeRide!.driverLocation!.lng]} 
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
              initial={{ y: 300 }}
              animate={{ y: isMapFullscreen ? 800 : (isMinimized ? 520 : 0) }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 z-[60] bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-5 pb-10 space-y-4 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
            >
               <div 
                 className="w-16 h-4 mx-auto mb-2 flex items-center justify-center cursor-pointer group"
                 onClick={() => setIsMinimized(!isMinimized)}
               >
                  <div className="w-12 h-1.5 bg-neutral-800 rounded-full group-hover:bg-neutral-600 transition-colors" />
               </div>
               
               {!isMinimized && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="space-y-4"
                 >
                   <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-[28px] p-5 relative">
                      <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${settingMode === 'pickup' ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-neutral-700'}`} />
                            <div className="flex-1">
                               <input 
                                 type="text" 
                                 value={pickup} 
                                 onChange={(e) => { setPickup(e.target.value); geocodeAddress(e.target.value); }} 
                                 onFocus={() => setSettingMode('pickup')}
                                 className="w-full bg-transparent text-sm font-bold text-[#f0eeff] border-none outline-none p-0" 
                               />
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCurrentLocation(); }}
                              className="p-2 hover:bg-white/5 rounded-full transition-colors text-emerald-500"
                              title="Eneo langu"
                            >
                               <Navigation2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${settingMode === 'destination' ? 'bg-red-500 ring-4 ring-red-500/20' : 'bg-neutral-700'}`} />
                            <div className="flex-1">
                                <input 
                                  type="text" 
                                  value={destination} 
                                  onChange={(e) => { setDestination(e.target.value); geocodeAddress(e.target.value); }} 
                                  onFocus={() => setSettingMode('destination')}
                                  className="w-full bg-transparent text-sm font-bold text-[#f0eeff] border-none outline-none p-0" 
                                  placeholder="Unakwenda wapi?" 
                                />
                            </div>
                          </div>
                      </div>

                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-[100] bg-[#111118] border border-[#1e1e2e] rounded-3xl shadow-2xl overflow-hidden">
                          {suggestions.map((s, i) => (
                            <button key={i} onClick={() => selectSuggestion(s)} className="w-full text-left p-4 hover:bg-[#1e1e2e] flex items-center gap-3 border-b border-[#1e1e2e] last:border-0">
                              <MapPin className="w-4 h-4 text-[#7F77DD]" />
                              <p className="text-xs font-bold text-[#f0eeff] truncate">{s.display_name}</p>
                            </button>
                          ))}
                        </div>
                      )}
                   </div>

                   <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                      {rideOptions.map((ride) => (
                        <button key={ride.id} onClick={() => setSelectedRide(ride)} className={`shrink-0 w-[120px] p-4 rounded-2xl border transition-all flex flex-col items-center ${selectedRide?.id === ride.id ? 'bg-red-500/10 border-red-500' : 'bg-[#111118] border-[#1e1e2e] opacity-70'}`}>
                          <div className="text-3xl mb-2">{ride.image}</div>
                          <h4 className="text-[9px] font-black uppercase text-[#6b6b8a]">{ride.name}</h4>
                          <h3 className="text-[11px] font-black text-[#f0eeff]">TZS {ride.price.toLocaleString()}</h3>
                        </button>
                      ))}
                   </div>

                   <button onClick={() => { console.log("Confirm button click"); confirmBooking(); }} disabled={isCreatingRide} className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-between px-10 disabled:opacity-50">
                      <span>{destination ? (selectedRide ? 'THIBITISHA USAFIRI' : 'CHAGUA USAFIRI') : 'WEKA UNAPOKWENDA'}</span>
                      <ArrowRight className="w-5 h-5" />
                   </button>
                 </motion.div>
               )}

               {isMinimized && (
                 <div className="py-2 flex items-center justify-center">
                   <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Bofya hapa kuendelea</p>
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
              className="absolute inset-0 z-[70] bg-[#0a0a0f]/20 backdrop-blur-[2px] px-4 pointer-events-none"
            >
              <div className="h-full w-full pointer-events-auto">
                <SearchingScreen 
                  ride={activeRide as any} 
                  onCancel={() => { console.log("Cancel from searching"); cancelRide(); setStep('map'); setRideId(null); }} 
                  onTimeout={handleTimeout}
                />
              </div>
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
              <div className="h-full w-full pointer-events-auto">
                <DriverFoundScreen onNext={() => setStep('arriving')} />
              </div>
            </motion.div>
          )}

          {step === 'arriving' && activeRide && (
             <motion.div key="arriving" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-transparent">
                <DriverArrivedScreen 
                  ride={{ ...activeRide, driverLocation: driverLivePos || activeRide.driverLocation } as any} 
                  onCall={() => window.open(`tel:${activeRide.driverInfo?.phone}`)} 
                  onMessage={() => setIsChatOpen(true)}
                  onImComing={() => toast.success("Dereva amejulishwa unakuja!")}
                />
             </motion.div>
          )}

          {step === 'on_trip' && activeRide && (
            <motion.div key="on_trip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-transparent">
              <LiveTripScreen 
                ride={{ ...activeRide, driverLocation: driverLivePos || activeRide.driverLocation, distance: liveDistance || activeRide.distance } as any} 
                onMessage={() => setIsChatOpen(true)}
              />
            </motion.div>
          )}

          {step === 'completed' && activeRide && (
            <motion.div key="completed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1">
              <TripCompleteScreen ride={activeRide as any} onPay={handlePayment} />
            </motion.div>
          )}

          {step === 'rating' && activeRide && (
            <motion.div key="rating" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1">
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
