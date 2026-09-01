import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-rotate';
import { Skeleton } from '../ui/Skeleton';
import { 
  Bell, Power, Navigation, Fuel, Zap, 
  ParkingCircle, Car, Settings, Phone, Gauge, Eye, EyeOff,
  Navigation2, MessageSquare, MapPin, Star, X as CloseX,
  Clock, TrendingUp, Info, Wifi, Battery, Map as MapIcon,
  CheckCircle2, ArrowRight, RefreshCw, DollarSign, Package, Home, LogOut,
  Volume2, VolumeX, Sun, Moon, Wrench, Sparkles, Plus, Minus, RotateCcw, RotateCw, Compass,
  AlertTriangle, TrafficCone, Wallet, Flame, ChevronRight, Gift, UserPlus, Layers
} from 'lucide-react';
import { AISmartHeatMap, HeatZone } from '../map/AISmartHeatMap';
import { useTheme } from '../../ThemeContext';
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
import { createDriverMarkerIcon, createGoogleMapsDestinationIcon } from '../../utils/driverMarker';
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
import StreetHailModal from './StreetHailModal';
import { AnimatedRoute } from '../map/AnimatedRoute';
import AppDownloadButton from '../AppDownloadButton';
import { Navigation3DHudOverlay } from '../map/Navigation3DHudOverlay';
import { 
  DriverVoice, 
  getDefaultAudioSettings, 
  saveAudioSettings, 
  DriverAudioSettings 
} from '../../utils/driverVoiceAlerts';

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
  isHeadingUp = true,
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
  isHeadingUp?: boolean,
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

  // Apply live dynamic whole map rotation (Waze / Google Maps Navigation Heading-Up vs North-Up)
  const accumulatedRotRef = React.useRef(0);

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;

    if (isHeadingUp && autoFollow && typeof rotation === 'number' && !isNaN(rotation)) {
      const currentNormalized = ((accumulatedRotRef.current % 360) + 360) % 360;
      const targetNormalized = ((rotation % 360) + 360) % 360;
      let diff = targetNormalized - currentNormalized;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      accumulatedRotRef.current = accumulatedRotRef.current + diff;

      const perspectiveTilt = is3DMode ? 'perspective(1000px) rotateX(28deg) ' : '';
      container.style.transform = `${perspectiveTilt}rotateZ(${-accumulatedRotRef.current}deg) scale(1.38)`;
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)';
    } else {
      accumulatedRotRef.current = 0;
      const perspectiveTilt = is3DMode ? 'perspective(1000px) rotateX(25deg)' : 'none';
      container.style.transform = perspectiveTilt;
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    }
  }, [map, is3DMode, isHeadingUp, autoFollow, rotation]);

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

function ZoomHandler({ zoomAction }: { zoomAction: { type: 'in' | 'out' | 'auto', id: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!zoomAction) return;
    if (zoomAction.type === 'in') {
      map.zoomIn(1);
    } else if (zoomAction.type === 'out') {
      map.zoomOut(1);
    } else if (zoomAction.type === 'auto') {
      map.setZoom(17.5, { animate: true });
    }
  }, [zoomAction?.id, map]);
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

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const ROAD_STATUS_POINTS = [
  // UBUNGO AREA
  { id: 'rsp-ubungo-light', type: 'traffic_light', name: 'Mataa – Ubungo', title: 'Taa za Trafiki (Ubungo Interchange)', desc: 'Taa za barabarani Ubungo Interchange zinafanya kazi vizuri. Chunga ishara za rangi!', lat: -6.7972, lng: 39.2086 },
  { id: 'rsp-ubungo-curve', type: 'sharp_curve', name: 'Kona Kali – Ubungo Flyover', title: 'Kona Kali Kushoto (Ubungo Flyover)', desc: 'Kona hatari wakati wa kushuka kutoka juu ya barabara ya interchange.', lat: -6.7955, lng: 39.2065 },

  // MOROCCO / KINONDONI
  { id: 'rsp-morocco-light', type: 'traffic_light', name: 'Mataa – Morocco', title: 'Taa za Trafiki (Morocco)', desc: 'Taa za makutano ya Morocco zinafanya kazi vizuri. Zingatia ishara za usalama.', lat: -6.7905, lng: 39.2595 },
  { id: 'rsp-morocco-closed', type: 'road_closed', name: 'Njia Imefungwa – Morocco', title: 'Njia Imefungwa (Morocco Access)', desc: 'Barabara imefungwa karibu na kituo cha mwendokasi cha Morocco, mabehewa yanachepuka.', lat: -6.7885, lng: 39.2604 },

  // MWENGE & SAM NUJOMA
  { id: 'rsp-mwenge-light', type: 'traffic_light', name: 'Mataa – Mwenge', title: 'Taa za Trafiki (Mwenge)', desc: 'Taa za makutano makubwa ya Mwenge (karibu na Mlimani City) zinafanya kazi vizuri.', lat: -6.7681, lng: 39.2274 },
  { id: 'rsp-nujoma-construction', type: 'road_construction', name: 'Barabara Inajengwa – Sam Nujoma', title: 'Barabara Inajengwa (Sam Nujoma Rd)', desc: 'Matengenezo ya barabara kuu ya Sam Nujoma, mabehewa ya ujenzi yamepaki.', lat: -6.7720, lng: 39.2250 },

  // JANGWANI / MSIMBAZI
  { id: 'rsp-jangwani-closed', type: 'road_closed', name: 'Barabara Imefungwa – Jangwani', title: 'Barabara Imefungwa (Daraja la Jangwani)', desc: 'Njia imefungwa kutokana na maji kupita juu ya daraja la Jangwani, tumia michepuko mbadala.', lat: -6.8080, lng: 39.2650 },

  // POSTA MPYA & KIVUKONI
  { id: 'rsp-posta-light', type: 'traffic_light', name: 'Mataa – Posta Mpya', title: 'Taa za Trafiki (Posta Mpya)', desc: 'Taa za makutano ya barabara ya Azikiwe na Samora zinasoma vizuri.', lat: -6.8164, lng: 39.2902 },
  { id: 'rsp-kivukoni-closed', type: 'road_closed', name: 'Njia Imefungwa – Kivukoni', title: 'Njia Imefungwa (Kivukoni Front)', desc: 'Kipande cha barabara kimefungwa kwa muda karibu na kivuko kutokana na dharura.', lat: -6.8190, lng: 39.2940 },

  // SINZA & SHEKILANGO
  { id: 'rsp-sinza-construction', type: 'road_construction', name: 'Barabara Inajengwa – Sinza Mori', title: 'Barabara Inajengwa (Sinza Mori)', desc: 'Maboresho ya miundombinu na uwekaji wa lami mpya kwenye barabara ya kuingia Sinza Mori.', lat: -6.7780, lng: 39.2200 },
  { id: 'rsp-shekilango-curve', type: 'sharp_curve', name: 'Kona Kali – Shekilango', title: 'Kona Kali Kulia (Shekilango)', desc: 'Kona kali ya kuingia mtaa salama upande wa kulia kutokea Shekilango.', lat: -6.7820, lng: 39.2150 },

  // TAZARA & VICTORIA
  { id: 'rsp-tazara-light', type: 'traffic_light', name: 'Mataa – Tazara Flyover', title: 'Taa za Trafiki (Tazara Flyover)', desc: 'Taa za makutano ya Nyerere Road na Mandela Road (Tazara) zinafanya kazi vizuri.', lat: -6.8290, lng: 39.2450 },
  { id: 'rsp-victoria-light', type: 'traffic_light', name: 'Mataa – Victoria', title: 'Taa za Trafiki (Victoria Bagamoyo Rd)', desc: 'Taa za makutano ya Victoria katika barabara ya Bagamoyo zinafanya kazi vyema.', lat: -6.7785, lng: 39.2505 }
];

const createAnchoredRoadStatusIcon = (
  type: string,
  name: string,
  isNearby: boolean,
  distMeters?: number,
  trafficColor: 'red' | 'yellow' | 'green' = 'green'
) => {
  let iconContent = '';
  let bgColor = 'bg-emerald-600';

  if (type === 'traffic_light') {
    const lightDot = trafficColor === 'red' ? 'bg-red-500' : trafficColor === 'yellow' ? 'bg-yellow-400' : 'bg-emerald-400';
    iconContent = `
      <div class="w-5 h-5 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center shadow-md">
        <span class="w-2 h-2 rounded-full ${lightDot}"></span>
      </div>
    `;
    bgColor = 'bg-neutral-900';
  } else if (type === 'road_construction' || type === 'construction') {
    iconContent = `
      <div class="w-5 h-5 rounded-full bg-amber-500 border border-white text-[10px] flex items-center justify-center shadow-md text-white">
        🚧
      </div>
    `;
  } else if (type === 'road_closed' || type === 'closed') {
    iconContent = `
      <div class="w-5 h-5 rounded-full bg-red-600 border border-white text-[10px] flex items-center justify-center shadow-md text-white">
        ⛔
      </div>
    `;
  } else {
    // sharp_curve / corner
    const isLeft = type === 'corner_left';
    iconContent = `
      <div class="w-5 h-5 rounded-full bg-amber-600 border border-white text-[9px] font-bold flex items-center justify-center shadow-md text-white">
        ${isLeft ? '↰' : '↱'}
      </div>
    `;
  }

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center transition-transform hover:scale-125" style="transform: translate(-50%, -50%);">
        ${iconContent}
      </div>
    `,
    className: 'custom-road-hazard-pin',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const createTrafficLightIcon = (color: 'red' | 'yellow' | 'green') => {
  return createAnchoredRoadStatusIcon('traffic_light', 'Mataa', false, undefined, color);
};

const createConstructionIcon = () => {
  return createAnchoredRoadStatusIcon('road_construction', 'Barabara Inajengwa', false);
};

const createClosedRoadIcon = () => {
  return createAnchoredRoadStatusIcon('road_closed', 'Njia Imefungwa', false);
};

const createCornerIcon = (direction: 'left' | 'right') => {
  return createAnchoredRoadStatusIcon(direction === 'left' ? 'corner_left' : 'corner_right', 'Kona Kali', false);
};

interface RiderHomeProps {
  onNavVisibilityChange?: (visible: boolean) => void;
  onProfileClick?: () => void;
  onNavigateTab?: (tab: 'wallet' | 'subscription' | 'sacco' | 'aicredit' | 'incentive' | 'settings') => void;
}

const pinIconCacheMap: Record<string, L.DivIcon> = {};

const MIN_REQUIRED_ONLINE_BALANCE = 3000;

export default function RiderHome({ onNavVisibilityChange, onProfileClick, onNavigateTab }: RiderHomeProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(false);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);
  const [driverAudioSettings, setDriverAudioSettings] = useState<DriverAudioSettings>(getDefaultAudioSettings());
  const lastAlertedRequestId = React.useRef<string | null>(null);
  const lastAlertedOrderId = React.useRef<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [zoomAction, setZoomAction] = useState<{ type: 'in' | 'out' | 'auto', id: number } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [position, setPosition] = useState<[number, number]>([-6.7924, 39.2083]);
  const [activePoiCategory, setActivePoiCategory] = useState<string | null>(null);
  const [poisCollapsed, setPoisCollapsed] = useState<boolean>(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [manualRotation, setManualRotation] = useState(0);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isHeadingUp, setIsHeadingUp] = useState(true);
  const [showRoadAlerts, setShowRoadAlerts] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState<boolean>(false);
  const [heatMapCategory, setHeatMapCategory] = useState<'all' | 'taxi' | 'food' | 'parcel' | 'mart'>('all');
  const [selectedHeatZone, setSelectedHeatZone] = useState<HeatZone | null>(null);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsTab, setEarningsTab] = useState<'mwezi' | 'mwaka' | 'jumla'>('mwezi');
  const [trafficColor, setTrafficColor] = useState<'red' | 'yellow' | 'green'>('green');
  const [isStreetHailModalOpen, setIsStreetHailModalOpen] = useState(false);
  const [showMapToolsMenu, setShowMapToolsMenu] = useState(false);
  const [activePromoTab, setActivePromoTab] = useState<'bonus' | 'streetHail'>('bonus');
  const [dismissedPromo, setDismissedPromo] = useState(false);

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

  // Road Alerts / Status generator anchored at specific fixed map coordinates
  const roadAlerts = useMemo(() => {
    const userLat = position ? position[0] : null;
    const userLng = position ? position[1] : null;

    return ROAD_STATUS_POINTS.map(point => {
      let distanceMeters = 999999;
      if (userLat !== null && userLng !== null) {
        distanceMeters = getDistanceInMeters(userLat, userLng, point.lat, point.lng);
      }
      const isNearby = distanceMeters <= 500;
      return {
        ...point,
        distanceMeters,
        isNearby
      };
    });
  }, [position]);

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
  const vTypeRaw = (profile?.vehicleType || profile?.driverType || profile?.driverRegVehicle || 'pikipiki').toLowerCase();
  const vType = (vTypeRaw.includes('bike') || vTypeRaw.includes('piki') || vTypeRaw.includes('boda') || vTypeRaw.includes('motorcycle') || vTypeRaw.includes('rider')) 
    ? 'bike' 
    : vTypeRaw.includes('bajaj') 
      ? 'bajaj' 
      : (vTypeRaw === 'gari' || vTypeRaw === 'mini' || vTypeRaw === 'car' || vTypeRaw === 'taxi')
        ? 'mini'
        : 'bike';
  
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
    true,
    activeRide?.status === 'on_trip' ? (activeRide as any)?.stops : undefined
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
        const topRequest = freshRequests[0];
        setIncomingRequest(topRequest);
        if (topRequest?.id && lastAlertedRequestId.current !== topRequest.id) {
          lastAlertedRequestId.current = topRequest.id;
          DriverVoice.incomingRide(
            (topRequest.pickup as any)?.name || topRequest.pickup?.address || 'Eneo la Karibu',
            (topRequest.destination as any)?.name || topRequest.destination?.address || 'Kituo cha Mwisho',
            topRequest.fare || 0
          );
        }
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
        const topOrder = freshOrders[0];
        setIncomingOrder(topOrder);
        if (topOrder?.id && lastAlertedOrderId.current !== topOrder.id) {
          lastAlertedOrderId.current = topOrder.id;
          DriverVoice.incomingParcel(
            (topOrder as any).pickup?.address || (topOrder as any).deliveryAddress || (topOrder as any).restaurantName || 'Eneo la Mteja',
            (topOrder as any).totalAmount || (topOrder as any).fare || 5000
          );
        }
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
    const activeCustomer = activeRide?.customerInfo || incomingRequest?.customerInfo;
    const customerPhoto = activeCustomer?.photo || activeCustomer?.avatar || (activeRide?.customerId ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRide.customerId}` : (incomingRequest?.customerId ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingRequest.customerId}` : null));
    const customerName = activeCustomer?.name || "Mteja";

    const key = `rider-start-scaled-${isDark}-${displayAddr}-${etaText || ''}-${customerPhoto || ''}`;
    if (pinIconCacheMap[key]) {
      return pinIconCacheMap[key];
    }

    const icon = L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center select-none transform scale-[0.7] origin-bottom" style="width: 175px;">
          <!-- DiDi / Uber Style Callout Card Container -->
          <div class="relative flex flex-col items-start w-full transition-transform duration-200 transform hover:scale-105 filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.25)]">
            
            <!-- Top Slanted Badge Tab -->
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-t-lg rounded-tr-xl text-[7.5px] font-black uppercase tracking-wider leading-none shadow-md ml-2 z-10 border-t border-x border-emerald-400/40">
              <span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
              <span class="font-black whitespace-nowrap">PICKUP</span>
            </div>
          </div>

          <!-- Main White Address Card -->
          <div class="w-full ${isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-200 text-neutral-900'} border rounded-xl rounded-tl-none p-1.5 px-2 shadow-lg flex items-center justify-between gap-1.5 z-20">
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-[6.5px] font-extrabold text-emerald-500 uppercase tracking-wider leading-none mb-0.5">MAHALI PA KUCHUKULIWA</span>
              <span class="text-[9.5px] font-black truncate leading-tight">${displayAddr}</span>
              ${etaText ? `<span class="text-[7.5px] font-mono font-bold text-emerald-500 mt-0.5 leading-none bg-emerald-500/10 px-1 py-0.2 rounded w-max">${etaText}</span>` : ''}
            </div>
            
            <!-- Customer Profile Picture Avatar -->
            <div class="w-6.5 h-6.5 rounded-full border-2 border-emerald-500 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 shadow-sm flex items-center justify-center">
              ${customerPhoto 
                ? `<img src="${customerPhoto}" class="w-full h-full object-cover" alt="${customerName}" />`
                : `<span class="text-[9px] font-black text-emerald-600">${customerName.charAt(0)}</span>`
              }
            </div>
          </div>
        </div>

        <!-- Vertical Connecting Stem Line -->
        <div class="w-0.5 h-2.5 bg-emerald-500 shadow-sm z-10 -mt-0.5"></div>

        <!-- Ground Pin Dot Base -->
        <div class="relative flex items-center justify-center -mt-0.5 z-20">
          <div class="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
        </div>
      </div>
    `,
    iconSize: [175, 68],
    iconAnchor: [87, 68],
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
  const key = `rider-end-scaled-${isDark}-${displayAddr}-${etaText || ''}`;
  if (pinIconCacheMap[key]) {
    return pinIconCacheMap[key];
  }

  const icon = L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative flex flex-col items-center select-none transform scale-[0.7] origin-bottom" style="width: 175px;">
        <!-- DiDi / Uber Style Callout Card Container -->
        <div class="relative flex flex-col items-start w-full transition-transform duration-200 transform hover:scale-105 filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.25)]">
          
          <!-- Top Slanted Badge Tab -->
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-t-lg rounded-tr-xl text-[7.5px] font-black uppercase tracking-wider leading-none shadow-md ml-2 z-10 border-t border-x border-amber-400/40">
            <span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
            <span class="font-black whitespace-nowrap">DROP-OFF</span>
          </div>

          <!-- Main White Address Card -->
          <div class="w-full ${isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-200 text-neutral-900'} border rounded-xl rounded-tl-none p-1.5 px-2 shadow-lg flex items-center justify-between gap-1.5 z-20">
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-[6.5px] font-extrabold text-amber-500 uppercase tracking-wider leading-none mb-0.5">HATIMA YAKO</span>
              <span class="text-[9.5px] font-black truncate leading-tight">${displayAddr}</span>
              ${etaText ? `<span class="text-[7.5px] font-mono font-bold text-amber-500 mt-0.5 leading-none bg-amber-500/10 px-1.5 py-0.5 rounded w-max">${etaText}</span>` : ''}
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
          <div class="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-md flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
        </div>
      </div>
    `,
    iconSize: [175, 68],
    iconAnchor: [87, 68],
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
      // Initialize simulation path only when status changes or when path is empty
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

    // Pre-paid Minimum Balance Rule for Pay-As-You-Go drivers:
    // If not on an active PapoPass subscription (0%), driver must have at least MIN_REQUIRED_ONLINE_BALANCE (TZS 3,000)
    if (nextStatus) {
      const isSubActive = profile?.subscription?.status === 'active' && 
        profile?.subscription?.expiresAt && 
        new Date(profile.subscription.expiresAt).getTime() > Date.now();
      
      const currentBalance = profile?.walletBalance ?? 0;

      if (!isSubActive && currentBalance < MIN_REQUIRED_ONLINE_BALANCE) {
        DriverVoice.lowBalance(currentBalance);
        setShowLowBalanceModal(true);
        return;
      }
    }

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
    const lastFsWriteRef = { current: 0 };

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
            
            // Throttle Firestore location writes to at most once every 6 seconds (or 4s during active ride)
            // to save battery and prevent mobile overheating!
            const now = Date.now();
            const writeIntervalMs = activeRide ? 4000 : 6000;
            if (now - lastFsWriteRef.current >= writeIntervalMs) {
              lastFsWriteRef.current = now;

              if (activeRide) {
                updateDriverLocation(loc.lat, loc.lng, currentBearing);
              }

              try {
                await updateDoc(doc(db, 'drivers', user.uid), {
                  location: { lat: loc.lat, lng: loc.lng, heading: currentBearing },
                  isOnline: true,
                  receiving: true,
                  status: 'online',
                  lastActive: serverTimestamp(),
                  vehicleType: vType
                });
              } catch (err) {
                console.warn("Silent location sync fail:", err);
              }
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
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
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
        DriverVoice.arrivedAtPickup();
        toast.success("Umefika kwa mteja!");
      } else if (status === 'on_trip') {
        await startTrip();
        DriverVoice.tripStarted((activeRide?.destination as any)?.name || activeRide?.destination?.address);
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
      DriverVoice.tripCompleted(activeRide.fare);
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
      const currentKm = (distToDest / 1000).toFixed(1);
      const remainingDurSecs = distToDest / 9.5;
      const realRemainingSecs = Math.max(0, remainingDurSecs - (secondsOffset % 30));
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestTextD = `${currentKm} km • Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
    } else {
      // heading to pickup: total duration = (driver to pickup) + (pickup to destination)
      const distToPickup = getDistanceDriver([position[0], position[1]], [activeRide.pickup.lat, activeRide.pickup.lng]);
      const durToPickupSecs = distToPickup / 6.5;

      const distPickupToDest = getDistanceDriver([activeRide.pickup.lat, activeRide.pickup.lng], [activeRide.destination.lat, activeRide.destination.lng]);
      const tripKm = activeRide.distance && Number(activeRide.distance) > 0 ? Number(activeRide.distance).toFixed(1) : (distPickupToDest / 1000).toFixed(1);
      const durPickupToDestSecs = distPickupToDest / 9.5;

      const totalRemainingSecs = durToPickupSecs + durPickupToDestSecs;
      const realRemainingSecs = Math.max(0, totalRemainingSecs - secondsOffset);
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestTextD = `${tripKm} km • Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
    }
  } else if (incomingRequest) {
    const distPickupToDest = getDistanceDriver([incomingRequest.pickup.lat, incomingRequest.pickup.lng], [incomingRequest.destination.lat, incomingRequest.destination.lng]);
    const tripKm = incomingRequest.distance && Number(incomingRequest.distance) > 0 ? Number(incomingRequest.distance).toFixed(1) : (distPickupToDest / 1000).toFixed(1);

    const etSecs = distPickupToDest / 9.5;
    const realRemainingSecs = Math.max(0, etSecs - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestTextD = `${tripKm} km • Kufika: ${formatTimeDriver(etaTime)} (dk ${minsLeft})`;
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
            className="absolute top-3 inset-x-2.5 sm:inset-x-4 z-[9999] flex items-center justify-between gap-1.5 sm:gap-2.5 pointer-events-none"
          >
            {/* Left side: Financial Status Badge */}
            {!activeRide ? (
              <div className="pointer-events-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateTab) {
                      onNavigateTab('subscription');
                    } else if (onProfileClick) {
                      onProfileClick();
                    }
                  }}
                  className="flex items-center gap-1.5 bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md rounded-full px-2.5 py-1.5 sm:px-3 sm:py-1.5 border border-neutral-200/50 dark:border-white/10 shadow-lg text-left active:scale-95 transition-transform"
                >
                  {profile?.subscription?.status === 'active' ? (
                    <>
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <span className="text-[10px]">🔥</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[6.5px] font-black uppercase text-amber-600 dark:text-amber-400 leading-none">PAPOPASS</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-black text-neutral-800 dark:text-white mt-0.5 leading-none whitespace-nowrap">0% Kamisheni</span>
                      </div>
                    </>
                  ) : (profile?.walletBalance ?? 0) < 0 ? (
                    <>
                      <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                        <span className="text-[10px]">⚡</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[6.5px] font-black uppercase text-rose-600 dark:text-rose-400 leading-none">AI OVERDRAFT</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-black text-rose-600 dark:text-rose-400 mt-0.5 leading-none whitespace-nowrap">
                          -TZS {Math.abs(profile?.walletBalance ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <span className="text-[10px]">👛</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[6.5px] font-black uppercase text-emerald-600 dark:text-emerald-400 leading-none">MKOBA</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-black text-neutral-800 dark:text-white mt-0.5 leading-none whitespace-nowrap">
                          {(profile?.walletBalance ?? 0).toLocaleString()} TZS
                        </span>
                      </div>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="pointer-events-none" />
            )}

            {/* Center side: Compact Earnings Pill - Only when NO active ride */}
            {!activeRide ? (
              <div className="pointer-events-auto flex items-center bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md rounded-full px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 border border-neutral-200/50 dark:border-white/10 shadow-lg gap-2 sm:gap-3 select-none min-w-0 shrink">
                {/* Today's Earnings / Leo */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                    <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[6px] sm:text-[6.5px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider leading-none">LEO</span>
                    <span className="text-[9px] sm:text-[10px] font-black text-neutral-800 dark:text-white mt-0.5 leading-none whitespace-nowrap">
                      {(stats?.todayEarnings || 0).toLocaleString()} TZS
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-4 w-[1px] bg-neutral-200 dark:bg-white/10 shrink-0" />

                {/* Total Earnings / Jumla */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/30">
                    <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[6px] sm:text-[6.5px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider leading-none">JUMLA</span>
                    <span className="text-[9px] sm:text-[10px] font-black text-neutral-800 dark:text-white mt-0.5 leading-none whitespace-nowrap">
                      {(stats?.lifetimeEarnings || 0).toLocaleString()} TZS
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pointer-events-none" />
            )}

            {/* Right side: Profile Avatar (only when no active ride) */}
            {!activeRide && (
              <div className="pointer-events-auto shrink-0">
                {renderProfileAvatar('md')}
              </div>
            )}
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
          .leaflet-control-attribution,
          .leaflet-control-rotate,
          .leaflet-control-compass,
          .leaflet-control-bearing,
          .leaflet-rotate-control {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
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
            zoomControl={false}
            attributionControl={false}
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
                vType,
                theme,
                rotation,
                undefined
              )}
            >
              <Popup className="custom-driver-vehicle-popup">
                <div className="p-3 text-center min-w-[190px]">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
                    <span className="text-xl">
                      {vType === 'bike' ? '🏍️' : vType === 'bajaj' ? '🛺' : '🚗'}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-xs text-neutral-900 dark:text-white uppercase tracking-tight">
                    {profile?.displayName || 'Usafiri Wangu'}
                  </h4>
                  <p className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {vType === 'bike' ? 'Pikipiki (BodaBoda)' : vType === 'bajaj' ? 'Bajaji (TukTuk)' : 'Gari (Taxi)'}
                  </p>
                  <div className="mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-[10px] text-neutral-600 dark:text-neutral-400">
                    <span>Namba: <strong className="text-neutral-900 dark:text-white">{profile?.licensePlate || 'T 123 ABC'}</strong></span>
                    <span className={`px-1.5 py-0.5 rounded-full font-black text-[9px] ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAutoFollow(true);
                      setRecenterTrigger(Date.now());
                      setZoomAction({ type: 'auto', id: Date.now() });
                      toast.success("Ramani imelenga usafiri wako kikamilifu! 🎯");
                    }}
                    className="mt-2.5 w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Navigation2 className="w-3 h-3 rotate-45" />
                    Lenga Usafiri
                  </button>
                </div>
              </Popup>
            </Marker>

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

                {/* Destination Marker (Classic Google Red Pin during trip navigation) */}
                <Marker 
                  position={[activeRide.destination.lat, activeRide.destination.lng]} 
                  icon={activeRide.status === 'on_trip' 
                    ? createGoogleMapsDestinationIcon(activeRide.destination?.address ? (activeRide.destination.address.length > 20 ? `${activeRide.destination.address.substring(0, 18)}...` : activeRide.destination.address) : 'Eneo la Kushusha')
                    : getEndPin(etaDestTextD)
                  } 
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

                {/* Intermediate Stops Markers for Driver */}
                {activeRide.stops && Array.isArray(activeRide.stops) && activeRide.stops.map((stop: any, idx: number) => {
                  if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return null;
                  const stopLabel = stop.address ? (stop.address.length > 18 ? `${stop.address.substring(0, 18)}...` : stop.address) : `Kituo #${idx + 1}`;
                  return (
                    <Marker
                      key={`driver-stop-pin-${stop.id || idx}`}
                      position={[stop.lat, stop.lng]}
                      icon={L.divIcon({
                        className: "driver-custom-stop-marker",
                        html: `
                          <div class="relative flex flex-col items-center pointer-events-none">
                            <div class="bg-amber-500 text-slate-950 font-black text-[9.5px] px-2 py-0.5 rounded-full shadow-xl border-2 border-white flex items-center gap-1 whitespace-nowrap">
                              <span>📍 Kituo #${idx + 1}: ${stopLabel}</span>
                            </div>
                            <div class="w-2.5 h-2.5 bg-amber-500 rotate-45 -mt-1 border-r-2 border-b-2 border-white shadow-md"></div>
                          </div>
                        `,
                        iconSize: [120, 34],
                        iconAnchor: [60, 34],
                      })}
                    >
                      <Popup>
                        <div className="p-2 text-center">
                          <p className="font-bold text-amber-600">Kituo cha Safari #{idx + 1}</p>
                          <p className="text-xs text-slate-700">{stop.address}</p>
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&origin=${position[0]},${position[1]}&destination=${stop.lat},${stop.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 underline mt-1 inline-block"
                          >
                            Elekea Kituo hiki (Google Maps)
                          </a>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

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
                        {/* Remaining active trip path connected seamlessly to current driver position */}
                        {slicedTripRoute.length > 1 && (
                          <AnimatedRoute
                            positions={slicedTripRoute}
                            color="#2563EB"
                            showTrafficSegments={true}
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
                    <>
                      <AnimatedRoute
                        positions={fullTripRoute}
                        color="#2563EB"
                        showTrafficSegments={true}
                      />
                      {/* On-Road 3D Floating Turn Callout Marker (Google Maps Exact Match) */}
                      {steps && steps.length > 0 && (() => {
                        const activeTurnStep = steps.find(s => s.distance > 15 && s.distance < 1200 && s.location);
                        if (!activeTurnStep) return null;
                        const instr = activeTurnStep.instruction.toLowerCase();
                        const isLeft = instr.includes('left') || instr.includes('kushoto');
                        const isRight = instr.includes('right') || instr.includes('kulia');
                        const symbol = isLeft ? '↖' : isRight ? '↗' : '↑';
                        const roadName = activeTurnStep.instruction.replace(/^(Head|Turn|Continue|Merge|Keep|Ingia|Kata|Endelea)\s*(left|right|straight|onto|kushoto|kulia)?\s*/i, '').trim() || 'Njia Kuu';
                        
                        const turnCalloutIcon = L.divIcon({
                          html: `
                            <div style="
                              background: #1E40AF;
                              color: white;
                              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                              font-weight: 800;
                              font-size: 11px;
                              padding: 4px 10px;
                              border-radius: 14px;
                              box-shadow: 0 4px 14px rgba(0,0,0,0.45);
                              border: 2px solid white;
                              white-space: nowrap;
                              display: flex;
                              align-items: center;
                              gap: 6px;
                              position: relative;
                              transform: translate(-50%, -120%);
                              pointer-events: none;
                            ">
                              <span style="font-size: 13px; font-weight: 900; color: #93C5FD;">${symbol}</span>
                              <span style="letter-spacing: -0.2px;">${roadName.length > 20 ? roadName.substring(0, 20) + '...' : roadName}</span>
                              <div style="
                                position: absolute;
                                bottom: -6px;
                                left: 50%;
                                transform: translateX(-50%);
                                width: 0;
                                height: 0;
                                border-left: 5px solid transparent;
                                border-right: 5px solid transparent;
                                border-top: 6px solid #1E40AF;
                              "></div>
                            </div>
                          `,
                          className: 'on-road-turn-callout',
                          iconSize: [0, 0],
                          iconAnchor: [0, 0]
                        });

                        return (
                          <Marker
                            key={`turn-step-${activeTurnStep.location[0]}-${activeTurnStep.location[1]}`}
                            position={[activeTurnStep.location[0], activeTurnStep.location[1]]}
                            icon={turnCalloutIcon}
                          />
                        );
                      })()}
                    </>
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
              isHeadingUp={isHeadingUp}
              autoFollow={autoFollow}
              setAutoFollow={setAutoFollow}
              recenterTrigger={recenterTrigger}
            />
            <ZoomHandler zoomAction={zoomAction} />
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

            {/* Render Anchored Road Status Points with Location Name Labels and Proximity Alert */}
            {showRoadAlerts && roadAlerts.map((alert: any) => {
              const icon = createAnchoredRoadStatusIcon(
                alert.type,
                alert.name || alert.title || 'Eneo La Njia',
                alert.isNearby,
                alert.distanceMeters,
                trafficColor
              );

              return (
                <Marker 
                  key={alert.id} 
                  position={[alert.lat, alert.lng]} 
                  icon={icon}
                >
                  <Popup>
                    <div className="p-3 max-w-[210px] text-center space-y-1 bg-white dark:bg-[#111118] text-neutral-850 dark:text-white rounded-xl shadow-2xl">
                      <div className="flex items-center gap-1.5 justify-center mb-1">
                        {alert.type === 'traffic_light' && <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                        {(alert.type === 'road_construction' || alert.type === 'construction') && <span className="text-orange-500 font-bold">🚧</span>}
                        {(alert.type === 'road_closed' || alert.type === 'closed') && <span className="text-red-500 font-bold">⛔</span>}
                        <h4 className="font-black text-[11px] uppercase tracking-wider text-neutral-900 dark:text-neutral-100 leading-tight">
                          {alert.title || alert.name}
                        </h4>
                      </div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                        {alert.desc}
                      </p>
                      {alert.isNearby && alert.distanceMeters !== undefined && (
                        <div className="mt-1 px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-black uppercase tracking-wide">
                          ⚠️ UPO KARIBU: {Math.round(alert.distanceMeters)}m
                        </div>
                      )}
                      <div className="pt-1.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
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

      {/* Floating Controls Column on the Right - Ultra Clean, Minimalist & Modern */}
      {!isMinimized && (
        <div className="absolute right-3.5 top-20 z-40 flex flex-col gap-2 items-end pointer-events-auto">
          {/* Main Map Tools Flyout Menu */}
          <AnimatePresence>
            {showMapToolsMenu && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-white/95 dark:bg-[#111118]/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-[#1e1e2e] p-2.5 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.25)] flex flex-col gap-1.5 min-w-[170px] mb-1"
              >
                <div className="flex items-center justify-between px-1.5 pb-1 border-b border-neutral-100 dark:border-neutral-800/80">
                  <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Mipangilio ya Ramani</span>
                  <button 
                    onClick={() => setShowMapToolsMenu(false)}
                    className="w-4 h-4 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  >
                    <CloseX className="w-3 h-3" />
                  </button>
                </div>

                {/* 1. Theme Toggle */}
                <button
                  onClick={() => setNextTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
                    <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">Mwonekano</span>
                  </div>
                  <span className="text-[9px] font-black uppercase text-neutral-400">
                    {theme === 'dark' ? 'Giza' : 'Mwangaza'}
                  </span>
                </button>

                {/* 2. Satellite Mode */}
                <button
                  onClick={() => setMapType(mapType === 'satellite' ? 'standard' : 'satellite')}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapIcon className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">Satelaiti</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${mapType === 'satellite' ? 'bg-blue-500/15 text-blue-500' : 'text-neutral-400'}`}>
                    {mapType === 'satellite' ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* 3. Audio & Voice Alerts */}
                <button
                  onClick={() => {
                    const newSound = !driverAudioSettings.soundEnabled;
                    const newVoice = !driverAudioSettings.voiceEnabled;
                    const updated = {
                      ...driverAudioSettings,
                      soundEnabled: newSound,
                      voiceEnabled: newVoice
                    };
                    setDriverAudioSettings(updated);
                    saveAudioSettings(updated);
                    if (newSound || newVoice) {
                      DriverVoice.testVoice();
                      toast.success("Sauti na milio ya dereva imewashwa!");
                    } else {
                      toast.info("Sauti na milio ya dereva imezimwa.");
                    }
                  }}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {driverAudioSettings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
                    <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">Sauti / Mwongozo</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${driverAudioSettings.soundEnabled ? 'bg-emerald-500/15 text-emerald-500' : 'text-neutral-400'}`}>
                    {driverAudioSettings.soundEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* 4. Road Hazards & Traffic Lights */}
                <button
                  onClick={() => {
                    setShowRoadAlerts(!showRoadAlerts);
                    toast.success(showRoadAlerts ? "Vituo vya barabara vimefichwa" : "Vituo vya barabara na taa za trafiki vimeoneshwa");
                  }}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">Hali ya Njia</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${showRoadAlerts ? 'bg-rose-500/15 text-rose-500' : 'text-neutral-400'}`}>
                    {showRoadAlerts ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* 5. Earnings details button */}
                <button
                  onClick={() => {
                    setShowEarningsModal(prev => !prev);
                    setShowMapToolsMenu(false);
                  }}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">Ripoti ya Mapato</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-neutral-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Right Side Actions (Clean & Compact Stack of 4) */}
          <div className="flex flex-col gap-2 items-center bg-white/95 dark:bg-[#111118]/95 backdrop-blur-xl border border-neutral-200/60 dark:border-[#1e1e2e] p-1.5 rounded-2xl shadow-lg">
            {/* 1. Recenter / Auto-Follow Vehicle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setAutoFollow(true);
                setRecenterTrigger(Date.now());
                setZoomAction({ type: 'auto', id: Date.now() });
                toast.success("Ramani imelenga usafiri wako!");
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                autoFollow 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' 
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              title="Lenga na Fuatilia Usafiri Wako (Auto-Follow)"
            >
              <Navigation2 className={`w-4 h-4 rotate-45 ${autoFollow ? 'fill-white' : ''}`} />
            </motion.button>

            {/* 2. Zoom In / Zoom Out Controls */}
            <div className="flex flex-col border-t border-b border-neutral-200/60 dark:border-neutral-800/80 my-0.5 py-0.5">
              <button
                onClick={() => setZoomAction({ type: 'in', id: Date.now() })}
                className="w-9 h-7 flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:text-emerald-500 transition-colors"
                title="Zoom In"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
              <button
                onClick={() => setZoomAction({ type: 'out', id: Date.now() })}
                className="w-9 h-7 flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:text-emerald-500 transition-colors"
                title="Zoom Out"
              >
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* 3. AI Smart Heat Map Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowHeatMap(!showHeatMap)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                showHeatMap
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30'
                  : 'text-amber-500 hover:bg-amber-500/10'
              }`}
              title="AI Smart Heatmap (Maeneo ya Uhitaji)"
            >
              <Flame className="w-4 h-4" />
            </motion.button>

            {/* 4. Layers & Map Settings Flyout Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMapToolsMenu(prev => !prev)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                showMapToolsMenu
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              title="Mipangilio na Zana za Ramani"
            >
              <Layers className="w-4 h-4" />
            </motion.button>
          </div>
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

                {/* 6. Street Hail / Pakia Mteja Papo Hapo */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsStreetHailModalOpen(true)}
                  className="w-10 h-10 rounded-full shadow-xl flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border-2 border-white text-white font-black shadow-emerald-500/40"
                  title="Pakia & Alika Mteja Hapo Hapo (Street Hail)"
                >
                  <UserPlus className="w-5 h-5 stroke-[2.5]" />
                </motion.button>

                <div className="w-8 h-[1px] bg-neutral-200 dark:bg-neutral-800 my-0.5" />

                {/* 7. Ongeza/Sajili Huduma (Paid Submission) */}
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

      {/* Sleek Master Driver Bottom Dock (Clean, Organized & Free of Clutter) */}
      {isOnline && !incomingRequest && !activeRide && !incomingOrder && (
        <div className="absolute bottom-20 sm:bottom-24 inset-x-3.5 max-w-md mx-auto z-40 pointer-events-none flex flex-col items-center gap-2">
          {/* 1. Slim Switchable / Dismissible Promo Pill */}
          {!dismissedPromo && (
            <motion.div
              key="promo-ticker"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 15, opacity: 0 }}
              className="w-full bg-white/95 dark:bg-[#111118]/95 backdrop-blur-xl border border-neutral-200/60 dark:border-[#1e1e2e] py-1.5 px-3 rounded-full shadow-lg flex items-center justify-between gap-2 pointer-events-auto select-none"
            >
              {activePromoTab === 'bonus' ? (
                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('incentive') : null}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                    <Flame className="w-3 h-3 animate-bounce" />
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0 text-left">
                    <span className="text-[8.5px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider shrink-0">
                      BONASI +15%
                    </span>
                    <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 truncate">
                      Kamilisha safari upate hadi TZS 20,000
                    </span>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setIsStreetHailModalOpen(true)}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                    <Gift className="w-3 h-3" />
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0 text-left">
                    <span className="text-[8.5px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider shrink-0">
                      STREET HAIL
                    </span>
                    <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 truncate">
                      Pakia mteja papo hapo • Punguzo TZS 1,000
                    </span>
                  </div>
                </div>
              )}

              {/* Action buttons on the right of the slim promo pill */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePromoTab(prev => prev === 'bonus' ? 'streetHail' : 'bonus')}
                  className="px-2 py-0.5 rounded-full text-[8.5px] font-black bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 transition-colors"
                  title="Badili ofa"
                >
                  {activePromoTab === 'bonus' ? 'Ofa ya 2 ➔' : 'Ofa ya 1 ➔'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedPromo(true)}
                  className="w-5 h-5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                  title="Funga"
                >
                  <CloseX className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. Unified Master Driver Dock */}
          <motion.div 
            key="master-dock"
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 20, opacity: 0 }}
            className="w-full bg-white/95 dark:bg-[#111118]/95 backdrop-blur-2xl border border-neutral-200/70 dark:border-[#1e1e2e] p-2.5 sm:p-3 rounded-2xl shadow-[0_12px_35px_rgba(0,0,0,0.18)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.55)] text-neutral-850 dark:text-white flex items-center justify-between pointer-events-auto gap-2"
          >
            {/* Status Indicator */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">ONLINE</span>
                <span className="text-[11px] sm:text-xs font-bold text-neutral-700 dark:text-neutral-200 mt-0.5 leading-none truncate">
                  Unasubiri safari...
                </span>
              </div>
            </div>

            {/* Middle Stats Badge */}
            <div className="flex items-center gap-2 bg-neutral-100/80 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-[#1e1e2e] py-1 px-2 rounded-xl shrink-0">
              <div className="flex flex-col items-center min-w-[26px]">
                <span className="text-[6.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">SAFARI</span>
                <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 leading-none mt-0.5">{stats?.todayTrips ?? 0}</span>
              </div>
              <div className="h-3.5 w-[1px] bg-neutral-300 dark:bg-neutral-800" />
              <div className="flex flex-col items-center min-w-[26px]">
                <span className="text-[6.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">MASAA</span>
                <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 leading-none mt-0.5">{stats?.activeHours ?? 0}h</span>
              </div>
            </div>

            {/* Quick Actions (Street Hail + Offline) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsStreetHailModalOpen(true)}
                className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-colors"
                title="Pakia mteja papo hapo (Street Hail)"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Pakia</span>
              </motion.button>
              
              <button 
                onClick={toggleStatus}
                className="w-8 h-8 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Gonga kuzima (Offline)"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Top Google Maps Turn-by-Turn Navigation HUD for Driver */}
      {isOnline && activeRide && !showPayment && !showRating && (
        <Navigation3DHudOverlay
          ride={activeRide as any}
          isDriver={true}
          driverLocation={{ lat: position[0], lng: position[1] }}
          targetLocation={activeRide.status === 'on_trip' ? activeRide.destination : activeRide.pickup}
          routeSteps={steps}
          is3DMode={is3DMode}
          onToggle3D={() => setIs3DMode(!is3DMode)}
          isHeadingUp={isHeadingUp}
          onToggleHeadingUp={() => setIsHeadingUp(!isHeadingUp)}
          onRecenter={() => {
            setAutoFollow(true);
            setRecenterTrigger(prev => prev + 1);
          }}
          onOpenChat={() => {
            setSearchParams({ to: activeRide.customerId });
            setIsChatOpen(true);
          }}
          isVoiceMuted={isMuted}
          onToggleVoice={toggleMute}
          onSpeak={speak}
          driverPhoto={profile?.photoURL || user?.photoURL}
          driverName={(profile as any)?.name || profile?.displayName || user?.displayName || 'Dereva'}
          driverRating={profile?.rating || 5.0}
          onProfileClick={onProfileClick}
          activeViewersCount={Object.keys((activeRide as any).viewers || {}).length}
        />
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
      )}

      {/* Modern Emerald GPS Recenter & Locate-Me Button for Driver (Both on-trip & idle/offline) */}
      <motion.button
        key="driver-gps-locate-floating-btn"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setAutoFollow(true);
          setRecenterTrigger(Date.now());
          setZoomAction({ type: 'auto', id: Date.now() });
          if (activeRide) {
            setIsHeadingUp(true);
          }
          toast.success("Ramani imelenga eneo lako la sasa!");
        }}
        className={`fixed sm:absolute z-[48] w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(0,0,0,0.18)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] border transition-all duration-300 pointer-events-auto cursor-pointer group ${
          activeRide
            ? (isTripMinimized || isMinimized ? 'bottom-28 sm:bottom-32 right-3.5 sm:right-5' : 'bottom-[295px] sm:bottom-[315px] right-3.5 sm:right-5')
            : (isOnline ? 'bottom-[155px] sm:bottom-[165px] right-3.5 sm:right-5' : 'bottom-28 sm:bottom-32 right-3.5 sm:right-5')
        } ${
          theme === 'dark'
            ? 'bg-[#111118]/95 border-neutral-700/80 text-emerald-400 hover:border-emerald-500/60 shadow-black/70'
            : 'bg-white/95 border-neutral-200/90 text-emerald-600 hover:border-emerald-500/60 shadow-neutral-400/30'
        }`}
        title="Lenga Eneo Lako la Sasa (Locate Me)"
      >
        {/* Soft Mint/Emerald Circular Halo Ring matching exact screenshot */}
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
          autoFollow 
            ? 'bg-emerald-500/20 dark:bg-emerald-500/30 ring-2 ring-emerald-500/50' 
            : 'bg-emerald-500/12 dark:bg-emerald-500/20 group-hover:bg-emerald-500/25'
        }`}>
          {/* Emerald GPS Crosshair Target Icon with Center Dot and 4 Axis Lines */}
          <svg 
            viewBox="0 0 24 24" 
            className={`w-6 h-6 sm:w-7 sm:h-7 text-[#00B14F] dark:text-[#00FF88] transition-transform ${
              autoFollow ? 'scale-105' : 'group-hover:scale-110'
            }`} 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            {/* Outer Target Circle */}
            <circle cx="12" cy="12" r="7" />
            {/* Center Filled Dot */}
            <circle cx="12" cy="12" r="2.8" fill="currentColor" />
            {/* 4 Extended Crosshair Lines */}
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
          </svg>
        </div>

        {/* Pulsing Emerald Beacon Indicator when locked onto driver location */}
        {autoFollow && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-[#111118]"></span>
          </span>
        )}
      </motion.button>

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

        {/* Low Balance / Pre-paid Requirement Modal for 10% Pay-As-You-Go */}
        <AnimatePresence>
          {showLowBalanceModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 text-center relative overflow-hidden"
              >
                {/* Background accent */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Warning Icon Badge */}
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                  <Wallet className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 rounded-full border border-amber-500/20">
                    MFUMO WA 10% KAMISHENI
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                    Salio Halitoshi Kuingia Online
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed pt-1">
                    Ili kuanza kupokea wateja kwenye <b>Mfumo wa Kawaida wa Kamisheni (10%)</b>, unahitaji kuwa na salio la kuanzia la angalau <b>TZS 3,000</b> kwenye Mkoba wako.
                  </p>
                </div>

                {/* Balance breakdown card */}
                <div className="bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5 text-left">
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral-500">Salio Lako Sasa:</span>
                    <span className="font-black text-rose-500">TZS {(profile?.walletBalance ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral-500">Kiwango cha Chini:</span>
                    <span className="font-black text-neutral-800 dark:text-white">TZS 3,000</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-500">Upungufu:</span>
                    <span className="font-black text-amber-600 dark:text-amber-400">
                      TZS {Math.max(0, 3000 - (profile?.walletBalance ?? 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Or PapoPass Callout */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-3 rounded-2xl text-left flex items-center gap-2.5">
                  <span className="text-lg">🔥</span>
                  <div className="text-[10.5px]">
                    <p className="font-black text-amber-600 dark:text-amber-400 uppercase">Hutaki kukatwa 10%?</p>
                    <p className="text-neutral-600 dark:text-neutral-400">Washa <b>PapoPass (TZS 2,000/siku)</b> upate 0% kamisheni bila kuhitaji salio la mkoba!</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLowBalanceModal(false);
                      if (onNavigateTab) {
                        onNavigateTab('wallet');
                      } else if (onProfileClick) {
                        onProfileClick();
                      }
                    }}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 border-0 outline-none active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" /> Weka Salio Sasa (Top Up)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowLowBalanceModal(false);
                      if (onNavigateTab) {
                        onNavigateTab('subscription');
                      } else if (onProfileClick) {
                        onProfileClick();
                      }
                    }}
                    className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black uppercase text-xs tracking-wider shadow-md flex items-center justify-center gap-1.5 border-0 outline-none active:scale-95 transition-all"
                  >
                    <span>🔥</span> Washa PapoPass (0% Kamisheni)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLowBalanceModal(false)}
                    className="w-full py-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs font-bold uppercase tracking-wider border-0 bg-transparent"
                  >
                    Funga & Baadaye
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Street Hail & Instant Direct Passenger Boarding Modal */}
        <StreetHailModal
          isOpen={isStreetHailModalOpen}
          onClose={() => setIsStreetHailModalOpen(false)}
          driverUser={user}
          driverProfile={profile}
          driverLocation={position}
          onRideStarted={(rideId) => {
            console.log("Direct street hail ride started:", rideId);
            setIsStreetHailModalOpen(false);
          }}
        />
      </AnimatePresence>
    </div>
  );
}
