import L from 'leaflet';
import {
  OFFLINE_3D_BUILDINGS_GEOJSON,
  OFFLINE_COASTLINE_GEOJSON,
  OFFLINE_ROADS_GEOJSON,
  OFFLINE_TZ_PLACES,
} from './offlineMapVectorData';
import {
  MAP_TILE_CACHE_NAME,
  getForceOfflineMode,
  isEffectivelyOffline,
} from './offlineMapEngine';

let patched = false;

function lngLatToTilePixel(
  lng: number,
  lat: number,
  tileX: number,
  tileY: number,
  zoom: number
): [number, number] {
  const scale = 256 * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const worldX = ((lng + 180) / 360) * scale;
  const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [worldX - tileX * 256, worldY - tileY * 256];
}

function ringBBoxOverlapsTile(
  coords: number[][],
  tileX: number,
  tileY: number,
  zoom: number
): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < coords.length; i++) {
    const [px, py] = lngLatToTilePixel(coords[i][0], coords[i][1], tileX, tileY, zoom);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return maxX >= -20 && minX <= 276 && maxY >= -20 && minY <= 276;
}

/**
 * Renders a crisp 256x256 vector tile (ocean, roads, building footprints, landmarks, grid)
 * as a PNG data URL for any Leaflet 2D map when a tile isn't cached offline.
 */
export function renderOfflineVectorTileDataUrl(
  coords: { x: number; y: number; z: number },
  isDark = false
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { x, y, z } = coords;

  // 1. Background land surface
  ctx.fillStyle = isDark ? '#0f172a' : '#f1f5f9';
  ctx.fillRect(0, 0, 256, 256);

  // 2. Subtle vector tile grid
  ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 64; g < 256; g += 64) {
    ctx.moveTo(g, 0);
    ctx.lineTo(g, 256);
    ctx.moveTo(0, g);
    ctx.lineTo(256, g);
  }
  ctx.stroke();

  // 3. Water bodies (Indian Ocean, Harbour, Lake Victoria)
  ctx.fillStyle = isDark ? '#0c2d48' : '#bae6fd';
  ctx.strokeStyle = isDark ? '#0369a1' : '#38bdf8';
  ctx.lineWidth = 1;
  for (const feat of OFFLINE_COASTLINE_GEOJSON.features) {
    for (const ring of feat.geometry.coordinates) {
      if (!ringBBoxOverlapsTile(ring, x, y, z)) continue;
      ctx.beginPath();
      ring.forEach((pt, idx) => {
        const [px, py] = lngLatToTilePixel(pt[0], pt[1], x, y, z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 4. Buildings (visible at z >= 13)
  if (z >= 13) {
    ctx.fillStyle = isDark ? '#334155' : '#cbd5e1';
    ctx.strokeStyle = isDark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 0.8;
    for (const b of OFFLINE_3D_BUILDINGS_GEOJSON.features) {
      const ring = b.geometry.coordinates[0];
      if (!ring || !ringBBoxOverlapsTile(ring, x, y, z)) continue;
      ctx.beginPath();
      ring.forEach((pt, idx) => {
        const [px, py] = lngLatToTilePixel(pt[0], pt[1], x, y, z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 5. Arterial roads (casing + inner fill)
  const zoomScale = Math.max(0.7, Math.min(2.4, (z - 9) * 0.35));
  for (const road of OFFLINE_ROADS_GEOJSON.features) {
    const line = road.geometry.coordinates;
    if (!ringBBoxOverlapsTile(line, x, y, z)) continue;
    const cls = String(road.properties?.class || 'primary');
    const baseW = cls === 'trunk' || cls === 'motorway' ? 4.5 : cls === 'primary' ? 3.5 : 2.5;
    const w = baseW * zoomScale;

    // Casing
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = w + 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    line.forEach((pt, idx) => {
      const [px, py] = lngLatToTilePixel(pt[0], pt[1], x, y, z);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Road center
    ctx.strokeStyle =
      cls === 'trunk' || cls === 'motorway'
        ? '#f97316'
        : cls === 'primary'
        ? isDark
          ? '#38bdf8'
          : '#fbbf24'
        : isDark
        ? '#64748b'
        : '#ffffff';
    ctx.lineWidth = w;
    ctx.beginPath();
    line.forEach((pt, idx) => {
      const [px, py] = lngLatToTilePixel(pt[0], pt[1], x, y, z);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // 6. Offline Landmarks & Hub Labels
  if (z >= 11) {
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    for (const p of OFFLINE_TZ_PLACES) {
      const [px, py] = lngLatToTilePixel(p.lng, p.lat, x, y, z);
      if (px < -40 || px > 296 || py < -20 || py > 276) continue;

      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (z >= 12) {
        const shortName = p.name.split('(')[0].trim();
        ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
        ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.strokeText(shortName, px + 6, py);
        ctx.fillText(shortName, px + 6, py);
      }
    }
  }

  // 7. Discreet offline vector badge in tile corner
  ctx.fillStyle = isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.45)';
  ctx.font = '600 8px monospace';
  ctx.fillText(`OFFLINE ${z}/${x}/${y}`, 6, 248);

  return canvas.toDataURL('image/png');
}

/**
 * Patches Leaflet's TileLayer globally (once) so EVERY 2D map across Papo Hapo:
 * 1) Checks CacheStorage (`papo-map-tiles-v1`) when offline / force-offline,
 * 2) Renders the crisp vector canvas tile fallback instead of broken/blank grey boxes on cache miss,
 * 3) Auto-caches visited CORS-enabled tiles silently when online.
 */
export function installLeafletOfflineSupport(): void {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const proto = L.TileLayer.prototype as any;
  const origCreateTile = proto.createTile;

  proto.createTile = function (coords: L.Coords, done: L.DoneCallback) {
    const tileUrl: string = this.getTileUrl(coords);
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    const applyVectorFallback = () => {
      tile.onerror = null;
      tile.onload = () => {
        done(undefined, tile);
      };
      const isDark =
        document.documentElement.classList.contains('dark') ||
        String(tileUrl).includes('dark');
      const dataUrl = renderOfflineVectorTileDataUrl(
        { x: coords.x, y: coords.y, z: coords.z },
        isDark
      );
      if (dataUrl) {
        tile.src = dataUrl;
      } else {
        done(undefined, tile);
      }
    };

    const tryCacheThenFallback = async () => {
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(MAP_TILE_CACHE_NAME);
          const match = await cache.match(tileUrl);
          if (match) {
            if (match.type !== 'opaque') {
              const blob = await match.blob();
              const objUrl = URL.createObjectURL(blob);
              tile.onload = () => {
                URL.revokeObjectURL(objUrl);
                done(undefined, tile);
              };
              tile.onerror = applyVectorFallback;
              tile.src = objUrl;
              return;
            } else if (!getForceOfflineMode()) {
              // Opaque cached tile can still be served by SW when device is genuinely offline
              tile.onload = () => done(undefined, tile);
              tile.onerror = applyVectorFallback;
              tile.src = tileUrl;
              return;
            }
          }
        } catch {}
      }
      applyVectorFallback();
    };

    if (isEffectivelyOffline()) {
      void tryCacheThenFallback();
      return tile;
    }

    // Online path: delegate to Leaflet's normal tile loader but inject fallback on error
    const onlineTile: HTMLImageElement = origCreateTile
      ? origCreateTile.call(this, coords, (err: any, el: HTMLElement) => {
          if (err) {
            void tryCacheThenFallback();
          } else {
            done(err, el);
          }
        })
      : tile;

    const prevOnError = onlineTile.onerror;
    onlineTile.onerror = (ev) => {
      if (typeof prevOnError === 'function') {
        try {
          prevOnError.call(onlineTile, ev as any);
        } catch {}
      }
      void tryCacheThenFallback();
    };

    return onlineTile;
  };
}
