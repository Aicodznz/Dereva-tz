import { haversineKm, getTanzaniaNowMinutes } from './geoLibreEngine';

export type TravelMode = 'driving-traffic' | 'cycling' | 'walking';

export type CongestionLevel = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

export type RoadReportCategory = 'jam' | 'roadworks' | 'flood' | 'accident' | 'police';

export interface RoadReportTypeMeta {
  id: RoadReportCategory;
  label: string;
  shortLabel: string;
  emoji: string;
  color: string;
  description: string;
}

export const ROAD_REPORT_TYPES: RoadReportTypeMeta[] = [
  {
    id: 'jam',
    label: 'Foleni Nzito',
    shortLabel: 'Foleni',
    emoji: '🚗',
    color: '#EF4444',
    description: 'Msongamano mkubwa wa magari',
  },
  {
    id: 'flood',
    label: 'Maji / Mafuriko',
    shortLabel: 'Mafuriko',
    emoji: '🌊',
    color: '#0EA5E9',
    description: 'Maji yamejaa barabarani',
  },
  {
    id: 'roadworks',
    label: 'Ujenzi wa Barabara',
    shortLabel: 'Ujenzi',
    emoji: '🚧',
    color: '#F59E0B',
    description: 'Matengenezo au njia finyu',
  },
  {
    id: 'accident',
    label: 'Ajali / Kizuizi',
    shortLabel: 'Ajali',
    emoji: '⚠️',
    color: '#DC2626',
    description: 'Ajali au gari limeharibika njiani',
  },
  {
    id: 'police',
    label: 'Ukaguzi wa Trafiki',
    shortLabel: 'Trafiki',
    emoji: '👮',
    color: '#6366F1',
    description: 'Kituo au ukaguzi wa askari',
  },
];

export interface RoadReportItem {
  id: string;
  category: RoadReportCategory;
  title: string;
  description: string;
  lat: number;
  lng: number;
  confirmations: number;
  createdAtMs: number;
}

export interface NavigationStep {
  instructionSw: string;
  roadName: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  modifier?: string;
  location: [number, number]; // [lng, lat]
}

export interface PapoMapRouteOption {
  id: string;
  summary: string;
  distanceMeters: number;
  durationSeconds: number;
  trafficStatus: 'clear' | 'moderate' | 'heavy';
  trafficLabel: string;
  geometry: GeoJSON.LineString;
  congestionGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  steps: NavigationStep[];
  source: 'mapbox' | 'osrm' | 'direct';
}

export interface SavedPlaceItem {
  id: string;
  slot: 'home' | 'work' | 'custom';
  label: string;
  address: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

export type NearbyEssentialKind = 'fuel' | 'hospital' | 'atm';

export interface NearbyEssentialResult {
  id: string;
  kind: NearbyEssentialKind;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  low: '#10B981',
  moderate: '#F59E0B',
  heavy: '#EF4444',
  severe: '#991B1B',
  unknown: '#3B82F6',
};

export function translateManeuverToSwahili(
  maneuverType: string = '',
  modifier: string = '',
  roadName: string = '',
  exitNum?: number
): string {
  const t = maneuverType.toLowerCase();
  const m = modifier.toLowerCase();
  const roadSuffix = roadName && roadName.trim() ? ` kuingia ${roadName.trim()}` : '';

  if (t === 'arrive') {
    return 'Umefika unakokwenda!';
  }
  if (t === 'depart') {
    return roadName ? `Anza safari kupitia ${roadName}` : 'Anza safari yako';
  }
  if (t === 'roundabout' || t === 'rotary' || t === 'exit roundabout' || t === 'exit rotary') {
    if (exitNum && Number.isFinite(exitNum)) {
      return `Kwenye mzunguko, toka njia ya ${exitNum}${roadSuffix}`;
    }
    return `Ingia kwenye mzunguko${roadSuffix}`;
  }
  if (t === 'merge') {
    return `Ungana na barabara${roadSuffix}`;
  }
  if (t === 'fork' || t === 'off ramp' || t === 'on ramp') {
    if (m.includes('left')) return `Shika upande wa kushoto${roadSuffix}`;
    if (m.includes('right')) return `Shika upande wa kulia${roadSuffix}`;
    return `Endelea moja kwa moja${roadSuffix}`;
  }

  if (m === 'uturn') return `Geuka nyuma (U-Turn)${roadSuffix}`;
  if (m === 'sharp right') return `Geuka kulia sana${roadSuffix}`;
  if (m === 'right') return `Geuka kulia${roadSuffix}`;
  if (m === 'slight right') return `Pinda kulia kidogo${roadSuffix}`;
  if (m === 'sharp left') return `Geuka kushoto sana${roadSuffix}`;
  if (m === 'left') return `Geuka kushoto${roadSuffix}`;
  if (m === 'slight left') return `Pinda kushoto kidogo${roadSuffix}`;
  if (m === 'straight' || t === 'continue' || t === 'new name') {
    return roadName ? `Endelea moja kwa moja kupitia ${roadName}` : 'Endelea moja kwa moja';
  }

  return roadName ? `Fuata barabara ya ${roadName}` : 'Endelea na safari';
}

export function formatDistanceSw(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters / 10) * 10 || Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDurationSw(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '1 dk';
  const totalMins = Math.max(1, Math.round(seconds / 60));
  if (totalMins < 60) return `${totalMins} dk`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs} saa ${mins} dk` : `${hrs} saa`;
}

export function formatEtaClock(durationSeconds: number): string {
  const nowMins = getTanzaniaNowMinutes();
  const arrivalMins = (nowMins + Math.max(1, Math.round(durationSeconds / 60))) % 1440;
  const hh = Math.floor(arrivalMins / 60);
  const mm = arrivalMins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function speakSwahiliInstruction(text: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const swVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('sw')) ||
      voices.find((v) => v.lang.toLowerCase().includes('tz') || v.lang.toLowerCase().includes('ke'));
    if (swVoice) {
      utter.voice = swVoice;
      utter.lang = swVoice.lang;
    } else {
      utter.lang = 'sw-TZ';
    }
    utter.rate = 0.96;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors on unsupported browsers
  }
}

function buildCongestionGeoJson(
  coordinates: [number, number][],
  congestionArray?: string[]
): {
  geojson: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  trafficStatus: 'clear' | 'moderate' | 'heavy';
  trafficLabel: string;
} {
  if (!congestionArray || congestionArray.length === 0 || coordinates.length < 2) {
    return {
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { congestion: 'low', color: '#2563EB' },
            geometry: { type: 'LineString', coordinates },
          },
        ],
      },
      trafficStatus: 'clear',
      trafficLabel: 'Barabara Shwari',
    };
  }

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  let currentLevel: CongestionLevel = normalizeCongestion(congestionArray[0]);
  let currentCoords: [number, number][] = [coordinates[0]];

  let heavyCount = 0;
  let moderateCount = 0;
  const totalSegs = Math.min(coordinates.length - 1, congestionArray.length);

  for (let i = 0; i < totalSegs; i++) {
    const level = normalizeCongestion(congestionArray[i]);
    if (level === 'heavy' || level === 'severe') heavyCount += 1;
    else if (level === 'moderate') moderateCount += 1;

    if (level !== currentLevel && currentCoords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { congestion: currentLevel, color: CONGESTION_COLORS[currentLevel] },
        geometry: { type: 'LineString', coordinates: currentCoords },
      });
      currentLevel = level;
      currentCoords = [coordinates[i]];
    }
    currentCoords.push(coordinates[i + 1]);
  }

  if (currentCoords.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { congestion: currentLevel, color: CONGESTION_COLORS[currentLevel] },
      geometry: { type: 'LineString', coordinates: currentCoords },
    });
  }

  const heavyRatio = totalSegs > 0 ? heavyCount / totalSegs : 0;
  const modRatio = totalSegs > 0 ? moderateCount / totalSegs : 0;

  let trafficStatus: 'clear' | 'moderate' | 'heavy' = 'clear';
  let trafficLabel = 'Barabara Shwari';
  if (heavyRatio >= 0.16) {
    trafficStatus = 'heavy';
    trafficLabel = 'Foleni Nzito';
  } else if (heavyRatio > 0.04 || modRatio >= 0.25) {
    trafficStatus = 'moderate';
    trafficLabel = 'Msongamano Kiasi';
  }

  return {
    geojson: { type: 'FeatureCollection', features },
    trafficStatus,
    trafficLabel,
  };
}

function normalizeCongestion(raw?: string): CongestionLevel {
  if (raw === 'low' || raw === 'moderate' || raw === 'heavy' || raw === 'severe') return raw;
  return 'low';
}

export async function fetchPapoMapRoutes(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: TravelMode;
  token?: string;
}): Promise<PapoMapRouteOption[]> {
  const { origin, destination, mode, token } = params;

  if (token) {
    try {
      const profile = mode === 'cycling' ? 'cycling' : mode === 'walking' ? 'walking' : 'driving-traffic';
      const annotations = profile === 'driving-traffic' ? 'congestion,distance,duration' : 'distance,duration';
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=true&geometries=geojson&overview=full&steps=true&annotations=${annotations}&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
          return data.routes.slice(0, 3).map((r: any, idx: number) => {
            const coords: [number, number][] = Array.isArray(r.geometry?.coordinates)
              ? r.geometry.coordinates
              : [
                  [origin.lng, origin.lat],
                  [destination.lng, destination.lat],
                ];
            const leg = r.legs?.[0];
            const congestionArr: string[] | undefined = leg?.annotation?.congestion;
            const cong =
              profile === 'driving-traffic'
                ? buildCongestionGeoJson(coords, congestionArr)
                : {
                    geojson: {
                      type: 'FeatureCollection' as const,
                      features: [
                        {
                          type: 'Feature' as const,
                          properties: { congestion: 'low', color: '#2563EB' },
                          geometry: { type: 'LineString' as const, coordinates: coords },
                        },
                      ],
                    },
                    trafficStatus: 'clear' as const,
                    trafficLabel: profile === 'walking' ? 'Njia ya Mguu' : 'Njia ya Boda / Baiskeli',
                  };

            const steps: NavigationStep[] = Array.isArray(leg?.steps)
              ? leg.steps.map((s: any) => ({
                  instructionSw: translateManeuverToSwahili(
                    s.maneuver?.type,
                    s.maneuver?.modifier,
                    s.name,
                    s.maneuver?.exit
                  ),
                  roadName: s.name || '',
                  distanceMeters: Number(s.distance || 0),
                  durationSeconds: Number(s.duration || 0),
                  maneuverType: s.maneuver?.type || 'turn',
                  modifier: s.maneuver?.modifier,
                  location: Array.isArray(s.maneuver?.location)
                    ? [Number(s.maneuver.location[0]), Number(s.maneuver.location[1])]
                    : [origin.lng, origin.lat],
                }))
              : [];

            return {
              id: `mbx-route-${idx}`,
              summary: leg?.summary || (idx === 0 ? 'Njia Kuu' : `Njia Mbadala ${idx}`),
              distanceMeters: Number(r.distance || 0),
              durationSeconds: Number(r.duration || 0),
              trafficStatus: cong.trafficStatus,
              trafficLabel: cong.trafficLabel,
              geometry: { type: 'LineString', coordinates: coords },
              congestionGeoJson: cong.geojson,
              steps,
              source: 'mapbox' as const,
            };
          });
        }
      }
    } catch {
      // Fall through to OSRM / server proxy fallback
    }
  }

  // Fallback 1: Server geo route proxy (/api/geo/route)
  try {
    const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
    const res = await fetch(
      `/api/geo/route?start=${origin.lat},${origin.lng}&end=${destination.lat},${destination.lng}&profile=${profile}`
    );
    if (res.ok) {
      const data = await res.json();
      const first = data?.routes?.[0];
      if (first?.geometry?.coordinates?.length >= 2) {
        const coords = first.geometry.coordinates as [number, number][];
        const distM = Number(first.distance || haversineKm(origin.lat, origin.lng, destination.lat, destination.lng) * 1000);
        const speedMps = mode === 'walking' ? 1.3 : mode === 'cycling' ? 7.5 : 9.5;
        const durS = Number(first.duration || distM / speedMps);
        return [
          {
            id: 'osrm-route-0',
            summary: 'Njia Iliyopendekezwa',
            distanceMeters: distM,
            durationSeconds: durS,
            trafficStatus: 'clear',
            trafficLabel: 'Kadirio la Njia',
            geometry: { type: 'LineString', coordinates: coords },
            congestionGeoJson: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { congestion: 'low', color: '#2563EB' },
                  geometry: { type: 'LineString', coordinates: coords },
                },
              ],
            },
            steps: [
              {
                instructionSw: 'Fuata mstari wa bluu kuelekea unakokwenda',
                roadName: 'Njia Kuu',
                distanceMeters: distM,
                durationSeconds: durS,
                maneuverType: 'depart',
                location: [origin.lng, origin.lat],
              },
              {
                instructionSw: 'Umefika unakokwenda!',
                roadName: '',
                distanceMeters: 0,
                durationSeconds: 0,
                maneuverType: 'arrive',
                location: [destination.lng, destination.lat],
              },
            ],
            source: 'osrm',
          },
        ];
      }
    }
  } catch {
    // Fall through to direct fallback
  }

  // Fallback 2: Direct Haversine route
  const distKm = Math.max(0.1, haversineKm(origin.lat, origin.lng, destination.lat, destination.lng));
  const distM = distKm * 1000;
  const speedKmh = mode === 'walking' ? 4.8 : mode === 'cycling' ? 24 : 32;
  const durS = Math.round((distKm / speedKmh) * 3600);
  const directCoords: [number, number][] = [
    [origin.lng, origin.lat],
    [destination.lng, destination.lat],
  ];
  return [
    {
      id: 'direct-route-0',
      summary: 'Mstari wa Moja kwa Moja',
      distanceMeters: distM,
      durationSeconds: durS,
      trafficStatus: 'clear',
      trafficLabel: 'Kadirio la Umbali',
      geometry: { type: 'LineString', coordinates: directCoords },
      congestionGeoJson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { congestion: 'low', color: '#2563EB' },
            geometry: { type: 'LineString', coordinates: directCoords },
          },
        ],
      },
      steps: [
        {
          instructionSw: 'Elekea upande wa lengo lililowekwa alama',
          roadName: '',
          distanceMeters: distM,
          durationSeconds: durS,
          maneuverType: 'depart',
          location: [origin.lng, origin.lat],
        },
        {
          instructionSw: 'Umefika unakokwenda!',
          roadName: '',
          distanceMeters: 0,
          durationSeconds: 0,
          maneuverType: 'arrive',
          location: [destination.lng, destination.lat],
        },
      ],
      source: 'direct',
    },
  ];
}

export function computeMeasureTelemetry(points: { lat: number; lng: number }[]): {
  totalKm: number;
  bodaEstimateTzs: number;
  bajajEstimateTzs: number;
  taxiEstimateTzs: number;
} {
  if (points.length < 2) {
    return { totalKm: 0, bodaEstimateTzs: 0, bajajEstimateTzs: 0, taxiEstimateTzs: 0 };
  }
  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalKm += haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  const roundTo500 = (n: number) => Math.max(1000, Math.round(n / 500) * 500);
  return {
    totalKm,
    bodaEstimateTzs: roundTo500(1000 + totalKm * 750),
    bajajEstimateTzs: roundTo500(1500 + totalKm * 1050),
    taxiEstimateTzs: roundTo500(3000 + totalKm * 1650),
  };
}

const SAVED_PLACES_KEY = 'papohapo_papomap_saved_places_v1';

export function getSavedPlaces(): SavedPlaceItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertSavedPlace(item: SavedPlaceItem): SavedPlaceItem[] {
  const current = getSavedPlaces();
  const filtered =
    item.slot === 'home' || item.slot === 'work'
      ? current.filter((p) => p.slot !== item.slot)
      : current.filter((p) => p.id !== item.id);
  const next = [item, ...filtered].slice(0, 10);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
    } catch {}
  }
  return next;
}

export function removeSavedPlace(id: string): SavedPlaceItem[] {
  const next = getSavedPlaces().filter((p) => p.id !== id);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
    } catch {}
  }
  return next;
}

export async function fetchNearbyEssentials(params: {
  lat: number;
  lng: number;
  kind: NearbyEssentialKind;
  token?: string;
}): Promise<NearbyEssentialResult[]> {
  const { lat, lng, kind, token } = params;
  const searchTerms: Record<NearbyEssentialKind, string[]> = {
    fuel: ['fuel station', 'petrol station'],
    hospital: ['hospital', 'clinic pharmacy'],
    atm: ['atm bank', 'bank branch'],
  };

  if (token) {
    try {
      const q = searchTerms[kind][0];
      const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&proximity=${lng},${lat}&limit=6&country=tz&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.features) && data.features.length > 0) {
          return data.features
            .map((f: any, idx: number) => {
              const fLng = Number(f.geometry?.coordinates?.[0]);
              const fLat = Number(f.geometry?.coordinates?.[1]);
              if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) return null;
              return {
                id: f.id || `${kind}-${idx}`,
                kind,
                name: f.properties?.name || f.properties?.name_preferred || 'Kituo',
                address: f.properties?.full_address || f.properties?.place_formatted || 'Tanzania',
                lat: fLat,
                lng: fLng,
                distanceKm: haversineKm(lat, lng, fLat, fLng),
              };
            })
            .filter(Boolean)
            .sort((a: NearbyEssentialResult, b: NearbyEssentialResult) => a.distanceKm - b.distanceKm);
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback to server geocoding endpoint
  try {
    const labelMap: Record<NearbyEssentialKind, string> = {
      fuel: 'petrol station Dar es Salaam',
      hospital: 'hospital clinic Tanzania',
      atm: 'bank atm Tanzania',
    };
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(labelMap[kind])}&limit=6`);
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr)) {
        return arr
          .map((item: any, idx: number) => {
            const fLat = Number(item.lat);
            const fLng = Number(item.lon ?? item.lng);
            if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) return null;
            const name = String(item.display_name || item.name || 'Kituo').split(',')[0];
            return {
              id: `geo-${kind}-${idx}`,
              kind,
              name,
              address: String(item.display_name || 'Tanzania'),
              lat: fLat,
              lng: fLng,
              distanceKm: haversineKm(lat, lng, fLat, fLng),
            };
          })
          .filter(Boolean)
          .sort((a: NearbyEssentialResult, b: NearbyEssentialResult) => a.distanceKm - b.distanceKm);
      }
    }
  } catch {}

  return [];
}
