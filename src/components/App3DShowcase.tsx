import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, RotateCcw, Smartphone, Bot, Home, Car, Box, Wallet, 
  Play, Pause, Layers, ShieldCheck, Zap, ArrowRight, Eye, RefreshCw
} from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function App3DShowcase() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [activeScreen, setActiveScreen] = useState<'maya' | 'papostay' | 'taxi' | 'robot' | 'wallet'>('maya');
  const [wireframeMode, setWireframeMode] = useState(false);
  const [particleDensity, setParticleDensity] = useState<'high' | 'med'>('high');
  const [is3DReady, setIs3DReady] = useState(false);

  const { profile } = useAuth();

  // Screen descriptions
  const screenMeta = {
    maya: {
      title: "MAYA AI Voice Assistant 🎙️",
      subtitle: "Sauti na Akili Mnemba ya Kiswahili",
      badge: "AI ENGINE",
      color: "from-amber-500 to-orange-600",
      description: "Chat au zungumza na Maya kwa sauti kuagiza Usafiri (Boda, Bajaji, Gari), Chakula, au kufanya Malipo papo hapo kwa kutumia mfumo wa AI.",
      features: ["Sauti ya Kiswahili yenye Mdundo Halisi", "Reverse Geocoding ya GPS Eneo Lako", "Amri za Sauti Bila Mtandao (Offline Voice)"]
    },
    papostay: {
      title: "PapoStay & Real Estate 🏠",
      subtitle: "Nyumba za Kupanga & Mawakala Waliohakikiwa",
      badge: "ESCROW PROTECTED",
      color: "from-indigo-600 to-purple-600",
      description: "Tafuta na kupata vyumba, apartments, na fremu za biashara na mawakala waliohakikiwa bila kudhulumiwa, kwa ulinzi wa Escrow.",
      features: ["Escrow Rent Vault System", "Mawakala na Madalali Waliohakikiwa", "Mkataba wa Kidijitali wa Pango"]
    },
    taxi: {
      title: "PapoRide Usafiri wa Kasi 🚕",
      subtitle: "Boda, Bajaji, Gari & Ambulansi ya Dharura",
      badge: "LIVE GPS TRACKING",
      color: "from-yellow-500 to-amber-600",
      description: "Chagua dereva aliye karibu zaidi nawe. Utaratibu wa kuwasili kwa dakika 2 na malipo ya Papo Wallet au Mobile Money.",
      features: ["Madereva Waliohakikiwa NIDA", "Emergency Ambulance & Fire Call", "Fare Estimate ya Mbofyo Mmoja"]
    },
    robot: {
      title: "Delivery Robot & Drones 🤖",
      subtitle: "Uwasilishaji wa Kidijitali na Robotic Dispatch",
      badge: "AUTONOMOUS",
      color: "from-emerald-500 to-teal-600",
      description: "Uwasilishaji salama wa chakula na dawa za dharura kwa kutumia Autonomous Delivery Robots na Drones.",
      features: ["Real-time Telemetry & LiDAR", "Passcode Security Box Unlock", "Zero Carbon Footprint"]
    },
    wallet: {
      title: "Papo Wallet & Malipo Salama 💳",
      subtitle: "M-Pesa, Tigo Pesa, Airtel Money & Pointi",
      badge: "0% TRANSACTION FEE",
      color: "from-blue-600 to-cyan-500",
      description: "Lipa huduma zote kwa mbofyo mmoja. Mfumo wa Pointi za zawadi na uhamishaji wa fedha salama papo hapo.",
      features: ["Papo Escrow Protection", "Pointi za Zawadi kwa Kila Oda", "Risiti za Kielektroniki (QR Verify)"]
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Clear container and append canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. Lights Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffa500, 2.5);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 2.0);
    dirLight2.position.set(-5, -5, -2);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 2, 10);
    pointLight.position.set(0, 0, 3);
    scene.add(pointLight);

    // 5. Build 3D Phone Geometry
    const phoneGroup = new THREE.Group();

    // Outer Frame (Chassis)
    const chassisGeo = new THREE.BoxGeometry(2.2, 4.4, 0.22);
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x111115,
      metalness: 0.9,
      roughness: 0.2,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      wireframe: wireframeMode
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    phoneGroup.add(chassis);

    // Metallic Bezel Ring
    const bezelGeo = new THREE.BoxGeometry(2.26, 4.46, 0.20);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Amber gold metallic tint
      metalness: 0.95,
      roughness: 0.15,
      wireframe: wireframeMode
    });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    phoneGroup.add(bezel);

    // Front Screen Glass
    const screenGeo = new THREE.PlaneGeometry(2.05, 4.25);
    
    // Create Dynamic Texture for the Screen plane
    const canvasScreen = document.createElement('canvas');
    canvasScreen.width = 512;
    canvasScreen.height = 1024;
    const ctx = canvasScreen.getContext('2d')!;

    const drawCanvasScreen = (screenKey: string) => {
      // Draw Screen Canvas Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 1024);
      if (screenKey === 'maya') {
        grad.addColorStop(0, '#1c1917');
        grad.addColorStop(0.5, '#451a03');
        grad.addColorStop(1, '#0c0a09');
      } else if (screenKey === 'papostay') {
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.5, '#311042');
        grad.addColorStop(1, '#0f172a');
      } else if (screenKey === 'taxi') {
        grad.addColorStop(0, '#292524');
        grad.addColorStop(0.5, '#78350f');
        grad.addColorStop(1, '#0c0a09');
      } else if (screenKey === 'robot') {
        grad.addColorStop(0, '#022c22');
        grad.addColorStop(0.5, '#064e3b');
        grad.addColorStop(1, '#020617');
      } else {
        grad.addColorStop(0, '#172554');
        grad.addColorStop(0.5, '#1e3a8a');
        grad.addColorStop(1, '#020617');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 1024);

      // Status Bar
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('09:41', 32, 48);
      ctx.fillText('5G 🔋 100%', 360, 48);

      // App Header Pill
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.roundRect(32, 80, 448, 80, 20);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('PAPO HAPO 🇹🇿', 56, 130);

      // Main Feature Visual Ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(256, 360, 120, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 12;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 25;
      ctx.stroke();
      ctx.restore();

      // Screen Center Icon / Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      
      if (screenKey === 'maya') {
        ctx.fillText('MAYA AI VOICE', 256, 350);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#fcd34d';
        ctx.fillText('Active & Listening...', 256, 390);
      } else if (screenKey === 'papostay') {
        ctx.fillText('PAPOSTAY ROOMS', 256, 350);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#a78bfa';
        ctx.fillText('Verified Brokers 🏠', 256, 390);
      } else if (screenKey === 'taxi') {
        ctx.fillText('PAPORIDE TAXI', 256, 350);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText('Boda & Bajaji 🚕', 256, 390);
      } else if (screenKey === 'robot') {
        ctx.fillText('ROBOT DISPATCH', 256, 350);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText('Autonomous AI 🤖', 256, 390);
      } else {
        ctx.fillText('PAPO WALLET', 256, 350);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText('TSH 250,000 💳', 256, 390);
      }

      // Feature Card 1
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.roundRect(40, 530, 432, 120, 24);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('✅ Eneo lako la sasa:', 64, 575);
      ctx.fillStyle = '#d1d5db';
      ctx.font = '20px sans-serif';
      ctx.fillText('Dar es Salaam, Tanzania', 64, 615);

      // Feature Card 2
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.roundRect(40, 680, 432, 120, 24);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('⚡ Papo Escrow Protection', 64, 725);
      ctx.fillStyle = '#fef3c7';
      ctx.font = '20px sans-serif';
      ctx.fillText('Ulinzi Salama wa Malipo 100%', 64, 765);

      // Bottom Navigation Bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 920, 512, 104);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏠    🔍    🎙️    📦    👤', 256, 980);
    };

    drawCanvasScreen(activeScreen);

    const screenTexture = new THREE.CanvasTexture(canvasScreen);
    screenTexture.needsUpdate = true;

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      wireframe: wireframeMode
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = 0.115;
    phoneGroup.add(screenMesh);

    // Camera Lens & Speaker Notch on Top
    const notchGeo = new THREE.BoxGeometry(0.5, 0.08, 0.02);
    const notchMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const notch = new THREE.Mesh(notchGeo, notchMat);
    notch.position.set(0, 1.95, 0.12);
    phoneGroup.add(notch);

    scene.add(phoneGroup);

    // 6. Floating 3D Particles Field
    const particleCount = particleDensity === 'high' ? 220 : 100;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 14;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // 7. Interactive Mouse Orbit / Rotation
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      mouseX = (x / rect.width) * 2;
      mouseY = -(y / rect.height) * 2;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Floating wave animation
      phoneGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.15;

      if (isRotating) {
        phoneGroup.rotation.y += 0.008;
        phoneGroup.rotation.x = Math.sin(elapsedTime * 0.8) * 0.1;
      } else {
        // Interactive Tilt towards mouse cursor
        targetRotationY = mouseX * 0.8;
        targetRotationX = -mouseY * 0.8;

        phoneGroup.rotation.y += (targetRotationY - phoneGroup.rotation.y) * 0.05;
        phoneGroup.rotation.x += (targetRotationX - phoneGroup.rotation.x) * 0.05;
      }

      // Rotate particle cloud gently
      particlePoints.rotation.y = elapsedTime * 0.03;

      renderer.render(scene, camera);
    };

    animate();
    setIs3DReady(true);

    // Window Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      chassisGeo.dispose();
      chassisMat.dispose();
      bezelGeo.dispose();
      bezelMat.dispose();
      screenGeo.dispose();
      screenMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      screenTexture.dispose();
      renderer.dispose();
    };
  }, [isRotating, activeScreen, wireframeMode, particleDensity]);

  const activeMeta = screenMeta[activeScreen];

  return (
    <div className="w-full bg-neutral-950 text-white min-h-[600px] rounded-[2.5rem] p-4 sm:p-8 border border-white/10 shadow-2xl overflow-hidden relative font-sans my-4">
      {/* Glow Ambient Effects */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-black text-[10px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 animate-spin" />
              Interactive 3D Engine
            </span>
            <span className="text-xs text-neutral-400 font-semibold">• Papo Hapo Super App</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight font-display uppercase bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
            3D App Animation Showcase
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border ${
              isRotating 
                ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20' 
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRotating ? 'Mzunguko (Auto Rotate)' : 'Interactive Tilt'}</span>
          </button>

          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`p-2 rounded-xl text-xs font-bold transition-all border ${
              wireframeMode 
                ? 'bg-purple-600 text-white border-purple-500' 
                : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
            }`}
            title="Toggle Wireframe Geometry Mode"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: 3D Canvas + Interactive Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Interactive 3D Canvas */}
        <div className="lg:col-span-7 h-[380px] sm:h-[460px] md:h-[500px] w-full relative bg-gradient-to-b from-white/5 to-transparent rounded-[2rem] border border-white/10 overflow-hidden flex items-center justify-center">
          
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Interactive Hint */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[11px] text-neutral-400 font-medium bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              Sogeza mouse au kidole juu ya 3D phone kuipindisha kwa pembe yoyote.
            </span>
            <span className="font-mono text-amber-300 font-bold hidden sm:inline">WebGL 3D Active</span>
          </div>
        </div>

        {/* Right Info & Interactive App Switcher */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active Screen Details Box */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6 rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-white bg-gradient-to-r ${activeMeta.color}`}>
                  {activeMeta.badge}
                </span>
                <span className="text-xs text-neutral-400 font-mono">Papo Hapo 3D</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black italic tracking-tight text-white mb-1">
                  {activeMeta.title}
                </h3>
                <p className="text-xs text-amber-300 font-semibold">{activeMeta.subtitle}</p>
              </div>

              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-normal">
                {activeMeta.description}
              </p>

              <div className="space-y-2 pt-2 border-t border-white/10">
                {activeMeta.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-neutral-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Interactive Feature Selectors */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-neutral-400 px-1">
              Badilisha Muonekano wa 3D App Screen:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setActiveScreen('maya')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col gap-1.5 ${
                  activeScreen === 'maya' 
                    ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400'
                }`}
              >
                <Bot className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold leading-tight">MAYA AI Voice</span>
              </button>

              <button
                onClick={() => setActiveScreen('papostay')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col gap-1.5 ${
                  activeScreen === 'papostay' 
                    ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400'
                }`}
              >
                <Home className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold leading-tight">PapoStay Rooms</span>
              </button>

              <button
                onClick={() => setActiveScreen('taxi')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col gap-1.5 ${
                  activeScreen === 'taxi' 
                    ? 'bg-yellow-500/20 border-yellow-500 text-white shadow-lg shadow-yellow-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400'
                }`}
              >
                <Car className="w-5 h-5 text-yellow-400" />
                <span className="text-xs font-bold leading-tight">PapoRide Taxi</span>
              </button>

              <button
                onClick={() => setActiveScreen('robot')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col gap-1.5 ${
                  activeScreen === 'robot' 
                    ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400'
                }`}
              >
                <Box className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold leading-tight">Delivery Robot</span>
              </button>

              <button
                onClick={() => setActiveScreen('wallet')}
                className={`p-3 rounded-2xl text-left border transition-all flex flex-col gap-1.5 col-span-2 sm:col-span-1 ${
                  activeScreen === 'wallet' 
                    ? 'bg-blue-500/20 border-blue-500 text-white shadow-lg shadow-blue-500/10' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400'
                }`}
              >
                <Wallet className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-bold leading-tight">Papo Wallet</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
