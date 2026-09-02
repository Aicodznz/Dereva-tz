import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
  Circle,
  Polygon,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-rotate";
import {
  ArrowLeft,
  Home,
  MapPin,
  Search,
  Navigation2,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X as CloseX,
  Phone,
  MessageSquare,
  Car,
  Activity,
  ShieldCheck,
  User,
  Users,
  UserPlus,
  Check,
  CheckCircle2,
  DollarSign,
  Zap,
  Layers,
  Trophy,
  ArrowRight,
  RefreshCw,
  RotateCw,
  RotateCcw,
  Sun,
  Moon,
  Siren,
  Flame,
  Ambulance,
  Trash2,
  Loader2,
  Calculator,
  Map,
  Compass,
  Menu,
  MessageCircle,
  Languages,
  Globe,
  Copy,
  Gift,
  Share2,
  X,
  Sparkles,
  Heart,
  Bookmark,
  Briefcase,
} from "lucide-react";
import { SavedAddressesModal } from "./tegex/SavedAddressesModal";
import { FavoriteDriversModal } from "./tegex/FavoriteDriversModal";
import { 
  SavedAddress, 
  FavoriteDriver, 
  getLocalSavedAddresses, 
  getLocalFavoriteDrivers,
  fetchSavedAddresses,
  fetchFavoriteDrivers
} from "../utils/customerPreferences";
import { AISmartHeatMap, HeatZone } from "./map/AISmartHeatMap";
import { useTheme } from "../ThemeContext";
import { calculateDetourBudget, calculateDistanceBasedPapoShareFare } from "../services/papoShareEngine";
import Chat from "./Chat";
import ActiveRideChatPopup from "./ActiveRideChatPopup";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  limit,
  getDoc,
  deleteField,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { useLanguage } from "../LanguageContext";
import { useBusinessConfig } from "../BusinessConfigContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom"; // test transition
import { toast } from "sonner";

import { useRouting, generateSimulatedRoads } from "../hooks/useRouting";
import { useCreateRide } from "../hooks/useCreateRide";
import { useTripFlow } from "../hooks/useTripFlow";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { useNearbyDrivers } from "../hooks/useNearbyDrivers";
import { getDriverSvg } from "../utils/driverMarker";

// --- SCREENS ---
import { SearchingScreen } from "./tegex/SearchingScreen";
import { DriverFoundScreen } from "./tegex/DriverFoundScreen";
import { DriverArrivedScreen } from "./tegex/DriverArrivedScreen";
import { LiveTripScreen } from "./tegex/LiveTripScreen";
import { TripCompleteScreen } from "./tegex/TripCompleteScreen";
import { RatingScreen } from "./tegex/RatingScreen";
import { AnimatedRoute } from "./map/AnimatedRoute";
import { SmoothDriverMarker } from "./map/SmoothDriverMarker";
import AppDownloadButton from "./AppDownloadButton";

// --- UTILITIES ---

interface NominatimAddress {
  shop?: string;
  amenity?: string;
  building?: string;
  office?: string;
  tourism?: string;
  point_of_interest?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  region?: string;
}

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

function formatAddress(result: any): string {
  if (!result) return "Eneo Halijapatikana";

  if (result.display_name) {
    const parts = result.display_name.split(",").map((p: string) => p.trim()).filter(Boolean);
    const seen = new Set<string>();
    const uniqueParts: string[] = [];
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueParts.push(p);
      }
    }
    if (uniqueParts.length > 0) {
      return uniqueParts.join(", ");
    }
  }

  const addr = result.address;
  if (!addr) return "Eneo Halijapatikana";

  const partsList: string[] = [];

  // Level A: Specific Point of Interest / Building / Number
  const a = addr.shop || addr.amenity || addr.building || addr.office || addr.tourism || addr.point_of_interest || addr.house_number || addr.healthcare || addr.leisure;
  if (a) partsList.push(a);

  // Level B: Road / Street
  const b = addr.road || addr.street || addr.square;
  if (b) partsList.push(b);

  // Level C: Neighborhood / Quarter / Suburb / Locality / Subdistrict / Residential
  const c = addr.neighbourhood || addr.quarter || addr.suburb || addr.residential || addr.locality || addr.subdistrict;
  if (c) partsList.push(c);

  // Level D: City District / District / Municipality
  const d = addr.city_district || addr.district || addr.municipality;
  if (d) partsList.push(d);

  // Level E: City / Town / Municipality / Village
  const e = addr.city || addr.town || addr.village;
  if (e) partsList.push(e);

  // Level F: Region / County / State / Zone
  const f = addr.state_district || addr.region || addr.county || addr.state;
  if (f) partsList.push(f);

  // Level G: Postcode
  const g = addr.postcode;
  if (g) partsList.push(g);

  // Level H: Country
  const h = addr.country || "Tanzania";
  if (h) partsList.push(h);

  const seenParts = new Set<string>();
  const finalParts: string[] = [];

  for (const part of partsList) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    
    if (!seenParts.has(lower)) {
      seenParts.add(lower);
      finalParts.push(trimmed);
    }
  }

  return finalParts.length > 0 ? finalParts.join(", ") : "Eneo Lisilojulikana";
}

const BajajSVG = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 11l2-4h14l2 4" />
    <path d="M3 11h18v7H3z" />
    <path d="M5 18v2M19 18v2" />
    <path d="M12 7v4" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="16" cy="18" r="1.5" />
  </svg>
);

const BikeSVG = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="5" cy="18" r="3" />
    <circle cx="19" cy="18" r="3" />
    <path d="M12 18V9c0-2 2-2 2-2" />
    <path d="M8 18l3-9h4l3 9" />
    <path d="M12 13h4" />
    <path d="M7 6l2-3h5l1 3" />
  </svg>
);

const LocateReticleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="1.5" x2="12" y2="4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="12" y1="19.5" x2="12" y2="22.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="1.5" y1="12" x2="4.5" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="19.5" y1="12" x2="22.5" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3.2" fill="#10a349" />
  </svg>
);

const MapEvents = ({
  onMapClick,
  onInteraction,
}: {
  onMapClick: (e: L.LeafletMouseEvent) => void;
  onInteraction?: () => void;
}) => {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
    dragstart() {
      if (onInteraction) onInteraction();
    },
    zoomstart() {
      if (onInteraction) onInteraction();
    },
    drag() {
      if (onInteraction) onInteraction();
    },
    zoom() {
      if (onInteraction) onInteraction();
    },
  });
  return null;
};

const isValidCoord = (pos: any): pos is [number, number] => {
  return Array.isArray(pos) && pos.length >= 2 && typeof pos[0] === 'number' && typeof pos[1] === 'number' && !isNaN(pos[0]) && !isNaN(pos[1]);
};

const MapControl = ({
  position,
  step,
  targetPos,
  autoFollow,
  routeCoords,
  isMapFullscreen,
  mapRefitTrigger,
}: {
  position: [number, number];
  step: string;
  targetPos?: [number, number];
  autoFollow: boolean;
  routeCoords?: [number, number][];
  isMapFullscreen?: boolean;
  mapRefitTrigger?: number;
}) => {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);
  const lastRouteHash = useRef<string>("");

  // Handle manual map refitting when mapRefitTrigger changes (re-centers/fits bounds)
  useEffect(() => {
    if (mapRefitTrigger && mapRefitTrigger > 0 && isValidCoord(position)) {
      try {
        map.invalidateSize({ animate: false });
        if (isValidCoord(targetPos)) {
          const bounds = L.latLngBounds([position, targetPos]);
          map.fitBounds(bounds, {
            padding: [80, 80],
            maxZoom: 17,
            animate: true,
            duration: 1.2,
          });
        } else {
          map.setView(position, 16, { animate: true, duration: 1.0 });
        }
      } catch (e) {
        console.warn("Failed to refit map bounds on trigger:", e);
      }
    }
  }, [mapRefitTrigger, map, position, targetPos]);

  // Invalidate map size sequentially on step change or fullscreen change to guarantee correct size calculations on mobile/tablet viewports
  useEffect(() => {
    const delays = [50, 200, 450, 900, 1500];
    const timers = delays.map(delay => 
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {
          // ignore
        }
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [map, step, isMapFullscreen]);

  const [containerResizedCount, setContainerResizedCount] = useState(0);

  // Handle auto resizing of the map container element dynamically via ResizeObserver to fix viewport and sizing shifts on mobile and tablet resizes
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          try {
            map.invalidateSize({ animate: false });
            setContainerResizedCount((prev) => prev + 1);
          } catch (e) {
            // ignore
          }
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  const lastFittedStepRef = useRef<string>("");

  const lastSinglePosRef = useRef<string>("");

  // Adjust camera to fit the full route or selected position on step 'map'
  useEffect(() => {
    if (step === "map") {
      const validCoords = (routeCoords || []).filter(isValidCoord);
      if (validCoords.length > 1) {
        const hash = validCoords.map((c) => `${c[0]},${c[1]}`).join("|").slice(0, 500) + `_${containerResizedCount}`;
        if (lastRouteHash.current !== hash) {
          lastRouteHash.current = hash;
          try {
            map.invalidateSize({ animate: false });
            const bounds = L.latLngBounds(validCoords);
            map.fitBounds(bounds, {
              padding: [60, 60],
              maxZoom: 16,
              animate: true,
              duration: 1.2,
            });
            setTimeout(() => {
              try {
                map.invalidateSize({ animate: false });
              } catch (e) {}
            }, 350);
          } catch (e) {
            console.error("Failed to fit bounds of routeCoords", e);
          }
        }
      } else if (isValidCoord(position)) {
        const posKey = `${position[0]},${position[1]}_${containerResizedCount}`;
        if (lastSinglePosRef.current !== posKey) {
          lastSinglePosRef.current = posKey;
          if (autoFollow) {
            map.setView(position, map.getZoom() || 15, { animate: true, duration: 0.8 });
          }
        }
      }
    }
  }, [step, routeCoords, position, map, containerResizedCount, autoFollow]);

  useEffect(() => {
    if (!isValidCoord(position) || !autoFollow) return;

    // Separate full route fits from dynamic follow center
    if (step === "map") return;

    const currentPos = L.latLng(position[0], position[1]);
    const lastPos = (lastCenterRef.current && isValidCoord(lastCenterRef.current))
      ? L.latLng(lastCenterRef.current[0], lastCenterRef.current[1])
      : null;

    // Transition tracking key - include loading state to re-fit when real driver position registers!
    const isFallback = isValidCoord(targetPos) && position[0] === targetPos[0] && position[1] === targetPos[1];
    const trackingKey = `${step}_${isFallback ? "fallback" : "active"}_${targetPos?.[0] || 0}_${targetPos?.[1] || 0}_${containerResizedCount}`;

    // Fit bounds only once when we first enter this booking step
    if (
      ["arriving", "on_trip", "found"].includes(step) &&
      isValidCoord(targetPos) &&
      lastFittedStepRef.current !== trackingKey
    ) {
      lastFittedStepRef.current = trackingKey;
      try {
        map.invalidateSize({ animate: false });
        const bounds = L.latLngBounds([position, targetPos]);
        map.fitBounds(bounds, {
          padding: [80, 80],
          maxZoom: 17,
          animate: true,
          duration: 1.2,
        });
        setTimeout(() => {
          try {
            map.invalidateSize({ animate: false });
          } catch (e) {}
        }, 350);
      } catch (e) {
        console.warn("Failed to set initial step bounds:", e);
      }
      lastCenterRef.current = position;
      return;
    }

    // Smooth camera tracking when driver or customer is on the move
    const isLiveStep = ["arriving", "on_trip", "found", "driver_arrived", "driver_arriving"].includes(step);
    const threshold = isLiveStep ? 1.0 : 5; // 1.0 meter threshold so the map smoothly tracks every corner and movement

    if (!lastPos || currentPos.distanceTo(lastPos) > threshold) {
      map.panTo(position, { animate: true, duration: isLiveStep ? 0.6 : 0.8, easeLinearity: 0.25 });
      lastCenterRef.current = position;
    }
  }, [
    position?.[0],
    position?.[1],
    step,
    targetPos?.[0],
    targetPos?.[1],
    map,
    autoFollow,
    containerResizedCount,
  ]);
  return null;
};

const MapRotationController = ({ 
  rotation = 0,
  heading = 0,
  isHeadingUp = true,
  is3DMode = false,
  onRotate
}: { 
  rotation?: number; 
  heading?: number;
  isHeadingUp?: boolean;
  is3DMode?: boolean;
  onRotate?: (newRotation: number) => void; 
}) => {
  const map = useMap();
  const accumulatedRotRef = useRef<number>(0);

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;

    if (isHeadingUp && typeof heading === 'number' && !isNaN(heading)) {
      // Calculate shortest angular delta to prevent 360° spin jumps
      const currentNormalized = ((accumulatedRotRef.current % 360) + 360) % 360;
      const targetNormalized = ((heading % 360) + 360) % 360;
      let diff = targetNormalized - currentNormalized;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      accumulatedRotRef.current = accumulatedRotRef.current + diff;

      const tilt = is3DMode ? 'perspective(1000px) rotateX(28deg) ' : '';
      // Negative rotation: map rotates counter to heading so forward driving direction is always UP
      container.style.transform = `${tilt}rotateZ(${-accumulatedRotRef.current}deg) scale(1.38)`;
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)';
    } else {
      accumulatedRotRef.current = 0;
      const perspectiveTilt = is3DMode ? 'perspective(1000px) rotateX(28deg)' : 'none';
      container.style.transform = perspectiveTilt;
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1)';
    }
  }, [map, heading, isHeadingUp, is3DMode]);

  return null;
};

// --- TYPES ---

type BookingStep =
  | "home"
  | "map"
  | "searching"
  | "found"
  | "arriving"
  | "on_trip"
  | "completed"
  | "rating"
  | "timeout";

interface RideOption {
  id: string;
  name: string;
  icon: any;
  sub: string;
  price: number;
  eta: string;
  image: string;
  vehicleType: string;
  discount?: string;
  imageUrl?: string;
  capacity?: number;
  maintenance?: boolean;
}

// --- MAIN COMPONENT ---

const taxiPinIconCacheMap: Record<string, L.DivIcon> = {};

export default function TaxiBooking() {
  const { user, profile, signInGuest, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { config } = useBusinessConfig();
  const navigate = useNavigate();
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState<BookingStep>("map");
  const [isMinimized, setIsMinimized] = useState(true);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [mapRefitTrigger, setMapRefitTrigger] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [settingMode, setSettingMode] = useState<"pickup" | "destination" | "stop">(
    "pickup",
  );
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Dar es Salaam");
  const [isNightSurcharge, setIsNightSurcharge] = useState(false);
  const [surgeLevel, setSurgeLevel] = useState("normal"); // "normal", "rush", "rain"
  const [waitingTime, setWaitingTime] = useState(0); // minutes
  const [secondsOffset, setSecondsOffset] = useState<number>(0);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [showHeatMap, setShowHeatMap] = useState<boolean>(false);
  const [heatMapCategory, setHeatMapCategory] = useState<'all' | 'taxi' | 'food' | 'parcel' | 'mart'>('all');
  const [selectedHeatZone, setSelectedHeatZone] = useState<HeatZone | null>(null);
  const [manualRotation, setManualRotation] = useState(0);
  const [isHeadingUp, setIsHeadingUp] = useState<boolean>(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const justSelectedRef = useRef(false);
  const vehicleScrollRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'wallet' | 'card'>('cash');
  const [selectedMobileOperator, setSelectedMobileOperator] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'halopesa'>('mpesa');
  const [pickupNote, setPickupNote] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  // PapoShare Pooling State
  const [shareMode, setShareMode] = useState<'solo' | 'share'>('solo');
  const [allowSharingConsent, setAllowSharingConsent] = useState<boolean>(true);
  const [womenOnlySharing, setWomenOnlySharing] = useState<boolean>(false);
  const [verifiedOnlySharing, setVerifiedOnlySharing] = useState<boolean>(false);
  const [allowBodaParcelAddon, setAllowBodaParcelAddon] = useState<boolean>(true);

  const scrollVehicles = (direction: 'left' | 'right') => {
    if (vehicleScrollRef.current) {
      const scrollAmount = 180;
      vehicleScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  const [userLivePos, setUserLivePos] = useState<[number, number] | null>(null);

  const [taxiBanners, setTaxiBanners] = useState<{ id?: string; title: string; sub: string; img: string; active?: boolean }[]>([]);

  // Saved Addresses and Favorite Drivers state
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState(false);
  const [showFavoriteDriversModal, setShowFavoriteDriversModal] = useState(false);
  const [savedAddressesList, setSavedAddressesList] = useState<SavedAddress[]>(() => getLocalSavedAddresses());
  const [favoriteDriversList, setFavoriteDriversList] = useState<FavoriteDriver[]>(() => getLocalFavoriteDrivers());
  const [preferredDriver, setPreferredDriver] = useState<FavoriteDriver | null>(null);

  // Sync saved addresses and favorite drivers
  useEffect(() => {
    const listAddr = getLocalSavedAddresses();
    setSavedAddressesList(listAddr);
    const listDrv = getLocalFavoriteDrivers();
    setFavoriteDriversList(listDrv);

    if (user?.uid) {
      fetchSavedAddresses(user.uid).then(res => {
        if (res && res.length > 0) setSavedAddressesList(res);
      });
      fetchFavoriteDrivers(user.uid).then(res => {
        if (res && res.length > 0) setFavoriteDriversList(res);
      });
    }

    const handleAddrUpdate = (e: any) => {
      if (e.detail) setSavedAddressesList(e.detail);
    };
    const handleDrvUpdate = (e: any) => {
      if (e.detail) setFavoriteDriversList(e.detail);
    };

    window.addEventListener('paporide_addresses_updated', handleAddrUpdate);
    window.addEventListener('paporide_drivers_updated', handleDrvUpdate);
    return () => {
      window.removeEventListener('paporide_addresses_updated', handleAddrUpdate);
      window.removeEventListener('paporide_drivers_updated', handleDrvUpdate);
    };
  }, [user?.uid]);

  const handleSelectSavedAddress = async (
    address: string,
    coords?: { lat: number; lng: number },
    mode: 'destination' | 'pickup' = 'destination'
  ) => {
    if (mode === 'destination') {
      setDestination(address);
      if (coords) {
        setDestPos([coords.lat, coords.lng]);
      } else {
        try {
          const res = await fetch(`/api/geo/search?q=${encodeURIComponent(address)}&limit=1&countrycodes=tz`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setDestPos([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            }
          }
        } catch (e) {}
      }
      setStep('map');
      setIsMinimized(false);
      setSettingMode('destination');
    } else {
      setPickup(address);
      if (coords) {
        setPickupPos([coords.lat, coords.lng]);
      }
    }
  };

  const handleSelectDriverForBooking = (driver: FavoriteDriver) => {
    setPreferredDriver(driver);
    if (driver.vehicleType) {
      const match = rideOptions.find(opt => opt.id === driver.vehicleType);
      if (match) {
        setSelectedRide(match);
      }
    }
    setStep('map');
    setIsMinimized(false);
    setSettingMode('destination');
  };

  useEffect(() => {
    const bannersRef = collection(db, "banners");
    const unsubscribe = onSnapshot(query(bannersRef), (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];
      setTaxiBanners(list.filter((b) => b.active !== false && b.img));
    }, (error) => {
      console.error("Error fetching banners in TaxiBooking:", error);
    });
    return unsubscribe;
  }, []);

  const [rideId, setRideIdState] = useState<string | null>(() => {
    return localStorage.getItem('active_ride_id') || null;
  });

  const setRideId = React.useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('active_ride_id', id);
    } else {
      localStorage.removeItem('active_ride_id');
    }
    setRideIdState(id);
  }, []);

  const { ride: activeRide, cancelRide, deleteRide } = useTripFlow(rideId);

  // Auto-reset autoFollow to true whenever the booking step or the ride status changes
  useEffect(() => {
    setAutoFollow(true);
  }, [step, activeRide?.status]);

  const isSpectator = useMemo(() => {
    const paramRideId = searchParams.get("rideId");
    if (!paramRideId) return false;
    if (!user) return true;
    if (user.isAnonymous) return true;
    if (!activeRide) return true; // Keep true as default while loading to avoid flicking or early redirects
    if (user.uid !== activeRide.customerId && user.uid !== activeRide.driverId) {
       return true;
    }
    return false;
  }, [searchParams, user, activeRide]);

  // Anonymous guest sign-in for spectators
  useEffect(() => {
    if (isSpectator && !user && !loading) {
      console.log("[TaxiBooking] Spectator detected but not authorized. Signing in anonymously...");
      signInGuest().catch((err) => {
        console.error("[TaxiBooking] Spectator anonymous signin failed:", err);
      });
    }
  }, [isSpectator, user, loading, signInGuest]);

  // Spectator session registry and active ping
  useEffect(() => {
    if (!isSpectator || !rideId) return;

    let viewerId = sessionStorage.getItem(`ride_viewer_${rideId}`);
    if (!viewerId) {
      viewerId = `viewer_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(`ride_viewer_${rideId}`, viewerId);
    }

    let viewerName = sessionStorage.getItem(`ride_viewer_name_${rideId}`);
    if (!viewerName) {
      if (user && !user.isAnonymous) {
        viewerName = user.displayName || user.email?.split('@')[0] || "Mshiriki";
      } else {
        const swahiliTitles = [
          "Rafiki", "Ndugu", "Mlinzi", "Msindikizaji", "Mshiriki", 
          "Mzee", "Mdau", "Karibu", "Mfuatiliaji", "Mshauri"
        ];
        const swahiliAdjectives = [
          "Machachari", "Mpole", "Makini", "Hodari", "Mwema", 
          "Mwaminifu", "Mkuu", "Shupavu", "Mcheshi", "Mkimya"
        ];
        const randomTitle = swahiliTitles[Math.floor(Math.random() * swahiliTitles.length)];
        const randomAdj = swahiliAdjectives[Math.floor(Math.random() * swahiliAdjectives.length)];
        viewerName = `${randomTitle} ${randomAdj}`;
      }
      sessionStorage.setItem(`ride_viewer_name_${rideId}`, viewerName);
    }

    const docRef = doc(db, "rides", rideId);

    const ping = async () => {
      try {
        await updateDoc(docRef, {
          [`viewers.${viewerId}`]: {
            lastActive: Date.now(),
            name: viewerName
          }
        });
      } catch (e) {
        console.error("Spectator ping failed:", e);
      }
    };

    ping();
    const timer = setInterval(ping, 15000);

    return () => {
      clearInterval(timer);
      const cleanUp = async () => {
        try {
          await updateDoc(docRef, {
            [`viewers.${viewerId}`]: deleteField()
          });
        } catch (e) {
          // ignore
        }
      };
      cleanUp();
    };
  }, [isSpectator, rideId, user]);

  // Keep step in sync with the active ride of the shared link
  useEffect(() => {
    const paramRideId = searchParams.get("rideId");
    if (paramRideId && activeRide) {
      if (activeRide.status === "completed") {
        setStep("completed");
      } else if (activeRide.status === "cancelled") {
        setStep("timeout");
      } else if (activeRide.status === "pending") {
        setStep("searching");
      } else if (activeRide.status === "accepted") {
        setStep("found");
      } else if (activeRide.status === "driver_arriving" || activeRide.status === "driver_arrived") {
        setStep("arriving");
      } else if (activeRide.status === "on_trip") {
        setStep("on_trip");
      } else {
        setStep("on_trip"); 
      }
    }
  }, [activeRide?.status, searchParams]);

  // Live timer tick for MM:SS countdown and arriving increments
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [pickupPos, setPickupPos] = useState<[number, number]>([
    -6.7721, 39.2326,
  ]);
  const [destPos, setDestPos] = useState<[number, number]>([-6.8235, 39.2695]);
  const [pickup, setPickup] = useState("Mwenge, Dar es Salaam");
  const [destination, setDestination] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [isAutoLocated, setIsAutoLocated] = useState(true);
  
  // Passenger selection states
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [passengerType, setPassengerType] = useState<'you' | 'someone_else'>('you');
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerStep, setPassengerStep] = useState<'who' | 'details'>('who');

  // Automatic pricing conditions & city detection based on location and time
  useEffect(() => {
    if (!pickupPos || pickupPos.length < 2) return;
    const rules = getPricingRules();
    const cityKeys = Object.keys(rules).filter(k => rules[k]?.active !== false);
    if (cityKeys.length === 0) return;

    let detectedCity = "Dar es Salaam";
    const addressLower = (pickup || "").toLowerCase();

    // 1. Try finding a direct name match in the address string
    const textMatched = cityKeys.find(key => addressLower.includes(key.toLowerCase()));
    if (textMatched) {
      detectedCity = textMatched;
    } else {
      // 2. Fallback to coordinate-based distance detection
      let minDistance = Infinity;
      cityKeys.forEach(key => {
        const cityData = rules[key];
        const cityLat = cityData?.lat || CITY_FALLBACK_COORDINATES[key]?.lat || -6.7924;
        const cityLng = cityData?.lng || CITY_FALLBACK_COORDINATES[key]?.lng || 39.2083;

        // Haversine distance
        const R = 6371; // km
        const dLat = (pickupPos[0] - cityLat) * Math.PI / 180;
        const dLng = (pickupPos[1] - cityLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(cityLat * Math.PI / 180) * Math.cos(pickupPos[0] * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance < minDistance) {
          minDistance = distance;
          detectedCity = key;
        }
      });
    }

    if (detectedCity !== selectedCity) {
      setSelectedCity(detectedCity);
      console.log(`[TaxiBooking] Automatically switched city to ${detectedCity} based on pickup location.`);
    }

    // 3. Automatic time-based features (Night surcharge & Rush hour surge)
    const now = new Date();
    const hour = now.getHours();

    // Night surcharge hours (typically 10 PM to 6 / 5:30 AM based on city rule, default 22:00 - 06:00)
    const cityRule = rules[detectedCity] || rules["Dar es Salaam"];
    let nightStartHour = 22;
    let nightEndHour = 6;
    if (cityRule?.nightStart) {
      const match = cityRule.nightStart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hr = parseInt(match[1]);
        const isPM = match[3].toUpperCase() === "PM";
        if (isPM && hr < 12) hr += 12;
        if (!isPM && hr === 12) hr = 0;
        nightStartHour = hr;
      }
    }
    if (cityRule?.nightEnd) {
      const match = cityRule.nightEnd.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hr = parseInt(match[1]);
        const isPM = match[3].toUpperCase() === "PM";
        if (isPM && hr < 12) hr += 12;
        if (!isPM && hr === 12) hr = 0;
        nightEndHour = hr;
      }
    }

    const isNight = hour >= nightStartHour || hour < nightEndHour;
    if (isNightSurcharge !== isNight) {
      setIsNightSurcharge(isNight);
    }

    // Auto-detect Rush hour (7:00 - 10:00 AM & 4:00 - 8:00 PM)
    const isMorningRush = (hour >= 7 && hour < 10);
    const isEveningRush = (hour >= 16 && hour < 20);
    const isRush = isMorningRush || isEveningRush;
    const expectedSurge = isRush ? "rush" : "normal";
    if (surgeLevel !== expectedSurge) {
      setSurgeLevel(expectedSurge);
    }
  }, [pickupPos, pickup, config]);

  const isInTanzania = (lat: number, lng: number) => {
    // Kuruhusu coordinates zote zilizo sahihi (sio 0 au NaN) ili GPS isome popote pale
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return false;
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return false;
    return true;
  };

  const theme = resolvedTheme === "light" ? "light" : "dark";

  const mapTileUrl = "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

  const getNearestPopularPlace = (lat: number, lng: number): string => {
    let nearestName = "Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania";
    let minDistance = Infinity;
    
    const places = [
      { display_name: "Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7645, lon: 39.2492 },
      { display_name: "New City Road off Bagamoyo Road, Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.7650, lon: 39.2485 },
      { display_name: "Vikawe Bondeni, Kibaha Town, Mkoa wa Pwani, Coastal Zone, Tanzania", lat: -6.7580, lon: 38.9320 },
      { display_name: "Kariakoo, Ilala Municipal, Dar es Salaam, Coastal Zone, 11101, Tanzania", lat: -6.82, lon: 39.278 },
      { display_name: "Posta, Kivukoni, Ilala Municipal, Dar es Salaam, Coastal Zone, 11105, Tanzania", lat: -6.8164, lon: 39.2902 },
      { display_name: "Mwenge, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7681, lon: 39.2274 },
      { display_name: "Sinza, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.7812, lon: 39.2223 },
      { display_name: "Masaki, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.7441, lon: 39.2812 },
      { display_name: "Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7645, lon: 39.2492 },
      { display_name: "Ubungo Bus Terminal, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14114, Tanzania", lat: -6.7961, lon: 39.2155 },
      { display_name: "Mbezi Luis, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14115, Tanzania", lat: -6.7831, lon: 39.1952 },
      { display_name: "Kinondoni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7952, lon: 39.2631 },
      { display_name: "Temeke, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.855, lon: 39.265 },
      { display_name: "Kigamboni, Kigamboni Municipal, Dar es Salaam, Coastal Zone, 17101, Tanzania", lat: -6.825, lon: 39.31 },
      { display_name: "Ilala, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.827, lon: 39.262 },
      { display_name: "Gerezani, Ilala Municipal, Dar es Salaam, Coastal Zone, 11102, Tanzania", lat: -6.8239, lon: 39.2797 },
      { display_name: "Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.7725, lon: 39.2789 },
      { display_name: "Msasani, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7561, lon: 39.2741 },
      { display_name: "Tabata, Ilala Municipal, Dar es Salaam, Coastal Zone, 12105, Tanzania", lat: -6.819, lon: 39.215 },
      { display_name: "Segerea, Ilala Municipal, Dar es Salaam, Coastal Zone, 12108, Tanzania", lat: -6.84, lon: 39.19 },
      { display_name: "Kawe, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14109, Tanzania", lat: -6.7389, lon: 39.2558 },
      { display_name: "Tegeta, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14108, Tanzania", lat: -6.685, lon: 39.214 },
      { display_name: "Kunduchi, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.669, lon: 39.219 },
      { display_name: "Kibamba, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14116, Tanzania", lat: -6.79, lon: 39.11 },
      { display_name: "Kimara, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.792, lon: 39.167 },
      { display_name: "Kisutu, Ilala Municipal, Dar es Salaam, Coastal Zone, 11104, Tanzania", lat: -6.814, lon: 39.287 },
      { display_name: "Upanga, Ilala Municipal, Dar es Salaam, Coastal Zone, 11102, Tanzania", lat: -6.804, lon: 39.28 },
      { display_name: "Mbagala, Temeke Municipal, Dar es Salaam, Coastal Zone, 15102, Tanzania", lat: -6.891, lon: 39.269 },
      { display_name: "Chanika, Ilala Municipal, Dar es Salaam, Coastal Zone, 12111, Tanzania", lat: -6.91, lon: 39.08 },
      { display_name: "Kivukoni Ferry, Ilala Municipal, Dar es Salaam, Coastal Zone, 11105, Tanzania", lat: -6.821, lon: 39.299 },
      { display_name: "Boko, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.649, lon: 39.191 },
      { display_name: "Bunju, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14106, Tanzania", lat: -6.611, lon: 39.166 },
      { display_name: "Julius Nyerere Airport (JNIA), Kipawa, Ukonga, Ilala Municipal, Dar es Salaam, Coastal Zone, 12109, Tanzania", lat: -6.8781, lon: 39.2026 },
      { display_name: "Tazara, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.843, lon: 39.241 },
      { display_name: "Morocco, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7885, lon: 39.2604 },
      { display_name: "Tandika, Temeke Municipal, Dar es Salaam, Coastal Zone, 15103, Tanzania", lat: -6.858, lon: 39.259 },
      { display_name: "Buguruni, Ilala Municipal, Dar es Salaam, Coastal Zone, 12102, Tanzania", lat: -6.828, lon: 39.245 },
      { display_name: "Vingunguti, Ilala Municipal, Dar es Salaam, Coastal Zone, 12103, Tanzania", lat: -6.842, lon: 39.218 },
      { display_name: "Kijitonyama, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.778, lon: 39.245 },
      { display_name: "Makumbusho, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.776, lon: 39.241 },
      { display_name: "Coco Beach, Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.765, lon: 39.294 },
      { display_name: "The Slipway, Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.749, lon: 39.284 },
      { display_name: "Mlimani City Mall, Sam Nujoma Road, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.7722, lon: 39.2241 },
      { display_name: "Karume, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.8202, lon: 39.2612 },
      { display_name: "Machinga Complex, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.8218, lon: 39.2598 },
      { display_name: "Kigogo, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.807, lon: 39.231 },
      { display_name: "Mabibo, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.801, lon: 39.211 },
      { display_name: "Manzese, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.793, lon: 39.217 },
      { display_name: "Keko, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.837, lon: 39.282 },
      { display_name: "Chang’ombe, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.841, lon: 39.268 },
      { display_name: "Kurasini, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.848, lon: 39.289 },
      { display_name: "Dodoma Town Central, Dodoma City, Mkoa wa Dodoma, Central Zone, Tanzania", lat: -6.1722, lon: 35.7481 },
      { display_name: "Arusha Clock Tower, Arusha Urban, Mkoa wa Arusha, Northern Zone, Tanzania", lat: -3.3731, lon: 36.6857 },
      { display_name: "Mwanza City Centre, Nyamagana, Mkoa wa Mwanza, Lake Zone, Tanzania", lat: -2.5164, lon: 32.9018 },
      { display_name: "Zanzibar Stone Town, Mjini Magharibi, Zanzibar, Tanzania", lat: -6.1659, lon: 39.199 },
    ];

    for (const p of places) {
      const d = Math.pow(p.lat - lat, 2) + Math.pow(p.lon - lng, 2);
      if (d < minDistance) {
        minDistance = d;
        nearestName = p.display_name;
      }
    }
    return nearestName;
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lng}`);
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Reverse geocoding failed with status ${response.status}`,
        );
      }
      const data = await response.json();
      const addr = formatAddress(data);
      if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
        return addr;
      }
      throw new Error("Invalid address formatted");
    } catch (error) {
      console.warn("Reverse geocoding failed, trying fallback:", error);
      try {
        const bdcResponse = await fetch(
          `/api/geo/bdc-reverse?lat=${lat}&lon=${lng}`,
        );
        const bdcContentType = bdcResponse.headers.get("content-type");
        const isBdcJson = bdcContentType && bdcContentType.includes("application/json");
        
        if (!bdcResponse.ok || !isBdcJson) {
          let bdcError = `BDC failed with status ${bdcResponse.status}`;
          if (isBdcJson) {
            try {
              const errorData = await bdcResponse.json();
              bdcError = errorData.error || bdcError;
            } catch (e) {
              // Fallback
            }
          }
          throw new Error(bdcError);
        }
        const bdcData = await bdcResponse.json();
        const bdcAddr = bdcData.locality || bdcData.city || bdcData.principalSubdivision;
        if (bdcAddr && bdcAddr !== "Unknown Area" && bdcAddr !== "Unknown Location") {
          return bdcAddr;
        }
        throw new Error("BDC returned unknown address");
      } catch (bdcErr) {
        return getNearestPopularPlace(lat, lng);
      }
    }
  };

  const handleCurrentLocation = async (isInitial = false) => {
    setIsAutoLocated(true);
    let fallbackCalled = false;
    let gpsResolved = false;
    const inIframe = window.self !== window.top;
    
    const triggerIpFallback = async () => {
      if (gpsResolved || fallbackCalled) return;
      fallbackCalled = true;
      console.log("[TaxiBooking] Attempting IP-based geolocation fallback...");
      
      // Try freeipapi.com
      try {
        const ipRes = await fetch("https://freeipapi.com/api/json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number' && ipData.latitude !== 0) {
            const lat = ipData.latitude;
            const lng = ipData.longitude;
            
            if (isInTanzania(lat, lng)) {
              setPickupPos([lat, lng]);
              setSettingMode("pickup");
              const addr = await reverseGeocode(lat, lng);
              if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
                setPickup(addr);
              } else {
                setPickup(getNearestPopularPlace(lat, lng));
              }
              if (!isInitial) {
                toast.success(`Eneo lako limetambuliwa (${ipData.cityName || 'Kabla nawe'}) 📍`);
              }
              return;
            } else {
              console.warn("[TaxiBooking] freeipapi returned coordinates outside Tanzania:", lat, lng);
            }
          }
        }
      } catch (err) {
        console.warn("[TaxiBooking] freeipapi fallback failed:", err);
      }

      // Try ipwho.is
      try {
        const ipRes = await fetch("https://ipwho.is/");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.success && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
            const lat = ipData.latitude;
            const lng = ipData.longitude;
            
            if (isInTanzania(lat, lng)) {
              setPickupPos([lat, lng]);
              setSettingMode("pickup");
              const addr = await reverseGeocode(lat, lng);
              if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
                setPickup(addr);
              } else {
                setPickup(getNearestPopularPlace(lat, lng));
              }
              if (!isInitial) {
                toast.success(`Eneo lako limetambuliwa Swahili (${ipData.city || 'Karibu nawe'}) 📍`);
              }
              return;
            } else {
              console.warn("[TaxiBooking] ipwho.is returned coordinates outside Tanzania:", lat, lng);
            }
          }
        }
      } catch (err) {
        console.warn("[TaxiBooking] ipwho.is fallback failed:", err);
      }

      // Try ipapi.co
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
            const lat = ipData.latitude;
            const lng = ipData.longitude;
            
            if (isInTanzania(lat, lng)) {
              setPickupPos([lat, lng]);
              setSettingMode("pickup");
              const addr = await reverseGeocode(lat, lng);
              if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
                setPickup(addr);
              } else {
                setPickup(getNearestPopularPlace(lat, lng));
              }
              if (!isInitial) {
                toast.success(`Eneo lako limetambuliwa (${ipData.city || 'Karibu nawe'}) 📍`);
              }
              return;
            } else {
              console.warn("[TaxiBooking] ipapi.co returned coordinates outside Tanzania:", lat, lng);
            }
          }
        }
      } catch (err) {
        console.warn("[TaxiBooking] ipapi.co fallback failed:", err);
      }

      // If all fallbacks fail or return locations outside of TZ, set default coordinates (Mwenge, Dar es Salaam)
      console.log("[TaxiBooking] Geolocation failed or coordinates are outside Tanzania. Using default Dar es Salaam.");
      const defLat = -6.7681;
      const defLng = 39.2274;
      setPickupPos([defLat, defLng]);
      setSettingMode("pickup");
      try {
        const startAddr = await reverseGeocode(defLat, defLng);
        if (startAddr && startAddr !== "Eneo Halijapatikana" && startAddr !== "Unknown Area" && startAddr !== "Unknown Location") {
          setPickup(startAddr);
        } else {
          setPickup("Mwenge, Dar es Salaam");
        }
      } catch (e) {
        setPickup("Mwenge, Dar es Salaam");
      }
      
      if (!isInitial) {
        if (inIframe) {
          toast.error("Imeshindwa kupata GPS sahihi kwenye Preview. Bofya alama ya 'Fungua katika Tab Mpya' juu kulia kupata GPS kamili! 📍", { duration: 8000 });
        } else {
          toast.error("Imeshindwa kukupata ki-GPS (Nje ya nchi au umezima location). Tumekuweka Mwenge, Dar es Salaam! 📍", { duration: 6000 });
        }
      }
    };

    if ("geolocation" in navigator) {
      let timer: any = null;
      if (isInitial) {
        // Non-blocking timer to guarantee rapid interface initialization on slow mobile connections
        timer = setTimeout(() => {
          triggerIpFallback();
        }, 3500);
      } else {
        toast.loading("Inatafuta mahali ulipo sahihi kwa GPS... 📡", { id: "gps-loading" });
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          gpsResolved = true;
          if (timer) clearTimeout(timer);
          if (!isInitial) toast.dismiss("gps-loading");
          
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          if (lat && lng && isInTanzania(lat, lng)) {
            setPickupPos([lat, lng]);
            setSettingMode("pickup");
            const addr = await reverseGeocode(lat, lng);
            if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
              setPickup(addr);
            } else {
              setPickup(getNearestPopularPlace(lat, lng));
            }
            if (!isInitial) {
              toast.success("Eneo lako la sasa limepatikana kupitia GPS! 📍");
            }
          } else {
            console.warn("[TaxiBooking] GPS returned coordinates outside Tanzania or empty:", lat, lng);
            await triggerIpFallback();
          }
        },
        async (error) => {
          console.warn("High accuracy GPS timed out, attempting fast cellular triangulation...", error);
          
          // Fall back gracefully to low-accuracy cellular/WiFi position (extremely fast indoors)
          navigator.geolocation.getCurrentPosition(
            async (positionLow) => {
              gpsResolved = true;
              if (timer) clearTimeout(timer);
              if (!isInitial) toast.dismiss("gps-loading");
              
              const lat = positionLow.coords.latitude;
              const lng = positionLow.coords.longitude;
              
              if (lat && lng && isInTanzania(lat, lng)) {
                setPickupPos([lat, lng]);
                setSettingMode("pickup");
                const addr = await reverseGeocode(lat, lng);
                if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
                  setPickup(addr);
                } else {
                  setPickup(getNearestPopularPlace(lat, lng));
                }
                if (!isInitial) {
                  toast.success("Eneo lako limegunduliwa! 📍");
                }
              } else {
                console.warn("[TaxiBooking] Low-accuracy GPS returned coordinates outside Tanzania or empty:", lat, lng);
                await triggerIpFallback();
              }
            },
            async (errorLow) => {
              if (timer) clearTimeout(timer);
              if (!isInitial) toast.dismiss("gps-loading");
              console.warn("[TaxiBooking] Triangulation fallback to IP position:", errorLow);
              await triggerIpFallback();
            },
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      );
    } else {
      triggerIpFallback();
    }
  };

  // Load initial readable names & detect current location
  useEffect(() => {
    handleCurrentLocation(true);
  }, []);

  // Watch customer's actual GPS location in real-time
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (lat && lng) {
            setUserLivePos([lat, lng]);
          }
        },
        (err) => {
          console.warn("[TaxiBooking] watchPosition error:", err);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const [extraStops, setExtraStops] = useState<Array<{ id: string; address: string; lat?: number; lng?: number }>>([]);
  const effectiveStops = useMemo(() => {
    if (activeRide?.stops && Array.isArray(activeRide.stops) && activeRide.stops.length > 0) {
      return activeRide.stops;
    }
    return extraStops;
  }, [activeRide?.stops, extraStops]);

  const { routeCoords, totalDistance, totalDuration } = useRouting(
    pickupPos,
    destination ? destPos : [NaN, NaN],
    false,
    effectiveStops
  );

  const { createRide, isLoading: isCreatingRide } = useCreateRide();

  const [timeTicker, setTimeTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Reset secondsOffset when ride status or ID changes
  useEffect(() => {
    setSecondsOffset(0);
  }, [rideId, activeRide?.status]);
  const [driverLivePos, setDriverLivePos] = useState<{
    lat: number;
    lng: number;
    heading?: number;
  } | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const lastFetchedPosRef = useRef<any>(null);
  const driverBearingsRef = useRef<Record<string, { lat: number; lng: number; bearing: number }>>({});

  const driverApproachRouteRef = useRef<[number, number][]>([]);
  const [approachRoute, setApproachRoute] = useState<[number, number][]>([]);
  const [realTripRoute, setRealTripRoute] = useState<[number, number][]>([]);
  const lastActiveRideIdStatusRef = useRef<string>("");

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
                console.warn("Direct trip fetch failed in TaxiBooking:", e);
              }
            }
          }

          if (json.code === "Ok" && json.routes && json.routes.length > 0) {
            const route = json.routes[0];
            const coords: [number, number][] = route.geometry.coordinates.map(
              (c: number[]) => [c[1], c[0]] as [number, number]
            );
            if (coords.length > 0) {
              console.log("[TaxiBooking] Successfully fetched real-world street curves for trip route!");
              setRealTripRoute(coords);
              return;
            }
          }
        }
      } catch (e) {
        console.error("[TaxiBooking] Failed to fetch real trip route:", e);
      }
    };

    fetchTripRoute();
  }, [activeRide?.id, activeRide?.pickup?.lat, activeRide?.destination?.lat]);

  const lastReroutePosRef = useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!activeRide || activeRide.status !== "on_trip" || !driverLivePos || realTripRoute.length === 0) {
      lastReroutePosRef.current = null;
      return;
    }

    const getDistMetersLocal = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
      const R = 6371000;
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Calculate minimum distance from driver's live position to any point on our active trip route line
    let minDistance = Infinity;
    for (let i = 0; i < realTripRoute.length; i++) {
      const d = getDistMetersLocal(driverLivePos, { lat: realTripRoute[i][0], lng: realTripRoute[i][1] });
      if (d < minDistance) {
        minDistance = d;
      }
    }

    // If driver is more than 80 meters away from the active route, we treat this as a road deviation ("anti way")
    // and fetch a new route instantly from their current position to destination
    if (minDistance > 80) {
      // Throttle: only reroute if they have moved at least 50 meters from our last reroute position
      if (lastReroutePosRef.current) {
        const movedSinceLastReroute = getDistMetersLocal(driverLivePos, lastReroutePosRef.current);
        if (movedSinceLastReroute < 50) {
          return;
        }
      }

      console.log(`[TaxiBooking] Road deviation ("anti way") detected! Distance to route: ${minDistance.toFixed(1)}m. Recalculating trip route...`);

      const triggerRerouteFetch = async () => {
        const driverStr = `${driverLivePos.lng},${driverLivePos.lat}`;
        const destStr = `${activeRide.destination.lng},${activeRide.destination.lat}`;
        const url = `/api/geo/route?coords=${encodeURIComponent(driverStr + ";" + destStr)}`;

        try {
          const response = await fetch(url);
          if (response.ok) {
            let json = await response.json();
            if (json.isFallback) {
              const directUrls = [
                `https://router.project-osrm.org/route/v1/driving/${driverStr};${destStr}?overview=full&geometries=geojson&steps=true`,
                `https://routing.openstreetmap.de/routed-car/route/v1/driving/${driverStr};${destStr}?overview=full&geometries=geojson&steps=true`
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
                } catch (e) {}
              }
            }

            if (json.code === "Ok" && json.routes && json.routes.length > 0) {
              const route = json.routes[0];
              const coords: [number, number][] = route.geometry.coordinates.map(
                (c: number[]) => [c[1], c[0]] as [number, number]
              );
              if (coords.length > 0) {
                console.log("[TaxiBooking] Successfully rerouted trip line following driver's road deviation!");
                setRealTripRoute(coords);
                lastReroutePosRef.current = driverLivePos;

                // Sync new coordinates back to Firestore so driver simulation and shared viewers are fully aligned
                try {
                  await updateDoc(doc(db, "rides", activeRide.id), {
                    routeCoords: coords.map(c => ({ lat: c[0], lng: c[1] })),
                    navigationMessage: "Njia mpya imepatikana! Antway inaendelea kukuongoza.",
                    isRerouting: false,
                    updatedAt: serverTimestamp()
                  });
                  toast.info("🔄 Antway: Njia imerekebishwa kufuatana na mabadiliko ya barabara!", {
                    duration: 5000
                  });
                } catch (err) {
                  console.error("Failed to update reroute in Firestore:", err);
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch dynamic reroute:", err);
        }
      };

      triggerRerouteFetch();
    }
  }, [driverLivePos, activeRide?.id, activeRide?.status, realTripRoute.length]);

  // Automated effect that listens specifically to the isRerouting flag in Firestore
  // to instantly recalculate and sync the detour route when triggered automatically or manually
  useEffect(() => {
    if (!activeRide || !activeRide.isRerouting || !driverLivePos || !activeRide.destination) return;

    console.log("[TaxiBooking] Firestore isRerouting flag is true! Automatically recalculating route...");

    const recalculateDueToFlag = async () => {
      const driverStr = `${driverLivePos.lng},${driverLivePos.lat}`;
      const destStr = `${activeRide.destination.lng},${activeRide.destination.lat}`;
      const url = `/api/geo/route?coords=${encodeURIComponent(driverStr + ";" + destStr)}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          let json = await response.json();
          if (json.isFallback) {
            const directUrls = [
              `https://router.project-osrm.org/route/v1/driving/${driverStr};${destStr}?overview=full&geometries=geojson&steps=true`,
              `https://routing.openstreetmap.de/routed-car/route/v1/driving/${driverStr};${destStr}?overview=full&geometries=geojson&steps=true`
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
              } catch (e) {}
            }
          }

          if (json.code === "Ok" && json.routes && json.routes.length > 0) {
            const route = json.routes[0];
            const coords: [number, number][] = route.geometry.coordinates.map(
              (c: number[]) => [c[1], c[0]] as [number, number]
            );
            if (coords.length > 0) {
              console.log("[TaxiBooking] Successfully auto-recalculated detour route from isRerouting flag!");
              setRealTripRoute(coords);
              lastReroutePosRef.current = driverLivePos;

              try {
                await updateDoc(doc(db, "rides", activeRide.id), {
                  routeCoords: coords.map(c => ({ lat: c[0], lng: c[1] })),
                  navigationMessage: "Njia mpya imepatikana! Antway inaendelea kukuongoza.",
                  isRerouting: false,
                  updatedAt: serverTimestamp()
                });
                toast.info("🔄 Antway: Njia imerekebishwa kufuatana na mabadiliko ya barabara!", {
                  duration: 5000
                });
              } catch (err) {
                console.error("Failed to update reroute from flag in Firestore:", err);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch dynamic reroute from flag:", err);
      }
    };

    recalculateDueToFlag();
  }, [activeRide?.id, activeRide?.isRerouting, driverLivePos?.lat, driverLivePos?.lng]);

  // Instantly reflect updated Firestore routeCoords in local map state
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
      setApproachRoute([]);
      lastActiveRideIdStatusRef.current = "";
      return;
    }

    const currentKey = `${activeRide.id}_${activeRide.status}`;
    if (lastActiveRideIdStatusRef.current !== currentKey) {
      lastActiveRideIdStatusRef.current = currentKey;

      if (["accepted", "driver_arriving"].includes(activeRide.status) && activeRide.driverLocation) {
        const startLoc = activeRide.driverLocation;
        const pickupLoc = activeRide.pickup;

        // Immediately populate a quick simulated fallback so there is zero rendering delay
        const initialSim = generateSimulatedRoads(
          [startLoc.lat, startLoc.lng],
          [pickupLoc.lat, pickupLoc.lng]
        );
        driverApproachRouteRef.current = initialSim;
        setApproachRoute(initialSim);

        // Fetch precise real-world street routing
        const fetchRealApproach = async () => {
          try {
            const pickupStr = `${pickupLoc.lng},${pickupLoc.lat}`;
            const startStr = `${startLoc.lng},${startLoc.lat}`;
            const url = `/api/geo/route?coords=${encodeURIComponent(startStr + ";" + pickupStr)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("API server response failed");
            let json = await response.json();

            if (json.isFallback) {
              const directUrls = [
                `https://router.project-osrm.org/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`,
                `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`,
                `http://router.project-osrm.org/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`,
                `http://routing.openstreetmap.de/routed-car/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`
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
                } catch (errDirect) {
                  console.warn("Direct approach fetch failed:", errDirect);
                }
              }
            }

            if (json.code === "Ok" && json.routes && json.routes.length > 0) {
              const route = json.routes[0];
              const coords: [number, number][] = route.geometry.coordinates.map(
                (c: number[]) => [c[1], c[0]] as [number, number]
              );
              if (coords.length > 0) {
                driverApproachRouteRef.current = coords;
                setApproachRoute(coords);
                console.log("[Customer View] Driver approach route fetched from real roads API successfully!");
              }
            }
          } catch (err) {
            console.error("Failed to fetch real driver approach route:", err);
          }
        };

        fetchRealApproach();
      } else {
        driverApproachRouteRef.current = [];
        setApproachRoute([]);
      }
    }
  }, [activeRide?.id, activeRide?.status, activeRide?.driverLocation?.lat, activeRide?.driverLocation?.lng]);

  const sliceRouteFromCurrentPos = (
    fullRoute: [number, number][],
    currentPos: { lat: number; lng: number } | null
  ): [number, number][] => {
    if (!fullRoute || fullRoute.length === 0) return [];
    if (!currentPos) return fullRoute;

    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < fullRoute.length; i++) {
      const lat = fullRoute[i][0];
      const lng = fullRoute[i][1];
      const diffLat = lat - currentPos.lat;
      const diffLng = lng - currentPos.lng;
      const dist = diffLat * diffLat + diffLng * diffLng;

      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const sliced = [...fullRoute.slice(closestIndex)];
    // Always connect the active trip line seamlessly to the driver's exact position to avoid any visual gap
    if (sliced.length > 0) {
      sliced[0] = [currentPos.lat, currentPos.lng];
    }
    return sliced;
  };

   // Persistence/Sharing: Look for active rides or shared rides on mount
  useEffect(() => {
    const paramRideId = searchParams.get("rideId");
    if (paramRideId) {
      console.log("[TaxiBooking] Loading shared ride from url param:", paramRideId);
      setRideId(paramRideId);
      setIsRestoring(false);
      return;
    }

    if (loading) return;

    if (!user) {
      setIsRestoring(false);
      navigate("/login");
      return;
    }

    console.log("[TaxiBooking] Checking for active rides for user:", user.uid);
    const ridesRef = collection(db, "rides");
    const q = query(
      ridesRef,
      where("customerId", "==", user.uid),
      where("status", "in", [
        "pending",
        "accepted",
        "driver_arriving",
        "driver_arrived",
        "on_trip",
      ]),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const ride = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
          } as any;
          console.log(
            "[TaxiBooking] Found persisting active ride:",
            ride.id,
            "status:",
            ride.status,
          );
          setRideId(ride.id);

          // Immediate step transition logic if possible
          if (ride.status === "on_trip") setStep("on_trip");
          else if (ride.status === "driver_arrived") setStep("arriving");
          else if (
            ride.status === "accepted" ||
            ride.status === "driver_arriving"
          )
            setStep("found");
          else if (ride.status === "pending") setStep("searching");
          else if (ride.status === "completed") setStep("rating");
        }
        setIsRestoring(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "rides");
        setIsRestoring(false);
      }
    );

    return () => unsubscribe();
  }, [user, loading, searchParams]);

  // Live Tracking: Synchronize specialized states from the active ride
  useEffect(() => {
    if (activeRide) {
      if (activeRide.pickup) {
        const pLat = Number(activeRide.pickup.lat ?? (activeRide.pickup as any).latitude);
        const pLng = Number(activeRide.pickup.lng ?? (activeRide.pickup as any).lon ?? (activeRide.pickup as any).longitude);
        if (!isNaN(pLat) && !isNaN(pLng)) {
          setPickupPos([pLat, pLng]);
        }
        setPickup(activeRide.pickup.address || pickup);
      }
      if (activeRide.destination) {
        const dLat = Number(activeRide.destination.lat ?? (activeRide.destination as any).latitude);
        const dLng = Number(activeRide.destination.lng ?? (activeRide.destination as any).lon ?? (activeRide.destination as any).longitude);
        if (!isNaN(dLat) && !isNaN(dLng)) {
          setDestPos([dLat, dLng]);
        }
        setDestination(activeRide.destination.address || destination);
      }

      if (
        activeRide.driverLocation &&
        ["accepted", "driver_arriving", "driver_arrived", "on_trip"].includes(
          activeRide.status,
        )
      ) {
        console.log(
          "[TaxiBooking] Syncing driver location from ride doc:",
          activeRide.driverLocation,
        );
        const loc = activeRide.driverLocation;
        const drvLat = Number(loc.lat ?? (loc as any).latitude);
        const drvLng = Number(loc.lng ?? (loc as any).lon ?? (loc as any).longitude);
        if (!isNaN(drvLat) && !isNaN(drvLng)) {
          setDriverLivePos({ ...loc, lat: drvLat, lng: drvLng });
        }

        const target =
          activeRide.status === "on_trip"
            ? activeRide.destination
            : activeRide.pickup;
        const tgtLat = Number(target?.lat ?? (target as any)?.latitude);
        const tgtLng = Number(target?.lng ?? (target as any)?.lon ?? (target as any)?.longitude);
        if (!isNaN(drvLat) && !isNaN(drvLng) && !isNaN(tgtLat) && !isNaN(tgtLng)) {
          const dist = L.latLng(drvLat, drvLng).distanceTo(L.latLng(tgtLat, tgtLng));
          setLiveDistance(dist / 1000); // km
        }
      } else if (activeRide?.status === "completed") {
        setStep("rating");
      }
    }
  }, [
    activeRide?.driverLocation?.lat,
    activeRide?.driverLocation?.lng,
    (activeRide?.driverLocation as any)?.heading,
    activeRide?.status,
    activeRide?.pickup?.lat,
    activeRide?.destination?.lat,
  ]);

  // Optional: Also listen to the independent driver doc for even more frequent or "idle" updates
  useEffect(() => {
    if (
      activeRide?.driverId &&
      ["accepted", "driver_arriving", "driver_arrived", "on_trip"].includes(
        activeRide.status,
      )
    ) {
      const unsub = onSnapshot(
        doc(db, "drivers", activeRide.driverId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const pos = data.location || data.currentPosition;
            if (pos) {
              setDriverLivePos(pos);
            }
          }
        },
        (error) => {
          handleFirestoreError(
            error,
            OperationType.GET,
            `drivers/${activeRide.driverId}`,
          );
        },
      );
      return () => unsub();
    }
  }, [activeRide?.driverId, activeRide?.status]);
  useMatchmaking(activeRide as any);

  const [driverRouteCoords, setDriverRouteCoords] = useState<
    [number, number][]
  >([]);

  // Driver Route: Fetch route from driver to target with smart caching and slicing
  useEffect(() => {
    const fetchDriverRoute = async () => {
      if (!driverLivePos || !activeRide) return;
      const target =
        activeRide.status === "on_trip"
          ? activeRide.destination
          : activeRide.pickup;

      // Helper to calculate distance in meters
      const getDistMetersLocal = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
        const R = 6371000; // meters
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      if (lastFetchedPosRef.current && driverRouteCoords.length > 0) {
        const dist = getDistMetersLocal(driverLivePos, lastFetchedPosRef.current);
        if (dist < 150) {
          // Find closest index on current route
          let minDistance = Infinity;
          let closestIndex = 0;
          for (let i = 0; i < driverRouteCoords.length; i++) {
            const coord = driverRouteCoords[i];
            const d = getDistMetersLocal(driverLivePos, { lat: coord[0], lng: coord[1] });
            if (d < minDistance) {
              minDistance = d;
              closestIndex = i;
            }
          }
          if (minDistance < 80) {
            setDriverRouteCoords(driverRouteCoords.slice(closestIndex));
            lastFetchedPosRef.current = driverLivePos;
            return;
          }
        }
      }

      try {
        const coords = `${driverLivePos.lng},${driverLivePos.lat};${target.lng},${target.lat}`;
        const response = await fetch(`/api/geo/route?coords=${encodeURIComponent(coords)}`);
        if (!response.ok)
          throw new Error(
            `Driver routing failed with status ${response.status}`,
          );
        let data = await response.json();

        // Direct browser address request if server falls back to simulated coordinates
        if (data.isFallback) {
          console.log("[TaxiBooking] Driver route server proxy returned fallback. Attempting DIRECT browser fetch...");
          const directUrls = [
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
            `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
            `http://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
            `http://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
            `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${coords}?overview=full&geometries=geojson&steps=true`,
            `http://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${coords}?overview=full&geometries=geojson&steps=true`,
            `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`,
            `http://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`
          ];
          for (const directUrl of directUrls) {
            try {
              const clientRes = await fetch(directUrl);
              if (clientRes.ok) {
                const clientJson = await clientRes.json();
                if (clientJson && clientJson.code === "Ok" && clientJson.routes?.[0]) {
                  console.log(`[TaxiBooking] Driver route DIRECT fetch succeeded via ${directUrl}`);
                  data = clientJson;
                  break;
                }
              }
            } catch (errDirect) {
              console.warn(`[TaxiBooking] Driver direct fetch failed for ${directUrl}`, errDirect);
            }
          }
        }

        if (data.routes?.[0]) {
          const fetched: [number, number][] = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          if (fetched.length > 0) {
            const startPoint: [number, number] = [driverLivePos.lat, driverLivePos.lng];
            const endPoint: [number, number] = [target.lat, target.lng];
            
            const distStart = getDistMetersLocal(driverLivePos, { lat: fetched[0][0], lng: fetched[0][1] });
            if (distStart > 1 && distStart < 500) {
              fetched.unshift(startPoint);
            }
            const distEnd = getDistMetersLocal(
              { lat: endPoint[0], lng: endPoint[1] },
              { lat: fetched[fetched.length - 1][0], lng: fetched[fetched.length - 1][1] }
            );
            if (distEnd > 1 && distEnd < 500) {
              fetched.push(endPoint);
            }
          }
          setDriverRouteCoords(fetched);
          lastFetchedPosRef.current = driverLivePos;
        }
      } catch (e) {
        console.error("Driver routing failed", e);
      }
    };

    if (
      driverLivePos &&
      ["accepted", "driver_arriving", "driver_arrived", "on_trip"].includes(
        activeRide?.status || "",
      )
    ) {
      fetchDriverRoute();
    } else {
      setDriverRouteCoords([]);
      lastFetchedPosRef.current = null;
    }
  }, [driverLivePos, activeRide?.status]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchTimer, setSearchTimer] = useState<any>(null);

  // Advanced Trip Options (Boresha Features)
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>("08:00");
  
  const [newStopInput, setNewStopInput] = useState("");
  const [showAddStopInput, setShowAddStopInput] = useState(false);

  const [usePoints, setUsePoints] = useState(false);
  const userPointsBalance = 1200; // 1200 Points = TZS 1,200 discount

  const { drivers } = useNearbyDrivers();

  const getDriverBearing = (driverId: string, lat: number, lng: number): number => {
    const prev = driverBearingsRef.current[driverId];
    if (!prev) {
      const hash = driverId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const initialBearing = hash % 360;
      driverBearingsRef.current[driverId] = { lat, lng, bearing: initialBearing };
      return initialBearing;
    }
    
    const dLat = Math.abs(lat - prev.lat);
    const dLng = Math.abs(lng - prev.lng);
    if (dLat > 0.00001 || dLng > 0.00001) {
      const radians = Math.PI / 180;
      const dLngRad = (lng - prev.lng) * radians;
      const lat1Rad = prev.lat * radians;
      const lat2Rad = lat * radians;
      
      const y = Math.sin(dLngRad) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLngRad);
      let brng = Math.atan2(y, x) * 180 / Math.PI;
      const targetBearing = (brng + 360) % 360;
      
      // Calculate shortest path continuous angle delta (no 360° flip glitch)
      const currentNorm = ((prev.bearing % 360) + 360) % 360;
      let diff = targetBearing - currentNorm;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const continuousBearing = prev.bearing + diff;
      
      driverBearingsRef.current[driverId] = { lat, lng, bearing: continuousBearing };
      return continuousBearing;
    }
    
    return prev.bearing;
  };

  const getDriverIcon = (type: string, driverId: string, lat: number, lng: number, dbHeading?: number) => {
    const rotation = typeof dbHeading === "number" ? dbHeading : getDriverBearing(driverId, lat, lng);
    const customVehicle = config?.vehicles?.[type];

    // Check if it is a custom image (which are usually side-profile pictures, e.g. of a motorcycle/car)
    // We only use the custom image when mapMarkerLayout is explicitly set to 'custom'
    const mapMarkerLayout = customVehicle?.mapMarkerLayout || 'top_down';

    if (customVehicle?.mapMarkerUrl && (mapMarkerLayout === 'custom' || mapMarkerLayout === 'custom_side' || mapMarkerLayout === 'custom_top_down')) {
      if (mapMarkerLayout === 'custom_top_down' || (mapMarkerLayout === 'custom' && type === 'bike')) {
        // Compute final orientation offset
        let finalRotation = rotation;
        const orientation = customVehicle.mapMarkerOrientation || 'left';
        if (orientation === 'left') {
          finalRotation += 90;
        } else if (orientation === 'right') {
          finalRotation -= 90;
        } else if (orientation === 'bottom') {
          finalRotation += 180;
        }

        return L.divIcon({
          className: "driver-marker-icon-clean-custom-topdown driver-marker-smooth",
          html: `
            <div class="relative flex items-center justify-center pointer-events-none" style="width: 44px; height: 44px;">
              <!-- Gentle micro pulse for premium active visibility -->
              <div class="absolute w-10 h-10 rounded-full bg-[#7F77DD]/10 animate-ping pointer-events-none"></div>
              
              <!-- Map Marker Glowing Halo -->
              <div class="absolute w-8 h-8 rounded-full bg-black/15 blur-[2px] pointer-events-none"></div>
              
              <div class="relative transition-transform duration-500 ease-out flex items-center justify-center" style="transform: rotate(${finalRotation}deg); width: 40px; height: 40px;">
                <img 
                  src="${customVehicle.mapMarkerUrl}" 
                  class="w-10 h-10 object-contain drop-shadow-[0_2.5px_4px_rgba(0,0,0,0.4)]" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
      } else {
        // For custom image side-profile photos ('custom_side' or legacy 'custom'), 360-deg rotation makes them go upside-down.
        // Instead we keep them horizontal/upright and flip them horizontally based on direction of travel (East vs West)
        const isMovingEast = rotation > 0 && rotation < 180;
        const flipTransform = isMovingEast ? "scaleX(-1)" : "scaleX(1)";

        return L.divIcon({
          className: "driver-marker-icon-clean-custom driver-marker-smooth",
          html: `
            <div class="relative flex items-center justify-center transition-all duration-300" style="width: 34px; height: 34px;">
              <!-- Gentle micro pulse for premium active visibility -->
              <div class="absolute -inset-1.5 rounded-full bg-[#7F77DD]/10 animate-ping pointer-events-none"></div>
              
              <!-- Sleek 3D Glowing Podium/Shadow disk at the bottom to ground the vehicle -->
              <div class="absolute bottom-0.5 w-6 h-1.5 rounded-full bg-black/45 blur-[1px] pointer-events-none"></div>
              
              <img 
                src="${customVehicle.mapMarkerUrl}" 
                class="w-8 h-8 object-contain drop-shadow-[0_2px_4.5px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out" 
                style="transform: ${flipTransform};"
                referrerPolicy="no-referrer" 
              />
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
      }
    }

    // Default top-down vectors remain rotatable 360 degrees
    return L.divIcon({
      className: "driver-marker-icon-clean-wrapper driver-marker-smooth",
      html: `
        <div class="relative flex items-center justify-center w-[46px] h-[46px]">
          <!-- Active sonar radar ripple radiating under the driver -->
          <div class="absolute w-[34px] h-[34px] rounded-full bg-emerald-500/15 border border-emerald-500/20 animate-pulse pointer-events-none"></div>
          
          <!-- Elegant premium pointer/glow ring (transparent background) -->
          <div class="absolute w-[38px] h-[38px] rounded-full bg-transparent ${theme === 'dark' ? 'border-[#00E5A0]/60 shadow-[0_0_12px_rgba(0,229,160,0.35)]' : 'border-[#1E724C]/60 shadow-[0_0_12px_rgba(30,114,76,0.25)]'} border flex items-center justify-center">
            <!-- Central rotated vehicle wrapper -->
            <div class="transition-transform duration-300 ease-out select-none pointer-events-none flex items-center justify-center w-7 h-7" style="transform: rotate(${rotation}deg);">
              <!-- Directional Compass Flashlight Light Beam / Field-of-View Cone (Mwangaza wa Dira ya Simu) -->
              <div class="absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom pointer-events-none" style="width: 90px; height: 80px; margin-bottom: 2px;">
                <svg viewBox="0 0 100 80" class="w-full h-full overflow-visible">
                  <defs>
                    <radialGradient id="tbCompassBeamGrad_${theme === 'dark' ? 'dark' : 'light'}" cx="50%" cy="100%" r="100%">
                      <stop offset="0%" stop-color="${theme === 'dark' ? '#00FF88' : '#3B82F6'}" stop-opacity="0.75"/>
                      <stop offset="45%" stop-color="${theme === 'dark' ? '#00FF88' : '#3B82F6'}" stop-opacity="0.35"/>
                      <stop offset="100%" stop-color="${theme === 'dark' ? '#00FF88' : '#3B82F6'}" stop-opacity="0"/>
                    </radialGradient>
                  </defs>
                  <path d="M 50 80 L 12 0 A 85 85 0 0 1 88 0 Z" fill="url(#tbCompassBeamGrad_${theme === 'dark' ? 'dark' : 'light'})" />
                </svg>
              </div>

              <!-- Heading notch/pointer at front of vehicle -->
              <div class="absolute top-[-2px] w-2 h-2 rotate-45 ${theme === 'dark' ? 'bg-[#00FF88]' : 'bg-[#3B82F6]'} rounded-[1px] shadow-[0_0_8px_rgba(0,255,136,0.9)] z-10"></div>
              
              <!-- Premium vehicle SVG -->
              <div class="w-7 h-7 flex items-center justify-center relative z-10">
                ${getDriverSvg(type, theme === "dark")}
              </div>
            </div>
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    });
  };

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

    const displayAddr = cleanAddr(pickup);
    const userPhoto = profile?.photoURL || user?.photoURL || null;
    const userName = profile?.displayName || user?.displayName || "Mteja";
    const key = `taxi-start-scaled-${isDark}-${displayAddr}-${etaText || ''}-${userPhoto || ''}`;
    if (taxiPinIconCacheMap[key]) {
      return taxiPinIconCacheMap[key];
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
            
            <!-- User Profile Picture Avatar -->
            <div class="w-6.5 h-6.5 rounded-full border-2 border-emerald-500 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 shadow-sm flex items-center justify-center">
              ${userPhoto 
                ? `<img src="${userPhoto}" class="w-full h-full object-cover" alt="${userName}" />`
                : `<span class="text-[9px] font-black text-emerald-600">${userName.charAt(0)}</span>`
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
  taxiPinIconCacheMap[key] = icon;
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

  const displayAddr = cleanAddr(destination);
  const key = `taxi-end-scaled-${isDark}-${displayAddr}-${etaText || ''}`;
  if (taxiPinIconCacheMap[key]) {
    return taxiPinIconCacheMap[key];
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
    taxiPinIconCacheMap[key] = icon;
    return icon;
  };

  const getNavEndPin = (_destName?: string) => {
    const key = "nav-end-pin-clean-minimal";
    if (taxiPinIconCacheMap[key]) return taxiPinIconCacheMap[key];

    const icon = L.divIcon({
      className: "custom-nav-dest-marker",
      html: `
        <div class="relative flex flex-col items-center pointer-events-none select-none" style="transform-origin: bottom center;">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs">
            🏁
          </div>
          <div class="w-2 h-2 bg-red-600 rotate-45 -mt-1 shadow-md"></div>
          <div class="w-3 h-1 bg-black/30 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      `,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });
    taxiPinIconCacheMap[key] = icon;
    return icon;
  };

  const geocodeAddress = (query: string) => {
    if (searchTimer) clearTimeout(searchTimer);

    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      return;
    }

    const TZ_POPULAR_PLACES = [
      { display_name: "Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7645, lon: 39.2492 },
      { display_name: "New City Road off Bagamoyo Road, Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.7650, lon: 39.2485 },
      { display_name: "Vikawe Bondeni, Kibaha Town, Mkoa wa Pwani, Coastal Zone, Tanzania", lat: -6.7580, lon: 38.9320 },
      { display_name: "Kariakoo, Ilala Municipal, Dar es Salaam, Coastal Zone, 11101, Tanzania", lat: -6.82, lon: 39.278 },
      { display_name: "Posta, Kivukoni, Ilala Municipal, Dar es Salaam, Coastal Zone, 11105, Tanzania", lat: -6.8164, lon: 39.2902 },
      { display_name: "Mwenge, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7681, lon: 39.2274 },
      { display_name: "Sinza, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.7812, lon: 39.2223 },
      { display_name: "Masaki, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.7441, lon: 39.2812 },
      { display_name: "Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7645, lon: 39.2492 },
      { display_name: "Ubungo Bus Terminal, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14114, Tanzania", lat: -6.7961, lon: 39.2155 },
      { display_name: "Mbezi Luis, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14115, Tanzania", lat: -6.7831, lon: 39.1952 },
      { display_name: "Kinondoni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7952, lon: 39.2631 },
      { display_name: "Temeke, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.855, lon: 39.265 },
      { display_name: "Kigamboni, Kigamboni Municipal, Dar es Salaam, Coastal Zone, 17101, Tanzania", lat: -6.825, lon: 39.31 },
      { display_name: "Ilala, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.827, lon: 39.262 },
      { display_name: "Gerezani, Ilala Municipal, Dar es Salaam, Coastal Zone, 11102, Tanzania", lat: -6.8239, lon: 39.2797 },
      { display_name: "Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.7725, lon: 39.2789 },
      { display_name: "Msasani, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7561, lon: 39.2741 },
      { display_name: "Tabata, Ilala Municipal, Dar es Salaam, Coastal Zone, 12105, Tanzania", lat: -6.819, lon: 39.215 },
      { display_name: "Segerea, Ilala Municipal, Dar es Salaam, Coastal Zone, 12108, Tanzania", lat: -6.84, lon: 39.19 },
      { display_name: "Kawe, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14109, Tanzania", lat: -6.7389, lon: 39.2558 },
      { display_name: "Tegeta, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14108, Tanzania", lat: -6.685, lon: 39.214 },
      { display_name: "Kunduchi, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.669, lon: 39.219 },
      { display_name: "Kibamba, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14116, Tanzania", lat: -6.79, lon: 39.11 },
      { display_name: "Kimara, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.792, lon: 39.167 },
      { display_name: "Kisutu, Ilala Municipal, Dar es Salaam, Coastal Zone, 11104, Tanzania", lat: -6.814, lon: 39.287 },
      { display_name: "Upanga, Ilala Municipal, Dar es Salaam, Coastal Zone, 11102, Tanzania", lat: -6.804, lon: 39.28 },
      { display_name: "Mbagala, Temeke Municipal, Dar es Salaam, Coastal Zone, 15102, Tanzania", lat: -6.891, lon: 39.269 },
      { display_name: "Chanika, Ilala Municipal, Dar es Salaam, Coastal Zone, 12111, Tanzania", lat: -6.91, lon: 39.08 },
      { display_name: "Kivukoni Ferry, Ilala Municipal, Dar es Salaam, Coastal Zone, 11105, Tanzania", lat: -6.821, lon: 39.299 },
      { display_name: "Boko, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.649, lon: 39.191 },
      { display_name: "Bunju, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14106, Tanzania", lat: -6.611, lon: 39.166 },
      { display_name: "Julius Nyerere Airport (JNIA), Kipawa, Ukonga, Ilala Municipal, Dar es Salaam, Coastal Zone, 12109, Tanzania", lat: -6.8781, lon: 39.2026 },
      { display_name: "Tazara, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.843, lon: 39.241 },
      { display_name: "Morocco, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7885, lon: 39.2604 },
      { display_name: "Tandika, Temeke Municipal, Dar es Salaam, Coastal Zone, 15103, Tanzania", lat: -6.858, lon: 39.259 },
      { display_name: "Buguruni, Ilala Municipal, Dar es Salaam, Coastal Zone, 12102, Tanzania", lat: -6.828, lon: 39.245 },
      { display_name: "Vingunguti, Ilala Municipal, Dar es Salaam, Coastal Zone, 12103, Tanzania", lat: -6.842, lon: 39.218 },
      { display_name: "Kijitonyama, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.778, lon: 39.245 },
      { display_name: "Makumbusho, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.776, lon: 39.241 },
      { display_name: "Coco Beach, Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.765, lon: 39.294 },
      { display_name: "The Slipway, Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.749, lon: 39.284 },
      { display_name: "Mlimani City Mall, Sam Nujoma Road, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.7722, lon: 39.2241 },
      { display_name: "Karume, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.8202, lon: 39.2612 },
      { display_name: "Machinga Complex, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.8218, lon: 39.2598 },
      { display_name: "Kigogo, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.807, lon: 39.231 },
      { display_name: "Mabibo, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.801, lon: 39.211 },
      { display_name: "Manzese, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.793, lon: 39.217 },
      { display_name: "Keko, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.837, lon: 39.282 },
      { display_name: "Chang’ombe, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.841, lon: 39.268 },
      { display_name: "Kurasini, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.848, lon: 39.289 },
      { display_name: "Dodoma Town Central, Dodoma City, Mkoa wa Dodoma, Central Zone, Tanzania", lat: -6.1722, lon: 35.7481 },
      { display_name: "Arusha Clock Tower, Arusha Urban, Mkoa wa Arusha, Northern Zone, Tanzania", lat: -3.3731, lon: 36.6857 },
      { display_name: "Mwanza City Centre, Nyamagana, Mkoa wa Mwanza, Lake Zone, Tanzania", lat: -2.5164, lon: 32.9018 },
      { display_name: "Zanzibar Stone Town, Mjini Magharibi, Zanzibar, Tanzania", lat: -6.1659, lon: 39.199 },
    ];

    const trimmed = query.trim().toLowerCase();
    const localFiltered = TZ_POPULAR_PLACES.filter((place) =>
      place.display_name.toLowerCase().includes(trimmed),
    ).slice(0, 10);

    setSuggestions(localFiltered);

    if (query.length >= 1) {
      const timer = setTimeout(async () => {
        try {
          const apiQuery = query.toLowerCase().includes("tanzania")
            ? query
            : `${query}, Tanzania`;
          const response = await fetch(
            `/api/geo/search?q=${encodeURIComponent(apiQuery)}&limit=8&addressdetails=1`,
          );
          const contentType = response.headers.get("content-type");
          const isJson = contentType && contentType.includes("application/json");

          if (!response.ok) {
            let errorMsg = `Search failed with status ${response.status}`;
            if (isJson) {
              try {
                const errData = await response.json();
                errorMsg = errData.error || errorMsg;
              } catch (e) {
                // Fallback
              }
            }
            throw new Error(errorMsg);
          }

          if (!isJson) {
            throw new Error("Received non-JSON response from geocoding service");
          }

          const data = await response.json();
          if (Array.isArray(data)) {
            const fetched = data.map((item: any) => ({
              display_name: formatAddress(item),
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
            }));
            setSuggestions((prev) => {
              const existingNames = new Set(
                prev.map((p) => p.display_name.toLowerCase()),
              );
              const filteredFetched = fetched.filter(
                (f: any) => !existingNames.has(f.display_name.toLowerCase()),
              );
              return [...prev, ...filteredFetched].slice(0, 20);
            });
          }
        } catch (error) {
          console.error("Geocoding search failed", error);
        }
      }, 500);
      setSearchTimer(timer);
    }
  };

  const selectSuggestion = (suggestion: any) => {
    const sLat = parseFloat(suggestion.lat ?? suggestion.latitude);
    const sLng = parseFloat(suggestion.lon ?? suggestion.lng ?? suggestion.longitude);
    if (isNaN(sLat) || isNaN(sLng)) {
      console.warn("Invalid suggestion coordinates:", suggestion);
      return;
    }
    const pos: [number, number] = [sLat, sLng];
    if (settingMode === "pickup") {
      setPickupPos(pos);
      setPickup(suggestion.display_name);
      setIsAutoLocated(false);
    } else {
      setDestPos(pos);
      setDestination(suggestion.display_name);
    }
    
    // Set a flag that we just selected a suggestion to block any ghost-clicks for 400ms
    justSelectedRef.current = true;
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 450);

    setSuggestions([]);
    
    // Automatically bring the bottom sheet up so they see the details and booking options
    setIsMapFullscreen(false);
    setIsMinimized(false);
  };

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    // Strictly disable selecting locations if any ride activity is happening
    if (
      rideId ||
      activeRide ||
      ["searching", "found", "arriving", "on_trip"].includes(step)
    ) {
      console.log("Map interaction blocked: Active ride in progress");
      return;
    }
    const { lat, lng } = e.latlng;

    if (settingMode === "stop") {
      toast.loading("Inatafuta jina la kituo...", { id: "geocoding-stop" });
      const addr = await reverseGeocode(lat, lng);
      toast.dismiss("geocoding-stop");
      const stopName = addr || `Kituo #${extraStops.length + 1} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setExtraStops(prev => [...prev, { id: Date.now().toString(), address: stopName, lat, lng }]);
      toast.success(`Kituo #${extraStops.length + 1} kimeongezwa: ${stopName}`, { duration: 3500 });
      setSettingMode("pickup");
      setIsMapFullscreen(false);
      setIsMinimized(false);
      return;
    }

    if (settingMode === "pickup") {
      setPickupPos([lat, lng]);
      setPickup("Inatafuta eneo... 📍");
      setIsAutoLocated(false);
      
      const addr = await reverseGeocode(lat, lng);
      setPickup(addr || "Eneo Halijapatikana");
    } else {
      setDestPos([lat, lng]);
      setDestination("Inatafuta eneo... 📍");
      
      const addr = await reverseGeocode(lat, lng);
      setDestination(addr || "Eneo Halijapatikana");
    }

    // Automatically bring the bottom sheet up so they see the details and booking options
    setIsMapFullscreen(false);
    setIsMinimized(false);
  };

  const confirmBooking = async () => {
    console.log("Confirming booking for ride option:", selectedRide?.id);
    if (!selectedRide || !destination) {
      toast.error("Tafadhali chagua unapoenda");
      return;
    }

    // Check geofence restrictions before launching search
    const rules = getPricingRules();
    const cityData = rules[selectedCity] || rules["Dar es Salaam"];
    if (cityData && cityData.geofenceActive === true) {
      const pLat = pickupPos[0];
      const pLng = pickupPos[1];
      const gfType = cityData.geofenceType || 'circle';

      if (gfType === 'circle') {
        const gfCenterObj = cityData.geofenceCenter || { lat: cityData.lat, lng: cityData.lng };
        const fallbacks = CITY_FALLBACK_COORDINATES[selectedCity] || CITY_FALLBACK_COORDINATES["Dar es Salaam"];
        const gfCenterLat = gfCenterObj.lat || cityData.lat || fallbacks.lat;
        const gfCenterLng = gfCenterObj.lng || cityData.lng || fallbacks.lng;
        const radius = cityData.geofenceRadius || 15000;

        // Haversine distance in meters
        const R = 6371000;
        const dLat = (pLat - gfCenterLat) * Math.PI / 180;
        const dLng = (pLng - gfCenterLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(gfCenterLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance > radius) {
          toast.error(`Kituo chako cha kuanzia kiko nje ya eneo la huduma la ${selectedCity}! Mipaka ya sasa ya Geofence ni kilomita ${Math.round(radius/1000)}.`);
          return;
        }
      } else if (gfType === 'polygon' && cityData.geofencePolygon && cityData.geofencePolygon.length >= 3) {
        // Ray-casting inside polygon test
        let inside = false;
        const pts = cityData.geofencePolygon;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const xi = pts[i][0], yi = pts[i][1];
          const xj = pts[j][0], yj = pts[j][1];
          const intersect = ((yi > pLng) !== (yj > pLng))
              && (pLat < (xj - xi) * (pLng - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }

        if (!inside) {
          toast.error(`Kituo chako cha kuanzia kiko nje ya mipaka ya kipekee ya huduma (Polygon) ya mji wa ${selectedCity}.`);
          return;
        }
      }
    }

    try {
      setStep("searching");
      console.log("Starting ride creation flow...");

      if (routeCoords.length === 0) {
        console.warn(
          "No route coordinates found. Attempting to proceed anyway but performance might be degraded.",
        );
      }

      const formattedCoords = routeCoords.map((c) => ({
        lat: c[0],
        lng: c[1],
      }));

      // Ensure user is signed in for the demo
      let activeUser = auth.currentUser;
      if (!activeUser) {
        console.log("No user found, signing in as guest for demo...");
        try {
          await signInGuest();
          // We must get the fresh user from auth since the state variable won't update until next render
          activeUser = auth.currentUser;
        } catch (e) {
          console.error("Guest sign in failed", e);
        }
      }

      if (!activeUser) {
        toast.error("Hujajisajili. Tafadhali jaribu tena.");
        setStep("map");
        return;
      }

      console.log("Current authorized user ID:", activeUser.uid);

      let customerName = "Mteja";
      let customerPhone = profile?.phoneNumber || "";

      if (passengerName.trim()) {
        customerName = passengerName.trim();
      } else {
        if (profile?.displayName) {
          customerName = profile.displayName;
        } else if (activeUser.displayName) {
          customerName = activeUser.displayName;
        } else if (activeUser.email) {
          const part = activeUser.email.split("@")[0];
          customerName = part.charAt(0).toUpperCase() + part.slice(1);
        }
      }

      if (passengerPhone.trim()) {
        let rawPhone = passengerPhone.trim();
        if (rawPhone.startsWith("0")) {
          customerPhone = "+255" + rawPhone.slice(1);
        } else if (rawPhone.startsWith("+")) {
          customerPhone = rawPhone;
        } else if (rawPhone.startsWith("255")) {
          customerPhone = "+" + rawPhone;
        } else {
          customerPhone = "+255" + rawPhone;
        }
      }

      const customerInfo = {
        name: customerName,
        rating: 5.0,
        avatar: passengerType === "someone_else" ? null : (profile?.photoURL || activeUser.photoURL || null),
        photo: passengerType === "someone_else" ? undefined : (profile?.photoURL || activeUser.photoURL || undefined),
        phone: customerPhone,
      };

      const calculatedDistanceKm = (totalDistance && totalDistance > 0)
        ? (totalDistance / 1000)
        : ((pickupPos && destPos) ? (getDistanceLocal(pickupPos, destPos) / 1000) : 3.0);

      const calculatedDurationMins = (totalDuration && totalDuration > 0)
        ? Math.ceil(totalDuration / 60)
        : Math.ceil((calculatedDistanceKm * 1000 / 9.5) / 60);

      const rawBasePrice = rideOptions.find((r) => r.id === selectedRide.id)?.price || selectedRide.price;
      const stopsExtra = extraStops.length * 1500;
      const discount = usePoints ? Math.min(userPointsBalance, rawBasePrice + stopsExtra - 1000) : 0;

      // PapoShare Pooling Fare Calculation
      const isEligibleForPooling = (selectedRide.id === 'bajaj' || selectedRide.id === 'mini') && shareMode === 'share';
      const detourBudgetMin = calculateDetourBudget(calculatedDurationMins);
      const sharedKm = Math.max(1, Math.round(calculatedDistanceKm * 0.75 * 10) / 10);
      
      let finalPrice = Math.max(1000, rawBasePrice + stopsExtra - discount);
      let sharedSavings = 0;

      if (isEligibleForPooling) {
        const poolCalculation = calculateDistanceBasedPapoShareFare({
          baseSoloFare: rawBasePrice,
          totalDistanceKm: calculatedDistanceKm,
          sharedDistanceKm: sharedKm,
          vehicleType: selectedRide.id,
        });
        finalPrice = Math.max(1000, poolCalculation.finalFare + stopsExtra - discount);
        sharedSavings = poolCalculation.savings;
      }

      const id = await createRide(
        activeUser.uid,
        customerInfo,
        { lat: pickupPos[0], lng: pickupPos[1], address: pickup },
        { lat: destPos[0], lng: destPos[1], address: destination },
        selectedRide.id as any,
        finalPrice,
        calculatedDistanceKm,
        calculatedDurationMins,
        formattedCoords,
        {
          scheduledAt: isScheduled ? `${scheduledDate} ${scheduledTime}` : null,
          stops: extraStops.map(s => ({ address: s.address, lat: s.lat, lng: s.lng })),
          pointsUsed: usePoints ? discount : 0,
          discountAmount: discount,
          paymentMethod: paymentMethod,
          paymentDetails: paymentMethod === 'mobile_money' ? { operator: selectedMobileOperator } : null,
          pickupNote: pickupNote.trim(),
          shareMode: selectedRide.id === 'bike' ? (allowBodaParcelAddon ? 'parcel_addon' : 'solo') : (isEligibleForPooling ? 'share' : 'solo'),
          allowSharingConsent: isEligibleForPooling ? allowSharingConsent : false,
          womenOnlySharing: isEligibleForPooling ? womenOnlySharing : false,
          verifiedOnlySharing: isEligibleForPooling ? verifiedOnlySharing : false,
          maxDetourBudgetMinutes: detourBudgetMin,
          sharedSavings: isEligibleForPooling ? sharedSavings : 0,
          originalSoloFare: rawBasePrice + stopsExtra - discount,
          poolStatus: isEligibleForPooling ? 'matching' : 'solo_fallback',
          preferredDriverId: preferredDriver ? (preferredDriver.driverId || preferredDriver.id) : null,
          preferredDriverName: preferredDriver ? preferredDriver.name : null,
          preferredDriverPhone: preferredDriver ? preferredDriver.phone : null,
          preferredDriverPlate: preferredDriver ? preferredDriver.vehiclePlate : null,
        }
      );

      if (id) {
        console.log("Ride created successfully. ID:", id);
        setRideId(id);
      } else {
        console.error("Ride creation failed - createRide returned null");
        setStep("map");
        toast.error(
          "Imeshindwa kuunda safari. Angalia usalama wa akaunti yako au salio.",
        );
      }
    } catch (error: any) {
      console.error("Critical error in confirmBooking:", error);
      setStep("map");
      toast.error(
        `Itilafu: ${error.message || "Tatizo la kiufundi limejitokeza"}`,
      );
    }
  };

  useEffect(() => {
    if (!activeRide) return;

    const currentStatus = activeRide.status;
    console.log(
      `[TaxiBooking] Status Sync: ${currentStatus} | Current Step: ${step} | RideID: ${activeRide.id}`,
    );

    // Auto-transition based on ride status - check for multiple positive statuses
    const isFound =
      currentStatus === "accepted" ||
      currentStatus === "driver_arriving" ||
      currentStatus === "driver_arrived" ||
      currentStatus === "on_trip";

    if (isFound) {
      if (step === "searching" || step === "map" || step === "home") {
        console.log(
          `[TaxiBooking] --> Transitioning to appropriate active screen based on status: ${currentStatus}`,
        );

        if (
          currentStatus === "accepted" ||
          currentStatus === "driver_arriving"
        ) {
          setStep("found");
        } else if (currentStatus === "driver_arrived") {
          setStep("arriving");
        } else if (currentStatus === "on_trip") {
          setStep("on_trip");
        }
      }
    }

    if (currentStatus === "driver_arrived") {
      if (step !== "arriving" && step !== "on_trip" && step !== "completed") {
        setStep("arriving");
      }
    } else if (currentStatus === "on_trip") {
      if (step !== "on_trip" && step !== "completed") {
        setStep("on_trip");
      }
    } else if (currentStatus === "completed" || currentStatus === "rated") {
      // If payment is already confirmed by driver, skip the payment screen and go to rating
      if (activeRide.paymentStatus === "paid" && step !== "rating") {
        setStep("rating");
      } else if (step !== "rating" && step !== "completed") {
        console.log("[TaxiBooking] --> Transitioning to COMPLETED screen");
        setStep("completed");
      }
    } else if (currentStatus === "cancelled") {
      if (step !== "map") {
        toast.info("Safari imeghairiwa");
        setStep("map");
        setRideId(null);
      }
    }
  }, [activeRide?.status, activeRide?.id, step, rideId]);

  const handleTimeout = () => {
    deleteRide();
    setStep("timeout");
  };

  const handleRetry = () => {
    setStep("map");
    setRideId(null);
  };

  const handlePayment = async (method: string) => {
    if (!rideId || !user || !activeRide) return;
    try {
      await addDoc(collection(db, "payments"), {
        rideId,
        customerId: user.uid,
        driverId: activeRide.driverId,
        amount: activeRide.fare,
        method,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setStep("rating");
    } catch (err) {
      console.error(err);
      toast.error("Malipo yameshindwa");
    }
  };

  const handleRating = async (ratingValue: number, feedback: string[]) => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, "rides", rideId), {
        rating: ratingValue,
        feedback,
        rated: true,
        updatedAt: serverTimestamp(),
      });

      // Update driver aggregate rating in users collection
      if (activeRide?.driverId) {
        const driverId = activeRide.driverId;
        const userRef = doc(db, "users", driverId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentRating = userData.rating !== undefined ? Number(userData.rating) : 4.8;
          const currentCount = userData.ratingCount !== undefined ? Number(userData.ratingCount) : 0;
          
          const newCount = currentCount + 1;
          const newRating = ((currentRating * currentCount) + ratingValue) / newCount;
          
          await updateDoc(userRef, {
            rating: parseFloat(newRating.toFixed(1)),
            ratingCount: newCount,
            updatedAt: serverTimestamp()
          });
        }

        // Also update driver rating in the temporary drivers tracking collection if they are listed there
        try {
          const driverTrackingRef = doc(db, "drivers", driverId);
          const trackingSnap = await getDoc(driverTrackingRef);
          if (trackingSnap.exists()) {
            const trackingData = trackingSnap.data();
            const currentRating = trackingData.rating !== undefined ? Number(trackingData.rating) : 4.8;
            const currentCount = trackingData.ratingCount !== undefined ? Number(trackingData.ratingCount) : 0;
            
            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + ratingValue) / newCount;

            await updateDoc(driverTrackingRef, {
              rating: parseFloat(newRating.toFixed(1)),
              ratingCount: newCount,
              updatedAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.warn("Could not update temporary driver presence rating:", e);
        }
      }

      toast.success("Asante kwa maoni yako!");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      console.error(err);
      navigate("/");
    }
  };

  const CITY_FALLBACK_COORDINATES: Record<string, { lat: number, lng: number }> = {
    "Dar es Salaam": { lat: -6.7924, lng: 39.2083 },
    "Arusha": { lat: -3.3731, lng: 36.6857 },
    "Dodoma": { lat: -6.1722, lng: 35.7481 },
    "Mwanza": { lat: -2.5164, lng: 32.9018 }
  };

  // Get Pricing Rules dynamically from the Admin config with deep default fallbacks
  const getPricingRules = () => {
    const rawRules = config?.pricingRules;
    const defaultRules: Record<string, any> = {
      "Dar es Salaam": {
        name: "Dar es Salaam",
        active: true,
        serviceStart: "05:00 AM",
        serviceEnd: "11:59 PM",
        nightMultiplier: 1.15,
        nightStart: "10:00 PM",
        nightEnd: "05:00 AM",
        taxName: "VAT",
        taxRate: 15,
        taxActive: true,
        rates: {
          mini: { baseFare: 1100, pricePerKm: 1100, pricePerMin: 120, waitingRate: 120, surgeRush: 1.25, surgeRain: 1.5 },
          bajaj: { baseFare: 500, pricePerKm: 700, pricePerMin: 90, waitingRate: 90, surgeRush: 1.15, surgeRain: 1.3 },
          bike: { baseFare: 400, pricePerKm: 400, pricePerMin: 90, waitingRate: 90, surgeRush: 1.1, surgeRain: 1.2 },
          rental: { baseFare: 45000, pricePerKm: 1500, pricePerMin: 0, waitingRate: 0, surgeRush: 1.0, surgeRain: 1.1 }
        }
      },
      "Arusha": {
        name: "Arusha",
        active: true,
        serviceStart: "05:00 AM",
        serviceEnd: "11:00 PM",
        nightMultiplier: 1.20,
        nightStart: "10:00 PM",
        nightEnd: "06:00 AM",
        taxName: "Service Fee",
        taxRate: 5,
        taxActive: true,
        rates: {
          mini: { baseFare: 1200, pricePerKm: 880, pricePerMin: 110, waitingRate: 130, surgeRush: 1.3, surgeRain: 1.6 },
          bajaj: { baseFare: 600, pricePerKm: 550, pricePerMin: 0, waitingRate: 55, surgeRush: 1.2, surgeRain: 1.4 },
          bike: { baseFare: 400, pricePerKm: 385, pricePerMin: 0, waitingRate: 35, surgeRush: 1.15, surgeRain: 1.3 },
          rental: { baseFare: 50000, pricePerKm: 1600, pricePerMin: 0, waitingRate: 0, surgeRush: 1.0, surgeRain: 1.1 }
        }
      },
      "Dodoma": {
        name: "Dodoma",
        active: true,
        serviceStart: "06:00 AM",
        serviceEnd: "10:30 PM",
        nightMultiplier: 1.10,
        nightStart: "10:00 PM",
        nightEnd: "06:00 AM",
        taxName: "Municipal Levy",
        taxRate: 2,
        taxActive: false,
        rates: {
          mini: { baseFare: 900, pricePerKm: 720, pricePerMin: 90, waitingRate: 100, surgeRush: 1.2, surgeRain: 1.4 },
          bajaj: { baseFare: 450, pricePerKm: 450, pricePerMin: 0, waitingRate: 40, surgeRush: 1.1, surgeRain: 1.2 },
          bike: { baseFare: 270, pricePerKm: 315, pricePerMin: 0, waitingRate: 25, surgeRush: 1.05, surgeRain: 1.15 },
          rental: { baseFare: 40000, pricePerKm: 1400, pricePerMin: 0, waitingRate: 0, surgeRush: 1.0, surgeRain: 1.1 }
        }
      },
      "Mwanza": {
        name: "Mwanza",
        active: true,
        serviceStart: "05:00 AM",
        serviceEnd: "11:00 PM",
        nightMultiplier: 1.15,
        nightStart: "10:00 PM",
        nightEnd: "05:30 AM",
        taxName: "Lakefront Service Tax",
        taxRate: 3,
        taxActive: true,
        rates: {
          mini: { baseFare: 1000, pricePerKm: 760, pricePerMin: 95, waitingRate: 110, surgeRush: 1.25, surgeRain: 1.45 },
          bajaj: { baseFare: 500, pricePerKm: 475, pricePerMin: 0, waitingRate: 45, surgeRush: 1.15, surgeRain: 1.3 },
          bike: { baseFare: 300, pricePerKm: 332, pricePerMin: 0, waitingRate: 28, surgeRush: 1.1, surgeRain: 1.2 },
          rental: { baseFare: 45000, pricePerKm: 1500, pricePerMin: 0, waitingRate: 0, surgeRush: 1.0, surgeRain: 1.1 }
        }
      }
    };

    if (!rawRules) return defaultRules;
    const merged = { ...defaultRules };
    Object.keys(rawRules).forEach(key => {
      merged[key] = {
        ...defaultRules[key],
        ...rawRules[key],
        rates: {
          ...(defaultRules[key]?.rates || {}),
          ...(rawRules[key]?.rates || {})
        }
      };
    });
    return merged;
  };

  const getDynamicPrice = (vehicleId: string, vehicleConfig: any) => {
    // Standard fallbacks if no destination or route is loaded
    const isPreRoute = !destination || !totalDistance || totalDistance <= 0;
    
    // Simulate standard reference trip if showing initial prices on opening
    const distKm = isPreRoute ? 3.0 : totalDistance / 1000;
    const durMins = isPreRoute ? 10 : Math.ceil((totalDuration || 300) / 60) || 1;

    // Load dynamic pricing rules for the selected city
    const rules = getPricingRules();
    const cityData = rules[selectedCity] || rules["Dar es Salaam"];

    // Base rates matching city/vehicle configs or using custom vehicle fields
    const rId = vehicleId;
    const isCustom = rId !== 'mini' && rId !== 'bajaj' && rId !== 'bike';
    
    const cityRates = cityData?.rates?.[rId] || {
      baseFare: vehicleConfig?.baseFare !== undefined ? Number(vehicleConfig.baseFare) : (rId === 'mini' ? 1100 : rId === 'bajaj' ? 500 : 400),
      pricePerKm: vehicleConfig?.pricePerKm !== undefined ? Number(vehicleConfig.pricePerKm) : (rId === 'mini' ? 1100 : rId === 'bajaj' ? 700 : 400),
      pricePerMin: vehicleConfig?.pricePerMin !== undefined ? Number(vehicleConfig.pricePerMin) : (rId === 'mini' ? 120 : 90),
      waitingRate: rId === 'mini' ? 120 : rId === 'bajaj' ? 90 : 90,
      surgeRush: 1.25,
      surgeRain: 1.5
    };

    const baseFare = cityRates.baseFare;
    const pricePerKm = cityRates.pricePerKm;
    const pricePerMin = cityRates.pricePerMin;

    // Core trip distance & duration cost
    const distanceCost = distKm * pricePerKm;
    const durationCost = durMins * pricePerMin;

    // Waiting Time Settle
    const waitingRate = cityRates.waitingRate !== undefined ? cityRates.waitingRate : (rId === "mini" ? 120 : rId === "bajaj" ? 50 : 30);
    const waitingCost = waitingTime * waitingRate;

    let subTotal = baseFare + distanceCost + durationCost + waitingCost;

    // Night Surcharge if enabled (using city's specific night multiplier)
    if (isNightSurcharge) {
      const nm = cityData?.nightMultiplier !== undefined ? Number(cityData.nightMultiplier) : 1.15;
      subTotal = subTotal * nm;
    }

    // Dynamic Surcharges (Surge level)
    let surgeMultiplier = 1.0;
    if (surgeLevel === "rush") {
      surgeMultiplier = cityRates.surgeRush !== undefined ? cityRates.surgeRush : 1.25;
    } else if (surgeLevel === "rain") {
      surgeMultiplier = cityRates.surgeRain !== undefined ? cityRates.surgeRain : 1.5;
    }
    
    subTotal = subTotal * surgeMultiplier;

    // City Tax additions
    if (cityData?.taxActive !== false && cityData?.taxRate > 0) {
      const taxRateFactor = 1 + (Number(cityData.taxRate) / 100);
      subTotal = subTotal * taxRateFactor;
    }
    
    // Round to nearest 100 TZS for payment convenience
    const rounded = Math.ceil(subTotal / 100) * 100;

    // Ensure it's not below the base rate specified by admin or fallback minimum
    const minPrice = vehicleConfig?.price !== undefined ? Number(vehicleConfig.price) : (vehicleId === 'mini' ? 5000 : vehicleId === 'bajaj' ? 4000 : vehicleId === 'bike' ? 2000 : 45000);
    
    return Math.max(minPrice, rounded);
  };

  const rideOptions: RideOption[] = useMemo(() => {
    const defaultVehicles = {
      mini: { id: "mini", name: "Gari", price: 5000, sub: "Max 4 Siti", image: "🚗", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      bajaj: { id: "bajaj", name: "Bajaji", price: 4000, sub: "3 Siti", image: "🛺", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      bike: { id: "bike", name: "BODA", price: 2000, sub: "1 Siti", image: "🏍️", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      ambulance: { id: "ambulance", name: "Ambulansi (Dharura)", price: 25000, sub: "Hospital & Madaktari", image: "🚑", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      fire: { id: "fire", name: "Zimamoto (Faya)", price: 30000, sub: "Kuzima Moto / Dharura", image: "🚒", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" }
    };

    const combinedVehicles = {
      ...defaultVehicles,
      ...(config?.vehicles || {})
    };

    return Object.entries(combinedVehicles)
      // Hide completely if enabled is explicitly set to false (kuzuiya user asionekabisa)
      .filter(([id, val]: [string, any]) => val?.enabled !== false)
      .map(([id, val]: [string, any]) => {
        let iconComponent: any = Car;
        if (id === 'bajaj') iconComponent = BajajSVG;
        else if (id === 'bike' || id.toLowerCase().includes('pikipiki') || id.toLowerCase().includes('bike') || id.toLowerCase().includes('boda')) {
          iconComponent = BikeSVG;
        } else if (id === 'ambulance' || id.toLowerCase().includes('ambulans')) {
          iconComponent = Ambulance;
        } else if (id === 'fire' || id.toLowerCase().includes('zimamoto') || id.toLowerCase().includes('faya')) {
          iconComponent = Flame;
        }

        const speedIndex = id === 'bike' ? 2 : id === 'mini' ? 3 : id === 'bajaj' ? 4 : 5;

        // Calculate dynamic ETA based on actual physical distance to the closest driver of this type
        let closestDriverDist = Infinity;
        if (drivers && drivers.length > 0) {
          drivers.forEach((d) => {
            if (d.vehicleType === id) {
              const dist = getDistanceLocal([d.lat, d.lng], pickupPos);
              if (dist < closestDriverDist) {
                closestDriverDist = dist;
              }
            }
          });
        }

        let calculatedEta = speedIndex;
        if (closestDriverDist < 15000) { // closest driver within 15km
          // 30km/h is ~500 meters per minute
          calculatedEta = Math.max(1, Math.ceil(closestDriverDist / 500));
        } else {
          // Stable mock/fallback estimate based on pickup coordinate hash so index is steady
          const stableHash = Math.abs(Math.round((pickupPos[0] + pickupPos[1]) * 10000)) % 4;
          calculatedEta = speedIndex + stableHash;
        }

        return {
          id: id,
          name: val?.name || id,
          icon: iconComponent,
          sub: val?.sub || "",
          price: getDynamicPrice(id, val),
          eta: String(calculatedEta),
          vehicleType: id,
          image: val?.image || "🚗",
          imageUrl: val?.imageUrl || "",
          capacity: val?.capacity !== undefined ? val.capacity : (id === 'mini' ? 4 : id === 'bajaj' ? 3 : 1),
          maintenance: val?.maintenance === true,
          discount: id === 'mini' ? "PUNGUZO 3K" : undefined
        };
      });
  }, [config?.vehicles, pickupPos, destPos, totalDistance, totalDuration, selectedCity, isNightSurcharge, surgeLevel, waitingTime, drivers]);

  const rideOptionsIds = (rideOptions || []).map(r => r.id).join(',');

  useEffect(() => {
    if (rideOptions.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const serviceParam = searchParams.get('service') || searchParams.get('type');
      const matched = serviceParam ? rideOptions.find(r => r.id === serviceParam) : null;
      
      if (matched && (!selectedRide || selectedRide.id !== matched.id)) {
        setSelectedRide(matched);
      } else if (!selectedRide || !rideOptions.some(r => r.id === selectedRide.id)) {
        const available = rideOptions.find(r => !r.maintenance) || rideOptions[0];
        setSelectedRide(available);
      }
    }
  }, [rideOptionsIds, selectedRide?.id]);

  // Dynamic ETA & Travel Calculations
  function getDistanceLocal(p1: [number, number], p2: [number, number]) {
    const R = 6371000; // meters
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function formatTimeLocal(date: Date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const amampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minStr} ${amampm}`;
  }

  // Determine pickup ETA text ("dereva atakuja baada ya dakika X min" au kashafika)
  let etaPickupText = "";
  if (!activeRide) {
    // Before a ride is created, check if we have any online/active drivers nearby
    let closestDriverDist = Infinity;
    if (drivers && drivers.length > 0) {
      drivers.forEach((d) => {
        const dist = getDistanceLocal([d.lat, d.lng], pickupPos);
        if (dist < closestDriverDist) {
          closestDriverDist = dist;
        }
      });
    }

    // Only show ETA text if we have drivers nearby (within 10km)
    if (closestDriverDist < 10000) {
      const durSecs = closestDriverDist / 6.5; 
      const durMins = Math.max(1, Math.ceil(durSecs / 60));
      etaPickupText = `baada ya dakika ${durMins} min`;
    } else {
      etaPickupText = ""; // Empty means do not read/display under PICKUP MTEJA pin
    }
  } else {
    if (["accepted", "driver_arriving", "found"].includes(activeRide.status)) {
      const matchedDriver = drivers.find((d) => d.id === activeRide.driverId);
      const driverLoc: [number, number] | null = driverLivePos
        ? [driverLivePos.lat, driverLivePos.lng]
        : activeRide.driverLocation
        ? [activeRide.driverLocation.lat, activeRide.driverLocation.lng]
        : matchedDriver
        ? [matchedDriver.lat, matchedDriver.lng]
        : null;

      if (driverLoc) {
        const distToPickup = getDistanceLocal(driverLoc, pickupPos);
        if (activeRide.status === "driver_arrived" || distToPickup < 5) {
          etaPickupText = "DEREVA KASHAFIKA!";
        } else if (distToPickup < 40) {
          etaPickupText = "DEREVA ANASHAWASILI...";
        } else {
          const durSecs = distToPickup / 6.5; // average 23 km/h
          const realDurSecs = Math.max(0, durSecs - (secondsOffset % 30));
          const minsLeft = Math.floor(realDurSecs / 60);
          const secsLeft = Math.floor(realDurSecs % 60);
          etaPickupText = `atakuja baada ya dk ${minsLeft} sek ${secsLeft}`;
        }
      } else {
        etaPickupText = ""; // Keep empty when there is no nearby driver/location info
      }
    } else if (activeRide.status === "pending") {
      etaPickupText = ""; // Keep empty during search
    } else if (step === "arriving") {
      etaPickupText = "DEREVA KASHAFIKA!";
    } else {
      etaPickupText = "IMESHAKAMILIKA";
    }
  }

  // Determine destination ETA time ("EXPECTED ARRIVE BY 12:20 pm" nakila akisogea masaa yatajikaunti)
  let etaDestText = "";
  let tripDurSecs = totalDuration > 0 ? totalDuration : 300; // default duration based on OSRM or fallback
  if (tripDurSecs === 300 && pickupPos && destPos) {
    const dist = getDistanceLocal(pickupPos, destPos);
    tripDurSecs = dist / 9.5; // average 34 km/h in traffic
  }

  const activeTripKm = (totalDistance > 0 ? (totalDistance / 1000) : (pickupPos && destPos ? getDistanceLocal(pickupPos, destPos) / 1000 : 3.0)).toFixed(1);

  if (activeRide) {
    if (activeRide.status === "on_trip") {
      const driverLoc: [number, number] | null = driverLivePos
        ? [driverLivePos.lat, driverLivePos.lng]
        : activeRide.driverLocation
        ? [activeRide.driverLocation.lat, activeRide.driverLocation.lng]
        : null;

      if (driverLoc) {
        const remainingDist = getDistanceLocal(driverLoc, destPos);
        const remainingKm = (remainingDist / 1000).toFixed(1);
        const remainingDurSecs = remainingDist / 9.5; // account for density and road twists
        const realRemainingSecs = Math.max(0, remainingDurSecs - (secondsOffset % 30));
        const minsLeft = Math.floor(realRemainingSecs / 60);
        const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
        etaDestText = `${remainingKm} km • Kufika: ${formatTimeLocal(etaTime)} (dk ${minsLeft})`;
      } else {
        const realRemainingSecs = Math.max(0, tripDurSecs - secondsOffset);
        const minsLeft = Math.floor(realRemainingSecs / 60);
        const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
        etaDestText = `${activeTripKm} km • Kufika: ${formatTimeLocal(etaTime)} (dk ${minsLeft})`;
      }
    } else if (["accepted", "driver_arriving", "driver_arrived", "found"].includes(activeRide.status)) {
      // Driver is heading to pickup. Estimated total duration = (time to pickup) + (ride duration)
      const matchedDriver = drivers?.find((d) => d.id === activeRide.driverId);
      const driverLoc: [number, number] | null = driverLivePos
        ? [driverLivePos.lat, driverLivePos.lng]
        : activeRide.driverLocation
        ? [activeRide.driverLocation.lat, activeRide.driverLocation.lng]
        : matchedDriver
        ? [matchedDriver.lat, matchedDriver.lng]
        : null;

      let durToPickupSecs = 0;
      if (driverLoc) {
        const distToPickup = getDistanceLocal(driverLoc, pickupPos);
        durToPickupSecs = distToPickup / 6.5; // average speed for pickup approach
      } else {
        durToPickupSecs = 300; // default 5 minutes to pickup
      }

      const totalRemainingSecs = durToPickupSecs + tripDurSecs;
      const realRemainingSecs = Math.max(0, totalRemainingSecs - secondsOffset);
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestText = `${activeTripKm} km • Kufika: ${formatTimeLocal(etaTime)} (dk ${minsLeft})`;
    } else {
      const realRemainingSecs = Math.max(0, tripDurSecs - secondsOffset);
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestText = `${activeTripKm} km • Kufika: ${formatTimeLocal(etaTime)} (dk ${minsLeft})`;
    }
  } else {
    // Before trip starts (during booking setup / search)
    const realRemainingSecs = Math.max(0, tripDurSecs - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestText = `${activeTripKm} km • Kufika: ${formatTimeLocal(etaTime)} (dk ${minsLeft})`;
  }

  return (
    <div className={`max-w-md mx-auto ${theme === "dark" ? "bg-[#0a0a0f] text-[#f0eeff] border-neutral-800" : "bg-neutral-50 text-neutral-800 border-neutral-200/60"} w-full flex flex-col relative overflow-hidden font-sans border-x h-[100dvh]`}>
      <div className={`absolute inset-0 ${theme === "dark" ? "bg-[#0a0a0f]" : "bg-[#f8f9fa]"}`} />

      {/* DEBUG FLAG */}
      <div className="hidden">DEBUG_RENDER_ACTIVE_{step}</div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-indigo-500/5 blur-[80px] rounded-full" />
      </div>

      <div className="flex-1 flex flex-col relative z-10 h-full overflow-hidden">
        {/* Foundation Map Layer - Visible during the whole journey */}
        <AnimatePresence mode="popLayout">
          {["map", "searching", "found", "arriving", "on_trip"].includes(
            step,
          ) &&
            !isRestoring && (
              <motion.div
                key="foundation-map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-0 h-full w-full pointer-events-auto"
              >
                {!activeRide && !["found", "arriving", "on_trip", "driver_arrived", "driver_arriving"].includes(step) && (
                  <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-[9999] flex items-center gap-2 sm:gap-3 pointer-events-none">
                    {/* Left Menu Button */}
                    <div className="relative pointer-events-auto">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className={`w-10 h-10 sm:w-12 sm:h-12 backdrop-blur-xl rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all border ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800 text-neutral-200 hover:text-indigo-400 hover:border-indigo-900' : 'bg-white/95 border-neutral-200/80 text-neutral-800 hover:text-indigo-600 hover:border-indigo-300'}`}
                      title="Fungua Menu"
                    >
                      <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    {/* Animated Dropdown Menu */}
                    <AnimatePresence>
                      {showMenu && (
                        <>
                          {/* Backdrop to close the menu on click outside */}
                          <div 
                            className="fixed inset-0 z-40 bg-black/5" 
                            onClick={() => setShowMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className={`absolute left-0 mt-2 w-52 backdrop-blur-2xl rounded-xl sm:rounded-2xl shadow-xl py-2 z-50 flex flex-col overflow-hidden border ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'}`}
                          >
                            <button
                              onClick={() => {
                                setShowMenu(false);
                                navigate("/");
                              }}
                              className={`w-full text-left px-4 py-3 text-xs sm:text-sm flex items-center gap-3 transition-colors font-bold ${theme === 'dark' ? 'text-neutral-300 hover:text-indigo-400 hover:bg-neutral-900/60' : 'text-neutral-700 hover:text-indigo-600 hover:bg-neutral-50'}`}
                            >
                              <Home className="w-4 h-4 text-indigo-500" />
                              <span>{t('back_to_home')}</span>
                            </button>
                            
                            <div className={`w-full border-b ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-100'}`} />

                            <button
                              onClick={() => {
                                setShowMenu(false);
                                navigate("/taxi/history");
                              }}
                              className={`w-full text-left px-4 py-3 text-xs sm:text-sm flex items-center gap-3 transition-colors font-bold ${theme === 'dark' ? 'text-neutral-300 hover:text-indigo-400 hover:bg-neutral-900/60' : 'text-neutral-700 hover:text-indigo-600 hover:bg-neutral-50'}`}
                            >
                              <Clock className="w-4 h-4 text-emerald-500" />
                              <span>{t('trip_history')}</span>
                            </button>

                            <div className={`w-full border-b ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-100'}`} />

                            <button
                              onClick={() => {
                                setShowMenu(false);
                                setMapType(mapType === "standard" ? "satellite" : "standard");
                              }}
                              className={`w-full text-left px-4 py-3 text-xs sm:text-sm flex items-center gap-3 transition-colors font-bold ${theme === 'dark' ? 'text-neutral-300 hover:text-indigo-400 hover:bg-neutral-900/60' : 'text-neutral-700 hover:text-indigo-600 hover:bg-neutral-50'}`}
                            >
                              {mapType === "satellite" ? (
                                <>
                                  <Layers className="w-4 h-4 text-sky-500" />
                                  <span>{t('standard_map')}</span>
                                </>
                              ) : (
                                <>
                                  <Map className="w-4 h-4 text-rose-500" />
                                  <span>{t('satellite_map')}</span>
                                </>
                              )}
                            </button>

                            <div className={`w-full border-b ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-100'}`} />

                            <button
                              onClick={() => {
                                setShowMenu(false);
                                setNextTheme(theme === "dark" ? "light" : "dark");
                              }}
                              className={`w-full text-left px-4 py-3 text-xs sm:text-sm flex items-center gap-3 transition-colors font-bold ${theme === 'dark' ? 'text-neutral-300 hover:text-indigo-400 hover:bg-neutral-900/60' : 'text-neutral-700 hover:text-indigo-600 hover:bg-neutral-50'}`}
                            >
                              {theme === "dark" ? (
                                <>
                                  <Sun className="w-4 h-4 text-amber-500" />
                                  <span>{t('light_mode')}</span>
                                </>
                              ) : (
                                <>
                                  <Moon className="w-4 h-4 text-blue-500" />
                                  <span>{t('dark_mode')}</span>
                                </>
                              )}
                            </button>

                            <div className={`w-full border-b ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-100'}`} />

                            <button
                              onClick={() => {
                                setShowMenu(false);
                                const nextLang = language === "sw" ? "en" : language === "en" ? "ar" : "sw";
                                setLanguage(nextLang);
                              }}
                              className={`w-full text-left px-4 py-3 text-xs sm:text-sm flex items-center justify-between transition-colors font-bold ${theme === 'dark' ? 'text-neutral-300 hover:text-emerald-400 hover:bg-neutral-900/60' : 'text-neutral-700 hover:text-emerald-600 hover:bg-neutral-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <Languages className="w-4 h-4 text-emerald-500" />
                                <span>{language === "sw" ? "English" : language === "en" ? "العربية" : "Kiswahili"}</span>
                              </div>
                               <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {language.toUpperCase()}
                              </span>
                            </button>

                            <div className={`w-full border-b ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-100'}`} />

                            {/* App download section inside dropdown */}
                            <div className={`px-1.5 py-1.5 ${theme === 'dark' ? 'bg-[#0d0d12]' : 'bg-neutral-50'}`}>
                              <AppDownloadButton 
                                variant="compact" 
                                className="w-full h-10 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-orange-500/20 text-orange-600 rounded-lg text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
                              />
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Center Search / Active Route Bar */}
                  {destination ? (
                    <div className={`flex-1 flex items-center h-10 sm:h-12 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-md px-2.5 sm:px-3 gap-2 pointer-events-auto border ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800 text-neutral-200' : 'bg-white/95 border-neutral-200/80 text-neutral-800'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setDestination("");
                          setSettingMode("destination");
                        }}
                        className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-90 transition-all text-neutral-600 dark:text-neutral-300"
                        title="Badili Eneo la Hatima"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex-1 flex items-center gap-1.5 min-w-0 font-bold text-xs">
                        <span className="truncate max-w-[42%] text-neutral-700 dark:text-neutral-300">
                          {pickup ? pickup.split(',')[0] : 'Pickup'}
                        </span>
                        <span className="text-emerald-500 font-black shrink-0">→</span>
                        <span className="truncate max-w-[45%] text-emerald-600 dark:text-emerald-400 font-extrabold">
                          {destination.split(',')[0]}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStopInput(true);
                          toast.info("Weka kituo cha ziada njiani (Add Stop) ➕");
                        }}
                        className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-neutral-600 dark:text-neutral-300 hover:text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 active:scale-90 transition-all border border-neutral-200/60 dark:border-neutral-700/60"
                        title="Ongeza Kituo (Add stop)"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className={`flex-1 flex items-center h-9 sm:h-11 backdrop-blur-xl rounded-lg sm:rounded-xl shadow-md px-2 sm:px-3 gap-1.5 pointer-events-auto relative border ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white/95 border-neutral-200/80'}`}>
                      <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      
                      <input
                        type="text"
                        value={pickup}
                        onChange={(e) => {
                          setPickup(e.target.value);
                          setIsAutoLocated(false);
                          setSettingMode("pickup");
                          geocodeAddress(e.target.value);
                        }}
                        onFocus={() => {
                          setSettingMode("pickup");
                        }}
                        placeholder={t('search_pickup_placeholder')}
                        className={`flex-1 bg-transparent text-[11px] sm:text-xs font-bold border-none outline-none p-0 font-sans ${theme === 'dark' ? 'text-neutral-200 placeholder:text-neutral-600' : 'text-neutral-800 placeholder:text-neutral-400'}`}
                      />

                      {isAutoLocated && (
                        <span className="shrink-0 text-[8px] font-black tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                          Auto
                        </span>
                      )}

                      {/* Automatic GPS locator button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAutoLocated(true);
                          setAutoFollow(true);
                          handleCurrentLocation(false);
                        }}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center active:scale-90 transition-all ${
                          isAutoLocated 
                            ? "bg-[#1D9E75]/25 text-[#00E5A0] border border-[#1D9E75]/35 hover:bg-[#1D9E75]/40"
                            : (theme === 'dark' ? "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800" : "bg-neutral-100 text-neutral-500 hover:text-neutral-800 border border-neutral-200/40")
                        }`}
                        title="Tafuta mahali ulipo kiotomatiki kwa GPS"
                      >
                        <Navigation2 className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isAutoLocated ? "rotate-45" : ""}`} />
                      </button>

                      {/* Autocomplete predictions for top search bar */}
                      {settingMode === "pickup" && suggestions.length > 0 && (
                        <div className={`absolute left-0 right-0 top-full mt-2 z-[99999] border shadow-2xl rounded-2xl overflow-hidden max-h-[250px] overflow-y-auto ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200'}`}>
                          <div className={`px-4 py-2 border-b text-[9px] font-black uppercase tracking-wider ${theme === 'dark' ? 'bg-[#161622] border-neutral-850 text-neutral-400' : 'bg-neutral-50 border-neutral-100 text-neutral-500'}`}>
                            Maeneo Yaliyopatikana
                          </div>
                          {suggestions.map((s, i) => {
                            const displayName = s.display_name || "";
                            const parts = displayName.split(",");
                            const mainName = parts[0] || "Eneo Lisilojulikana";
                            const subName = parts.slice(1).join(",").trim() || "Chagua eneo hili";
                            
                            return (
                              <button
                                key={`top-suggest-${displayName}-${i}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  selectSuggestion(s);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                                className={`w-full text-left p-3.5 flex items-center gap-3 border-b last:border-0 group transition-all ${theme === 'dark' ? 'hover:bg-neutral-800/40 border-neutral-800' : 'hover:bg-neutral-50 active:bg-neutral-100 border-neutral-100'}`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-neutral-800 text-indigo-400 group-hover:bg-indigo-950/40' : 'bg-neutral-100 text-indigo-600 group-hover:bg-indigo-50'} group-hover:scale-105`}>
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <p className={`text-xs font-bold truncate group-hover:text-indigo-500 transition-colors ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                    {mainName}
                                  </p>
                                  <p className={`text-[10px] truncate mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                    {subName}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

                {/* Floating Cards removed as requested */}

                <style>{`
                  .leaflet-container { 
                    height: 100% !important; 
                    width: 100% !important; 
                    background: ${theme === 'dark' ? '#111118' : '#ffffff'} !important; 
                  } 
                  .custom-div-icon { 
                    background: none; 
                    border: none; 
                  } 
                  .animate-spin-slow { 
                    animation: spin 3s linear infinite; 
                  } 
                  @keyframes spin { 
                    from { transform: rotate(0deg); } 
                    to { transform: rotate(360deg); } 
                  }
                  /* Position Zoom control safely below the Top-Left Home Button */
                  .leaflet-left .leaflet-control-zoom {
                    margin-top: 70px !important;
                    border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3) !important;
                    border-radius: 12px !important;
                    overflow: hidden;
                  }
                  .leaflet-control-zoom-in, .leaflet-control-zoom-out {
                    background-color: ${theme === 'dark' ? '#111118' : '#ffffff'} !important;
                    color: ${theme === 'dark' ? '#f0eeff' : '#0f0f18'} !important;
                    border-bottom: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;
                    transition: all 0.2s ease !important;
                  }
                  .leaflet-control-zoom-in:hover, .leaflet-control-zoom-out:hover {
                    background-color: #7F77DD !important;
                    color: white !important;
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
                <div
                  style={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    height: "100%",
                    width: "100%",
                  }}
                  className="h-full w-full"
                >
                  <MapContainer
                    center={pickupPos}
                    zoom={15}
                    maxZoom={22}
                    preferCanvas={false}
                    className="h-full w-full"
                    zoomControl={true}
                    attributionControl={false}
                    touchZoom={true}
                    doubleClickZoom={true}
                    scrollWheelZoom={true}
                    dragging={true}
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
                    <MapEvents
                      onMapClick={handleMapClick}
                      onInteraction={() => setAutoFollow(false)}
                    />
                    <MapControl
                      position={
                        ["arriving", "on_trip", "found"].includes(step) &&
                        driverLivePos
                          ? [driverLivePos.lat, driverLivePos.lng]
                          : settingMode === "pickup"
                            ? pickupPos
                            : destPos
                      }
                      step={step}
                      autoFollow={autoFollow}
                      targetPos={
                        ["arriving", "found"].includes(step)
                          ? pickupPos
                          : step === "on_trip"
                            ? destPos
                            : undefined
                      }
                      routeCoords={routeCoords}
                      isMapFullscreen={isMapFullscreen}
                      mapRefitTrigger={mapRefitTrigger}
                    />
                    {(() => {
                      const activeDriverHeading = (driverLivePos as any)?.heading ?? (activeRide?.driverLocation as any)?.heading ?? 0;
                      return (
                        <MapRotationController 
                          rotation={manualRotation} 
                          heading={activeDriverHeading} 
                          isHeadingUp={isHeadingUp && ["arriving", "on_trip", "driver_arrived", "found", "driver_arriving"].includes(step)} 
                          onRotate={setManualRotation} 
                          is3DMode={is3DMode} 
                        />
                      );
                    })()}
                    {activeRide?.status !== "on_trip" && (
                      <Marker position={pickupPos} icon={getStartPin(etaPickupText)} />
                    )}
                    {destination && (
                      <Marker 
                        position={destPos} 
                        icon={getEndPin(etaDestText)} 
                      />
                    )}

                    {/* Intermediate Extra Stops Pins */}
                    {effectiveStops.map((stop: any, idx: number) => {
                      if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return null;
                      const stopLabel = stop.address ? (stop.address.length > 20 ? `${stop.address.substring(0, 20)}...` : stop.address) : `Kituo #${idx + 1}`;
                      return (
                        <Marker
                          key={`extra-stop-pin-${stop.id || idx}`}
                          position={[stop.lat, stop.lng]}
                          icon={L.divIcon({
                            className: "custom-extra-stop-marker",
                            html: `
                              <div class="relative flex flex-col items-center pointer-events-none">
                                <div class="bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full shadow-xl border-2 border-white flex items-center gap-1.5 whitespace-nowrap">
                                  <span>📍 Kituo #${idx + 1}: ${stopLabel}</span>
                                </div>
                                <div class="w-2.5 h-2.5 bg-amber-500 rotate-45 -mt-1 border-r-2 border-b-2 border-white shadow-md"></div>
                              </div>
                            `,
                            iconSize: [120, 36],
                            iconAnchor: [60, 36],
                          })}
                        />
                      );
                    })}

                    {/* User's Current Live GPS Location (Blue Dot) */}
                    {userLivePos && (
                      <Marker
                        position={userLivePos}
                        icon={L.divIcon({
                          className: "user-gps-marker",
                          html: `
                            <div class="relative flex items-center justify-center w-6 h-6">
                              <div class="absolute w-4 h-4 rounded-full bg-blue-500/30 animate-ping"></div>
                              <div class="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-md"></div>
                            </div>
                          `,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12],
                        })}
                      />
                    )}

                    {/* Assigned Driver Marker (Ultra-Smooth 60fps Interpolation & 360° Continuous Heading) */}
                    {(driverLivePos || activeRide?.driverLocation) && (() => {
                      const lat = driverLivePos?.lat || activeRide?.driverLocation?.lat || 0;
                      const lng = driverLivePos?.lng || activeRide?.driverLocation?.lng || 0;
                      const heading = (driverLivePos as any)?.heading ?? (activeRide?.driverLocation as any)?.heading;
                      return (
                        <SmoothDriverMarker
                          key={`active-driver-${activeRide?.driverId || "presence"}`}
                          position={[lat, lng]}
                          heading={heading}
                          vehicleType={activeRide?.vehicleType || "mini"}
                          driverId={activeRide?.driverId || "active-driver"}
                          customVehicle={config?.vehicles?.[activeRide?.vehicleType || "mini"]}
                          theme={theme === "dark" ? "dark" : "light"}
                          isAssignedDriver={true}
                        />
                      );
                    })()}

                    {/* Nearby Drivers - Show in home or map step, showing all vehicle types without selecting */}
                    {(step === "home" || step === "map") &&
                      drivers
                        .filter((d) => d.id !== activeRide?.driverId)
                        .map((driver) => (
                          <SmoothDriverMarker
                            key={`nearby-${driver.id}`}
                            position={[driver.lat, driver.lng]}
                            heading={driver.heading}
                            vehicleType={driver.vehicleType}
                            driverId={driver.id}
                            customVehicle={config?.vehicles?.[driver.vehicleType]}
                            theme={theme === "dark" ? "dark" : "light"}
                            isAssignedDriver={false}
                          />
                        ))}

                    {activeRide ? (
                      (() => {
                        const hasRealTripRoute = realTripRoute && realTripRoute.length > 0;
                        const hasFullRoute = activeRide.routeCoords && activeRide.routeCoords.length > 2;
                        const fullTripRoute = hasRealTripRoute
                          ? realTripRoute
                          : (hasFullRoute 
                              ? getNormalizedCoords(activeRide.routeCoords)
                              : generateSimulatedRoads(pickupPos, destPos));

                        const driverPosObj = driverLivePos || (activeRide.driverLocation ? { lat: activeRide.driverLocation.lat, lng: activeRide.driverLocation.lng } : null);

                        if (activeRide.status === "on_trip") {
                          const slicedTripRoute = sliceRouteFromCurrentPos(fullTripRoute, driverPosObj);
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
                          if (driverApproachRouteRef.current.length === 0 && driverPosObj) {
                            const roads = generateSimulatedRoads(
                              [driverPosObj.lat, driverPosObj.lng],
                              [activeRide.pickup.lat, activeRide.pickup.lng]
                            );
                            driverApproachRouteRef.current = roads;
                            if (approachRoute.length === 0) {
                              setApproachRoute(roads);
                            }
                          }
                          const slicedApproachRoute = sliceRouteFromCurrentPos(
                            approachRoute.length > 0 ? approachRoute : driverApproachRouteRef.current,
                            driverPosObj
                          );

                          // Prefer actual fetched street-following coordinates from driverRouteCoords if loaded
                          const activeApproachPath = (driverRouteCoords && driverRouteCoords.length > 1)
                            ? driverRouteCoords
                            : slicedApproachRoute;

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
                              {activeApproachPath.length > 1 && (
                                <AnimatedRoute
                                  positions={activeApproachPath}
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
                      })()
                    ) : (
                      destination && (
                        routeCoords && routeCoords.length > 1 ? (
                          <AnimatedRoute positions={routeCoords} color="#00E5A0" />
                        ) : (
                          pickupPos && destPos && (
                            <AnimatedRoute positions={generateSimulatedRoads(pickupPos, destPos)} color="#00E5A0" />
                          )
                        )
                      )
                    )}

                    {/* Render Geofence Boundary Layer for Selected City */}
                    {(() => {
                      const rules = getPricingRules();
                      const cityData = rules[selectedCity] || rules["Dar es Salaam"];
                      if (!cityData || cityData.geofenceActive !== true) return null;

                      const type = cityData.geofenceType || 'circle';

                      if (type === 'circle') {
                        const gfCenterObj = cityData.geofenceCenter || { lat: cityData.lat, lng: cityData.lng };
                        const fallbacks = CITY_FALLBACK_COORDINATES[selectedCity] || CITY_FALLBACK_COORDINATES["Dar es Salaam"];
                        const gfCenterLat = gfCenterObj.lat || cityData.lat || fallbacks.lat;
                        const gfCenterLng = gfCenterObj.lng || cityData.lng || fallbacks.lng;
                        const gfCenter: [number, number] = [gfCenterLat, gfCenterLng];
                        const gfRadius = cityData.geofenceRadius || 15000;
                        if (isNaN(gfCenterLat) || isNaN(gfCenterLng)) return null;
                        return (
                          <Circle
                            center={gfCenter}
                            radius={gfRadius}
                            pathOptions={{
                              color: '#F97316',
                              fillColor: '#F97316',
                              fillOpacity: 0.1,
                              weight: 1.5,
                              dashArray: '4, 4'
                            }}
                          />
                        );
                      } else if (type === 'polygon' && cityData.geofencePolygon && cityData.geofencePolygon.length >= 3) {
                        return (
                          <Polygon
                            positions={cityData.geofencePolygon}
                            pathOptions={{
                              color: '#F97316',
                              fillColor: '#F97316',
                              fillOpacity: 0.1,
                              weight: 2
                            }}
                          />
                        );
                      }
                      return null;
                    })()}

                  </MapContainer>

                  {/* Floating Guide Banner for Picking Stop on Map */}
                  <AnimatePresence>
                    {settingMode === "stop" && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-20 left-4 right-16 z-[9999] bg-indigo-600/95 text-white p-3 rounded-2xl shadow-2xl border border-indigo-400/40 backdrop-blur-md flex items-center justify-between pointer-events-auto"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-amber-300 animate-bounce" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-tight truncate">Chagua Kituo Kwenye Ramani</p>
                            <p className="text-[10px] text-indigo-100 font-medium truncate">Gusa eneo kwenye ramani kuweka Kituo #{extraStops.length + 1}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettingMode("pickup");
                            setIsMapFullscreen(false);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase shrink-0"
                        >
                          Ghairi
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Floating Auto-Follow Re-Center Button when user pans away from moving driver */}
                  <AnimatePresence>
                    {!autoFollow && ["arriving", "on_trip", "driver_arrived", "found", "driver_arriving"].includes(step) && (
                      <motion.button
                        key="recenter-driver-floating-btn"
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAutoFollow(true);
                          setMapRefitTrigger(Date.now());
                          toast.info("Unamfuatilia dereva sasa (Auto-Follow Imewashwa)", { duration: 2000 });
                        }}
                        className="absolute bottom-80 sm:bottom-96 right-4 sm:right-6 z-[45] flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-2xl border border-emerald-400/40 cursor-pointer backdrop-blur-md transition-all active:shadow-inner"
                      >
                        <div className="relative flex items-center justify-center w-5 h-5">
                          <span className="absolute w-full h-full rounded-full bg-white/40 animate-ping pointer-events-none" />
                          <Navigation2 className="w-4 h-4 text-white rotate-45" />
                        </div>
                        <span className="tracking-tight uppercase font-black text-[11px]">Fuatilia Dereva</span>
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Floating GPS Reticle Locate-Me Button */}
                  {["map", "home"].includes(step) && !isSpectator && (
                    <motion.button
                      key="floating-gps-reticle-btn"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAutoLocated(true);
                        setAutoFollow(true);
                        setMapRefitTrigger(Date.now());
                        handleCurrentLocation(false);
                        toast.success("Eneo lako limerejeshwa (GPS Recenter) 📍", { duration: 2000 });
                      }}
                      className={`fixed sm:absolute z-[99999] w-12 h-12 rounded-full flex items-center justify-center shadow-2xl border cursor-pointer transition-all duration-300 pointer-events-auto group ${
                        (isMinimized || isMapFullscreen)
                          ? (!destination ? 'bottom-[195px] sm:bottom-[205px] right-4 sm:right-6' : 'bottom-[110px] sm:bottom-[120px] right-4 sm:right-6')
                          : (destination ? 'bottom-[440px] sm:bottom-[460px] right-4 sm:right-6' : 'bottom-[450px] sm:bottom-[470px] right-4 sm:right-6')
                      } ${
                        theme === 'dark' 
                          ? 'bg-[#161622]/95 border-neutral-700 text-white hover:bg-neutral-800 shadow-black/60' 
                          : 'bg-white/95 border-neutral-200/90 text-neutral-800 hover:bg-neutral-50 shadow-neutral-900/20'
                      }`}
                      title="Weka ramani mahali nilipo (GPS Locate Me)"
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-7 h-7 rounded-full bg-emerald-500/25 animate-ping group-active:scale-150 transition-transform pointer-events-none" />
                        <LocateReticleIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                      </div>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === "home" && !isRestoring && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col px-6 pt-12 pb-24 space-y-8 overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("/")}
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-md active:scale-95 transition-all text-[#ff6b35] hover:text-[#ff8552] ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200/80 hover:border-neutral-300'}`}
                    title="Rudi Nyumbani (Home)"
                  >
                    <Home className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className={`text-2xl font-black italic tracking-tighter leading-tight ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
                      TEKSI-PAPA 🚕
                    </h1>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-0.5">
                      Usafiri wa haraka na uhakika
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSavedAddressesModal(true)}
                    className={`h-11 px-3 rounded-2xl border flex items-center gap-1.5 shadow-md active:scale-95 transition-all text-xs font-black ${
                      theme === 'dark' 
                        ? 'bg-[#111118] border-neutral-800 text-neutral-200 hover:border-indigo-500/50' 
                        : 'bg-white border-neutral-200/80 text-neutral-800 hover:border-indigo-400'
                    }`}
                    title="Maeneo Yangu Yaliyohifadhiwa"
                  >
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span className="hidden sm:inline">Maeneo</span>
                    {savedAddressesList.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">
                        {savedAddressesList.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setShowFavoriteDriversModal(true)}
                    className={`h-11 px-3 rounded-2xl border flex items-center gap-1.5 shadow-md active:scale-95 transition-all text-xs font-black ${
                      theme === 'dark' 
                        ? 'bg-[#111118] border-neutral-800 text-neutral-200 hover:border-rose-500/50' 
                        : 'bg-white border-neutral-200/80 text-neutral-800 hover:border-rose-400'
                    }`}
                    title="Madereva Ninaowapenda"
                  >
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    <span className="hidden sm:inline">Madereva</span>
                    {favoriteDriversList.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">
                        {favoriteDriversList.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => navigate("/taxi/history")}
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-md active:scale-95 transition-all ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-300 hover:bg-neutral-900/60' : 'bg-white border-neutral-200/80 text-neutral-800 hover:bg-neutral-50'}`}
                    title="Historia ya Safari"
                  >
                    <Clock size={18} />
                  </button>
                </div>
              </div>

              <div className={`border rounded-[32px] p-6 shadow-xl space-y-5 ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200/80'}`}>
                <div className="space-y-4">
                  <div
                    className={`rounded-2xl border p-4 flex items-center gap-3.5 cursor-pointer active:scale-[0.98] transition-transform ${theme === 'dark' ? 'bg-neutral-900/40 hover:bg-neutral-900 border-neutral-800/80' : 'bg-neutral-50/80 hover:bg-neutral-100/40 border-neutral-200/60'}`}
                    onClick={() => {
                      console.log("Manual pickup click");
                      setSettingMode("pickup");
                      setStep("map");
                    }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-0.5">
                        {t('from_label')}
                      </p>
                      <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                        {pickup}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`rounded-2xl border p-4 flex items-center gap-3.5 cursor-pointer active:scale-[0.98] transition-transform ${theme === 'dark' ? 'bg-neutral-900/40 hover:bg-neutral-900 border-neutral-800/80' : 'bg-neutral-50/80 hover:bg-neutral-100/40 border-neutral-200/60'}`}
                    onClick={() => {
                      console.log("Manual dest click");
                      setSettingMode("destination");
                      setStep("map");
                    }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider mb-0.5">
                        {t('where_to_go')}
                      </p>
                      <p
                        className={`text-sm font-bold truncate ${destination ? (theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800') : (theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400')}`}
                      >
                        {destination || t('type_destination_placeholder')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Saved Addresses Bar */}
                <div className="space-y-2 pt-1 border-t border-neutral-150 dark:border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-indigo-500" />
                      Maeneo Yangu ya Haraka
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSavedAddressesModal(true)}
                      className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {savedAddressesList.length === 0 ? '+ Hifadhi Eneo' : 'Tazama Yote'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {savedAddressesList.slice(0, 4).map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr.address, addr.lat && addr.lng ? { lat: addr.lat, lng: addr.lng } : undefined, 'destination')}
                        className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 active:scale-95 transition-all ${
                          theme === 'dark' 
                            ? 'bg-neutral-900/80 border-neutral-800 text-neutral-200 hover:border-indigo-500' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:border-indigo-400 shadow-2xs'
                        }`}
                      >
                        <span>{addr.category === 'home' ? '🏠' : addr.category === 'work' ? '🏢' : '📍'}</span>
                        <span className="truncate max-w-[120px]">{addr.label}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowSavedAddressesModal(true)}
                      className="px-3 py-2 rounded-xl border-2 border-dashed border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0 hover:border-indigo-500 flex items-center gap-1 transition-colors"
                    >
                      + Ongeza Eneo
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    console.log("Order now click");
                    setSettingMode("destination");
                    setStep("map");
                  }}
                  className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[50px] font-black tracking-[0.2em] text-xs shadow-lg active:scale-95 transition-all"
                >
                  {t('book_ride').toUpperCase()}
                </button>
              </div>

              {/* Favorite Driver Feature Card */}
              {favoriteDriversList.length > 0 ? (
                <div className={`p-4 rounded-3xl border shadow-md space-y-2.5 ${
                  theme === 'dark' ? 'bg-[#141420] border-neutral-800' : 'bg-gradient-to-r from-rose-50/70 to-neutral-50 border-rose-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      Dereva Wangu Ninayempenda
                    </div>
                    <button
                      onClick={() => setShowFavoriteDriversModal(true)}
                      className="text-[10px] font-bold text-neutral-400 hover:text-neutral-200"
                    >
                      Tazama Wote ({favoriteDriversList.length})
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black border border-rose-500/20 shrink-0">
                        {favoriteDriversList[0].vehicleType === 'bike' ? '🏍️' : favoriteDriversList[0].vehicleType === 'bajaj' ? '🛺' : '🚗'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black truncate">{favoriteDriversList[0].name}</h4>
                        <p className="text-[11px] text-neutral-500 font-mono truncate">{favoriteDriversList[0].vehiclePlate} • ⭐ {favoriteDriversList[0].rating?.toFixed(1) || '5.0'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectDriverForBooking(favoriteDriversList[0])}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all shrink-0 shadow-xs"
                    >
                      Agiza Naye
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setShowFavoriteDriversModal(true)}
                  className={`p-4 rounded-3xl border border-dashed cursor-pointer hover:shadow-md transition-all flex items-center justify-between gap-3 ${
                    theme === 'dark' ? 'bg-neutral-900/40 border-neutral-800 hover:border-rose-500/40' : 'bg-rose-50/40 border-rose-200/80 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                      <Heart className="w-5 h-5 fill-rose-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black">Madereva Ninaowapenda</h4>
                      <p className="text-[10.5px] text-neutral-400">Hifadhi madereva unaowaamini kwa safari za kipaumbele</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-rose-500 underline shrink-0">+ Ongeza</span>
                </div>
              )}
            </motion.div>
          )}
          {step === "map" && !isSpectator && (
            <motion.div
              key="map-ui"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              onClick={() => {
                if (isMinimized || isMapFullscreen) {
                  setIsMapFullscreen(false);
                  setIsMinimized(false);
                  setSettingMode("destination");
                }
              }}
              className={`absolute z-[9999] transition-all duration-300 ${
                isMinimized || isMapFullscreen
                  ? "bottom-6 left-4 right-4 mx-auto max-w-[360px] pointer-events-auto flex flex-col gap-2.5"
                  : `bottom-0 left-0 right-0 rounded-t-[32px] border-t shadow-[0_-12px_48px_rgba(0,0,0,0.18)] max-h-[78dvh] overflow-y-auto no-scrollbar p-5 pb-9 space-y-3.5 ${
                      theme === 'dark' ? 'bg-[#111118]/95 backdrop-blur-md border-neutral-800' : 'bg-white/95 backdrop-blur-md border-neutral-200/90'
                    }`
              }`}
            >
              {!isMinimized && !isMapFullscreen && (
                <div
                  className="w-full flex flex-col items-center justify-center cursor-pointer group relative -mt-1.5 mb-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(true);
                  }}
                >
                  <div
                    className={`w-12 h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                      theme === 'dark' ? 'bg-neutral-800 group-hover:bg-neutral-700' : 'bg-neutral-200 group-hover:bg-neutral-300'
                    }`}
                  />
                </div>
              )}

              {!isMinimized && !isMapFullscreen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        console.log("Back to home click");
                        setStep("home");
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all text-[11px] font-black tracking-wider uppercase ${theme === 'dark' ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-200/40 text-neutral-600 hover:text-neutral-800'}`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      {t('back_to_home').toUpperCase()}
                    </button>
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] italic">
                      {t('select_location')}
                    </span>
                  </div>

                  <div className={`border rounded-[2rem] p-5 relative shadow-[0_12px_40px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.06)] ${theme === 'dark' ? 'bg-[#111118]/90 border-neutral-800' : 'bg-white border-neutral-100/80'}`}>
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-[#7F77DD] rounded-t-[2rem] opacity-90" />
                    <div className="space-y-4">
                      <div 
                        className="flex items-center gap-4 bg-neutral-50/70 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-850 p-3.5 rounded-2xl cursor-pointer group focus-within:border-indigo-500/50 focus-within:bg-white dark:focus-within:bg-neutral-900 transition-all duration-300 shadow-inner"
                        onClick={() => setSettingMode("destination")}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${settingMode === "destination" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : (theme === 'dark' ? "bg-neutral-800 text-neutral-400 group-hover:text-neutral-200" : "bg-neutral-200/60 text-neutral-500 group-hover:text-neutral-700")}`}
                        >
                          <Search className="w-4 h-4" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[8.5px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 mb-1">
                            {t('where_to_go')}
                          </p>
                          <input
                            type="text"
                            value={destination}
                            onChange={(e) => {
                              setDestination(e.target.value);
                              geocodeAddress(e.target.value);
                            }}
                            onFocus={() => setSettingMode("destination")}
                            className={`w-full bg-transparent text-[13px] font-black border-none outline-none p-0 focus:ring-0 leading-tight ${theme === 'dark' ? 'text-neutral-100 placeholder:text-neutral-700' : 'text-neutral-850 placeholder:text-neutral-400'}`}
                            placeholder={t('type_destination_placeholder')}
                          />
                        </div>
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingMode("destination");
                              setIsMapFullscreen(true);
                              toast.success(`${t('select_location')} ${t('on_map')}! 📍`);
                            }}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border active:scale-90 transition-all shadow-sm group ${theme === 'dark' ? 'bg-emerald-950/50 border-emerald-900/40 text-emerald-400 hover:bg-emerald-900/80 hover:text-emerald-300' : 'bg-emerald-50/80 border-emerald-100 text-emerald-600 hover:bg-emerald-100/90 hover:text-emerald-700'}`}
                            title={t('on_map')}
                          >
                            <Map className="w-4 h-4 group-hover:scale-105 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {suggestions.length > 0 && (
                      <div className={`absolute left-0 right-0 top-full mt-2 z-[100] border shadow-2xl rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200'}`}>
                        <div className={`px-4 py-2.5 border-b text-[9px] font-black uppercase tracking-wider ${theme === 'dark' ? 'bg-[#161622] border-neutral-850 text-neutral-400' : 'bg-neutral-50 border-neutral-100 text-neutral-500'}`}>
                          Maeneo Yaliyopatikana
                        </div>
                        {suggestions.map((s, i) => {
                          const displayName = s.display_name || "";
                          const parts = displayName.split(",");
                          const mainName = parts[0] || "Eneo Lisilojulikana";
                          const subName = parts.slice(1).join(",").trim() || "Chagua eneo hili";
                          
                          return (
                            <button
                              key={`suggest-${displayName}-${i}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                selectSuggestion(s);
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              className={`w-full text-left p-4 flex items-center gap-4 border-b last:border-0 group transition-all ${theme === 'dark' ? 'hover:bg-neutral-800/40 border-neutral-800' : 'hover:bg-neutral-50 active:bg-neutral-100 border-neutral-100'}`}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-neutral-800 text-emerald-400 group-hover:bg-emerald-950/40' : 'bg-neutral-100 text-emerald-600 group-hover:bg-emerald-50'} group-hover:scale-105`}>
                                <MapPin className="w-4 h-4" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className={`text-sm font-bold truncate group-hover:text-emerald-500 transition-colors ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                  {mainName}
                                </p>
                                <p className={`text-[11px] truncate mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                  {subName}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Bar: Saved Addresses & Favorite Drivers in Map view */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <button
                      type="button"
                      onClick={() => setShowSavedAddressesModal(true)}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider shrink-0 active:scale-95 transition-all ${
                        theme === 'dark' ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 hover:bg-indigo-900/50' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                      }`}
                      title="Fungua Maeneo Yangu"
                    >
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      <span>Maeneo Yangu ({savedAddressesList.length})</span>
                    </button>

                    {savedAddressesList.slice(0, 3).map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr.address, addr.lat && addr.lng ? { lat: addr.lat, lng: addr.lng } : undefined, 'destination')}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 text-[10.5px] font-bold shrink-0 active:scale-95 transition-all ${
                          destination === addr.address
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : (theme === 'dark' ? 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-2xs')
                        }`}
                      >
                        <span>{addr.category === 'home' ? '🏠' : addr.category === 'work' ? '🏢' : '📍'}</span>
                        <span className="truncate max-w-[100px]">{addr.label}</span>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowFavoriteDriversModal(true)}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider shrink-0 active:scale-95 transition-all ${
                        preferredDriver 
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : (theme === 'dark' ? 'bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/50' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100')
                      }`}
                      title="Chagua Dereva Unayempenda"
                    >
                      <Heart className={`w-3 h-3 ${preferredDriver ? 'fill-white text-white' : 'fill-rose-500 text-rose-500'}`} />
                      <span>{preferredDriver ? `Dereva: ${preferredDriver.name}` : `Dereva Mpendwa (${favoriteDriversList.length})`}</span>
                    </button>
                  </div>

                  {/* Preferred Driver Active Banner if selected */}
                  {preferredDriver && (
                    <div className="w-full px-3.5 py-2 rounded-2xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-rose-700 dark:text-rose-300 shadow-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Heart className="w-4 h-4 fill-rose-500 text-rose-500 shrink-0" />
                        <div className="text-xs truncate">
                          <span className="font-black">Safari na Dereva Mpendwa:</span> {preferredDriver.name} ({preferredDriver.vehiclePlate})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreferredDriver(null);
                          toast.info('Dereva mpendwa ameondolewa kwenye safari hii');
                        }}
                        className="text-[10.5px] font-black text-rose-600 dark:text-rose-400 hover:underline shrink-0 ml-2"
                      >
                        Ondoa
                      </button>
                    </div>
                  )}

                  {/* 36% OFF Promotion Applied Ribbon when destination is set */}
                  {destination && (
                    <div className="w-full px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/25 flex items-center justify-between text-emerald-700 dark:text-emerald-300 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                          36% OFF
                        </span>
                        <span className="text-xs font-bold">
                          Promotion applied
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        Okoa hadi TZS 1,000
                      </span>
                    </div>
                  )}

                  {/* Compact slide banner of active promotional banners */}
                  {(() => {
                    const isHomepageOnly = config.taxiBannerPlacement === 'homepage';
                    const showBannerHere = isHomepageOnly ? !destination : true;
                    if (!showBannerHere || taxiBanners.length === 0) return null;
                    return (
                      <div className={`w-full p-4 rounded-3xl border shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${theme === 'dark' ? 'bg-neutral-900/30 border-neutral-800/80' : 'bg-neutral-50 border-neutral-100/50'}`}>
                        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar snap-x scroll-smooth">
                          {taxiBanners.map((banner, idx) => (
                            <div
                              key={`taxi-banner-${banner.id || idx}`}
                              className="min-w-full h-28 rounded-2xl overflow-hidden relative snap-center shadow-md group border border-white/5 shrink-0"
                            >
                              <img
                                src={banner.img}
                                alt={banner.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent flex flex-col justify-end p-4 text-white">
                                <span className="absolute top-2 left-2.5 flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 backdrop-blur-md rounded-full border border-emerald-500/30 text-[8px] font-black uppercase tracking-widest text-[#00E5A0]">
                                  Ofa Maalum
                                </span>
                                <h4 className="text-xs font-black uppercase italic tracking-tight">{banner.title}</h4>
                                <p className="text-[9px] opacity-95 font-bold uppercase tracking-wider text-neutral-300">{banner.sub}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {taxiBanners.length > 1 && (
                          <div className="flex justify-center gap-1.5 mt-2">
                            {taxiBanners.map((_, i) => (
                              <div key={`dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-indigo-500/30" />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}



                  {destination && (
                    <div className={`relative w-full py-2 transition-all duration-200 ${suggestions.length > 0 ? "pointer-events-none opacity-20 grayscale select-none" : ""}`}>
                      {/* Left Scroll Button */}
                      <button
                        type="button"
                        onClick={() => scrollVehicles('left')}
                        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-30 w-7 h-7 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-md items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all opacity-80 hover:opacity-100 hover:scale-110"
                        title="Scroll kushoto"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Right Scroll Button */}
                      <button
                        type="button"
                        onClick={() => scrollVehicles('right')}
                        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-30 w-7 h-7 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-md items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all opacity-80 hover:opacity-100 hover:scale-110"
                        title="Scroll kulia"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Horizontal Single Row Scroll Container */}
                      <div 
                        ref={vehicleScrollRef}
                        className="flex items-stretch gap-2.5 sm:gap-3 w-full overflow-x-auto pb-2 pt-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none flex-nowrap"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {rideOptions.map((ride) => {
                          const isSelected = selectedRide?.id === ride.id;
                          return (
                            <button
                              key={ride.id}
                              onClick={() => {
                                if (justSelectedRef.current) return;
                                if (ride.maintenance) {
                                  toast.error(`La hasha! Huduma ya ${ride.name} iko kwenye matengenezo kwa sasa. Tafadhali chagua usafiri mwingine.`);
                                  return;
                                }
                                setSelectedRide(ride);
                              }}
                              className={`min-w-[130px] sm:min-w-[145px] max-w-[155px] flex-1 snap-start shrink-0 p-3 sm:p-3.5 rounded-[22px] border-2 transition-all duration-300 flex flex-col items-center justify-between gap-2 relative overflow-hidden group ${
                                ride.maintenance 
                                  ? (theme === 'dark' ? "opacity-50 grayscale pointer-events-auto cursor-not-allowed border-amber-900/40 bg-amber-950/20" : "opacity-50 grayscale pointer-events-auto cursor-not-allowed border-amber-500/25 bg-amber-50") :
                                isSelected
                                  ? (theme === 'dark' ? "bg-indigo-950/30 border-indigo-500 shadow-md scale-[1.02]" : "bg-indigo-50/60 border-indigo-600 shadow-md scale-[1.02]")
                                  : (theme === 'dark' ? "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80" : "bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50")
                              }`}
                            >
                              {ride.maintenance && (
                                <div className="absolute top-0 inset-x-0 bg-amber-500 text-black font-black uppercase text-[6.5px] text-center tracking-widest py-0.5 z-20 leading-none">
                                  Matengenezo
                                </div>
                              )}

                              {isSelected && (
                                <motion.div
                                  layoutId="active-bg"
                                  className="absolute inset-0 bg-indigo-600/5 pointer-events-none"
                                />
                              )}
                              
                              {/* Active state small indicator point */}
                              <div className={`absolute top-2 left-2 w-1.5 h-1.5 rounded-full transition-all duration-300 ${isSelected ? "bg-indigo-600 scale-100 shadow-[0_0_8px_indigo]" : "bg-transparent scale-0"}`} />

                              {/* Kitufe cha Ikoni cha Gharama ya Uwazi (Breakdown Icon) */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRide(ride);
                                  setShowBreakdownModal(true);
                                }}
                                title="Tazama Mchanganuo wa Gharama za Usafiri Huu"
                                className={`absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-500"
                                    : (theme === 'dark'
                                      ? "bg-neutral-800/90 text-indigo-400 border border-neutral-700 hover:bg-neutral-700"
                                      : "bg-white/95 text-indigo-600 border border-neutral-200 hover:bg-indigo-50")
                                }`}
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </div>

                              {/* Beautiful Custom-designed Vehicle Container with a 3D Glowing Podium/Shadow */}
                              <div className="relative w-full aspect-[4/3] max-h-[64px] sm:max-h-[72px] flex items-center justify-center -mt-1 select-none">
                                {/* Ambient dynamic glow under the vehicle */}
                                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-2.5 rounded-full transition-all duration-300 blur-md ${
                                  isSelected ? "bg-indigo-600/20 scale-110" : (theme === 'dark' ? "bg-neutral-950/60" : "bg-neutral-200/40 group-hover:bg-indigo-600/10")
                                }`} />
                                {/* Subtle elegant podium ellipse */}
                                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1 rounded-full border transition-all duration-300 ${
                                  isSelected ? (theme === 'dark' ? "bg-neutral-800 border-indigo-900" : "bg-neutral-100 border-indigo-200") : "bg-transparent border-transparent"
                                }`} />
                                
                                {/* Floating Vehicle container */}
                                <div className={`relative z-10 transition-all duration-500 transform flex items-center justify-center ${
                                  isSelected ? "-translate-y-1.5 scale-110 drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)]" : "group-hover:-translate-y-1 group-hover:scale-105"
                                }`}>
                                  {ride.imageUrl ? (
                                    <img 
                                      src={ride.imageUrl} 
                                      className="w-16 sm:w-20 h-10 sm:h-12 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]" 
                                      referrerPolicy="no-referrer" 
                                      alt={ride.name}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                        const fb = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                        if (fb) fb.style.display = 'block';
                                      }}
                                    />
                                  ) : null}
                                  <span className={`text-3xl sm:text-3.5xl vehicle-emoji-fallback ${ride.imageUrl ? 'hidden' : 'block'}`}>
                                    {ride.image || (ride.id === 'mini' ? '🚗' : ride.id === 'bajaj' ? '🛺' : ride.id === 'bike' ? '🏍️' : ride.id === 'ambulance' ? '🚑' : '🚒')}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="text-center w-full">
                                <h4
                                  className={`text-[9px] font-black uppercase tracking-wider truncate px-1 ${isSelected ? "text-indigo-400" : (theme === 'dark' ? 'text-neutral-500' : "text-neutral-500")}`}
                                >
                                  {ride.name}
                                </h4>
                                <h3 className={`text-[11px] font-black italic mt-0.5 transition-colors whitespace-nowrap ${
                                  isSelected 
                                    ? (destination && totalDistance > 0) ? "text-emerald-500 drop-shadow-sm text-xs" : (theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800')
                                    : (destination && totalDistance > 0) ? "text-emerald-600 text-xs" : (theme === 'dark' ? 'text-neutral-400' : 'text-neutral-700')
                                }`}>
                                  TZS {ride.price.toLocaleString()}
                                </h3>
                              </div>
                              
                              {/* Information of capacity and ETA */}
                              <div className={`w-full flex items-center justify-between px-1.5 pt-1.5 mt-0.5 border-t text-[9px] font-bold ${theme === 'dark' ? 'border-neutral-800 text-neutral-400' : 'border-neutral-100 text-neutral-600'}`}>
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span>Abiria {ride.capacity}</span>
                                </div>
                                <div className={`flex items-center gap-1 whitespace-nowrap ${isSelected ? "text-emerald-500 font-extrabold" : ""}`}>
                                  <Clock className={`w-3 h-3 shrink-0 ${isSelected ? "text-emerald-500 animate-pulse" : "text-neutral-400"}`} />
                                  <span>{ride.eta} min</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PapoShare Ride Mode Selector (Solo vs PapoShare) for Bajaji / Gari, and PapoSend for Boda */}
                  {destination && selectedRide && (
                    <div className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                      theme === 'dark' ? 'bg-[#161622]/90 border-neutral-800' : 'bg-white border-neutral-200/90 shadow-sm'
                    } ${suggestions.length > 0 ? "pointer-events-none opacity-20 grayscale select-none" : ""}`}>
                      {(selectedRide.id === 'mini' || selectedRide.id === 'bajaj') ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">👥</span>
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                  Hali ya Safari (PapoShare Pooling)
                                </h4>
                                <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">
                                  Gawana gharama ya safari na msafiri wa njia moja
                                </p>
                              </div>
                            </div>
                            <span className="text-[8.5px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
                              Okoa hadi 35%
                            </span>
                          </div>

                          {/* 2-Mode Tab Switch: Solo vs PapoShare */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Solo Mode */}
                            <button
                              type="button"
                              onClick={() => setShareMode('solo')}
                              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                                shareMode === 'solo'
                                  ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-500 text-indigo-950 dark:text-indigo-300 shadow-xs ring-1 ring-indigo-500'
                                  : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-base">⚡</span>
                                {shareMode === 'solo' && (
                                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 flex items-center justify-center">
                                    <Check className="w-2 h-2 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="mt-1">
                                <p className="text-[10px] font-black leading-tight">Solo (Binafsi)</p>
                                <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">Moja kwa moja • 100%</p>
                              </div>
                            </button>

                            {/* PapoShare Mode */}
                            <button
                              type="button"
                              onClick={() => setShareMode('share')}
                              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                                shareMode === 'share'
                                  ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-500 text-purple-950 dark:text-purple-300 shadow-xs ring-1 ring-purple-500'
                                  : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-base">🤝</span>
                                {shareMode === 'share' && (
                                  <div className="w-3.5 h-3.5 rounded-full bg-purple-600 flex items-center justify-center">
                                    <Check className="w-2 h-2 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="mt-1">
                                <p className="text-[10px] font-black leading-tight text-purple-700 dark:text-purple-300">PapoShare (Gawana)</p>
                                <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-black">Punguzo la Bei</p>
                              </div>
                            </button>
                          </div>

                          {/* PapoShare Details & Consent Preferences */}
                          {shareMode === 'share' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2 text-xs"
                            >
                              {/* Detour Budget & Route Efficiency Banner */}
                              <div className="flex items-center justify-between text-[9px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-1.5 rounded-lg border border-purple-500/15">
                                <span>⏱️ Detour Budget: Max {calculateDetourBudget(Math.ceil((totalDuration || 900) / 60))} min</span>
                                <span className="text-neutral-500 dark:text-neutral-400 font-normal">FIFO / Hakuna Kurudi Nyuma</span>
                              </div>

                              {/* Consent Checkbox (Ruhusu dereva kupakia msafiri njiani) */}
                              <label className="flex items-start gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={allowSharingConsent}
                                  onChange={(e) => setAllowSharingConsent(e.target.checked)}
                                  className="w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                                />
                                <span className="text-[9.5px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                                  Ruhusu dereva kuchukua abiria mwingine njiani anayeelekea njia yako
                                </span>
                              </label>

                              {/* Women Only & Verified Only Sharing Preferences */}
                              <div className="pt-1.5 border-t border-purple-500/15 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={womenOnlySharing}
                                    onChange={(e) => setWomenOnlySharing(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                                  />
                                  <span className="text-[8.5px] font-bold text-neutral-700 dark:text-neutral-300">
                                    👩 Abiria Wanawake Tu
                                  </span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={verifiedOnlySharing}
                                    onChange={(e) => setVerifiedOnlySharing(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                                  />
                                  <span className="text-[8.5px] font-bold text-neutral-700 dark:text-neutral-300">
                                    ⭐ Waliothibitishwa Tu
                                  </span>
                                </label>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ) : selectedRide.id === 'bike' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">🏍️</span>
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                Boda Boda • Abiria 1 Tu
                              </h4>
                            </div>
                            <span className="text-[8px] font-bold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                              Sheria za Usalama
                            </span>
                          </div>

                          {/* PapoSend Parcel Add-on along the way */}
                          <label className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allowBodaParcelAddon}
                                onChange={(e) => setAllowBodaParcelAddon(e.target.checked)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600"
                              />
                              <div>
                                <p className="text-[9.5px] font-black text-amber-800 dark:text-amber-300">
                                  📦 PapoSend Njiani (Kifurushi Kidogo)
                                </p>
                                <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">
                                  Ruhusu dereva kubeba bahasha/kifurushi kidogo kuelekea njia moja
                                </p>
                              </div>
                            </div>
                            <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              PapoSend
                            </span>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Payment Method Selection (Aina ya Malipo) */}
                  {destination && (
                    <div className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                      theme === 'dark' ? 'bg-[#161622]/90 border-neutral-800' : 'bg-white border-neutral-200/90 shadow-sm'
                    } ${suggestions.length > 0 ? "pointer-events-none opacity-20 grayscale select-none" : ""}`}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">💳</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                            Aina ya Malipo
                          </span>
                        </div>
                        <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                          {paymentMethod === 'cash' 
                            ? '💵 Pesa Mkononi' 
                            : paymentMethod === 'mobile_money' 
                              ? `📱 ${selectedMobileOperator === 'mpesa' ? 'M-Pesa' : selectedMobileOperator === 'tigopesa' ? 'Tigo Pesa' : selectedMobileOperator === 'airtel' ? 'Airtel Money' : 'HaloPesa'}` 
                              : paymentMethod === 'wallet' 
                                ? '👛 Mkoba' 
                                : '💳 Kadi ya Benki'}
                        </span>
                      </div>

                      {/* 4 Payment Methods Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* 1. Cash */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            paymentMethod === 'cash'
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 text-emerald-950 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500'
                              : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-lg">💵</span>
                            {paymentMethod === 'cash' && (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="mt-1">
                            <p className="text-[10px] font-black leading-tight">Pesa Taslimu</p>
                            <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">Lipa Dereva Mkononi</p>
                          </div>
                        </button>

                        {/* 2. Mobile Money */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('mobile_money')}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            paymentMethod === 'mobile_money'
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-500 text-indigo-950 dark:text-indigo-300 shadow-xs ring-1 ring-indigo-500'
                              : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-lg">📱</span>
                            {paymentMethod === 'mobile_money' && (
                              <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="mt-1">
                            <p className="text-[10px] font-black leading-tight">Lipa kwa Simu</p>
                            <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">M-Pesa / Tigo / Airtel</p>
                          </div>
                        </button>

                        {/* 3. Papo Hapo Wallet */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('wallet')}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            paymentMethod === 'wallet'
                              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 text-amber-950 dark:text-amber-300 shadow-xs ring-1 ring-amber-500'
                              : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-lg">👛</span>
                            {paymentMethod === 'wallet' && (
                              <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="mt-1">
                            <p className="text-[10px] font-black leading-tight">Papo Mkoba</p>
                            <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">Wallet App</p>
                          </div>
                        </button>

                        {/* 4. Card / Visa */}
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            paymentMethod === 'card'
                              ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 text-blue-950 dark:text-blue-300 shadow-xs ring-1 ring-blue-500'
                              : 'bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-lg">💳</span>
                            {paymentMethod === 'card' && (
                              <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="mt-1">
                            <p className="text-[10px] font-black leading-tight">Kadi ya Benki</p>
                            <p className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">Visa / Mastercard</p>
                          </div>
                        </button>
                      </div>

                      {/* Mobile Network Selection (when Lipa kwa Simu is selected) */}
                      {paymentMethod === 'mobile_money' && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                          <span className="text-[8.5px] font-black uppercase text-neutral-400 shrink-0">Mtandao:</span>
                          {[
                            { id: 'mpesa', name: 'Vodacom M-Pesa', emoji: '🔴' },
                            { id: 'tigopesa', name: 'Tigo Pesa', emoji: '🔵' },
                            { id: 'airtel', name: 'Airtel Money', emoji: '🔴' },
                            { id: 'halopesa', name: 'HaloPesa', emoji: '🟠' },
                          ].map((op) => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setSelectedMobileOperator(op.id as any)}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black whitespace-nowrap transition-all border flex items-center gap-1 ${
                                selectedMobileOperator === op.id
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200'
                              }`}
                            >
                              <span>{op.emoji}</span>
                              <span>{op.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modernization Options (Scheduled Rides, Multi-Stops, Loyalty Rewards) */}
                  {destination && (
                    <div className={`p-3.5 rounded-2xl border space-y-3 transition-all ${theme === 'dark' ? 'bg-[#161622]/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200/80'}`}>
                      {/* Top Bar Tabs: Instant vs Scheduled */}
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsScheduled(false)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                              !isScheduled
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : (theme === 'dark' ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200/70 text-neutral-600')
                            }`}
                          >
                            ⚡ Sasa Hivi
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsScheduled(true)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                              isScheduled
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : (theme === 'dark' ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200/70 text-neutral-600')
                            }`}
                          >
                            📅 Weka Miadi (Schedule)
                          </button>
                        </div>
                      </div>

                      {/* Scheduled Date/Time Picker */}
                      {isScheduled && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Tarehe ya Safari</label>
                            <input
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              className={`w-full p-2 rounded-xl text-xs font-bold border ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200' : 'bg-white border-neutral-300 text-neutral-800'}`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Saa ya Safari</label>
                            <input
                              type="time"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className={`w-full p-2 rounded-xl text-xs font-bold border ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200' : 'bg-white border-neutral-300 text-neutral-800'}`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Multi-Stop Rides Section */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Vituo vya Safari (Stops)</span>
                          {extraStops.length < 3 && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSettingMode("stop");
                                  setIsMapFullscreen(true);
                                  toast.info(`Gusa mahali kwenye ramani kuweka Kituo #${extraStops.length + 1}`, { duration: 3000 });
                                }}
                                className="text-[9px] font-black uppercase text-amber-500 hover:text-amber-400 tracking-wider flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg active:scale-95 transition-all"
                              >
                                <MapPin className="w-3 h-3 text-amber-500" />
                                <span>Chagua kwa Ramani</span>
                              </button>
                              {!showAddStopInput && (
                                <button
                                  type="button"
                                  onClick={() => setShowAddStopInput(true)}
                                  className="text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-400 tracking-wider flex items-center gap-0.5"
                                >
                                  + Ongeza Kituo
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* List of Extra Stops */}
                        {extraStops.map((stop, idx) => (
                          <div key={stop.id} className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'}`}>
                            <span className="truncate pr-2">📍 Kituo #{idx + 1}: {stop.address}</span>
                            <button
                              type="button"
                              onClick={() => setExtraStops(prev => prev.filter(s => s.id !== stop.id))}
                              className="text-red-500 font-bold text-xs px-1 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {/* Add Stop Input Row */}
                        {showAddStopInput && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={newStopInput}
                              onChange={(e) => setNewStopInput(e.target.value)}
                              placeholder="Andika jina la kituo cha kati..."
                              className={`flex-1 p-2 rounded-xl text-xs font-bold border ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200' : 'bg-white border-neutral-300 text-neutral-800'}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newStopInput.trim()) {
                                  setExtraStops(prev => [...prev, { id: Date.now().toString(), address: newStopInput.trim() }]);
                                  setNewStopInput("");
                                  setShowAddStopInput(false);
                                }
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-black uppercase shadow-md active:scale-95 transition-all shrink-0"
                            >
                              Weka
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSettingMode("stop");
                                setIsMapFullscreen(true);
                                setShowAddStopInput(false);
                                toast.info(`Gusa mahali kwenye ramani kuweka Kituo #${extraStops.length + 1}`, { duration: 3000 });
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-md active:scale-95 transition-all shrink-0"
                              title="Chagua kituo moja kwa moja kwenye ramani"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Ramani</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Pickup Note / Landmark Instructions for Driver */}
                      <div className="pt-0.5">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block mb-1">
                          📍 Maelekezo kwa Dereva (Alama / Landmark)
                        </label>
                        <input
                          type="text"
                          value={pickupNote}
                          onChange={(e) => setPickupNote(e.target.value)}
                          placeholder="Mf. Nipo karibu na duka la dawa, gari nyeusi..."
                          className={`w-full p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                            theme === 'dark'
                              ? 'bg-[#111118] border-neutral-800 text-neutral-200 placeholder-neutral-500 focus:border-indigo-500'
                              : 'bg-white border-neutral-300 text-neutral-800 placeholder-neutral-400 focus:border-indigo-600'
                          }`}
                        />
                      </div>

                      {/* Loyalty Cashback Points Redemption */}
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-200/60'}`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="usePointsCheck"
                            checked={usePoints}
                            onChange={(e) => setUsePoints(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                          />
                          <label htmlFor="usePointsCheck" className="text-xs font-bold cursor-pointer select-none">
                            🎁 Tumia Pointi za Zawadi ({userPointsBalance} Pts)
                          </label>
                        </div>
                        {usePoints && (
                          <span className="text-xs font-black font-mono text-emerald-500">
                            -TZS {Math.min(userPointsBalance, 1200).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}


                  
                  <button
                    onClick={() => {
                      if (justSelectedRef.current) return;
                      console.log("Confirm button click");
                      if (destination && selectedRide) {
                        const defaultName = profile?.displayName || auth.currentUser?.displayName || "";
                        let defaultPhone = profile?.phoneNumber || "";
                        if (defaultPhone.startsWith("+255")) {
                          defaultPhone = defaultPhone.slice(4);
                        } else if (defaultPhone.startsWith("255")) {
                          defaultPhone = defaultPhone.slice(3);
                        }
                        
                        setPassengerType('you');
                        setPassengerStep('who');
                        setPassengerName(passengerName || defaultName);
                        setPassengerPhone(passengerPhone || defaultPhone);
                        setShowPassengerModal(true);
                      } else {
                        confirmBooking();
                      }
                    }}
                    disabled={isCreatingRide || !destination || suggestions.length > 0}
                    className={`w-full h-14 sm:h-16 rounded-2xl font-black italic uppercase text-xs sm:text-sm tracking-wider flex items-center justify-between px-6 sm:px-8 transition-all duration-300 active:scale-98 relative overflow-hidden group shadow-lg ${
                      (!destination || suggestions.length > 0)
                        ? "bg-neutral-200 dark:bg-neutral-850 text-neutral-400 dark:text-neutral-500 border border-neutral-300/20 dark:border-neutral-800 cursor-not-allowed opacity-80"
                        : "bg-[#10a349] hover:bg-[#0d8a3e] text-white shadow-[0_8px_25px_rgba(16,163,73,0.3)] hover:shadow-[0_12px_32px_rgba(16,163,73,0.45)] hover:scale-[1.01]"
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <span className="relative z-10 flex items-center gap-2">
                      {destination ? (
                        selectedRide ? (
                          <div className="flex items-center gap-2 text-left">
                            <span>
                              THIBITISHA {selectedRide.name.toUpperCase()}
                              {(selectedRide.id === 'mini' || selectedRide.id === 'bajaj') && shareMode === 'share' ? ' (PAPOSHARE)' : ''}
                            </span>
                            <span className="text-[10px] normal-case tracking-normal px-2 py-0.5 rounded-full bg-white/20 font-bold hidden sm:inline-block">
                              {paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'mobile_money' ? `📱 ${selectedMobileOperator === 'mpesa' ? 'M-Pesa' : selectedMobileOperator === 'tigopesa' ? 'TigoPesa' : selectedMobileOperator === 'airtel' ? 'Airtel' : 'HaloPesa'}` : paymentMethod === 'wallet' ? '👛 Mkoba' : '💳 Kadi'}
                            </span>
                          </div>
                        ) : (
                          "CHAGUA USAFIRI"
                        )
                      ) : (
                        "WEKA UNAPOKWENDA"
                      )}
                    </span>
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}

              {(isMinimized || isMapFullscreen) && (
                <div className="w-full flex flex-col gap-2.5">
                  {/* Ultra-Sleek Modern Promo Card: Share Papo Hapo / Zawadi / Earn TZS 1,000 */}
                  {!destination && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShareModal(true);
                      }}
                      className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-[0_8px_25px_rgba(16,185,129,0.3)] border border-emerald-400/40 backdrop-blur-xl flex items-center justify-between cursor-pointer transition-all group overflow-hidden relative"
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
                      
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                          <span className="text-xl group-hover:scale-110 transition-transform">🎁</span>
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping border border-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs sm:text-sm font-black tracking-tight leading-tight">
                              Share Papo Hapo
                            </h4>
                            <span className="text-[8.5px] bg-gradient-to-r from-amber-400 to-yellow-300 text-neutral-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm animate-heartBeat flex items-center gap-1 border border-amber-300/60">
                              <span className="inline-block animate-bounce">🎁</span>
                              <span>Zawadi</span>
                            </span>
                          </div>
                          <p className="text-[10.5px] font-extrabold text-emerald-100 truncate mt-0.5 flex items-center gap-1">
                            <span>Earn TZS 1,000 Coupons</span>
                            <span className="text-[9px] text-emerald-200/90">• Vocha papo hapo</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="px-3 py-1.5 rounded-xl bg-white/20 group-hover:bg-white/30 text-white text-[10.5px] font-black uppercase flex items-center gap-1.5 border border-white/25 transition-all shadow-xs">
                          <span>Alika</span>
                          <Share2 className="w-3.5 h-3.5 text-white group-hover:rotate-12 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Search Destination Pill */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMapFullscreen(false);
                      setIsMinimized(false);
                      setSettingMode("destination");
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-3xl border shadow-[0_12px_40px_rgba(0,0,0,0.15)] flex items-center gap-3.5 select-none cursor-pointer active:scale-[0.98] hover:shadow-[0_16px_48px_rgba(0,0,0,0.22)] transition-all ${
                      theme === 'dark' ? 'bg-[#111118]/95 backdrop-blur-md border-neutral-800' : 'bg-white/95 backdrop-blur-md border-neutral-200/90'
                    }`}
                  >
                    <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${
                      theme === 'dark' ? 'bg-neutral-850 text-neutral-400' : 'bg-neutral-100/90 text-neutral-500'
                    }`}>
                      <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400 mb-0.5 animate-neonPulse">
                        UNAKWENDA WAPI?
                      </p>
                      <p className={`text-[13px] font-black tracking-tight truncate ${
                        destination
                          ? (theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800')
                          : (theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500')
                      }`}>
                        {destination || "Andika hapa unapokwenda"}
                      </p>
                    </div>

                    <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 ${
                      theme === 'dark'
                        ? 'bg-indigo-950/40 text-indigo-400'
                        : 'bg-indigo-50/70 text-indigo-600'
                    }`}>
                      <Map className="w-4 h-4 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === "searching" && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-transparent pointer-events-none"
            >
              <SearchingScreen
                ride={activeRide as any}
                onCancel={() => {
                  if (isSpectator) return;
                  console.log("Cancel from searching");
                  cancelRide();
                  setStep("map");
                  setRideId(null);
                }}
                onTimeout={handleTimeout}
                isMinimized={isMapFullscreen}
                isSpectator={isSpectator}
              />
            </motion.div>
          )}

          {step === "found" && (
            <motion.div
              key="found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-transparent pointer-events-none"
            >
              <DriverFoundScreen
                onNext={() => setStep("arriving")}
                isMinimized={isMapFullscreen}
              />
            </motion.div>
          )}

          {step === "arriving" && activeRide && (
            <motion.div
              key="arriving"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-transparent pointer-events-none"
            >
              <DriverArrivedScreen
                ride={
                  {
                    ...activeRide,
                    driverLocation: driverLivePos || activeRide.driverLocation,
                  } as any
                }
                onCall={() =>
                  window.open(`tel:${activeRide.driverInfo?.phone}`)
                }
                onMessage={() => {
                  if (activeRide.driverId) {
                    setSearchParams({ to: activeRide.driverId });
                    setIsChatOpen(true);
                  }
                }}
                onCancel={() => {
                  if (isSpectator) return;
                  cancelRide();
                }}
                onImComing={() => {
                  if (isSpectator) return;
                  updateDoc(doc(db, "rides", rideId!), {
                    status: "on_trip",
                    updatedAt: serverTimestamp(),
                  });
                }}
                isMinimized={isMapFullscreen}
                isSpectator={isSpectator}
              />
            </motion.div>
          )}

          {step === "on_trip" && activeRide && (
            <motion.div
              key="on_trip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-transparent pointer-events-none"
            >
              <LiveTripScreen
                ride={
                  {
                    ...activeRide,
                    driverLocation: driverLivePos || activeRide.driverLocation,
                    distance: liveDistance || activeRide.distance,
                    viewers: activeRide.viewers,
                  } as any
                }
                user={user}
                profile={profile}
                onGoHome={() => {
                  setStep("map");
                  toast.info("Umerudi nyumbani. Safari yako inaendelea kufuatiliwa!");
                }}
                onMessage={isSpectator ? undefined : () => {
                  if (activeRide.driverId) {
                    setSearchParams({ to: activeRide.driverId });
                    setIsChatOpen(true);
                  }
                }}
                onCancel={async () => {
                  if (isSpectator) return;
                  if (window.confirm("Je, una uhakika unataka kukatisha safari hii ya sasa na kuanza upya?")) {
                    await cancelRide();
                    setStep("map");
                    setRideId(null);
                    toast.success("Safari imefutwa. Sasa unaweza kupanga upya!");
                  }
                }}
                isMinimized={isMapFullscreen}
                isSpectator={isSpectator}
              />
            </motion.div>
          )}

          {step === "completed" && activeRide && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[80] bg-[#0a0a0f]"
            >
              <TripCompleteScreen
                ride={activeRide as any}
                onPay={handlePayment}
              />
            </motion.div>
          )}

          {step === "rating" && activeRide && (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[80] bg-[#0a0a0f]"
            >
              <RatingScreen
                ride={activeRide as any}
                onSubmit={handleRating}
                onSkip={() => navigate("/")}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isSpectator && activeRide && ["completed", "cancelled"].includes(activeRide.status) && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-[#111118] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-neutral-800 border border-neutral-700">
                {activeRide.status === "completed" ? "🎉" : "⚠️"}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                  {activeRide.status === "completed" ? "SAFARI IMEKAMILIKA" : "SAFARI IMEGHAIRIWA"}
                </h2>
                <p className="text-xs text-[#8A8FA8] leading-relaxed">
                  {activeRide.status === "completed" 
                    ? "Safari hii imekamilika salama. Asante kwa kumpasha na kumfuatilia safari yake kuanzia mwanzo hadi mwisho!"
                    : "Safari hii imeghairiwa na dereva au msafiri. Asante kwa kufuatilia."}
                </p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-all"
              >
                Nenda Mwanzo
              </button>
            </div>
          </div>
        )}

        {step === "timeout" && (
          <div className="absolute inset-0 z-[100] bg-[#0a0a0f] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-8 border border-red-500/30">
              <CloseX className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-[#f0eeff] mb-4">
              Hakuna Dereva Karibu Nawe Sasa Hivi
            </h2>
            <p className="text-[#6b6b8a] text-sm font-bold mb-12">
              Samahani, madereva wetu wote wako mbali kwa sasa. Tafadhali jaribu
              tena baada ya muda mfupi.
            </p>

            <div className="w-full space-y-4">
              <button
                onClick={handleRetry}
                className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform"
              >
                Jaribu Tena
              </button>
              <button
                onClick={() => {
                  setStep("map");
                  setRideId(null);
                }}
                className="w-full text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest py-4 transition-colors hover:text-[#f0eeff]"
              >
                Ghairi
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spectator Loading Overlay for Guest Viewers */}
      <AnimatePresence>
        {isSpectator && !activeRide && (
          <motion.div
            key="spectator-loading"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-6 left-6 right-6 z-[120] bg-[#0A0C14]/95 backdrop-blur-[20px] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center font-sans pointer-events-auto"
          >
            <Loader2 className="w-8 h-8 text-[#00E5A0] animate-spin mb-3" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">
              INAPAKIA SAFARI...
            </h3>
            <p className="text-[10px] text-[#8a8fa8] font-bold uppercase tracking-widest leading-relaxed">
              Tunaunganisha kwenye safari ya mshiriki wako kwa njia ya setilaiti
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isChatOpen && activeRide && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-x-0 bottom-0 top-[72px] z-[200] bg-[#0a0a0f] p-4 pt-12"
          >
            <button
              onClick={() => setIsChatOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-[#111118] border border-[#1e1e2e] rounded-xl flex items-center justify-center z-[210] active:scale-95 transition-transform"
            >
              <CloseX className="w-6 h-6 text-[#f0eeff]" />
            </button>
            <Chat onBack={() => setIsChatOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gharama ya Uwazi Breakdown Modal */}
      <AnimatePresence>
        {showBreakdownModal && (
          <div className="absolute inset-0 z-[250] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-sm bg-[#0E0E18] border border-white/10 rounded-[32px] p-6 text-white overflow-y-auto max-h-[85vh] shadow-[0_-10px_40px_rgba(0,0,0,0.8)] no-scrollbar space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#7F77DD]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Gharama ya Uwazi</h3>
                </div>
                <button
                  onClick={() => setShowBreakdownModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white"
                >
                  <CloseX className="w-4 h-4" />
                </button>
              </div>

              {/* General Trip Info */}
              <div className="bg-[#141424] p-3.5 rounded-2xl flex justify-around text-center border border-white/5">
                <div>
                  <p className="text-[9px] text-[#8a8ab0] uppercase font-black tracking-wider">Mji & Vigezo</p>
                  <p className="text-xs font-black text-[#7F77DD] mt-1 uppercase">{selectedCity}</p>
                </div>
                <div className="w-[1px] bg-white/5" />
                <div>
                  <p className="text-[9px] text-[#8a8ab0] uppercase font-black tracking-wider">Muda wa Safari</p>
                  <p className="text-xs font-black text-white mt-1">
                    {destination ? `${Math.ceil((totalDuration || 300) / 60)} DK` : "Simulasi (10 DK)"}
                  </p>
                </div>
                {waitingTime > 0 && (
                  <>
                    <div className="w-[1px] bg-white/5" />
                    <div>
                      <p className="text-[9px] text-amber-400 uppercase font-black tracking-wider">Subira</p>
                      <p className="text-xs font-black text-amber-400 mt-1">{waitingTime} DK</p>
                    </div>
                  </>
                )}
              </div>

              {/* Ride Options Breakdowns - KWA USAFIRI HUSIKA ULIOCHAGULIWA TU */}
              <div className="space-y-4">
                {rideOptions
                  .filter((ride) => ride.id === (selectedRide?.id || "mini"))
                  .map((ride) => {
                  const id = ride.id;
                  const vehicleConfig = config?.vehicles?.[id];
                  
                  // Same pricing computation as getDynamicPrice
                  const isPreRoute = !destination || !totalDistance || totalDistance <= 0;
                  const distKm = isPreRoute ? 3.0 : totalDistance / 1000;
                  const durMins = isPreRoute ? 10 : Math.ceil((totalDuration || 300) / 60) || 1;

                  // Load dynamic pricing rules for the selected city
                  const rules = getPricingRules();
                  const cityData = rules[selectedCity] || rules["Dar es Salaam"];

                  // Base rates matching city/vehicle configs or custom fields
                  const rId = id;
                  const cityRates = cityData?.rates?.[rId] || {
                    baseFare: vehicleConfig?.baseFare !== undefined ? Number(vehicleConfig.baseFare) : (rId === 'mini' ? 1000 : rId === 'bajaj' ? 500 : 300),
                    pricePerKm: vehicleConfig?.pricePerKm !== undefined ? Number(vehicleConfig.pricePerKm) : (rId === 'mini' ? 800 : rId === 'bajaj' ? 500 : 350),
                    pricePerMin: vehicleConfig?.pricePerMin !== undefined ? Number(vehicleConfig.pricePerMin) : (rId === 'mini' ? 100 : 0),
                    waitingRate: rId === 'mini' ? 120 : rId === 'bajaj' ? 50 : 30,
                    surgeRush: 1.25,
                    surgeRain: 1.5
                  };

                  const baseFare = cityRates.baseFare;
                  const pricePerKm = cityRates.pricePerKm;
                  const pricePerMin = cityRates.pricePerMin;

                  const kmCost = distKm * pricePerKm;
                  const minCost = durMins * pricePerMin;

                  const waitingRate = cityRates.waitingRate !== undefined ? cityRates.waitingRate : (rId === "mini" ? 120 : rId === "bajaj" ? 50 : 30);
                  const waitingCost = waitingTime * waitingRate;

                  // Surge factor
                  let surgeMultiplier = 1.0;
                  if (surgeLevel === "rush") {
                    surgeMultiplier = cityRates.surgeRush !== undefined ? cityRates.surgeRush : 1.25;
                  } else if (surgeLevel === "rain") {
                    surgeMultiplier = cityRates.surgeRain !== undefined ? cityRates.surgeRain : 1.5;
                  }

                  const nm = cityData?.nightMultiplier !== undefined ? Number(cityData.nightMultiplier) : 1.15;
                  const taxRate = cityData?.taxActive !== false && cityData?.taxRate > 0 ? Number(cityData.taxRate) : 0;

                  return (
                    <div 
                      key={ride.id} 
                      className="p-5 rounded-3xl bg-gradient-to-b from-[#141426] to-[#0D0D17] border border-indigo-500/30 shadow-[0_0_25px_rgba(127,119,221,0.2)] space-y-4"
                    >
                      {/* Hero card badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                            Mchanganuo Halisi wa {ride.name}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-neutral-400">0% Gharama Zilizojificha</span>
                      </div>

                      {/* Vehicle summary header */}
                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                            {ride.imageUrl ? (
                              <img src={ride.imageUrl} className="w-10 h-10 object-contain drop-shadow" referrerPolicy="no-referrer" alt={ride.name} />
                            ) : (
                              <span className="text-xl">{ride.image || (id === 'mini' ? '🚗' : id === 'bajaj' ? '🛺' : '🏍️')}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-wide text-white">{ride.name}</h4>
                            <p className="text-[9px] text-indigo-300 font-bold uppercase">{ride.sub} • Abiria {ride.capacity}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-neutral-400 uppercase font-black tracking-wider">Jumla ya Gharama</p>
                          <span className="text-base font-black text-emerald-400">
                            TZS {ride.price.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Breakdown Rows */}
                      <div className="space-y-2 text-xs text-neutral-300 font-medium">
                        {/* Base Fare */}
                        <div className="flex justify-between items-center bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                          <span className="text-neutral-300 font-semibold">1. Kuanza Safari (Base Fare):</span>
                          <span className="font-bold text-white">TZS {Math.round(baseFare).toLocaleString()}</span>
                        </div>

                        {/* Distance Cost */}
                        <div className="flex justify-between items-center bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                          <span className="text-neutral-300 font-semibold">
                            2. Kilometa ({distKm.toFixed(1)} KM × {Math.round(pricePerKm)} TZS):
                          </span>
                          <span className="font-bold text-white">TZS {Math.round(kmCost).toLocaleString()}</span>
                        </div>

                        {/* Duration Cost */}
                        <div className="flex justify-between items-center bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                          <span className="text-neutral-300 font-semibold">
                            3. Muda njiani ({durMins} Dk × {pricePerMin} TZS):
                          </span>
                          {pricePerMin === 0 ? (
                            <span className="text-[9px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full font-black uppercase">
                              Trafiki Bure 🎉 (0 TZS)
                            </span>
                          ) : (
                            <span className="font-bold text-white">TZS {Math.round(minCost).toLocaleString()}</span>
                          )}
                        </div>

                        {/* Waiting Time Cost (Muda wa Subira) */}
                        {waitingTime > 0 && (
                          <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-300">
                            <span className="font-semibold">4. Subira ({waitingTime} Dk × {waitingRate} TZS):</span>
                            <span className="font-bold">+ TZS {waitingCost.toLocaleString()}</span>
                          </div>
                        )}

                        {/* Code for City Taxes */}
                        {taxRate > 0 && (
                          <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-300">
                            <span className="font-semibold">Tozo/Kodi ({cityData.taxName || "Kodi"} - {taxRate}%):</span>
                            <span className="font-bold">Imejumuishwa</span>
                          </div>
                        )}

                        {/* Surcharges info row */}
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                          {isNightSurcharge && (
                            <span className="text-[9px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                              Usiku ({nm}x Nomino)
                            </span>
                          )}
                          {surgeLevel !== "normal" && (
                            <span className="text-[9px] text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                              Uhitaji Surcharge ({surgeMultiplier}x)
                            </span>
                          )}
                          <span className="text-[9px] text-neutral-300 bg-white/10 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                            Mji: {selectedCity}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informative Swahili explanation of why it is different */}
              <div className="bg-[#141424] border border-[#7F77DD]/30 p-4 rounded-2.5xl space-y-1.5">
                <h4 className="text-[10px] font-black text-[#7F77DD] uppercase tracking-wide">💡 UWIANO WA HAKI ZA PAPO HAPO:</h4>
                <p className="text-[10px] text-neutral-200 leading-relaxed font-semibold">
                  Sisi ni waigizaji kulingana na miji mbalimbali nchini Tanzania. <strong>Dar es Salaam</strong> ina nauli ya kawaida, <strong>Arusha</strong> imeongezwa kutokana na milima, huku miji ya <strong>Dodoma</strong> na <strong>Mwanza</strong> ikileta unafuu zaidi! Pia kwa Pikipiki na Bajaji, <strong>hutozwi hela ya foleni</strong> hata kidogo!
                </p>
              </div>

              <button
                onClick={() => setShowBreakdownModal(false)}
                className="w-full py-4 bg-gradient-to-r from-[#7F77DD] to-[#6056d6] hover:from-[#6d64d1] hover:to-[#5349c2] text-white rounded-2.5xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                FUNGA MCHANGANUO NA ENDELEA
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PASSENGER SELECTION MODAL */}
      <AnimatePresence>
        {showPassengerModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPassengerModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white border border-neutral-200 shadow-2xl rounded-[28px] p-6 overflow-hidden z-10 flex flex-col gap-5"
            >
              {passengerStep === 'who' ? (
                <>
                  <div className="text-center relative">
                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] mb-0.5">
                      Nani Anasafiri?
                    </h3>
                    <h2 className="text-sm font-black text-neutral-800 uppercase tracking-wider">
                      Who will be seated?
                    </h2>
                    
                    <button
                      onClick={() => setShowPassengerModal(false)}
                      className="absolute right-0 top-0 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      <CloseX className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 gap-3.5 my-1">
                    {/* Someone Else Option */}
                    <button
                      onClick={() => {
                        setPassengerType('someone_else');
                        const defaultName = profile?.displayName || auth.currentUser?.displayName || "";
                        let defaultPhone = profile?.phoneNumber || "";
                        if (defaultPhone.startsWith("+255")) {
                          defaultPhone = defaultPhone.slice(4);
                        } else if (defaultPhone.startsWith("255")) {
                          defaultPhone = defaultPhone.slice(3);
                        }
                        if (passengerName === defaultName) setPassengerName('');
                        if (passengerPhone === defaultPhone) setPassengerPhone('');
                        setPassengerStep('details');
                      }}
                      className={`p-4 rounded-2.5xl border-2 transition-all flex flex-col items-center gap-2.5 group relative cursor-pointer ${
                        passengerType === 'someone_else'
                          ? "bg-indigo-50/60 border-indigo-600 shadow-sm scale-[1.02]"
                          : "bg-white border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                        passengerType === 'someone_else'
                          ? "bg-indigo-600 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        <UserPlus className="w-6 h-6" />
                      </div>
                      
                      <div className="text-center">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${
                          passengerType === 'someone_else' ? "text-indigo-600" : "text-neutral-500"
                        }`}>
                          Mtu Mwingine
                        </p>
                        <p className="text-[8.5px] text-neutral-400 font-bold mt-0.5">
                          Someone Else
                        </p>
                      </div>

                      {passengerType === 'someone_else' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>

                    {/* You Option */}
                    <button
                      onClick={() => {
                        setPassengerType('you');
                        const defaultName = profile?.displayName || auth.currentUser?.displayName || "Mteja";
                        let defaultPhone = profile?.phoneNumber || "";
                        if (defaultPhone.startsWith("+255")) {
                          defaultPhone = defaultPhone.slice(4);
                        } else if (defaultPhone.startsWith("255")) {
                          defaultPhone = defaultPhone.slice(3);
                        }
                        
                        setPassengerName(passengerName || defaultName);
                        setPassengerPhone(passengerPhone || defaultPhone);
                        setShowPassengerModal(false);
                        confirmBooking();
                      }}
                      className={`p-4 rounded-2.5xl border-2 transition-all flex flex-col items-center gap-2.5 group relative cursor-pointer ${
                        passengerType === 'you'
                          ? "bg-emerald-50 border-emerald-500 shadow-sm scale-[1.02]"
                          : "bg-white border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                        passengerType === 'you'
                          ? "bg-emerald-500 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        <User className="w-6 h-6" />
                      </div>

                      <div className="text-center">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${
                          passengerType === 'you' ? "text-emerald-600" : "text-neutral-500"
                        }`}>
                          Wewe
                        </p>
                        <p className="text-[8.5px] text-neutral-400 font-bold mt-0.5">
                          You
                        </p>
                      </div>

                      {passengerType === 'you' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  </div>

                  <p className="text-[9px] text-neutral-500 font-semibold text-center leading-normal px-2">
                    Confirm the customer & make sure the trip information / Thibitisha mteja na uhakikishe taarifa za safari
                  </p>

                  <button
                    onClick={() => {
                      if (passengerType === 'you') {
                        const defaultName = profile?.displayName || auth.currentUser?.displayName || "Mteja";
                        let defaultPhone = profile?.phoneNumber || "";
                        if (defaultPhone.startsWith("+255")) {
                          defaultPhone = defaultPhone.slice(4);
                        } else if (defaultPhone.startsWith("255")) {
                          defaultPhone = defaultPhone.slice(3);
                        }
                        
                        setPassengerName(passengerName || defaultName);
                        setPassengerPhone(passengerPhone || defaultPhone);
                        setShowPassengerModal(false);
                        confirmBooking();
                      } else {
                        const defaultName = profile?.displayName || auth.currentUser?.displayName || "";
                        let defaultPhone = profile?.phoneNumber || "";
                        if (defaultPhone.startsWith("+255")) {
                          defaultPhone = defaultPhone.slice(4);
                        } else if (defaultPhone.startsWith("255")) {
                          defaultPhone = defaultPhone.slice(3);
                        }

                        if (passengerName === defaultName) {
                          setPassengerName('');
                        }
                        if (passengerPhone === defaultPhone) {
                          setPassengerPhone('');
                        }
                        setPassengerStep('details');
                      }
                    }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    Next / Endelea
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center relative">
                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] mb-0.5">
                      {passengerType === 'you' ? "Taarifa Zako" : "Taarifa za Msafiri"}
                    </h3>
                    <h2 className="text-sm font-black text-neutral-800 uppercase tracking-wider">
                      {passengerType === 'you' ? "Verify Your Details" : "Ride Information"}
                    </h2>
                    
                    <button
                      onClick={() => setPassengerStep('who')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                      title="Rudi Nyuma"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Input Fields */}
                  <div className="flex flex-col gap-3.5 my-1">
                    {/* Name Input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8.5px] font-black uppercase text-neutral-500 tracking-wider pl-1">
                        {passengerType === 'you' ? "Jina Lako / Your Name" : "Jina la Msafiri / Passenger Name"}
                      </label>
                      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 flex items-center gap-3 focus-within:border-indigo-500/50 transition-colors">
                        <User className="w-4 h-4 text-neutral-400" />
                        <input
                          type="text"
                          value={passengerName}
                          onChange={(e) => setPassengerName(e.target.value)}
                          placeholder="Andika Jina / Enter Name..."
                          className="bg-transparent text-xs font-black text-neutral-800 w-full outline-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>

                    {/* Contact Number Input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8.5px] font-black uppercase text-neutral-500 tracking-wider pl-1">
                        {passengerType === 'you' ? "Namba Yako ya Simu / Your Number" : "Namba ya Simu / Contact Number"}
                      </label>
                      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 flex items-center gap-3 focus-within:border-indigo-500/50 transition-colors">
                        <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-neutral-200 select-none">
                          <span className="text-xs">🇹🇿</span>
                          <span className="text-xs font-black text-neutral-500">+255</span>
                        </div>
                        <input
                          type="tel"
                          value={passengerPhone}
                          onChange={(e) => setPassengerPhone(e.target.value)}
                          placeholder="Andika Namba / Enter Contact..."
                          className="bg-transparent text-xs font-black text-neutral-800 w-full outline-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Selected Ride & Payment Method Preview */}
                  {selectedRide && (
                    <div className="bg-neutral-100 dark:bg-neutral-800/80 p-3 rounded-2xl flex items-center justify-between text-xs border border-neutral-200/60 dark:border-neutral-700">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{selectedRide.image || '🚗'}</span>
                        <div>
                          <p className="font-black text-[11px] uppercase text-neutral-800 dark:text-neutral-200">{selectedRide.name}</p>
                          <p className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-semibold">
                            {paymentMethod === 'cash' ? '💵 Pesa Taslimu' : paymentMethod === 'mobile_money' ? `📱 ${selectedMobileOperator === 'mpesa' ? 'Vodacom M-Pesa' : selectedMobileOperator === 'tigopesa' ? 'Tigo Pesa' : selectedMobileOperator === 'airtel' ? 'Airtel Money' : 'HaloPesa'}` : paymentMethod === 'wallet' ? '👛 Papo Mkoba' : '💳 Kadi ya Benki'}
                          </p>
                        </div>
                      </div>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                        TZS {selectedRide.price.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <p className="text-[9px] text-neutral-500 font-semibold text-center leading-normal px-2">
                    {passengerType === 'you'
                      ? "Hakikisha jina na namba yako ya simu ni sahihi ili dereva akupigie simu pindi akifika."
                      : "Msafiri atapokea maelezo ya gari na dereva kwa njia ya ujumbe (SMS)."}
                  </p>

                  <button
                    onClick={() => {
                      if (!passengerName.trim()) {
                        toast.error(passengerType === 'you' ? "Tafadhali andika jina lako! 👤" : "Tafadhali andika jina la msafiri! 👤");
                        return;
                      }
                      if (!passengerPhone.trim()) {
                        toast.error(passengerType === 'you' ? "Tafadhali andika namba yako ya simu! 📞" : "Tafadhali andika namba ya simu ya msafiri! 📞");
                        return;
                      }
                      setShowPassengerModal(false);
                      confirmBooking();
                    }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md"
                  >
                    Done / Thibitisha
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}

        {/* Modern Share Papo Hapo / Earn TZS 1,000 Referral & Voucher Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={`w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border max-h-[90dvh] overflow-y-auto space-y-5 ${
                theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-xl font-bold border border-emerald-500/20">
                    🎁
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                      Share Papo Hapo • Zawadi
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase">
                        TZS 1,000
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-semibold">
                      Alika marafiki na ujipatie vocha ya punguzo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 flex items-center justify-center active:scale-95 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Highlight Promo Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg space-y-2 relative overflow-hidden">
                <div className="absolute -right-2 -bottom-2 text-6xl opacity-15 pointer-events-none select-none">
                  🎁
                </div>
                <span className="text-[9px] font-black uppercase bg-amber-400 text-neutral-950 px-2.5 py-0.5 rounded-full tracking-wider">
                  Ofa ya Mwaliko
                </span>
                <h4 className="text-sm sm:text-base font-black leading-snug">
                  Jipatie Vocha ya TZS 1,000 kwa kila rafiki anayesafiri!
                </h4>
                <p className="text-xs text-emerald-100 leading-relaxed font-medium">
                  Rafiki yako anapata <strong className="text-white font-black">punguzo la TZS 1,000</strong> kwenye safari yake ya kwanza, na wewe unazawadiwa <strong className="text-white font-black">TZS 1,000</strong> kwenye pochi yako ya Papo Hapo mara moja!
                </p>
              </div>

              {/* Referral Code Box */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                  Kodi Yako ya Mwaliko (Referral Code)
                </label>
                <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black tracking-widest text-emerald-600 dark:text-emerald-400 animate-rubberBand">
                      PAPO-TZ1000
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText("PAPO-TZ1000");
                      toast.success("Kodi ya mwaliko 'PAPO-TZ1000' imenakiliwa! 📋");
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Nakili</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const text = `Habari! Tumia huduma ya usafiri wa Papo Hapo (Bodaboda, Bajaj & Teksi) na upate punguzo la TZS 1,000 kwenye safari yako ya kwanza kwa kutumia kodi yangu: PAPO-TZ1000. Fungua hapa: ${window.location.origin}`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                    window.open(whatsappUrl, '_blank');
                    toast.success("Inafungua WhatsApp kushiriki mwaliko... 💬");
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Shiriki WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const text = `Habari! Tumia huduma ya usafiri wa Papo Hapo (Bodaboda, Bajaj & Teksi) na upate punguzo la TZS 1,000 kwenye safari yako ya kwanza kwa kutumia kodi yangu: PAPO-TZ1000. Fungua hapa: ${window.location.origin}`;
                    if (navigator.share) {
                      navigator.share({
                        title: 'Papo Hapo - Usafiri Haraka & Nafuu',
                        text: text,
                        url: window.location.origin,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(text);
                      toast.success("Ujumbe wa mwaliko umenakiliwa! Shiriki sasa hivi na marafiki 🎁");
                    }
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Njia Nyingine (Share)</span>
                </button>
              </div>

              {/* Benefits breakdown */}
              <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                theme === 'dark' ? 'bg-neutral-900/50 border-neutral-800/80 text-neutral-300' : 'bg-neutral-50/80 border-neutral-200/60 text-neutral-700'
              }`}>
                <p className="font-bold text-[10.5px] uppercase tracking-wider text-neutral-400">Jinsi Inavyofanya Kazi:</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-500 font-black">1.</span>
                  <span>Tuma kodi au kiunganishi chako kwa marafiki na familia.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-500 font-black">2.</span>
                  <span>Rafiki akipanda safari yake ya kwanza, anapata punguzo la TZS 1,000.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-500 font-black">3.</span>
                  <span>Unapokea vocha ya TZS 1,000 ya papo hapo kutumia kwenye Bodaboda au Teksi!</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Addresses Modal (Maeneo Yangu) */}
      <SavedAddressesModal
        isOpen={showSavedAddressesModal}
        onClose={() => setShowSavedAddressesModal(false)}
        onSelectAddress={handleSelectSavedAddress}
        userId={user?.uid}
        currentLocationName={pickup}
        currentLocationCoords={pickupPos}
      />

      {/* Favorite Drivers Modal (Madereva Ninaowapenda) */}
      <FavoriteDriversModal
        isOpen={showFavoriteDriversModal}
        onClose={() => setShowFavoriteDriversModal(false)}
        onSelectDriverForBooking={handleSelectDriverForBooking}
        userId={user?.uid}
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { font-family: inherit; }
        .custom-div-icon { background: none; border: none; }
      `}</style>
    </div>
  );
}
