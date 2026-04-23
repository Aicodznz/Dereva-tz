import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Bell, User, Shield, Power, Navigation, Fuel, Zap, 
  ParkingCircle, Car, Settings, Phone, CarFront, Gauge, Eye, EyeOff,
  Navigation2, CheckCircle, MessageSquare, X, ChevronRight, MapPin, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../AuthContext';
import { taxiService, RideRequest } from '../../services/taxiService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Fix leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function RiderHome() {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showSafetySheet, setShowSafetySheet] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  
  const [incomingRequest, setIncomingRequest] = useState<RideRequest | null>(null);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  }, []);

  // Listen for requests when online
  useEffect(() => {
    if (!isOnline || !profile?.vehicleType || activeRide) {
      setIncomingRequest(null);
      return;
    }
    
    const vType = profile.vehicleType.toLowerCase() as any;
    const typeMap: Record<string, string> = {
      'motorcycle': 'pikipiki',
      'bajaj': 'bajaji',
      'car': 'gari'
    };
    
    const unsubscribe = taxiService.listenForRequests(typeMap[vType] || 'gari', (requests) => {
      if (requests.length > 0 && !activeRide) {
        setIncomingRequest(requests[0]);
      } else {
        setIncomingRequest(null);
      }
    });
    
    return () => unsubscribe();
  }, [isOnline, profile?.vehicleType, activeRide]);

  // Listen to active ride updates
  useEffect(() => {
    if (!activeRide?.id) return;
    const unsubscribe = taxiService.listenToRide(activeRide.id, (ride) => {
      setActiveRide(ride);
      if (activeRide?.id && (ride.status === 'completed' || ride.status === 'cancelled')) {
         setActiveRide(null);
      }
    });
    return () => unsubscribe();
  }, [activeRide?.id]);

  const toggleStatus = () => setIsOnline(!isOnline);

  const handleAccept = async () => {
    if (!incomingRequest?.id || !user) return;
    try {
      await taxiService.acceptRide(incomingRequest.id, user.uid);
      setActiveRide(incomingRequest);
      setIncomingRequest(null);
      toast.success("Safari Imekubaliwa!");
    } catch (error) {
      toast.error("Safari haipatikani tena");
      setIncomingRequest(null);
    }
  };

  const handleUpdateStatus = async (status: RideRequest['status']) => {
    if (!activeRide?.id) return;
    try {
      await taxiService.updateRideStatus(activeRide.id, status);
      toast.success(`Hali: ${status}`);
    } catch (error) {
      toast.error("Imeshindwa kusasisha");
    }
  };

  const MapControl = () => {
    const map = useMap();
    useEffect(() => {
      map.setView(position, 15);
    }, [position]);
    return null;
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-100">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker position={position}>
            <Popup>Uko Hapa</Popup>
          </Marker>
          <MapControl />
        </MapContainer>
      </div>

      {/* Top Bar Overlays */}
      <div className="absolute top-4 inset-x-4 z-40 flex justify-between items-start">
        <div className="flex flex-col gap-2">
           <div className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
            <img 
              src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-xl" 
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <motion.button
            onClick={() => setShowEarnings(!showEarnings)}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-full shadow-xl flex items-center gap-2 font-bold"
          >
            {showEarnings ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{showEarnings ? 'TZS 45,200' : 'TZS **.**'}</span>
          </motion.button>
          
          {isOnline && (
            <div className="bg-neutral-900/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold border border-white/10">
              00:00 hrs Online
            </div>
          )}
        </div>

        <div className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
          <Bell className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
        </div>
      </div>

      {/* Side Controls (Only if not in active ride) */}
      {!activeRide && (
        <div className="absolute top-36 left-4 z-40 flex flex-col gap-3">
          {[
            { icon: Settings, color: "text-neutral-600" },
            { icon: Car, color: "text-blue-500" },
            { icon: Fuel, color: "text-orange-500" },
            { icon: ParkingCircle, color: "text-red-500" },
            { icon: Zap, color: "text-emerald-500" },
            { icon: Gauge, color: "text-neutral-900", label: "0 km/h" }
          ].map((item, id) => (
            <motion.div
              key={id}
              whileHover={{ scale: 1.05 }}
              className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-full shadow-md flex flex-col items-center justify-center border border-neutral-100 dark:border-neutral-800"
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              {item.label && <span className="text-[7px] font-black">{item.label}</span>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Main Action Button (Online/Offline) */}
      {!activeRide && !incomingRequest && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40">
          <motion.button
            onClick={toggleStatus}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-28 h-28 rounded-full border-8 border-white dark:border-neutral-800 shadow-2xl flex items-center justify-center relative ${
              isOnline ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          >
            {isOnline && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 rounded-full bg-emerald-400/30"
              />
            )}
            <div className="bg-white dark:bg-neutral-900 w-16 h-16 rounded-full flex items-center justify-center shadow-inner z-10">
              <Power className={`w-8 h-8 ${isOnline ? 'text-emerald-600' : 'text-red-600'}`} />
            </div>
          </motion.button>
        </div>
      )}

      {/* Incoming Request Modal */}
      <AnimatePresence>
        {incomingRequest && (
          <motion.div 
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            className="absolute inset-x-4 bottom-10 z-50 bg-neutral-900 rounded-[3rem] p-8 text-white shadow-3xl border border-white/10"
          >
             <div className="flex justify-between items-start mb-6">
                <div>
                   <Badge className="bg-orange-600 text-white font-black px-4 py-1 mb-2">NEW REQUEST</Badge>
                   <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">TZS {incomingRequest.estimatedFare}</h2>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black uppercase text-neutral-400">Time to pickup</p>
                   <p className="text-xl font-black italic">5 Mins</p>
                </div>
             </div>

             <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                   <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
                   <div>
                      <p className="text-[8px] font-black uppercase text-neutral-400">Pickup</p>
                      <p className="text-sm font-bold line-clamp-1">{incomingRequest.pickupAddress}</p>
                   </div>
                </div>
                <div className="flex items-start gap-4">
                   <Navigation2 className="w-5 h-5 text-orange-500 shrink-0" />
                   <div>
                      <p className="text-[8px] font-black uppercase text-neutral-400">Destination</p>
                      <p className="text-sm font-bold line-clamp-1">{incomingRequest.destinationAddress}</p>
                   </div>
                </div>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => setIncomingRequest(null)}
                  className="flex-1 h-16 rounded-2xl border border-neutral-700 font-black uppercase tracking-widest text-neutral-500"
                >
                  Reject
                </button>
                <button 
                  onClick={handleAccept}
                  className="flex-1 h-16 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20"
                >
                  Accept
                </button>
             </div>
             
             {/* Progress Bar (Timer Simulation) */}
             <div className="mt-6 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 15, ease: "linear" }}
                  onAnimationComplete={() => setIncomingRequest(null)}
                  className="h-full bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.5)]"
                />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Ride Controls */}
      <AnimatePresence>
        {activeRide && (
          <motion.div 
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute inset-x-4 bottom-10 z-50 bg-white dark:bg-neutral-900 rounded-[3rem] p-8 shadow-3xl border border-neutral-100 dark:border-neutral-800"
          >
             <div className="flex items-center justify-between mb-8 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500/20">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.customerId}`} alt="Customer" />
                   </div>
                   <div>
                      <h4 className="font-black italic uppercase tracking-tighter text-lg">Mteja Mapata</h4>
                      <div className="flex items-center gap-1 text-orange-500 font-bold text-xs">
                         <Star className="w-3 h-3 fill-current" />
                         <span>4.9</span>
                      </div>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-neutral-600"><Phone className="w-5 h-5" /></button>
                   <button className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-emerald-600"><MessageSquare className="w-5 h-5" /></button>
                </div>
             </div>

             <div className="space-y-6 mb-10">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-emerald-500">
                      <Navigation className="w-6 h-6" />
                   </div>
                   <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-neutral-400">Current Task</p>
                      <h4 className="text-sm font-black italic uppercase tracking-tighter">
                         {activeRide.status === 'accepted' && 'Pick up passenger'}
                         {activeRide.status === 'arrived' && 'Customer Boarding'}
                         {activeRide.status === 'started' && 'On the way to destination'}
                      </h4>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {activeRide.status === 'accepted' ? activeRide.pickupAddress : activeRide.destinationAddress}
                      </p>
                   </div>
                </div>
             </div>

             <div className="space-y-3">
                {activeRide.status === 'accepted' && (
                  <Button 
                    onClick={() => handleUpdateStatus('arrived')}
                    className="w-full h-16 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest italic"
                  >
                    I have Arrived
                  </Button>
                )}
                {activeRide.status === 'arrived' && (
                  <Button 
                    onClick={() => handleUpdateStatus('started')}
                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black uppercase tracking-widest italic"
                  >
                    Start Trip
                  </Button>
                )}
                {activeRide.status === 'started' && (
                  <Button 
                    onClick={() => handleUpdateStatus('completed')}
                    className="w-full h-16 bg-red-600 hover:bg-red-500 rounded-2xl font-black uppercase tracking-widest italic"
                  >
                    End Trip
                  </Button>
                )}
                
                <button 
                  onClick={() => setShowSafetySheet(true)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-red-500 transition-colors"
                >
                  Emergency SOS
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-30">
          <AnimatePresence>
            {!isOnline && !activeRide && (
              <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="bg-red-600/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl text-center border border-white/10"
              >
                  <p className="font-black italic uppercase text-xs tracking-widest">You are currently OFFLINE</p>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
