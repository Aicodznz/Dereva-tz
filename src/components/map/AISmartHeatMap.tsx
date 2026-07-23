import React, { useMemo } from 'react';
import { Polygon, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

export type ServiceCategory = 'all' | 'taxi' | 'food' | 'parcel' | 'mart';

export type DemandTrigger = 'rain' | 'rush_hour' | 'event' | 'airport' | 'terminal' | 'mall';

export interface HeatZone {
  id: string;
  name: string;
  cityName: string;
  center: [number, number];
  radius: number; // radius in meters
  category: 'taxi' | 'food' | 'parcel' | 'mart';
  surgeRange: string; // e.g. "1.4~2.1x"
  surgeVal: number; // numeric value for multiplier calculations
  orderCount: number; // estimated active waiting orders / passengers
  level: 'moderate' | 'high' | 'extreme'; // surge level
  triggers: DemandTrigger[]; // e.g. ['rain', 'rush_hour', 'mall']
  reason: string; // e.g. "Kariakoo Market - Oda za Sokoni & Mizigo Mchana"
  descriptionSw: string; // Swahili hint for drivers/riders
}

// Generate authentic 6-sided hexagon coordinates around a lat/lng center
export function generateHexagonVertices(lat: number, lng: number, radiusMeters: number): [number, number][] {
  const vertices: [number, number][] = [];
  const latDelta = (radiusMeters / 6378137) * (180 / Math.PI);
  const lngDelta = (radiusMeters / (6378137 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const vLat = lat + latDelta * Math.sin(angle);
    const vLng = lng + lngDelta * Math.cos(angle);
    vertices.push([vLat, vLng]);
  }
  return vertices;
}

// Generate overlapping hexagons around a hotspot center
export function generateHeatClusterHexagons(centerLat: number, centerLng: number, baseRadius: number) {
  const offsets = [
    { dLat: 0, dLng: 0, factor: 1.0 },
    { dLat: 0.003, dLng: 0.002, factor: 0.85 },
    { dLat: -0.0025, dLng: 0.0035, factor: 0.9 },
    { dLat: -0.003, dLng: -0.002, factor: 0.8 },
    { dLat: 0.002, dLng: -0.003, factor: 0.85 },
  ];

  return offsets.map((off, idx) => ({
    id: `hex-${idx}`,
    center: [centerLat + off.dLat, centerLng + off.dLng] as [number, number],
    vertices: generateHexagonVertices(centerLat + off.dLat, centerLng + off.dLng, baseRadius * off.factor),
  }));
}

// Trigger emoji helpers
export const TRIGGER_ICONS: Record<DemandTrigger, { emoji: string; label: string }> = {
  rain: { emoji: '🌧️', label: 'Mvua Inanyesha' },
  rush_hour: { emoji: '🕒', label: 'Saa za Kilele' },
  event: { emoji: '🎉', label: 'Matukio / Tamasha' },
  airport: { emoji: '✈️', label: 'Uwanja wa Ndege' },
  terminal: { emoji: '🚌', label: 'Kituo cha Mabasi' },
  mall: { emoji: '🛍️', label: 'Masoko & Malls' },
};

export const CATEGORY_META: Record<Exclude<ServiceCategory, 'all'>, { emoji: string; label: string; bg: string }> = {
  taxi: { emoji: '🚖', label: 'Taxi & Boda', bg: 'bg-amber-500' },
  food: { emoji: '🍔', label: 'Oda za Chakula', bg: 'bg-emerald-500' },
  parcel: { emoji: '📦', label: 'Oda za Mizigo', bg: 'bg-blue-500' },
  mart: { emoji: '🛒', label: 'Oda za Sokoni', bg: 'bg-purple-500' },
};

// Default AI Smart Heatmap hotspots per City
export const CITY_HEAT_ZONES: Record<string, HeatZone[]> = {
  "Dar es Salaam": [
    {
      id: "dar-kariakoo-taxi",
      name: "Kariakoo Market & Soko Kuu",
      cityName: "Dar es Salaam",
      center: [-6.8182, 39.2748],
      radius: 650,
      category: "mart",
      surgeRange: "1,5~2,2x",
      surgeVal: 1.8,
      orderCount: 168,
      level: "extreme",
      triggers: ["mall", "rush_hour"],
      reason: "Uhitaji Mkubwa wa Sokoni & Mizigo Mchana",
      descriptionSw: "Wateja 168+ wanagombania bidhaa na usafiri wa kubeba mizigo Kariakoo.",
    },
    {
      id: "dar-kariakoo-food",
      name: "Msimbazi Street Restaurants",
      cityName: "Dar es Salaam",
      center: [-6.8150, 39.2720],
      radius: 480,
      category: "food",
      surgeRange: "1,3~1,8x",
      surgeVal: 1.5,
      orderCount: 94,
      level: "high",
      triggers: ["rush_hour", "mall"],
      reason: "Oda za Chakula za Tangawizi & Chief's Grill",
      descriptionSw: "Oda 94+ za chakula zinasubiri ma-rider Msimbazi na Fire.",
    },
    {
      id: "dar-posta-taxi",
      name: "Posta Mpya & Samora Avenue",
      cityName: "Dar es Salaam",
      center: [-6.8162, 39.2888],
      radius: 550,
      category: "taxi",
      surgeRange: "1,3~1,9x",
      surgeVal: 1.6,
      orderCount: 112,
      level: "high",
      triggers: ["rush_hour", "rain"],
      reason: "Wafanyakazi wa Ofisi Wanaondoka Mjini",
      descriptionSw: "Mvua & Saa za kutoka kazini. Wateja wengi wanatafuta Taxi na Bajaj.",
    },
    {
      id: "dar-mlimani-mall",
      name: "Mlimani City Mall & Cinema",
      cityName: "Dar es Salaam",
      center: [-6.7725, 39.2220],
      radius: 600,
      category: "taxi",
      surgeRange: "1,2~1,7x",
      surgeVal: 1.45,
      orderCount: 88,
      level: "high",
      triggers: ["mall", "event"],
      reason: "Shoppers, Cinemas & Onyesho la Mlimani",
      descriptionSw: "Wanafunzi wa UDSM na wanaotoka Shopping Mall wanahitaji usafiri.",
    },
    {
      id: "dar-jnia-airport",
      name: "Julius Nyerere Int. Airport (JNIA T3)",
      cityName: "Dar es Salaam",
      center: [-6.8781, 39.2026],
      radius: 700,
      category: "taxi",
      surgeRange: "1,6~2,5x",
      surgeVal: 2.0,
      orderCount: 145,
      level: "extreme",
      triggers: ["airport", "rush_hour"],
      reason: "Ndege 3 za Kimataifa Zimetua Hivi Punde",
      descriptionSw: "Abiria wa ndege za Emirates & Ethiopian wanahitaji Taxi kwenda Masaki & Posta.",
    },
    {
      id: "dar-magufuli-bus",
      name: "Magufuli Bus Terminal (Mbezi)",
      cityName: "Dar es Salaam",
      center: [-6.7880, 39.1280],
      radius: 650,
      category: "parcel",
      surgeRange: "1,4~2,0x",
      surgeVal: 1.7,
      orderCount: 130,
      level: "extreme",
      triggers: ["terminal", "rush_hour"],
      reason: "Mabasi ya Mikoani Yameingia & Mizigo ya Parsele",
      descriptionSw: "Mizigo zaidi ya 130 inahitaji kutoroshwa kwenda Posta, Kariakoo na Tegeta.",
    },
    {
      id: "dar-masaki-food",
      name: "Masaki & Slipway Dining Hub",
      cityName: "Dar es Salaam",
      center: [-6.7485, 39.2883],
      radius: 520,
      category: "food",
      surgeRange: "1,2~1,7x",
      surgeVal: 1.4,
      orderCount: 78,
      level: "moderate",
      triggers: ["rain", "event"],
      reason: "Oda za Chakula cha Jioni Masaki & Oysterbay",
      descriptionSw: "Oda za migahawa ya Slipway & Cape Town Fish Market ziko juu.",
    },
    {
      id: "dar-ubungo-mart",
      name: "Shoppers Plaza & Ubungo Complex",
      cityName: "Dar es Salaam",
      center: [-6.7938, 39.2083],
      radius: 500,
      category: "mart",
      surgeRange: "1,2~1,6x",
      surgeVal: 1.35,
      orderCount: 62,
      level: "moderate",
      triggers: ["mall"],
      reason: "Oda za Supermarket & Vyakula vya Nyumbani",
      descriptionSw: "Oda za Sokoni za jioni kutoka Shoppers Plaza.",
    }
  ],
  "Arusha": [
    {
      id: "arusha-clocktower",
      name: "Arusha Clock Tower & Heritage",
      cityName: "Arusha",
      center: [-3.3723, 36.6942],
      radius: 550,
      category: "taxi",
      surgeRange: "1,3~1,9x",
      surgeVal: 1.5,
      orderCount: 95,
      level: "high",
      triggers: ["rush_hour", "event"],
      reason: "Watalii & Mikutano ya AICC",
      descriptionSw: "Usafiri wa watalii kutoka AICC kwenda hoteli za Njiro na Sekei.",
    },
    {
      id: "arusha-soko-kuu",
      name: "Soko Kuu la Arusha & Kilombero",
      cityName: "Arusha",
      center: [-3.3680, 36.6880],
      radius: 500,
      category: "mart",
      surgeRange: "1,2~1,7x",
      surgeVal: 1.4,
      orderCount: 74,
      level: "high",
      triggers: ["mall", "terminal"],
      reason: "Oda za Sokoni Mchana",
      descriptionSw: "Manunuzi ya Sokoni na usafirishaji wa nafaka Mianzini.",
    }
  ],
  "Mwanza": [
    {
      id: "mwanza-rockcity",
      name: "Rock City Mall & Capri Point",
      cityName: "Mwanza",
      center: [-2.5186, 32.9025],
      radius: 600,
      category: "food",
      surgeRange: "1,3~1,9x",
      surgeVal: 1.55,
      orderCount: 108,
      level: "high",
      triggers: ["mall", "rain"],
      reason: "Oda za Samaki & Migahawa ya Ziwa",
      descriptionSw: "Delivery za Tilapia na oda za chakula katika mji wa Mwanza.",
    }
  ],
  "Dodoma": [
    {
      id: "dodoma-bunge",
      name: "Bunge, Chinangali & Shoppers",
      cityName: "Dodoma",
      center: [-6.1731, 35.7480],
      radius: 550,
      category: "taxi",
      surgeRange: "1,2~1,8x",
      surgeVal: 1.45,
      orderCount: 82,
      level: "high",
      triggers: ["rush_hour", "event"],
      reason: "Saa za Kazi za Wizara & Bunge",
      descriptionSw: "Wafanyakazi wa Serikali wanahitaji usafiri kwenda Area D na Iyumbu.",
    }
  ],
  "Zanzibar": [
    {
      id: "znz-stonetown",
      name: "Stone Town & Forodhani Market",
      cityName: "Zanzibar",
      center: [-6.1620, 39.1882],
      radius: 500,
      category: "food",
      surgeRange: "1,4~2,2x",
      surgeVal: 1.75,
      orderCount: 135,
      level: "extreme",
      triggers: ["event", "mall"],
      reason: "Forodhani Night Food Market & Watalii",
      descriptionSw: "Oda kibao za sea food & usafiri wa watalii Stone Town.",
    }
  ]
};

// Create custom Leaflet DivIcons matching Uber/DiDi style badges
export function createSurgeBadgeIcon(
  surgeRange: string,
  level: 'moderate' | 'high' | 'extreme',
  category: 'taxi' | 'food' | 'parcel' | 'mart',
  triggers: DemandTrigger[]
) {
  const isExtreme = level === 'extreme';
  const isHigh = level === 'high';

  const badgeBg = isExtreme ? 'from-rose-600 to-red-500' : isHigh ? 'from-amber-600 to-orange-500' : 'from-yellow-500 to-amber-500';

  const catMeta = CATEGORY_META[category] || CATEGORY_META.taxi;
  const triggerEmojis = triggers.map(t => TRIGGER_ICONS[t]?.emoji).filter(Boolean).slice(0, 2).join('');

  return L.divIcon({
    className: 'custom-surge-badge',
    html: `
      <div class="inline-flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-700/80 px-2.5 py-1 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.28)] select-none transition-transform hover:scale-110">
        <span class="text-[12px] leading-none">${catMeta.emoji}</span>
        ${triggerEmojis ? `<span class="text-[10px] leading-none opacity-90">${triggerEmojis}</span>` : ''}
        <span class="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gradient-to-r ${badgeBg} text-white font-black text-[8px]">
          ⚡
        </span>
        <span class="text-[11px] font-black tracking-tight text-neutral-900 dark:text-white font-mono leading-none">
          ${surgeRange}
        </span>
      </div>
    `,
    iconSize: [110, 30],
    iconAnchor: [55, 15],
  });
}

export function createOrderVolumeBadgeIcon(
  orderCount: number,
  category: 'taxi' | 'food' | 'parcel' | 'mart'
) {
  const catMeta = CATEGORY_META[category] || CATEGORY_META.taxi;

  return L.divIcon({
    className: 'custom-order-volume-badge',
    html: `
      <div class="inline-flex items-center gap-1 bg-neutral-900/90 dark:bg-neutral-950/90 text-white border border-neutral-700/80 px-2.5 py-1 rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.3)] select-none transition-transform hover:scale-110">
        <span class="text-[10px] font-extrabold text-amber-400 font-mono leading-none">
          ${orderCount}+
        </span>
        <span class="text-[9px] font-bold text-neutral-300 font-sans leading-none uppercase tracking-wider">
          Oda
        </span>
      </div>
    `,
    iconSize: [64, 26],
    iconAnchor: [32, 13],
  });
}

interface AISmartHeatMapProps {
  cityName?: string;
  userPos?: [number, number];
  visible?: boolean;
  activeCategory?: ServiceCategory;
  onZoneClick?: (zone: HeatZone) => void;
}

export const AISmartHeatMap: React.FC<AISmartHeatMapProps> = ({
  cityName = "Dar es Salaam",
  userPos,
  visible = true,
  activeCategory = "all",
  onZoneClick,
}) => {
  if (!visible) return null;

  // Filter heat zones by city and selected category
  const activeZones = useMemo(() => {
    let zones = CITY_HEAT_ZONES[cityName] || CITY_HEAT_ZONES["Dar es Salaam"];

    // Dynamic local hotspot generation if user is outside known cities
    if (userPos && userPos[0] !== 0 && userPos[1] !== 0) {
      const hasNearby = zones.some(z => {
        const dLat = Math.abs(z.center[0] - userPos[0]);
        const dLng = Math.abs(z.center[1] - userPos[1]);
        return dLat < 0.15 && dLng < 0.15;
      });

      if (!hasNearby) {
        zones = [
          {
            id: `local-surge-1`,
            name: "Hotspot ya Sasa (Taxi Demand)",
            cityName: cityName,
            center: [userPos[0] + 0.004, userPos[1] + 0.005],
            radius: 550,
            category: "taxi",
            surgeRange: "1,3~1,8x",
            surgeVal: 1.5,
            orderCount: 68,
            level: "high",
            triggers: ["rush_hour", "rain"],
            reason: "Uhitaji Mkubwa wa Usafiri Eneo Lako",
            descriptionSw: "Wateja 68+ wanatafuta usafiri wa haraka karibu nawe.",
          },
          {
            id: `local-surge-2`,
            name: "Kituo cha Chakula & Vinywaji",
            cityName: cityName,
            center: [userPos[0] - 0.005, userPos[1] + 0.003],
            radius: 480,
            category: "food",
            surgeRange: "1,2~1,6x",
            surgeVal: 1.35,
            orderCount: 45,
            level: "moderate",
            triggers: ["mall"],
            reason: "Oda za Chakula Karibu",
            descriptionSw: "Migahawa ya karibu ina oda 45+ za delivery.",
          }
        ];
      }
    }

    if (activeCategory !== 'all') {
      return zones.filter(z => z.category === activeCategory);
    }

    return zones;
  }, [cityName, userPos, activeCategory]);

  return (
    <>
      {activeZones.map((zone) => {
        const hexClusters = generateHeatClusterHexagons(zone.center[0], zone.center[1], zone.radius);

        // Color theme mapping according to service category & level
        let strokeColor = '#EAB308'; // Yellow
        let fillColor = '#FACC15';
        let fillOpacity = 0.38;

        if (zone.category === 'food') {
          strokeColor = '#10B981'; // Emerald
          fillColor = '#34D399';
        } else if (zone.category === 'parcel') {
          strokeColor = '#3B82F6'; // Blue
          fillColor = '#60A5FA';
        } else if (zone.category === 'mart') {
          strokeColor = '#A855F7'; // Purple
          fillColor = '#C084FC';
        }

        if (zone.level === 'high') {
          if (zone.category === 'taxi') {
            strokeColor = '#EA580C';
            fillColor = '#F97316';
          }
          fillOpacity = 0.46;
        } else if (zone.level === 'extreme') {
          if (zone.category === 'taxi') {
            strokeColor = '#DC2626';
            fillColor = '#EF4444';
          }
          fillOpacity = 0.54;
        }

        // Offsets for surge badge and order volume badge
        const badgePos: [number, number] = [
          zone.center[0] + 0.0018,
          zone.center[1] - 0.0015
        ];

        const volumePos: [number, number] = [
          zone.center[0] - 0.0018,
          zone.center[1] + 0.0022
        ];

        return (
          <React.Fragment key={zone.id}>
            {/* Smooth pulse background aura */}
            <Circle
              center={zone.center}
              radius={zone.radius * 1.15}
              pathOptions={{
                stroke: false,
                fillColor: fillColor,
                fillOpacity: fillOpacity * 0.35,
              }}
            />

            {/* Hexagonal mesh cell pattern */}
            {hexClusters.map((cluster, cIdx) => (
              <Polygon
                key={`${zone.id}-${cluster.id}`}
                positions={cluster.vertices}
                pathOptions={{
                  color: strokeColor,
                  weight: cIdx === 0 ? 1.6 : 1.0,
                  fillColor: fillColor,
                  fillOpacity: cIdx === 0 ? fillOpacity : fillOpacity * 0.75,
                  dashArray: cIdx % 2 === 1 ? '3, 3' : undefined,
                }}
                eventHandlers={{
                  click: () => onZoneClick?.(zone),
                }}
              />
            ))}

            {/* Surge Multiplier + Triggers Floating Badge */}
            <Marker
              position={badgePos}
              icon={createSurgeBadgeIcon(zone.surgeRange, zone.level, zone.category, zone.triggers)}
              eventHandlers={{
                click: () => onZoneClick?.(zone),
              }}
            />

            {/* Order Volume Count Floating Badge */}
            <Marker
              position={volumePos}
              icon={createOrderVolumeBadgeIcon(zone.orderCount, zone.category)}
              eventHandlers={{
                click: () => onZoneClick?.(zone),
              }}
            />
          </React.Fragment>
        );
      })}
    </>
  );
};
