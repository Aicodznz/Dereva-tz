import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, Search, Navigation2, Clock, Star, 
  CreditCard, ChevronRight, X, Phone, MessageSquare, 
  Car, Bike, Activity, ShieldCheck, HelpCircle, User,
  CheckCircle2, DollarSign, Wallet
} from 'lucide-react';
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
  const [step, setStep] = useState<BookingStep>('home');
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState('Current Location (D Block, Sector 2)');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('mpesa');
  
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  
  const rideOptions: RideOption[] = [
    { 
      id: 'mini', 
      name: 'TegeX Mini', 
      icon: Car, 
      sub: 'City-whetted city car', 
      priceRange: '2,000 - 3,000', 
      price: 2800, 
      eta: '4',
      vehicleType: 'gari',
      image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=400&q=80' 
    },
    { 
      id: 'bajaji', 
      name: 'TegeX Bajaj', 
      icon: Activity, 
      sub: 'Tuk-Tuk transit 🛺', 
      priceRange: '1,000 - 2,000', 
      price: 1500, 
      eta: '5',
      vehicleType: 'bajaji',
      image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=400&q=80' 
    },
    { 
      id: 'bike', 
      name: 'TegeX Bike', 
      icon: Bike, 
      sub: 'Fast city transit', 
      priceRange: '500 - 1,000', 
      price: 800, 
      eta: '3',
      vehicleType: 'pikipiki',
      image: 'https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&w=400&q=80' 
    }
  ];

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
        pickup: { lat: -6.7924, lng: 39.2083 },
        destination: { lat: -6.8235, lng: 39.2695 },
        pickupAddress: pickup,
        destinationAddress: destination,
        distance: 5.2,
        duration: 15,
        estimatedFare: selectedRide.price,
        vehicleType: selectedRide.vehicleType
      });
      setRideId(docRef.id);
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Failed to request ride");
      setStep('map');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-neutral-950 min-h-screen relative overflow-hidden font-sans text-white">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-orange-600 p-0.5 overflow-hidden">
             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="User" className="w-full h-full object-cover rounded-full" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Karibu, {profile?.displayName || 'Mteja'}</p>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">Wapi leo?</h1>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-neutral-800 hover:bg-neutral-800 transition-colors">
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
            {/* Search Input */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center text-orange-600">
                <MapPin className="w-5 h-5" />
              </div>
              <input 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Unataka kwenda wapi?" 
                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-orange-600 transition-all font-bold placeholder:text-neutral-600"
              />
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
            className="absolute inset-0 z-20 flex flex-col pt-12"
          >
            <div className="px-6 flex items-center justify-between mb-4">
              <button onClick={() => setStep('home')} className="w-10 h-10 rounded-xl bg-neutral-900/80 backdrop-blur-md flex items-center justify-center border border-neutral-800">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-black uppercase italic">Map and Trip Options</h2>
              <div className="w-10" />
            </div>

            {/* Mock Map Area */}
            <div className="flex-1 bg-neutral-900 overflow-hidden relative">
               <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80" alt="Map" className="w-full h-full object-cover opacity-60 grayscale brightness-50" />
               <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/40 via-transparent to-neutral-950/80 pointer-events-none" />
               
               {/* Route Line Marker (Stylized) */}
               <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <path d="M 100 600 Q 150 400 300 300 T 350 100" fill="transparent" stroke="#059669" strokeWidth="6" strokeLinecap="round" strokeDasharray="12 8" />
                  <circle cx="100" cy="600" r="8" fill="#059669" />
                  <circle cx="350" cy="100" r="8" fill="#ef4444" />
               </svg>

               <div className="absolute bottom-8 left-0 right-0 px-6 space-y-4">
                  {/* Address Display */}
                  <div className="bg-neutral-900/90 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 shadow-3xl">
                     <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1">
                           <div className="w-3 h-3 rounded-full bg-emerald-500" />
                           <div className="w-0.5 h-10 border-l border-dashed border-neutral-700" />
                           <div className="w-3 h-3 rounded-full bg-red-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                           <div>
                              <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Pickup</p>
                              <p className="text-xs font-bold truncate">{pickup}</p>
                           </div>
                           <div>
                              <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Destination</p>
                              <p className="text-xs font-bold truncate">{destination}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Ride Options Scroller */}
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                     {rideOptions.map((ride) => (
                        <button 
                           key={ride.id}
                           onClick={() => setSelectedRide(ride)}
                           className={`min-w-[200px] flex items-center justify-between p-4 rounded-3xl border transition-all ${
                              selectedRide?.id === ride.id ? 'bg-orange-600 border-orange-500 shadow-xl shadow-orange-600/30' : 'bg-neutral-800/80 backdrop-blur-md border-neutral-700'
                           }`}
                        >
                           <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-black/20 rounded-2xl flex items-center justify-center p-1">
                                 <img src={ride.image} alt={ride.name} className="w-full h-full object-contain mix-blend-lighten" />
                              </div>
                              <div className="text-left">
                                 <h4 className="text-[12px] font-black uppercase mb-0.5 leading-none">{ride.name}</h4>
                                 <p className="text-[9px] font-bold opacity-60 italic whitespace-nowrap">{ride.eta} mins ({ride.id === 'bike' ? '2.5' : '3.2'} km)</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[12px] font-black italic">USD {ride.price}</p>
                           </div>
                        </button>
                     ))}
                  </div>

                  <button 
                     onClick={confirmBooking}
                     className="w-full bg-emerald-500 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-emerald-400 shadow-2xl shadow-emerald-900/40 text-sm"
                  >
                     Hifadhi Sasa
                  </button>
               </div>
            </div>
          </motion.div>
        )}

        {step === 'searching' && (
          <motion.div 
            key="searching"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 bg-neutral-950/90 backdrop-blur-sm"
          >
             <div className="relative w-64 h-64 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-[6px] border-orange-600 border-t-transparent rounded-full shadow-2xl shadow-orange-600/20"
                />
                <div className="absolute inset-4 rounded-full bg-neutral-900 flex items-center justify-center p-8 shadow-inner">
                   <img src={selectedRide?.image} alt="Ride" className="w-full h-full object-contain animate-pulse mix-blend-lighten" />
                </div>
                <motion.div 
                   animate={{ scale: [1, 1.2, 1] }}
                   transition={{ duration: 1.5, repeat: Infinity }}
                   className="absolute top-0 right-0 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shadow-lg"
                >
                   <MapPin className="w-4 h-4 text-white" />
                </motion.div>
             </div>
             <div className="text-center space-y-2">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter animate-pulse">Kutafuta Dereva wa Karibu...</h2>
                <p className="text-neutral-500 font-bold max-w-[250px] mx-auto text-sm">Tunatafuta dereva bora wa {selectedRide?.name} kwa ajili yako.</p>
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

        {step === 'arriving' && (
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
                   <p className="text-neutral-400 font-bold text-sm">Moses arrives shortly</p>

                   <div className="w-full h-px bg-neutral-800 my-8" />

                   <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-16 rounded-[1.5rem] bg-orange-600/10 p-1 border-2 border-orange-600/30 overflow-hidden relative">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Moses" alt="Driver" className="w-full h-full object-cover rounded-xl" />
                         </div>
                         <div className="text-left">
                            <h4 className="text-lg font-black uppercase italic tracking-tighter">Moses</h4>
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
                         <h4 className="text-sm font-black">Silver Sedan, T 123 ABC</h4>
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

        {step === 'completed' && (
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
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Moses" alt="Driver" />
                      </div>
                      <div className="text-left">
                         <h4 className="text-lg font-black uppercase italic tracking-tighter">Moses</h4>
                         <p className="text-[10px] text-neutral-500 font-bold uppercase">Silver Sedan, T 123 ABC</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-500 uppercase">Paid Via M-Pesa</p>
                      <p className="text-2xl font-black italic mt-1 tracking-tighter">USD {selectedRide?.price}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-center text-[10px] font-black uppercase text-neutral-500 tracking-wider">Tafadhali kadiria safari yako:</p>
                   <div className="flex justify-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                         <button key={star} className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all shadow-lg">
                            <Star className="w-6 h-6 fill-current" />
                         </button>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-3 pt-6">
                   {[2, 5, 10, 20].map((tip) => (
                      <button key={tip} className="flex flex-col items-center gap-2 p-3 bg-neutral-800 rounded-2xl border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 group transition-all">
                         <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <DollarSign className="w-5 h-5" />
                         </div>
                         <span className="text-[10px] font-black italic">USD {tip}</span>
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
