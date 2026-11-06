import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Compass, Eye, Maximize2, Minimize2, Sun, Moon, Sunset, 
  RotateCcw, Navigation, Volume2, VolumeX, Layers, Car, Bike, 
  Crosshair, ChevronRight, X, Sparkles, MapPin, Building, TreePine, 
  Share2, Shield, Info, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export interface F4Map3DViewProps {
  isOpen?: boolean;
  onClose: () => void;
  center?: [number, number]; // [lat, lng]
  vehicleHeading?: number;
  vehicleType?: 'car' | 'bike' | 'bajaj';
  isOnline?: boolean;
  speed?: number;
  driverName?: string;
  licensePlate?: string;
  activeRide?: any;
  theme?: 'light' | 'dark';
  incomingRequest?: any;
  onAcceptRide?: (ride: any) => void;
  onDeclineRide?: (ride: any) => void;
}

// Preset locations in Dar es Salaam matching user's screenshots
export interface CityHotspot {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  description: string;
  tag: string;
  cameraTilt: number; // in degrees
  cameraDistance: number;
}

const DAR_HOTSPOTS: CityHotspot[] = [
  {
    id: 'mabibo-mandela',
    name: 'Nelson Mandela Rd & Mabibo Relini',
    area: 'Tabata / Mabibo, Dar es Salaam',
    lat: -6.8163,
    lng: 39.2384,
    description: 'Barabara kuu ya Mandela, reli ya Tazara, na vituo vikuu vya biashara',
    tag: 'F4Map Default',
    cameraTilt: 55,
    cameraDistance: 280,
  },
  {
    id: 'tabata-kisiwani',
    name: 'Tabata Kisiwani & Kamoti St',
    area: 'Tabata, Dar es Salaam',
    lat: -6.8225,
    lng: 39.2431,
    description: 'Makazi ya 3D, mitaa ya Kamoti na Mgasa, mitende na zahanati',
    tag: 'Dense 3D Suburb',
    cameraTilt: 60,
    cameraDistance: 190,
  },
  {
    id: 'sam-nujoma',
    name: 'Sam Nujoma Rd & Mlimani City',
    area: 'Ubungo, Dar es Salaam',
    lat: -6.7725,
    lng: 39.2198,
    description: 'Ghorofa za NSSF, Mlimani Mall na chuo kikuu cha UDSM',
    tag: 'Commercial Hub',
    cameraTilt: 50,
    cameraDistance: 320,
  },
  {
    id: 'posta-city',
    name: 'Posta City Centre & Azikiwe St',
    area: 'Ilala, Dar es Salaam',
    lat: -6.8160,
    lng: 39.2890,
    description: 'Maghorofa marefu ya benki kuu na bandari ya Dar es Salaam',
    tag: 'Skyscraper CBD',
    cameraTilt: 48,
    cameraDistance: 350,
  },
  {
    id: 'kariakoo-market',
    name: 'Kariakoo Market & Morogoro Rd',
    area: 'Kariakoo, Dar es Salaam',
    lat: -6.8198,
    lng: 39.2745,
    description: 'Mji mkuu wa kibiashara, mwendokasi (BRT) na masoko makubwa',
    tag: 'Mega Market',
    cameraTilt: 55,
    cameraDistance: 260,
  }
];

// 3D POI Pins matching F4Map screenshot
interface F4Pin3D {
  id: string;
  title: string;
  category: 'school' | 'police' | 'mosque' | 'hospital' | 'commercial' | 'hotel' | 'church';
  icon: string;
  x: number;
  z: number;
  yOffset: number; // Building height
  color: string;
  subtitle: string;
}

const DAR_PINS: F4Pin3D[] = [
  {
    id: 'mary-daycare',
    title: 'Mary Impressive Day Care',
    category: 'school',
    icon: '🏫',
    x: 45,
    z: 32,
    yOffset: 14,
    color: '#3B82F6',
    subtitle: 'Shule ya Awali & Malezi ya Watoto'
  },
  {
    id: 'mabibo-police',
    title: 'Mabibo Relini Police Post',
    category: 'police',
    icon: '👮',
    x: -85,
    z: -40,
    yOffset: 12,
    color: '#EF4444',
    subtitle: 'Kituo cha Polisi Mabibo Relini'
  },
  {
    id: 'tabata-mosque',
    title: 'Tabata Mosque (Msikiti)',
    category: 'mosque',
    icon: '🕌',
    x: -30,
    z: 65,
    yOffset: 18,
    color: '#10B981',
    subtitle: 'Msikiti Mkuu wa Tabata'
  },
  {
    id: 'ramada-complex',
    title: 'Ramada Complex',
    category: 'hotel',
    icon: '🏨',
    x: 120,
    z: -70,
    yOffset: 24,
    color: '#F59E0B',
    subtitle: 'Hoteli & Kituo cha Mikutano'
  },
  {
    id: 'bollore-logistics',
    title: 'Bollore Africa Logistics',
    category: 'commercial',
    icon: '📦',
    x: 170,
    z: -35,
    yOffset: 16,
    color: '#6366F1',
    subtitle: 'Maghala na Usafirishaji Mizigo'
  },
  {
    id: 'varsan-plaza',
    title: 'Varsan Plaza',
    category: 'commercial',
    icon: '🏬',
    x: 80,
    z: -110,
    yOffset: 20,
    color: '#EC4899',
    subtitle: 'Maduka, Ofisi na Huduma za Kifedha'
  },
  {
    id: 'tabata-dispensary',
    title: 'Tabata Kisiwani Dispensary',
    category: 'hospital',
    icon: '🏥',
    x: -110,
    z: 130,
    yOffset: 15,
    color: '#06B6D4',
    subtitle: 'Zahanati na Huduma ya Kwanza 24/7'
  },
  {
    id: 'nida-mosque',
    title: 'Msikiti Wa Nida',
    category: 'mosque',
    icon: '🕌',
    x: 140,
    z: -160,
    yOffset: 16,
    color: '#10B981',
    subtitle: 'Msikiti wa Ijumaa'
  }
];

export default function F4Map3DView({
  isOpen = true,
  onClose,
  center = [-6.8163, 39.2384],
  vehicleHeading = 45,
  vehicleType = 'car',
  isOnline = true,
  speed = 0,
  driverName = 'Dereva Papo Hapo',
  licensePlate = 'T 782 DSK',
  activeRide,
  theme = 'light',
  incomingRequest,
  onAcceptRide,
  onDeclineRide
}: F4Map3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // View & Lighting Controls
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('day');
  const [cameraMode, setCameraMode] = useState<'isometric' | 'chase' | 'birdseye' | 'free'>('isometric');
  const [activeHotspot, setActiveHotspot] = useState<CityHotspot>(DAR_HOTSPOTS[0]);
  const [selectedPin, setSelectedPin] = useState<F4Pin3D | null>(null);
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState(false);
  const [showControlsDrawer, setShowControlsDrawer] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [showTrees, setShowTrees] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [laneGuidanceActive, setLaneGuidanceActive] = useState(true);
  const [cameraAngleDeg, setCameraAngleDeg] = useState(35);
  const [currentZoomDist, setCurrentZoomDist] = useState(250);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const vehicleGroupRef = useRef<THREE.Group | null>(null);
  const trafficCarsRef = useRef<THREE.Group[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const treeInstancesRef = useRef<THREE.Group | null>(null);

  // Pointer & Touch Controls Interaction Math
  const isPointerDownRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartAngleRef = useRef<number | null>(null);

  // Spherical camera coordinates
  const sphericalRef = useRef({
    radius: 260,
    theta: THREE.MathUtils.degToRad(40), // Azimuth
    phi: THREE.MathUtils.degToRad(52)    // Polar tilt
  });

  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // -------------------------------------------------------------
  // BUILD PROCEDURAL 3D PALM TREE (Phoenix dactylifera)
  // -------------------------------------------------------------
  const createPalmTree = useCallback((height: number = 8, scale: number = 1): THREE.Group => {
    const palm = new THREE.Group();

    // Curved Trunk
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.random() * 0.6 - 0.3, height * 0.4, Math.random() * 0.6 - 0.3),
      new THREE.Vector3(Math.random() * 0.8 - 0.4, height * 0.75, Math.random() * 0.8 - 0.4),
      new THREE.Vector3(Math.random() * 0.6 - 0.3, height, Math.random() * 0.6 - 0.3)
    ]);

    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.35 * scale, 7, false);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6e5239,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    palm.add(trunkMesh);

    // Palm Crown (Leaves / Fronds)
    const topPoint = trunkCurve.getPoint(1);
    const leavesCount = 9;
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e6b2c,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < leavesCount; i++) {
      const angle = (i / leavesCount) * Math.PI * 2;
      const leafLength = 4.5 * scale;
      const leafCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(topPoint.x, topPoint.y, topPoint.z),
        new THREE.Vector3(
          topPoint.x + Math.cos(angle) * (leafLength * 0.5),
          topPoint.y + 0.8 * scale,
          topPoint.z + Math.sin(angle) * (leafLength * 0.5)
        ),
        new THREE.Vector3(
          topPoint.x + Math.cos(angle) * leafLength,
          topPoint.y - 1.2 * scale,
          topPoint.z + Math.sin(angle) * leafLength
        )
      ]);
      const leafGeo = new THREE.TubeGeometry(leafCurve, 8, 0.28 * scale, 4, false);
      const leafMesh = new THREE.Mesh(leafGeo, leafMat);
      leafMesh.castShadow = true;
      palm.add(leafMesh);
    }

    return palm;
  }, []);

  // -------------------------------------------------------------
  // BUILD VEHICLE MODEL (Procedural Clay / Modern F4Map Style)
  // -------------------------------------------------------------
  const createVehicleMesh = useCallback((type: 'car' | 'bike' | 'bajaj'): THREE.Group => {
    const group = new THREE.Group();

    if (type === 'bike') {
      // Bodaboda Motorcycle
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.4, metalness: 0.6 });
      const frameGeo = new THREE.BoxGeometry(0.8, 1.2, 2.8);
      const frame = new THREE.Mesh(frameGeo, bodyMat);
      frame.position.y = 1.0;
      frame.castShadow = true;
      group.add(frame);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const w1 = new THREE.Mesh(wheelGeo, wheelMat);
      w1.rotation.z = Math.PI / 2;
      w1.position.set(0, 0.5, 1.1);
      w1.castShadow = true;
      group.add(w1);

      const w2 = w1.clone();
      w2.position.z = -1.1;
      group.add(w2);
    } else if (type === 'bajaj') {
      // TukTuk / Bajaj
      const bajajMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.5, metalness: 0.3 });
      const cabinGeo = new THREE.BoxGeometry(1.8, 2.0, 3.2);
      const cabin = new THREE.Mesh(cabinGeo, bajajMat);
      cabin.position.y = 1.4;
      cabin.castShadow = true;
      group.add(cabin);

      const roofGeo = new THREE.BoxGeometry(2.0, 0.3, 3.4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1E293B });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 2.5;
      group.add(roof);
    } else {
      // Modern Taxi Sedan (Clay / Clean F4Map Style)
      const carMat = new THREE.MeshStandardMaterial({ 
        color: 0x2563EB, 
        roughness: 0.3, 
        metalness: 0.4 
      });
      const glassMat = new THREE.MeshStandardMaterial({ 
        color: 0x1E293B, 
        roughness: 0.1, 
        metalness: 0.9 
      });

      // Lower chassis
      const chassisGeo = new THREE.BoxGeometry(2.4, 0.9, 5.0);
      const chassis = new THREE.Mesh(chassisGeo, carMat);
      chassis.position.y = 0.8;
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      group.add(chassis);

      // Cabin / Roof
      const cabinGeo = new THREE.BoxGeometry(2.1, 0.85, 2.8);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 1.6, -0.2);
      cabin.castShadow = true;
      group.add(cabin);

      // Roof taxi sign
      const signGeo = new THREE.BoxGeometry(0.9, 0.25, 0.35);
      const signMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, emissive: 0x78350F });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 2.15, -0.2);
      group.add(sign);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.8 });
      const wheelPositions = [
        [-1.25, 0.48, 1.6],
        [1.25, 0.48, 1.6],
        [-1.25, 0.48, -1.6],
        [1.25, 0.48, -1.6]
      ];
      wheelPositions.forEach(pos => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(pos[0], pos[1], pos[2]);
        w.castShadow = true;
        group.add(w);
      });

      // Headlights
      const headMat = new THREE.MeshStandardMaterial({ color: 0xFFFBEB, emissive: 0xFFFFFF, emissiveIntensity: 0.8 });
      const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
      hl1.position.set(-0.8, 0.8, 2.52);
      group.add(hl1);
      const hl2 = hl1.clone();
      hl2.position.x = 0.8;
      group.add(hl2);
    }

    // Vehicle radar circle / orientation ring on road
    const radarGeo = new THREE.RingGeometry(3.5, 3.8, 32);
    const radarMat = new THREE.MeshBasicMaterial({ 
      color: 0x10B981, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.6 
    });
    const radar = new THREE.Mesh(radarGeo, radarMat);
    radar.rotation.x = -Math.PI / 2;
    radar.position.y = 0.05;
    group.add(radar);

    return group;
  }, []);

  // -------------------------------------------------------------
  // BUILD PROCEDURAL 3D CITY (Nelson Mandela Rd, Tabata, Mabibo)
  // -------------------------------------------------------------
  const buildCityScene = useCallback((scene: THREE.Scene) => {
    // 1. Ground Plane (Asphalt & Terrain)
    const groundGeo = new THREE.PlaneGeometry(1000, 1000, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xc4c7cb, // Clean architectural grey ground (F4Map signature look)
      roughness: 0.85,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. Green Parkland / Verges
    const parkGeo = new THREE.PlaneGeometry(260, 160);
    const parkMat = new THREE.MeshStandardMaterial({
      color: 0x8aa869, // Olive/lush green matching screenshot
      roughness: 0.9,
      metalness: 0.05
    });
    const park1 = new THREE.Mesh(parkGeo, parkMat);
    park1.rotation.x = -Math.PI / 2;
    park1.position.set(130, 0.02, 120);
    park1.receiveShadow = true;
    scene.add(park1);

    // 3. Nelson Mandela Dual-Carriageway Highway (6 lanes)
    const mandelaRoadGeo = new THREE.PlaneGeometry(42, 900);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x474e57, // Slate asphalt
      roughness: 0.7,
      metalness: 0.2
    });
    const mandelaRoad = new THREE.Mesh(mandelaRoadGeo, roadMat);
    mandelaRoad.rotation.x = -Math.PI / 2;
    mandelaRoad.rotation.z = Math.PI / 5.2; // Angled diagonal like screenshot
    mandelaRoad.position.set(0, 0.05, 0);
    mandelaRoad.receiveShadow = true;
    scene.add(mandelaRoad);

    // Central median divider on Mandela Rd
    const medianGeo = new THREE.BoxGeometry(2.0, 0.5, 900);
    const medianMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.8 });
    const median = new THREE.Mesh(medianGeo, medianMat);
    median.rotation.y = -Math.PI / 5.2;
    median.position.set(0, 0.25, 0);
    scene.add(median);

    // White dashed lane markings
    const laneMarkerGeo = new THREE.BoxGeometry(0.4, 0.08, 6.0);
    const laneMarkerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const lanesGroup = new THREE.Group();
    for (let z = -400; z < 400; z += 18) {
      // Left lane divider
      const markL = new THREE.Mesh(laneMarkerGeo, laneMarkerMat);
      markL.position.set(-8, 0.09, z);
      lanesGroup.add(markL);

      // Right lane divider
      const markR = new THREE.Mesh(laneMarkerGeo, laneMarkerMat);
      markR.position.set(8, 0.09, z);
      lanesGroup.add(markR);
    }
    lanesGroup.rotation.y = -Math.PI / 5.2;
    scene.add(lanesGroup);

    // 4. Secondary Neighborhood Streets (Kamoti, Mgasa, Chanzi, Mwayiva)
    const streetDefs = [
      { name: 'Kamoti St', width: 14, length: 380, rot: Math.PI / 2.6, x: -70, z: 90 },
      { name: 'Mgasa St', width: 12, length: 420, rot: -Math.PI / 3.4, x: -30, z: 140 },
      { name: 'Chanzi St', width: 12, length: 350, rot: Math.PI / 4, x: -120, z: 200 },
      { name: 'Mabibo Cross', width: 16, length: 500, rot: -Math.PI / 3.8, x: -60, z: -50 }
    ];

    streetDefs.forEach(st => {
      const stGeo = new THREE.PlaneGeometry(st.width, st.length);
      const stMesh = new THREE.Mesh(stGeo, roadMat);
      stMesh.rotation.x = -Math.PI / 2;
      stMesh.rotation.z = st.rot;
      stMesh.position.set(st.x, 0.04, st.z);
      stMesh.receiveShadow = true;
      scene.add(stMesh);
    });

    // 5. Tazara / Relini Railway Tracks crossing Nelson Mandela Road
    const trackGeo = new THREE.PlaneGeometry(6, 600);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const tracks = new THREE.Mesh(trackGeo, trackMat);
    tracks.rotation.x = -Math.PI / 2;
    tracks.rotation.z = -Math.PI / 1.7;
    tracks.position.set(-40, 0.06, -70);
    scene.add(tracks);

    // Railway Sleepers (ties)
    const sleeperGeo = new THREE.BoxGeometry(4.5, 0.15, 0.7);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const sleeperGroup = new THREE.Group();
    for (let i = -250; i < 250; i += 3.5) {
      const s = new THREE.Mesh(sleeperGeo, sleeperMat);
      s.position.set(0, 0.1, i);
      sleeperGroup.add(s);
    }
    sleeperGroup.rotation.y = Math.PI / 1.7;
    sleeperGroup.position.set(-40, 0, -70);
    scene.add(sleeperGroup);

    // 6. Extruded 3D Buildings (F4Map Signature Architectural Blocks)
    // Create diverse materials for realism
    const buildingMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xD6D9E0, roughness: 0.6, metalness: 0.15 }), // Crisp light grey
      new THREE.MeshStandardMaterial({ color: 0xC5CCD8, roughness: 0.5, metalness: 0.2 }),  // Cool blue-grey
      new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.7, metalness: 0.1 }),  // Clean white-grey
      new THREE.MeshStandardMaterial({ color: 0xB0B8C4, roughness: 0.55, metalness: 0.25 })  // Slate shadow tone
    ];

    const roofMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x838B98, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.85 })
    ];

    const buildingsGroup = new THREE.Group();

    // Procedural grid distribution of buildings matching density in screenshots
    const buildingPositions = [
      // Major complexes along Nelson Mandela Road
      { x: 120, z: -70, w: 55, d: 40, h: 26, mat: 0, roof: 0 }, // Ramada Complex
      { x: 170, z: -35, w: 75, d: 50, h: 18, mat: 1, roof: 1 }, // Bollore Africa Logistics
      { x: 80, z: -110, w: 60, d: 45, h: 22, mat: 2, roof: 0 }, // Varsan Plaza
      { x: 140, z: -160, w: 45, d: 38, h: 18, mat: 0, roof: 2 }, // Msikiti wa Nida
      { x: -85, z: -40, w: 35, d: 28, h: 14, mat: 2, roof: 1 }, // Mabibo Relini Police Post
      { x: -30, z: 65, w: 40, d: 35, h: 20, mat: 1, roof: 2 }, // Tabata Mosque
      { x: 45, z: 32, w: 30, d: 25, h: 15, mat: 0, roof: 0 }, // Mary Impressive Day Care
      { x: -110, z: 130, w: 32, d: 26, h: 16, mat: 3, roof: 1 } // Tabata Dispensary
    ];

    // Add residential clusters (dense Tabata Kisiwani blocks)
    for (let rz = 20; rz < 280; rz += 32) {
      for (let rx = -260; rx < -50; rx += 28) {
        // Displace slightly to mimic real organic streets
        const jx = (Math.sin(rx * 0.1) * 6) + (Math.cos(rz * 0.2) * 5);
        const jz = (Math.cos(rx * 0.15) * 6);
        const bw = 16 + (Math.abs(Math.sin(rx + rz)) * 14);
        const bd = 14 + (Math.abs(Math.cos(rx * 2)) * 12);
        const bh = 9 + (Math.abs(Math.sin(rx * 3 + rz)) * 18);
        const matIdx = Math.floor(Math.abs(Math.sin(rx)) * buildingMaterials.length);
        const roofIdx = Math.floor(Math.abs(Math.cos(rz)) * roofMaterials.length);

        buildingPositions.push({
          x: rx + jx,
          z: rz + jz,
          w: bw,
          d: bd,
          h: bh,
          mat: matIdx,
          roof: roofIdx
        });
      }
    }

    // Add industrial / commercial warehouses along east side of Mandela Rd
    for (let rz = -260; rz < 40; rz += 48) {
      for (let rx = 70; rx < 240; rx += 55) {
        if (Math.abs(rx - 120) < 30 && Math.abs(rz - (-70)) < 25) continue;
        const bw = 35 + (Math.sin(rx) * 15);
        const bd = 30 + (Math.cos(rz) * 12);
        const bh = 14 + (Math.abs(Math.sin(rx + rz)) * 14);

        buildingPositions.push({
          x: rx,
          z: rz,
          w: bw,
          d: bd,
          h: bh,
          mat: 1,
          roof: 1
        });
      }
    }

    // Instantiate 3D building meshes
    buildingPositions.forEach(b => {
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bMesh = new THREE.Mesh(bGeo, buildingMaterials[b.mat]);
      bMesh.position.set(b.x, b.h / 2, b.z);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;

      // Parapet / Roof Border for architectural realism
      const parapetGeo = new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4);
      const parapet = new THREE.Mesh(parapetGeo, roofMaterials[b.roof]);
      parapet.position.set(0, b.h / 2 + 0.2, 0);
      bMesh.add(parapet);

      // Subtle HVAC / Roof Tank
      if (b.h > 15) {
        const tankGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.0, 8);
        const tankMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(b.w * 0.2, b.h / 2 + 1.2, b.d * 0.2);
        bMesh.add(tank);
      }

      buildingsGroup.add(bMesh);
    });

    scene.add(buildingsGroup);

    // 7. Add 3D Palm Trees (Phoenix dactylifera) around streets & Mary Impressive Day Care
    const treeGroup = new THREE.Group();
    const palmLocations = [
      // Exact palm next to Mary Impressive Day Care (seen in image_b3f369c2.png)
      { x: 58, z: 28, h: 10, scale: 1.15 },
      { x: 52, z: 38, h: 9, scale: 1.0 },
      // Tabata Kisiwani neighborhood palms
      { x: -50, z: 80, h: 8.5, scale: 1.0 },
      { x: -80, z: 110, h: 9.2, scale: 1.1 },
      { x: -65, z: 125, h: 8.0, scale: 0.95 },
      { x: -115, z: 145, h: 10.0, scale: 1.2 },
      { x: -40, z: 160, h: 8.5, scale: 1.0 },
      { x: -95, z: 180, h: 9.0, scale: 1.05 },
      { x: 120, z: 100, h: 11.0, scale: 1.3 },
      { x: 140, z: 130, h: 10.5, scale: 1.2 },
      { x: 160, z: 110, h: 9.8, scale: 1.1 }
    ];

    palmLocations.forEach(loc => {
      const palm = createPalmTree(loc.h, loc.scale);
      palm.position.set(loc.x, 0, loc.z);
      treeGroup.add(palm);
    });

    treeInstancesRef.current = treeGroup;
    scene.add(treeGroup);

    // 8. 3D AR Navigation Route Ribbon (Blue guidance track matching image_16f169ca.png)
    const routeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12, 180),
      new THREE.Vector3(0, 0.12, 50),
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(-15, 0.12, -80),
      new THREE.Vector3(-50, 0.12, -160)
    ]);

    const ribbonGeo = new THREE.TubeGeometry(routeCurve, 64, 2.2, 4, false);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x3B82F6,
      transparent: true,
      opacity: 0.85
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.scale.set(1, 0.05, 1); // Flatten to asphalt
    scene.add(ribbonMesh);

    // 9. Ambient Traffic Vehicles (Moving along Nelson Mandela Road)
    trafficCarsRef.current = [];
    const trafficColors = [0xEF4444, 0x10B981, 0xF59E0B, 0x6B7280, 0x2563EB];
    for (let i = 0; i < 6; i++) {
      const carGroup = new THREE.Group();
      const carMat = new THREE.MeshStandardMaterial({ 
        color: trafficColors[i % trafficColors.length], 
        roughness: 0.4 
      });
      const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.6), carMat);
      carBody.position.y = 0.8;
      carBody.castShadow = true;
      carGroup.add(carBody);

      // Start positions along Mandela road
      const zPos = -200 + (i * 80);
      const side = (i % 2 === 0) ? -7 : 7;
      carGroup.position.set(side, 0, zPos);
      carGroup.rotation.y = (side > 0) ? -Math.PI / 5.2 : Math.PI - Math.PI / 5.2;
      scene.add(carGroup);
      trafficCarsRef.current.push(carGroup);
    }
  }, [createPalmTree]);

  // -------------------------------------------------------------
  // INITIALIZE THREE.JS ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(timeOfDay === 'night' ? 0x0B0F19 : timeOfDay === 'sunset' ? 0xFDE68A : 0xDFE3E8);
    scene.fog = new THREE.FogExp2(
      timeOfDay === 'night' ? 0x0B0F19 : timeOfDay === 'sunset' ? 0xFDE68A : 0xDFE3E8, 
      0.0018
    );
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 2, 2000);
    cameraRef.current = camera;

    // 3. Renderer with soft shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d96a0, 0.6);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    dirLight.position.set(150, 250, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 800;
    const d = 260;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    directionalLightRef.current = dirLight;

    // 5. Populate Procedural 3D City
    buildCityScene(scene);

    // 6. Driver Vehicle Avatar
    const vehicle = createVehicleMesh(vehicleType);
    vehicle.position.set(0, 0, 0);
    vehicle.rotation.y = THREE.MathUtils.degToRad(vehicleHeading);
    scene.add(vehicle);
    vehicleGroupRef.current = vehicle;

    // Update Camera position initially
    const updateCameraPos = () => {
      const { radius, theta, phi } = sphericalRef.current;
      const target = cameraTargetRef.current;
      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = target.y + radius * Math.cos(phi);
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(target);
      setCameraAngleDeg(Math.round(THREE.MathUtils.radToDeg(theta) % 360));
      setCurrentZoomDist(Math.round(radius));
    };

    updateCameraPos();

    // 7. Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Animate ambient traffic cars
      if (showTraffic && trafficCarsRef.current.length > 0) {
        trafficCarsRef.current.forEach((car, idx) => {
          const speed = (idx % 2 === 0 ? 32 : -28) * delta;
          car.translateZ(speed);
          if (car.position.z > 350) car.position.z = -350;
          if (car.position.z < -350) car.position.z = 350;
        });
      }

      // Chase camera mode follows vehicle
      if (cameraMode === 'chase' && vehicleGroupRef.current) {
        const vPos = vehicleGroupRef.current.position;
        cameraTargetRef.current.lerp(vPos, 0.08);
        const headingRad = vehicleGroupRef.current.rotation.y;
        sphericalRef.current.theta = headingRad + Math.PI;
        sphericalRef.current.phi = THREE.MathUtils.degToRad(68);
        sphericalRef.current.radius = 65;
        updateCameraPos();
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Observer
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
      }
    };
  }, [buildCityScene, createVehicleMesh, vehicleType, vehicleHeading]);

  // -------------------------------------------------------------
  // TIME OF DAY LIGHTING UPDATER
  // -------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !directionalLightRef.current || !ambientLightRef.current) return;
    const dirLight = directionalLightRef.current;
    const ambLight = ambientLightRef.current;
    const scene = sceneRef.current;

    if (timeOfDay === 'day') {
      scene.background = new THREE.Color(0xDFE3E8);
      scene.fog = new THREE.FogExp2(0xDFE3E8, 0.0018);
      dirLight.color.setHex(0xFFFAED);
      dirLight.intensity = 1.45;
      dirLight.position.set(160, 260, 100);
      ambLight.intensity = 0.45;
    } else if (timeOfDay === 'sunset') {
      scene.background = new THREE.Color(0xFBBF24);
      scene.fog = new THREE.FogExp2(0xF59E0B, 0.0022);
      dirLight.color.setHex(0xFB923C);
      dirLight.intensity = 1.6;
      dirLight.position.set(220, 80, 120); // Long low shadows
      ambLight.intensity = 0.35;
    } else {
      // Night 3D
      scene.background = new THREE.Color(0x0F172A);
      scene.fog = new THREE.FogExp2(0x0F172A, 0.0028);
      dirLight.color.setHex(0x38BDF8);
      dirLight.intensity = 0.35;
      ambLight.intensity = 0.2;
    }
  }, [timeOfDay]);

  // -------------------------------------------------------------
  // CAMERA PRESETS
  // -------------------------------------------------------------
  const applyCameraPreset = (preset: 'isometric' | 'chase' | 'birdseye' | 'free') => {
    setCameraMode(preset);
    const camera = cameraRef.current;
    if (!camera) return;

    if (preset === 'isometric') {
      sphericalRef.current = {
        radius: 250,
        theta: THREE.MathUtils.degToRad(42),
        phi: THREE.MathUtils.degToRad(52) // 45° - 55° F4Map tilt
      };
      cameraTargetRef.current.set(0, 0, 0);
    } else if (preset === 'chase') {
      sphericalRef.current = {
        radius: 65,
        theta: THREE.MathUtils.degToRad(vehicleHeading + 180),
        phi: THREE.MathUtils.degToRad(68) // Cinematic road level
      };
      if (vehicleGroupRef.current) {
        cameraTargetRef.current.copy(vehicleGroupRef.current.position);
      }
    } else if (preset === 'birdseye') {
      sphericalRef.current = {
        radius: 340,
        theta: 0,
        phi: THREE.MathUtils.degToRad(15) // Top down
      };
      cameraTargetRef.current.set(0, 0, 0);
    }

    const { radius, theta, phi } = sphericalRef.current;
    const target = cameraTargetRef.current;
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);

    setCameraAngleDeg(Math.round(THREE.MathUtils.radToDeg(theta) % 360));
    setCurrentZoomDist(Math.round(radius));
  };

  // -------------------------------------------------------------
  // TOUCH & MOUSE INTERACTION (Rotate, Tilt, Pinch-Zoom)
  // -------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current || !cameraRef.current) return;
    const deltaX = e.clientX - lastPointerPosRef.current.x;
    const deltaY = e.clientY - lastPointerPosRef.current.y;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

    // Azimuth rotation (around Y axis)
    sphericalRef.current.theta -= deltaX * 0.006;

    // Polar pitch tilt (clamp between 15° and 85°)
    sphericalRef.current.phi = THREE.MathUtils.clamp(
      sphericalRef.current.phi + deltaY * 0.005,
      THREE.MathUtils.degToRad(15),
      THREE.MathUtils.degToRad(82)
    );

    const camera = cameraRef.current;
    const { radius, theta, phi } = sphericalRef.current;
    const target = cameraTargetRef.current;
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);

    setCameraAngleDeg(Math.round(THREE.MathUtils.radToDeg(theta) % 360));
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    sphericalRef.current.radius = THREE.MathUtils.clamp(
      sphericalRef.current.radius + e.deltaY * 0.25,
      35,
      600
    );
    const camera = cameraRef.current;
    const { radius, theta, phi } = sphericalRef.current;
    const target = cameraTargetRef.current;
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);
    setCurrentZoomDist(Math.round(radius));
  };

  // -------------------------------------------------------------
  // RESET NORTH
  // -------------------------------------------------------------
  const resetNorth = () => {
    if (!cameraRef.current) return;
    sphericalRef.current.theta = 0;
    const camera = cameraRef.current;
    const { radius, theta, phi } = sphericalRef.current;
    const target = cameraTargetRef.current;
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);
    setCameraAngleDeg(0);
    toast.success("🧭 Kaskazini Juu (North-Up) imesawazishwa!");
  };

  // -------------------------------------------------------------
  // TELEPORT TO DAR ES SALAAM HOTSPOT
  // -------------------------------------------------------------
  const teleportToHotspot = (spot: CityHotspot) => {
    setActiveHotspot(spot);
    setShowHotspotsDrawer(false);
    sphericalRef.current.radius = spot.cameraDistance;
    sphericalRef.current.phi = THREE.MathUtils.degToRad(spot.cameraTilt);
    applyCameraPreset('isometric');
    toast.info(`🏙️ Umefika: ${spot.name}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-neutral-900 overflow-hidden select-none touch-none flex flex-col">
      {/* Top Floating App Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
        {/* Left: Branding & Current Landmark */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button
            onClick={onClose}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-white active:scale-95 transition-all cursor-pointer"
            title="Rudi Ramani ya Kawaida (2D)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xs shadow-md">
              F4
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-tight">F4Map 3D Real-City</span>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  OpenStreetMap
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-medium truncate max-w-[170px] sm:max-w-[260px]">
                {activeHotspot.name}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Time of Day Switcher */}
          <div className="flex items-center bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl p-1 border border-neutral-200 dark:border-neutral-800 shadow-xl">
            <button
              onClick={() => setTimeOfDay('day')}
              className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer ${timeOfDay === 'day' ? 'bg-amber-500 text-white shadow-xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              title="Mchana (Daylight)"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTimeOfDay('sunset')}
              className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer ${timeOfDay === 'sunset' ? 'bg-orange-500 text-white shadow-xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              title="Jioni (Golden Hour Sunset)"
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTimeOfDay('night')}
              className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer ${timeOfDay === 'night' ? 'bg-indigo-600 text-white shadow-xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              title="Usiku (Night 3D)"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>

          {/* Hotspots Modal Drawer Trigger */}
          <button
            onClick={() => setShowHotspotsDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-orange-950/30 active:scale-95 transition-all cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Maeneo ya DSM</span>
          </button>
        </div>
      </div>

      {/* Main WebGL Three.js Canvas Container */}
      <div 
        ref={mountRef} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* 3D Elevated Pin Overlays (Billboard HTML Stems) */}
      {showPins && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {DAR_PINS.map((pin, pIdx) => (
            <div
              key={`f4-pin-${pin.id}-${pIdx}`}
              onClick={() => setSelectedPin(pin)}
              className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-full transition-transform hover:scale-110 active:scale-95 cursor-pointer group"
              style={{
                // Approximate screen projection offset for sample pins
                left: `calc(50% + ${pin.x * 2.2}px)`,
                top: `calc(55% + ${pin.z * 1.4}px - ${pin.yOffset * 3.5}px)`
              }}
            >
              {/* Elevated Pin Card matching user's Mary Impressive Day Care screenshot */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-300 dark:border-neutral-700 shadow-xl group-hover:border-orange-500 transition-colors">
                  <span className="text-xs">{pin.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-900 dark:text-white whitespace-nowrap">
                    {pin.title}
                  </span>
                </div>
                {/* Thin vertical stem line to roof (matching screenshot) */}
                <div className="w-[1.5px] h-8 sm:h-12 bg-neutral-600/80 dark:bg-neutral-400/80 shadow-sm" />
                <div className="w-1.5 h-1.5 rounded-full bg-orange-600 shadow-xs" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AR Distance Tag Simulation matching user's image_16f169ca.png ("20 ft" / Turn Guidance) */}
      {laneGuidanceActive && cameraMode === 'chase' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-16 pointer-events-none z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-orange-500 shadow-2xl text-orange-600 font-black text-xs"
          >
            <span className="animate-pulse">((((</span>
            <span>20 ft • Nyoosha Mbele</span>
          </motion.div>
        </div>
      )}

      {/* Right Side Navigation & View Controls Floating HUD */}
      <div className="absolute right-3 sm:right-4 top-20 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* 360° Compass Bezel */}
        <button
          onClick={resetNorth}
          className="w-11 h-11 rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl flex flex-col items-center justify-center hover:bg-white active:scale-95 transition-all group cursor-pointer"
          title="Kaskazini Juu (Reset North 0°)"
        >
          <Compass 
            className="w-5 h-5 text-orange-600 transition-transform duration-300" 
            style={{ transform: `rotate(${-cameraAngleDeg}deg)` }}
          />
          <span className="text-[8px] font-mono font-black text-neutral-700 dark:text-neutral-300 mt-0.5">
            {cameraAngleDeg}°
          </span>
        </button>

        {/* Camera Preset Switcher */}
        <div className="flex flex-col bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl p-1 border border-neutral-200 dark:border-neutral-800 shadow-xl gap-1">
          <button
            onClick={() => applyCameraPreset('isometric')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] uppercase transition-all cursor-pointer ${cameraMode === 'isometric' ? 'bg-orange-600 text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            title="Mtazamo wa F4Map (Isometric 45°)"
          >
            45°
          </button>
          <button
            onClick={() => applyCameraPreset('chase')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] uppercase transition-all cursor-pointer ${cameraMode === 'chase' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            title="Dereva / Mwelekeo wa Barabara (Chase Navigation)"
          >
            <Car className="w-4 h-4" />
          </button>
          <button
            onClick={() => applyCameraPreset('birdseye')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] uppercase transition-all cursor-pointer ${cameraMode === 'birdseye' ? 'bg-emerald-600 text-white shadow-xs' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            title="Juu Kabisa (Top Down Bird's Eye)"
          >
            TOP
          </button>
        </div>

        {/* Zoom In / Zoom Out */}
        <div className="flex flex-col bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl p-1 border border-neutral-200 dark:border-neutral-800 shadow-xl gap-1">
          <button
            onClick={() => {
              sphericalRef.current.radius = Math.max(35, sphericalRef.current.radius - 40);
              applyCameraPreset(cameraMode);
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            title="Kuza Ramani (+)"
          >
            +
          </button>
          <button
            onClick={() => {
              sphericalRef.current.radius = Math.min(550, sphericalRef.current.radius + 40);
              applyCameraPreset(cameraMode);
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            title="Punguza Ramani (-)"
          >
            -
          </button>
        </div>

        {/* Feature Toggles (Pins, Trees, Traffic) */}
        <button
          onClick={() => setShowPins(!showPins)}
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition-all cursor-pointer ${showPins ? 'bg-orange-500/15 border-orange-500 text-orange-600' : 'bg-white/90 dark:bg-neutral-900/90 border-neutral-200 dark:border-neutral-800 text-neutral-400'}`}
          title="Washa/Zima Majina ya Majengo (3D Billboard Pins)"
        >
          <Building className="w-5 h-5" />
        </button>
      </div>

      {/* Real Live Incoming Ride Request Alert inside F4Map 3D View */}
      <AnimatePresence>
        {incomingRequest && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="absolute top-16 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-50 p-4 rounded-3xl bg-neutral-900/95 backdrop-blur-xl border-2 border-emerald-500 shadow-2xl text-white space-y-3 pointer-events-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Ombi la Safari Mpya Liko Hapa! 🔔
                </span>
              </div>
              <span className="text-sm font-black font-mono text-emerald-400">
                TZS {(incomingRequest.price || incomingRequest.fare || 12000).toLocaleString()}
              </span>
            </div>

            <div className="text-xs text-neutral-300 space-y-1">
              <p>📍 <strong>Kuanzia:</strong> {incomingRequest.pickupAddress || incomingRequest.pickupName || 'Eneo la Mteja'}</p>
              <p>🏁 <strong>Kuelekea:</strong> {incomingRequest.destinationAddress || incomingRequest.destName || 'Mwisho wa Safari'}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onDeclineRide?.(incomingRequest)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase cursor-pointer"
              >
                Kataa
              </button>
              <button
                type="button"
                onClick={() => onAcceptRide?.(incomingRequest)}
                className="flex-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Pokea Safari Sasa ✅
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Driver Speedometer & HUD Card */}
      <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pointer-events-none">
        {/* Left: Driver Telemetry & Active Status */}
        <div className="p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-800 shadow-2xl flex items-center justify-between sm:justify-start gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-orange-950/30">
              {vehicleType === 'bike' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                  {driverName}
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                Namba: <strong className="text-neutral-800 dark:text-neutral-200">{licensePlate}</strong> • Mwelekeo: <strong>{vehicleHeading}°</strong>
              </p>
            </div>
          </div>

          <div className="pl-4 border-l border-neutral-200 dark:border-neutral-800 text-right">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">Kasi (Speed)</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-orange-600 dark:text-orange-400">
              {speed} <span className="text-xs font-normal text-neutral-500">km/h</span>
            </span>
          </div>
        </div>

        {/* Right: Quick Action Return Button & Info */}
        <div className="flex items-center justify-end gap-2 pointer-events-auto">
          <button
            onClick={onClose}
            className="h-12 px-5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-orange-950/40 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Rudi Ramani ya 2D</span>
          </button>
        </div>
      </div>

      {/* Selected Landmark Details Card Modal */}
      <AnimatePresence>
        {selectedPin && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="absolute bottom-24 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-30 p-4 sm:p-5 rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-3 pointer-events-auto"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-md text-white"
                  style={{ backgroundColor: selectedPin.color }}
                >
                  {selectedPin.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                    {selectedPin.title}
                  </h3>
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    {selectedPin.subtitle}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPin(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center hover:bg-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Jengo la 3D lililothibitishwa kupitia OpenStreetMap data ya Dar es Salaam. Urefu wa muundo: {selectedPin.yOffset}m.
            </p>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-400">
                Lat: {center[0].toFixed(4)}, Lng: {center[1].toFixed(4)}
              </span>
              <button
                onClick={() => {
                  toast.success(`Umeanzisha urambazaji kuelekea ${selectedPin.title}!`);
                  setSelectedPin(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
              >
                <span>Elekea Hapa</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dar es Salaam Hotspots Drawer */}
      <AnimatePresence>
        {showHotspotsDrawer && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                    Maeneo ya 3D ya Dar es Salaam
                  </h3>
                  <p className="text-xs text-neutral-500">Chagua eneo la kufungua kwenye mtazamo wa F4Map 3D</p>
                </div>
                <button
                  onClick={() => setShowHotspotsDrawer(false)}
                  className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {DAR_HOTSPOTS.map((spot, sIdx) => (
                  <button
                    key={`f4-spot-${spot.id}-${sIdx}`}
                    onClick={() => teleportToHotspot(spot)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${activeHotspot.id === spot.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">{spot.name}</span>
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600">
                          {spot.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{spot.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
