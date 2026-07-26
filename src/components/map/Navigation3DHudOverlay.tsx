import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation2, 
  CornerUpRight, 
  CornerUpLeft, 
  ArrowUp, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  MessageSquare, 
  Compass, 
  Gauge, 
  Eye, 
  Layers, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Ride } from '../../types/trip.types';

export interface RouteStepProp {
  distance: number;
  duration: number;
  instruction: string;
  location: [number, number];
}

export interface Navigation3DHudOverlayProps {
  ride: Ride;
  isDriver?: boolean;
  driverLocation?: { lat: number; lng: number } | null;
  targetLocation?: { lat: number; lng: number } | null;
  currentSpeed?: number;
  routeSteps?: RouteStepProp[];
  is3DMode?: boolean;
  onToggle3D?: () => void;
  onRecenter?: () => void;
  onOpenChat?: () => void;
  isVoiceMuted?: boolean;
  onToggleVoice?: () => void;
  activeViewersCount?: number;
}

export const Navigation3DHudOverlay: React.FC<Navigation3DHudOverlayProps> = ({
  ride,
  isDriver = false,
  driverLocation,
  targetLocation,
  currentSpeed: customSpeed,
  routeSteps,
  is3DMode = true,
  onToggle3D,
  onRecenter,
  onOpenChat,
  isVoiceMuted = false,
  onToggleVoice,
  activeViewersCount = 0,
}) => {
  const isArriving = ride.status === 'accepted' || ride.status === 'driver_arriving';
  const isOnTrip = ride.status === 'on_trip';

  // Target destination details
  const destinationName = isArriving 
    ? ((ride.pickup as any)?.name || ride.pickup?.address || 'Pickup Point') 
    : ((ride.destination as any)?.name || ride.destination?.address || 'Destination');

  // Calculate distance in meters / km
  const { distMeters, formattedDist, etaMins } = useMemo(() => {
    const loc1 = driverLocation || ride.driverLocation;
    const loc2 = targetLocation || (isArriving ? ride.pickup : ride.destination);

    if (!loc1 || !loc2) {
      return { distMeters: 501, formattedDist: '501m', etaMins: 4 };
    }

    const R = 6371e3;
    const φ1 = (loc1.lat * Math.PI) / 180;
    const φ2 = (loc2.lat * Math.PI) / 180;
    const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = Math.round(R * c);

    const formatted = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters}m`;
    const mins = Math.max(1, Math.round((meters / 1000) / 0.5)); // ~30 km/h avg

    return { distMeters: meters, formattedDist: formatted, etaMins: mins };
  }, [driverLocation, targetLocation, ride.driverLocation, ride.pickup, ride.destination, isArriving]);

  // Simulated live speed calculation if no custom speed passed
  const [speed, setSpeed] = useState<number>(customSpeed || 48);

  useEffect(() => {
    if (typeof customSpeed === 'number') {
      setSpeed(customSpeed);
      return;
    }
    // Dynamic realistic driving speed oscillation
    const interval = setInterval(() => {
      setSpeed(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        const nextSpeed = Math.min(78, Math.max(18, prev + delta));
        return nextSpeed;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [customSpeed]);

  // Smooth Speed Interpolation for low latency real-time updates (GPU/raf optimized)
  const [interpolatedSpeed, setInterpolatedSpeed] = useState<number>(speed);
  useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;
    const startSpeed = interpolatedSpeed;
    const targetSpeed = speed;
    const duration = 600; // ms

    if (Math.abs(startSpeed - targetSpeed) < 0.5) {
      setInterpolatedSpeed(targetSpeed);
      return;
    }

    const animateStep = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Easing curve
      const eased = 1 - Math.pow(1 - progress, 3);
      setInterpolatedSpeed(Math.round(startSpeed + (targetSpeed - startSpeed) * eased));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateStep);
      }
    };

    animationFrameId = requestAnimationFrame(animateStep);
    return () => cancelAnimationFrame(animationFrameId);
  }, [speed]);

  // Dynamic traffic light simulation state
  const [trafficLight, setTrafficLight] = useState<{ color: 'red' | 'green'; timer: number }>({ color: 'green', timer: 12 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTrafficLight(prev => {
        if (prev.timer <= 1) {
          return prev.color === 'red' 
            ? { color: 'green', timer: 20 }
            : { color: 'red', timer: 8 };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Maneuver Turn Logic driven by real route steps when available, or distance fallback
  const currentManeuver = useMemo(() => {
    // 1. Real Routing Data Steps (from OSRM / Directions API)
    if (routeSteps && routeSteps.length > 0 && driverLocation) {
      const activeStep = routeSteps.find((step) => {
        const dLat = (step.location[0] - driverLocation.lat) * 111000;
        const dLng = (step.location[1] - driverLocation.lng) * 111000 * Math.cos((driverLocation.lat * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        return dist > 15;
      }) || routeSteps[0];

      if (activeStep) {
        const instr = activeStep.instruction.toLowerCase();
        let icon: 'left' | 'right' | 'straight' | 'check' = 'straight';
        let laneActiveIndex = 1;

        if (instr.includes('left') || instr.includes('kushoto')) {
          icon = 'left';
          laneActiveIndex = 0;
        } else if (instr.includes('right') || instr.includes('kulia')) {
          icon = 'right';
          laneActiveIndex = 3;
        } else if (instr.includes('destination') || instr.includes('arrive') || instr.includes('fika')) {
          icon = 'check';
          laneActiveIndex = 1;
        }

        const cleanTitle = activeStep.instruction
          .replace(/^(Head|Turn|Continue|Merge|Keep|Ingia|Kata|Endelea)\s*(left|right|straight|onto|kushoto|kulia)?\s*/i, '')
          .trim() || destinationName;

        return {
          type: icon,
          icon,
          title: cleanTitle.length > 25 ? `${cleanTitle.substring(0, 25)}...` : cleanTitle,
          laneActiveIndex,
          stepDistFormatted: activeStep.distance >= 1000 ? `${(activeStep.distance / 1000).toFixed(1)} km` : `${Math.round(activeStep.distance)}m`,
        };
      }
    }

    // 2. Fallback based on distance remaining
    if (distMeters <= 80) {
      return {
        type: 'destination',
        icon: 'check',
        title: isArriving ? 'Fika Pickup Point' : 'Umewahi Eneo la Mteja',
        laneActiveIndex: 1,
        stepDistFormatted: formattedDist,
      };
    } else if (distMeters <= 350) {
      return {
        type: 'turn_right',
        icon: 'right',
        title: destinationName.length > 22 ? `${destinationName.substring(0, 22)}...` : destinationName,
        laneActiveIndex: 3, // Highlight right lane ↱
        stepDistFormatted: formattedDist,
      };
    } else if (distMeters <= 700) {
      return {
        type: 'turn_left',
        icon: 'left',
        title: 'Wangjing Street / Nyerere Rd',
        laneActiveIndex: 0, // Highlight left lane ↰
        stepDistFormatted: formattedDist,
      };
    } else {
      return {
        type: 'straight',
        icon: 'straight',
        title: destinationName,
        laneActiveIndex: 1, // Highlight middle lane ⬆
        stepDistFormatted: formattedDist,
      };
    }
  }, [routeSteps, driverLocation, distMeters, destinationName, formattedDist, isArriving]);

  const isNearJunction = distMeters > 50 && distMeters <= 380;

  return (
    <div 
      className="absolute inset-x-0 top-0 z-[500] pointer-events-none flex flex-col items-center"
      style={{
        transform: 'translate3d(0,0,0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform, opacity',
      }}
    >
      {/* --- TOP 3D NAVIGATION GUIDANCE HEADER (DARK GLASS) --- */}
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 180 }}
        className="w-full max-w-[480px] px-2 pt-2 sm:pt-3 pointer-events-auto"
      >
        <div className="bg-[#0B1220]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-3 shadow-[0_16px_50px_rgba(0,0,0,0.6)] text-white overflow-hidden relative">
          {/* Subtle Ambient Route Beam Glow */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-cyan-500/20 blur-2xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/20 blur-2xl rounded-full pointer-events-none" />

          {/* Main Direction Banner Row */}
          <div className="flex items-center justify-between gap-3 relative z-10">
            {/* Maneuver Arrow Box */}
            <div className="w-13 h-13 sm:w-14 sm:h-14 bg-blue-600/90 rounded-2xl border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(37,99,235,0.5)]">
              {currentManeuver.icon === 'right' && (
                <CornerUpRight className="w-8 h-8 text-white stroke-[2.5] animate-pulse" />
              )}
              {currentManeuver.icon === 'left' && (
                <CornerUpLeft className="w-8 h-8 text-white stroke-[2.5] animate-pulse" />
              )}
              {currentManeuver.icon === 'straight' && (
                <ArrowUp className="w-8 h-8 text-white stroke-[2.5]" />
              )}
              {currentManeuver.icon === 'check' && (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 stroke-[2.5]" />
              )}
            </div>

            {/* Distance and Road Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono leading-none">
                  {formattedDist}
                </span>
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  ~{etaMins} min
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-100 truncate mt-0.5 tracking-wide">
                {currentManeuver.title}
              </h3>
            </div>

            {/* Quick Action Controls Header */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleVoice && (
                <button
                  onClick={onToggleVoice}
                  className={`p-2 rounded-xl border transition-all active:scale-95 ${
                    !isVoiceMuted 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                  title={isVoiceMuted ? "Enable Voice Guidance" : "Mute Voice Guidance"}
                >
                  {!isVoiceMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {onToggle3D && (
                <button
                  onClick={onToggle3D}
                  className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                    is3DMode 
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  {is3DMode ? '3D' : '2D'}
                </button>
              )}
            </div>
          </div>

          {/* Lane Guidance Indicators Bar (Shown for Driver in full HUD) */}
          {isDriver && (
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Njia za Barabara:
                </span>
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl">
                  {/* Lane 1: Left */}
                  <div className={`px-2 py-0.5 rounded-lg flex items-center justify-center transition-all ${
                    currentManeuver.laneActiveIndex === 0 
                      ? 'bg-cyan-500 text-black font-black shadow-[0_0_10px_rgba(6,182,212,0.8)] scale-105' 
                      : 'text-slate-500'
                  }`}>
                    <span className="text-xs font-black">↰</span>
                  </div>
                  {/* Lane 2: Straight */}
                  <div className={`px-2 py-0.5 rounded-lg flex items-center justify-center transition-all ${
                    currentManeuver.laneActiveIndex === 1 
                      ? 'bg-cyan-500 text-black font-black shadow-[0_0_10px_rgba(6,182,212,0.8)] scale-105' 
                      : 'text-slate-500'
                  }`}>
                    <span className="text-xs font-black">⬆</span>
                  </div>
                  {/* Lane 3: Straight */}
                  <div className={`px-2 py-0.5 rounded-lg flex items-center justify-center transition-all ${
                    currentManeuver.laneActiveIndex === 2 
                      ? 'bg-cyan-500 text-black font-black shadow-[0_0_10px_rgba(6,182,212,0.8)] scale-105' 
                      : 'text-slate-500'
                  }`}>
                    <span className="text-xs font-black">⬆</span>
                  </div>
                  {/* Lane 4: Right */}
                  <div className={`px-2 py-0.5 rounded-lg flex items-center justify-center transition-all ${
                    currentManeuver.laneActiveIndex === 3 
                      ? 'bg-amber-400 text-black font-black shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-105' 
                      : 'text-slate-500'
                  }`}>
                    <span className="text-xs font-black">↱</span>
                  </div>
                </div>
              </div>

              {/* Live Status Badge */}
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[9.5px] font-bold text-emerald-400 uppercase tracking-widest">
                  GPS DIRA
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* --- 3D JUNCTION PREVIEW CARD (Visible for Driver when approaching intersection < 380m) --- */}
      <AnimatePresence>
        {isDriver && isNearJunction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="w-full max-w-[480px] px-2 pt-1.5 pointer-events-auto"
          >
            <div className="bg-[#0f172a]/95 border border-cyan-500/30 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                  <Navigation2 className="w-3 h-3 animate-bounce" /> 3D BARABARA YA NJIA PANDA (JUNCTION VIEW)
                </span>
                <span className="text-[9px] font-bold text-slate-400 font-mono">
                  {distMeters}m kabla ya kona
                </span>
              </div>

              {/* 3D Road Graphic Box */}
              <div className="h-20 bg-slate-900/90 rounded-xl border border-slate-700/80 relative overflow-hidden flex items-center justify-center">
                {/* Road surface texture */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800" />
                
                {/* Lane Dividers */}
                <div className="absolute inset-y-0 left-1/3 border-r-2 border-dashed border-slate-600/60" />
                <div className="absolute inset-y-0 left-2/3 border-r-2 border-dashed border-slate-600/60" />
                
                {/* Pedestrian Zebra Crossings */}
                <div className="absolute bottom-2 inset-x-0 h-3 flex justify-around opacity-40">
                  <div className="w-3 h-full bg-white" />
                  <div className="w-3 h-full bg-white" />
                  <div className="w-3 h-full bg-white" />
                  <div className="w-3 h-full bg-white" />
                  <div className="w-3 h-full bg-white" />
                </div>

                {/* Turn Curve Path Graphic */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80">
                  <path 
                    d="M 150 80 Q 150 40 190 30" 
                    fill="none" 
                    stroke="#F59E0B" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    className="animate-pulse"
                  />
                  <path 
                    d="M 150 80 Q 150 40 190 30" 
                    fill="none" 
                    stroke="#FEF08A" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                  />
                  {/* Arrowhead */}
                  <polygon points="190,24 198,30 188,36" fill="#F59E0B" />
                </svg>

                {/* Turn Sign Overlay */}
                <div className="absolute top-2 right-3 bg-blue-600 text-white font-black text-xs px-2 py-0.5 rounded-md flex items-center gap-1 shadow-lg">
                  <CornerUpRight className="w-3.5 h-3.5" />
                  <span>Kona ya Kulia</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FLOATING MAP BADGES (LEFT & RIGHT OVERLAY) --- */}
      <div className="w-full max-w-[480px] px-3 mt-3 flex items-start justify-between pointer-events-none">
        
        {/* LEFT COLUMN: SPEEDOMETER (and driver-specific badges) */}
        <div className="flex flex-col items-start gap-2.5 pointer-events-auto">
          {/* Circular Speedometer Badge (Both Customer & Driver) */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white dark:bg-[#0f172a] border-2 border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col items-center justify-center text-slate-900 dark:text-white relative"
          >
            <span className="text-xl sm:text-2xl font-black font-mono leading-none tracking-tight">
              {interpolatedSpeed}
            </span>
            <span className="text-[8px] font-bold uppercase text-slate-500 dark:text-slate-400 mt-0.5">
              km/h
            </span>

            {/* Glowing active rim */}
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/40 animate-ping opacity-25 pointer-events-none" />
          </motion.div>

          {/* Driver-Specific Extra Badges */}
          {isDriver && (
            <>
              {/* Speed Limit Indicator */}
              <div className="w-10 h-10 rounded-full bg-white border-2 border-red-600 shadow-lg flex items-center justify-center font-black text-slate-900 text-xs font-mono">
                50
              </div>

              {/* Traffic Light Signal Countdown Widget */}
              <motion.div 
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`px-2.5 py-1 rounded-full border shadow-lg flex items-center gap-1.5 font-mono text-xs font-black ${
                  trafficLight.color === 'red'
                    ? 'bg-red-950/90 border-red-500/50 text-red-400'
                    : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400'
                }`}
              >
                <span className="text-sm">
                  {trafficLight.color === 'red' ? '🔴' : '🟢'}
                </span>
                <span>{trafficLight.timer}s</span>
              </motion.div>

              {/* Pedestrian Alert Badge */}
              <div className="bg-slate-900/90 border border-amber-500/40 px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 text-amber-300 text-[10px] font-black">
                <span>🚸</span>
                <span>110m Crossing</span>
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: RECENTER, CHAT, SHARE, VIEWERS */}
        <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
          {/* Recenter / Focus Vehicle Button */}
          {onRecenter && (
            <button
              onClick={onRecenter}
              className="w-11 h-11 rounded-2xl bg-[#0f172a]/90 backdrop-blur-md border border-cyan-500/40 text-cyan-400 shadow-xl flex items-center justify-center active:scale-90 transition-transform"
              title="Lenga Gari Kwenye Ramani"
            >
              <Compass className="w-5 h-5 animate-spin [animation-duration:10s]" />
            </button>
          )}

          {/* Chat with Driver / Customer button */}
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="w-11 h-11 rounded-2xl bg-indigo-600 text-white border border-indigo-400/50 shadow-xl flex items-center justify-center active:scale-90 transition-transform relative"
              title="Ujumbe wa Safari"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </button>
          )}

          {/* Viewer count pill if spectators are tracking ride */}
          {activeViewersCount > 0 && (
            <div className="bg-blue-950/90 border border-blue-400/40 text-blue-300 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>{activeViewersCount} Wanatazama</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
