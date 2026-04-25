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
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
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

const MapControl = ({ position, step }: { position: [number, number], step: string }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      if (['arriving', 'on_trip'].includes(step)) {
        map.panTo(position, { animate: true, duration: 1.5 });
      } else {
        map.setView(position, 15);
      }
    }
  }, [position, step, map]);
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
  const { user, signInGuest } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<BookingStep>('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [settingMode, setSettingMode] = useState<'pickup' | 'destination'>('pickup');
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);

  const [pickupPos, setPickupPos] = useState<[number, number]>([-6.7721, 39.2326]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8235, 39.2695]);
  const [pickup, setPickup] = useState('Tabata Shule, Dar es Salaam');
  const [destination, setDestination] = useState('');

  const { routeCoords } = useRouting(pickupPos, destPos);

  const { createRide, isLoading: isCreatingRide } = useCreateRide();
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide, cancelRide, deleteRide } = useTripFlow(rideId);
  useMatchmaking(activeRide as any);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchTimer, setSearchTimer] = useState<any>(null);

  const { drivers } = useNearbyDrivers();

  const getDriverIcon = (type: string) => {
    let iconStr = '🚗';
    let ringColor = '#7F77DD';
    if (type === 'bike') {
      iconStr = '🏍️';
      ringColor = '#1D9E75';
    }
    if (type === 'bajaj') {
      iconStr = '🛺';
      ringColor = '#D85A30';
    }

    return L.divIcon({
      className: 'driver-marker-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 bg-white/20 rounded-full animate-ping"></div>
          <div class="w-10 h-10 bg-[#111118] border-2 border-[#1e1e2e] rounded-2xl flex items-center justify-center text-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-2 ring-${ringColor}/50 transition-all">
            ${iconStr}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  const StartPin = React.useMemo(() => L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="bg-[#1D9E75] text-white w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold">A</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
  }), []);

  const EndPin = React.useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="bg-[#D85A30] text-white w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold">B</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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
      
      const formattedCoords = routeCoords.map(c => ({ lat: c[0], lng: c[1] }));
      
      // Ensure user is signed in for the demo
      let currentUserId = user?.uid;
      if (!currentUserId) {
        console.log("No user found, signing in as guest for demo...");
        try {
          await signInGuest();
          // Need to wait slightly for auth state to update
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.error("Guest sign in failed", e);
        }
      }

      const id = await createRide(
        auth.currentUser?.uid || 'guest_user',
        { lat: pickupPos[0], lng: pickupPos[1], address: pickup },
        { lat: destPos[0], lng: destPos[1], address: destination },
        selectedRide.id as any,
        selectedRide.price,
        formattedCoords
      );
      
      if (id) {
        console.log("Ride created successfully. ID:", id);
        setRideId(id);
      } else {
        console.error("Ride creation returned null ID");
        setStep('map');
        toast.error("Imeshindwa kuunda safari. Jaribu tena.");
      }
    } catch (error) {
      console.error("Error in confirmBooking:", error);
      setStep('map');
      toast.error("Imeshindwa kuunda safari. Angalia mtandao wako.");
    }
  };

  useEffect(() => {
    if (!activeRide) return;
    
    console.log("Trip status updated:", activeRide.status);
    
    switch (activeRide.status) {
      case 'accepted':
      case 'driver_arriving':
        if (step !== 'found' && step !== 'arriving' && step !== 'on_trip' && step !== 'completed' && step !== 'rating') {
          setStep('found');
        }
        break;
      case 'driver_arrived':
        setStep('arriving');
        break;
      case 'on_trip':
        setStep('on_trip');
        break;
      case 'completed':
        if (step !== 'rating') setStep('completed');
        break;
      case 'cancelled':
        setStep('home');
        setRideId(null);
        toast.info("Safari imeghairiwa");
        break;
    }
  }, [activeRide?.status]);

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
      await setDoc(doc(db, 'payments', `pay_${rideId}`), {
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
      toast.error("Malipo yameshindwa");
    }
  };

  const handleRating = async (ratingValue: number, feedback: string[]) => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        rating: ratingValue,
        feedback,
        rated: true
      });
      toast.success("Asante kwa maoni yako!");
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
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

      <div className="flex-1 flex flex-col relative z-10 h-full"> 
        {step === 'home' && (
          <div 
            className="flex-1 flex flex-col px-6 pt-12 pb-24 space-y-8 overflow-y-auto no-scrollbar"
          >
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
          </div>
        )}

        {step === 'map' && (
          <div 
            className="flex-1 flex flex-col relative bg-[#0a0a0f] overflow-hidden"
          >
            <div className="absolute top-6 left-6 z-[60]">
               <button onClick={() => setStep('home')} className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform"><ArrowLeft className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 relative z-0">
               <style>{`.leaflet-container { height: 100% !important; background: #0a0a0f !important; } .custom-div-icon { background: none; border: none; }`}</style>
               <MapContainer center={pickupPos} zoom={15} className="h-full w-full grayscale contrast-[1.1] brightness-[0.9]" zoomControl={false}>
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 <MapEvents onMapClick={handleMapClick} />
                 <MapControl position={settingMode === 'pickup' ? pickupPos : destPos} step={step} />
                 <Marker position={pickupPos} icon={StartPin} />
                 <Marker position={destPos} icon={EndPin} />
                 
                 {/* Nearby Drivers - Show all initially, or filtered if ride selected */}
                 {drivers
                   .filter(d => !selectedRide || d.vehicleType === selectedRide.vehicleType)
                   .map(driver => (
                   <Marker 
                     key={driver.id} 
                     position={[driver.lat, driver.lng]} 
                     icon={getDriverIcon(driver.vehicleType)}
                   />
                 ))}

                 {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#7F77DD" weight={4} opacity={0.6} dashArray="8, 12" />}
               </MapContainer>
            </div>

            <div className="relative z-[60] bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-5 pb-10 space-y-4 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
               <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-[28px] p-5 relative">
                  <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full ${settingMode === 'pickup' ? 'bg-[#1D9E75] ring-4 ring-[#1D9E75]/20' : 'bg-[#6b6b8a]'}`} />
                        <div className="flex-1">
                           <input 
                             type="text" 
                             value={pickup} 
                             onChange={(e) => { setPickup(e.target.value); geocodeAddress(e.target.value); }} 
                             onFocus={() => setSettingMode('pickup')}
                             className="w-full bg-transparent text-sm font-bold text-[#f0eeff] border-none outline-none p-0" 
                           />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full ${settingMode === 'destination' ? 'bg-[#D85A30] ring-4 ring-[#D85A30]/20' : 'bg-[#6b6b8a]'}`} />
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
                    <button key={ride.id} onClick={() => setSelectedRide(ride)} className={`shrink-0 w-[120px] p-4 rounded-2xl border transition-all flex flex-col items-center ${selectedRide?.id === ride.id ? 'bg-[#7F77DD]/20 border-[#7F77DD]' : 'bg-[#111118] border-[#1e1e2e] opacity-70'}`}>
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
            </div>
          </div>
        )}

        {step === 'searching' && (
          <SearchingScreen 
            ride={activeRide as any} 
            onCancel={() => { console.log("Cancel from searching"); cancelRide(); setStep('map'); setRideId(null); }} 
            onTimeout={handleTimeout}
          />
        )}

        {step === 'found' && (
          <DriverFoundScreen onNext={() => setStep('arriving')} />
        )}

        {step === 'arriving' && activeRide && (
          <DriverArrivedScreen 
            ride={activeRide as any} 
            onCall={() => window.open(`tel:${activeRide.driverInfo?.phone}`)} 
            onMessage={() => setIsChatOpen(true)}
            onImComing={() => toast.success("Dereva amejulishwa unakuja!")}
          />
        )}

        {step === 'on_trip' && activeRide && (
          <LiveTripScreen 
            ride={activeRide as any} 
            onMessage={() => setIsChatOpen(true)}
          />
        )}

        {step === 'completed' && activeRide && (
          <TripCompleteScreen ride={activeRide as any} onPay={handlePayment} />
        )}

        {step === 'rating' && activeRide && (
          <RatingScreen 
            ride={activeRide as any} 
            onSubmit={handleRating} 
            onSkip={() => navigate('/')} 
          />
        )}

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
