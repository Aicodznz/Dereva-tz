import React, { useMemo } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export interface GeoLandmark {
  id: string;
  name: string;
  category: 'hub' | 'hospital' | 'school' | 'bus' | 'airport' | 'ferry' | 'market' | 'road';
  lat: number;
  lng: number;
  minZoom: number;
  priority: number; // 1 (highest) to 5 (lowest)
  badgeColor?: string;
  subText?: string;
}

// Canonical geographical landmarks of Dar es Salaam & strategic logistics corridors
export const DAR_GEOGRAPHICAL_LANDMARKS: GeoLandmark[] = [
  // 1. Major Municipalities & Regional Hubs
  { id: 'hub-posta', name: 'Posta (City Center)', category: 'hub', lat: -6.8163, lng: 39.2894, minZoom: 11, priority: 1, subText: 'CBD • Kivukoni' },
  { id: 'hub-kariakoo', name: 'Kariakoo', category: 'market', lat: -6.8222, lng: 39.2749, minZoom: 12, priority: 1, subText: 'Soko Kuu' },
  { id: 'hub-mwenge', name: 'Mwenge', category: 'hub', lat: -6.7712, lng: 39.2274, minZoom: 12, priority: 1, subText: 'Kijitonyama' },
  { id: 'hub-ubungo', name: 'Ubungo Interchange', category: 'bus', lat: -6.7937, lng: 39.2155, minZoom: 12, priority: 1, subText: 'Morogoro Rd' },
  { id: 'hub-morogoro-mbezi', name: 'Mbezi Louis (Magufuli)', category: 'bus', lat: -6.7865, lng: 39.1287, minZoom: 11, priority: 1, subText: 'Magufuli Terminal' },
  { id: 'hub-sinza', name: 'Sinza (Kumekucha)', category: 'hub', lat: -6.7835, lng: 39.2312, minZoom: 13, priority: 2, subText: 'Shekilango' },
  { id: 'hub-kinondoni', name: 'Kinondoni B', category: 'hub', lat: -6.7925, lng: 39.2638, minZoom: 13, priority: 2, subText: 'Manyanya' },
  { id: 'hub-mikocheni', name: 'Mikocheni', category: 'hub', lat: -6.7645, lng: 39.2520, minZoom: 13, priority: 2, subText: 'Rose Garden' },
  { id: 'hub-masaki', name: 'Masaki & Oysterbay', category: 'hub', lat: -6.7533, lng: 39.2755, minZoom: 13, priority: 2, subText: 'Peninsula' },
  { id: 'hub-ilala', name: 'Ilala Boma', category: 'hub', lat: -6.8277, lng: 39.2655, minZoom: 13, priority: 2, subText: 'Uhuru St' },
  { id: 'hub-temeke', name: 'Temeke Stereo', category: 'hub', lat: -6.8550, lng: 39.2680, minZoom: 13, priority: 2, subText: 'Mwembe Yanga' },
  { id: 'hub-tegeta', name: 'Tegeta Kibaoni', category: 'hub', lat: -6.6780, lng: 39.1980, minZoom: 12, priority: 2, subText: 'Bagamoyo Rd' },
  { id: 'hub-kigamboni', name: 'Kigamboni Bridge', category: 'hub', lat: -6.8290, lng: 39.3020, minZoom: 12, priority: 2, subText: 'Nyerere Bridge' },
  { id: 'hub-mbagala', name: 'Mbagala Rangi Tatu', category: 'bus', lat: -6.9050, lng: 39.2720, minZoom: 12, priority: 2, subText: 'Kilwa Rd' },

  // 2. Transport & Terminals (Airports, Ports, Train & BRT)
  { id: 'trans-jnia', name: 'JNIA Airport (Terminal 3)', category: 'airport', lat: -6.8781, lng: 39.2026, minZoom: 11, priority: 1, subText: 'Uwanja wa Ndege' },
  { id: 'trans-ferry', name: 'Zanzibar Ferry Terminal', category: 'ferry', lat: -6.8140, lng: 39.2930, minZoom: 13, priority: 1, subText: 'Azam Marine' },
  { id: 'trans-sgr', name: 'Tanzania SGR Central Station', category: 'bus', lat: -6.8185, lng: 39.2820, minZoom: 13, priority: 1, subText: 'Treni ya Kisasa' },
  { id: 'trans-makumbusho', name: 'Makumbusho Bus Stand', category: 'bus', lat: -6.7780, lng: 39.2450, minZoom: 14, priority: 2, subText: 'Stendi ya Daladala' },
  { id: 'trans-gerezani', name: 'Gerezani BRT Terminal', category: 'bus', lat: -6.8235, lng: 39.2840, minZoom: 14, priority: 2, subText: 'Mwendokasi' },
  { id: 'trans-kimara', name: 'Kimara Mwisho BRT', category: 'bus', lat: -6.7860, lng: 39.1720, minZoom: 13, priority: 2, subText: 'Mwendokasi Stop' },

  // 3. Hospitals & Emergency Centers
  { id: 'hosp-muhimbili', name: 'Muhimbili National Hospital', category: 'hospital', lat: -6.8065, lng: 39.2745, minZoom: 13, priority: 1, subText: 'MNH Emergency' },
  { id: 'hosp-mwananyamala', name: 'Mwananyamala Hospital', category: 'hospital', lat: -6.7845, lng: 39.2555, minZoom: 14, priority: 2, subText: 'Hospitali ya Rufaa' },
  { id: 'hosp-agakhan', name: 'Aga Khan Hospital', category: 'hospital', lat: -6.8105, lng: 39.2870, minZoom: 14, priority: 2, subText: 'Ocean Road' },
  { id: 'hosp-amana', name: 'Amana Hospital (Ilala)', category: 'hospital', lat: -6.8250, lng: 39.2610, minZoom: 14, priority: 2, subText: 'Hospitali ya Wilaya' },
  { id: 'hosp-temeke', name: 'Temeke Hospital', category: 'hospital', lat: -6.8580, lng: 39.2670, minZoom: 14, priority: 2, subText: 'Hospitali ya Wilaya' },
  { id: 'hosp-kairuki', name: 'Kairuki Hospital', category: 'hospital', lat: -6.7725, lng: 39.2470, minZoom: 15, priority: 3, subText: 'Mikocheni' },

  // 4. Universities & Educational Hubs
  { id: 'edu-udsm', name: 'UDSM (Mlimani Campus)', category: 'school', lat: -6.7790, lng: 39.2060, minZoom: 13, priority: 1, subText: 'Chuo Kikuu DSM' },
  { id: 'edu-dit', name: 'DIT (Dar Tech Institute)', category: 'school', lat: -6.8120, lng: 39.2810, minZoom: 14, priority: 2, subText: 'Morogoro Rd' },
  { id: 'edu-ifm', name: 'IFM (Finance & Mgmt)', category: 'school', lat: -6.8110, lng: 39.2895, minZoom: 15, priority: 3, subText: 'Shaaban Robert' },
  { id: 'edu-cbe', name: 'CBE (Business Education)', category: 'school', lat: -6.8135, lng: 39.2845, minZoom: 15, priority: 3, subText: 'Bibi Titi St' },

  // 5. Major Arterial Highways & Express Corridors
  { id: 'road-morogoro', name: 'Morogoro Road', category: 'road', lat: -6.7910, lng: 39.2220, minZoom: 13, priority: 2, subText: 'Barabara Kuu' },
  { id: 'road-bagamoyo', name: 'Bagamoyo Road', category: 'road', lat: -6.7680, lng: 39.2390, minZoom: 13, priority: 2, subText: 'Mwenge ➔ Tegeta' },
  { id: 'road-ali-hassan', name: 'Ali Hassan Mwinyi Rd', category: 'road', lat: -6.7880, lng: 39.2710, minZoom: 14, priority: 2, subText: 'Kijitonyama ➔ Selander' },
  { id: 'road-sam-nujoma', name: 'Sam Nujoma Road', category: 'road', lat: -6.7820, lng: 39.2150, minZoom: 14, priority: 2, subText: 'Mwenge ➔ Ubungo' },
  { id: 'road-nyerere', name: 'Julius Nyerere Road', category: 'road', lat: -6.8450, lng: 39.2420, minZoom: 13, priority: 2, subText: 'Posta ➔ JNIA' },
  { id: 'road-shekilango', name: 'Shekilango Road', category: 'road', lat: -6.7915, lng: 39.2295, minZoom: 15, priority: 3, subText: 'Sinza Corridor' },

  // 6. Markets & Commercial Landmarks
  { id: 'mkt-mlimani-city', name: 'Mlimani City Mall', category: 'market', lat: -6.7735, lng: 39.2185, minZoom: 13, priority: 1, subText: 'Shopping & Cinema' },
  { id: 'mkt-tandale', name: 'Tandale Market', category: 'market', lat: -6.7975, lng: 39.2415, minZoom: 15, priority: 3, subText: 'Soko la Tandale' },
  { id: 'mkt-manzese', name: 'Manzese Midizini', category: 'market', lat: -6.7985, lng: 39.2315, minZoom: 14, priority: 2, subText: 'Soko la Nguo' },
  { id: 'mkt-mwenge-carvings', name: 'Mwenge Woodcarvers Market', category: 'market', lat: -6.7695, lng: 39.2290, minZoom: 15, priority: 3, subText: 'Sanaa za Vinyago' },
  { id: 'mkt-machame', name: 'Kariakoo Congo St', category: 'market', lat: -6.8210, lng: 39.2760, minZoom: 15, priority: 2, subText: 'Maduka ya Nguo' }
];

interface SmartMapLabelsOverlayProps {
  currentRotation: number;
  theme: 'dark' | 'light';
  enabled?: boolean;
}

export default function SmartMapLabelsOverlay({
  currentRotation,
  theme,
  enabled = true
}: SmartMapLabelsOverlayProps) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = React.useState<number>(map.getZoom());

  useMapEvents({
    zoomend: () => {
      setCurrentZoom(map.getZoom());
    }
  });

  // Calculate screen-projected distance between markers to avoid overlapping / collision
  const visibleLandmarks = useMemo(() => {
    if (!enabled) return [];

    const zoom = currentZoom;
    // 1. Filter by minimum zoom requirement
    const eligible = DAR_GEOGRAPHICAL_LANDMARKS.filter(lm => zoom >= lm.minZoom);

    // 2. Sort by priority (1 = highest)
    eligible.sort((a, b) => a.priority - b.priority);

    // 3. Collision avoidance in screen space coordinates (px)
    const accepted: GeoLandmark[] = [];
    const minDistancePixels = zoom >= 16 ? 48 : zoom >= 14 ? 65 : 85;

    for (const item of eligible) {
      try {
        const itemPoint = map.project([item.lat, item.lng], zoom);
        let hasCollision = false;

        for (const placed of accepted) {
          const placedPoint = map.project([placed.lat, placed.lng], zoom);
          const dist = itemPoint.distanceTo(placedPoint);
          if (dist < minDistancePixels) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          accepted.push(item);
        }
      } catch (e) {
        accepted.push(item);
      }
    }

    return accepted;
  }, [currentZoom, enabled, map]);

  if (!enabled) return null;

  return (
    <>
      {visibleLandmarks.map((lm) => {
        const iconConfig = getCategoryConfig(lm.category, theme);

        const customIcon = L.divIcon({
          className: 'smart-map-label-leaflet-icon',
          html: `
            <div class="smart-billboard-inner" style="
              transform: rotate(${currentRotation}deg);
              transform-origin: center center;
              transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
              display: inline-flex;
              align-items: center;
              gap: 5px;
              padding: 3px 8px;
              border-radius: 9999px;
              background: ${iconConfig.bg};
              color: ${iconConfig.textColor};
              border: 1px solid ${iconConfig.border};
              box-shadow: 0 4px 14px rgba(0,0,0,0.28);
              white-space: nowrap;
              pointer-events: none;
              user-select: none;
              font-family: system-ui, -apple-system, sans-serif;
            ">
              <span style="font-size: 11px; line-height: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                ${iconConfig.emoji}
              </span>
              <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.05;">
                <span style="font-weight: 900; font-size: 10px; letter-spacing: -0.01em;">
                  ${lm.name}
                </span>
                ${lm.subText && currentZoom >= 14 ? `
                  <span style="font-size: 7.5px; opacity: 0.75; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
                    ${lm.subText}
                  </span>
                ` : ''}
              </div>
            </div>
          `,
          iconSize: [120, 26],
          iconAnchor: [60, 13]
        });

        return (
          <Marker
            key={lm.id}
            position={[lm.lat, lm.lng]}
            icon={customIcon}
            interactive={false}
          />
        );
      })}
    </>
  );
}

function getCategoryConfig(category: GeoLandmark['category'], theme: 'dark' | 'light') {
  const isDark = theme === 'dark';

  switch (category) {
    case 'hospital':
      return {
        emoji: '🏥',
        bg: isDark ? 'rgba(239, 68, 68, 0.92)' : 'rgba(254, 242, 242, 0.95)',
        textColor: isDark ? '#ffffff' : '#b91c1c',
        border: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(239, 68, 68, 0.4)'
      };
    case 'airport':
      return {
        emoji: '✈️',
        bg: isDark ? 'rgba(59, 130, 246, 0.95)' : 'rgba(239, 246, 255, 0.95)',
        textColor: isDark ? '#ffffff' : '#1d4ed8',
        border: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(59, 130, 246, 0.4)'
      };
    case 'bus':
      return {
        emoji: '🚌',
        bg: isDark ? 'rgba(249, 115, 22, 0.92)' : 'rgba(255, 247, 237, 0.95)',
        textColor: isDark ? '#ffffff' : '#c2410c',
        border: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(249, 115, 22, 0.4)'
      };
    case 'ferry':
      return {
        emoji: '⛴️',
        bg: isDark ? 'rgba(14, 165, 233, 0.92)' : 'rgba(240, 249, 255, 0.95)',
        textColor: isDark ? '#ffffff' : '#0369a1',
        border: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(14, 165, 233, 0.4)'
      };
    case 'school':
      return {
        emoji: '🎓',
        bg: isDark ? 'rgba(139, 92, 246, 0.92)' : 'rgba(245, 243, 255, 0.95)',
        textColor: isDark ? '#ffffff' : '#6d28d9',
        border: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(139, 92, 246, 0.4)'
      };
    case 'market':
      return {
        emoji: '🛍️',
        bg: isDark ? 'rgba(16, 185, 129, 0.92)' : 'rgba(236, 253, 245, 0.95)',
        textColor: isDark ? '#ffffff' : '#047857',
        border: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(16, 185, 129, 0.4)'
      };
    case 'road':
      return {
        emoji: '🛣️',
        bg: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(248, 250, 252, 0.95)',
        textColor: isDark ? '#e2e8f0' : '#1e293b',
        border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(148, 163, 184, 0.4)'
      };
    case 'hub':
    default:
      return {
        emoji: '📍',
        bg: isDark ? 'rgba(24, 24, 37, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        textColor: isDark ? '#ffffff' : '#0f172a',
        border: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(203, 213, 225, 0.8)'
      };
  }
}
