import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMap, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { 
  Eye, Compass, Layers, Car, Building2, Radio, 
  Maximize2, RotateCcw, Sliders, ChevronDown, 
  Check, Navigation, Sparkles, Zap, Shield, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type MapPerspectiveMode = 'standard' | '3d_birdseye' | 'gods_eye';

interface GodsEye3DMapOverlayProps {
  mode: MapPerspectiveMode;
  onModeChange: (mode: MapPerspectiveMode) => void;
  centerPos: { lat: number; lng: number };
  theme?: 'dark' | 'light';
  showBuildingsDefault?: boolean;
  showTrafficDefault?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Controller to apply 3D Pitch and 360° Rotation to Leaflet Map Container
 */
export const Map3DViewController = ({
  mode,
  pitch = 50,
  rotation = 0,
}: {
  mode: MapPerspectiveMode;
  pitch: number;
  rotation: number;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;

    if (mode === '3d_birdseye') {
      container.style.perspective = '1200px';
      container.style.transformStyle = 'preserve-3d';
      container.style.transform = `perspective(1200px) rotateX(${pitch}deg) rotateZ(${rotation}deg) scale(1.15)`;
      container.style.transformOrigin = 'center 60%';
      container.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)';
    } else if (mode === 'gods_eye') {
      container.style.perspective = 'none';
      container.style.transformStyle = 'flat';
      container.style.transform = 'none';
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.5s ease-out';
    } else {
      container.style.perspective = 'none';
      container.style.transformStyle = 'flat';
      container.style.transform = 'none';
      container.style.transformOrigin = 'center center';
      container.style.transition = 'transform 0.35s ease-out';
    }
  }, [map, mode, pitch, rotation]);

  return null;
};

/**
 * 3D Isometric Extruded Buildings Layer
 * Renders stylized 3D architectural prisms with lighted windows, helipads, and shadows
 */
export const ThreeDBuildingsLayer = ({
  center,
  visible = true,
}: {
  center: { lat: number; lng: number };
  visible: boolean;
}) => {
  if (!visible) return null;

  // Generate realistic procedural building clusters relative to center coordinates
  const buildings = useMemo(() => {
    if (!center || !center.lat || !center.lng) return [];
    
    // Deterministic offset seeds for realistic city blocks
    const templates = [
      { dLat: 0.0012, dLng: 0.0015, height: 75, width: 48, depth: 44, type: 'tower', name: 'Papo Heights Plaza', color: '#3b82f6' },
      { dLat: -0.0014, dLng: 0.0018, height: 95, width: 52, depth: 50, type: 'commercial', name: 'Skyline Hub & Mall', color: '#10b981' },
      { dLat: 0.0018, dLng: -0.0016, height: 60, width: 65, depth: 38, type: 'residential', name: 'Zanzibar Pearl Tower', color: '#8b5cf6' },
      { dLat: -0.0019, dLng: -0.0014, height: 110, width: 50, depth: 50, type: 'hq', name: 'PapoRide Central HQ', color: '#f59e0b' },
      { dLat: 0.0028, dLng: 0.0008, height: 55, width: 58, depth: 42, type: 'hotel', name: 'Serena Grand Hotel', color: '#06b6d4' },
      { dLat: -0.0026, dLng: 0.0006, height: 80, width: 44, depth: 44, type: 'tower', name: 'Victoria Financial Center', color: '#ec4899' },
      { dLat: 0.0007, dLng: 0.0027, height: 65, width: 60, depth: 45, type: 'commercial', name: 'Trade Fair Complex', color: '#6366f1' },
      { dLat: -0.0009, dLng: -0.0028, height: 70, width: 46, depth: 46, type: 'residential', name: 'Oysterbay Terraces', color: '#14b8a6' },
    ];

    return templates.map((tmpl, idx) => {
      const lat = center.lat + tmpl.dLat;
      const lng = center.lng + tmpl.dLng;

      // 3D Isometric Extruded Building HTML (CSS 3D / Isometric Prisms)
      const isHQ = tmpl.type === 'hq';
      const buildingHtml = `
        <div class="building-3d-wrapper relative select-none pointer-events-none" style="width: ${tmpl.width}px; height: ${tmpl.height}px;">
          <!-- Ambient Ground Drop Shadow -->
          <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: ${tmpl.width * 1.3}px; height: ${tmpl.depth * 0.5}px; background: rgba(0,0,0,0.45); border-radius: 50%; filter: blur(4px);"></div>
          
          <!-- Extruded Prism Body -->
          <div style="position: absolute; bottom: 6px; left: 0; width: ${tmpl.width}px; height: ${tmpl.height}px; display: flex; flex-direction: column; justify-content: flex-end;">
            <!-- Rooftop with Helipad / Antenna -->
            <div style="width: 100%; height: ${tmpl.depth * 0.4}px; background: linear-gradient(135deg, #1e293b, #334155); border: 1.5px solid ${tmpl.color}; border-radius: 4px 4px 0 0; box-shadow: 0 0 12px ${tmpl.color}80; display: flex; items-center; justify-content: center; position: relative;">
              ${isHQ ? `
                <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 2px; height: 14px; background: #ef4444; box-shadow: 0 0 6px #ef4444;">
                  <div style="width: 5px; height: 5px; background: #ff0000; border-radius: 50%; position: absolute; top: -2px; left: -1.5px; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                </div>
                <span style="font-size: 8px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 4px #000;">[ H ]</span>
              ` : `
                <div style="width: 10px; height: 6px; background: rgba(255,255,255,0.25); border-radius: 2px;"></div>
              `}
            </div>

            <!-- Front & Side Glass/Concrete Facade with Lit Windows -->
            <div style="width: 100%; height: ${tmpl.height - (tmpl.depth * 0.4)}px; background: linear-gradient(180deg, #0f172a, #1e293b); border-left: 1.5px solid rgba(255,255,255,0.2); border-right: 1.5px solid rgba(0,0,0,0.5); padding: 3px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; box-shadow: inset 0 0 8px rgba(0,0,0,0.8);">
              ${Array.from({ length: 12 }).map((_, wIdx) => `
                <div style="background: ${(wIdx % 3 === 0 || isHQ) ? tmpl.color : 'rgba(148, 163, 184, 0.35)'}; opacity: ${(wIdx % 2 === 0) ? '0.85' : '0.45'}; border-radius: 1px; height: 4px; box-shadow: ${(wIdx % 3 === 0 || isHQ) ? `0 0 4px ${tmpl.color}` : 'none'};"></div>
              `).join('')}
            </div>

            <!-- Floating 3D Building Label Pill -->
            <div style="position: absolute; top: -22px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.92); border: 1px solid ${tmpl.color}aa; border-radius: 8px; padding: 1px 6px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5); pointer-events: auto;">
              <span style="font-size: 8px; font-weight: 900; color: #f8fafc; text-shadow: 0 1px 2px #000;">🏢 ${tmpl.name.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: buildingHtml,
        className: 'building-3d-icon-marker',
        iconSize: [tmpl.width, tmpl.height],
        iconAnchor: [tmpl.width / 2, tmpl.height],
      });

      return {
        id: `building-${idx}`,
        lat,
        lng,
        name: tmpl.name,
        icon,
      };
    });
  }, [center.lat, center.lng]);

  return (
    <>
      {buildings.map((b) => (
        <Marker key={b.id} position={[b.lat, b.lng]} icon={b.icon} interactive={false} />
      ))}
    </>
  );
};

/**
 * Traffic Flow & Road Vectors Layer (Mwelekeo wa Trafiki)
 * Shows moving traffic flow arrows along main road corridors
 */
export const TrafficFlowLayer = ({
  center,
  visible = true,
}: {
  center: { lat: number; lng: number };
  visible: boolean;
}) => {
  if (!visible || !center?.lat || !center?.lng) return null;

  // Road corridors around center
  const corridors = useMemo(() => {
    const lat = center.lat;
    const lng = center.lng;

    return [
      {
        id: 'corridor-main-north',
        positions: [
          [lat - 0.006, lng - 0.002] as [number, number],
          [lat - 0.002, lng - 0.001] as [number, number],
          [lat + 0.002, lng + 0.001] as [number, number],
          [lat + 0.006, lng + 0.003] as [number, number],
        ],
        status: 'clear', // green
        color: '#10b981',
        name: 'Morogoro Rd Flow (Kaskazini)',
      },
      {
        id: 'corridor-east-west',
        positions: [
          [lat - 0.001, lng - 0.006] as [number, number],
          [lat, lng - 0.001] as [number, number],
          [lat + 0.001, lng + 0.004] as [number, number],
          [lat + 0.002, lng + 0.007] as [number, number],
        ],
        status: 'moderate', // amber
        color: '#f59e0b',
        name: 'Ali Hassan Mwinyi Rd Flow',
      },
      {
        id: 'corridor-port-south',
        positions: [
          [lat + 0.004, lng - 0.004] as [number, number],
          [lat + 0.001, lng - 0.002] as [number, number],
          [lat - 0.003, lng] as [number, number],
          [lat - 0.007, lng + 0.002] as [number, number],
        ],
        status: 'busy', // red
        color: '#ef4444',
        name: 'Nyerere Rd Corridor',
      },
    ];
  }, [center.lat, center.lng]);

  // Traffic Direction Flow Particles (Moving Pulse Arrows)
  const trafficPulseIcons = useMemo(() => {
    const lat = center.lat;
    const lng = center.lng;

    const points = [
      { lat: lat + 0.0015, lng: lng + 0.0008, heading: 45, speed: '42 km/h', type: 'car', color: '#10b981' },
      { lat: lat - 0.0012, lng: lng - 0.0005, heading: 45, speed: '38 km/h', type: 'bajaj', color: '#10b981' },
      { lat: lat + 0.0005, lng: lng + 0.0025, heading: 85, speed: '25 km/h', type: 'car', color: '#f59e0b' },
      { lat: lat - 0.0020, lng: lng + 0.0003, heading: 140, speed: '18 km/h', type: 'boda', color: '#ef4444' },
    ];

    return points.map((pt, idx) => {
      const html = `
        <div class="relative flex items-center justify-center pointer-events-none select-none" style="transform: rotate(${pt.heading}deg);">
          <div class="absolute w-7 h-7 rounded-full bg-emerald-500/20 animate-ping"></div>
          <div class="w-6 h-6 rounded-full bg-neutral-900 border border-white/60 shadow-lg flex items-center justify-center" style="box-shadow: 0 0 10px ${pt.color};">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${pt.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2"/>
            </svg>
          </div>
        </div>
      `;

      return {
        id: `pulse-${idx}`,
        lat: pt.lat,
        lng: pt.lng,
        icon: L.divIcon({
          html,
          className: 'traffic-pulse-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      };
    });
  }, [center.lat, center.lng]);

  return (
    <>
      {corridors.map((c) => (
        <Polyline
          key={c.id}
          positions={c.positions}
          pathOptions={{
            color: c.color,
            weight: 5,
            opacity: 0.75,
            dashArray: '8, 10',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
      {trafficPulseIcons.map((tp) => (
        <Marker key={tp.id} position={[tp.lat, tp.lng]} icon={tp.icon} interactive={false} />
      ))}
    </>
  );
};

/**
 * High-tech Military/Satellite Reconnaissance HUD for "God's Eye View" (90° Top-Down)
 */
export const GodsEyeHudTelemetry = ({
  center,
  zoom = 15,
  onClose,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  onClose: () => void;
}) => {
  const [scanAngle, setScanAngle] = useState(0);

  // Rotate radar scan sweep
  useEffect(() => {
    const timer = setInterval(() => {
      setScanAngle((prev) => (prev + 3) % 360);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  // Compute calculated altitude based on zoom level
  const altitudeEstimate = useMemo(() => {
    // Zoom 18 ~ 300m, Zoom 15 ~ 1,200m, Zoom 12 ~ 5,000m
    const alt = Math.round(15000 * Math.pow(2, 13 - zoom));
    return Math.max(250, alt);
  }, [zoom]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[1200] overflow-hidden flex flex-col justify-between p-3 sm:p-5">
      {/* Top Banner: God's Eye Recon Status */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5 bg-neutral-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-emerald-500/40 shadow-2xl">
          <div className="relative w-3.5 h-3.5 flex items-center justify-center">
            <span className="absolute w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-black tracking-wider uppercase text-emerald-400 font-mono">
                🛰️ GOD'S EYE VIEW • LIVE
              </span>
              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ANGANI 90° TOP-DOWN
              </span>
            </div>
            <p className="text-[9px] font-mono text-neutral-400">
              ORBITAL SATELLITE RECON • MTAA MZIMA BILA KIZUIZI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Telemetry Badge */}
          <div className="hidden sm:flex flex-col items-end bg-neutral-950/85 backdrop-blur-md px-3 py-1 rounded-xl border border-neutral-800 text-[9.5px] font-mono text-neutral-300">
            <span className="text-emerald-400 font-bold">ALT: {altitudeEstimate.toLocaleString()} METERS</span>
            <span className="text-neutral-400 text-[8.5px]">LAT: {center.lat.toFixed(5)} • LNG: {center.lng.toFixed(5)}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-[10px] font-black text-neutral-200 active:scale-95 transition-all shadow-lg flex items-center gap-1"
          >
            <span>Toka</span>
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Center Radar Scanner Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Concentric Range Circles */}
        <div className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] rounded-full border border-emerald-500/25 flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-emerald-500/20" />
          {/* Inner ring 500m */}
          <div className="w-2/3 h-2/3 rounded-full border border-emerald-500/30 flex items-center justify-center">
            {/* Inner core 200m */}
            <div className="w-1/2 h-1/2 rounded-full border border-emerald-500/40 relative">
              {/* Radar rotating sweep beam */}
              <div
                className="absolute inset-0 origin-center pointer-events-none"
                style={{
                  transform: `rotate(${scanAngle}deg)`,
                  background: 'conic-gradient(from 0deg, rgba(16, 185, 129, 0.25) 0deg, transparent 60deg)',
                  borderRadius: '50%',
                }}
              />
            </div>
          </div>

          {/* Crosshairs */}
          <div className="absolute w-full h-[1px] bg-emerald-500/25" />
          <div className="absolute h-full w-[1px] bg-emerald-500/25" />

          {/* Range Labels */}
          <span className="absolute top-2 right-1/2 translate-x-1/2 text-[8px] font-mono text-emerald-400/70">500M RECON</span>
          <span className="absolute bottom-2 right-1/2 translate-x-1/2 text-[8px] font-mono text-emerald-400/70">RADAR 360°</span>
        </div>
      </div>

      {/* Bottom Telemetry Bar */}
      <div className="flex items-center justify-between text-[9px] font-mono text-neutral-300 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 pointer-events-auto">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" /> SATELLITE: CONNECTED
          </span>
          <span className="text-neutral-400">FPS: 60 • LATENCY: 22ms</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">GRID ACCURACY: 99.8%</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 3D Bird's-Eye Perspective Floating Controller (Pitch Slider, Compass, 3D Toggles)
 */
export const ThreeDBirdseyeControlWidget = ({
  pitch,
  onPitchChange,
  rotation,
  onRotationChange,
  showBuildings,
  onToggleBuildings,
  showTraffic,
  onToggleTraffic,
  onReset,
}: {
  pitch: number;
  onPitchChange: (pitch: number) => void;
  rotation: number;
  onRotationChange: (rotation: number) => void;
  showBuildings: boolean;
  onToggleBuildings: () => void;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  onReset: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-16 sm:bottom-20 right-3 sm:right-5 z-[1100] flex flex-col items-end gap-2 pointer-events-auto">
      {/* Expanded Quick Settings Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800 rounded-2xl p-3.5 shadow-2xl text-white w-64 space-y-3 font-sans"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎮</span>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                  3D Bird's-Eye Angle
                </span>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="text-[9px] font-bold text-neutral-400 hover:text-white flex items-center gap-1 active:scale-95"
                title="Weka pembe ya asili"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Pitch Angle Preset Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                <span>Pembe ya Kuinama (Pitch Tilt):</span>
                <span className="text-emerald-400 font-mono font-black">{pitch}°</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { angle: 30, label: '30° Mpole' },
                  { angle: 50, label: '50° 3D Game' },
                  { angle: 65, label: '65° Cinema' },
                ].map((p) => (
                  <button
                    key={p.angle}
                    type="button"
                    onClick={() => onPitchChange(p.angle)}
                    className={`py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                      pitch === p.angle
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Heading Compass Wheel */}
            <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
              <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                <span>Zungusha Ramani (360° Compass):</span>
                <span className="text-indigo-400 font-mono font-black">{rotation}°</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRotationChange((rotation - 30 + 360) % 360)}
                  className="px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-black text-neutral-200"
                >
                  ↺ -30°
                </button>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={rotation}
                  onChange={(e) => onRotationChange(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onRotationChange((rotation + 30) % 360)}
                  className="px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-black text-neutral-200"
                >
                  +30° ↻
                </button>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Vipengele vya 3D:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {/* 3D Buildings */}
                <button
                  type="button"
                  onClick={onToggleBuildings}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-between border transition-all ${
                    showBuildings
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-xs'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Majengo 3D</span>
                  </div>
                  {showBuildings && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                {/* Traffic Flow */}
                <button
                  type="button"
                  onClick={onToggleTraffic}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-between border transition-all ${
                    showTraffic
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-xs'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" />
                    <span>Trafiki Live</span>
                  </div>
                  {showTraffic && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-10 px-3.5 rounded-2xl bg-neutral-950/90 backdrop-blur-xl border border-indigo-500/40 text-white shadow-2xl flex items-center gap-2 text-xs font-black hover:border-indigo-400 active:scale-95 transition-all"
        title="Mipangilio ya 3D Bird's-Eye"
      >
        <span className="text-sm">🎮</span>
        <span>Mchezo 3D ({pitch}°)</span>
        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
      </button>
    </div>
  );
};

/**
 * Main Top Segmented Switcher for Map Perspectives:
 * [ 🗺️ 2D Kawaida ] [ 🎮 3D Bird's-Eye ] [ 🛰️ God's Eye (90°) ]
 */
export const MapPerspectiveSegmentedPicker = ({
  mode,
  onModeChange,
  theme = 'dark',
  className = '',
}: {
  mode: MapPerspectiveMode;
  onModeChange: (mode: MapPerspectiveMode) => void;
  theme?: 'dark' | 'light';
  className?: string;
}) => {
  return (
    <div
      className={`flex items-center p-1 rounded-2xl border shadow-xl backdrop-blur-xl transition-all select-none ${
        theme === 'dark' 
          ? 'bg-[#12121a]/95 border-neutral-800 text-white shadow-black/50' 
          : 'bg-white/95 border-neutral-200/90 text-neutral-900 shadow-neutral-900/15'
      } ${className}`}
    >
      {/* 1. Standard 2D */}
      <button
        type="button"
        onClick={() => onModeChange('standard')}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
          mode === 'standard'
            ? (theme === 'dark' ? 'bg-neutral-800 text-white shadow-sm' : 'bg-neutral-900 text-white shadow-sm')
            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
        }`}
      >
        <span>🗺️</span>
        <span>2D Kawaida</span>
      </button>

      {/* 2. 3D Bird's-Eye Perspective */}
      <button
        type="button"
        onClick={() => onModeChange('3d_birdseye')}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
          mode === '3d_birdseye'
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/50'
            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
        }`}
      >
        <span>🎮</span>
        <span>3D Bird's-Eye</span>
      </button>

      {/* 3. God's Eye View (90° Top-Down Satellite) */}
      <button
        type="button"
        onClick={() => onModeChange('gods_eye')}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
          mode === 'gods_eye'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/50'
            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
        }`}
      >
        <span>🛰️</span>
        <span className="flex items-center gap-1">
          <span>God's Eye</span>
          <span className="text-[8px] bg-emerald-400/30 text-emerald-200 px-1 py-0.2 rounded font-mono">90°</span>
        </span>
      </button>
    </div>
  );
};
