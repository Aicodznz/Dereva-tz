import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  ArrowLeft, MapPin, Search, Navigation2, Clock, Star, 
  CreditCard, ChevronRight, X, Phone, MessageSquare, 
  Car, Bike, Activity, ShieldCheck, HelpCircle, User,
  CheckCircle2, DollarSign, Wallet, Zap, Layers, Trophy
} from 'lucide-react';

// Fix leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom futuristic icons
const StartPin = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="relative flex items-center justify-center">
            <div class="absolute w-12 h-12 bg-emerald-500/30 rounded-full animate-ping"></div>
            <div class="relative w-9 h-9 bg-white border-2 border-emerald-500 rounded-lg flex items-center justify-center shadow-xl">
              <span class="text-emerald-500 font-black text-sm">M</span>
            </div>
            <div class="absolute -bottom-1 w-2 h-2 bg-emerald-500 rotate-45"></div>
          </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
});

const EndPin = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 bg-amber-500/30 rounded-full animate-ping"></div>
          <div class="relative w-9 h-9 bg-white border-2 border-amber-500 rounded-lg flex items-center justify-center shadow-xl">
            <span class="text-amber-500 font-black text-sm">E</span>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 bg-amber-500 rotate-45"></div>
        </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

const DriverPin = (type: string) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative flex items-center justify-center">
          <div class="w-6 h-6 bg-neutral-950 border border-cyan-500/50 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            <div class="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,0.8)]"></div>
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

const MapControl = ({ position }: { position: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(position, 15);
  }, [position]);
  return null;
};
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { taxiService, RideRequest } from '../services/taxiService';
import { toast } from 'sonner';

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
  const [pickupPos, setPickupPos] = useState<[number, number]>([-6.7924, 39.2083]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8235, 39.2695]);
  const [settingMode, setSettingMode] = useState<'pickup' | 'destination'>('pickup');

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (settingMode === 'pickup') {
          setPickupPos([e.latlng.lat, e.latlng.lng]);
          setPickup(`Karatasi ya Ramani (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
        } else {
          setDestPos([e.latlng.lat, e.latlng.lng]);
          setDestination(`Karatasi ya Ramani (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
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
  
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  
  const rideOptions: RideOption[] = [
    { 
      id: 'mini', 
      name: 'TegeX Gari', 
      icon: Car, 
      sub: '4 Seats | Deluxe Gari', 
      priceRange: '2,800', 
      price: 2800, 
      eta: '4',
      vehicleType: 'gari',
      image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=400&q=80' 
    },
    { 
      id: 'bajaji', 
      name: 'TegeX Bajaj', 
      icon: Activity, 
      sub: '3 Siti | Transit', 
      priceRange: '1,500', 
      price: 1500, 
      eta: '5',
      vehicleType: 'bajaji',
      image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=400&q=80' 
    },
    { 
      id: 'bike', 
      name: 'TegeX Bike', 
      icon: Bike, 
      sub: '2-wheel rides', 
      priceRange: '800', 
      price: 800, 
      eta: '3',
      vehicleType: 'pikipiki',
      image: 'https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&w=400&q=80' 
    }
  ];

  const DAR_LOCATIONS = [
    { name: 'Kariakoo Market', lat: -6.8184, lng: 39.2748 },
    { name: 'Posta Mpya', lat: -6.8163, lng: 39.2889 },
    { name: 'Mwenge Bus Stand', lat: -6.7686, lng: 39.2273 },
    { name: 'Ubungo Maziwa', lat: -6.7924, lng: 39.2083 },
    { name: 'Tabata Kisiwani', lat: -6.8235, lng: 39.2695 },
    { name: 'Mlimani City', lat: -6.7725, lng: 39.2131 }
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

  const recentAddresses = [
    { name: 'Address Nine Street', area: 'Ncula, Klagorata', time: '1min' },
    { name: 'Address Sirargara', area: 'Koriuba, Mamatia', time: '5min' }
  ];

  // Listen for ride updates
  useEffect(() => {
    if (!rideId) return;
    const unsubscribe = taxiService.listenToRide(rideId, (ride) => {
      setActiveRide(ride);
      if (ride.status === 'accepted') setStep('confirmed');
      if (ride.status === 'arrived') setStep('arriving');
      if (ride.status === 'started') setStep('on_trip');
      if (ride.status === 'completed') setStep('completed');
    });
    return () => unsubscribe();
  }, [rideId]);

  const handleBookNow = () => {
    if (!destination) return;
    setStep('map');
  };

  const confirmBooking = async () => {
    if (!selectedRide || !user) return;
    setStep('searching');
    
    try {
      const docRef = await taxiService.requestRide({
        customerId: user.uid,
        customerName: profile?.displayName || 'Mteja',
        customerPhoto: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`,
        pickup: { lat: -6.7924, lng: 39.2083 },
        destination: { lat: -6.8235, lng: 39.2695 },
        pickupAddress: pickup,
        destinationAddress: destination,
        distance: 5.2,
        duration: 15,
        estimatedFare: selectedRide.price,
        vehicleType: selectedRide.vehicleType,
        paymentMethod: paymentMethod
      });
      setRideId(docRef.id);
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Failed to request ride");
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
      await taxiService.rateRide(rideId, rating, "Great ride!");
      toast.success("Asante kwa maoni yako!");
      navigate('/');
    } catch (error) {
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
    <div className="max-w-md mx-auto bg-neutral-950 min-h-screen relative overflow-hidden font-sans text-white">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <div className="relative z-50 px-6 pt-12 pb-4 flex items-center justify-between bg-neutral-950/50 backdrop-blur-md border-b border-white/5">
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
                <div className="absolute inset-y-0 left-4 flex items-center text-emerald-500">
                  <MapPin className="w-5 h-5" />
                </div>
                <input 
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Uko wapi?" 
                  className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-all font-bold placeholder:text-neutral-600"
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-orange-600">
                  <Navigation2 className="w-5 h-5" />
                </div>
                <input 
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Unataka kwenda wapi?" 
                  className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-orange-600 transition-all font-bold placeholder:text-neutral-600"
                />
              </div>
            </div>

            {/* Promo Banner */}
            <div className="relative rounded-[2.5rem] overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-orange-600/40 to-neutral-950 z-0" />
               <div className="relative z-10 p-8 space-y-2">
                 <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter">Safari yako, kwa<br />mtindo wa Tegex.</h2>
                 <p className="text-sm font-bold text-orange-400">Pata 15% punguzo la safari ya kwanza.</p>
               </div>
               <div className="absolute bottom-[-20px] right-[-20px] w-48 h-32 opacity-80 group-hover:scale-110 transition-transform duration-700">
                  <img src="https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=400&q=80" alt="Car" className="w-full h-full object-contain" />
               </div>
               <div className="absolute bottom-4 left-8">
                  <Badge className="bg-orange-600 text-white font-black group-hover:px-6 transition-all duration-300">Tegex Prime</Badge>
               </div>
            </div>

            {/* Recent Locations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black italic uppercase tracking-tighter">Maeneo ya Karibuni</h3>
                <button className="text-[10px] font-black uppercase text-orange-600">Ondoa Zote</button>
              </div>
              <div className="space-y-4">
                {recentAddresses.map((addr, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setDestination(addr.name)}
                    className="w-full flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-sm text-neutral-200">{addr.name}</h4>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{addr.area}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{addr.time}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ride Selection Grid */}
            <div>
               <h3 className="text-lg font-black italic uppercase tracking-tighter mb-6">Tafuta Gari</h3>
               <div className="grid grid-cols-2 gap-4">
                  {rideOptions.map((ride) => (
                    <button 
                      key={ride.id}
                      onClick={() => {
                        setSelectedRide(ride);
                        setDestination('Random Location'); // Auto-fill for demo
                      }}
                      className={`relative p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center text-center space-y-3 ${
                        selectedRide?.id === ride.id ? 'bg-orange-600/10 border-orange-600 shadow-2xl shadow-orange-600/20' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="w-20 h-20 relative mb-2">
                        <img src={ride.image} alt={ride.name} className="w-full h-full object-contain mix-blend-lighten group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black italic uppercase tracking-tighter leading-none">{ride.name}</h4>
                        <p className="text-[9px] font-bold text-neutral-500">{ride.sub}</p>
                        <p className="text-[10px] font-black text-orange-600">Price {ride.priceRange}</p>
                      </div>
                    </button>
                  ))}
               </div>
            </div>

            {/* Book Now Sticky */}
            <div className="fixed bottom-0 left-0 right-0 p-6 z-50">
               <button 
                 onClick={handleBookNow}
                 disabled={!destination}
                 className="w-full bg-emerald-500 py-5 rounded-2xl font-black uppercase tracking-widest text-white shadow-2xl shadow-emerald-900/40 hover:bg-emerald-400 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
               >
                 Book Now
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
            className="absolute inset-0 z-10 flex flex-col h-full bg-neutral-950 font-sans"
          >
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
                   <Popup>Mwanzo (Pickup)</Popup>
                 </Marker>
                 <Marker position={destPos} icon={EndPin}>
                    <Popup>Mwisho (Destination)</Popup>
                 </Marker>

                 {/* Render nearby drivers */}
                 {nearbyDrivers.map((driver: any) => (
                    <Marker 
                        key={driver.id} 
                        position={[driver.location.lat, driver.location.lng]}
                        icon={DriverPin(driver.vehicleType)}
                    >
                        <Popup>{driver.vehicleType.toUpperCase()} iko karibu!</Popup>
                    </Marker>
                 ))}

                 <MapControl position={settingMode === 'pickup' ? pickupPos : destPos} />
                 <MapEvents />
               </MapContainer>
               
               {/* Selection Mode Indicator floating on map */}
               <div className="absolute top-28 left-0 right-0 flex justify-center z-50 pointer-events-none">
                  <div className={`px-6 py-3 rounded-full backdrop-blur-xl border-2 shadow-[0_0_30px_rgba(0,0,0,0.2)] flex items-center gap-3 pointer-events-auto transition-all ${settingMode === 'pickup' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600' : 'bg-amber-500/10 border-amber-500/50 text-amber-600'}`}>
                    <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_currentcolor] ${settingMode === 'pickup' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">GUSA RAMANI KUCHAGUA {settingMode === 'pickup' ? 'PICKUP' : 'DESTINATION'}</span>
                  </div>
               </div>

               {/* Map Controls - MOVED TO TOP RIGHT */}
               <div className="absolute right-6 top-6 flex flex-col gap-4 z-40">
                  <button className="w-12 h-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 shadow-xl active:scale-95 transition-all">
                    <Navigation2 className="w-5 h-5" />
                  </button>
                  <button className="w-12 h-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 shadow-xl active:scale-95 transition-all">
                    <Layers className="w-5 h-5" />
                  </button>
               </div>
            </div>

            {/* Bottom Panel */}
            <div className="bg-white p-8 space-y-6 z-40 border-t-2 border-amber-500/20 shadow-[0_-20px_60px_rgba(0,0,0,0.1)] relative rounded-t-[3rem]">
               {/* Address Display */}
               <div className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-200 shadow-inner space-y-6 relative overflow-hidden group">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center pt-2 gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      </div>
                      <div className="w-0.5 h-12 border-l-2 border-dashed border-neutral-300" />
                      <div className="w-4 h-4 rounded-full border-2 border-amber-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Pickup Point: <span className="text-neutral-400 italic font-medium">{pickupPos[0].toFixed(4)}, {pickupPos[1].toFixed(4)}</span></label>
                        <input 
                          value={pickup}
                          onFocus={() => setSettingMode('pickup')}
                          onChange={(e) => handleLocationSearch(e.target.value, 'pickup')}
                          className="bg-transparent text-sm font-bold w-full focus:outline-none text-neutral-900 placeholder:text-neutral-300"
                          placeholder="Andika au gusa ramani..."
                        />
                        {pickupSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-neutral-100 rounded-2xl shadow-2xl z-[60] overflow-hidden max-h-48 overflow-y-auto">
                            {pickupSuggestions.map((loc, idx) => (
                              <button 
                                key={idx}
                                onClick={() => selectLocation(loc, 'pickup')}
                                className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-neutral-50 flex items-center gap-3 border-b border-neutral-50 last:border-0"
                              >
                                <MapPin className="w-3 h-3 text-emerald-500" />
                                {loc.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-600">Destination: <span className="text-neutral-400 italic font-medium">{destPos[0].toFixed(4)}, {destPos[1].toFixed(4)}</span></label>
                        <input 
                          value={destination}
                          onFocus={() => setSettingMode('destination')}
                          onChange={(e) => handleLocationSearch(e.target.value, 'destination')}
                          className="bg-transparent text-sm font-bold w-full focus:outline-none text-neutral-900 placeholder:text-neutral-300"
                          placeholder="Andika unapo kwenda..."
                        />
                        {destSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-neutral-100 rounded-2xl shadow-2xl z-[60] overflow-hidden max-h-48 overflow-y-auto">
                            {destSuggestions.map((loc, idx) => (
                              <button 
                                key={idx}
                                onClick={() => selectLocation(loc, 'destination')}
                                className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-neutral-50 flex items-center gap-3 border-b border-neutral-50 last:border-0"
                              >
                                <MapPin className="w-3 h-3 text-amber-500" />
                                {loc.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
               </div>

               {/* Vehicle Options */}
               <div className="grid grid-cols-3 gap-3">
                  {rideOptions.map((ride) => (
                     <button 
                        key={ride.id}
                        onClick={() => setSelectedRide(ride)}
                        className={`group relative p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 overflow-hidden ${
                           selectedRide?.id === ride.id ? 'bg-amber-500/5 border-amber-500 shadow-xl scale-105 shadow-amber-500/20' : 'bg-neutral-50 border-neutral-200'
                        }`}
                     >
                        <div className="flex items-center gap-1 absolute top-2 right-2 opacity-70">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span className="text-[8px] font-black">{ride.eta}min</span>
                        </div>
                        
                        <div className="w-16 h-10 relative mb-1">
                           <img src={ride.image} alt={ride.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" />
                        </div>
                        
                        <div className="text-center">
                           <h4 className="text-[10px] font-black uppercase leading-none mb-1">{ride.name}</h4>
                           <p className="text-[8px] font-bold text-neutral-400 mb-1 leading-none">{ride.sub}</p>
                           <div className="flex flex-col items-center">
                             <span className="text-[11px] font-black text-amber-600">TZS {ride.price}</span>
                             <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">Punguzo Tzs 3000</span>
                           </div>
                        </div>
                     </button>
                  ))}
               </div>

               {/* Confirm Action Button */}
               <button 
                  onClick={confirmBooking}
                  className="w-full h-20 bg-neutral-900 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-sm hover:bg-black transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-4 border border-white/10"
               >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Thibitisha Safari
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               </button>
            </div>
          </motion.div>
        )}

        {step === 'searching' && (
          <motion.div 
            key="searching"
            id="ride-searching-container"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 bg-neutral-950/90 backdrop-blur-sm"
          >
             <div className="relative w-64 h-64 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-[6px] border-orange-600 border-t-transparent rounded-full shadow-[0_0_50px_rgba(234,88,12,0.3)]"
                />
                <div className="absolute inset-4 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center p-8 shadow-inner">
                   <img src={selectedRide?.image} alt="Ride" className="w-full h-full object-contain animate-pulse mix-blend-lighten" />
                </div>
                <motion.div 
                   animate={{ scale: [1, 1.2, 1] }}
                   transition={{ duration: 1.5, repeat: Infinity }}
                   className="absolute top-0 right-0 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"
                >
                   <MapPin className="w-4 h-4 text-white" />
                </motion.div>
             </div>
             <div className="text-center space-y-3">
                <Badge className="bg-orange-600/20 text-orange-600 border-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase mb-2">
                   Searching for {selectedRide?.vehicleType}
                </Badge>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter animate-pulse">Kutafuta Dereva...</h2>
                <p className="text-neutral-500 font-bold max-w-[250px] mx-auto text-sm">Tunatafuta dereva wa {selectedRide?.name} karibu nawe.</p>
             </div>
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 1 }}
               className="mt-12 w-full max-w-[200px]"
             >
                <button onClick={() => setStep('map')} className="w-full border border-neutral-800 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-neutral-500 hover:text-red-500 hover:border-red-500/30 transition-all">GHAIRI SAFARI</button>
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
            <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] p-10 shadow-3xl relative overflow-hidden group">
               <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full group-hover:scale-150 transition-all" />
               <div className="absolute inset-0 z-0 bg-noise opacity-10" />

               <div className="relative z-10 space-y-8">
                  <div className="flex flex-col items-center text-center">
                     <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 border-2 border-dashed border-emerald-500/20 shadow-xl shadow-emerald-950/20">
                        <CheckCircle2 className="w-10 h-10" />
                     </div>
                     <h2 className="text- emerald-500 text-3xl font-black italic uppercase italic tracking-tighter">Safari Imethibitishwa!</h2>
                     <p className="text-neutral-400 font-bold mt-2">Ahsante {profile?.displayName || 'Mteja'}, kiti chako kimetengwa.</p>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-5 bg-neutral-800/50 rounded-3xl border border-white/5">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-black/20 rounded-2xl p-1 overflow-hidden">
                              <img src={selectedRide?.image} alt="Car" className="w-full h-full object-contain mix-blend-lighten" />
                           </div>
                           <div>
                              <h4 className="text-sm font-black uppercase italic">{selectedRide?.name}</h4>
                              <p className="text-[10px] font-bold text-neutral-500">Selected Vehicle</p>
                           </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                     </div>

                     <div className="p-6 bg-neutral-800/50 rounded-3xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">Pickup</p>
                              <p className="text-xs font-bold leading-tight line-clamp-1">{pickup}</p>
                           </div>
                        </div>
                        <div className="flex justify-between items-start pt-4 border-t border-white/5">
                           <div>
                              <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">Kuelekea</p>
                              <p className="text-xs font-bold leading-tight line-clamp-1">{destination}</p>
                           </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-orange-600" />
                              <span className="text-lg font-black italic">USD {selectedRide?.price}</span>
                           </div>
                           <Badge className="bg-emerald-500/20 text-emerald-500 border-none font-black text-[10px] px-4 py-1.5 rounded-full">CONFIRMED</Badge>
                        </div>
                     </div>
                  </div>

                  <button 
                     onClick={() => setStep('arriving')}
                     className="w-full bg-neutral-100 text-neutral-950 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-white/5"
                  >
                     Confirm Details & Start
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
             <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] p-8 shadow-3xl border-b-emerald-500 border-b-2 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                   <Navigation2 className="w-24 h-24 text-orange-600 rotate-45" />
                </div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                   <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-6">Driver Approaching</p>
                   <div className="text-5xl font-black italic mb-2 tracking-tighter">4 Mins</div>
                   <p className="text-neutral-400 font-bold text-sm">{activeRide.driverName || 'Dereva'} arrives shortly</p>

                   <div className="w-full h-px bg-neutral-800 my-8" />

                   <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-16 rounded-[1.5rem] bg-orange-600/10 p-1 border-2 border-orange-600/30 overflow-hidden relative">
                            <img src={activeRide.driverPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.driverName}`} alt="Driver" className="w-full h-full object-cover rounded-xl" />
                         </div>
                         <div className="text-left">
                            <h4 className="text-lg font-black uppercase italic tracking-tighter">{activeRide.driverName || 'Dereva'}</h4>
                            <div className="flex items-center gap-1 text-orange-500">
                               <Star className="w-4 h-4 fill-current" />
                               <span className="text-sm font-black">4.9</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-white border border-white/5 hover:bg-neutral-700 transition-all">
                            <Phone className="w-5 h-5" />
                         </button>
                         <button className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-white border border-white/5 hover:bg-neutral-700 transition-all">
                            <MessageSquare className="w-5 h-5" />
                         </button>
                      </div>
                   </div>

                   <div className="w-full bg-neutral-800/40 rounded-3xl p-5 mt-6 border border-white/5 flex items-center gap-5 group/car">
                      <div className="w-20 h-14 bg-black/30 rounded-2xl flex items-center justify-center p-1 overflow-hidden">
                         <img src={selectedRide?.image} alt="Vehicle" className="w-full h-full object-contain mix-blend-lighten group-hover/car:scale-110 transition-transform" />
                      </div>
                      <div className="text-left">
                         <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-1">Vehicle Details</p>
                         <h4 className="text-sm font-black">{activeRide.vehicleNumber || 'T 123 ABC'}</h4>
                      </div>
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest ml-4">Current Route Details</p>
                <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-6">
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                         <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                      </div>
                      <div>
                         <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">Pickup</p>
                         <p className="text-xs font-bold leading-tight">{pickup}</p>
                      </div>
                   </div>
                </div>
             </div>

             <button 
                onClick={() => setStep('on_trip')}
                className="w-full bg-emerald-500 py-5 rounded-[2.5rem] font-black uppercase tracking-tighter text-white shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all text-xl italic"
             >
                Arrived at Pickup
             </button>
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
                <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-dashed border-emerald-500/30 text-emerald-500 shadow-3xl shadow-emerald-950/20">
                   <ShieldCheck className="w-12 h-12" />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Safari Imekamilika</h2>
                <p className="text-neutral-400 font-bold max-w-[250px] mx-auto text-sm">Asante kwa kusafiri nasi leo! Tumekufikisha salama.</p>
             </div>

             <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-6">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-orange-600/30">
                         <img src={activeRide.driverPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.driverName}`} alt="Driver" />
                      </div>
                      <div className="text-left">
                         <h4 className="text-lg font-black uppercase italic tracking-tighter">{activeRide.driverName}</h4>
                         <p className="text-[10px] text-neutral-500 font-bold uppercase">{activeRide.vehicleNumber}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-500 uppercase">Paid Via {activeRide.paymentMethod || 'Cash'}</p>
                      <p className="text-2xl font-black italic mt-1 tracking-tighter">TZS {activeRide.estimatedFare.toLocaleString()}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-center text-[10px] font-black uppercase text-neutral-500 tracking-wider">Tafadhali kadiria safari yako:</p>
                   <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                         <button 
                          key={star} 
                          onClick={() => handleRate(star)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                            userRating >= star ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-orange-600 hover:bg-neutral-700'
                          }`}
                        >
                            <Star className={`w-6 h-6 ${userRating >= star ? 'fill-current' : ''}`} />
                         </button>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-3 pt-6">
                   {[200, 500, 1000, 2000].map((tip) => (
                      <button key={tip} className="flex flex-col items-center gap-2 p-3 bg-neutral-800 rounded-2xl border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 group transition-all">
                         <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <DollarSign className="w-5 h-5" />
                         </div>
                         <span className="text-[10px] font-black italic">TZS {tip}</span>
                      </button>
                   ))}
                </div>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => setStep('receipt')}
                  className="flex-1 border border-neutral-800 py-5 rounded-[2.5rem] font-black uppercase tracking-tighter text-sm italic hover:bg-white/5"
                >
                  View Receipt
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="flex-1 bg-emerald-500 py-5 rounded-[2.5rem] font-black uppercase tracking-tighter text-sm italic text-white shadow-2xl shadow-emerald-500/20"
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
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Payment and Receipt</h2>
                <Badge className="bg-emerald-500/20 text-emerald-500 border-none px-6 py-2 rounded-xl font-black tracking-widest text-[10px]">MALIPO IMETHIBITISHWA</Badge>
             </div>

             {/* Stylized Receipt */}
             <div className="w-full max-w-[320px] bg-white rounded-t-3xl relative p-10 text-neutral-900 shadow-2xl group">
                {/* Receipt Zigzag Bottom */}
                <div className="absolute bottom-[-10px] left-0 right-0 h-[20px] bg-[radial-gradient(circle_at_10px_-4px,white_10px,transparent_11px)] bg-[length:20px_20px]" />
                
                <div className="space-y-6">
                   <div className="text-center pb-6 border-b border-dashed border-neutral-300">
                      <div className="w-16 h-16 bg-neutral-100 rounded-2xl mx-auto flex items-center justify-center text-neutral-800 mb-4 font-black text-2xl tracking-tighter italic">TX</div>
                      <h3 className="font-black italic uppercase text-xl">Maelezo ya Malipo:</h3>
                   </div>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-neutral-500">Harakati ya Safari:</span>
                         <span className="font-black italic">USD {selectedRide?.price || '286.00'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-neutral-500">Tip Dereva:</span>
                         <span className="font-black italic">USD 5.00</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-neutral-500">Ada ya Platform:</span>
                         <span className="font-black italic">USD 1.20</span>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-dashed border-neutral-300 flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest leading-none mb-1">Jumla ya Malipo:</p>
                         <p className="text-3xl font-black italic tracking-tighter">USD {(selectedRide?.price || 0) + 6.20}</p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                         <CheckCircle2 className="w-7 h-7" />
                      </div>
                   </div>

                   <div className="pt-6">
                      <div className="flex items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                         <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Wallet className="w-5 h-5" />
                         </div>
                         <div className="text-left overflow-hidden">
                            <p className="text-xs font-black uppercase tracking-tight truncate">Malipo kwa M-Pesa</p>
                            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest truncate">Transaction ID: 0823347081</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="pt-12 w-full flex flex-col gap-4">
                <button 
                  onClick={() => navigate('/')}
                  className="w-full bg-emerald-500 py-6 rounded-[2.5rem] font-black uppercase tracking-tighter text-lg italic text-white shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Navigation2 className="w-5 h-5" />
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
