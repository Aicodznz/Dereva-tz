import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Bell, Power, Navigation, Fuel, Zap, 
  ParkingCircle, Car, Settings, Phone, Gauge, Eye, EyeOff,
  Navigation2, MessageSquare, MapPin, Star, X as CloseX,
  Clock, TrendingUp, Info, Wifi, Battery, Map as MapIcon,
  CheckCircle2, ArrowRight, RefreshCw, DollarSign, Package, Home
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Chat from '../Chat';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../firebase';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp, collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';
import { useDriverActions } from '../../hooks/useDriverActions';
import { useRideStatus } from '../../hooks/useRideStatus';
import { useDriverRideListener } from '../../hooks/useDriverRideListener';
import { useIncomingRequests } from '../../hooks/useIncomingRequests';
import { useDriverDashboard } from '../../hooks/useDriverDashboard';
import { useRouting } from '../../hooks/useRouting';
import { createDriverMarkerIcon } from '../../utils/driverMarker';
import { calculateBearing, getMapBounds } from '../../utils/mapHelpers';
import { RideStatus, DriverInfo } from '../../types/ride.types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import IncomingRideCard from '../tegex/IncomingRideCard';
import DriverTripSheet from '../tegex/DriverTripSheet';
import PaymentConfirmScreen from '../tegex/PaymentConfirmScreen';
import RateCustomerScreen from '../tegex/RateCustomerScreen';

// Helper components for Map
function MapController({ position, activeRide }: { position: [number, number], activeRide: any }) {
  const map = useMap();
  const hasCentered = React.useRef(false);

  useEffect(() => {
    if (position && !hasCentered.current) {
      map.setView(position, 15);
      hasCentered.current = true;
    }
  }, [position]);
  
  const handleRecenter = () => {
    if (position) {
      map.flyTo(position, 16, { animate: true, duration: 1.5 });
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '160px', marginRight: '16px' }}>
      <div className="leaflet-control">
        <button 
          onClick={handleRecenter}
          className="w-12 h-12 bg-white dark:bg-[#111118] rounded-2xl shadow-2xl flex items-center justify-center text-orange-600 border border-neutral-200 dark:border-[#1e1e2e] active:scale-90 transition-transform"
          title="Center Map"
        >
          <Navigation2 className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function MapBoundsUpdater({ activeRide, position }: { activeRide: any, position: [number, number] }) {
  const map = useMap();
  const lastStatus = React.useRef<string | null>(null);
  const lastRideId = React.useRef<string | null>(null);

  useEffect(() => {
    if (!activeRide) {
      lastStatus.current = null;
      lastRideId.current = null;
      return;
    }

    // Only auto-fit bounds when status changes or it's a new ride
    if (activeRide.status !== lastStatus.current || activeRide.id !== lastRideId.current) {
      const bounds = L.latLngBounds([position]);
      
      if (activeRide.status === 'on_trip') {
         bounds.extend([activeRide.destination.lat, activeRide.destination.lng]);
      } else {
         bounds.extend([activeRide.pickup.lat, activeRide.pickup.lng]);
      }

      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 20 });
      lastStatus.current = activeRide.status;
      lastRideId.current = activeRide.id;
    }
  }, [activeRide?.status, activeRide?.id]);

  return null;
}



function DriverMarker({ position, rotation, vType }: { position: [number, number], rotation: number, vType: string }) {
  return (
    <Marker 
      position={position}
      icon={createDriverMarkerIcon(
        '', // Initial will be handled by parent if needed
        true,
        rotation
      )}
    />
  );
}
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface RiderHomeProps {
  onNavVisibilityChange?: (visible: boolean) => void;
}

export default function RiderHome({ onNavVisibilityChange }: RiderHomeProps) {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  const [lastPosition, setLastPosition] = useState<[number, number] | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showTopInfo, setShowTopInfo] = useState(false);
  
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide } = useRideStatus(rideId);
  const vTypeRaw = (profile?.vehicleType || 'gari').toLowerCase();
  const vType = (vTypeRaw.includes('bike') || vTypeRaw.includes('piki')) ? 'bike' : vTypeRaw.includes('bajaj') ? 'bajaj' : 'mini';
  
  const { showEarnings, toggleEarnings, stats } = useDriverDashboard();
  const nearbyRequests = useIncomingRequests(vType, isOnline, position ? { lat: position[0], lng: position[1] } : null, user?.uid);
  const { assignedRide } = useDriverRideListener(user?.uid, isOnline);
  const { acceptRide: firestoreAccept, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation } = useDriverActions(rideId);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [declinedRequests, setDeclinedRequests] = useState<Set<string>>(new Set());

  // Dynamic Routing for Driver
  const routingTarget = useMemo<[number, number] | null>(() => {
    if (activeRide) {
      if (activeRide.status === 'on_trip') {
        return [activeRide.destination.lat, activeRide.destination.lng];
      }
      // For all other active statuses (accepted, arriving, arrived), go to pickup
      if (['accepted', 'driver_arriving', 'driver_arrived'].includes(activeRide.status)) {
        return [activeRide.pickup.lat, activeRide.pickup.lng];
      }
    } else if (incomingRequest) {
      return [incomingRequest.pickup.lat, incomingRequest.pickup.lng];
    }
    return null;
  }, [activeRide?.status, activeRide?.pickup?.lat, activeRide?.destination?.lat, incomingRequest?.id]);

  const { routeCoords: dynamicRoute } = useRouting(
    position, 
    routingTarget || position
  );
  const [showPayment, setShowPayment] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [isGoingOnline, setIsGoingOnline] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isTripMinimized, setIsTripMinimized] = useState(false);

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
  
  // Auto-expand if request comes or ride active
  useEffect(() => {
    if (incomingRequest) {
      setIsMinimized(false);
    }
    // If a ride is active, don't auto-expand isMinimized (which controls top/bottom common UI)
    // but we have a separate toggle for the trip sheet itself
  }, [incomingRequest]);

  useEffect(() => {
    if (activeRide) {
       setIsTripMinimized(false);
    }
  }, [activeRide?.id]);

  useEffect(() => {
    const freshRequests = nearbyRequests.filter(r => !declinedRequests.has(r.id));
    const currentStillValid = incomingRequest ? freshRequests.find(r => r.id === incomingRequest.id) : null;
    
    // Only set incoming request if we are online, not in an active ride, and not already showing one
    if (isOnline && freshRequests.length > 0 && !activeRide && !showPayment && !showRating) {
      if (!incomingRequest || !currentStillValid) {
        setIncomingRequest(freshRequests[0]);
      }
    } else if (!isOnline || activeRide || freshRequests.length === 0 || (incomingRequest && !currentStillValid)) {
      if (incomingRequest) setIncomingRequest(null);
    }
  }, [nearbyRequests, activeRide, incomingRequest, isOnline, showPayment, showRating, declinedRequests]);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          if (err.code !== 1) console.warn("Initial geolocation failed", err.message);
        }
      );
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

  const StartPin = React.useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="bg-white/90 backdrop-blur-sm border border-emerald-500 rounded-lg px-2 py-1 mb-1 shadow-xl">
          <p class="text-[8px] font-black text-emerald-600 uppercase whitespace-nowrap">PICKUP MTEJA</p>
        </div>
        <div class="bg-[#1D9E75] text-white w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-black">A</div>
        <div class="w-0.5 h-2 bg-emerald-500"></div>
      </div>
    `,
    iconSize: [80, 60],
    iconAnchor: [40, 60]
  }), []);

  const EndPin = React.useMemo(() => L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="bg-white/90 backdrop-blur-sm border border-orange-500 rounded-lg px-2 py-1 mb-1 shadow-xl">
          <p class="text-[8px] font-black text-orange-600 uppercase whitespace-nowrap">DESTINATION</p>
        </div>
        <div class="bg-[#D85A30] text-white w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-black">B</div>
        <div class="w-0.5 h-2 bg-orange-500"></div>
      </div>
    `,
    iconSize: [80, 60],
    iconAnchor: [40, 60]
  }), []);

  // Unified location and presence sync
  useEffect(() => {
    if (!isOnline || !user?.uid) return;
    
    // Global presence update (every 10s)
    const presenceInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, 'drivers', user.uid), {
          location: { lat: position[0], lng: position[1], heading: rotation },
          lastActive: serverTimestamp()
        });
      } catch (e) {
        console.error("Presence update failed", e);
      }
    }, 10000);

    // Ride tracking (every 1s for smoother customer experience)
    let rideInterval: any;
    if (rideId && activeRide && (activeRide.status === 'accepted' || activeRide.status === 'driver_arriving' || activeRide.status === 'driver_arrived' || activeRide.status === 'on_trip')) {
      rideInterval = setInterval(async () => {
        try {
          await updateDriverLocation(position[0], position[1], rotation);
        } catch (e) {
          console.warn("Ride location sync fail", e);
        }
      }, 1000);
    }

    return () => {
      clearInterval(presenceInterval);
      if (rideInterval) clearInterval(rideInterval);
    };
  }, [isOnline, user?.uid, rideId, activeRide?.status, position, rotation]);

  // Listen for assigned rides when online
  useEffect(() => {
    if (!isOnline) {
      setRideId(null);
      return;
    }
    
    if (assignedRide && !rideId) {
      console.log("[Rider] Restored assigned ride:", assignedRide.id);
      setRideId(assignedRide.id);
    }
  }, [isOnline, assignedRide, rideId]);

  // Restore online status from Firestore on mount - ONLY ONCE
  useEffect(() => {
    if (user?.uid && !isOnline) {
      const restoreStatus = async () => {
        try {
          const snap = await getDoc(doc(db, 'drivers', user.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.isOnline !== undefined) {
               setIsOnline(!!data.isOnline);
            }
          }
        } catch (err) {
          console.error("Error restoring driver status:", err);
        }
      };
      restoreStatus();
    }
  }, [user?.uid]);

  const toggleStatus = async () => {
    if (isOnline && activeRide) {
       toast.error("Una safari inayoendelea. Maliza kwanza.");
       return;
    }

    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    
    if (nextStatus) {
      setIsGoingOnline(true);
      // Small delay for UX feel
      setTimeout(() => setIsGoingOnline(false), 800);
    }
    
    if (user?.uid) {
      try {
        console.log(`Setting driver ${user.uid} to ${nextStatus ? 'ONLINE' : 'OFFLINE'}`);
        await setDoc(doc(db, 'drivers', user.uid), {
          id: user.uid,
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
              await updateDoc(doc(db, 'drivers', user.uid), {
                location: { lat: loc.lat, lng: loc.lng },
                isOnline: true,
                receiving: true,
                status: 'online',
                lastActive: serverTimestamp(),
                vehicleType: vType // Keep vehicle type synced
              });
            } catch (err) {
              // Silent fail for Firestore updates to avoid UI flickering
              console.warn("Silent location sync fail:", err);
            }
          }, 
          (err) => {
            const now = Date.now();
            // Only log errors every 30 seconds to avoid flooding
            if (now - lastErrorTime > 30000) {
              if (err.code !== 1) console.error("Geolocation error:", err.message || "Unknown error", err.code);
              else console.warn("Geolocation permission denied");
              
              if (err.code === 1) {
                toast.error("Ruhusa ya Location imekataliwa. Tafadhali ruhusu kwenye browser ili uweze kupokea safari.", {
                  description: "Nenda kwenye Settings za browser yako na uruhusu 'Location' kwa tovuti hii.",
                  duration: 10000
                });
                setIsOnline(false);
              } else if (err.code === 3) {
                toast.error("Imeshindwa kupata Location (Timeout). Kabla hujazima GPS, hakikisha ipo wazi.");
              }
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
        photo: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
        vehicle: {
          model: profile?.vehicleModel || (vType === 'bike' ? 'Honda SanLG' : vType === 'bajaj' ? 'TVS King' : 'Toyota Axio'),
          plate: profile?.licensePlate || 'T 123 ABC',
          color: profile?.vehicleColor || 'Nyekundu'
        }
      };
      
      console.log("[Rider] Accepting ride:", incomingRequest.id);
      
      // Update local state first for instant UI response
      setRideId(incomingRequest.id);
      setIncomingRequest(null);

      // Force update location immediately upon acceptance
      await firestoreAccept(incomingRequest.id, user.uid, driverInfo, { lat: position[0], lng: position[1] });
      
      // Also update the drivers collection to 'busy' or similar if needed, 
      // but status 'online' is usually enough if filtered by 'active'
      
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
        toast.success("Umefika kwa mteja!");
      } else if (status === 'on_trip') {
        await startTrip();
        toast.success("Safari imeanza!");
      }
    } catch (e) {
      console.error("Status update error:", e);
      toast.error("Imeshindwa kusasisha hali");
    }
  };

  const handleComplete = async () => {
    if (!activeRide || !user) return;
    try {
      await completeTrip(
        activeRide.customerId,
        user.uid,
        activeRide.fare
      );
      setShowPayment(true);
      toast.success("Safari Imekamilika!");
    } catch (e) {
      toast.error("Imeshindwa kukamilisha safari");
    }
  };



  // Map centering logic - Auto focus on important points
  useEffect(() => {
    if (activeRide) {
       // When ride is active, map should focus on driver and target (pickup or destination)
       // This will be handled by MapBoundsUpdater below
    } else if (position && !activeRide) {
       // When just online, periodically center on self if moved significantly?
       // For now let's just do it on first lock
    }
  }, [!!activeRide]);

  if (profile?.role === 'rider' && profile?.approvalStatus !== 'approved') {
    return (
      <div className="relative h-full w-full flex items-center justify-center bg-[#0a0a0f] p-8 overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[#7F77DD]/5" />
        {/* Animated background circles */}
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-[#7F77DD]/10 rounded-full blur-3xl animate-pulse border border-[#7F77DD]/20" />
        
        <Card className="relative z-10 w-full max-w-sm rounded-[3rem] border-none bg-[#111118]/80 backdrop-blur-2xl p-10 text-center shadow-2xl border border-[#1e1e2e]">
          <div className="w-24 h-24 bg-orange-600/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 animate-bounce transition-transform duration-1000">
            <CheckCircle2 className="w-12 h-12 text-orange-600" />
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-white">Subiri Idhini</h2>
          <p className="text-neutral-400 font-bold mb-8 text-sm leading-relaxed">
            Akaunti yako bado inakaguliwa na timu ya <span className="text-orange-600">TzNation</span>. Utapata taarifa punde tu utakapoidhinishwa kuanza kazi.
          </p>
          <div className="p-4 bg-orange-600/10 rounded-2xl border border-orange-600/20 mb-8">
             <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest italic">Hali ya Akaunti: Kwenye Mapitio</p>
          </div>
          <Button 
            className="w-full h-16 rounded-[1.5rem] bg-orange-600 hover:bg-orange-700 text-lg font-black uppercase italic tracking-widest shadow-2xl shadow-orange-600/30 transition-all active:scale-95"
            onClick={() => window.location.reload()}
          >
            ANGALIA TENA <RefreshCw className="ml-2 w-5 h-5" />
          </Button>
          <div className="mt-8 pt-8 border-t border-[#1e1e2e]">
            <p className="text-[10px] font-black uppercase text-neutral-600 tracking-widest leading-none">
              TzNation Logistics Group
            </p>
            <p className="text-[8px] font-bold text-neutral-700 uppercase mt-2">© 2024 Vyote vimehifadhiwa</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0f] text-[#f0eeff]">
      {/* Top Bar Overlays */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-24 inset-x-6 z-40 flex flex-col gap-4"
          >
            <div className="flex justify-between items-center bg-white/95 dark:bg-[#111118]/95 p-1.5 rounded-full shadow-2xl border border-neutral-200 dark:border-white/10 backdrop-blur-3xl">
              <button 
                onClick={() => {
                  const nextVal = !showTopInfo;
                  setShowTopInfo(nextVal);
                  if (onNavVisibilityChange) onNavVisibilityChange(!nextVal);
                }}
                className="w-10 h-10 bg-orange-600 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform overflow-hidden shrink-0"
              >
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-xs uppercase">
                    {(profile?.displayName || 'D').split(' ').map(n => n[0]).join('')}
                  </div>
                )}
              </button>

              <div className="h-8 w-px bg-neutral-200 dark:bg-white/10 mx-1"></div>

              <Link to="/">
                <button className="w-10 h-10 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center relative shrink-0">
                  <Home className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </button>
              </Link>

              <div className="flex-1 flex flex-col items-center px-2">
                {isOnline ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter leading-none">ACTIVE & RECEIVING</span>
                  </motion.div>
                ) : (
                  <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-600 rounded-full" />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-neutral-500 dark:text-neutral-500 leading-none">SYSTEM OFFLINE</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => toast.info("Huna taarifa mpya")}
                className="w-10 h-10 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center relative shrink-0"
              >
                <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 border border-white dark:border-[#1a1a2e] rounded-full shadow-sm" />
              </button>
            </div>

            {/* Info Strip */}
            <AnimatePresence>
              {showTopInfo && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => {
                    setShowTopInfo(false);
                    if (onNavVisibilityChange) onNavVisibilityChange(true);
                  }}
                  className="flex items-center justify-center gap-3 py-2 px-4 bg-white dark:bg-[#1a1a2e] rounded-xl border border-neutral-200 dark:border-white/10 w-fit mx-auto shadow-xl cursor-pointer hover:bg-neutral-50 dark:hover:bg-[#1a1a2e] transition-all"
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{profile?.rating || '4.8'} RATING</span>
                  </div>
                  <div className="w-px h-3 bg-neutral-200 dark:bg-white/10" />
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                    <span>NETWORK: GOOD</span>
                  </div>
                  <div className="w-px h-3 bg-neutral-200 dark:bg-white/10" />
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    <Battery className="w-3.5 h-3.5 text-emerald-500" />
                    <span>TRIP MODE ON</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Layer */}
      <div className="absolute inset-0 z-0 bg-[#0a0a0f]">
        <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
           <div className="absolute inset-0 bg-[#0a0a0f]" />
        </div>
        <MapContainer 
          center={position} 
          zoom={15} 
          maxZoom={22}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="transition-all duration-1000"
        >
          <TileLayer 
            url={mapTileUrl}
            maxZoom={22}
            maxNativeZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
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
            pathOptions={{ color: theme === 'dark' ? '#10b981' : '#7F77DD', fillOpacity: 0.1, weight: 1 }}
          />

          {/* Incoming Request Preview */}
          {incomingRequest && (
            <>
              <Marker 
                position={[incomingRequest.pickup.lat, incomingRequest.pickup.lng]} 
                icon={StartPin}
              />
              {dynamicRoute && dynamicRoute.length > 0 && (
                <Polyline 
                  positions={dynamicRoute} 
                  color="#FFA500" 
                  weight={4} 
                  opacity={0.6} 
                  dashArray="10, 15" 
                />
              )}
            </>
          )}

          {activeRide && (
            <>
              {/* Pickup Marker */}
              <Marker 
                position={[activeRide.pickup.lat, activeRide.pickup.lng]} 
                icon={StartPin} 
              >
                <Popup>
                  <div className="p-2 text-center">
                    <p className="font-bold">Eneo la Pickup</p>
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&origin=${position[0]},${position[1]}&destination=${activeRide.pickup.lat},${activeRide.pickup.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 underline"
                    >
                      Fungua Google Maps
                    </a>
                  </div>
                </Popup>
              </Marker>

              {/* Destination Marker */}
              <Marker 
                position={[activeRide.destination.lat, activeRide.destination.lng]} 
                icon={EndPin} 
              >
                <Popup>
                  <div className="p-2 text-center">
                    <p className="font-bold">Eneo la Kushusha</p>
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&origin=${position[0]},${position[1]}&destination=${activeRide.destination.lat},${activeRide.destination.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 underline"
                    >
                      Fungua Google Maps
                    </a>
                  </div>
                </Popup>
              </Marker>

              {/* 1. Static Route (Original from ride data) */}
              {activeRide.routeCoords && (
                <Polyline 
                  positions={activeRide.routeCoords} 
                  color="#ffffff40" 
                  weight={2} 
                  opacity={0.4} 
                  dashArray="4, 8" 
                />
              )}

              {/* 2. Dynamic Live Route (Driver to Current Target) */}
              {dynamicRoute && dynamicRoute.length > 0 && (
                <Polyline 
                  positions={dynamicRoute} 
                  color={activeRide.status === 'on_trip' ? "#1D9E75" : "#7F77DD"} 
                  weight={6} 
                  opacity={0.9} 
                  className="animate-[pulse_2s_infinite]"
                />
              )}
            </>
          )}

          <MapController position={position} activeRide={activeRide} />
          <MapBoundsUpdater activeRide={activeRide} position={position} />

        </MapContainer>
      </div>

      {/* Floating Buttons */}
      {!activeRide && !incomingRequest && !isMinimized && (
        <div className="absolute bottom-1/2 translate-y-[-20%] right-4 z-40 flex flex-col gap-3">
           <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleEarnings}
            className={`w-12 h-12 border-2 rounded-2xl shadow-2xl flex flex-col items-center justify-center transition-all ${
              showEarnings ? 'bg-[#7F77DD] border-[#7F77DD] text-white' : 'bg-[#111118] border-[#1e1e2e] text-neutral-500'
            }`}
          >
            {showEarnings ? <Eye className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            <span className="text-[7px] font-black mt-0.5 uppercase tracking-tighter">Mapato</span>
          </motion.button>
          
           <button className="w-12 h-12 bg-[#111118] border border-[#1e1e2e] rounded-2xl shadow-2xl flex items-center justify-center text-neutral-400 active:scale-95 transition-transform">
             <MapIcon className="w-5 h-5" />
           </button>
        </div>
      )}

      {/* Earnings Toggle Overlay */}
      {!activeRide && !incomingRequest && !isMinimized && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40">
          <AnimatePresence>
            {showEarnings && (
               <motion.div 
                 initial={{ opacity: 0, y: -20, scale: 0.9 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: -20, scale: 0.9 }}
                 onClick={toggleEarnings}
                 className="bg-[#111118]/90 backdrop-blur-xl border border-[#1e1e2e] px-4 py-2 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] cursor-pointer flex flex-col items-center gap-0.5 active:scale-95 transition-all"
               >
                  <div className="flex items-center gap-2">
                    <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest italic">Mapato Leo</p>
                    <div className="flex items-center gap-1 bg-[#7F77DD]/10 px-1.5 py-0.5 rounded-full border border-[#7F77DD]/20">
                      <TrendingUp className="w-2.5 h-2.5 text-[#7F77DD]" />
                      <span className="text-[8px] font-black text-[#7F77DD] uppercase">{stats.todayTrips} SAFARI</span>
                    </div>
                  </div>
                  <h2 className="text-lg font-black italic tracking-tighter leading-none">
                    TZS {(stats?.todayEarnings ?? 0).toLocaleString()}
                  </h2>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Map Mode Toggle Button - Ultra Modern Hyper-Floating style */}
      {!activeRide && !incomingRequest && (
        <div className={`absolute bottom-8 right-6 z-[80] transition-all duration-500`}>
          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const nextVal = !isMinimized;
              setIsMinimized(nextVal);
              if (onNavVisibilityChange) onNavVisibilityChange(!nextVal);
            }}
            className={`w-16 h-16 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-center transition-all duration-500 backdrop-blur-3xl border-4 ${
              isMinimized 
                ? 'bg-orange-600 border-orange-400 text-white ring-8 ring-orange-600/20' 
                : 'bg-white/95 dark:bg-[#1a1a2e]/95 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 shadow-xl'
            }`}
          >
            <AnimatePresence mode="wait">
              {isMinimized ? (
                <motion.div 
                  key="eye"
                  initial={{ rotate: -180, opacity: 0, scale: 0.3 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 180, opacity: 0, scale: 0.3 }}
                  transition={{ type: 'spring', damping: 12 }}
                >
                  <Eye className="w-8 h-8" />
                </motion.div>
              ) : (
                <motion.div 
                  key="eye-off"
                  initial={{ rotate: 180, opacity: 0, scale: 0.3 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -180, opacity: 0, scale: 0.3 }}
                   transition={{ type: 'spring', damping: 12 }}
                >
                  <EyeOff className="w-8 h-8" />
                </motion.div>
              )}
            </AnimatePresence>
            
            {isMinimized && (
              <motion.div 
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-orange-400 -z-10" 
              />
            )}
          </motion.button>
        </div>
      )}

      {/* Bottom Sheet Redesign */}
      <motion.div 
        initial={{ y: 0 }}
        animate={{ y: isMinimized ? 1000 : 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          // We no longer trigger setIsMinimized(true) here. 
          // Minimization must be explicitly done via the eye button.
        }}
        className="absolute inset-x-0 bottom-0 z-50 cursor-grab active:cursor-grabbing"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-neutral-600/30 rounded-full mt-3 z-[60]" />
        
        <AnimatePresence mode="wait">
          {!isOnline && (
             <motion.div 
               key="offline"
               initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
               className="bg-[#111118] border-t border-[#1e1e2e] pt-10 pb-10 px-10 flex flex-col items-center gap-6 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
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

                <div className="grid grid-cols-3 gap-2 mb-6">
                   <div className="bg-[#1a1a2e] border border-[#7F77DD]/20 p-3 rounded-2xl flex flex-col items-center shadow-lg transition-transform hover:scale-105">
                      <DollarSign className="w-4 h-4 text-emerald-500 mb-0.5" />
                      <p className="text-[7px] font-black text-neutral-400 uppercase">Mapato</p>
                      <p className="text-xs font-black italic text-white flex flex-col items-center leading-tight">
                        <span className="text-[8px] opacity-70 not-italic">TZS</span>
                        {showEarnings ? (stats?.todayEarnings ?? 0).toLocaleString() : "••••••"}
                      </p>
                   </div>
                   <div className="bg-[#1a1a2e] border border-[#7F77DD]/20 p-3 rounded-2xl flex flex-col items-center shadow-lg transition-transform hover:scale-105">
                      <Navigation2 className="w-4 h-4 text-emerald-500 mb-0.5" />
                      <p className="text-[7px] font-black text-neutral-400 uppercase">Safari</p>
                      <p className="text-sm font-black italic text-white">{stats.todayTrips}</p>
                   </div>
                   <div className="bg-[#1a1a2e] border border-[#7F77DD]/20 p-3 rounded-2xl flex flex-col items-center shadow-lg transition-transform hover:scale-105">
                      <Clock className="w-4 h-4 text-amber-500 mb-0.5" />
                      <p className="text-[7px] font-black text-neutral-400 uppercase">Saa</p>
                      <p className="text-sm font-black italic text-white">{stats.activeHours}h</p>
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
    </AnimatePresence>

        <AnimatePresence>
            {incomingRequest && (
              <IncomingRideCard 
                ride={incomingRequest}
                onAccept={handleAccept}
                onDecline={() => {
                  setDeclinedRequests(prev => new Set(prev).add(incomingRequest.id));
                  setIncomingRequest(null);
                }}
                onTimeout={() => {
                  setDeclinedRequests(prev => new Set(prev).add(incomingRequest.id));
                  setIncomingRequest(null);
                }}
              />
            )}

            {activeRide && !showPayment && !showRating && (
              <DriverTripSheet 
                ride={activeRide as any}
                onArrive={() => handleUpdateStatus('driver_arrived')}
                onStart={() => handleUpdateStatus('on_trip')}
                onComplete={handleComplete}
                isMinimized={isTripMinimized}
                onToggleMinimize={() => setIsTripMinimized(!isTripMinimized)}
              />
            )}

            {activeRide && showPayment && (
              <PaymentConfirmScreen 
                ride={activeRide as any}
                onPaymentConfirmed={() => {
                  setShowPayment(false);
                  setShowRating(true);
                }}
              />
            )}

            {activeRide && showRating && (
              <RateCustomerScreen 
                ride={activeRide as any}
                onDone={() => {
                  setShowRating(false);
                  setRideId(null);
                }}
              />
            )}
          </AnimatePresence>
      </motion.div>

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
