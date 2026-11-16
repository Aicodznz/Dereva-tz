import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  X,
  Search,
  Navigation,
  Layers,
  Compass,
  Plus,
  Minus,
  Building2,
  MapPin,
  Clock,
  Star,
  ArrowRight,
  Car,
  Flame,
  Loader2,
  Bus,
  Check,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { useBusinessConfig } from '../../BusinessConfigContext';
import {
  ensureMapLibreGeoLibreSetup,
  GeoLibreBasemapId,
  GEOLIBRE_BASEMAPS,
  MAPBOX_STYLE_URLS,
  MapProjectionMode,
  MapboxLightPreset,
  getMapboxToken,
  evaluateVendorOpenStatus,
  haversineKm,
  buildSpatialDemandLayersData,
  buildCircleGeoJsonPolygon,
  normalizeLatLngList,
  DALADALA_CORRIDORS_GEOJSON,
  DALADALA_STOPS_GEOJSON,
} from '../../lib/geoLibreEngine';
import {
  GeoLibreBasemapPillBar,
  GeoLibreControlDrawer,
  GeoLibreLayerState,
} from './GeoLibreControls';

export interface PapoMapExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: { lat: number; lng: number; address?: string };
  vendors?: any[];
  onSelectLocation?: (location: { address: string; lat: number; lng: number }) => void;
}

const CATEGORY_CHIPS = [
  { id: 'all', label: 'Zote' },
  { id: 'restaurant', label: 'PapoFood' },
  { id: 'grocery', label: 'PapoMart' },
  { id: 'pharmacy', label: 'PapoMed' },
  { id: 'salon', label: 'PapoStyle' },
  { id: 'handyman', label: 'PapoFix' },
  { id: 'hotel', label: 'PapoStay' },
  { id: 'ecommerce', label: 'PapoMall' },
];

function getCategoryEmoji(category: string = ''): string {
  const c = category.toLowerCase();
  if (c.includes('restaurant') || c.includes('chakula') || c.includes('food')) return '🍔';
  if (c.includes('grocery') || c.includes('soko') || c.includes('mart')) return '🛒';
  if (c.includes('pharmacy') || c.includes('dawa') || c.includes('med')) return '💊';
  if (c.includes('salon') || c.includes('saluni') || c.includes('style')) return '💇';
  if (c.includes('handyman') || c.includes('home_service') || c.includes('fundi')) return '🛠️';
  if (c.includes('hotel') || c.includes('stay') || c.includes('malazi')) return '🏨';
  if (c.includes('bus')) return '🚌';
  if (c.includes('car_rental') || c.includes('rent')) return '🚘';
  return '🛍️';
}

function getVehicleEmoji(vType: string = ''): string {
  const t = vType.toLowerCase();
  if (t.includes('bajaj') || t.includes('tuktuk')) return '🛺';
  if (t.includes('bike') || t.includes('boda') || t.includes('pikipiki')) return '🏍️';
  if (t.includes('delivery') || t.includes('cargo')) return '🚚';
  return '🚕';
}

export const PapoMapExplorerModal: React.FC<PapoMapExplorerModalProps> = ({
  isOpen,
  onClose,
  initialLocation,
  vendors = [],
  onSelectLocation,
}) => {
  const navigate = useNavigate();
  const { config: businessConfig } = useBusinessConfig();
  const mapboxToken = useMemo(() => getMapboxToken(), []);
  const useMapbox = Boolean(mapboxToken);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const vendorMarkersRef = useRef<any[]>([]);
  const driverMarkersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const initLat = Number(initialLocation?.lat) || -6.7924;
  const initLng = Number(initialLocation?.lng) || 39.2083;

  const [basemap, setBasemap] = useState<GeoLibreBasemapId>('street_3d');
  const [projection, setProjection] = useState<MapProjectionMode>('globe');
  const [lightPreset, setLightPreset] = useState<MapboxLightPreset>('day');
  const [pitch, setPitch] = useState<number>(48);
  const [bearing, setBearing] = useState<number>(0);
  const [mapReady, setMapReady] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  const [layers, setLayers] = useState<GeoLibreLayerState>({
    showVendors: true,
    openVendorsOnly: false,
    showDrivers: true,
    showHeatmap: false,
    showGeofences: true,
    showDaladalaRoutes: false,
    show3DBuildings: true,
  });

  const [isLayerDrawerOpen, setIsLayerDrawerOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number }>({ lat: initLat, lng: initLng });

  const [liveDrivers, setLiveDrivers] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [customOverlayUrl, setCustomOverlayUrl] = useState<string>('');
  const [customGeoJsonData, setCustomGeoJsonData] = useState<any | null>(null);

  // Real-time Firestore drivers listener
  useEffect(() => {
    if (!isOpen) return;
    let unsub = () => {};
    try {
      const q = query(collection(db, 'drivers'), where('isOnline', '==', true));
      unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as any))
            .filter(
              (d) =>
                d.location &&
                Number.isFinite(Number(d.location.lat)) &&
                Number.isFinite(Number(d.location.lng))
            )
            .map((d) => ({
              id: d.id,
              name: d.name || d.displayName || 'Dereva',
              lat: Number(d.location.lat),
              lng: Number(d.location.lng),
              vehicleType: d.vehicleType || d.driverType || 'mini',
              vehiclePlate: d.vehiclePlate || d.licensePlate || 'PapoRide',
              isBusy: d.receiving === false || Boolean(d.activeRideId),
              rating: Number(d.rating || 4.9),
            }));
          setLiveDrivers(list);
        },
        () => setLiveDrivers([])
      );
    } catch {
      setLiveDrivers([]);
    }
    return () => unsub();
  }, [isOpen]);

  // Compute Open vs Closed vendor enrichment
  const enrichedVendors = useMemo(() => {
    return vendors
      .filter((v) => v.location && Number.isFinite(Number(v.location.lat)) && Number.isFinite(Number(v.location.lng)))
      .map((v) => {
        const openStatus = evaluateVendorOpenStatus(v.operatingHours, v.hotelStatus);
        const distanceKm = haversineKm(
          userPos.lat,
          userPos.lng,
          Number(v.location.lat),
          Number(v.location.lng)
        );
        return {
          ...v,
          openStatus,
          distanceKm,
        };
      });
  }, [vendors, userPos.lat, userPos.lng]);

  const filteredVendors = useMemo(() => {
    if (!layers.showVendors) return [];
    return enrichedVendors.filter((v) => {
      if (layers.openVendorsOnly && !v.openStatus.isOpen) return false;
      if (categoryFilter === 'all') return true;
      const c = String(v.category || '').toLowerCase();
      if (categoryFilter === 'handyman') return c.includes('handyman') || c.includes('home_service') || c.includes('fundi');
      return c.includes(categoryFilter);
    });
  }, [enrichedVendors, layers.showVendors, layers.openVendorsOnly, categoryFilter]);

  const counts = useMemo(() => {
    let openVendors = 0;
    let closedVendors = 0;
    for (const v of enrichedVendors) {
      if (v.openStatus.isOpen) openVendors += 1;
      else closedVendors += 1;
    }
    let onlineDrivers = 0;
    let busyDrivers = 0;
    for (const d of liveDrivers) {
      if (d.isBusy) busyDrivers += 1;
      else onlineDrivers += 1;
    }
    const rules = businessConfig?.pricingRules || {};
    const geofenceCount = Object.values(rules).filter((r: any) => r?.geofenceActive).length;
    return {
      openVendors,
      closedVendors,
      onlineDrivers,
      busyDrivers,
      geofenceCount,
      daladalaRoutes: DALADALA_CORRIDORS_GEOJSON.features.length,
    };
  }, [enrichedVendors, liveDrivers, businessConfig?.pricingRules]);

  const geofencesGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    const rules = businessConfig?.pricingRules || {};
    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    Object.entries(rules).forEach(([cityName, city]: [string, any]) => {
      if (!city || city.geofenceActive !== true) return;
      if ((city.geofenceType || 'circle') === 'polygon') {
        const pts = normalizeLatLngList(city.geofencePolygon);
        if (pts.length >= 3) {
          const ring = pts.map(([la, ln]) => [ln, la] as [number, number]);
          ring.push(ring[0]);
          features.push({
            type: 'Feature',
            properties: { name: cityName },
            geometry: { type: 'Polygon', coordinates: [ring] },
          });
          return;
        }
      }
      const cLat = Number(city.geofenceCenter?.lat ?? city.lat);
      const cLng = Number(city.geofenceCenter?.lng ?? city.lng);
      const rad = Number(city.geofenceRadius || 15000);
      if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
        const circleFeat = buildCircleGeoJsonPolygon(cLat, cLng, rad);
        circleFeat.properties = { name: cityName };
        features.push(circleFeat);
      }
    });
    return { type: 'FeatureCollection', features };
  }, [businessConfig?.pricingRules]);

  const demandData = useMemo(() => buildSpatialDemandLayersData({}), []);

  // Inject or sync custom overlay layers cleanly whenever style finishes loading
  const syncMapLayers = useCallback(
    (map: any) => {
      if (!map || !map.isStyleLoaded?.()) return;

      // 1. 3D Buildings & Standard Lighting
      if (useMapbox) {
        try {
          if (basemap === 'street_3d' && typeof map.setConfigProperty === 'function') {
            map.setConfigProperty('basemap', 'lightPreset', lightPreset);
            map.setConfigProperty('basemap', 'show3dObjects', layers.show3DBuildings);
            map.setConfigProperty('basemap', 'showPointOfInterestLabels', true);
            map.setConfigProperty('basemap', 'showRoadLabels', true);
            map.setConfigProperty('basemap', 'showPlaceLabels', true);
          }
        } catch {}
      } else {
        const cfg = GEOLIBRE_BASEMAPS[basemap];
        try {
          if (cfg.supports3D && layers.show3DBuildings) {
            const styleLayers = map.getStyle().layers || [];
            const labelLayerId = styleLayers.find(
              (l: any) => l.type === 'symbol' && l.layout?.['text-field']
            )?.id;
            if (!map.getLayer('geolibre-3d-buildings') && map.getSource('openmaptiles')) {
              map.addLayer(
                {
                  id: 'geolibre-3d-buildings',
                  source: 'openmaptiles',
                  'source-layer': 'building',
                  type: 'fill-extrusion',
                  minzoom: 13.5,
                  paint: {
                    'fill-extrusion-color': [
                      'interpolate',
                      ['linear'],
                      ['get', 'render_height'],
                      0,
                      '#CBD5E1',
                      40,
                      '#94A3B8',
                      90,
                      '#64748B',
                    ],
                    'fill-extrusion-height': ['get', 'render_height'],
                    'fill-extrusion-base': ['get', 'render_min_height'],
                    'fill-extrusion-opacity': 0.72,
                  },
                },
                labelLayerId
              );
            }
          } else if (map.getLayer('geolibre-3d-buildings')) {
            map.removeLayer('geolibre-3d-buildings');
          }
        } catch {}
      }

      // 2. Service Geofence Boundaries
      try {
        if (!map.getSource('geolibre-geofences')) {
          map.addSource('geolibre-geofences', { type: 'geojson', data: geofencesGeoJson });
          map.addLayer({
            id: 'geolibre-geofences-fill',
            type: 'fill',
            source: 'geolibre-geofences',
            paint: { 'fill-color': '#F97316', 'fill-opacity': 0.08 },
          });
          map.addLayer({
            id: 'geolibre-geofences-line',
            type: 'line',
            source: 'geolibre-geofences',
            paint: { 'line-color': '#F97316', 'line-width': 2, 'line-dasharray': [3, 2] },
          });
        } else {
          map.getSource('geolibre-geofences').setData(geofencesGeoJson);
        }
        const vis = layers.showGeofences ? 'visible' : 'none';
        if (map.getLayer('geolibre-geofences-fill')) map.setLayoutProperty('geolibre-geofences-fill', 'visibility', vis);
        if (map.getLayer('geolibre-geofences-line')) map.setLayoutProperty('geolibre-geofences-line', 'visibility', vis);
      } catch {}

      // 3. BRT / Daladala Corridors & Stops
      try {
        if (!map.getSource('geolibre-daladala-routes')) {
          map.addSource('geolibre-daladala-routes', { type: 'geojson', data: DALADALA_CORRIDORS_GEOJSON });
          map.addLayer({
            id: 'geolibre-daladala-line',
            type: 'line',
            source: 'geolibre-daladala-routes',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#2563EB'],
              'line-width': 4,
              'line-opacity': 0.85,
            },
          });
        }
        if (!map.getSource('geolibre-daladala-stops')) {
          map.addSource('geolibre-daladala-stops', { type: 'geojson', data: DALADALA_STOPS_GEOJSON });
          map.addLayer({
            id: 'geolibre-daladala-stops-circle',
            type: 'circle',
            source: 'geolibre-daladala-stops',
            paint: {
              'circle-radius': 6,
              'circle-color': '#FFFFFF',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#2563EB',
            },
          });
        }
        const vis = layers.showDaladalaRoutes ? 'visible' : 'none';
        if (map.getLayer('geolibre-daladala-line')) map.setLayoutProperty('geolibre-daladala-line', 'visibility', vis);
        if (map.getLayer('geolibre-daladala-stops-circle')) map.setLayoutProperty('geolibre-daladala-stops-circle', 'visibility', vis);
      } catch {}

      // 4. WebGL Demand Heatmap + 3D Hex Columns
      try {
        if (!map.getSource('geolibre-heat-pts')) {
          map.addSource('geolibre-heat-pts', { type: 'geojson', data: demandData.heatPoints });
          map.addLayer({
            id: 'geolibre-heatmap-layer',
            type: 'heatmap',
            source: 'geolibre-heat-pts',
            paint: {
              'heatmap-weight': ['coalesce', ['get', 'weight'], 0.6],
              'heatmap-intensity': 1.2,
              'heatmap-radius': 34,
              'heatmap-opacity': 0.72,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(0,0,0,0)',
                0.25,
                'rgba(59,130,246,0.55)',
                0.55,
                'rgba(245,158,11,0.78)',
                0.85,
                'rgba(239,68,68,0.9)',
                1,
                'rgba(220,38,38,0.95)',
              ],
            },
          });
        }
        if (!map.getSource('geolibre-hex-cols')) {
          map.addSource('geolibre-hex-cols', { type: 'geojson', data: demandData.hexColumns });
          map.addLayer({
            id: 'geolibre-hex-extrusion',
            type: 'fill-extrusion',
            source: 'geolibre-hex-cols',
            paint: {
              'fill-extrusion-color': ['coalesce', ['get', 'color'], '#F97316'],
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 200],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.48,
            },
          });
        }
        const vis = layers.showHeatmap ? 'visible' : 'none';
        if (map.getLayer('geolibre-heatmap-layer')) map.setLayoutProperty('geolibre-heatmap-layer', 'visibility', vis);
        if (map.getLayer('geolibre-hex-extrusion')) map.setLayoutProperty('geolibre-hex-extrusion', 'visibility', vis);
      } catch {}

      // 5. Custom GeoJSON Overlay
      try {
        if (customGeoJsonData) {
          if (!map.getSource('geolibre-custom-geojson')) {
            map.addSource('geolibre-custom-geojson', { type: 'geojson', data: customGeoJsonData });
            map.addLayer({
              id: 'geolibre-custom-fill',
              type: 'fill',
              source: 'geolibre-custom-geojson',
              paint: { 'fill-color': '#06B6D4', 'fill-opacity': 0.25 },
            });
            map.addLayer({
              id: 'geolibre-custom-line',
              type: 'line',
              source: 'geolibre-custom-geojson',
              paint: { 'line-color': '#06B6D4', 'line-width': 2.5 },
            });
          } else {
            map.getSource('geolibre-custom-geojson').setData(customGeoJsonData);
          }
        }
      } catch {}
    },
    [useMapbox, basemap, lightPreset, layers, geofencesGeoJson, demandData, customGeoJsonData]
  );

  // Initialize Mapbox Standard GL JS (or MapLibre fallback)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    setWebglLost(false);

    let map: any;
    if (useMapbox) {
      map = new mapboxgl.Map({
        accessToken: mapboxToken,
        container: containerRef.current,
        style: MAPBOX_STYLE_URLS[basemap],
        center: [initLng, initLat],
        zoom: 14.5,
        pitch,
        bearing,
        projection,
        attributionControl: false,
      });
    } else {
      ensureMapLibreGeoLibreSetup();
      map = new maplibregl.Map({
        container: containerRef.current,
        style: GEOLIBRE_BASEMAPS[basemap].style,
        center: [initLng, initLat],
        zoom: 13.5,
        pitch,
        bearing,
        maxPitch: 75,
        attributionControl: false,
      });
    }
    mapRef.current = map;

    const canvas = map.getCanvas();
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => setWebglLost(false);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    map.on('load', () => {
      setMapReady(true);
      syncMapLayers(map);
    });
    map.on('style.load', () => {
      syncMapLayers(map);
    });
    map.on('styledata', () => {
      syncMapLayers(map);
    });
    map.on('rotate', () => setBearing(Math.round(map.getBearing())));
    map.on('pitch', () => setPitch(Math.round(map.getPitch())));

    // User location marker
    const userEl = document.createElement('div');
    userEl.innerHTML = `<div style="width:18px;height:18px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(37,99,235,0.28);"></div>`;
    userMarkerRef.current = useMapbox
      ? new mapboxgl.Marker({ element: userEl }).setLngLat([initLng, initLat]).addTo(map)
      : new maplibregl.Marker({ element: userEl }).setLngLat([initLng, initLat]).addTo(map);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      vendorMarkersRef.current.forEach((m) => m.remove());
      driverMarkersRef.current.forEach((m) => m.remove());
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Update basemap style cleanly when user picks another style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (useMapbox) {
      map.setStyle(MAPBOX_STYLE_URLS[basemap]);
    } else {
      map.setStyle(GEOLIBRE_BASEMAPS[basemap].style);
    }
  }, [basemap, useMapbox]);

  // Live projection toggle (Globe vs Mercator)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.setProjection !== 'function') return;
    try {
      map.setProjection(projection);
    } catch {}
  }, [projection]);

  // Sync layers when toggles or lighting preset change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncMapLayers(map);
  }, [mapReady, syncMapLayers]);

  // Render Vendor DOM Markers (Open Green vs Closed Red)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    vendorMarkersRef.current.forEach((m) => m.remove());
    vendorMarkersRef.current = [];

    if (!layers.showVendors) return;

    for (const v of filteredVendors) {
      const el = document.createElement('button');
      el.type = 'button';
      const isOpen = v.openStatus.isOpen;
      const emoji = getCategoryEmoji(v.category);
      const dotColor = isOpen ? '#10B981' : '#EF4444';
      const ringColor = isOpen ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.85)';

      el.style.cssText = 'background:transparent;border:none;padding:0;cursor:pointer;';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="position:relative;width:36px;height:36px;border-radius:12px;background:#0F172A;border:2px solid ${ringColor};display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 6px 14px rgba(0,0,0,0.4);">
            <span>${emoji}</span>
            <span style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:9999px;background:${dotColor};border:2px solid #0F172A;"></span>
          </div>
          <div style="background:rgba(15,23,42,0.88);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,0.14);">
            ${(v.businessName || 'Duka').replace(/</g, '&lt;')}
          </div>
        </div>
      `;
      el.onclick = () => {
        setSelectedDriver(null);
        setSelectedVendor(v);
        map.flyTo({
          center: [Number(v.location.lng), Number(v.location.lat)],
          zoom: Math.max(map.getZoom(), 16),
          duration: 600,
        });
      };

      const marker = useMapbox
        ? new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([Number(v.location.lng), Number(v.location.lat)])
            .addTo(map)
        : new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([Number(v.location.lng), Number(v.location.lat)])
            .addTo(map);
      vendorMarkersRef.current.push(marker);
    }
  }, [filteredVendors, layers.showVendors, useMapbox]);

  // Render Live Driver Markers (Online Green vs Busy Amber)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    driverMarkersRef.current.forEach((m) => m.remove());
    driverMarkersRef.current = [];

    if (!layers.showDrivers) return;

    for (const drv of liveDrivers) {
      const el = document.createElement('button');
      el.type = 'button';
      const dotColor = drv.isBusy ? '#F59E0B' : '#10B981';
      const emoji = getVehicleEmoji(drv.vehicleType);
      el.style.cssText = 'background:transparent;border:none;padding:0;cursor:pointer;';
      el.innerHTML = `
        <div style="position:relative;width:34px;height:34px;border-radius:9999px;background:#1E293B;border:2px solid ${dotColor};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.4);">
          <span>${emoji}</span>
          <span style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;border-radius:9999px;background:${dotColor};border:2px solid #0F172A;"></span>
        </div>
      `;
      el.onclick = () => {
        setSelectedVendor(null);
        setSelectedDriver(drv);
        map.flyTo({ center: [drv.lng, drv.lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
      };
      const marker = useMapbox
        ? new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([drv.lng, drv.lat]).addTo(map)
        : new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([drv.lng, drv.lat]).addTo(map);
      driverMarkersRef.current.push(marker);
    }
  }, [liveDrivers, layers.showDrivers, useMapbox]);

  // Debounced Place Search (/api/geo/search)
  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}&limit=5&addressdetails=1`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) setSearchResults(json);
        }
      } catch {
      } finally {
        setIsSearching(false);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [searchText]);

  const handleRecenterGps = () => {
    if (!navigator.geolocation) {
      toast.error('Kifaa chako hakiruhusu GPS.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos({ lat, lng });
        userMarkerRef.current?.setLngLat([lng, lat]);
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 750 });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        toast.error('Imeshindwa kupata GPS ya sasa.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLoadCustomGeoJson = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCustomOverlayUrl(url);
      setCustomGeoJsonData(json);
      toast.success('Faili la GeoJSON limeongezwa kwenye ramani!');
    } catch {
      toast.error('Imeshindwa kupakua GeoJSON kutoka kiungo hicho.');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] bg-neutral-950 text-white flex flex-col">
      {/* Top Floating Search & Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 shrink-0 cursor-pointer shadow-lg"
            title="Funga Ramani"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tafuta mtaa, duka au kituo (mf. Kariakoo)..."
              className="w-full h-10 pl-9 pr-9 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-white/15 text-xs text-white placeholder:text-neutral-400 focus:outline-none focus:border-orange-500 shadow-lg"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}

            {searchResults.length > 0 && (
              <div className="absolute top-11 left-0 right-0 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden shadow-2xl z-30">
                {searchResults.map((item, idx) => {
                  const lat = Number(item.lat);
                  const lng = Number(item.lon ?? item.lng);
                  const label = item.display_name || item.name || 'Eneo';
                  return (
                    <button
                      key={`sr-${idx}`}
                      type="button"
                      onClick={() => {
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                          setUserPos({ lat, lng });
                          userMarkerRef.current?.setLngLat([lng, lat]);
                          mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 750 });
                        }
                        setSearchResults([]);
                        setSearchText(label.split(',')[0]);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs text-neutral-200 hover:bg-white/10 border-b border-white/5 last:border-b-0 flex items-center gap-2 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} />
          </div>

          <button
            type="button"
            onClick={() => setIsLayerDrawerOpen(true)}
            className="h-10 px-3 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-white/15 text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-900 whitespace-nowrap shrink-0 cursor-pointer shadow-lg"
          >
            <Layers className="w-4 h-4 text-orange-400" />
            <span>Tabaka</span>
          </button>
        </div>

        {/* Category Filter Strip + Mobile Basemap Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto pb-0.5">
          <div className="md:hidden shrink-0">
            <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} compact />
          </div>
          {CATEGORY_CHIPS.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                  active
                    ? 'bg-orange-600 border-orange-500 text-white shadow-md'
                    : 'bg-neutral-950/85 border-white/15 text-neutral-300 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, openVendorsOnly: !prev.openVendorsOnly }))}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
              layers.openVendorsOnly
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                : 'bg-neutral-950/85 border-white/15 text-neutral-300 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>Wazi Tu (<span className="tabular-nums">{counts.openVendors}</span>)</span>
          </button>
          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, showDaladalaRoutes: !prev.showDaladalaRoutes }))}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
              layers.showDaladalaRoutes
                ? 'bg-sky-600 border-sky-500 text-white shadow-md'
                : 'bg-neutral-950/85 border-white/15 text-neutral-300 hover:text-white'
            }`}
          >
            <Bus className="w-3.5 h-3.5 shrink-0" />
            <span>BRT / Daladala</span>
          </button>
          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, showHeatmap: !prev.showHeatmap }))}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
              layers.showHeatmap
                ? 'bg-rose-600 border-rose-500 text-white shadow-md'
                : 'bg-neutral-950/85 border-white/15 text-neutral-300 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>Hotspots 3D</span>
          </button>
        </div>
      </div>

      {/* Main WebGL Map Viewport */}
      <div className="relative flex-1 w-full h-full">
        <div ref={containerRef} className="w-full h-full" />
        {webglLost && (
          <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-6 text-center gap-3 z-30">
            <p className="text-sm font-bold text-white">Injini ya ramani ya WebGL imesimama kwa muda.</p>
            <button
              type="button"
              onClick={() => setWebglLost(false)}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer"
            >
              Jaribu Tena
            </button>
          </div>
        )}
      </div>

      {/* Right Navigation Controls Rail */}
      <div className="absolute right-3 top-32 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="w-9 h-9 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 cursor-pointer shadow-lg"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="w-9 h-9 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 cursor-pointer shadow-lg"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleRecenterGps}
          disabled={isLocating}
          className="w-9 h-9 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-orange-400 hover:bg-neutral-900 cursor-pointer shadow-lg"
          title="Lenga GPS Yangu"
        >
          {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'))}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shadow-lg ${
            projection === 'globe'
              ? 'bg-sky-600 border-sky-500 text-white'
              : 'bg-neutral-950/90 border-white/15 text-neutral-300'
          }`}
          title={projection === 'globe' ? 'Globe 3D (Bofya kwenda Mercator)' : 'Mercator (Bofya kwenda Globe)'}
        >
          <Globe className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const next = pitch > 10 ? 0 : 52;
            setPitch(next);
            mapRef.current?.easeTo({ pitch: next, duration: 400 });
          }}
          className={`w-9 h-9 rounded-xl border flex flex-col items-center justify-center text-[10px] font-black cursor-pointer shadow-lg ${
            pitch > 10
              ? 'bg-orange-600 border-orange-500 text-white'
              : 'bg-neutral-950/90 border-white/15 text-neutral-300'
          }`}
          title="Badili 3D / 2D"
        >
          <span>{pitch > 10 ? '3D' : '2D'}</span>
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: 400 })}
          className="w-9 h-9 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 cursor-pointer shadow-lg"
          title="Kaskazini (Reset North)"
        >
          <Compass
            className="w-4 h-4 text-sky-400 transition-transform"
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
        </button>
        <button
          type="button"
          onClick={() => setLayers((prev) => ({ ...prev, show3DBuildings: !prev.show3DBuildings }))}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shadow-lg ${
            layers.show3DBuildings
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-neutral-950/90 border-white/15 text-neutral-400'
          }`}
          title="Majengo ya 3D"
        >
          <Building2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Summary Telemetry Strip */}
      {!selectedVendor && !selectedDriver && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-neutral-950/90 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 shadow-2xl">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-bold tabular-nums">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {counts.openVendors} Wazi
            </span>
            <span className="flex items-center gap-1.5 font-bold text-neutral-400 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {counts.closedVendors} Imefungwa
            </span>
            <span className="flex items-center gap-1.5 font-bold text-amber-400 tabular-nums">
              <Car className="w-3.5 h-3.5" />
              {counts.onlineDrivers} Online • {counts.busyDrivers} Busy
            </span>
          </div>
          {onSelectLocation && (
            <button
              type="button"
              onClick={() => {
                onSelectLocation({
                  address: initialLocation?.address || `Eneo (${userPos.lat.toFixed(4)}, ${userPos.lng.toFixed(4)})`,
                  lat: userPos.lat,
                  lng: userPos.lng,
                });
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tumia Eneo Hili</span>
            </button>
          )}
        </div>
      )}

      {/* Selected Vendor Inspection Card */}
      {selectedVendor && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[400px] z-30 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 overflow-hidden flex items-center justify-center text-xl shrink-0">
                {selectedVendor.logoUrl ? (
                  <img
                    src={selectedVendor.logoUrl}
                    alt={selectedVendor.businessName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{getCategoryEmoji(selectedVendor.category)}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black uppercase tracking-tight truncate">
                    {selectedVendor.businessName}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 ${
                      selectedVendor.openStatus.isOpen
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {selectedVendor.openStatus.label}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  {selectedVendor.address || selectedVendor.city || 'Tanzania'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedVendor(null)}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] bg-white/5 border border-white/10 rounded-xl p-2.5">
            <div>
              <span className="text-neutral-400 block text-[10px]">Umbali</span>
              <strong className="font-mono tabular-nums text-white">
                {selectedVendor.distanceKm.toFixed(1)} km
              </strong>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Saa za Kazi</span>
              <strong className="text-neutral-200 truncate block">
                {selectedVendor.openStatus.hoursLabel}
              </strong>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Kadirio</span>
              <strong className="font-mono tabular-nums text-amber-400 inline-flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                {Number(selectedVendor.rating || 4.8).toFixed(1)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/vendor/${selectedVendor.id}`);
              }}
              className="flex-1 h-10 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Tembelea Duka</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${selectedVendor.location.lat},${selectedVendor.location.lng}`;
                window.open(url, '_blank');
              }}
              className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nielekeze</span>
            </button>
          </div>
        </div>
      )}

      {/* Selected Driver Inspection Card */}
      {selectedDriver && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[380px] z-30 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                {getVehicleEmoji(selectedDriver.vehicleType)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black uppercase truncate">{selectedDriver.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      selectedDriver.isBusy
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {selectedDriver.isBusy ? 'Busy' : 'Online'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {selectedDriver.vehiclePlate} • ⭐ {selectedDriver.rating.toFixed(1)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDriver(null)}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-white/5 border border-white/10 rounded-xl p-2.5">
            <div>
              <span className="text-[10px] text-neutral-400 block">Umbali</span>
              <strong className="font-mono tabular-nums text-white">
                {haversineKm(userPos.lat, userPos.lng, selectedDriver.lat, selectedDriver.lng).toFixed(2)} km
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block">Kadirio la Kufika</span>
              <strong className="font-mono tabular-nums text-emerald-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.max(
                  2,
                  Math.round(
                    (haversineKm(userPos.lat, userPos.lng, selectedDriver.lat, selectedDriver.lng) / 35) * 60
                  )
                )}{' '}
                dk
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(selectedDriver.vehicleType === 'delivery' ? '/service/vifurushi' : '/taxi');
            }}
            className="w-full h-10 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Agiza Usafiri Sasa</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <GeoLibreControlDrawer
        isOpen={isLayerDrawerOpen}
        onClose={() => setIsLayerDrawerOpen(false)}
        basemap={basemap}
        onBasemapChange={setBasemap}
        layers={layers}
        onToggleLayer={(key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
        counts={counts}
        customOverlayUrl={customOverlayUrl}
        onLoadCustomOverlay={handleLoadCustomGeoJson}
        onClearCustomOverlay={() => {
          setCustomOverlayUrl('');
          setCustomGeoJsonData(null);
        }}
        projection={projection}
        onProjectionChange={setProjection}
        lightPreset={lightPreset}
        onLightPresetChange={setLightPreset}
        isMapboxEnabled={useMapbox}
      />
    </div>,
    document.body
  );
};
