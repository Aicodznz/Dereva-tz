import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Box, Eye, Sparkles, Layers, Sliders, Camera, 
  RotateCw, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  Upload, Download, ExternalLink, Sun, Moon, Info,
  Check, Play, Pause, Compass, Ruler, RefreshCw,
  ShoppingBag, Hotel, Car, Bus
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { toast } from 'sonner';

interface SuperSplatViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScene?: 'hotel' | 'car' | 'product' | 'terminal';
}

export type ScenePreset = 'hotel' | 'car' | 'product' | 'terminal';

export default function SuperSplatViewerModal({
  isOpen,
  onClose,
  initialScene = 'hotel'
}: SuperSplatViewerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeScene, setActiveScene] = useState<ScenePreset>(initialScene);
  const [pointSize, setPointSize] = useState<number>(1.2);
  const [exposure, setExposure] = useState<number>(1.0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'firstperson' | 'topdown'>('orbit');
  const [renderMode, setRenderMode] = useState<'splat' | 'wireframe' | 'solid'>('splat');
  const [bgTheme, setBgTheme] = useState<'dark' | 'grid' | 'studio'>('dark');
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurement, setMeasurement] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [splatCount, setSplatCount] = useState<number>(45000);
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  // Three.js instances ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentObjectRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const splatPointsMaterialRef = useRef<THREE.PointsMaterial | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  useEffect(() => {
    setActiveScene(initialScene);
  }, [initialScene]);

  // Hide Maya AI and other overlapping modals when open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('whatsapp-ai-modal-open');
    } else {
      document.body.classList.remove('whatsapp-ai-modal-open');
    }
    return () => {
      document.body.classList.remove('whatsapp-ai-modal-open');
    };
  }, [isOpen]);

  // Initialize Three.js Viewport
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    updateSceneBackground(scene, bgTheme);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 4.2);
    cameraRef.current = camera;

    // 3. Renderer with high-DPI support and tone mapping for Gaussian Splats
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.4;
    controls.maxDistance = 25;
    controls.minDistance = 0.4;
    controlsRef.current = controls;

    // 5. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    blueRimLight.position.set(-5, 4, -5);
    scene.add(blueRimLight);

    const amberFillLight = new THREE.DirectionalLight(0xf59e0b, 0.5);
    amberFillLight.position.set(3, -2, -3);
    scene.add(amberFillLight);

    // 6. Build the active 3D Gaussian Splat model
    loadSceneModel(activeScene);

    // 7. Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };
    animate(performance.now());

    // 8. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [isOpen, bgTheme]);

  // Update background styling
  const updateSceneBackground = (scene: THREE.Scene, theme: 'dark' | 'grid' | 'studio') => {
    if (theme === 'dark') {
      scene.background = new THREE.Color(0x0a0c14);
      scene.fog = new THREE.FogExp2(0x0a0c14, 0.05);
    } else if (theme === 'grid') {
      scene.background = new THREE.Color(0x0e1320);
      scene.fog = new THREE.FogExp2(0x0e1320, 0.04);
      const grid = new THREE.GridHelper(30, 60, 0x38bdf8, 0x1e293b);
      grid.position.y = -0.01;
      grid.name = 'scene-grid';
      scene.add(grid);
    } else {
      // Studio
      scene.background = new THREE.Color(0x181824);
      scene.fog = new THREE.FogExp2(0x181824, 0.03);
    }
  };

  // Build Procedural 3D Gaussian Splat Point Cloud & Models
  const loadSceneModel = (preset: ScenePreset) => {
    if (!sceneRef.current) return;
    setIsLoading(true);

    // Clean previous objects
    if (currentObjectRef.current) {
      sceneRef.current.remove(currentObjectRef.current);
      disposeHierarchy(currentObjectRef.current);
      currentObjectRef.current = null;
    }

    const group = new THREE.Group();
    currentObjectRef.current = group;

    // Splat Texture generator (Soft circular Gaussian falloff)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const splatTexture = new THREE.CanvasTexture(canvas);

    // Build specific preset geometry and Gaussian point clouds
    if (preset === 'hotel') {
      buildHotelSuiteSplatScene(group, splatTexture);
      setSplatCount(62400);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(2.8, 1.7, 3.4);
        controlsRef.current.target.set(0, 0.9, 0);
      }
    } else if (preset === 'car') {
      buildLuxuryCarSplatScene(group, splatTexture);
      setSplatCount(48500);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(-3.2, 1.6, 3.2);
        controlsRef.current.target.set(0, 0.7, 0);
      }
    } else if (preset === 'product') {
      buildSneakerProductSplatScene(group, splatTexture);
      setSplatCount(36800);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(0, 0.4, 1.8);
        controlsRef.current.target.set(0, 0, 0);
      }
    } else if (preset === 'terminal') {
      buildBusTerminalSplatScene(group, splatTexture);
      setSplatCount(74200);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(4.5, 3.2, 5.5);
        controlsRef.current.target.set(0, 0.8, 0);
      }
    }

    sceneRef.current.add(group);
    setIsLoading(false);
  };

  // 1. HOTEL SUITE 3D SPLAT SCENE
  const buildHotelSuiteSplatScene = (group: THREE.Group, splatTexture: THREE.Texture) => {
    // Architectural Floor & Balcony
    const floorGeo = new THREE.BoxGeometry(6, 0.1, 5);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x27272a, 
      roughness: 0.3, 
      metalness: 0.1 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.05, 0);
    group.add(floor);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 2.8, 0.1), wallMat);
    backWall.position.set(0, 1.4, -2.5);
    group.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.8, 5), wallMat);
    sideWall.position.set(-3, 1.4, 0);
    group.add(sideWall);

    // King Bed (Solid structural frame + plush duvet)
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 }));
    bedBase.position.set(-0.8, 0.2, -1.1);
    group.add(bedBase);

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 2.0), new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.6 }));
    mattress.position.set(-0.8, 0.5, -1.1);
    group.add(mattress);

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7 }));
    headboard.position.set(-0.8, 0.8, -2.2);
    group.add(headboard);

    // Lounge sofa & coffee table
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.8), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }));
    sofa.position.set(1.5, 0.27, 0.5);
    sofa.rotation.y = -Math.PI / 4;
    group.add(sofa);

    // High-Density Gaussian Splat Cloud (Simulates 3DGS photogrammetry capture)
    const count = 55000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Concentrate points around bed, furniture, balcony window and room surfaces
      const u = Math.random();
      let x = 0, y = 0, z = 0;
      let r = 0.9, g = 0.85, b = 0.75; // Warm luxury tone

      if (u < 0.4) {
        // Bed & Headboard cluster
        x = -0.8 + (Math.random() - 0.5) * 2.3;
        y = 0.35 + Math.random() * 0.9;
        z = -1.1 + (Math.random() - 0.5) * 2.3;
        r = 0.95; g = 0.92; b = 0.88;
      } else if (u < 0.7) {
        // Sofa & Living room zone
        x = 1.4 + (Math.random() - 0.5) * 1.8;
        y = 0.1 + Math.random() * 0.9;
        z = 0.5 + (Math.random() - 0.5) * 1.8;
        r = 0.95; g = 0.55; b = 0.2; // Amber velvet
      } else {
        // Ambient room splat particles & ocean balcony light
        x = (Math.random() - 0.5) * 5.8;
        y = Math.random() * 2.6;
        z = (Math.random() - 0.5) * 4.8;
        r = 0.4 + Math.random() * 0.3;
        g = 0.7 + Math.random() * 0.25;
        b = 0.95; // Balcony ocean reflection
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    const splatGeo = new THREE.BufferGeometry();
    splatGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const splatMat = new THREE.PointsMaterial({
      size: pointSize * 0.045,
      vertexColors: true,
      map: splatTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    splatPointsMaterialRef.current = splatMat;

    const points = new THREE.Points(splatGeo, splatMat);
    group.add(points);
  };

  // 2. LUXURY CAR 3D SPLAT SCENE (Toyota Prado / SUV)
  const buildLuxuryCarSplatScene = (group: THREE.Group, splatTexture: THREE.Texture) => {
    // Showroom pedestal floor
    const floorGeo = new THREE.CylinderGeometry(3.5, 3.6, 0.12, 48);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x111116, 
      roughness: 0.2, 
      metalness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.06;
    group.add(floor);

    // Car Body Frame (PBR procedural Prado SUV)
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f172a, // Deep obsidian black / pearl
      roughness: 0.15, 
      metalness: 0.85 
    });
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 1.6), bodyMat);
    lowerBody.position.set(0, 0.65, 0);
    group.add(lowerBody);

    const cabinMat = new THREE.MeshStandardMaterial({ 
      color: 0x1e293b, 
      roughness: 0.1, 
      metalness: 0.9,
      transparent: true,
      opacity: 0.75
    });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 1.45), cabinMat);
    cabin.position.set(-0.2, 1.25, 0);
    group.add(cabin);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    
    [
      [-1.1, 0.38, 0.85],
      [1.1, 0.38, 0.85],
      [-1.1, 0.38, -0.85],
      [1.1, 0.38, -0.85]
    ].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    });

    // Splat Point Cloud of Vehicle Exterior & Chrome Grille
    const count = 48000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      let x = 0, y = 0, z = 0;
      let r = 0.1, g = 0.5, b = 0.9;

      if (u < 0.6) {
        // Vehicle Body Surface
        x = (Math.random() - 0.5) * 3.8;
        y = 0.35 + Math.random() * 1.35;
        z = (Math.random() - 0.5) * 1.7;
        r = 0.2 + Math.random() * 0.4;
        g = 0.3 + Math.random() * 0.5;
        b = 0.8 + Math.random() * 0.2; // Glossy blue metallic
      } else if (u < 0.8) {
        // LED Headlights & Grille
        x = 1.75 + (Math.random() - 0.5) * 0.2;
        y = 0.5 + Math.random() * 0.45;
        z = (Math.random() - 0.5) * 1.3;
        r = 0.95; g = 0.95; b = 1.0; // Xenon White
      } else {
        // Alloy Rims & Ground Reflection
        x = (Math.random() - 0.5) * 3.2;
        y = 0.05 + Math.random() * 0.4;
        z = (Math.random() - 0.5) * 2.2;
        r = 0.7; g = 0.75; b = 0.8;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    const splatGeo = new THREE.BufferGeometry();
    splatGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const splatMat = new THREE.PointsMaterial({
      size: pointSize * 0.04,
      vertexColors: true,
      map: splatTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    splatPointsMaterialRef.current = splatMat;

    const points = new THREE.Points(splatGeo, splatMat);
    group.add(points);
  };

  // 3. SNEAKER PRODUCT 3D SPLAT SCENE (PapoMall E-Commerce AR/3D)
  const buildSneakerProductSplatScene = (group: THREE.Group, splatTexture: THREE.Texture) => {
    // Elegant Showcase Pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.95, 0.08, 36),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.5 })
    );
    pedestal.position.y = -0.35;
    group.add(pedestal);

    // Sole & Upper Structure
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.14, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
    );
    sole.position.set(0, -0.22, 0);
    group.add(sole);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 })
    );
    upper.position.set(-0.05, -0.05, 0);
    group.add(upper);

    // High Density Product Gaussian Splat Cloud
    const count = 38000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      let x = 0, y = 0, z = 0;
      let r = 0.1, g = 0.1, b = 0.1;

      if (u < 0.45) {
        // Red Air Sole & Midsole
        x = (Math.random() - 0.5) * 1.35;
        y = -0.3 + Math.random() * 0.18;
        z = (Math.random() - 0.5) * 0.52;
        r = 0.95; g = 0.15; b = 0.2; // Bred Red
      } else if (u < 0.8) {
        // Leather Upper & Tongue
        x = (Math.random() - 0.5) * 1.25;
        y = -0.15 + Math.random() * 0.45;
        z = (Math.random() - 0.5) * 0.48;
        r = 0.15 + Math.random() * 0.1;
        g = 0.15 + Math.random() * 0.1;
        b = 0.15 + Math.random() * 0.1; // Deep matte leather black
      } else {
        // Mesh Panels, Laces & Jumpman Logo
        x = (Math.random() - 0.5) * 0.8;
        y = 0.1 + Math.random() * 0.35;
        z = (Math.random() - 0.5) * 0.4;
        r = 0.85; g = 0.85; b = 0.9; // Cement grey / white laces
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    const splatGeo = new THREE.BufferGeometry();
    splatGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const splatMat = new THREE.PointsMaterial({
      size: pointSize * 0.028,
      vertexColors: true,
      map: splatTexture,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    splatPointsMaterialRef.current = splatMat;

    const points = new THREE.Points(splatGeo, splatMat);
    group.add(points);
  };

  // 4. BUS TERMINAL SCAN (Magufuli / Ubungo 3D Station Tour)
  const buildBusTerminalSplatScene = (group: THREE.Group, splatTexture: THREE.Texture) => {
    // Large Terminal Floor & Tarmac Bays
    const tarmac = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 })
    );
    tarmac.position.set(0, -0.05, 0);
    group.add(tarmac);

    // Terminal Canopy Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.15, 4),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.6 })
    );
    roof.position.set(0, 2.4, 0);
    group.add(roof);

    // Canopy Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    [
      [-3.5, 1.2, -1.8],
      [3.5, 1.2, -1.8],
      [-3.5, 1.2, 1.8],
      [3.5, 1.2, 1.8]
    ].forEach(([px, py, pz]) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, py, pz);
      group.add(pillar);
    });

    // Splat Cloud of Terminal & Parked Long-Distance Luxury Bus
    const count = 72000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      let x = 0, y = 0, z = 0;
      let r = 0.2, g = 0.6, b = 0.9;

      if (u < 0.45) {
        // Luxury Bus parked at Bay 1
        x = -1.5 + (Math.random() - 0.5) * 4.8;
        y = 0.3 + Math.random() * 1.8;
        z = -0.5 + (Math.random() - 0.5) * 1.8;
        r = 0.95; g = 0.45; b = 0.1; // Bright Orange / Shabiby Luxury Bus
      } else if (u < 0.75) {
        // Glass Waiting Lounge & Passenger Gates
        x = 2.0 + (Math.random() - 0.5) * 3.5;
        y = 0.1 + Math.random() * 2.2;
        z = 1.0 + (Math.random() - 0.5) * 2.8;
        r = 0.2; g = 0.7; b = 0.95; // Cyan Glass
      } else {
        // Tarmac Lane Markings & Passenger Walkway
        x = (Math.random() - 0.5) * 9.5;
        y = 0.05 + Math.random() * 0.2;
        z = (Math.random() - 0.5) * 7.5;
        r = 0.9; g = 0.85; b = 0.2; // Yellow Tarmac Lines
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    const splatGeo = new THREE.BufferGeometry();
    splatGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const splatMat = new THREE.PointsMaterial({
      size: pointSize * 0.05,
      vertexColors: true,
      map: splatTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    splatPointsMaterialRef.current = splatMat;

    const points = new THREE.Points(splatGeo, splatMat);
    group.add(points);
  };

  // Memory disposal helper
  const disposeHierarchy = (obj: THREE.Object3D) => {
    obj.traverse((child: any) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  };

  // Adjust point/splat size
  const handlePointSizeChange = (val: number) => {
    setPointSize(val);
    if (splatPointsMaterialRef.current) {
      splatPointsMaterialRef.current.size = val * 0.04;
      splatPointsMaterialRef.current.needsUpdate = true;
    }
  };

  // Adjust exposure
  const handleExposureChange = (val: number) => {
    setExposure(val);
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = val;
    }
  };

  // Toggle Auto-Rotate
  const handleToggleAutoRotate = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    if (controlsRef.current) {
      controlsRef.current.autoRotate = next;
    }
  };

  // Camera presets
  const setCameraPreset = (mode: 'orbit' | 'firstperson' | 'topdown') => {
    setCameraMode(mode);
    if (!cameraRef.current || !controlsRef.current) return;

    if (mode === 'topdown') {
      cameraRef.current.position.set(0, 6.5, 0.01);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.autoRotate = false;
      setAutoRotate(false);
      toast.info("📐 Mtazamo wa Ramani ya Juu (Top-Down Floorplan)");
    } else if (mode === 'firstperson') {
      cameraRef.current.position.set(0, 1.4, 0.5);
      controlsRef.current.target.set(0, 1.4, -2.5);
      controlsRef.current.autoRotate = false;
      setAutoRotate(false);
      toast.info("👁️ Mtazamo wa Ndani (First-Person Walkthrough)");
    } else {
      cameraRef.current.position.set(0, 1.8, 4.2);
      controlsRef.current.target.set(0, 0.8, 0);
      controlsRef.current.autoRotate = true;
      setAutoRotate(true);
      toast.info("🔄 Mtazamo wa Mzunguko 360° (Orbit View)");
    }
  };

  // Handle Custom .ply / .splat file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const loader = new PLYLoader();
        const geometry = loader.parse(buffer);

        if (sceneRef.current && currentObjectRef.current) {
          sceneRef.current.remove(currentObjectRef.current);
          disposeHierarchy(currentObjectRef.current);
          currentObjectRef.current = null;
        }

        geometry.computeVertexNormals();
        geometry.center();

        const material = new THREE.PointsMaterial({
          size: pointSize * 0.035,
          vertexColors: geometry.hasAttribute('color'),
          color: geometry.hasAttribute('color') ? 0xffffff : 0x38bdf8
        });

        const points = new THREE.Points(geometry, material);
        const group = new THREE.Group();
        group.add(points);
        currentObjectRef.current = group;

        if (sceneRef.current) {
          sceneRef.current.add(group);
        }

        const count = geometry.getAttribute('position')?.count || 0;
        setSplatCount(count);
        setIsLoading(false);
        toast.success(`Faili la "${file.name}" lenye chembechembe ${count.toLocaleString()} limepakiwa! 🎉`);
      } catch (err: any) {
        console.error("PLY parse failed:", err);
        toast.error("Imeshindwa kusoma faili hili. Hakikisha ni faili halali la .ply au .splat.");
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Take high-res snapshot
  const handleTakeSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `papo-hapo-supersplat-${activeScene}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Picha ya 3D (Snapshot) imehifadhiwa kwenye simu yako! 📸");
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-start sm:justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 25, stiffness: 240 }}
        className="w-full sm:max-w-5xl h-full sm:h-[88vh] bg-[#0c0e17] border-0 sm:border border-purple-500/30 rounded-none sm:rounded-[28px] shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-white relative"
      >
        {/* TOP BAR: SuperSplat Header */}
        <div className="bg-[#141624] px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 shadow-md z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
              <Box className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base tracking-tight truncate text-white">
                  SuperSplat 3D Viewer & Virtual Tour
                </h3>
                <span className="bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[8.5px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0">
                  3D Gaussian Splats
                </span>
              </div>
              <p className="text-[10px] text-neutral-300 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Chembechembe {splatCount.toLocaleString()} za 3DGS • WebGL & Three.js</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct SuperSplat.at Link */}
            <a
              href="https://superspl.at/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
              title="Fungua tovuti rasmi ya SuperSplat Studio"
            >
              <span>superspl.at Studio</span>
              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
            </a>

            <button 
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer shadow-sm border border-white/20"
              title="Funga Dirisha"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* SCENE PRESET SELECTOR TABS */}
        <div className="bg-[#0f111e] px-3 py-2 border-b border-white/5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setActiveScene('hotel');
                loadSceneModel('hotel');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeScene === 'hotel'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <Hotel className="w-3.5 h-3.5 text-amber-400" />
              <span>PapoStay Suite 3D</span>
            </button>

            <button
              onClick={() => {
                setActiveScene('car');
                loadSceneModel('car');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeScene === 'car'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-sky-400" />
              <span>PapoRent Prado 3D</span>
            </button>

            <button
              onClick={() => {
                setActiveScene('product');
                loadSceneModel('product');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeScene === 'product'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-rose-400" />
              <span>PapoMall Sneaker 3D</span>
            </button>

            <button
              onClick={() => {
                setActiveScene('terminal');
                loadSceneModel('terminal');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeScene === 'terminal'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <Bus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Standi ya Basi 3D</span>
            </button>
          </div>

          {/* Upload Custom .ply / .splat */}
          <label className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer border border-white/15 active:scale-95 transition-all shrink-0">
            <Upload className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Pakia .ply / .splat</span>
            <span className="sm:hidden">Pakia</span>
            <input 
              type="file" 
              accept=".ply,.splat" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>

        {/* 3D VIEWPORT CANVAS */}
        <div className="flex-1 relative w-full h-full overflow-hidden bg-black select-none">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
              <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-wider text-purple-300">
                Inapakia 3D Gaussian Splats...
              </p>
            </div>
          )}

          {/* Floating On-Canvas SuperSplat Tool Controls (Top-Right) */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-[#141624]/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-xl">
            {/* Auto Rotate Toggle */}
            <button
              onClick={handleToggleAutoRotate}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                autoRotate ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-300 hover:bg-white/10'
              }`}
              title={autoRotate ? "Simamisha Mzunguko wa 360°" : "Washa Mzunguko wa 360° (Auto-Orbit)"}
            >
              {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Orbit / 360° View */}
            <button
              onClick={() => setCameraPreset('orbit')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                cameraMode === 'orbit' ? 'bg-purple-600 text-white' : 'text-neutral-300 hover:bg-white/10'
              }`}
              title="Mtazamo wa 360° (Orbit View)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* First-Person / Walkthrough */}
            <button
              onClick={() => setCameraPreset('firstperson')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                cameraMode === 'firstperson' ? 'bg-purple-600 text-white' : 'text-neutral-300 hover:bg-white/10'
              }`}
              title="Tembea Ndani (Walkthrough)"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Top Down View */}
            <button
              onClick={() => setCameraPreset('topdown')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                cameraMode === 'topdown' ? 'bg-purple-600 text-white' : 'text-neutral-300 hover:bg-white/10'
              }`}
              title="Mtazamo wa Juu (Top-Down Floorplan)"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Take Snapshot */}
            <button
              onClick={handleTakeSnapshot}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-300 hover:bg-white/10 transition-all"
              title="Chukua Picha ya 3D (Capture Snapshot)"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Floating On-Canvas Sliders & Calibration (Bottom-Left) */}
          <div className="absolute bottom-3 left-3 z-10 bg-[#141624]/90 backdrop-blur-md p-3 rounded-2xl border border-white/15 shadow-xl max-w-[280px] w-full space-y-2.5 text-xs">
            {/* Splat Point Size */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-bold text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Ukubwa wa Splats (Size):
                </span>
                <span className="font-mono text-purple-400">{pointSize.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.3" 
                max="3.0" 
                step="0.1" 
                value={pointSize} 
                onChange={(e) => handlePointSizeChange(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Exposure / Brightness */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-bold text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Kiwango cha Mwanga:
                </span>
                <span className="font-mono text-amber-400">{exposure.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="0.4" 
                max="2.5" 
                step="0.1" 
                value={exposure} 
                onChange={(e) => handleExposureChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Backdrop Switcher */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
              <span className="text-neutral-400 font-bold">Mandhari:</span>
              <div className="flex gap-1">
                {(['dark', 'grid', 'studio'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBgTheme(t)}
                    className={`px-2 py-0.5 rounded-md font-bold uppercase transition-all ${
                      bgTheme === t ? 'bg-purple-600 text-white' : 'bg-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION & BOOKING BAR */}
        <div className="bg-[#141624] px-4 py-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="text-left">
              <h4 className="font-black text-sm text-white leading-tight">
                {activeScene === 'hotel' && "Serena Hotel Suite • 3D Walkthrough"}
                {activeScene === 'car' && "Toyota Prado TX-L • 360° Inspection"}
                {activeScene === 'product' && "Air Jordan 4 Retro • 3D Interactive"}
                {activeScene === 'terminal' && "Standi Kuu ya Magufuli • 3D Station"}
              </h4>
              <p className="text-[11px] text-neutral-400">
                {activeScene === 'hotel' && "Gharama: TZS 280,000 / usiku • Chumba Kimekaguliwa"}
                {activeScene === 'car' && "Gharama: TZS 150,000 / siku • Ulinzi & Bima 100%"}
                {activeScene === 'product' && "Bei: TZS 85,000 • Inapatikana Madukani"}
                {activeScene === 'terminal' && "Tiketi za Mabasi Masaa 24/7 • LATRA Compliant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (activeScene === 'hotel') {
                  toast.success("Chumba cha hoteli kimeongezwa kwenye oda yako!");
                } else if (activeScene === 'car') {
                  toast.success("Gari hili limechaguliwa kwa ukodishaji!");
                } else if (activeScene === 'product') {
                  toast.success("Bidhaa imeongezwa kwenye kikapu chako!");
                } else {
                  toast.success("Nenda kwenye mfumo wa kukata tiketi za basi!");
                }
                onClose();
              }}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {activeScene === 'hotel' && "Weka Oda ya Chumba (Book Now)"}
              {activeScene === 'car' && "Kodi Gari Hili (Rent Car)"}
              {activeScene === 'product' && "Weka Kwenye Kikapu (Add to Cart)"}
              {activeScene === 'terminal' && "Kata Tiketi ya Basi Hapa"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
