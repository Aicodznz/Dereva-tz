import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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
  Activity,
  AlertTriangle,
  Volume2,
  VolumeX,
  Home,
  Briefcase,
  Fuel,
  HeartPulse,
  Landmark,
  Ruler,
  Share2,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  Flag,
  Bike,
  Footprints,
  List,
  ChevronUp,
  ChevronDown,
  ThumbsUp,
  Trash2,
  Gauge,
  WifiOff,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { useBusinessConfig } from '../../BusinessConfigContext';
import {
  GeoLibreBasemapId,
  GEOLIBRE_BASEMAPS,
  MAPBOX_STYLE_URLS,
  MapProjectionMode,
  getMapboxToken,
  resolveMapboxAccessToken,
  resolveBasemapStyleSync,
  resolveBestOfflineBasemapStyle,
  attachOffline3DFallback,
  evaluateVendorOpenStatus,
  haversineKm,
  buildSpatialDemandLayersData,
  buildCircleGeoJsonPolygon,
  normalizeLatLngList,
  DALADALA_CORRIDORS_GEOJSON,
  DALADALA_STOPS_GEOJSON,
  stripMapWatermarks,
} from '../../lib/geoLibreEngine';
import {
  GeoLibreBasemapPillBar,
  GeoLibreControlDrawer,
  GeoLibreLayerState,
} from './GeoLibreControls';
import { OfflineMapManagerModal } from './OfflineMapManagerModal';
import {
  isEffectivelyOffline,
  reverseGeocodeOfflineFirst,
  searchPlacesOfflineFirst,
  useOfflineMapStatus,
} from '../../lib/offlineMapEngine';
import {
  TravelMode,
  RoadReportCategory,
  RoadReportItem,
  ROAD_REPORT_TYPES,
  PapoMapRouteOption,
  SavedPlaceItem,
  NearbyEssentialKind,
  NearbyEssentialResult,
  fetchPapoMapRoutes,
  formatDistanceSw,
  formatDurationSw,
  formatEtaClock,
  speakSwahiliInstruction,
  computeMeasureTelemetry,
  getSavedPlaces,
  upsertSavedPlace,
  removeSavedPlace,
  fetchNearbyEssentials,
} from '../../lib/mapboxNavigation';

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

const TRAVEL_MODES: { id: TravelMode; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'driving-traffic', label: 'Gari / Trafiki', icon: Car },
  { id: 'cycling', label: 'Boda / Baiskeli', icon: Bike },
  { id: 'walking', label: 'Kwa Mguu', icon: Footprints },
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

function formatRelativeAgoSw(createdAtMs: number): string {
  const diffMins = Math.max(1, Math.round((Date.now() - createdAtMs) / 60000));
  if (diffMins < 60) return `Dk ${diffMins} zilizopita`;
  const hrs = Math.round(diffMins / 60);
  return `Saa ${hrs} zilizopita`;
}

function renderManeuverIcon(maneuverType: string = '', modifier: string = '') {
  const t = maneuverType.toLowerCase();
  const m = modifier.toLowerCase();
  if (t === 'arrive') return <Flag className="w-6 h-6 text-emerald-300" />;
  if (m === 'uturn') return <RotateCcw className="w-6 h-6 text-amber-300" />;
  if (m.includes('right')) return <CornerUpRight className="w-6 h-6 text-white" />;
  if (m.includes('left')) return <CornerUpLeft className="w-6 h-6 text-white" />;
  return <ArrowUp className="w-6 h-6 text-white" />;
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
  const roadReportMarkersRef = useRef<any[]>([]);
  const essentialMarkersRef = useRef<any[]>([]);
  const destMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const initLat = Number(initialLocation?.lat) || -6.7924;
  const initLng = Number(initialLocation?.lng) || 39.2083;

  const [basemap, setBasemap] = useState<GeoLibreBasemapId>('street_3d');
  const [projection, setProjection] = useState<MapProjectionMode>('mercator');
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
    showTraffic: true,
    showRoadReports: true,
  });

  const [isLayerDrawerOpen, setIsLayerDrawerOpen] = useState(false);
  const [isOfflineManagerOpen, setIsOfflineManagerOpen] = useState(false);
  const offlineStatus = useOfflineMapStatus();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Live GPS state
  const [userPos, setUserPos] = useState<{ lat: number; lng: number }>({ lat: initLat, lng: initLng });
  const [hasGpsFix, setHasGpsFix] = useState(false);
  const [gpsSpeedKmh, setGpsSpeedKmh] = useState<number>(0);
  const [gpsHeading, setGpsHeading] = useState<number | null>(null);
  const [followCamera, setFollowCamera] = useState(false);

  const [liveDrivers, setLiveDrivers] = useState<any[]>([]);
  const [roadReports, setRoadReports] = useState<RoadReportItem[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [selectedReport, setSelectedReport] = useState<RoadReportItem | null>(null);
  const [droppedPin, setDroppedPin] = useState<{ lat: number; lng: number; label: string } | null>(null);

  // GPS Navigation & Routing State
  const [travelMode, setTravelMode] = useState<TravelMode>('driving-traffic');
  const [routeDestination, setRouteDestination] = useState<{
    lat: number;
    lng: number;
    name: string;
    address?: string;
  } | null>(null);
  const [routeOptions, setRouteOptions] = useState<PapoMapRouteOption[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [isNavActive, setIsNavActive] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [showStepList, setShowStepList] = useState<boolean>(false);

  // Community Road Report Composer State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<RoadReportCategory>('jam');
  const [reportNote, setReportNote] = useState('');
  const [reportAtGps, setReportAtGps] = useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Saved Places (Nyumbani, Kazini) & Nearby Essentials & Distance Ruler
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>(() => getSavedPlaces());
  const [isSavedPlacesOpen, setIsSavedPlacesOpen] = useState(false);
  const [activeEssentialKind, setActiveEssentialKind] = useState<NearbyEssentialKind | null>(null);
  const [essentialResults, setEssentialResults] = useState<NearbyEssentialResult[]>([]);
  const [isLoadingEssentials, setIsLoadingEssentials] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lng: number }[]>([]);

  const [customOverlayUrl, setCustomOverlayUrl] = useState<string>('');
  const [customGeoJsonData, setCustomGeoJsonData] = useState<any | null>(null);

  // Refs for fresh state access inside Mapbox/MapLibre event listeners
  const isMeasuringRef = useRef(isMeasuring);
  isMeasuringRef.current = isMeasuring;
  const isNavActiveRef = useRef(isNavActive);
  isNavActiveRef.current = isNavActive;
  const followCameraRef = useRef(followCamera);
  followCameraRef.current = followCamera;
  const userPosRef = useRef(userPos);
  userPosRef.current = userPos;

  const activeRoute = routeOptions[selectedRouteIdx] || null;
  const currentStep = activeRoute?.steps?.[currentStepIdx] || null;

  // 1. Real-time Firestore drivers listener
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

  // 2. Real-time Firestore Community Road Alerts listener (last 12 hours)
  useEffect(() => {
    if (!isOpen) return;
    let unsub = () => {};
    try {
      const q = query(collection(db, 'pois'), where('type', '==', 'papomap_road_alert'));
      unsub = onSnapshot(
        q,
        (snap) => {
          const cutoff = Date.now() - 12 * 60 * 60 * 1000;
          const alerts: RoadReportItem[] = snap.docs
            .map((d) => {
              const data = d.data() as any;
              const lat = Number(data.location?.lat ?? data.lat);
              const lng = Number(data.location?.lng ?? data.lng);
              const createdAtMs = Number(data.createdAtMs || 0);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              if (createdAtMs > 0 && createdAtMs < cutoff) return null;
              return {
                id: d.id,
                category: (data.category || 'jam') as RoadReportCategory,
                title: String(data.title || 'Tukio Barabarani'),
                description: String(data.description || ''),
                lat,
                lng,
                confirmations: Number(data.confirmations || 1),
                createdAtMs: createdAtMs || Date.now(),
              };
            })
            .filter(Boolean) as RoadReportItem[];
          alerts.sort((a, b) => b.createdAtMs - a.createdAtMs);
          setRoadReports(alerts);
        },
        () => setRoadReports([])
      );
    } catch {
      setRoadReports([]);
    }
    return () => unsub();
  }, [isOpen]);

  // 3. Continuous Live GPS Watch while PapoMap is open
  useEffect(() => {
    if (!isOpen || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setUserPos({ lat, lng });
        setHasGpsFix(true);

        const rawSpeed = pos.coords.speed;
        const kmh = rawSpeed !== null && Number.isFinite(rawSpeed) && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0;
        setGpsSpeedKmh(kmh);

        const heading =
          pos.coords.heading !== null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null;
        setGpsHeading(heading);

        userMarkerRef.current?.setLngLat([lng, lat]);

        if (followCameraRef.current && mapRef.current) {
          mapRef.current.easeTo({
            center: [lng, lat],
            ...(heading !== null && kmh > 4 ? { bearing: heading } : {}),
            duration: 500,
          });
        }
      },
      () => {
        // Silent watch fallback; user can trigger manual GPS recenter
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOpen]);

  // 4. Auto-advance Navigation Steps based on GPS proximity
  useEffect(() => {
    if (!isNavActive || !activeRoute || !routeDestination) return;

    const distToDestKm = haversineKm(
      userPos.lat,
      userPos.lng,
      routeDestination.lat,
      routeDestination.lng
    );
    if (distToDestKm < 0.035 && currentStepIdx < activeRoute.steps.length - 1) {
      const lastIdx = activeRoute.steps.length - 1;
      setCurrentStepIdx(lastIdx);
      speakSwahiliInstruction('Umefika unakokwenda!', voiceEnabled);
      toast.success('Umefika unakokwenda!');
      return;
    }

    const nextStep = activeRoute.steps[currentStepIdx + 1];
    if (nextStep) {
      const distNextKm = haversineKm(
        userPos.lat,
        userPos.lng,
        nextStep.location[1],
        nextStep.location[0]
      );
      if (distNextKm < 0.045) {
        const nextIdx = currentStepIdx + 1;
        setCurrentStepIdx(nextIdx);
        speakSwahiliInstruction(nextStep.instructionSw, voiceEnabled);
      }
    }
  }, [userPos, isNavActive, activeRoute, routeDestination, currentStepIdx, voiceEnabled]);

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
      roadReports: roadReports.length,
    };
  }, [enrichedVendors, liveDrivers, businessConfig?.pricingRules, roadReports.length]);

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

  const altRoutesGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    const features = routeOptions
      .filter((_, idx) => idx !== selectedRouteIdx)
      .map((r) => ({
        type: 'Feature' as const,
        properties: { id: r.id },
        geometry: r.geometry,
      }));
    return { type: 'FeatureCollection', features };
  }, [routeOptions, selectedRouteIdx]);

  const activeRouteGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    if (!activeRoute) return { type: 'FeatureCollection', features: [] };
    return activeRoute.congestionGeoJson;
  }, [activeRoute]);

  const measureGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = [];
    if (measurePoints.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { kind: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: measurePoints.map((p) => [p.lng, p.lat]),
        },
      });
    }
    measurePoints.forEach((p, idx) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'point', index: idx + 1 },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      });
    });
    return { type: 'FeatureCollection', features };
  }, [measurePoints]);

  const measureTelemetry = useMemo(() => computeMeasureTelemetry(measurePoints), [measurePoints]);

  // Inject or sync custom overlay + traffic + route + measure layers whenever style finishes loading
  const syncMapLayers = useCallback(
    (map: any) => {
      if (!map || !map.isStyleLoaded?.()) return;

      // 1. 3D Buildings (Mapbox composite or OpenMapTiles) & Mapbox Live Traffic
      try {
        const hasComposite = Boolean(map.getSource('composite'));
        const hasOpenMapTiles = Boolean(map.getSource('openmaptiles'));
        const styleLayers = map.getStyle()?.layers || [];
        const labelLayerId = styleLayers.find(
          (l: any) => l.type === 'symbol' && l.layout?.['text-field']
        )?.id;

        if (hasComposite) {
          if (layers.show3DBuildings && basemap !== 'satellite') {
            if (!map.getLayer('papomap-3d-buildings')) {
              map.addLayer(
                {
                  id: 'papomap-3d-buildings',
                  source: 'composite',
                  'source-layer': 'building',
                  filter: ['==', 'extrude', 'true'],
                  type: 'fill-extrusion',
                  minzoom: 14,
                  paint: {
                    'fill-extrusion-color': basemap === 'night' ? '#334155' : '#CBD5E1',
                    'fill-extrusion-height': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      14,
                      0,
                      14.5,
                      ['get', 'height'],
                    ],
                    'fill-extrusion-base': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      14,
                      0,
                      14.5,
                      ['get', 'min_height'],
                    ],
                    'fill-extrusion-opacity': 0.65,
                  },
                },
                labelLayerId
              );
            } else {
              map.setLayoutProperty('papomap-3d-buildings', 'visibility', 'visible');
            }
          } else if (map.getLayer('papomap-3d-buildings')) {
            map.setLayoutProperty('papomap-3d-buildings', 'visibility', 'none');
          }
        } else if (hasOpenMapTiles) {
          const cfg = GEOLIBRE_BASEMAPS[basemap];
          if (cfg.supports3D && layers.show3DBuildings) {
            if (!map.getLayer('geolibre-3d-buildings')) {
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
            } else {
              map.setLayoutProperty('geolibre-3d-buildings', 'visibility', 'visible');
            }
          } else if (map.getLayer('geolibre-3d-buildings')) {
            map.setLayoutProperty('geolibre-3d-buildings', 'visibility', 'none');
          }
        }
      } catch {}

      // 1B. Mapbox Live Traffic Vector Layer (works over both Mapbox and OpenFreeMap basemaps when token is present)
      if (useMapbox) {
        try {
          if (!map.getSource('mapbox-traffic')) {
            map.addSource('mapbox-traffic', {
              type: 'vector',
              url: 'mapbox://mapbox.mapbox-traffic-v1',
            });
          }
          if (!map.getLayer('papomap-traffic-layer')) {
            const styleLayers = map.getStyle()?.layers || [];
            const firstSymbolId = styleLayers.find((l: any) => l.type === 'symbol')?.id;
            map.addLayer(
              {
                id: 'papomap-traffic-layer',
                type: 'line',
                source: 'mapbox-traffic',
                'source-layer': 'traffic',
                minzoom: 9,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 14, 3.8, 17, 6.5],
                  'line-opacity': 0.85,
                  'line-color': [
                    'match',
                    ['get', 'congestion'],
                    'low',
                    '#10B981',
                    'moderate',
                    '#F59E0B',
                    'heavy',
                    '#EF4444',
                    'severe',
                    '#991B1B',
                    '#10B981',
                  ],
                },
              },
              firstSymbolId
            );
          }
          if (map.getLayer('papomap-traffic-layer')) {
            map.setLayoutProperty(
              'papomap-traffic-layer',
              'visibility',
              layers.showTraffic ? 'visible' : 'none'
            );
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

      // 5. Alternative Routes + Congestion-Colored Active Navigation Route
      try {
        if (!map.getSource('papomap-alt-routes')) {
          map.addSource('papomap-alt-routes', { type: 'geojson', data: altRoutesGeoJson });
          map.addLayer({
            id: 'papomap-alt-routes-line',
            type: 'line',
            source: 'papomap-alt-routes',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#94A3B8',
              'line-width': 4.5,
              'line-opacity': 0.55,
              'line-dasharray': [2, 1.5],
            },
          });
        } else {
          map.getSource('papomap-alt-routes').setData(altRoutesGeoJson);
        }

        if (!map.getSource('papomap-active-route')) {
          map.addSource('papomap-active-route', { type: 'geojson', data: activeRouteGeoJson });
          map.addLayer({
            id: 'papomap-active-route-casing',
            type: 'line',
            source: 'papomap-active-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#0F172A',
              'line-width': 9,
              'line-opacity': 0.85,
            },
          });
          map.addLayer({
            id: 'papomap-active-route-line',
            type: 'line',
            source: 'papomap-active-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#2563EB'],
              'line-width': 6,
              'line-opacity': 0.96,
            },
          });
        } else {
          map.getSource('papomap-active-route').setData(activeRouteGeoJson);
        }
      } catch {}

      // 6. Distance & Fare Measurement Ruler Layer
      try {
        if (!map.getSource('papomap-measure-src')) {
          map.addSource('papomap-measure-src', { type: 'geojson', data: measureGeoJson });
          map.addLayer({
            id: 'papomap-measure-line',
            type: 'line',
            source: 'papomap-measure-src',
            filter: ['==', ['get', 'kind'], 'line'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#F59E0B', 'line-width': 3.5, 'line-dasharray': [2, 1.5] },
          });
          map.addLayer({
            id: 'papomap-measure-pts',
            type: 'circle',
            source: 'papomap-measure-src',
            filter: ['==', ['get', 'kind'], 'point'],
            paint: {
              'circle-radius': 6,
              'circle-color': '#F59E0B',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#0F172A',
            },
          });
        } else {
          map.getSource('papomap-measure-src').setData(measureGeoJson);
        }
      } catch {}

      // 7. Custom GeoJSON Overlay
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
    [
      useMapbox,
      basemap,
      layers,
      geofencesGeoJson,
      demandData,
      altRoutesGeoJson,
      activeRouteGeoJson,
      measureGeoJson,
      customGeoJsonData,
    ]
  );

  const prevBasemapRef = useRef<GeoLibreBasemapId>(basemap);
  const prevOfflineRef = useRef<boolean>(offlineStatus.isOffline);
  const fallbackAppliedRef = useRef<boolean>(false);

  // Initialize Mapbox GL JS (supports both Mapbox styles and OpenFreeMap/ESRI fallbacks in one isolated engine)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    setWebglLost(false);
    fallbackAppliedRef.current = false;
    prevBasemapRef.current = basemap;
    prevOfflineRef.current = offlineStatus.isOffline;

    const accessToken = resolveMapboxAccessToken(mapboxToken);
    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      accessToken,
      container: containerRef.current,
      style: resolveBasemapStyleSync(basemap, useMapbox) as any,
      center: [initLng, initLat],
      zoom: useMapbox ? 14.2 : 13.8,
      pitch,
      bearing,
      maxPitch: 75,
      projection,
      attributionControl: false,
    });
    mapRef.current = map;
    stripMapWatermarks(map);
    const detachOfflineFallback = attachOffline3DFallback(map, () => prevBasemapRef.current);

    if (isEffectivelyOffline()) {
      void resolveBestOfflineBasemapStyle(basemap).then((offlineStyle) => {
        if (mapRef.current === map && offlineStyle && (offlineStyle as any).id !== 'papo-offline-3d') {
          try {
            map.setStyle(offlineStyle as any);
          } catch {}
        }
      });
    }

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
      stripMapWatermarks(map);
      syncMapLayers(map);
      try {
        map.resize();
      } catch {}
    });
    map.on('style.load', () => {
      setMapReady(true);
      stripMapWatermarks(map);
      syncMapLayers(map);
    });
    map.on('error', (err: any) => {
      const msg = String(err?.error?.message || err?.message || '').toLowerCase();
      const status = Number(err?.error?.status || 0);
      const isStyleOrAuthFailure =
        status === 401 ||
        status === 403 ||
        (err?.sourceId === undefined && (msg.includes('style') || msg.includes('unauthorized')));
      if (!fallbackAppliedRef.current && useMapbox && isStyleOrAuthFailure) {
        fallbackAppliedRef.current = true;
        try {
          map.setStyle(resolveBasemapStyleSync(basemap, false) as any);
        } catch {}
      }
    });
    map.on('rotate', () => setBearing(Math.round(map.getBearing())));
    map.on('pitch', () => setPitch(Math.round(map.getPitch())));
    map.on('dragstart', () => {
      if (followCameraRef.current) setFollowCamera(false);
    });

    map.on('click', async (e: any) => {
      const clickLat = Number(e?.lngLat?.lat);
      const clickLng = Number(e?.lngLat?.lng);
      if (!Number.isFinite(clickLat) || !Number.isFinite(clickLng)) return;

      if (isMeasuringRef.current) {
        setMeasurePoints((prev) => [...prev, { lat: clickLat, lng: clickLng }]);
        return;
      }

      if (isNavActiveRef.current) return;

      setSelectedVendor(null);
      setSelectedDriver(null);
      setSelectedReport(null);
      setDroppedPin({
        lat: clickLat,
        lng: clickLng,
        label: `Eneo (${clickLat.toFixed(4)}, ${clickLng.toFixed(4)})`,
      });

      try {
        const data = await reverseGeocodeOfflineFirst(clickLat, clickLng, 17);
        if (data?.display_name) {
          const shortLabel = String(data.display_name).split(',').slice(0, 2).join(', ');
          setDroppedPin((prev) =>
            prev && Math.abs(prev.lat - clickLat) < 0.0005 ? { ...prev, label: shortLabel } : prev
          );
        }
      } catch {}
    });

    // User GPS Blue Dot Marker
    const userEl = document.createElement('div');
    userEl.innerHTML = `<div style="width:18px;height:18px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 7px rgba(37,99,235,0.28);"></div>`;
    userMarkerRef.current = new mapboxgl.Marker({ element: userEl }).setLngLat([initLng, initLat]).addTo(map);

    // Keep canvas sized cleanly on mobile viewport / orientation changes
    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObs = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {}
      });
      resizeObs.observe(containerRef.current);
    }

    return () => {
      detachOfflineFallback();
      resizeObs?.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      vendorMarkersRef.current.forEach((m) => m.remove());
      driverMarkersRef.current.forEach((m) => m.remove());
      roadReportMarkersRef.current.forEach((m) => m.remove());
      essentialMarkersRef.current.forEach((m) => m.remove());
      destMarkerRef.current?.remove();
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Update basemap style cleanly when user picks a different basemap or offline status toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (prevBasemapRef.current === basemap && prevOfflineRef.current === offlineStatus.isOffline) {
      return;
    }
    prevBasemapRef.current = basemap;
    prevOfflineRef.current = offlineStatus.isOffline;
    if (offlineStatus.isOffline) {
      void resolveBestOfflineBasemapStyle(basemap).then((offlineStyle) => {
        if (mapRef.current === map) {
          try {
            map.setStyle(offlineStyle as any);
          } catch {}
        }
      });
      return;
    }
    const targetUseMapbox = useMapbox && !fallbackAppliedRef.current;
    map.setStyle(resolveBasemapStyleSync(basemap, targetUseMapbox) as any);
  }, [basemap, useMapbox, offlineStatus.isOffline]);

  // Live projection toggle (Globe vs Mercator)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.setProjection !== 'function') return;
    try {
      map.setProjection(projection);
    } catch {}
  }, [projection]);

  // Sync layers whenever toggles, lighting, routes, or ruler points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncMapLayers(map);
  }, [mapReady, syncMapLayers]);

  // Render Destination Marker when routeDestination is active
  useEffect(() => {
    const map = mapRef.current;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (!map || !routeDestination) return;

    const el = document.createElement('div');
    el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;"><div style="width:36px;height:36px;border-radius:9999px;background:#EA580C;border:3px solid #FFFFFF;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 6px 16px rgba(0,0,0,0.45);">🏁</div></div>`;
    destMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([routeDestination.lng, routeDestination.lat])
      .addTo(map);
  }, [routeDestination]);

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
      el.onclick = (ev) => {
        ev.stopPropagation();
        setSelectedDriver(null);
        setSelectedReport(null);
        setDroppedPin(null);
        setSelectedVendor(v);
        map.flyTo({
          center: [Number(v.location.lng), Number(v.location.lat)],
          zoom: Math.max(map.getZoom(), 16),
          duration: 600,
        });
      };

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([Number(v.location.lng), Number(v.location.lat)])
        .addTo(map);
      vendorMarkersRef.current.push(marker);
    }
  }, [filteredVendors, layers.showVendors]);

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
      el.onclick = (ev) => {
        ev.stopPropagation();
        setSelectedVendor(null);
        setSelectedReport(null);
        setDroppedPin(null);
        setSelectedDriver(drv);
        map.flyTo({ center: [drv.lng, drv.lat], zoom: Math.max(map.getZoom(), 16), duration: 600 });
      };
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([drv.lng, drv.lat])
        .addTo(map);
      driverMarkersRef.current.push(marker);
    }
  }, [liveDrivers, layers.showDrivers]);

  // Render Community Road Alert Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    roadReportMarkersRef.current.forEach((m) => m.remove());
    roadReportMarkersRef.current = [];

    if (!layers.showRoadReports) return;

    for (const rep of roadReports) {
      const meta = ROAD_REPORT_TYPES.find((r) => r.id === rep.category) || ROAD_REPORT_TYPES[0];
      const el = document.createElement('button');
      el.type = 'button';
      el.style.cssText = 'background:transparent;border:none;padding:0;cursor:pointer;';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="width:34px;height:34px;border-radius:9999px;background:#0F172A;border:2.5px solid ${meta.color};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 5px 14px rgba(0,0,0,0.45);">
            <span>${meta.emoji}</span>
          </div>
          <div style="background:${meta.color};color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
            ${meta.shortLabel}
          </div>
        </div>
      `;
      el.onclick = (ev) => {
        ev.stopPropagation();
        setSelectedVendor(null);
        setSelectedDriver(null);
        setDroppedPin(null);
        setSelectedReport(rep);
        map.flyTo({ center: [rep.lng, rep.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 550 });
      };
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([rep.lng, rep.lat])
        .addTo(map);
      roadReportMarkersRef.current.push(marker);
    }
  }, [roadReports, layers.showRoadReports]);

  // Render Nearby Essentials Markers (Fuel, Hospital, ATM)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    essentialMarkersRef.current.forEach((m) => m.remove());
    essentialMarkersRef.current = [];

    for (const item of essentialResults) {
      const emoji = item.kind === 'fuel' ? '⛽' : item.kind === 'hospital' ? '🏥' : '🏧';
      const borderColor = item.kind === 'fuel' ? '#F59E0B' : item.kind === 'hospital' ? '#EF4444' : '#10B981';
      const el = document.createElement('button');
      el.type = 'button';
      el.style.cssText = 'background:transparent;border:none;padding:0;cursor:pointer;';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="width:32px;height:32px;border-radius:10px;background:#0F172A;border:2px solid ${borderColor};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.4);">
            <span>${emoji}</span>
          </div>
          <div style="background:rgba(15,23,42,0.9);color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:5px;white-space:nowrap;max-width:105px;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,0.15);">
            ${item.name.replace(/</g, '&lt;')}
          </div>
        </div>
      `;
      el.onclick = (ev) => {
        ev.stopPropagation();
        startRoutePlanning({
          lat: item.lat,
          lng: item.lng,
          name: item.name,
          address: item.address,
        });
      };
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([item.lng, item.lat])
        .addTo(map);
      essentialMarkersRef.current.push(marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essentialResults]);

  // Debounced Place Search (Offline-first with online Geocoding + vendor catalog)
  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const extraPlaces = vendors
          .filter((v: any) => Number.isFinite(Number(v?.location?.lat)) && Number.isFinite(Number(v?.location?.lng)))
          .map((v: any) => ({
            name: String(v.businessName || 'Duka'),
            displayName: `${v.businessName || 'Duka'}${v.address ? `, ${v.address}` : ''}`,
            lat: Number(v.location.lat),
            lng: Number(v.location.lng),
          }));
        const results = await searchPlacesOfflineFirst(q, {
          limit: 6,
          addressdetails: true,
          extraPlaces,
        });
        setSearchResults(results);
      } catch {
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText, vendors]);

  // Fetch Routes from userPos to routeDestination
  const calculateRoute = useCallback(
    async (
      dest: { lat: number; lng: number; name: string; address?: string },
      modeToUse: TravelMode
    ) => {
      setIsFetchingRoute(true);
      try {
        const origin = userPosRef.current;
        const routes = await fetchPapoMapRoutes({
          origin,
          destination: { lat: dest.lat, lng: dest.lng },
          mode: modeToUse,
          token: mapboxToken,
        });
        setRouteOptions(routes);
        setSelectedRouteIdx(0);
        setCurrentStepIdx(0);

        const first = routes[0];
        if (first && mapRef.current && first.geometry.coordinates.length >= 2) {
          const lons = first.geometry.coordinates.map((c) => c[0]);
          const lats = first.geometry.coordinates.map((c) => c[1]);
          const minLng = Math.min(...lons, origin.lng, dest.lng);
          const maxLng = Math.max(...lons, origin.lng, dest.lng);
          const minLat = Math.min(...lats, origin.lat, dest.lat);
          const maxLat = Math.max(...lats, origin.lat, dest.lat);
          try {
            mapRef.current.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              { padding: { top: 135, bottom: 230, left: 48, right: 60 }, duration: 700 }
            );
          } catch {}
        }
      } catch {
        toast.error('Imeshindwa kupanga njia kwa sasa.');
      } finally {
        setIsFetchingRoute(false);
      }
    },
    [mapboxToken]
  );

  const startRoutePlanning = useCallback(
    (dest: { lat: number; lng: number; name: string; address?: string }) => {
      setSelectedVendor(null);
      setSelectedDriver(null);
      setSelectedReport(null);
      setDroppedPin(null);
      setIsMeasuring(false);
      setIsNavActive(false);
      setShowStepList(false);
      setRouteDestination(dest);
      calculateRoute(dest, travelMode);
    },
    [calculateRoute, travelMode]
  );

  // Re-fetch routes automatically when travel mode changes during route preview
  const handleTravelModeChange = (nextMode: TravelMode) => {
    setTravelMode(nextMode);
    if (routeDestination) {
      calculateRoute(routeDestination, nextMode);
    }
  };

  const handleStartTurnByTurn = () => {
    if (!activeRoute) return;
    setIsNavActive(true);
    setFollowCamera(true);
    setCurrentStepIdx(0);
    setShowStepList(false);
    setPitch(54);
    mapRef.current?.easeTo({
      center: [userPos.lng, userPos.lat],
      zoom: 16.5,
      pitch: 54,
      ...(gpsHeading !== null && gpsSpeedKmh > 4 ? { bearing: gpsHeading } : {}),
      duration: 650,
    });
    const firstInst = activeRoute.steps[0]?.instructionSw;
    if (firstInst) {
      speakSwahiliInstruction(firstInst, voiceEnabled);
    }
  };

  const handleStopNavigation = () => {
    setIsNavActive(false);
    setFollowCamera(false);
    setShowStepList(false);
    setRouteDestination(null);
    setRouteOptions([]);
    setSelectedRouteIdx(0);
    setCurrentStepIdx(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

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
        setHasGpsFix(true);
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

  const handleSubmitRoadReport = async () => {
    const meta = ROAD_REPORT_TYPES.find((r) => r.id === reportCategory) || ROAD_REPORT_TYPES[0];
    let targetLat = userPos.lat;
    let targetLng = userPos.lng;
    if (!reportAtGps && mapRef.current) {
      const center = mapRef.current.getCenter();
      if (center) {
        targetLat = Number(center.lat);
        targetLng = Number(center.lng);
      }
    }

    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, 'pois'), {
        type: 'papomap_road_alert',
        category: reportCategory,
        title: meta.label,
        description: reportNote.trim() || meta.description,
        location: { lat: targetLat, lng: targetLng },
        lat: targetLat,
        lng: targetLng,
        confirmations: 1,
        createdAtMs: Date.now(),
      });
      toast.success(`Taarifa ya "${meta.label}" imechapishwa kwenye PapoMap!`);
      setIsReportModalOpen(false);
      setReportNote('');
      setLayers((prev) => ({ ...prev, showRoadReports: true }));
    } catch {
      toast.error('Imeshindwa kutuma taarifa. Jaribu tena.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleConfirmReport = async (rep: RoadReportItem) => {
    try {
      await updateDoc(doc(db, 'pois', rep.id), {
        confirmations: increment(1),
      });
      setSelectedReport((prev) => (prev && prev.id === rep.id ? { ...prev, confirmations: prev.confirmations + 1 } : prev));
      toast.success('Asante kwa kuthibitisha hali ya barabara!');
    } catch {
      toast.error('Imeshindwa kuthibitisha.');
    }
  };

  const handleResolveReport = async (rep: RoadReportItem) => {
    try {
      await deleteDoc(doc(db, 'pois', rep.id));
      setSelectedReport(null);
      toast.success('Tukio limeondolewa — barabara iko shwari!');
    } catch {
      toast.error('Imeshindwa kuondoa tukio.');
    }
  };

  const handleSavePlace = (slot: 'home' | 'work' | 'custom', place: { lat: number; lng: number; address: string; label?: string }) => {
    const label =
      slot === 'home' ? 'Nyumbani' : slot === 'work' ? 'Kazini' : place.label || place.address.split(',')[0] || 'Eneo Muhimu';
    const next = upsertSavedPlace({
      id: slot === 'custom' ? `custom-${Date.now()}` : slot,
      slot,
      label,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      updatedAt: Date.now(),
    });
    setSavedPlaces(next);
    toast.success(`${label} imehifadhiwa!`);
  };

  const handleToggleEssentials = async (kind: NearbyEssentialKind) => {
    if (activeEssentialKind === kind) {
      setActiveEssentialKind(null);
      setEssentialResults([]);
      return;
    }
    setActiveEssentialKind(kind);
    setIsLoadingEssentials(true);
    try {
      const center = mapRef.current?.getCenter?.();
      const refLat = center ? Number(center.lat) : userPos.lat;
      const refLng = center ? Number(center.lng) : userPos.lng;
      const items = await fetchNearbyEssentials({
        lat: refLat,
        lng: refLng,
        kind,
        token: mapboxToken,
      });
      setEssentialResults(items);
      if (items.length === 0) {
        toast.info('Hakuna vituo vilivyopatikana karibu kwa sasa.');
      } else {
        const first = items[0];
        mapRef.current?.flyTo({ center: [first.lng, first.lat], zoom: 14.2, duration: 600 });
      }
    } catch {
      toast.error('Imeshindwa kutafuta huduma za karibu.');
    } finally {
      setIsLoadingEssentials(false);
    }
  };

  const handleShareLocation = async () => {
    const shareTarget = droppedPin
      ? { lat: droppedPin.lat, lng: droppedPin.lng, title: droppedPin.label }
      : { lat: userPos.lat, lng: userPos.lng, title: 'Mahali Nilipo Sasa (PapoMap)' };
    const mapsUrl = `https://maps.google.com/?q=${shareTarget.lat.toFixed(6)},${shareTarget.lng.toFixed(6)}`;
    const text = `${shareTarget.title}: ${mapsUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'PapoMap — Eneo Langu', text, url: mapsUrl });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Kiungo cha eneo kimenakiliwa!');
    } catch {
      toast.info(mapsUrl);
    }
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

  const homePlace = savedPlaces.find((p) => p.slot === 'home');
  const workPlace = savedPlaces.find((p) => p.slot === 'work');

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] bg-neutral-950 text-white flex flex-col">
      {/* ACTIVE TURN-BY-TURN NAVIGATION HUD */}
      {isNavActive && activeRoute && (
        <div className="absolute top-3 left-3 right-3 z-30 flex flex-col gap-2 pointer-events-none">
          <div className="pointer-events-auto bg-emerald-950/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl max-w-2xl mx-auto w-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-md">
                  {renderManeuverIcon(currentStep?.maneuverType, currentStep?.modifier)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-300 font-mono tabular-nums">
                    {currentStep ? formatDistanceSw(currentStep.distanceMeters) : 'Njiani'} ·{' '}
                    {activeRoute.trafficLabel}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {currentStep?.instructionSw || 'Endelea na safari yako'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setVoiceEnabled((v) => !v)}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                  title={voiceEnabled ? 'Zima Sauti ya Maelekezo' : 'Washa Sauti ya Maelekezo'}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStepList((s) => !s)}
                  className="h-10 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">Hatua</span>
                  {showStepList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-200 truncate max-w-[60%]">
                <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate font-medium">{routeDestination?.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {currentStepIdx < activeRoute.steps.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = currentStepIdx + 1;
                      setCurrentStepIdx(nextIdx);
                      const nextInst = activeRoute.steps[nextIdx]?.instructionSw;
                      if (nextInst) speakSwahiliInstruction(nextInst, voiceEnabled);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold cursor-pointer whitespace-nowrap"
                  >
                    Hatua Ijayo
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStopNavigation}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer whitespace-nowrap"
                >
                  Simama
                </button>
              </div>
            </div>

            {showStepList && activeRoute.steps.length > 0 && (
              <div className="mt-3 max-h-52 overflow-y-auto border-t border-white/10 pt-2 space-y-1">
                {activeRoute.steps.map((step, idx) => (
                  <button
                    key={`step-${idx}`}
                    type="button"
                    onClick={() => {
                      setCurrentStepIdx(idx);
                      setShowStepList(false);
                      mapRef.current?.flyTo({ center: step.location, zoom: 16.5, duration: 500 });
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-3 cursor-pointer ${
                      idx === currentStepIdx
                        ? 'bg-emerald-600/35 text-white font-bold'
                        : 'text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{idx + 1}. {step.instructionSw}</span>
                    <span className="font-mono tabular-nums text-[11px] text-emerald-300 shrink-0">
                      {formatDistanceSw(step.distanceMeters)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP SEARCH & CONTROLS BAR (Hidden when actively navigating) */}
      {!isNavActive && (
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
                    const shortName = String(label).split(',')[0];
                    return (
                      <div
                        key={`sr-${idx}`}
                        className="w-full px-3 py-2.5 text-left text-xs text-neutral-200 hover:bg-white/10 border-b border-white/5 last:border-b-0 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                              setDroppedPin({ lat, lng, label: shortName });
                              mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 750 });
                            }
                            setSearchResults([]);
                            setSearchText(shortName);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                        {Number.isFinite(lat) && Number.isFinite(lng) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchResults([]);
                              setSearchText(shortName);
                              startRoutePlanning({ lat, lng, name: shortName, address: label });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Nielekeze</span>
                          </button>
                        )}
                      </div>
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
              onClick={() => setIsOfflineManagerOpen(true)}
              className={`h-10 px-2.5 sm:px-3 rounded-xl backdrop-blur-md border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-lg ${
                offlineStatus.isOffline
                  ? 'bg-amber-600/90 border-amber-400 text-white'
                  : 'bg-neutral-950/90 border-white/15 text-emerald-300 hover:bg-neutral-900'
              }`}
              title="Hifadhi ramani za 2D & 3D utumie bila intaneti"
            >
              {offlineStatus.isOffline ? (
                <WifiOff className="w-4 h-4 text-white" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              <span className="hidden sm:inline">{offlineStatus.isOffline ? 'Offline' : 'Hifadhi'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLayerDrawerOpen(true)}
              className="h-10 px-3 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-white/15 text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-900 whitespace-nowrap shrink-0 cursor-pointer shadow-lg"
            >
              <Layers className="w-4 h-4 text-orange-400" />
              <span>Tabaka</span>
            </button>
          </div>

          {/* Category Filter Strip + Traffic + BRT + Hotspots */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto pb-0.5">
            <div className="md:hidden shrink-0">
              <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} compact />
            </div>
            <button
              type="button"
              onClick={() => setLayers((prev) => ({ ...prev, showTraffic: !prev.showTraffic }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
                layers.showTraffic
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                  : 'bg-neutral-950/85 border-white/15 text-neutral-300 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Live Traffic</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border bg-amber-600/90 border-amber-500 text-white hover:bg-amber-500 transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Ripoti Hali</span>
            </button>
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

          {/* Utility Row: Saved Places, Nearby Essentials (Petroli/Hospitali/ATM), Distance Ruler, Share */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                if (homePlace) {
                  startRoutePlanning({
                    lat: homePlace.lat,
                    lng: homePlace.lng,
                    name: homePlace.label,
                    address: homePlace.address,
                  });
                } else {
                  setIsSavedPlacesOpen(true);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950/85 border border-white/15 text-[11px] font-bold text-neutral-200 hover:text-white hover:bg-neutral-900 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-orange-400" />
              <span>{homePlace ? 'Nyumbani' : 'Weka Nyumbani'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (workPlace) {
                  startRoutePlanning({
                    lat: workPlace.lat,
                    lng: workPlace.lng,
                    name: workPlace.label,
                    address: workPlace.address,
                  });
                } else {
                  setIsSavedPlacesOpen(true);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950/85 border border-white/15 text-[11px] font-bold text-neutral-200 hover:text-white hover:bg-neutral-900 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5 text-sky-400" />
              <span>{workPlace ? 'Kazini' : 'Weka Kazini'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleEssentials('fuel')}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeEssentialKind === 'fuel'
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-neutral-950/85 border-white/15 text-neutral-200 hover:text-white'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span>Petroli</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleEssentials('hospital')}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeEssentialKind === 'hospital'
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-neutral-950/85 border-white/15 text-neutral-200 hover:text-white'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
              <span>Hospitali</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleEssentials('atm')}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeEssentialKind === 'atm'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-neutral-950/85 border-white/15 text-neutral-200 hover:text-white'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span>ATM / Benki</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMeasuring((m) => {
                  const next = !m;
                  if (next) {
                    setMeasurePoints([{ lat: userPos.lat, lng: userPos.lng }]);
                    toast.info('Gusa pointi kwenye ramani kupima umbali na nauli.');
                  } else {
                    setMeasurePoints([]);
                  }
                  return next;
                });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                isMeasuring
                  ? 'bg-amber-500 border-amber-400 text-neutral-950'
                  : 'bg-neutral-950/85 border-white/15 text-neutral-200 hover:text-white'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Pima Umbali</span>
            </button>
            <button
              type="button"
              onClick={handleShareLocation}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950/85 border border-white/15 text-[11px] font-bold text-neutral-200 hover:text-white hover:bg-neutral-900 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Shiriki</span>
            </button>
          </div>
        </div>
      )}

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

      {/* Live Traffic Legend HUD + GPS Speedometer */}
      <div
        className={`absolute left-3 z-20 flex flex-col gap-1.5 pointer-events-none ${
          isNavActive ? 'bottom-28 sm:bottom-24' : 'bottom-24 sm:bottom-16'
        }`}
      >
        {(hasGpsFix || isNavActive) && (
          <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-white/15 shadow-lg w-fit">
            <Gauge className="w-4 h-4 text-sky-400" />
            <div className="font-mono tabular-nums text-xs font-bold text-white">
              {gpsSpeedKmh} <span className="text-[10px] text-neutral-400 font-normal">km/h</span>
            </div>
          </div>
        )}
        {layers.showTraffic && !isNavActive && (
          <div className="pointer-events-auto inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-950/90 backdrop-blur-md border border-white/15 text-[10px] font-bold shadow-lg w-fit">
            <span className="text-neutral-400">Trafiki:</span>
            <span className="text-emerald-400">● Shwari</span>
            <span className="text-amber-400">● Kiasi</span>
            <span className="text-rose-400">● Foleni</span>
          </div>
        )}
      </div>

      {/* Right Navigation Controls Rail */}
      <div
        className={`absolute right-3 z-20 flex flex-col gap-1.5 ${
          isNavActive ? 'top-36' : 'top-40'
        }`}
      >
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="w-10 h-10 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 cursor-pointer shadow-lg"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="w-10 h-10 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 cursor-pointer shadow-lg"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (isNavActive) {
              setFollowCamera((f) => !f);
              mapRef.current?.easeTo({ center: [userPos.lng, userPos.lat], zoom: 16.5, duration: 500 });
            } else {
              handleRecenterGps();
            }
          }}
          disabled={isLocating}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer shadow-lg ${
            followCamera
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-neutral-950/90 border-white/15 text-orange-400 hover:bg-neutral-900'
          }`}
          title="Lenga GPS Yangu"
        >
          {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'))}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer shadow-lg ${
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
          className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center text-[10px] font-black cursor-pointer shadow-lg ${
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
          className="w-10 h-10 rounded-xl bg-neutral-950/90 border border-white/15 flex items-center justify-center text-white hover:bg-neutral-900 cursor-pointer shadow-lg"
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
          className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer shadow-lg ${
            layers.show3DBuildings
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-neutral-950/90 border-white/15 text-neutral-400'
          }`}
          title="Majengo ya 3D"
        >
          <Building2 className="w-4 h-4" />
        </button>
      </div>

      {/* NEARBY ESSENTIALS DRAWER PANEL (Petroli / Hospitali / ATM) */}
      {activeEssentialKind && !isNavActive && !routeDestination && (
        <div className="absolute bottom-16 left-3 right-3 sm:right-auto sm:w-96 z-20 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-2xl space-y-2.5 max-h-64 flex flex-col">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white">
              {activeEssentialKind === 'fuel'
                ? 'Vituo vya Petroli Karibu'
                : activeEssentialKind === 'hospital'
                ? 'Hospitali & Kliniki Karibu'
                : 'ATM & Benki Karibu'}
            </h4>
            <button
              type="button"
              onClick={() => {
                setActiveEssentialKind(null);
                setEssentialResults([]);
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {isLoadingEssentials ? (
            <div className="py-5 flex items-center justify-center gap-2 text-xs text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              <span>Inatafuta vituo karibu...</span>
            </div>
          ) : essentialResults.length === 0 ? (
            <p className="text-xs text-neutral-400 py-2">Hakuna vituo vilivyopatikana kwa sasa.</p>
          ) : (
            <div className="overflow-y-auto space-y-1.5 pr-1">
              {essentialResults.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-neutral-400 truncate">
                      {item.distanceKm.toFixed(1)} km · {item.address}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      startRoutePlanning({
                        lat: item.lat,
                        lng: item.lng,
                        name: item.name,
                        address: item.address,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Nenda</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISTANCE & FARE RULER TELEMETRY BAR */}
      {isMeasuring && !isNavActive && (
        <div className="absolute bottom-16 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[540px] z-20 bg-neutral-950/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Ruler className="w-4 h-4" />
              <span>Pima Umbali & Kadirio la Nauli</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMeasurePoints([])}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white cursor-pointer"
              >
                Futa
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMeasuring(false);
                  setMeasurePoints([]);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-[11px] font-bold text-white cursor-pointer"
              >
                Maliza
              </button>
            </div>
          </div>
          {measurePoints.length < 2 ? (
            <p className="text-[11px] text-neutral-300">
              Gusa sehemu nyingine kwenye ramani kuweka pointi ya pili ({measurePoints.length}/2).
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 text-[11px] bg-white/5 border border-white/10 rounded-xl p-2">
              <div>
                <span className="text-neutral-400 block text-[10px]">Umbali</span>
                <strong className="font-mono tabular-nums text-white">
                  {measureTelemetry.totalKm.toFixed(2)} km
                </strong>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Boda</span>
                <strong className="font-mono tabular-nums text-emerald-400">
                  TZS {measureTelemetry.bodaEstimateTzs.toLocaleString()}
                </strong>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Bajaji</span>
                <strong className="font-mono tabular-nums text-amber-300">
                  TZS {measureTelemetry.bajajEstimateTzs.toLocaleString()}
                </strong>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Taxi</span>
                <strong className="font-mono tabular-nums text-sky-300">
                  TZS {measureTelemetry.taxiEstimateTzs.toLocaleString()}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE NAVIGATION BOTTOM TELEMETRY BAR */}
      {isNavActive && activeRoute && (
        <div className="absolute bottom-3 left-3 right-3 z-30 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[10px] text-neutral-400 block">Muda Uliobaki</span>
              <strong className="text-base font-bold text-emerald-400 font-mono tabular-nums">
                {formatDurationSw(activeRoute.durationSeconds)}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block">Umbali</span>
              <strong className="text-sm font-bold text-white font-mono tabular-nums">
                {formatDistanceSw(activeRoute.distanceMeters)}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block">Kufika (EAT)</span>
              <strong className="text-sm font-bold text-amber-300 font-mono tabular-nums">
                Saa {formatEtaClock(activeRoute.durationSeconds)}
              </strong>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="h-9 px-3 rounded-xl bg-amber-600/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Ripoti Hali</span>
            </button>
            <button
              type="button"
              onClick={() => setFollowCamera((f) => !f)}
              className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                followCamera
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-neutral-200 hover:bg-white/20'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{followCamera ? 'Inafuata GPS' : 'Fuata GPS'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ROUTE PREVIEW SHEET (Shown before pressing Anza Safari) */}
      {routeDestination && !isNavActive && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[420px] z-30 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-emerald-400">Mpango wa Safari (GPS Navigation)</div>
              <h4 className="text-sm font-bold text-white truncate mt-0.5">{routeDestination.name}</h4>
              {routeDestination.address && (
                <p className="text-[11px] text-neutral-400 truncate">{routeDestination.address}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleStopNavigation}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Travel Mode Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10">
            {TRAVEL_MODES.map((m) => {
              const Icon = m.icon;
              const active = travelMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleTravelModeChange(m.id)}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    active ? 'bg-orange-600 text-white' : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Route Alternatives List */}
          {isFetchingRoute ? (
            <div className="py-5 flex items-center justify-center gap-2 text-xs text-neutral-300">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              <span>Inatafuta njia bora yenye trafiki ndogo...</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {routeOptions.map((r, idx) => {
                const selected = idx === selectedRouteIdx;
                const badgeColor =
                  r.trafficStatus === 'heavy'
                    ? 'text-rose-400'
                    : r.trafficStatus === 'moderate'
                    ? 'text-amber-300'
                    : 'text-emerald-400';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRouteIdx(idx)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      selected
                        ? 'border-emerald-500 bg-emerald-500/15'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {idx === 0 ? 'Njia ya Haraka Zaidi' : `Njia Mbadala ${idx}`} · {r.summary}
                      </div>
                      <div className={`text-[11px] font-medium mt-0.5 ${badgeColor}`}>
                        {r.trafficLabel} · Kufika Saa {formatEtaClock(r.durationSeconds)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white font-mono tabular-nums">
                        {formatDurationSw(r.durationSeconds)}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono tabular-nums">
                        {formatDistanceSw(r.distanceMeters)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!activeRoute || isFetchingRoute}
              onClick={handleStartTurnByTurn}
              className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" />
              <span>Anza Safari (GPS)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/taxi');
              }}
              className="h-11 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Car className="w-4 h-4" />
              <span>Agiza PapoRide</span>
            </button>
          </div>
        </div>
      )}

      {/* DROPPED PIN ACTION CARD */}
      {droppedPin && !routeDestination && !selectedVendor && !selectedDriver && !selectedReport && !isNavActive && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[400px] z-30 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{droppedPin.label}</h4>
                <p className="text-[11px] text-neutral-400 font-mono tabular-nums mt-0.5">
                  {droppedPin.lat.toFixed(5)}, {droppedPin.lng.toFixed(5)} ·{' '}
                  {haversineKm(userPos.lat, userPos.lng, droppedPin.lat, droppedPin.lng).toFixed(1)} km kutoka ulipo
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDroppedPin(null)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                startRoutePlanning({
                  lat: droppedPin.lat,
                  lng: droppedPin.lng,
                  name: droppedPin.label,
                })
              }
              className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" />
              <span>Nielekeze Hapa</span>
            </button>
            <button
              type="button"
              onClick={() => handleSavePlace('home', { lat: droppedPin.lat, lng: droppedPin.lng, address: droppedPin.label })}
              className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Hifadhi kama Nyumbani"
            >
              <Home className="w-3.5 h-3.5 text-orange-400" />
              <span>Nyumbani</span>
            </button>
            <button
              type="button"
              onClick={() => handleSavePlace('work', { lat: droppedPin.lat, lng: droppedPin.lng, address: droppedPin.label })}
              className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Hifadhi kama Kazini"
            >
              <Briefcase className="w-3.5 h-3.5 text-sky-400" />
              <span>Kazini</span>
            </button>
            {onSelectLocation && (
              <button
                type="button"
                onClick={() => {
                  onSelectLocation({
                    address: droppedPin.label,
                    lat: droppedPin.lat,
                    lng: droppedPin.lng,
                  });
                  onClose();
                }}
                className="w-full h-10 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Tumia Eneo Hili</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* COMMUNITY ROAD REPORT INSPECTION CARD */}
      {selectedReport && !routeDestination && !isNavActive && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[390px] z-30 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3">
          {(() => {
            const meta =
              ROAD_REPORT_TYPES.find((r) => r.id === selectedReport.category) || ROAD_REPORT_TYPES[0];
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: `${meta.color}22`, border: `1px solid ${meta.color}66` }}
                    >
                      {meta.emoji}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{selectedReport.title}</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {formatRelativeAgoSw(selectedReport.createdAtMs)} ·{' '}
                        <span className="font-mono tabular-nums text-amber-300">
                          {selectedReport.confirmations} wamethibitisha
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReport(null)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {selectedReport.description && (
                  <p className="text-xs text-neutral-200 bg-white/5 border border-white/10 rounded-xl p-2.5">
                    {selectedReport.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmReport(selectedReport)}
                    className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Bado Ipo (+1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveReport(selectedReport)}
                    className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Imeisha</span>
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Bottom Summary Telemetry Strip */}
      {!selectedVendor &&
        !selectedDriver &&
        !selectedReport &&
        !droppedPin &&
        !routeDestination &&
        !isNavActive && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-neutral-950/90 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 shadow-2xl">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-bold text-emerald-400 tabular-nums">
                {counts.openVendors} Wazi
              </span>
              <span className="font-bold text-neutral-400 tabular-nums">
                {counts.closedVendors} Imefungwa
              </span>
              <span className="flex items-center gap-1.5 font-bold text-amber-400 tabular-nums">
                <Car className="w-3.5 h-3.5" />
                {counts.onlineDrivers} Online · {counts.busyDrivers} Busy
              </span>
              {counts.roadReports > 0 && (
                <span className="flex items-center gap-1 font-bold text-rose-400 tabular-nums">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {counts.roadReports} Matukio
                </span>
              )}
            </div>
            {onSelectLocation && (
              <button
                type="button"
                onClick={() => {
                  onSelectLocation({
                    address:
                      initialLocation?.address ||
                      `Eneo (${userPos.lat.toFixed(4)}, ${userPos.lng.toFixed(4)})`,
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
      {selectedVendor && !routeDestination && !isNavActive && (
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
                    className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                      selectedVendor.openStatus.isOpen ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    · {selectedVendor.openStatus.label}
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
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 shrink-0 cursor-pointer"
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
                startRoutePlanning({
                  lat: Number(selectedVendor.location.lat),
                  lng: Number(selectedVendor.location.lng),
                  name: selectedVendor.businessName || 'Duka',
                  address: selectedVendor.address || selectedVendor.city,
                });
              }}
              className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Nielekeze</span>
            </button>
          </div>
        </div>
      )}

      {/* Selected Driver Inspection Card */}
      {selectedDriver && !routeDestination && !isNavActive && (
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
                    className={`text-[11px] font-bold ${
                      selectedDriver.isBusy ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    · {selectedDriver.isBusy ? 'Busy' : 'Online'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  {selectedDriver.vehiclePlate} · ⭐ {selectedDriver.rating.toFixed(1)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDriver(null)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 cursor-pointer"
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

      {/* COMMUNITY ROAD ALERT SUBMISSION MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[1060] bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full sm:max-w-md bg-neutral-950 text-white rounded-t-3xl sm:rounded-2xl border border-white/15 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Ripoti Hali ya Barabara</h3>
                <p className="text-[11px] text-neutral-400">
                  Saidia watumiaji wengine wa PapoMap kuepuka foleni au hatari
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROAD_REPORT_TYPES.map((rt) => {
                const selected = reportCategory === rt.id;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setReportCategory(rt.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xl">{rt.emoji}</div>
                    <div className="text-xs font-bold mt-1 leading-tight">{rt.shortLabel}</div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 block">
                Maelezo mafupi (hiari)
              </label>
              <input
                type="text"
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Mf. Foleni kubwa mataa ya Ubungo..."
                maxLength={120}
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportAtGps(true)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                  reportAtGps
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-neutral-300'
                }`}
              >
                Tumia GPS Yangu
              </button>
              <button
                type="button"
                onClick={() => setReportAtGps(false)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                  !reportAtGps
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-neutral-300'
                }`}
              >
                Katikati ya Ramani
              </button>
            </div>

            <button
              type="button"
              disabled={isSubmittingReport}
              onClick={handleSubmitRoadReport}
              className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>Tuma Taarifa Kwenye Ramani</span>
            </button>
          </div>
        </div>
      )}

      {/* SAVED PLACES MANAGEMENT MODAL */}
      {isSavedPlacesOpen && (
        <div className="fixed inset-0 z-[1060] bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full sm:max-w-md bg-neutral-950 text-white rounded-t-3xl sm:rounded-2xl border border-white/15 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Maeneo Yangu Muhimu</h3>
                <p className="text-[11px] text-neutral-400">
                  Hifadhi Nyumbani au Kazini kwa safari ya kubofya mara moja
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSavedPlacesOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const center = mapRef.current?.getCenter?.();
                  const lat = center ? Number(center.lat) : userPos.lat;
                  const lng = center ? Number(center.lng) : userPos.lng;
                  handleSavePlace('home', {
                    lat,
                    lng,
                    address: `Eneo (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                  });
                }}
                className="p-3 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-left cursor-pointer"
              >
                <Home className="w-4 h-4 text-orange-400 mb-1" />
                <div className="text-xs font-bold">Weka Hapa = Nyumbani</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">Katikati ya ramani sasa</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const center = mapRef.current?.getCenter?.();
                  const lat = center ? Number(center.lat) : userPos.lat;
                  const lng = center ? Number(center.lng) : userPos.lng;
                  handleSavePlace('work', {
                    lat,
                    lng,
                    address: `Eneo (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                  });
                }}
                className="p-3 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-left cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-sky-400 mb-1" />
                <div className="text-xs font-bold">Weka Hapa = Kazini</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">Katikati ya ramani sasa</div>
              </button>
            </div>

            {savedPlaces.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {savedPlaces.map((sp) => (
                  <div
                    key={sp.id}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsSavedPlacesOpen(false);
                        startRoutePlanning({ lat: sp.lat, lng: sp.lng, name: sp.label, address: sp.address });
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="text-xs font-bold text-white truncate">{sp.label}</div>
                      <div className="text-[10px] text-neutral-400 truncate">{sp.address}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedPlaces(removeSavedPlace(sp.id))}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        isMapboxEnabled={useMapbox}
        onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
      />

      <OfflineMapManagerModal
        isOpen={isOfflineManagerOpen}
        onClose={() => setIsOfflineManagerOpen(false)}
        currentCenter={{ lat: userPos.lat, lng: userPos.lng }}
      />
    </div>,
    document.body
  );
};
