import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DaladalaRoute, DaladalaVehicle, DaladalaStop } from '../../types/daladala.types';
import { 
  Navigation, 
  Compass, 
  Layers, 
  Bus, 
  Filter, 
  Eye, 
  EyeOff, 
  Check, 
  Sparkles,
  MapPin,
  ChevronRight,
  Plus,
  Minus,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Tile Layer configurations - 100% Free, reliable tile servers with NO API keys or watermarks
type MapTileStyle = 'hot' | 'light' | 'osm' | 'satellite';

const MAP_TILES: Record<MapTileStyle, { name: string; url: string; attribution: string; maxZoom?: number }> = {
  hot: {
    name: 'Mitaa ya Kisasa (OSM Humanitarian)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, HOT',
    maxZoom: 19,
  },
  light: {
    name: 'Wazi & Minimal (Canvas Light)',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 16,
  },
  osm: {
    name: 'OpenStreetMap Asili',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    name: 'Picha za Anga (Satellite Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar',
    maxZoom: 18,
  },
};

/**
 * Creates an authentic, aerodynamic Tanzanian Daladala Bus Marker
 */
const createModernBusIcon = (
  vehicle: DaladalaVehicle, 
  isSelected: boolean,
  isDisplaced: boolean = false,
  isOwnerVehicle: boolean = false
) => {
  const routeColor = vehicle.colorHex || '#2563eb';
  
  // Status color logic
  const statusColor = 
    vehicle.seatStatus === 'available' ? '#10b981' :
    vehicle.seatStatus === 'few' ? '#f59e0b' :
    vehicle.seatStatus === 'standing' ? '#f97316' : '#ef4444';

  const seatsLeft = Math.max(0, vehicle.capacity - vehicle.seatsTaken);
  const statusText = 
    vehicle.seatStatus === 'available' ? `${seatsLeft} Viti` :
    vehicle.seatStatus === 'few' ? `${seatsLeft} Viti` :
    vehicle.seatStatus === 'standing' ? 'Msimamo' : 'FULL';

  // Rotation heading angle for direction arrow
  const headingAngle = vehicle.heading || 0;

  if (!isSelected) {
    // 🚏 SLEEK COMPACT MARKER (Prevents visual clutter, overlap & sticker pile-up)
    const shortPlate = vehicle.plateNumber.replace(/^T\s*/, '');
    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; z-index: ${isOwnerVehicle ? 250 : 100};">
        ${isOwnerVehicle ? `
          <div style="
            position: absolute;
            top: -8px;
            background: #f59e0b;
            color: #000;
            border-radius: 9999px;
            font-size: 8px;
            font-weight: 900;
            padding: 0 4px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            white-space: nowrap;
          ">YANGU</div>
        ` : ''}
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          background: #ffffff;
          border: ${isOwnerVehicle ? '2.5px solid #f59e0b' : `1.5px solid ${routeColor}`};
          border-radius: 9999px;
          padding: 2px 5px 2px 2px;
          gap: 3.5px;
          box-shadow: ${isOwnerVehicle ? '0 0 10px rgba(245,158,11,0.6)' : '0 2px 6px rgba(0,0,0,0.18)'};
          cursor: pointer;
          white-space: nowrap;
          transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        ">
          <!-- Mini Colored Bus Disc with Heading Direction -->
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 9999px;
            background: ${routeColor};
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            position: relative;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
              <path d="M4 11h16"/>
              <path d="M6 18v2"/>
              <path d="M18 18v2"/>
            </svg>
          </div>

          <!-- Short plate / Route badge -->
          <span style="
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 9.5px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1;
            letter-spacing: -0.02em;
          ">
            ${shortPlate}
          </span>

          <!-- Tiny Seat Status Dot -->
          <span style="
            width: 5.5px;
            height: 5.5px;
            border-radius: 50%;
            background: ${statusColor};
            display: inline-block;
            flex-shrink: 0;
          "></span>
        </div>

        <!-- Tiny Minimal Pin Tail -->
        <div style="
          width: 0;
          height: 0;
          border-left: 3.5px solid transparent;
          border-right: 3.5px solid transparent;
          border-top: 3.5px solid ${routeColor};
          margin-top: -1px;
        "></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'daladala-bus-marker-compact',
      iconSize: [60, 26],
      iconAnchor: [30, 24],
    });
  }

  // 🌟 EXPANDED / SELECTED MARKER (Elevated, Detailed & Glowing)
  const html = `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; z-index: 500;">
      <!-- Live Selected Radar Glow -->
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 62px;
        height: 62px;
        border-radius: 9999px;
        background: rgba(37, 99, 235, 0.25);
        border: 2px solid #2563eb;
        animation: daladalaRadarPing 2s infinite;
        pointer-events: none;
      "></div>

      <!-- Main Daladala Marker Body -->
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 2px solid #2563eb;
        border-radius: 9999px;
        padding: 3px 8px 3px 4px;
        gap: 6px;
        box-shadow: 0 10px 25px -3px rgba(37, 99, 235, 0.5), 0 4px 10px rgba(0,0,0,0.25);
        transform: scale(1.15);
        cursor: pointer;
        white-space: nowrap;
      ">
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: ${routeColor};
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          flex-shrink: 0;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
            <path d="M4 11h16"/>
            <path d="M6 18v2"/>
            <path d="M18 18v2"/>
            <circle cx="8" cy="14" r="1.5"/>
            <circle cx="16" cy="14" r="1.5"/>
          </svg>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1;">
          <div style="display: flex; align-items: center; gap: 3px;">
            <span style="
              font-family: ui-monospace, SFMono-Regular, monospace;
              font-size: 10px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: 0.04em;
            ">
              ${vehicle.plateNumber}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 3px; margin-top: 1.5px;">
            <span style="
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: ${statusColor};
              display: inline-block;
            "></span>
            <span style="
              font-size: 8.5px;
              font-weight: 800;
              color: #475569;
              letter-spacing: 0.02em;
            ">
              ${statusText}
            </span>
          </div>
        </div>
      </div>

      <!-- Pointer Stem / Pin Tail -->
      <div style="
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid #2563eb;
        margin-top: -1px;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'daladala-bus-marker selected',
    iconSize: [90, 44],
    iconAnchor: [45, 40],
  });
};

/**
 * Creates modern, clean Bus Stop icons (Terminal vs Local vs Boarding/Alight Highlights)
 */
const createModernStopIcon = (stop: DaladalaStop, isBoarding: boolean = false, isAlight: boolean = false) => {
  if (isBoarding) {
    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          background: #059669;
          color: #ffffff;
          padding: 2px 7px;
          border-radius: 9999px;
          font-size: 9px;
          font-weight: 900;
          box-shadow: 0 4px 10px rgba(5,150,105,0.4);
          white-space: nowrap;
          border: 1.5px solid #ffffff;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 3px;
        ">
          <span>📍 Kupandia</span>
        </div>
        <div style="
          width: 14px;
          height: 14px;
          background: #10b981;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(16,185,129,0.35);
        "></div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'daladala-stop-marker boarding',
      iconSize: [80, 40],
      iconAnchor: [40, 36],
    });
  }

  if (isAlight) {
    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          background: #ea580c;
          color: #ffffff;
          padding: 2px 7px;
          border-radius: 9999px;
          font-size: 9px;
          font-weight: 900;
          box-shadow: 0 4px 10px rgba(234,88,12,0.4);
          white-space: nowrap;
          border: 1.5px solid #ffffff;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 3px;
        ">
          <span>🏁 Kushukia</span>
        </div>
        <div style="
          width: 14px;
          height: 14px;
          background: #f97316;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(249,115,22,0.35);
        "></div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'daladala-stop-marker alight',
      iconSize: [80, 40],
      iconAnchor: [40, 36],
    });
  }

  if (stop.isTerminal) {
    // Stendi Kuu (Main Terminal)
    const html = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        background: #ea580c;
        color: #ffffff;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
          <path d="M4 11h16"/>
        </svg>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'daladala-stop-marker terminal',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  // Local transit stop node
  const html = `
    <div style="
      width: 11px;
      height: 11px;
      background: #ffffff;
      border: 2.5px solid #2563eb;
      border-radius: 50%;
      box-shadow: 0 2px 5px rgba(0,0,0,0.25);
      cursor: pointer;
      transition: transform 0.2s ease;
    "></div>
  `;

  return L.divIcon({
    html,
    className: 'daladala-stop-marker',
    iconSize: [11, 11],
    iconAnchor: [5.5, 5.5],
  });
};

interface DaladalaMapProps {
  routes: DaladalaRoute[];
  vehicles: DaladalaVehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (v: DaladalaVehicle) => void;
  selectedRouteId: string | null;
  onSelectStop?: (stop: DaladalaStop) => void;
  onSetBoardingStop?: (stopName: string) => void;
  onSetAlightStop?: (stopName: string) => void;
  boardingStopName?: string;
  alightStopName?: string;
  userCoords?: { lat: number; lng: number } | null;
  resizeTrigger?: any;
  isEdgeToEdge?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenRoutePlanner?: () => void;
  isOwnerLoggedIn?: boolean;
  ownerPlates?: string[];
  filterOwnerOnly?: boolean;
  onToggleOwnerOnly?: () => void;
}

// Controller to auto-pan ONLY when a new vehicle is selected by user
function MapRecenter({ 
  selectedVehicleId, 
  vehicles 
}: { 
  selectedVehicleId: string | null; 
  vehicles: DaladalaVehicle[] 
}) {
  const map = useMap();
  const lastPanVehicleIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only pan to vehicle when user actively clicks/selects a vehicle or changes to a different one
    if (selectedVehicleId && selectedVehicleId !== lastPanVehicleIdRef.current) {
      lastPanVehicleIdRef.current = selectedVehicleId;
      const veh = vehicles.find((v) => v.id === selectedVehicleId);
      if (veh) {
        map.flyTo([veh.currentLat, veh.currentLng], 14, { duration: 1.0 });
      }
    } else if (!selectedVehicleId) {
      lastPanVehicleIdRef.current = null;
    }
  }, [selectedVehicleId, map, vehicles]);

  return null;
}

// Ensures Leaflet recalculates tile dimensions when map container resizes
function MapResizeInvalidator({ resizeTrigger }: { resizeTrigger: any }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [resizeTrigger, map]);
  return null;
}

export default function DaladalaMap({
  routes,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  selectedRouteId,
  onSelectStop,
  onSetBoardingStop,
  onSetAlightStop,
  boardingStopName,
  alightStopName,
  userCoords,
  resizeTrigger,
  isEdgeToEdge = true,
  isFullscreen,
  onToggleFullscreen,
  onOpenRoutePlanner,
  isOwnerLoggedIn = false,
  ownerPlates = [],
  filterOwnerOnly = false,
  onToggleOwnerOnly,
}: DaladalaMapProps) {
  // Tile layer style state (Default to clean, colorful Humanitarian OpenStreetMap)
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('hot');
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

  // Map Filter: Active Route selection directly on map
  const [mapRouteFilter, setMapRouteFilter] = useState<string>('all');
  const [showStops, setShowStops] = useState(true);

  // Sync internal map filter with parent selectedRouteId if provided
  useEffect(() => {
    if (selectedRouteId) {
      setMapRouteFilter(selectedRouteId);
    }
  }, [selectedRouteId]);

  const defaultCenter: [number, number] = [-6.8140, 39.2450]; // Central Dar es Salaam

  // Filter routes based on route selector
  const activeRoutes = useMemo(() => {
    if (mapRouteFilter === 'all') return routes;
    return routes.filter((r) => r.id === mapRouteFilter);
  }, [routes, mapRouteFilter]);

  // Filter vehicles based on active routes
  const filteredVehicles = useMemo(() => {
    if (mapRouteFilter === 'all') return vehicles;
    return vehicles.filter((v) => v.routeId === mapRouteFilter);
  }, [vehicles, mapRouteFilter]);

  /**
   * 🚗 Intelligent De-clustering & Staggering Algorithm:
   * When multiple Daladalas are clustered closely (e.g. at Kivukoni, Kariakoo, Mwenge),
   * they fan out in an arc/circle so every marker is clearly legible and clickable!
   */
  const displayedVehicles = useMemo(() => {
    const proximityThreshold = 0.0035; // ~380 meters
    const clusters: DaladalaVehicle[][] = [];
    const visited = new Set<string>();

    filteredVehicles.forEach((veh) => {
      if (visited.has(veh.id)) return;
      const cluster = [veh];
      visited.add(veh.id);

      filteredVehicles.forEach((other) => {
        if (visited.has(other.id)) return;
        const d = Math.hypot(veh.currentLat - other.currentLat, veh.currentLng - other.currentLng);
        if (d < proximityThreshold) {
          cluster.push(other);
          visited.add(other.id);
        }
      });

      clusters.push(cluster);
    });

    return clusters.flatMap((cluster) => {
      if (cluster.length <= 1) {
        return cluster.map((v) => ({
          vehicle: v,
          renderLat: v.currentLat,
          renderLng: v.currentLng,
          isDisplaced: false,
        }));
      }

      // Displace radially with gentle stagger
      const radius = 0.0024; // ~260 meters offset
      return cluster.map((v, idx) => {
        const angle = (2 * Math.PI * idx) / cluster.length;
        return {
          vehicle: v,
          renderLat: v.currentLat + Math.sin(angle) * radius,
          renderLng: v.currentLng + Math.cos(angle) * radius * 1.15,
          isDisplaced: true,
        };
      });
    });
  }, [filteredVehicles]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  return (
    <div className={`relative w-full h-full overflow-hidden ${isEdgeToEdge ? 'rounded-none' : 'rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-inner'}`}>
      {/* 🧭 Unified Map Header Bar: Route Selector on Left, Action Buttons on Right (Never overlapping!) */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between gap-1.5 sm:gap-2 pointer-events-none">
        {/* Left: Route Filter Pills */}
        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-1 overflow-x-auto scrollbar-none pointer-events-auto flex-1 min-w-0">
          <button
            onClick={() => setMapRouteFilter('all')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
              mapRouteFilter === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <span>Ruti Zote</span>
            <span className="text-[10px] opacity-75 font-normal">({vehicles.length})</span>
          </button>

          {/* Owner-specific Quick Filter: Only show owner's vehicles */}
          {isOwnerLoggedIn && ownerPlates.length > 0 && onToggleOwnerOnly && (
            <button
              type="button"
              onClick={onToggleOwnerOnly}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                filterOwnerOnly
                  ? 'bg-amber-500 text-neutral-950 ring-2 ring-amber-300 shadow-md font-black'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 hover:bg-amber-200 border border-amber-300 dark:border-amber-800'
              }`}
              title="Onyesha magari yako pekee kwenye ramani"
            >
              <span>👑 Gari Zangu Tu</span>
              <span className="text-[10px] opacity-90 font-mono font-black">({ownerPlates.length})</span>
            </button>
          )}

          {routes.map((route) => {
            const count = vehicles.filter((v) => v.routeId === route.id).length;
            const isSelected = mapRouteFilter === route.id;
            return (
              <button
                key={route.id}
                onClick={() => setMapRouteFilter(isSelected ? 'all' : route.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: route.color }} 
                />
                <span>{route.routeCode}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Right: Map Actions (Kioo Kizima & Panga Ruti) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pointer-events-auto">
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl shadow-xl backdrop-blur-md text-xs font-black flex items-center gap-1 border transition active:scale-95 ${
                isFullscreen 
                  ? 'bg-orange-600 text-white border-orange-500' 
                  : 'bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700 hover:bg-white'
              }`}
              title={isFullscreen ? 'Toka Kioo Kizima (Exit Fullscreen)' : 'Fungua Kioo Kizima (Full Screen)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline font-bold">Toka Kioo</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline font-bold">Kioo Kizima</span>
                </>
              )}
            </button>
          )}

          {onOpenRoutePlanner && (
            <button
              type="button"
              onClick={onOpenRoutePlanner}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl text-xs font-black flex items-center gap-1 transition active:scale-95"
              title="Panga Ruti (Route Planner)"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">Panga Ruti</span>
            </button>
          )}
        </div>
      </div>

      {/* 🗺️ Floating Map Layers & Centering Tools (Bottom-Right) */}
      <div className="absolute bottom-5 right-3 z-[400] flex flex-col items-end gap-2 pointer-events-none">
        {/* Tile Style Picker Popup */}
        {isStyleMenuOpen && (
          <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 pointer-events-auto mb-1 space-y-1 w-48 text-xs animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1 text-[10px] font-black uppercase text-neutral-400 tracking-wider">
              Muonekano wa Ramani
            </div>
            {(Object.keys(MAP_TILES) as MapTileStyle[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setTileStyle(key);
                  setIsStyleMenuOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl text-left font-bold flex items-center justify-between transition ${
                  tileStyle === key
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                }`}
              >
                <span>{MAP_TILES[key].name}</span>
                {tileStyle === key && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Zoom In & Out Controls */}
          <div className="flex items-center bg-white/95 dark:bg-neutral-900/95 rounded-xl shadow-xl backdrop-blur-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <button
              onClick={() => {
                const mapEl = (window as any).__papoDaladalaMap;
                if (mapEl) mapEl.zoomIn();
              }}
              className="p-2.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition border-r border-neutral-200 dark:border-neutral-800"
              title="Kuza Ramani (Zoom In)"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const mapEl = (window as any).__papoDaladalaMap;
                if (mapEl) mapEl.zoomOut();
              }}
              className="p-2.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              title="Punguza Ukubwa (Zoom Out)"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle Stops Marker Button */}
          <button
            onClick={() => setShowStops(!showStops)}
            className={`p-2.5 rounded-xl shadow-xl backdrop-blur-md border transition ${
              showStops 
                ? 'bg-white/95 dark:bg-neutral-900/95 text-blue-600 border-neutral-200 dark:border-neutral-800' 
                : 'bg-neutral-200/90 dark:bg-neutral-800/90 text-neutral-400 border-transparent'
            }`}
            title={showStops ? 'Ficha Vituo vya Mabasi' : 'Onyesha Vituo vya Mabasi'}
          >
            {showStops ? <MapPin className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Switch Map Style Layer Button */}
          <button
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
            className="p-2.5 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-200 shadow-xl backdrop-blur-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 transition"
            title="Badili Aina ya Ramani (Layer Style)"
          >
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>

          {/* User Location Center */}
          {userCoords && (
            <button
              onClick={() => {
                const mapEl = (window as any).__papoDaladalaMap;
                if (mapEl) {
                  mapEl.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 1.1 });
                }
              }}
              className="p-2.5 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-blue-600 dark:text-blue-400 shadow-xl backdrop-blur-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 transition"
              title="Nielekeze Nilipo (My GPS Location)"
            >
              <Navigation className="w-4 h-4" />
            </button>
          )}

          {/* Fit Dar es Salaam View */}
          <button
            onClick={() => {
              const mapEl = (window as any).__papoDaladalaMap;
              if (mapEl) {
                mapEl.flyTo(defaultCenter, 12, { duration: 1.1 });
              }
            }}
            className="p-2.5 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-300 shadow-xl backdrop-blur-md border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 transition"
            title="Onyesha Dar es Salaam Yote"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
        zoomControl={false}
        ref={(instance) => {
          if (instance) {
            (window as any).__papoDaladalaMap = instance;
          }
        }}
      >
        <MapResizeInvalidator resizeTrigger={resizeTrigger} />

        {/* Selected Tile Layer Style */}
        <TileLayer
          attribution={MAP_TILES[tileStyle].attribution}
          url={MAP_TILES[tileStyle].url}
          maxZoom={MAP_TILES[tileStyle]?.maxZoom || 19}
        />

        <MapRecenter selectedVehicleId={selectedVehicleId} vehicles={vehicles} />

        {/* Polylines for Daladala Routes */}
        {activeRoutes.map((route) => {
          const isSelected = selectedRouteId === route.id || mapRouteFilter === route.id;
          return (
            <React.Fragment key={route.id}>
              {/* Outer soft glowing casing line for selected route */}
              {isSelected && (
                <Polyline
                  positions={route.pathCoordinates}
                  pathOptions={{
                    color: route.color,
                    weight: 9,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Core Route Line */}
              <Polyline
                positions={route.pathCoordinates}
                pathOptions={{
                  color: route.color,
                  weight: isSelected ? 5 : 3.5,
                  opacity: isSelected ? 0.95 : 0.6,
                  dashArray: isSelected ? undefined : '5, 5',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5 p-0.5">
                    <span 
                      className="px-1.5 py-0.5 rounded text-white text-[10px] font-black"
                      style={{ backgroundColor: route.color }}
                    >
                      {route.routeCode}
                    </span>
                    <span>{route.name}</span>
                  </div>
                </Tooltip>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* Bus Stops (Stendi & Vituo) */}
        {showStops && activeRoutes.flatMap((route) =>
          route.stops.map((stop) => {
            const isBoarding = Boolean(
              boardingStopName && 
              stop.name.toLowerCase().includes(boardingStopName.trim().toLowerCase())
            );
            const isAlight = Boolean(
              alightStopName && 
              stop.name.toLowerCase().includes(alightStopName.trim().toLowerCase())
            );

            return (
              <Marker
                key={`${route.id}-${stop.id}`}
                position={[stop.lat, stop.lng]}
                icon={createModernStopIcon(stop, isBoarding, isAlight)}
                eventHandlers={{
                  click: () => onSelectStop && onSelectStop(stop),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[180px] space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: stop.isTerminal ? '#ea580c' : '#2563eb' }}
                      />
                      <h4 className="font-black text-xs text-neutral-900">{stop.name}</h4>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-semibold">
                      {stop.isTerminal ? 'Stendi Kuu (Terminal)' : `Kituo cha abiria (${stop.zone || 'Dar'})`}
                    </p>
                    <div className="text-[10px] text-neutral-600 bg-neutral-100 p-1.5 rounded-lg flex items-center justify-between font-mono">
                      <span>Ruti:</span>
                      <strong className="text-blue-700">{route.routeCode}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-1">
                      {onSetBoardingStop && (
                        <button
                          type="button"
                          onClick={() => onSetBoardingStop(stop.name)}
                          className={`text-white font-bold text-[10px] py-1 px-1.5 rounded-lg transition text-center ${
                            isBoarding ? 'bg-emerald-700 font-black ring-1 ring-emerald-400' : 'bg-emerald-600 hover:bg-emerald-500'
                          }`}
                        >
                          📍 Kupandia
                        </button>
                      )}
                      {onSetAlightStop && (
                        <button
                          type="button"
                          onClick={() => onSetAlightStop(stop.name)}
                          className={`text-white font-bold text-[10px] py-1 px-1.5 rounded-lg transition text-center ${
                            isAlight ? 'bg-orange-700 font-black ring-1 ring-orange-400' : 'bg-orange-600 hover:bg-orange-500'
                          }`}
                        >
                          🏁 Kushukia
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        )}

        {/* 🚌 Moving Daladala Vehicles with Intelligent De-clustering */}
        {displayedVehicles.map(({ vehicle: v, renderLat, renderLng, isDisplaced }) => {
          const isSelected = v.id === selectedVehicleId;
          return (
            <Marker
              key={v.id}
              position={[renderLat, renderLng]}
              icon={createModernBusIcon(v, isSelected, isDisplaced)}
              eventHandlers={{
                click: () => onSelectVehicle(v),
              }}
            >
              <Popup>
                <div className="p-1.5 min-w-[230px] space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100">
                    <div className="flex items-center gap-1.5">
                      <span className="tz-number-plate text-xs font-black">{v.plateNumber}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        {v.routeCode}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-500">{v.speedKmH} km/h</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-neutral-900 italic">"{v.nickname}"</h4>
                    <p className="text-[11px] text-neutral-600 font-semibold mt-0.5">{v.routeName}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      Kuelekea: <strong className="text-neutral-800">{v.nextStopName}</strong> (Dk {v.etaMinutesToNextStop})
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-neutral-100">
                    <span className="text-neutral-500">Hali ya Viti:</span>
                    <span className={`font-black uppercase ${
                      v.seatStatus === 'available' ? 'text-emerald-600' :
                      v.seatStatus === 'few' ? 'text-amber-600' :
                      v.seatStatus === 'standing' ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {v.seatStatus === 'available' ? `${v.capacity - v.seatsTaken} Viti Wazi` : v.seatStatus}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectVehicle(v)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-2 rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <span>Fungua Safari & Tiketi</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* User Current Location Marker */}
        {userCoords && (
          <Marker
            position={[userCoords.lat, userCoords.lng]}
            icon={L.divIcon({
              html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(37, 99, 235, 0.25); animation: daladalaRadarPing 1.8s infinite; position: absolute;"></div>
                  <div style="width: 14px; height: 14px; border-radius: 50%; background: #2563eb; border: 2.5px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>
                </div>
              `,
              className: 'user-location-marker',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
          >
            <Tooltip>Uko Hapa (Dar es Salaam)</Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
