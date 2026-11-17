import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Undo2,
  Trash2,
  Plus,
  Copy,
  Layers,
  Flame,
  Store,
  Car,
  Shield,
  Bus,
  Route as RouteIcon,
  CircleDot,
  Hexagon,
  Upload,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ensureMapLibreGeoLibreSetup,
  GeoLibreBasemapId,
  GEOLIBRE_BASEMAPS,
  MAPBOX_STYLE_URLS,
  MapProjectionMode,
  getMapboxToken,
  normalizeLatLngList,
  toFirestoreLatLngList,
  calculatePathDistanceKm,
  calculatePolygonAreaKm2,
  buildCircleGeoJsonPolygon,
  buildSpatialDemandLayersData,
  computeSpatialCityAnalytics,
  evaluateVendorOpenStatus,
  DALADALA_CORRIDORS_GEOJSON,
  LatLngTuple,
} from '../../lib/geoLibreEngine';
import { GeoLibreBasemapPillBar } from '../map/GeoLibreControls';

export type GeoEditorMode = 'circle' | 'polygon' | 'route';

interface GeoLibreZoneEditorProps {
  cityName: string;
  center: LatLngTuple;
  radius: number;
  active: boolean;
  mode: GeoEditorMode;
  polygonPoints: any;
  routePoints?: any;
  onCenterChange: (pos: LatLngTuple) => void;
  onPolygonChange: (pts: { lat: number; lng: number }[]) => void;
  onRouteChange?: (pts: { lat: number; lng: number }[]) => void;
}

export const GeoLibreZoneEditor: React.FC<GeoLibreZoneEditorProps> = ({
  cityName,
  center,
  radius,
  active,
  mode,
  polygonPoints,
  routePoints,
  onCenterChange,
  onPolygonChange,
  onRouteChange,
}) => {
  const mapboxToken = useMemo(() => getMapboxToken(), []);
  const useMapbox = Boolean(mapboxToken);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [basemap, setBasemap] = useState<GeoLibreBasemapId>('street_3d');
  const [projection, setProjection] = useState<MapProjectionMode>('mercator');
  const [mapReady, setMapReady] = useState(false);

  const normalizedPoly = useMemo(() => normalizeLatLngList(polygonPoints), [polygonPoints]);
  const normalizedRoute = useMemo(() => normalizeLatLngList(routePoints), [routePoints]);
  const activeVertices = mode === 'route' ? normalizedRoute : normalizedPoly;

  // Live geodesic telemetry
  const telemetry = useMemo(() => {
    if (mode === 'circle') {
      const rKm = (radius || 15000) / 1000;
      return {
        areaKm2: Math.PI * rKm * rKm,
        lengthKm: 2 * Math.PI * rKm,
        count: 1,
      };
    }
    if (mode === 'route') {
      return {
        areaKm2: 0,
        lengthKm: calculatePathDistanceKm(normalizedRoute, false),
        count: normalizedRoute.length,
      };
    }
    return {
      areaKm2: calculatePolygonAreaKm2(normalizedPoly),
      lengthKm: calculatePathDistanceKm(normalizedPoly, true),
      count: normalizedPoly.length,
    };
  }, [mode, radius, normalizedPoly, normalizedRoute]);

  const activeGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    if (mode === 'circle') {
      return {
        type: 'FeatureCollection',
        features: [buildCircleGeoJsonPolygon(center[0], center[1], radius || 15000)],
      };
    }
    if (mode === 'route') {
      if (normalizedRoute.length < 2) return { type: 'FeatureCollection', features: [] };
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: normalizedRoute.map(([la, ln]) => [ln, la]),
            },
          },
        ],
      };
    }
    if (normalizedPoly.length >= 3) {
      const ring = normalizedPoly.map(([la, ln]) => [ln, la] as [number, number]);
      ring.push(ring[0]);
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
        ],
      };
    }
    if (normalizedPoly.length === 2) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: normalizedPoly.map(([la, ln]) => [ln, la]),
            },
          },
        ],
      };
    }
    return { type: 'FeatureCollection', features: [] };
  }, [mode, center, radius, normalizedPoly, normalizedRoute]);

  const syncZoneLayers = useCallback(
    (map: any) => {
      if (!map || !map.isStyleLoaded?.()) return;
      const strokeColor = mode === 'route' ? '#2563EB' : active ? '#EA580C' : '#9CA3AF';
      const fillColor = active ? '#F97316' : '#9CA3AF';
      try {
        if (!map.getSource('geolibre-editor-shape')) {
          map.addSource('geolibre-editor-shape', { type: 'geojson', data: activeGeoJson });
          map.addLayer({
            id: 'geolibre-editor-fill',
            type: 'fill',
            source: 'geolibre-editor-shape',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': fillColor, 'fill-opacity': 0.22 },
          });
          map.addLayer({
            id: 'geolibre-editor-line',
            type: 'line',
            source: 'geolibre-editor-shape',
            paint: {
              'line-color': strokeColor,
              'line-width': mode === 'route' ? 4 : 2.5,
            },
          });
        } else {
          (map.getSource('geolibre-editor-shape') as maplibregl.GeoJSONSource).setData(activeGeoJson);
          if (map.getLayer('geolibre-editor-fill')) {
            map.setPaintProperty('geolibre-editor-fill', 'fill-color', fillColor);
          }
          if (map.getLayer('geolibre-editor-line')) {
            map.setPaintProperty('geolibre-editor-line', 'line-color', strokeColor);
            map.setPaintProperty('geolibre-editor-line', 'line-width', mode === 'route' ? 4 : 2.5);
          }
        }
      } catch {}
    },
    [activeGeoJson, active, mode]
  );

  // Refs for click handler so we always read fresh mode & vertex lists without recreating the map
  const modeRef = useRef(mode);
  const polyRef = useRef(normalizedPoly);
  const routeRef = useRef(normalizedRoute);
  const callbacksRef = useRef({ onCenterChange, onPolygonChange, onRouteChange });
  modeRef.current = mode;
  polyRef.current = normalizedPoly;
  routeRef.current = normalizedRoute;
  callbacksRef.current = { onCenterChange, onPolygonChange, onRouteChange };

  useEffect(() => {
    if (!containerRef.current) return;

    let map: any;
    if (useMapbox) {
      map = new mapboxgl.Map({
        accessToken: mapboxToken,
        container: containerRef.current,
        style: MAPBOX_STYLE_URLS[basemap],
        center: [center[1] || 39.2083, center[0] || -6.7924],
        zoom: 11.8,
        projection,
        attributionControl: false,
      });
    } else {
      ensureMapLibreGeoLibreSetup();
      map = new maplibregl.Map({
        container: containerRef.current,
        style: GEOLIBRE_BASEMAPS[basemap].style,
        center: [center[1] || 39.2083, center[0] || -6.7924],
        zoom: 11.2,
        attributionControl: false,
      });
    }
    mapRef.current = map;

    map.on('load', () => {
      setMapReady(true);
      syncZoneLayers(map);
    });
    map.on('style.load', () => {
      setMapReady(true);
      syncZoneLayers(map);
    });

    map.on('click', (e: any) => {
      const lat = Number(e.lngLat.lat.toFixed(6));
      const lng = Number(e.lngLat.lng.toFixed(6));
      if (modeRef.current === 'circle') {
        callbacksRef.current.onCenterChange([lat, lng]);
      } else if (modeRef.current === 'route') {
        const next = [...routeRef.current, [lat, lng] as LatLngTuple];
        callbacksRef.current.onRouteChange?.(toFirestoreLatLngList(next));
      } else {
        const next = [...polyRef.current, [lat, lng] as LatLngTuple];
        callbacksRef.current.onPolygonChange(toFirestoreLatLngList(next));
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center smoothly when city switches
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [center[1] || 39.2083, center[0] || -6.7924], zoom: 11.8, duration: 500 });
  }, [cityName]);

  const prevBasemapRef = useRef<GeoLibreBasemapId>(basemap);
  // Swap basemap only when user selects a different style
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevBasemapRef.current === basemap) return;
    prevBasemapRef.current = basemap;
    map.setStyle(useMapbox ? MAPBOX_STYLE_URLS[basemap] : GEOLIBRE_BASEMAPS[basemap].style);
  }, [basemap, useMapbox]);

  // Toggle Globe / Mercator projection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.setProjection !== 'function') return;
    try {
      map.setProjection(projection);
    } catch {}
  }, [projection]);

  // Update shape layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncZoneLayers(map);
  }, [mapReady, syncZoneLayers]);

  // Render draggable vertex/center handles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (mode === 'circle') {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:22px;height:22px;border-radius:9999px;background:#EA580C;border:3px solid #FFF;box-shadow:0 4px 12px rgba(0,0,0,0.45);cursor:grab;"></div>`;
      const m: any = useMapbox
        ? new mapboxgl.Marker({ element: el, draggable: true }).setLngLat([center[1], center[0]]).addTo(map)
        : new maplibregl.Marker({ element: el, draggable: true }).setLngLat([center[1], center[0]]).addTo(map);
      m.on('dragend', () => {
        const ll = m.getLngLat();
        onCenterChange([Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6))]);
      });
      markersRef.current.push(m);
      return;
    }

    activeVertices.forEach((pt, idx) => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="min-width:22px;height:22px;padding:0 5px;border-radius:9999px;background:${mode === 'route' ? '#2563EB' : '#EA580C'};color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.4);cursor:grab;">${idx + 1}</div>`;
      const m: any = useMapbox
        ? new mapboxgl.Marker({ element: el, draggable: true }).setLngLat([pt[1], pt[0]]).addTo(map)
        : new maplibregl.Marker({ element: el, draggable: true }).setLngLat([pt[1], pt[0]]).addTo(map);
      m.on('dragend', () => {
        const ll = m.getLngLat();
        const cloned = [...activeVertices];
        cloned[idx] = [Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6))];
        if (mode === 'route') {
          onRouteChange?.(toFirestoreLatLngList(cloned));
        } else {
          onPolygonChange(toFirestoreLatLngList(cloned));
        }
      });
      markersRef.current.push(m);
    });
  }, [mode, center, activeVertices, onCenterChange, onPolygonChange, onRouteChange, useMapbox]);

  const handleExportGeoJson = () => {
    const json = JSON.stringify(activeGeoJson, null, 2);
    navigator.clipboard?.writeText(json);
    toast.success('GeoJSON imenakiliwa kwenye clipboard!');
  };

  const handleImportGeoJson = () => {
    const raw = window.prompt('Bandika GeoJSON Polygon au LineString coordinates hapa:');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const geom = parsed?.features?.[0]?.geometry || parsed?.geometry || parsed;
      if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
        const pts = geom.coordinates[0].slice(0, -1).map(([ln, la]: number[]) => [la, ln] as LatLngTuple);
        onPolygonChange(toFirestoreLatLngList(pts));
        toast.success(`Pointi ${pts.length} za Polygon zimeingizwa!`);
      } else if (geom?.type === 'LineString' && Array.isArray(geom.coordinates)) {
        const pts = geom.coordinates.map(([ln, la]: number[]) => [la, ln] as LatLngTuple);
        onRouteChange?.(toFirestoreLatLngList(pts));
        toast.success(`Pointi ${pts.length} za njia zimeingizwa!`);
      } else {
        toast.error('Muundo wa GeoJSON haujatambuliwa.');
      }
    } catch {
      toast.error('JSON si sahihi.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Live Spatial Telemetry Bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
          <span className="text-[10px] font-bold uppercase text-neutral-400 block">Ukubwa wa Eneo</span>
          <strong className="text-sm font-black font-mono tabular-nums text-neutral-900 dark:text-white">
            {mode === 'route' ? '—' : `${telemetry.areaKm2.toFixed(1)} km²`}
          </strong>
        </div>
        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
          <span className="text-[10px] font-bold uppercase text-neutral-400 block">
            {mode === 'route' ? 'Urefu wa Njia' : 'Mzingo (Perimeter)'}
          </span>
          <strong className="text-sm font-black font-mono tabular-nums text-orange-600 dark:text-orange-400">
            {telemetry.lengthKm.toFixed(1)} km
          </strong>
        </div>
        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
          <span className="text-[10px] font-bold uppercase text-neutral-400 block">Pointi (Vertices)</span>
          <strong className="text-sm font-black font-mono tabular-nums text-neutral-900 dark:text-white">
            {telemetry.count}
          </strong>
        </div>
      </div>

      {/* WebGL Map Viewport */}
      <div className="relative h-[28rem] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-900">
        <div ref={containerRef} className="w-full h-full" />

        {/* Basemap Switcher + Projection Toggle Top Left */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
          <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} compact={false} />
          <button
            type="button"
            onClick={() => setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'))}
            className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1 backdrop-blur-md shadow-lg cursor-pointer ${
              projection === 'globe'
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-neutral-950/85 border-white/15 text-neutral-300 hover:text-white'
            }`}
            title="Badili Globe / Mercator"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{projection === 'globe' ? 'Globe' : 'Mercator'}</span>
          </button>
        </div>

        {/* GeoEditor Action Bar Top Right */}
        {mode !== 'circle' && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-neutral-950/85 backdrop-blur-md p-1 rounded-xl border border-white/15">
            <button
              type="button"
              disabled={activeVertices.length === 0}
              onClick={() => {
                const next = activeVertices.slice(0, -1);
                if (mode === 'route') onRouteChange?.(toFirestoreLatLngList(next));
                else onPolygonChange(toFirestoreLatLngList(next));
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              title="Rudisha nyuma pointi ya mwisho"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleExportGeoJson}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-sky-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
              title="Nakili GeoJSON"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>GeoJSON</span>
            </button>
            <button
              type="button"
              onClick={handleImportGeoJson}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
              title="Ingiza GeoJSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Pakia</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === 'route') onRouteChange?.([]);
                else onPolygonChange([]);
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-400 hover:bg-rose-500/20 flex items-center gap-1 cursor-pointer"
              title="Futa zote"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Helper Hint Footer */}
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex justify-center">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-neutral-200">
            {mode === 'circle'
              ? 'Bofya popote kwenye ramani kuweka katikati ya mduara au buruta pointi ya rangi ya chungwa.'
              : mode === 'route'
                ? 'Bofya kwenye barabara mfululizo kuchora njia ya daladala/delivery; buruta namba kurekebisha.'
                : 'Bofya kwenye ramani kuongeza pembe za mpaka (Polygon); buruta namba yoyote kurekebisha.'}
          </div>
        </div>
      </div>
    </div>
  );
};

interface GeoLibreSpatialAnalyticsPanelProps {
  pricingRules: Record<string, any>;
  vendors: any[];
  drivers: any[];
  orders: any[];
}

export const GeoLibreSpatialAnalyticsPanel: React.FC<GeoLibreSpatialAnalyticsPanelProps> = ({
  pricingRules,
  vendors,
  drivers,
  orders,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [basemap, setBasemap] = useState<GeoLibreBasemapId>('night');
  const [mapReady, setMapReady] = useState(false);
  const [showHeatmap3D, setShowHeatmap3D] = useState(true);
  const [showVendorsLayer, setShowVendorsLayer] = useState(true);
  const [showDriversLayer, setShowDriversLayer] = useState(true);
  const [showGeofencesLayer, setShowGeofencesLayer] = useState(true);
  const [showDaladalaLayer, setShowDaladalaLayer] = useState(true);

  const analytics = useMemo(
    () => computeSpatialCityAnalytics({ pricingRules, vendors, drivers, orders }),
    [pricingRules, vendors, drivers, orders]
  );

  const demandData = useMemo(() => buildSpatialDemandLayersData({ orders }), [orders]);

  const geofencesGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    Object.entries(pricingRules || {}).forEach(([name, city]: [string, any]) => {
      if (!city) return;
      if ((city.geofenceType || 'circle') === 'polygon') {
        const poly = normalizeLatLngList(city.geofencePolygon);
        if (poly.length >= 3) {
          const ring = poly.map(([la, ln]) => [ln, la] as [number, number]);
          ring.push(ring[0]);
          features.push({
            type: 'Feature',
            properties: { name },
            geometry: { type: 'Polygon', coordinates: [ring] },
          });
          return;
        }
      }
      const cLat = Number(city.geofenceCenter?.lat ?? city.lat);
      const cLng = Number(city.geofenceCenter?.lng ?? city.lng);
      const rad = Number(city.geofenceRadius || 15000);
      if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
        const cFeat = buildCircleGeoJsonPolygon(cLat, cLng, rad);
        cFeat.properties = { name };
        features.push(cFeat);
      }
    });
    return { type: 'FeatureCollection', features };
  }, [pricingRules]);

  const syncAnalyticsLayers = useCallback(
    (map: maplibregl.Map) => {
      if (!map.isStyleLoaded()) return;

      // Geofences
      try {
        if (!map.getSource('admin-gf-src')) {
          map.addSource('admin-gf-src', { type: 'geojson', data: geofencesGeoJson });
          map.addLayer({
            id: 'admin-gf-fill',
            type: 'fill',
            source: 'admin-gf-src',
            paint: { 'fill-color': '#F97316', 'fill-opacity': 0.1 },
          });
          map.addLayer({
            id: 'admin-gf-line',
            type: 'line',
            source: 'admin-gf-src',
            paint: { 'line-color': '#F97316', 'line-width': 2 },
          });
        } else {
          (map.getSource('admin-gf-src') as maplibregl.GeoJSONSource).setData(geofencesGeoJson);
        }
        const gfVis = showGeofencesLayer ? 'visible' : 'none';
        map.setLayoutProperty('admin-gf-fill', 'visibility', gfVis);
        map.setLayoutProperty('admin-gf-line', 'visibility', gfVis);
      } catch {}

      // Daladala Corridors
      try {
        if (!map.getSource('admin-brt-src')) {
          map.addSource('admin-brt-src', { type: 'geojson', data: DALADALA_CORRIDORS_GEOJSON });
          map.addLayer({
            id: 'admin-brt-line',
            type: 'line',
            source: 'admin-brt-src',
            paint: { 'line-color': ['coalesce', ['get', 'color'], '#38BDF8'], 'line-width': 3, 'line-opacity': 0.75 },
          });
        }
        map.setLayoutProperty('admin-brt-line', 'visibility', showDaladalaLayer ? 'visible' : 'none');
      } catch {}

      // WebGL Heatmap + 3D Hex Columns
      try {
        if (!map.getSource('admin-heat-src')) {
          map.addSource('admin-heat-src', { type: 'geojson', data: demandData.heatPoints });
          map.addLayer({
            id: 'admin-heat-layer',
            type: 'heatmap',
            source: 'admin-heat-src',
            paint: {
              'heatmap-weight': ['coalesce', ['get', 'weight'], 0.7],
              'heatmap-intensity': 1.3,
              'heatmap-radius': 32,
              'heatmap-opacity': 0.75,
            },
          });
        } else {
          (map.getSource('admin-heat-src') as maplibregl.GeoJSONSource).setData(demandData.heatPoints);
        }
        if (!map.getSource('admin-hex-src')) {
          map.addSource('admin-hex-src', { type: 'geojson', data: demandData.hexColumns });
          map.addLayer({
            id: 'admin-hex-layer',
            type: 'fill-extrusion',
            source: 'admin-hex-src',
            paint: {
              'fill-extrusion-color': ['coalesce', ['get', 'color'], '#F97316'],
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 250],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.55,
            },
          });
        } else {
          (map.getSource('admin-hex-src') as maplibregl.GeoJSONSource).setData(demandData.hexColumns);
        }
        const hVis = showHeatmap3D ? 'visible' : 'none';
        map.setLayoutProperty('admin-heat-layer', 'visibility', hVis);
        map.setLayoutProperty('admin-hex-layer', 'visibility', hVis);
      } catch {}
    },
    [geofencesGeoJson, demandData, showGeofencesLayer, showDaladalaLayer, showHeatmap3D]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    ensureMapLibreGeoLibreSetup();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GEOLIBRE_BASEMAPS[basemap].style,
      center: [39.24, -6.805],
      zoom: 11.4,
      pitch: 45,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      setMapReady(true);
      syncAnalyticsLayers(map);
    });
    map.on('styledata', () => syncAnalyticsLayers(map));

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(GEOLIBRE_BASEMAPS[basemap].style);
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncAnalyticsLayers(map);
  }, [mapReady, syncAnalyticsLayers]);

  // Vendor & Driver Point Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (showVendorsLayer) {
      for (const v of vendors) {
        if (!v.location || !Number.isFinite(Number(v.location.lat))) continue;
        const st = evaluateVendorOpenStatus(v.operatingHours, v.hotelStatus);
        const el = document.createElement('div');
        el.title = `${v.businessName} (${st.label})`;
        el.style.cssText = `width:10px;height:10px;border-radius:9999px;background:${st.isOpen ? '#10B981' : '#EF4444'};border:2px solid #0F172A;box-shadow:0 2px 6px rgba(0,0,0,0.45);`;
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([Number(v.location.lng), Number(v.location.lat)])
            .addTo(map)
        );
      }
    }

    if (showDriversLayer) {
      for (const d of drivers) {
        const on = d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true;
        const pos = d.location || d.currentPosition;
        if (!on || !pos || !Number.isFinite(Number(pos.lat))) continue;
        const isBusy = d.receiving === false || Boolean(d.activeRideId);
        const el = document.createElement('div');
        el.title = `${d.name || d.displayName || 'Dereva'} (${isBusy ? 'Busy' : 'Online'})`;
        el.style.cssText = `width:12px;height:12px;border-radius:9999px;background:${isBusy ? '#F59E0B' : '#38BDF8'};border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.5);`;
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([Number(pos.lng), Number(pos.lat)])
            .addTo(map)
        );
      }
    }
  }, [vendors, drivers, showVendorsLayer, showDriversLayer]);

  return (
    <div className="space-y-6">
      {/* Top Spatial KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Eneo la Huduma (Geofence)</span>
          <div className="text-2xl font-black font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
            {analytics.totals.totalCoverageKm2.toFixed(0)} km²
          </div>
          <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
            {analytics.totals.geofenceCoveragePct}% ya oda ndani ya mipaka
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Maduka Wazi vs Imefungwa</span>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {analytics.totals.openVendors}{' '}
            <span className="text-sm text-rose-500">/ {analytics.totals.closedVendors}</span>
          </div>
          <span className="text-[11px] text-neutral-500">Muda halisi (UTC+3 EAT)</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Madereva (Online / Busy)</span>
          <div className="text-2xl font-black font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-1">
            {analytics.totals.onlineDrivers}{' '}
            <span className="text-sm text-amber-500">/ {analytics.totals.busyDrivers}</span>
          </div>
          <span className="text-[11px] text-neutral-500">Walio hewani kwa sasa</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Oda Zilizopimwa Ramani</span>
          <div className="text-2xl font-black font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
            {analytics.totals.totalOrdersMapped}
          </div>
          <span className="text-[11px] text-neutral-500">Zinazoonyeshwa kwenye 3D Hex Heatmap</span>
        </div>
      </div>

      {/* Interactive GeoLibre Spatial Heatmap Explorer */}
      <div className="rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 shadow-xl">
        <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-white">
              GeoLibre 3D Spatial Demand & Coverage Explorer
            </h3>
            <p className="text-[11px] text-neutral-400">
              Uchambuzi wa mahitaji (3D Hex), maduka wazi/yaliyofungwa, madereva, na mipaka ya huduma
            </p>
          </div>
          <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} />
        </div>

        <div className="px-5 py-2.5 bg-neutral-900/80 border-b border-white/10 flex flex-wrap items-center gap-2">
          {[
            { key: 'heat', label: '3D Demand Hex', state: showHeatmap3D, toggle: () => setShowHeatmap3D((s) => !s), icon: Flame },
            { key: 'vendors', label: 'Maduka (Wazi/Funga)', state: showVendorsLayer, toggle: () => setShowVendorsLayer((s) => !s), icon: Store },
            { key: 'drivers', label: 'Madereva Live', state: showDriversLayer, toggle: () => setShowDriversLayer((s) => !s), icon: Car },
            { key: 'gf', label: 'Mipaka (Geofence)', state: showGeofencesLayer, toggle: () => setShowGeofencesLayer((s) => !s), icon: Shield },
            { key: 'brt', label: 'Njia za Daladala', state: showDaladalaLayer, toggle: () => setShowDaladalaLayer((s) => !s), icon: Bus },
          ].map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.key}
                type="button"
                onClick={btn.toggle}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  btn.state
                    ? 'bg-orange-600 border-orange-500 text-white'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        <div ref={containerRef} className="w-full h-[420px]" />
      </div>

      {/* Per-City Spatial Breakdown Table */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h4 className="text-sm font-black uppercase tracking-tight text-neutral-900 dark:text-white">
            Uchambuzi wa Kijiografia kwa Kila Mji (Spatial Breakdown)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-5 py-3">Mji</th>
                <th className="px-5 py-3">Umbo la Mpaka</th>
                <th className="px-5 py-3 text-right">Ukubwa (km²)</th>
                <th className="px-5 py-3 text-right">Mzingo (km)</th>
                <th className="px-5 py-3 text-right">Wazi / Funga</th>
                <th className="px-5 py-3 text-right">Online / Busy</th>
                <th className="px-5 py-3 text-right">Oda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {analytics.cityMetrics.map((m) => (
                <tr key={m.cityName} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="px-5 py-3 font-bold text-neutral-900 dark:text-white">
                    {m.cityName}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      {m.geofenceType === 'polygon' ? (
                        <Hexagon className="w-3.5 h-3.5 text-orange-500" />
                      ) : m.geofenceType === 'route' ? (
                        <RouteIcon className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <CircleDot className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>{m.geofenceType.toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums font-bold">
                    {m.areaKm2.toFixed(1)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-neutral-500">
                    {m.perimeterKm.toFixed(1)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">
                    <span className="text-emerald-600 font-bold">{m.openVendors}</span> /{' '}
                    <span className="text-rose-500">{m.closedVendors}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">
                    <span className="text-sky-600 font-bold">{m.onlineDrivers}</span> /{' '}
                    <span className="text-amber-500">{m.busyDrivers}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums font-bold">
                    {m.ordersInside}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
