import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, X, Navigation, QrCode, Compass, Scan, Store, Scissors, 
  Coffee, Gift, Heart, Star, Sparkles, CheckCircle, ArrowRight,
  MapPin, RefreshCw, AlertCircle, Volume2, VolumeX, Eye,
  Trophy, Award, HelpCircle, Gamepad2, ArrowLeft, HeartHandshake
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ARMapViewProps {
  vendors: any[];
  initialTargetVendorId?: string;
  onClose: () => void;
  userCoords?: { lat: number; lng: number };
  arRouteId?: string | null;
}

// Map custom string icons to Lucide components
export const AR_ICONS: Record<string, any> = {
  store: Store,
  scissors: Scissors,
  coffee: Coffee,
  gift: Gift,
  heart: Heart,
  star: Star,
  mappin: MapPin,
};

export default function ARMapView({ vendors, initialTargetVendorId, onClose, userCoords, arRouteId = null }: ARMapViewProps) {
  // Route / Tour States
  const [arRoute, setArRoute] = useState<any>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizSelectedOption, setQuizSelectedOption] = useState<string>('');
  const [quizSolved, setQuizSolved] = useState(false);
  const [quizRewardInfo, setQuizRewardInfo] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Navigation & GPS States
  const [userLocation, setUserLocation] = useState(userCoords || { lat: -6.7924, lng: 39.2083 });
  const [targetVendor, setTargetVendor] = useState<any>(null);
  
  // Simulation and Orientation States
  const [deviceHeading, setDeviceHeading] = useState(0); // 0 = North, 90 = East, etc.
  const [simulatedHeading, setSimulatedHeading] = useState(0); // For desktop manual dragging
  const [isSensorsSupported, setIsSensorsSupported] = useState(false);
  const [isSensorPermissionDenied, setIsSensorPermissionDenied] = useState(false);
  const [simulatedDistance, setSimulatedDistance] = useState<number | null>(null);
  const [isSimulatingWalk, setIsSimulatingWalk] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);

  // Camera States
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Scan States
  const [scanMode, setScanMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Compass Drag / Manual Control States
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startHeadingRef = useRef(0);

  // Initialize target vendor
  useEffect(() => {
    if (initialTargetVendorId) {
      const found = vendors.find(v => v.id === initialTargetVendorId);
      if (found) {
        setTargetVendor(found);
        setHasArrived(false);
        // Start simulation distance from real/simulated GPS
        const realDist = calculateDistanceMeters(
          userLocation.lat, 
          userLocation.lng, 
          found.location?.lat || userLocation.lat, 
          found.location?.lng || userLocation.lng
        );
        setSimulatedDistance(Math.round(Math.max(15, realDist)));
      }
    } else if (vendors.length > 0) {
      // Default to closest vendor
      setTargetVendor(vendors[0]);
      setSimulatedDistance(120); // default simulation start
    }
  }, [initialTargetVendorId, vendors]);

  // Fetch Route from Firestore if arRouteId is provided
  useEffect(() => {
    async function fetchRoute() {
      if (!arRouteId) return;
      setIsLoadingRoute(true);
      try {
        const routeDoc = await getDoc(doc(db, 'ar_routes', arRouteId));
        if (routeDoc.exists()) {
          const routeData = { id: routeDoc.id, ...routeDoc.data() } as any;
          setArRoute(routeData);
          setCurrentStopIndex(0);
          setTourCompleted(false);
          // Set distance to the first stop
          if (routeData.stops && routeData.stops[0]) {
            const firstStop = routeData.stops[0];
            const realDist = calculateDistanceMeters(
              userLocation.lat,
              userLocation.lng,
              firstStop.lat,
              firstStop.lng
            );
            setSimulatedDistance(Math.round(Math.max(15, realDist)));
          }
        } else {
          console.error("Route not found in Firestore:", arRouteId);
        }
      } catch (err) {
        console.error("Error fetching route:", err);
      } finally {
        setIsLoadingRoute(false);
      }
    }
    fetchRoute();
  }, [arRouteId]);

  // Handle stop arrivals (Narration & Quiz)
  useEffect(() => {
    if (hasArrived && arRoute && arRoute.stops && arRoute.stops[currentStopIndex]) {
      const stop = arRoute.stops[currentStopIndex];
      // Speak Narration using Web Speech API
      if (audioEnabled && stop.audioNarration) {
        try {
          window.speechSynthesis?.cancel(); // Clear any ongoing speech
          const utterance = new SpeechSynthesisUtterance(stop.audioNarration);
          utterance.lang = stop.narrationVoice || 'sw-TZ';
          window.speechSynthesis?.speak(utterance);
        } catch (e) {
          console.warn("Web Speech synthesis is blocked or unsupported:", e);
        }
      }
      // Open quiz if configured
      if (stop.hasQuiz && stop.quizQuestion) {
        setShowQuiz(true);
        setQuizSolved(false);
        setQuizSelectedOption('');
        setQuizRewardInfo(null);
      }
    }
  }, [hasArrived, currentStopIndex, arRoute, audioEnabled]);

  // Request camera access
  useEffect(() => {
    async function startCamera() {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraError(
          'Imeshindwa kufungua kamera yako ya simu. AR itaendelea kufanya kazi katika hali ya "Simulated Camera Canvas".'
        );
        setIsCameraActive(false);
      }
    }
    startCamera();

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Request and listen to device orientation (Compass)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      setIsSensorsSupported(true);
      let heading = 0;
      if ('webkitCompassHeading' in e) {
        heading = e.webkitCompassHeading as number;
      } else if (e.absolute && e.alpha !== null) {
        heading = 360 - e.alpha;
      } else if (e.alpha !== null) {
        heading = 360 - e.alpha;
      }
      setDeviceHeading(Math.round(heading));
    };

    // Attempt to register deviceorientation
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
      
      // Some iOS browsers require device orientation permission
      const requestPermission = (DeviceOrientationEvent as any).requestPermission;
      if (typeof requestPermission === 'function') {
        requestPermission()
          .then((permissionState: string) => {
            if (permissionState !== 'granted') {
              setIsSensorPermissionDenied(true);
            }
          })
          .catch((err: any) => {
            console.warn('Orientation permission error:', err);
            setIsSensorPermissionDenied(true);
          });
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Walk simulator interval
  useEffect(() => {
    let timer: any;
    if (isSimulatingWalk && simulatedDistance !== null && simulatedDistance > 0 && (targetVendor || arRoute)) {
      timer = setInterval(() => {
        setSimulatedDistance(prev => {
          if (prev === null) return null;
          const step = Math.floor(Math.random() * 5) + 4; // 4-8 meters per tick
          const nextVal = prev - step;
          if (nextVal <= 2) {
            clearInterval(timer);
            setIsSimulatingWalk(false);
            setHasArrived(true);
            triggerBeep(880, 0.3); // High celebratory tone
            return 0;
          }
          return nextVal;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSimulatingWalk, simulatedDistance, targetVendor, arRoute]);

  // Audio tone generator for scanning and navigation alignment feedback
  const triggerBeep = (frequency = 440, duration = 0.1) => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Fallback silently if audio context is blocked
    }
  };

  // Helper formula to compute bearing between two points
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  // Helper formula to compute distance in meters
  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate current heading combining hardware and manual simulator offsets
  const currentHeading = (deviceHeading + simulatedHeading + 360) % 360;

  // Calculate targeting parameters
  let targetBearing = 0;
  let rawDistance = 120;
  if (arRoute && arRoute.stops && arRoute.stops[currentStopIndex]) {
    const currentStop = arRoute.stops[currentStopIndex];
    targetBearing = Math.round(
      calculateBearing(
        userLocation.lat,
        userLocation.lng,
        currentStop.lat,
        currentStop.lng
      )
    );
    rawDistance = calculateDistanceMeters(
      userLocation.lat,
      userLocation.lng,
      currentStop.lat,
      currentStop.lng
    );
  } else if (targetVendor && targetVendor.location) {
    targetBearing = Math.round(
      calculateBearing(
        userLocation.lat,
        userLocation.lng,
        targetVendor.location.lat,
        targetVendor.location.lng
      )
    );
    rawDistance = calculateDistanceMeters(
      userLocation.lat,
      userLocation.lng,
      targetVendor.location.lat,
      targetVendor.location.lng
    );
  }

  const activeDistance = simulatedDistance !== null ? simulatedDistance : Math.round(rawDistance);

  // Compute horizontal angle offset to target
  // angleOffset is in degrees, between -180 and 180
  let angleOffset = (targetBearing - currentHeading);
  if (angleOffset > 180) angleOffset -= 360;
  if (angleOffset < -180) angleOffset += 360;

  // Determine if target vendor is inside field of view (approx 60 degrees)
  const FOV = 60;
  const isTargetVisibleInCamera = Math.abs(angleOffset) < (FOV / 2);

  // Screen coordinates for floating 3D spatial indicator card
  // Map angleOffset (-FOV/2 to +FOV/2) to horizontal percent (0% to 100%)
  const horizontalPercent = 50 + (angleOffset / (FOV / 2)) * 50;

  // Vertical position scaling (make it bounce slightly and sit vertically centered)
  // Distance scaling (near = larger, far = smaller)
  const distanceScale = Math.max(0.4, Math.min(1.2, 80 / (activeDistance + 15)));
  const cardOpacity = isTargetVisibleInCamera ? Math.max(0.2, Math.min(1.0, 1.2 - Math.abs(angleOffset) / (FOV / 2))) : 0;

  // Handle Drag-to-Rotate on Desktop (Swipable compass)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    startHeadingRef.current = simulatedHeading;
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - startXRef.current;
    // Map screen movement to degrees rotation (e.g. 1px = 0.5 deg)
    const deltaDegrees = -deltaX * 0.4;
    setSimulatedHeading((startHeadingRef.current + deltaDegrees + 360) % 360);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  // Play audio pulse if aligned with target store (extremely high-fidelity guidance feature)
  useEffect(() => {
    if (isTargetVisibleInCamera && Math.abs(angleOffset) < 5 && activeDistance > 0) {
      const interval = setInterval(() => {
        triggerBeep(660, 0.08); // Lock feedback tone
      }, Math.max(200, activeDistance * 8)); // Beeps faster as you get closer!
      return () => clearInterval(interval);
    }
  }, [isTargetVisibleInCamera, angleOffset, activeDistance]);

  // Handle Mock QR scanning
  const handleSimulateScan = (vendorId: string) => {
    setIsScanning(true);
    triggerBeep(330, 0.15);
    setTimeout(() => {
      triggerBeep(523.25, 0.1); // Scanner beep
      const found = vendors.find(v => v.id === vendorId);
      if (found) {
        setTargetVendor(found);
        setHasArrived(false);
        setSimulatedDistance(Math.round(Math.max(10, Math.floor(Math.random() * 40) + 15)));
        setScanSuccess(found.businessName);
        setScanMode(false);
        triggerBeep(1046.5, 0.35); // Success tone
      }
      setIsScanning(false);
      setTimeout(() => setScanSuccess(null), 3000);
    }, 1500);
  };

  // Tour / Treasure Hunt handlers
  const handleNextStop = () => {
    if (!arRoute || !arRoute.stops) return;
    const isLast = currentStopIndex >= arRoute.stops.length - 1;
    if (isLast) {
      setTourCompleted(true);
      triggerBeep(1200, 0.45);
    } else {
      const nextIdx = currentStopIndex + 1;
      setCurrentStopIndex(nextIdx);
      setHasArrived(false);
      setShowQuiz(false);
      setQuizSolved(false);
      setQuizSelectedOption('');
      setQuizRewardInfo(null);
      setQuizError(null);
      // Reset simulated distance for next stop
      const nextStop = arRoute.stops[nextIdx];
      const nextDist = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        nextStop.lat,
        nextStop.lng
      );
      setSimulatedDistance(Math.round(Math.max(15, nextDist)));
    }
  };

  const handleQuizSubmit = () => {
    if (!arRoute || !arRoute.stops) return;
    const stop = arRoute.stops[currentStopIndex];
    if (quizSelectedOption.trim().toLowerCase() === stop.quizAnswer.trim().toLowerCase()) {
      setQuizSolved(true);
      setQuizRewardInfo(stop.quizReward || "Hongera sana! Umepata pointi 100 za Uaminifu!");
      setQuizScore(prev => prev + 100);
      setQuizError(null);
      triggerBeep(880, 0.35);
    } else {
      setQuizError("Jibu si sahihi. Tafadhali jaribu tena au soma maelezo kwa makini!");
      triggerBeep(220, 0.4);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[300] flex flex-col overflow-hidden font-sans select-none text-white">
      {tourCompleted && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 text-center select-text">
          {/* Celebrating Fireworks / Particle Simulation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-yellow-400 rounded-full animate-ping [animation-delay:0.5s]" />
            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-500 rounded-full animate-ping [animation-delay:0.2s]" />
            <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-green-400 rounded-full animate-ping [animation-delay:0.8s]" />
          </div>

          <div className="max-w-md w-full bg-[#0B0C10] border-2 border-orange-500 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />
            
            {/* Celebration Badge */}
            <div className="w-24 h-24 rounded-full bg-orange-600/20 border-2 border-orange-500 flex items-center justify-center text-5xl mb-6 shadow-2xl animate-bounce">
              🏅
            </div>

            <span className="px-4 py-1.5 bg-orange-500/10 border border-orange-500/25 rounded-full text-xs font-black uppercase tracking-widest text-orange-500 mb-3">
              Mwisho wa Utalii!
            </span>

            <h2 className="text-2xl font-black uppercase text-white tracking-tight mb-2">🎉 Utalii Umekamilika!</h2>
            <p className="text-sm text-neutral-300 font-medium mb-6 leading-relaxed">
              Hongera sana! Umekamilisha vituo vyote vya <span className="text-orange-400 font-bold">{arRoute?.routeName}</span> kwa mafanikio makubwa!
            </p>

            {/* Loyalty points score */}
            <div className="w-full bg-white/5 rounded-2xl p-4 border border-white/5 text-center mb-6">
              <p className="text-[10px] text-neutral-400 font-black uppercase tracking-wider mb-1">Pointi Ulizokusanya:</p>
              <div className="text-3xl font-mono font-black text-orange-500 flex items-center justify-center gap-1.5">
                <Trophy className="w-6 h-6 text-yellow-500 animate-pulse" />
                <span>{quizScore} PTS</span>
              </div>
            </div>

            {/* Coupon Card */}
            <div className="w-full bg-orange-600/10 border-2 border-dashed border-orange-500/40 rounded-3xl p-5 mb-8 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-orange-600 rounded-full text-[9px] font-black uppercase tracking-widest text-white leading-none">
                Zawadi Yako (Coupon)
              </span>
              <p className="text-xs text-orange-200 font-bold uppercase tracking-wider mb-1 leading-none">Voucher ya Punguzo</p>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">FREECOFFEE20</h3>
              <p className="text-[10px] text-neutral-400 font-medium mt-1 leading-normal">Onyesha nambari hii kwenye duka la mshirika kupata punguzo la 20%!</p>
            </div>

            {/* Character Saying Congratulations */}
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 text-left mb-6 w-full">
              <span className="text-3xl">🦁</span>
              <div>
                <p className="text-[10px] text-neutral-400 font-black uppercase">Simba wa 3D:</p>
                <p className="text-xs text-neutral-200 font-bold leading-normal">"Asante sana kwa kufanya utalii nami katika Stone Town! Karibu tena wakati mwingine!"</p>
              </div>
            </div>

            <Button 
              onClick={onClose}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
            >
              Funga na Urudi Nyumbani
            </Button>
          </div>
        </div>
      )}

      {/* 1. Camera View / Virtual Canvas */}
      <div 
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        className="relative flex-1 bg-neutral-950 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
      >
        {isCameraActive ? (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : (
          /* High quality virtual camera backup view */
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 flex flex-col items-center justify-center">
            {/* Holographic grid and tech-arcs */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
            <div className="w-48 h-48 rounded-full border-4 border-dashed border-orange-500/20 flex items-center justify-center animate-[spin_60s_linear_infinite] relative pointer-events-none">
              <div className="absolute inset-4 rounded-full border border-orange-500/40" />
              <div className="absolute w-8 h-8 rounded-full bg-orange-500/20 blur-xl animate-pulse" />
            </div>
            
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                Virtual Camera Canvas Mode
              </span>
            </div>
          </div>
        )}

        {/* Scan overlay HUD */}
        <div className="absolute inset-x-8 top-12 bottom-20 border border-white/5 pointer-events-none flex flex-col justify-between">
          <div className="flex justify-between">
            <div className="w-8 h-8 border-t-[3px] border-l-[3px] border-orange-500 rounded-tl-2xl" />
            <div className="w-8 h-8 border-t-[3px] border-r-[3px] border-orange-500 rounded-tr-2xl" />
          </div>
          <div className="flex justify-between">
            <div className="w-8 h-8 border-b-[3px] border-l-[3px] border-orange-500 rounded-bl-2xl" />
            <div className="w-8 h-8 border-b-[3px] border-r-[3px] border-orange-500 rounded-br-2xl" />
          </div>
        </div>

        {/* Camera fallback notification message */}
        {cameraError && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-black/65 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex items-start gap-2 text-left pointer-events-auto">
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-neutral-300 font-medium leading-normal">{cameraError}</p>
          </div>
        )}

        {/* Top Floating Control Bar */}
        <div className="absolute top-5 left-5 right-5 z-40 flex items-center justify-between pointer-events-auto">
          <button 
            onClick={onClose}
            className="w-11 h-11 bg-black/60 backdrop-blur-lg border border-white/15 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="w-11 h-11 bg-black/60 backdrop-blur-lg border border-white/15 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
            >
              {audioEnabled ? <Volume2 className="w-5 h-5 text-green-500" /> : <VolumeX className="w-5 h-5 text-neutral-400" />}
            </button>
            <button 
              onClick={() => setScanMode(!scanMode)}
              className={`px-4 h-11 backdrop-blur-lg border rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all shadow-lg ${scanMode ? 'bg-orange-600 border-orange-500 text-white animate-pulse' : 'bg-black/60 border-white/15 text-white'}`}
            >
              <QrCode className="w-4 h-4" />
              {scanMode ? 'Map AR' : 'Scan QR'}
            </button>
          </div>
        </div>

        {/* Route / Tour Top HUD Panel */}
        {arRoute && !scanMode && (
          <div className="absolute top-20 inset-x-5 z-40 bg-black/75 backdrop-blur-md border border-orange-500/30 p-4 rounded-3xl flex flex-col gap-1 shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-600/20 flex items-center justify-center">
                  <Gamepad2 className="w-4 h-4 text-orange-500 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 leading-none">AR Tour & Treasure Hunt</h4>
                  <h3 className="text-xs font-black uppercase text-white tracking-tight">{arRoute.routeName}</h3>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[9px] font-bold text-orange-400">
                Kituo {currentStopIndex + 1} kati ya {arRoute.stops?.length || 0}
              </span>
            </div>
            
            {/* Visual step bar indicator */}
            <div className="w-full flex items-center gap-1.5 mt-2">
              {arRoute.stops?.map((stop: any, idx: number) => {
                let charEmoji = '📍';
                const charType = stop.character || 'guide';
                if (charType === 'lion') charEmoji = '🦁';
                else if (charType === 'mascot') charEmoji = '🤖';
                else if (charType === 'castle') charEmoji = '🏰';
                else if (charType === 'guide') charEmoji = '💁‍♂️';
                else if (charType === 'chest') charEmoji = '🎁';
                else if (charType === 'fireworks') charEmoji = '🎉';

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-1.5 rounded-full transition-all duration-300 ${idx <= currentStopIndex ? 'bg-orange-500 shadow-[0_0_8px_#ea580c]' : 'bg-white/10'}`} />
                    <span className={`text-[10px] ${idx === currentStopIndex ? 'animate-bounce scale-110 opacity-100' : 'opacity-40'}`}>{charEmoji}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. MAIN AR VIRTUAL MARKER OVERLAY */}
        {!scanMode && (targetVendor || arRoute) && (
          <div className="absolute inset-0 pointer-events-none">
            {isTargetVisibleInCamera ? (
              <motion.div 
                style={{
                  left: `${horizontalPercent}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute flex flex-col items-center justify-center transition-all duration-75"
              >
                {/* 3D Floating Tag Card */}
                <motion.div 
                  style={{ scale: distanceScale }}
                  animate={{ y: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="bg-[#0B0C10]/95 backdrop-blur-xl border-2 border-orange-500/80 p-5 rounded-[2.25rem] w-80 text-center shadow-[0_25px_60px_rgba(249,115,22,0.25)] flex flex-col items-center relative overflow-hidden pointer-events-auto"
                >
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />
                  
                  {arRoute && arRoute.stops && arRoute.stops[currentStopIndex] ? (
                    /* AR TOUR STOP MARKER */
                    (() => {
                      const stop = arRoute.stops[currentStopIndex];
                      let stopEmoji = '📍';
                      let stopCharName = '3D Character';
                      const charType = stop.character || 'guide';
                      if (charType === 'lion') {
                        stopEmoji = '🦁';
                        stopCharName = 'Simba wa 3D';
                      } else if (charType === 'mascot') {
                        stopEmoji = '🤖';
                        stopCharName = 'Guide Katuni';
                      } else if (charType === 'castle') {
                        stopEmoji = '🏰';
                        stopCharName = 'Jengo la Kale';
                      } else if (charType === 'guide') {
                        stopEmoji = '💁‍♂️';
                        stopCharName = 'Tour Guide';
                      } else if (charType === 'chest') {
                        stopEmoji = '🎁';
                        stopCharName = 'Treasure Box';
                      } else if (charType === 'fireworks') {
                        stopEmoji = '🎉';
                        stopCharName = 'Ponzi 3D';
                      }

                      return (
                        <>
                          {/* Animated 3D Avatar Simulator */}
                          <div className="w-20 h-20 rounded-full bg-orange-600/20 border-2 border-orange-500/60 flex items-center justify-center text-4xl mb-3 shadow-lg relative overflow-hidden animate-[pulse_1.5s_infinite]">
                            <span className="animate-bounce">{stopEmoji}</span>
                            <span className="absolute bottom-1 text-[8px] font-black uppercase text-orange-400 bg-black/50 px-1.5 py-0.5 rounded-full">{stopCharName}</span>
                          </div>

                          <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[8.5px] font-black uppercase tracking-widest text-orange-500 mb-1.5">
                            Kituo cha AR Locked
                          </span>

                          <h3 className="text-base font-black uppercase text-white leading-none tracking-tight mb-1">{stop.stopName}</h3>
                          <p className="text-[10px] text-neutral-300 font-medium leading-relaxed mb-3">{stop.stopDescription}</p>

                          {/* Distance feedback */}
                          <div className="flex items-center justify-center gap-1.5 text-orange-500 font-mono font-black text-2xl tracking-tighter mb-4">
                            <Navigation className="w-5 h-5 fill-current animate-[spin_5s_linear_infinite]" />
                            <span>{activeDistance} Mita</span>
                          </div>

                          {/* Interactive Stop Experience */}
                          {hasArrived ? (
                            <div className="w-full space-y-3">
                              {stop.hasQuiz && !quizSolved ? (
                                <div className="p-3 bg-neutral-900 border border-orange-500/30 rounded-2xl text-left">
                                  <h4 className="text-[10px] font-black uppercase text-orange-500 mb-1 flex items-center gap-1">
                                    <HelpCircle className="w-3.5 h-3.5" /> Fumbo la Kituo:
                                  </h4>
                                  <p className="text-xs text-neutral-100 font-bold mb-3 leading-relaxed">{stop.quizQuestion}</p>
                                  
                                  <div className="space-y-1.5">
                                    <input 
                                      type="text" 
                                      placeholder="Andika jibu lako hapa..." 
                                      value={quizSelectedOption}
                                      onChange={(e) => {
                                        setQuizSelectedOption(e.target.value);
                                        setQuizError(null);
                                      }}
                                      className="w-full px-3 py-2 bg-white/5 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                                    />
                                    {quizError && (
                                      <p className="text-[10px] text-red-500 font-bold">{quizError}</p>
                                    )}
                                    <Button 
                                      onClick={handleQuizSubmit}
                                      className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                                    >
                                      Hakiki Jibu
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {quizSolved && quizRewardInfo && (
                                    <motion.div 
                                      initial={{ scale: 0.9, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-xs font-bold flex flex-col items-center gap-1"
                                    >
                                      <Award className="w-5 h-5 text-green-500 animate-spin" />
                                      <span>{quizRewardInfo}</span>
                                    </motion.div>
                                  )}

                                  <Button 
                                    onClick={handleNextStop}
                                    className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                                  >
                                    <span>{currentStopIndex >= arRoute.stops.length - 1 ? 'Kamilisha Utalii' : 'Nenda Kituo Kinachofuata'}</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Walking simulation buttons for testers/users */
                            <Button 
                              onClick={() => setIsSimulatingWalk(!isSimulatingWalk)}
                              className={`w-full py-4 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all ${isSimulatingWalk ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg'}`}
                            >
                              <Sparkles className="w-4 h-4 animate-spin" />
                              {isSimulatingWalk ? 'Inatembea (Simulating...)' : 'Anza Safari (Simulate Walk)'}
                            </Button>
                          )}
                        </>
                      );
                    })()
                  ) : targetVendor ? (
                    /* ORIGINAL SINGLE-VENDOR STOREMARKER */
                    <>
                      {/* Glowing custom icon Selected by Vendor */}
                      <div className="w-16 h-16 rounded-3xl bg-orange-600 flex items-center justify-center text-white shadow-lg border border-orange-400/30 mb-3.5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                        {(() => {
                          const IconComponent = AR_ICONS[targetVendor.arIcon || 'store'] || Store;
                          return <IconComponent className="w-8 h-8 animate-pulse" style={{ color: targetVendor.arColor || '#ffffff' }} />;
                        })()}
                      </div>

                      <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[8px] font-black uppercase tracking-widest text-orange-500 mb-2">
                        AR Destination Locked
                      </span>

                      <h3 className="text-lg font-black uppercase text-white leading-none tracking-tight mb-1">{targetVendor.businessName}</h3>
                      
                      {/* Distance feedback */}
                      <div className="flex items-center justify-center gap-1.5 text-orange-500 font-mono font-black text-2xl tracking-tighter mb-3">
                        <Navigation className="w-5 h-5 fill-current animate-[spin_5s_linear_infinite]" />
                        <span>{activeDistance} Mita</span>
                      </div>

                      {/* Storefront Image uploaded by Vendor */}
                      {targetVendor.arImageUrl ? (
                        <div className="w-full h-24 rounded-2xl overflow-hidden border border-white/10 mb-3 relative bg-neutral-900">
                          <img 
                            src={targetVendor.arImageUrl} 
                            alt="Storefront" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <span className="absolute bottom-2 left-2 text-[8.5px] font-black uppercase tracking-widest text-white flex items-center gap-1">
                            <Eye className="w-3 h-3 text-orange-500" /> Storefront View
                          </span>
                        </div>
                      ) : targetVendor.bannerUrl ? (
                        <div className="w-full h-24 rounded-2xl overflow-hidden border border-white/10 mb-3 relative bg-neutral-900">
                          <img 
                            src={targetVendor.bannerUrl} 
                            alt="Storefront" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        </div>
                      ) : null}

                      {/* Directions instructions */}
                      <div className="w-full p-3 bg-white/5 rounded-2xl border border-white/5 text-left mb-4">
                        <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider mb-1">Maelezo ya Kufika:</p>
                        <p className="text-[11px] text-neutral-100 font-medium leading-relaxed">
                          {targetVendor.arDirections || 'Fika dukani kwa kufuata mshale wa GPS hapo juu.'}
                        </p>
                      </div>

                      {/* Simulator walk controls */}
                      {!hasArrived ? (
                        <Button 
                          onClick={() => setIsSimulatingWalk(!isSimulatingWalk)}
                          className={`w-full py-5 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all ${isSimulatingWalk ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/40'}`}
                        >
                          <Sparkles className="w-4 h-4 animate-spin" />
                          {isSimulatingWalk ? 'Ninasafiri (Simulating...)' : 'Anza Kutembea (Simulate Walk)'}
                        </Button>
                      ) : (
                        <div className="w-full py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Amefika Dukani! Karibu Sana!
                        </div>
                      )}
                    </>
                  ) : null}
                </motion.div>

                {/* Ground neon projection ring */}
                <div className="w-40 h-8 bg-transparent border-[3px] border-orange-500/40 rounded-full shadow-[0_0_20px_#ea580c] scale-[0.6] blur-[1px] mt-6 animate-[pulse_2s_infinite]" />
              </motion.div>
            ) : (
              /* Out of Field-of-View Arrow Helper (Guiding user left/right) */
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex items-center justify-between z-30">
                {angleOffset < 0 ? (
                  <motion.div 
                    animate={{ x: [-5, 5, -5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    onClick={() => setSimulatedHeading(prev => (prev + 15) % 360)}
                    className="p-4 bg-orange-600/95 border border-orange-500 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto cursor-pointer"
                  >
                    <Navigation className="w-5 h-5 -rotate-90 fill-current text-white" />
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-wider">Mzunguko wa Kushoto</p>
                      <p className="text-[9px] text-orange-200 font-bold uppercase">Zunguka kushoto kuona duka</p>
                    </div>
                  </motion.div>
                ) : (
                  <div />
                )}

                {angleOffset > 0 ? (
                  <motion.div 
                    animate={{ x: [5, -5, 5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    onClick={() => setSimulatedHeading(prev => (prev - 15 + 360) % 360)}
                    className="p-4 bg-orange-600/95 border border-orange-500 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto cursor-pointer text-right"
                  >
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-wider">Mzunguko wa Kulia</p>
                      <p className="text-[9px] text-orange-200 font-bold uppercase">Zunguka kulia kuona duka</p>
                    </div>
                    <Navigation className="w-5 h-5 rotate-90 fill-current text-white" />
                  </motion.div>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. PHYSICAL QR CODE SCANNER HUD */}
        {scanMode && (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-6 z-30 pointer-events-none">
            <div className="w-72 h-72 border-[3px] border-dashed border-orange-500 rounded-[3rem] flex flex-col items-center justify-center relative overflow-hidden bg-black/30 backdrop-blur-xs shadow-2xl">
              {/* Scan laser line */}
              <div className="absolute inset-x-4 h-0.5 bg-orange-500 shadow-[0_0_15px_#ea580c] animate-[bounce_3s_infinite]" />
              
              <Scan className="w-16 h-16 text-orange-500/30 mb-3" />
              <p className="text-xs text-neutral-300 font-bold uppercase tracking-widest text-center px-4 leading-normal">
                {isScanning ? 'Mifumo inasoma QR...' : 'Sogeza QR Code ya duka hapa...'}
              </p>
            </div>

            <div className="mt-8 bg-neutral-900/90 backdrop-blur-md border border-white/10 p-5 rounded-[2.25rem] w-80 text-center pointer-events-auto shadow-2xl">
              <h4 className="text-xs font-black uppercase tracking-widest text-orange-500 mb-1.5 flex items-center justify-center gap-1.5">
                <QrCode className="w-4 h-4" /> Simulator Scan Finder
              </h4>
              <p className="text-[11px] text-neutral-400 font-medium mb-4 leading-normal">
                Ili kujaribu mteja anavyoweza kuskani QR Code iliyobandikwa na muuzaji, chagua duka hapa chini kuiga scanning:
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                {vendors.map((v) => (
                  <button 
                    key={v.id}
                    onClick={() => handleSimulateScan(v.id)}
                    disabled={isScanning}
                    className="w-full p-3 bg-white/5 hover:bg-orange-600 border border-white/5 hover:border-orange-500 rounded-2xl flex items-center justify-between text-left text-xs font-bold uppercase tracking-tight transition-all text-neutral-100 disabled:opacity-50"
                  >
                    <span>{v.businessName}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scan Success Toast Banner */}
        <AnimatePresence>
          {scanSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-24 inset-x-5 z-50 bg-green-600/95 border border-green-500 px-5 py-4 rounded-3xl flex items-center gap-3 shadow-2xl text-left pointer-events-auto"
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white">QR Code Imeskaniwa!</p>
                <p className="text-[11px] text-green-100 font-bold uppercase">Locked onto {scanSuccess} in AR Navigation Mode.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Helper Overlay (If no hardware compass is active) */}
        {!isSensorsSupported && !scanMode && (
          <div className="absolute bottom-24 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/5 flex items-center gap-2 text-[10px] text-neutral-400 font-bold uppercase tracking-widest pointer-events-none animate-pulse">
            <Compass className="w-4 h-4 text-orange-500 animate-spin" />
            Drag Left / Right to Look Around
          </div>
        )}
      </div>

      {/* 4. Bottom Compass & HUD Dashboard Panel */}
      <div className="bg-[#0B0C10] border-t border-white/10 px-6 py-6 flex flex-col gap-5 shrink-0 z-40 relative">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] mb-1">Mwelekeo wa sasa</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-white tracking-tighter">
                {currentHeading}°
              </span>
              <span className="text-xs font-black text-orange-500 uppercase tracking-widest">
                {currentHeading >= 337.5 || currentHeading < 22.5 ? 'KASKAZINI (N)' :
                 currentHeading >= 22.5 && currentHeading < 67.5 ? 'KAS-MASHARIKI (NE)' :
                 currentHeading >= 67.5 && currentHeading < 112.5 ? 'MASHARIKI (E)' :
                 currentHeading >= 112.5 && currentHeading < 157.5 ? 'KUS-MASHARIKI (SE)' :
                 currentHeading >= 157.5 && currentHeading < 202.5 ? 'KUSINI (S)' :
                 currentHeading >= 202.5 && currentHeading < 247.5 ? 'KUS-MAGHARIBI (SW)' :
                 currentHeading >= 247.5 && currentHeading < 292.5 ? 'MAGHARIBI (W)' : 'KAS-MAGHARIBI (NW)'}
              </span>
            </div>
          </div>

          {/* Electronic Compass Dial */}
          <div className="relative w-16 h-16 rounded-full border border-white/10 flex items-center justify-center shrink-0">
            <div 
              style={{ transform: `rotate(${-currentHeading}deg)` }}
              className="absolute inset-0 transition-transform duration-75 flex flex-col justify-between items-center py-1 text-[8px] font-black text-neutral-500"
            >
              <span className="text-orange-500 text-[9px]">N</span>
              <span>S</span>
            </div>
            {targetVendor && (
              <div 
                style={{ transform: `rotate(${(targetBearing - currentHeading)}deg)` }}
                className="absolute w-12 h-12 flex items-center justify-center transition-transform duration-75"
              >
                <Navigation className="w-4 h-4 text-orange-500 fill-current transform -rotate-45 -translate-y-2" />
              </div>
            )}
            <div className="w-1.5 h-1.5 rounded-full bg-white relative z-10 shadow-md" />
          </div>
        </div>

        {/* Store selector slider/list for fast navigation switches */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">Chagua duka la kupata maelekezo</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {vendors.map((v) => {
              const isSelected = targetVendor?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setTargetVendor(v);
                    setHasArrived(false);
                    const realDist = calculateDistanceMeters(
                      userLocation.lat, 
                      userLocation.lng, 
                      v.location?.lat || userLocation.lat, 
                      v.location?.lng || userLocation.lng
                    );
                    setSimulatedDistance(Math.round(Math.max(15, realDist)));
                    triggerBeep(523.25, 0.05);
                  }}
                  className={`px-4 py-3 rounded-2xl whitespace-nowrap text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2 ${isSelected ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-950/20' : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'}`}
                >
                  <Store className="w-4 h-4 shrink-0" />
                  {v.businessName}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
