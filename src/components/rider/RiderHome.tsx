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
  Volume2, VolumeX, Sun, Moon, Wrench, Sparkles, Plus, Minus, RotateCcw, RotateCw, Compass,
  AlertTriangle, TrafficCone, Wallet, Flame
} from 'lucide-react';
import { AISmartHeatMap, HeatZone } from '../map/AISmartHeatMap';
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
import { Navigation3DHudOverlay } from '../map/Navigation3DHudOverlay';

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
function MapController({ 
  position, 
  activeRide, 
  rotation, 
  manualRotation = 0,
  onRotate,
  is3DMode = false,
  autoFollow,
  setAutoFollow,
  recenterTrigger
}: { 
  position: [number, number], 
  activeRide: any, 
  rotation: number, 
  manualRotation?: number,
  onRotate?: (newRotation: number) => void,
  is3DMode?: boolean,
  autoFollow: boolean,
  setAutoFollow: (val: boolean) => void,
  recenterTrigger: number
}) {
  const map = useMap();
  const hasCentered = React.useRef(false);
  const lastCenterRef = React.useRef<[number, number] | null>(null);

  // Trigger invalidateSize sequentially to fix size issues when loaded on mobile phone or tablet layout
  useEffect(() => {
    const delays = [100, 300, 600, 1200];
    const timers = delays.map(delay => 
      setTimeout(() => {
        try {
          map.invalidateSize();
          if (position && !hasCentered.current) {
            const desiredZoom = activeRide && ['accepted', 'driver_arriving', 'on_trip'].includes(activeRide?.status) ? 18.5 : 17;
            map.setView(position, desiredZoom, { animate: false });
          }
        } catch (e) {
          // ignore
        }
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [map, activeRide?.status, activeRide?.id]);

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

  // Apply live optional clean 3D perspective tilt (No map rotation as per user request, map remains North-Up)
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;

    // Perspective tilt ONLY if user explicitly enabled 3D mode (mild 25deg)
    const perspectiveTilt = is3DMode ? 'perspective(1000px) rotateX(25deg)' : 'none';

    container.style.transform = perspectiveTilt;
    container.style.transformOrigin = 'center center';
    container.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
  }, [map, is3DMode]);

  useEffect(() => {
    if (!position) return;
    
    const desiredZoom = activeRide && ['accepted', 'driver_arriving', 'on_trip'].includes(activeRide?.status) ? 18.5 : 17;

    if (!hasCentered.current) {
      map.setView(position, desiredZoom);
      hasCentered.current = true;
      lastCenterRef.current = position;
      return;
    }
    
    // Only update view if autoFollow is enabled
    if (autoFollow) {
      const currentPos = L.latLng(position[0], position[1]);
      const lastPos = lastCenterRef.current ? L.latLng(lastCenterRef.current[0], lastCenterRef.current[1]) : null;

      // Pan camera smoothly as driver moves (> 2 meters) to keep vehicle centered without lag
      if (!lastPos || currentPos.distanceTo(lastPos) > 2) {
        map.panTo(position, { animate: true, duration: 0.5 });
        lastCenterRef.current = position;
      }
    }
  }, [position?.[0], position?.[1], !!activeRide, autoFollow, activeRide?.status]);
  
  useEffect(() => {
    if (recenterTrigger > 0 && position) {
      const desiredZoom = activeRide && ['accepted', 'driver_arriving', 'on_trip'].includes(activeRide?.status) ? 18.5 : 18;
      map.flyTo(position, desiredZoom, { animate: true, duration: 1.2 });
      lastCenterRef.current = position;
    }
  }, [recenterTrigger, map, position, activeRide]);

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

function PoiMapController({ 
  activePoiCategory, 
  pois, 
  driverPosition 
}: { 
  activePoiCategory: string | null, 
  pois: any[], 
  driverPosition: [number, number] 
}) {
  const map = useMap();
  const lastCategoryRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (activePoiCategory && activePoiCategory !== lastCategoryRef.current && pois.length > 0) {
      const bounds = L.latLngBounds([driverPosition]);
      pois.forEach((poi) => {
        bounds.extend([poi.lat, poi.lng]);
      });
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    }
    lastCategoryRef.current = activePoiCategory;
  }, [activePoiCategory, pois, driverPosition, map]);

  return null;
}



function DriverMarker({ position, rotation, vType }: { position: [number, number], rotation: number, vType: string }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'light' ? 'light' : 'dark';
  return (
    <Marker 
      position={position}
      icon={createDriverMarkerIcon(
        '', // Initial will be handled by parent if needed
        true,
        rotation,
        vType,
        theme,
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

const createTrafficLightIcon = (color: 'red' | 'yellow' | 'green') => {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center">
        <div class="w-7 h-14 bg-neutral-900 border border-neutral-700 rounded-full flex flex-col justify-between items-center p-1.5 shadow-2xl">
          <div class="w-3 h-3 rounded-full ${color === 'red' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-950'} transition-all duration-300"></div>
          <div class="w-3 h-3 rounded-full ${color === 'yellow' ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-yellow-950'} transition-all duration-300"></div>
          <div class="w-3 h-3 rounded-full ${color === 'green' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-emerald-950'} transition-all duration-300 animate-pulse"></div>
        </div>
        <div class="w-1 h-3 bg-neutral-700"></div>
      </div>
    `,
    className: 'custom-leaflet-traffic-light',
    iconSize: [28, 68],
    iconAnchor: [14, 68]
  });
};

const createConstructionIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <div class="absolute inset-0 rounded-full bg-orange-500/20 animate-ping"></div>
        <div class="absolute inset-1 rounded-full border border-orange-500/40 bg-orange-500/10 animate-pulse"></div>
        <div class="relative w-8 h-8 rounded-full bg-orange-600 border border-orange-400 flex items-center justify-center text-sm shadow-xl text-white">
          🚧
        </div>
      </div>
    `,
    className: 'custom-leaflet-construction',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

const createClosedRoadIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <div class="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
        <div class="absolute inset-1 rounded-full border border-red-500/40 bg-red-500/10 animate-pulse"></div>
        <div class="relative w-8 h-8 rounded-full bg-red-600 border border-red-400 flex items-center justify-center text-sm shadow-xl text-white">
          ⛔
        </div>
      </div>
    `,
    className: 'custom-leaflet-closed-road',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

const createCornerIcon = (direction: 'left' | 'right') => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute inset-0 rounded-full border border-amber-500 bg-amber-500/10 animate-pulse"></div>
        <div class="relative w-6 h-6 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center font-bold text-xs shadow-xl text-neutral-900 font-sans">
          ${direction === 'left' ? '↰' : '↱'}
        </div>
      </div>
    `,
    className: 'custom-leaflet-corner',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

interface RiderHomeProps {
  onNavVisibilityChange?: (visible: boolean) => void;
  onProfileClick?: () => void;
}

const pinIconCacheMap: Record<string, L.DivIcon> = {};

export default function RiderHome({ onNavVisibilityChange, onProfileClick }: RiderHomeProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  const [activePoiCategory, setActivePoiCategory] = useState<string | null>(null);
  const [poisCollapsed, setPoisCollapsed] = useState<boolean>(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [manualRotation, setManualRotation] = useState(0);
  const [is3DMode, setIs3DMode] = useState(false);
  const [showRoadAlerts, setShowRoadAlerts] = useState(true);
  const [showHeatMap, setShowHeatMap] = useState<boolean>(true);
  const [heatMapCategory, setHeatMapCategory] = useState<'all' | 'taxi' | 'food' | 'parcel' | 'mart'>('all');
  const [selectedHeatZone, setSelectedHeatZone] = useState<HeatZone | null>(null);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsTab, setEarningsTab] = useState<'mwezi' | 'mwaka' | 'jumla'>('mwezi');
  const [trafficColor, setTrafficColor] = useState<'red' | 'yellow' | 'green'>('green');

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

  const [stablePoiBasePosition, setStablePoiBasePosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (position && !stablePoiBasePosition) {
      setStablePoiBasePosition(position);
    }
  }, [position, stablePoiBasePosition]);

  // Generate simulated POIs centered around driver's stable base position
  const simulatedPois = useMemo(() => {
    const basePos = stablePoiBasePosition || position || [-6.7924, 39.2083];
    const lat = basePos[0];
    const lng = basePos[1];
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
  }, [stablePoiBasePosition, position]);

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

  // Traffic light color changing cycle (switches green/yellow/red every 5s)
  useEffect(() => {
    const timer = setInterval(() => {
      setTrafficColor(prev => {
        if (prev === 'green') return 'yellow';
        if (prev === 'yellow') return 'red';
        return 'green';
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);



  const [rotation, setRotation] = useState(0);
  const [vehicleHeading, setVehicleHeading] = useState(0);
  const simulatedPathRef = React.useRef<[number, number][]>([]);
  const simulatedIndexRef = React.useRef<number>(0);
  const initialPositionRef = React.useRef<[number, number] | null>(null);
  const activeStatusRef = React.useRef<string | null>(null);

  const [showTopInfo, setShowTopInfo] = useState(false);
  const [rideId, setRideIdState] = useState<string | null>(() => {
    return localStorage.getItem('active_ride_id') || localStorage.getItem('active_driver_ride_id') || null;
  });

  const setRideId = React.useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('active_ride_id', id);
      localStorage.setItem('active_driver_ride_id', id);
    } else {
      localStorage.removeItem('active_ride_id');
      localStorage.removeItem('active_driver_ride_id');
    }
    setRideIdState(id);
  }, []);

  const { ride: activeRide } = useRideStatus(rideId);
  const [realTripRoute, setRealTripRoute] = useState<[number, number][]>([]);

  // Road Alerts / Status generator around current position or active route
  const roadAlerts = useMemo(() => {
    const alerts = [];

    if (activeRide) {
      const hasRealTripRoute = realTripRoute && realTripRoute.length > 0;
      const hasFullRoute = activeRide.routeCoords && activeRide.routeCoords.length > 2;
      const route = hasRealTripRoute
        ? realTripRoute
        : (hasFullRoute 
            ? getNormalizedCoords(activeRide.routeCoords)
            : generateSimulatedRoads([activeRide.pickup.lat, activeRide.pickup.lng], [activeRide.destination.lat, activeRide.destination.lng]));

      if (route.length > 5) {
        // Traffic light at 35% of the route
        const midIdx = Math.floor(route.length * 0.35);
        alerts.push({
          id: 'ra-route-light',
          type: 'traffic_light',
          title: 'Taa za Trafiki',
          desc: 'Taa ya barabara kwenye njia yako. Punguza kasi au simama ikileta nyekundu!',
          lat: route[midIdx][0],
          lng: route[midIdx][1]
        });

        // Construction site at 65% of the route
        const constIdx = Math.floor(route.length * 0.65);
        alerts.push({
          id: 'ra-route-construction',
          type: 'construction',
          title: 'Barabara Inatengenezwa',
          desc: 'Kuna mafundi wanatengeneza barabara mbele yako. Punguza kasi sana!',
          lat: route[constIdx][0],
          lng: route[constIdx][1]
        });

        // Closed road marker
        const closedIdx = Math.min(route.length - 2, Math.floor(route.length * 0.8));
        alerts.push({
          id: 'ra-route-closed',
          type: 'closed',
          title: 'Mchepuko / Njia Imefungwa',
          desc: 'Kipande hiki kimefungwa kwa muda, fuata ishara za barabarani kuelekea mchepuko.',
          lat: route[closedIdx][0],
          lng: route[closedIdx][1]
        });

        // Corner detections along the route!
        for (let i = 2; i < route.length - 2; i += 4) {
          const p1 = route[i - 2];
          const p2 = route[i];
          const p3 = route[i + 2];
          
          const bearing1 = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
          const bearing2 = calculateBearing(p2[0], p2[1], p3[0], p3[1]);
          let diff = (bearing2 - bearing1 + 360) % 360;
          if (diff > 180) diff = 360 - diff;
          
          if (diff > 35 && diff < 120) {
            const isLeft = (bearing2 - bearing1 + 360) % 360 > 180;
            alerts.push({
              id: `ra-route-corner-${i}`,
              type: isLeft ? 'corner_left' : 'corner_right',
              title: isLeft ? 'Kona Kali Kushoto' : 'Kona Kali Kulia',
              desc: `Kona kali inayofuata mbele ya mita chache. Chunga usalama wako.`,
              lat: p2[0],
              lng: p2[1]
            });
          }
        }
      }
    } else {
      // Offline / Waiting mode nearby alerts - Real fixed coordinates across Dar es Salaam (Ubungo, Morocco, Mwenge, Posta, Sinza, Jangwani)
      alerts.push(
        // UBUNGO AREA
        { id: 'ra1', type: 'traffic_light', title: 'Taa za Trafiki (Ubungo)', desc: 'Taa za barabarani Ubungo Interchange zinafanya kazi vizuri. Chunga ishara za rangi!', lat: -6.7972, lng: 39.2086 },
        { id: 'ra4', type: 'corner_left', title: 'Kona Kali Kushoto (Ubungo Flyover)', desc: 'Kona hatari wakati wa kushuka kutoka juu ya barabara ya interchange.', lat: -6.7955, lng: 39.2065 },
        
        // MOROCCO / KINONDONI AREA
        { id: 'ra3', type: 'closed', title: 'Njia Imefungwa - Morocco Access', desc: 'Barabara imefungwa karibu na kituo cha mwendokasi cha Morocco, magari yote yanatakiwa kuchepuka.', lat: -6.7885, lng: 39.2604 },
        { id: 'ra-morocco-light', type: 'traffic_light', title: 'Taa za Trafiki (Morocco)', desc: 'Taa za makutano ya Morocco zinafanya kazi vizuri. Zingatia ishara za usalama.', lat: -6.7905, lng: 39.2595 },
        { id: 'ra-morocco-corner', type: 'corner_right', title: 'Kona Kali Kulia (Morocco Loop)', desc: 'Kona kali ya kuingia upande wa Morocco kutoka barabara kuu.', lat: -6.7875, lng: 39.2615 },
        
        // MWENGE AREA
        { id: 'ra-mwenge-light', type: 'traffic_light', title: 'Taa za Trafiki (Mwenge)', desc: 'Taa za makutano makubwa ya Mwenge (karibu na Mlimani City) zinafanya kazi vizuri.', lat: -6.7681, lng: 39.2274 },
        { id: 'ra2', type: 'construction', title: 'Barabara Inajengwa (Sam Nujoma Rd)', desc: 'Matengenezo ya barabara kuu ya Sam Nujoma, mabehewa ya ujenzi yamepaki.', lat: -6.7720, lng: 39.2250 },
        
        // POSTA AREA
        { id: 'ra-posta-light', type: 'traffic_light', title: 'Taa za Trafiki (Posta Mpya)', desc: 'Taa za makutano ya barabara ya Azikiwe na Samora zinasoma vizuri.', lat: -6.8164, lng: 39.2902 },
        { id: 'ra-posta-closed', type: 'closed', title: 'Njia Imefungwa (Kivukoni Front)', desc: 'Kipande cha barabara kimefungwa kwa muda karibu na kivuko kutokana na dharura.', lat: -6.8190, lng: 39.2940 },

        // SINZA AREA
        { id: 'ra-sinza-construction', type: 'construction', title: 'Barabara Inajengwa (Sinza Mori)', desc: 'Maboresho ya miundombinu na uwekaji wa lami mpya kwenye barabara ya kuingia Sinza Mori.', lat: -6.7780, lng: 39.2200 },
        { id: 'ra5', type: 'corner_right', title: 'Kona Kali Kulia (Shekilango)', desc: 'Kona kali ya kuingia mtaa salama upande wa kulia kutokea Shekilango.', lat: -6.7820, lng: 39.2150 },

        // JANGWANI / MSIMBAZI AREA
        { id: 'ra-jangwani-closed', type: 'closed', title: 'Barabara Imefungwa (Jangwani)', desc: 'Njia imefungwa kutokana na maji kupita juu ya daraja la Jangwani, tafadhali tumia michepuko mbadala.', lat: -6.8080, lng: 39.2650 }
      );
    }
    return alerts;
  }, [position, activeRide, realTripRoute]);

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

  // Instantly reflect updated Firestore routeCoords in local map state for rider
  useEffect(() => {
    if (activeRide?.routeCoords && activeRide.routeCoords.length > 2) {
      const normalized = getNormalizedCoords(activeRide.routeCoords);
      if (normalized.length > 0) {
        setRealTripRoute(normalized);
      }
    }
  }, [activeRide?.id, activeRide?.routeCoords ? JSON.stringify(activeRide.routeCoords) : '']);

  useEffect(() => {
    if (!activeRide) {
      driverApproachRouteRef.current = [];
      lastActiveRideIdStatusRef.current = "";
      return;
    }

    const currentKey = `${activeRide.id}_${activeRide.status}`;
    if (lastActiveRideIdStatusRef.current !== currentKey) {
      lastActiveRideIdStatusRef.current = currentKey;
      driverApproachRouteRef.current = [];
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
    // Always connect the active trip line seamlessly to the driver's exact position to avoid any visual gap
    if (sliced.length > 0) {
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
  const vTypeRaw = (profile?.vehicleType || 'mini').toLowerCase();
  const vType = (vTypeRaw.includes('bike') || vTypeRaw.includes('piki')) 
    ? 'bike' 
    : vTypeRaw.includes('bajaj') 
      ? 'bajaj' 
      : (vTypeRaw === 'gari' || vTypeRaw === 'mini')
        ? 'mini'
        : vTypeRaw;
  
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

  const livePositionRef = React.useRef<[number, number]>(position);
  useEffect(() => {
    livePositionRef.current = position;
  }, [position]);

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

  const routingStart = useMemo<[number, number]>(() => {
    if (activeRide) {
      if (activeRide.status === 'on_trip') {
        return [activeRide.pickup.lat, activeRide.pickup.lng];
      }
      if (['accepted', 'driver_arriving', 'driver_arrived'].includes(activeRide.status)) {
        return livePositionRef.current;
      }
    } else if (incomingRequest) {
      return livePositionRef.current;
    }
    return livePositionRef.current;
  }, [activeRide?.id, activeRide?.status, incomingRequest?.id]);

  const { routeCoords: dynamicRoute, steps, isLoading: isRoutingLoading } = useRouting(
    routingStart, 
    routingTarget || routingStart,
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
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isInstructionsHidden, setIsInstructionsHidden] = useState(false);
  
  const mapTileUrl = "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
  
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
       setIsHeaderHidden(false);
       setIsInstructionsHidden(false);
    } else {
       setIsHeaderHidden(false);
       setIsInstructionsHidden(false);
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
    const isInTanzania = (lat: number, lng: number) => {
      return lat <= -1 && lat >= -12 && lng >= 29 && lng <= 41;
    };

    const triggerIpFallback = async () => {
      if (fallbackCalled) return;
      fallbackCalled = true;

      // 1. Try freeipapi.com
      try {
        const ipRes = await fetch("https://freeipapi.com/api/json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number' && ipData.latitude !== 0) {
            if (isInTanzania(ipData.latitude, ipData.longitude)) {
              setPosition([ipData.latitude, ipData.longitude]);
              toast.success(`Eneo lako la sasa limetambuliwa (${ipData.cityName || 'Karibu nawe'}) 📍`);
              return;
            } else {
              console.log("[Simulation] IP location outside Tanzania:", ipData.latitude, ipData.longitude, "- Keeping Dar es Salaam simulated coordinates.");
              toast.info("Mazingira ya Majaribio: Eneo lako limewekwa Dar es Salaam (Ubungo/Tabata) ili uweze kupata maombi ya safari! 📍", { duration: 6000 });
              return;
            }
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
            if (isInTanzania(ipData.latitude, ipData.longitude)) {
              setPosition([ipData.latitude, ipData.longitude]);
              toast.success(`Eneo lako la sasa limetambuliwa (${ipData.city || 'Karibu nawe'}) 📍`);
              return;
            } else {
              console.log("[Simulation] ipwho.is outside Tanzania. Keeping Dar es Salaam.");
              toast.info("Mazingira ya Majaribio: Eneo lako limewekwa Dar es Salaam (Ubungo/Tabata) ili uweze kupata maombi ya safari! 📍", { duration: 6000 });
              return;
            }
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
            if (isInTanzania(ipData.latitude, ipData.longitude)) {
              setPosition([ipData.latitude, ipData.longitude]);
              toast.success(`Eneo lako la sasa limetambuliwa (${ipData.city || 'Karibu nawe'}) 📍`);
              return;
            } else {
              console.log("[Simulation] ipapi.co outside Tanzania. Keeping Dar es Salaam.");
              toast.info("Mazingira ya Majaribio: Eneo lako limewekwa Dar es Salaam (Ubungo/Tabata) ili uweze kupata maombi ya safari! 📍", { duration: 6000 });
              return;
            }
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
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (isInTanzania(lat, lng)) {
            setPosition([lat, lng]);
            toast.success("Eneo lako limepatikana kupitia GPS! 📍");
          } else {
            console.log("[Simulation] GPS location outside Tanzania:", lat, lng, "- Keeping Dar es Salaam simulated coordinates.");
            toast.info("Mazingira ya Majaribio: Eneo lako limewekwa Dar es Salaam (Ubungo/Tabata) ili uweze kupata maombi ya safari! 📍", { duration: 6000 });
          }
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
    const isDark = theme === "dark";
    const cleanAddr = (addr: string) => {
      if (!addr) return "Tafuta eneo la pickup...";
      const parts = addr.split(",");
      if (parts.length > 2) {
        return `${parts[0].trim()}, ${parts[1].trim()}`;
      }
      return addr.length > 24 ? addr.substring(0, 22) + "..." : addr;
    };

    const activePickupAddress = activeRide?.pickup?.address || incomingRequest?.pickup?.address || "Pickup Eneo";
    const displayAddr = cleanAddr(activePickupAddress);
    const key = `rider-start-${isDark}-${displayAddr}-${etaText || ''}`;
    if (pinIconCacheMap[key]) {
      return pinIconCacheMap[key];
    }

    const icon = L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center select-none" style="width: 150px;">
          <!-- DiDi / Uber Style Callout Card Container -->
          <div class="relative flex flex-col items-start w-full transition-transform duration-200 transform hover:scale-105 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]">
            
            <!-- Top Slanted Badge Tab -->
            <div class="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-t-md rounded-tr-xl text-[6.5px] font-bold uppercase tracking-wide leading-none shadow-sm ml-2 z-10 border-t border-x border-emerald-400/40 w-[110px] overflow-hidden">
              <span class="w-1 h-1 rounded-full bg-white animate-pulse shrink-0"></span>
              <div class="overflow-hidden min-w-0 flex-1 relative">
                <span class="badge-text-slide">Recommended Pickup</span>
              </div>
            </div>

            <!-- Main White Address Card -->
            <div class="w-full ${isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-200 text-neutral-900'} border rounded-xl rounded-tl-none p-1.5 px-2 shadow-lg flex items-center justify-between gap-1.5 z-20">
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-[6.5px] font-extrabold text-emerald-500 uppercase tracking-wider leading-none mb-0.5">MAHALI PA KUCHUKULIWA</span>
                <span class="text-[9.5px] font-black truncate leading-tight">${displayAddr}</span>
                ${etaText ? `<span class="text-[7.5px] font-mono font-bold text-emerald-500 mt-0.5 leading-none bg-emerald-500/10 px-1 py-0.2 rounded w-max">${etaText}</span>` : ''}
              </div>
              <div class="w-4 h-4 rounded-full ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'} flex items-center justify-center shrink-0">
                <svg class="w-2.5 h-2.5 stroke-current stroke-[3]" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          </div>

          <!-- Vertical Connecting Stem Line -->
          <div class="w-0.5 h-2.5 bg-emerald-500 shadow-sm z-10 -mt-0.5"></div>

          <!-- Ground Pin Dot Base -->
          <div class="relative flex items-center justify-center -mt-0.5 z-20">
            <div class="absolute w-4 h-4 rounded-full bg-emerald-500/35 animate-ping"></div>
            <div class="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center">
              <div class="w-1 h-1 rounded-full bg-white"></div>
            </div>
          </div>
        </div>
      `,
      iconSize: [150, 68],
      iconAnchor: [75, 65],
    });
    pinIconCacheMap[key] = icon;
    return icon;
  };

  const getEndPin = (etaText: string) => {
    const isDark = theme === "dark";
    const cleanAddr = (addr: string) => {
      if (!addr) return "Tafuta eneo la dropoff...";
      const parts = addr.split(",");
      if (parts.length > 2) {
        return `${parts[0].trim()}, ${parts[1].trim()}`;
      }
      return addr.length > 24 ? addr.substring(0, 22) + "..." : addr;
    };

    const activeDestAddress = activeRide?.destination?.address || incomingRequest?.destination?.address || "Eneo la Kushushwa";
    const displayAddr = cleanAddr(activeDestAddress);
    const key = `rider-end-${isDark}-${displayAddr}-${etaText || ''}`;
    if (pinIconCacheMap[key]) {
      return pinIconCacheMap[key];
    }

    const icon = L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center select-none" style="width: 150px;">
          <!-- DiDi / Uber Style Callout Card Container -->
          <div class="relative flex flex-col items-start w-full transition-transform duration-200 transform hover:scale-105 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]">
            
            <!-- Top Slanted Badge Tab -->
            <div class="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-t-md rounded-tr-xl text-[6.5px] font-bold uppercase tracking-wide leading-none shadow-sm ml-2 z-10 border-t border-x border-amber-400/40 w-[110px] overflow-hidden">
              <span class="w-1 h-1 rounded-full bg-white animate-pulse shrink-0"></span>
              <div class="overflow-hidden min-w-0 flex-1 relative">
                <span class="badge-text-slide">Recommended Drop-off</span>
              </div>
            </div>

            <!-- Main White Address Card -->
            <div class="w-full ${isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-200 text-neutral-900'} border rounded-xl rounded-tl-none p-1.5 px-2 shadow-lg flex items-center justify-between gap-1.5 z-20">
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-[6.5px] font-extrabold text-amber-500 uppercase tracking-wider leading-none mb-0.5">HATIMA YAKO</span>
                <span class="text-[9.5px] font-black truncate leading-tight">${displayAddr}</span>
                ${etaText ? `<span class="text-[7.5px] font-mono font-bold text-amber-500 mt-0.5 leading-none bg-amber-500/10 px-1 py-0.2 rounded w-max">${etaText}</span>` : ''}
              </div>
              <div class="w-4 h-4 rounded-full ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'} flex items-center justify-center shrink-0">
                <svg class="w-2.5 h-2.5 stroke-current stroke-[3]" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          </div>

          <!-- Vertical Connecting Stem Line -->
          <div class="w-0.5 h-2.5 bg-amber-500 shadow-sm z-10 -mt-0.5"></div>

          <!-- Ground Pin Dot Base -->
          <div class="relative flex items-center justify-center -mt-0.5 z-20">
            <div class="absolute w-4 h-4 rounded-full bg-amber-500/35 animate-ping"></div>
            <div class="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow-md flex items-center justify-center">
              <div class="w-1 h-1 rounded-full bg-white"></div>
            </div>
          </div>
        </div>
      `,
      iconSize: [150, 68],
      iconAnchor: [75, 65],
    });
    pinIconCacheMap[key] = icon;
    return icon;
  };

  // Unified location and presence sync using refs to prevent continuous clearing/recreation of intervals
  const positionRef = React.useRef(position);
  positionRef.current = position;
  const rotationRef = React.useRef(rotation);
  rotationRef.current = rotation;
  const vehicleHeadingRef = React.useRef(vehicleHeading);
  vehicleHeadingRef.current = vehicleHeading;

  useEffect(() => {
    if (!isOnline || !user?.uid) return;
    
    // Global presence update (every 10s)
    const presenceInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, 'drivers', user.uid), {
          location: { lat: positionRef.current[0], lng: positionRef.current[1], heading: vehicleHeadingRef.current },
          lastActive: serverTimestamp()
        });
      } catch (e) {
        console.error("Presence update failed", e);
      }
    }, 10000);

    // Ride tracking (every 1.1s for real-time smooth GPS tracking)
    let rideInterval: any;
    if (rideId && activeRide && (activeRide.status === 'accepted' || activeRide.status === 'driver_arriving' || activeRide.status === 'driver_arrived' || activeRide.status === 'on_trip')) {
      rideInterval = setInterval(async () => {
        try {
          await updateDriverLocation(positionRef.current[0], positionRef.current[1], vehicleHeadingRef.current);
          if (user?.uid) {
            await updateDoc(doc(db, 'drivers', user.uid), {
              location: { lat: positionRef.current[0], lng: positionRef.current[1], heading: vehicleHeadingRef.current },
              updatedAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.warn("Ride location sync fail", e);
        }
      }, 1100);
    }

    return () => {
      clearInterval(presenceInterval);
      if (rideInterval) clearInterval(rideInterval);
    };
  }, [isOnline, user?.uid, rideId, activeRide?.status]);

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
      // Support simulating all rides in preview/testing environments, including USSD/SMS bookings!
      const isSimRide = 
        (activeRide as any).isSimulation || 
        (activeRide as any).simulated || 
        activeRide.bookingSource === 'ussd' || 
        activeRide.bookingSource === 'sms' || 
        activeRide.customerId?.startsWith('sms-client-') || 
        activeRide.customerId?.startsWith('meta-client-');

      if (!isSimRide) {
        return;
      }
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
      } else if (!isRoutingLoading) {
        // If route has finished loading a fresh precise route of real streets, Our enableSlicing-based
        // useRouting hook gives us a route starting precisely from the driver's current position to target.
        // We can cleanly re-align the active driver path to the high-precision actual street curves!
        console.log(`[Simulation] Re-aligning driver path to precise OSM/OSRM streets! Points: ${dynamicRoute.length}`);
        
        const oldPosition = position;
        simulatedPathRef.current = [...dynamicRoute];
        activeStatusRef.current = status;
        
        if (oldPosition) {
          // Find the index of the closest point on the brand new path matching our current coordinate
          let minDistance = Infinity;
          let closestIdx = 0;
          for (let i = 0; i < dynamicRoute.length; i++) {
            const latDiff = dynamicRoute[i][0] - oldPosition[0];
            const lngDiff = dynamicRoute[i][1] - oldPosition[1];
            const dist = latDiff * latDiff + lngDiff * lngDiff;
            if (dist < minDistance) {
              minDistance = dist;
              closestIdx = i;
            }
          }
          simulatedIndexRef.current = closestIdx;
        } else {
          simulatedIndexRef.current = 0;
        }
      }
    }
  }, [dynamicRoute, activeRide?.status, isRoutingLoading]);

  // Automatic GPS Simulation Loop for preview/testing environments
  useEffect(() => {
    if (!isOnline || !activeRide) return;

    // Support simulating all rides in preview/testing environments, including USSD/SMS bookings!
    const isSimRide = 
      (activeRide as any).isSimulation || 
      (activeRide as any).simulated || 
      activeRide.bookingSource === 'ussd' || 
      activeRide.bookingSource === 'sms' || 
      activeRide.customerId?.startsWith('sms-client-') || 
      activeRide.customerId?.startsWith('meta-client-');

    if (!isSimRide) return;

    const status = activeRide.status;
    const isMovingStatus = ['accepted', 'driver_arriving', 'on_trip'].includes(status);
    if (!isMovingStatus) return;

    const simInterval = setInterval(async () => {
      const path = simulatedPathRef.current;
      const index = simulatedIndexRef.current;

      if (path && path.length > 0 && index < path.length - 1) {
        // Advance along the path step-by-step (1 step per 1.1s tick) for smooth 54 km/h urban traversal
        const nextIndex = Math.min(index + 1, path.length - 1);
        simulatedIndexRef.current = nextIndex;
        
        const currentCoord = path[index];
        const nextCoord = path[nextIndex];

        if (nextCoord) {
          const bearing = calculateBearing(currentCoord[0], currentCoord[1], nextCoord[0], nextCoord[1]);
          
          console.log(`[Simulation] Moving driver smoothly to [${nextCoord[0].toFixed(5)}, ${nextCoord[1].toFixed(5)}]. Bearing: ${bearing.toFixed(1)}`);
          
          setVehicleHeading(bearing);
          setRotation(prev => {
            let diff = bearing - prev;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            const next = (prev + diff * 0.2) % 360;
            return next < 0 ? next + 360 : next;
          });
          setPosition(nextCoord);
          
          try {
            await updateDriverLocation(nextCoord[0], nextCoord[1], bearing);
            if (user?.uid) {
              await updateDoc(doc(db, 'drivers', user.uid), {
                location: { lat: nextCoord[0], lng: nextCoord[1], heading: bearing },
                updatedAt: serverTimestamp()
              });
            }
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
    }, 1100);

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

  const renderProfileAvatar = (size: 'sm' | 'md' = 'md') => {
    const driverRating = profile?.rating !== undefined && profile?.rating > 0 ? Number(profile.rating) : 4.9;
    
    // Determine Rank details
    let rankName = 'BRONZE';
    if (driverRating >= 4.8) {
      rankName = 'GOLD';
    } else if (driverRating >= 4.5) {
      rankName = 'SILVER';
    }

    const isSm = size === 'sm';
    const widthClass = isSm ? 'w-8 h-8' : 'w-12 h-12';
    
    let borderClass = 'border-amber-500 shadow-[0_0_8px_rgba(241,196,15,0.4)]';
    let ratingBg = 'bg-amber-500';
    if (driverRating >= 4.8) {
      borderClass = 'border-yellow-400 shadow-[0_0_8px_rgba(253,224,71,0.5)]';
      ratingBg = 'bg-yellow-500';
    } else if (driverRating >= 4.5) {
      borderClass = 'border-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.4)]';
      ratingBg = 'bg-slate-500';
    } else {
      borderClass = 'border-amber-700 shadow-[0_0_8px_rgba(180,83,9,0.3)]';
      ratingBg = 'bg-amber-700';
    }

    return (
      <button
        onClick={onProfileClick}
        className={`relative ${widthClass} rounded-full border-2 ${borderClass} overflow-visible bg-white dark:bg-neutral-900 shadow-lg active:scale-90 transition-all cursor-pointer inline-flex items-center justify-center p-0 shrink-0 pointer-events-auto`}
        title={`Wasifu wako - Rank: ${rankName} (${driverRating.toFixed(1)} ★)`}
      >
        <img 
          src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'Juma'}`} 
          alt="Driver" 
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
        />
        {/* Tanzania flag overlay */}
        <div className={`absolute ${isSm ? '-top-1 -right-1 w-3.5 h-2.5' : '-top-0.5 -right-0.5 w-5 h-3.5'} rounded-xs overflow-hidden border border-white shadow flex items-center justify-center`}>
          <svg viewBox="0 0 40 25" className="w-full h-full">
            <rect width="40" height="25" fill="#1EB53A" />
            <polygon points="0,25 40,0 40,25" fill="#00A3E0" />
            <line x1="0" y1="25" x2="40" y2="0" stroke="#FCD116" strokeWidth="8" />
            <line x1="0" y1="25" x2="40" y2="0" stroke="#000000" strokeWidth="4" />
          </svg>
        </div>
        {/* Micro score badge centered at the bottom */}
        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${ratingBg} text-white ${isSm ? 'text-[6.5px] px-1' : 'text-[8.5px] px-1.5 py-0.5'} font-black rounded-full border border-white dark:border-[#111118] flex items-center shadow-md whitespace-nowrap`}>
          <span>{driverRating.toFixed(1)}</span>
        </div>
      </button>
    );
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
  // Real-time Phone Compass Orientation Listener
  // When driver points their phone in any direction, rotate the GPS map and vehicle marker towards that orientation
  useEffect(() => {
    if (!isOnline) return;

    let lastOrientationTime = 0;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastOrientationTime < 60) return; // ~16 updates/sec for silky movement

      let compassHeading: number | null = null;

      // iOS Safari webkitCompassHeading (0 = North, 90 = East, 180 = South, 270 = West)
      if (typeof (e as any).webkitCompassHeading === 'number' && !isNaN((e as any).webkitCompassHeading)) {
        compassHeading = (e as any).webkitCompassHeading;
      } 
      // Standard Android / W3C device orientation
      else if (e.alpha !== null && e.alpha !== undefined && !isNaN(e.alpha)) {
        compassHeading = (360 - e.alpha) % 360;
      }

      if (compassHeading !== null && !isNaN(compassHeading)) {
        lastOrientationTime = now;
        const roundedHeading = Math.round((compassHeading + 360) % 360);

        setRotation(prev => {
          let diff = roundedHeading - prev;
          while (diff < -180) diff += 360;
          while (diff > 180) diff -= 360;
          
          const absDiff = Math.abs(diff);
          if (absDiff < 5) return prev; // Filter out small noise and jitter
          
          // Smoothen using a dampening factor of 0.15 (smoothly glides rather than snapping)
          const step = diff * 0.15;
          const next = (prev + step) % 360;
          return next < 0 ? next + 360 : next;
        });
      }
    };

    // Request iOS orientation permission if required
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        })
        .catch((err: any) => console.warn("DeviceOrientation permission:", err));
    } else {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || !user) return;

    let watchId: number | null = null;
    let lastErrorTime = 0;
    const prevPosRef = { current: null as [number, number] | null };

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
            
            // Check if coordinates are in Tanzania. If not (e.g. testing in simulator), ignore the update
            const isInTanzania = (lat: number, lng: number) => {
              return lat <= -1 && lat >= -12 && lng >= 29 && lng <= 41;
            };
            if (!isInTanzania(loc.lat, loc.lng)) {
              return;
            }

            // Check if simulated ride is in progress.
            const isSimRide = activeRide && (
              (activeRide as any).isSimulation || 
              (activeRide as any).simulated || 
              activeRide.bookingSource === 'ussd' || 
              activeRide.bookingSource === 'sms' || 
              activeRide.customerId?.startsWith('sms-client-') || 
              activeRide.customerId?.startsWith('meta-client-')
            );
            const isSimulating = activeRide && ['accepted', 'driver_arriving', 'on_trip'].includes(activeRide.status) && isSimRide;
            if (isSimulating) {
              return;
            }

            const prev = prevPosRef.current;
            let shouldUpdate = true;
            let currentBearing = vehicleHeadingRef.current;

            // Direct device GPS heading if available
            if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
              currentBearing = Math.round(pos.coords.heading);
              setVehicleHeading(currentBearing);
              setRotation(prev => {
                let diff = currentBearing - prev;
                while (diff < -180) diff += 360;
                while (diff > 180) diff -= 360;
                if (Math.abs(diff) < 5) return prev;
                const next = (prev + diff * 0.15) % 360;
                return next < 0 ? next + 360 : next;
              });
            }

            if (prev) {
              const dist = getDistanceInMeters(prev[0], prev[1], loc.lat, loc.lng);
              // Ignore micro GPS noise (< 0.3 meters), update position immediately for real movement
              if (dist < 0.3) {
                shouldUpdate = false;
              } else {
                if (dist >= 2 && (typeof pos.coords.heading !== 'number' || isNaN(pos.coords.heading) || pos.coords.heading < 0)) {
                  currentBearing = calculateBearing(prev[0], prev[1], loc.lat, loc.lng);
                  setVehicleHeading(currentBearing);
                  setRotation(prev => {
                    let diff = currentBearing - prev;
                    while (diff < -180) diff += 360;
                    while (diff > 180) diff -= 360;
                    if (Math.abs(diff) < 5) return prev;
                    const next = (prev + diff * 0.15) % 360;
                    return next < 0 ? next + 360 : next;
                  });
                }
                setPosition([loc.lat, loc.lng]);
                prevPosRef.current = [loc.lat, loc.lng];
              }
            } else {
              // First location acquired
              setPosition([loc.lat, loc.lng]);
              prevPosRef.current = [loc.lat, loc.lng];
            }

            if (!shouldUpdate) return;

            setLastPosition(prevPosRef.current);
            
            // Update active ride tracking if exists with heading
            if (activeRide) {
              updateDriverLocation(loc.lat, loc.lng, currentBearing);
            }

            // ALWAYS update the public "drivers" collection if online
            // so passengers can see the driver on their map with the heading
            try {
              await updateDoc(doc(db, 'drivers', user.uid), {
                location: { lat: loc.lat, lng: loc.lng, heading: currentBearing },
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
                toast.error("Ruhusa ya GPS imezuiwa au uko kwenye Preview. Tutatumia eneo la majaribio la Dar es Salaam ili uendelee kufanya kazi! 📍", {
                  description: "Ili kutumia GPS yako halisi, bofya alama ya 'Fungua katika Tab Mpya' juu kulia.",
                  duration: 8000
                });
                // DO NOT turn off online! Allow them to test using the default coordinate in the preview iframe
                try {
                  const defaultLat = -6.7924;
                  const defaultLng = 39.2083;
                  updateDoc(doc(db, 'drivers', user.uid), {
                    location: { lat: defaultLat, lng: defaultLng, heading: vehicleHeadingRef.current || 0 },
                    isOnline: true,
                    receiving: true,
                    status: 'online',
                    lastActive: serverTimestamp(),
                    vehicleType: vType
                  });
                } catch (fsErr) {
                  console.warn("Silent location write on GPS error:", fsErr);
                }
              } else if (err.code === 3) {
                toast.error("Imeshindwa kupata Location (Timeout). Kabla hujazima GPS, hakikisha ipo wazi.");
              }
              lastErrorTime = now;
            }
          }, 
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
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

  // Periodic heartbeat interval for online drivers to prevent database staleness filtering
  useEffect(() => {
    if (!isOnline || !user?.uid) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        console.log(`[RiderHome] Heartbeat updating lastActive for driver ${user.uid}`);
        await updateDoc(doc(db, 'drivers', user.uid), {
          lastActive: serverTimestamp(),
          isOnline: true,
          receiving: true,
          status: 'online'
        });
      } catch (err) {
        console.warn("[RiderHome] Heartbeat silent fail:", err);
      }
    }, 25000); // Send heartbeat every 25 seconds

    return () => clearInterval(heartbeatInterval);
  }, [isOnline, user?.uid]);

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
    // We disable automatic completion in the proximity detector to prevent premature trip ending.
    // The driver will manually press the "MALIZA SAFARI" button to complete the trip.
    else if (status === 'on_trip') {
      // Manual completion only
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
    if (activeRide.status === "driver_arrived" || distToPickup < 15) {
      etaPickupTextD = "UMESHAWASILI!";
    } else if (distToPickup < 60) {
      etaPickupTextD = "UNAWASILI SASA...";
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
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestTextD = `Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
    } else {
      // heading to pickup: total duration = (driver to pickup) + (pickup to destination)
      const distToPickup = getDistanceDriver([position[0], position[1]], [activeRide.pickup.lat, activeRide.pickup.lng]);
      const durToPickupSecs = distToPickup / 6.5;

      const distPickupToDest = getDistanceDriver([activeRide.pickup.lat, activeRide.pickup.lng], [activeRide.destination.lat, activeRide.destination.lng]);
      const durPickupToDestSecs = distPickupToDest / 9.5;

      const totalRemainingSecs = durToPickupSecs + durPickupToDestSecs;
      const realRemainingSecs = Math.max(0, totalRemainingSecs - secondsOffset);
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestTextD = `Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
    }
  } else if (incomingRequest) {
    const distToDest = getDistanceDriver([incomingRequest.pickup.lat, incomingRequest.pickup.lng], [incomingRequest.destination.lat, incomingRequest.destination.lng]);
    const etSecs = distToDest / 9.5;
    const realRemainingSecs = Math.max(0, etSecs - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestTextD = `Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
  } else {
    const realRemainingSecs = Math.max(0, 600 - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestTextD = `Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
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
    <div className="relative h-full w-full overflow-hidden bg-neutral-50 dark:bg-[#0a0a0f] text-neutral-900 dark:text-[#f0eeff]">
      {/* Top Bar Overlays */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-4 inset-x-4 z-[9999] grid grid-cols-3 items-center pointer-events-none"
          >
            {/* Left side: Empty placeholder to align center properly */}
            <div className="pointer-events-none" />

            {/* Center side: Compact Earnings Pill */}
            <div className="justify-self-center pointer-events-auto flex items-center bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md rounded-full px-3.5 py-1.5 border border-neutral-200/50 dark:border-white/10 shadow-lg gap-3 select-none">
              {/* Today's Earnings / Leo */}
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                  <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[6.5px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider leading-none">LEO</span>
                  <span className="text-[10px] font-black text-neutral-800 dark:text-white mt-0.5 leading-none whitespace-nowrap">
                    {(stats?.todayEarnings || 0).toLocaleString()} TZS
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-4.5 w-[1px] bg-neutral-200 dark:bg-white/10" />

              {/* Total Earnings / Jumla */}
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/30">
                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[6.5px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider leading-none">JUMLA</span>
                  <span className="text-[10px] font-black text-neutral-800 dark:text-white mt-0.5 leading-none whitespace-nowrap">
                    {(stats?.lifetimeEarnings || 0).toLocaleString()} TZS
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: Profile Avatar */}
            <div className="justify-self-end pointer-events-auto">
              {renderProfileAvatar('md')}
            </div>
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
      <div className="absolute inset-0 z-0 bg-neutral-100 dark:bg-[#0a0a0f]">
        <style>{`
          .leaflet-container {
            background: ${theme === 'dark' ? '#111118' : '#ffffff'} !important;
          }
        `}</style>
        <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
           <div className="absolute inset-0 bg-[#0a0a0f]" />
        </div>
        <div style={{
          borderRadius: '16px',
          overflow: 'hidden',
          height: '100%',
          width: '100%'
        }} className="relative h-full w-full">
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
              key={`${theme}-${mapType}`}
              url={mapType === 'satellite' ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" : mapTileUrl}
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              attribution="&copy; Google Maps"
              maxZoom={22}
              maxNativeZoom={19}
              detectRetina={true}
            />
            
            <Marker 
              position={position}
              icon={createDriverMarkerIcon(
                (profile?.displayName || 'D').split(' ').map(n => n[0]).join(''),
                isOnline,
                vehicleHeading,
                profile?.vehicleType || 'mini',
                theme,
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
                  const hasFullRoute = activeRide.routeCoords && activeRide.routeCoords.length > 2;
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

            <MapController 
              position={position} 
              activeRide={activeRide} 
              rotation={rotation} 
              manualRotation={manualRotation} 
              onRotate={setManualRotation} 
              is3DMode={is3DMode} 
              autoFollow={autoFollow}
              setAutoFollow={setAutoFollow}
              recenterTrigger={recenterTrigger}
            />
            <MapBoundsUpdater activeRide={activeRide} position={position} />
            <PoiMapController 
              activePoiCategory={activePoiCategory} 
              pois={mergedPois[activePoiCategory as keyof typeof mergedPois] || []} 
              driverPosition={position} 
            />

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
                    <div className="p-2.5 max-w-[200px] text-neutral-800 dark:text-neutral-100 font-sans leading-snug">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[7.5px] font-black tracking-widest text-emerald-500 uppercase">SASA HIVI • CURRENT</span>
                      </div>
                      
                      <p className="font-extrabold text-xs uppercase tracking-tight text-neutral-900 dark:text-white mb-1 leading-tight">{poi.name}</p>
                      <div className="h-[2px] w-6 bg-[#00FF88] mb-1.5 rounded-full" />
                      
                      {poi.type === 'charging' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">KASI YA CHAJI: <span className="text-blue-500 font-black">{poi.speed || '120 kW'}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">GHARAMA (COST): <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.cost || 'TZS 450/kWh'}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">MKONDO (CURRENT): <span className="text-neutral-800 dark:text-neutral-200 font-bold">150A (DC LIVE)</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'mechanic' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">HALI (STATUS): <span className="text-[#00FF88] font-black">Wazi (Open Now)</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">SIMU (PHONE): <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.phone || '+255 712 345 678'}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'wash' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">BEI (PRICE): <span className="text-amber-500 font-black">{poi.price || 'TZS 5,000'}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">NYOTA (RATING): <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.rating || '4.8 ⭐'}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'parking' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">BEI YA SASA (RATE): <span className="text-red-500 font-black">{poi.rate || 'TZS 1,000/hr'}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">NAFASI (SLOTS): <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.slots || '15 slots'}</span></p>
                        </div>
                      )}
                      
                      {poi.type === 'fuel' && (
                        <div className="space-y-0.5 text-[10px] mb-2">
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">PETROL: <span className="text-sky-500 font-black">{poi.petrol || 'TZS 3,120/L'}</span></p>
                          <p className="font-semibold text-neutral-500 uppercase text-[8.5px]">DIESEL: <span className="text-neutral-800 dark:text-neutral-200 font-bold">{poi.diesel || 'TZS 3,050/L'}</span></p>
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

            {/* Render Road Alerts (Taa za barabarani, Kona, Matengenezo, Njia imefungwa) */}
            {showRoadAlerts && roadAlerts.map((alert: any) => {
              let icon;
              if (alert.type === 'traffic_light') {
                icon = createTrafficLightIcon(trafficColor);
              } else if (alert.type === 'construction') {
                icon = createConstructionIcon();
              } else if (alert.type === 'closed') {
                icon = createClosedRoadIcon();
              } else {
                icon = createCornerIcon(alert.type === 'corner_left' ? 'left' : 'right');
              }

              return (
                <Marker 
                  key={alert.id} 
                  position={[alert.lat, alert.lng]} 
                  icon={icon}
                >
                  <Popup>
                    <div className="p-3 max-w-[200px] text-center space-y-1 bg-white dark:bg-[#111118] text-neutral-850 dark:text-white rounded-xl">
                      <div className="flex items-center gap-1.5 justify-center mb-1">
                        {alert.type === 'traffic_light' && <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />}
                        {alert.type === 'construction' && <span className="text-orange-500 font-bold">🚧</span>}
                        {alert.type === 'closed' && <span className="text-red-500 font-bold">⛔</span>}
                        <h4 className="font-black text-[11px] uppercase tracking-wider text-neutral-900 dark:text-neutral-100 leading-tight">
                          {alert.title}
                        </h4>
                      </div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                        {alert.desc}
                      </p>
                      <div className="pt-2 text-[8px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                        TAARIFA YA HALI YA NJIA
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* AI Smart Heat Map Overlay Layer */}
            <AISmartHeatMap
              cityName={profile?.city || "Dar es Salaam"}
              userPos={position}
              visible={showHeatMap}
              activeCategory={heatMapCategory}
              onZoneClick={(zone) => setSelectedHeatZone(zone)}
            />

          </MapContainer>
        </div>
      </div>

      {/* AI Smart Demand Heat Map Callout Banner - Positioned below top earnings bar */}
      <AnimatePresence>
        {showHeatMap && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-20 left-4 right-16 sm:left-1/2 sm:-translate-x-1/2 z-[9990] pointer-events-auto sm:max-w-md"
          >
            <div className={`p-3 rounded-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl flex flex-col gap-2 ${
              theme === 'dark'
                ? 'bg-neutral-900/95 border-amber-500/40 text-white'
                : 'bg-white/95 border-amber-500/30 text-neutral-900'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                    <Flame className="w-4 h-4 text-white animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                        🤖 AI Smart Heat Map
                      </span>
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-red-500/15 text-red-500 border border-red-500/30">
                        HIGH DEMAND
                      </span>
                    </div>
                    <p className="text-xs font-black truncate leading-tight mt-0.5">
                      {selectedHeatZone ? `${selectedHeatZone.name} (${selectedHeatZone.surgeRange})` : `Maeneo ya Uhitaji Mkubwa ya Oda`}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (selectedHeatZone) {
                      setSelectedHeatZone(null);
                    } else {
                      setShowHeatMap(false);
                    }
                  }}
                  className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white shrink-0 transition-colors"
                  title="Funga"
                >
                  <CloseX className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[10px] text-neutral-400 dark:text-neutral-400 leading-tight">
                {selectedHeatZone ? selectedHeatZone.descriptionSw : "Elekea maeneo yenye rangi nyekundu/machungwa kupata oda za Taxi, Chakula, Mizigo na Sokoni kwa haraka!"}
              </p>

              {/* Multi-Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-neutral-200/50 dark:border-neutral-800/60">
                {[
                  { id: 'all', label: '🔥 Zote' },
                  { id: 'taxi', label: '🚖 Taxi & Boda' },
                  { id: 'food', label: '🍔 Chakula' },
                  { id: 'parcel', label: '📦 Mizigo' },
                  { id: 'mart', label: '🛒 Sokoni' },
                ].map((cat) => {
                  const isSelected = heatMapCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setHeatMapCategory(cat.id as any)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black whitespace-nowrap transition-all border ${
                        isSelected
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                          : theme === 'dark'
                          ? 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60 hover:bg-neutral-700'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Controls Column on the Right - Ultra Clean & Seamless Alignment */}
      {!isMinimized && (
        <div className="absolute right-4 top-24 z-45 flex flex-col gap-2.5 items-center pointer-events-auto">
          {/* AI Smart Heat Map Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHeatMap(!showHeatMap)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg transition-all ${
              showHeatMap
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-400/60 shadow-orange-500/25'
                : theme === 'dark'
                ? 'bg-white/95 dark:bg-[#111118]/90 border-neutral-200/50 dark:border-[#1e1e2e] text-neutral-400 hover:text-amber-400'
                : 'bg-white/90 border-neutral-200 text-neutral-600 hover:text-amber-600'
            }`}
            title="AI Smart Heatmap (Maeneo ya Uhitaji Mkubwa)"
          >
            <Flame className={`w-5 h-5 ${showHeatMap ? 'text-amber-100 animate-bounce' : 'text-amber-500'}`} />
          </motion.button>
          <AppDownloadButton 
            variant="compact" 
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600/15 border border-orange-500/20 text-orange-400 hover:bg-orange-600/25 shadow-lg active:scale-95 transition-all"
          />
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setNextTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 bg-white/95 dark:bg-[#111118]/90 backdrop-blur-xl border border-neutral-200/50 dark:border-[#1e1e2e] rounded-xl shadow-lg flex items-center justify-center text-neutral-800 dark:text-white active:scale-95 transition-all"
            title={theme === "dark" ? "Badili kwenda mwangaza" : "Badili kwenda giza"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </motion.button>

          {/* Satellite Map Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMapType(mapType === 'satellite' ? 'standard' : 'satellite')}
            className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center transition-all ${
              mapType === 'satellite'
                ? 'bg-[#7F77DD] border-[#7F77DD] text-white shadow-[0_0_12px_rgba(127,119,221,0.4)]'
                : 'bg-white/95 dark:bg-[#111118]/90 border-neutral-200/50 dark:border-[#1e1e2e] text-neutral-500 hover:text-neutral-850 dark:hover:text-white'
            }`}
            title={mapType === 'satellite' ? "Badili kwenda Ramani Kawaida" : "Badili kwenda Ramani ya Satelaiti"}
          >
            <MapIcon className="w-4 h-4" />
            <span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter leading-none">
              {mapType === 'satellite' ? 'Kawaida' : 'Satelaiti'}
            </span>
          </motion.button>

          {/* Recenter Button (IKITE) */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setRecenterTrigger(prev => prev + 1);
              setAutoFollow(true);
            }}
            className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
              autoFollow 
                ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)] animate-pulse'
                : 'bg-white/95 dark:bg-[#111118]/90 border-neutral-200/50 dark:border-[#1e1e2e] text-neutral-500 hover:text-neutral-850 dark:hover:text-white hover:border-purple-500/50'
            }`}
            title="Ikite (Recenter Map)"
          >
            <Compass className={`w-4 h-4 ${autoFollow ? 'text-white' : 'text-purple-500'}`} />
            <span className="text-[6.5px] font-black mt-0.5 uppercase tracking-tighter leading-none">
              Ikite
            </span>
          </motion.button>

          {/* Toggle Road Alerts (Taa, Kona, Matengenezo, Njia Imefungwa) */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowRoadAlerts(!showRoadAlerts);
              toast.success(showRoadAlerts ? "Vituo vya trafiki, kona, na barabara zilizofungwa vimefichwa!" : "Vituo vya trafiki, kona, na barabara zilizofungwa vimeoneshwa kwenye ramani!");
            }}
            className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center transition-all ${
              showRoadAlerts 
                ? 'bg-[#ef4444] border-[#ef4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
                : 'bg-white/95 dark:bg-[#111118]/90 border-neutral-200/50 dark:border-[#1e1e2e] text-neutral-500 hover:text-neutral-850 dark:hover:text-white'
            }`}
            title="Onyesha / Ficha Taa za Trafiki, Kona, na Barabara"
          >
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter leading-none">Hali Njia</span>
          </motion.button>

          {activeRide && (
            <>
              {/* Toggle Safari Details */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsHeaderHidden(!isHeaderHidden)}
                className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center transition-all ${
                  isHeaderHidden 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400' 
                    : 'bg-emerald-500/10 dark:bg-[#00FF88]/10 border-emerald-500/30 dark:border-[#00FF88]/30 text-emerald-600 dark:text-[#00FF88]'
                }`}
                title={isHeaderHidden ? "Onyesha Maelezo ya Safari" : "Ficha Maelezo ya Safari"}
              >
                {isHeaderHidden ? <EyeOff className="w-3.5 h-3.5 animate-pulse" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter leading-none">Safari</span>
              </motion.button>

              {/* Toggle Maelekezo (Ruti) */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsInstructionsHidden(!isInstructionsHidden)}
                className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center transition-all ${
                  isInstructionsHidden 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400' 
                    : 'bg-emerald-500/10 dark:bg-[#00FF88]/10 border-emerald-500/30 dark:border-[#00FF88]/30 text-emerald-600 dark:text-[#00FF88]'
                }`}
                title={isInstructionsHidden ? "Onyesha Maelekezo ya Ruti" : "Ficha Maelekezo ya Ruti"}
              >
                {isInstructionsHidden ? <EyeOff className="w-3.5 h-3.5 animate-pulse" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter leading-none">Ruti</span>
              </motion.button>
            </>
          )}

          {!activeRide && !incomingRequest && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEarningsModal(prev => !prev)}
                className={`w-10 h-10 border rounded-xl shadow-lg flex flex-col items-center justify-center transition-all ${
                  showEarningsModal ? 'bg-[#7F77DD] border-[#7F77DD] text-white' : 'bg-white/95 dark:bg-[#111118]/90 border-neutral-200/50 dark:border-[#1e1e2e] text-neutral-500 hover:text-neutral-850 dark:hover:text-white'
                }`}
                title="Tazama au ficha mapato ya leo"
              >
                {showEarningsModal ? <Eye className="w-3.5 h-3.5 animate-pulse" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter leading-none">Mapato</span>
              </motion.button>
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

      {/* Elegant Floating Power Button when Offline */}
      {!isOnline && !isMinimized && (
        <div className="absolute inset-x-0 bottom-28 z-50 flex flex-col items-center justify-center pointer-events-none">
          {/* Subtle floating instruction label */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 px-3 py-1 bg-neutral-900/90 dark:bg-neutral-950/90 text-white rounded-full text-[8.5px] font-bold tracking-wider uppercase shadow-lg border border-white/10 flex items-center gap-1.5 pointer-events-auto backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            <span>Uko Offline — Gonga uanze</span>
          </motion.div>
          
          <motion.button
            onClick={toggleStatus}
            disabled={isGoingOnline}
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 4px 15px rgba(239,68,68,0.35)",
                "0 10px 25px rgba(239,68,68,0.65)",
                "0 4px 15px rgba(239,68,68,0.35)"
              ]
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-14 h-14 bg-gradient-to-tr from-red-600 to-rose-500 rounded-full border-2 border-white dark:border-[#0a0a0f] flex items-center justify-center cursor-pointer pointer-events-auto transition-all"
            title="Gonga ili uwe Online"
          >
            {isGoingOnline ? (
              <RefreshCw className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Power className="w-5 h-5 text-white" />
            )}
          </motion.button>
        </div>
      )}

      {/* Sleek Floating Status Pill - When Online & Waiting for requests (Replaces large bottom sheet) */}
      {isOnline && !incomingRequest && !activeRide && !incomingOrder && (
        <motion.div 
          key="waiting-pill"
          initial={{ y: 50, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          exit={{ y: 50, opacity: 0 }}
          className="absolute bottom-28 left-4 right-4 max-w-sm mx-auto bg-white/95 dark:bg-[#111118]/95 backdrop-blur-xl border border-neutral-200/60 dark:border-[#1e1e2e] p-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] text-neutral-850 dark:text-white flex items-center justify-between z-50 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">ACTIVE</span>
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 mt-0.5 leading-none">Unangoja maombi ya safari...</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-[#1e1e2e] py-1 px-2.5 rounded-xl">
              <div className="flex flex-col items-center min-w-[32px]">
                <span className="text-[7px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">SAFARI</span>
                <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 leading-none mt-0.5">{stats?.todayTrips ?? 0}</span>
              </div>
              <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800" />
              <div className="flex flex-col items-center min-w-[32px]">
                <span className="text-[7px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">MASAA</span>
                <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 leading-none mt-0.5">{stats?.activeHours ?? 0}h</span>
              </div>
            </div>
            
            <button 
              onClick={toggleStatus}
              className="w-8 h-8 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 active:scale-95 transition-all cursor-pointer"
              title="Gonga kuzima (Offline)"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Interactive Bottom Sheet Container - Only for active states */}
      {isOnline && (incomingRequest || activeRide || incomingOrder) && (
        <motion.div 
          initial={{ y: 0 }}
          animate={{ y: isMinimized ? 1000 : 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          className="absolute inset-x-0 bottom-0 z-50 cursor-grab active:cursor-grabbing"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-neutral-600/30 rounded-full mt-3 z-[9999]" />
          
          <AnimatePresence mode="wait">
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
                theme={theme}
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
              <>
                <Navigation3DHudOverlay
                  ride={activeRide as any}
                  isDriver={true}
                  driverLocation={{ lat: position[0], lng: position[1] }}
                  targetLocation={activeRide.status === 'on_trip' ? activeRide.destination : activeRide.pickup}
                  routeSteps={steps}
                  is3DMode={is3DMode}
                  onToggle3D={() => setIs3DMode(!is3DMode)}
                  onRecenter={() => setRecenterTrigger(prev => prev + 1)}
                  onOpenChat={() => {
                    setSearchParams({ to: activeRide.customerId });
                    setIsChatOpen(true);
                  }}
                  isVoiceMuted={isMuted}
                  onToggleVoice={toggleMute}
                  activeViewersCount={Object.keys((activeRide as any).viewers || {}).length}
                />
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
              </>
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
      )}

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

        {/* modal ya tathmini ya mapato ya dereva */}
        <AnimatePresence>
          {showEarningsModal && (
            <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                className="bg-[#0c0c12] border border-neutral-800 rounded-3xl w-full max-w-xl shadow-[0_20px_50px_rgba(127,119,221,0.2)] flex flex-col overflow-hidden max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-5 border-b border-[#1e1e2e] flex items-center justify-between bg-[#111118]/80">
                  <div>
                    <h3 className="text-base font-black italic tracking-wide text-white uppercase flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#7F77DD] animate-pulse" />
                      Ripoti ya Mapato & Safari
                    </h3>
                    <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Mchanganuo wa mwezi, mwaka na miaka yote</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEarningsModal(false)}
                    className="w-8 h-8 rounded-full bg-[#161622] hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all"
                  >
                    <CloseX className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5 overflow-y-auto flex-1 text-sm font-sans text-neutral-300">
                  {/* Tabs Selector */}
                  <div className="flex bg-[#111118] border border-neutral-800 p-1 rounded-2xl">
                    {[
                      { id: 'mwezi', name: 'Mwezi Huu' },
                      { id: 'mwaka', name: 'Mwaka Huu' },
                      { id: 'jumla', name: 'Miaka yote (Jumla)' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEarningsTab(tab.id as any)}
                        className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all ${
                          earningsTab === tab.id
                            ? 'bg-[#7F77DD] text-white shadow-md'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                        }`}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>

                  {/* Earnings & Safari summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#111118] border border-neutral-800/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                      <TrendingUp className="w-5 h-5 text-[#7F77DD] mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Muda Huu</span>
                      <h4 className="text-sm font-black italic tracking-tight text-white mt-1">
                        TZS {(() => {
                          if (earningsTab === 'mwezi') return (stats.thisMonthEarnings || 0).toLocaleString();
                          if (earningsTab === 'mwaka') return (stats.thisYearEarnings || 0).toLocaleString();
                          return (stats.lifetimeEarnings || 0).toLocaleString();
                        })()}
                      </h4>
                    </div>

                    <div className="bg-[#111118] border border-neutral-800/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                      <Navigation2 className="w-5 h-5 text-emerald-500 mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Safari</span>
                      <h4 className="text-base font-black italic tracking-tight text-white mt-1">
                        {(() => {
                          if (earningsTab === 'mwezi') return stats.thisMonthTrips || 0;
                          if (earningsTab === 'mwaka') return stats.thisYearTrips || 0;
                          return stats.lifetimeTrips || 0;
                        })()}
                      </h4>
                    </div>

                    <div className="bg-[#111118] border border-neutral-800/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                      <Clock className="w-5 h-5 text-amber-500 mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Saa Amilifu</span>
                      <h4 className="text-base font-black italic tracking-tight text-white mt-1">
                        {(() => {
                          const trips = earningsTab === 'mwezi' 
                            ? (stats.thisMonthTrips || 0) 
                            : (earningsTab === 'mwaka' ? (stats.thisYearTrips || 0) : (stats.lifetimeTrips || 0));
                          return (trips * 0.5).toFixed(1) + 'h';
                        })()}
                      </h4>
                    </div>
                  </div>

                  {/* Performance Chart Block */}
                  <div className="bg-[#111118] border border-[#1e1e2e] p-4 rounded-3xl space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-[#7F77DD]" />
                      Mchanganuo wa Grafu
                    </h4>

                    {/* Rendering Custom Bento Bar Chart */}
                    {(() => {
                      let chartData: { label: string; amount: number; count: number }[] = [];
                      if (earningsTab === 'mwezi') {
                        // Show last few months of monthly stats
                        chartData = Object.entries(stats.monthlyStats || {}).map(([key, val]: [string, any]) => ({
                          label: key,
                          amount: val.earnings,
                          count: val.trips
                        }));
                        // If empty, put default mock for current month
                        if (chartData.length === 0) {
                          const swahiliMonths = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"];
                          const currentMonthName = swahiliMonths[new Date().getMonth()];
                          chartData = [{ label: `${currentMonthName} ${new Date().getFullYear()}`, amount: stats.thisMonthEarnings || 0, count: stats.thisMonthTrips || 0 }];
                        }
                      } else if (earningsTab === 'mwaka') {
                        // Show yearly stats per year
                        chartData = Object.entries(stats.yearlyStats || {}).map(([key, val]: [string, any]) => ({
                          label: key,
                          amount: val.earnings,
                          count: val.trips
                        }));
                        if (chartData.length === 0) {
                          chartData = [{ label: `${new Date().getFullYear()}`, amount: stats.thisYearEarnings || 0, count: stats.thisYearTrips || 0 }];
                        }
                      } else {
                        // Multi-year comparison
                        chartData = Object.entries(stats.yearlyStats || {}).map(([key, val]: [string, any]) => ({
                          label: `Mwaka ${key}`,
                          amount: val.earnings,
                          count: val.trips
                        }));
                        if (chartData.length === 0) {
                          chartData = [{ label: `Mwaka ${new Date().getFullYear()}`, amount: stats.lifetimeEarnings || 0, count: stats.lifetimeTrips || 0 }];
                        }
                      }

                      const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

                      return (
                        <div className="space-y-4 pt-2">
                          {chartData.map((data, idx) => {
                            const percentage = (data.amount / maxAmount) * 100;
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                                  <span className="text-neutral-300">{data.label}</span>
                                  <span className="text-emerald-500">TZS {data.amount.toLocaleString()} ({data.count} safari)</span>
                                </div>
                                <div className="w-full h-3 bg-[#1e1e2e] rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="h-full bg-gradient-to-r from-[#7F77DD] to-emerald-500 rounded-full"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Histori ya Safari (Completed Rides history) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      Histori ya Safari Zilizokamilika
                    </h4>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {(!stats.completedRides || stats.completedRides.length === 0) ? (
                        <div className="bg-[#111118]/60 border border-neutral-800/60 p-6 rounded-2xl text-center text-xs text-neutral-500 uppercase tracking-wider font-bold">
                          Hakuna safari zilizokamilika bado.
                        </div>
                      ) : (
                        stats.completedRides.map((ride: any) => (
                          <div key={ride.id} className="bg-[#111118] border border-neutral-800/60 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-[#7F77DD]">{ride.formattedDate}</span>
                                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border border-emerald-500/20 leading-none">Imelipwa</span>
                              </div>
                              <p className="text-[10px] font-bold text-neutral-300 truncate mt-1">
                                📍 {ride.pickup?.name || 'Mahali fulani'} → 🏁 {ride.destination?.name || 'Mahali fulani'}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-black italic text-white text-sm">
                                TZS {(ride.fare || 0).toLocaleString()}
                              </p>
                              <p className="text-[7.5px] uppercase font-black text-neutral-500">Mshahara</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
