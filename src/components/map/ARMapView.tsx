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
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';

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

// Robust helper to render raw videos, YouTube videos, or Vimeo links correctly for users
const renderVideoPlayer = (url: string) => {
  if (!url) return null;
  // Check for YouTube
  const youtubeRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(youtubeRegExp);
  if (match && match[2].length === 11) {
    const videoId = match[2];
    return (
      <iframe
        className="w-full h-full rounded-xl border-0"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  // Check for Vimeo
  const vimeoRegExp = /vimeo\.com\/(\d+)/;
  const vimeoMatch = url.match(vimeoRegExp);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return (
      <iframe
        className="w-full h-full rounded-xl border-0"
        src={`https://player.vimeo.com/video/${videoId}`}
        title="Vimeo video player"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  // Fallback to HTML5 video for raw mp4/webm uploads
  return (
    <video 
      src={url} 
      controls 
      playsInline
      className="w-full h-full object-contain bg-black rounded-xl"
    />
  );
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
  const [isCapturing, setIsCapturing] = useState(false);

  // Scan States
  const [scanMode, setScanMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isStopMediaCollapsed, setIsStopMediaCollapsed] = useState(true);

  // Compass Drag / Manual Control States
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startHeadingRef = useRef(0);

  // Initialize target vendor
  useEffect(() => {
    async function initTargetVendor() {
      if (initialTargetVendorId) {
        // Try finding in current memory list
        let found = vendors.find(v => v.id === initialTargetVendorId);
        
        if (!found) {
          // Fetch directly from Firestore to prevent showing the wrong restaurant!
          try {
            const vendorDoc = await getDoc(doc(db, 'vendors', initialTargetVendorId));
            if (vendorDoc.exists()) {
              found = { id: vendorDoc.id, ...vendorDoc.data() } as any;
            }
          } catch (err) {
            console.error("Error fetching vendor directly:", err);
          }
        }

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
    }
    initTargetVendor();
  }, [initialTargetVendorId, vendors]);

  // Fetch Route from Firestore (either by arRouteId or by vendorId if deep-linked via QR)
  useEffect(() => {
    async function fetchRoute() {
      setIsLoadingRoute(true);
      try {
        let routeData: any = null;
        
        if (arRouteId) {
          const routeDoc = await getDoc(doc(db, 'ar_routes', arRouteId));
          if (routeDoc.exists()) {
            routeData = { id: routeDoc.id, ...routeDoc.data() };
          }
        } else if (initialTargetVendorId) {
          // Query for any AR route associated with this vendor
          const q = query(
            collection(db, 'ar_routes'),
            where('vendorId', '==', initialTargetVendorId)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            // Find the first matching route
            const firstDoc = querySnapshot.docs[0];
            routeData = { id: firstDoc.id, ...firstDoc.data() };
          }
        }

        if (routeData) {
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
          setArRoute(null);
        }
      } catch (err) {
        console.error("Error fetching route:", err);
      } finally {
        setIsLoadingRoute(false);
      }
    }
    fetchRoute();
  }, [arRouteId, initialTargetVendorId]);

  // Handle stop arrivals (Narration & Quiz)
  useEffect(() => {
    if (hasArrived && arRoute && arRoute.stops && arRoute.stops[currentStopIndex]) {
      const stop = arRoute.stops[currentStopIndex];
      const narrationText = stop.audioNarration || stop.voiceText || '';
      // Speak Narration using Web Speech API
      if (audioEnabled && narrationText) {
        try {
          window.speechSynthesis?.cancel(); // Clear any ongoing speech
          const utterance = new SpeechSynthesisUtterance(narrationText);
          utterance.lang = stop.narrationVoice || 'sw-TZ';
          window.speechSynthesis?.speak(utterance);
        } catch (e) {
          console.warn("Web Speech synthesis is blocked or unsupported:", e);
        }
      }
      
      const hasQuiz = stop.hasQuiz || !!stop.quiz;
      const questionText = stop.quizQuestion || stop.quiz?.question;
      // Open quiz if configured
      if (hasQuiz && questionText) {
        setShowQuiz(true);
        setQuizSolved(false);
        setQuizSelectedOption('');
        setQuizRewardInfo(null);
      }
    }
  }, [hasArrived, currentStopIndex, arRoute, audioEnabled]);

  // Request camera access
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function startCamera() {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        activeStream = stream;
        setCameraStream(stream);
        setIsCameraActive(true);
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
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Bind camera stream to videoRef once video element is rendered
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => {
        console.warn("Failed to play camera stream automatically:", err);
      });
    }
  }, [cameraStream, isCameraActive]);

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

  // Auto arrive when user gets close to the target coordinates (<= 6 meters)
  useEffect(() => {
    let rawDistance = 120;
    if (arRoute && arRoute.stops && arRoute.stops[currentStopIndex]) {
      const currentStop = arRoute.stops[currentStopIndex];
      rawDistance = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        currentStop.lat,
        currentStop.lng
      );
    } else if (targetVendor && targetVendor.location) {
      rawDistance = calculateDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        targetVendor.location.lat,
        targetVendor.location.lng
      );
    }

    const currentDist = simulatedDistance !== null ? simulatedDistance : Math.round(rawDistance);

    if (currentDist <= 6 && !hasArrived && (arRoute || targetVendor)) {
      setHasArrived(true);
      triggerBeep(880, 0.3); // High celebratory tone
    }
  }, [simulatedDistance, userLocation, currentStopIndex, arRoute, targetVendor, hasArrived]);

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

  // Pre-calculate render parameters for all future/upcoming stops in the tour
  const upcomingStopsRenderData = (arRoute && arRoute.stops) 
    ? arRoute.stops.map((stop: any, idx: number) => {
        if (idx < currentStopIndex) return null; // already visited, don't show

        // Calculate bearing and raw distance for this specific stop
        const bearing = Math.round(
          calculateBearing(
            userLocation.lat,
            userLocation.lng,
            stop.lat,
            stop.lng
          )
        );
        const rawDist = calculateDistanceMeters(
          userLocation.lat,
          userLocation.lng,
          stop.lat,
          stop.lng
        );

        // In walking simulation mode, we want the active stop distance to scale from simulatedDistance
        let dist = Math.round(rawDist);
        if (idx === currentStopIndex && simulatedDistance !== null) {
          dist = simulatedDistance;
        } else if (idx > currentStopIndex && simulatedDistance !== null) {
          // Future stops should be located relative to the simulated position of the active stop.
          // To make it look realistic, their simulated distance is the remaining distance of the active stop
          // PLUS the distance between the active stop and this future stop!
          const activeStop = arRoute.stops[currentStopIndex];
          const distBetweenStops = calculateDistanceMeters(
            activeStop.lat,
            activeStop.lng,
            stop.lat,
            stop.lng
          );
          dist = Math.round(simulatedDistance + distBetweenStops);
        }

        let offset = (bearing - currentHeading);
        if (offset > 180) offset -= 360;
        if (offset < -180) offset += 360;

        const isVisible = Math.abs(offset) < (FOV / 2);
        const horizPercent = 50 + (offset / (FOV / 2)) * 50;

        // Scale: closer is larger
        const scale = Math.max(0.35, Math.min(1.2, 80 / (dist + 15)));
        const opacity = isVisible ? Math.max(0.15, Math.min(1.0, 1.2 - Math.abs(offset) / (FOV / 2))) : 0;

        return {
          idx,
          stop,
          bearing,
          distance: dist,
          angleOffset: offset,
          isVisible,
          horizontalPercent: horizPercent,
          scale,
          opacity
        };
      }).filter(Boolean)
    : [];

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
  const handleSimulateScan = async (vendorId: string) => {
    setIsScanning(true);
    triggerBeep(330, 0.15);
    try {
      // Query Firestore to see if this vendor has an AR route
      const routesQuery = query(
        collection(db, 'ar_routes'),
        where('vendorId', '==', vendorId)
      );
      const querySnapshot = await getDocs(routesQuery);

      setTimeout(() => {
        triggerBeep(523.25, 0.1); // Scanner beep
        const found = vendors.find(v => v.id === vendorId);
        if (found) {
          setTargetVendor(found);
          setHasArrived(false);
          setScanSuccess(found.businessName);
          setScanMode(false);
          triggerBeep(1046.5, 0.35); // Success tone

          if (!querySnapshot.empty) {
            // Yes! The vendor has an AR route. Load it!
            const firstRouteDoc = querySnapshot.docs[0];
            const routeData = firstRouteDoc.data();
            setArRoute({ id: firstRouteDoc.id, ...routeData });
            setCurrentStopIndex(0);
            
            if (routeData.stops && routeData.stops.length > 0) {
              const firstStop = routeData.stops[0];
              const dist = calculateDistanceMeters(
                userLocation.lat,
                userLocation.lng,
                firstStop.lat,
                firstStop.lng
              );
              setSimulatedDistance(Math.round(Math.max(15, dist)));
            }
          } else {
            // No custom AR route, fallback to single point navigation
            setArRoute(null);
            setSimulatedDistance(Math.round(Math.max(10, Math.floor(Math.random() * 40) + 15)));
          }
        }
        setIsScanning(false);
        setTimeout(() => setScanSuccess(null), 3000);
      }, 1500);
    } catch (err) {
      console.error("Error matching route during scan:", err);
      // Fallback
      setTimeout(() => {
        triggerBeep(523.25, 0.1);
        const found = vendors.find(v => v.id === vendorId);
        if (found) {
          setTargetVendor(found);
          setHasArrived(false);
          setArRoute(null);
          setSimulatedDistance(Math.round(Math.max(10, Math.floor(Math.random() * 40) + 15)));
          setScanSuccess(found.businessName);
          setScanMode(false);
          triggerBeep(1046.5, 0.35);
        }
        setIsScanning(false);
        setTimeout(() => setScanSuccess(null), 3000);
      }, 1500);
    }
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
    
    let isCorrect = false;
    let correctAnswerStr = "";
    
    if (stop.quiz) {
      correctAnswerStr = stop.quiz.options[stop.quiz.answer] || "";
      isCorrect = quizSelectedOption.trim().toLowerCase() === correctAnswerStr.trim().toLowerCase();
    } else if (stop.quizAnswer) {
      correctAnswerStr = stop.quizAnswer;
      isCorrect = quizSelectedOption.trim().toLowerCase() === correctAnswerStr.trim().toLowerCase();
    }
    
    if (isCorrect) {
      setQuizSolved(true);
      const points = stop.rewardPoints || 100;
      const couponStr = stop.rewardCoupon ? ` na kadi ya kuponi ya kishindo: ${stop.rewardCoupon}` : "";
      setQuizRewardInfo(stop.quizReward || `Hongera sana! Umepata pointi ${points} za Uaminifu${couponStr}!`);
      setQuizScore(prev => prev + points);
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
          <>
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            
            {/* Shutter feedback flash */}
            {isCapturing && (
              <motion.div 
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 bg-white z-50 pointer-events-none"
              />
            )}

            {/* Photo Frame Overlay on Camera View */}
            {arRoute && arRoute.stops && arRoute.stops[currentStopIndex] && arRoute.stops[currentStopIndex].photoFrame && arRoute.stops[currentStopIndex].photoFrame !== 'none' && (
              (() => {
                const stop = arRoute.stops[currentStopIndex];
                return (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20">
                    {stop.photoFrame === 'retro_polaroid' && (
                      <div className="absolute inset-0 border-[16px] border-white border-b-[80px] shadow-2xl flex flex-col justify-end items-center p-4">
                        <span className="font-mono text-neutral-800 font-bold text-xs uppercase tracking-widest pointer-events-auto">
                          📸 {stop.stopName || stop.name || 'AR ADVENTURE'}
                        </span>
                        <span className="font-mono text-neutral-400 text-[9px] mt-1">
                          {new Date().toLocaleDateString('sw-TZ')}
                        </span>
                      </div>
                    )}
                    {stop.photoFrame === 'cyberpunk_glow' && (
                      <div className="absolute inset-0 border-2 border-cyan-500/80 animate-pulse shadow-[inset_0_0_20px_rgba(6,182,212,0.3)]">
                        <div className="absolute top-2 left-2 text-[8px] font-mono text-cyan-400 bg-black/60 px-2 py-0.5 rounded uppercase tracking-widest">
                          SYS_LOCK: SEC_B7 // TARGET ACQUIRED
                        </div>
                        <div className="absolute bottom-2 right-2 text-[8px] font-mono text-cyan-400 bg-black/60 px-2 py-0.5 rounded">
                          GPS_ALT: {stop.lat?.toFixed(5)}, {stop.lng?.toFixed(5)}
                        </div>
                        {/* Tech lines */}
                        <div className="absolute top-1/4 left-0 w-4 h-0.5 bg-cyan-500" />
                        <div className="absolute top-1/4 right-0 w-4 h-0.5 bg-cyan-500" />
                        <div className="absolute bottom-1/4 left-0 w-4 h-0.5 bg-cyan-500" />
                        <div className="absolute bottom-1/4 right-0 w-4 h-0.5 bg-cyan-500" />
                      </div>
                    )}
                    {stop.photoFrame === 'vintage_safari' && (
                      <div className="absolute inset-0 border-[8px] border-emerald-900/90 shadow-inner flex flex-col justify-between p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">🌿</span>
                          <span className="font-sans font-black text-[9px] tracking-widest text-emerald-300 uppercase bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
                            WILD SAFARI TOURS
                          </span>
                          <span className="text-sm">🌿</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-emerald-200">
                          <span>🐘</span>
                          <span>🦁</span>
                        </div>
                      </div>
                    )}
                    {stop.photoFrame === 'modern' && (
                      <div className="absolute inset-0 border-2 border-orange-500/50">
                        <div className="absolute top-1/2 left-4 w-6 h-0.5 bg-orange-500/70" />
                        <div className="absolute top-1/2 right-4 w-6 h-0.5 bg-orange-500/70" />
                        <div className="absolute left-1/2 top-4 w-0.5 h-6 bg-orange-500/70" />
                        <div className="absolute left-1/2 bottom-4 w-0.5 h-6 bg-orange-500/70" />
                        <div className="absolute top-4 right-4 text-[9px] font-bold text-orange-400 bg-black/50 px-2 py-0.5 rounded-full">
                          REC ●
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* Shutter Button when Photo Frame is Active */}
            {arRoute && arRoute.stops && arRoute.stops[currentStopIndex] && arRoute.stops[currentStopIndex].photoFrame && arRoute.stops[currentStopIndex].photoFrame !== 'none' && (
              <div className="absolute bottom-24 right-4 z-30 pointer-events-auto">
                <button
                  onClick={() => {
                    setIsCapturing(true);
                    triggerBeep(1200, 0.08);
                    setTimeout(() => {
                      setIsCapturing(false);
                      toast.success("📸 Picha imepigwa na kuhifadhiwa kwenye maktaba yako ya safari! 🎉");
                    }, 400);
                  }}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all border-4 border-neutral-300"
                  title="Piga Picha"
                >
                  <Camera className="w-5 h-5 text-neutral-800" />
                </button>
              </div>
            )}
          </>
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

        {/* Persistent/Collapsible Active Stop HUD for flat media view */}
        {arRoute && !scanMode && arRoute.stops && arRoute.stops[currentStopIndex] && (
          <div className="absolute top-[184px] inset-x-5 z-40 bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-3xl flex flex-col gap-2 shadow-2xl pointer-events-auto max-h-[48vh] overflow-y-auto no-scrollbar">
            {(() => {
              const stop = arRoute.stops[currentStopIndex];
              return (
                <>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="text-left min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Kituo cha Sasa ({currentStopIndex + 1})</span>
                      <h4 className="text-xs font-black uppercase text-white leading-tight truncate max-w-[150px]">
                        {stop.stopName || stop.name}
                      </h4>
                    </div>
                    <button 
                      onClick={() => setIsStopMediaCollapsed(!isStopMediaCollapsed)}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded-xl text-[9px] font-black uppercase tracking-wider text-white transition-all flex items-center gap-1 shrink-0"
                    >
                      <span>{isStopMediaCollapsed ? 'Fungua Picha/Video 👁️' : 'Funga Picha/Video ❌'}</span>
                    </button>
                  </div>

                  {!isStopMediaCollapsed && (
                    <div className="space-y-3 pt-1 text-left">
                      {(stop.stopDescription || stop.voiceText || stop.description) && (
                        <p className="text-[10px] text-neutral-300 font-medium leading-relaxed">
                          {stop.stopDescription || stop.voiceText || stop.description}
                        </p>
                      )}

                      {/* Image */}
                      {(stop.imageUrl || stop.image) && (
                        <div className="w-full h-32 rounded-2xl overflow-hidden border border-white/10 bg-neutral-900 relative">
                          <img 
                            src={stop.imageUrl || stop.image} 
                            alt={stop.stopName || "Stop Image"} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Video */}
                      {(stop.videoUrl || stop.video) && (
                        <div className="w-full p-2 bg-neutral-900 border border-white/10 rounded-2xl text-left">
                          <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">🎥 Video Clip:</span>
                          <div className="mt-1 aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center relative">
                            {renderVideoPlayer(stop.videoUrl || stop.video)}
                          </div>
                        </div>
                      )}

                      {/* External Link */}
                      {(stop.linkUrl || stop.link) && (
                        <div className="w-full">
                          <a 
                            href={stop.linkUrl || stop.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider block text-center transition-all shadow-lg"
                          >
                            🌐 Fungua Kiungo / Open External Link
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* 2. MAIN AR VIRTUAL MARKER OVERLAY */}
        {!scanMode && (targetVendor || arRoute) && (
          <div className="absolute inset-0 pointer-events-none">
            {/* IF IT IS AN AR TOUR (ROUTE), RENDER ALL UPCOMING STOPS SPATIALLY */}
            {arRoute ? (
              <>
                {upcomingStopsRenderData.map((item) => {
                  if (!item || !item.isVisible) return null;
                  const stop = item.stop;
                  const isCurrentActive = item.idx === currentStopIndex;

                  const charType = stop.character || 'guide';
                  const stopEmoji = [
                    { id: 'lion', icon: '🦁' },
                    { id: 'castle', icon: '🏰' },
                    { id: 'guide', icon: '🤖' },
                    { id: 'treasure', icon: '🎁' },
                    { id: 'coin', icon: '🪙' },
                    { id: 'dragon', icon: '🐉' },
                    { id: 'bread', icon: '🍞' },
                    { id: 'soda', icon: '🥤' },
                    { id: 'tv', icon: '📺' },
                    { id: 'teacher', icon: '👩‍🏫' },
                    { id: 'fireworks', icon: '🎉' },
                  ].find(c => c.id === charType)?.icon || '📍';

                  if (isCurrentActive) {
                    /* ACTIVE TARGET STOP: LARGE INTERACTIVE CARD */
                    return (
                      <motion.div 
                        key={item.idx}
                        style={{
                          left: `${item.horizontalPercent}%`,
                          top: '45%',
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute flex flex-col items-center justify-center transition-all duration-75 z-20"
                      >
                        {/* 3D Floating Tag Card */}
                        <motion.div 
                          style={{ scale: item.scale }}
                          animate={{ y: [0, -12, 0] }}
                          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                          className="bg-[#0B0C10]/95 backdrop-blur-xl border-2 border-orange-500/80 p-5 rounded-[2.25rem] w-80 text-center shadow-[0_25px_60px_rgba(249,115,22,0.35)] flex flex-col items-center relative overflow-hidden pointer-events-auto"
                        >
                          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />
                          
                          {/* Animated 3D Avatar Simulator */}
                          <div className="w-20 h-20 rounded-full bg-orange-600/20 border-2 border-orange-500/60 flex items-center justify-center text-4xl mb-3 shadow-lg relative overflow-hidden animate-[pulse_1.5s_infinite]">
                            <span className="animate-bounce">{stopEmoji}</span>
                            <span className="absolute bottom-1 text-[8px] font-black uppercase text-orange-400 bg-black/50 px-1.5 py-0.5 rounded-full">
                              {[
                                { id: 'lion', name: 'Simba wa 3D 🦁' },
                                { id: 'castle', name: 'Jengo la Kale 🏰' },
                                { id: 'guide', name: 'Guide wa Katuni 🤖' },
                                { id: 'treasure', name: 'Sanduku la Hazina 🎁' },
                                { id: 'coin', name: 'Sarafu ya Dhahabu 🪙' },
                                { id: 'dragon', name: 'Joka la Ndoto 🐉' },
                                { id: 'bread', name: 'Mkate mtamu 🍞' },
                                { id: 'soda', name: 'Kinywaji baridi 🥤' },
                                { id: 'tv', name: 'TV/Televisheni 📺' },
                                { id: 'teacher', name: 'Mwalimu msomi 👩‍🏫' },
                                { id: 'fireworks', name: 'Fataki za Sherehe 🎉' },
                              ].find(c => c.id === charType)?.name || 'Kiongozi'}
                            </span>
                          </div>

                          <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[8.5px] font-black uppercase tracking-widest text-orange-500 mb-1.5 animate-pulse">
                            Kituo cha AR Active
                          </span>

                          <h3 className="text-base font-black uppercase text-white leading-none tracking-tight mb-1">{stop.stopName || stop.name}</h3>
                          <p className="text-[10px] text-neutral-300 font-medium leading-relaxed mb-3">{stop.stopDescription || stop.voiceText}</p>

                          {/* Rich Media: Image */}
                          {(stop.imageUrl || stop.image) && (
                            <div className="w-full h-28 rounded-2xl overflow-hidden border border-white/10 mb-3 bg-neutral-900 relative pointer-events-auto">
                              <img 
                                src={stop.imageUrl || stop.image} 
                                alt={stop.name || "AR Image"} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          {/* Rich Media: Video */}
                          {(stop.videoUrl || stop.video) && (
                            <div className="w-full p-2 bg-neutral-900 border border-white/10 rounded-2xl mb-3 text-left pointer-events-auto">
                              <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">🎥 Video Clip:</span>
                              <div className="mt-1 aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center relative">
                                {renderVideoPlayer(stop.videoUrl || stop.video)}
                              </div>
                            </div>
                          )}

                          {/* Rich Media: External Link */}
                          {(stop.linkUrl || stop.link) && (
                            <div className="w-full mb-3 pointer-events-auto">
                              <a 
                                href={stop.linkUrl || stop.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider block text-center transition-colors"
                              >
                                🌐 Fungua Kiungo / Link
                              </a>
                            </div>
                          )}

                          {/* Distance feedback */}
                          <div className="flex items-center justify-center gap-1.5 text-orange-500 font-mono font-black text-2xl tracking-tighter mb-4">
                            <Navigation className="w-5 h-5 fill-current animate-[spin_5s_linear_infinite]" />
                            <span>{item.distance} Mita</span>
                          </div>

                          {/* Interactive Stop Experience */}
                          {hasArrived ? (
                            <div className="w-full space-y-3 pointer-events-auto">
                              {(stop.hasQuiz || !!stop.quiz) && !quizSolved ? (
                                <div className="p-3 bg-neutral-900 border border-orange-500/30 rounded-2xl text-left">
                                  <h4 className="text-[10px] font-black uppercase text-orange-500 mb-1 flex items-center gap-1">
                                    <HelpCircle className="w-3.5 h-3.5" /> Fumbo la Kituo:
                                  </h4>
                                  <p className="text-xs text-neutral-100 font-bold mb-3 leading-relaxed">
                                    {stop.quizQuestion || stop.quiz?.question}
                                  </p>
                                  
                                  <div className="space-y-1.5">
                                    {stop.quiz ? (
                                      <div className="space-y-1.5">
                                        {stop.quiz.options.map((opt: string, oIdx: number) => {
                                          const isSelected = quizSelectedOption === opt;
                                          return (
                                            <button
                                              key={oIdx}
                                              onClick={() => {
                                                setQuizSelectedOption(opt);
                                                setQuizError(null);
                                              }}
                                              className={`w-full py-1.5 px-3 rounded-xl text-left text-[11px] font-bold border transition-all ${
                                                isSelected 
                                                  ? 'bg-orange-600 text-white border-orange-500 shadow-md'
                                                  : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10'
                                              }`}
                                            >
                                              {oIdx + 1}. {opt}
                                            </button>
                                          );
                                        })}
                                        {quizError && (
                                          <p className="text-[10px] text-red-500 font-bold mt-1">{quizError}</p>
                                        )}
                                        <Button 
                                          onClick={handleQuizSubmit}
                                          disabled={!quizSelectedOption}
                                          className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                                        >
                                          Hakiki Jibu
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
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
                                      </>
                                    )}
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
                                    className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg animate-bounce"
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
                        </motion.div>

                        {/* Ground neon projection ring */}
                        <div className="w-40 h-8 bg-transparent border-[3px] border-orange-500/40 rounded-full shadow-[0_0_20px_#ea580c] scale-[0.6] blur-[1px] mt-6 animate-[pulse_2s_infinite]" />
                      </motion.div>
                    );
                  } else {
                    /* FUTURE UPCOMING STOP: SMALL 3D PIN IN SPACE */
                    return (
                      <motion.div
                        key={item.idx}
                        style={{
                          left: `${item.horizontalPercent}%`,
                          top: '38%',
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute flex flex-col items-center justify-center transition-all duration-75 z-10"
                      >
                        <motion.div
                          style={{ scale: item.scale }}
                          animate={{ y: [0, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: (item.idx * 0.4) }}
                          className="bg-neutral-950/90 backdrop-blur-md border border-dashed border-orange-500/40 p-3 rounded-2xl w-44 text-center shadow-[0_15px_30px_rgba(234,88,12,0.15)] flex flex-col items-center relative overflow-hidden pointer-events-auto"
                        >
                          <div className="w-9 h-9 rounded-full bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-xl mb-1 shadow-inner">
                            <span className="animate-pulse">{stopEmoji}</span>
                          </div>
                          
                          <span className="px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-[7.5px] font-black uppercase tracking-widest text-orange-400 mb-1">
                            Kituo #{item.idx + 1}
                          </span>
                          
                          <h4 className="text-[10px] font-black text-white leading-tight mb-1 truncate max-w-[150px]">
                            {stop.stopName || stop.name}
                          </h4>
                          
                          <div className="flex items-center gap-1 text-[8.5px] text-neutral-400 font-mono">
                            <Navigation className="w-2.5 h-2.5 fill-current text-orange-500 rotate-45" />
                            <span>{item.distance} Mita</span>
                          </div>
                        </motion.div>
                        
                        {/* Connecting visual dotted line to ground indicator */}
                        <div className="w-0.5 h-5 border-l border-dashed border-orange-500/30" />
                        <div className="w-2 h-2 rounded-full bg-orange-500/60 animate-ping" />
                      </motion.div>
                    );
                  }
                })}

                {/* OUT OF FOV HELPERS (GUIDE THE USER TOWARDS THE ACTIVE STOP) */}
                {!isTargetVisibleInCamera && (
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
                          <p className="text-[10px] font-black uppercase tracking-wider">Pinda Kushoto</p>
                          <p className="text-[9px] text-orange-200 font-bold uppercase">Zunguka kushoto kuona Kituo #{currentStopIndex + 1}</p>
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
                          <p className="text-[10px] font-black uppercase tracking-wider">Pinda Kulia</p>
                          <p className="text-[9px] text-orange-200 font-bold uppercase">Zunguka kulia kuona Kituo #{currentStopIndex + 1}</p>
                        </div>
                        <Navigation className="w-5 h-5 rotate-90 fill-current text-white" />
                      </motion.div>
                    ) : (
                      <div />
                    )}
                  </div>
                )}
              </>
            ) : (
              /* ORIGINAL SINGLE VENDOR STORE DESTINATION CARD */
              <>
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
                          {targetVendor.arDirections || 'Fika dukani kwa kufuata mshale vya GPS hapo juu.'}
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
              </>
            )}
          </div>
        )}

        {/* 2.5 ANT-WAY LIVE WAYFINDING HUD PANEL */}
        {arRoute && !scanMode && (
          <div className="absolute bottom-4 inset-x-5 z-30 flex flex-col gap-2 pointer-events-none">
            {/* The Ant-Way Trail Board */}
            <div className="bg-[#0B0C10]/95 backdrop-blur-md border border-orange-500/30 px-4 py-3.5 rounded-3xl flex flex-col gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto max-h-[80vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-neutral-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                  Njia ya Ant-Way (Wayfinding Trail)
                </span>
                <span className="text-orange-500 font-mono font-bold">UTALII WA AR</span>
              </div>
              
              {/* Direction/Chevron Indicator */}
              <div className="flex items-center justify-center py-1.5 bg-white/5 border border-white/5 rounded-xl">
                {(() => {
                  const absAngleOffset = Math.abs(angleOffset);
                  
                  if (absAngleOffset <= 10) {
                    return (
                      <div className="flex items-center gap-2 text-green-500 font-black uppercase tracking-widest text-xs animate-pulse">
                        <Navigation className="w-4 h-4 fill-current rotate-0" />
                        <span>MWELEKEO SAHIHI (GO STRAIGHT)</span>
                        <div className="flex gap-0.5 ml-1">
                          <span className="animate-pulse">▲</span>
                          <span className="animate-pulse delay-75">▲</span>
                        </div>
                      </div>
                    );
                  } else if (angleOffset < 0) {
                    return (
                      <div className="flex items-center gap-2 text-orange-500 font-black uppercase tracking-widest text-xs">
                        <div className="flex gap-0.5 mr-1">
                          <span className="animate-bounce">◀</span>
                          <span className="animate-bounce delay-75">◀</span>
                        </div>
                        <span>PINDA KUSHOTO ({Math.round(absAngleOffset)}°)</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center gap-2 text-orange-500 font-black uppercase tracking-widest text-xs">
                        <span>PINDA KULIA ({Math.round(absAngleOffset)}°)</span>
                        <div className="flex gap-0.5 ml-1">
                          <span className="animate-bounce">▶</span>
                          <span className="animate-bounce delay-75">▶</span>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Waypoint nodes list with animated connection */}
              <div className="flex items-center justify-between gap-1.5 mt-0.5 overflow-x-auto no-scrollbar py-0.5 border-b border-white/10 pb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">👤</span>
                  <span className="text-[9px] font-black text-white/60">Wewe</span>
                </div>
                
                <div className="flex-1 h-0.5 border-t border-dashed border-orange-500/40 relative min-w-[30px]">
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-orange-500 origin-left animate-[shimmer_1.5s_infinite]" style={{ width: '100%' }} />
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/15 border border-orange-500/30 rounded-xl max-w-[120px]">
                  <span className="text-[10px]">📍</span>
                  <div className="text-left leading-none truncate">
                    <p className="text-[9px] font-black uppercase text-orange-400">Kituo sasa</p>
                    <p className="text-[8px] font-bold text-neutral-300 truncate max-w-[80px]">
                      {arRoute.stops[currentStopIndex].stopName || arRoute.stops[currentStopIndex].name}
                    </p>
                  </div>
                </div>

                {currentStopIndex < arRoute.stops.length - 1 && (
                  <>
                    <div className="flex-1 h-0.5 border-t border-dashed border-white/20 min-w-[30px]" />
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-xl max-w-[120px]">
                      <span className="text-[10px]">🔮</span>
                      <div className="text-left leading-none truncate">
                        <p className="text-[9px] font-black uppercase text-neutral-500">Kijacho</p>
                        <p className="text-[8px] font-bold text-neutral-400 truncate max-w-[80px]">
                          {arRoute.stops[currentStopIndex + 1].stopName || arRoute.stops[currentStopIndex + 1].name}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Enhanced Media & Info Drawer Content */}
              {(() => {
                const stop = arRoute.stops[currentStopIndex];
                if (!stop) return null;
                const hasMedia = stop.imageUrl || stop.image || stop.videoUrl || stop.video || stop.linkUrl || stop.link;
                const charType = stop.character || 'guide';
                let charEmoji = '🤖';
                if (charType === 'lion') charEmoji = '🦁';
                else if (charType === 'castle') charEmoji = '🏰';
                else if (charType === 'treasure') charEmoji = '🎁';
                else if (charType === 'coin') charEmoji = '🪙';
                else if (charType === 'dragon') charEmoji = '🐉';
                else if (charType === 'bread') charEmoji = '🍞';
                else if (charType === 'soda') charEmoji = '🥤';
                else if (charType === 'tv') charEmoji = '📺';
                else if (charType === 'teacher') charEmoji = '👩‍🏫';
                else if (charType === 'fireworks') charEmoji = '🎉';

                return (
                  <div className="flex flex-col gap-2 mt-1">
                    {/* Header showing Active Stop */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{charEmoji}</span>
                        <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                          {stop.stopName || stop.name}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${hasArrived ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-orange-500/10 border border-orange-500/20 text-orange-500 animate-pulse"}`}>
                        {hasArrived ? "📍 Umefika!" : `${activeDistance} Mita`}
                      </span>
                    </div>

                    {/* Narrator Voice Description */}
                    <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-[10px] text-neutral-300 font-medium leading-relaxed">
                      <span className="text-[8.5px] font-black uppercase tracking-widest text-neutral-500 block mb-0.5">Sauti ya Kiongozi (Narrator):</span>
                      {stop.voiceText || stop.stopDescription || "Tafadhali nenda mbele kuelekea kituo hiki kulingana na dira ya GPS hapo juu."}
                    </div>

                    {/* Rich Media List (Always accessible) */}
                    {hasMedia && (
                      <div className="space-y-2 mt-1 bg-white/5 border border-white/5 p-2 rounded-2xl max-h-[160px] overflow-y-auto no-scrollbar">
                        {/* Image */}
                        {(stop.imageUrl || stop.image) && (
                          <div className="rounded-xl overflow-hidden border border-white/10 bg-neutral-900 aspect-video relative">
                            <img 
                              src={stop.imageUrl || stop.image} 
                              alt={stop.stopName || stop.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[7px] text-white uppercase font-black tracking-widest">
                              Picha ya Kituo
                            </div>
                          </div>
                        )}

                        {/* Video */}
                        {(stop.videoUrl || stop.video) && (
                          <div className="p-1 bg-black/40 border border-white/5 rounded-xl">
                            <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 block p-1">🎥 Video Clip ya Kituo:</span>
                            <div className="aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center relative">
                              {renderVideoPlayer(stop.videoUrl || stop.video)}
                            </div>
                          </div>
                        )}

                        {/* External Link */}
                        {(stop.linkUrl || stop.link) && (
                          <div className="pt-0.5">
                            <a 
                              href={stop.linkUrl || stop.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider block text-center transition-all shadow-md shadow-blue-950/40"
                            >
                              🌐 Fungua Tovuti / Visit External Link
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Quiz when Arrived */}
                    {hasArrived && (stop.hasQuiz || !!stop.quiz) && !quizSolved && (
                      <div className="p-2.5 bg-orange-950/20 border border-orange-500/20 rounded-xl text-left">
                        <h4 className="text-[8.5px] font-black uppercase text-orange-400 mb-1 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> Fumbo / Quiz ya Kituo:
                        </h4>
                        <p className="text-[10px] text-neutral-100 font-bold mb-2 leading-relaxed">
                          {stop.quiz?.question || stop.quizQuestion || "Je, unaweza kutatua fumbo hili?"}
                        </p>
                        
                        <div className="space-y-1">
                          {(stop.quiz?.options || stop.quizOptions || []).map((opt: string, oIdx: number) => (
                            <button
                              key={oIdx}
                              onClick={() => setQuizSelectedOption(opt)}
                              className={`w-full text-left p-2 rounded-lg text-[9px] font-bold transition-all border ${quizSelectedOption === opt ? 'bg-orange-500/20 border-orange-500 text-white shadow-sm' : 'bg-white/5 border-transparent text-neutral-400 hover:bg-white/10'}`}
                            >
                              {oIdx + 1}. {opt}
                            </button>
                          ))}
                        </div>
                        
                        <button
                          disabled={!quizSelectedOption}
                          onClick={handleQuizSubmit}
                          className="w-full mt-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          Wasilisha Jibu la Fumbo
                        </button>
                        
                        {quizError && <p className="text-[9px] text-red-500 mt-1 font-semibold">{quizError}</p>}
                      </div>
                    )}

                    {/* Quiz Solved Reward Display */}
                    {quizSolved && quizRewardInfo && (
                      <div className="p-2.5 bg-green-950/20 border border-green-500/20 rounded-xl text-center">
                        <p className="text-[9px] text-green-400 font-black uppercase tracking-wider">🎉 Fumbo Limetatuliwa kwa Mafanikio!</p>
                        <p className="text-xs text-white font-black mt-0.5">{quizRewardInfo}</p>
                      </div>
                    )}

                    {/* Simulation and Navigation Control Buttons */}
                    <div className="mt-1 flex gap-2">
                      {!hasArrived ? (
                        <button 
                          onClick={() => setIsSimulatingWalk(!isSimulatingWalk)}
                          className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${isSimulatingWalk ? 'bg-amber-600 text-white animate-pulse' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-950/20'}`}
                        >
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          {isSimulatingWalk ? 'Inatembea...' : 'Anza Safari (Simulate Walk)'}
                        </button>
                      ) : (
                        <button
                          onClick={handleNextStop}
                          className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-green-950/30 font-black"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{currentStopIndex >= arRoute.stops.length - 1 ? 'Kamilisha Utalii' : 'Nenda Kituo Kinachofuata'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
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
        {!arRoute && !initialTargetVendorId && (
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
        )}
      </div>
    </div>
  );
}
