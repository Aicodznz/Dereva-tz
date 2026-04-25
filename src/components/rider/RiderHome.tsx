import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Bell, Power, Navigation, Fuel, Zap, 
  ParkingCircle, Car, Settings, Phone, Gauge, Eye, EyeOff,
  Navigation2, MessageSquare, MapPin, Star, X as CloseX
} from 'lucide-react';
import Chat from '../Chat';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useNearbyRides } from '../../hooks/useNearbyRides';
import { useDriverActions } from '../../hooks/useDriverActions';
import { useRideStatus } from '../../hooks/useRideStatus';
import { useDriverRideListener } from '../../hooks/useDriverRideListener';
import { RideStatus, DriverInfo } from '../../types/ride.types';
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide } = useRideStatus(rideId);
  const vTypeRaw = (profile?.vehicleType || 'gari').toLowerCase();
  const vType = vTypeRaw.includes('bike') ? 'bike' : vTypeRaw.includes('bajaj') ? 'bajaj' : 'mini';
  
  const { rides: nearbyRides } = useNearbyRides(vType as any);
  const { assignedRide } = useDriverRideListener(user?.uid, isOnline);
  const { acceptRide: firestoreAccept, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation } = useDriverActions(rideId);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [speed, setSpeed] = useState(0);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  }, []);

  // Update speed simulation
  useEffect(() => {
    let interval: any;
    if (isOnline && activeRide) {
      interval = setInterval(() => {
        setSpeed(Math.floor(Math.random() * 20) + 40);
      }, 3000);
    } else if (isOnline) {
      interval = setInterval(() => {
        setSpeed(Math.floor(Math.random() * 5));
      }, 5000);
    } else {
      setSpeed(0);
    }
    return () => clearInterval(interval);
  }, [isOnline, !!activeRide]);

  // Listen for requests or assigned rides when online
  useEffect(() => {
    if (!isOnline) {
      setIncomingRequest(null);
      setRideId(null);
      return;
    }
    
    // If we have an assigned ride (that we are already on or just got)
    if (assignedRide) {
      setRideId(assignedRide.id);
      setIncomingRequest(null);
      return;
    }

    // If no active ride yet, check for nearby pending ones
    if (nearbyRides.length > 0 && !activeRide) {
      setIncomingRequest(nearbyRides[0]);
    } else {
      setIncomingRequest(null);
    }
  }, [isOnline, nearbyRides, assignedRide, !!activeRide]);

  // Restore online status from Firestore on mount
  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, 'drivers', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setIsOnline(!!data.isOnline);
        }
      }).catch(err => console.error("Error restoring driver status:", err));
    }
  }, [user?.uid]);

  const toggleStatus = async () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    
    if (user?.uid) {
      try {
        console.log(`Setting driver ${user.uid} to ${nextStatus ? 'ONLINE' : 'OFFLINE'}`);
        await setDoc(doc(db, 'drivers', user.uid), {
          status: nextStatus ? 'online' : 'offline',
          isOnline: nextStatus,
          receiving: nextStatus,
          lastActive: serverTimestamp(),
          vehicleType: vType,
          name: profile?.displayName || 'Dereva',
          phone: profile?.phoneNumber || '',
          photo: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
          vehicle: {
            model: profile?.vehicleModel || 'N/A',
            plate: profile?.licensePlate || 'T 123 ABC',
            brand: profile?.vehicleBrand || ''
          },
          location: {
            lat: position[0],
            lng: position[1]
          }
        }, { merge: true });
        
        toast.success(nextStatus ? 'Uko Online & Mapokezi' : 'Uko Offline');
      } catch (err) {
        console.error("Failed to sync driver status:", err);
        setIsOnline(!nextStatus); // Revert on failure
      }
    }
  };

  // Update driver location periodically when online
  useEffect(() => {
    if (!isOnline || !user) return;

    const updateLoc = async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition([loc.lat, loc.lng]);
          
          // Update active ride tracking if exists
          if (activeRide) {
            updateDriverLocation(loc.lat, loc.lng);
          }

          // ALWAYS update the public "drivers" collection if online
          // so passengers can see the driver on their map
          try {
            await setDoc(doc(db, 'drivers', user.uid), {
              location: { lat: loc.lat, lng: loc.lng },
              isOnline: true,
              receiving: true,
              status: 'online',
              lastActive: new Date(),
              vehicleType: vType // Keep vehicle type synced
            }, { merge: true });
          } catch (err) {
            console.error("Failed to update public driver location:", err);
          }
        }, (err) => {
          console.error("Geolocation error:", err);
        }, { enableHighAccuracy: true });
      }
    };

    updateLoc(); // Initial update
    const interval = setInterval(updateLoc, 3000); // Every 3 seconds

    return () => clearInterval(interval);
  }, [isOnline, user, activeRide?.id]);

  const handleAccept = async () => {
    if (!incomingRequest?.id || !user) return;
    try {
      const driverInfo: DriverInfo = {
        name: profile?.displayName || 'Dereva',
        initials: (profile?.displayName || 'D').split(' ').map(n => n[0]).join(''),
        plate: profile?.licensePlate || 'T 123 ABC',
        rating: 4.8,
        phone: profile?.phoneNumber || '0700000000',
        photo: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`
      };
      
      setRideId(incomingRequest.id);
      await firestoreAccept(user.uid, driverInfo);
      setIncomingRequest(null);
      toast.success("Safari Imekubaliwa!");
    } catch (error: any) {
      console.error("[Rider] Failed to accept ride:", error);
      toast.error("Safari haipatikani tena");
      setIncomingRequest(null);
      setRideId(null);
    }
  };

  const handleUpdateStatus = async (status: RideStatus) => {
    if (!activeRide?.id) return;
    try {
      if (status === 'driver_arrived') {
        await arrivedAtPickup();
      } else if (status === 'on_trip') {
        await startTrip();
      } else if (status === 'completed') {
        const customerId = activeRide.customerId;
        const driverId = user!.uid;
        const fare = activeRide.fare;
        await completeTrip(customerId, driverId, fare);
        setRideId(null);
      }
      toast.success(`Hali imesasishwa`);
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
      <div className="absolute inset-0 z-0 bg-neutral-200">
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: '100%', width: '100%', minHeight: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker 
            position={position}
            icon={L.divIcon({
              className: 'rider-marker',
              html: `<div class="relative items-center justify-center flex">
                      ${isOnline ? '<div class="absolute w-12 h-12 bg-emerald-500/30 rounded-full animate-ping"></div>' : ''}
                      <div class="w-10 h-10 ${isOnline ? 'bg-emerald-600' : 'bg-neutral-500'} rounded-2xl border-4 border-white shadow-2xl flex items-center justify-center transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.5C2.1 10.4 2 10.7 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                      </div>
                    </div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 40]
            })}
          >
            <Popup>{isOnline ? 'Active & Receiving' : 'Offline'}</Popup>
          </Marker>
          {activeRide && (
            <>
               <Marker position={[activeRide.pickup.lat, activeRide.pickup.lng]}>
                 <Popup>Mteja Yupo Hapa (Pickup)</Popup>
               </Marker>
               <Marker position={[activeRide.destination.lat, activeRide.destination.lng]}>
                 <Popup>Kuelekea (Destination)</Popup>
               </Marker>
            </>
          )}
          <MapControl />
        </MapContainer>
      </div>

      {/* Top Bar Overlays */}
      <div className="absolute top-4 inset-x-4 z-40 flex justify-between items-start">
        <div className="flex flex-col gap-2">
           <button 
             onClick={() => toast.info(`Habari ${profile?.displayName || 'Dereva'}, wasifu wako unakuja hivi karibuni`)}
             className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-800 active:scale-95 transition-transform"
           >
            <img 
              src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-xl" 
            />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          {isOnline ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-emerald-600/20 text-emerald-500 px-4 py-2 rounded-full border border-emerald-500/30 flex items-center gap-2 shadow-lg backdrop-blur-sm"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Active & Receiving</span>
            </motion.div>
          ) : (
             <div className="bg-neutral-800 text-neutral-400 px-4 py-2 rounded-full border border-white/5 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Offline</span>
             </div>
          )}
          
          <motion.button
            onClick={() => setShowEarnings(!showEarnings)}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-full shadow-xl flex items-center gap-2 font-bold"
          >
            {showEarnings ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{showEarnings ? 'TZS 45,200' : 'TZS **.**'}</span>
          </motion.button>
          
        </div>

        <button 
          onClick={() => toast.info("Huna taarifa mpya kwa sasa")}
          className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-800 active:scale-95 transition-transform"
        >
          <Bell className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* Side Controls */}
      {!activeRide && (
        <div className="absolute top-36 left-4 z-40 flex flex-col gap-4">
          {[
            { icon: Settings, color: "text-neutral-500" },
            { icon: Car, color: "text-blue-500" },
            { icon: Fuel, color: "text-orange-500" },
            { icon: ParkingCircle, color: "text-red-500" },
            { icon: Zap, color: "text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" },
            { icon: Gauge, color: "text-neutral-900", label: `${speed} km/h` }
          ].map((item, id) => (
            <motion.button
              key={id}
              onClick={() => toast.info("Kipengele hiki kinakuja hivi karibuni")}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-14 h-14 bg-white/90 backdrop-blur-xl rounded-[1.2rem] shadow-2xl flex flex-col items-center justify-center border border-white/50 transition-all relative group"
            >
              <item.icon className={`w-6 h-6 ${item.color}`} />
              {item.label && <span className="text-[8px] font-black text-neutral-400 mt-0.5">{item.label}</span>}
            </motion.button>
          ))}
        </div>
      )}

      {/* Main Action Button (Online/Offline) */}
      {!activeRide && !incomingRequest && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-6">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`px-8 py-3 rounded-2xl backdrop-blur-3xl border-2 flex items-center gap-3 shadow-2xl transition-all ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                : 'bg-red-500/10 text-red-600 border-red-500/20'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-black uppercase tracking-[0.2em]">
              {isOnline ? 'Active & Receiving' : 'System Offline'}
            </span>
          </motion.div>

          <motion.button
            onClick={toggleStatus}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`w-28 h-28 rounded-[2.5rem] border-8 border-white shadow-[0_30px_70px_rgba(0,0,0,0.4)] flex items-center justify-center transition-colors ${
              isOnline ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          >
            <div className="bg-white/10 backdrop-blur-xl w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg border border-white/20 z-10">
              <Power className="w-8 h-8 text-white shadow-sm" />
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
                <div className="flex gap-4">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-orange-600/30">
                      <img src={incomingRequest.customerPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingRequest.customerId}`} alt="Customer" />
                   </div>
                   <div>
                      <div className="bg-orange-600 text-white font-black px-4 py-1 mb-1 italic text-[10px] rounded-full inline-block">NEW REQUEST</div>
                      <h4 className="text-xl font-black italic uppercase tracking-tighter">{incomingRequest.customerName || 'Mteja'}</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                          <p className="text-[9px] font-bold text-neutral-300 uppercase tracking-tight truncate">{incomingRequest.pickup.address}</p>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
                          <p className="text-[9px] font-bold text-neutral-300 uppercase tracking-tight truncate">{incomingRequest.destination.address}</p>
                        </div>
                      </div>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black uppercase text-neutral-400">Gharama</p>
                   <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-emerald-500">TZS {incomingRequest.fare}</h2>
                </div>
             </div>

             <div className="flex gap-4">
                  <button 
                    onClick={() => setIncomingRequest(null)}
                    className="flex-1 h-16 rounded-2xl border border-white/10 bg-white/5 font-black text-neutral-400"
                  >
                    Kataa
                  </button>
                  <button 
                    onClick={handleAccept}
                    className="flex-1 h-16 rounded-2xl bg-emerald-500 text-white font-black uppercase"
                  >
                    Kubali
                  </button>
             </div>

             <div className="mt-6 h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 15, ease: "linear" }}
                  onAnimationComplete={() => setIncomingRequest(null)}
                  className="h-full bg-orange-600"
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
                      <h4 className="font-black italic uppercase tracking-tighter text-lg">Mteja: {activeRide.customerId.slice(0,5)}</h4>
                      <div className="flex items-center gap-1 text-orange-500 font-bold text-xs">
                         <Star className="w-3 h-3 fill-current" />
                         <span>4.9</span>
                      </div>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center"><Phone className="w-5 h-5 text-neutral-600" /></button>
                   <button 
                     onClick={() => setIsChatOpen(true)}
                     className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-neutral-800 flex items-center justify-center"
                   >
                     <MessageSquare className="w-5 h-5 text-emerald-600" />
                   </button>
                </div>
             </div>

             <div className="space-y-6 mb-10">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-emerald-500 text-sm">
                      <Navigation className="w-6 h-6" />
                   </div>
                   <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-neutral-400">Marudio ya Safari</p>
                      <h4 className="text-sm font-black uppercase text-emerald-600">
                         {activeRide.status === 'driver_arriving' && 'Unaelekea kuchukua abiria'}
                         {activeRide.status === 'driver_arrived' && 'Umewasili kwa abiria'}
                         {activeRide.status === 'on_trip' && 'Safari inaendelea...'}
                      </h4>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 leading-tight">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                          {activeRide.pickup.address}
                        </p>
                        <p className="text-[10px] text-orange-500 font-bold flex items-center gap-1 leading-tight">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
                          {activeRide.destination.address}
                        </p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="space-y-3">
                {activeRide.status === 'driver_arriving' && (
                  <Button 
                    onClick={() => handleUpdateStatus('driver_arrived')}
                    className="w-full h-16 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest italic"
                  >
                    Nimefika (Arrived)
                  </Button>
                )}
                {activeRide.status === 'driver_arrived' && (
                  <Button 
                    onClick={() => handleUpdateStatus('on_trip')}
                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black uppercase tracking-widest italic shadow-[0_10px_30px_rgba(16,185,129,0.3)]"
                  >
                    Anzisha Safari (Start Trip)
                  </Button>
                )}
                {activeRide.status === 'on_trip' && (
                  <Button 
                    onClick={() => handleUpdateStatus('completed')}
                    className="w-full h-16 bg-red-600 hover:bg-red-500 rounded-2xl font-black uppercase italic"
                  >
                    Maliza Safari (End Trip)
                  </Button>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
