import type * as mapboxgl from 'mapbox-gl';
import { PMTiles } from 'pmtiles';
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

// ============================================================================
// CLOUD-NATIVE GIS & GEOLIBRE WORKBENCH (NGIS 2026 WORKSHOP MODULES 1/8 - 5/8)
// ============================================================================

export type VendorSymbologyMode = 'status' | 'category' | 'orders_graduated';

export interface GeoLibreSymbologyLegendItem {
  label: string;
  color: string;
  sizePx?: number;
}

export const VENDOR_CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#F97316',
  food: '#F97316',
  grocery: '#10B981',
  pharmacy: '#06B6D4',
  salon: '#EC4899',
  hotel: '#8B5CF6',
  bus_ticket: '#3B82F6',
  car_rental: '#EAB308',
  ecommerce: '#6366F1',
};

export function resolveVendorSymbologyStyle(
  vendor: any,
  mode: VendorSymbologyMode,
  orderCount = 0
): { color: string; sizePx: number; categoryLabel: string; isOpen: boolean; statusLabel: string } {
  const st = evaluateVendorOpenStatus(vendor?.operatingHours, vendor?.hotelStatus);
  const rawCat = String(vendor?.category || vendor?.serviceType || 'restaurant').toLowerCase();

  if (mode === 'category') {
    const color = VENDOR_CATEGORY_COLORS[rawCat] || '#94A3B8';
    return {
      color,
      sizePx: 12,
      categoryLabel: rawCat,
      isOpen: st.isOpen,
      statusLabel: st.label,
    };
  }

  if (mode === 'orders_graduated') {
    const cnt = Number(orderCount || vendor?.ordersCount || 0);
    const color = cnt >= 15 ? '#DC2626' : cnt >= 5 ? '#F97316' : cnt >= 1 ? '#FACC15' : '#38BDF8';
    const sizePx = cnt >= 15 ? 18 : cnt >= 5 ? 15 : cnt >= 1 ? 12 : 9;
    return {
      color,
      sizePx,
      categoryLabel: rawCat,
      isOpen: st.isOpen,
      statusLabel: st.label,
    };
  }

  return {
    color: st.isOpen ? '#10B981' : '#EF4444',
    sizePx: 11,
    categoryLabel: rawCat,
    isOpen: st.isOpen,
    statusLabel: st.label,
  };
}

export function getSymbologyLegend(mode: VendorSymbologyMode): GeoLibreSymbologyLegendItem[] {
  if (mode === 'category') {
    return [
      { label: 'Chakula / Mgahawa', color: '#F97316', sizePx: 10 },
      { label: 'Grocery / Soko', color: '#10B981', sizePx: 10 },
      { label: 'Dawa / Pharmacy', color: '#06B6D4', sizePx: 10 },
      { label: 'Hoteli / Stay', color: '#8B5CF6', sizePx: 10 },
      { label: 'Saluni / Urembo', color: '#EC4899', sizePx: 10 },
      { label: 'Mabasi & Kukodi', color: '#3B82F6', sizePx: 10 },
    ];
  }
  if (mode === 'orders_graduated') {
    return [
      { label: 'Oda 15+ (Mahitaji Juu)', color: '#DC2626', sizePx: 14 },
      { label: 'Oda 5–14 (Kati)', color: '#F97316', sizePx: 12 },
      { label: 'Oda 1–4 (Chache)', color: '#FACC15', sizePx: 10 },
      { label: '0 Oda (Bila Oda)', color: '#38BDF8', sizePx: 8 },
    ];
  }
  return [
    { label: 'Duka Wazi (Open UTC+3)', color: '#10B981', sizePx: 10 },
    { label: 'Duka Limefungwa', color: '#EF4444', sizePx: 10 },
    { label: 'Dereva Online', color: '#38BDF8', sizePx: 10 },
    { label: 'Dereva Safari (Busy)', color: '#F59E0B', sizePx: 10 },
  ];
}

// --- Module 1/8: Cloud-Native Project Save & Reopen ---
export interface GeoLibreProjectState {
  version: 'geolibre-ngis-v1';
  savedAt: string;
  basemap: GeoLibreBasemapId;
  projection: MapProjectionMode;
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  symbologyMode: VendorSymbologyMode;
  layers: {
    showHeatmap3D: boolean;
    showVendorsLayer: boolean;
    showDriversLayer: boolean;
    showGeofencesLayer: boolean;
    showDaladalaLayer: boolean;
  };
  cloudLayers: Array<{
    id: string;
    name: string;
    kind: 'geojson' | 'xyz' | 'pmtiles';
    url: string;
    opacity?: number;
  }>;
  sqlQuery?: string;
}

export function parseGeoLibreProject(rawJson: string): GeoLibreProjectState | null {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.basemap || !parsed.camera) return null;
    return parsed as GeoLibreProjectState;
  } catch {
    return null;
  }
}

// --- Module 2/8: Bringing in Cloud-Hosted Data (GeoJSON, XYZ Raster/COG, PMTiles HTTP Range) ---
export interface CloudPmTilesInspection {
  url: string;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  centerLon: number;
  centerLat: number;
  tileTypeLabel: string;
  metadataName?: string;
  vectorLayers?: string[];
}

export async function inspectPmTilesRemote(url: string): Promise<CloudPmTilesInspection> {
  const archive = new PMTiles(url);
  const header = await archive.getHeader();
  let meta: any = {};
  try {
    meta = (await archive.getMetadata()) || {};
  } catch {}

  const tileTypeMap: Record<number, string> = {
    1: 'MVT Vector Tiles',
    2: 'PNG Raster',
    3: 'JPEG Raster',
    4: 'WebP Raster',
    5: 'AVIF Raster',
  };

  const vectorLayers = Array.isArray(meta?.vector_layers)
    ? meta.vector_layers.map((vl: any) => String(vl?.id || '')).filter(Boolean)
    : undefined;

  return {
    url,
    minZoom: Number(header.minZoom || 0),
    maxZoom: Number(header.maxZoom || 14),
    bounds: [
      Number(header.minLon ?? 29),
      Number(header.minLat ?? -12),
      Number(header.maxLon ?? 41),
      Number(header.maxLat ?? -1),
    ],
    centerLon: Number(header.centerLon ?? (header.minLon + header.maxLon) / 2),
    centerLat: Number(header.centerLat ?? (header.minLat + header.maxLat) / 2),
    tileTypeLabel: tileTypeMap[Number(header.tileType)] || `TileType #${header.tileType}`,
    metadataName: meta?.name || meta?.description || undefined,
    vectorLayers,
  };
}

export async function fetchCloudGeoJsonSource(url: string): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${res.statusText || 'Failed to fetch cloud dataset'})`);
  }
  const data = await res.json();
  if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data as GeoJSON.FeatureCollection;
  }
  if (data?.type === 'Feature' && data.geometry) {
    return { type: 'FeatureCollection', features: [data as GeoJSON.Feature] };
  }
  if (data?.type && data?.coordinates) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: data }],
    };
  }
  throw new Error('Faili halina muundo halali wa GeoJSON FeatureCollection.');
}

export function computeGeoJsonBounds(fc: GeoJSON.FeatureCollection): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visitCoords = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lng, lat] = coords;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
      return;
    }
    for (const c of coords) visitCoords(c);
  };

  for (const f of fc.features || []) {
    if (f?.geometry && 'coordinates' in f.geometry) {
      visitCoords((f.geometry as any).coordinates);
    }
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export const CLOUD_NATIVE_SAMPLE_DATASETS: Array<{
  id: string;
  name: string;
  kind: 'geojson' | 'xyz' | 'pmtiles';
  url: string;
  description: string;
}> = [
  {
    id: 'osm-dar-roads-xyz',
    name: 'OpenStreetMap Standard Tiles (XYZ Cloud Stream)',
    kind: 'xyz',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    description: 'Safu ya moja kwa moja ya XYZ Tiles bila kupakua faili kubwa',
  },
  {
    id: 'protomaps-dar-pmtiles',
    name: 'Overture / Protomaps Africa PMTiles (HTTP Range Inspector)',
    kind: 'pmtiles',
    url: 'https://demo-bucket.protomaps.com/v4.pmtiles',
    description: 'Ukaguzi wa Cloud-Native PMTiles kupitia HTTP Range Requests',
  },
  {
    id: 'usgs-eq-geojson',
    name: 'USGS Live Feed (Cloud GeoJSON Stream)',
    kind: 'geojson',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    description: 'Mfano halisi wa Live Cloud GeoJSON kutoka seva ya kimataifa',
  },
];

// --- Module 4/8: Attribute Table & In-Browser Spatial SQL Engine ---
export type SpatialDatasetName = 'vendors' | 'drivers' | 'orders' | 'cities' | 'cloud';

export interface SpatialAttributeRow {
  id: string;
  dataset: SpatialDatasetName;
  name: string;
  category: string;
  status: string;
  city: string;
  amount: number;
  lat: number | null;
  lng: number | null;
  inside_geofence: boolean;
  distance_dar_km: number | null;
  area_km2?: number;
  online?: boolean;
  phone?: string;
}

function isCoordInsideAnyCity(lat: number, lng: number, pricingRules: Record<string, any>): { inside: boolean; cityName: string } {
  for (const [cityName, city] of Object.entries(pricingRules || {})) {
    if (!city) continue;
    if ((city.geofenceType || 'circle') === 'polygon') {
      const poly = normalizeLatLngList(city.geofencePolygon);
      if (poly.length >= 3 && isPointInPolygon(lat, lng, poly)) {
        return { inside: true, cityName };
      }
    }
    const cLat = Number(city.geofenceCenter?.lat ?? city.lat);
    const cLng = Number(city.geofenceCenter?.lng ?? city.lng);
    const radKm = Number(city.geofenceRadius || 15000) / 1000;
    if (Number.isFinite(cLat) && Number.isFinite(cLng) && haversineKm(lat, lng, cLat, cLng) <= radKm) {
      return { inside: true, cityName };
    }
  }
  return { inside: false, cityName: 'Nje ya Mpaka' };
}

export function buildAttributeRows(params: {
  dataset: SpatialDatasetName;
  pricingRules: Record<string, any>;
  vendors: any[];
  drivers: any[];
  orders: any[];
  cloudFc?: GeoJSON.FeatureCollection | null;
}): SpatialAttributeRow[] {
  const { dataset, pricingRules = {}, vendors = [], drivers = [], orders = [], cloudFc } = params;
  const DAR_CENTER: [number, number] = [-6.805, 39.24];

  if (dataset === 'vendors') {
    const orderCountMap = new Map<string, number>();
    for (const o of orders) {
      const vid = String(o?.vendorId || '');
      if (vid) orderCountMap.set(vid, (orderCountMap.get(vid) || 0) + 1);
    }
    return vendors.map((v, idx) => {
      const st = evaluateVendorOpenStatus(v.operatingHours, v.hotelStatus);
      const lat = Number.isFinite(Number(v?.location?.lat)) ? Number(v.location.lat) : null;
      const lng = Number.isFinite(Number(v?.location?.lng)) ? Number(v.location.lng) : null;
      const gf = lat !== null && lng !== null ? isCoordInsideAnyCity(lat, lng, pricingRules) : { inside: false, cityName: v.city || '-' };
      return {
        id: String(v.id || `vendor-${idx}`),
        dataset: 'vendors',
        name: String(v.businessName || v.name || 'Duka'),
        category: String(v.category || 'restaurant'),
        status: st.isOpen ? 'open' : 'closed',
        city: String(v.city || gf.cityName || 'Dar es Salaam'),
        amount: orderCountMap.get(String(v.id)) || 0,
        lat,
        lng,
        inside_geofence: gf.inside,
        distance_dar_km: lat !== null && lng !== null ? Number(haversineKm(lat, lng, DAR_CENTER[0], DAR_CENTER[1]).toFixed(2)) : null,
        phone: String(v.phoneNumber || v.socialLinks?.whatsapp || ''),
      };
    });
  }

  if (dataset === 'drivers') {
    return drivers.map((d, idx) => {
      const on = d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true;
      const isBusy = d.receiving === false || Boolean(d.activeRideId);
      const pos = d.location || d.currentPosition;
      const lat = pos && Number.isFinite(Number(pos.lat)) ? Number(pos.lat) : null;
      const lng = pos && Number.isFinite(Number(pos.lng)) ? Number(pos.lng) : null;
      const gf = lat !== null && lng !== null ? isCoordInsideAnyCity(lat, lng, pricingRules) : { inside: false, cityName: '-' };
      return {
        id: String(d.id || d.uid || `driver-${idx}`),
        dataset: 'drivers',
        name: String(d.name || d.displayName || d.fullName || 'Dereva'),
        category: String(d.driverType || d.vehicleType || 'taxi'),
        status: !on ? 'offline' : isBusy ? 'busy' : 'online',
        city: String(d.city || gf.cityName || 'Dar es Salaam'),
        amount: Number(d.totalEarnings || d.walletBalance || 0),
        lat,
        lng,
        inside_geofence: gf.inside,
        distance_dar_km: lat !== null && lng !== null ? Number(haversineKm(lat, lng, DAR_CENTER[0], DAR_CENTER[1]).toFixed(2)) : null,
        online: on,
        phone: String(d.phoneNumber || d.phone || ''),
      };
    });
  }

  if (dataset === 'orders') {
    return orders.slice(0, 250).map((o, idx) => {
      const loc = o?.deliveryLocation || o?.customerLocation || o?.pickup;
      const lat = loc && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null;
      const lng = loc && Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null;
      const gf = lat !== null && lng !== null ? isCoordInsideAnyCity(lat, lng, pricingRules) : { inside: false, cityName: '-' };
      return {
        id: String(o.id || o.bookingCode || `order-${idx}`),
        dataset: 'orders',
        name: String(o.customerName || o.bookingCode || `Oda #${String(o.id || idx).slice(-5)}`),
        category: String(o.service || o.orderType || 'order'),
        status: String(o.status || 'pending'),
        city: String(o.city || gf.cityName || '-'),
        amount: Number(o.totalAmount || o.total || o.fare || 0),
        lat,
        lng,
        inside_geofence: gf.inside,
        distance_dar_km: lat !== null && lng !== null ? Number(haversineKm(lat, lng, DAR_CENTER[0], DAR_CENTER[1]).toFixed(2)) : null,
        phone: String(o.customerPhone || ''),
      };
    });
  }

  if (dataset === 'cities') {
    const cityStats = computeSpatialCityAnalytics({ pricingRules, vendors, drivers, orders }).cityMetrics;
    return cityStats.map((m) => {
      const c = pricingRules[m.cityName] || {};
      const lat = Number.isFinite(Number(c.geofenceCenter?.lat ?? c.lat)) ? Number(c.geofenceCenter?.lat ?? c.lat) : -6.8;
      const lng = Number.isFinite(Number(c.geofenceCenter?.lng ?? c.lng)) ? Number(c.geofenceCenter?.lng ?? c.lng) : 39.24;
      return {
        id: m.cityName,
        dataset: 'cities',
        name: m.cityName,
        category: m.geofenceType,
        status: m.active ? 'active' : 'inactive',
        city: m.cityName,
        amount: m.revenueInside,
        lat,
        lng,
        inside_geofence: true,
        distance_dar_km: Number(haversineKm(lat, lng, DAR_CENTER[0], DAR_CENTER[1]).toFixed(2)),
        area_km2: Number(m.areaKm2.toFixed(2)),
      };
    });
  }

  if (dataset === 'cloud' && cloudFc) {
    return (cloudFc.features || []).slice(0, 250).map((f, idx) => {
      const props = f?.properties || {};
      let lat: number | null = null;
      let lng: number | null = null;
      if (f?.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
        lng = Number(f.geometry.coordinates[0]);
        lat = Number(f.geometry.coordinates[1]);
      }
      return {
        id: String(f.id ?? props.id ?? `cloud-${idx}`),
        dataset: 'cloud',
        name: String(props.name || props.title || props.place || `Feature #${idx + 1}`),
        category: String(f.geometry?.type || 'Geometry'),
        status: String(props.status || props.type || 'streamed'),
        city: String(props.city || props.region || '-'),
        amount: Number(props.mag || props.value || props.amount || 0),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        inside_geofence: lat !== null && lng !== null ? isCoordInsideAnyCity(lat, lng, pricingRules).inside : false,
        distance_dar_km:
          lat !== null && lng !== null
            ? Number(haversineKm(lat, lng, DAR_CENTER[0], DAR_CENTER[1]).toFixed(2))
            : null,
      };
    });
  }

  return [];
}

export interface SpatialSqlResult {
  ok: boolean;
  dataset: SpatialDatasetName;
  columns: string[];
  rows: Record<string, any>[];
  matchedLatLngIds: string[];
  error?: string;
}

export function executeSpatialSqlQuery(
  rawSql: string,
  allDatasets: Record<SpatialDatasetName, SpatialAttributeRow[]>
): SpatialSqlResult {
  const sql = rawSql.trim().replace(/;+$/, '');
  const match = sql.match(
    /^SELECT\s+(.+?)\s+FROM\s+(vendors|drivers|orders|cities|cloud)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+([a-zA-Z0-9_]+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i
  );

  if (!match) {
    return {
      ok: false,
      dataset: 'vendors',
      columns: [],
      rows: [],
      matchedLatLngIds: [],
      error:
        "Muundo sahihi: SELECT * FROM vendors|drivers|orders|cities WHERE <sharti> ORDER BY <safu> DESC LIMIT 20",
    };
  }

  const selectPart = match[1].trim();
  const table = match[2].toLowerCase() as SpatialDatasetName;
  const wherePart = match[3]?.trim();
  const orderCol = match[4]?.trim();
  const orderDir = (match[5] || 'ASC').toUpperCase();
  const limitVal = match[6] ? Math.max(1, Math.min(500, parseInt(match[6], 10))) : 100;

  let working = [...(allDatasets[table] || [])];

  if (wherePart) {
    const orGroups = wherePart.split(/\s+OR\s+/i);
    working = working.filter((row: any) =>
      orGroups.some((group) => {
        const andConds = group.split(/\s+AND\s+/i);
        return andConds.every((cond) => {
          const m = cond.trim().match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*(.+)$/i);
          if (!m) return true;
          const field = m[1];
          const op = m[2].toUpperCase();
          let rawVal = m[3].trim();
          if ((rawVal.startsWith("'") && rawVal.endsWith("'")) || (rawVal.startsWith('"') && rawVal.endsWith('"'))) {
            rawVal = rawVal.slice(1, -1);
          }

          const cell = row[field];
          if (rawVal.toLowerCase() === 'true' || rawVal.toLowerCase() === 'false') {
            const b = rawVal.toLowerCase() === 'true';
            return op === '=' ? Boolean(cell) === b : Boolean(cell) !== b;
          }
          const numTarget = Number(rawVal);
          const numCell = Number(cell);
          if (!Number.isNaN(numTarget) && rawVal !== '' && cell !== null && cell !== undefined && !Number.isNaN(numCell)) {
            if (op === '=') return numCell === numTarget;
            if (op === '!=' || op === '<>') return numCell !== numTarget;
            if (op === '>') return numCell > numTarget;
            if (op === '<') return numCell < numTarget;
            if (op === '>=') return numCell >= numTarget;
            if (op === '<=') return numCell <= numTarget;
          }

          const strCell = String(cell ?? '').toLowerCase();
          const strTarget = rawVal.toLowerCase();
          if (op === 'LIKE') {
            const needle = strTarget.replace(/%/g, '');
            return strCell.includes(needle);
          }
          if (op === '=') return strCell === strTarget;
          if (op === '!=' || op === '<>') return strCell !== strTarget;
          return strCell.includes(strTarget);
        });
      })
    );
  }

  if (orderCol) {
    working.sort((a: any, b: any) => {
      const va = a[orderCol] ?? '';
      const vb = b[orderCol] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return orderDir === 'DESC' ? vb - va : va - vb;
      }
      return orderDir === 'DESC'
        ? String(vb).localeCompare(String(va))
        : String(va).localeCompare(String(vb));
    });
  }

  const limited = working.slice(0, limitVal);
  const cols =
    selectPart === '*'
      ? ['id', 'name', 'category', 'status', 'city', 'amount', 'inside_geofence', 'distance_dar_km']
      : selectPart.split(',').map((c) => c.trim()).filter(Boolean);

  const projected = limited.map((r: any) => {
    const out: Record<string, any> = { _lat: r.lat, _lng: r.lng, _id: r.id };
    for (const c of cols) out[c] = r[c] ?? null;
    return out;
  });

  return {
    ok: true,
    dataset: table,
    columns: cols,
    rows: projected,
    matchedLatLngIds: limited.map((r) => r.id),
  };
}

// --- Module 5/8: Geoprocessing Toolbox (Buffer, Spatial Join, Nearest Neighbor) ---
export interface BufferAnalysisResult {
  buffersFc: GeoJSON.FeatureCollection;
  bufferCount: number;
  radiusKm: number;
  ordersTotal: number;
  ordersCovered: number;
  driversCovered: number;
  coveragePct: number;
}

export function runGeodesicBufferAnalysis(params: {
  sourceType: 'open_vendors' | 'brt_stops' | 'city_centers';
  radiusKm: number;
  vendors: any[];
  drivers: any[];
  orders: any[];
  pricingRules: Record<string, any>;
}): BufferAnalysisResult {
  const { sourceType, radiusKm, vendors, drivers, orders, pricingRules } = params;
  const centers: Array<{ name: string; lat: number; lng: number }> = [];

  if (sourceType === 'open_vendors') {
    for (const v of vendors) {
      const st = evaluateVendorOpenStatus(v.operatingHours, v.hotelStatus);
      const lat = Number(v?.location?.lat);
      const lng = Number(v?.location?.lng);
      if (st.isOpen && Number.isFinite(lat) && Number.isFinite(lng)) {
        centers.push({ name: v.businessName || 'Duka', lat, lng });
      }
    }
  } else if (sourceType === 'brt_stops') {
    for (const f of DALADALA_STOPS_GEOJSON.features) {
      if (f.geometry.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates;
        centers.push({ name: String(f.properties?.name || 'Kituo'), lat, lng });
      }
    }
  } else {
    for (const [name, city] of Object.entries(pricingRules || {})) {
      const lat = Number(city?.geofenceCenter?.lat ?? city?.lat);
      const lng = Number(city?.geofenceCenter?.lng ?? city?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        centers.push({ name, lat, lng });
      }
    }
  }

  const bufferFeatures = centers.map((c) => {
    const poly = buildCircleGeoJsonPolygon(c.lat, c.lng, radiusKm * 1000, 48);
    poly.properties = { name: `${c.name} (${radiusKm} km Buffer)`, radiusKm };
    return poly;
  });

  const isInsideAnyBuffer = (lat: number, lng: number) =>
    centers.some((c) => haversineKm(lat, lng, c.lat, c.lng) <= radiusKm);

  let ordersTotal = 0;
  let ordersCovered = 0;
  for (const o of orders) {
    const loc = o?.deliveryLocation || o?.customerLocation || o?.pickup;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    ordersTotal += 1;
    if (isInsideAnyBuffer(lat, lng)) ordersCovered += 1;
  }

  let driversCovered = 0;
  for (const d of drivers) {
    const on = d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true;
    const pos = d.location || d.currentPosition;
    const lat = Number(pos?.lat);
    const lng = Number(pos?.lng);
    if (on && Number.isFinite(lat) && Number.isFinite(lng) && isInsideAnyBuffer(lat, lng)) {
      driversCovered += 1;
    }
  }

  return {
    buffersFc: { type: 'FeatureCollection', features: bufferFeatures },
    bufferCount: bufferFeatures.length,
    radiusKm,
    ordersTotal,
    ordersCovered,
    driversCovered,
    coveragePct: ordersTotal > 0 ? Math.round((ordersCovered / ordersTotal) * 100) : 0,
  };
}

export interface NearestDriverLink {
  id: string;
  name: string;
  vehicle: string;
  distanceKm: number;
  etaMins: number;
  lat: number;
  lng: number;
}

export function computeNearestDriversSpider(params: {
  targetLat: number;
  targetLng: number;
  targetName: string;
  drivers: any[];
  limit?: number;
}): {
  links: NearestDriverLink[];
  spiderGeoJson: GeoJSON.FeatureCollection;
} {
  const { targetLat, targetLng, targetName, drivers, limit = 5 } = params;
  const candidates: NearestDriverLink[] = [];

  for (const d of drivers) {
    const on = d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true;
    const pos = d.location || d.currentPosition;
    const lat = Number(pos?.lat);
    const lng = Number(pos?.lng);
    if (!on || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const distanceKm = haversineKm(targetLat, targetLng, lat, lng);
    candidates.push({
      id: String(d.id || d.uid || candidates.length),
      name: String(d.name || d.displayName || 'Dereva'),
      vehicle: String(d.driverType || d.vehicleType || 'taxi'),
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMins: Math.max(2, Math.round((distanceKm / 26) * 60)),
      lat,
      lng,
    });
  }

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  const top = candidates.slice(0, limit);

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = top.map((drv) => ({
    type: 'Feature',
    properties: {
      name: `${targetName} → ${drv.name}`,
      distanceKm: drv.distanceKm,
      etaMins: drv.etaMins,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [targetLng, targetLat],
        [drv.lng, drv.lat],
      ],
    },
  }));

  return {
    links: top,
    spiderGeoJson: { type: 'FeatureCollection', features },
  };
}

export const NGIS_WORKSHOP_MODULES_1_TO_5 = [
  {
    num: '1/8',
    title: 'Getting Started with GeoLibre & Cloud-Native GIS',
    swTitle: 'Kuanza na GeoLibre, Projection (Globe/Mercator) & Kuhifadhi Mradi',
    videoUrl: 'https://youtu.be/luH-qzkIsU0',
    workbenchTarget: 'project' as const,
  },
  {
    num: '2/8',
    title: 'Bringing in Cloud-Hosted Data',
    swTitle: 'Kupakia Data Kutoka Wingu (GeoJSON, XYZ/COG Tiles & PMTiles Range)',
    videoUrl: 'https://youtu.be/yamrtUICBoU',
    workbenchTarget: 'cloud' as const,
  },
  {
    num: '3/8',
    title: 'Visualization and Styling',
    swTitle: 'Rangi za Symbology, Popups za Taarifa, Legend & Picha ya Ramani (PNG)',
    videoUrl: 'https://youtu.be/2uWzNPHbbOE',
    workbenchTarget: 'symbology' as const,
  },
  {
    num: '4/8',
    title: 'Attributes, Editing, and Spatial SQL',
    swTitle: 'Jedwali la Sifa (Attribute Table), Spatial SQL & Kuhamisha CSV/GeoJSON',
    videoUrl: 'https://youtu.be/uEdoKROdutg',
    workbenchTarget: 'sql' as const,
  },
  {
    num: '5/8',
    title: 'Analysis and Processing',
    swTitle: 'Uchakataji wa Ramani (Buffer Zones, Spatial Join & Nearest Drivers)',
    videoUrl: 'https://youtu.be/_urA2ZWx6Ks',
    workbenchTarget: 'geoprocessing' as const,
  },
];

