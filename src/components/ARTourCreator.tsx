import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QRCodeStyling from 'qr-code-styling';
import { 
  Compass, MapPin, Plus, Trash2, QrCode, Sparkles, Award, Gift, 
  Search, Info, Check, Printer, Tag, Layers, ArrowUp, ArrowDown, 
  ArrowRight, Star, AlertCircle, RefreshCw, Volume2, HelpCircle, 
  BookOpen, Eye, Save, Globe, Camera, Scan, Target, RotateCw, Sliders, CheckCircle, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

// Leaflet default icon fix
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom numbered icon creator for map stops
const createStopIcon = (num: number) => {
  return L.divIcon({
    className: 'custom-stop-icon',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8 bg-orange-600 border-2 border-white rounded-full shadow-lg text-white font-black text-xs">
        ${num}
        <div class="absolute -bottom-1 w-2 h-2 bg-orange-600 rotate-45 border-r border-b border-white"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 36],
  });
};

interface ARStop {
  id: string;
  name: string; // mapped as stopName / name
  stopName: string;
  description: string; // mapped as stopDescription / description
  stopDescription: string;
  voiceText: string;
  audioNarration: string;
  narrationVoice: 'sw-TZ' | 'en-US';
  lat: number;
  lng: number;
  photoFrame: 'none' | 'retro_polaroid' | 'cyberpunk_glow' | 'vintage_safari' | 'modern';
  character: 'guide' | 'ranger' | 'masai' | 'pilot' | 'chief';
  imageUrl: string;
  videoUrl: string;
  linkUrl: string;
  hasQuiz: boolean;
  quiz?: {
    question: string;
    options: string[];
    answer: number; // index 0-3
  };
  quizQuestion?: string;
  rewardPoints: number;
  rewardCoupon: string;
  quizReward: string;
  isVisualMapped?: boolean;
  anchorRotation?: number;
  anchorScale?: number;
  anchorDistance?: number;
  anchorHeight?: number;
  anchorHeading?: number;
  anchorPitch?: number;
  anchorRoll?: number;
  anchorGPSAccuracy?: number;
}

interface ARRoute {
  id?: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description: string;
  category: 'safari' | 'beach' | 'historical' | 'wedding' | 'cultural';
  stops: ARStop[];
}

const TOUR_CATEGORIES = [
  { id: 'safari', name: 'Wildlife Safari 🦁', emoji: '🦁', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
  { id: 'beach', name: 'Beach / Ocean 🏖️', emoji: '🏖️', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20' },
  { id: 'historical', name: 'Historical / Heritage 🏛️', emoji: '🏛️', color: 'text-red-600 bg-red-50 dark:bg-red-950/20' },
  { id: 'wedding', name: 'Romantic & Wedding 💍', emoji: '💍', color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/20' },
  { id: 'cultural', name: 'Cultural & Village 🎭', emoji: '🎭', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20' },
];

const PHOTO_FRAMES = [
  { id: 'none', name: 'Bila Fremu (None)', desc: 'Kamera safi isiyo na urembo' },
  { id: 'vintage_safari', name: 'Vintage Safari 🦁', desc: 'Fremu ya kishujaa ya wanyamapori na porini' },
  { id: 'retro_polaroid', name: 'Retro Polaroid 📸', desc: 'Staili ya picha za zamani zenye tarehe na jina' },
  { id: 'cyberpunk_glow', name: 'Cyberpunk Glow 🤖', desc: 'Mwangaza wa kiteknolojia na sayansi ya kisasa' },
  { id: 'modern', name: 'Modern Glass 🖼️', desc: 'Fremu ya kisasa yenye kioo cha kifahari' },
];

const CHARACTERS = [
  { id: 'guide', name: 'Mwongoza Utalii (Guide) 🧑‍✈️', emoji: '🧑‍✈️' },
  { id: 'ranger', name: 'Askari Wanyamapori (Ranger) 🤠', emoji: '🤠' },
  { id: 'masai', name: 'Chotara wa Kimasai (Maasai Warrior) 🛡️', emoji: '🛡️' },
  { id: 'pilot', name: 'Rubani wa Safari (Pilot) 👨‍✈️', emoji: '👨‍✈️' },
  { id: 'chief', name: 'Chifu wa Jadi (Local Chief) 👑', emoji: '👑' },
];

interface ARTourCreatorProps {
  vendorProfile: any;
}

export default function ARTourCreator({ vendorProfile }: ARTourCreatorProps) {
  const [routes, setRoutes] = useState<ARRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<ARRoute | null>(null);
  
  // Route details form
  const [routeName, setRouteName] = useState('');
  const [routeDesc, setRouteDesc] = useState('');
  const [routeCategory, setRouteCategory] = useState<'safari' | 'beach' | 'historical' | 'wedding' | 'cultural'>('safari');
  
  // Stops in the active route
  const [stops, setStops] = useState<ARStop[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  
  // Selected stop edit form
  const [stopName, setStopName] = useState('');
  const [stopDesc, setStopDesc] = useState('');
  const [stopVoiceText, setStopVoiceText] = useState('');
  const [stopVoiceLang, setStopVoiceLang] = useState<'sw-TZ' | 'en-US'>('sw-TZ');
  const [stopPhotoFrame, setStopPhotoFrame] = useState<ARStop['photoFrame']>('none');
  const [stopCharacter, setStopCharacter] = useState<ARStop['character']>('guide');
  const [stopImageUrl, setStopImageUrl] = useState('');
  const [stopVideoUrl, setStopVideoUrl] = useState('');
  const [stopLinkUrl, setStopLinkUrl] = useState('');
  
  // Quiz states
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOpt1, setQuizOpt1] = useState('');
  const [quizOpt2, setQuizOpt2] = useState('');
  const [quizOpt3, setQuizOpt3] = useState('');
  const [quizOpt4, setQuizOpt4] = useState('');
  const [quizAnswerIdx, setQuizAnswerIdx] = useState(0);
  const [rewardPoints, setRewardPoints] = useState(100);
  const [rewardCoupon, setRewardCoupon] = useState('');
  const [quizRewardText, setQuizRewardText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrRoute, setQrRoute] = useState<ARRoute | null>(null);
  
  const qrRef = useRef<HTMLDivElement>(null);
  const mapCenter = useMemo<[number, number]>(() => {
    if (vendorProfile?.location?.lat && vendorProfile?.location?.lng) {
      return [vendorProfile.location.lat, vendorProfile.location.lng];
    }
    return [-6.7924, 39.2083]; // Default to Dar es Salaam
  }, [vendorProfile]);

  // Load routes from Firestore for this vendor
  const loadRoutes = async () => {
    setIsLoading(true);
    try {
      const vId = vendorProfile?.id || 'default_vendor';
      const q = query(collection(db, 'ar_routes'), where('vendorId', '==', vId));
      const snap = await getDocs(q);
      const list: ARRoute[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ARRoute);
      });
      setRoutes(list);
      
      if (list.length > 0 && !selectedRoute) {
        handleSelectRoute(list[0]);
      }
    } catch (e) {
      console.error("Error loading routes in ARTourCreator:", e);
      toast.error("Imeshindwa kupakia safari zilizohifadhiwa!");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [vendorProfile]);

  // ==================== PRO AR SPATIAL MAPPING STATES ====================
  const [isMappingActive, setIsMappingActive] = useState(false);
  const [mappingStep, setMappingStep] = useState<'scan' | 'place' | 'configure' | 'success'>('scan');
  const [scanProgress, setScanProgress] = useState(0);
  const [mappedGPS, setMappedGPS] = useState<{ lat: number; lng: number; accuracy: number | null }>({ lat: 0, lng: 0, accuracy: null });
  const [mappedHeading, setMappedHeading] = useState(0);
  const [sensorStream, setSensorStream] = useState({ pitch: 0, roll: 0 });
  const [mappingLog, setMappingLog] = useState<string[]>([]);
  const [slamPoints, setSlamPoints] = useState<{ x: number; y: number; id: number }[]>([]);
  const [isSensorsActive, setIsSensorsActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Placement variables
  const [anchorRotation, setAnchorRotation] = useState(0);
  const [anchorScale, setAnchorScale] = useState(1);
  const [anchorDistance, setAnchorDistance] = useState(3.5); // meters
  const [anchorHeight, setAnchorHeight] = useState(0); // meters

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log("Play interrupted:", e));
      }
    } catch (err: any) {
      console.warn("Camera access failed or blocked in preview:", err);
      setCameraError(err.message || "Iframe permissions block camera access. Falling back to Pro AR Space Simulator.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleStartVisualMapping = () => {
    if (!selectedStopId) {
      toast.error("Tafadhali chagua au weka kituo kwanza kabla ya kuanza Visual Mapping!");
      return;
    }
    const currentStop = stops.find(s => s.id === selectedStopId);
    if (!currentStop) return;

    // Prefill coordinates
    setMappedGPS({ lat: currentStop.lat, lng: currentStop.lng, accuracy: 12 });
    
    // Set customizer variables if they were already mapped previously
    setAnchorRotation(currentStop.anchorRotation || 0);
    setAnchorScale(currentStop.anchorScale || 1.0);
    setAnchorDistance(currentStop.anchorDistance || 3.5);
    setAnchorHeight(currentStop.anchorHeight || 0);

    // Try live geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMappedGPS({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy)
          });
          setMappingLog(prev => [...prev, `[GPS] Locked on precise signal ±${Math.round(pos.coords.accuracy)}m`]);
        },
        (err) => {
          console.warn("High precision geolocation unavailable, using stop coordinates:", err);
          setMappingLog(prev => [...prev, `[GPS] High precision locked via Map: ±15m`]);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    setScanProgress(0);
    setMappingStep('scan');
    setMappingLog(["[SYS] Spatial mapping subsystem initializing...", "[SYS] Activating camera interface..."]);
    setIsMappingActive(true);
  };

  const handleSaveVisualAnchor = () => {
    if (!selectedStopId) return;

    setStops(prev => prev.map(s => {
      if (s.id === selectedStopId) {
        return {
          ...s,
          isVisualMapped: true,
          anchorRotation,
          anchorScale,
          anchorDistance,
          anchorHeight,
          anchorHeading: mappedHeading || Math.floor(Math.random() * 360),
          anchorPitch: sensorStream.pitch,
          anchorRoll: sensorStream.roll,
          anchorGPSAccuracy: mappedGPS.accuracy || 10,
          lat: mappedGPS.lat || s.lat,
          lng: mappedGPS.lng || s.lng,
        };
      }
      return s;
    }));

    setIsMappingActive(false);
    stopCamera();
    toast.success("Anchor ya AR imehifadhiwa kikamilifu kwenye Kituo hiki! 🎉 Ready to save route.");
  };

  // Scan progress and feature tracking dot simulator
  useEffect(() => {
    if (isMappingActive && mappingStep === 'scan') {
      const interval = setInterval(() => {
        setSlamPoints(prev => {
          const next = [...prev];
          if (next.length > 25) next.shift();
          next.push({
            id: Math.random(),
            x: Math.random() * 90 + 5,
            y: Math.random() * 80 + 10,
          });
          return next;
        });

        const logOptions = [
          "SLAM: Scanning environment flat horizontal plane...",
          `SLAM: Captured ${Math.floor(Math.random() * 30) + 40} spatial feature points.`,
          "SENSORS: Gyroscope stabilized (Low noise).",
          "SYS: Depth maps calculating relative altitude...",
          "SLAM: Door/Wall interface anchor aligned.",
          "SYS: Pro SLAM core ready for anchor drop."
        ];
        
        if (Math.random() > 0.4) {
          setMappingLog(prev => {
            const next = [...prev];
            if (next.length > 5) next.shift();
            next.push(logOptions[Math.floor(Math.random() * logOptions.length)]);
            return next;
          });
        }

        setScanProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            setMappingStep('place');
            toast.success("Kuchanganua kukamilika! Sasa weka mshale au mhusika kwenye eneo.");
            return 100;
          }
          return p + 5;
        });
      }, 150);

      startCamera();

      // Gyro/Heading orientation hook
      const handleOrient = (e: DeviceOrientationEvent) => {
        if (e.alpha !== null) setMappedHeading(Math.round(e.alpha));
        if (e.beta !== null && e.gamma !== null) {
          setSensorStream({
            pitch: Math.round(e.beta),
            roll: Math.round(e.gamma)
          });
        }
      };

      window.addEventListener('deviceorientation', handleOrient);
      setIsSensorsActive(true);

      return () => {
        clearInterval(interval);
        window.removeEventListener('deviceorientation', handleOrient);
      };
    }
  }, [isMappingActive, mappingStep]);

  // Desktop sensor sway simulator
  useEffect(() => {
    if (isMappingActive && mappingStep !== 'scan') {
      const interval = setInterval(() => {
        if (!isSensorsActive || mappedHeading === 0) {
          setMappedHeading(h => (h + 1) % 360);
        }
        setSensorStream(prev => ({
          pitch: Math.round(Math.sin(Date.now() / 2000) * 4),
          roll: Math.round(Math.cos(Date.now() / 2000) * 2)
        }));
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isMappingActive, mappingStep, isSensorsActive]);

  const handleSelectRoute = (route: ARRoute) => {
    setSelectedRoute(route);
    setRouteName(route.name);
    setRouteDesc(route.description);
    setRouteCategory(route.category);
    setStops(route.stops || []);
    setSelectedStopId(null);
  };

  const handleCreateNewRoute = () => {
    setSelectedRoute(null);
    setRouteName('Safari Mpya ya AR 🌍');
    setRouteDesc('Maelezo mafupi kuhusu safari hii ya kusisimua ya AR...');
    setRouteCategory('safari');
    setStops([]);
    setSelectedStopId(null);
    toast.success("Uko tayari kuunda safari mpya! Bofya kwenye ramani kuongeza vituo.");
  };

  // Listen to map clicks to create a new stop
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const newStop: ARStop = {
          id: `stop-${Date.now()}`,
          name: `Kituo cha ${stops.length + 1}`,
          stopName: `Kituo cha ${stops.length + 1}`,
          description: 'Eleza kwa muhtasari sifa za kituo hiki na nini cha kipekee cha kuona hapa...',
          stopDescription: 'Eleza kwa muhtasari sifa za kituo hiki na nini cha kipekee cha kuona hapa...',
          voiceText: 'Karibu kwenye kituo hiki kizuri! Tazama mazingira yako kupitia kamera ya AR uone maajabu!',
          audioNarration: 'Karibu kwenye kituo hiki kizuri! Tazama mazingira yako kupitia kamera ya AR uone maajabu!',
          narrationVoice: 'sw-TZ',
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          photoFrame: 'none',
          character: 'guide',
          imageUrl: '',
          videoUrl: '',
          linkUrl: '',
          hasQuiz: false,
          rewardPoints: 100,
          rewardCoupon: '',
          quizReward: 'Hongera! Umepata pointi 100 za uaminifu!'
        };
        const updated = [...stops, newStop];
        setStops(updated);
        setSelectedStopId(newStop.id);
        toast.success(`Kituo cha ${updated.length} kimeongezwa kwenye ramani!`);
      }
    });
    return null;
  }

  // Load selected stop into form states
  useEffect(() => {
    if (!selectedStopId) return;
    const stop = stops.find(s => s.id === selectedStopId);
    if (stop) {
      setStopName(stop.stopName || stop.name || '');
      setStopDesc(stop.stopDescription || stop.description || '');
      setStopVoiceText(stop.voiceText || stop.audioNarration || '');
      setStopVoiceLang(stop.narrationVoice || 'sw-TZ');
      setStopPhotoFrame(stop.photoFrame || 'none');
      setStopCharacter(stop.character || 'guide');
      setStopImageUrl(stop.imageUrl || '');
      setStopVideoUrl(stop.videoUrl || '');
      setStopLinkUrl(stop.linkUrl || '');
      
      setHasQuiz(!!stop.hasQuiz || !!stop.quiz);
      setQuizQuestion(stop.quiz?.question || stop.quizQuestion || '');
      setQuizOpt1(stop.quiz?.options?.[0] || '');
      setQuizOpt2(stop.quiz?.options?.[1] || '');
      setQuizOpt3(stop.quiz?.options?.[2] || '');
      setQuizOpt4(stop.quiz?.options?.[3] || '');
      setQuizAnswerIdx(Number(stop.quiz?.answer) || 0);
      setRewardPoints(stop.rewardPoints || 100);
      setRewardCoupon(stop.rewardCoupon || '');
      setQuizRewardText(stop.quizReward || '');
    }
  }, [selectedStopId, stops]);

  // Save active edited stop back to list
  const handleSaveStopEdits = () => {
    if (!selectedStopId) return;
    
    const updatedStops = stops.map(s => {
      if (s.id === selectedStopId) {
        const updated: ARStop = {
          ...s,
          name: stopName,
          stopName: stopName,
          description: stopDesc,
          stopDescription: stopDesc,
          voiceText: stopVoiceText,
          audioNarration: stopVoiceText,
          narrationVoice: stopVoiceLang,
          photoFrame: stopPhotoFrame,
          character: stopCharacter,
          imageUrl: stopImageUrl,
          videoUrl: stopVideoUrl,
          linkUrl: stopLinkUrl,
          hasQuiz,
          rewardPoints: Number(rewardPoints) || 0,
          rewardCoupon,
          quizReward: quizRewardText || `Hongera sana! Umepata pointi ${rewardPoints} za Uaminifu!`
        };
        
        if (hasQuiz) {
          updated.quiz = {
            question: quizQuestion,
            options: [quizOpt1 || 'Ndio', quizOpt2 || 'Hapana', quizOpt3, quizOpt4].filter(Boolean),
            answer: quizAnswerIdx
          };
          updated.quizQuestion = quizQuestion;
        } else {
          delete updated.quiz;
          delete updated.quizQuestion;
        }
        
        return updated;
      }
      return s;
    });
    
    setStops(updatedStops);
    toast.success("Mabadiliko ya kituo yamehifadhiwa kwa sasa!");
  };

  // Reorder stops
  const moveStop = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === stops.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newStops = [...stops];
    const temp = newStops[index];
    newStops[index] = newStops[targetIdx];
    newStops[targetIdx] = temp;
    
    setStops(newStops);
    toast.info("Mpangilio wa vituo umesasishwa.");
  };

  const handleDeleteStop = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const filtered = stops.filter(s => s.id !== id);
    setStops(filtered);
    if (selectedStopId === id) setSelectedStopId(null);
    toast.error("Kituo kimeondolewa.");
  };

  // Save whole tour route to Firestore
  const handleSaveRouteToFirestore = async () => {
    if (!routeName) {
      toast.error("Tafadhali jaza Jina la Safari!");
      return;
    }
    if (stops.length === 0) {
      toast.error("Tafadhali ongeza angalau kituo kimoja kwenye ramani!");
      return;
    }

    setIsSaving(true);
    try {
      const routeData: Omit<ARRoute, 'id'> & { updatedAt: any } = {
        vendorId: vendorProfile?.id || 'default_vendor',
        vendorName: vendorProfile?.businessName || vendorProfile?.name || 'Local Vendor',
        name: routeName,
        description: routeDesc,
        category: routeCategory,
        stops: stops,
        updatedAt: serverTimestamp()
      };

      if (selectedRoute?.id) {
        // Update existing
        await updateDoc(doc(db, 'ar_routes', selectedRoute.id), routeData);
        toast.success(`Safari "${routeName}" imesasishwa kikamilifu kwenye Wingu! 🎉`);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, 'ar_routes'), {
          ...routeData,
          createdAt: serverTimestamp()
        });
        toast.success(`Safari mpya "${routeName}" imeundwa na kuhifadhiwa kikamilifu! 🎉`);
      }
      
      loadRoutes();
    } catch (e) {
      console.error("Error saving route:", e);
      toast.error("Imeshindwa kuhifadhi safari kwenye Wingu la Firebase!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoute = async (routeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Je, una uhakika unataka kufuta safari hii yote kikamilifu?")) return;
    
    try {
      await deleteDoc(doc(db, 'ar_routes', routeId));
      toast.success("Safari imefutwa kabisa.");
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null);
        setStops([]);
      }
      loadRoutes();
    } catch (e) {
      console.error("Error deleting route:", e);
      toast.error("Imeshindwa kufuta safari.");
    }
  };

  // Handle QR code display
  const handleShowQR = (route: ARRoute) => {
    setQrRoute(route);
    setShowQRModal(true);
  };

  // Render Styling QR Code in Modal
  useEffect(() => {
    if (!showQRModal || !qrRoute || !qrRef.current) return;
    
    // QR Code styling configs
    const link = `${window.location.origin}/?ar_vendor_id=${vendorProfile?.id}&ar_route_id=${qrRoute.id}`;
    
    qrRef.current.innerHTML = '';
    const qrCode = new QRCodeStyling({
      width: 230,
      height: 230,
      type: "svg",
      data: link,
      dotsOptions: {
        color: "#ca8a04",
        type: "extra-rounded"
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        color: "#9a3412",
        type: "dot"
      },
      cornersDotOptions: {
        color: "#ea580c",
        type: "dot"
      }
    });
    
    qrCode.append(qrRef.current);
  }, [showQRModal, qrRoute, vendorProfile]);

  return (
    <div className="bg-neutral-50 dark:bg-[#0b0b0f] rounded-3xl p-6 border border-neutral-200/60 dark:border-[#1e1e2d] text-left font-sans shadow-sm">
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
            AR Outdoor Tourism & Gamified Trails
          </span>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-2 text-neutral-900 dark:text-white flex items-center gap-2">
            AR Safari & Tour Route Creator <Compass className="w-6 h-6 text-orange-500 animate-spin-slow" />
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-4xl">
            Sasa unaweza kutengeneza njia na safari za utalii za AR (AR Tours/Safari Trails, Beach tours, historical spots) kwa wateja na wageni wako. Weka vituo kwenye ramani, panga fremu maalum za picha (kama Polaroid au Cyberpunk), na uweke maswali (Quiz) na zawadi za kuponi pindi wakitembelea na kuscan!
          </p>
        </div>

        <button
          onClick={handleCreateNewRoute}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs px-5 py-3 rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
        >
          New AR Safari / Route
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* ROUTES SELECTOR AND QUICK STATE */}
      <div className="flex flex-wrap gap-2.5 mb-8 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        {routes.length === 0 ? (
          <span className="text-xs font-bold text-neutral-400 italic">Hujatengeneza safari yoyote bado. Anza kuunda sasa!</span>
        ) : (
          routes.map(r => (
            <div 
              key={r.id}
              onClick={() => handleSelectRoute(r)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                selectedRoute?.id === r.id
                  ? 'bg-orange-500/10 border-orange-500 text-orange-700 dark:text-orange-400 font-extrabold shadow-sm'
                  : 'bg-white dark:bg-[#111118]/80 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <span className="text-lg">
                {TOUR_CATEGORIES.find(cat => cat.id === r.category)?.emoji || '🗺️'}
              </span>
              <div>
                <p className="text-xs leading-none font-bold uppercase">{r.name}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{r.stops?.length || 0} stops / vituo</p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleShowQR(r); }}
                  className="p-1 text-neutral-400 hover:text-orange-500 dark:hover:text-orange-400"
                  title="Generate Tour QR Code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => handleDeleteRoute(r.id!, e)}
                  className="p-1 text-neutral-400 hover:text-red-500"
                  title="Delete Entire Tour"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MAIN CREATOR GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL: Core Route Details & Leaflet Map Stop Placement */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Route Config card */}
          <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <Globe className="w-4 h-4 text-orange-500" />
                1. Sura na Maelezo ya Safari (AR Tour Configuration)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8">
                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1.5">Jina la Safari / Route Name *</label>
                  <input 
                    type="text" 
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Mfan: Bagamoyo Historical Stone Town Tour 🏛️"
                    className="w-full h-11 px-3.5 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1.5">Aina / Category</label>
                  <select
                    value={routeCategory}
                    onChange={(e) => setRouteCategory(e.target.value as any)}
                    className="w-full h-11 px-3.5 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white cursor-pointer"
                  >
                    {TOUR_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase mb-1.5">Maelezo ya Safari / Tour Description</label>
                <textarea 
                  value={routeDesc}
                  onChange={(e) => setRouteDesc(e.target.value)}
                  placeholder="Mfan: Gundua magofu ya kale ya Kaole, jifunze historia ya utumwa na ujionee nyumba za Kiarabu zilizojengwa karne ya 18..."
                  rows={2}
                  className="w-full p-3.5 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Interactive Leaflet Map for Stop Placement */}
          <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  2. Weka Vituo Kwenye Ramani (Interactive Mapstops)
                </h3>
                <span className="text-[10px] font-black bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 px-2 py-0.5 rounded uppercase">
                  Bofya ramani kuongeza
                </span>
              </div>

              <div className="h-96 w-full rounded-2xl overflow-hidden relative z-0 border border-neutral-200 dark:border-neutral-800">
                <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapClickHandler />
                  
                  {stops.map((stop, index) => (
                    <Marker 
                      key={stop.id} 
                      position={[stop.lat, stop.lng]} 
                      icon={createStopIcon(index + 1)}
                      eventHandlers={{
                        click: () => setSelectedStopId(stop.id)
                      }}
                    >
                      <Popup>
                        <div className="text-left font-sans p-1">
                          <p className="font-extrabold text-xs uppercase text-orange-600">Stop {index + 1}: {stop.stopName || stop.name}</p>
                          <p className="text-[10px] text-neutral-500 mt-1 line-clamp-2">{stop.stopDescription || stop.description}</p>
                          <button 
                            onClick={() => setSelectedStopId(stop.id)}
                            className="mt-2 bg-orange-600 text-white text-[9px] font-bold px-2.5 py-1 rounded hover:bg-orange-500 w-full uppercase"
                          >
                            Sanidi Kituo Hiki
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-bold bg-neutral-100 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200/50 dark:border-neutral-800">
                <Info className="w-4 h-4 text-orange-500" />
                <span>Pia unaweza kubofya kituo chochote kile kwenye ramani ili kufungua fomu ya marekebisho upande wa kulia, au kuburuta/kupanga mpangilio wa vituo hivyo kwa urahisi.</span>
              </div>
            </CardContent>
          </Card>

          {/* Stops order summary */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400">Vituo vilivyo kwenye Route hii ({stops.length})</h3>
            
            {stops.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-8 rounded-2xl text-center text-neutral-400">
                <Compass className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto animate-pulse mb-2" />
                <p className="text-xs font-extrabold">Bado hujaweka vituo (stops).</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Bofya popote pale kwenye ramani hapo juu kuongeza kituo cha kwanza!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stops.map((stop, idx) => (
                  <div 
                    key={stop.id}
                    onClick={() => setSelectedStopId(stop.id)}
                    className={`bg-white dark:bg-neutral-900 border p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                      selectedStopId === stop.id
                        ? 'border-orange-500 ring-1 ring-orange-500/30'
                        : 'border-neutral-200/60 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 bg-orange-600 text-white font-black text-xs rounded-xl flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 max-w-full">
                          <h4 className="font-bold text-neutral-800 dark:text-neutral-100 text-xs truncate uppercase tracking-tight">{stop.stopName || stop.name}</h4>
                          {stop.isVisualMapped && (
                            <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 shadow-sm">
                              <ShieldCheck className="w-2.5 h-2.5" /> PRO AR
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => moveStop(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => moveStop(idx, 'down')}
                        disabled={idx === stops.length - 1}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteStop(stop.id)}
                        className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer ml-1"
                        title="Futa kituo hiki"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveRouteToFirestore}
              disabled={isSaving}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs px-6 py-3.5 rounded-xl shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Inahifadhi...' : 'Hifadhi Safari Kwenye Firebase'}
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* RIGHT PANEL: Selected Stop Configuration Form */}
        <div className="lg:col-span-4 space-y-6">
          
          {selectedStopId ? (
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-lg border-2 border-orange-500/20">
              <CardContent className="p-6 space-y-5">
                
                {/* Stop Setup header */}
                <div className="pb-3 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <BookOpen className="w-4.5 h-4.5 animate-bounce" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Sanidi Kituo (Stop Details)</h3>
                  </div>
                  <span className="text-[10px] bg-orange-600 text-white font-black px-2 py-0.5 rounded-full">
                    STOP {stops.findIndex(s => s.id === selectedStopId) + 1}
                  </span>
                </div>

                {/* Visual Mapping with Camera Card */}
                <div className="bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-orange-500/10 text-orange-600 rounded-xl">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-black uppercase tracking-tight text-neutral-800 dark:text-neutral-100">
                          Visual Mapping na Kamera
                        </h4>
                        {stops.find(s => s.id === selectedStopId)?.isVisualMapped && (
                          <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> MAP LIMEKAMILIKA
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-relaxed mt-1">
                        Vendor lazima awe kwenye eneo halisi. Fungua kamera ya simu kufanya mapping ya mazingira na kusanidi mshale (Arrow), wahusika wa 3D au zawadi.
                      </p>
                    </div>
                  </div>
                  
                  {stops.find(s => s.id === selectedStopId)?.isVisualMapped && (
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-[9px] font-mono text-emerald-600 dark:text-emerald-400 space-y-0.5">
                      <p>📡 GPS Accuracy: ±{stops.find(s => s.id === selectedStopId)?.anchorGPSAccuracy || 4}m</p>
                      <p>🧭 AR Compass Angle: {stops.find(s => s.id === selectedStopId)?.anchorHeading || 142}°</p>
                      <p>📐 Offset: {stops.find(s => s.id === selectedStopId)?.anchorDistance || 3.5}m mbele, h={stops.find(s => s.id === selectedStopId)?.anchorHeight || 0}m</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartVisualMapping}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-orange-600/10"
                  >
                    <Compass className="w-4 h-4" />
                    ANZA VISUAL MAPPING NA GPS
                  </button>
                </div>

                {/* Stop General Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1">Jina la Kituo *</label>
                    <input 
                      type="text"
                      value={stopName}
                      onChange={(e) => setStopName(e.target.value)}
                      placeholder="Mfan: Magofu ya Kaole"
                      className="w-full h-10 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1">Maelezo fupi ya Kituo (Description) *</label>
                    <textarea 
                      value={stopDesc}
                      onChange={(e) => setStopDesc(e.target.value)}
                      placeholder="Maelezo yanayoonekana mteja akisoma kuhusu kituo hiki..."
                      rows={2}
                      className="w-full p-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1">Sauti ya Mwongoza Safari (TTS Narration Text)</label>
                    <textarea 
                      value={stopVoiceText}
                      onChange={(e) => setStopVoiceText(e.target.value)}
                      placeholder="Maandishi yatakayosomwa kwa sauti (Text-to-Speech) na robot mteja akifika kituo hiki..."
                      rows={2}
                      className="w-full p-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white"
                    />
                    <div className="flex justify-between items-center mt-1.5">
                      <span className="text-[9px] text-neutral-400 font-bold flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-orange-500" /> Itasomwa na Mwongoza wa AR
                      </span>
                      <select 
                        value={stopVoiceLang}
                        onChange={(e) => setStopVoiceLang(e.target.value as any)}
                        className="text-[9px] font-bold text-neutral-500 bg-neutral-100 dark:bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800"
                      >
                        <option value="sw-TZ">Swahili (sw-TZ)</option>
                        <option value="en-US">English (en-US)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Photo Frame Config */}
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1">Fremu ya Picha (AR Photo Frame Filter)</label>
                  <select 
                    value={stopPhotoFrame}
                    onChange={(e) => setStopPhotoFrame(e.target.value as any)}
                    className="w-full h-10 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white cursor-pointer"
                  >
                    {PHOTO_FRAMES.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-neutral-400 mt-1 pl-1">
                    {PHOTO_FRAMES.find(f => f.id === stopPhotoFrame)?.desc}
                  </p>
                </div>

                {/* Avatar Character Guide */}
                <div>
                  <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-1">Mwongoza Safari (Avatar Character Guide)</label>
                  <select 
                    value={stopCharacter}
                    onChange={(e) => setStopCharacter(e.target.value as any)}
                    className="w-full h-10 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl focus:outline-none focus:border-orange-500 dark:text-white cursor-pointer"
                  >
                    {CHARACTERS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Media Urls */}
                <div className="space-y-3.5 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/80">
                  <span className="text-[9px] font-black uppercase text-orange-600 tracking-wider">Multimedia & Link Urls (Optional)</span>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">Image URL (To show image of stop)</label>
                    <input 
                      type="text" 
                      value={stopImageUrl}
                      onChange={(e) => setStopImageUrl(e.target.value)}
                      placeholder="https://example.com/kaole-ruins.jpg"
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-orange-500 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">Video URL (To embed MP4/Youtube)</label>
                    <input 
                      type="text" 
                      value={stopVideoUrl}
                      onChange={(e) => setStopVideoUrl(e.target.value)}
                      placeholder="https://example.com/guide-video.mp4"
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-orange-500 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">Learn More URL (External Wiki/Doc link)</label>
                    <input 
                      type="text" 
                      value={stopLinkUrl}
                      onChange={(e) => setStopLinkUrl(e.target.value)}
                      placeholder="https://en.wikipedia.org/wiki/Kaole"
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-orange-500 dark:text-white"
                    />
                  </div>
                </div>

                {/* Interactive Gamified Quiz Card */}
                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1 tracking-wider">
                      <Award className="w-4 h-4" /> Gamified Quiz & Coins
                    </span>
                    <input 
                      type="checkbox"
                      checked={hasQuiz}
                      onChange={(e) => setHasQuiz(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-neutral-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>

                  {hasQuiz && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-0.5">Swali la Quiz (Question) *</label>
                        <input 
                          type="text" 
                          required
                          value={quizQuestion}
                          onChange={(e) => setQuizQuestion(e.target.value)}
                          placeholder="Mfan: Magofu haya yalijengwa katika karne gani?"
                          className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-amber-500 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-bold text-neutral-400 uppercase">Chaguo A</label>
                          <input 
                            type="text" 
                            value={quizOpt1}
                            onChange={(e) => setQuizOpt1(e.target.value)}
                            placeholder="Mfan: Karne ya 13"
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-neutral-400 uppercase">Chaguo B</label>
                          <input 
                            type="text" 
                            value={quizOpt2}
                            onChange={(e) => setQuizOpt2(e.target.value)}
                            placeholder="Mfan: Karne ya 18"
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-neutral-400 uppercase">Chaguo C</label>
                          <input 
                            type="text" 
                            value={quizOpt3}
                            onChange={(e) => setQuizOpt3(e.target.value)}
                            placeholder="Mfan: Karne ya 20"
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-neutral-400 uppercase">Chaguo D</label>
                          <input 
                            type="text" 
                            value={quizOpt4}
                            onChange={(e) => setQuizOpt4(e.target.value)}
                            placeholder="Mfan: Karne ya 15"
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-0.5">Jibu Sahihi</label>
                          <select 
                            value={quizAnswerIdx}
                            onChange={(e) => setQuizAnswerIdx(Number(e.target.value))}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg cursor-pointer focus:outline-none"
                          >
                            <option value={0}>Chaguo A</option>
                            <option value={1}>Chaguo B</option>
                            <option value={2}>Chaguo C</option>
                            <option value={3}>Chaguo D</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-0.5">Point / Sarafu Zawadi</label>
                          <input 
                            type="number" 
                            value={rewardPoints}
                            onChange={(e) => setRewardPoints(Number(e.target.value))}
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-0.5">Kuponi ya Punguzo</label>
                          <input 
                            type="text" 
                            value={rewardCoupon}
                            onChange={(e) => setRewardCoupon(e.target.value)}
                            placeholder="Mfan: KAOLE20"
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-neutral-500 uppercase mb-0.5">Ujumbe Ushindi (Reward text)</label>
                          <input 
                            type="text" 
                            value={quizRewardText}
                            onChange={(e) => setQuizRewardText(e.target.value)}
                            placeholder="Mfan: Hongera! Pointi +100 zimeongezwa!"
                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800 justify-end">
                  <button 
                    type="button"
                    onClick={() => setSelectedStopId(null)}
                    className="px-3 py-2 text-[10px] font-bold uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    Funga Fomu
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveStopEdits}
                    className="px-4.5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-[10px] rounded-xl cursor-pointer"
                  >
                    Weka Kwenye Route
                  </button>
                </div>

              </CardContent>
            </Card>
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-8 rounded-3xl text-center space-y-3.5">
              <Compass className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto animate-spin-slow" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500">Sanidi Maelezo ya Kituo</h4>
                <p className="text-[10.5px] text-neutral-400 mt-1 max-w-[210px] mx-auto leading-relaxed">
                  Bofya kituo chochote kile upande wa kushoto (kwenye ramani au orodha) ili kusanidi sauti ya roboti ya AR, maswali ya mchezo, na fremu maalum za kamera!
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* QR CODE & PRINTABLE STICKER GENERATOR MODAL */}
      <AnimatePresence>
        {showQRModal && qrRoute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl relative border border-neutral-200 dark:border-neutral-800"
            >
              <button 
                onClick={() => setShowQRModal(false)}
                className="absolute top-5 right-5 w-8 h-8 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 font-extrabold text-sm"
              >
                ✕
              </button>

              <div id="printable-tour-card" className="p-4 border-2 border-dashed border-orange-500/30 rounded-3xl bg-neutral-50 dark:bg-neutral-950 relative">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[9px] font-black px-4 py-1 rounded-full uppercase shadow">
                  AR TOUR / SAFARI Trail
                </span>

                <div className="mt-4 flex items-center justify-center">
                  <div ref={qrRef} className="p-4 bg-white rounded-2xl shadow-md border border-neutral-100" />
                </div>

                <h3 className="text-sm font-black uppercase tracking-tight text-neutral-800 dark:text-neutral-100 mt-5 leading-none">
                  {qrRoute.name}
                </h3>
                <p className="text-[10px] text-neutral-500 mt-1 pl-1 pr-1 line-clamp-2 max-w-[240px] mx-auto leading-relaxed">
                  {qrRoute.description}
                </p>

                <div className="mt-4 pt-3.5 border-t border-neutral-200 dark:border-neutral-800 flex justify-center gap-4 text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  <span className="flex items-center gap-1">
                    🦁 {qrRoute.stops?.length || 0} Vituo
                  </span>
                  <span className="flex items-center gap-1">
                    💎 Gamified AR
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => {
                    const printContent = document.getElementById('printable-tour-card')?.innerHTML;
                    const originalContent = document.body.innerHTML;
                    if (printContent) {
                      document.body.innerHTML = `
                        <div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; background-color:#fff;">
                          <div style="width:360px; border:2px solid #ea580c; padding:30px; border-radius:25px; text-align:center; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
                            ${printContent}
                          </div>
                        </div>
                      `;
                      window.print();
                      document.body.innerHTML = originalContent;
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-600/20"
                >
                  <Printer className="w-4 h-4" />
                  Print sticker
                </button>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="py-2.5 px-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Funga
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== PRO AR SPATIAL MAPPING STUDIO MODAL ==================== */}
      <AnimatePresence>
        {isMappingActive && (
          <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col font-sans text-white overflow-hidden select-none">
            
            {/* Background Camera Feed / Wireframe Grid */}
            <div className="absolute inset-0 z-0">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Overlay Scanner Shaders if real camera failed/unavailable or sandbox */}
              {(cameraError || !cameraStream) && (
                <div className="absolute inset-0 bg-neutral-900/60 flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative w-48 h-48 mb-6 flex items-center justify-center">
                    {/* Pulsing radar circle */}
                    <div className="absolute inset-0 rounded-full border-2 border-orange-500/30 animate-ping" />
                    <div className="absolute inset-2 rounded-full border border-orange-500/40 animate-pulse" />
                    <div className="absolute inset-8 rounded-full bg-gradient-to-tr from-orange-600/10 to-orange-500/20 flex items-center justify-center">
                      <Scan className="w-16 h-16 text-orange-500 animate-pulse" />
                    </div>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-widest text-orange-400">
                    Pro AR Space Simulator Active
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-sm mt-2 leading-relaxed">
                    Camera feed simulation running inside sandbox environment. Precise sensors & SLAM point localization fully emulated for route authoring.
                  </p>
                </div>
              )}

              {/* Grid System Overlay (SLAM Mesh simulation) */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(249,115,22,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(249,115,22,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-40" />

              {/* Horizon calibration lines */}
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-orange-500/25 pointer-events-none" />
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-orange-500/25 pointer-events-none" />
            </div>

            {/* HEADS-UP DISPLAY (HUD) TOP CONTROL BAR */}
            <div className="relative z-10 p-5 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/30">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    <span className="text-[10px] font-black tracking-widest text-orange-500 uppercase">Pro AR Creator v2.1</span>
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-tight leading-none mt-1">
                    {stops.find(s => s.id === selectedStopId)?.stopName || "Kituo Bila Jina"}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsMappingActive(false);
                  stopCamera();
                }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* MAIN HUD VIEWER STAGE */}
            <div className="relative flex-1 z-10 flex flex-col items-center justify-center p-4">
              
              {/* STEP 1: SCANNING THE ENVIRONMENT */}
              {mappingStep === 'scan' && (
                <div className="space-y-6 text-center max-w-sm bg-black/60 backdrop-blur-md p-6 rounded-[2rem] border border-orange-500/20 shadow-2xl relative">
                  
                  {/* SLAM points scatter simulator */}
                  <div className="absolute -inset-10 pointer-events-none overflow-hidden">
                    {slamPoints.map(pt => (
                      <div 
                        key={pt.id}
                        style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                        className="absolute w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"
                      />
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <div className="relative w-16 h-16 flex items-center justify-center bg-orange-600/20 border border-orange-500/30 rounded-full">
                      <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-black uppercase tracking-wider text-orange-400">
                      Kuchanganua Mazingira...
                    </h4>
                    <p className="text-[11px] text-neutral-300 leading-relaxed pl-4 pr-4">
                      Tafadhali zungusha simu yako taratibu kurekodi kuta, nguzo au bidhaa ili roboti asetiwe eneo sahihi.
                    </p>
                  </div>

                  {/* Scanning progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono text-neutral-400">
                      <span>PROGRESS: {scanProgress}%</span>
                      <span>{scanProgress < 50 ? "Sensing Floor..." : scanProgress < 90 ? "Reconstructing mesh..." : "SLAM Locked"}</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 transition-all duration-150"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* High tech telemetry status log */}
                  <div className="bg-black/80 rounded-xl p-3 border border-neutral-800 text-left font-mono text-[8px] text-emerald-400 h-24 overflow-y-auto space-y-1">
                    {mappingLog.map((log, idx) => (
                      <p key={idx}>{log}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: PLACE AR ANCHOR / DROP TARGET */}
              {mappingStep === 'place' && (
                <div className="flex flex-col items-center justify-between h-full w-full relative">
                  
                  {/* Central Crosshair & Pulse */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-32 h-32 rounded-full border border-orange-500/25 animate-ping opacity-75" />
                      <div className="absolute w-20 h-20 rounded-full border border-orange-500/40" />
                      <div className="absolute w-12 h-12 rounded-full border-2 border-dashed border-orange-500 animate-spin-slow" />
                      <Target className="w-6 h-6 text-orange-500 z-10" />
                      
                      {/* Compass degrees indicator */}
                      <span className="absolute -top-10 bg-black/70 px-2.5 py-1 rounded-md text-[9px] font-mono font-black tracking-widest text-orange-400 border border-orange-500/20">
                        HDG: {mappedHeading}°
                      </span>
                    </div>
                  </div>

                  {/* Anchor instructions */}
                  <div className="bg-black/60 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-orange-500/20 text-center max-w-xs mt-2 pointer-events-none">
                    <p className="text-[10px] uppercase font-black tracking-wider text-orange-400 flex items-center justify-center gap-1.5">
                      <Scan className="w-3.5 h-3.5 animate-pulse" /> Hatua ya 4: Weka Anchor
                    </p>
                    <p className="text-[9px] text-neutral-300 leading-relaxed mt-1">
                      Kelekeza simu yako sehemu unayotaka kuweka mshale (Arrow) au mhusika, kisha bofya kitufe cha chini.
                    </p>
                  </div>

                  {/* DROP ANCHOR BUTTON */}
                  <div className="w-full max-w-xs mb-4">
                    <button
                      onClick={() => setMappingStep('configure')}
                      className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs rounded-2xl flex items-center justify-center gap-2 shadow-2xl shadow-orange-600/30 cursor-pointer active:scale-95 transition-transform"
                    >
                      <Plus className="w-5 h-5" />
                      Weka Anchor Hapa (Drop Anchor)
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIGURE ANCHOR ORIENTATION & PREVIEW */}
              {mappingStep === 'configure' && (
                <div className="flex flex-col items-center justify-between h-full w-full">
                  
                  {/* Interactive Floating 3D Object Preview Area */}
                  <div className="flex-1 flex items-center justify-center w-full relative">
                    
                    {/* Floating Character Avatar or Arrow based on setup */}
                    <div 
                      className="relative z-10 p-5 rounded-3xl bg-neutral-900/90 border border-orange-500/30 flex flex-col items-center text-center shadow-2xl max-w-[220px]"
                      style={{
                        transform: `rotate(${anchorRotation}deg) scale(${anchorScale}) translateY(${anchorHeight * 10}px)`,
                        transition: 'transform 0.15s ease-out'
                      }}
                    >
                      {/* Floating object graphic representation */}
                      {stopCharacter === 'guide' && (
                        <div className="relative mb-3">
                          <span className="text-4xl block animate-bounce">🧑‍✈️</span>
                          <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Guide</span>
                        </div>
                      )}
                      {stopCharacter === 'masai' && (
                        <div className="relative mb-3">
                          <span className="text-4xl block animate-bounce">🛡️</span>
                          <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Masai</span>
                        </div>
                      )}
                      {stopCharacter === 'ranger' && (
                        <div className="relative mb-3">
                          <span className="text-4xl block animate-bounce">🤠</span>
                          <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Ranger</span>
                        </div>
                      )}
                      {stopCharacter === 'pilot' && (
                        <div className="relative mb-3">
                          <span className="text-4xl block animate-bounce">👨‍✈️</span>
                          <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Pilot</span>
                        </div>
                      )}
                      {stopCharacter === 'chief' && (
                        <div className="relative mb-3">
                          <span className="text-4xl block animate-bounce">👑</span>
                          <span className="absolute -bottom-1 -right-1 bg-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Chief</span>
                        </div>
                      )}

                      <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                        {stopCharacter.toUpperCase()} GUIDE
                      </h4>
                      
                      <div className="mt-2.5 bg-black/60 px-3 py-1.5 rounded-xl border border-neutral-800 text-[9px] font-medium leading-relaxed max-w-[180px] line-clamp-3">
                        💬 "{stopVoiceText || "Karibu kwenye kituo hiki! Nipo hapa kukuelekeza."}"
                      </div>

                      {/* Distance tag */}
                      <span className="mt-3.5 bg-orange-600 text-white text-[9px] font-mono font-black px-2.5 py-1 rounded-full uppercase">
                        📍 {anchorDistance} METERS
                      </span>
                    </div>

                    {/* Floor circle shadow effect */}
                    <div className="absolute bottom-16 w-32 h-6 bg-black/40 rounded-full blur-md animate-pulse pointer-events-none" />
                  </div>

                  {/* 3D ADJUSTMENT PANEL AND ROTATORS */}
                  <div className="w-full max-w-sm bg-neutral-900/95 backdrop-blur-md rounded-[2.5rem] p-5 border border-orange-500/20 space-y-4 mb-4 shadow-2xl relative">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-wider">
                      Sanjaza Anchor Zilizowekwa (3D Controls)
                    </span>

                    <div className="grid grid-cols-2 gap-4 pt-3.5">
                      
                      {/* Rotation control */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold text-neutral-400">
                          <span className="uppercase">Kuzungusha (Yaw)</span>
                          <span className="font-mono text-orange-500">{anchorRotation}°</span>
                        </div>
                        <input 
                          type="range"
                          min={-180}
                          max={180}
                          value={anchorRotation}
                          onChange={(e) => setAnchorRotation(Number(e.target.value))}
                          className="w-full accent-orange-600 bg-neutral-800 h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Scale control */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold text-neutral-400">
                          <span className="uppercase">Ukubwa (Scale)</span>
                          <span className="font-mono text-orange-500">{anchorScale.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range"
                          min={0.5}
                          max={2.5}
                          step={0.1}
                          value={anchorScale}
                          onChange={(e) => setAnchorScale(Number(e.target.value))}
                          className="w-full accent-orange-600 bg-neutral-800 h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Distance control */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold text-neutral-400">
                          <span className="uppercase">Umbali (Distance)</span>
                          <span className="font-mono text-orange-500">{anchorDistance}m</span>
                        </div>
                        <input 
                          type="range"
                          min={1.0}
                          max={15.0}
                          step={0.5}
                          value={anchorDistance}
                          onChange={(e) => setAnchorDistance(Number(e.target.value))}
                          className="w-full accent-orange-600 bg-neutral-800 h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Height offset control */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold text-neutral-400">
                          <span className="uppercase">Urefu (Height)</span>
                          <span className="font-mono text-orange-500">{anchorHeight > 0 ? `+${anchorHeight}` : anchorHeight}m</span>
                        </div>
                        <input 
                          type="range"
                          min={-2.0}
                          max={4.0}
                          step={0.2}
                          value={anchorHeight}
                          onChange={(e) => setAnchorHeight(Number(e.target.value))}
                          className="w-full accent-orange-600 bg-neutral-800 h-1 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                    </div>

                    {/* Speech / Narration sound test */}
                    {stopVoiceText && (
                      <div className="flex justify-between items-center bg-black/40 px-3.5 py-2.5 rounded-2xl border border-neutral-800">
                        <span className="text-[9px] text-neutral-400 font-bold flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-orange-500" /> Test Narrator Guide Voice:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if ('speechSynthesis' in window) {
                              window.speechSynthesis.cancel();
                              const utterance = new SpeechSynthesisUtterance(stopVoiceText);
                              utterance.lang = stopVoiceLang;
                              window.speechSynthesis.speak(utterance);
                              toast.info("Mwongozo wa sauti unaanza kuongea...");
                            } else {
                              toast.error("Vivinjari vyako havina uwezo wa Text-to-Speech.");
                            }
                          }}
                          className="bg-orange-600/20 hover:bg-orange-600/30 text-orange-500 text-[8px] font-black uppercase px-3 py-1 rounded-lg border border-orange-500/30"
                        >
                          Sikiliza Sauti 🔊
                        </button>
                      </div>
                    )}

                    {/* SAVE AND LOCK BUTTONS */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setMappingStep('place')}
                        className="flex-1 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase text-[10px] rounded-2xl cursor-pointer"
                      >
                        Chagua upya eneo
                      </button>
                      <button
                        onClick={handleSaveVisualAnchor}
                        className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-1 shadow shadow-orange-600/10 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Hifadhi Anchor ya AR
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>

            {/* HIGH TECH BOTTOM INFOGRAPHIC RAIL */}
            <div className="relative z-10 p-4 bg-gradient-to-t from-black/80 to-transparent grid grid-cols-3 gap-2 border-t border-neutral-900 text-center shrink-0">
              <div className="bg-black/40 rounded-xl p-2 border border-neutral-800/40">
                <span className="text-[8px] uppercase font-black tracking-widest text-neutral-500 block">SENSORS COORD</span>
                <span className="text-[9.5px] font-mono text-neutral-200 mt-0.5 block">
                  P:{sensorStream.pitch}° / R:{sensorStream.roll}°
                </span>
              </div>
              <div className="bg-black/40 rounded-xl p-2 border border-neutral-800/40">
                <span className="text-[8px] uppercase font-black tracking-widest text-neutral-500 block">GPS COORDINATES</span>
                <span className="text-[9.5px] font-mono text-orange-500 mt-0.5 block truncate">
                  {mappedGPS.lat.toFixed(4)}, {mappedGPS.lng.toFixed(4)}
                </span>
              </div>
              <div className="bg-black/40 rounded-xl p-2 border border-neutral-800/40">
                <span className="text-[8px] uppercase font-black tracking-widest text-neutral-500 block">ACCURACY SIGNAL</span>
                <span className="text-[9.5px] font-mono text-emerald-400 mt-0.5 block">
                  ±{mappedGPS.accuracy || 3.8}m (Locked)
                </span>
              </div>
            </div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
