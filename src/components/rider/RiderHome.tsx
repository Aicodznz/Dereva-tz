import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Skeleton } from '../ui/Skeleton';
import { 
  Bell, Power, Navigation, Fuel, Zap, 
  ParkingCircle, Car, Settings, Phone, Gauge, Eye, EyeOff,
  Navigation2, MessageSquare, MapPin, Star, X as CloseX,
  Clock, TrendingUp, Info, Wifi, Battery, Map as MapIcon,
  CheckCircle2, ArrowRight, RefreshCw, DollarSign, Package, Home, LogOut,
  Volume2, VolumeX, Sun, Moon, Wrench, Sparkles, Plus, Minus
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Chat from '../Chat';
import ActiveRideChatPopup from '../ActiveRideChatPopup';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../../firebase';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp, collection, query, where, limit, onSnapshot, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';
import { useDriverActions } from '../../hooks/useDriverActions';
import { useRideStatus } from '../../hooks/useRideStatus';
import { useDriverRideListener } from '../../hooks/useDriverRideListener';
import { useIncomingRequests } from '../../hooks/useIncomingRequests';
import { useDriverDashboard } from '../../hooks/useDriverDashboard';
import { useIncomingOrders } from '../../hooks/useIncomingOrders';
import { useRouting, generateSimulatedRoads } from '../../hooks/useRouting';
import { useVoiceNavigation } from '../../hooks/useVoiceNavigation';
import { createDriverMarkerIcon } from '../../utils/driverMarker';
import { calculateBearing, getMapBounds } from '../../utils/mapHelpers';
import { RideStatus, DriverInfo } from '../../types/ride.types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import IncomingRideCard from '../tegex/IncomingRideCard';
import IncomingOrderCard from './IncomingOrderCard';
import DriverTripSheet from '../tegex/DriverTripSheet';
import PaymentConfirmScreen from '../tegex/PaymentConfirmScreen';
import RateCustomerScreen from '../tegex/RateCustomerScreen';
import { AnimatedRoute } from '../map/AnimatedRoute';
import AppDownloadButton from '../AppDownloadButton';

const getNormalizedCoords = (coords: any): [number, number][] => {
  if (!coords || !Array.isArray(coords)) return [];
  return coords.map((c: any) => {
    if (Array.isArray(c)) {
      return [Number(c[0]), Number(c[1])] as [number, number];
    }
    if (c && typeof c === "object") {
      const lat = c.lat !== undefined ? c.lat : c.latitude;
      const lng = c.lng !== undefined ? c.lng : c.longitude;
      if (lat !== undefined && lng !== undefined) {
        return [Number(lat), Number(lng)] as [number, number];
      }
    }
    return null;
  }).filter((c): c is [number, number] => c !== null);
};

// Helper components for Map
function MapController({ position, activeRide }: { position: [number, number], activeRide: any }) {
  const map = useMap();
  const hasCentered = React.useRef(false);
  const [autoFollow, setAutoFollow] = React.useState(true);
  const lastCenterRef = React.useRef<[number, number] | null>(null);

  // Trigger invalidateSize sequentially to fix size issues when loaded on mobile phone or tablet layout
  useEffect(() => {
    const delays = [100, 300, 600, 1200];
    const timers = delays.map(delay => 
      setTimeout(() => {
        try {
          map.invalidateSize();
          if (position) {
            map.setView(position, map.getZoom() || 17, { animate: false });
          }
        } catch (e) {
          // ignore
        }
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [map, activeRide?.status, activeRide?.id, position]);

  // Handle dynamic map resize constraints beautifully via ResizeObserver on mobile/tablet viewports
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;

    const observer = new ResizeObserver(() => {
      try {
        map.invalidateSize({ animate: true });
      } catch (e) {
        // ignore
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  // Use map events to turn off autoFollow if user drags or zooms manually
  useMapEvents({
    dragstart() {
      setAutoFollow(false);
    },
    zoomstart() {
      setAutoFollow(false);
    },
    drag() {
      setAutoFollow(false);
    },
    zoom() {
      setAutoFollow(false);
    }
  });

  useEffect(() => {
    if (!position) return;
    
    if (!hasCentered.current) {
      map.setView(position, 17);
      hasCentered.current = true;
      lastCenterRef.current = position;
      return;
    }
    
    // Only update view if autoFollow is enabled
    if (autoFollow) {
      const currentPos = L.latLng(position[0], position[1]);
      const lastPos = lastCenterRef.current ? L.latLng(lastCenterRef.current[0], lastCenterRef.current[1]) : null;

      // Only panTo/setView if we have moved significantly to avoid constant jittering / playing of the marker
      if (!lastPos || currentPos.distanceTo(lastPos) > 10) {
        map.panTo(position, { animate: true, duration: 0.8 });
        lastCenterRef.current = position;
      }
    }
  }, [position?.[0], position?.[1], !!activeRide, autoFollow]);
  
  const handleRecenter = () => {
    setAutoFollow(true);
    if (position) {
      map.flyTo(position, 18, { animate: true, duration: 1.2 });
      lastCenterRef.current = position;
    }
  };

  return null;
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
  }, [activeRide?.status, activeRide?.id, position, map]);

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
  onProfileClick?: () => void;
}

export default function RiderHome({ onNavVisibilityChange, onProfileClick }: RiderHomeProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  const [activePoiCategory, setActivePoiCategory] = useState<string | null>(null);
  const [poisCollapsed, setPoisCollapsed] = useState<boolean>(false);

  // States for adding a POI
  const [isAddPoiModalOpen, setIsAddPoiModalOpen] = useState(false);
  const [newPoiName, setNewPoiName] = useState('');
  const [newPoiType, setNewPoiType] = useState('charging');
  const [newPoiPhone, setNewPoiPhone] = useState('');
  const [newPoiPrice, setNewPoiPrice] = useState('');
  const [newPoiLat, setNewPoiLat] = useState<number>(0);
  const [newPoiLng, setNewPoiLng] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mobile'>('wallet');
  const [mobileNumber, setMobileNumber] = useState('');
  const [isSubmittingPoi, setIsSubmittingPoi] = useState(false);

  // Real-time POIs state from Firestore
  const [firestorePois, setFirestorePois] = useState<any[]>([]);

  // Track coordinates for placing/adding POIs
  useEffect(() => {
    if (position) {
      setNewPoiLat(position[0]);
      setNewPoiLng(position[1]);
    }
  }, [position?.[0], position?.[1]]);

  // Read POIs in real-time
  useEffect(() => {
    const q = query(collection(db, 'pois'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setFirestorePois(list);
    }, (error) => {
      console.error("Error loading POIs from Firestore:", error);
    });
    return () => unsubscribe();
  }, []);

  // Generate simulated POIs centered around driver position
  const simulatedPois = useMemo(() => {
    const lat = position[0];
    const lng = position[1];
    return {
      charging: [
        { id: 'c1', name: 'TzNation EV Fast Charger', lat: lat + 0.003, lng: lng + 0.002, speed: '120 kW', cost: 'TZS 450/kWh', type: 'charging' },
        { id: 'c2', name: 'Mlimani EV Charging Point', lat: lat - 0.004, lng: lng + 0.005, speed: '50 kW', cost: 'TZS 380/kWh', type: 'charging' },
        { id: 'c3', name: 'Kijitonyama Smart EV station', lat: lat + 0.002, lng: lng - 0.003, speed: '150 kW', cost: 'TZS 500/kWh', type: 'charging' },
      ],
      mechanic: [
        { id: 'm1', name: 'Karakana ya Boda & Taxi Juma', lat: lat - 0.003, lng: lng - 0.002, status: 'Funguliwa', phone: '+255 712 345 678', type: 'mechanic' },
        { id: 'm2', name: 'Kinondoni Auto Repair Workshop', lat: lat + 0.004, lng: lng - 0.004, status: 'Funguliwa', phone: '+255 655 987 654', type: 'mechanic' },
        { id: 'm3', name: 'TzNation Garage Fast Care', lat: lat - 0.002, lng: lng + 0.003, status: 'Funguliwa', phone: '+255 784 444 555', type: 'mechanic' },
      ],
      wash: [
        { id: 'w1', name: 'Kinondoni Smart Car Wash', lat: lat + 0.005, lng: lng + 0.001, price: 'TZS 5,000', rating: '4.8 ⭐', type: 'wash' },
        { id: 'w2', name: 'Osha Gari Elimu & Care', lat: lat - 0.003, lng: lng + 0.004, price: 'TZS 6,000', rating: '4.5 ⭐', type: 'wash' },
        { id: 'w3', name: 'Bustani Premium Car Wash', lat: lat + 0.001, lng: lng - 0.004, price: 'TZS 8,000', rating: '4.9 ⭐', type: 'wash' },
      ],
      parking: [
        { id: 'p1', name: 'Maegesho Salama Posta', lat: lat - 0.004, lng: lng - 0.001, rate: 'TZS 1,000/hr', slots: '15 slots', type: 'parking' },
        { id: 'p2', name: 'Mbezi Park & Ride Slot', lat: lat + 0.003, lng: lng + 0.003, rate: 'TZS 500/hr', slots: '32 slots', type: 'parking' },
        { id: 'p3', name: 'Mlimani City Parking Mall', lat: lat - 0.001, lng: lng - 0.003, rate: 'TZS 2,000/hr', slots: '120 slots', type: 'parking' },
      ],
      fuel: [
        { id: 'f1', name: 'Puma Energy - Kinondoni', lat: lat + 0.002, lng: lng + 0.004, petrol: 'TZS 3,120/L', diesel: 'TZS 3,050/L', type: 'fuel' },
        { id: 'f2', name: 'TotalEnergies Station', lat: lat - 0.002, lng: lng - 0.005, petrol: 'TZS 3,110/L', diesel: 'TZS 3,040/L', type: 'fuel' },
        { id: 'f3', name: 'Mlimani Petrol Station', lat: lat + 0.004, lng: lng - 0.002, petrol: 'TZS 3,130/L', diesel: 'TZS 3,060/L', type: 'fuel' },
      ],
    };
  }, [position]);

  // Merged POIs including real-time Firestore POIs
  const mergedPois = useMemo(() => {
    const listByCategory: { [key: string]: any[] } = {
      charging: [...simulatedPois.charging],
      mechanic: [...simulatedPois.mechanic],
      wash: [...simulatedPois.wash],
      parking: [...simulatedPois.parking],
      fuel: [...simulatedPois.fuel],
    };

    firestorePois.forEach((poi) => {
      const isApproved = poi.status === 'approved';
      const isOwnPending = poi.status === 'pending' && poi.submittedBy === user?.uid;

      if (isApproved || isOwnPending) {
        const mappedPoi = {
          id: poi.id,
          name: poi.name + (poi.status === 'pending' ? ' (Msubiri Uhakiki ⏳)' : ''),
          lat: poi.lat,
          lng: poi.lng,
          type: poi.type,
          speed: poi.type === 'charging' ? poi.price || '80 kW' : undefined,
          cost: poi.type === 'charging' ? poi.price || 'TZS 400/kWh' : undefined,
          status: poi.type === 'mechanic' ? 'Funguliwa' : undefined,
          phone: poi.phone || '',
          price: poi.type === 'wash' ? poi.price || 'TZS 5,000' : undefined,
          rating: poi.type === 'wash' ? '4.8 ⭐' : undefined,
          rate: poi.type === 'parking' ? poi.price || 'TZS 1,000/hr' : undefined,
          slots: poi.type === 'parking' ? '12 spots' : undefined,
          petrol: poi.type === 'fuel' ? poi.price || 'TZS 3,200/L' : undefined,
          diesel: poi.type === 'fuel' ? 'TZS 3,090/L' : undefined,
          isReal: true,
          realStatus: poi.status
        };

        if (listByCategory[poi.type]) {
          listByCategory[poi.type].push(mappedPoi);
        }
      }
    });

    return listByCategory;
  }, [simulatedPois, firestorePois, user?.uid]);
  const [lastPosition, setLastPosition] = useState<[number, number] | null>(null);
  const [rotation, setRotation] = useState(0);
  const simulatedPathRef = React.useRef<[number, number][]>([]);
  const simulatedIndexRef = React.useRef<number>(0);
  const activeStatusRef = React.useRef<string | null>(null);

  const [showTopInfo, setShowTopInfo] = useState(false);
  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide } = useRideStatus(rideId);
  const [realTripRoute, setRealTripRoute] = useState<[number, number][]>([]);

  const driverApproachRouteRef = React.useRef<[number, number][]>([]);
  const lastActiveRideIdStatusRef = React.useRef<string>("");

  useEffect(() => {
    if (!activeRide) {
      setRealTripRoute([]);
      return;
    }

    const { pickup, destination } = activeRide;
    if (!pickup || !destination) return;

    const fetchTripRoute = async () => {
      const pickupStr = `${pickup.lng},${pickup.lat}`;
      const destStr = `${destination.lng},${destination.lat}`;
      const url = `/api/geo/route?coords=${encodeURIComponent(pickupStr + ";" + destStr)}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          let json = await response.json();
          if (json.isFallback) {
            const directUrls = [
              `https://router.project-osrm.org/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
              `https://routing.openstreetmap.de/routed-car/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
              `http://router.project-osrm.org/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
              `http://routing.openstreetmap.de/routed-car/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`
            ];
            for (const directUrl of directUrls) {
              try {
                const clientRes = await fetch(directUrl);
                if (clientRes.ok) {
                  const clientJson = await clientRes.json();
                  if (clientJson && clientJson.code === "Ok" && clientJson.routes && clientJson.routes.length > 0) {
                    json = clientJson;
                    break;
                  }
                }
              } catch (e) {
                console.warn("Direct trip fetch failed in RiderHome:", e);
              }
            }
          }

          if (json.code === "Ok" && json.routes && json.routes.length > 0) {
            const route = json.routes[0];
            const coords: [number, number][] = route.geometry.coordinates.map(
              (c: number[]) => [c[1], c[0]] as [number, number]
            );
            if (coords.length > 0) {
              console.log("[RiderHome] Successfully fetched real-world street curves for trip route!");
              setRealTripRoute(coords);
              return;
            }
          }
        }
      } catch (e) {
        console.error("[RiderHome] Failed to fetch real trip route:", e);
      }
    };

    fetchTripRoute();
  }, [activeRide?.id, activeRide?.pickup?.lat, activeRide?.destination?.lat]);

  useEffect(() => {
    if (!activeRide) {
      driverApproachRouteRef.current = [];
      lastActiveRideIdStatusRef.current = "";
      return;
    }

    const currentKey = `${activeRide.id}_${activeRide.status}`;
    if (lastActiveRideIdStatusRef.current !== currentKey) {
      lastActiveRideIdStatusRef.current = currentKey;

      if (['accepted', 'driver_arriving'].includes(activeRide.status) && position) {
        // Generate approach route once!
        const generated = generateSimulatedRoads(
          [position[0], position[1]],
          [activeRide.pickup.lat, activeRide.pickup.lng]
        );
        driverApproachRouteRef.current = generated;
      } else {
        driverApproachRouteRef.current = [];
      }
    }
  }, [activeRide?.id, activeRide?.status]);

  const sliceRouteFromCurrentPos = (
    fullRoute: [number, number][],
    currentPos: [number, number] | null
  ): [number, number][] => {
    if (!fullRoute || fullRoute.length === 0) return [];
    if (!currentPos) return fullRoute;

    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < fullRoute.length; i++) {
      const lat = fullRoute[i][0];
      const lng = fullRoute[i][1];
      const diffLat = lat - currentPos[0];
      const diffLng = lng - currentPos[1];
      const dist = diffLat * diffLat + diffLng * diffLng;

      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const sliced = [...fullRoute.slice(closestIndex)];
    // Only smooth the first coordinate to the driver's exact position if the distance is tiny (within ~50m)
    // 50m correspond to a squared degree distance of approximately 2.0e-7
    if (sliced.length > 0 && minDistance < 2.0e-7) {
      sliced[0] = [currentPos[0], currentPos[1]];
    }
    return sliced;
  };

  const [timeTicker, setTimeTicker] = useState(0);
  const [secondsOffset, setSecondsOffset] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset secondsOffset when ride status or ID changes
  useEffect(() => {
    setSecondsOffset(0);
  }, [rideId, activeRide?.status]);
  const vTypeRaw = (profile?.vehicleType || 'gari').toLowerCase();
  const vType = (vTypeRaw.includes('bike') || vTypeRaw.includes('piki')) ? 'bike' : vTypeRaw.includes('bajaj') ? 'bajaj' : 'mini';
  
  const { showEarnings, toggleEarnings, stats } = useDriverDashboard();
  const nearbyRequests = useIncomingRequests(vType, isOnline, position ? { lat: position[0], lng: position[1] } : null, user?.uid);
  const nearbyOrders = useIncomingOrders(isOnline, position ? { lat: position[0], lng: position[1] } : null);
  const { assignedRide } = useDriverRideListener(user?.uid, isOnline);
  const { acceptRide: firestoreAccept, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation } = useDriverActions(rideId);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [incomingOrder, setIncomingOrder] = useState<any>(null);
  const [declinedRequests, setDeclinedRequests] = useState<Set<string>>(new Set());

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/login');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  // Dynamic Routing for Driver
  const routingTarget = useMemo<[number, number] | null>(() => {
    if (activeRide) {
      if (activeRide.status === 'on_trip') {
        return [activeRide.destination.lat, activeRide.destination.lng];
      }
      // For all active statuses where we need to reach the customer
      if (['accepted', 'driver_arriving', 'driver_arrived'].includes(activeRide.status)) {
        return [activeRide.pickup.lat, activeRide.pickup.lng];
      }
    } else if (incomingRequest) {
      return [incomingRequest.pickup.lat, incomingRequest.pickup.lng];
    }
    return null;
  }, [activeRide?.status, activeRide?.pickup?.lat, activeRide?.destination?.lat, incomingRequest?.pickup?.lat, incomingRequest?.id]);

  const { routeCoords: dynamicRoute, steps, isLoading: isRoutingLoading } = useRouting(
    position, 
    routingTarget || position,
    true
  );
  const { isUnlocked: voiceUnlocked, isMuted, speak, toggleMute } = useVoiceNavigation();
  const [lastInstruction, setLastInstruction] = useState("");
  const lastStateRef = React.useRef<string | null>(null);

  // Status-based voice announcements
  useEffect(() => {
    if (activeRide) {
      if (activeRide.status !== lastStateRef.current) {
        if (activeRide.status === 'on_trip') {
          speak("Safari imeanza. Fuata njia iliyoonyeshwa.");
        } else if (activeRide.status === 'driver_arrived') {
          speak("Umefika. Karibu na mteja wako.");
        } else if (activeRide.status === 'driver_arriving') {
          speak("Unakaribia sehemu ya kukusanyia abiria");
        }
        lastStateRef.current = activeRide.status;
      }
    } else {
      lastStateRef.current = null;
    }
  }, [activeRide?.status, speak]);

  // Voice Navigation Implementation for turn-by-turn
  useEffect(() => {
    if (activeRide && steps && steps.length > 0 && !isMuted && voiceUnlocked) {
      // Find the first step that is ahead of us
      const nextStep = steps.find(s => s.distance > 20);
      if (nextStep && nextStep.instruction !== lastInstruction) {
        // Speak if we are close (500m)
        if (nextStep.distance < 500) {
          const mapping: Record<string, string> = {
            'turn right': 'geuka kulia',
            'turn left': 'geuka kushoto',
            'arrive': 'Umefika unapoenda',
            'depart': 'Anza safari yako sasa',
            'continue': 'Endelea moja kwa moja',
            'roundabout': 'Kwenye mzunguko',
            'slight right': 'geuka kulia kidogo',
            'slight left': 'geuka kushoto kidogo',
            'sharp right': 'geuka kulia kabisa',
            'sharp left': 'geuka kushoto kabisa',
            'uturn': 'Geuka nyuma',
            'destination': 'unapokwenda',
          };
          
          let translatedText = nextStep.instruction.toLowerCase();
          Object.keys(mapping).forEach(key => {
            if (translatedText.includes(key)) {
              translatedText = translatedText.replace(key, mapping[key]);
            }
          });

          let text = "";
          if (nextStep.distance < 50) {
             text = "Sasa, " + translatedText;
          } else if (nextStep.distance > 1000) {
             text = `Baada ya kilometa ${ (nextStep.distance / 1000).toFixed(1) }, ${translatedText}`;
          } else {
             text = `Baada ya mita ${Math.round(nextStep.distance)}, ${translatedText}`;
          }

          speak(text);
          setLastInstruction(nextStep.instruction);
        }
      }
    }
  }, [steps, activeRide?.id, lastInstruction, isMuted, voiceUnlocked, speak]);
  const [showPayment, setShowPayment] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [isGoingOnline, setIsGoingOnline] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const theme = resolvedTheme === 'light' ? 'light' : 'dark';
  const [isTripMinimized, setIsTripMinimized] = useState(false);
  
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
    if (onNavVisibilityChange) {
      if (activeRide && !isTripMinimized) {
        onNavVisibilityChange(false);
      } else {
        onNavVisibilityChange(!isMinimized);
      }
    }
  }, [activeRide, isTripMinimized, isMinimized, onNavVisibilityChange]);

  useEffect(() => {
    const freshRequests = nearbyRequests.filter(r => r.id && !declinedRequests.has(r.id));
    const currentStillValid = incomingRequest && incomingRequest.id ? freshRequests.find(r => r.id === incomingRequest.id) : null;
    
    // Only set incoming request if we are online, not in an active ride, and not already showing one
    if (isOnline && freshRequests.length > 0 && !activeRide && !showPayment && !showRating) {
      if (!incomingRequest || !currentStillValid) {
        setIncomingRequest(freshRequests[0]);
      }
    } else if (!isOnline || activeRide || freshRequests.length === 0 || (incomingRequest && !currentStillValid)) {
      if (incomingRequest) setIncomingRequest(null);
    }
  }, [nearbyRequests, activeRide, incomingRequest, isOnline, showPayment, showRating, declinedRequests]);

  useEffect(() => {
    const freshOrders = nearbyOrders.filter(o => !declinedRequests.has(o.id!));
    const currentStillValid = incomingOrder && incomingOrder.id ? freshOrders.find(o => o.id === incomingOrder.id) : null;
    
    if (isOnline && freshOrders.length > 0 && !activeRide && !incomingRequest && !showPayment && !showRating) {
      if (!incomingOrder || !currentStillValid) {
        setIncomingOrder(freshOrders[0]);
      }
    } else if (!isOnline || activeRide || incomingRequest || freshOrders.length === 0 || (incomingOrder && !currentStillValid)) {
      if (incomingOrder) setIncomingOrder(null);
    }
  }, [nearbyOrders, activeRide, incomingRequest, incomingOrder, isOnline, showPayment, showRating, declinedRequests]);

  // Get current location
  useEffect(() => {
    let fallbackCalled = false;
    const triggerIpFallback = async () => {
      if (fallbackCalled) return;
      fallbackCalled = true;

      // 1. Try freeipapi.com
      try {
        const ipRes = await fetch("https://freeipapi.com/api/json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number' && ipData.latitude !== 0) {
            setPosition([ipData.latitude, ipData.longitude]);
            toast.success(`Eneo lako la sasa limetambuliwa (${ipData.cityName || 'Karibu nawe'}) 📍`);
            return;
          }
        }
      } catch (err) {
        console.warn("RiderHome freeipapi Loc fail:", err);
      }

      // 2. Try ipwho.is
      try {
        const ipRes = await fetch("https://ipwho.is/");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.success && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
            setPosition([ipData.latitude, ipData.longitude]);
            toast.success(`Eneo lako la sasa limetambuliwa (${ipData.city || 'Karibu nawe'}) 📍`);
            return;
          }
        }
      } catch (err) {
        console.warn("RiderHome ipwho.is Loc fail:", err);
      }

      // 3. Try ipapi.co
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
            setPosition([ipData.latitude, ipData.longitude]);
            toast.success(`Eneo lako la sasa limetambuliwa (${ipData.city || 'Karibu nawe'}) 📍`);
            return;
          }
        }
      } catch (err) {
        console.warn("RiderHome IP Loc fail:", err);
      }
    };

    if (navigator.geolocation) {
      const timer = setTimeout(() => {
        triggerIpFallback();
      }, 4000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          toast.success("Eneo lako limepatikana kupitia GPS! 📍");
        },
        async (err) => {
          clearTimeout(timer);
          console.warn("Initial geolocation failed, fallback to IP", err.message);
          await triggerIpFallback();
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 300000 }
      );
    } else {
      triggerIpFallback();
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

  const getStartPin = (etaText: string) => {
    return L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center animate-fade-in">
          <div class="bg-[#111118]/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl px-2.5 py-1 mb-1 shadow-2xl flex flex-col items-center min-w-[125px]">
            <span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-normal">PICKUP MTEJA</span>
            <span class="text-[9.5px] font-bold text-white/95 mt-0.5 whitespace-nowrap px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">${etaText}</span>
          </div>
          <div class="bg-emerald-500 text-white w-9 h-9 rounded-full border-4 border-[#111118] shadow-2xl flex items-center justify-center font-black text-lg marker-pulse-green">A</div>
          <div class="w-1 h-2.5 bg-emerald-500 rounded-full -mt-0.5 shadow-lg"></div>
        </div>
      `,
      iconSize: [145, 85],
      iconAnchor: [72, 85],
    });
  };

  const getEndPin = (etaText: string) => {
    return L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center animate-fade-in">
          <div class="bg-[#111118]/95 backdrop-blur-md border border-orange-500/30 rounded-2xl px-2.5 py-1 mb-1 shadow-2xl flex flex-col items-center min-w-[160px]">
            <span class="text-[9px] font-black text-orange-400 uppercase tracking-widest leading-normal">DESTINATION</span>
            <span class="text-[9.5px] font-bold text-white/95 mt-0.5 whitespace-nowrap px-1.5 py-0.5 bg-orange-500/10 rounded border border-orange-500/20">${etaText}</span>
          </div>
          <div class="bg-orange-500 text-white w-9 h-9 rounded-full border-4 border-[#111118] shadow-2xl flex items-center justify-center font-black text-lg marker-pulse-orange">B</div>
          <div class="w-1 h-2.5 bg-orange-500 rounded-full -mt-0.5 shadow-lg"></div>
        </div>
      `,
      iconSize: [170, 85],
      iconAnchor: [85, 85],
    });
  };

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
    
    if (assignedRide && assignedRide.id && !rideId) {
      console.log("[Rider] Restored assigned ride:", assignedRide.id);
      setRideId(assignedRide.id);
    }
  }, [isOnline, assignedRide, rideId]);

  // Synchronize dynamicRoute to simulatedPath once generated
  useEffect(() => {
    if (dynamicRoute && dynamicRoute.length > 2 && activeRide) {
      const status = activeRide.status;
      // If status changed or simulated path is empty, initialize simulation path
      if (activeStatusRef.current !== status || simulatedPathRef.current.length === 0) {
        console.log(`[Simulation] Initializing simulated path for status: ${status}. Points: ${dynamicRoute.length}`);
        simulatedPathRef.current = [...dynamicRoute];
        simulatedIndexRef.current = 0;
        activeStatusRef.current = status;
        
        // Put driver at the beginning of the new simulated path immediately
        const startPoint = dynamicRoute[0];
        if (startPoint) {
          setPosition(startPoint);
        }
      }
    }
  }, [dynamicRoute, activeRide?.status]);

  // Automatic GPS Simulation Loop for preview/testing environments
  useEffect(() => {
    if (!isOnline || !activeRide) return;

    const status = activeRide.status;
    const isMovingStatus = ['accepted', 'driver_arriving', 'on_trip'].includes(status);
    if (!isMovingStatus) return;

    const simInterval = setInterval(async () => {
      const path = simulatedPathRef.current;
      const index = simulatedIndexRef.current;

      if (path && path.length > 0 && index < path.length - 1) {
        // Advance along the path. 
        // We advance by 2 coordinate indices per tick to keep up a good simulated pace
        const nextIndex = Math.min(index + 2, path.length - 1);
        simulatedIndexRef.current = nextIndex;
        
        const currentCoord = path[index];
        const nextCoord = path[nextIndex];

        if (nextCoord) {
          const bearing = calculateBearing(currentCoord[0], currentCoord[1], nextCoord[0], nextCoord[1]);
          
          console.log(`[Simulation] Moving driver to [${nextCoord[0].toFixed(5)}, ${nextCoord[1].toFixed(5)}]. Bearing: ${bearing.toFixed(1)}`);
          
          setRotation(bearing);
          setPosition(nextCoord);
          
          try {
            await updateDriverLocation(nextCoord[0], nextCoord[1], bearing);
          } catch (e) {
            console.warn("[Simulation] sync location fail:", e);
          }
        }
      } else if (path && path.length > 0 && index >= path.length - 1) {
        // We have successfully arrived at destination/pickup
        console.log(`[Simulation] Driver reached target for status: ${status}`);
        
        // If we are arriving at the customer, auto-transition to arrived at pickup!
        if (status === 'accepted' || status === 'driver_arriving') {
          console.log("[Simulation] Auto marking as arrived at pickup");
          arrivedAtPickup();
        }
      }
    }, 1500);

    return () => clearInterval(simInterval);
  }, [isOnline, activeRide?.status, updateDriverLocation, arrivedAtPickup]);

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

  const handleAcceptOrder = async () => {
    if (!incomingOrder || !user) return;
    try {
      await updateDoc(doc(db, 'orders', incomingOrder.id!), {
        riderId: user.uid,
        riderName: profile?.displayName || 'Driver',
        riderPhone: profile?.phoneNumber || '',
        status: 'out_for_delivery',
        updatedAt: serverTimestamp()
      });
      toast.success('Oda imekubaliwa! 🛵');
      setIncomingOrder(null);
      // For now, simpler than full order tracking in this UI
      // In a real app we'd set activeOrder and show an OrderTripSheet
    } catch (error) {
      console.error(error);
      toast.error('Imeshindwa kukubali oda.');
    }
  };

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

    const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const startTracking = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            
            let shouldUpdate = true;
            setPosition(prev => {
              if (prev && prev[0] && prev[1]) {
                const dist = getDistanceInMeters(prev[0], prev[1], loc.lat, loc.lng);
                if (dist < 3) {
                  shouldUpdate = false;
                  return prev;
                }
              }
              return [loc.lat, loc.lng];
            });

            if (!shouldUpdate) return;

            setLastPosition(prev => {
              if (prev && (prev[0] !== loc.lat || prev[1] !== loc.lng)) {
                const b = calculateBearing(prev[0], prev[1], loc.lat, loc.lng);
                setRotation(b);
              }
              return [loc.lat, loc.lng];
            });
            
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
        rating: profile?.rating !== undefined && profile?.rating > 0 ? Number(profile.rating) : 4.8,
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
      // Automatic chat deletion between customer and driver
      try {
        const cId = [user.uid, activeRide.customerId].sort().join('_');
        const msgsRef = collection(db, 'messages');
        const qMsgs = query(msgsRef, where('chatId', '==', cId));
        const msgsSnap = await getDocs(qMsgs);
        const deletePromises = msgsSnap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log("Chat history deleted automatically on trip complete.");
      } catch (chatErr) {
        console.error("Error clearing chat history:", chatErr);
      }

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

  // Automatic Proximity & Phase Transition Detector
  useEffect(() => {
    if (!isOnline || !activeRide || !position) return;

    const ARRIVAL_THRESHOLD_METERS = 50;
    const status = activeRide.status;

    // Phase 1: Driver -> Pickup (Point A) [GREEN Route]
    if (['accepted', 'driver_arriving'].includes(status)) {
      const distToPickup = getDistanceDriver(
        [position[0], position[1]], 
        [activeRide.pickup.lat, activeRide.pickup.lng]
      );
      
      if (distToPickup < ARRIVAL_THRESHOLD_METERS) {
        console.log(`[Proximity Detector] Within ${distToPickup.toFixed(1)}m of pickup. Triggering arrivedAtPickup.`);
        arrivedAtPickup().then(() => {
          toast.success("Mteja amefikiwa! Umewasili eneo la pickup.");
        }).catch(err => {
          console.warn("[Proximity] Auto-arrival trigger failed:", err);
        });
      }
    } 
    // Phase 2: Driver -> Destination (Point B) [ORANGE Route]
    else if (status === 'on_trip') {
      const distToDest = getDistanceDriver(
        [position[0], position[1]], 
        [activeRide.destination.lat, activeRide.destination.lng]
      );
      
      if (distToDest < ARRIVAL_THRESHOLD_METERS) {
        console.log(`[Proximity Detector] Within ${distToDest.toFixed(1)}m of destination. Triggering handleComplete.`);
        handleComplete().catch(err => {
          console.warn("[Proximity] Auto-completion trigger failed:", err);
        });
      }
    }
  }, [isOnline, position, activeRide?.status, activeRide?.id, arrivedAtPickup]);


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

  // Dynamic driver-focused ETA calculations
  const getDistanceDriver = (p1: [number, number], p2: [number, number]) => {
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatTimeDriver = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const amampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minStr} ${amampm}`;
  };

  let etaPickupTextD = "baada ya dakika 5 min";
  if (activeRide && position) {
    const distToPickup = getDistanceDriver([position[0], position[1]], [activeRide.pickup.lat, activeRide.pickup.lng]);
    if (distToPickup < 60 || activeRide.status === "driver_arrived") {
      etaPickupTextD = "UMESHAWASILI!";
    } else {
      const durSecs = distToPickup / 6.5;
      const realDurSecs = Math.max(0, durSecs - (secondsOffset % 30));
      const minsLeft = Math.floor(realDurSecs / 60);
      const secsLeft = Math.floor(realDurSecs % 60);
      etaPickupTextD = `utafika baada ya dk ${minsLeft} s ${secsLeft}`;
    }
  } else if (incomingRequest) {
    etaPickupTextD = "baada ya dakika 5 min";
  }

  let etaDestTextD = "";
  if (activeRide && position) {
    if (activeRide.status === "on_trip") {
      const distToDest = getDistanceDriver([position[0], position[1]], [activeRide.destination.lat, activeRide.destination.lng]);
      const remainingDurSecs = distToDest / 9.5;
      const realRemainingSecs = Math.max(0, remainingDurSecs - (secondsOffset % 30));
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const secsLeft = Math.floor(realRemainingSecs % 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestTextD = `EXPECTED ARRIVE BY ${formatTimeDriver(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
    } else {
      // heading to pickup: total duration = (driver to pickup) + (pickup to destination)
      const distToPickup = getDistanceDriver([position[0], position[1]], [activeRide.pickup.lat, activeRide.pickup.lng]);
      const durToPickupSecs = distToPickup / 6.5;

      const distPickupToDest = getDistanceDriver([activeRide.pickup.lat, activeRide.pickup.lng], [activeRide.destination.lat, activeRide.destination.lng]);
      const durPickupToDestSecs = distPickupToDest / 9.5;

      const totalRemainingSecs = durToPickupSecs + durPickupToDestSecs;
      const realRemainingSecs = Math.max(0, totalRemainingSecs - secondsOffset);
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const secsLeft = Math.floor(realRemainingSecs % 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestTextD = `EXPECTED ARRIVE BY ${formatTimeDriver(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
    }
  } else if (incomingRequest) {
    const distToDest = getDistanceDriver([incomingRequest.pickup.lat, incomingRequest.pickup.lng], [incomingRequest.destination.lat, incomingRequest.destination.lng]);
    const etSecs = distToDest / 9.5;
    const realRemainingSecs = Math.max(0, etSecs - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const secsLeft = Math.floor(realRemainingSecs % 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestTextD = `EXPECTED ARRIVE BY ${formatTimeDriver(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
  } else {
    const realRemainingSecs = Math.max(0, 600 - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const secsLeft = Math.floor(realRemainingSecs % 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestTextD = `EXPECTED ARRIVE BY ${formatTimeDriver(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
  }

  const handleSubmitPoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoiName.trim() || !newPoiPhone.trim() || !newPoiPrice.trim()) {
      toast.error("Tafadhali jaza taarifa zote zinazohitajika.");
      return;
    }

    setIsSubmittingPoi(true);
    try {
      if (paymentMethod === 'wallet') {
        const currentBalance = profile?.walletBalance ?? 0;
        if (currentBalance < 10000) {
          toast.error("Salio lako la Wallet halitoshi! Tafadhali weka salio au tumia malipo ya m-pesa.");
          setIsSubmittingPoi(false);
          return;
        }

        // Deduct wallet balance
        const userRef = doc(db, 'users', user!.uid);
        await updateDoc(userRef, {
          walletBalance: currentBalance - 10000
        });
        
        // Add POI
        await addDoc(collection(db, 'pois'), {
          name: newPoiName,
          type: newPoiType,
          phone: newPoiPhone,
          price: newPoiPrice,
          lat: Number(newPoiLat),
          lng: Number(newPoiLng),
          submittedBy: user?.uid,
          paidAmount: 10000,
          transactionId: 'WLT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          status: 'pending',
          createdAt: serverTimestamp()
        });
      } else {
        // Mobile money simulation
        toast.info("Tafadhali thibitisha ombi la malipo (USSD PUSH TZS 10,000) lililotumwa kwenye simu yako ya " + mobileNumber);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Add POI
        await addDoc(collection(db, 'pois'), {
          name: newPoiName,
          type: newPoiType,
          phone: newPoiPhone,
          price: newPoiPrice,
          lat: Number(newPoiLat),
          lng: Number(newPoiLng),
          submittedBy: user?.uid,
          paidAmount: 10000,
          transactionId: 'MPESA-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      setIsAddPoiModalOpen(false);
      // Reset
      setNewPoiName('');
      setNewPoiPhone('');
      setNewPoiPrice('');
      toast.success("Usajili umekamilika! Huduma yako imetumwa kwa Admin ili iweze kukaguliwa na kuchapishwa.");
    } catch (error) {
      console.error("Error submitting driver service POI:", error);
      toast.error("Imeshindwa kusajili huduma. Tafadhali jaribu tena.");
    } finally {
      setIsSubmittingPoi(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0f] text-[#f0eeff]">
      {/* Top Bar Overlays */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-4 inset-x-4 z-[9999] flex flex-col gap-2"
          >
            {/* Main Header / Navigation Card */}
            <div className="glass-morphism rounded-[18px] py-1.5 px-3 flex flex-col gap-2 shadow-[0_12px_30px_rgba(0,0,0,0.4)] border border-white/10">
              {activeRide ? (
                <>
                  <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
                    <div className="flex flex-col min-w-0">
                      <p className="text-[8px] font-black text-[#8B8BA0] uppercase tracking-widest mb-0.5">UNAKOKWENDA</p>
                      <h2 className="text-xs font-black text-white italic uppercase truncate max-w-[150px] sm:max-w-[200px]">
                        {activeRide.status === 'on_trip' ? activeRide.destination.address : activeRide.pickup.address || 'Pickup Eneo'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2.5 text-right shrink-0">
                      <div className="flex flex-col">
                        <p className="text-[8px] font-black text-[#8B8BA0] uppercase tracking-widest text-right mb-0.5">ETA</p>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-sm font-black text-[#00FF88] italic">
                            {Math.round((steps?.[0]?.duration || 0) / 60) + 2} MIN
                          </span>
                          <div className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-pulse" />
                        </div>
                      </div>
                      {/* Driver profile avatar when active */}
                      <button 
                        onClick={onProfileClick}
                        className="w-7 h-7 rounded-full border-2 border-[#00FF88]/30 overflow-hidden bg-neutral-900 shadow-md hover:border-[#00FF88] active:scale-90 transition-all cursor-pointer animate-pulse"
                        title="Fungua wasifu wako"
                      >
                        <img 
                          src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'Juma'}`} 
                          alt="Driver" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 px-1">
                    <div className="flex justify-between items-center text-[7.5px] font-black uppercase tracking-widest">
                      <span className="text-[#8B8BA0]">TRIP PROGRESS</span>
                      <span className="text-[#00FF88]">
                        {activeRide.status === 'on_trip' ? '65%' : 'ENROUTE'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: activeRide.status === 'on_trip' ? '65%' : '35%' }}
                        className="h-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={toggleMute}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${voiceUnlocked && !isMuted ? 'bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30' : 'bg-white/5 text-[#8B8BA0]'}`}
                    >
                      {voiceUnlocked && !isMuted ? <Volume2 className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    <div>
                      <p className="text-[8px] font-black text-[#8B8BA0] uppercase tracking-widest leading-none mb-0.5">DEREVA</p>
                      <h3 className="text-xs font-black text-white italic uppercase">{profile?.displayName || 'TzNation Driver'}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className={`px-2 py-1 rounded-full border flex items-center gap-1.5 ${isOnline ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#00FF88] animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{isOnline ? 'LIVE' : 'OFFLINE'}</span>
                     </div>
                     {/* Driver Profile Picture on Top Right */}
                     <button
                       onClick={onProfileClick}
                       className="w-8 h-8 rounded-full border-2 border-[#00FF88]/30 overflow-hidden bg-neutral-900 shadow-md hover:border-[#00FF88] active:scale-90 transition-all cursor-pointer inline-flex items-center justify-center p-0"
                       title="Fungua wasifu wako"
                     >
                        <img 
                          src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'Juma'}`} 
                          alt="Driver" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                     </button>
                  </div>
                </div>
              )}
            </div>

            {/* Instruction Bar when Active */}
            <AnimatePresence>
              {activeRide && steps && steps.length > 0 && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="bg-[#00FF88] text-[#0A0A0F] py-2 px-3 rounded-xl shadow-2xl flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-black/10 rounded-lg flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black opacity-60 uppercase tracking-widest mb-0.5">MALINGANISHO</p>
                    <p className="text-xs font-black italic tracking-tight uppercase leading-none truncate">
                      {steps[0].instruction}
                    </p>
                  </div>
                  <div className="text-right shrink-0 pl-2 border-l border-black/10">
                     <p className="text-[8px] font-black opacity-60 uppercase tracking-widest">MITA</p>
                     <p className="text-sm font-black italic tracking-tighter leading-none">{Math.round(steps[0].distance)}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Bottom Status Bar when Active */}
      <AnimatePresence>
        {activeRide && !showPayment && !showRating && !isMinimized && isTripMinimized && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-4 inset-x-4 z-[9999] flex flex-col gap-3 pointer-events-none"
          >
            {/* Speed Indicator */}
            <div className="flex justify-center">
              <div className="glass-morphism rounded-full px-6 py-2 flex items-center gap-3">
                <Gauge className="w-5 h-5 text-[#00FF88]" />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-white italic leading-none">{speed}</span>
                  <span className="text-[8px] font-black text-[#8B8BA0] uppercase">KM/H</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Layer */}
      <div className="absolute inset-0 z-0 bg-[#0a0a0f]">
        <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
           <div className="absolute inset-0 bg-[#0a0a0f]" />
        </div>
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          height: '100%',
          width: '100%'
        }}>
          <MapContainer 
            center={position} 
            zoom={15} 
            maxZoom={22}
            preferCanvas={false}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            touchZoom={true}
            doubleClickZoom={true}
            scrollWheelZoom={true}
            dragging={true}
            className="transition-all duration-1000"
          >
            <TileLayer 
              key={theme}
              url={mapTileUrl}
              attribution=""
              maxZoom={22}
              maxNativeZoom={19}
              detectRetina={true}
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
                  icon={getStartPin(etaPickupTextD)}
                />
                <AnimatedRoute 
                  positions={
                    dynamicRoute && dynamicRoute.length > 0 
                      ? dynamicRoute 
                      : generateSimulatedRoads(position, [incomingRequest.pickup.lat, incomingRequest.pickup.lng])
                  } 
                  color="#FF6B35" 
                />
              </>
            )}

            {activeRide && (
              <>
                {/* Pickup Marker - Only show before trip starts */}
                {activeRide.status !== 'on_trip' && (
                  <Marker 
                    position={[activeRide.pickup.lat, activeRide.pickup.lng]} 
                    icon={getStartPin(etaPickupTextD)} 
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
                )}

                {/* Destination Marker */}
                <Marker 
                  position={[activeRide.destination.lat, activeRide.destination.lng]} 
                  icon={getEndPin(etaDestTextD)} 
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

                {/* 1. Beautiful Underlay & Sliced Overlay Routes */}
                {(() => {
                  const hasRealTripRoute = realTripRoute && realTripRoute.length > 0;
                  const hasFullRoute = activeRide.routeCoords && activeRide.routeCoords.length > 0;
                  const fullTripRoute = hasRealTripRoute
                    ? realTripRoute
                    : (hasFullRoute 
                        ? getNormalizedCoords(activeRide.routeCoords)
                        : generateSimulatedRoads([activeRide.pickup.lat, activeRide.pickup.lng], [activeRide.destination.lat, activeRide.destination.lng]));

                  if (activeRide.status === "on_trip") {
                    const slicedTripRoute = sliceRouteFromCurrentPos(fullTripRoute, position);
                    return (
                      <>
                        {/* Planned trip underlay */}
                        <Polyline
                          positions={fullTripRoute}
                          pathOptions={{
                            color: theme === 'dark' ? '#334155' : '#94a3b8',
                            weight: 6,
                            opacity: 0.5,
                            lineCap: 'round',
                            lineJoin: 'round'
                          }}
                        />
                        {/* Remaining trip path */}
                        {slicedTripRoute.length > 1 && (
                          <AnimatedRoute
                            positions={slicedTripRoute}
                            color="#00E5FF"
                          />
                        )}
                      </>
                    );
                  }

                  if (["accepted", "driver_arriving"].includes(activeRide.status)) {
                    const roadCoordsToUse = (dynamicRoute && dynamicRoute.length > 0)
                      ? dynamicRoute
                      : (driverApproachRouteRef.current.length > 0 ? driverApproachRouteRef.current : generateSimulatedRoads(
                          [position[0], position[1]],
                          [activeRide.pickup.lat, activeRide.pickup.lng]
                        ));

                    // Keep driverApproachRouteRef updated as a fallback reference
                    if (dynamicRoute && dynamicRoute.length > 0) {
                      driverApproachRouteRef.current = dynamicRoute;
                    } else if (driverApproachRouteRef.current.length === 0 && position) {
                      driverApproachRouteRef.current = roadCoordsToUse;
                    }

                    const slicedApproachRoute = sliceRouteFromCurrentPos(
                      roadCoordsToUse,
                      position
                    );

                    return (
                      <>
                        {/* Planned trip path is shown underlay since we haven't started yet */}
                        <Polyline
                          positions={fullTripRoute}
                          pathOptions={{
                            color: theme === 'dark' ? '#334155' : '#cbd5e1',
                            weight: 5,
                            opacity: 0.4,
                            dashArray: '8, 8',
                            lineCap: 'round',
                            lineJoin: 'round'
                          }}
                        />
                        {/* Active driver approach route */}
                        {slicedApproachRoute.length > 1 && (
                          <AnimatedRoute
                            positions={slicedApproachRoute}
                            color="#00E5A0"
                          />
                        )}
                      </>
                    );
                  }

                  // For driver_arrived or other active steps, show the full upcoming trip route animated
                  return (
                    <AnimatedRoute
                      positions={fullTripRoute}
                      color="#00E5FF"
                    />
                  );
                })()}
              </>
            )}

            <MapController position={position} activeRide={activeRide} />
            <MapBoundsUpdater activeRide={activeRide} position={position} />

            {/* Render POIs when a category is selected */}
            {activePoiCategory && (() => {
              const getPoiMarkerIcon = (type: string) => {
                let color = '#3b82f6'; // charging (blue)
                let iconHtml = '';
                
                if (type === 'charging') {
                  color = '#3b82f6'; // blue
                  iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
                } else if (type === 'mechanic') {
                  color = '#10b981'; // green
                  iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
                } else if (type === 'wash') {
                  color = '#f59e0b'; // orange/amber
                  iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
                } else if (type === 'parking') {
                  color = '#ef4444'; // red
                  iconHtml = `<div style="font-family: sans-serif; font-weight: 900; font-size: 13px; color: white; line-height: 1;">P</div>`;
                } else if (type === 'fuel') {
                  color = '#0ea5e9'; // sky-blue
                  iconHtml = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><path d="M3 22h12M4 2h10a2 2 0 0 1 2 2v18M11 2v8M14 13h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"/></svg>`;
                }

                return L.divIcon({
                  html: `
                    <div style="
                      background-color: ${color};
                      border: 2px solid white;
                      border-radius: 50%;
                      width: 28px;
                      height: 28px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                      transform: translate(-4px, -4px);
                    ">
                      ${iconHtml}
                    </div>
                  `,
                  className: 'custom-poi-marker',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                });
              };

              const pois = mergedPois[activePoiCategory as keyof typeof mergedPois] || [];
              return pois.map((poi: any) => (
                <Marker
                  key={poi.id}
                  position={[poi.lat, poi.lng]}
                  icon={getPoiMarkerIcon(poi.type)}
                >
                  <Popup>
                    <div className="p-2.5 max-w-[190px] text-neutral-800 dark:text-neutral-100 font-sans leading-snug">
                      <p className="font-extrabold text-xs uppercase tracking-tight text-neutral-900 dark:text-white mb-1 leading-tight">{poi.name}</p>
                      <div className="h-[2px] w-6 bg-[#00FF88] mb-1.5 rounded-full" />
                      
                      {poi.type === 'charging' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">SPEED: <span className="text-blue-500 font-black">{poi.speed}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">COST: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.cost}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'mechanic' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">STATUS: <span className="text-[#00FF88] font-black">{poi.status}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">PHONE: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.phone}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'wash' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">COST: <span className="text-amber-500 font-black">{poi.price}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">RATING: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.rating}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'parking' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">RATE: <span className="text-red-500 font-black">{poi.rate}</span></p>
                           <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">SLOTS: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.slots}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'fuel' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">PETROL: <span className="text-sky-500 font-black">{poi.petrol}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">DIESEL: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.diesel}</span></p>
                        </div>
                      )}
                      
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&origin=${position[0]},${position[1]}&destination=${poi.lat},${poi.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 justify-center w-full py-1 bg-neutral-950 hover:bg-neutral-900 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[9px] font-black uppercase text-[#00FF88] rounded-md transition-all active:scale-95 text-center leading-none"
                      >
                        NIONGOZE RAMANINI
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ));
            })()}

          </MapContainer>
        </div>
      </div>

      {/* Floating Controls Column on the Right - Ultra Clean & Seamless Alignment */}
      {!isMinimized && (
        <div className="absolute right-4 top-24 z-45 flex flex-col gap-2.5 items-center pointer-events-auto">
          <AppDownloadButton 
            variant="compact" 
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600/15 border border-orange-500/20 text-orange-400 hover:bg-orange-600/25 shadow-lg active:scale-95 transition-all"
          />
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setNextTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 bg-[#111118]/90 backdrop-blur-xl border border-[#1e1e2e] rounded-xl shadow-lg flex items-center justify-center text-white active:scale-95 transition-all"
            title={theme === "dark" ? "Badili kwenda mwangaza" : "Badili kwenda giza"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </motion.button>

          {!activeRide && !incomingRequest && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleEarnings}
                className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center transition-all ${
                  showEarnings ? 'bg-[#7F77DD] border-[#7F77DD] text-white' : 'bg-[#111118]/90 border-[#1e1e2e] text-neutral-500'
                }`}
                title="Tazama au ficha mapato ya leo"
              >
                {showEarnings ? <Eye className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter leading-none">Mapato</span>
              </motion.button>
              
              <button 
                className="w-10 h-10 bg-[#111118]/90 border border-[#1e1e2e] rounded-xl shadow-lg flex items-center justify-center text-neutral-400 active:scale-95 hover:text-white transition-all"
                title="Badilisha muonekano wa ramani"
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Floating Driver Services Column on the Left - Collapse/Expand Panel */}
      {!isMinimized && (
        <div className="absolute left-4 top-24 z-45 flex flex-col gap-2.5 items-center pointer-events-auto">
          {/* Expanded Container */}
          <AnimatePresence>
            {!poisCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2.5 items-center"
              >
                {/* 1. Electric Charging */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePoiCategory(activePoiCategory === 'charging' ? null : 'charging')}
                  className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
                    activePoiCategory === 'charging'
                      ? 'bg-blue-600 border-2 border-white text-white scale-110 shadow-blue-500/30'
                      : 'bg-white text-blue-600 hover:bg-blue-50 border border-neutral-100 dark:bg-[#111118]/90 dark:border-[#1e1e2e] dark:hover:bg-[#181825]'
                  }`}
                  title="Vituo vya Chaji za Umeme"
                >
                  <Zap className="w-5 h-5" />
                </motion.button>

                {/* 2. Mechanic */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePoiCategory(activePoiCategory === 'mechanic' ? null : 'mechanic')}
                  className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
                    activePoiCategory === 'mechanic'
                      ? 'bg-[#10b981] border-2 border-white text-white scale-110 shadow-emerald-500/30'
                      : 'bg-white text-[#10b981] hover:bg-emerald-50 border border-neutral-100 dark:bg-[#111118]/90 dark:border-[#1e1e2e] dark:hover:bg-[#181825]'
                  }`}
                  title="Karakana na Mafundi"
                >
                  <Wrench className="w-5 h-5" />
                </motion.button>

                {/* 3. Car Wash */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePoiCategory(activePoiCategory === 'wash' ? null : 'wash')}
                  className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
                    activePoiCategory === 'wash'
                      ? 'bg-amber-500 border-2 border-white text-white scale-110 shadow-amber-500/30'
                      : 'bg-white text-amber-500 hover:bg-amber-50 border border-neutral-100 dark:bg-[#111118]/90 dark:border-[#1e1e2e] dark:hover:bg-[#181825]'
                  }`}
                  title="Osha Gari na Pikipiki"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.button>

                {/* 4. Parking */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePoiCategory(activePoiCategory === 'parking' ? null : 'parking')}
                  className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
                    activePoiCategory === 'parking'
                      ? 'bg-red-500 border-2 border-white text-white scale-110 shadow-red-500/30'
                      : 'bg-white text-red-500 hover:bg-red-50 border border-neutral-100 dark:bg-[#111118]/90 dark:border-[#1e1e2e] dark:hover:bg-[#181825]'
                  }`}
                  title="Maegesho Salama (Parking)"
                >
                  <ParkingCircle className="w-5 h-5" />
                </motion.button>

                {/* 5. Fuel Station */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePoiCategory(activePoiCategory === 'fuel' ? null : 'fuel')}
                  className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
                    activePoiCategory === 'fuel'
                      ? 'bg-sky-500 border-2 border-white text-white scale-110 shadow-sky-500/30'
                      : 'bg-white text-sky-500 hover:bg-sky-50 border border-neutral-100 dark:bg-[#111118]/90 dark:border-[#1e1e2e] dark:hover:bg-[#181825]'
                  }`}
                  title="Kituo cha Mafuta"
                >
                  <Fuel className="w-5 h-5" />
                </motion.button>

                <div className="w-8 h-[1px] bg-neutral-200 dark:bg-neutral-800 my-0.5" />

                {/* 6. Ongeza/Sajili Huduma (Paid Submission) */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setIsAddPoiModalOpen(true);
                  }}
                  className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center bg-[#00FF88] hover:bg-emerald-400 border-2 border-white text-neutral-950 font-black"
                  title="Sajili/Ongeza Huduma Yako ya Dereva"
                >
                  <Plus className="w-5 h-5 stroke-[3]" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle Button to Collapse or Expand */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setPoisCollapsed(!poisCollapsed);
            }}
            className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center border-2 transition-all ${
              poisCollapsed 
                ? 'bg-[#111118]/95 border-[#1e1e2e] text-[#00FF88] scale-100' 
                : 'bg-emerald-600 border-white text-white scale-110 shadow-emerald-500/20'
            }`}
            title={poisCollapsed ? "Fungua Huduma za Karibu" : "Funga Huduma za Karibu"}
          >
            {poisCollapsed ? (
              <Plus className="w-5 h-5 stroke-[3]" />
            ) : (
              <Minus className="w-5 h-5 stroke-[3]" />
            )}
          </motion.button>
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-neutral-600/30 rounded-full mt-3 z-[9999]" />
        
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
                   {stats.todayEarnings !== undefined ? (
                     <div className="bg-[#1a1a2e] border border-[#7F77DD]/20 p-3 rounded-2xl flex flex-col items-center shadow-lg transition-transform hover:scale-105">
                        <DollarSign className="w-4 h-4 text-emerald-500 mb-0.5" />
                        <p className="text-[7px] font-black text-neutral-400 uppercase">Mapato</p>
                        <p className="text-xs font-black italic text-white flex flex-col items-center leading-tight">
                          <span className="text-[8px] opacity-70 not-italic">TZS</span>
                          {showEarnings ? (stats?.todayEarnings ?? 0).toLocaleString() : "••••••"}
                        </p>
                     </div>
                   ) : (
                     <Skeleton className="h-16 rounded-2xl bg-white/5" />
                   )}
                   
                   {stats.todayTrips !== undefined ? (
                     <div className="bg-[#1a1a2e] border border-[#7F77DD]/20 p-3 rounded-2xl flex flex-col items-center shadow-lg transition-transform hover:scale-105">
                        <Navigation2 className="w-4 h-4 text-emerald-500 mb-0.5" />
                        <p className="text-[7px] font-black text-neutral-400 uppercase">Safari</p>
                        <p className="text-sm font-black italic text-white">{stats.todayTrips}</p>
                     </div>
                   ) : (
                     <Skeleton className="h-16 rounded-2xl bg-white/5" />
                   )}

                   {stats.activeHours !== undefined ? (
                     <div className="bg-[#1a1a2e] border border-[#7F77DD]/20 p-3 rounded-2xl flex flex-col items-center shadow-lg transition-transform hover:scale-105">
                        <Clock className="w-4 h-4 text-amber-500 mb-0.5" />
                        <p className="text-[7px] font-black text-neutral-400 uppercase">Saa</p>
                        <p className="text-sm font-black italic text-white">{stats.activeHours}h</p>
                     </div>
                   ) : (
                     <Skeleton className="h-16 rounded-2xl bg-white/5" />
                   )}
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

            {incomingOrder && (
              <IncomingOrderCard 
                order={incomingOrder}
                onAccept={handleAcceptOrder}
                onDecline={() => {
                  setDeclinedRequests(prev => new Set(prev).add(incomingOrder.id!));
                  setIncomingOrder(null);
                }}
                onTimeout={() => {
                  setDeclinedRequests(prev => new Set(prev).add(incomingOrder.id!));
                  setIncomingOrder(null);
                }}
              />
            )}

            {activeRide && !showPayment && !showRating && (
              <DriverTripSheet 
                ride={activeRide as any}
                onArrive={() => handleUpdateStatus('driver_arrived')}
                onStart={() => handleUpdateStatus('on_trip')}
                onComplete={handleComplete}
                onMessage={() => {
                  setSearchParams({ to: activeRide.customerId });
                  setIsChatOpen(true);
                }}
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

      {/* modal ya kusajili huduma mpya ya dereva */}
      <AnimatePresence>
        {isAddPoiModalOpen && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-[#0c0c12] border border-neutral-800 rounded-3xl w-full max-w-md shadow-[0_20px_50px_rgba(0,255,136,0.15)] flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-[#1e1e2e] flex items-center justify-between bg-[#111118]/80">
                <div>
                  <h3 className="text-base font-black italic tracking-wide text-white uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                    Sajili Huduma Yako
                  </h3>
                  <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Tengeneza kipato kwa madereva wa karibu</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddPoiModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#161622] hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all"
                >
                  <CloseX className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitPoi} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm font-sans">
                {/* Info Note */}
                <div className="p-3 bg-emerald-500/10 border border-[#00FF88]/20 rounded-xl">
                  <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                    <strong className="text-[#00FF88]">Ada ya Usajili TZS 10,000</strong>. Biashara yako itawekwa kwenye ramani na kuonekana kwa madereva wote nchini kwa ajili ya kuwapata wateja na masoko!
                  </p>
                </div>

                {/* Service Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Aina ya Huduma</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'charging', name: '⚡ EV Charger', desc: 'Sajili kituo cha chaji' },
                      { id: 'mechanic', name: '🛠️ Karakana/Fundi', desc: 'Karabati vyombo vya moto' },
                      { id: 'wash', name: '🧼 Osha Gari/Piki', desc: 'Sajili eneo la kuosha' },
                      { id: 'parking', name: '🅿️ Maegesho', desc: 'Sajili eneo la kupaki' },
                      { id: 'fuel', name: '⛽ Kituo cha Mafuta', desc: 'Sajili shell/fuel station' }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewPoiType(type.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                          newPoiType === type.id
                            ? 'bg-[#00FF88]/10 border-[#00FF88] text-[#00FF88]'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <span className="font-extrabold">{type.name}</span>
                        <span className="text-[8.5px] opacity-70 leading-none">{type.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Business Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Jina la Biashara/Huduma</label>
                  <input
                    type="text"
                    required
                    value={newPoiName}
                    onChange={(e) => setNewPoiName(e.target.value)}
                    placeholder="Mfano: Karakana ya Kisasa Mwenge"
                    className="w-full py-2.5 px-3 bg-neutral-900/80 border border-neutral-800 rounded-xl focus:border-[#00FF88] text-white focus:outline-none transition-all placeholder:text-neutral-600 text-xs"
                  />
                </div>

                {/* Phone Contact */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Namba ya Simu ya Huduma</label>
                  <input
                    type="tel"
                    required
                    value={newPoiPhone}
                    onChange={(e) => setNewPoiPhone(e.target.value)}
                    placeholder="Mfano: 0712 345 678"
                    className="w-full py-2.5 px-3 bg-neutral-900/80 border border-neutral-800 rounded-xl focus:border-[#00FF88] text-white focus:outline-none transition-all placeholder:text-neutral-600 text-xs"
                  />
                </div>

                {/* Cost/Pricing Details */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Ada ya Huduma/Maelezo ya Bei</label>
                  <input
                    type="text"
                    required
                    value={newPoiPrice}
                    onChange={(e) => setNewPoiPrice(e.target.value)}
                    placeholder={
                      newPoiType === 'charging' ? "Mfano: TZS 450/kWh" :
                      newPoiType === 'mechanic' ? "Mfano: Kubadilisha Oil TZS 15,000" :
                      newPoiType === 'wash' ? "Mfano: Osha gari ndogo TZS 6,000" :
                      newPoiType === 'parking' ? "Mfano: TZS 1,000 badala ya TZS 2,000/hr" :
                      "Mfano: Petroli TZS 3,110/L"
                    }
                    className="w-full py-2.5 px-3 bg-neutral-900/80 border border-neutral-800 rounded-xl focus:border-[#00FF88] text-white focus:outline-none transition-all placeholder:text-neutral-600 text-xs"
                  />
                </div>

                {/* Loaction display coords */}
                <div className="grid grid-cols-2 gap-2 p-2 bg-neutral-900/60 border border-neutral-800/80 rounded-xl">
                  <div>
                    <span className="text-[8.5px] font-black block text-neutral-500 uppercase leading-none mb-0.5">LATITUDE</span>
                    <span className="font-mono text-[10px] text-white tracking-tight">{newPoiLat?.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-black block text-neutral-500 uppercase leading-none mb-0.5">LONGITUDE</span>
                    <span className="font-mono text-[10px] text-white tracking-tight">{newPoiLng?.toFixed(6)}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Chagua Njia ya Malipo (Ada: TZS 10,000)</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-2 rounded-xl border flex flex-col gap-0.5 transition-all text-left ${
                        paymentMethod === 'wallet'
                          ? 'bg-[#7F77DD]/10 border-[#7F77DD] text-[#7F77DD]'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      <span className="font-extrabold flex items-center gap-1">🏦 Kutoka Wallet</span>
                      <span className="text-[9px] opacity-70">Salio: TZS {(profile?.walletBalance ?? 0).toLocaleString()}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mobile')}
                      className={`p-2 rounded-xl border flex flex-col gap-0.5 transition-all text-left ${
                        paymentMethod === 'mobile'
                          ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      <span className="font-extrabold">📱 Mtandao wa Simu</span>
                      <span className="text-[9px] opacity-70">Tigo, M-pesa, Airtel</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Money Input */}
                {paymentMethod === 'mobile' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-1 overflow-hidden"
                  >
                    <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Namba ya Simu ya Malipo</label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Mfano: 0712345678"
                      className="w-full py-2.5 px-3 bg-neutral-900/80 border border-neutral-800 rounded-xl focus:border-orange-500 text-white focus:outline-none transition-all placeholder:text-neutral-600 text-xs"
                    />
                  </motion.div>
                )}

                {/* Submit button */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddPoiModalOpen(false)}
                    className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-400 font-bold uppercase tracking-wider text-[11px] transition-all"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPoi}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-[#00FF88] text-black font-extrabold uppercase tracking-widest text-[11px] rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmittingPoi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Inatuma...
                      </>
                    ) : (
                      'Lipia & Sajili'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Real-time Responsive Popup Chat for Active Ride */}
        {activeRide && activeRide.customerId && !isChatOpen && (
          <ActiveRideChatPopup
            rideId={rideId || ""}
            user={user}
            recipientId={activeRide.customerId}
            recipientName={activeRide.customerInfo?.name || "Mteja"}
            recipientPhoto={activeRide.customerInfo?.avatar || ""}
            isDriver={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
