import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Bell, Power, Navigation, Fuel, Zap, 
  ParkingCircle, Car, Settings, Phone, Gauge, Eye, EyeOff,
  Navigation2, MessageSquare, MapPin, Star, X as CloseX,
  Clock, TrendingUp, Info, Wifi, Battery, Map as MapIcon,
  CheckCircle2, ArrowRight, RefreshCw, DollarSign
} from 'lucide-react';
import Chat from '../Chat';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useDriverActions } from '../../hooks/useDriverActions';
import { useRideStatus } from '../../hooks/useRideStatus';
import { useDriverRideListener } from '../../hooks/useDriverRideListener';
import { useIncomingRequests } from '../../hooks/useIncomingRequests';
import { useDriverDashboard } from '../../hooks/useDriverDashboard';
import { createDriverMarkerIcon } from '../../utils/driverMarker';
import { calculateBearing, getMapBounds } from '../../utils/mapHelpers';
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  const [lastPosition, setLastPosition] = useState<[number, number] | null>(null);
  const [rotation, setRotation] = useState(0);
  
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide } = useRideStatus(rideId);
  const vTypeRaw = (profile?.vehicleType || 'gari').toLowerCase();
  const vType = vTypeRaw.includes('bike') ? 'bike' : vTypeRaw.includes('bajaj') ? 'bajaj' : 'mini';
  
  const { showEarnings, toggleEarnings, stats } = useDriverDashboard();
  const nearbyRequests = useIncomingRequests(vType, isOnline);
  const { assignedRide } = useDriverRideListener(user?.uid, isOnline);
  const { acceptRide: firestoreAccept, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation } = useDriverActions(rideId);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [speed, setSpeed] = useState(0);
  const [isGoingOnline, setIsGoingOnline] = useState(false);

  // Sound & Vibration for new requests
  useEffect(() => {
    if (incomingRequest && isOnline) {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (e) {}
    }
  }, [incomingRequest?.id]);

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
    if (nearbyRequests.length > 0 && !activeRide) {
      setIncomingRequest(nearbyRequests[0]);
    } else {
      setIncomingRequest(null);
    }
  }, [isOnline, nearbyRequests, assignedRide, !!activeRide]);

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
    if (isOnline && activeRide) {
       toast.error("Una safari inayoendelea. Maliza kwanza.");
       return;
    }

    const nextStatus = !isOnline;
    
    if (nextStatus) {
      setIsGoingOnline(true);
      await new Promise(r => setTimeout(r, 1500));
      setIsGoingOnline(false);
    }

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

    let watchId: number | null = null;
    let lastErrorTime = 0;

    const startTracking = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            
            setLastPosition(prev => {
              if (prev && (prev[0] !== loc.lat || prev[1] !== loc.lng)) {
                const b = calculateBearing(prev[0], prev[1], loc.lat, loc.lng);
                setRotation(b);
              }
              return [loc.lat, loc.lng];
            });
            
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
              // Silent fail for Firestore updates to avoid UI flickering
              console.warn("Silent location sync fail:", err);
            }
          }, 
          (err) => {
            const now = Date.now();
            // Only log errors every 30 seconds to avoid flooding
            if (now - lastErrorTime > 30000) {
              console.error("Geolocation error:", err.message || "Unknown error", err.code);
              lastErrorTime = now;
            }
          }, 
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
      }
    };

    startTracking();

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline, user?.uid, activeRide?.id]);

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
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0f] text-[#f0eeff]">
      {/* Top Bar Overlays */}
      <div className="absolute top-4 inset-x-4 z-40 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => toast.info(`Habari ${profile?.displayName || 'Dereva'}`)}
            className="w-12 h-12 bg-[#111118]/80 backdrop-blur-xl rounded-2xl shadow-lg flex items-center justify-center border border-[#1e1e2e] active:scale-95 transition-transform overflow-hidden"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD] font-black text-sm">
                {(profile?.displayName || 'D').split(' ').map(n => n[0]).join('')}
              </div>
            )}
          </button>

          <div className="flex flex-col items-center">
            {isOnline ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full border border-emerald-500/20 flex items-center gap-2 shadow-lg backdrop-blur-md"
              >
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">ACTIVE & RECEIVING</span>
              </motion.div>
            ) : (
               <div className="bg-neutral-800/80 backdrop-blur-md text-neutral-400 px-4 py-2 rounded-full border border-white/5 flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 leading-none">OFFLINE</span>
               </div>
            )}
          </div>

          <button 
            onClick={() => toast.info("Huna taarifa mpya")}
            className="w-12 h-12 bg-[#111118]/80 backdrop-blur-xl rounded-2xl shadow-lg flex items-center justify-center border border-[#1e1e2e] relative"
          >
            <Bell className="w-6 h-6 text-neutral-400" />
            <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-[#111118] rounded-full" />
          </button>
        </div>

        {/* Info Strip */}
        <div className="flex items-center justify-center gap-4 py-1.5 px-4 bg-[#111118]/60 backdrop-blur-md rounded-xl border border-[#1e1e2e]/50 w-fit mx-auto shadow-2xl">
           <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-400">
             <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
             <span>{profile?.rating || '4.8'} RATING</span>
           </div>
           <div className="w-px h-3 bg-neutral-800" />
           <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-400">
             <Wifi className="w-3 h-3 text-emerald-500" />
             <span>NETWORK: GOOD</span>
           </div>
           <div className="w-px h-3 bg-neutral-800" />
           <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-400">
             <Battery className="w-3 h-3 text-emerald-500" />
             <span>TRIP MODE ON</span>
           </div>
        </div>
      </div>

      {/* Map Layer */}
      <div className="absolute inset-0 z-0 bg-[#0a0a0f]">
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="grayscale contrast-[1.1] brightness-[0.7]"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <Marker 
            position={position}
            icon={createDriverMarkerIcon(
              (profile?.displayName || 'D').split(' ').map(n => n[0]).join(''),
              isOnline,
              rotation
            )}
          />

          <Circle 
            center={position}
            radius={30}
            pathOptions={{ color: '#7F77DD', fillOpacity: 0.1, weight: 1 }}
          />

          {activeRide?.routeCoords && (
            <>
              <Polyline positions={activeRide.routeCoords} color="#1D9E75" weight={6} opacity={0.5} />
              {/* Pulse effect or similar could be added here, but simple polyline for now */}
            </>
          )}

          <MapControl />
        </MapContainer>
      </div>

      {/* Floating Buttons */}
      {!activeRide && !incomingRequest && (
        <div className="absolute bottom-1/2 translate-y-[-20%] right-4 z-40 flex flex-col gap-4">
           <motion.button
            onClick={toggleEarnings}
            className="w-14 h-14 bg-[#111118] border-2 border-[#1e1e2e] rounded-2xl shadow-2xl flex flex-col items-center justify-center group active:scale-95 transition-all"
          >
            {showEarnings ? <Eye className="w-5 h-5 text-[#7F77DD]" /> : <EyeOff className="w-5 h-5 text-neutral-500" />}
            <span className="text-[8px] font-black text-neutral-500 mt-1 uppercase tracking-tighter">Budget</span>
          </motion.button>
          
           <button className="w-14 h-14 bg-[#111118] border border-[#1e1e2e] rounded-2xl shadow-2xl flex items-center justify-center text-neutral-400 active:scale-95 transition-transform">
             <MapIcon className="w-6 h-6" />
           </button>
        </div>
      )}

      {/* Earnings Toggle Overlay */}
      {!activeRide && !incomingRequest && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-40">
           <motion.div 
             onClick={toggleEarnings}
             className="bg-[#111118]/90 backdrop-blur-xl border border-[#1e1e2e] px-6 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer flex flex-col items-center gap-1 active:scale-95 transition-all"
           >
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">Mapato Leo</p>
                <div className="flex items-center gap-1.5 bg-[#7F77DD]/10 px-2 py-0.5 rounded-full border border-[#7F77DD]/20">
                  <TrendingUp className="w-3 h-3 text-[#7F77DD]" />
                  <span className="text-[9px] font-black text-[#7F77DD]">{stats.todayTrips} SAFARI</span>
                </div>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter leading-none">
                {showEarnings ? `TZS ${(stats?.todayEarnings ?? 0).toLocaleString()}` : "TZS ••••••"}
              </h2>
           </motion.div>
        </div>
      )}

      {/* Bottom Sheet Redesign */}
      <div className="absolute inset-x-0 bottom-0 z-50">
        <AnimatePresence mode="wait">
          {!isOnline && (
             <motion.div 
               key="offline"
               initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
               className="bg-[#111118] border-t border-[#1e1e2e] p-10 flex flex-col items-center gap-6 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
             >
                <div className="text-center space-y-2">
                   <h3 className="text-xl font-black italic tracking-tighter text-neutral-400">UKO OFFLINE</h3>
                   <p className="text-xs font-bold text-neutral-600">Bonyeza chini kuanza safari</p>
                </div>
                <motion.button
                  onClick={toggleStatus}
                  disabled={isGoingOnline}
                  whileTap={{ scale: 0.95 }}
                  className="w-24 h-24 bg-red-500 rounded-[2rem] border-8 border-[#0a0a0f] shadow-2xl flex items-center justify-center"
                >
                  {isGoingOnline ? <RefreshCw className="w-8 h-8 text-white animate-spin" /> : <Power className="w-8 h-8 text-white" />}
                </motion.button>
             </motion.div>
          )}

          {isOnline && !incomingRequest && !activeRide && (
            <motion.div 
               key="waiting"
               initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
               className="bg-[#111118] border-t border-[#1e1e2e] p-8 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
             >
                <div className="flex items-center justify-between mb-8">
                   <div className="space-y-1">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                         <span className="text-xs font-black text-emerald-500 uppercase tracking-widest italic">ACTIVE & RECEIVING</span>
                      </div>
                      <h4 className="text-lg font-black italic tracking-tighter uppercase">Unangoja maombi...</h4>
                   </div>
                   <button 
                     onClick={toggleStatus}
                     className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500"
                   >
                     <Power className="w-6 h-6" />
                   </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8">
                   <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-4 rounded-3xl flex flex-col items-center">
                      <DollarSign className="w-5 h-5 text-[#7F77DD] mb-1" />
                      <p className="text-[8px] font-black text-neutral-500 uppercase">Mapato</p>
                      <p className="text-xs font-black italic">TZS {(stats?.todayEarnings ?? 0).toLocaleString()}</p>
                   </div>
                   <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-4 rounded-3xl flex flex-col items-center">
                      <Navigation2 className="w-5 h-5 text-emerald-500 mb-1" />
                      <p className="text-[8px] font-black text-neutral-500 uppercase">Safari</p>
                      <p className="text-xs font-black italic">{stats.todayTrips}</p>
                   </div>
                   <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-4 rounded-3xl flex flex-col items-center">
                      <Clock className="w-5 h-5 text-amber-500 mb-1" />
                      <p className="text-[8px] font-black text-neutral-500 uppercase">Saa</p>
                      <p className="text-xs font-black italic">{stats.activeHours}h</p>
                   </div>
                </div>

                <div className="bg-[#7F77DD]/5 border border-[#7F77DD]/10 rounded-2xl p-4 flex items-center gap-4">
                   <div className="w-10 h-10 bg-[#7F77DD]/20 rounded-xl flex items-center justify-center text-[#7F77DD]"><TrendingUp className="w-6 h-6" /></div>
                   <div>
                      <p className="text-[9px] font-black text-[#7F77DD] uppercase tracking-widest italic leading-none mb-1">Busy Zone Alert</p>
                      <p className="text-[11px] font-bold text-neutral-400">Mahitaji makubwa Ubungo, Mlimani City. Elekea huko!</p>
                   </div>
                </div>
             </motion.div>
          )}

          {incomingRequest && (
            <motion.div 
               key="incoming"
               initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
               className="bg-[#111118] border-t border-[#1e1e2e] p-4 pb-10 rounded-t-[40px] shadow-[0_-40px_100px_rgba(127,119,221,0.2)]"
             >
                <div className="flex flex-col gap-6 p-4">
                   <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                         <div className="relative">
                            <svg className="w-16 h-16 transform -rotate-90">
                              <circle cx="32" cy="32" r="30" stroke="#1e1e2e" strokeWidth="4" fill="none" />
                              <motion.circle 
                                cx="32" cy="32" r="30" stroke="#7F77DD" strokeWidth="4" fill="none"
                                initial={{ pathLength: 1 }}
                                animate={{ pathLength: 0 }}
                                transition={{ duration: 15, ease: "linear" }}
                                onAnimationComplete={() => setIncomingRequest(null)}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xl font-black italic text-[#7F77DD]"><Zap className="w-6 h-6" /></div>
                         </div>
                         <div>
                            <div className="bg-[#7F77DD]/20 text-[#7F77DD] text-[10px] font-black px-3 py-1 rounded-full mb-1 italic inline-block tracking-widest border border-[#7F77DD]/30">⚡ OMBI JIPYA</div>
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter -mt-1 leading-none text-[#7F77DD]">#{incomingRequest.id.slice(-4).toUpperCase()}</h2>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black uppercase text-neutral-500">MAPATO YAKO</p>
                         <h3 className="text-2xl font-black italic text-emerald-500 leading-none">TZS {(incomingRequest.fare ?? 0).toLocaleString()}</h3>
                      </div>
                   </div>

                   <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-3xl p-5 space-y-4">
                      <div className="flex items-start gap-4">
                         <div className="mt-1 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                         <div className="flex-1 overflow-hidden">
                            <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Pickup: Ubungo</p>
                            <p className="text-sm font-bold truncate leading-tight">{incomingRequest.pickup.address}</p>
                         </div>
                      </div>
                      <div className="h-4 w-px bg-neutral-800 ml-[5px]" />
                      <div className="flex items-start gap-4">
                         <div className="mt-1 w-2.5 h-2.5 bg-orange-500 rounded-full" />
                         <div className="flex-1 overflow-hidden">
                            <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Mwisho: {incomingRequest.destination.address.split(',')[0]}</p>
                            <p className="text-sm font-bold truncate leading-tight">{incomingRequest.destination.address}</p>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center justify-around py-2 border-y border-[#1e1e2e]">
                      <div className="flex flex-col items-center">
                         <MapIcon className="w-5 h-5 text-neutral-500 mb-1" />
                         <p className="text-[10px] font-black uppercase italic">12 KM</p>
                      </div>
                      <div className="w-px h-6 bg-[#1e1e2e]" />
                      <div className="flex flex-col items-center">
                         <Clock className="w-5 h-5 text-neutral-500 mb-1" />
                         <p className="text-[10px] font-black uppercase italic">~18 DAK</p>
                      </div>
                   </div>

                   <div className="flex gap-4">
                      <button 
                        onClick={() => setIncomingRequest(null)}
                        className="w-[35%] h-16 rounded-2xl border-2 border-red-500/20 text-red-500 font-black uppercase italic text-sm"
                      >
                        Kataa
                      </button>
                      <button 
                        onClick={handleAccept}
                        className="w-[65%] h-16 rounded-2xl bg-[#1D9E75] text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(29,158,117,0.3)] flex items-center justify-center gap-3"
                      >
                        KUBALI <ArrowRight className="w-6 h-6" />
                      </button>
                   </div>
                </div>
             </motion.div>
          )}

          {activeRide && (
            <motion.div 
               key="active"
               initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
               className="bg-[#111118] border-t border-[#1e1e2e] p-6 pb-12 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
             >
                <div className="flex flex-col gap-6">
                   <div className="flex items-center justify-between border-b border-[#1e1e2e] pb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-16 bg-[#0a0a0f] border-2 border-[#1e1e2e] rounded-2xl overflow-hidden shadow-xl">
                            <img src={activeRide.customerInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.customerId}`} alt="Customer" className="w-full h-full object-cover" />
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-neutral-500 italic">MTEJA</p>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter leading-none">{activeRide.customerInfo?.name || "Mteja"}</h3>
                            <div className="flex items-center gap-1.5 text-[#amber-500]">
                               <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                               <span className="text-xs font-black text-amber-500">{activeRide.customerInfo?.rating || "4.9"}</span>
                               <span className="text-[10px] text-neutral-600 ml-2 font-bold px-2 py-0.5 bg-[#0a0a0f] rounded-full">TZS {(activeRide.fare ?? 0).toLocaleString()}</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => window.open(`tel:${activeRide.customerInfo?.phone || '0700000000'}`)} className="w-14 h-14 bg-[#1D9E75]/10 border border-[#1D9E75]/20 rounded-2xl flex items-center justify-center transition-all active:scale-95">
                           <Phone className="w-6 h-6 text-[#1D9E75]" />
                         </button>
                         <button onClick={() => setIsChatOpen(true)} className="w-14 h-14 bg-[#7F77DD]/10 border border-[#7F77DD]/20 rounded-2xl flex items-center justify-center transition-all active:scale-95">
                           <MessageSquare className="w-6 h-6 text-[#7F77DD]" />
                         </button>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="flex items-start gap-4">
                         <div className="w-10 h-10 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl flex items-center justify-center text-[#7F77DD]">
                           {activeRide.status === 'on_trip' ? <MapIcon className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                         </div>
                         <div className="flex-1 overflow-hidden">
                            <p className="text-[9px] font-black uppercase text-neutral-600 mb-0.5">
                               {activeRide.status === 'on_trip' ? 'MWISHO WA SAFARI' : 'PICKUP POINT'}
                            </p>
                            <h4 className="text-sm font-bold truncate leading-tight">
                               {activeRide.status === 'on_trip' ? activeRide.destination.address : activeRide.pickup.address}
                            </h4>
                            <p className="text-[11px] font-bold text-[#7F77DD] italic">
                               {activeRide.status === 'on_trip' ? 'ETA: 08:22 · 5.1 km imebaki' : 'Umbali: 1.2 km · ETA: 4 dak'}
                            </p>
                         </div>
                      </div>

                      {activeRide.status === 'on_trip' && (
                        <div className="space-y-1.5">
                           <div className="flex justify-between text-[10px] font-black uppercase italic text-neutral-500">
                             <span>Progress</span>
                             <span>62%</span>
                           </div>
                           <div className="h-2 w-full bg-[#0a0a0f] rounded-full overflow-hidden border border-[#1e1e2e]">
                              <motion.div initial={{ width: 0 }} animate={{ width: "62%" }} className="h-full bg-[#7F77DD] shadow-[0_0_10px_#7F77DD]" />
                           </div>
                        </div>
                      )}

                      <div className="flex gap-4"> 
                        {activeRide.status === 'driver_arriving' && (
                          <button 
                            onClick={() => handleUpdateStatus('driver_arrived')}
                            className="w-full h-16 bg-[#7F77DD] text-white font-black uppercase italic tracking-widest text-lg shadow-[0_10px_30px_rgba(127,119,221,0.3)] flex items-center justify-center gap-3"
                          >
                            NIMEFIKA <CheckCircle2 className="w-6 h-6" />
                          </button>
                        )}
                        {activeRide.status === 'driver_arrived' && (
                          <button 
                            onClick={() => handleUpdateStatus('on_trip')}
                            className="w-full h-16 bg-[#1D9E75] text-white font-black uppercase italic tracking-widest text-lg shadow-[0_10px_30px_rgba(29,158,117,0.3)] flex items-center justify-center gap-3"
                          >
                            ANZISHA SAFARI <ArrowRight className="w-6 h-6" />
                          </button>
                        )}
                        {activeRide.status === 'on_trip' && (
                          <button 
                            onClick={() => handleUpdateStatus('completed')}
                            className="w-full h-16 bg-red-600 text-white font-black uppercase italic tracking-widest text-lg shadow-[0_10px_30px_rgba(220,38,38,0.3)] flex items-center justify-center gap-3"
                          >
                            MALIZA SAFARI <CheckCircle2 className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                   </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isChatOpen && activeRide && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="absolute inset-0 z-[100] bg-[#0a0a0f] p-4 flex flex-col"
          >
             <div className="flex items-center justify-between py-4 border-b border-[#1e1e2e] mb-2">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#111118] border border-[#1e1e2e]">
                      <img src={activeRide.customerInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.customerId}`} alt="Customer" className="w-full h-full object-cover" />
                   </div>
                   <h4 className="font-black italic uppercase italic">{activeRide.customerInfo?.name || "Mteja"}</h4>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 bg-[#111118] border border-[#1e1e2e] rounded-xl flex items-center justify-center text-neutral-400">
                  <CloseX className="w-6 h-6" />
                </button>
             </div>
             <div className="flex-1">
               <Chat onBack={() => setIsChatOpen(false)} />
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
