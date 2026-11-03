import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, Navigation, Navigation2, Plus, Minus, RotateCcw, RotateCw, 
  Layers, Map as MapIcon, Sun, Moon, Eye, EyeOff, Check, X, Shield, Volume2
} from 'lucide-react';
import { toast } from 'sonner';

interface SmartRotationControlsProps {
  currentRotation: number;
  onSetRotation: (angle: number) => void;
  isHeadingUp: boolean;
  onToggleHeadingUp: () => void;
  is3DMode: boolean;
  onToggle3D: () => void;
  autoFollow: boolean;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  mapType: 'standard' | 'satellite';
  onSetMapType: (type: 'standard' | 'satellite') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  isMinimized?: boolean;
}

export default function SmartRotationControls({
  currentRotation,
  onSetRotation,
  isHeadingUp,
  onToggleHeadingUp,
  is3DMode,
  onToggle3D,
  autoFollow,
  onRecenter,
  onZoomIn,
  onZoomOut,
  mapType,
  onSetMapType,
  theme,
  onToggleTheme,
  showLabels = true,
  onToggleLabels,
  isMinimized = false
}: SmartRotationControlsProps) {
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isDraggingDial, setIsDraggingDial] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);

  // Normalized display angle (0 - 359)
  const normalizedAngle = Math.round(((currentRotation % 360) + 360) % 360);

  // Cardinal direction label
  const getCardinalDirection = (deg: number) => {
    if (deg >= 338 || deg < 23) return 'N';
    if (deg >= 23 && deg < 68) return 'NE';
    if (deg >= 68 && deg < 113) return 'E';
    if (deg >= 113 && deg < 158) return 'SE';
    if (deg >= 158 && deg < 203) return 'S';
    if (deg >= 203 && deg < 248) return 'SW';
    if (deg >= 248 && deg < 293) return 'W';
    return 'NW';
  };

  const cardinal = getCardinalDirection(normalizedAngle);

  // Interactive 360° Drag Dial Gesture (mouse & touch)
  useEffect(() => {
    if (!isDraggingDial) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;

      // Calculate angle from vertical (North = 0 deg)
      let angleRad = Math.atan2(deltaY, deltaX);
      let angleDeg = (angleRad * (180 / Math.PI)) + 90;
      if (angleDeg < 0) angleDeg += 360;

      onSetRotation(Math.round(angleDeg));
    };

    const handlePointerUp = () => {
      setIsDraggingDial(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDraggingDial, onSetRotation]);

  if (isMinimized) return null;

  return (
    <div className="absolute right-3.5 top-20 z-[9000] flex flex-col items-end gap-2 pointer-events-auto select-none font-sans">
      
      {/* 1. Layers & Settings Flyout Modal */}
      <AnimatePresence>
        {showLayerMenu && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.16 }}
            className="w-56 p-3 rounded-2xl bg-white/95 dark:bg-[#111118]/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-[#1e1e2e] shadow-2xl flex flex-col gap-2 mb-1"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                Mipangilio ya Ramani
              </span>
              <button
                onClick={() => setShowLayerMenu(false)}
                className="w-5 h-5 rounded-md flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Map Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Mwonekano</span>
              </div>
              <span className="text-[9.5px] font-black uppercase text-neutral-400">
                {theme === 'dark' ? 'Giza 🌙' : 'Mchana ☀️'}
              </span>
            </button>

            {/* Satellite Imagery Toggle */}
            <button
              onClick={() => onSetMapType(mapType === 'satellite' ? 'standard' : 'satellite')}
              className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Satelaiti</span>
              </div>
              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                mapType === 'satellite' ? 'bg-sky-500/20 text-sky-400' : 'text-neutral-400'
              }`}>
                {mapType === 'satellite' ? 'WASHWA' : 'ZIMA'}
              </span>
            </button>

            {/* 3D Perspective Tilt */}
            <button
              onClick={onToggle3D}
              className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Navigation2 className="w-4 h-4 text-purple-400 rotate-45" />
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Mtazamo wa 3D</span>
              </div>
              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                is3DMode ? 'bg-purple-500/20 text-purple-400' : 'text-neutral-400'
              }`}>
                {is3DMode ? '3D ON' : '2D FLAT'}
              </span>
            </button>

            {/* Smart Labels Toggle */}
            {onToggleLabels && (
              <button
                onClick={onToggleLabels}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Majina ya Maeneo</span>
                </div>
                <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                  showLabels ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-400'
                }`}>
                  {showLabels ? 'ON' : 'OFF'}
                </span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Interactive 3D Compass Needle & Drag Bezel */}
      <div 
        ref={dialRef}
        className="relative group p-1.5 rounded-2xl bg-white/95 dark:bg-[#111118]/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-[#1e1e2e] shadow-xl flex flex-col items-center gap-1"
      >
        {/* Main Circular Compass Disc */}
        <div
          onMouseDown={() => setIsDraggingDial(true)}
          onTouchStart={() => setIsDraggingDial(true)}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-950 border-2 border-neutral-300 dark:border-neutral-800 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-inner group/dial"
          title="Kokota kwa mzunguko wa 360°, au gonga kurudisha Kaskazini"
        >
          {/* Compass Outer Tick Marks */}
          <div className="absolute inset-0 rounded-full border border-neutral-400/20 pointer-events-none" />
          <div className="absolute top-0.5 w-1 h-1.5 bg-rose-500 rounded-full" />
          <div className="absolute bottom-0.5 w-1 h-1.5 bg-neutral-400 rounded-full" />
          <div className="absolute left-0.5 w-1.5 h-1 bg-neutral-400 rounded-full" />
          <div className="absolute right-0.5 w-1.5 h-1 bg-neutral-400 rounded-full" />

          {/* Rotating Double Needle */}
          <div 
            className="w-full h-full relative flex items-center justify-center pointer-events-none transition-transform duration-200"
            style={{ transform: `rotate(${-currentRotation}deg)` }}
          >
            {/* North Red Pointer */}
            <div className="absolute top-1.5 flex flex-col items-center">
              <span className="text-[8px] font-black text-rose-500 leading-none select-none drop-shadow-xs">N</span>
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[12px] border-b-rose-500 mt-0.5" />
            </div>

            {/* Center Pivot Jewel */}
            <div className="w-3 h-3 rounded-full bg-neutral-800 dark:bg-white border-2 border-neutral-900 shadow-md z-10 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-rose-500" />
            </div>

            {/* South White/Silver Pointer */}
            <div className="absolute bottom-1.5 flex flex-col items-center">
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[12px] border-t-neutral-400 mb-0.5" />
              <span className="text-[7.5px] font-black text-neutral-400 leading-none select-none">S</span>
            </div>
          </div>
        </div>

        {/* Live Degree Readout & Reset North Pill */}
        <button
          onClick={() => {
            onSetRotation(0);
            toast.success("🧭 Ramani imerejea Kaskazini (North-Up 0°)");
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-rose-500/15 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 hover:text-rose-500 transition-colors cursor-pointer"
          title="Bonyeza kurudisha Kaskazini (North-Up 0°)"
        >
          <span className="text-[8.5px] font-black font-mono">
            {normalizedAngle}° {cardinal}
          </span>
        </button>

        {/* Quick 45° Steppers */}
        <div className="flex items-center gap-1 border-t border-neutral-200/60 dark:border-neutral-800/80 pt-1 mt-0.5 w-full justify-center">
          <button
            onClick={() => {
              onSetRotation(((currentRotation - 45) % 360 + 360) % 360);
              toast.info("↺ Zungusha Kushoto (-45°)");
            }}
            className="w-6 h-6 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors"
            title="Zungusha Kushoto (↺ 45°)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              onSetRotation(((currentRotation + 45) % 360 + 360) % 360);
              toast.info("↻ Zungusha Kulia (+45°)");
            }}
            className="w-6 h-6 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors"
            title="Zungusha Kulia (↻ 45°)"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 3. Core Action Buttons Stack (Locate Me, Follow Direction, Zoom In, Zoom Out, Layers) */}
      <div className="p-1 rounded-2xl bg-white/95 dark:bg-[#111118]/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-[#1e1e2e] shadow-xl flex flex-col items-center gap-1">
        
        {/* GPS Recenter / My Location Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            onRecenter();
            toast.success("🎯 Ramani imelenga eneo lako la sasa");
          }}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            autoFollow
              ? 'bg-emerald-500/20 text-[#00B14F] dark:text-[#00FF88] ring-2 ring-emerald-500/40 shadow-sm'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title="Lenga Eneo Lako la Sasa (Locate Me)"
        >
          <svg 
            viewBox="0 0 24 24" 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.8" fill="currentColor" />
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
          </svg>
          {autoFollow && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}
        </motion.button>

        {/* Follow Direction (Heading-Up) Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleHeadingUp}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            isHeadingUp
              ? 'bg-blue-500/20 text-blue-500 ring-2 ring-blue-500/40 shadow-sm'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={isHeadingUp ? "Mwelekeo wa Njia (Heading-Up: ON)" : "Mwelekeo wa Kaskazini (North-Up: ON)"}
        >
          <Navigation className={`w-5 h-5 transition-transform duration-300 ${isHeadingUp ? 'fill-blue-500 text-blue-500' : ''}`} />
          {isHeadingUp && (
            <span className="absolute bottom-1 right-1 text-[7px] font-black text-blue-500 bg-blue-500/20 px-1 rounded">
              HDG
            </span>
          )}
        </motion.button>

        <div className="w-6 h-[1px] bg-neutral-200 dark:bg-neutral-800 my-0.5" />

        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          className="w-10 h-8 rounded-lg flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Kuza Ramani (Zoom In)"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          className="w-10 h-8 rounded-lg flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Punguza Ramani (Zoom Out)"
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="w-6 h-[1px] bg-neutral-200 dark:bg-neutral-800 my-0.5" />

        {/* Map Layers Dropdown Button */}
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className={`w-10 h-9 rounded-xl flex items-center justify-center transition-colors ${
            showLayerMenu 
              ? 'bg-orange-500/20 text-orange-500' 
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title="Tabaka za Ramani (Map Layers)"
        >
          <Layers className="w-4 h-4 stroke-[2.2]" />
        </button>
      </div>
    </div>
  );
}
