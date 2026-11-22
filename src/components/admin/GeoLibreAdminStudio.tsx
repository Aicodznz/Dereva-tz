import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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
  Database,
  Code2,
  Download,
  Camera,
  Palette,
  Compass,
  FolderOpen,
  Save,
  Play,
  ExternalLink,
  BookOpen,
  Navigation,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  GeoLibreBasemapId,
  GEOLIBRE_BASEMAPS,
  MAPBOX_STYLE_URLS,
  MapProjectionMode,
  getMapboxToken,
  resolveMapboxAccessToken,
  resolveBasemapStyleSync,
  attachOffline3DFallback,
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
  VendorSymbologyMode,
  resolveVendorSymbologyStyle,
  getSymbologyLegend,
  GeoLibreProjectState,
  parseGeoLibreProject,
  CloudPmTilesInspection,
  inspectPmTilesRemote,
  fetchCloudGeoJsonSource,
  computeGeoJsonBounds,
  CLOUD_NATIVE_SAMPLE_DATASETS,
  SpatialDatasetName,
  buildAttributeRows,
  executeSpatialSqlQuery,
  runGeodesicBufferAnalysis,
  BufferAnalysisResult,
  computeNearestDriversSpider,
  NearestDriverLink,
  NGIS_WORKSHOP_MODULES_1_TO_5,
  stripMapWatermarks,
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
          (map.getSource('geolibre-editor-shape') as mapboxgl.GeoJSONSource).setData(activeGeoJson);
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

    const accessToken = resolveMapboxAccessToken(mapboxToken);
    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      accessToken,
      container: containerRef.current,
      style: resolveBasemapStyleSync(basemap, useMapbox) as any,
      center: [center[1] || 39.2083, center[0] || -6.7924],
      zoom: useMapbox ? 11.8 : 11.2,
      projection,
      attributionControl: false,
    });
    mapRef.current = map;
    stripMapWatermarks(map);
    const detachOffline = attachOffline3DFallback(map, () => prevBasemapRef.current);

    map.on('load', () => {
      setMapReady(true);
      stripMapWatermarks(map);
      syncZoneLayers(map);
    });
    map.on('style.load', () => {
      setMapReady(true);
      stripMapWatermarks(map);
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
      detachOffline();
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
    map.setStyle(resolveBasemapStyleSync(basemap, useMapbox) as any);
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
      const m = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([center[1], center[0]])
        .addTo(map);
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
      const m = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([pt[1], pt[0]])
        .addTo(map);
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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);

  const [basemap, setBasemap] = useState<GeoLibreBasemapId>('night');
  const [projection, setProjection] = useState<MapProjectionMode>('mercator');
  const [mapReady, setMapReady] = useState(false);
  const [showHeatmap3D, setShowHeatmap3D] = useState(true);
  const [showVendorsLayer, setShowVendorsLayer] = useState(true);
  const [showDriversLayer, setShowDriversLayer] = useState(true);
  const [showGeofencesLayer, setShowGeofencesLayer] = useState(true);
  const [showDaladalaLayer, setShowDaladalaLayer] = useState(true);

  // Module 3/8: Symbology Mode & Dynamic Legend
  const [symbologyMode, setSymbologyMode] = useState<VendorSymbologyMode>('status');
  const legendItems = useMemo(() => getSymbologyLegend(symbologyMode), [symbologyMode]);

  // Active Cloud-Native GIS Workbench Tab (Modules 1-5)
  const [workbenchTab, setWorkbenchTab] = useState<'sql' | 'cloud' | 'geoprocessing' | 'lessons'>('sql');

  // Module 2/8: Cloud-Hosted Data Loader (GeoJSON, XYZ Raster, PMTiles Range Inspector)
  const [cloudInputType, setCloudInputType] = useState<'geojson' | 'xyz' | 'pmtiles'>('geojson');
  const [cloudUrlInput, setCloudUrlInput] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudGeoJson, setCloudGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [cloudGeoJsonLabel, setCloudGeoJsonLabel] = useState('');
  const [cloudXyzUrl, setCloudXyzUrl] = useState('');
  const [cloudXyzOpacity, setCloudXyzOpacity] = useState(0.7);
  const [pmtilesInfo, setPmTilesInfo] = useState<CloudPmTilesInspection | null>(null);

  // Module 4/8: Attribute Table & Spatial SQL Console
  const [attrDataset, setAttrDataset] = useState<SpatialDatasetName>('vendors');
  const [attrSearch, setAttrSearch] = useState('');
  const [sqlText, setSqlText] = useState(
    "SELECT id, name, category, status, city, amount, inside_geofence FROM vendors WHERE status = 'open' ORDER BY amount DESC LIMIT 25"
  );
  const [sqlModeActive, setSqlModeActive] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  // Module 5/8: In-Browser Geoprocessing Toolbox (Buffer, Nearest Drivers)
  const [bufferSource, setBufferSource] = useState<'open_vendors' | 'brt_stops' | 'city_centers'>('open_vendors');
  const [bufferRadiusKm, setBufferRadiusKm] = useState<number>(2);
  const [bufferResult, setBufferResult] = useState<BufferAnalysisResult | null>(null);
  const [spiderTargetVendorId, setSpiderTargetVendorId] = useState<string>('');
  const [spiderLinks, setSpiderLinks] = useState<NearestDriverLink[]>([]);
  const [spiderGeoJson, setSpiderGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

  const analytics = useMemo(
    () => computeSpatialCityAnalytics({ pricingRules, vendors, drivers, orders }),
    [pricingRules, vendors, drivers, orders]
  );

  const vendorOrderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) {
      const vid = String(o?.vendorId || '');
      if (vid) counts.set(vid, (counts.get(vid) || 0) + 1);
    }
    return counts;
  }, [orders]);

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

  const allDatasets = useMemo(
    () => ({
      vendors: buildAttributeRows({ dataset: 'vendors', pricingRules, vendors, drivers, orders }),
      drivers: buildAttributeRows({ dataset: 'drivers', pricingRules, vendors, drivers, orders }),
      orders: buildAttributeRows({ dataset: 'orders', pricingRules, vendors, drivers, orders }),
      cities: buildAttributeRows({ dataset: 'cities', pricingRules, vendors, drivers, orders }),
      cloud: buildAttributeRows({ dataset: 'cloud', pricingRules, vendors, drivers, orders, cloudFc: cloudGeoJson }),
    }),
    [pricingRules, vendors, drivers, orders, cloudGeoJson]
  );

  const sqlResult = useMemo(
    () => (sqlModeActive ? executeSpatialSqlQuery(sqlText, allDatasets) : null),
    [sqlModeActive, sqlText, allDatasets]
  );

  const filteredAttrRows = useMemo(() => {
    const rows = allDatasets[attrDataset] || [];
    const q = attrSearch.trim().toLowerCase();
    if (!q) return rows.slice(0, 60);
    return rows
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [allDatasets, attrDataset, attrSearch]);

  const syncAnalyticsLayers = useCallback(
    (map: mapboxgl.Map) => {
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
          (map.getSource('admin-gf-src') as mapboxgl.GeoJSONSource).setData(geofencesGeoJson);
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
          (map.getSource('admin-heat-src') as mapboxgl.GeoJSONSource).setData(demandData.heatPoints);
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
          (map.getSource('admin-hex-src') as mapboxgl.GeoJSONSource).setData(demandData.hexColumns);
        }
        const hVis = showHeatmap3D ? 'visible' : 'none';
        map.setLayoutProperty('admin-heat-layer', 'visibility', hVis);
        map.setLayoutProperty('admin-hex-layer', 'visibility', hVis);
      } catch {}

      // Module 2/8: Cloud XYZ Raster Stream Layer
      try {
        if (cloudXyzUrl) {
          if (!map.getSource('cloud-xyz-src')) {
            map.addSource('cloud-xyz-src', {
              type: 'raster',
              tiles: [cloudXyzUrl],
              tileSize: 256,
              maxzoom: 19,
            });
            map.addLayer({
              id: 'cloud-xyz-layer',
              type: 'raster',
              source: 'cloud-xyz-src',
              paint: { 'raster-opacity': cloudXyzOpacity },
            });
          } else {
            map.setPaintProperty('cloud-xyz-layer', 'raster-opacity', cloudXyzOpacity);
          }
        } else if (map.getLayer('cloud-xyz-layer')) {
          map.removeLayer('cloud-xyz-layer');
          if (map.getSource('cloud-xyz-src')) map.removeSource('cloud-xyz-src');
        }
      } catch {}

      // Module 2/8: Cloud GeoJSON Layer
      try {
        const fcData: GeoJSON.FeatureCollection = cloudGeoJson || { type: 'FeatureCollection', features: [] };
        if (!map.getSource('cloud-geojson-src')) {
          map.addSource('cloud-geojson-src', { type: 'geojson', data: fcData });
          map.addLayer({
            id: 'cloud-geojson-fill',
            type: 'fill',
            source: 'cloud-geojson-src',
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: { 'fill-color': '#38BDF8', 'fill-opacity': 0.25 },
          });
          map.addLayer({
            id: 'cloud-geojson-line',
            type: 'line',
            source: 'cloud-geojson-src',
            paint: { 'line-color': '#38BDF8', 'line-width': 2.5 },
          });
          map.addLayer({
            id: 'cloud-geojson-point',
            type: 'circle',
            source: 'cloud-geojson-src',
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            paint: {
              'circle-radius': 6,
              'circle-color': '#38BDF8',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            },
          });
        } else {
          (map.getSource('cloud-geojson-src') as mapboxgl.GeoJSONSource).setData(fcData);
        }
      } catch {}

      // Module 5/8: Geoprocessing Buffer Polygons
      try {
        const bufData: GeoJSON.FeatureCollection =
          bufferResult?.buffersFc || { type: 'FeatureCollection', features: [] };
        if (!map.getSource('geoproc-buffer-src')) {
          map.addSource('geoproc-buffer-src', { type: 'geojson', data: bufData });
          map.addLayer({
            id: 'geoproc-buffer-fill',
            type: 'fill',
            source: 'geoproc-buffer-src',
            paint: { 'fill-color': '#10B981', 'fill-opacity': 0.14 },
          });
          map.addLayer({
            id: 'geoproc-buffer-line',
            type: 'line',
            source: 'geoproc-buffer-src',
            paint: { 'line-color': '#10B981', 'line-width': 2, 'line-dasharray': [2, 2] },
          });
        } else {
          (map.getSource('geoproc-buffer-src') as mapboxgl.GeoJSONSource).setData(bufData);
        }
      } catch {}

      // Module 5/8: Nearest Driver Spider Links
      try {
        const spData: GeoJSON.FeatureCollection =
          spiderGeoJson || { type: 'FeatureCollection', features: [] };
        if (!map.getSource('geoproc-spider-src')) {
          map.addSource('geoproc-spider-src', { type: 'geojson', data: spData });
          map.addLayer({
            id: 'geoproc-spider-line',
            type: 'line',
            source: 'geoproc-spider-src',
            paint: { 'line-color': '#FACC15', 'line-width': 3, 'line-opacity': 0.9 },
          });
        } else {
          (map.getSource('geoproc-spider-src') as mapboxgl.GeoJSONSource).setData(spData);
        }
      } catch {}
    },
    [
      geofencesGeoJson,
      demandData,
      showGeofencesLayer,
      showDaladalaLayer,
      showHeatmap3D,
      cloudGeoJson,
      cloudXyzUrl,
      cloudXyzOpacity,
      bufferResult,
      spiderGeoJson,
    ]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const accessToken = resolveMapboxAccessToken();
    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      accessToken,
      container: containerRef.current,
      style: resolveBasemapStyleSync(basemap, false) as any,
      center: [39.24, -6.805],
      zoom: 11.4,
      pitch: 45,
      preserveDrawingBuffer: true, // Enables PNG map print export (Module 3/8)
      attributionControl: false,
    });
    mapRef.current = map;
    stripMapWatermarks(map);
    const detachAnalyticsOffline = attachOffline3DFallback(map, () => basemap);

    map.on('load', () => {
      setMapReady(true);
      stripMapWatermarks(map);
      syncAnalyticsLayers(map);
    });
    map.on('styledata', () => {
      stripMapWatermarks(map);
      syncAnalyticsLayers(map);
    });

    // Interactive Popups for Daladala Corridors & Cloud Features (Module 3/8)
    map.on('click', 'admin-brt-line', (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties || {};
      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:sans-serif;font-size:12px;color:#0f172a;">
            <strong>${p.name || 'Njia ya Usafiri'}</strong><br/>
            <span>Kodi: ${p.code || '-'} • Nauli: ${p.fare || '-'}</span>
          </div>`
        )
        .addTo(map);
    });
    map.on('click', 'cloud-geojson-point', (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties || {};
      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:sans-serif;font-size:12px;color:#0f172a;">
            <strong>${p.name || p.title || p.place || 'Cloud Feature'}</strong><br/>
            <span>${p.type || p.status || 'GeoJSON Feature'}</span>
          </div>`
        )
        .addTo(map);
    });

    return () => {
      detachAnalyticsOffline();
      popupRef.current?.remove();
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevBasemapRef = useRef<GeoLibreBasemapId>(basemap);
  useEffect(() => {
    if (prevBasemapRef.current === basemap) return;
    prevBasemapRef.current = basemap;
    mapRef.current?.setStyle(resolveBasemapStyleSync(basemap, false) as any);
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      (map as any).setProjection?.(projection === 'globe' ? 'globe' : 'mercator');
    } catch {}
  }, [projection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncAnalyticsLayers(map);
  }, [mapReady, syncAnalyticsLayers]);

  // Vendor & Driver Point Markers with Dynamic Symbology & Click Popups (Module 3/8 & 4/8 highlights)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (showVendorsLayer) {
      for (const v of vendors) {
        if (!v.location || !Number.isFinite(Number(v.location.lat))) continue;
        const vid = String(v.id || '');
        const ordCnt = vendorOrderCounts.get(vid) || 0;
        const sym = resolveVendorSymbologyStyle(v, symbologyMode, ordCnt);
        const isHighlighted = highlightedIds.size > 0 && highlightedIds.has(vid);
        const size = isHighlighted ? Math.max(16, sym.sizePx + 4) : sym.sizePx;

        const el = document.createElement('div');
        el.title = `${v.businessName} (${sym.statusLabel})`;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${sym.color};border:${isHighlighted ? '3px solid #FACC15' : '2px solid #0F172A'};box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;`;
        el.onclick = (ev) => {
          ev.stopPropagation();
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ offset: 12 })
            .setLngLat([Number(v.location.lng), Number(v.location.lat)])
            .setHTML(
              `<div style="font-family:sans-serif;font-size:12px;color:#0f172a;min-width:160px;">
                <strong>${v.businessName || 'Duka'}</strong><br/>
                <span>Hali: <b>${sym.statusLabel}</b> • Aina: ${sym.categoryLabel}</span><br/>
                <span>Oda: <b>${ordCnt}</b> • ${v.city || 'Dar es Salaam'}</span>
              </div>`
            )
            .addTo(map);
        };
        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
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
        const did = String(d.id || d.uid || '');
        const isBusy = d.receiving === false || Boolean(d.activeRideId);
        const isHighlighted = highlightedIds.size > 0 && highlightedIds.has(did);
        const size = isHighlighted ? 16 : 12;

        const el = document.createElement('div');
        el.title = `${d.name || d.displayName || 'Dereva'} (${isBusy ? 'Busy' : 'Online'})`;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${isBusy ? '#F59E0B' : '#38BDF8'};border:${isHighlighted ? '3px solid #FACC15' : '2px solid #FFFFFF'};box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;`;
        el.onclick = (ev) => {
          ev.stopPropagation();
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ offset: 12 })
            .setLngLat([Number(pos.lng), Number(pos.lat)])
            .setHTML(
              `<div style="font-family:sans-serif;font-size:12px;color:#0f172a;">
                <strong>${d.name || d.displayName || 'Dereva'}</strong><br/>
                <span>Hali: <b>${isBusy ? 'Yupo Safari (Busy)' : 'Online / Tayari'}</b></span><br/>
                <span>Chombo: ${d.driverType || d.vehicleType || 'taxi'}</span>
              </div>`
            )
            .addTo(map);
        };
        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([Number(pos.lng), Number(pos.lat)])
            .addTo(map)
        );
      }
    }
  }, [vendors, drivers, showVendorsLayer, showDriversLayer, symbologyMode, vendorOrderCounts, highlightedIds]);

  const flyToCoord = (lat: number | null, lng: number | null, label?: string) => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) {
      toast.error('Kipengele hiki hakina majira ya GPS.');
      return;
    }
    map.flyTo({ center: [lng, lat], zoom: 14.5, pitch: 50, duration: 900 });
    if (label) {
      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ offset: 14 })
        .setLngLat([lng, lat])
        .setHTML(`<div style="font-family:sans-serif;font-size:12px;color:#0f172a;"><strong>${label}</strong></div>`)
        .addTo(map);
    }
  };

  // Module 1/8: Save & Load GeoLibre Project JSON
  const handleSaveProject = () => {
    const map = mapRef.current;
    const center = map ? map.getCenter() : { lng: 39.24, lat: -6.805 };
    const project: GeoLibreProjectState = {
      version: 'geolibre-ngis-v1',
      savedAt: new Date().toISOString(),
      basemap,
      projection,
      camera: {
        center: [Number(center.lng.toFixed(5)), Number(center.lat.toFixed(5))],
        zoom: Number((map?.getZoom() || 11.4).toFixed(2)),
        pitch: Number((map?.getPitch() || 45).toFixed(1)),
        bearing: Number((map?.getBearing() || 0).toFixed(1)),
      },
      symbologyMode,
      layers: {
        showHeatmap3D,
        showVendorsLayer,
        showDriversLayer,
        showGeofencesLayer,
        showDaladalaLayer,
      },
      cloudLayers: [
        ...(cloudXyzUrl ? [{ id: 'xyz', name: 'Cloud XYZ', kind: 'xyz' as const, url: cloudXyzUrl, opacity: cloudXyzOpacity }] : []),
        ...(pmtilesInfo ? [{ id: 'pmtiles', name: pmtilesInfo.metadataName || 'PMTiles', kind: 'pmtiles' as const, url: pmtilesInfo.url }] : []),
      ],
      sqlQuery: sqlText,
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `papohapo-geolibre-${Date.now()}.geolibre.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Mradi wa GeoLibre umehifadhiwa (.geolibre.json).');
  };

  const handleLoadProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = parseGeoLibreProject(txt);
      if (!parsed) {
        toast.error('Faili la mradi wa GeoLibre si sahihi.');
        return;
      }
      setBasemap(parsed.basemap);
      setProjection(parsed.projection || 'mercator');
      setSymbologyMode(parsed.symbologyMode || 'status');
      setShowHeatmap3D(parsed.layers?.showHeatmap3D ?? true);
      setShowVendorsLayer(parsed.layers?.showVendorsLayer ?? true);
      setShowDriversLayer(parsed.layers?.showDriversLayer ?? true);
      setShowGeofencesLayer(parsed.layers?.showGeofencesLayer ?? true);
      setShowDaladalaLayer(parsed.layers?.showDaladalaLayer ?? true);
      if (parsed.sqlQuery) setSqlText(parsed.sqlQuery);
      const xyz = parsed.cloudLayers?.find((l) => l.kind === 'xyz');
      if (xyz) {
        setCloudXyzUrl(xyz.url);
        setCloudXyzOpacity(xyz.opacity ?? 0.7);
      }
      mapRef.current?.flyTo({
        center: parsed.camera.center,
        zoom: parsed.camera.zoom,
        pitch: parsed.camera.pitch,
        bearing: parsed.camera.bearing,
      });
      toast.success('Mradi wa GeoLibre umepakiwa kikamilifu!');
    } catch {
      toast.error('Imeshindwa kusoma faili la mradi.');
    } finally {
      e.target.value = '';
    }
  };

  // Module 3/8: Export Map PNG
  const handleExportPng = () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const dataUrl = map.getCanvas().toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `geolibre-map-${Date.now()}.png`;
      a.click();
      toast.success('Picha ya ramani (PNG) imepakuliwa!');
    } catch {
      toast.error('Imeshindwa kupakua picha (Cross-Origin tiles zinaweza kuzuia canvas).');
    }
  };

  // Module 2/8: Load Cloud-Hosted Source (GeoJSON, XYZ, PMTiles)
  const handleLoadCloudData = async (overrideKind?: 'geojson' | 'xyz' | 'pmtiles', overrideUrl?: string, overrideName?: string) => {
    const targetKind = overrideKind || cloudInputType;
    const targetUrl = (overrideUrl ?? cloudUrlInput).trim();
    if (!targetUrl) {
      toast.error('Weka URL ya data ya wingu (GeoJSON, XYZ Tiles, au PMTiles).');
      return;
    }
    setCloudLoading(true);
    try {
      if (targetKind === 'xyz') {
        if (!targetUrl.includes('{z}') || !targetUrl.includes('{x}')) {
          toast.error('URL ya XYZ Tiles lazima iwe na {z}/{x}/{y}.');
          return;
        }
        // Force source rebuild on URL change
        if (mapRef.current?.getLayer('cloud-xyz-layer')) {
          mapRef.current.removeLayer('cloud-xyz-layer');
          if (mapRef.current.getSource('cloud-xyz-src')) mapRef.current.removeSource('cloud-xyz-src');
        }
        setCloudXyzUrl(targetUrl);
        toast.success(`Safu ya XYZ imeunganishwa: ${overrideName || targetUrl}`);
      } else if (targetKind === 'pmtiles') {
        const info = await inspectPmTilesRemote(targetUrl);
        setPmTilesInfo(info);
        const [minLon, minLat, maxLon, maxLat] = info.bounds;
        if (maxLon > minLon && maxLat > minLat && maxLon - minLon < 160) {
          mapRef.current?.fitBounds(
            [
              [minLon, minLat],
              [maxLon, maxLat],
            ],
            { padding: 40, duration: 900 }
          );
        }
        toast.success(`PMTiles imekaguliwa kupitia HTTP Range (${info.tileTypeLabel}, Zoom ${info.minZoom}-${info.maxZoom})`);
      } else {
        const fc = await fetchCloudGeoJsonSource(targetUrl);
        setCloudGeoJson(fc);
        setCloudGeoJsonLabel(overrideName || targetUrl);
        setAttrDataset('cloud');
        const bounds = computeGeoJsonBounds(fc);
        if (bounds) {
          mapRef.current?.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 900 });
        }
        toast.success(`GeoJSON (${fc.features.length} vipengele) imetiririshwa moja kwa moja!`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Imeshindwa kusoma data kutoka wingu.');
    } finally {
      setCloudLoading(false);
    }
  };

  // Module 4/8: Export Rows CSV / GeoJSON
  const handleExportRowsCsv = () => {
    const rowsToExport = sqlModeActive && sqlResult?.ok ? sqlResult.rows : filteredAttrRows;
    if (!rowsToExport.length) {
      toast.error('Hakuna data ya kuhamisha.');
      return;
    }
    const keys = Object.keys(rowsToExport[0]).filter((k) => !k.startsWith('_'));
    const csvLines = [
      keys.join(','),
      ...rowsToExport.map((r: any) =>
        keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `geolibre-${attrDataset}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Faili la CSV limepakuliwa!');
  };

  const handleExportRowsGeoJson = () => {
    const sourceRows = allDatasets[attrDataset] || [];
    const filtered = highlightedIds.size > 0 ? sourceRows.filter((r) => highlightedIds.has(r.id)) : sourceRows;
    const features = filtered
      .filter((r) => r.lat !== null && r.lng !== null)
      .map((r) => ({
        type: 'Feature' as const,
        properties: {
          id: r.id,
          name: r.name,
          category: r.category,
          status: r.status,
          city: r.city,
          amount: r.amount,
          inside_geofence: r.inside_geofence,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [r.lng!, r.lat!],
        },
      }));
    const fc = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `geolibre-${attrDataset}-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`GeoJSON (${features.length} alama) imepakuliwa!`);
  };

  // Module 5/8: Execute Geoprocessing Buffer & Nearest Drivers
  const handleRunBuffer = () => {
    const res = runGeodesicBufferAnalysis({
      sourceType: bufferSource,
      radiusKm: bufferRadiusKm,
      vendors,
      drivers,
      orders,
      pricingRules,
    });
    setBufferResult(res);
    toast.success(
      `Buffer ya ${bufferRadiusKm} km imetengenezwa (${res.bufferCount} miduara • ${res.coveragePct}% ya oda zimefunikwa).`
    );
  };

  const handleRunNearestDrivers = () => {
    const v = vendors.find((x) => String(x.id) === spiderTargetVendorId) || vendors.find((x) => Number.isFinite(Number(x?.location?.lat)));
    const targetLat = Number(v?.location?.lat ?? -6.816);
    const targetLng = Number(v?.location?.lng ?? 39.289);
    const targetName = String(v?.businessName || 'Posta Kati (Dar es Salaam)');
    const res = computeNearestDriversSpider({
      targetLat,
      targetLng,
      targetName,
      drivers,
      limit: 5,
    });
    setSpiderLinks(res.links);
    setSpiderGeoJson(res.spiderGeoJson);
    flyToCoord(targetLat, targetLng, targetName);
    if (res.links.length === 0) {
      toast.info('Hakuna dereva aliye online mwenye GPS kwa sasa.');
    } else {
      toast.success(`Madereva ${res.links.length} wa karibu na ${targetName} wameunganishwa.`);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".json,.geolibre.json"
        className="hidden"
        onChange={handleLoadProjectFile}
      />

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

      {/* Interactive GeoLibre Spatial Heatmap & Cloud-Native GIS Explorer */}
      <div className="rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 shadow-xl">
        <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-white">
              GeoLibre Cloud-Native GIS & 3D Coverage Explorer
            </h3>
            <p className="text-[11px] text-neutral-400">
              NGIS Modules 1–5: Cloud Data, Symbology, Spatial SQL & In-Browser Geoprocessing
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Module 1/8: Globe vs Mercator & Save/Open Project */}
            <button
              type="button"
              onClick={() => setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'))}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 cursor-pointer"
              title="Badili Projection (Globe / Mercator)"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>{projection === 'globe' ? 'Globe 3D' : 'Mercator'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveProject}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 cursor-pointer"
              title="Hifadhi Mradi (.geolibre.json)"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hifadhi</span>
            </button>
            <button
              type="button"
              onClick={() => projectFileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 cursor-pointer"
              title="Fungua Mradi Uliopita"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Fungua</span>
            </button>
            <button
              type="button"
              onClick={handleExportPng}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 cursor-pointer"
              title="Pakua Picha ya Ramani (PNG)"
            >
              <Camera className="w-3.5 h-3.5 text-rose-400" />
              <span>PNG</span>
            </button>
            <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} />
          </div>
        </div>

        {/* Layer & Symbology Toolbar (Module 3/8) */}
        <div className="px-5 py-2.5 bg-neutral-900/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'heat', label: '3D Demand Hex', state: showHeatmap3D, toggle: () => setShowHeatmap3D((s) => !s), icon: Flame },
              { key: 'vendors', label: 'Maduka', state: showVendorsLayer, toggle: () => setShowVendorsLayer((s) => !s), icon: Store },
              { key: 'drivers', label: 'Madereva', state: showDriversLayer, toggle: () => setShowDriversLayer((s) => !s), icon: Car },
              { key: 'gf', label: 'Mipaka', state: showGeofencesLayer, toggle: () => setShowGeofencesLayer((s) => !s), icon: Shield },
              { key: 'brt', label: 'BRT & Daladala', state: showDaladalaLayer, toggle: () => setShowDaladalaLayer((s) => !s), icon: Bus },
            ].map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={btn.toggle}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
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

          {/* Symbology Switcher */}
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] font-bold uppercase text-neutral-400">Symbology:</span>
            {([
              { id: 'status', label: 'Wazi/Funga' },
              { id: 'category', label: 'Aina' },
              { id: 'orders_graduated', label: 'Kiasi cha Oda' },
            ] as const).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSymbologyMode(s.id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                  symbologyMode === s.id
                    ? 'bg-white text-neutral-950'
                    : 'bg-white/5 text-neutral-300 hover:bg-white/15'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div ref={containerRef} className="w-full h-[430px]" />

          {/* Dynamic Legend Overlay (Module 3/8) */}
          <div className="absolute bottom-3 left-3 z-10 bg-neutral-950/90 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 text-[10px] text-neutral-200 space-y-1 max-w-[220px]">
            <div className="font-black uppercase tracking-wider text-neutral-400 text-[9px]">
              Ufunguo wa Ramani (Legend)
            </div>
            {legendItems.map((it) => (
              <div key={it.label} className="flex items-center gap-2">
                <span
                  className="rounded-full shrink-0 border border-white/40"
                  style={{
                    width: `${it.sizePx || 10}px`,
                    height: `${it.sizePx || 10}px`,
                    backgroundColor: it.color,
                  }}
                />
                <span className="truncate">{it.label}</span>
              </div>
            ))}
            {(bufferResult || spiderLinks.length > 0 || highlightedIds.size > 0) && (
              <div className="pt-1 border-t border-white/10 flex flex-wrap gap-1.5">
                {highlightedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setHighlightedIds(new Set())}
                    className="text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    Ondoa Highlight ({highlightedIds.size})
                  </button>
                )}
                {bufferResult && (
                  <button
                    type="button"
                    onClick={() => setBufferResult(null)}
                    className="text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Futa Buffer
                  </button>
                )}
                {spiderGeoJson && (
                  <button
                    type="button"
                    onClick={() => {
                      setSpiderGeoJson(null);
                      setSpiderLinks([]);
                    }}
                    className="text-yellow-400 font-bold hover:underline cursor-pointer"
                  >
                    Futa Spider
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cloud-Native GIS Workbench (NGIS 2026 Workshop Modules 1/8 - 5/8) */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 dark:bg-neutral-950/60">
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: 'sql', label: 'Jedwali & Spatial SQL (4/8)', icon: Code2 },
              { id: 'cloud', label: 'Cloud Data & PMTiles (2/8)', icon: Database },
              { id: 'geoprocessing', label: 'Geoprocessing (5/8)', icon: Navigation },
              { id: 'lessons', label: 'Masomo NGIS 1/8–5/8', icon: BookOpen },
            ] as const).map((t) => {
              const Icon = t.icon;
              const active = workbenchTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setWorkbenchTab(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportRowsCsv}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportRowsGeoJson}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>GeoJSON</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Attribute Table + Spatial SQL Console (Module 4/8) */}
        {workbenchTab === 'sql' && (
          <div className="p-5 space-y-4">
            {/* Spatial SQL Query Bar */}
            <div className="p-4 rounded-2xl bg-neutral-950 text-white border border-neutral-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  Spatial SQL Query Engine (DuckDB-style)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'Maduka Wazi',
                      sql: "SELECT id, name, category, city, amount, inside_geofence FROM vendors WHERE status = 'open' ORDER BY amount DESC LIMIT 25",
                    },
                    {
                      label: 'Oda Nje ya Mpaka',
                      sql: 'SELECT id, name, category, status, amount, distance_dar_km FROM orders WHERE inside_geofence = false ORDER BY amount DESC LIMIT 25',
                    },
                    {
                      label: 'Madereva Online',
                      sql: "SELECT id, name, category, status, distance_dar_km, inside_geofence FROM drivers WHERE status = 'online' ORDER BY distance_dar_km ASC LIMIT 25",
                    },
                    {
                      label: 'Miji Mikubwa',
                      sql: 'SELECT id, name, category, area_km2, amount FROM cities ORDER BY area_km2 DESC LIMIT 15',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSqlText(preset.sql);
                        setSqlModeActive(true);
                        const res = executeSpatialSqlQuery(preset.sql, allDatasets);
                        if (res.ok) setHighlightedIds(new Set(res.matchedLatLngIds));
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-neutral-200 cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={sqlText}
                  onChange={(e) => setSqlText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-white/15 font-mono text-xs text-emerald-300 focus:outline-none focus:border-orange-500"
                  placeholder="SELECT * FROM vendors WHERE status = 'open' AND inside_geofence = true"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSqlModeActive(true);
                      const res = executeSpatialSqlQuery(sqlText, allDatasets);
                      if (res.ok) {
                        setAttrDataset(res.dataset);
                        setHighlightedIds(new Set(res.matchedLatLngIds));
                        toast.success(`Matokeo ${res.rows.length} yamepatikana na kuangaziwa kwenye ramani!`);
                      } else {
                        toast.error(res.error || 'SQL ina hitilafu');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run SQL</span>
                  </button>
                  {sqlModeActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setSqlModeActive(false);
                        setHighlightedIds(new Set());
                      }}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
                    >
                      Jedwali Kawaida
                    </button>
                  )}
                </div>
              </div>

              {sqlModeActive && sqlResult && !sqlResult.ok && (
                <div className="text-xs text-rose-400 font-mono">{sqlResult.error}</div>
              )}
            </div>

            {/* Dataset Tabs & Search */}
            {!sqlModeActive && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'vendors', label: `Maduka (${allDatasets.vendors.length})` },
                    { id: 'drivers', label: `Madereva (${allDatasets.drivers.length})` },
                    { id: 'orders', label: `Oda (${allDatasets.orders.length})` },
                    { id: 'cities', label: `Miji (${allDatasets.cities.length})` },
                    ...(cloudGeoJson ? [{ id: 'cloud' as const, label: `Cloud (${allDatasets.cloud.length})` }] : []),
                  ] as const).map((ds) => (
                    <button
                      key={ds.id}
                      type="button"
                      onClick={() => setAttrDataset(ds.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        attrDataset === ds.id
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {ds.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={attrSearch}
                    onChange={(e) => setAttrSearch(e.target.value)}
                    placeholder="Tafuta kwenye jedwali..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Interactive Attribute Table (Click row -> Fly Map) */}
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl max-h-72 overflow-y-auto">
              {sqlModeActive && sqlResult?.ok ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      {sqlResult.columns.map((c) => (
                        <th key={c} className="px-4 py-2.5">
                          {c}
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-right">Ramani</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {sqlResult.rows.map((r, idx) => (
                      <tr
                        key={`${r._id}-${idx}`}
                        onClick={() => flyToCoord(r._lat, r._lng, String(r.name || r.id || ''))}
                        className="hover:bg-orange-50/70 dark:hover:bg-orange-950/20 cursor-pointer"
                      >
                        {sqlResult.columns.map((c) => (
                          <td key={c} className="px-4 py-2.5 font-mono text-[11px]">
                            {String(r[c] ?? '-')}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right text-orange-600 font-bold text-[11px]">
                          Zoom →
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Jina</th>
                      <th className="px-4 py-2.5">Aina</th>
                      <th className="px-4 py-2.5">Hali</th>
                      <th className="px-4 py-2.5">Mji</th>
                      <th className="px-4 py-2.5 text-right">Kiasi / Idadi</th>
                      <th className="px-4 py-2.5 text-right">Ndani ya Mpaka</th>
                      <th className="px-4 py-2.5 text-right">Km toka CBD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredAttrRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => flyToCoord(row.lat, row.lng, row.name)}
                        className="hover:bg-orange-50/70 dark:hover:bg-orange-950/20 cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-bold text-neutral-900 dark:text-white">{row.name}</td>
                        <td className="px-4 py-2.5 text-neutral-500">{row.category}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`font-bold ${
                              row.status === 'open' || row.status === 'online' || row.status === 'active'
                                ? 'text-emerald-600'
                                : 'text-neutral-500'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{row.city}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.amount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold">
                          {row.inside_geofence ? (
                            <span className="text-emerald-600">Ndio</span>
                          ) : (
                            <span className="text-rose-500">Nje</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-neutral-500">
                          {row.distance_dar_km !== null ? `${row.distance_dar_km} km` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Cloud-Hosted Data Streamer (Module 2/8) */}
        {workbenchTab === 'cloud' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'geojson', label: 'Cloud GeoJSON URL' },
                    { id: 'xyz', label: 'XYZ / COG / Raster Tile URL' },
                    { id: 'pmtiles', label: 'PMTiles (HTTP Range)' },
                  ] as const).map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setCloudInputType(k.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        cloudInputType === k.id
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    placeholder={
                      cloudInputType === 'xyz'
                        ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                        : cloudInputType === 'pmtiles'
                        ? 'https://.../dataset.pmtiles'
                        : 'https://.../data.geojson'
                    }
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={cloudLoading}
                    onClick={() => handleLoadCloudData()}
                    className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    {cloudLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Tiririsha</span>
                  </button>
                </div>

                {/* Quick Cloud Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Mifano ya Cloud-Native Datasets (Bofya Kujaribu):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CLOUD_NATIVE_SAMPLE_DATASETS.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => {
                          setCloudInputType(sample.kind);
                          setCloudUrlInput(sample.url);
                          handleLoadCloudData(sample.kind, sample.url, sample.name);
                        }}
                        className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-orange-500 text-left transition-all cursor-pointer"
                      >
                        <div className="text-xs font-bold text-neutral-900 dark:text-white leading-snug">
                          {sample.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-1">{sample.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Cloud Layers Inspector */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Safu Zinazotiririshwa (Cloud Active)
                </div>

                {cloudGeoJson && (
                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-600">GeoJSON Stream</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCloudGeoJson(null);
                          setCloudGeoJsonLabel('');
                        }}
                        className="text-[10px] font-bold text-rose-500 cursor-pointer"
                      >
                        Ondoa
                      </button>
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">{cloudGeoJsonLabel}</div>
                    <div className="text-[11px] font-mono font-bold">{cloudGeoJson.features.length} Features</div>
                  </div>
                )}

                {cloudXyzUrl && (
                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600">XYZ Raster Layer</span>
                      <button
                        type="button"
                        onClick={() => setCloudXyzUrl('')}
                        className="text-[10px] font-bold text-rose-500 cursor-pointer"
                      >
                        Ondoa
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.1}
                      value={cloudXyzOpacity}
                      onChange={(e) => setCloudXyzOpacity(Number(e.target.value))}
                      className="w-full accent-orange-600"
                    />
                    <div className="text-[10px] text-neutral-500">Mwonekano: {Math.round(cloudXyzOpacity * 100)}%</div>
                  </div>
                )}

                {pmtilesInfo && (
                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-600">PMTiles HTTP Range</span>
                      <button
                        type="button"
                        onClick={() => setPmTilesInfo(null)}
                        className="text-[10px] font-bold text-rose-500 cursor-pointer"
                      >
                        Funga
                      </button>
                    </div>
                    <div className="text-[11px] font-bold truncate">{pmtilesInfo.metadataName || 'Remote PMTiles'}</div>
                    <div className="text-[10px] font-mono text-neutral-500">
                      {pmtilesInfo.tileTypeLabel} • Z{pmtilesInfo.minZoom}–Z{pmtilesInfo.maxZoom}
                    </div>
                    {pmtilesInfo.vectorLayers && pmtilesInfo.vectorLayers.length > 0 && (
                      <div className="text-[10px] text-neutral-500">
                        Layers: {pmtilesInfo.vectorLayers.slice(0, 6).join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {!cloudGeoJson && !cloudXyzUrl && !pmtilesInfo && (
                  <div className="text-xs text-neutral-500">
                    Hakuna safu ya wingu iliyopakiwa bado. Weka URL au bofya mfano kushoto.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: In-Browser Geoprocessing Toolbox (Module 5/8) */}
        {workbenchTab === 'geoprocessing' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Buffer & Coverage Analysis */}
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <CircleDot className="w-4 h-4 text-emerald-500" />
                  1. Buffer Zones & Coverage Analysis
                </h4>
              </div>
              <p className="text-[11px] text-neutral-500">
                Pima umbali wa huduma (radius km) kuzunguka maduka, vituo vya BRT, au vitovu vya miji na uone asilimia ya oda zinazofikiwa.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={bufferSource}
                  onChange={(e) => setBufferSource(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold"
                >
                  <option value="open_vendors">Maduka Yaliyo Wazi</option>
                  <option value="brt_stops">Vituo vya BRT / Daladala</option>
                  <option value="city_centers">Vitovu vya Miji</option>
                </select>
                <select
                  value={bufferRadiusKm}
                  onChange={(e) => setBufferRadiusKm(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold"
                >
                  {[0.5, 1, 2, 3, 5, 10].map((r) => (
                    <option key={r} value={r}>
                      Radius: {r} km
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleRunBuffer}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
              >
                Tengeneza Buffer Kwenye Ramani
              </button>

              {bufferResult && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-center">
                    <div className="text-[10px] text-neutral-500">Miduara</div>
                    <div className="text-sm font-black font-mono">{bufferResult.bufferCount}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-center">
                    <div className="text-[10px] text-neutral-500">Oda Ndani</div>
                    <div className="text-sm font-black font-mono">
                      {bufferResult.ordersCovered}/{bufferResult.ordersTotal} ({bufferResult.coveragePct}%)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-center">
                    <div className="text-[10px] text-neutral-500">Madereva</div>
                    <div className="text-sm font-black font-mono">{bufferResult.driversCovered}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Nearest Neighbor / Dispatch Spider */}
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-amber-500" />
                2. Nearest Online Drivers (Spider Lines)
              </h4>
              <p className="text-[11px] text-neutral-500">
                Chagua duka au kituo na uchore mistari ya moja kwa moja hadi kwa madereva 5 wa karibu zaidi na ETA yao.
              </p>
              <div className="flex gap-2">
                <select
                  value={spiderTargetVendorId}
                  onChange={(e) => setSpiderTargetVendorId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold"
                >
                  <option value="">Posta Kati / Duka la Kwanza</option>
                  {vendors
                    .filter((v) => Number.isFinite(Number(v?.location?.lat)))
                    .slice(0, 40)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.businessName}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleRunNearestDrivers}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black cursor-pointer shrink-0"
                >
                  Pima Karibu
                </button>
              </div>

              {spiderLinks.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {spiderLinks.map((lnk, i) => (
                    <div
                      key={lnk.id}
                      onClick={() => flyToCoord(lnk.lat, lnk.lng, lnk.name)}
                      className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs cursor-pointer hover:border-amber-500"
                    >
                      <span className="font-bold">
                        {i + 1}. {lnk.name} ({lnk.vehicle})
                      </span>
                      <span className="font-mono font-bold text-amber-600">
                        {lnk.distanceKm} km • ~{lnk.etaMins} dk
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: NGIS 2026 Workshop Modules 1/8 - 5/8 Reference */}
        {workbenchTab === 'lessons' && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {NGIS_WORKSHOP_MODULES_1_TO_5.map((mod) => (
              <div
                key={mod.num}
                className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Open Geospatial Solutions • Somo {mod.num}
                  </div>
                  <div className="text-xs font-black text-neutral-900 dark:text-white mt-1">{mod.title}</div>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">{mod.swTitle}</p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (mod.workbenchTarget === 'cloud') setWorkbenchTab('cloud');
                      else if (mod.workbenchTarget === 'sql') setWorkbenchTab('sql');
                      else if (mod.workbenchTarget === 'geoprocessing') setWorkbenchTab('geoprocessing');
                      else if (mod.workbenchTarget === 'project') setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'));
                      else setSymbologyMode((m) => (m === 'status' ? 'category' : m === 'category' ? 'orders_graduated' : 'status'));
                    }}
                    className="text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                  >
                    Jaribu Hapa →
                  </button>
                  <a
                    href={mod.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                  >
                    <span>YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
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

