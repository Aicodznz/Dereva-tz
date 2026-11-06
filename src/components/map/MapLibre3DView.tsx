import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Compass, Eye, Sun, Moon, Sunset, Layers, 
  Car, Bike, Navigation, Volume2, VolumeX, X, 
  MapPin, Building2, Check, ArrowUpRight, Sparkles,
  Activity, AlertTriangle, ShieldCheck, Zap, Gauge,
  Mountain, Wifi, WifiOff, Phone, Fuel, ChevronDown,
  ChevronUp, Play, Radio, ArrowRight, Clock, DollarSign,
  Plus, Minus, Crosshair, Route, RefreshCw, CornerUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Ensure MapLibre Web Worker loads reliably without worker URL resolution errors in Vite
if (typeof window !== 'undefined') {
  try {
    if (typeof (maplibregl as any).setWorkerUrl === 'function') {
      const workerUrl = window.location?.origin 
        ? `${window.location.origin}/maplibre-gl-worker.mjs`
        : '/maplibre-gl-worker.mjs';
      (maplibregl as any).setWorkerUrl(workerUrl);
      if (typeof (maplibregl as any).setWorkerCount === 'function') {
        (maplibregl as any).setWorkerCount(2);
      }
    }
  } catch (e) {
    console.warn("MapLibre worker setup notice:", e);
  }
}

export interface MapLibre3DViewProps {
  isOpen: boolean;
  onClose: () => void;
  center?: [number, number]; // [lat, lng]
  vehicleHeading?: number;
  vehicleType?: 'car' | 'bike' | 'bajaj';
  isOnline?: boolean;
  speed?: number;
  driverName?: string;
  licensePlate?: string;
  activeRide?: any;
  incomingRequest?: any;
  onAcceptRide?: () => void;
  onDeclineRide?: (ride: any) => void;
  theme?: 'light' | 'dark';
}

// 100% Free OpenFreeMap & Vector Styles (Zero API key, zero watermarks, high data-saving)
const TILE_ENGINES = {
  vector_liberty: {
    id: 'vector_liberty',
    name: 'Vekta ya Kasi (Liberty)',
    tag: '⚡ Vekta PBF',
    dataRate: '22 KB/s',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    supports3D: true,
    isDataSaver: false
  },
  lite_saver: {
    id: 'lite_saver',
    name: 'Bando Kidogo Sana (Lite Saver)',
    tag: '🍃 84% Bando',
    dataRate: '8 KB/s',
    url: 'https://tiles.openfreemap.org/styles/positron',
    supports3D: false,
    isDataSaver: true
  },
  vector_bright: {
    id: 'vector_bright',
    name: 'Mwangaza Wazi (Bright)',
    tag: '☀️ Mwangaza',
    dataRate: '20 KB/s',
    url: 'https://tiles.openfreemap.org/styles/bright',
    supports3D: true,
    isDataSaver: false
  }
};

const DAR_HOTSPOTS = [
  {
    id: 'mabibo-mandela',
    name: 'Nelson Mandela Rd & Mabibo Relini',
    lngLat: [39.2384, -6.8163] as [number, number],
    desc: 'Barabara ya Mandela, Reli ya Tazara & Tabata',
    altitude: 34,
    slope: '+2.1%',
    surface: 'Lami Nzuri (92%)',
    trafficSpeed: 42,
    trafficLevel: 'wastani',
    pitch: 58,
    bearing: 42,
    zoom: 16.5
  },
  {
    id: 'tabata-kisiwani',
    name: 'Tabata Kisiwani & Kamoti St',
    lngLat: [39.2431, -6.8225] as [number, number],
    desc: 'Mtaa wa Kamoti, Mgasa & Chanzi',
    altitude: 28,
    slope: '+1.4%',
    surface: 'Changarawe & Lami ya Kati (75%)',
    trafficSpeed: 28,
    trafficLevel: 'nyepesi',
    pitch: 62,
    bearing: 35,
    zoom: 17
  },
  {
    id: 'sam-nujoma',
    name: 'Sam Nujoma Rd & Mlimani City',
    lngLat: [39.2198, -6.7725] as [number, number],
    desc: 'Mlimani City Mall & UDSM Campus',
    altitude: 68,
    slope: '+4.8%',
    surface: 'Lami Safi ya Barabara Kuu (98%)',
    trafficSpeed: 50,
    trafficLevel: 'nyepesi',
    pitch: 55,
    bearing: -20,
    zoom: 16
  },
  {
    id: 'posta-cbd',
    name: 'Posta City Centre & Samora Ave',
    lngLat: [39.2890, -6.8160] as [number, number],
    desc: 'Maghorofa marefu ya benki kuu na bandari',
    altitude: 6,
    slope: '+0.5%',
    surface: 'Lami ya Mjini (95%)',
    trafficSpeed: 18,
    trafficLevel: 'nzito',
    pitch: 60,
    bearing: 65,
    zoom: 16.5
  },
  {
    id: 'kariakoo',
    name: 'Kariakoo Market & Morogoro Rd',
    lngLat: [39.2745, -6.8198] as [number, number],
    desc: 'Soko kuu la Kariakoo na barabara ya BRT',
    altitude: 16,
    slope: '+1.1%',
    surface: 'Lami na Njia ya BRT (90%)',
    trafficSpeed: 14,
    trafficLevel: 'nzito',
    pitch: 56,
    bearing: 15,
    zoom: 16.5
  }
];

// Helper to calculate terrain elevation & slope for any Dar es Salaam coordinate
function calculateTerrainAnalysis(lng: number, lat: number) {
  const inlandFactor = Math.max(0, (39.29 - lng) * 100);
  const estimatedAltitude = Math.round(Math.max(3, inlandFactor * 8.5 + (Math.sin(lat * 50) * 12)));
  const slopePercent = (estimatedAltitude > 60 ? (estimatedAltitude * 0.05).toFixed(1) : (estimatedAltitude * 0.035).toFixed(1));
  const isUphill = estimatedAltitude > 25;

  let surfaceType = 'Lami Nzuri (Smooth Asphalt)';
  let surfaceQuality = 92;
  let hasBumps = false;
  let flyoverNearby = false;

  if (estimatedAltitude > 80) {
    surfaceType = 'Lami & Miinuko Mikali (Hilly Asphalt)';
    surfaceQuality = 85;
    hasBumps = true;
  } else if (lng > 39.27 && lat < -6.81) {
    surfaceType = 'Lami ya Mjini & Barabara ya BRT';
    surfaceQuality = 95;
    flyoverNearby = true;
  } else if (lng < 39.24 && lat > -6.83) {
    surfaceType = 'Lami & Sehemu za Changarawe';
    surfaceQuality = 78;
    hasBumps = true;
  }

  const hour = new Date().getHours();
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  let congestionLevel: 'nyepesi' | 'wastani' | 'nzito' = 'nyepesi';
  let avgTrafficSpeed = 48;
  let delayMinutes = 0;

  if (isRushHour) {
    congestionLevel = estimatedAltitude < 35 ? 'nzito' : 'wastani';
    avgTrafficSpeed = estimatedAltitude < 35 ? 16 : 28;
    delayMinutes = estimatedAltitude < 35 ? 8 : 4;
  } else {
    congestionLevel = 'nyepesi';
    avgTrafficSpeed = 52;
    delayMinutes = 1;
  }

  const fuelImpact = isUphill ? `+${(Number(slopePercent) * 2.2).toFixed(0)}% (Panda Mlima)` : 'Kawaida (0%)';

  return {
    altitude: estimatedAltitude,
    slope: `${isUphill ? '+' : ''}${slopePercent}%`,
    isUphill,
    surfaceType,
    surfaceQuality,
    hasBumps,
    flyoverNearby,
    congestionLevel,
    avgTrafficSpeed,
    delayMinutes,
    fuelImpact
  };
}

// Generate realistic road coordinates with custom curve detour
function generateRoadPath(
  start: [number, number], 
  end: [number, number], 
  points = 10,
  detourFactor = 1.0,
  detourSide = 1
): [number, number][] {
  const coords: [number, number][] = [start];
  for (let i = 1; i < points; i++) {
    const t = i / points;
    const midLng = start[0] + (end[0] - start[0]) * t;
    const midLat = start[1] + (end[1] - start[1]) * t;
    const offset = Math.sin(t * Math.PI) * 0.0022 * detourFactor * detourSide;
    coords.push([midLng + offset * 0.55, midLat + offset]);
  }
  coords.push(end);
  return coords;
}

export default function MapLibre3DView({
  isOpen,
  onClose,
  center = [-6.8163, 39.2384],
  vehicleHeading = 45,
  vehicleType = 'car',
  isOnline = true,
  speed = 0,
  driverName = 'Dereva Papo Hapo',
  licensePlate = 'T 782 DSK',
  activeRide,
  incomingRequest: externalIncomingRequest,
  onAcceptRide,
  onDeclineRide,
  theme = 'light'
}: MapLibre3DViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const customerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  
  // Track user interaction to prevent camera fight / zoom snap-back
  const isUserInteractingRef = useRef<boolean>(false);
  const lastFittedTargetIdRef = useRef<string | null>(null);

  // Auto-follow state: When true, camera eases to driver; when false (after user zooms/drags), map stays put!
  const [autoFollow, setAutoFollow] = useState<boolean>(true);

  // Active Route Option: 0 = Njia Kuu (Haraka), 1 = Njia Mbadala 2 (Mkato), 2 = Njia Mbadala 3 (Kuepuka Foleni)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [showRoutesDrawer, setShowRoutesDrawer] = useState<boolean>(false);
  const [isReroutingNotice, setIsReroutingNotice] = useState<boolean>(false);

  // Dynamic destination override (if customer changes destination mid-trip)
  const [customDestination, setCustomDestination] = useState<any | null>(null);

  // Simulated Test Request state for immediate testing
  const [simulatedRequest, setSimulatedRequest] = useState<any | null>(null);
  const incomingRequest = externalIncomingRequest || simulatedRequest;

  // Active Tile Engine
  const [activeEngineKey, setActiveEngineKey] = useState<keyof typeof TILE_ENGINES>('vector_liberty');
  const activeEngine = TILE_ENGINES[activeEngineKey];

  // Camera & Map State
  const [pitch, setPitch] = useState<number>(55);
  const [bearing, setBearing] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(16.5);
  const [isHeadingUp, setIsHeadingUp] = useState<boolean>(true);
  const [buildings3DEnabled, setBuildings3DEnabled] = useState<boolean>(true);
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(false);

  // Analyzer Panels & Modals
  const [showTerrainDrawer, setShowTerrainDrawer] = useState<boolean>(false);
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState<boolean>(false);
  const [activeHotspot, setActiveHotspot] = useState(DAR_HOTSPOTS[0]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isTurnBarMinimized, setIsTurnBarMinimized] = useState<boolean>(false);

  // Request countdown timer (30s)
  const [requestTimeLeft, setRequestTimeLeft] = useState<number>(30);

  // Live Terrain & Surface Data for current position
  const currentTerrain = calculateTerrainAnalysis(center[1] || 39.2384, center[0] || -6.8163);

  // Audio Chime synthesizer for alerts
  const playAlertChime = useCallback((type: 'request' | 'reroute' = 'request') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (type === 'reroute') {
        // Two rising chimes for reroute
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc1.frequency.setValueAtTime(659.25, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc1.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.5);
      } else {
        // Multi-tone chime for new request
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);
        osc1.frequency.setValueAtTime(659.25, now + 0.12);
        osc1.frequency.setValueAtTime(783.99, now + 0.24);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1046.50, now + 0.24);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now + 0.24);
        osc1.stop(now + 0.55);
        osc2.stop(now + 0.55);
      }
    } catch {
      // Audio context blocked
    }
  }, [soundEnabled]);

  // Handle countdown timer when incoming request exists
  useEffect(() => {
    if (!incomingRequest) {
      setRequestTimeLeft(30);
      return;
    }

    playAlertChime('request');
    setRequestTimeLeft(30);

    const timer = setInterval(() => {
      setRequestTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (simulatedRequest) setSimulatedRequest(null);
          onDeclineRide?.(incomingRequest);
          toast.info("Ombi la safari limepitwa na muda");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingRequest?.id]);

  // Trigger test simulated request
  const triggerSampleRequest = () => {
    const sample = {
      id: `req-sample-${Date.now()}`,
      customerId: 'cust-dsm-01',
      customerInfo: {
        name: 'Fatma Bakari',
        phone: '+255 712 345 678',
        rating: 4.95,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      },
      pickup: {
        lat: center[0] + 0.0045,
        lng: center[1] - 0.0035,
        address: 'Mabibo Relini, Kituo cha Basi'
      },
      destination: {
        lat: center[0] + 0.0160,
        lng: center[1] + 0.0140,
        address: 'Posta Samora Ave, Jengo la PSPF'
      },
      fare: 14500,
      price: 14500,
      distance: 5.2,
      vehicleType: vehicleType,
      paymentMethod: 'M-Pesa / PapoCredit'
    };

    setSimulatedRequest(sample);
    setSelectedRouteIndex(0);
    toast.success("🔔 Ombi jipya la safari limewasili!");
  };

  // Trigger simulated Off-Route / Mchepuko Rerouting
  const triggerSimulatedReroute = () => {
    setIsReroutingNotice(true);
    playAlertChime('reroute');
    toast.info("🔄 Dereva amechepuka! Njia inarekebishwa kiotomatiki...");
    
    // Switch to alternative detour route with dynamic animation
    setTimeout(() => {
      setSelectedRouteIndex(prev => (prev === 0 ? 1 : prev === 1 ? 2 : 0));
      setIsReroutingNotice(false);
      toast.success("✅ Njia mpya imekokotolewa kikamilifu kulingana na mwelekeo wako!");
    }, 1200);
  };

  // Trigger Customer Change Destination
  const triggerChangeDestination = () => {
    const newDests = [
      { name: 'Kariakoo Market, Mtaa wa Swahili', lat: -6.8198, lng: 39.2745, fare: 11000 },
      { name: 'Mlimani City Mall, Sam Nujoma Rd', lat: -6.7725, lng: 39.2198, fare: 16500 },
      { name: 'Masaki Slipway, Chole Rd', lat: -6.7485, lng: 39.2785, fare: 22000 }
    ];
    const pick = newDests[Math.floor(Math.random() * newDests.length)];
    setCustomDestination(pick);
    playAlertChime('reroute');
    toast.success(`📍 Mteja amebadilisha mwisho wa safari: ${pick.name}! Njia inarekebishwa...`);
  };

  // -------------------------------------------------------------
  // INITIALIZE MAPLIBRE GL JS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLng = center[1] || 39.2384;
    const initialLat = center[0] || -6.8163;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: activeEngine.url,
      center: [initialLng, initialLat],
      zoom: 16.5,
      pitch: pitch,
      bearing: isHeadingUp ? (vehicleHeading || 0) : 0,
      attributionControl: false,
      maxPitch: 85,
      dragRotate: true,
      touchPitch: true,
      touchZoomRotate: true
    });

    mapInstanceRef.current = map;

    // Detect user interactions (drag, zoom, pitch, rotate)
    map.on('dragstart', () => {
      isUserInteractingRef.current = true;
      setAutoFollow(false);
    });
    map.on('zoomstart', () => {
      isUserInteractingRef.current = true;
      setAutoFollow(false);
    });
    map.on('rotatestart', () => {
      isUserInteractingRef.current = true;
      setAutoFollow(false);
    });
    map.on('pitchstart', () => {
      isUserInteractingRef.current = true;
    });

    map.on('dragend', () => {
      isUserInteractingRef.current = false;
    });
    map.on('zoomend', () => {
      isUserInteractingRef.current = false;
      setCurrentZoom(Number(map.getZoom().toFixed(1)));
    });
    map.on('rotateend', () => {
      isUserInteractingRef.current = false;
    });
    map.on('pitchend', () => {
      isUserInteractingRef.current = false;
    });

    map.on('rotate', () => {
      setBearing(Math.round(map.getBearing()));
    });

    map.on('pitch', () => {
      setPitch(Math.round(map.getPitch()));
    });

    map.on('load', () => {
      // 1. Add 3D Extruded Buildings Layer from OpenFreeMap vector tiles
      if (activeEngine.supports3D && !dataSaverMode) {
        try {
          const layers = map.getStyle().layers;
          const labelLayerId = layers?.find(l => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;

          if (!map.getLayer('3d-buildings')) {
            map.addLayer(
              {
                id: '3d-buildings',
                source: 'openmaptiles',
                'source-layer': 'building',
                type: 'fill-extrusion',
                minzoom: 14,
                paint: {
                  'fill-extrusion-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'render_height'],
                    0, '#D6D9E0',
                    30, '#C2C8D2',
                    80, '#94A3B8'
                  ],
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0,
                    14.5, ['get', 'render_height']
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0,
                    14.5, ['get', 'render_min_height']
                  ],
                  'fill-extrusion-opacity': 0.88
                }
              },
              labelLayerId
            );
          }
        } catch (err) {
          console.warn("3D buildings layer notice:", err);
        }
      }

      // 2. Add Alternative Routes Background Layer (Semi-transparent dashed lines)
      try {
        if (!map.getSource('alt-routes-source')) {
          map.addSource('alt-routes-source', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });

          map.addLayer({
            id: 'alt-routes-line',
            type: 'line',
            source: 'alt-routes-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#64748B',
              'line-width': 4,
              'line-opacity': 0.6,
              'line-dasharray': [2, 2]
            }
          });
        }
      } catch (err) {
        console.warn("Alt routes source notice:", err);
      }

      // 3. Add Primary Active Route GeoJSON Source
      try {
        if (!map.getSource('active-route-source')) {
          map.addSource('active-route-source', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: []
              }
            }
          });

          // Outer Route Glow Casing
          map.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'active-route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#0f172a',
              'line-width': 8,
              'line-opacity': 0.88
            }
          });

          // Inner Vibrant Neon Route Line (Color changes dynamically: Emerald for Primary, Amber for Detour)
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'active-route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#10b981',
              'line-width': 4.5,
              'line-opacity': 0.95
            }
          });
        }
      } catch (err) {
        console.warn("Route source notice:", err);
      }

      // 4. Add Driver 3D Vehicle Marker
      const driverEl = document.createElement('div');
      driverEl.className = 'maplibre-driver-marker';
      driverEl.innerHTML = `
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ea580c, #f59e0b);
          border: 3px solid #ffffff;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          transform: rotate(${vehicleHeading}deg);
          transition: transform 0.3s ease;
        ">
          ${vehicleType === 'bike' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
        </div>
      `;

      const marker = new maplibregl.Marker({ element: driverEl, rotationAlignment: 'map' })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

      driverMarkerRef.current = marker;
    });

    return () => {
      customerMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      driverMarkerRef.current?.remove();
      map.remove();
    };
  }, [activeEngineKey, dataSaverMode]);

  // Update vehicle marker & camera
  useEffect(() => {
    if (!driverMarkerRef.current || !mapInstanceRef.current) return;
    const lngLat: [number, number] = [center[1], center[0]];
    driverMarkerRef.current.setLngLat(lngLat);

    if (autoFollow && !isUserInteractingRef.current) {
      mapInstanceRef.current.easeTo({
        center: lngLat,
        bearing: isHeadingUp ? (vehicleHeading || 0) : 0,
        duration: 400
      });
    }
  }, [center[0], center[1], vehicleHeading, autoFollow, isHeadingUp]);

  // -------------------------------------------------------------
  // DYNAMIC 3D ROUTE DRAWING WITH REROUTING & ALTERNATIVES
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentTarget = incomingRequest || activeRide;

    if (!currentTarget) {
      lastFittedTargetIdRef.current = null;
      try {
        const source = map.getSource('active-route-source') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] }
          });
        }
        const altSource = map.getSource('alt-routes-source') as maplibregl.GeoJSONSource;
        if (altSource) {
          altSource.setData({
            type: 'FeatureCollection',
            features: []
          });
        }
      } catch {
        // Source not ready
      }
      customerMarkerRef.current?.remove();
      customerMarkerRef.current = null;
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      return;
    }

    const driverLngLat: [number, number] = [center[1], center[0]];

    // 1. Pickup Point
    const pLat = currentTarget.pickup?.lat || (Array.isArray(currentTarget.pickup) ? currentTarget.pickup[0] : null);
    const pLng = currentTarget.pickup?.lng || (Array.isArray(currentTarget.pickup) ? currentTarget.pickup[1] : null);

    // 2. Destination Point (Supports dynamic customer destination override)
    const dLat = customDestination ? customDestination.lat : (currentTarget.destination?.lat || (Array.isArray(currentTarget.destination) ? currentTarget.destination[0] : null));
    const dLng = customDestination ? customDestination.lng : (currentTarget.destination?.lng || (Array.isArray(currentTarget.destination) ? currentTarget.destination[1] : null));
    const dAddress = customDestination ? customDestination.name : (currentTarget.destinationAddress || currentTarget.destination?.address || 'Mwisho');

    if (pLat && pLng) {
      const pickupLngLat: [number, number] = [pLng, pLat];

      if (!customerMarkerRef.current) {
        const custEl = document.createElement('div');
        custEl.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              position: absolute;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: rgba(16, 185, 129, 0.4);
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              background: #10B981;
              color: white;
              font-weight: 900;
              font-size: 11px;
              padding: 4px 9px;
              border-radius: 12px;
              border: 2px solid white;
              box-shadow: 0 6px 18px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              gap: 4px;
              z-index: 10;
            ">
              <span>👤</span> ${currentTarget.customerInfo?.name || 'Mteja'}
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #10B981;"></div>
          </div>
        `;
        customerMarkerRef.current = new maplibregl.Marker({ element: custEl })
          .setLngLat(pickupLngLat)
          .addTo(map);
      } else {
        customerMarkerRef.current.setLngLat(pickupLngLat);
      }

      if (dLat && dLng) {
        const destLngLat: [number, number] = [dLng, dLat];

        if (!destMarkerRef.current) {
          const destEl = document.createElement('div');
          destEl.innerHTML = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="
                background: #EF4444;
                color: white;
                font-weight: 900;
                font-size: 11px;
                padding: 4px 9px;
                border-radius: 12px;
                border: 2px solid white;
                box-shadow: 0 6px 18px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                <span>🏁</span> ${dAddress}
              </div>
              <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #EF4444;"></div>
            </div>
          `;
          destMarkerRef.current = new maplibregl.Marker({ element: destEl })
            .setLngLat(destLngLat)
            .addTo(map);
        } else {
          destMarkerRef.current.setLngLat(destLngLat);
        }

        // GENERATE 3 ALTERNATIVE ROUTE TRAJECTORIES
        // Option 0: Primary Straightforward Highway
        const route0_p1 = generateRoadPath(driverLngLat, pickupLngLat, 8, 0.7, 1);
        const route0_p2 = generateRoadPath(pickupLngLat, destLngLat, 12, 0.8, -1);
        const route0 = [...route0_p1, ...route0_p2.slice(1)];

        // Option 1: Detour via Ring Road (Kuepuka Foleni)
        const route1_p1 = generateRoadPath(driverLngLat, pickupLngLat, 8, 1.4, -1);
        const route1_p2 = generateRoadPath(pickupLngLat, destLngLat, 12, 1.5, 1);
        const route1 = [...route1_p1, ...route1_p2.slice(1)];

        // Option 2: Short-cut via Urban Street Grid
        const route2_p1 = generateRoadPath(driverLngLat, pickupLngLat, 8, 1.9, 1);
        const route2_p2 = generateRoadPath(pickupLngLat, destLngLat, 12, 2.0, -1);
        const route2 = [...route2_p1, ...route2_p2.slice(1)];

        const allRoutes = [route0, route1, route2];
        const activeSelectedCoords = allRoutes[selectedRouteIndex] || route0;
        const alternativeCoordsList = allRoutes.filter((_, idx) => idx !== selectedRouteIndex);

        // Update Primary Active Route
        try {
          const source = map.getSource('active-route-source') as maplibregl.GeoJSONSource;
          if (source) {
            source.setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: activeSelectedCoords
              }
            });
          }

          // Dynamic line color: Emerald for Route 0, Amber for Route 1, Blue for Route 2
          const routeColors = ['#10b981', '#f59e0b', '#3b82f6'];
          if (map.getLayer('route-line')) {
            map.setPaintProperty('route-line', 'line-color', routeColors[selectedRouteIndex] || '#10b981');
          }

          // Update Secondary Alternative Lines
          const altSource = map.getSource('alt-routes-source') as maplibregl.GeoJSONSource;
          if (altSource) {
            altSource.setData({
              type: 'FeatureCollection',
              features: alternativeCoordsList.map((coords, i) => ({
                type: 'Feature',
                properties: { id: `alt-${i}` },
                geometry: {
                  type: 'LineString',
                  coordinates: coords
                }
              }))
            });
          }
        } catch {
          // Source pending
        }

        // Fit bounds once on target arrival
        if (currentTarget.id && lastFittedTargetIdRef.current !== currentTarget.id) {
          lastFittedTargetIdRef.current = currentTarget.id;
          const bounds = new maplibregl.LngLatBounds();
          bounds.extend(driverLngLat);
          bounds.extend(pickupLngLat);
          bounds.extend(destLngLat);

          map.fitBounds(bounds, {
            padding: { top: 90, bottom: 180, left: 50, right: 50 },
            pitch: 50,
            maxZoom: 16.5,
            duration: 1200
          });
        }
      }
    }
  }, [incomingRequest?.id, activeRide?.id, selectedRouteIndex, customDestination]);

  // Recenter Camera to Driver (Auto-Follow re-enable)
  const recenterToDriver = () => {
    if (!mapInstanceRef.current) return;
    const lngLat: [number, number] = [center[1], center[0]];
    mapInstanceRef.current.easeTo({
      center: lngLat,
      zoom: 16.5,
      pitch: pitch,
      bearing: isHeadingUp ? (vehicleHeading || 0) : 0,
      duration: 600
    });
    setAutoFollow(true);
    toast.success("🎯 Kamera imerejeshwa kwenye gari lako!");
  };

  // Zoom In
  const handleZoomIn = () => {
    if (!mapInstanceRef.current) return;
    setAutoFollow(false);
    mapInstanceRef.current.zoomIn({ duration: 300 });
  };

  // Zoom Out
  const handleZoomOut = () => {
    if (!mapInstanceRef.current) return;
    setAutoFollow(false);
    mapInstanceRef.current.zoomOut({ duration: 300 });
  };

  // Toggle 3D buildings layer
  const toggle3DBuildings = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (map.getLayer('3d-buildings')) {
      const currentVis = map.getLayoutProperty('3d-buildings', 'visibility');
      const nextVis = currentVis === 'none' ? 'visible' : 'none';
      map.setLayoutProperty('3d-buildings', 'visibility', nextVis);
      setBuildings3DEnabled(nextVis === 'visible');
      toast.info(nextVis === 'visible' ? "Majengo ya 3D Yamewashwa!" : "Majengo ya 3D Yamezimwa");
    }
  };

  // Toggle Data Saver Mode
  const toggleDataSaver = () => {
    setDataSaverMode(prev => {
      const next = !prev;
      if (next) {
        setActiveEngineKey('lite_saver');
        setBuildings3DEnabled(false);
        toast.success("🍃 Hali ya Bando Kidogo Imewashwa: Uokoaji wa 84% wa bando!");
      } else {
        setActiveEngineKey('vector_liberty');
        setBuildings3DEnabled(true);
        toast.info("⚡ Ramani ya Vekta ya Kasi Kamili Imewashwa");
      }
      return next;
    });
  };

  // Reset North (0°)
  const resetNorth = () => {
    if (!mapInstanceRef.current) return;
    setIsHeadingUp(false);
    mapInstanceRef.current.easeTo({
      bearing: 0,
      duration: 500
    });
    setBearing(0);
    toast.success("🧭 Kaskazini Juu (0°) imesawazishwa!");
  };

  // Teleport to Hotspot
  const teleport = (spot: typeof DAR_HOTSPOTS[0]) => {
    setActiveHotspot(spot);
    setShowHotspotsDrawer(false);
    setAutoFollow(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: spot.lngLat,
        zoom: spot.zoom,
        pitch: spot.pitch,
        bearing: spot.bearing,
        duration: 1800
      });
      setPitch(spot.pitch);
      setBearing(spot.bearing);
      toast.info(`🏙️ Umefika: ${spot.name}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-neutral-950 overflow-hidden select-none touch-none flex flex-col font-sans">
      {/* -------------------------------------------------------------
          TOP HEADER BAR (CLEAN, ORGANIZED & RESPONSIVE)
          ------------------------------------------------------------- */}
      <div className="absolute top-0 left-0 right-0 z-30 p-2.5 sm:p-4 flex items-center justify-between pointer-events-none gap-2">
        {/* Left: Branding & Current Landmark */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onClose}
            className="h-10 px-3 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 hover:bg-white active:scale-95 transition-all cursor-pointer font-black text-xs uppercase"
            title="Rudi Ramani ya 2D"
          >
            <X className="w-4 h-4 text-rose-500" />
            <span className="hidden sm:inline">2D</span>
          </button>

          <div className="px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-[11px] shadow-sm">
              3D
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tight">MapLibre GL</span>
                <span className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full ${dataSaverMode ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                  {activeEngine.tag}
                </span>
              </div>
              <p className="text-[9.5px] text-neutral-500 font-medium truncate max-w-[120px] sm:max-w-[200px]">
                {activeHotspot.name}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Alternative Routes & Detour Selector Button */}
          <button
            onClick={() => setShowRoutesDrawer(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg transition-all cursor-pointer active:scale-95 ${
              showRoutesDrawer
                ? 'bg-blue-600 text-white shadow-blue-950/40 ring-2 ring-blue-400/50'
                : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800'
            }`}
            title="Chagua Njia Mbadala (Alternative Routes & Reroute)"
          >
            <Route className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Njia Mbadala</span>
          </button>

          {/* Data Saver Mode Pill */}
          <button
            onClick={toggleDataSaver}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg transition-all cursor-pointer active:scale-95 ${
              dataSaverMode 
                ? 'bg-emerald-600 text-white shadow-emerald-950/40 ring-2 ring-emerald-400/50' 
                : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
            }`}
            title="Hali ya Kubana Bando (Data Saver)"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{dataSaverMode ? 'Bando Kidogo' : 'Saver'}</span>
          </button>

          {/* Terrain & Surface Analyzer Toggle */}
          <button
            onClick={() => setShowTerrainDrawer(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg transition-all cursor-pointer active:scale-95 ${
              showTerrainDrawer
                ? 'bg-amber-500 text-slate-950 shadow-amber-950/40'
                : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800'
            }`}
            title="Kukokotoa Hali ya Trafiki na Miinuko"
          >
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Trafiki</span>
          </button>

          {/* Test Sample Request Trigger */}
          {!incomingRequest && !activeRide && (
            <button
              onClick={triggerSampleRequest}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-orange-600 text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-orange-950/30 active:scale-95 transition-all cursor-pointer"
              title="Jaribu kuona mteja akirekwesti"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span className="hidden lg:inline">Jaribu Ombi</span>
            </button>
          )}

          {/* Hotspots Modal Drawer Trigger */}
          <button
            onClick={() => setShowHotspotsDrawer(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-800 font-black text-[11px] uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer border border-neutral-700"
          >
            <MapPin className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Maeneo DSM</span>
          </button>
        </div>
      </div>

      {/* Main MapLibre WebGL Canvas Container */}
      <div 
        ref={mapContainerRef} 
        className="relative flex-1 w-full h-full"
      />

      {/* REROUTING NOTICE BANNER (INAKOKOTOA UPYA NJIA) */}
      <AnimatePresence>
        {isReroutingNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 border-2 border-white pointer-events-auto"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Umechepuka! Inakokotoa upya njia...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          ACTIVE TRIP TURN-BY-TURN GUIDANCE BANNER
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {activeRide && !incomingRequest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 sm:top-20 inset-x-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-30 pointer-events-auto"
          >
            <div className="p-3 sm:p-3.5 rounded-2xl bg-neutral-950/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl text-white space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0">
                    <Navigation className="w-4 h-4 rotate-45" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 block">
                      {activeRide.status === 'arrived' ? 'Umefika kwa Mteja' : `Njia #${selectedRouteIndex + 1} inaendelea`}
                    </span>
                    <p className="text-xs font-bold text-white truncate">
                      {customDestination?.name || activeRide.destinationAddress || activeRide.destination?.address || 'Kuelekea Eneo la Safari'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-black text-emerald-400 block">
                    TZS {(customDestination?.fare || activeRide.price || activeRide.fare || 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-400 block">
                    {activeRide.customerInfo?.name || 'Mteja'}
                  </span>
                </div>
              </div>

              {!isTurnBarMinimized && (
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 text-[10px]">
                  <div className="p-1.5 rounded-lg bg-white/5">
                    <span className="text-[8px] text-neutral-400 block">Mwinuko wa Njia</span>
                    <strong className="text-white font-mono">{currentTerrain.altitude}m ASL</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white/5">
                    <span className="text-[8px] text-neutral-400 block">Hali ya Trafiki</span>
                    <strong className="text-emerald-400 font-mono">Nyepesi</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white/5">
                    <span className="text-[8px] text-neutral-400 block">Uso wa Barabara</span>
                    <strong className="text-amber-400 font-mono truncate">Lami Safi</strong>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          RICH 3D INCOMING RIDE REQUEST CARD (MTU AKIREKWESTI USAFIRI)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {incomingRequest && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="absolute bottom-22 inset-x-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-40 p-4 sm:p-5 rounded-3xl bg-neutral-950/95 backdrop-blur-2xl border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-white space-y-3.5 pointer-events-auto"
          >
            {/* Header: Status and Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> Ombi Jipya la Safari Liko Hapa!
                </span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black">
                <Clock className="w-3.5 h-3.5" />
                <span>{requestTimeLeft}s</span>
              </div>
            </div>

            {/* Customer & Price Card */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-lg font-black text-white shadow-md">
                  {incomingRequest.customerInfo?.name?.[0] || 'M'}
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-tight">
                    {incomingRequest.customerInfo?.name || 'Mteja wa Papo Hapo'}
                  </h4>
                  <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                    <span>⭐ {incomingRequest.customerInfo?.rating || '4.9'}</span>
                    <span>• {incomingRequest.paymentMethod || 'M-Pesa'}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[8.5px] font-bold text-neutral-400 uppercase tracking-widest block">Nauli (Fare)</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  TZS {(incomingRequest.price || incomingRequest.fare || 14500).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Journey Addresses */}
            <div className="space-y-1.5 text-xs bg-black/40 p-2.5 rounded-xl border border-white/5">
              <div className="flex items-start gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black">
                  A
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase text-emerald-400 block">Kuanzia (Pickup):</span>
                  <p className="text-neutral-200 font-bold truncate text-[11px]">
                    {incomingRequest.pickupAddress || incomingRequest.pickup?.address || 'Eneo la Mteja'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t border-white/5 pt-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black">
                  B
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase text-red-400 block">Kuelekea (Destination):</span>
                  <p className="text-neutral-200 font-bold truncate text-[11px]">
                    {customDestination?.name || incomingRequest.destinationAddress || incomingRequest.destination?.address || 'Mwisho wa Safari'}
                  </p>
                </div>
              </div>
            </div>

            {/* Route & Traffic Info */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[8px] text-neutral-400 font-bold uppercase block">Umbali</span>
                <strong className="text-white font-mono">{incomingRequest.distance || '5.2'} km • 12 dk</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[8px] text-neutral-400 font-bold uppercase block">Trafiki</span>
                <strong className="text-emerald-400 font-mono">Nyepesi (45 km/h)</strong>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[8px] text-neutral-400 font-bold uppercase block">Uso Barabara</span>
                <strong className="text-amber-400 font-mono truncate">92% Lami Safi</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  if (simulatedRequest) setSimulatedRequest(null);
                  onDeclineRide?.(incomingRequest);
                }}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Kataa
              </button>
              <button
                type="button"
                onClick={() => {
                  if (simulatedRequest) setSimulatedRequest(null);
                  toast.success("✅ Safari imepokelewa! Mwongozo wa 3D unaanza...");
                  onAcceptRide?.();
                }}
                className="flex-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Pokea Safari Sasa</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          FLOATING RIGHT CONTROLS RAIL
          ------------------------------------------------------------- */}
      <div className="absolute right-3 sm:right-4 top-20 z-30 flex flex-col gap-1.5 pointer-events-auto">
        {/* Zoom In (+) */}
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-white active:scale-95 transition-all cursor-pointer"
          title="Zoom In (+)"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Zoom Out (-) */}
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-white active:scale-95 transition-all cursor-pointer"
          title="Zoom Out (-)"
        >
          <Minus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Recenter to Vehicle */}
        {!autoFollow && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={recenterToDriver}
            className="w-10 h-10 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-950/40 flex items-center justify-center active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-400 animate-pulse"
            title="🎯 Rejea Kwenye Gari (Auto-Follow)"
          >
            <Crosshair className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        )}

        {/* 360° Compass */}
        <button
          onClick={resetNorth}
          className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex flex-col items-center justify-center hover:bg-white active:scale-95 transition-all cursor-pointer"
          title="Kaskazini Juu (Reset North 0°)"
        >
          <Compass 
            className="w-4 h-4 text-orange-600 transition-transform duration-300" 
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
          <span className="text-[7.5px] font-mono font-black text-neutral-700 dark:text-neutral-300">
            {bearing}°
          </span>
        </button>

        {/* 3D Pitch Tilt Toggle */}
        <button
          onClick={() => {
            const nextPitch = pitch >= 60 ? 0 : 60;
            setPitch(nextPitch);
            mapInstanceRef.current?.easeTo({ pitch: nextPitch, duration: 400 });
            toast.info(nextPitch > 0 ? "Mwinuko wa 3D: 60°" : "Mwinuko wa 2D: 0°");
          }}
          className={`w-10 h-10 rounded-2xl backdrop-blur-md border shadow-xl flex flex-col items-center justify-center font-black text-xs transition-all cursor-pointer ${pitch > 0 ? 'bg-orange-600 text-white border-orange-500' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-300 border-neutral-200'}`}
          title="Badili Mwinuko wa 3D (Pitch Toggle)"
        >
          <span>3D</span>
          <span className="text-[7px] font-mono font-normal">{pitch}°</span>
        </button>

        {/* 3D Building Extrusions Toggle */}
        <button
          onClick={toggle3DBuildings}
          className={`w-10 h-10 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${buildings3DEnabled ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-400 border-neutral-200'}`}
          title="Washa/Zima Majengo ya 3D (3D Buildings)"
        >
          <Building2 className="w-4 h-4" />
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => {
            setSoundEnabled(prev => {
              const next = !prev;
              toast.info(next ? "Sauti ya Kengele Imewashwa 🔔" : "Sauti Imezimwa 🔇");
              return next;
            });
          }}
          className={`w-10 h-10 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${soundEnabled ? 'bg-white/95 dark:bg-neutral-900/95 text-emerald-500 border-neutral-200' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-400 border-neutral-200'}`}
          title="Sauti ya Kengele ya Maombi"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Heading-Up Toggle */}
        <button
          onClick={() => {
            setIsHeadingUp(prev => {
              const nxt = !prev;
              toast.info(nxt ? "🧭 Kufuata Mwelekeo (Heading-Up)" : "🧭 Kaskazini Juu (North-Up)");
              return nxt;
            });
          }}
          className={`w-10 h-10 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${isHeadingUp ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-700 border-neutral-200'}`}
          title="Heading-Up (Kufuata Mwelekeo wa Gari)"
        >
          <Navigation className="w-4 h-4 rotate-45" />
        </button>
      </div>

      {/* -------------------------------------------------------------
          BOTTOM SPEEDOMETER & DOCK
          ------------------------------------------------------------- */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Driver Telemetry Card */}
        <div className="p-2 sm:p-2.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-2xl flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md">
            {vehicleType === 'bike' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                {driverName}
              </h4>
              <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase ${isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
              Namba: <strong className="text-neutral-800 dark:text-neutral-200">{licensePlate}</strong> • {currentTerrain.altitude}m ASL
            </p>
          </div>

          <div className="pl-3 border-l border-neutral-200 dark:border-neutral-800 text-right">
            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest block">Kasi</span>
            <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
              {speed} <span className="text-[10px] font-normal text-neutral-500">km/h</span>
            </span>
          </div>
        </div>

        {/* Right: Data Rate Pill & Return Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-2 rounded-xl bg-neutral-950/80 backdrop-blur-md border border-white/10 text-neutral-300 text-[10.5px] font-mono hidden md:flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>{activeEngine.dataRate}</span>
          </div>

          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 text-white font-black text-xs uppercase tracking-wider shadow-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-neutral-700"
          >
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <span>Rudi Ramani ya 2D</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          ALTERNATIVE ROUTES & DETOUR SELECTION DRAWER
          (NINI KINATOKEA MTU AKIBADILISHA NJIA)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {showRoutesDrawer && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-lg bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 max-h-[85vh] overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-blue-500" />
                    <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                      Mtu Akibadilisha Njia (Rerouting Engine)
                    </h3>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Mstari wa njia unaong'aa unajirekebisha kiotomatiki kwa sekunde 0.5
                  </p>
                </div>
                <button
                  onClick={() => setShowRoutesDrawer(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Explanatory Banner */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-900/20 to-emerald-900/20 border border-blue-500/20 text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-3.5 h-3.5" /> Jinsi Mfumo Unavyofanya Kazi:
                </p>
                <p className="text-[11px] text-neutral-500">
                  1. <strong>Dereva akichepuka (Off-Route):</strong> GPS inatambua mara moja na kuchora upya mstari unaong'aa kutoka pale gari lilipo kuelekea mwisho.
                </p>
                <p className="text-[11px] text-neutral-500">
                  2. <strong>Mteja akibadilisha eneo:</strong> Pini ya mwisho 🏁 inasogea na mstari unaong'aa unajikokotoa papo hapo.
                </p>
              </div>

              {/* 3 Alternative Route Choices */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200 block">
                  Chagua Njia Unayotaka Kuitumia:
                </span>

                {/* Route 1: Fastest Highway */}
                <button
                  onClick={() => {
                    setSelectedRouteIndex(0);
                    setShowRoutesDrawer(false);
                    playAlertChime('reroute');
                    toast.success("✅ Njia Kuu imechaguliwa (Haraka Zaidi)!");
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    selectedRouteIndex === 0
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm">
                      1
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">
                          Njia Kuu (Nelson Mandela Rd)
                        </span>
                        <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600">
                          Haraka Zaidi 🚀
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        5.2 km • ~12 dakika • Mstari wa Kijani (#10B981)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">12 dk</span>
                  </div>
                </button>

                {/* Route 2: Detour via Tabata */}
                <button
                  onClick={() => {
                    setSelectedRouteIndex(1);
                    setShowRoutesDrawer(false);
                    playAlertChime('reroute');
                    toast.success("✅ Njia ya Tabata Kisiwani imechaguliwa (Kuepuka Foleni)!");
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    selectedRouteIndex === 1
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-500/30'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm">
                      2
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">
                          Kupitia Tabata Kisiwani
                        </span>
                        <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600">
                          Epuka Foleni 🍃
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        5.8 km • ~14 dakika • Mstari wa Njano (#F59E0B)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">14 dk</span>
                  </div>
                </button>

                {/* Route 3: Sam Nujoma BRT Corridor */}
                <button
                  onClick={() => {
                    setSelectedRouteIndex(2);
                    setShowRoutesDrawer(false);
                    playAlertChime('reroute');
                    toast.success("✅ Njia ya Sam Nujoma & BRT imechaguliwa!");
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    selectedRouteIndex === 2
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/30'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                      3
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">
                          Kupitia Sam Nujoma & BRT
                        </span>
                        <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-600">
                          Njia Ndefu Wazi
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        6.4 km • ~16 dakika • Mstari wa Bluu (#3B82F6)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">16 dk</span>
                  </div>
                </button>
              </div>

              {/* Simulation Testing Buttons */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                  Majaribio ya Moja kwa Moja (Live Test Actions):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShowRoutesDrawer(false);
                      triggerSimulatedReroute();
                    }}
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Jaribu Mchepuko</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowRoutesDrawer(false);
                      triggerChangeDestination();
                    }}
                    className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CornerUpRight className="w-3.5 h-3.5" />
                    <span>Badili Mwisho wa Safari</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          TERRAIN & ROAD SURFACE ANALYSIS DRAWER
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {showTerrainDrawer && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-3.5 max-h-[85vh] overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                      Hali ya Trafiki na Miinuko ya DSM
                    </h3>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Kukokotoa uso wa barabara, mwinuko, na msongamano wa magari
                  </p>
                </div>
                <button
                  onClick={() => setShowTerrainDrawer(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Live Traffic Congestion Calculation */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span className="text-[11px] font-black uppercase text-neutral-900 dark:text-white">
                      Msongamano wa Trafiki
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    currentTerrain.congestionLevel === 'nyepesi' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    currentTerrain.congestionLevel === 'wastani' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {currentTerrain.congestionLevel === 'nyepesi' ? '🟢 Nyepesi (Smooth)' :
                     currentTerrain.congestionLevel === 'wastani' ? '🟡 Wastani' :
                     '🔴 Nzito (Foleni)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[9px] text-neutral-500 block">Kasi ya Wastani</span>
                    <strong className="text-sm font-black font-mono text-neutral-900 dark:text-white">
                      {currentTerrain.avgTrafficSpeed} km/h
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[9px] text-neutral-500 block">Kuchelewa kwa Foleni</span>
                    <strong className="text-sm font-black font-mono text-amber-500">
                      +{currentTerrain.delayMinutes} dakika
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. Terrain Elevation & Slope Profile */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Mountain className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-black uppercase text-neutral-900 dark:text-white">
                      Mwinuko wa Ardhi (Elevation & Slope)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">
                    {currentTerrain.altitude}m Juu ya Bahari
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[9px] text-neutral-500 block">Mwinuko / Mteremko</span>
                    <strong className="text-xs font-black font-mono text-neutral-900 dark:text-white">
                      {currentTerrain.slope} {currentTerrain.isUphill ? '↗️ Panda' : '↘️ Shuka'}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[9px] text-neutral-500 block">Athari ya Mafuta / Betri</span>
                    <strong className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {currentTerrain.fuelImpact}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 3. Road Surface Quality Breakdown */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-[11px] font-black uppercase text-neutral-900 dark:text-white">
                      Uso wa Barabara
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-500">
                    {currentTerrain.surfaceQuality}% Bora
                  </span>
                </div>

                <div className="text-[11px] space-y-1 text-neutral-700 dark:text-neutral-300">
                  <p>🛣️ <strong>Aina:</strong> {currentTerrain.surfaceType}</p>
                  <p>⚠️ <strong>Vizingiti:</strong> {currentTerrain.hasBumps ? 'Vizingiti vipo kwenye mitaa' : 'Barabara safi haina vizuizi'}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          DAR ES SALAAM HOTSPOTS DRAWER
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {showHotspotsDrawer && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-3 max-h-[85vh] overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                    Maeneo ya 3D ya Dar es Salaam
                  </h3>
                  <p className="text-[11px] text-neutral-500">MapLibre GL Vector & Majengo ya 3D</p>
                </div>
                <button
                  onClick={() => setShowHotspotsDrawer(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {DAR_HOTSPOTS.map((spot, sIdx) => (
                  <button
                    key={`ml-spot-${spot.id}-${sIdx}`}
                    onClick={() => teleport(spot)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${activeHotspot.id === spot.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'}`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">{spot.name}</span>
                        <span className="text-[9px] font-mono text-blue-500">({spot.altitude}m)</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{spot.desc}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
