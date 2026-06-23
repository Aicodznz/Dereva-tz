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
import {
  ArrowLeft,
  Home,
  MapPin,
  Search,
  Navigation2,
  Clock,
  Star,
  ChevronRight,
  X as CloseX,
  Phone,
  MessageSquare,
  Car,
  Activity,
  ShieldCheck,
  User,
  Users,
  CheckCircle2,
  DollarSign,
  Zap,
  Layers,
  Trophy,
  ArrowRight,
  RefreshCw,
  RotateCw,
  Sun,
  Moon,
  Trash2,
  Loader2,
  Calculator,
  Map,
  Compass,
} from "lucide-react";
import { useTheme } from "next-themes";
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

// --- SCREENS ---
import { SearchingScreen } from "./tegex/SearchingScreen";
import { DriverFoundScreen } from "./tegex/DriverFoundScreen";
import { DriverArrivedScreen } from "./tegex/DriverArrivedScreen";
import { LiveTripScreen } from "./tegex/LiveTripScreen";
import { TripCompleteScreen } from "./tegex/TripCompleteScreen";
import { RatingScreen } from "./tegex/RatingScreen";
import { AnimatedRoute } from "./map/AnimatedRoute";
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
  const addr = result.address;

  if (!addr && result.display_name) {
    const parts = result.display_name.split(",");
    if (parts.length > 2) {
      return parts.slice(0, 2).map((p: string) => p.trim()).join(", ");
    }
    return result.display_name;
  }

  if (!addr) return result.display_name || "Eneo Halijapatikana";

  let primary =
    addr.shop ||
    addr.amenity ||
    addr.building ||
    addr.office ||
    addr.tourism ||
    addr.point_of_interest ||
    addr.house_number;
  let secondary = addr.road || addr.suburb || addr.neighbourhood;
  let tertiary = addr.city || addr.town || addr.village || addr.county;

  let label = "";
  if (primary && secondary) {
    label = `${primary}, ${secondary}`;
  } else if (primary) {
    label = primary;
  } else if (secondary && tertiary) {
    label = `${secondary}, ${tertiary}`;
  } else if (secondary) {
    label = secondary;
  } else {
    label = tertiary || result.display_name || "Unknown Location";
  }

  if ((label === "Unknown Location" || label === "Eneo Halijapatikana") && result.display_name) {
    const parts = result.display_name.split(",");
    if (parts.length > 2) {
      return parts.slice(0, 2).map((p: string) => p.trim()).join(", ");
    }
    return result.display_name;
  }

  return label.length > 35 ? label.substring(0, 32) + "..." : label;
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

const MapControl = ({
  position,
  step,
  targetPos,
  autoFollow,
  routeCoords,
  isMapFullscreen,
}: {
  position: [number, number];
  step: string;
  targetPos?: [number, number];
  autoFollow: boolean;
  routeCoords?: [number, number][];
  isMapFullscreen?: boolean;
}) => {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);
  const lastRouteHash = useRef<string>("");

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
      if (routeCoords && routeCoords.length > 1) {
        const hash = routeCoords.map((c) => `${c[0]},${c[1]}`).join("|").slice(0, 500) + `_${containerResizedCount}`;
        if (lastRouteHash.current !== hash) {
          lastRouteHash.current = hash;
          try {
            map.invalidateSize({ animate: false });
            const bounds = L.latLngBounds(routeCoords);
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
      } else if (position) {
        const posKey = `${position[0]},${position[1]}_${containerResizedCount}`;
        if (lastSinglePosRef.current !== posKey) {
          lastSinglePosRef.current = posKey;
          map.setView(position, map.getZoom() || 15, { animate: true, duration: 0.8 });
        }
      }
    }
  }, [step, routeCoords, position, map, containerResizedCount]);

  useEffect(() => {
    if (!position || !autoFollow) return;

    // Separate full route fits from dynamic follow center
    if (step === "map") return;

    const currentPos = L.latLng(position[0], position[1]);
    const lastPos = lastCenterRef.current
      ? L.latLng(lastCenterRef.current[0], lastCenterRef.current[1])
      : null;

    // Transition tracking key - include loading state to re-fit when real driver position registers!
    const isFallback = targetPos && position[0] === targetPos[0] && position[1] === targetPos[1];
    const trackingKey = `${step}_${isFallback ? "fallback" : "active"}_${targetPos?.[0] || 0}_${targetPos?.[1] || 0}_${containerResizedCount}`;

    // Fit bounds only once when we first enter this booking step
    if (
      ["arriving", "on_trip", "found"].includes(step) &&
      targetPos &&
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

    // Only update tracker view if position changed significantly (e.g., more than 10 meters)
    if (!lastPos || currentPos.distanceTo(lastPos) > 10) {
      map.panTo(position, { animate: true, duration: 0.8 });
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

export default function TaxiBooking() {
  const { user, profile, signInGuest, loading } = useAuth();
  const { config } = useBusinessConfig();
  const navigate = useNavigate();
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState<BookingStep>("map");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [settingMode, setSettingMode] = useState<"pickup" | "destination">(
    "pickup",
  );
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Dar es Salaam");
  const [isNightSurcharge, setIsNightSurcharge] = useState(false);
  const [surgeLevel, setSurgeLevel] = useState("normal"); // "normal", "rush", "rain"
  const [waitingTime, setWaitingTime] = useState(0); // minutes
  const [secondsOffset, setSecondsOffset] = useState<number>(0);
  const justSelectedRef = useRef(false);

  const [rideId, setRideId] = useState<string | null>(null);
  const { ride: activeRide, cancelRide, deleteRide } = useTripFlow(rideId);

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
    return lat >= -12.0 && lat <= -1.0 && lng >= 29.0 && lng <= 41.5;
  };

  const theme = resolvedTheme === "light" ? "light" : "dark";

  const mapTileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const getNearestPopularPlace = (lat: number, lng: number): string => {
    let nearestName = "Mwai Kibaki Road, Dar es Salaam";
    let minDistance = Infinity;
    
    const places = [
      { display_name: "Kariakoo, Dar es Salaam", lat: -6.82, lon: 39.278 },
      { display_name: "Posta, Dar es Salaam", lat: -6.8164, lon: 39.2902 },
      { display_name: "Mwenge, Dar es Salaam", lat: -6.7681, lon: 39.2274 },
      { display_name: "Sinza, Dar es Salaam", lat: -6.7812, lon: 39.2223 },
      { display_name: "Masaki, Dar es Salaam", lat: -6.7441, lon: 39.2812 },
      { display_name: "Mikocheni, Dar es Salaam", lat: -6.7645, lon: 39.2492 },
      { display_name: "Ubungo Bus Terminal, Dar es Salaam", lat: -6.7961, lon: 39.2155 },
      { display_name: "Mbezi Luis, Dar es Salaam", lat: -6.7831, lon: 39.1952 },
      { display_name: "Kinondoni, Dar es Salaam", lat: -6.7952, lon: 39.2631 },
      { display_name: "Temeke, Dar es Salaam", lat: -6.855, lon: 39.265 },
      { display_name: "Kigamboni, Dar es Salaam", lat: -6.825, lon: 39.31 },
      { display_name: "Ilala, Dar es Salaam", lat: -6.827, lon: 39.262 },
      { display_name: "Gerezani, Dar es Salaam", lat: -6.8239, lon: 39.2797 },
      { display_name: "Oysterbay, Dar es Salaam", lat: -6.7725, lon: 39.2789 },
      { display_name: "Msasani, Dar es Salaam", lat: -6.7561, lon: 39.2741 },
      { display_name: "Tabata, Dar es Salaam", lat: -6.819, lon: 39.215 },
      { display_name: "Segerea, Dar es Salaam", lat: -6.84, lon: 39.19 },
      { display_name: "Kawe, Dar es Salaam", lat: -6.7389, lon: 39.2558 },
      { display_name: "Tegeta, Dar es Salaam", lat: -6.685, lon: 39.214 },
      { display_name: "Kunduchi, Dar es Salaam", lat: -6.669, lon: 39.219 },
      { display_name: "Kibamba, Dar es Salaam", lat: -6.79, lon: 39.11 },
      { display_name: "Kimara, Dar es Salaam", lat: -6.792, lon: 39.167 },
      { display_name: "Kisutu, Dar es Salaam", lat: -6.814, lon: 39.287 },
      { display_name: "Upanga, Dar es Salaam", lat: -6.804, lon: 39.28 },
      { display_name: "Mbagala, Dar es Salaam", lat: -6.891, lon: 39.269 },
      { display_name: "Chanika, Dar es Salaam", lat: -6.91, lon: 39.08 },
      { display_name: "Kivukoni Ferry, Dar es Salaam", lat: -6.821, lon: 39.299 },
      { display_name: "Boko, Dar es Salaam", lat: -6.649, lon: 39.191 },
      { display_name: "Bunju, Dar es Salaam", lat: -6.611, lon: 39.166 },
      { display_name: "Julius Nyerere Airport (JNIA), Dar es Salaam", lat: -6.8781, lon: 39.2026 },
      { display_name: "Tazara, Dar es Salaam", lat: -6.843, lon: 39.241 },
      { display_name: "Morocco, Dar es Salaam", lat: -6.7885, lon: 39.2604 },
      { display_name: "Tandika, Dar es Salaam", lat: -6.858, lon: 39.259 },
      { display_name: "Buguruni, Dar es Salaam", lat: -6.828, lon: 39.245 },
      { display_name: "Vingunguti, Dar es Salaam", lat: -6.842, lon: 39.218 },
      { display_name: "Kijitonyama, Dar es Salaam", lat: -6.778, lon: 39.245 },
      { display_name: "Makumbusho, Dar es Salaam", lat: -6.776, lon: 39.241 },
      { display_name: "Coco Beach, Dar es Salaam", lat: -6.765, lon: 39.294 },
      { display_name: "The Slipway, Oysterbay, Dar es Salaam", lat: -6.749, lon: 39.284 },
      { display_name: "Mlimani City Mall, Dar es Salaam", lat: -6.7722, lon: 39.2241 },
      { display_name: "Karume, Dar es Salaam", lat: -6.8202, lon: 39.2612 },
      { display_name: "Machinga Complex, Dar es Salaam", lat: -6.8218, lon: 39.2598 },
      { display_name: "Kigogo, Dar es Salaam", lat: -6.807, lon: 39.231 },
      { display_name: "Mabibo, Dar es Salaam", lat: -6.801, lon: 39.211 },
      { display_name: "Manzese, Dar es Salaam", lat: -6.793, lon: 39.217 },
      { display_name: "Keko, Dar es Salaam", lat: -6.837, lon: 39.282 },
      { display_name: "Chang’ombe, Dar es Salaam", lat: -6.841, lon: 39.268 },
      { display_name: "Kurasini, Dar es Salaam", lat: -6.848, lon: 39.289 },
      { display_name: "Dodoma Town Central, Tanzania", lat: -6.1722, lon: 35.7481 },
      { display_name: "Arusha Clock Tower, Tanzania", lat: -3.3731, lon: 36.6857 },
      { display_name: "Mwanza City Centre, Tanzania", lat: -2.5164, lon: 32.9018 },
      { display_name: "Zanzibar Stone Town, Tanzania", lat: -6.1659, lon: 39.199 },
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
      if (!response.ok)
        throw new Error(
          `Reverse geocoding failed with status ${response.status}`,
        );
      const data = await response.json();
      const addr = formatAddress(data);
      if (addr && addr !== "Unknown Area" && addr !== "Eneo Halijapatikana" && addr !== "Unknown Location") {
        return addr;
      }
      throw new Error("Invalid address formatted");
    } catch (error) {
      console.error("Reverse geocoding failed, trying fallback:", error);
      try {
        const bdcResponse = await fetch(
          `/api/geo/bdc-reverse?lat=${lat}&lon=${lng}`,
        );
        if (!bdcResponse.ok) {
          const errorData = await bdcResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || `BDC failed with status ${bdcResponse.status}`,
          );
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
              console.error("Triangulation failed, falling back to IP:", errorLow);
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

  const { routeCoords, totalDistance, totalDuration } = useRouting(
    pickupPos,
    destination ? destPos : [NaN, NaN],
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
    // Only smooth the first coordinate to the driver's exact position if the distance is tiny (within ~50m)
    // 50m correspond to a squared degree distance of approximately 2.0e-7
    if (sliced.length > 0 && minDistance < 2.0e-7) {
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
        setPickupPos([activeRide.pickup.lat, activeRide.pickup.lng]);
        setPickup(activeRide.pickup.address || pickup);
      }
      if (activeRide.destination) {
        setDestPos([activeRide.destination.lat, activeRide.destination.lng]);
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
        setDriverLivePos((prev) => {
          if (!prev) return loc;
          const dist = L.latLng(loc.lat, loc.lng).distanceTo(L.latLng(prev.lat, prev.lng));
          const headingDiff = Math.abs(((loc as any).heading ?? 0) - ((prev as any).heading ?? 0));
          if (dist > 1 || headingDiff > 5) {
            return loc;
          }
          return prev;
        });

        const target =
          activeRide.status === "on_trip"
            ? activeRide.destination
            : activeRide.pickup;
        if (target && target.lat && target.lng) {
          const dist = L.latLng(
            loc.lat,
            loc.lng,
          ).distanceTo(L.latLng(target.lat, target.lng));
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
              setDriverLivePos((prev) => {
                if (!prev) return pos;
                const dist = L.latLng(pos.lat, pos.lng).distanceTo(L.latLng(prev.lat, prev.lng));
                const headingDiff = Math.abs((pos.heading ?? 0) - (prev.heading ?? 0));
                if (dist > 1 || headingDiff > 5) {
                  return pos;
                }
                return prev;
              });
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
          if (minDistance < 300) {
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
      const bearing = (brng + 360) % 360;
      
      driverBearingsRef.current[driverId] = { lat, lng, bearing };
      return bearing;
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
      if (mapMarkerLayout === 'custom_top_down') {
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
          className: "driver-marker-icon-clean-custom-topdown",
          html: `
            <div class="relative flex items-center justify-center pointer-events-none" style="width: 44px; height: 44px;">
              <!-- Gentle micro pulse for premium active visibility -->
              <div class="absolute w-10 h-10 rounded-full bg-[#7F77DD]/10 animate-ping pointer-events-none"></div>
              
              <!-- Map Marker Glowing Halo -->
              <div class="absolute w-8 h-8 rounded-full bg-black/15 blur-[2px] pointer-events-none"></div>
              
              <div class="relative transition-transform duration-500 ease-out" style="transform: rotate(${finalRotation}deg); width: 40px; height: 40px; display: flex; items-center: center; justify-content: center;">
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
          className: "driver-marker-icon-clean-custom",
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
    let markerHtml = "";
    if (type === "bike") {
      markerHtml = `
        <svg viewBox="0 0 100 100" class="w-8 h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] transition-all duration-300">
          <!-- Scooter / Motorcycle chassis -->
          <rect x="42" y="15" width="16" height="70" rx="6" fill="#1e1b4b" />
          <!-- Front wheel fender -->
          <rect x="44" y="5" width="12" height="20" rx="4" fill="#111827" />
          <!-- Handlebars -->
          <rect x="25" y="27" width="50" height="6" rx="3" fill="#374151" />
          <!-- Yellow handlebar grips -->
          <rect x="23" y="25" width="6" height="10" rx="1.5" fill="#f59e0b" />
          <rect x="71" y="25" width="6" height="10" rx="1.5" fill="#f59e0b" />
          <!-- Red main body -->
          <path d="M38,35 C38,32 62,32 62,35 L58,68 C58,74 42,74 42,68 Z" fill="#ef4444" />
          <rect x="44" y="38" width="12" height="24" rx="4" fill="#b91c1c" />
          <!-- Black seat -->
          <rect x="43" y="44" width="14" height="28" rx="7" fill="#111827" />
          <!-- Rear luggage box/carrier -->
          <rect x="41" y="74" width="18" height="16" rx="4" fill="#374151" />
          <!-- Rider Head (Helmet) in the middle -->
          <circle cx="50" cy="46" r="11" fill="#f97316" /> <!-- Orange helmet -->
          <path d="M43,44 C45,39 55,39 57,44" fill="#111827" /> <!-- Visor -->
          <rect x="46" y="86" width="8" height="12" rx="2" fill="#ef4444" /> <!-- Tail light -->
        </svg>
      `;
    } else if (type === "bajaj") {
      markerHtml = `
        <svg viewBox="0 0 100 100" class="w-8 h-8 drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)] transition-all duration-300">
          <!-- Black Wheels -->
          <rect x="18" y="20" width="10" height="20" rx="3" fill="#111827" />
          <rect x="72" y="20" width="10" height="20" rx="3" fill="#111827" />
          <rect x="45" y="75" width="10" height="18" rx="3" fill="#111827" />
          <!-- Yellow Chassis main outer body -->
          <path d="M22,25 C22,12 78,12 78,25 L75,72 C75,78 25,78 25,72 Z" fill="#facc15" />
          <!-- Inside floor cabin black -->
          <rect x="28" y="22" width="44" height="42" rx="4" fill="#1f2937" />
          <!-- Black hard top roof -->
          <path d="M25,28 C25,23 75,23 75,28 L71,64 C71,68 29,68 29,64 Z" fill="#111827" />
          <!-- Front windshield nose -->
          <path d="M35,76 L40,86 C42,90 58,90 60,86 L65,76 Z" fill="#eab308" />
          <rect x="38" y="71" width="24" height="4" rx="2" fill="#e2e8f0" />
          <!-- Side mirrors -->
          <rect x="14" y="65" width="8" height="4" rx="1.5" fill="#374151" />
          <rect x="78" y="65" width="8" height="4" rx="1.5" fill="#374151" />
          <!-- Tail brake lights -->
          <rect x="29" y="16" width="8" height="5" rx="1" fill="#ef4444" />
          <rect x="63" y="16" width="8" height="5" rx="1" fill="#ef4444" />
        </svg>
      `;
    } else {
      markerHtml = `
        <svg viewBox="0 0 100 100" class="w-8 h-8 drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] transition-all duration-300">
          <!-- Side mirrors -->
          <rect x="18" y="42" width="6" height="12" rx="2.5" fill="#94a3b8" />
          <rect x="76" y="42" width="6" height="12" rx="2.5" fill="#94a3b8" />
          <!-- Wheels under the car -->
          <rect x="20" y="20" width="8" height="16" rx="3.5" fill="#111827" />
          <rect x="72" y="20" width="8" height="16" rx="3.5" fill="#111827" />
          <rect x="20" y="66" width="8" height="16" rx="3.5" fill="#111827" />
          <rect x="72" y="66" width="8" height="16" rx="3.5" fill="#111827" />
          <!-- Car body (Silver Slate color) -->
          <rect x="24" y="8" width="52" height="84" rx="25" fill="#cbd5e1" />
          <!-- Glossy metallic highlights -->
          <path d="M28,24 L72,24 M28,76 L72,76" stroke="#94a3b8" stroke-width="2" />
          <!-- Front Windshield -->
          <path d="M30,34 C30,30 70,30 70,34 L68,44 C68,44 32,44 32,44 Z" fill="#1e293b" />
          <!-- Rear Windshield -->
          <path d="M32,68 C32,71 68,71 68,68 L66,75 L34,75 Z" fill="#1e293b" />
          <!-- Black Glass Roof Panel -->
          <rect x="33" y="47" width="34" height="18" rx="2" fill="#0f172a" />
          <!-- Shiny yellow headlights -->
          <rect x="29" y="5" width="8" height="4" rx="1.5" fill="#fef08a" />
          <rect x="63" y="5" width="8" height="4" rx="1.5" fill="#fef08a" />
          <!-- Red break tail lights -->
          <rect x="28" y="91" width="10" height="4" rx="1" fill="#ef4444" />
          <rect x="62" y="91" width="10" height="4" rx="1" fill="#ef4444" />
        </svg>
      `;
    }

    return L.divIcon({
      className: "driver-marker-icon-clean",
      html: `
        <div class="relative flex items-center justify-center transition-transform duration-500 ease-out" style="transform: rotate(${rotation}deg); width: 36px; height: 36px;">
          <!-- Elegant subtle background pulse/sonar radiating of red/orange Papo Hapo theme inside -->
          <div class="absolute w-8 h-8 rounded-full bg-red-500/5 pointer-events-none transition-all duration-1000"></div>
          
          <!-- Render Actual Vehicle Shape -->
          <div class="relative flex items-center justify-center select-none pointer-events-none">
            ${markerHtml}
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  const getStartPin = (etaText: string) => {
    return L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center">
          <!-- Active Pill above marker with premium typography and alignment -->
          ${etaText ? `
          <div class="bg-[#0A0C14]/95 backdrop-blur-md border border-[#00E5A0]/30 rounded-2xl px-3 py-1.5 mb-2 shadow-2xl flex flex-col items-center min-w-[130px]">
            <span class="text-[9px] font-black text-[#00E5A0] uppercase tracking-[0.15em] leading-tight font-heading">PICKUP MTEJA</span>
            <span class="text-[9.5px] font-mono font-bold text-white mt-0.5 whitespace-nowrap">${etaText}</span>
          </div>
          ` : `
          <div class="bg-[#0A0C14]/95 backdrop-blur-md border border-[#00E5A0]/30 rounded-2xl px-3 py-1 mb-1.5 shadow-2xl flex flex-col items-center min-w-[100px]">
            <span class="text-[9px] font-black text-[#00E5A0] uppercase tracking-[0.15em] leading-tight font-heading font-semibold text-center">PICKUP MTEJA</span>
          </div>
          `}
          <!-- Pulse green animating container -->
          <div class="w-9 h-9 bg-[#00E5A0] rounded-full border-4 border-[#0F111E] shadow-2xl flex items-center justify-center font-black text-lg text-[#0F111E] marker-pulse-mint">A</div>
          <div class="w-1.5 h-3 bg-[#00E5A0] rounded-full -mt-0.5 shadow-lg"></div>
        </div>
      `,
      iconSize: [160, 95],
      iconAnchor: [80, 95],
    });
  };

  const getEndPin = (etaText: string) => {
    return L.divIcon({
      className: "custom-div-icon",
      html: `
        <div class="relative flex flex-col items-center">
          <div class="bg-[#0A0C14]/95 backdrop-blur-md border border-[#FF6B35]/30 rounded-2xl px-3 py-1.5 mb-2 shadow-2xl flex flex-col items-center min-w-[160px]">
            <span class="text-[9px] font-black text-[#FF6B35] uppercase tracking-[0.15em] leading-tight font-heading">DESTINATION</span>
            <span class="text-[9.5px] font-mono font-bold text-white mt-0.5 whitespace-nowrap">${etaText}</span>
          </div>
          <div class="w-9 h-9 bg-[#FF6B35] rounded-full border-4 border-[#0F111E] shadow-2xl flex items-center justify-center font-black text-lg text-white">B</div>
          <div class="w-1.5 h-3 bg-[#FF6B35] rounded-full -mt-0.5 shadow-lg animate-bounce"></div>
        </div>
      `,
      iconSize: [180, 95],
      iconAnchor: [90, 95],
    });
  };

  const geocodeAddress = (query: string) => {
    if (searchTimer) clearTimeout(searchTimer);

    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      return;
    }

    const TZ_POPULAR_PLACES = [
      { display_name: "Kariakoo, Dar es Salaam", lat: -6.82, lon: 39.278 },
      { display_name: "Posta, Dar es Salaam", lat: -6.8164, lon: 39.2902 },
      { display_name: "Mwenge, Dar es Salaam", lat: -6.7681, lon: 39.2274 },
      { display_name: "Sinza, Dar es Salaam", lat: -6.7812, lon: 39.2223 },
      { display_name: "Masaki, Dar es Salaam", lat: -6.7441, lon: 39.2812 },
      { display_name: "Mikocheni, Dar es Salaam", lat: -6.7645, lon: 39.2492 },
      {
        display_name: "Ubungo Bus Terminal, Dar es Salaam",
        lat: -6.7961,
        lon: 39.2155,
      },
      { display_name: "Mbezi Luis, Dar es Salaam", lat: -6.7831, lon: 39.1952 },
      { display_name: "Kinondoni, Dar es Salaam", lat: -6.7952, lon: 39.2631 },
      { display_name: "Temeke, Dar es Salaam", lat: -6.855, lon: 39.265 },
      { display_name: "Kigamboni, Dar es Salaam", lat: -6.825, lon: 39.31 },
      { display_name: "Ilala, Dar es Salaam", lat: -6.827, lon: 39.262 },
      { display_name: "Gerezani, Dar es Salaam", lat: -6.8239, lon: 39.2797 },
      { display_name: "Oysterbay, Dar es Salaam", lat: -6.7725, lon: 39.2789 },
      { display_name: "Msasani, Dar es Salaam", lat: -6.7561, lon: 39.2741 },
      { display_name: "Tabata, Dar es Salaam", lat: -6.819, lon: 39.215 },
      { display_name: "Segerea, Dar es Salaam", lat: -6.84, lon: 39.19 },
      { display_name: "Kawe, Dar es Salaam", lat: -6.7389, lon: 39.2558 },
      { display_name: "Tegeta, Dar es Salaam", lat: -6.685, lon: 39.214 },
      { display_name: "Kunduchi, Dar es Salaam", lat: -6.669, lon: 39.219 },
      { display_name: "Kibamba, Dar es Salaam", lat: -6.79, lon: 39.11 },
      { display_name: "Kimara, Dar es Salaam", lat: -6.792, lon: 39.167 },
      { display_name: "Kisutu, Dar es Salaam", lat: -6.814, lon: 39.287 },
      { display_name: "Upanga, Dar es Salaam", lat: -6.804, lon: 39.28 },
      { display_name: "Mbagala, Dar es Salaam", lat: -6.891, lon: 39.269 },
      { display_name: "Chanika, Dar es Salaam", lat: -6.91, lon: 39.08 },
      {
        display_name: "Kivukoni Ferry, Dar es Salaam",
        lat: -6.821,
        lon: 39.299,
      },
      { display_name: "Boko, Dar es Salaam", lat: -6.649, lon: 39.191 },
      { display_name: "Bunju, Dar es Salaam", lat: -6.611, lon: 39.166 },
      {
        display_name: "Julius Nyerere Airport (JNIA), Dar es Salaam",
        lat: -6.8781,
        lon: 39.2026,
      },
      { display_name: "Tazara, Dar es Salaam", lat: -6.843, lon: 39.241 },
      { display_name: "Morocco, Dar es Salaam", lat: -6.7885, lon: 39.2604 },
      { display_name: "Tandika, Dar es Salaam", lat: -6.858, lon: 39.259 },
      { display_name: "Buguruni, Dar es Salaam", lat: -6.828, lon: 39.245 },
      { display_name: "Vingunguti, Dar es Salaam", lat: -6.842, lon: 39.218 },
      { display_name: "Kijitonyama, Dar es Salaam", lat: -6.778, lon: 39.245 },
      { display_name: "Makumbusho, Dar es Salaam", lat: -6.776, lon: 39.241 },
      { display_name: "Coco Beach, Dar es Salaam", lat: -6.765, lon: 39.294 },
      {
        display_name: "The Slipway, Oysterbay, Dar es Salaam",
        lat: -6.749,
        lon: 39.284,
      },
      {
        display_name: "Mlimani City Mall, Dar es Salaam",
        lat: -6.7722,
        lon: 39.2241,
      },
      { display_name: "Karume, Dar es Salaam", lat: -6.8202, lon: 39.2612 },
      {
        display_name: "Machinga Complex, Dar es Salaam",
        lat: -6.8218,
        lon: 39.2598,
      },
      { display_name: "Kigogo, Dar es Salaam", lat: -6.807, lon: 39.231 },
      { display_name: "Mabibo, Dar es Salaam", lat: -6.801, lon: 39.211 },
      { display_name: "Manzese, Dar es Salaam", lat: -6.793, lon: 39.217 },
      { display_name: "Keko, Dar es Salaam", lat: -6.837, lon: 39.282 },
      { display_name: "Chang’ombe, Dar es Salaam", lat: -6.841, lon: 39.268 },
      { display_name: "Kurasini, Dar es Salaam", lat: -6.848, lon: 39.289 },
      {
        display_name: "Dodoma Town Central, Tanzania",
        lat: -6.1722,
        lon: 35.7481,
      },
      {
        display_name: "Arusha Clock Tower, Tanzania",
        lat: -3.3731,
        lon: 36.6857,
      },
      {
        display_name: "Mwanza City Centre, Tanzania",
        lat: -2.5164,
        lon: 32.9018,
      },
      {
        display_name: "Zanzibar Stone Town, Tanzania",
        lat: -6.1659,
        lon: 39.199,
      },
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
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
              errData.error || `Search failed with status ${response.status}`,
            );
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
    const pos: [number, number] = [
      parseFloat(suggestion.lat),
      parseFloat(suggestion.lon),
    ];
    if (settingMode === "pickup") {
      setPickupPos(pos);
      setPickup(suggestion.display_name);
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
    const addr = await reverseGeocode(lat, lng);

    if (settingMode === "pickup") {
      setPickupPos([lat, lng]);
      setPickup(addr);
    } else {
      setDestPos([lat, lng]);
      setDestination(addr);
    }
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
      if (profile?.displayName) {
        customerName = profile.displayName;
      } else if (activeUser.displayName) {
        customerName = activeUser.displayName;
      } else if (activeUser.email) {
        const part = activeUser.email.split("@")[0];
        customerName = part.charAt(0).toUpperCase() + part.slice(1);
      }

      const customerInfo = {
        name: customerName,
        rating: 5.0,
        avatar: profile?.photoURL || activeUser.photoURL || null,
        photo: profile?.photoURL || activeUser.photoURL || undefined,
        phone: profile?.phoneNumber || "",
      };

      const id = await createRide(
        activeUser.uid,
        customerInfo,
        { lat: pickupPos[0], lng: pickupPos[1], address: pickup },
        { lat: destPos[0], lng: destPos[1], address: destination },
        selectedRide.id as any,
        rideOptions.find((r) => r.id === selectedRide.id)?.price || selectedRide.price,
        totalDistance / 1000,
        Math.ceil(totalDuration / 60),
        formattedCoords,
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
          mini: { baseFare: 1000, pricePerKm: 800, pricePerMin: 100, waitingRate: 120, surgeRush: 1.25, surgeRain: 1.5 },
          bajaj: { baseFare: 500, pricePerKm: 500, pricePerMin: 0, waitingRate: 50, surgeRush: 1.15, surgeRain: 1.3 },
          bike: { baseFare: 300, pricePerKm: 350, pricePerMin: 0, waitingRate: 30, surgeRush: 1.1, surgeRain: 1.2 }
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
        taxName: "Tourism Development Tax",
        taxRate: 5,
        taxActive: true,
        rates: {
          mini: { baseFare: 1200, pricePerKm: 880, pricePerMin: 110, waitingRate: 130, surgeRush: 1.3, surgeRain: 1.6 },
          bajaj: { baseFare: 600, pricePerKm: 550, pricePerMin: 0, waitingRate: 55, surgeRush: 1.2, surgeRain: 1.4 },
          bike: { baseFare: 400, pricePerKm: 385, pricePerMin: 0, waitingRate: 35, surgeRush: 1.15, surgeRain: 1.3 }
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
          bike: { baseFare: 270, pricePerKm: 315, pricePerMin: 0, waitingRate: 25, surgeRush: 1.05, surgeRain: 1.15 }
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
          bike: { baseFare: 300, pricePerKm: 332, pricePerMin: 0, waitingRate: 28, surgeRush: 1.1, surgeRain: 1.2 }
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
    const minPrice = vehicleConfig?.price !== undefined ? Number(vehicleConfig.price) : (vehicleId === 'mini' ? 1500 : vehicleId === 'bajaj' ? 800 : 500);
    
    return Math.max(minPrice, rounded);
  };

  const rideOptions: RideOption[] = useMemo(() => {
    const defaultVehicles = {
      mini: { id: "mini", name: "Gari", price: 2800, sub: "Max 4 Siti", image: "🚗", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      bajaj: { id: "bajaj", name: "Bajaji", price: 1500, sub: "3 Siti", image: "🛺", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      bike: { id: "bike", name: "Pikipiki", price: 800, sub: "Usafiri Salama", image: "🏍️", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" }
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
      if (!selectedRide || !rideOptions.some(r => r.id === selectedRide.id)) {
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
        if (distToPickup < 60) {
          etaPickupText = "DEREVA KASHAFIKA!";
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

  if (activeRide) {
    if (activeRide.status === "on_trip") {
      const driverLoc: [number, number] | null = driverLivePos
        ? [driverLivePos.lat, driverLivePos.lng]
        : activeRide.driverLocation
        ? [activeRide.driverLocation.lat, activeRide.driverLocation.lng]
        : null;

      if (driverLoc) {
        const remainingDist = getDistanceLocal(driverLoc, destPos);
        const remainingDurSecs = remainingDist / 9.5; // account for density and road twists
        const realRemainingSecs = Math.max(0, remainingDurSecs - (secondsOffset % 30));
        const minsLeft = Math.floor(realRemainingSecs / 60);
        const secsLeft = Math.floor(realRemainingSecs % 60);
        const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
        etaDestText = `EXPECTED ARRIVE BY ${formatTimeLocal(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
      } else {
        const realRemainingSecs = Math.max(0, tripDurSecs - secondsOffset);
        const minsLeft = Math.floor(realRemainingSecs / 60);
        const secsLeft = Math.floor(realRemainingSecs % 60);
        const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
        etaDestText = `EXPECTED ARRIVE BY ${formatTimeLocal(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
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
      const secsLeft = Math.floor(realRemainingSecs % 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestText = `EXPECTED ARRIVE BY ${formatTimeLocal(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
    } else {
      const realRemainingSecs = Math.max(0, tripDurSecs - secondsOffset);
      const minsLeft = Math.floor(realRemainingSecs / 60);
      const secsLeft = Math.floor(realRemainingSecs % 60);
      const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
      etaDestText = `EXPECTED ARRIVE BY ${formatTimeLocal(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
    }
  } else {
    // Before trip starts (during booking setup / search)
    const realRemainingSecs = Math.max(0, tripDurSecs - secondsOffset);
    const minsLeft = Math.floor(realRemainingSecs / 60);
    const secsLeft = Math.floor(realRemainingSecs % 60);
    const etaTime = new Date(Date.now() + realRemainingSecs * 1000);
    etaDestText = `EXPECTED ARRIVE BY ${formatTimeLocal(etaTime)} (Imebaki dk ${minsLeft} sek ${secsLeft})`;
  }

  return (
    <div className="max-w-md mx-auto bg-green-500/5 w-full flex flex-col relative overflow-hidden font-sans text-[#f0eeff] border-x border-[#1e1e2e] h-[100dvh]">
      <div className="absolute inset-0 bg-[#0a0a0f]" />

      {/* DEBUG FLAG */}
      <div className="hidden">DEBUG_RENDER_ACTIVE_{step}</div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-[#7F77DD]/10 blur-[100px] rounded-full" />
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
                <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-[9999] flex flex-wrap items-center justify-between gap-y-2 pointer-events-none">
                  <button
                    onClick={() => navigate("/")}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-[#111118]/90 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white pointer-events-auto"
                    title="Rudi Nyumbani"
                  >
                    <Home className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <div className="flex gap-1.5 sm:gap-3">
                    <AppDownloadButton variant="compact" className="w-10 h-10 sm:w-12 sm:h-12 bg-[#111118]/90 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white pointer-events-auto" />
                    <button
                      onClick={() => {
                        setIsMapFullscreen(!isMapFullscreen);
                        if (!isMapFullscreen) setAutoFollow(true);
                      }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 ${isMapFullscreen ? "bg-[#7F77DD] text-white" : "bg-[#111118]/90 text-white"} backdrop-blur-xl rounded-xl sm:rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-all pointer-events-auto`}
                      title={isMapFullscreen ? "Onesha Maelezo" : "Ramani tupu"}
                    >
                      {isMapFullscreen ? (
                        <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : (
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                    </button>
                    {!autoFollow && step !== "home" && (
                      <button
                        onClick={() => setAutoFollow(true)}
                        className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1D9E75] text-white backdrop-blur-xl rounded-xl sm:rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-all pointer-events-auto"
                      >
                        <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin-slow" />
                      </button>
                    )}
                    <button
                      onClick={() => navigate("/taxi/history")}
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-[#111118]/90 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white pointer-events-auto"
                    >
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                      onClick={() => setNextTheme(theme === "dark" ? "light" : "dark")}
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-[#111118]/90 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-[#1e1e2e] flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white pointer-events-auto"
                      title={theme === "dark" ? "Badili kwenda mwangaza" : "Badili kwenda giza"}
                    >
                      {theme === "dark" ? (
                        <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                      ) : (
                        <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 2025 African Tech Premium Floating Info Cards */}
                {activeRide && ["found", "arriving", "on_trip"].includes(step) && (
                  <div className="absolute top-24 right-6 left-6 md:left-auto md:w-[320px] z-[9999] flex flex-col gap-3 pointer-events-none animate-fade-in font-sans">
                    {/* Pickup Card - Only visible when the driver is coming to get them */}
                    {activeRide.status !== "on_trip" && (
                      <div className="bg-[#080A12]/85 backdrop-blur-[20px] border border-white/10 rounded-2xl p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden pointer-events-auto">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00E5A0]" />
                        <div className="flex items-center justify-between mb-2 pl-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#00E5A0] animate-ping" />
                            <span className="text-[10px] font-black tracking-[0.15em] text-[#00E5A0] font-heading">🟢 PICKUP MTEJA</span>
                          </div>
                        </div>
                        <div className="h-[1px] w-full bg-white/5 mb-3" />
                        <div className="flex flex-col pl-2">
                          <span className="text-[10px] font-black text-[#8A8FA8] uppercase tracking-[0.08em] mb-1 font-heading">Dereva atakuja baada ya</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xl md:text-2xl font-mono font-black text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 tracking-wider">
                              {(() => {
                                const driverLoc: [number, number] | null = driverLivePos
                                  ? [driverLivePos.lat, driverLivePos.lng]
                                  : activeRide.driverLocation
                                  ? [activeRide.driverLocation.lat, activeRide.driverLocation.lng]
                                  : null;
                                if (driverLoc) {
                                  const distToPickup = getDistanceLocal(driverLoc, pickupPos);
                                  if (distToPickup < 60) {
                                    return "[ ARRIVED ]";
                                  } else {
                                    const durSecs = distToPickup / 6.5; 
                                    const mins = Math.max(0, Math.floor(durSecs / 60));
                                    const secs = Math.max(0, Math.floor(durSecs % 60));
                                    return `[ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} ]`;
                                  }
                                }
                                return "[ 05:00 ]";
                              })()}
                            </span>
                            <span className="text-[9px] font-semibold text-[#8A8FA8] italic">countdown</span>
                          </div>
                          <p className="text-[10px] text-white/70 mt-3 truncate bg-white/5 py-1.5 px-3 rounded-lg border border-white/5 font-sans">
                            Kutoka: <span className="font-semibold text-white">{activeRide.pickup.address}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <style>{`
                  .leaflet-container { 
                    height: 100% !important; 
                    width: 100% !important; 
                    background: ${theme === 'dark' ? '#0a0a0f' : '#ffffff'} !important; 
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
                    touchZoom={true}
                    doubleClickZoom={true}
                    scrollWheelZoom={true}
                    dragging={true}
                  >
                     <TileLayer
                      key={theme}
                      url={mapTileUrl}
                      attribution=""
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
                    />
                    {activeRide?.status !== "on_trip" && (
                      <Marker position={pickupPos} icon={getStartPin(etaPickupText)} />
                    )}
                    {destination && (
                      <Marker position={destPos} icon={getEndPin(etaDestText)} />
                    )}

                    {/* Assigned Driver Marker */}
                    {(driverLivePos || activeRide?.driverLocation) && (() => {
                      const lat = driverLivePos?.lat || activeRide?.driverLocation?.lat || 0;
                      const lng = driverLivePos?.lng || activeRide?.driverLocation?.lng || 0;
                      const heading = (driverLivePos as any)?.heading ?? (activeRide?.driverLocation as any)?.heading;
                      return (
                        <Marker
                          key={`active-driver-${activeRide?.driverId || "presence"}-${lat}-${lng}-${heading || 0}`}
                          position={[lat, lng]}
                          icon={getDriverIcon(activeRide?.vehicleType || "mini", activeRide?.driverId || "active-driver", lat, lng, heading)}
                        />
                      );
                    })()}

                    {/* Nearby Drivers - Only show in map step */}
                    {step === "map" &&
                      drivers
                        .filter(
                          (d) =>
                            (!selectedRide ||
                              d.vehicleType === selectedRide.vehicleType) &&
                            d.id !== activeRide?.driverId,
                        )
                        .map((driver) => (
                          <Marker
                            key={`nearby-${driver.id}-${driver.lat}-${driver.lng}-${driver.heading || 0}`}
                            position={[driver.lat, driver.lng]}
                            icon={getDriverIcon(driver.vehicleType, driver.id, driver.lat, driver.lng, driver.heading)}
                          />
                        ))}

                    {activeRide ? (
                      (() => {
                        const hasRealTripRoute = realTripRoute && realTripRoute.length > 0;
                        const hasFullRoute = activeRide.routeCoords && activeRide.routeCoords.length > 0;
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

                  {/* Floating locate button inside the map area */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCurrentLocation();
                    }}
                    title="Angazia Eneo Langu la Sasa"
                    className="absolute bottom-6 right-6 z-[1000] bg-black/80 hover:bg-black border border-white/20 hover:border-[#00E5A0]/50 text-white rounded-full p-4 shadow-2xl flex items-center justify-center backdrop-blur-md active:scale-95 transition-all hover:shadow-[#00E5A0]/20 hover:shadow-lg"
                  >
                    <Navigation2 className="w-5 h-5 text-[#00E5A0]" />
                  </button>
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
                    className="w-12 h-12 rounded-2xl bg-[#0e0e17] border border-[#ff6b35]/20 hover:border-[#ff6b35]/40 flex items-center justify-center shadow-lg active:scale-95 transition-all text-[#ff6b35] hover:text-[#ff8552]"
                    title="Rudi Nyumbani (Home)"
                  >
                    <Home className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-black italic tracking-tighter text-white leading-tight">
                      TEKSI-PAPA 🚕
                    </h1>
                    <p className="text-[9px] font-bold text-[#6b6b8a] uppercase tracking-widest leading-none mt-0.5">
                      Usafiri wa haraka na uhakika
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/taxi/history")}
                  className="w-12 h-12 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center shadow-lg active:scale-95 transition-all text-white"
                  title="Historia ya Safari"
                >
                  <Clock size={20} />
                </button>
              </div>

              <div className="bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8 shadow-2xl space-y-6">
                <div className="space-y-4">
                  <div
                    className="bg-[#0a0a0f] rounded-2xl border border-[#1e1e2e] p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => {
                      console.log("Manual pickup click");
                      setSettingMode("pickup");
                      setStep("map");
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75]">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-wider mb-1">
                        Unatokea
                      </p>
                      <p className="text-sm font-bold text-[#f0eeff] truncate">
                        {pickup}
                      </p>
                    </div>
                  </div>
                  <div
                    className="bg-[#0a0a0f] rounded-2xl border border-[#1e1e2e] p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => {
                      console.log("Manual dest click");
                      setSettingMode("destination");
                      setStep("map");
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD]">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-wider mb-1">
                        Unakwenda wapi?
                      </p>
                      <p
                        className={`text-sm font-bold truncate ${destination ? "text-[#f0eeff]" : "text-[#6b6b8a]"}`}
                      >
                        {destination || "Andika hapa unapoenda"}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    console.log("Order now click");
                    setSettingMode("destination");
                    setStep("map");
                  }}
                  className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black tracking-[0.2em] text-xs shadow-2xl shadow-white/5 active:scale-95 transition-all"
                >
                  AGIZA USAFIRI SASA
                </button>
              </div>
            </motion.div>
          )}
          {step === "map" && !isSpectator && (
            <motion.div
              key="map-ui"
              initial={{ y: "100%" }}
              animate={{
                y: isMapFullscreen
                  ? "calc(100% - 90px)"
                  : isMinimized
                    ? "calc(100% - 110px)"
                    : 0,
              }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 z-[9999] bg-[#111118] rounded-t-[40px] border-t border-[#1e1e2e] p-5 pb-10 space-y-4 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] max-h-[85dvh] overflow-y-auto no-scrollbar"
            >
              <div
                className="w-full h-10 flex items-center justify-center cursor-pointer group -mt-4 relative"
                onClick={() => {
                  if (isMapFullscreen) {
                    setIsMapFullscreen(false);
                    setIsMinimized(false);
                  } else if (isMinimized) {
                    setIsMinimized(false);
                  } else {
                    setIsMinimized(true);
                  }
                }}
              >
                <div
                  className={`w-16 h-2 rounded-full transition-all duration-300 shadow-lg ${isMinimized || isMapFullscreen ? "bg-[#7F77DD] animate-bounce" : "bg-neutral-800 group-hover:bg-neutral-600"}`}
                />
              </div>

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
                      className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/10 text-[#6b6b8a] hover:text-white transition-all text-[11px] font-black tracking-wider uppercase"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      RUDI NYUMBANI
                    </button>
                    <span className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-[0.2em] italic">
                      chagua maeneo
                    </span>
                  </div>

                  <div className="bg-[#0a0a0f]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-[#7F77DD] opacity-30 rounded-t-3xl" />
                    <div className="space-y-6">
                      <div 
                        className="flex items-center gap-4 cursor-pointer"
                        onClick={() => setSettingMode("pickup")}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${settingMode === "pickup" ? "bg-emerald-500 text-white shadow-lg" : "bg-white/5 text-[#6b6b8a]"}`}
                        >
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest mb-1">
                            UNATOKEA
                          </p>
                          <input
                            type="text"
                            value={pickup}
                            onChange={(e) => {
                              setPickup(e.target.value);
                              geocodeAddress(e.target.value);
                            }}
                            onFocus={() => setSettingMode("pickup")}
                            placeholder="Tafuta eneo lako..."
                            className="w-full bg-transparent text-sm font-bold text-white border-none outline-none p-0 placeholder:text-neutral-700 italic"
                          />
                        </div>
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingMode("pickup");
                              setIsMapFullscreen(true);
                              toast.success("Gusa popote kwenye ramani ili kuchagua eneo la kuanzia safari! 📍");
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#7F77DD]/15 border border-[#7F77DD]/35 text-[#7F77DD] hover:bg-[#7F77DD]/30 active:scale-90 transition-all shadow-md shadow-[#7F77DD]/10 group"
                            title="Chagua kwa Ramani"
                          >
                            <Map className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-white/5" />

                      <div 
                        className="flex items-center gap-4 cursor-pointer"
                        onClick={() => setSettingMode("destination")}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${settingMode === "destination" ? "bg-red-500 text-white shadow-lg" : "bg-white/5 text-[#6b6b8a]"}`}
                        >
                          <Search className="w-5 h-5" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest mb-1">
                            UNAKWENDA WAPI?
                          </p>
                          <input
                            type="text"
                            value={destination}
                            onChange={(e) => {
                              setDestination(e.target.value);
                              geocodeAddress(e.target.value);
                            }}
                            onFocus={() => setSettingMode("destination")}
                            className="w-full bg-transparent text-sm font-bold text-white border-none outline-none p-0 placeholder:text-neutral-700 italic"
                            placeholder="Andika hapa unapoenda"
                          />
                        </div>
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingMode("destination");
                              setIsMapFullscreen(true);
                              toast.success("Gusa popote kwenye ramani ili kuchagua unakokwenda! 📍");
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#7F77DD]/15 border border-[#7F77DD]/35 text-[#7F77DD] hover:bg-[#7F77DD]/30 active:scale-90 transition-all shadow-md shadow-[#7F77DD]/10 group"
                            title="Chagua kwa Ramani"
                          >
                            <Map className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-[100] bg-[#14141f] border-2 border-[#7f77dd]/30 rounded-3xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                        <div className="px-4 py-2.5 bg-[#1b1b29] border-b border-white/5 text-[9px] font-black uppercase text-[#8a8ab0] tracking-wider">
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
                              className="w-full text-left p-4 hover:bg-white/5 active:bg-white/10 flex items-center gap-4 border-b border-white/5 last:border-0 group transition-all"
                            >
                              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-[#7f77dd] group-hover:bg-[#7f77dd]/20 group-hover:scale-105 transition-all">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold text-white truncate group-hover:text-[#7f77dd] transition-colors">
                                  {mainName}
                                </p>
                                <p className="text-[11px] text-[#8a8ab0] truncate mt-0.5">
                                  {subName}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>



                  <div className={`grid grid-cols-3 gap-2.5 w-full py-3 transition-all duration-200 ${suggestions.length > 0 ? "pointer-events-none opacity-20 grayscale select-none" : ""}`}>
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
                          className={`w-full p-3.5 rounded-[24px] border-2 transition-all duration-300 flex flex-col items-center gap-2.5 relative overflow-hidden group ${
                            ride.maintenance ? "opacity-50 grayscale pointer-events-auto cursor-not-allowed border-amber-500/20 bg-amber-950/20" :
                            isSelected
                              ? "bg-[#7F77DD]/15 border-[#7F77DD] shadow-[0_0_25px_rgba(127,119,221,0.25)] scale-[1.02]"
                              : "bg-[#141420] border-white/5 hover:border-white/10 hover:bg-[#181828]"
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
                              className="absolute inset-0 bg-[#7F77DD]/5 pointer-events-none"
                            />
                          )}
                          
                          {/* Active state small indicator point */}
                          <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full transition-all duration-300 ${isSelected ? "bg-[#7F77DD] scale-100 shadow-[0_0_8px_#7F77DD]" : "bg-transparent scale-0"}`} />

                          {/* Beautiful Custom-designed Vehicle Container with a 3D Glowing Podium/Shadow */}
                          <div className="relative w-full aspect-[4/3] max-h-[72px] sm:max-h-[80px] flex items-center justify-center -mt-1 select-none">
                            {/* Ambient dynamic glow under the vehicle */}
                            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-2.5 rounded-full transition-all duration-300 blur-md ${
                              isSelected ? "bg-[#7F77DD]/50 scale-110" : "bg-neutral-900/50 group-hover:bg-[#7F77DD]/20"
                            }`} />
                            {/* Subtle elegant podium ellipse */}
                            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1 rounded-full border border-white/5 transition-all duration-300 ${
                              isSelected ? "bg-white/5 border-[#7F77DD]/30" : "bg-transparent"
                            }`} />
                            
                            {/* Floating Vehicle container */}
                            <div className={`relative z-10 transition-all duration-500 transform ${
                              isSelected ? "-translate-y-1.5 scale-110 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" : "group-hover:-translate-y-1 group-hover:scale-105"
                            }`}>
                              {ride.imageUrl ? (
                                <img 
                                  src={ride.imageUrl} 
                                  className="w-20 sm:w-24 h-12 sm:h-14 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" 
                                  referrerPolicy="no-referrer" 
                                  alt={ride.name}
                                />
                              ) : (
                                <span className="text-3.5xl sm:text-4xl">{ride.image}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-center w-full">
                            <h4
                              className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? "text-[#7F77DD]" : "text-[#8a8ab0]"}`}
                            >
                              {ride.name}
                            </h4>
                            <h3 className={`text-[11px] font-black italic mt-0.5 transition-colors ${
                              isSelected 
                                ? (destination && totalDistance > 0) ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.25)] text-xs" : "text-white" 
                                : (destination && totalDistance > 0) ? "text-emerald-500/90 text-xs" : "text-neutral-200"
                            }`}>
                              TZS {ride.price.toLocaleString()}
                            </h3>
                          </div>
                          
                          {/* Information of capacity and ETA */}
                          <div className="w-full flex flex-col gap-1 border-t border-white/5 pt-2 mt-0.5">
                            <div className="flex items-center justify-center gap-1 text-[8.5px] font-bold text-neutral-300">
                              <Users className="w-2.5 h-2.5 text-[#7F77DD] shrink-0" />
                              <span>Abiria {ride.capacity}</span>
                            </div>
                            <div className={`flex items-center justify-center gap-1 text-[8.5px] font-bold ${
                              isSelected ? "text-emerald-400" : "text-neutral-400"
                            }`}>
                              <Clock className={`w-2.5 h-2.5 shrink-0 ${isSelected ? "text-emerald-400 animate-pulse" : "text-neutral-500"}`} />
                              <span>Fika: {ride.eta} min</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Dynamic transparent pricing explanation trigger */}
                  {destination && totalDistance > 0 && (
                    <div className="w-full flex justify-center py-1">
                      <button
                        onClick={() => setShowBreakdownModal(true)}
                        className="text-[9.5px] font-black tracking-widest text-[#7F77DD] hover:text-[#9c95ff] bg-[#7F77DD]/10 hover:bg-[#7F77DD]/15 px-4 py-2 rounded-full uppercase flex items-center gap-1.5 transition-all shadow-sm border border-[#7F77DD]/25 active:scale-95"
                      >
                        <Calculator className="w-3 h-3 text-[#7F77DD]" />
                        <span>Gharama ya Uwazi (Breakdown)</span>
                      </button>
                    </div>
                  )}

                  {/* Summary Dynamic Trip Ticket Panel for better user confirmation as explicitly requested */}
                  {destination && totalDistance > 0 && selectedRide && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="w-full bg-[#161626]/90 border border-emerald-500/35 rounded-[24px] p-4 flex flex-col gap-2.5 select-none my-2.5 shadow-[0_0_20px_rgba(16,185,129,0.08)] relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <p className="text-[9.5px] font-black text-emerald-400 uppercase tracking-wider">MAKADIRIO YA SAFARI (TRIP ESTIMATE)</p>
                        </div>
                        <span className="text-[8px] font-black text-[#7F77DD] uppercase tracking-widest bg-[#7F77DD]/10 px-2 py-0.5 rounded-full border border-[#7F77DD]/15">
                          {selectedRide.name} ⚡
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5 mt-0.5">
                        <div className="flex flex-col">
                          <span className="text-[8.5px] text-neutral-400 font-extrabold uppercase tracking-wide">Kiasi cha Kulipa (Fare)</span>
                          <span className="text-[15px] font-black italic text-emerald-400 tracking-tight mt-0.5">
                            TZS {selectedRide.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8.5px] text-neutral-400 font-extrabold uppercase tracking-wide">Muda wa Kufika Dereva (ETA)</span>
                          <span className="text-[15px] font-black text-white tracking-tight mt-0.5 flex items-center gap-1 leading-none">
                            <span className="text-[#9c95ff]">{selectedRide.eta}</span>
                            <span className="text-[9px] font-black uppercase text-neutral-400">Dakika</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-[8px] bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-xl text-emerald-400/90 font-bold leading-relaxed text-center">
                        Dereva wa karibu zaidi atakufikia kwa takribani dakika <strong className="text-white font-black">{selectedRide.eta}</strong> akipokea ombi lako.
                      </div>
                    </motion.div>
                  )}
                  
                  <button
                    onClick={() => {
                      if (justSelectedRef.current) return;
                      console.log("Confirm button click");
                      confirmBooking();
                    }}
                    disabled={isCreatingRide || !destination || suggestions.length > 0}
                    className="w-full h-16 bg-white text-[#0a0a0f] rounded-3xl font-black italic uppercase text-xs tracking-[0.2em] flex items-center justify-between px-10 disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-2xl relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <span className="relative z-10">
                      {destination
                        ? selectedRide
                          ? "THIBITISHA USAFIRI"
                          : "CHAGUA USAFIRI"
                        : "WEKA UNAPOKWENDA"}
                    </span>
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}

              {(isMinimized || isMapFullscreen) && (
                <div className="py-2 flex flex-col items-center justify-center gap-1 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-[#7F77DD]/20 flex items-center justify-center mb-1">
                    <ChevronRight className="w-4 h-4 text-[#7F77DD] -rotate-90" />
                  </div>
                  <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                    Bofya hapa kuendelea
                  </p>
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
                onNext={() => setStep("found")}
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

              {/* Ride Options Breakdowns */}
              <div className="space-y-4">
                {rideOptions.map((ride) => {
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
                      className={`p-4 rounded-3xl border transition-all ${
                        selectedRide?.id === ride.id 
                          ? 'bg-[#7F77DD]/10 border-[#7F77DD] shadow-[0_0_15px_rgba(127,119,221,0.15)]' 
                          : 'bg-[#12121e]/50 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                            {ride.imageUrl ? (
                              <img src={ride.imageUrl} className="w-7 h-7 object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-sm">{ride.image || (id === 'mini' ? '🚗' : id === 'bajaj' ? '🛺' : '🏍️')}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wide">{ride.name}</h4>
                            <p className="text-[8px] text-neutral-400 font-bold uppercase">{ride.sub}</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#7F77DD]">
                          TZS {ride.price.toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 text-[10px] text-neutral-300 font-medium">
                        {/* Base Fare */}
                        <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded-lg">
                          <span className="text-neutral-400">1. Kuanza Safari:</span>
                          <span>TZS {Math.round(baseFare).toLocaleString()}</span>
                        </div>

                        {/* Distance Cost */}
                        <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded-lg">
                          <span className="text-neutral-400">
                            2. Kilometa ({distKm.toFixed(1)} KM × {Math.round(pricePerKm)} TZS):
                          </span>
                          <span>TZS {Math.round(kmCost).toLocaleString()}</span>
                        </div>

                        {/* Duration Cost */}
                        <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded-lg">
                          <span className="text-neutral-400">
                            3. Muda njiani ({durMins} Dk × {pricePerMin} TZS):
                          </span>
                          {pricePerMin === 0 ? (
                            <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-black uppercase">
                              Trafiki Bure 🎉
                            </span>
                          ) : (
                            <span>TZS {Math.round(minCost).toLocaleString()}</span>
                          )}
                        </div>

                        {/* Waiting Time Cost (Muda wa Subira) */}
                        {waitingTime > 0 && (
                          <div className="flex justify-between items-center bg-amber-500/5 p-1.5 rounded-lg text-amber-400">
                            <span>4. Subira ({waitingTime} Dk × {waitingRate} TZS):</span>
                            <span>+ TZS {waitingCost.toLocaleString()}</span>
                          </div>
                        )}

                        {/* Code for City Taxes */}
                        {taxRate > 0 && (
                          <div className="flex justify-between items-center bg-emerald-500/5 p-1.5 rounded-lg text-emerald-400">
                            <span>Tozo/Kodi ({cityData.taxName || "Kodi"} - {taxRate}%):</span>
                            <span>Imijumuishwa kwenye jumla</span>
                          </div>
                        )}

                        {/* Surcharges info row */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {isNightSurcharge && (
                            <span className="text-[8px] text-[#7F77DD] bg-[#7F77DD]/10 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                              Usiku ({nm}x Nomino)
                            </span>
                          )}
                          {surgeLevel !== "normal" && (
                            <span className="text-[8px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                              Uhitaji Surcharge ({surgeMultiplier}x)
                            </span>
                          )}
                          <span className="text-[8px] text-neutral-400 bg-white/5 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                            Mji: {selectedCity}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informative Swahili explanation of why it is different */}
              <div className="bg-[#141424] border border-[#7F77DD]/20 p-4 rounded-2.5xl space-y-1.5">
                <h4 className="text-[10px] font-black text-[#7F77DD] uppercase tracking-wide">💡 TOFAUTI yetu ya Kipekee:</h4>
                <p className="text-[9.2px] text-neutral-200 leading-relaxed font-semibold">
                  Sisi ni waigizaji kulingana na miji mbalimbali nchini Tanzania. <strong>Dar es Salaam</strong> ina nauli ya kawaida, <strong>Arusha</strong> imeongezwa kutokana na milima, huku miji ya <strong>Dodoma</strong> na <strong>Mwanza</strong> ikileta unafuu zaidi! Pia kwa Pikipiki na Bajaji, <strong>hutoizwi hela ya foleni</strong> hata kidogo!
                </p>
              </div>

              <button
                onClick={() => setShowBreakdownModal(false)}
                className="w-full py-4 bg-gradient-to-r from-[#7F77DD] to-[#6056d6] text-white rounded-2.5xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                NIMEFAHAMU, ASANTE!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Responsive Popup Chat for Active Ride */}
      {activeRide && activeRide.driverId && ["arriving", "on_trip", "found"].includes(step) && !isChatOpen && (
        <ActiveRideChatPopup
          rideId={rideId || ""}
          user={user}
          recipientId={activeRide.driverId}
          recipientName={activeRide.driverInfo?.name || "Dereva Swahili"}
          recipientPhoto={activeRide.driverInfo?.photo || ""}
          isDriver={false}
        />
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { font-family: inherit; }
        .custom-div-icon { background: none; border: none; }
      `}</style>
    </div>
  );
}
