import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  ArrowLeft, MapPin, Search, Navigation2, Clock, Star, 
  ChevronRight, X, Phone, MessageSquare, 
  Car, Activity, ShieldCheck, User,
  CheckCircle2, DollarSign, Zap, Layers, Trophy,
  ArrowRight, RefreshCw, RotateCw
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useRouting } from '../hooks/useRouting';
import { useCreateRide } from '../hooks/useCreateRide';
import { useRideStatus } from '../hooks/useRideStatus';

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
  if (!result || !result.address) return "Location Not Found";
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

  // Max 35 characters, truncate with "..."
  return label.length > 35 ? label.substring(0, 32) + "..." : label;
}

// --- COMPONENTS ---

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

// Map Pins
const StartPin = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="bg-[#1D9E75] text-white w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold">A</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const EndPin = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="bg-[#D85A30] text-white w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold">B</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

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

type BookingStep = 'home' | 'map' | 'searching' | 'confirmed' | 'arriving' | 'on_trip' | 'completed' | 'receipt';

interface RideOption {
  id: string;
  name: string;
  icon: any;
  sub: string;
  price: number;
  eta: string;
  image: string;
  vehicleType: 'pikipiki' | 'bajaji' | 'gari';
  discount?: string;
}

// --- MAIN COMPONENT ---

export default function TaxiBooking() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Navigation & UI State
  const [step, setStep] = useState<BookingStep>('home');
  const [settingMode, setSettingMode] = useState<'pickup' | 'destination'>('pickup');
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);

  // Locations & Coordinates
  const [pickupPos, setPickupPos] = useState<[number, number]>([-6.7721, 39.2326]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8235, 39.2695]);
  const [pickup, setPickup] = useState('Tabata Shule, Dar es Salaam');
  const [destination, setDestination] = useState('');

  // Routing & Distance
  const { routeCoords, totalDistance, isLoading: isRouteLoading } = useRouting(pickupPos, destPos);

  // Ride Management
  const { createRide, isLoading: isCreatingRide } = useCreateRide();
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide } = useRideStatus(rideId);
  const [etaText, setEtaText] = useState('Calculating...');
  const [tripProgress, setTripProgress] = useState(0);

  // Address Geocoding
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await response.json();
      return formatAddress(data);
    } catch (error) {
      return "Unknown Area";
    }
  };

  const [searchTimer, setSearchTimer] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const geocodeAddress = (query: string, isPickup: boolean) => {
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
          lon: parseFloat(item.lon),
          raw: item
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
    toast.loading("Inatafuta eneo...");
    const addr = await reverseGeocode(lat, lng);
    toast.dismiss();
    
    if (settingMode === 'pickup') {
      setPickupPos([lat, lng]);
      setPickup(addr);
    } else {
      setDestPos([lat, lng]);
      setDestination(addr);
    }
  };

  const swapLocations = () => {
    const tempPos = pickupPos;
    const tempAddr = pickup;
    setPickupPos(destPos);
    setPickup(destination);
    setDestPos(tempPos);
    setDestination(tempAddr);
  };

  const confirmBooking = async () => {
    if (!selectedRide || !user || !destination) {
       toast.error("Tafadhali chagua unapoenda");
       return;
    }
    
    try {
      const id = await createRide(
        user.uid,
        { lat: pickupPos[0], lng: pickupPos[1], address: pickup },
        { lat: destPos[0], lng: destPos[1], address: destination },
        selectedRide.id as any,
        selectedRide.price,
        routeCoords
      );
      if (id) {
        setRideId(id);
        setStep('searching');
      }
    } catch (error) {
      toast.error("Imeshindwa kutuma ombi");
    }
  };

  // Ride Logic Listeners
  useEffect(() => {
    if (!activeRide) return;
    
    if (activeRide.status === 'accepted') setStep('arriving');
    if (activeRide.status === 'on_trip') setStep('on_trip');
    if (activeRide.status === 'completed') setStep('completed');
    
    if (activeRide.eta) {
      setEtaText(`${activeRide.eta.minutes} min`);
    }

    // Rough progress estimation
    if (activeRide.status === 'on_trip' && activeRide.driverLocation && routeCoords.length > 1) {
       let minDistance = Infinity;
       let nearestIndex = 0;
       routeCoords.forEach((coord, index) => {
         const dist = Math.sqrt(Math.pow(coord[0] - activeRide.driverLocation!.lat, 2) + Math.pow(coord[1] - activeRide.driverLocation!.lng, 2));
         if (dist < minDistance) {
           minDistance = dist;
           nearestIndex = index;
         }
       });
       setTripProgress((nearestIndex / (routeCoords.length - 1)) * 100);
    }
  }, [activeRide?.status, activeRide?.eta, activeRide?.driverLocation, routeCoords]);

  const rideOptions: RideOption[] = [
    { 
      id: 'mini', 
      name: 'Gari', 
      icon: Car, 
      sub: 'Max 4 Siti', 
      price: 2800, 
      eta: '4',
      vehicleType: 'gari',
      image: '🚗',
      discount: 'PUNGUZO 3K'
    },
    { 
      id: 'bajaj', 
      name: 'Bajaj', 
      icon: BajajSVG, 
      sub: '3 Siti | Transit', 
      price: 1500, 
      eta: '5',
      vehicleType: 'bajaji',
      image: '🛺' 
    },
    { 
      id: 'bike', 
      name: 'Bike', 
      icon: BikeSVG, 
      sub: 'Pikipiki', 
      price: 800, 
      eta: '3',
      vehicleType: 'pikipiki',
      image: '🏍️' 
    }
  ];

  return (
    <div className="max-w-md mx-auto bg-[#0a0a0f] min-h-screen relative overflow-hidden font-sans text-[#f0eeff]">
      {/* Dynamic Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-[#7F77DD]/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[10%] left-[-10%] w-[250px] h-[250px] bg-[#1D9E75]/10 blur-[80px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {step === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 px-6 pt-16 pb-24 space-y-10"
          >
            {/* Logo Section */}
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-[#f0eeff]">
                SwiftApp<br /><span className="text-[#7F77DD]">TegeX</span>
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse" />
                <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">Premium Rides Only</p>
              </div>
            </div>

            {/* Main Action Box */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6">
               <div className="space-y-4">
                  <div 
                    className="group bg-[#0a0a0f] rounded-2xl border border-[#1e1e2e] p-5 flex items-center gap-4 cursor-pointer hover:border-[#1D9E75]/50 transition-all"
                    onClick={() => setStep('map')}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75]">
                       <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-wider mb-1">Pickup From</p>
                       <p className="text-sm font-bold text-[#f0eeff] truncate">{pickup}</p>
                    </div>
                  </div>

                  <div 
                    className="group bg-[#0a0a0f] rounded-2xl border border-[#1e1e2e] p-5 flex items-center gap-4 cursor-pointer hover:border-[#7F77DD]/50 transition-all ring-1 ring-[#7F77DD]/10"
                    onClick={() => setStep('map')}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD]">
                       <Search className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-wider mb-1">Where to?</p>
                       <p className={`text-sm font-bold truncate ${destination ? 'text-[#f0eeff]' : 'text-[#6b6b8a]'}`}>
                          {destination || "Andika eneo unaloenda..."}
                       </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#7F77DD] group-hover:translate-x-1 transition-transform" />
                  </div>
               </div>

               <button 
                 onClick={() => setStep('map')}
                 className="w-full h-15 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-[0.98] transition-all hover:bg-neutral-100"
               >
                 BOOK SAFARI NOW
               </button>
            </div>

            {/* Quick Badges */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#111118]/50 border border-[#1e1e2e] rounded-3xl p-6 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-[#7F77DD]/10 text-[#7F77DD] mb-3">
                     <Zap className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-black italic text-[#f0eeff]">FAST</h4>
                  <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none">Swift Delivery</p>
               </div>
               <div className="bg-[#111118]/50 border border-[#1e1e2e] rounded-3xl p-6 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-[#1D9E75]/10 text-[#1D9E75] mb-3">
                     <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-black italic text-[#f0eeff]">SAFE</h4>
                  <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none">Secure Travel</p>
               </div>
            </div>
          </motion.div>
        )}

        {step === 'map' && (
          <motion.div 
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col h-full bg-[#0a0a0f]"
          >
            {/* Top Back Nav */}
            <div className="absolute top-8 left-6 z-[60]">
               <button 
                 onClick={() => setStep('home')}
                 className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl border border-[#1e1e2e] flex items-center justify-center text-[#f0eeff] shadow-2xl"
               >
                 <ArrowLeft className="w-6 h-6" />
               </button>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative z-0">
               <style>{`
                 .leaflet-container { background: #0a0a0f !important; }
                 .custom-div-icon { background: none; border: none; }
               `}</style>
               <MapContainer 
                 center={pickupPos} 
                 zoom={15} 
                 className="h-full w-full grayscale contrast-[1.2] invert-[0.9] opacity-60"
                 zoomControl={false}
               >
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 <MapEvents onMapClick={handleMapClick} />
                 <MapControl position={settingMode === 'pickup' ? pickupPos : destPos} step={step} />
                 <Marker position={pickupPos} icon={StartPin} />
                 <Marker position={destPos} icon={EndPin} />
                 {routeCoords.length > 1 && (
                   <Polyline positions={routeCoords} color="#7F77DD" weight={4} opacity={0.6} dashArray="8, 12" />
                 )}
               </MapContainer>
               
               {/* Selection Overlay */}
               <div className="absolute top-28 left-0 right-0 flex justify-center pointer-events-none z-50 px-6 text-center">
                  <div className={`px-6 py-3 rounded-full backdrop-blur-2xl border flex items-center gap-3 transition-all duration-500 ${
                    settingMode === 'pickup' ? 'bg-[#1D9E75]/20 border-[#1D9E75]/50 text-[#1D9E75]' : 'bg-[#D85A30]/20 border-[#D85A30]/50 text-[#D85A30]'
                  }`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${settingMode === 'pickup' ? 'bg-[#1D9E75]' : 'bg-[#D85A30]'}`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{settingMode === 'pickup' ? 'SELECT PICKUP' : 'SELECT DESTINATION'}</span>
                  </div>
               </div>
            </div>

            {/* Bottom Selection Panel */}
            <motion.div 
               initial={{ y: 300 }}
               animate={{ y: 0 }}
               className="relative z-50 bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] shadow-[0_-20px_60px_rgba(0,0,0,0.8)] p-6 pb-12 space-y-6"
            >
               <div className="w-12 h-1.5 bg-[#1e1e2e] rounded-full mx-auto" />

               {/* Location Card */}
               <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-[24px] p-5 relative">
                  <div className="space-y-6">
                     <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between">
                              <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest">Pickup</p>
                              <button onClick={() => setSettingMode('pickup')} className="text-[10px] font-black text-[#7F77DD] uppercase">Map</button>
                           </div>
                           <input 
                             type="text"
                             value={pickup}
                             onChange={(e) => {
                               setPickup(e.target.value);
                               geocodeAddress(e.target.value, true);
                             }}
                             onFocus={() => setSettingMode('pickup')}
                             placeholder="Anzia wapi..."
                             className="w-full bg-transparent text-sm font-bold text-[#f0eeff] border-none outline-none p-0 focus:ring-0 placeholder:text-[#6b6b8a]"
                           />
                        </div>
                     </div>

                     <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-[#D85A30]" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest">Destiny</p>
                              <button onClick={() => setSettingMode('destination')} className="text-[10px] font-black text-[#7F77DD] uppercase">Map</button>
                           </div>
                           <input 
                             type="text"
                             value={destination}
                             onChange={(e) => {
                               setDestination(e.target.value);
                               geocodeAddress(e.target.value, false);
                             }}
                             onFocus={() => setSettingMode('destination')}
                             placeholder="Unakwenda wapi?"
                             className="w-full bg-transparent text-sm font-bold text-[#f0eeff] border-none outline-none p-0 focus:ring-0 placeholder:text-[#6b6b8a]"
                           />
                        </div>
                     </div>
                  </div>

                  {/* Suggestions List */}
                  <AnimatePresence>
                    {suggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 border-t border-[#1e1e2e] pt-4 space-y-2 max-h-52 overflow-y-auto no-scrollbar relative z-10"
                      >
                        {suggestions.map((s, i) => (
                          <button 
                            key={i}
                            onClick={() => selectSuggestion(s)}
                            className="w-full text-left p-4 rounded-2xl bg-[#111118] border border-[#1e1e2e] hover:border-[#7F77DD]/50 flex items-center gap-4 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD] group-hover:scale-110 transition-transform">
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-[#f0eeff] truncate">{s.display_name}</p>
                               <p className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-widest">Select Location</p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button onClick={swapLocations} className="absolute right-4 top-10 w-8 h-8 bg-[#111118] border border-[#1e1e2e] rounded-full flex items-center justify-center text-[#6b6b8a] hover:text-[#7F77DD]">
                    <RotateCw className="w-4 h-4" />
                  </button>
               </div>

               {/* Distance Info */}
               <div className="flex justify-center items-center gap-3">
                  <Navigation2 className="w-3 h-3 text-[#6b6b8a] rotate-45" />
                  <span className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-[0.3em]">
                    {(totalDistance/1000).toFixed(1)} KM • NJIA YA HARAKA
                  </span>
               </div>

               {/* Vehicle Scroller */}
               <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 py-2">
                  {rideOptions.map((ride) => (
                    <button 
                      key={ride.id}
                      onClick={() => setSelectedRide(ride)}
                      className={`shrink-0 w-[140px] p-5 rounded-2xl border transition-all flex flex-col items-center relative overflow-hidden ${
                        selectedRide?.id === ride.id 
                        ? 'bg-[#7F77DD]/10 border-[#7F77DD] shadow-lg scale-105' 
                        : 'bg-[#111118] border-[#1e1e2e] opacity-70 scale-95'
                      }`}
                    >
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full border border-white/5">
                        <Clock className="w-2.5 h-2.5 text-[#6b6b8a]" />
                        <span className="text-[8px] font-bold text-[#6b6b8a]">{ride.eta}m</span>
                      </div>
                      <div className="w-full h-12 flex items-center justify-center mb-2">
                         {typeof ride.icon === 'function' ? (
                           <ride.icon className={`w-8 h-8 ${selectedRide?.id === ride.id ? 'text-[#7F77DD]' : 'text-[#f0eeff]'}`} />
                         ) : (
                           <span className="text-3xl">{ride.image}</span>
                         )}
                      </div>
                      <div className="text-center">
                         <h4 className="text-[10px] font-black uppercase text-[#f0eeff] mb-1">{ride.name}</h4>
                         <h3 className="text-sm font-black text-[#f0eeff]">TZS {ride.price.toLocaleString()}</h3>
                         {ride.discount && (
                            <div className="mt-2 text-[7px] font-black uppercase text-[#1D9E75] bg-[#1D9E75]/10 px-1.5 py-0.5 rounded-md border border-[#1D9E75]/20">
                               {ride.discount}
                            </div>
                         )}
                      </div>
                    </button>
                  ))}
               </div>

               {/* Confirm Button */}
               <button 
                  onClick={confirmBooking}
                  disabled={!selectedRide || !destination || isCreatingRide}
                  className="group w-full h-[60px] bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-between px-10 shadow-xl active:scale-[0.96] transition-all disabled:opacity-20"
               >
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse" />
                     <span>THIBITISHA SAFARI</span>
                  </div>
                  <ArrowRight className="w-5 h-5" />
               </button>
            </motion.div>
          </motion.div>
        )}

        {/* Searching */}
        {step === 'searching' && (
           <motion.div 
            key="searching"
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-[#0a0a0f]/95 backdrop-blur-3xl"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
           >
              <div className="relative w-60 h-60 mb-10">
                 <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-[3px] border-[#7F77DD]/20 border-t-[#7F77DD] rounded-full shadow-2xl shadow-[#7F77DD]/10"
                 />
                 <div className="absolute inset-8 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center text-7xl">
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      {selectedRide?.image}
                    </motion.div>
                 </div>
              </div>
              <div className="text-center space-y-4">
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#7F77DD] animate-pulse">Searching...</h2>
                 <p className="text-[#6b6b8a] font-bold max-w-[280px] mx-auto text-sm">Tunakutafutia dereva aliye karibu nawe sasa hivi.</p>
              </div>
              <button 
                onClick={() => setStep('map')}
                className="mt-16 text-[10px] font-black uppercase tracking-widest text-[#6b6b8a] bg-[#1e1e2e]/50 px-8 py-3 rounded-full"
              >
                GHAIRI OMBI
              </button>
           </motion.div>
        )}

        {/* Active Trip States */}
        {(step === 'arriving' || step === 'on_trip') && activeRide && (
          <motion.div 
            key="active"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-6 bottom-10 z-[60]"
          >
             <div className="bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8 shadow-4xl space-y-8">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#7F77DD]/30 bg-[#0a0a0f]">
                         <img src={activeRide.driverInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.driverId}`} className="w-full h-full object-cover" />
                      </div>
                      <div>
                         <h4 className="text-lg font-black uppercase italic tracking-tighter leading-none mb-1">{activeRide.driverInfo?.name || "Driver"}</h4>
                         <div className="flex items-center gap-1 text-[#D85A30]">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-[10px] font-black">4.9</span>
                         </div>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[8px] font-black text-[#6b6b8a] uppercase leading-none mb-1">ETA</p>
                      <p className="text-2xl font-black italic tracking-tighter text-[#7F77DD]">{etaText}</p>
                   </div>
                </div>

                <div className="bg-[#0a0a0f] rounded-3xl p-5 border border-[#1e1e2e] flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-10 bg-black/30 rounded-xl flex items-center justify-center text-3xl">
                         {selectedRide?.image}
                      </div>
                      <div>
                         <p className="text-[8px] font-black text-[#6b6b8a] uppercase leading-none mb-1">Plate</p>
                         <h4 className="text-xs font-black text-[#f0eeff] italic">{activeRide.driverInfo?.plate || "T 482 DXC"}</h4>
                      </div>
                   </div>
                   <div className="flex gap-2">
                     <button className="w-11 h-11 bg-[#1D9E75] rounded-xl flex items-center justify-center text-white shadow-lg"><Phone className="w-5 h-5 fill-white" /></button>
                     <button className="w-11 h-11 bg-[#1e1e2e] rounded-xl flex items-center justify-center text-white border border-[#1e1e2e]"><MessageSquare className="w-5 h-5" /></button>
                   </div>
                </div>

                <div className={`w-full py-4 rounded-full text-center font-black uppercase tracking-[0.2em] text-[10px] border ${
                   step === 'arriving' ? 'bg-[#D85A30]/10 border-[#D85A30]/30 text-[#D85A30]' : 'bg-[#1D9E75]/10 border-[#1D9E75]/30 text-[#1D9E75]'
                }`}>
                   {step === 'arriving' ? "Dereva anakuja..." : "Safari inaendelea..."}
                </div>
             </div>
          </motion.div>
        )}

        {step === 'completed' && activeRide && (
          <motion.div 
            key="completed"
            className="flex-1 px-6 pt-20 pb-12 relative z-10 flex flex-col items-center justify-center text-center space-y-10"
          >
             <div className="space-y-4">
                <div className="w-24 h-24 bg-[#1D9E75]/10 rounded-3xl flex items-center justify-center mx-auto border border-[#1D9E75]/30 shadow-2xl">
                   <CheckCircle2 className="w-12 h-12 text-[#1D9E75]" />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Safari<br />Imeisha!</h2>
                <p className="text-[#6b6b8a] font-bold text-sm leading-relaxed max-w-[280px]">Asante kwa kusafiri na Tegex! Hongera kwa safari salama.</p>
             </div>

             <div className="w-full bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8 space-y-8">
                <div className="flex items-center justify-between pb-6 border-b border-[#1e1e2e]">
                    <div className="text-left">
                       <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest mb-1">Jumla ya Malipo</p>
                       <h3 className="text-3xl font-black italic text-[#f0eeff]">TZS {activeRide.fare.toLocaleString()}</h3>
                    </div>
                    <Badge className="bg-[#1D9E75]/10 text-[#1D9E75] border-none uppercase text-[8px] font-black tracking-widest">PAID</Badge>
                </div>
                <button 
                  onClick={() => navigate('/')}
                  className="w-full h-15 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all"
                >
                  IMALIZA NA RURUDI
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}
