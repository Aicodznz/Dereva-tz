// Priority: shop/amenity/building > road + suburb > suburb + city
function formatAddress(result: any): string {
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

  // Never include country, postcode, or coordinates
  return label.length > 35 ? label.substring(0, 32) + "..." : label;
}

const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await response.json();
    return formatAddress(data);
  } catch (error) {
    console.error("Geocoding error:", error);
    return "Unknown Location";
  }
};

const BajajSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11h18v7H3z" />
    <path d="M5 18v2M19 18v2" />
    <path d="M12 7v4" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="16" cy="18" r="1.5" />
    <path d="M7 7h10l-2-4H9z" />
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

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  ArrowLeft, MapPin, Search, Navigation2, Clock, Star, 
  CreditCard, ChevronRight, X, Phone, MessageSquare, 
  Car, Bike, Activity, ShieldCheck, HelpCircle, User,
  CheckCircle2, DollarSign, Wallet, Zap, Layers, Trophy,
  ArrowRight, RefreshCw
} from 'lucide-react';

// Fix leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom futuristic icons
const StartPin = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="bg-[#1D9E75] text-white w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center font-black">A</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const EndPin = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="bg-[#D85A30] text-white w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center font-black">B</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const DriverPin = (type: string) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative flex items-center justify-center">
          <div class="w-6 h-6 bg-[#0a0a0f] border border-[#7F77DD]/50 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(127,119,221,0.3)]">
            <div class="w-2 h-2 bg-[#7F77DD] rounded-full shadow-[0_0_5px_rgba(127,119,221,0.8)]"></div>
          </div>
        </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapControl = ({ position, step }: { position: [number, number], step: BookingStep }) => {
  const map = useMap();
  const lastCenter = React.useRef<number>(0);
  
  useEffect(() => {
    const now = Date.now();
    const shouldFollow = step === 'arriving' || step === 'on_trip';
    
    // Only center every 1 second during trip to avoid jitter
    if (shouldFollow) {
      if (now - lastCenter.current > 1000) {
        map.panTo(position, { animate: true, duration: 1.2 });
        lastCenter.current = now;
      }
    } else {
      map.setView(position, 15);
      lastCenter.current = now;
    }
  }, [position, step]);
  return null;
};
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { taxiService, RideRequest } from '../services/taxiService';
import { toast } from 'sonner';

import { useRouting } from '../hooks/useRouting';
import { useCreateRide } from '../hooks/useCreateRide';
import { useRideStatus } from '../hooks/useRideStatus';
import { RideStatus } from '../types/ride.types';

type BookingStep = 'home' | 'map' | 'searching' | 'confirmed' | 'arriving' | 'on_trip' | 'completed' | 'receipt';

interface RideOption {
  id: string;
  name: string;
  icon: any;
  sub: string;
  priceRange: string;
  price: number;
  eta: string;
  image: string;
  distance?: string;
  vehicleType: 'pikipiki' | 'bajaji' | 'gari';
}

export default function TaxiBooking() {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [pickupPos, setPickupPos] = useState<[number, number]>([-6.7721, 39.2326]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8781, 39.2026]);
  const [settingMode, setSettingMode] = useState<'pickup' | 'destination'>('pickup');

  const MapEvents = () => {
    useMapEvents({
      async click(e) {
        toast.loading("Gusa eneo...");
        const address = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        toast.dismiss();
        
        if (settingMode === 'pickup') {
          setPickupPos([e.latlng.lat, e.latlng.lng]);
          setPickup(address);
        } else {
          setDestPos([e.latlng.lat, e.latlng.lng]);
          setDestination(address);
        }
      },
    });
    return null;
  };

  const [step, setStep] = useState<BookingStep>('home');
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState('Current Location (D Block, Sector 2)');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'wallet'>('mpesa');
  
  const { routeCoords: osrmCoords, totalDistance, totalDuration: osrmDuration, isLoading: isRouteLoading, error: routeError } = useRouting(pickupPos, destPos);
  const routeCoords = osrmCoords.length > 0 ? osrmCoords : [pickupPos, destPos];
  
  const { createRide, rideId: createdRideId, isLoading: isCreatingRide } = useCreateRide();
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRideDoc, isLoading: isRideStatusLoading } = useRideStatus(rideId);
  const activeRide = activeRideDoc;

  const [tripProgress, setTripProgress] = useState(0); // 0 to 100
  const [etaSeconds, setEtaSeconds] = useState(0);

  // Calculate trip progress based on driver position relative to route
  useEffect(() => {
    if (step === 'on_trip' && activeRide?.driverLocation && routeCoords.length > 1) {
      // Find nearest point on route to estimate progress
      // Simple index-based estimation for now
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
  }, [activeRide?.driverLocation, step, routeCoords]);

  const [driverPos, setDriverPos] = useState<[number, number]>(pickupPos);
  
  // Link driverPos and ETA to real Firestore data
  useEffect(() => {
    if (activeRide?.driverLocation) {
      setDriverPos([activeRide.driverLocation.lat, activeRide.driverLocation.lng]);
    }
    if (activeRide?.eta) {
      setEtaSeconds(activeRide.eta);
    }
  }, [activeRide?.driverLocation, activeRide?.eta]);
  
  const rideOptions: RideOption[] = [
    { 
      id: 'mini', 
      name: 'Gari', 
      icon: Car, 
      sub: '4 Sitting | Deluxe', 
      priceRange: '2,800', 
      price: 2800, 
      eta: '4',
      vehicleType: 'gari',
      image: '🚗' 
    },
    { 
      id: 'bajaj', 
      name: 'Bajaj', 
      icon: BajajSVG, 
      sub: '3 Siti | Transit', 
      priceRange: '1,500', 
      price: 1500, 
      eta: '5',
      vehicleType: 'bajaji',
      image: '🛺' 
    },
    { 
      id: 'bike', 
      name: 'Bike', 
      icon: BikeSVG, 
      sub: '2-wheel rides', 
      priceRange: '800', 
      price: 800, 
      eta: '3',
      vehicleType: 'pikipiki',
      image: '🏍️' 
    }
  ];

  const DAR_LOCATIONS = [
    { name: 'Kariakoo Market', lat: -6.8184, lng: 39.2748 },
    { name: 'Posta Mpya', lat: -6.8163, lng: 39.2889 },
    { name: 'Mwenge Bus Stand', lat: -6.7686, lng: 39.2273 },
    { name: 'Ubungo Maziwa', lat: -6.7924, lng: 39.2083 },
    { name: 'Tabata Kisiwani', lat: -6.8235, lng: 39.2695 },
    { name: 'Tabata Mawenzi', lat: -6.8210, lng: 39.2600 },
    { name: 'Tabata Bima', lat: -6.8250, lng: 39.2750 },
    { name: 'Tabata Segerea', lat: -6.8350, lng: 39.2450 },
    { name: 'Mlimani City Mall', lat: -6.7725, lng: 39.2131 },
    { name: 'Tegeta Nyuki', lat: -6.6900, lng: 39.2100 },
    { name: 'Bunju B', lat: -6.6200, lng: 39.1900 },
    { name: 'Masasani Peninsula', lat: -6.7500, lng: 39.2800 },
    { name: 'Mikocheni Rose Garden', lat: -6.7750, lng: 39.2550 },
    { name: 'Kinondoni Mkwajuni', lat: -6.7950, lng: 39.2650 },
    { name: 'Sinza Mapambano', lat: -6.7850, lng: 39.2350 },
    { name: 'Kawe Beach', lat: -6.7350, lng: 39.2750 },
    { name: 'Mbezi Beach', lat: -6.7150, lng: 39.2650 },
    { name: 'Mbezi Luis', lat: -6.7950, lng: 39.1050 },
    { name: 'Kimara Mwisho', lat: -6.7850, lng: 39.1550 },
    { name: 'Kurasini Port', lat: -6.8450, lng: 39.2950 },
    { name: 'Temeke Hospital', lat: -6.8550, lng: 39.2750 },
    { name: 'Mbagala Zakhem', lat: -6.9050, lng: 39.2650 },
    { name: 'Magomeni Mapipa', lat: -6.8050, lng: 39.2550 },
    { name: 'Manzese Tip Top', lat: -6.7950, lng: 39.2250 },
    { name: 'Zanzibar Ferry Terminal', lat: -6.8140, lng: 39.2910 }
  ];

  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);

  const handleLocationSearch = (query: string, type: 'pickup' | 'destination') => {
    const filtered = DAR_LOCATIONS.filter(loc => 
      loc.name.toLowerCase().includes(query.toLowerCase())
    );
    if (type === 'pickup') {
      setPickup(query);
      setPickupSuggestions(query.length > 1 ? filtered : []);
    } else {
      setDestination(query);
      setDestSuggestions(query.length > 1 ? filtered : []);
    }
  };

  const selectLocation = (loc: any, type: 'pickup' | 'destination') => {
    if (type === 'pickup') {
      setPickup(loc.name);
      setPickupPos([loc.lat, loc.lng]);
      setPickupSuggestions([]);
    } else {
      setDestination(loc.name);
      setDestPos([loc.lat, loc.lng]);
      setDestSuggestions([]);
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

  const recentAddresses = [
    { name: 'Address Nine Street', area: 'Ncula, Klagorata', time: '1min' },
    { name: 'Address Sirargara', area: 'Koriuba, Mamatia', time: '5min' }
  ];

  // Listen for ride updates
  useEffect(() => {
    if (!activeRide) return;
    
    if (activeRide.status === 'accepted' || activeRide.status === 'driver_arriving') {
      setStep('arriving');
    }
    if (activeRide.status === 'on_trip') {
      setStep('on_trip');
    }
    if (activeRide.status === 'completed') {
      setStep('completed');
    }
    if (activeRide.status === 'cancelled') {
      toast.error("Safari imeghairiwa");
      setStep('map');
      setRideId(null);
    }
  }, [activeRide?.status]);

  const handleBookNow = () => {
    if (!destination) return;
    setStep('map');
  };

  const confirmBooking = async () => {
    if (!selectedRide || !user) return;
    
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
      console.error("Booking error:", error);
      toast.error("Imeshindwa kutuma ombi la safari");
      setStep('map');
    }
  };

  const [userRating, setUserRating] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  // Listen for nearby drivers
  useEffect(() => {
    if (step === 'map' || step === 'home') {
      const vType = selectedRide?.vehicleType || 'gari';
      const unsubscribe = taxiService.listenToNearbyDrivers(vType, (drivers) => {
        setNearbyDrivers(drivers);
      });
      return () => unsubscribe();
    }
  }, [step, selectedRide?.vehicleType]);

  const handleRate = async (rating: number) => {
    setUserRating(rating);
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        rating,
        status: 'rated',
        updatedAt: serverTimestamp()
      });
      toast.success("Asante kwa maoni yako!");
      navigate('/');
    } catch (error) {
      console.error("Rating error:", error);
      toast.error("Imeshindwa kutuma maoni");
    }
  };

  const [mapIcon, setMapIcon] = useState<any>(null);
  
  useEffect(() => {
    // Create custom icons for different vehicle types
    const createIcon = (type: string) => {
      const iconPath = type === 'pikipiki' 
        ? '<path d="M12 11c0 3.5 2.5 5 2.5 5M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7-8L9 5h4l-1 3Z"/>'
        : type === 'bajaji'
        ? '<path d="M4 11h16v6h-16zM6 17v2M18 17v2M12 7l-2 4h4z"/>'
        : '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>';

      return L.divIcon({
        className: 'custom-car-icon',
        html: `<div class="w-10 h-10 bg-white rounded-full p-2 shadow-xl border-2 border-orange-600 flex items-center justify-center">
                 <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="text-orange-600">${iconPath}</svg>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    };

    setMapIcon({
      pikipiki: createIcon('pikipiki'),
      bajaji: createIcon('bajaji'),
      gari: createIcon('gari')
    });
  }, []);

  return (
    <div className="max-w-md mx-auto bg-[#0a0a0f] min-h-screen relative overflow-hidden font-sans text-[#f0eeff]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#7F77DD]/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#1D9E75]/10 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <div className="relative z-50 px-6 pt-12 pb-4 flex items-center justify-between bg-[#0a0a0f]/50 backdrop-blur-md border-b border-[#1e1e2e]">
        <div className="flex items-center gap-3">
          {step !== 'home' ? (
            <button 
                onClick={() => setStep('home')}
                className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center border border-orange-600/30 text-orange-600"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-orange-600 p-0.5 overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="User" className="w-full h-full object-cover rounded-full" />
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              {step === 'home' ? `Karibu, ${profile?.displayName || 'Mteja'}` : 'Njia ya Safari'}
            </p>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">
              {step === 'home' ? 'Wapi leo?' : 'Trip Details'}
            </h1>
          </div>
        </div>
        <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-neutral-800 hover:bg-neutral-800 transition-colors">
          <X className="w-5 h-5 text-neutral-400" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-6 space-y-8 relative z-10 pb-24"
          >
            {/* Search Inputs */}
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-[#1D9E75]">
                  <MapPin className="w-5 h-5" />
                </div>
                <input 
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Uko wapi?" 
                  className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#7F77DD] transition-all font-bold placeholder:text-[#6b6b8a] text-[#f0eeff]"
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-[#D85A30]">
                  <Navigation2 className="w-5 h-5" />
                </div>
                <input 
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Unataka kwenda wapi?" 
                  className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#7F77DD] transition-all font-bold placeholder:text-[#6b6b8a] text-[#f0eeff]"
                />
              </div>
            </div>

            {/* Promo Banner */}
            <div className="relative rounded-[32px] overflow-hidden group border border-[#1e1e2e]">
               <div className="absolute inset-0 bg-gradient-to-br from-[#7F77DD]/20 to-[#0a0a0f] z-0" />
               <div className="relative z-10 p-8 space-y-2">
                 <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-[#f0eeff]">Safari yako, kwa<br />mtindo wa Tegex.</h2>
                 <p className="text-sm font-bold text-[#7F77DD]">Pata 15% punguzo la safari ya kwanza.</p>
               </div>
               <div className="absolute bottom-[-20px] right-[-20px] w-48 h-32 opacity-40 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                  <Car className="w-full h-full text-[#7F77DD]" />
               </div>
               <div className="absolute bottom-4 left-8">
                  <Badge className="bg-[#7F77DD] text-white font-black group-hover:px-6 transition-all duration-300">Tegex Premium</Badge>
               </div>
            </div>

            {/* Recent Locations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black italic uppercase tracking-tighter text-[#f0eeff]">Maeneo ya Karibuni</h3>
                <button className="text-[10px] font-black uppercase text-[#7F77DD]">Ondoa Zote</button>
              </div>
              <div className="space-y-4">
                 {recentAddresses.map((addr, idx) => (
                   <button 
                     key={idx}
                     onClick={() => setDestination(addr.name)}
                     className="w-full flex items-center justify-between p-4 rounded-xl bg-[#111118] border border-[#1e1e2e] hover:border-[#7F77DD] hover:bg-[#7F77DD]/5 transition-all group"
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-lg bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD] group-hover:scale-110 transition-transform">
                         <MapPin className="w-5 h-5" />
                       </div>
                       <div className="text-left">
                         <h4 className="font-bold text-sm text-[#f0eeff]">{addr.name}</h4>
                         <p className="text-[9px] text-[#6b6b8a] font-bold uppercase tracking-widest">{addr.area}</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-2 text-[#6b6b8a]">
                       <Clock className="w-3 h-3" />
                       <span className="text-[10px] font-black tracking-tight">{addr.time}</span>
                     </div>
                   </button>
                 ))}
              </div>
            </div>

            {/* Ride Selection Grid */}
            <div>
               <h3 className="text-lg font-black italic uppercase tracking-tighter mb-6 text-[#f0eeff]">Tafuta Gari</h3>
               <div className="grid grid-cols-2 gap-4">
                  {rideOptions.map((ride) => (
                    <button 
                      key={ride.id}
                      onClick={() => {
                        setSelectedRide(ride);
                        setStep('map');
                      }}
                      className={`relative p-6 rounded-[32px] border transition-all flex flex-col items-center text-center space-y-3 ${
                        selectedRide?.id === ride.id ? 'bg-[#7F77DD]/10 border-[#7F77DD] shadow-2xl shadow-[#7F77DD]/10' : 'bg-[#111118] border-[#1e1e2e] hover:border-[#6b6b8a]/30'
                      }`}
                    >
                      <div className="w-16 h-16 relative mb-2 flex items-center justify-center">
                         {typeof ride.icon === 'function' ? <ride.icon className="w-12 h-12 text-[#f0eeff]" /> : <span className="text-4xl">{ride.image}</span>}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black italic uppercase tracking-tighter leading-none text-[#f0eeff]">{ride.name}</h4>
                        <p className="text-[9px] font-bold text-[#6b6b8a]">{ride.sub}</p>
                        <p className="text-[10px] font-black text-[#7F77DD]">Price {ride.priceRange}</p>
                      </div>
                    </button>
                  ))}
               </div>
            </div>

            {/* Book Now Sticky */}
            <div className="fixed bottom-0 left-0 right-0 p-6 z-50 bg-gradient-to-t from-[#0a0a0f] to-transparent">
               <button 
                 onClick={handleBookNow}
                 disabled={!destination}
                 className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-widest shadow-2xl hover:bg-neutral-200 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
               >
                 Agiza Sasa
               </button>
            </div>
          </motion.div>
        )}

        {step === 'map' && (
          <motion.div 
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col h-full bg-[#0a0a0f] font-sans"
          >
            {/* Top Navigation Overlay */}
            <div className="absolute top-0 inset-x-0 z-[60] px-6 pt-6 pointer-events-none">
              <div className="flex items-center gap-4 pointer-events-auto">
                <button 
                  onClick={() => setStep('home')}
                  className="w-12 h-12 bg-[#111118]/90 backdrop-blur-xl rounded-2xl shadow-2xl flex items-center justify-center border border-[#1e1e2e] active:scale-90 transition-transform"
                >
                  <ArrowLeft className="w-5 h-5 text-[#f0eeff]" />
                </button>
                <div className="flex-1 bg-[#111118]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#1e1e2e] flex items-center px-4 py-3 gap-3">
                  <Search className="w-4 h-4 text-[#6b6b8a]" />
                  <input 
                    type="text" 
                    placeholder="Wapi unapo kwenda?" 
                    className="flex-1 bg-transparent text-sm font-black text-[#f0eeff] outline-none placeholder:text-[#6b6b8a]"
                    value={destination}
                    onChange={(e) => handleLocationSearch(e.target.value, 'destination')}
                  />
                  <div className="w-8 h-8 rounded-full border-2 border-[#7F77DD] overflow-hidden">
                    <img src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="User" />
                  </div>
                </div>
              </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 bg-white overflow-hidden relative">
               <style>
                 {`
                  .leaflet-container {
                    background: #f0f0f0 !important;
                  }
                  .custom-div-icon {
                    background: transparent;
                    border: none;
                  }
                 `}
               </style>
               <MapContainer 
                 center={pickupPos} 
                 zoom={13} 
                 style={{ height: '100%', width: '100%' }}
                 zoomControl={false}
               >
                 <TileLayer
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                 />
                 <Marker position={pickupPos} icon={StartPin}>
                   <Popup>Mwanzo (A)</Popup>
                 </Marker>
                 <Marker position={destPos} icon={EndPin}>
                    <Popup>Mwisho (B)</Popup>
                 </Marker>

                 {/* Trip Route Line - Real Road Routing */}
                 {(step === 'map' || step === 'details' || step === 'searching' || step === 'confirmed' || step === 'arriving' || step === 'on_trip') && routeCoords.length > 0 && (
                   <>
                     {/* Outer Glow */}
                     <Polyline 
                       positions={routeCoords} 
                       color="#1D9E75" 
                       weight={10} 
                       opacity={0.1}
                     />
                     {/* Full Route Base */}
                     <Polyline 
                       positions={routeCoords} 
                       color="#1D9E75" 
                       weight={4} 
                       opacity={0.6}
                     />
                   </>
                 )}

                 {/* Traveled Path - Purple portion */}
                 {step === 'on_trip' && routeCoords.length > 0 && (
                   <Polyline 
                     positions={routeCoords.slice(0, Math.floor((tripProgress/100) * (routeCoords.length - 1)) + 1).concat([driverPos])} 
                     color="#7F77DD" 
                     weight={5} 
                     opacity={1}
                   />
                 )}

                 {/* Driver Marker - initials + pulse anim */}
                 {(step === 'arriving' || step === 'on_trip') && (
                   <Marker 
                     position={driverPos}
                     icon={L.divIcon({
                       className: 'custom-div-icon',
                       html: `
                        <div class="relative flex flex-col items-center">
                          <div class="absolute inset-0 w-16 h-16 bg-amber-500/30 rounded-full animate-ping -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2"></div>
                          <div class="w-12 h-12 bg-neutral-900 rounded-full border-4 border-amber-500 shadow-2xl flex items-center justify-center text-white font-black text-sm z-10">
                            ${activeRide?.driverName?.split(' ').map(n => n[0]).join('') || 'JK'}
                          </div>
                        </div>
                       `,
                       iconSize: [48, 48],
                       iconAnchor: [24, 24]
                     })}
                   />
                 )}

                 {/* Render nearby drivers */}
                 {nearbyDrivers.map((driver: any) => (
                    <Marker 
                        key={driver.id} 
                        position={[driver.location.lat, driver.location.lng]}
                        icon={L.divIcon({
                          className: 'custom-div-icon',
                          html: `<div class="relative flex items-center justify-center">
                                   <div class="absolute w-12 h-12 bg-cyan-400/40 rounded-full animate-ping"></div>
                                   <div class="absolute w-8 h-8 bg-cyan-400/20 rounded-full animate-pulse"></div>
                                   <div class="w-7 h-7 bg-white p-1 rounded-full border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] flex items-center justify-center">
                                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" class="text-cyan-600">
                                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>
                                      </svg>
                                   </div>
                                   <div class="absolute -top-8 bg-neutral-900 border border-cyan-500/30 px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                                      <p class="text-[7px] font-black uppercase text-cyan-400 tracking-widest leading-none">Active & Receiving</p>
                                   </div>
                                 </div>`,
                          iconSize: [40, 40],
                          iconAnchor: [20, 20]
                        })}
                    >
                        <Popup>
                          <div class="p-2 text-neutral-900">
                            <p class="font-black text-[10px] uppercase tracking-widest text-cyan-600 mb-1">Active & Receiving</p>
                            <p class="text-xs font-bold">${driver.vehicleType.toUpperCase()} IKO HEWANI</p>
                            <p class="text-[9px] text-neutral-400 mt-1">Tayari kupokea abiria</p>
                          </div>
                        </Popup>
                    </Marker>
                 ))}

                 <MapControl 
                   position={(step === 'arriving' || step === 'on_trip') ? driverPos : (settingMode === 'pickup' ? pickupPos : destPos)} 
                   step={step}
                 />
                 <MapEvents />
               </MapContainer>
               
                 {/* Selection Mode Indicator floating on map */}
                 <div className="absolute top-28 left-0 right-0 flex justify-center z-50 pointer-events-none">
                    {isRouteLoading ? (
                      <div className="px-6 py-3 rounded-full bg-[#111118] border-2 border-[#D85A30] shadow-xl flex items-center gap-3 animate-pulse">
                         <div className="w-4 h-4 border-2 border-[#D85A30] border-t-transparent rounded-full animate-spin" />
                         <span className="text-[11px] font-black uppercase tracking-widest text-[#D85A30]">Tunafuta njia bora...</span>
                      </div>
                    ) : (
                      <div className={`px-6 py-3 rounded-full backdrop-blur-xl border-2 shadow-[0_0_30px_rgba(0,0,0,0.2)] flex items-center gap-3 pointer-events-auto transition-all ${settingMode === 'pickup' ? 'bg-[#1D9E75]/10 border-[#1D9E75]/50 text-[#1D9E75]' : 'bg-[#D85A30]/10 border-[#D85A30]/50 text-[#D85A30]'}`}>
                        <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_currentcolor] ${settingMode === 'pickup' ? 'bg-[#1D9E75]' : 'bg-[#D85A30]'}`} />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">GUSA RAMANI KUCHAGUA {settingMode === 'pickup' ? 'PICKUP' : 'DESTINATION'}</span>
                      </div>
                    )}
                 </div>

               {/* Map Controls - MOVED TO TOP RIGHT */}
               <div className="absolute right-6 top-6 flex flex-col gap-4 z-40">
                  {/* Floating ETA Chip */}
                   {(step === 'on_trip' || step === 'arriving') && (
                    <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#D85A30]/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-[#D85A30]" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none mb-1">
                            {step === 'on_trip' ? 'Muda uliobaki' : 'Dereva anawasili'}
                          </p>
                          <h4 className="text-xl font-black text-[#f0eeff] italic tracking-tighter">
                            {Math.floor(etaSeconds / 60)}:{Math.floor(etaSeconds % 60).toString().padStart(2, '0')}
                          </h4>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#1e1e2e] flex items-center justify-between">
                         <div className="flex items-center gap-1.5">
                            <Navigation2 className="w-3 h-3 text-[#1D9E75] rotate-45" />
                            <span className="text-[10px] font-black text-[#6b6b8a] capitalize">
                               {(totalDistance * (1 - tripProgress/100) / 1000).toFixed(1)} km
                            </span>
                         </div>
                         <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse" />
                      </div>
                    </div>
                  )}
                  
                  <button className="w-12 h-12 rounded-xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center text-[#6b6b8a] shadow-xl active:scale-95 transition-all">
                    <Navigation2 className="w-5 h-5" />
                  </button>
                  <button className="w-12 h-12 rounded-xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center text-[#6b6b8a] shadow-xl active:scale-95 transition-all">
                    <Layers className="w-5 h-5" />
                  </button>
               </div>
            </div>

            {/* Bottom Panel */}
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-[#111118] text-[#f0eeff] p-6 pb-12 space-y-6 z-40 border-t border-[#1e1e2e] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] relative rounded-t-[32px] overflow-hidden"
            >
               {/* Location Input Section */}
               <div className="bg-[#111118] p-4 rounded-2xl border border-[#1e1e2e] relative shadow-inner">
                  <div className="flex items-center gap-4 relative">
                     {/* Dots and line */}
                     <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#1D9E75] shadow-[0_0_8px_#1D9E75]" />
                        <div className="w-[1px] h-10 bg-[#1e1e2e]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#D85A30]" />
                     </div>

                     <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center group">
                           <div className="flex-1">
                              <p className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-widest mb-0.5">ENEO LA MWANZO</p>
                              <p className="text-sm font-medium text-[#f0eeff] line-clamp-1">{pickup}</p>
                           </div>
                           <button onClick={() => setSettingMode('pickup')} className="text-[11px] font-bold text-[#7F77DD] hover:underline px-2">Badilisha</button>
                        </div>
                        
                        {/* Subtle Badge */}
                        <div className="flex items-center gap-2">
                           <div className="h-[1px] flex-1 bg-[#1e1e2e]" />
                           <div className="bg-[#1D9E75]/10 text-[#1D9E75] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-[#1D9E75]/20">Njia ya Haraka</div>
                           <div className="h-[1px] flex-1 bg-[#1e1e2e]" />
                        </div>

                        <div className="flex justify-between items-center group">
                           <div className="flex-1">
                              <p className="text-[10px] font-bold text-[#6b6b8a] uppercase tracking-widest mb-0.5">ENEO LA MWISHO</p>
                              <p className="text-sm font-medium text-[#f0eeff] line-clamp-1">{destination || 'Unakwenda wapi?'}</p>
                           </div>
                           <button onClick={() => setSettingMode('destination')} className="text-[11px] font-bold text-[#7F77DD] hover:underline px-2">Badilisha</button>
                        </div>
                     </div>
                     
                     {/* Swap Icon */}
                     <button onClick={swapLocations} className="ml-2 w-8 h-8 rounded-full bg-[#1e1e2e] flex items-center justify-center text-[#6b6b8a] hover:text-[#f0eeff] transition-all hover:rotate-180 duration-500">
                        <RefreshCw className="w-4 h-4" />
                     </button>
                  </div>
                  
                  {/* Distance Indicator */}
                  <div className="mt-4 flex items-center gap-2 justify-center border-t border-[#1e1e2e] pt-3">
                     <Navigation2 className="w-3 h-3 text-[#6b6b8a] rotate-45" />
                     <span className="text-[9px] font-bold text-[#6b6b8a] uppercase tracking-widest">Total distance: {(totalDistance/1000).toFixed(1)} km</span>
                  </div>
               </div>

               {/* Vehicle Options */}
               <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6">
                  {rideOptions.map((ride) => (
                     <button 
                        key={ride.id}
                        onClick={() => setSelectedRide(ride)}
                        className={`shrink-0 w-[140px] p-4 rounded-2xl border transition-all flex flex-col items-center relative overflow-hidden backdrop-blur-sm ${
                           selectedRide?.id === ride.id 
                           ? 'bg-[#7F77DD]/5 border-[#7F77DD] shadow-[0_0_20px_rgba(127,119,221,0.1)] scale-[1.02]' 
                           : 'bg-[#111118] border-[#1e1e2e] hover:border-[#6b6b8a]/30'
                        }`}
                     >
                        <div className="flex items-center gap-1 absolute top-2 right-2 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                          <Clock className="w-2.5 h-2.5 text-[#6b6b8a]" />
                          <span className="text-[9px] font-bold text-[#6b6b8a]">{ride.eta} min</span>
                        </div>
                        
                        <div className="w-16 h-12 flex items-center justify-center mb-2">
                           {typeof ride.icon === 'function' ? (
                             <ride.icon className={`w-10 h-10 ${selectedRide?.id === ride.id ? 'text-[#7F77DD]' : 'text-[#f0eeff]'}`} />
                           ) : (
                             <span className="text-3xl">{ride.image}</span>
                           )}
                        </div>
                        
                        <div className="text-center">
                           <h4 className="text-xs font-bold uppercase text-[#f0eeff] mb-0.5 leading-none">{ride.name}</h4>
                           <p className="text-[9px] font-bold text-[#6b6b8a] mb-2 leading-none">{ride.sub}</p>
                           <div className="flex flex-col items-center">
                             <span className="text-sm font-black text-[#f0eeff]">TZS {ride.priceRange}</span>
                             <span className="text-[8px] font-bold text-[#1D9E75] uppercase tracking-widest bg-[#1D9E75]/10 px-2 py-0.5 rounded-full mt-1 border border-[#1D9E75]/20">PUNGUZO 3K</span>
                           </div>
                        </div>
                     </button>
                  ))}
               </div>

               {/* Confirm Action Button */}
               <button 
                  onClick={confirmBooking}
                  disabled={!selectedRide || !destination}
                  className="group w-full h-[56px] bg-white text-[#0a0a0f] rounded-[50px] font-bold uppercase tracking-[0.1em] text-sm overflow-hidden flex items-center justify-between px-8 shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
               >
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse shadow-[0_0_8px_#1D9E75]" />
                     <span>THIBITISHA SAFARI</span>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </button>
            </motion.div>
          </motion.div>
        )}

        {step === 'searching' && (
          <motion.div 
            key="searching"
            id="ride-searching-container"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-[#0a0a0f]/95 backdrop-blur-md"
          >
             <div className="relative w-64 h-64 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-[4px] border-[#7F77DD]/30 border-t-[#7F77DD] rounded-full shadow-[0_0_50px_rgba(127,119,221,0.2)]"
                />
                <div className="absolute inset-6 rounded-full bg-[#111118] border border-[#1e1e2e] flex items-center justify-center p-8 shadow-inner">
                   <div className="w-full h-full flex items-center justify-center text-6xl animate-pulse">
                      {selectedRide?.image}
                   </div>
                </div>
                <motion.div 
                   animate={{ scale: [1, 1.2, 1] }}
                   transition={{ duration: 1.5, repeat: Infinity }}
                   className="absolute top-0 right-0 w-8 h-8 bg-[#1D9E75] rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"
                >
                   <MapPin className="w-4 h-4 text-white" />
                </motion.div>
             </div>
            <div className="text-center space-y-3">
                <Badge className="bg-[#7F77DD]/20 text-[#7F77DD] border-none px-4 py-1.5 rounded-full text-[11px] font-black uppercase mb-2">
                   Kutafuta dereva: {selectedRide?.vehicleType}
                </Badge>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter animate-pulse text-[#f0eeff]">Kutafuta Dereva...</h2>
                <p className="text-[#6b6b8a] font-bold max-w-[250px] mx-auto text-sm">Tunatafuta dereva wa {selectedRide?.name} karibu nawe.</p>
             </div>
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 1 }}
               className="mt-12 w-full max-w-[200px]"
             >
                <button onClick={() => setStep('map')} className="w-full border border-[#1e1e2e] py-4 rounded-[50px] font-black uppercase tracking-widest text-[10px] text-[#6b6b8a] hover:text-red-500 hover:border-red-500/30 transition-all">GHAIRI SAFARI</button>
             </motion.div>
          </motion.div>
        )}

        {step === 'confirmed' && (
          <motion.div 
            key="confirmed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 relative z-10 flex flex-col h-[85vh] justify-center"
          >
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-[32px] p-10 shadow-3xl relative overflow-hidden group">
               <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-[#1D9E75]/10 blur-[80px] rounded-full group-hover:scale-150 transition-all" />
               <div className="absolute inset-0 z-0 bg-noise opacity-10" />

               <div className="relative z-10 space-y-8">
                  <div className="flex flex-col items-center text-center">
                     <div className="w-20 h-20 rounded-[2rem] bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75] mb-6 border-2 border-dashed border-[#1D9E75]/20 shadow-xl shadow-emerald-950/20">
                        <CheckCircle2 className="w-10 h-10" />
                     </div>
                     <h2 className="text-[#1D9E75] text-3xl font-black italic uppercase tracking-tighter">Safari Imethibitishwa!</h2>
                     <p className="text-[#6b6b8a] font-bold mt-2">Ahsante {profile?.displayName || 'Mteja'}, kiti chako kimetengwa.</p>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-5 bg-[#0a0a0f] rounded-3xl border border-[#1e1e2e]">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-black/20 rounded-2xl p-1 overflow-hidden flex items-center justify-center text-4xl">
                              {selectedRide?.image}
                           </div>
                           <div>
                              <h4 className="text-sm font-black uppercase italic text-[#f0eeff]">{selectedRide?.name}</h4>
                              <p className="text-[10px] font-bold text-[#6b6b8a]">Usafiri Uliochaguliwa</p>
                           </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-[#1D9E75]" />
                     </div>

                     <div className="p-6 bg-[#0a0a0f] rounded-3xl border border-[#1e1e2e] space-y-4">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="text-[9px] font-black uppercase text-[#6b6b8a] tracking-widest mb-1">Pickup</p>
                              <p className="text-xs font-bold leading-tight line-clamp-1 text-[#f0eeff]">{pickup}</p>
                           </div>
                        </div>
                        <div className="flex justify-between items-start pt-4 border-t border-[#1e1e2e]">
                           <div>
                              <p className="text-[9px] font-black uppercase text-[#6b6b8a] tracking-widest mb-1">Mwisho (Destination)</p>
                              <p className="text-xs font-bold leading-tight line-clamp-1 text-[#f0eeff]">{destination}</p>
                           </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-[#1e1e2e]">
                           <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-[#D85A30]" />
                              <span className="text-lg font-black italic text-[#f0eeff]">TZS {selectedRide?.price.toLocaleString()}</span>
                           </div>
                           <Badge className="bg-[#1D9E75]/20 text-[#1D9E75] border-none font-black text-[10px] px-4 py-1.5 rounded-full">IMETHIBITISHWA</Badge>
                        </div>
                     </div>
                  </div>

                  <button 
                     onClick={() => setStep('arriving')}
                     className="w-full bg-white text-[#0a0a0f] py-5 rounded-[50px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all shadow-xl active:scale-95"
                  >
                     Subiri Dereva Afike
                  </button>
               </div>
            </div>
          </motion.div>
        )}

        {step === 'arriving' && activeRide && (
          <motion.div 
            key="arriving"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 pt-12 space-y-8 relative z-10"
          >
             {/* Driver Card */}
             <div className="bg-[#111118] border border-[#1e1e2e] rounded-[32px] p-8 shadow-3xl border-b-[#1D9E75] border-b-2 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                   <Navigation2 className="w-24 h-24 text-[#D85A30] rotate-45" />
                </div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                   <p className="text-[10px] font-black uppercase text-[#1D9E75] tracking-widest mb-6">Dereva Anakuja</p>
                   <div className="text-5xl font-black italic mb-2 tracking-tighter text-[#f0eeff]">
                    {etaSeconds > 60 
                      ? `${Math.floor(etaSeconds / 60)} DK ${Math.floor(etaSeconds % 60)} SEK` 
                      : `${etaSeconds.toFixed(2)} SEK`}
                   </div>
                   <p className="text-[#6b6b8a] font-bold text-sm">{activeRide.driverName || 'Dereva'}</p>

                   <div className="w-full h-px bg-[#1e1e2e] my-8" />

                   <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-16 rounded-[1.5rem] bg-[#D85A30]/10 p-1 border-2 border-[#D85A30]/30 overflow-hidden relative">
                            <img src={activeRide.driverPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.driverName}`} alt="Driver" className="w-full h-full object-cover rounded-xl" />
                         </div>
                         <div className="text-left">
                            <h4 className="text-lg font-black uppercase italic tracking-tighter text-[#f0eeff]">{activeRide.driverName || 'Dereva'}</h4>
                            <div className="flex items-center gap-1 text-[#D85A30]">
                               <Star className="w-4 h-4 fill-current" />
                               <span className="text-sm font-black">4.9</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button className="w-12 h-12 rounded-2xl bg-[#0a0a0f] flex items-center justify-center text-[#f0eeff] border border-[#1e1e2e] hover:bg-[#111118] transition-all">
                            <Phone className="w-5 h-5" />
                         </button>
                         <button className="w-12 h-12 rounded-2xl bg-[#0a0a0f] flex items-center justify-center text-[#f0eeff] border border-[#1e1e2e] hover:bg-[#111118] transition-all">
                            <MessageSquare className="w-5 h-5" />
                         </button>
                      </div>
                   </div>

                   <div className="w-full bg-[#0a0a0f]/40 rounded-3xl p-5 mt-6 border border-[#1e1e2e] flex items-center gap-5 group/car">
                      <div className="w-20 h-14 bg-black/30 rounded-2xl flex items-center justify-center text-4xl p-1 overflow-hidden">
                         {selectedRide?.image}
                      </div>
                      <div className="text-left">
                         <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none mb-1">Maelezo ya Chombo</p>
                         <h4 className="text-sm font-black text-[#f0eeff]">{activeRide.vehicleNumber || 'T 123 ABC'}</h4>
                      </div>
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-[#6b6b8a] tracking-widest ml-4">Maelezo ya Safari ya Sasa</p>
                <div className="p-6 bg-[#111118] border border-[#1e1e2e] rounded-3xl space-y-6">
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75] shrink-0">
                         <div className="w-3 h-3 rounded-full bg-[#1D9E75] animate-ping" />
                      </div>
                      <div>
                         <p className="text-[9px] font-black uppercase text-[#6b6b8a] tracking-widest mb-1">Pickup</p>
                         <p className="text-xs font-bold leading-tight text-[#f0eeff]">{pickup}</p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-[#1D9E75]/10 border-2 border-[#1D9E75]/20 p-6 rounded-3xl text-center space-y-2">
                <p className="text-[10px] font-black uppercase text-[#1D9E75] tracking-widest">Driver Status</p>
                <h4 className="text-xl font-black italic uppercase tracking-tighter text-[#1D9E75]">
                   {activeRide.status === 'accepted' && 'Anakuja kukuachukua...'}
                   {activeRide.status === 'arrived' && 'Amefika! Tafadhali nenda kwenye gari.'}
                </h4>
             </div>
          </motion.div>
        )}
         {step === 'on_trip' && activeRide && (
          <motion.div 
            key="on_trip"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 pt-12 space-y-6 relative z-10"
          >
             <div className="bg-[#111118] border border-[#1e1e2e] rounded-[32px] p-8 shadow-3xl border-b-[#7F77DD] border-b-4 overflow-hidden relative group">
                <div className="relative z-10 flex flex-col items-center text-center">
                   <div className="flex items-center gap-2 bg-[#7F77DD]/10 px-4 py-1.5 rounded-full border border-[#7F77DD]/20 mb-6">
                      <div className="w-2 h-2 bg-[#7F77DD] rounded-full animate-pulse shadow-[0_0_8px_#7F77DD]" />
                      <span className="text-[10px] font-black uppercase text-[#7F77DD] tracking-widest leading-none">SAFARI INAENDELEA</span>
                   </div>
                   
                   <div className={`text-6xl font-black italic mb-2 tracking-tighter ${tripProgress >= 95 ? 'text-[#1D9E75]' : 'text-[#f0eeff]'}`}>
                     {tripProgress >= 100 ? 'UMEFIKA!' : (
                       etaSeconds > 60 
                         ? `${Math.floor(etaSeconds / 60)}:${Math.floor(etaSeconds % 60).toString().padStart(2, '0')}` 
                         : `${etaSeconds.toFixed(2)}`
                     )}
                   </div>
                   <p className="text-[#6b6b8a] font-bold text-xs uppercase tracking-widest mb-8">
                     {tripProgress >= 100 ? 'TUMEFATILIA MWISHO WA SAFARI' : `${(totalDistance * (1 - tripProgress/100) / 1000).toFixed(1)} KM IMESALIA`}
                   </p>

                   {/* Progress Visual */}
                   <div className="w-full h-3 bg-[#1e1e2e] rounded-full mb-8 relative overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${tripProgress}%` }}
                        className="absolute h-full bg-gradient-to-r from-[#7F77DD] to-[#1D9E75] rounded-full"
                      />
                   </div>

                   <div className="w-full flex justify-between items-center px-2">
                       <div className="flex flex-col items-start">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tripProgress > 0 ? 'bg-[#1D9E75] text-white' : 'bg-[#1e1e2e] text-[#6b6b8a]'}`}>
                             <p className="text-[10px] font-black">A</p>
                          </div>
                          <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest">Kuanza</p>
                       </div>
                       <div className="flex-1 h-px bg-[#1e1e2e] mx-4 border-t border-dashed border-[#1e1e2e]" />
                       <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 border-2 transition-colors ${tripProgress > 10 && tripProgress < 90 ? 'bg-[#7F77DD] border-white text-white' : 'bg-[#1e1e2e] border-[#1e1e2e] text-[#6b6b8a]'}`}>
                             <Navigation2 className="w-5 h-5 rotate-45" />
                          </div>
                          <p className={`text-[8px] font-black uppercase tracking-widest ${tripProgress > 10 && tripProgress < 90 ? 'text-[#7F77DD]' : 'text-[#6b6b8a]'}`}>Ulipo Sasa</p>
                       </div>
                       <div className="flex-1 h-px bg-[#1e1e18] mx-4 border-t border-dashed border-[#1e1e2e]" />
                       <div className="flex flex-col items-end">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tripProgress >= 100 ? 'bg-[#1D9E75] text-white' : 'bg-[#1e1e2e] text-[#6b6b8a]'}`}>
                             <p className="text-[10px] font-black">B</p>
                          </div>
                          <p className="text-[8px] font-black text-[#6b6b8a] uppercase tracking-widest">Mwisho</p>
                       </div>
                   </div>
                </div>
             </div>

              {/* Driver Detailed Card */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-[2.5rem] p-6 shadow-2xl">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-[#0a0a0f] bg-[#0a0a0f]">
                             <img src={activeRide.driverPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.driverName}`} alt="Driver" className="w-full h-full object-cover" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 bg-[#1D9E75] w-5 h-5 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center">
                             <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          </div>
                       </div>
                       <div>
                          <h4 className="font-black uppercase italic text-lg leading-none mb-1 text-[#f0eeff]">{activeRide.driverName}</h4>
                          <div className="flex items-center gap-2">
                             <div className="flex items-center bg-[#D85A30]/10 px-2 py-0.5 rounded text-[#D85A30]">
                                <Star className="w-3 h-3 fill-[#D85A30]" />
                                <span className="text-[10px] font-black ml-1">4.9</span>
                             </div>
                             <p className="text-[10px] text-[#6b6b8a] font-bold tracking-widest uppercase">{activeRide.vehicleNumber}</p>
                          </div>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button className="w-12 h-12 bg-[#1D9E75] rounded-2xl flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-transform">
                          <Phone className="w-5 h-5 fill-white" />
                       </button>
                       <button className="w-12 h-12 bg-[#0a0a0f] border border-[#1e1e2e] rounded-2xl flex items-center justify-center text-[#f0eeff] hover:scale-105 active:scale-95 transition-transform">
                          <MessageSquare className="w-5 h-5" />
                       </button>
                    </div>
                 </div>
              </div>
           </motion.div>
        )}

         {step === 'completed' && activeRide && (
          <motion.div 
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 pt-20 space-y-8 relative z-10"
          >
             <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-[#1D9E75]/10 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-dashed border-[#1D9E75]/30 text-[#1D9E75] shadow-3xl shadow-emerald-950/20">
                   <ShieldCheck className="w-12 h-12" />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#f0eeff]">Safari Imekamilika</h2>
                <p className="text-[#6b6b8a] font-bold max-w-[250px] mx-auto text-sm">Asante kwa kusafiri nasi leo! Tumekufikisha salama.</p>
             </div>

             <div className="bg-[#111118] border border-[#1e1e2e] rounded-[32px] p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-[#1e1e2e] pb-6">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#D85A30]/30">
                         <img src={activeRide.driverPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.driverName}`} alt="Driver" />
                      </div>
                      <div className="text-left">
                         <h4 className="text-lg font-black uppercase italic tracking-tighter text-[#f0eeff]">{activeRide.driverName}</h4>
                         <p className="text-[10px] text-[#6b6b8a] font-bold uppercase">{activeRide.vehicleNumber}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-[#1D9E75] uppercase">Paid Via {activeRide.paymentMethod || 'Cash'}</p>
                      <p className="text-2xl font-black italic mt-1 tracking-tighter text-[#f0eeff]">TZS {activeRide.estimatedFare.toLocaleString()}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-center text-[10px] font-black uppercase text-[#6b6b8a] tracking-wider">Tafadhali kadiria safari yako:</p>
                   <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                         <button 
                          key={star} 
                          onClick={() => handleRate(star)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                            userRating >= star ? 'bg-[#7F77DD] text-white' : 'bg-[#0a0a0f] text-[#6b6b8a] hover:bg-[#111118]'
                          }`}
                        >
                            <Star className={`w-6 h-6 ${userRating >= star ? 'fill-current' : ''}`} />
                         </button>
                      ))}
                   </div>
                </div>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => setStep('receipt')}
                  className="flex-1 border border-[#1e1e2e] py-5 rounded-[50px] font-black uppercase tracking-tighter text-sm italic text-[#6b6b8a] hover:bg-white/5"
                >
                  View Receipt
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="flex-1 bg-white text-[#0a0a0f] py-5 rounded-[50px] font-black uppercase tracking-tighter text-sm italic shadow-2xl"
                >
                  Nyumbani Sasa
                </button>
             </div>
          </motion.div>
        )}

        {step === 'receipt' && (
          <motion.div 
            key="receipt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 pt-12 space-y-8 relative z-10 flex flex-col items-center"
          >
             <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#f0eeff]">Malipo na Stakabadhi</h2>
                <Badge className="bg-[#1D9E75]/20 text-[#1D9E75] border-none px-6 py-2 rounded-xl font-black tracking-widest text-[10px]">MALIPO IMETHIBITISHWA</Badge>
             </div>

             {/* Stylized Receipt */}
             <div className="w-full max-w-[320px] bg-white rounded-t-3xl relative p-10 text-[#0a0a0f] shadow-2xl group">
                {/* Receipt Zigzag Bottom */}
                <div className="absolute bottom-[-10px] left-0 right-0 h-[20px] bg-[radial-gradient(circle_at_10px_-4px,white_10px,transparent_11px)] bg-[length:20px_20px]" />
                
                <div className="space-y-6">
                   <div className="text-center pb-6 border-b border-dashed border-neutral-300">
                      <div className="w-16 h-16 bg-[#0a0a0f] rounded-2xl mx-auto flex items-center justify-center text-white mb-4 font-black text-2xl tracking-tighter italic">TX</div>
                      <h3 className="font-black italic uppercase text-xl text-[#0a0a0f]">Maelezo ya Malipo:</h3>
                   </div>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-neutral-500">Gharama ya Safari:</span>
                         <span className="font-black italic">TZS {selectedRide?.price.toLocaleString() || '2,800'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-neutral-500">Ada ya Huduma:</span>
                         <span className="font-black italic">TZS 500</span>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-dashed border-neutral-300 flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest leading-none mb-1">Jumla ya Malipo:</p>
                         <p className="text-3xl font-black italic tracking-tighter text-[#0a0a0f]">TZS {((selectedRide?.price || 0) + 500).toLocaleString()}</p>
                      </div>
                      <div className="w-12 h-12 bg-[#1D9E75] rounded-2xl flex items-center justify-center text-white shadow-lg">
                         <CheckCircle2 className="w-7 h-7" />
                      </div>
                   </div>
                </div>
             </div>

             <div className="pt-12 w-full flex flex-col gap-4">
                <button 
                  onClick={() => navigate('/')}
                  className="w-full bg-white text-[#0a0a0f] py-6 rounded-[50px] font-black uppercase tracking-tighter text-lg italic shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Navigation2 className="w-5 h-5 pointer-events-none" />
                  Nyumbani Sasa
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Padding */}
      <div className="h-24" />
    </div>
  );
}
