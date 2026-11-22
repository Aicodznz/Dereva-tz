import type * as mapboxgl from 'mapbox-gl';

export interface OfflinePlaceEntry {
  id: string;
  name: string;
  displayName: string;
  region: string;
  district: string;
  category: 'hub' | 'market' | 'hospital' | 'fuel' | 'atm' | 'airport' | 'ferry' | 'landmark' | 'ward';
  lat: number;
  lng: number;
  aliases: string[];
}

export const OFFLINE_TZ_PLACES: OfflinePlaceEntry[] = [
  // --- DAR ES SALAAM HUBS & LANDMARKS ---
  { id: 'tz-dsm-posta', name: 'Posta Mpya & Ohio St', displayName: 'Posta Mpya, Ilala, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'landmark', lat: -6.8144, lng: 39.2903, aliases: ['POSTA', 'CITY CENTRE', 'OHIO', 'SAMORA', 'BOT', 'CBD'] },
  { id: 'tz-dsm-askari', name: 'Sanamu ya Askari (Askari Monument)', displayName: 'Askari Monument, Samora Ave, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'landmark', lat: -6.8162, lng: 39.2894, aliases: ['ASKARI', 'AZIKIWE', 'SAMORA'] },
  { id: 'tz-dsm-kariakoo', name: 'Soko la Kariakoo', displayName: 'Kariakoo Market, Ilala, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'market', lat: -6.8198, lng: 39.2745, aliases: ['KARIAKOO', 'KKOO', 'MSIMBAZI', 'SOKONI'] },
  { id: 'tz-dsm-kivukoni', name: 'Kivukoni Feri (Kigamboni Ferry)', displayName: 'Kivukoni Ferry Terminal, Ilala, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'ferry', lat: -6.8205, lng: 39.2981, aliases: ['KIVUKONI', 'FERI', 'FERRY', 'PANTONI', 'AZAM MARINE'] },
  { id: 'tz-dsm-gerezani', name: 'Gerezani BRT Hub', displayName: 'Gerezani Terminal, Kariakoo, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'hub', lat: -6.8239, lng: 39.2797, aliases: ['GEREZANI', 'KAMATA', 'BRT'] },
  { id: 'tz-dsm-ubungo', name: 'Ubungo Kijazi Interchange', displayName: 'Ubungo Kijazi Interchange, Ubungo, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'hub', lat: -6.7865, lng: 39.2132, aliases: ['UBUNGO', 'KIJAZI', 'MAWASILIANO', 'SIMU 2000'] },
  { id: 'tz-dsm-mlimani', name: 'Mlimani City Mall', displayName: 'Mlimani City Mall, Sam Nujoma Rd, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'market', lat: -6.7725, lng: 39.2198, aliases: ['MLIMANI', 'MLIMANI CITY', 'UDSM', 'SAM NUJOMA'] },
  { id: 'tz-dsm-mwenge', name: 'Mwenge Stendi Kuu', displayName: 'Mwenge Bus Stand, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'hub', lat: -6.7681, lng: 39.2274, aliases: ['MWENGE', 'ITV', 'COCA COLA'] },
  { id: 'tz-dsm-morocco', name: 'Morocco Transfer Hub', displayName: 'Morocco Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'hub', lat: -6.7885, lng: 39.2604, aliases: ['MOROCCO', 'KINONDONI', 'AIRTEL'] },
  { id: 'tz-dsm-sinza', name: 'Sinza Mori / Mugabe', displayName: 'Sinza, Ubungo, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'ward', lat: -6.7852, lng: 39.2295, aliases: ['SINZA', 'MORI', 'KAMANYOLA', 'PALESTINA', 'LION'] },
  { id: 'tz-dsm-mikocheni', name: 'Mikocheni (Shoppers Plaza)', displayName: 'Mikocheni, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'ward', lat: -6.7645, lng: 39.2492, aliases: ['MIKOCHENI', 'SHOPPERS', 'REGENT ESTATE', 'MAKUMBUSHO'] },
  { id: 'tz-dsm-masaki', name: 'Masaki & Slipway', displayName: 'Masaki Peninsula, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'landmark', lat: -6.7485, lng: 39.2785, aliases: ['MASAKI', 'SLIPWAY', 'CHOLE', 'COCO BEACH', 'OYSTERBAY'] },
  { id: 'tz-dsm-magomeni', name: 'Magomeni Mapipa', displayName: 'Magomeni Mapipa, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'ward', lat: -6.8095, lng: 39.2611, aliases: ['MAGOMENI', 'MAPIPA', 'USALAMA'] },
  { id: 'tz-dsm-manzese', name: 'Manzese Darajani', displayName: 'Manzese, Ubungo, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'ward', lat: -6.8031, lng: 39.2361, aliases: ['MANZESE', 'TIP TOP', 'ARGENTINA'] },
  { id: 'tz-dsm-kimara', name: 'Kimara Mwisho BRT', displayName: 'Kimara Mwisho, Ubungo, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'hub', lat: -6.7920, lng: 39.1670, aliases: ['KIMARA', 'SUKA', 'STOP OVER'] },
  { id: 'tz-dsm-mbezi', name: 'Stendi Kuu ya Magufuli (Mbezi Luis)', displayName: 'Magufuli Bus Terminal, Mbezi Luis, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'hub', lat: -6.7880, lng: 39.1280, aliases: ['MBEZI', 'MAGUFULI', 'MBEZI LUIS', 'STENDI KUU'] },
  { id: 'tz-dsm-mabibo', name: 'Mabibo Relini & Mandela Rd', displayName: 'Mabibo, Ubungo, Dar es Salaam', region: 'Dar es Salaam', district: 'Ubungo', category: 'ward', lat: -6.8163, lng: 39.2384, aliases: ['MABIBO', 'RELINI', 'MANDELA', 'NIT'] },
  { id: 'tz-dsm-tabata', name: 'Tabata Bima / Kisiwani', displayName: 'Tabata, Ilala, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'ward', lat: -6.8268, lng: 39.2225, aliases: ['TABATA', 'BIMA', 'SEGEREA', 'KINYEREZI', 'SHULE'] },
  { id: 'tz-dsm-buguruni', name: 'Buguruni Sokoni', displayName: 'Buguruni, Ilala, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'market', lat: -6.8280, lng: 39.2450, aliases: ['BUGURUNI', 'MALAPA', 'ROZANA'] },
  { id: 'tz-dsm-tazara', name: 'Tazara Flyover (Mfugale)', displayName: 'Tazara Mfugale Flyover, Ilala, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'hub', lat: -6.8430, lng: 39.2410, aliases: ['TAZARA', 'MFUGALE', 'NYERERE'] },
  { id: 'tz-dsm-jnia', name: 'Uwanja wa Ndege JNIA Terminal 3', displayName: 'Julius Nyerere International Airport (JNIA), Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'airport', lat: -6.8781, lng: 39.2026, aliases: ['AIRPORT', 'JNIA', 'TERMINAL 3', 'NDEGE', 'KIPAVA', 'KARAKATA'] },
  { id: 'tz-dsm-temeke', name: 'Temeke & Uwanja wa Mkapa', displayName: 'Temeke / Benjamin Mkapa Stadium, Dar es Salaam', region: 'Dar es Salaam', district: 'Temeke', category: 'landmark', lat: -6.8542, lng: 39.2738, aliases: ['TEMEKE', 'MKAPA', 'TAIFA', 'STADIUM', 'SABASABA'] },
  { id: 'tz-dsm-mbagala', name: 'Mbagala Rangi Tatu', displayName: 'Mbagala Rangi Tatu, Temeke, Dar es Salaam', region: 'Dar es Salaam', district: 'Temeke', category: 'hub', lat: -6.8910, lng: 39.2690, aliases: ['MBAGALA', 'RANGI TATU', 'CHARAMBE'] },
  { id: 'tz-dsm-kigamboni', name: 'Kigamboni Darajani / Ferry', displayName: 'Kigamboni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kigamboni', category: 'hub', lat: -6.8295, lng: 39.3112, aliases: ['KIGAMBONI', 'DARAJA', 'FUNDIKIRA', 'GEZAULOLE'] },
  { id: 'tz-dsm-tegeta', name: 'Tegeta Kibo Complex', displayName: 'Tegeta, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'ward', lat: -6.6525, lng: 39.1852, aliases: ['TEGETA', 'KIBO', 'KUNDUCHI', 'BUNJU'] },
  { id: 'tz-dsm-mbezi-beach', name: 'Mbezi Beach (Bagamoyo Rd)', displayName: 'Mbezi Beach, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'ward', lat: -6.7042, lng: 39.2195, aliases: ['MBEZI BEACH', 'AFRICANA', 'JOGOO', 'RAINBOW'] },
  // --- HOSPITALS, FUEL & BANKS (ESSENTIALS OFFLINE) ---
  { id: 'tz-dsm-muhimbili', name: 'Hospitali ya Taifa Muhimbili (MNH)', displayName: 'Muhimbili National Hospital, Upanga, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'hospital', lat: -6.8058, lng: 39.2742, aliases: ['MUHIMBILI', 'MNH', 'UPANGA', 'HOSPITALI'] },
  { id: 'tz-dsm-agakhan', name: 'Hospitali ya Aga Khan', displayName: 'Aga Khan Hospital, Ocean Rd, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'hospital', lat: -6.8035, lng: 39.2889, aliases: ['AGA KHAN', 'AGAKHAN', 'OCEAN ROAD'] },
  { id: 'tz-dsm-mwananyamala', name: 'Hospitali ya Mwananyamala', displayName: 'Mwananyamala Hospital, Kinondoni, Dar es Salaam', region: 'Dar es Salaam', district: 'Kinondoni', category: 'hospital', lat: -6.7824, lng: 39.2571, aliases: ['MWANANYAMALA', 'HOSPITALI'] },
  { id: 'tz-dsm-fuel-posta', name: 'TotalEnergies Posta / Bibi Titi', displayName: 'TotalEnergies Petrol Station, Bibi Titi Rd, Dar es Salaam', region: 'Dar es Salaam', district: 'Ilala', category: 'fuel', lat: -6.8124, lng: 39.2825, aliases: ['TOTAL', 'PETROLI', 'FUEL', 'MAFUTA'] },
  { id: 'tz-dsm-fuel-morocco', name: 'Oryx Energies Morocco', displayName: 'Oryx Petrol Station, Ali Hassan Mwinyi Rd, Morocco', region: 'Dar es Salaam', district: 'Kinondoni', category: 'fuel', lat: -6.7878, lng: 39.2615, aliases: ['ORYX', 'PETROLI', 'FUEL', 'MOROCCO'] },
  { id: 'tz-dsm-fuel-ubungo', name: 'Puma Energy Ubungo', displayName: 'Puma Petrol Station, Morogoro Rd, Ubungo', region: 'Dar es Salaam', district: 'Ubungo', category: 'fuel', lat: -6.7885, lng: 39.2164, aliases: ['PUMA', 'PETROLI', 'FUEL', 'UBUNGO'] },
  { id: 'tz-dsm-atm-crdb', name: 'CRDB Bank Makao Makuu (Azikiwe)', displayName: 'CRDB Bank HQ & ATM, Azikiwe St, Posta', region: 'Dar es Salaam', district: 'Ilala', category: 'atm', lat: -6.8152, lng: 39.2896, aliases: ['CRDB', 'ATM', 'BENKI'] },
  { id: 'tz-dsm-atm-nmb', name: 'NMB Bank Makao Makuu (Ohio St)', displayName: 'NMB Bank HQ & ATM, Ohio St, Posta', region: 'Dar es Salaam', district: 'Ilala', category: 'atm', lat: -6.8131, lng: 39.2891, aliases: ['NMB', 'ATM', 'BENKI'] },
  { id: 'tz-dsm-atm-mlimani', name: 'ATM Hub Mlimani City (CRDB / NMB / NBC)', displayName: 'Mlimani City Banking & ATM Hub, Sam Nujoma Rd', region: 'Dar es Salaam', district: 'Ubungo', category: 'atm', lat: -6.7729, lng: 39.2208, aliases: ['ATM', 'CRDB', 'NMB', 'NBC', 'MLIMANI'] },
  // --- ZANZIBAR ---
  { id: 'tz-znz-stonetown', name: 'Stone Town (Mji Mkongwe)', displayName: 'Stone Town, Mjini Magharibi, Zanzibar', region: 'Zanzibar', district: 'Mjini Magharibi', category: 'landmark', lat: -6.1620, lng: 39.1915, aliases: ['STONE TOWN', 'MJI MKONGWE', 'FORODHANI', 'ZANZIBAR'] },
  { id: 'tz-znz-darajani', name: 'Soko la Darajani', displayName: 'Darajani Market, Zanzibar', region: 'Zanzibar', district: 'Mjini Magharibi', category: 'market', lat: -6.1610, lng: 39.1970, aliases: ['DARAJANI', 'SOKO'] },
  { id: 'tz-znz-ferry', name: 'Bandari ya Malindi (Zanzibar Port)', displayName: 'Malindi Ferry Terminal, Zanzibar', region: 'Zanzibar', district: 'Mjini Magharibi', category: 'ferry', lat: -6.1550, lng: 39.1920, aliases: ['MALINDI', 'FERRY', 'BANDARI'] },
  { id: 'tz-znz-airport', name: 'Zanzibar Airport (AAKIA)', displayName: 'Abeid Amani Karume Airport, Zanzibar', region: 'Zanzibar', district: 'Mjini Magharibi', category: 'airport', lat: -6.2220, lng: 39.2245, aliases: ['ZANZIBAR AIRPORT', 'AAKIA', 'KIEMBESAMAKI'] },
  { id: 'tz-znz-mnazi', name: 'Hospitali ya Mnazi Mmoja', displayName: 'Mnazi Mmoja Hospital, Zanzibar', region: 'Zanzibar', district: 'Mjini Magharibi', category: 'hospital', lat: -6.1674, lng: 39.1932, aliases: ['MNAZI MMOJA', 'HOSPITALI', 'ZANZIBAR'] },
  // --- ARUSHA, MWANZA, DODOMA, MBEYA, MOROGORO ---
  { id: 'tz-aru-clock', name: 'Arusha Clock Tower (Mnara wa Saa)', displayName: 'Clock Tower, Arusha CBD', region: 'Arusha', district: 'Arusha Mjini', category: 'landmark', lat: -3.3688, lng: 36.6873, aliases: ['ARUSHA', 'CLOCK TOWER', 'AICC', 'SOKO KUU'] },
  { id: 'tz-aru-stendi', name: 'Arusha Stendi Kuu', displayName: 'Arusha Central Bus Terminal', region: 'Arusha', district: 'Arusha Mjini', category: 'hub', lat: -3.3738, lng: 36.6845, aliases: ['STENDI', 'ARUSHA BUS'] },
  { id: 'tz-aru-mtmeru', name: 'Hospitali ya Mount Meru', displayName: 'Mount Meru Regional Hospital, Arusha', region: 'Arusha', district: 'Arusha Mjini', category: 'hospital', lat: -3.3635, lng: 36.6901, aliases: ['MOUNT MERU', 'HOSPITALI'] },
  { id: 'tz-mwz-rock', name: 'Mwanza Rock City Mall', displayName: 'Rock City Mall, Mwanza', region: 'Mwanza', district: 'Ilemela', category: 'market', lat: -2.4956, lng: 32.9058, aliases: ['MWANZA', 'ROCK CITY', 'NYEGEZI', 'BUZURUGA'] },
  { id: 'tz-mwz-cbd', name: 'Mwanza Kati (Kenyatta Rd)', displayName: 'Kenyatta Rd, Mwanza City Centre', region: 'Mwanza', district: 'Nyamagana', category: 'landmark', lat: -2.5164, lng: 32.8998, aliases: ['KENYATTA', 'MWANZA', 'KAMANGA'] },
  { id: 'tz-mwz-bugando', name: 'Hospitali ya Bugando (BMC)', displayName: 'Bugando Medical Centre, Mwanza', region: 'Mwanza', district: 'Nyamagana', category: 'hospital', lat: -2.5284, lng: 32.9035, aliases: ['BUGANDO', 'HOSPITALI'] },
  { id: 'tz-dod-bunge', name: 'Dodoma Jiji & Bunge', displayName: 'Bunge & Jamhuri, Dodoma CBD', region: 'Dodoma', district: 'Dodoma Mjini', category: 'landmark', lat: -6.1731, lng: 35.7478, aliases: ['DODOMA', 'BUNGE', 'NYERERE SQUARE', 'NANENANE'] },
  { id: 'tz-dod-sgr', name: 'Stesheni ya SGR Dodoma', displayName: 'Dodoma SGR Train Station', region: 'Dodoma', district: 'Dodoma Mjini', category: 'hub', lat: -6.1768, lng: 35.7510, aliases: ['SGR', 'TRENI', 'STESHENI'] },
  { id: 'tz-mor-msamvu', name: 'Msamvu Bus Terminal (Morogoro)', displayName: 'Msamvu, Morogoro Mjini', region: 'Morogoro', district: 'Morogoro Urban', category: 'hub', lat: -6.8145, lng: 37.6748, aliases: ['MOROGORO', 'MSAMVU'] },
  { id: 'tz-mby-kabanjia', name: 'Mbeya Kabwe / Uyole', displayName: 'Mbeya Mjini, Mbeya', region: 'Mbeya', district: 'Mbeya Urban', category: 'hub', lat: -8.9094, lng: 33.4608, aliases: ['MBEYA', 'KABWE', 'UYOLE'] },
];

/**
 * Simplified Indian Ocean / Dar es Salaam Bay / Unguja & Lake Victoria water polygons
 * so offline 2D & 3D maps immediately distinguish coastline vs land even without raster/vector PBF cache.
 */
export const OFFLINE_COASTLINE_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: 'FeatureCollection',
  features: [
    // Indian Ocean off Dar es Salaam Coast (East of Kivukoni / Masaki / Kunduchi / Kigamboni)
    {
      type: 'Feature',
      properties: { name: 'Bahari ya Hindi (Indian Ocean)', waterType: 'ocean' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.180, -6.550],
            [39.550, -6.550],
            [39.550, -7.120],
            [39.370, -7.120],
            [39.355, -6.920],
            [39.335, -6.860],
            [39.318, -6.826],
            [39.302, -6.818],
            [39.299, -6.812],
            [39.294, -6.801],
            [39.286, -6.785],
            [39.288, -6.762],
            [39.282, -6.742],
            [39.256, -6.736],
            [39.236, -6.716],
            [39.222, -6.690],
            [39.205, -6.655],
            [39.190, -6.620],
            [39.180, -6.550],
          ],
        ],
      },
    },
    // Msimbazi Creek & Harbor entrance
    {
      type: 'Feature',
      properties: { name: 'Dar es Salaam Harbour Creek', waterType: 'harbour' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.298, -6.821],
            [39.308, -6.824],
            [39.304, -6.842],
            [39.294, -6.850],
            [39.289, -6.838],
            [39.291, -6.824],
            [39.298, -6.821],
          ],
        ],
      },
    },
    // Lake Victoria West of Mwanza CBD
    {
      type: 'Feature',
      properties: { name: 'Ziwa Victoria (Lake Victoria)', waterType: 'lake' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [32.650, -2.350],
            [32.895, -2.350],
            [32.888, -2.470],
            [32.892, -2.515],
            [32.886, -2.555],
            [32.896, -2.620],
            [32.650, -2.620],
            [32.650, -2.350],
          ],
        ],
      },
    },
  ],
};

/**
 * Major Tanzania & Dar es Salaam arterial highways + CBD streets for crisp offline 2D & 3D rendering
 * AND offline road-aware route estimation.
 */
export const OFFLINE_ROADS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: 'FeatureCollection',
  features: [
    // 1. Morogoro Road (Kivukoni -> Posta -> Fire -> Magomeni -> Manzese -> Ubungo -> Kimara -> Mbezi)
    {
      type: 'Feature',
      properties: { name: 'Morogoro Rd (BRT)', class: 'trunk', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2981, -6.8205],
          [39.2896, -6.8161],
          [39.2820, -6.8142],
          [39.2762, -6.8129],
          [39.2611, -6.8095],
          [39.2470, -6.8062],
          [39.2361, -6.8031],
          [39.2245, -6.7985],
          [39.2141, -6.7949],
          [39.2015, -6.7940],
          [39.1850, -6.7932],
          [39.1670, -6.7920],
          [39.1460, -6.7898],
          [39.1280, -6.7880],
        ],
      },
    },
    // 2. Ali Hassan Mwinyi / Bagamoyo Rd (Posta -> Palm Beach -> Morocco -> Mwenge -> Mbezi Beach -> Tegeta)
    {
      type: 'Feature',
      properties: { name: 'Ali Hassan Mwinyi & Bagamoyo Rd', class: 'trunk', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2903, -6.8144],
          [39.2882, -6.8058],
          [39.2825, -6.7985],
          [39.2712, -6.7940],
          [39.2604, -6.7885],
          [39.2540, -6.7795],
          [39.2460, -6.7722],
          [39.2274, -6.7681],
          [39.2195, -6.7042],
          [39.1852, -6.6525],
        ],
      },
    },
    // 3. Sam Nujoma Rd (Ubungo Kijazi -> Mlimani City -> Mwenge)
    {
      type: 'Feature',
      properties: { name: 'Sam Nujoma Rd', class: 'primary', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2132, -6.7865],
          [39.2165, -6.7790],
          [39.2198, -6.7725],
          [39.2238, -6.7695],
          [39.2274, -6.7681],
        ],
      },
    },
    // 4. Nelson Mandela Expressway (Ubungo -> Mabibo -> Buguruni -> Tazara -> Temeke -> Port)
    {
      type: 'Feature',
      properties: { name: 'Nelson Mandela Expressway', class: 'motorway', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2132, -6.7865],
          [39.2215, -6.7995],
          [39.2384, -6.8163],
          [39.2450, -6.8280],
          [39.2410, -6.8430],
          [39.2550, -6.8510],
          [39.2738, -6.8542],
          [39.2870, -6.8430],
        ],
      },
    },
    // 5. Julius K. Nyerere Rd (Gerezani -> Buguruni -> Tazara -> Karakata -> JNIA Airport)
    {
      type: 'Feature',
      properties: { name: 'Nyerere Rd', class: 'trunk', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2797, -6.8239],
          [39.2660, -6.8290],
          [39.2450, -6.8350],
          [39.2410, -6.8430],
          [39.2280, -6.8495],
          [39.2180, -6.8540],
          [39.2026, -6.8781],
        ],
      },
    },
    // 6. Kilwa Rd (Gerezani -> Sabasaba -> Temeke -> Mbagala Rangi Tatu)
    {
      type: 'Feature',
      properties: { name: 'Kilwa Rd (BRT-2)', class: 'trunk', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2797, -6.8239],
          [39.2785, -6.8420],
          [39.2738, -6.8542],
          [39.2702, -6.8725],
          [39.2690, -6.8910],
        ],
      },
    },
    // 7. Kawawa Road (Kinondoni -> Magomeni -> Ilala -> Buguruni -> Chang'ombe)
    {
      type: 'Feature',
      properties: { name: 'Rashidi Kawawa Rd', class: 'primary', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2604, -6.7885],
          [39.2682, -6.7990],
          [39.2611, -6.8095],
          [39.2570, -6.8235],
          [39.2580, -6.8390],
          [39.2700, -6.8490],
        ],
      },
    },
    // 8. Toure Drive & Msasani Peninsula Loop (Ocean Rd -> Coco Beach -> Masaki -> Slipway)
    {
      type: 'Feature',
      properties: { name: 'Toure Dr & Haile Selassie Rd', class: 'secondary', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2889, -6.8035],
          [39.2815, -6.7820],
          [39.2830, -6.7640],
          [39.2785, -6.7485],
          [39.2665, -6.7470],
          [39.2600, -6.7590],
          [39.2604, -6.7885],
        ],
      },
    },
    // 9. Kigamboni Bridge Corridor (Kurasini -> Nyerere Bridge -> Kigamboni Ferry)
    {
      type: 'Feature',
      properties: { name: 'Daraja la Nyerere (Kigamboni)', class: 'primary', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2870, -6.8430],
          [39.2995, -6.8475],
          [39.3112, -6.8420],
          [39.3112, -6.8295],
        ],
      },
    },
    // 10. Posta & Kariakoo CBD Street Grid (Samora, Azikiwe, Ohio, Bibi Titi, Msimbazi, Uhuru)
    {
      type: 'Feature',
      properties: { name: 'Samora Ave & Uhuru St', class: 'secondary', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2965, -6.8165],
          [39.2894, -6.8162],
          [39.2818, -6.8178],
          [39.2745, -6.8198],
          [39.2570, -6.8235],
          [39.2450, -6.8280],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Bibi Titi Mohamed & Msimbazi St', class: 'primary', city: 'Dar es Salaam' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.2882, -6.8058],
          [39.2825, -6.8124],
          [39.2797, -6.8239],
          [39.2745, -6.8198],
          [39.2762, -6.8129],
        ],
      },
    },
    // 11. Arusha East-West Corridor
    {
      type: 'Feature',
      properties: { name: 'Arusha–Moshi Rd (Dodoma Rd)', class: 'trunk', city: 'Arusha' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [36.6400, -3.3740],
          [36.6740, -3.3720],
          [36.6873, -3.3688],
          [36.7150, -3.3695],
        ],
      },
    },
    // 12. Dodoma CBD Ring
    {
      type: 'Feature',
      properties: { name: 'Barabara ya Nyerere & Bunge, Dodoma', class: 'trunk', city: 'Dodoma' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [35.7200, -6.1780],
          [35.7478, -6.1731],
          [35.7510, -6.1768],
          [35.7850, -6.1820],
        ],
      },
    },
    // 13. Mwanza Kenyatta & Makongoro Rd
    {
      type: 'Feature',
      properties: { name: 'Kenyatta & Nyerere Rd, Mwanza', class: 'trunk', city: 'Mwanza' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [32.9058, -2.4956],
          [32.8998, -2.5164],
          [32.9035, -2.5284],
          [32.9175, -2.5490],
        ],
      },
    },
    // 14. Zanzibar Stone Town Main Roads
    {
      type: 'Feature',
      properties: { name: 'Creek Rd & Kenyatta Rd, Zanzibar', class: 'primary', city: 'Zanzibar' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.1920, -6.1550],
          [39.1915, -6.1620],
          [39.1970, -6.1610],
          [39.2080, -6.1740],
          [39.2245, -6.2220],
        ],
      },
    },
  ],
};

function makeBuildingFootprint(
  lng: number,
  lat: number,
  widthDeg: number,
  depthDeg: number,
  heightMeters: number,
  name: string,
  kind: string = 'commercial'
): GeoJSON.Feature<GeoJSON.Polygon> {
  const hw = widthDeg / 2;
  const hd = depthDeg / 2;
  return {
    type: 'Feature',
    properties: {
      name,
      kind,
      render_height: heightMeters,
      render_min_height: 0,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng - hw, lat - hd],
          [lng + hw, lat - hd],
          [lng + hw, lat + hd],
          [lng - hw, lat + hd],
          [lng - hw, lat - hd],
        ],
      ],
    },
  };
}

/**
 * Curated + procedurally densified Tanzania & Dar es Salaam 3D building footprints
 * so Mapbox GL / GeoLibre fill-extrusion renders crisp skylines offline!
 */
export const OFFLINE_3D_BUILDINGS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = (() => {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [
    // Posta CBD Skyline (BoT Twin Towers, PSPF Golden Jubilee, TPA Tower, PPF Tower, NMB HQ, CRDB HQ)
    makeBuildingFootprint(39.2932, -6.8142, 0.00085, 0.00075, 118, 'BoT Twin Towers'),
    makeBuildingFootprint(39.2908, -6.8140, 0.00075, 0.00070, 145, 'TPA One Stop Centre'),
    makeBuildingFootprint(39.2889, -6.8135, 0.00080, 0.00068, 128, 'PSPF Commercial Towers'),
    makeBuildingFootprint(39.2896, -6.8152, 0.00070, 0.00060, 72, 'CRDB & Azikiwe Tower'),
    makeBuildingFootprint(39.2891, -6.8130, 0.00075, 0.00062, 68, 'NMB Head Office'),
    makeBuildingFootprint(39.2918, -6.8163, 0.00065, 0.00055, 88, 'Golden Jubilee Tower'),
    makeBuildingFootprint(39.2872, -6.8159, 0.00072, 0.00058, 64, 'Samora Commercial Block'),
    makeBuildingFootprint(39.2852, -6.8168, 0.00080, 0.00065, 52, 'Posta Mpya Complex'),
    makeBuildingFootprint(39.2962, -6.8172, 0.00090, 0.00070, 38, 'Azam Marine / Kivukoni'),
    // Kariakoo Commercial Core
    makeBuildingFootprint(39.2745, -6.8198, 0.00110, 0.00095, 28, 'Soko Kuu la Kariakoo'),
    makeBuildingFootprint(39.2762, -6.8185, 0.00070, 0.00060, 42, 'Msimbazi Commercial'),
    makeBuildingFootprint(39.2728, -6.8190, 0.00065, 0.00055, 36, 'Congo Street Mall'),
    makeBuildingFootprint(39.2755, -6.8215, 0.00070, 0.00060, 46, 'Uhuru & Swahili Plaza'),
    // Mlimani City & Ubungo
    makeBuildingFootprint(39.2198, -6.7725, 0.00180, 0.00110, 24, 'Mlimani City Mall'),
    makeBuildingFootprint(39.2145, -6.7875, 0.00090, 0.00080, 58, 'Ubungo NSSF / Ubungo Plaza'),
    makeBuildingFootprint(39.2055, -6.7795, 0.00120, 0.00090, 32, 'UDSM Mwalimu Nyerere'),
    // JNIA Airport Terminal 3 & Mwanza / Arusha / Dodoma Landmarks
    makeBuildingFootprint(39.2026, -6.8781, 0.00220, 0.00100, 26, 'JNIA Terminal 3'),
    makeBuildingFootprint(36.6873, -3.3688, 0.00095, 0.00075, 42, 'Arusha AICC Complex'),
    makeBuildingFootprint(35.7478, -6.1731, 0.00130, 0.00095, 36, 'Ukumbi wa Bunge Dodoma'),
    makeBuildingFootprint(32.9058, -2.4956, 0.00140, 0.00090, 28, 'Rock City Mall Mwanza'),
    makeBuildingFootprint(39.1915, -6.1620, 0.00090, 0.00070, 22, 'House of Wonders (Stone Town)'),
  ];

  // Add realistic surrounding city blocks around Posta, Kariakoo, Sinza, Masaki, and Mabibo
  const blockAnchors: Array<{ lat: number; lng: number; cols: number; rows: number; minH: number; maxH: number }> = [
    { lat: -6.8155, lng: 39.2865, cols: 5, rows: 4, minH: 18, maxH: 65 }, // Posta blocks
    { lat: -6.8205, lng: 39.2715, cols: 5, rows: 4, minH: 14, maxH: 42 }, // Kariakoo blocks
    { lat: -6.7855, lng: 39.2285, cols: 4, rows: 3, minH: 9, maxH: 24 },  // Sinza blocks
    { lat: -6.7510, lng: 39.2740, cols: 4, rows: 3, minH: 12, maxH: 34 }, // Masaki blocks
    { lat: -6.8170, lng: 39.2375, cols: 4, rows: 3, minH: 10, maxH: 26 }, // Mabibo / Mandela
  ];

  blockAnchors.forEach((anchor, aIdx) => {
    for (let r = 0; r < anchor.rows; r++) {
      for (let c = 0; c < anchor.cols; c++) {
        const seed = (aIdx + 1) * 31 + r * 17 + c * 13;
        const jitterLat = ((seed % 7) - 3) * 0.00018;
        const jitterLng = (((seed * 3) % 7) - 3) * 0.00018;
        const bLat = anchor.lat + (r - anchor.rows / 2) * 0.00125 + jitterLat;
        const bLng = anchor.lng + (c - anchor.cols / 2) * 0.00135 + jitterLng;
        const h = anchor.minH + ((seed * 19) % Math.max(4, anchor.maxH - anchor.minH));
        features.push(
          makeBuildingFootprint(
            bLng,
            bLat,
            0.00052 + (seed % 3) * 0.0001,
            0.00046 + ((seed + 1) % 3) * 0.00008,
            h,
            `Block-${aIdx}-${r}-${c}`
          )
        );
      }
    }
  });

  return { type: 'FeatureCollection', features };
})();

/**
 * Generates a self-contained Mapbox GL / MapLibre v8 style JSON with ZERO network calls
 * (no external sprite or glyphs URLs so it renders cleanly offline in 2D and 3D).
 */
export function buildOffline3DStyle(
  mode: 'street_3d' | 'satellite' | 'night' | 'lite' | 'bright' = 'street_3d'
): mapboxgl.StyleSpecification {
  const isDark = mode === 'night' || mode === 'satellite';
  const bgColor = isDark ? '#0b1120' : mode === 'lite' ? '#f3f4f6' : '#eef2f6';
  const waterColor = isDark ? '#0c2d48' : '#7dd3fc';
  const roadCasingColor = isDark ? '#1e293b' : '#cbd5e1';
  const trunkColor = isDark ? '#f59e0b' : '#f97316';
  const primaryColor = isDark ? '#38bdf8' : '#fbbf24';
  const secondaryColor = isDark ? '#475569' : '#ffffff';
  const buildingLow = isDark ? '#1e293b' : '#e2e8f0';
  const buildingMid = isDark ? '#334155' : '#cbd5e1';
  const buildingHigh = isDark ? '#475569' : '#94a3b8';

  return {
    version: 8,
    name: `Papo Hapo Offline Vector (${mode})`,
    sources: {
      'papo-offline-water': {
        type: 'geojson',
        data: OFFLINE_COASTLINE_GEOJSON,
      },
      'papo-offline-roads': {
        type: 'geojson',
        data: OFFLINE_ROADS_GEOJSON,
      },
      'papo-offline-buildings': {
        type: 'geojson',
        data: OFFLINE_3D_BUILDINGS_GEOJSON,
      },
      'papo-offline-places': {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: OFFLINE_TZ_PLACES.map((p) => ({
            type: 'Feature',
            properties: { id: p.id, name: p.name, category: p.category },
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          })),
        },
      },
    },
    layers: [
      {
        id: 'offline-background',
        type: 'background',
        paint: { 'background-color': bgColor },
      },
      {
        id: 'offline-water-fill',
        type: 'fill',
        source: 'papo-offline-water',
        paint: {
          'fill-color': waterColor,
          'fill-opacity': isDark ? 0.9 : 0.72,
        },
      },
      {
        id: 'offline-roads-casing',
        type: 'line',
        source: 'papo-offline-roads',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadCasingColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 13, 6, 17, 13],
        },
      },
      {
        id: 'offline-roads-secondary',
        type: 'line',
        source: 'papo-offline-roads',
        filter: ['==', ['get', 'class'], 'secondary'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': secondaryColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 13, 3.2, 17, 7.5],
        },
      },
      {
        id: 'offline-roads-primary',
        type: 'line',
        source: 'papo-offline-roads',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'motorway']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': primaryColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.8, 13, 4.2, 17, 9.5],
        },
      },
      {
        id: 'offline-roads-trunk',
        type: 'line',
        source: 'papo-offline-roads',
        filter: ['==', ['get', 'class'], 'trunk'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': trunkColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 4.8, 17, 10.5],
        },
      },
      {
        id: 'offline-3d-buildings',
        type: 'fill-extrusion',
        source: 'papo-offline-buildings',
        minzoom: 11.5,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'render_height'],
            0,
            buildingLow,
            40,
            buildingMid,
            95,
            buildingHigh,
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11.5,
            0,
            12.8,
            ['coalesce', ['get', 'render_height'], 16],
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      },
      {
        id: 'offline-places-dots',
        type: 'circle',
        source: 'papo-offline-places',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 5.5],
          'circle-color': '#ea580c',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      },
    ],
  };
}
