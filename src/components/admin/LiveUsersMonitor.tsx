import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  addDoc,
} from 'firebase/firestore';
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  Globe,
  History,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Navigation,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  UserCheck,
  Users,
  Car,
  Store,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../firebase';
import {
  GEOLIBRE_BASEMAPS,
  GeoLibreBasemapId,
  MAPBOX_STYLE_URLS,
  buildCircleGeoJsonPolygon,
  getMapboxToken,
  normalizeLatLngList,
  resolveMapboxAccessToken,
  stripMapWatermarks,
} from '../../lib/geoLibreEngine';
import { GeoLibreBasemapPillBar } from '../map/GeoLibreControls';
import { logUserActivity } from '../../utils/userActivityTracker';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LiveUsersMonitorProps {
  allUsers: any[];
  driverLocations: any[];
  activeRides: any[];
  orders: any[];
  vendors: any[];
  pricingRules?: Record<string, any>;
  initialSelectedUserId?: string | null;
  onSelectDriver?: (driver: any) => void;
}

interface UnifiedUserMonitorRow {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  isOnline: boolean;
  hasGps: boolean;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  currentPath: string;
  currentPageLabel: string;
  lastActionTitle: string;
  lastSeenAtMs: number;
  lastLoginAtMs: number;
  sessionStartedAtMs: number;
  device: string;
  accuracy: number | null;
  locationTrail: Array<{ lat: number; lng: number; atMs: number; path?: string }>;
  userDoc: any;
  presenceDoc: any;
  driverTelemetry: any;
}

const ROLE_META: Record<string, { label: string; color: string; badgeClass: string }> = {
  customer: {
    label: 'Mteja',
    color: '#10B981',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  rider: {
    label: 'Dereva',
    color: '#F97316',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  driver: {
    label: 'Dereva',
    color: '#F97316',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  vendor: {
    label: 'Muuzaji',
    color: '#8B5CF6',
    badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  wakala: {
    label: 'Wakala',
    color: '#06B6D4',
    badgeClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  },
  merchant_pos: {
    label: 'Merchant POS',
    color: '#0EA5E9',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  admin: {
    label: 'Admin',
    color: '#E11D48',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
};

const QUICK_NAV_ROUTES = [
  { path: '/', label: 'Nyumbani (Homepage)' },
  { path: '/services', label: 'Kituo cha Huduma' },
  { path: '/taxi', label: 'PapoRide Taxi' },
  { path: '/daladala', label: 'Daladala & Mwendokasi' },
  { path: '/papopay', label: 'PapoPay / Malipo' },
  { path: '/orders', label: 'Oda Zangu' },
  { path: '/profile', label: 'Wasifu (Profile)' },
  { path: '/chat', label: 'Ujumbe (Chat)' },
  { path: '/notifications', label: 'Arifa (Notifications)' },
];

const ONLINE_STALE_WINDOW_MS = 3 * 60 * 1000;

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = Date.parse(String(val));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeTime(ms: number): string {
  if (!ms) return 'Haijulikani';
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 15000) return 'Sasa hivi';
  if (diff < 60000) return `Sekunde ${Math.floor(diff / 1000)} zilizopita`;
  if (diff < 3600000) return `Dakika ${Math.floor(diff / 60000)} zilizopita`;
  if (diff < 86400000) return `Saa ${Math.floor(diff / 3600000)} zilizopita`;
  return new Date(ms).toLocaleString();
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const LiveUsersMonitor: React.FC<LiveUsersMonitorProps> = ({
  allUsers,
  driverLocations,
  activeRides,
  orders,
  vendors,
  pricingRules = {},
  initialSelectedUserId = null,
  onSelectDriver,
}) => {
  const [presenceDocs, setPresenceDocs] = useState<any[]>([]);
  const [globalLogs, setGlobalLogs] = useState<any[]>([]);
  const [selectedUserLogs, setSelectedUserLogs] = useState<any[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(initialSelectedUserId || null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'blocked'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [inspectorTab, setInspectorTab] = useState<'user' | 'global'>('user');
  const [activityFilter, setActivityFilter] = useState<'all' | 'auth' | 'navigation' | 'commerce' | 'admin'>('all');

  // Map state
  const mapboxToken = useMemo(() => getMapboxToken(), []);
  const useMapbox = Boolean(mapboxToken);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const rideMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [basemap, setBasemap] = useState<GeoLibreBasemapId>('street_3d');
  const [mapReady, setMapReady] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showRidesLayer, setShowRidesLayer] = useState(true);
  const [showOfflinePins, setShowOfflinePins] = useState(false);

  // Remote control inputs
  const [alertMessage, setAlertMessage] = useState('');
  const [remoteTargetPath, setRemoteTargetPath] = useState('/orders');
  const [customPathInput, setCustomPathInput] = useState('');
  const [controlBusy, setControlBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Tick every 20s so relative times & stale-online checks stay accurate
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 20000);
    return () => window.clearInterval(id);
  }, []);

  // Sync external initial selection from AdminDashboard Users tab
  useEffect(() => {
    if (initialSelectedUserId) {
      setSelectedUid(initialSelectedUserId);
      setInspectorTab('user');
    }
  }, [initialSelectedUserId]);

  // Subscribe to live user_presence collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'user_presence'),
      (snap) => {
        setPresenceDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('user_presence subscribe error:', err);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to global recent activity logs (single-field orderBy, no composite index needed)
  useEffect(() => {
    const q = query(
      collection(db, 'user_activity_logs'),
      orderBy('createdAtMs', 'desc'),
      limit(150)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setGlobalLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('user_activity_logs global subscribe error:', err);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to selected user's detailed activity logs (single-field where, sorted on client)
  useEffect(() => {
    if (!selectedUid) {
      setSelectedUserLogs([]);
      return;
    }
    const q = query(
      collection(db, 'user_activity_logs'),
      where('uid', '==', selectedUid),
      limit(120)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0)));
        setSelectedUserLogs(rows);
      },
      (err) => {
        console.warn('selected user logs subscribe error:', err);
      }
    );
    return () => unsub();
  }, [selectedUid]);

  // Merge allUsers + user_presence + driverLocations + vendors into unified monitor records
  const mergedUsers = useMemo<UnifiedUserMonitorRow[]>(() => {
    const byUid = new Map<string, UnifiedUserMonitorRow>();

    const userMap = new Map<string, any>();
    allUsers.forEach((u) => {
      const uid = u.id || u.uid;
      if (uid) userMap.set(uid, u);
    });

    const presenceMap = new Map<string, any>();
    presenceDocs.forEach((p) => {
      const uid = p.uid || p.id;
      if (uid) presenceMap.set(uid, p);
    });

    const driverMap = new Map<string, any>();
    driverLocations.forEach((d) => {
      const uid = d.id || d.uid;
      if (uid) driverMap.set(uid, d);
    });

    const vendorByOwner = new Map<string, any>();
    vendors.forEach((v) => {
      if (v.ownerUid) vendorByOwner.set(v.ownerUid, v);
    });

    const allUids = new Set<string>([
      ...userMap.keys(),
      ...presenceMap.keys(),
      ...driverMap.keys(),
    ]);

    allUids.forEach((uid) => {
      const u = userMap.get(uid);
      const p = presenceMap.get(uid);
      const d = driverMap.get(uid);
      const v = vendorByOwner.get(uid);

      const roleRaw = String(p?.role || u?.role || (d ? 'rider' : 'customer')).toLowerCase();
      const role = roleRaw === 'driver' ? 'rider' : roleRaw;

      const driverOnline =
        d?.networkStatus === 'online' || d?.status === 'online' || d?.isOnline === true;
      const pLastSeen = Math.max(
        toMs(p?.lastSeenAtMs || p?.lastSeenAt),
        toMs(u?.lastSeenAtMs || u?.lastSeenAt),
        toMs(d?.updatedAt)
      );
      const presenceOnline =
        p?.isOnline === true &&
        (pLastSeen === 0 || nowTick - pLastSeen <= ONLINE_STALE_WINDOW_MS);

      const isOnline = Boolean(presenceOnline || driverOnline);

      const pLoc = p?.location;
      const dLoc = d?.location || d?.currentPosition;
      const uLoc = u?.location || u?.currentPosition;
      const vLoc = v?.location;

      const chosenLoc =
        pLoc && Number.isFinite(Number(pLoc.lat))
          ? pLoc
          : dLoc && Number.isFinite(Number(dLoc.lat))
          ? dLoc
          : uLoc && Number.isFinite(Number(uLoc.lat))
          ? uLoc
          : vLoc && Number.isFinite(Number(vLoc.lat))
          ? vLoc
          : null;

      const lat = chosenLoc ? Number(chosenLoc.lat) : null;
      const lng = chosenLoc ? Number(chosenLoc.lng) : null;
      const hasGps =
        lat !== null &&
        lng !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !(lat === 0 && lng === 0);

      const displayName =
        p?.displayName ||
        u?.displayName ||
        u?.fullName ||
        u?.name ||
        d?.displayName ||
        d?.name ||
        v?.businessName ||
        u?.email?.split('@')[0] ||
        'Mtumiaji';

      const status = String(u?.status || p?.status || 'active');
      const lastLoginAtMs = Math.max(
        toMs(u?.lastLoginAtMs || u?.lastLoginAt),
        toMs(p?.sessionStartedAtMs)
      );

      byUid.set(uid, {
        uid,
        displayName,
        email: p?.email || u?.email || d?.email || '',
        phone: p?.phone || u?.phoneNumber || u?.phone || d?.phoneNumber || d?.phone || '',
        role,
        status,
        isOnline,
        hasGps,
        lat,
        lng,
        locationSource: p?.locationSource || (dLoc ? 'gps' : vLoc ? 'profile' : 'none'),
        currentPath: p?.currentPath || u?.currentPath || '/',
        currentPageLabel: p?.currentPageLabel || 'App',
        lastActionTitle: p?.lastActionTitle || (isOnline ? 'Yupo online' : 'Offline'),
        lastSeenAtMs: pLastSeen,
        lastLoginAtMs,
        sessionStartedAtMs: toMs(p?.sessionStartedAtMs),
        device: p?.device || '',
        accuracy: p?.accuracy ?? null,
        locationTrail: Array.isArray(p?.locationTrail) ? p.locationTrail : [],
        userDoc: u || null,
        presenceDoc: p || null,
        driverTelemetry: d || null,
      });
    });

    return Array.from(byUid.values()).sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (b.lastSeenAtMs || 0) - (a.lastSeenAtMs || 0);
    });
  }, [allUsers, presenceDocs, driverLocations, vendors, nowTick]);

  // Select the first online user automatically if none selected yet
  useEffect(() => {
    if (!selectedUid && mergedUsers.length > 0) {
      setSelectedUid(mergedUsers[0].uid);
    }
  }, [mergedUsers, selectedUid]);

  const selectedUser = useMemo(
    () => mergedUsers.find((u) => u.uid === selectedUid) || null,
    [mergedUsers, selectedUid]
  );

  // KPIs
  const kpis = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const onlineCount = mergedUsers.filter((u) => u.isOnline).length;
    const onlineCustomers = mergedUsers.filter((u) => u.isOnline && u.role === 'customer').length;
    const onlineDrivers = mergedUsers.filter((u) => u.isOnline && u.role === 'rider').length;
    const onlineVendors = mergedUsers.filter((u) => u.isOnline && u.role === 'vendor').length;
    const gpsLocated = mergedUsers.filter((u) => (u.isOnline || showOfflinePins) && u.hasGps).length;

    const loginsTodayUids = new Set<string>();
    mergedUsers.forEach((u) => {
      if (u.lastLoginAtMs >= todayMs || u.lastSeenAtMs >= todayMs) {
        loginsTodayUids.add(u.uid);
      }
    });
    globalLogs.forEach((l) => {
      if (
        Number(l.createdAtMs || 0) >= todayMs &&
        (String(l.action || '').startsWith('LOGIN') || l.category === 'auth')
      ) {
        if (l.uid) loginsTodayUids.add(l.uid);
      }
    });

    return {
      onlineCount,
      onlineCustomers,
      onlineDrivers,
      onlineVendors,
      gpsLocated,
      loginsToday: loginsTodayUids.size,
      totalActions: globalLogs.length,
    };
  }, [mergedUsers, globalLogs, showOfflinePins]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedUsers.filter((u) => {
      if (statusFilter === 'online' && !u.isOnline) return false;
      if (statusFilter === 'blocked' && u.status !== 'blocked') return false;
      if (roleFilter !== 'all') {
        if (roleFilter === 'wakala_pos') {
          if (u.role !== 'wakala' && u.role !== 'merchant_pos') return false;
        } else if (u.role !== roleFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.currentPageLabel.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [mergedUsers, searchQuery, statusFilter, roleFilter]);

  // Unified chronological timeline for selected user (logs + orders + rides)
  const selectedUserTimeline = useMemo(() => {
    if (!selectedUser) return [];
    const uid = selectedUser.uid;
    const items: Array<{
      id: string;
      timeMs: number;
      category: 'auth' | 'navigation' | 'commerce' | 'admin' | 'profile';
      badge: string;
      title: string;
      details: string;
      path?: string;
    }> = [];

    selectedUserLogs.forEach((l) => {
      const catRaw = String(l.category || 'system');
      const mappedCat: 'auth' | 'navigation' | 'commerce' | 'admin' | 'profile' =
        catRaw === 'auth'
          ? 'auth'
          : catRaw === 'navigation'
          ? 'navigation'
          : catRaw === 'admin'
          ? 'admin'
          : catRaw === 'order' || catRaw === 'ride' || catRaw === 'payment'
          ? 'commerce'
          : 'profile';

      items.push({
        id: `log-${l.id}`,
        timeMs: Number(l.createdAtMs || toMs(l.createdAt)),
        category: mappedCat,
        badge: String(l.action || catRaw).toUpperCase(),
        title: l.title || l.action || 'Tukio',
        details: l.details || l.pageLabel || '',
        path: l.path || '',
      });
    });

    orders
      .filter((o) => o.userId === uid || o.customerId === uid || o.vendorId === uid)
      .forEach((o) => {
        const t = toMs(o.createdAt);
        items.push({
          id: `order-${o.id}`,
          timeMs: t,
          category: 'commerce',
          badge: 'ODA',
          title: `Oda #${String(o.id || '').slice(-6).toUpperCase()} (${o.status || 'pending'})`,
          details: `Kiasi: TZS ${Number(o.totalAmount || 0).toLocaleString()} • Malipo: ${o.paymentStatus || 'pending'}`,
          path: '/orders',
        });
      });

    activeRides
      .filter((r) => r.customerId === uid || r.riderId === uid || r.driverId === uid || r.userId === uid)
      .forEach((r) => {
        const t = toMs(r.createdAt || r.updatedAt);
        items.push({
          id: `ride-${r.id}`,
          timeMs: t,
          category: 'commerce',
          badge: 'SAFARI',
          title: `Safari #${String(r.id || '').slice(-6).toUpperCase()} (${r.status || 'active'})`,
          details: r.destinationAddress
            ? `Kwenda: ${r.destinationAddress}`
            : `Nauli: TZS ${Number(r.fare || r.price || 0).toLocaleString()}`,
          path: '/taxi',
        });
      });

    return items
      .filter((it) => activityFilter === 'all' || it.category === activityFilter)
      .sort((a, b) => (b.timeMs || 0) - (a.timeMs || 0));
  }, [selectedUser, selectedUserLogs, orders, activeRides, activityFilter]);

  // Initialize Mapbox GL Live Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const accessToken = resolveMapboxAccessToken(mapboxToken);
    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      accessToken,
      container: mapContainerRef.current,
      style: (useMapbox ? MAPBOX_STYLE_URLS[basemap] : GEOLIBRE_BASEMAPS[basemap].style) as any,
      center: [39.2083, -6.7924],
      zoom: 11.6,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');
    mapRef.current = map;
    stripMapWatermarks(map);

    map.on('load', () => {
      stripMapWatermarks(map);
      setMapReady(true);
    });
    map.on('style.load', () => {
      stripMapWatermarks(map);
      setMapReady(true);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      rideMarkersRef.current.forEach((m) => m.remove());
      rideMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap when user clicks GeoLibreBasemapPillBar
  const prevBasemapRef = useRef<GeoLibreBasemapId>(basemap);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevBasemapRef.current === basemap) return;
    prevBasemapRef.current = basemap;
    setMapReady(false);
    map.setStyle((useMapbox ? MAPBOX_STYLE_URLS[basemap] : GEOLIBRE_BASEMAPS[basemap].style) as any);
  }, [basemap, useMapbox]);

  // Render Geofence Polygons/Circles + Selected User Trail on Mapbox
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    // 1. Geofence GeoJSON
    const gfFeatures: GeoJSON.Feature[] = [];
    if (showGeofences) {
      Object.entries(pricingRules || {}).forEach(([cityKey, c]: [string, any]) => {
        if (c?.geofenceActive === false) return;
        const poly = normalizeLatLngList(c?.geofencePolygon);
        if ((c?.geofenceType || 'circle') === 'polygon' && poly.length >= 3) {
          const ring = poly.map(([la, ln]) => [ln, la]);
          ring.push(ring[0]);
          gfFeatures.push({
            type: 'Feature',
            properties: { city: cityKey },
            geometry: { type: 'Polygon', coordinates: [ring] },
          });
        } else {
          const cLat = Number(c?.geofenceCenter?.lat ?? c?.lat);
          const cLng = Number(c?.geofenceCenter?.lng ?? c?.lng);
          if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
            gfFeatures.push(buildCircleGeoJsonPolygon(cLat, cLng, Number(c?.geofenceRadius || 15000)));
          }
        }
      });
    }

    const gfCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: gfFeatures,
    };

    try {
      if (!map.getSource('monitor-geofences')) {
        map.addSource('monitor-geofences', { type: 'geojson', data: gfCollection });
        map.addLayer({
          id: 'monitor-geofences-fill',
          type: 'fill',
          source: 'monitor-geofences',
          paint: { 'fill-color': '#F97316', 'fill-opacity': 0.06 },
        });
        map.addLayer({
          id: 'monitor-geofences-line',
          type: 'line',
          source: 'monitor-geofences',
          paint: { 'line-color': '#EA580C', 'line-width': 1.5, 'line-dasharray': [3, 3] },
        });
      } else {
        (map.getSource('monitor-geofences') as mapboxgl.GeoJSONSource).setData(gfCollection);
      }
    } catch {}

    // 2. Selected user movement trail LineString
    const trailCoords =
      selectedUser && selectedUser.locationTrail.length >= 2
        ? selectedUser.locationTrail.map((pt) => [pt.lng, pt.lat])
        : [];
    const trailGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        trailCoords.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: trailCoords },
              },
            ]
          : [],
    };

    try {
      if (!map.getSource('selected-user-trail')) {
        map.addSource('selected-user-trail', { type: 'geojson', data: trailGeoJson });
        map.addLayer({
          id: 'selected-user-trail-line',
          type: 'line',
          source: 'selected-user-trail',
          paint: {
            'line-color': '#2563EB',
            'line-width': 3.5,
            'line-opacity': 0.85,
            'line-dasharray': [2, 1],
          },
        });
      } else {
        (map.getSource('selected-user-trail') as mapboxgl.GeoJSONSource).setData(trailGeoJson);
      }
    } catch {}
  }, [mapReady, showGeofences, pricingRules, selectedUser]);

  // Render Live User Markers + Active Rides Markers cleanly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    rideMarkersRef.current.forEach((m) => m.remove());
    rideMarkersRef.current = [];

    const usersToPlot = mergedUsers.filter((u) => {
      if (!u.hasGps) return false;
      if (!showOfflinePins && !u.isOnline) return false;
      return true;
    });

    usersToPlot.forEach((u) => {
      const meta = ROLE_META[u.role] || ROLE_META.customer;
      const isSelected = u.uid === selectedUid;
      const pinColor = u.isOnline ? meta.color : '#64748B';
      const initial = (u.displayName || 'U').trim().charAt(0).toUpperCase();

      const el = document.createElement('div');
      el.className = 'cursor-pointer select-none';
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          ${
            u.isOnline
              ? `<span style="position:absolute;inset:-4px;border-radius:9999px;background:${pinColor};opacity:0.35;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>`
              : ''
          }
          <div style="
            position:relative;
            width:${isSelected ? '38px' : '32px'};
            height:${isSelected ? '38px' : '32px'};
            border-radius:9999px;
            background:${pinColor};
            color:#fff;
            font-weight:900;
            font-size:12px;
            display:flex;
            align-items:center;
            justify-content:center;
            border:${isSelected ? '3px solid #111827' : '2.5px solid #ffffff'};
            box-shadow:0 6px 16px rgba(0,0,0,0.35);
          ">${escapeHtml(initial)}</div>
          <div style="
            margin-top:3px;
            padding:1px 6px;
            border-radius:9999px;
            background:rgba(17,24,39,0.88);
            color:#ffffff;
            font-size:9px;
            font-weight:800;
            white-space:nowrap;
            max-width:110px;
            overflow:hidden;
            text-overflow:ellipsis;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
          ">${escapeHtml(u.displayName)}</div>
        </div>
      `;

      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:190px;padding:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <strong style="font-size:13px;color:#111827;">${escapeHtml(u.displayName)}</strong>
            <span style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:999px;background:${
              u.isOnline ? '#DCFCE7' : '#F1F5F9'
            };color:${u.isOnline ? '#166534' : '#475569'};">${u.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div style="font-size:11px;color:#4B5563;margin-bottom:4px;">Jukumu: <b>${escapeHtml(
            meta.label
          )}</b></div>
          <div style="font-size:11px;color:#1F2937;background:#F9FAFB;padding:5px 7px;border-radius:8px;border:1px solid #E5E7EB;">
            <div><b>Ukurasa:</b> ${escapeHtml(u.currentPageLabel)}</div>
            <div style="margin-top:2px;"><b>Hatua:</b> ${escapeHtml(u.lastActionTitle)}</div>
          </div>
          ${
            u.device
              ? `<div style="font-size:10px;color:#6B7280;margin-top:4px;">${escapeHtml(u.device)}</div>`
              : ''
          }
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 22, closeButton: true }).setHTML(popupHtml);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([u.lng!, u.lat!])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        setSelectedUid(u.uid);
        setInspectorTab('user');
      });

      if (isSelected) {
        marker.togglePopup();
      }

      markersRef.current.set(u.uid, marker);
    });

    if (showRidesLayer) {
      activeRides.forEach((ride) => {
        const lat = Number(ride?.pickup?.lat);
        const lng = Number(ride?.pickup?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const el = document.createElement('div');
        el.innerHTML = `<div style="width:14px;height:14px;border-radius:4px;background:#2563EB;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);" title="Safari Hai"></div>`;
        const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:11px;font-family:system-ui,sans-serif;"><b>Safari Hai (${escapeHtml(
            String(ride.status || 'active').toUpperCase()
          )})</b><br/>${escapeHtml(ride.destinationAddress || '')}</div>`
        );
        const rm = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);
        rideMarkersRef.current.push(rm);
      });
    }
  }, [mergedUsers, selectedUid, showOfflinePins, showRidesLayer, activeRides]);

  const flyToUser = (u: UnifiedUserMonitorRow) => {
    setSelectedUid(u.uid);
    setInspectorTab('user');
    if (u.hasGps && mapRef.current) {
      mapRef.current.flyTo({ center: [u.lng!, u.lat!], zoom: 14.5, duration: 750 });
    } else {
      toast.info(`${u.displayName} hana GPS ya sasa kwenye ramani bado.`);
    }
  };

  const fitAllOnlineUsers = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts = mergedUsers.filter((u) => u.isOnline && u.hasGps);
    if (pts.length === 0) {
      map.flyTo({ center: [39.2083, -6.7924], zoom: 11.6, duration: 600 });
      return;
    }
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lng!, pts[0].lat!], zoom: 14, duration: 600 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    pts.forEach((p) => bounds.extend([p.lng!, p.lat!]));
    map.fitBounds(bounds, { padding: 70, maxZoom: 14.5, duration: 700 });
  };

  // ==================== ADMIN REMOTE CONTROLS ====================

  const handleForceLogout = async (u: UnifiedUserMonitorRow) => {
    if (u.email === 'aicodtznation@gmail.com') {
      toast.error('Huwezi kumtoa Super Admin.');
      return;
    }
    setControlBusy(true);
    try {
      const cmdId = `logout-${Date.now()}`;
      const nowMs = Date.now();
      await setDoc(
        doc(db, 'user_presence', u.uid),
        {
          uid: u.uid,
          isOnline: false,
          adminCommand: {
            id: cmdId,
            type: 'force_logout',
            message: 'Kikao chako kimefungwa na Admin.',
            issuedAtMs: nowMs,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'users', u.uid),
        { forceLogoutAt: nowMs, isOnline: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await logUserActivity({
        uid: u.uid,
        userName: u.displayName,
        userEmail: u.email,
        role: u.role,
        action: 'ADMIN_FORCE_LOGOUT',
        title: 'Admin amemlazimisha atoke (Force Logout)',
        details: `Mtumiaji ${u.displayName} ametolewa kwenye mfumo`,
        category: 'admin',
      });
      toast.success(`Amri ya kutoka (Force Logout) imetumwa kwa ${u.displayName}.`);
    } catch (err: any) {
      toast.error('Imeshindwa kutuma amri: ' + (err?.message || err));
    } finally {
      setControlBusy(false);
    }
  };

  const handleToggleBlock = async (u: UnifiedUserMonitorRow) => {
    if (u.email === 'aicodtznation@gmail.com') {
      toast.error('Huwezi kumfungia Super Admin.');
      return;
    }
    const nextStatus = u.status === 'blocked' ? 'active' : 'blocked';
    setControlBusy(true);
    try {
      const nowMs = Date.now();
      await setDoc(
        doc(db, 'users', u.uid),
        {
          status: nextStatus,
          ...(nextStatus === 'blocked' ? { forceLogoutAt: nowMs, isOnline: false } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'user_presence', u.uid),
        {
          uid: u.uid,
          status: nextStatus,
          ...(nextStatus === 'blocked'
            ? {
                isOnline: false,
                adminCommand: {
                  id: `block-${nowMs}`,
                  type: 'force_logout',
                  message: 'Akaunti yako imefungiwa na Admin.',
                  issuedAtMs: nowMs,
                },
              }
            : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Keep Meta bot block status synced if it's a Meta WhatsApp/Messenger customer
      const metaSenderId =
        u.userDoc?.metaSenderId || (u.uid.startsWith('meta-whatsapp-') ? u.uid.replace('meta-whatsapp-', '') : '');
      const metaChannel = u.userDoc?.channel || (u.uid.startsWith('meta-') ? u.uid.split('-')[1] : '');
      if (metaSenderId && (metaChannel === 'whatsapp' || metaChannel === 'messenger' || metaChannel === 'instagram')) {
        fetch('/api/meta/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: nextStatus === 'blocked' ? 'block' : 'unblock',
            channel: metaChannel,
            senderId: metaSenderId,
            blocked: nextStatus === 'blocked',
          }),
        }).catch(() => {});
      }

      await logUserActivity({
        uid: u.uid,
        userName: u.displayName,
        userEmail: u.email,
        role: u.role,
        action: nextStatus === 'blocked' ? 'ADMIN_BLOCKED_USER' : 'ADMIN_UNBLOCKED_USER',
        title: nextStatus === 'blocked' ? 'Admin amefungia akaunti' : 'Admin amefungulia akaunti',
        category: 'admin',
      });

      toast.success(
        nextStatus === 'blocked'
          ? `${u.displayName} amefungiwa na kutolewa mara moja.`
          : `${u.displayName} amefunguliwa sasa.`
      );
    } catch (err: any) {
      toast.error('Hitilafu: ' + (err?.message || err));
    } finally {
      setControlBusy(false);
    }
  };

  const handleSendLiveAlert = async (u: UnifiedUserMonitorRow) => {
    const msg = alertMessage.trim();
    if (!msg) {
      toast.error('Andika ujumbe wa kumtumia kwanza.');
      return;
    }
    setControlBusy(true);
    try {
      const cmdId = `alert-${Date.now()}`;
      await setDoc(
        doc(db, 'user_presence', u.uid),
        {
          uid: u.uid,
          adminCommand: {
            id: cmdId,
            type: 'alert',
            title: 'Ujumbe kutoka kwa Admin',
            message: msg,
            issuedAtMs: Date.now(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await addDoc(collection(db, 'notifications'), {
        title: 'Ujumbe kutoka kwa Admin',
        body: msg,
        userId: u.uid,
        type: 'system',
        importance: 'high',
        isRead: false,
        createdAt: serverTimestamp(),
      });
      await logUserActivity({
        uid: u.uid,
        userName: u.displayName,
        userEmail: u.email,
        role: u.role,
        action: 'ADMIN_SENT_ALERT',
        title: 'Admin amemtuma ujumbe wa moja kwa moja',
        details: msg,
        category: 'admin',
      });
      setAlertMessage('');
      toast.success(`Ujumbe umeonekana kwenye skrini ya ${u.displayName}!`);
    } catch (err: any) {
      toast.error('Imeshindwa kutuma ujumbe: ' + (err?.message || err));
    } finally {
      setControlBusy(false);
    }
  };

  const handleRemoteNavigate = async (u: UnifiedUserMonitorRow) => {
    const target = (customPathInput.trim() || remoteTargetPath || '/').trim();
    if (!target.startsWith('/')) {
      toast.error('Njia ya ukurasa lazima ianze na / (mfano: /orders)');
      return;
    }
    setControlBusy(true);
    try {
      await setDoc(
        doc(db, 'user_presence', u.uid),
        {
          uid: u.uid,
          adminCommand: {
            id: `nav-${Date.now()}`,
            type: 'navigate',
            targetPath: target,
            issuedAtMs: Date.now(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await logUserActivity({
        uid: u.uid,
        userName: u.displayName,
        userEmail: u.email,
        role: u.role,
        action: 'ADMIN_REMOTE_NAVIGATE',
        title: `Admin amempeleka kwenye ukurasa: ${target}`,
        category: 'admin',
      });
      setCustomPathInput('');
      toast.success(`${u.displayName} atapelekwa moja kwa moja kwenye ${target}.`);
    } catch (err: any) {
      toast.error('Imeshindwa kuelekeza mtumiaji: ' + (err?.message || err));
    } finally {
      setControlBusy(false);
    }
  };

  const handleChangeRole = async (u: UnifiedUserMonitorRow, nextRole: string) => {
    if (u.email === 'aicodtznation@gmail.com') {
      toast.error('Huwezi kubadili jukumu la Super Admin.');
      return;
    }
    setControlBusy(true);
    try {
      await setDoc(
        doc(db, 'users', u.uid),
        { role: nextRole, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, 'user_presence', u.uid),
        { uid: u.uid, role: nextRole, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await logUserActivity({
        uid: u.uid,
        userName: u.displayName,
        userEmail: u.email,
        role: nextRole,
        action: 'ADMIN_CHANGED_ROLE',
        title: `Admin amebadili jukumu kuwa: ${nextRole}`,
        details: `Kutoka ${u.role} -> ${nextRole}`,
        category: 'admin',
      });
      toast.success(`Jukumu la ${u.displayName} sasa ni ${nextRole}.`);
    } catch (err: any) {
      toast.error('Imeshindwa kubadili jukumu: ' + (err?.message || err));
    } finally {
      setControlBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              Online Sasa
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-3xl font-black mt-1 tabular-nums text-neutral-900 dark:text-white">
            {kpis.onlineCount}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Wateja {kpis.onlineCustomers} • Madereva {kpis.onlineDrivers} • Wauzaji {kpis.onlineVendors}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              Walioingia Leo (Login)
            </span>
            <LogIn className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black mt-1 tabular-nums text-neutral-900 dark:text-white">
            {kpis.loginsToday}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Jumla ya akaunti zote: {mergedUsers.length}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              Kwenye Ramani (GPS)
            </span>
            <MapPin className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-3xl font-black mt-1 tabular-nums text-neutral-900 dark:text-white">
            {kpis.gpsLocated}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Safari hai za sasa: {activeRides.length}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              Matukio Live (App)
            </span>
            <Activity className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-3xl font-black mt-1 tabular-nums text-neutral-900 dark:text-white">
            {kpis.totalActions}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Ufuatiliaji wa kila hatua ndani ya App
          </p>
        </Card>
      </div>

      {/* Main Split Workspace: Left Users Directory + Right Map & Controls */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Directory (4 cols) */}
        <Card className="xl:col-span-4 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col h-[760px] shadow-xl">
          <div className="space-y-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                  Watumiaji & Login Live
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Bonyeza mtumiaji umwone kwenye ramani, umkontro au uone alichofanya
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white font-black text-[10px]">
                {kpis.onlineCount} Online
              </Badge>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta jina, email, simu au ukurasa..."
                className="pl-9 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-xs font-medium"
              />
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap gap-1.5">
              {([
                { id: 'all', label: 'Wote' },
                { id: 'online', label: `Online Sasa (${kpis.onlineCount})` },
                { id: 'blocked', label: 'Waliofungiwa' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Role Filter */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'Majukumu Yote' },
                { id: 'customer', label: 'Wateja' },
                { id: 'rider', label: 'Madereva' },
                { id: 'vendor', label: 'Wauzaji' },
                { id: 'wakala_pos', label: 'Wakala/POS' },
                { id: 'admin', label: 'Admin' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleFilter(r.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                    roleFilter === r.id
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable User Cards */}
          <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 pr-1">
            {filteredUsers.map((u) => {
              const roleMeta = ROLE_META[u.role] || ROLE_META.customer;
              const isSelected = selectedUid === u.uid;
              return (
                <div
                  key={u.uid}
                  onClick={() => {
                    setSelectedUid(u.uid);
                    setInspectorTab('user');
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/20 shadow-sm'
                      : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs"
                          style={{ backgroundColor: roleMeta.color }}
                        >
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${
                            u.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-xs text-neutral-900 dark:text-white truncate">
                            {u.displayName}
                          </h4>
                          {u.status === 'blocked' && (
                            <Badge className="bg-red-600 text-white text-[8px] px-1.5 py-0">
                              BLOCKED
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {u.phone || u.email || u.uid.slice(0, 12)}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-[9px] font-black uppercase border-none shrink-0 ${roleMeta.badgeClass}`}>
                      {roleMeta.label}
                    </Badge>
                  </div>

                  <div className="text-[10px] space-y-1 bg-white/80 dark:bg-neutral-900/60 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500 truncate">
                        Skrini: <b className="text-neutral-800 dark:text-neutral-200">{u.currentPageLabel}</b>
                      </span>
                      <span className={`font-bold shrink-0 ${u.isOnline ? 'text-emerald-600' : 'text-neutral-400'}`}>
                        {u.isOnline ? 'Online' : formatRelativeTime(u.lastSeenAtMs)}
                      </span>
                    </div>
                    <div className="text-neutral-500 truncate">
                      Hatua: <span className="text-neutral-700 dark:text-neutral-300">{u.lastActionTitle}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        flyToUser(u);
                      }}
                      className="flex-1 h-7 rounded-lg text-[10px] font-black uppercase gap-1"
                    >
                      <MapPin className="w-3 h-3 text-orange-600" />
                      Ramani
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUid(u.uid);
                        setInspectorTab('user');
                      }}
                      className="flex-1 h-7 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-orange-600 text-white text-[10px] font-black uppercase gap-1"
                    >
                      <History className="w-3 h-3" />
                      Kontro & Historia
                    </Button>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-neutral-400 text-xs font-bold">
                Hakuna mtumiaji anayelingana na kichujio hiki.
              </div>
            )}
          </div>
        </Card>

        {/* Right Side: Live Map + Inspector/Controls (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Interactive Mapbox Live Map */}
          <Card className="rounded-[2rem] overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-2xl relative h-[430px] bg-neutral-950">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Top Left: Basemap Style Selector */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
              <GeoLibreBasemapPillBar basemap={basemap} onChange={setBasemap} />
              <button
                type="button"
                onClick={fitAllOnlineUsers}
                className="px-3 py-1.5 rounded-xl bg-neutral-950/85 text-white border border-white/15 text-[11px] font-bold flex items-center gap-1.5 hover:bg-neutral-900 cursor-pointer shadow-lg"
                title="Onyesha watumiaji wote walioko online"
              >
                <Compass className="w-3.5 h-3.5 text-orange-400" />
                Onyesha Wote
              </button>
            </div>

            {/* Top Right: Layer Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setShowOfflinePins((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shadow-md cursor-pointer ${
                  showOfflinePins
                    ? 'bg-slate-700 text-white border-white/20'
                    : 'bg-neutral-950/85 text-neutral-300 border-white/15'
                }`}
              >
                {showOfflinePins ? 'Ficha Offline' : 'Onyesha Offline Pia'}
              </button>
              <button
                type="button"
                onClick={() => setShowRidesLayer((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shadow-md cursor-pointer ${
                  showRidesLayer
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-neutral-950/85 text-neutral-300 border-white/15'
                }`}
              >
                Safari Hai
              </button>
              <button
                type="button"
                onClick={() => setShowGeofences((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shadow-md cursor-pointer ${
                  showGeofences
                    ? 'bg-orange-600 text-white border-orange-400'
                    : 'bg-neutral-950/85 text-neutral-300 border-white/15'
                }`}
              >
                Mipaka
              </button>
            </div>

            {/* Bottom Left Legend */}
            <div className="absolute bottom-4 left-4 z-10 px-3 py-2 rounded-xl bg-neutral-950/85 backdrop-blur-md border border-white/15 text-white flex flex-wrap items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Mteja
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Dereva
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Muuzaji
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Wakala / POS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Admin
              </span>
            </div>
          </Card>

          {/* Bottom Inspector Switcher */}
          <Card className="rounded-[2rem] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectorTab('user')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-colors ${
                    inspectorTab === 'user'
                      ? 'bg-orange-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  Kontro & Historia ya Mtumiaji
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('global')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase cursor-pointer transition-colors ${
                    inspectorTab === 'global'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  Matukio Yote Live ({globalLogs.length})
                </button>
              </div>

              {selectedUser && inspectorTab === 'user' && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Smartphone className="w-4 h-4 text-neutral-400" />
                  <span>{selectedUser.device || 'Kifaa hakijatambuliwa bado'}</span>
                </div>
              )}
            </div>

            {inspectorTab === 'user' ? (
              selectedUser ? (
                <div className="space-y-6">
                  {/* Selected User Header & Live Session Info */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shrink-0"
                        style={{
                          backgroundColor:
                            (ROLE_META[selectedUser.role] || ROLE_META.customer).color,
                        }}
                      >
                        {selectedUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-base text-neutral-900 dark:text-white">
                            {selectedUser.displayName}
                          </h3>
                          <Badge
                            className={`text-[10px] font-black uppercase border-none ${
                              selectedUser.isOnline
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-neutral-200 text-neutral-600'
                            }`}
                          >
                            {selectedUser.isOnline ? 'ONLINE SASA' : 'OFFLINE'}
                          </Badge>
                          {selectedUser.status === 'blocked' && (
                            <Badge className="bg-red-600 text-white text-[10px] font-black">
                              AMEFUNGIWA
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {selectedUser.email || 'Hakuna email'} • {selectedUser.phone || 'Hakuna simu'}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                          <span>
                            <b>Skrini ya Sasa:</b> {selectedUser.currentPageLabel} ({selectedUser.currentPath})
                          </span>
                          <span>
                            <b>Login ya Mwisho:</b>{' '}
                            {selectedUser.lastLoginAtMs
                              ? formatRelativeTime(selectedUser.lastLoginAtMs)
                              : 'Haijarekodiwa'}
                          </span>
                          {selectedUser.hasGps && (
                            <span>
                              <b>GPS:</b> {selectedUser.lat?.toFixed(5)}, {selectedUser.lng?.toFixed(5)} (
                              {selectedUser.locationSource === 'gps' ? 'GPS Halisi' : 'Kadirio'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedUser.role === 'rider' && onSelectDriver && selectedUser.userDoc && (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => onSelectDriver(selectedUser.userDoc)}
                        className="rounded-xl text-xs font-bold shrink-0"
                      >
                        Fungua Wasifu wa Dereva
                      </Button>
                    )}
                  </div>

                  {/* Admin Remote Control Deck */}
                  <div className="p-4 rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/15 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" />
                        Udhibiti wa Admin Moja kwa Moja (Remote Control)
                      </h4>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={controlBusy}
                        onClick={() => handleForceLogout(selectedUser)}
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Mtoe Nje Sasa (Force Logout)
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        disabled={controlBusy}
                        onClick={() => handleToggleBlock(selectedUser)}
                        className={`${
                          selectedUser.status === 'blocked'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-red-600 hover:bg-red-700'
                        } text-white rounded-xl text-xs font-bold gap-1.5`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {selectedUser.status === 'blocked' ? 'Fungulia Akaunti' : 'Fungia Akaunti Papo Hapo'}
                      </Button>

                      {selectedUser.hasGps && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => flyToUser(selectedUser)}
                          className="rounded-xl text-xs font-bold gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5 text-orange-600" />
                          Lenga Kwenye Ramani
                        </Button>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[11px] font-bold text-neutral-500">Jukumu:</span>
                        <select
                          value={selectedUser.role}
                          disabled={controlBusy}
                          onChange={(e) => handleChangeRole(selectedUser, e.target.value)}
                          className="h-8 px-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold cursor-pointer"
                        >
                          <option value="customer">Mteja (customer)</option>
                          <option value="rider">Dereva (rider)</option>
                          <option value="vendor">Muuzaji (vendor)</option>
                          <option value="wakala">Wakala (wakala)</option>
                          <option value="merchant_pos">Merchant POS</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    {/* Send Live Alert + Remote Navigate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="flex gap-2">
                        <Input
                          value={alertMessage}
                          onChange={(e) => setAlertMessage(e.target.value)}
                          placeholder="Tuma ujumbe uonekane kwenye skrini yake..."
                          className="h-9 rounded-xl bg-white dark:bg-neutral-900 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={controlBusy}
                          onClick={() => handleSendLiveAlert(selectedUser)}
                          className="h-9 px-3 rounded-xl bg-neutral-900 dark:bg-orange-600 text-white text-xs font-bold gap-1 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Tuma Alert
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <select
                          value={remoteTargetPath}
                          onChange={(e) => {
                            setRemoteTargetPath(e.target.value);
                            setCustomPathInput('');
                          }}
                          className="h-9 px-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold flex-1 min-w-0"
                        >
                          {QUICK_NAV_ROUTES.map((r) => (
                            <option key={r.path} value={r.path}>
                              {r.label} ({r.path})
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          disabled={controlBusy}
                          onClick={() => handleRemoteNavigate(selectedUser)}
                          className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1 shrink-0"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Mpeleke
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Unified In-App Activity Audit */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-orange-600" />
                        Alichofanya Kwenye App ({selectedUserTimeline.length})
                      </h4>

                      <div className="flex flex-wrap gap-1">
                        {([
                          { id: 'all', label: 'Yote' },
                          { id: 'auth', label: 'Login/Logout' },
                          { id: 'navigation', label: 'Kurasa' },
                          { id: 'commerce', label: 'Oda & Safari' },
                          { id: 'admin', label: 'Kontro' },
                        ] as const).map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActivityFilter(cat.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                              activityFilter === cat.id
                                ? 'bg-orange-600 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                      {selectedUserTimeline.map((item) => {
                        const badgeColors: Record<string, string> = {
                          auth: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                          navigation: 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                          commerce: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                          admin: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                          profile: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
                        };
                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                    badgeColors[item.category] || badgeColors.navigation
                                  }`}
                                >
                                  {item.badge}
                                </span>
                                <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                  {item.title}
                                </span>
                              </div>
                              {item.details && (
                                <p className="text-[11px] text-neutral-500 truncate">{item.details}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400 font-medium whitespace-nowrap shrink-0">
                              {item.timeMs ? new Date(item.timeMs).toLocaleString() : 'Sasa hivi'}
                            </span>
                          </div>
                        );
                      })}

                      {selectedUserTimeline.length === 0 && (
                        <div className="text-center py-8 text-xs text-neutral-400 font-medium">
                          Hakuna historia ya matukio iliyorekodiwa kwa kichujio hiki bado.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-neutral-400">
                  Chagua mtumiaji upande wa kushoto ili kumkontro na kuona alichofanya.
                </div>
              )
            ) : (
              /* Global Real-Time Activity Stream */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-500">
                    Mlisho wa moja kwa moja wa watumiaji wote wanaoingia na kutumia mfumo. Bonyeza tukio kumchagua mtumiaji.
                  </p>
                </div>
                <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
                  {globalLogs.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => {
                        if (l.uid) {
                          setSelectedUid(l.uid);
                          setInspectorTab('user');
                        }
                      }}
                      className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 hover:bg-orange-50/50 dark:hover:bg-orange-950/15 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-neutral-900 dark:bg-neutral-700 text-white text-[9px] font-black uppercase border-none">
                            {l.action || 'ACTIVITY'}
                          </Badge>
                          <span className="text-xs font-black text-neutral-900 dark:text-white truncate">
                            {l.userName || l.userEmail || l.uid?.slice(0, 8)}
                          </span>
                          <span className="text-[10px] text-neutral-400 uppercase font-bold">
                            ({l.role || 'customer'})
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 truncate">
                          {l.title} {l.details ? `— ${l.details}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] text-neutral-400 whitespace-nowrap shrink-0">
                        {formatRelativeTime(Number(l.createdAtMs || toMs(l.createdAt)))}
                      </span>
                    </div>
                  ))}
                  {globalLogs.length === 0 && (
                    <div className="text-center py-10 text-xs text-neutral-400">
                      Matukio yatatokea hapa mara tu watumiaji wanapoingia au kutembelea kurasa.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
