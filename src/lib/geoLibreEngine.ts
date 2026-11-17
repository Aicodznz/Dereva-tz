import type * as mapboxgl from 'mapbox-gl';
import { CITY_HEAT_ZONES, HeatZone } from '../components/map/AISmartHeatMap';

let geoLibreInitialized = false;

/**
 * Legacy compatibility hook (mapbox-gl manages its own isolated Web Worker pool cleanly without global classRegistry collisions).
 */
export function ensureMapLibreGeoLibreSetup(): void {
  if (geoLibreInitialized || typeof window === 'undefined') return;
  geoLibreInitialized = true;
}

export type GeoLibreBasemapId =
  | 'street_3d'
  | 'satellite'
  | 'night'
  | 'lite'
  | 'bright';

export interface GeoLibreBasemapConfig {
  id: GeoLibreBasemapId;
  name: string;
  shortLabel: string;
  tag: string;
  dataRate: string;
  supports3D: boolean;
  isDark: boolean;
  isDataSaver: boolean;
  style: string | mapboxgl.StyleSpecification;
}

/**
 * Custom ESRI World Imagery Satellite + Reference Labels style (Zero API key required).
 */
export const SATELLITE_HYBRID_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  name: 'GeoLibre Satellite Hybrid',
  sources: {
    'esri-world-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri, Maxar, Earthstar Geographics',
    },
    'esri-labels': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri',
    },
  },
  layers: [
    {
      id: 'satellite-imagery-layer',
      type: 'raster',
      source: 'esri-world-imagery',
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: 'satellite-labels-layer',
      type: 'raster',
      source: 'esri-labels',
      minzoom: 8,
      maxzoom: 22,
      paint: {
        'raster-opacity': 0.92,
      },
    },
  ],
};

export const GEOLIBRE_BASEMAPS: Record<GeoLibreBasemapId, GeoLibreBasemapConfig> = {
  street_3d: {
    id: 'street_3d',
    name: 'Mitaa & Majengo 3D',
    shortLabel: 'Mitaa 3D',
    tag: '3D Vekta',
    dataRate: '22 KB/s',
    supports3D: true,
    isDark: false,
    isDataSaver: false,
    style: 'https://tiles.openfreemap.org/styles/liberty',
  },
  satellite: {
    id: 'satellite',
    name: 'Satelaiti (Angani)',
    shortLabel: 'Satelaiti',
    tag: 'Angani HD',
    dataRate: '34 KB/s',
    supports3D: false,
    isDark: true,
    isDataSaver: false,
    style: SATELLITE_HYBRID_STYLE,
  },
  night: {
    id: 'night',
    name: 'Usiku (Night Mode)',
    shortLabel: 'Usiku',
    tag: 'Usiku',
    dataRate: '18 KB/s',
    supports3D: false,
    isDark: true,
    isDataSaver: false,
    style: 'https://tiles.openfreemap.org/styles/dark',
  },
  lite: {
    id: 'lite',
    name: 'Bando Kidogo (Data Saver)',
    shortLabel: 'Bando Kidogo',
    tag: 'Okoa 84%',
    dataRate: '8 KB/s',
    supports3D: false,
    isDark: false,
    isDataSaver: true,
    style: 'https://tiles.openfreemap.org/styles/positron',
  },
  bright: {
    id: 'bright',
    name: 'Mwangaza Wazi (Daylight)',
    shortLabel: 'Mwangaza',
    tag: 'Mchana',
    dataRate: '20 KB/s',
    supports3D: true,
    isDark: false,
    isDataSaver: false,
    style: 'https://tiles.openfreemap.org/styles/bright',
  },
};

export type MapProjectionMode = 'globe' | 'mercator';
export type MapboxLightPreset = 'day' | 'dusk' | 'dawn' | 'night';

export const DEFAULT_FALLBACK_MAPBOX_TOKEN = 'pk.geolibre-openfreemap-fallback';

export function getMapboxToken(): string {
  try {
    const t = import.meta.env.VITE_MAPBOX_TOKEN;
    return typeof t === 'string' ? t.trim() : '';
  } catch {
    return '';
  }
}

export function resolveMapboxAccessToken(token?: string): string {
  const clean = (token ?? getMapboxToken()).trim();
  return clean || DEFAULT_FALLBACK_MAPBOX_TOKEN;
}

export const MAPBOX_STYLE_URLS: Record<GeoLibreBasemapId, string> = {
  street_3d: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  night: 'mapbox://styles/mapbox/navigation-night-v1',
  lite: 'mapbox://styles/mapbox/light-v11',
  bright: 'mapbox://styles/mapbox/navigation-day-v1',
};

export function getMapboxRasterTileStyle(
  styleId: 'streets-v12' | 'satellite-streets-v12' | 'dark-v11' | 'light-v11',
  token: string
): mapboxgl.StyleSpecification {
  return {
    version: 8,
    name: `Mapbox ${styleId}`,
    sources: {
      'mapbox-raster': {
        type: 'raster',
        tiles: [
          `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(token)}`,
        ],
        tileSize: 512,
        maxzoom: 22,
        attribution: '© Mapbox © OpenStreetMap',
      },
    },
    layers: [
      {
        id: 'mapbox-raster-layer',
        type: 'raster',
        source: 'mapbox-raster',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

export type LatLngTuple = [number, number]; // [lat, lng]
export interface LatLngObject {
  lat: number;
  lng: number;
}

/**
 * Normalizes mixed polygon/route coordinate arrays ([[lat, lng]] or [{lat, lng}]) into clean [lat, lng] tuples.
 */
export function normalizeLatLngList(input: any): LatLngTuple[] {
  if (!Array.isArray(input)) return [];
  const out: LatLngTuple[] = [];
  for (const item of input) {
    if (Array.isArray(item) && item.length >= 2) {
      const lat = Number(item[0]);
      const lng = Number(item[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
    } else if (item && typeof item === 'object') {
      const lat = Number(item.lat ?? item.latitude);
      const lng = Number(item.lng ?? item.lon ?? item.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
    }
  }
  return out;
}

/**
 * Converts [lat, lng] tuples into Firestore-safe {lat, lng} objects (avoids nested arrays unsupported by Firestore).
 */
export function toFirestoreLatLngList(input: any): LatLngObject[] {
  return normalizeLatLngList(input).map(([lat, lng]) => ({
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  }));
}

/**
 * Haversine distance in kilometers between two [lat, lng] points.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates total length/perimeter of a polyline or closed polygon in kilometers.
 */
export function calculatePathDistanceKm(points: LatLngTuple[], closed = false): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
  if (closed && points.length >= 3) {
    total += haversineKm(
      points[points.length - 1][0],
      points[points.length - 1][1],
      points[0][0],
      points[0][1]
    );
  }
  return total;
}

/**
 * Calculates geodesic polygon area in square kilometers using spherical excess approximation.
 */
export function calculatePolygonAreaKm2(points: LatLngTuple[]): number {
  if (points.length < 3) return 0;
  const R = 6371.0088; // Earth mean radius in km
  const rad = Math.PI / 180;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const lon1 = p1[1] * rad;
    const lon2 = p2[1] * rad;
    const lat1 = p1[0] * rad;
    const lat2 = p2[0] * rad;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((area * R * R) / 2);
}

/**
 * Ray-casting point-in-polygon check for [lat, lng].
 */
export function isPointInPolygon(lat: number, lng: number, polygon: LatLngTuple[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Builds a circle GeoJSON polygon around [lat, lng] with radiusMeters.
 */
export function buildCircleGeoJsonPolygon(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const latDelta = (radiusMeters / 6378137) * (180 / Math.PI);
  const lngDelta =
    (radiusMeters / (6378137 * Math.cos((centerLat * Math.PI) / 180))) * (180 / Math.PI);

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([
      centerLng + lngDelta * Math.cos(angle),
      centerLat + latDelta * Math.sin(angle),
    ]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

/**
 * Current Tanzania (Africa/Dar_es_Salaam UTC+3) time in minutes from midnight.
 */
export function getTanzaniaNowMinutes(): number {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + 180) % 1440;
}

function parseClockMinutes(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (mins < 0 || mins > 59 || hours > 24) return null;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (!meridiem && hours === 24 && mins === 0) return 1440;
  return hours * 60 + mins;
}

export interface OpenStatusResult {
  status: 'open' | 'closed' | 'unknown';
  isOpen: boolean;
  label: string;
  hoursLabel: string;
}

/**
 * Mirrors server-side operating hours evaluation in Africa/Dar_es_Salaam (UTC+3).
 */
export function evaluateVendorOpenStatus(
  operatingHours?: string,
  extraStatus?: string
): OpenStatusResult {
  const hotelState = String(extraStatus || '').toLowerCase();
  if (hotelState.includes('maintenance') || hotelState.includes('closed') || hotelState.includes('booked')) {
    return {
      status: 'closed',
      isOpen: false,
      label: hotelState.includes('booked') ? 'Imejaa' : 'Imefungwa',
      hoursLabel: operatingHours || 'Kwa sasa haipatikani',
    };
  }

  const raw = String(operatingHours || '').trim();
  if (!raw) {
    return {
      status: 'open',
      isOpen: true,
      label: 'Wazi',
      hoursLabel: 'Saa za Kazi',
    };
  }

  const lower = raw.toLowerCase();
  if (
    lower.includes('24/7') ||
    lower.includes('24 hours') ||
    lower.includes('saa 24') ||
    lower.includes('always open')
  ) {
    return {
      status: 'open',
      isOpen: true,
      label: 'Wazi 24/7',
      hoursLabel: raw,
    };
  }
  if (lower === 'closed' || lower === 'imefungwa') {
    return {
      status: 'closed',
      isOpen: false,
      label: 'Imefungwa',
      hoursLabel: raw,
    };
  }

  const rangeMatch = raw.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (!rangeMatch) {
    return {
      status: 'open',
      isOpen: true,
      label: 'Wazi',
      hoursLabel: raw,
    };
  }

  const startMins = parseClockMinutes(rangeMatch[1]);
  const endMins = parseClockMinutes(rangeMatch[2]);
  if (startMins === null || endMins === null) {
    return {
      status: 'open',
      isOpen: true,
      label: 'Wazi',
      hoursLabel: raw,
    };
  }

  const nowMins = getTanzaniaNowMinutes();
  const isOpen =
    startMins <= endMins
      ? nowMins >= startMins && nowMins <= endMins
      : nowMins >= startMins || nowMins <= endMins;

  return {
    status: isOpen ? 'open' : 'closed',
    isOpen,
    label: isOpen ? 'Wazi Sasa' : 'Imefungwa',
    hoursLabel: raw,
  };
}

/**
 * Curated Dar es Salaam BRT (Mwendokasi) & Major Daladala Corridors GeoJSON for the Map Layer Manager.
 */
export const DALADALA_CORRIDORS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'BRT Mwendokasi: Kivukoni — Kimara — Mbezi', code: 'BRT-1', color: '#2563EB', fare: 'TZS 750' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2981, -6.8205], // Kivukoni
          [39.2896, -6.8161], // Posta / Kisutu
          [39.2762, -6.8129], // Fire
          [39.2611, -6.8095], // Magomeni Mapipa
          [39.2361, -6.8031], // Manzese
          [39.2141, -6.7949], // Ubungo Terminal
          [39.1670, -6.7920], // Kimara Mwisho
          [39.1280, -6.7880], // Mbezi Magufuli
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'BRT / Daladala: Kariakoo — Morocco — Mwenge', code: 'COR-2', color: '#059669', fare: 'TZS 600' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2748, -6.8182], // Kariakoo Gerezani
          [39.2762, -6.8129], // Fire
          [39.2682, -6.7990], // Kinondoni Studio
          [39.2604, -6.7885], // Morocco
          [39.2492, -6.7645], // Mikocheni / Makumbusho
          [39.2274, -6.7681], // Mwenge
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Daladala: Posta — Tazara — JNIA Airport', code: 'COR-3', color: '#D97706', fare: 'TZS 700' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2896, -6.8161], // Posta
          [39.2797, -6.8239], // Gerezani
          [39.2450, -6.8280], // Buguruni
          [39.2410, -6.8430], // Tazara
          [39.2180, -6.8540], // Karakata
          [39.2026, -6.8781], // JNIA Terminal 3
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'BRT Phase 2: Posta — Mbagala Rangi Tatu', code: 'BRT-2', color: '#7C3AED', fare: 'TZS 750' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2896, -6.8161],
          [39.2797, -6.8239],
          [39.2650, -6.8550], // Temeke / Sabasaba
          [39.2690, -6.8910], // Mbagala
        ],
      },
    },
  ],
};

export const DALADALA_STOPS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Kivukoni Feri Terminal', route: 'BRT-1' }, geometry: { type: 'Point', coordinates: [39.2981, -6.8205] } },
    { type: 'Feature', properties: { name: 'Gerezani / Kariakoo Hub', route: 'BRT-1 / BRT-2' }, geometry: { type: 'Point', coordinates: [39.2797, -6.8239] } },
    { type: 'Feature', properties: { name: 'Morocco Transfer Hub', route: 'COR-2' }, geometry: { type: 'Point', coordinates: [39.2604, -6.7885] } },
    { type: 'Feature', properties: { name: 'Ubungo Kijazi Interchange', route: 'BRT-1' }, geometry: { type: 'Point', coordinates: [39.2141, -6.7949] } },
    { type: 'Feature', properties: { name: 'Mwenge Stendi Kuu', route: 'COR-2' }, geometry: { type: 'Point', coordinates: [39.2274, -6.7681] } },
    { type: 'Feature', properties: { name: 'Kimara Mwisho BRT', route: 'BRT-1' }, geometry: { type: 'Point', coordinates: [39.1670, -6.7920] } },
    { type: 'Feature', properties: { name: 'Magufuli Bus Terminal (Mbezi)', route: 'BRT-1' }, geometry: { type: 'Point', coordinates: [39.1280, -6.7880] } },
    { type: 'Feature', properties: { name: 'JNIA Airport Terminal 3', route: 'COR-3' }, geometry: { type: 'Point', coordinates: [39.2026, -6.8781] } },
    { type: 'Feature', properties: { name: 'Mbagala Rangi Tatu', route: 'BRT-2' }, geometry: { type: 'Point', coordinates: [39.2690, -6.8910] } },
  ],
};

/**
 * Generates hexagon polygon vertices in GeoJSON [lng, lat] order for MapLibre fill-extrusion.
 */
function buildHexRingLngLat(lat: number, lng: number, radiusMeters: number): [number, number][] {
  const ring: [number, number][] = [];
  const latDelta = (radiusMeters / 6378137) * (180 / Math.PI);
  const lngDelta = (radiusMeters / (6378137 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    ring.push([lng + lngDelta * Math.cos(angle), lat + latDelta * Math.sin(angle)]);
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * Generates WebGL Heatmap points AND 3D Hexagonal Demand Columns from live Firestore orders/rides + CITY_HEAT_ZONES.
 */
export function buildSpatialDemandLayersData(params: {
  orders?: any[];
  rides?: any[];
  cityName?: string;
}): {
  heatPoints: GeoJSON.FeatureCollection;
  hexColumns: GeoJSON.FeatureCollection;
  topZones: HeatZone[];
} {
  const { orders = [], rides = [], cityName } = params;
  const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const hexFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

  // 1. Add real Firestore orders/rides spatial points
  const gridBuckets = new Map<string, { lat: number; lng: number; count: number; revenue: number }>();
  const addRealPoint = (lat: any, lng: any, amount = 0) => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || (nLat === 0 && nLng === 0)) return;
    pointFeatures.push({
      type: 'Feature',
      properties: { weight: Math.min(2, 0.7 + amount / 30000), orderCount: 1 },
      geometry: { type: 'Point', coordinates: [nLng, nLat] },
    });
    const key = `${nLat.toFixed(2)}_${nLng.toFixed(2)}`;
    const existing = gridBuckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.revenue += amount;
    } else {
      gridBuckets.set(key, { lat: nLat, lng: nLng, count: 1, revenue: amount });
    }
  };

  for (const o of orders) {
    const loc = o?.deliveryLocation || o?.customerLocation || o?.pickup;
    if (loc) addRealPoint(loc.lat, loc.lng, Number(o.totalAmount || o.price || 0));
  }
  for (const r of rides) {
    const loc = r?.pickup;
    if (loc) addRealPoint(loc.lat, loc.lng, Number(r.fare || r.price || 0));
  }

  for (const [key, bucket] of gridBuckets.entries()) {
    const intensity = Math.min(1, 0.35 + bucket.count * 0.15);
    hexFeatures.push({
      type: 'Feature',
      properties: {
        id: `live-hex-${key}`,
        name: 'Mahitaji ya Moja kwa Moja',
        orderCount: bucket.count,
        revenue: bucket.revenue,
        height: Math.min(900, 120 + bucket.count * 90),
        intensity,
        color: bucket.count >= 5 ? '#EF4444' : bucket.count >= 3 ? '#F97316' : '#FACC15',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [buildHexRingLngLat(bucket.lat, bucket.lng, 420)],
      },
    });
  }

  // 2. Merge curated high-signal hotspots across Tanzanian cities
  const zoneEntries: HeatZone[] = cityName
    ? CITY_HEAT_ZONES[cityName] || Object.values(CITY_HEAT_ZONES).flat()
    : Object.values(CITY_HEAT_ZONES).flat();

  for (const zone of zoneEntries) {
    const w = zone.level === 'extreme' ? 1.0 : zone.level === 'high' ? 0.78 : 0.55;
    pointFeatures.push({
      type: 'Feature',
      properties: {
        id: zone.id,
        name: zone.name,
        weight: w,
        orderCount: zone.orderCount,
        surge: zone.surgeVal,
      },
      geometry: { type: 'Point', coordinates: [zone.center[1], zone.center[0]] },
    });

    const color =
      zone.level === 'extreme' ? '#EF4444' : zone.level === 'high' ? '#F97316' : '#F59E0B';
    hexFeatures.push({
      type: 'Feature',
      properties: {
        id: zone.id,
        name: zone.name,
        orderCount: zone.orderCount,
        surgeRange: zone.surgeRange,
        height: Math.min(1100, 160 + zone.orderCount * 4.5),
        intensity: w,
        color,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [buildHexRingLngLat(zone.center[0], zone.center[1], Math.min(550, zone.radius * 0.75))],
      },
    });
  }

  return {
    heatPoints: { type: 'FeatureCollection', features: pointFeatures },
    hexColumns: { type: 'FeatureCollection', features: hexFeatures },
    topZones: zoneEntries.slice(0, 8),
  };
}

export interface CitySpatialMetric {
  cityName: string;
  active: boolean;
  geofenceActive: boolean;
  geofenceType: 'circle' | 'polygon' | 'route';
  areaKm2: number;
  perimeterKm: number;
  openVendors: number;
  closedVendors: number;
  onlineDrivers: number;
  busyDrivers: number;
  ordersInside: number;
  revenueInside: number;
}

/**
 * Client-side spatial aggregation across all cities, vendors, drivers & orders (GeoLibre Spatial Analytics).
 */
export function computeSpatialCityAnalytics(params: {
  pricingRules: Record<string, any>;
  vendors: any[];
  drivers: any[];
  orders: any[];
}): {
  cityMetrics: CitySpatialMetric[];
  totals: {
    totalCoverageKm2: number;
    openVendors: number;
    closedVendors: number;
    onlineDrivers: number;
    busyDrivers: number;
    totalOrdersMapped: number;
    geofenceCoveragePct: number;
  };
} {
  const { pricingRules = {}, vendors = [], drivers = [], orders = [] } = params;
  const cityNames = Object.keys(pricingRules);

  const isPointInCity = (lat: number, lng: number, city: any): boolean => {
    const gfType = city.geofenceType || 'circle';
    if (gfType === 'polygon') {
      const poly = normalizeLatLngList(city.geofencePolygon);
      if (poly.length >= 3) return isPointInPolygon(lat, lng, poly);
    }
    const cLat = Number(city.geofenceCenter?.lat ?? city.lat ?? -6.7924);
    const cLng = Number(city.geofenceCenter?.lng ?? city.lng ?? 39.2083);
    const radiusKm = Number(city.geofenceRadius || 15000) / 1000;
    return haversineKm(lat, lng, cLat, cLng) <= radiusKm;
  };

  let totalCoverageKm2 = 0;
  let globalOrdersInside = 0;
  let globalOrdersWithCoords = 0;

  // Evaluate vendor open/closed & driver status globally
  let globalOpenVendors = 0;
  let globalClosedVendors = 0;
  const vendorStatuses = vendors.map((v) => {
    const st = evaluateVendorOpenStatus(v.operatingHours, v.hotelStatus);
    if (st.isOpen) globalOpenVendors += 1;
    else globalClosedVendors += 1;
    return { v, st };
  });

  let globalOnlineDrivers = 0;
  let globalBusyDrivers = 0;
  const activeDrivers = drivers.filter((d) => {
    const on = d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true;
    if (!on) return false;
    const isBusy = d.receiving === false || Boolean(d.activeRideId);
    if (isBusy) globalBusyDrivers += 1;
    else globalOnlineDrivers += 1;
    return true;
  });

  const ordersWithCoords = orders.filter((o) => {
    const loc = o?.deliveryLocation || o?.customerLocation || o?.pickup;
    return loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng));
  });
  globalOrdersWithCoords = ordersWithCoords.length;

  const cityMetrics: CitySpatialMetric[] = cityNames.map((cityName) => {
    const city = pricingRules[cityName] || {};
    const gfType = (city.geofenceType || 'circle') as 'circle' | 'polygon' | 'route';
    const polyPts = normalizeLatLngList(city.geofencePolygon);
    const radiusKm = Number(city.geofenceRadius || 15000) / 1000;

    let areaKm2 = 0;
    let perimeterKm = 0;
    if (gfType === 'polygon' && polyPts.length >= 3) {
      areaKm2 = calculatePolygonAreaKm2(polyPts);
      perimeterKm = calculatePathDistanceKm(polyPts, true);
    } else if (gfType === 'route') {
      const routePts = normalizeLatLngList(city.deliveryRoutePath || city.geofencePolygon);
      perimeterKm = calculatePathDistanceKm(routePts, false);
    } else {
      areaKm2 = Math.PI * radiusKm * radiusKm;
      perimeterKm = 2 * Math.PI * radiusKm;
    }
    totalCoverageKm2 += areaKm2;

    let openVendors = 0;
    let closedVendors = 0;
    for (const { v, st } of vendorStatuses) {
      if (!v.location || !Number.isFinite(Number(v.location.lat))) continue;
      if (isPointInCity(Number(v.location.lat), Number(v.location.lng), city)) {
        if (st.isOpen) openVendors += 1;
        else closedVendors += 1;
      }
    }

    let onlineDrivers = 0;
    let busyDrivers = 0;
    for (const d of activeDrivers) {
      const pos = d.location || d.currentPosition;
      if (!pos || !Number.isFinite(Number(pos.lat))) continue;
      if (isPointInCity(Number(pos.lat), Number(pos.lng), city)) {
        const isBusy = d.receiving === false || Boolean(d.activeRideId);
        if (isBusy) busyDrivers += 1;
        else onlineDrivers += 1;
      }
    }

    let ordersInside = 0;
    let revenueInside = 0;
    for (const o of ordersWithCoords) {
      const loc = o.deliveryLocation || o.customerLocation || o.pickup;
      if (isPointInCity(Number(loc.lat), Number(loc.lng), city)) {
        ordersInside += 1;
        revenueInside += Number(o.totalAmount || o.price || 0);
      }
    }
    globalOrdersInside += ordersInside;

    return {
      cityName,
      active: city.active !== false,
      geofenceActive: city.geofenceActive === true,
      geofenceType: gfType,
      areaKm2,
      perimeterKm,
      openVendors,
      closedVendors,
      onlineDrivers,
      busyDrivers,
      ordersInside,
      revenueInside,
    };
  });

  const geofenceCoveragePct =
    globalOrdersWithCoords > 0
      ? Math.min(100, Math.round((globalOrdersInside / globalOrdersWithCoords) * 100))
      : 100;

  return {
    cityMetrics,
    totals: {
      totalCoverageKm2,
      openVendors: globalOpenVendors,
      closedVendors: globalClosedVendors,
      onlineDrivers: globalOnlineDrivers,
      busyDrivers: globalBusyDrivers,
      totalOrdersMapped: globalOrdersWithCoords,
      geofenceCoveragePct,
    },
  };
}
