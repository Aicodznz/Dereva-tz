import { useEffect, useState } from 'react';
import {
  OFFLINE_TZ_PLACES,
  OFFLINE_ROADS_GEOJSON,
  OfflinePlaceEntry,
} from './offlineMapVectorData';
import type {
  NearbyEssentialKind,
  NearbyEssentialResult,
  PapoMapRouteOption,
  TravelMode,
} from './mapboxNavigation';

export const MAP_TILE_CACHE_NAME = 'papo-map-tiles-v1';
export const MAP_STYLE_CACHE_NAME = 'papo-map-styles-v1';

const DB_NAME = 'papo_offline_maps_db';
const DB_VERSION = 1;
const STORE_REGIONS = 'regions';
const STORE_PLACES = 'places';
const STORE_ROUTES = 'routes';
const FORCE_OFFLINE_KEY = 'papohapo_force_offline_maps_v1';

export interface OfflineBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface OfflineRegionPreset {
  id: string;
  name: string;
  subtitle: string;
  bbox: OfflineBoundingBox;
  center: [number, number]; // [lat, lng]
  rasterZooms: number[]; // e.g., [12, 13, 14, 15]
  vectorZooms: number[]; // e.g., [10, 12, 14]
  estimatedMb: string;
}

export interface DownloadedOfflineRegion {
  id: string;
  name: string;
  subtitle: string;
  bbox: OfflineBoundingBox;
  center: [number, number];
  rasterZooms: number[];
  vectorZooms: number[];
  tileCount: number;
  styleCount: number;
  sizeBytes: number;
  downloadedAt: number;
  supports2D: boolean;
  supports3D: boolean;
}

export interface OfflineDownloadProgress {
  regionId: string;
  regionName: string;
  phase: 'styles' | '2d_tiles' | '3d_tiles' | 'saving' | 'done';
  completed: number;
  total: number;
  percent: number;
  bytesDownloaded: number;
}

export const OFFLINE_REGIONS: OfflineRegionPreset[] = [
  {
    id: 'dar-cbd',
    name: 'Dar es Salaam Kati (Posta & Kariakoo)',
    subtitle: 'Posta, Kariakoo, Upanga, Kivukoni, Muhimbili, Magomeni',
    bbox: { minLat: -6.835, maxLat: -6.798, minLng: 39.255, maxLng: 39.308 },
    center: [-6.8165, 39.282],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~4 MB',
  },
  {
    id: 'dar-north',
    name: 'Dar Kaskazini (Kinondoni, Sinza & Masaki)',
    subtitle: 'Ubungo, Sinza, Mwenge, Mlimani City, Mikocheni, Masaki, Coco Beach',
    bbox: { minLat: -6.802, maxLat: -6.740, minLng: 39.205, maxLng: 39.288 },
    center: [-6.774, 39.245],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~5 MB',
  },
  {
    id: 'dar-all',
    name: 'Dar es Salaam Yote (Pamoja na Airport & Mbagala)',
    subtitle: 'Kimara, Mbezi, JNIA Airport, Buguruni, Tazara, Temeke, Kigamboni',
    bbox: { minLat: -6.905, maxLat: -6.680, minLng: 39.120, maxLng: 39.330 },
    center: [-6.805, 39.240],
    rasterZooms: [11, 12, 13, 14],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~7 MB',
  },
  {
    id: 'zanzibar',
    name: 'Zanzibar (Stone Town & Airport)',
    subtitle: 'Mji Mkongwe, Darajani, Bandari ya Malindi, AAKIA Airport',
    bbox: { minLat: -6.235, maxLat: -6.140, minLng: 39.180, maxLng: 39.240 },
    center: [-6.175, 39.205],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~4 MB',
  },
  {
    id: 'arusha',
    name: 'Arusha Jiji',
    subtitle: 'Clock Tower, AICC, Stendi Kuu, Mount Meru & Barabara Kuu',
    bbox: { minLat: -3.400, maxLat: -3.350, minLng: 36.655, maxLng: 36.715 },
    center: [-3.374, 36.685],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~4 MB',
  },
  {
    id: 'mwanza',
    name: 'Mwanza Jiji (Rock City)',
    subtitle: 'Kenyatta Rd, Rock City Mall, Bugando, Nyegezi & Ziwa Victoria',
    bbox: { minLat: -2.555, maxLat: -2.485, minLng: 32.885, maxLng: 32.940 },
    center: [-2.518, 32.908],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~4 MB',
  },
  {
    id: 'dodoma',
    name: 'Dodoma Jiji (Makao Makuu)',
    subtitle: 'Bunge, Nyerere Square, SGR Station & Katikati ya Jiji',
    bbox: { minLat: -6.205, maxLat: -6.145, minLng: 35.720, maxLng: 35.785 },
    center: [-6.174, 35.750],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~4 MB',
  },
];

// --- Slippy Map Tile Math ---
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

export function tileToLatLngBounds(
  x: number,
  y: number,
  z: number
): { north: number; south: number; west: number; east: number } {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { north, south, west, east };
}

export function enumerateTilesForBBox(
  bbox: OfflineBoundingBox,
  zooms: number[],
  maxTiles = 320
): Array<{ z: number; x: number; y: number }> {
  const result: Array<{ z: number; x: number; y: number }> = [];
  const sortedZooms = [...zooms].sort((a, b) => a - b);

  for (const z of sortedZooms) {
    const topLeft = latLngToTile(bbox.maxLat, bbox.minLng, z);
    const bottomRight = latLngToTile(bbox.minLat, bbox.maxLng, z);
    const minX = Math.min(topLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, bottomRight.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (result.length >= maxTiles) return result;
        result.push({ z, x, y });
      }
    }
  }
  return result;
}

export function buildViewportRegionPreset(
  centerLat: number,
  centerLng: number,
  label?: string
): OfflineRegionPreset {
  const dLat = 0.022;
  const dLng = 0.026;
  return {
    id: `viewport-${centerLat.toFixed(3)}-${centerLng.toFixed(3)}`,
    name: label ? `Eneo Lako: ${label}` : 'Eneo la Sasa Kwenye Ramani',
    subtitle: `Kituo (${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}) · 2D & 3D`,
    bbox: {
      minLat: centerLat - dLat,
      maxLat: centerLat + dLat,
      minLng: centerLng - dLng,
      maxLng: centerLng + dLng,
    },
    center: [centerLat, centerLng],
    rasterZooms: [12, 13, 14, 15],
    vectorZooms: [10, 12, 14],
    estimatedMb: '~3 MB',
  };
}

// --- Network & Offline Mode State ---
const listeners = new Set<() => void>();

export function getForceOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FORCE_OFFLINE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setForceOfflineMode(force: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (force) {
      window.localStorage.setItem(FORCE_OFFLINE_KEY, '1');
    } else {
      window.localStorage.removeItem(FORCE_OFFLINE_KEY);
    }
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_FORCE_OFFLINE',
        value: force,
      });
    }
    window.dispatchEvent(new CustomEvent('papo-offline-status-change', { detail: { force } }));
  } catch {}
  listeners.forEach((fn) => fn());
}

export function isEffectivelyOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !navigator.onLine || getForceOfflineMode();
}

export function subscribeOfflineStatus(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    window.addEventListener('papo-offline-status-change', cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', cb);
      window.removeEventListener('offline', cb);
      window.removeEventListener('papo-offline-status-change', cb);
    }
  };
}

export function useOfflineMapStatus(): {
  isOnline: boolean;
  isOffline: boolean;
  forceOffline: boolean;
  setForceOffline: (v: boolean) => void;
} {
  const [state, setState] = useState(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    forceOffline: getForceOfflineMode(),
  }));

  useEffect(() => {
    const sync = () => {
      setState({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        forceOffline: getForceOfflineMode(),
      });
    };
    return subscribeOfflineStatus(sync);
  }, []);

  return {
    isOnline: state.isOnline && !state.forceOffline,
    isOffline: !state.isOnline || state.forceOffline,
    forceOffline: state.forceOffline,
    setForceOffline: setForceOfflineMode,
  };
}

// --- IndexedDB Wrapper ---
let dbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_REGIONS)) {
          db.createObjectStore(STORE_REGIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PLACES)) {
          db.createObjectStore(STORE_PLACES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ROUTES)) {
          db.createObjectStore(STORE_ROUTES, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error || new Error('Failed to open IndexedDB'));
      };
    });
  }
  return dbPromise;
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function idbPut<T>(storeName: string, item: T): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export async function listDownloadedRegions(): Promise<DownloadedOfflineRegion[]> {
  const list = await idbGetAll<DownloadedOfflineRegion>(STORE_REGIONS);
  return list.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
}

export async function getOfflineStorageStats(): Promise<{
  regionsCount: number;
  cachedTileRequests: number;
  cachedStyleRequests: number;
  estimatedBytes: number;
}> {
  const regions = await listDownloadedRegions();
  let cachedTileRequests = 0;
  let cachedStyleRequests = 0;

  if (typeof caches !== 'undefined') {
    try {
      const tileCache = await caches.open(MAP_TILE_CACHE_NAME);
      const tileKeys = await tileCache.keys();
      cachedTileRequests = tileKeys.length;
    } catch {}
    try {
      const styleCache = await caches.open(MAP_STYLE_CACHE_NAME);
      const styleKeys = await styleCache.keys();
      cachedStyleRequests = styleKeys.length;
    } catch {}
  }

  let estimatedBytes = regions.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);
  if (estimatedBytes === 0 && cachedTileRequests > 0) {
    estimatedBytes = cachedTileRequests * 18 * 1024;
  }

  return {
    regionsCount: regions.length,
    cachedTileRequests,
    cachedStyleRequests,
    estimatedBytes,
  };
}

export function formatBytesSw(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Tile & Style Downloader (2D + 3D) ---
async function fetchAndCacheRequest(
  cache: Cache,
  url: string,
  signal?: AbortSignal,
  allowOpaque = true
): Promise<number> {
  try {
    const existing = await cache.match(url);
    if (existing) {
      return 16 * 1024;
    }
  } catch {}

  try {
    const res = await fetch(url, { mode: 'cors', signal });
    if (res.ok) {
      const clone = res.clone();
      let size = 18 * 1024;
      try {
        const buf = await clone.arrayBuffer();
        size = buf.byteLength || size;
      } catch {}
      await cache.put(url, res);
      return size;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    if (allowOpaque) {
      try {
        const opaqueRes = await fetch(url, { mode: 'no-cors', signal });
        if (opaqueRes) {
          await cache.put(url, opaqueRes);
          return 18 * 1024;
        }
      } catch (innerErr: any) {
        if (innerErr?.name === 'AbortError') throw innerErr;
      }
    }
  }
  return 0;
}

export async function downloadOfflineRegion(
  region: OfflineRegionPreset,
  onProgress?: (progress: OfflineDownloadProgress) => void,
  signal?: AbortSignal
): Promise<DownloadedOfflineRegion> {
  if (typeof caches === 'undefined') {
    throw new Error('Kivinjari hakiungi mkono hifadhi ya CacheStorage.');
  }

  const tileCache = await caches.open(MAP_TILE_CACHE_NAME);
  const styleCache = await caches.open(MAP_STYLE_CACHE_NAME);

  const rasterCoords = enumerateTilesForBBox(region.bbox, region.rasterZooms, 180);
  const vectorCoords = enumerateTilesForBBox(region.bbox, region.vectorZooms, 90);

  // Build 2D OSM tile URLs + Google roadmap tile URLs for key zooms
  const rasterUrls: string[] = [];
  for (const c of rasterCoords) {
    rasterUrls.push(`https://tile.openstreetmap.org/${c.z}/${c.x}/${c.y}.png`);
    if (c.z <= 14) {
      const sub = (c.x + c.y) % 4;
      rasterUrls.push(`https://mt${sub}.google.com/vt/lyrs=m&x=${c.x}&y=${c.y}&z=${c.z}`);
    }
  }

  // 3D Styles to cache
  const styleUrls = [
    'https://tiles.openfreemap.org/styles/liberty',
    'https://tiles.openfreemap.org/styles/dark',
    'https://tiles.openfreemap.org/styles/positron',
    'https://tiles.openfreemap.org/styles/bright',
    '/maplibre-gl-worker.mjs',
  ];

  // Collect dynamic 3D vector tile templates from TileJSON when available
  const vectorTileUrls: string[] = [];
  let styleCount = 0;
  let bytesDownloaded = 0;

  const totalSteps = styleUrls.length + rasterUrls.length + vectorCoords.length + 2;
  let completed = 0;

  const emit = (phase: OfflineDownloadProgress['phase']) => {
    onProgress?.({
      regionId: region.id,
      regionName: region.name,
      phase,
      completed,
      total: totalSteps,
      percent: Math.min(100, Math.round((completed / Math.max(1, totalSteps)) * 100)),
      bytesDownloaded,
    });
  };

  emit('styles');

  // 1. Fetch & cache 3D styles, sprites, glyphs & inspect TileJSON
  const discoveredTileTemplates = new Set<string>();
  for (const sUrl of styleUrls) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(sUrl, { mode: 'cors', signal });
      if (res.ok) {
        const clone = res.clone();
        const text = await clone.text();
        bytesDownloaded += text.length;
        await styleCache.put(sUrl, res);
        styleCount += 1;

        if (sUrl.includes('/styles/')) {
          try {
            const styleJson = JSON.parse(text);
            if (typeof styleJson?.sprite === 'string') {
              for (const ext of ['.json', '.png', '@2x.json', '@2x.png']) {
                bytesDownloaded += await fetchAndCacheRequest(
                  styleCache,
                  `${styleJson.sprite}${ext}`,
                  signal,
                  false
                );
              }
            }
            if (typeof styleJson?.glyphs === 'string') {
              const sampleFonts = ['Noto Sans Regular', 'Noto Sans Bold'];
              for (const fontStack of sampleFonts) {
                const glyphUrl = styleJson.glyphs
                  .replace('{fontstack}', encodeURIComponent(fontStack))
                  .replace('{range}', '0-255');
                bytesDownloaded += await fetchAndCacheRequest(styleCache, glyphUrl, signal, false);
              }
            }
            const sources = styleJson?.sources || {};
            for (const srcVal of Object.values(sources) as any[]) {
              if (typeof srcVal?.url === 'string' && srcVal.url.startsWith('http')) {
                try {
                  const tjRes = await fetch(srcVal.url, { mode: 'cors', signal });
                  if (tjRes.ok) {
                    const tjClone = tjRes.clone();
                    const tjJson = await tjClone.json();
                    await styleCache.put(srcVal.url, tjRes);
                    if (Array.isArray(tjJson?.tiles) && tjJson.tiles[0]) {
                      discoveredTileTemplates.add(tjJson.tiles[0]);
                    }
                  }
                } catch {}
              } else if (Array.isArray(srcVal?.tiles) && srcVal.tiles[0]) {
                discoveredTileTemplates.add(srcVal.tiles[0]);
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
    completed += 1;
    emit('styles');
  }

  const tileTemplate =
    Array.from(discoveredTileTemplates)[0] ||
    'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf';

  for (const vc of vectorCoords) {
    vectorTileUrls.push(
      tileTemplate
        .replace('{z}', String(vc.z))
        .replace('{x}', String(vc.x))
        .replace('{y}', String(vc.y))
    );
  }

  // Helper for bounded concurrency
  const runBatch = async (
    urls: string[],
    targetCache: Cache,
    phase: OfflineDownloadProgress['phase'],
    allowOpaque: boolean
  ) => {
    const CONCURRENCY = 6;
    let idx = 0;
    let successCount = 0;
    const worker = async () => {
      while (idx < urls.length) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const currentUrl = urls[idx++];
        const bytes = await fetchAndCacheRequest(targetCache, currentUrl, signal, allowOpaque);
        if (bytes > 0) {
          bytesDownloaded += bytes;
          successCount += 1;
        }
        completed += 1;
        emit(phase);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length || 1) }, worker));
    return successCount;
  };

  // 2. Cache 2D raster tiles
  emit('2d_tiles');
  const cached2DCount = await runBatch(rasterUrls, tileCache, '2d_tiles', true);

  // 3. Cache 3D vector tiles
  emit('3d_tiles');
  const cached3DCount = await runBatch(vectorTileUrls, tileCache, '3d_tiles', false);

  // 4. Persist region places inside bbox + metadata in IndexedDB
  emit('saving');
  for (const p of OFFLINE_TZ_PLACES) {
    if (
      p.lat >= region.bbox.minLat - 0.1 &&
      p.lat <= region.bbox.maxLat + 0.1 &&
      p.lng >= region.bbox.minLng - 0.1 &&
      p.lng <= region.bbox.maxLng + 0.1
    ) {
      await idbPut(STORE_PLACES, {
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        region: p.region,
        district: p.district,
        aliases: p.aliases,
        savedAt: Date.now(),
      });
    }
  }

  const record: DownloadedOfflineRegion = {
    id: region.id,
    name: region.name,
    subtitle: region.subtitle,
    bbox: region.bbox,
    center: region.center,
    rasterZooms: region.rasterZooms,
    vectorZooms: region.vectorZooms,
    tileCount: cached2DCount + cached3DCount,
    styleCount,
    sizeBytes: Math.max(bytesDownloaded, (cached2DCount + cached3DCount) * 14 * 1024),
    downloadedAt: Date.now(),
    supports2D: true,
    supports3D: true,
  };

  await idbPut(STORE_REGIONS, record);
  completed = totalSteps;
  emit('done');
  listeners.forEach((fn) => fn());
  return record;
}

export async function deleteOfflineRegion(regionId: string): Promise<void> {
  await idbDelete(STORE_REGIONS, regionId);
  listeners.forEach((fn) => fn());
}

export async function clearAllOfflineMapCaches(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await Promise.all([
      caches.delete(MAP_TILE_CACHE_NAME).catch(() => false),
      caches.delete(MAP_STYLE_CACHE_NAME).catch(() => false),
    ]);
  }
  const regions = await listDownloadedRegions();
  for (const r of regions) {
    await idbDelete(STORE_REGIONS, r.id);
  }
  listeners.forEach((fn) => fn());
}

// --- Offline Geocoding & Reverse Geocoding ---
function calcKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export interface OfflineGeocodeResult {
  place_id?: string | number;
  lat: string;
  lon: string;
  lng?: number;
  display_name: string;
  name?: string;
  offline?: boolean;
}

export async function cacheSearchResultsOffline(results: any[]): Promise<void> {
  if (!Array.isArray(results)) return;
  for (const item of results.slice(0, 8)) {
    const lat = Number(item?.lat);
    const lng = Number(item?.lon ?? item?.lng);
    const displayName = String(item?.display_name || item?.name || '').trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !displayName) continue;
    const id = `cached-${lat.toFixed(4)}-${lng.toFixed(4)}`;
    await idbPut(STORE_PLACES, {
      id,
      name: displayName.split(',')[0].trim(),
      displayName,
      lat,
      lng,
      category: 'cached',
      region: 'Tanzania',
      district: '',
      aliases: [displayName.toUpperCase()],
      savedAt: Date.now(),
    });
  }
}

export async function searchPlacesOffline(
  queryStr: string,
  extraPlaces: Array<{ name: string; displayName?: string; lat: number; lng: number }> = [],
  limitCount = 6
): Promise<OfflineGeocodeResult[]> {
  const q = queryStr.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const idbPlaces = await idbGetAll<any>(STORE_PLACES);

  const combined: Array<{ name: string; displayName: string; lat: number; lng: number; hay: string; id: string }> = [
    ...OFFLINE_TZ_PLACES.map((p: OfflinePlaceEntry) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      lat: p.lat,
      lng: p.lng,
      hay: `${p.name} ${p.displayName} ${p.region} ${p.district} ${p.aliases.join(' ')}`.toLowerCase(),
    })),
    ...idbPlaces.map((p: any, idx: number) => ({
      id: p.id || `idb-${idx}`,
      name: p.name || p.displayName || 'Eneo',
      displayName: p.displayName || p.name || 'Eneo',
      lat: Number(p.lat),
      lng: Number(p.lng),
      hay: `${p.name || ''} ${p.displayName || ''} ${(p.aliases || []).join(' ')}`.toLowerCase(),
    })),
    ...extraPlaces.map((p, idx) => ({
      id: `extra-${idx}`,
      name: p.name,
      displayName: p.displayName || p.name,
      lat: Number(p.lat),
      lng: Number(p.lng),
      hay: `${p.name} ${p.displayName || ''}`.toLowerCase(),
    })),
  ].filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

  const seen = new Set<string>();
  const scored: Array<{ score: number; item: OfflineGeocodeResult }> = [];

  for (const entry of combined) {
    const key = `${entry.lat.toFixed(4)}_${entry.lng.toFixed(4)}`;
    if (seen.has(key)) continue;

    let score = 0;
    if (entry.name.toLowerCase() === q) score += 100;
    else if (entry.name.toLowerCase().startsWith(q)) score += 60;
    else if (entry.hay.includes(q)) score += 40;
    else {
      let tokenHits = 0;
      for (const tk of tokens) {
        if (entry.hay.includes(tk)) tokenHits += 1;
      }
      if (tokenHits > 0) score += tokenHits * 15;
    }

    if (score > 0) {
      seen.add(key);
      scored.push({
        score,
        item: {
          place_id: entry.id,
          lat: String(entry.lat),
          lon: String(entry.lng),
          lng: entry.lng,
          display_name: `${entry.displayName} (Offline)`,
          name: entry.name,
          offline: true,
        },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limitCount).map((s) => s.item);
}

export async function searchPlacesOfflineFirst(
  queryStr: string,
  opts: {
    limit?: number;
    countrycodes?: string;
    addressdetails?: boolean;
    extraPlaces?: Array<{ name: string; displayName?: string; lat: number; lng: number }>;
  } = {}
): Promise<OfflineGeocodeResult[]> {
  const limit = opts.limit ?? 6;
  const offlineFallback = () => searchPlacesOffline(queryStr, opts.extraPlaces || [], limit);

  if (isEffectivelyOffline()) {
    return offlineFallback();
  }

  try {
    const params = new URLSearchParams({
      q: queryStr.trim(),
      limit: String(limit),
    });
    if (opts.countrycodes) params.set('countrycodes', opts.countrycodes);
    if (opts.addressdetails) params.set('addressdetails', '1');

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? window.setTimeout(() => ctrl.abort(), 5500) : null;
    const res = await fetch(`/api/geo/search?${params.toString()}`, {
      signal: ctrl?.signal,
    });
    if (timer) window.clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        void cacheSearchResultsOffline(json);
        return json;
      }
    }
  } catch {
    // Fall through to local offline search
  }

  return offlineFallback();
}

export async function reverseGeocodeOffline(
  lat: number,
  lng: number
): Promise<{ display_name: string; name: string; offline: true }> {
  const idbPlaces = await idbGetAll<any>(STORE_PLACES);
  const all = [
    ...OFFLINE_TZ_PLACES.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      lat: p.lat,
      lng: p.lng,
    })),
    ...idbPlaces.map((p: any) => ({
      name: p.name || 'Eneo',
      displayName: p.displayName || p.name || 'Eneo',
      lat: Number(p.lat),
      lng: Number(p.lng),
    })),
  ].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  let nearest: { name: string; displayName: string; dist: number } | null = null;
  for (const p of all) {
    const d = calcKm(lat, lng, p.lat, p.lng);
    if (!nearest || d < nearest.dist) {
      nearest = { name: p.name, displayName: p.displayName, dist: d };
    }
  }

  if (nearest && nearest.dist <= 25) {
    if (nearest.dist <= 0.45) {
      return {
        name: nearest.name,
        display_name: `${nearest.displayName} (Offline)`,
        offline: true,
      };
    }
    return {
      name: `Karibu na ${nearest.name}`,
      display_name: `Karibu na ${nearest.displayName} (${nearest.dist.toFixed(1)} km · Offline)`,
      offline: true,
    };
  }

  return {
    name: `Eneo (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    display_name: `Kuratibu (${lat.toFixed(4)}, ${lng.toFixed(4)}) · Offline`,
    offline: true,
  };
}

export async function reverseGeocodeOfflineFirst(
  lat: number,
  lng: number,
  zoom = 18
): Promise<{ display_name: string; name?: string; address?: any; offline?: boolean }> {
  if (isEffectivelyOffline()) {
    return reverseGeocodeOffline(lat, lng);
  }
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? window.setTimeout(() => ctrl.abort(), 5000) : null;
    const res = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lng}&zoom=${zoom}`, {
      signal: ctrl?.signal,
    });
    if (timer) window.clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) {
        void cacheSearchResultsOffline([{ lat, lon: lng, display_name: data.display_name }]);
        return data;
      }
    }
  } catch {}
  return reverseGeocodeOffline(lat, lng);
}

// --- Offline Route Cache & Corridor-Aware Route Builder ---
export async function cacheRouteOffline(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: TravelMode;
  routes: PapoMapRouteOption[];
}): Promise<void> {
  if (!params.routes?.length) return;
  const key = `${params.mode}_${params.origin.lat.toFixed(3)}_${params.origin.lng.toFixed(3)}_${params.destination.lat.toFixed(3)}_${params.destination.lng.toFixed(3)}`;
  await idbPut(STORE_ROUTES, {
    key,
    mode: params.mode,
    origin: params.origin,
    destination: params.destination,
    routes: params.routes,
    savedAt: Date.now(),
  });
}

export async function findCachedRouteOffline(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: TravelMode;
}): Promise<PapoMapRouteOption[] | null> {
  const all = await idbGetAll<any>(STORE_ROUTES);
  for (const entry of all) {
    if (entry.mode !== params.mode || !Array.isArray(entry.routes)) continue;
    const dOrig = calcKm(params.origin.lat, params.origin.lng, entry.origin?.lat, entry.origin?.lng);
    const dDest = calcKm(
      params.destination.lat,
      params.destination.lng,
      entry.destination?.lat,
      entry.destination?.lng
    );
    if (dOrig <= 0.45 && dDest <= 0.45) {
      return entry.routes as PapoMapRouteOption[];
    }
  }
  return null;
}

/**
 * Builds an intelligent offline route using bundled Dar/Tanzania arterial road corridors
 * when nearby, or road-weighted Haversine geometry with Swahili turn-by-turn steps.
 */
export function buildOfflineRoadAwareRoute(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: TravelMode;
}): PapoMapRouteOption {
  const { origin, destination, mode } = params;
  const straightKm = Math.max(0.1, calcKm(origin.lat, origin.lng, destination.lat, destination.lng));

  // Snap midpoints along nearest major offline corridor if origin & dest are in Tanzania
  let bestRoadName = 'Barabara Kuu (Offline)';
  let viaPoint: [number, number] | null = null;
  let bestScore = Infinity;

  for (const feat of OFFLINE_ROADS_GEOJSON.features) {
    const coords = feat.geometry.coordinates;
    if (coords.length < 2) continue;
    for (let i = 0; i < coords.length; i++) {
      const [lng, lat] = coords[i];
      const dOrig = calcKm(origin.lat, origin.lng, lat, lng);
      const dDest = calcKm(destination.lat, destination.lng, lat, lng);
      const total = dOrig + dDest;
      if (dOrig <= straightKm * 1.15 && dDest <= straightKm * 1.15 && total < straightKm * 1.45) {
        if (total < bestScore) {
          bestScore = total;
          viaPoint = [lng, lat];
          bestRoadName = String(feat.properties?.name || bestRoadName);
        }
      }
    }
  }

  const coords: [number, number][] = viaPoint
    ? [
        [origin.lng, origin.lat],
        viaPoint,
        [destination.lng, destination.lat],
      ]
    : [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ];

  let roadKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    roadKm += calcKm(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
  }
  const distM = Math.round(Math.max(roadKm, straightKm) * 1.15 * 1000);
  const speedKmh = mode === 'walking' ? 4.8 : mode === 'cycling' ? 24 : 30;
  const durS = Math.max(60, Math.round(((distM / 1000) / speedKmh) * 3600));

  const steps = viaPoint
    ? [
        {
          instructionSw: `Anza safari kuelekea ${bestRoadName}`,
          roadName: bestRoadName,
          distanceMeters: Math.round(distM * 0.45),
          durationSeconds: Math.round(durS * 0.45),
          maneuverType: 'depart',
          location: [origin.lng, origin.lat] as [number, number],
        },
        {
          instructionSw: `Endelea kupitia ${bestRoadName} kuelekea lengo`,
          roadName: bestRoadName,
          distanceMeters: Math.round(distM * 0.55),
          durationSeconds: Math.round(durS * 0.55),
          maneuverType: 'continue',
          modifier: 'straight',
          location: viaPoint,
        },
        {
          instructionSw: 'Umefika unakokwenda!',
          roadName: '',
          distanceMeters: 0,
          durationSeconds: 0,
          maneuverType: 'arrive',
          location: [destination.lng, destination.lat] as [number, number],
        },
      ]
    : [
        {
          instructionSw: 'Elekea upande wa lengo lililowekwa alama (Offline)',
          roadName: bestRoadName,
          distanceMeters: distM,
          durationSeconds: durS,
          maneuverType: 'depart',
          location: [origin.lng, origin.lat] as [number, number],
        },
        {
          instructionSw: 'Umefika unakokwenda!',
          roadName: '',
          distanceMeters: 0,
          durationSeconds: 0,
          maneuverType: 'arrive',
          location: [destination.lng, destination.lat] as [number, number],
        },
      ];

  return {
    id: 'offline-route-0',
    summary: viaPoint ? `Njia ya Offline (${bestRoadName})` : 'Njia ya Offline (Kadirio)',
    distanceMeters: distM,
    durationSeconds: durS,
    trafficStatus: 'clear',
    trafficLabel: 'Hali ya Offline',
    geometry: { type: 'LineString', coordinates: coords },
    congestionGeoJson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { congestion: 'low', color: '#0EA5E9' },
          geometry: { type: 'LineString', coordinates: coords },
        },
      ],
    },
    steps,
    source: 'direct',
  };
}

export function getOfflineNearbyEssentials(params: {
  lat: number;
  lng: number;
  kind: NearbyEssentialKind;
}): NearbyEssentialResult[] {
  const { lat, lng, kind } = params;
  return OFFLINE_TZ_PLACES.filter((p) => p.category === kind)
    .map((p) => ({
      id: p.id,
      kind,
      name: p.name,
      address: `${p.displayName} (Offline)`,
      lat: p.lat,
      lng: p.lng,
      distanceKm: calcKm(lat, lng, p.lat, p.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6);
}
