import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Compass, Eye, Sun, Moon, Sunset, Layers, 
  Car, Bike, Navigation, Volume2, VolumeX, X, 
  MapPin, Building2, Check, ArrowUpRight, Sparkles
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

// 100% Free OpenFreeMap styles (Zero API key, zero watermark, full vector 3D buildings)
const FREE_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron'
};

const DAR_HOTSPOTS = [
  {
    id: 'mabibo-mandela',
    name: 'Nelson Mandela Rd & Mabibo Relini',
    lngLat: [39.2384, -6.8163] as [number, number],
    desc: 'Barabara ya Mandela, Reli ya Tazara & Tabata',
    pitch: 58,
    bearing: 42,
    zoom: 16.5
  },
  {
    id: 'tabata-kisiwani',
    name: 'Tabata Kisiwani & Kamoti St',
    lngLat: [39.2431, -6.8225] as [number, number],
    desc: 'Mtaa wa Kamoti, Mgasa & Chanzi',
    pitch: 62,
    bearing: 35,
    zoom: 17
  },
  {
    id: 'sam-nujoma',
    name: 'Sam Nujoma Rd & Mlimani City',
    lngLat: [39.2198, -6.7725] as [number, number],
    desc: 'Mlimani City Mall & UDSM Campus',
    pitch: 55,
    bearing: -20,
    zoom: 16
  },
  {
    id: 'posta-cbd',
    name: 'Posta City Centre & Samora Ave',
    lngLat: [39.2890, -6.8160] as [number, number],
    desc: 'Maghorofa marefu ya benki kuu na bandari',
    pitch: 60,
    bearing: 65,
    zoom: 16.5
  },
  {
    id: 'kariakoo',
    name: 'Kariakoo Market & Morogoro Rd',
    lngLat: [39.2745, -6.8198] as [number, number],
    desc: 'Soko kuu la Kariakoo na barabara ya BRT',
    pitch: 56,
    bearing: 15,
    zoom: 16.5
  }
];

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
  incomingRequest,
  onAcceptRide,
  onDeclineRide,
  theme = 'light'
}: MapLibre3DViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const customerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [activeStyle, setActiveStyle] = useState<'liberty' | 'bright' | 'positron'>('liberty');
  const [pitch, setPitch] = useState<number>(55);
  const [bearing, setBearing] = useState<number>(0);
  const [isHeadingUp, setIsHeadingUp] = useState<boolean>(true);
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState<boolean>(false);
  const [activeHotspot, setActiveHotspot] = useState(DAR_HOTSPOTS[0]);
  const [buildings3DEnabled, setBuildings3DEnabled] = useState<boolean>(true);

  // Convert lat/lng to MapLibre [lng, lat]
  const currentLngLat = useRef<[number, number]>([center[1], center[0]]);
  useEffect(() => {
    currentLngLat.current = [center[1], center[0]];
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
      style: FREE_STYLES[activeStyle],
      center: [initialLng, initialLat],
      zoom: 16.5,
      pitch: pitch,
      bearing: isHeadingUp ? (vehicleHeading || 0) : 0,
      attributionControl: false,
      maxPitch: 85
    });

    mapInstanceRef.current = map;

    // Add navigation control
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('rotate', () => {
      setBearing(Math.round(map.getBearing()));
    });

    map.on('pitch', () => {
      setPitch(Math.round(map.getPitch()));
    });

    map.on('load', () => {
      // Add 3D Extruded Buildings Layer from OpenFreeMap vector tiles
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(l => l.type === 'symbol' && (l.layout as any)?.['text-field'])?.id;

      try {
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

      // Add Driver 3D Vehicle Marker
      const driverEl = document.createElement('div');
      driverEl.className = 'maplibre-driver-marker';
      driverEl.innerHTML = `
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ea580c, #f59e0b);
          border: 3px solid #ffffff;
          box-shadow: 0 8px 20px rgba(0,0,0,0.45);
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
  }, [activeStyle]);

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

  // Handle active ride pickup/destination pins
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (activeRide && activeRide.pickup) {
      const pLat = activeRide.pickup.lat || activeRide.pickup[0];
      const pLng = activeRide.pickup.lng || activeRide.pickup[1];
      if (pLat && pLng) {
        if (!customerMarkerRef.current) {
          const custEl = document.createElement('div');
          custEl.innerHTML = `
            <div style="
              background: #10B981;
              color: white;
              font-weight: 900;
              font-size: 11px;
              padding: 4px 8px;
              border-radius: 12px;
              border: 2px solid white;
              box-shadow: 0 6px 16px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span>👤</span> ${activeRide.customerInfo?.name || 'Mteja'}
            </div>
          `;
          customerMarkerRef.current = new maplibregl.Marker({ element: custEl })
            .setLngLat([pLng, pLat])
            .addTo(map);
        } else {
          customerMarkerRef.current.setLngLat([pLng, pLat]);
        }
      }
    } else if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }

    if (activeRide && activeRide.destination) {
      const dLat = activeRide.destination.lat || activeRide.destination[0];
      const dLng = activeRide.destination.lng || activeRide.destination[1];
      if (dLat && dLng) {
        if (!destMarkerRef.current) {
          const destEl = document.createElement('div');
          destEl.innerHTML = `
            <div style="
              background: #EF4444;
              color: white;
              font-weight: 900;
              font-size: 11px;
              padding: 4px 8px;
              border-radius: 12px;
              border: 2px solid white;
              box-shadow: 0 6px 16px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span>🏁</span> ${activeRide.destinationName || 'Mwisho wa Safari'}
            </div>
          `;
          destMarkerRef.current = new maplibregl.Marker({ element: destEl })
            .setLngLat([dLng, dLat])
            .addTo(map);
        } else {
          destMarkerRef.current.setLngLat([dLng, dLat]);
        }
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [activeRide]);

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
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  OpenSource WebGL
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-medium truncate max-w-[170px] sm:max-w-[260px]">
                {activeHotspot.name}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Style Switcher */}
          <div className="flex items-center bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl p-1 border border-neutral-200 dark:border-neutral-800 shadow-xl">
            <button
              onClick={() => setActiveStyle('liberty')}
              className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${activeStyle === 'liberty' ? 'bg-orange-600 text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-300'}`}
              title="Mtindo wa Rangi (Liberty)"
            >
              Rangi
            </button>
            <button
              onClick={() => setActiveStyle('positron')}
              className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${activeStyle === 'positron' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-300'}`}
              title="Kijivu Safi (Positron)"
            >
              Kijivu
            </button>
          </div>

          {/* Hotspots Modal Drawer Trigger */}
          <button
            onClick={() => setShowHotspotsDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-orange-950/30 active:scale-95 transition-all cursor-pointer"
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

      {/* Real Live Incoming Ride Request Alert inside MapLibre 3D View */}
      <AnimatePresence>
        {incomingRequest && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="absolute top-16 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-50 p-4 rounded-3xl bg-neutral-900/95 backdrop-blur-xl border-2 border-emerald-500 shadow-2xl text-white space-y-3 pointer-events-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Ombi la Safari Mpya Liko Hapa! 🔔
                </span>
              </div>
              <span className="text-sm font-black font-mono text-emerald-400">
                TZS {(incomingRequest.price || incomingRequest.fare || 12000).toLocaleString()}
              </span>
            </div>

            <div className="text-xs text-neutral-300 space-y-1">
              <p>📍 <strong>Kuanzia:</strong> {incomingRequest.pickupAddress || incomingRequest.pickupName || 'Eneo la Mteja'}</p>
              <p>🏁 <strong>Kuelekea:</strong> {incomingRequest.destinationAddress || incomingRequest.destName || 'Mwisho wa Safari'}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onDeclineRide?.(incomingRequest)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase cursor-pointer"
              >
                Kataa
              </button>
              <button
                type="button"
                onClick={() => onAcceptRide?.()}
                className="flex-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Pokea Safari Sasa ✅
              </button>
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

        {/* 3D Pitch Tilt Slider / Button */}
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
                Namba: <strong className="text-neutral-800 dark:text-neutral-200">{licensePlate}</strong> • Mwelekeo: <strong>{vehicleHeading}°</strong>
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
          <button
            onClick={onClose}
            className="h-12 px-5 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-neutral-950/40 flex items-center gap-2 active:scale-95 transition-all cursor-pointer border border-neutral-700"
          >
            <Layers className="w-4 h-4" />
            <span>Rudi Ramani ya 2D</span>
          </button>
        </div>
      </div>

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
                  className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center"
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
