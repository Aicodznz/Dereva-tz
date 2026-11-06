import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Compass, Eye, Sun, Moon, Sunset, Layers, 
  Car, Bike, Navigation, Volume2, VolumeX, X, 
  MapPin, Building2, Check, ArrowUpRight, Sparkles,
  Activity, AlertTriangle, ShieldCheck, Zap, Gauge,
  Mountain, Wifi, WifiOff, Phone, Fuel, ChevronDown,
  ChevronUp, Play, Radio, ArrowRight, Clock, DollarSign
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
  // Vector Tile PBF - High speed, 75% data saving
  vector_liberty: {
    id: 'vector_liberty',
    name: 'Vekta ya Kasi (Liberty)',
    tag: '⚡ Vekta PBF',
    dataRate: '22 KB/s',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    supports3D: true,
    isDataSaver: false
  },
  // Lite Data Saver - Ultra compressed, minimal bandwidth for 2G/3G mobile networks
  lite_saver: {
    id: 'lite_saver',
    name: 'Bando Kidogo Sana (Lite Saver)',
    tag: '🍃 84% Bando',
    dataRate: '8 KB/s',
    url: 'https://tiles.openfreemap.org/styles/positron',
    supports3D: false,
    isDataSaver: true
  },
  // High Contrast Bright Vector
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
  // Dar es Salaam terrain profile: Low at coast (~2m), rises towards Mbezi/Kimara (~140m)
  // Distance from ocean (roughly lng: 39.29 is coast, 39.18 is inland hills)
  const inlandFactor = Math.max(0, (39.29 - lng) * 100);
  const estimatedAltitude = Math.round(Math.max(3, inlandFactor * 8.5 + (Math.sin(lat * 50) * 12)));
  
  // Slope calculation
  const slopePercent = (estimatedAltitude > 60 ? (estimatedAltitude * 0.05).toFixed(1) : (estimatedAltitude * 0.035).toFixed(1));
  const isUphill = estimatedAltitude > 25;

  // Road surface estimation based on zones
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

  // Traffic congestion calculation based on time and area
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

  // Fuel / Energy efficiency impact
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

// Generate realistic interpolated road coordinates between points
function generateRoadPath(start: [number, number], end: [number, number], points = 10): [number, number][] {
  const coords: [number, number][] = [start];
  for (let i = 1; i < points; i++) {
    const t = i / points;
    const midLng = start[0] + (end[0] - start[0]) * t;
    const midLat = start[1] + (end[1] - start[1]) * t;
    const offset = Math.sin(t * Math.PI) * 0.0018 * (i % 2 === 0 ? 1 : -0.8);
    coords.push([midLng + offset * 0.6, midLat + offset]);
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
  const routeSourceAddedRef = useRef<boolean>(false);

  // Simulated Test Request state for immediate testing
  const [simulatedRequest, setSimulatedRequest] = useState<any | null>(null);
  const incomingRequest = externalIncomingRequest || simulatedRequest;

  // Active Tile Engine
  const [activeEngineKey, setActiveEngineKey] = useState<keyof typeof TILE_ENGINES>('vector_liberty');
  const activeEngine = TILE_ENGINES[activeEngineKey];

  // Camera & Map State
  const [pitch, setPitch] = useState<number>(55);
  const [bearing, setBearing] = useState<number>(0);
  const [isHeadingUp, setIsHeadingUp] = useState<boolean>(true);
  const [buildings3DEnabled, setBuildings3DEnabled] = useState<boolean>(true);
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(false);

  // Analyzer Panels
  const [showTerrainDrawer, setShowTerrainDrawer] = useState<boolean>(false);
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState<boolean>(false);
  const [activeHotspot, setActiveHotspot] = useState(DAR_HOTSPOTS[0]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Request countdown timer (30s)
  const [requestTimeLeft, setRequestTimeLeft] = useState<number>(30);

  // Live Terrain & Surface Data for current position
  const currentTerrain = calculateTerrainAnalysis(center[1] || 39.2384, center[0] || -6.8163);

  // Audio Chime synthesizer for ride requests
  const playAlertChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.24); // G5
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now + 0.24);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
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

    playAlertChime();
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
    toast.success("🔔 Ombi la safari la majaribio limetumwa!");
  };

  // Convert lat/lng to MapLibre [lng, lat]
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.easeTo({
        center: [center[1], center[0]],
        duration: 800
      });
    }
  }, [center[0], center[1]]);

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
      maxPitch: 85
    });

    mapInstanceRef.current = map;
    routeSourceAddedRef.current = false;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('rotate', () => {
      setBearing(Math.round(map.getBearing()));
    });

    map.on('pitch', () => {
      setPitch(Math.round(map.getPitch()));
    });

    map.on('load', () => {
      // 1. Add 3D Extruded Buildings Layer from OpenFreeMap vector tiles (if supported by engine)
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

      // 2. Add Route GeoJSON Source for Request / Active Navigation
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
              'line-width': 9,
              'line-opacity': 0.85
            }
          });

          // Inner Vibrant Neon Route Line
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
              'line-width': 5,
              'line-opacity': 0.95
            }
          });

          routeSourceAddedRef.current = true;
        }
      } catch (err) {
        console.warn("Route source notice:", err);
      }

      // 3. Add Driver 3D Vehicle Marker
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

  // Update vehicle heading & position
  useEffect(() => {
    if (!driverMarkerRef.current || !mapInstanceRef.current) return;
    const lngLat: [number, number] = [center[1], center[0]];
    driverMarkerRef.current.setLngLat(lngLat);

    if (isHeadingUp) {
      mapInstanceRef.current.easeTo({
        center: lngLat,
        bearing: vehicleHeading || 0,
        pitch: pitch,
        duration: 400
      });
    }
  }, [center[0], center[1], vehicleHeading, isHeadingUp, pitch]);

  // -------------------------------------------------------------
  // DYNAMIC 3D ROUTE DRAWING & VISUALIZATION FOR INCOMING/ACTIVE RIDE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentTarget = incomingRequest || activeRide;

    if (!currentTarget) {
      // Clear route line and markers
      try {
        const source = map.getSource('active-route-source') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] }
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

    // 2. Destination Point
    const dLat = currentTarget.destination?.lat || (Array.isArray(currentTarget.destination) ? currentTarget.destination[0] : null);
    const dLng = currentTarget.destination?.lng || (Array.isArray(currentTarget.destination) ? currentTarget.destination[1] : null);

    if (pLat && pLng) {
      const pickupLngLat: [number, number] = [pLng, pLat];

      // Create or update Pickup Marker with pulsing wave
      if (!customerMarkerRef.current) {
        const custEl = document.createElement('div');
        custEl.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              position: absolute;
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: rgba(16, 185, 129, 0.35);
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              background: #10B981;
              color: white;
              font-weight: 900;
              font-size: 11px;
              padding: 5px 10px;
              border-radius: 14px;
              border: 2px solid white;
              box-shadow: 0 8px 20px rgba(0,0,0,0.45);
              display: flex;
              align-items: center;
              gap: 5px;
              z-index: 10;
            ">
              <span>👤</span> ${currentTarget.customerInfo?.name || 'Mteja Anangoja'}
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #10B981;"></div>
          </div>
        `;
        customerMarkerRef.current = new maplibregl.Marker({ element: custEl })
          .setLngLat(pickupLngLat)
          .addTo(map);
      } else {
        customerMarkerRef.current.setLngLat(pickupLngLat);
      }

      // Create or update Destination Marker
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
                padding: 5px 10px;
                border-radius: 14px;
                border: 2px solid white;
                box-shadow: 0 8px 20px rgba(0,0,0,0.45);
                display: flex;
                align-items: center;
                gap: 5px;
              ">
                <span>🏁</span> ${currentTarget.destinationAddress || currentTarget.destination?.address || 'Mwisho wa Safari'}
              </div>
              <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #EF4444;"></div>
            </div>
          `;
          destMarkerRef.current = new maplibregl.Marker({ element: destEl })
            .setLngLat(destLngLat)
            .addTo(map);
        } else {
          destMarkerRef.current.setLngLat(destLngLat);
        }

        // Generate full journey path: Driver -> Pickup -> Destination
        const path1 = generateRoadPath(driverLngLat, pickupLngLat, 8);
        const path2 = generateRoadPath(pickupLngLat, destLngLat, 12);
        const fullPath = [...path1, ...path2.slice(1)];

        try {
          const source = map.getSource('active-route-source') as maplibregl.GeoJSONSource;
          if (source) {
            source.setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: fullPath
              }
            });
          }
        } catch {
          // Source pending
        }

        // Auto Frame Camera to show Driver, Pickup, and Destination in 3D perspective
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(driverLngLat);
        bounds.extend(pickupLngLat);
        bounds.extend(destLngLat);

        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 180, left: 60, right: 60 },
          pitch: 50,
          maxZoom: 16.5,
          duration: 1600
        });
      }
    }
  }, [incomingRequest, activeRide]);

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
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: spot.lngLat,
        zoom: spot.zoom,
        pitch: spot.pitch,
        bearing: spot.bearing,
        duration: 2000
      });
      setPitch(spot.pitch);
      setBearing(spot.bearing);
      toast.info(`🏙️ Umefika: ${spot.name}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-neutral-900 overflow-hidden select-none touch-none flex flex-col">
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
        {/* Left: Branding & Current Landmark */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button
            onClick={onClose}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-white active:scale-95 transition-all cursor-pointer"
            title="Rudi Ramani ya Kawaida (2D)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md">
              ML
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tight">MapLibre GL 3D</span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${dataSaverMode ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                  {activeEngine.tag}
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-medium truncate max-w-[150px] sm:max-w-[240px]">
                {activeHotspot.name}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Data Saver Mode Pill */}
          <button
            onClick={toggleDataSaver}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl transition-all cursor-pointer active:scale-95 ${
              dataSaverMode 
                ? 'bg-emerald-600 text-white shadow-emerald-950/40 ring-2 ring-emerald-400/50' 
                : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
            }`}
            title="Hali ya Kubana Bando (Data Saver)"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{dataSaverMode ? 'Bando Kidogo (84%)' : 'Bando Saver'}</span>
          </button>

          {/* Terrain & Surface Analyzer Toggle */}
          <button
            onClick={() => setShowTerrainDrawer(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl transition-all cursor-pointer active:scale-95 ${
              showTerrainDrawer
                ? 'bg-amber-500 text-slate-950 shadow-amber-950/40 font-black'
                : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800'
            }`}
            title="Kukokotoa Hali ya Trafiki na Miinuko (Terrain & Road Analysis)"
          >
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Trafiki & Miinuko</span>
          </button>

          {/* Test Sample Request Trigger (Jaribu Ombi la Safari) */}
          {!incomingRequest && !activeRide && (
            <button
              onClick={triggerSampleRequest}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-orange-950/30 active:scale-95 transition-all cursor-pointer"
              title="Jaribu kuona jinsi mteja akirekwesti inavyoonekana kwenye 3D"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span className="hidden lg:inline">Jaribu Ombi</span>
            </button>
          )}

          {/* Hotspots Modal Drawer Trigger */}
          <button
            onClick={() => setShowHotspotsDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-800 font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer border border-neutral-700"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Maeneo ya DSM</span>
          </button>
        </div>
      </div>

      {/* Main MapLibre WebGL Canvas Container */}
      <div 
        ref={mapContainerRef} 
        className="relative flex-1 w-full h-full"
      />

      {/* -------------------------------------------------------------
          RICH 3D INCOMING RIDE REQUEST CARD (MTU AKIREKWESTI USAFIRI)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {incomingRequest && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="absolute bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[500px] z-50 p-4 sm:p-5 rounded-3xl bg-neutral-950/95 backdrop-blur-2xl border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-white space-y-4 pointer-events-auto"
          >
            {/* Header: Status and Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> Ombi Jipya la Safari Liko Hapa!
                </span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black">
                <Clock className="w-3.5 h-3.5" />
                <span>{requestTimeLeft}s</span>
              </div>
            </div>

            {/* Customer & Price Card */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-xl font-black text-white shadow-md">
                  {incomingRequest.customerInfo?.name?.[0] || 'M'}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">
                    {incomingRequest.customerInfo?.name || 'Mteja wa Papo Hapo'}
                  </h4>
                  <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                    <span>⭐ {incomingRequest.customerInfo?.rating || '4.9'}</span>
                    <span>• {incomingRequest.paymentMethod || 'M-Pesa / PapoCredit'}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Nauli (Fare)</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  TZS {(incomingRequest.price || incomingRequest.fare || 14500).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Journey Addresses & Route Distance */}
            <div className="space-y-2 text-xs bg-black/40 p-3 rounded-2xl border border-white/5">
              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                  A
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-400 block">Kuanzia (Pickup):</span>
                  <p className="text-neutral-200 font-bold truncate">
                    {incomingRequest.pickupAddress || incomingRequest.pickup?.address || 'Eneo la Mteja'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 border-t border-white/5 pt-2">
                <div className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                  B
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-red-400 block">Kuelekea (Destination):</span>
                  <p className="text-neutral-200 font-bold truncate">
                    {incomingRequest.destinationAddress || incomingRequest.destination?.address || 'Mwisho wa Safari'}
                  </p>
                </div>
              </div>
            </div>

            {/* Terrain & Surface Summary Badge on Request */}
            <div className="grid grid-cols-3 gap-2 text-[10.5px]">
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
                <span className="text-[9px] text-neutral-400 font-bold uppercase">Umbali & Muda</span>
                <strong className="text-white font-mono mt-0.5">
                  {incomingRequest.distance || '5.2'} km • ~12 dk
                </strong>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
                <span className="text-[9px] text-neutral-400 font-bold uppercase">Hali ya Trafiki</span>
                <strong className="text-emerald-400 font-mono mt-0.5">
                  Nyepesi (45 km/h)
                </strong>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex flex-col">
                <span className="text-[9px] text-neutral-400 font-bold uppercase">Uso wa Barabara</span>
                <strong className="text-amber-400 font-mono mt-0.5 truncate">
                  92% Lami Nzuri
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (simulatedRequest) setSimulatedRequest(null);
                  onDeclineRide?.(incomingRequest);
                }}
                className="flex-1 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
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
                className="flex-2 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Pokea Safari Sasa</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          ACTIVE TRIP TURN-BY-TURN GUIDANCE OVERLAY (WAKATI WA SAFARI)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {activeRide && !incomingRequest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-18 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-30 p-3.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl text-white pointer-events-auto flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-base shadow-md">
                <Navigation className="w-5 h-5 rotate-45" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 block">
                  {activeRide.status === 'arrived' ? 'Umefika kwa Mteja' : 'Njia ya 3D inaendelea...'}
                </span>
                <p className="text-xs font-bold text-white truncate max-w-[220px]">
                  {activeRide.destinationAddress || activeRide.destination?.address || 'Kuelekea Eneo la Mteja'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono font-black text-emerald-400">
                TZS {(activeRide.price || activeRide.fare || 0).toLocaleString()}
              </span>
              <span className="text-[9px] text-neutral-400 block">
                {activeRide.customerInfo?.name || 'Mteja'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Controls HUD on Right */}
      <div className="absolute right-3 sm:right-4 top-20 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* 360° Compass */}
        <button
          onClick={resetNorth}
          className="w-11 h-11 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex flex-col items-center justify-center hover:bg-white active:scale-95 transition-all group cursor-pointer"
          title="Kaskazini Juu (Reset North 0°)"
        >
          <Compass 
            className="w-5 h-5 text-orange-600 transition-transform duration-300" 
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
          <span className="text-[8px] font-mono font-black text-neutral-700 dark:text-neutral-300 mt-0.5">
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
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex flex-col items-center justify-center font-black text-xs transition-all cursor-pointer ${pitch > 0 ? 'bg-orange-600 text-white border-orange-500' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-300 border-neutral-200'}`}
          title="Badili Mwinuko wa 3D (Pitch Toggle)"
        >
          <span>3D</span>
          <span className="text-[7.5px] font-mono font-normal">{pitch}°</span>
        </button>

        {/* 3D Building Extrusions Toggle */}
        <button
          onClick={toggle3DBuildings}
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${buildings3DEnabled ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-400 border-neutral-200'}`}
          title="Washa/Zima Majengo ya 3D (3D Buildings)"
        >
          <Building2 className="w-5 h-5" />
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
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${soundEnabled ? 'bg-white/95 dark:bg-neutral-900/95 text-emerald-500 border-neutral-200' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-400 border-neutral-200'}`}
          title="Sauti ya Kengele ya Maombi"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
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
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${isHeadingUp ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-700 border-neutral-200'}`}
          title="Heading-Up (Kufuata Mwelekeo wa Gari)"
        >
          <Navigation className="w-5 h-5 rotate-45" />
        </button>
      </div>

      {/* Bottom Driver Speedometer & HUD Card */}
      <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pointer-events-none">
        {/* Left: Driver Telemetry & Active Status */}
        <div className="p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 shadow-2xl flex items-center justify-between sm:justify-start gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-950/30">
              {vehicleType === 'bike' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                  {driverName}
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                Namba: <strong className="text-neutral-800 dark:text-neutral-200">{licensePlate}</strong> • Mwinuko: <strong>{currentTerrain.altitude}m</strong>
              </p>
            </div>
          </div>

          <div className="pl-4 border-l border-neutral-200 dark:border-neutral-800 text-right">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Kasi (Speed)</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {speed} <span className="text-xs font-normal text-neutral-500">km/h</span>
            </span>
          </div>
        </div>

        {/* Right: Quick Action Return Button & Info */}
        <div className="flex items-center justify-end gap-2 pointer-events-auto">
          {/* Data Saver Counter Pill */}
          <div className="px-3 py-2.5 rounded-2xl bg-neutral-950/80 backdrop-blur-md border border-white/10 text-neutral-300 text-[11px] font-mono hidden md:flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Matumizi: <strong>{activeEngine.dataRate}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="h-12 px-5 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-neutral-950/40 flex items-center gap-2 active:scale-95 transition-all cursor-pointer border border-neutral-700"
          >
            <Layers className="w-4 h-4" />
            <span>Rudi Ramani ya 2D</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          KUKOKOTOA HALI YA TRAFIKI NA MIINUKO (TERRAIN & SURFACE DRAWER)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {showTerrainDrawer && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-lg bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 max-h-[85vh] overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                      Hali ya Trafiki na Miinuko ya DSM
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Kukokotoa uso wa barabara, mwinuko, na msongamano wa magari
                  </p>
                </div>
                <button
                  onClick={() => setShowTerrainDrawer(false)}
                  className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. Live Traffic Congestion Calculation */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black uppercase text-neutral-900 dark:text-white tracking-wide">
                      Msongamano wa Trafiki (Live Traffic Index)
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    currentTerrain.congestionLevel === 'nyepesi' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    currentTerrain.congestionLevel === 'wastani' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {currentTerrain.congestionLevel === 'nyepesi' ? '🟢 Nyepesi (Smooth)' :
                     currentTerrain.congestionLevel === 'wastani' ? '🟡 Wastani (Moderate)' :
                     '🔴 Nzito (Congested)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Kasi ya Wastani ya Trafiki</span>
                    <strong className="text-base font-black font-mono text-neutral-900 dark:text-white">
                      {currentTerrain.avgTrafficSpeed} km/h
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Kuchelewa kwa Foleni</span>
                    <strong className="text-base font-black font-mono text-amber-500">
                      +{currentTerrain.delayMinutes} dakika
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. Terrain Elevation & Slope Profile */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-black uppercase text-neutral-900 dark:text-white tracking-wide">
                      Mwinuko wa Ardhi (Elevation & Slope)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">
                    {currentTerrain.altitude}m Juu ya Bahari
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Mwinuko / Mteremko (Slope)</span>
                    <strong className="text-sm font-black font-mono text-neutral-900 dark:text-white">
                      {currentTerrain.slope} {currentTerrain.isUphill ? '↗️ Panda' : '↘️ Shuka'}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Athari ya Mafuta / Betri</span>
                    <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {currentTerrain.fuelImpact}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 3. Road Surface Quality Breakdown */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-black uppercase text-neutral-900 dark:text-white tracking-wide">
                      Uso wa Barabara (Road Surface Quality)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-500">
                    {currentTerrain.surfaceQuality}% Bora
                  </span>
                </div>

                <div className="text-xs space-y-1 text-neutral-700 dark:text-neutral-300">
                  <p>🛣️ <strong>Aina ya Barabara:</strong> {currentTerrain.surfaceType}</p>
                  <p>⚠️ <strong>Vizingiti / Mashimo:</strong> {currentTerrain.hasBumps ? 'Vizingiti vipo kwenye maeneo ya makazi' : 'Hakuna vizuizi vilivyoripotiwa'}</p>
                  {currentTerrain.flyoverNearby && (
                    <p>🌉 <strong>Madaraja / BRT:</strong> Karibu na njia kuu ya BRT Mwendo Kasi</p>
                  )}
                </div>
              </div>

              {/* 4. Tile Engine & Data Saver Switcher */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">
                    Uchaguzi wa Tabaka za Ramani (Tile Engine)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-500">
                    Bando Saver
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setActiveEngineKey('vector_liberty');
                      setDataSaverMode(false);
                      toast.info("⚡ Vekta ya Kasi (Liberty) Imewashwa");
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      activeEngineKey === 'vector_liberty' && !dataSaverMode
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <span className="text-xs font-black block">⚡ Vekta ya Kasi PBF</span>
                    <span className="text-[10px] text-neutral-500">22 KB/s • 3D Kamili</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveEngineKey('lite_saver');
                      setDataSaverMode(true);
                      toast.success("🍃 Bando Kidogo Sana (Lite Saver) Imewashwa!");
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      dataSaverMode
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <span className="text-xs font-black block">🍃 Bando Kidogo Sana</span>
                    <span className="text-[10px] text-neutral-500">8 KB/s • 84% Okoa Bando</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dar es Salaam Hotspots Drawer */}
      <AnimatePresence>
        {showHotspotsDrawer && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 max-h-[85vh] overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                    Maeneo ya 3D ya Dar es Salaam
                  </h3>
                  <p className="text-xs text-neutral-500">MapLibre GL Vector & Majengo ya 3D</p>
                </div>
                <button
                  onClick={() => setShowHotspotsDrawer(false)}
                  className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {DAR_HOTSPOTS.map((spot, sIdx) => (
                  <button
                    key={`ml-spot-${spot.id}-${sIdx}`}
                    onClick={() => teleport(spot)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${activeHotspot.id === spot.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">{spot.name}</span>
                        <span className="text-[9px] font-mono text-blue-500">({spot.altitude}m)</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{spot.desc}</p>
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
