import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QRCodeStyling from 'qr-code-styling';
import { 
  MapPin, Compass, QrCode, Save, Sparkles, Trash2, Plus, ArrowRight, Play, 
  Volume2, Gift, HelpCircle, Award, Printer, Download, Eye, Layers, Route,
  Gamepad2, Compass as CompassIcon, Sparkles as SparklesIcon, Check, X, Edit, RotateCcw,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Leaflet default marker icons
const StopIcon = (index: number) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 text-white font-black text-sm border-2 border-white shadow-lg animate-bounce">${index}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

const CurrentIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

// Characters / AR Models list
const CHARACTERS_LIST = [
  { id: 'lion', name: 'Simba wa 3D 🦁', icon: '🦁', desc: 'Sauti ya simba na maelezo ya kitalii' },
  { id: 'castle', name: 'Jengo la Kale 🏰', icon: '🏰', desc: 'Jengo la kihistoria na maelezo ya kale' },
  { id: 'guide', name: 'Guide wa Katuni 🤖', icon: '🤖', desc: 'Kiongozi anayesema na kuelekeza wageni' },
  { id: 'treasure', name: 'Sanduku la Hazina 🎁', icon: '🎁', desc: 'Sanduku la kufungua kupata zawadi' },
  { id: 'coin', name: 'Sarafu ya Dhahabu 🪙', icon: '🪙', desc: 'Sarafu ya kukusanya ili kupata pointi' },
  { id: 'dragon', name: 'Joka la Ndoto 🐉', icon: '🐉', desc: 'Joka linaloruka na kuleta changamoto ya mchezo' },
  { id: 'bread', name: 'Mkate mtamu 🍞', icon: '🍞', desc: 'Chakula cha mfano kwa maduka ya retail' },
  { id: 'soda', name: 'Kinywaji baridi 🥤', icon: '🥤', desc: 'Kinywaji cha kuvutia wateja sokoni' },
  { id: 'tv', name: 'TV/Televisheni 📺', icon: '📺', desc: 'Vifaa vya kielektroniki' },
  { id: 'teacher', name: 'Mwalimu msomi 👩‍🏫', icon: '👩‍🏫', desc: 'Mwalimu anayetoa maswali ya elimu' },
  { id: 'fireworks', name: 'Fataki za Sherehe 🎉', icon: '🎉', desc: 'Fataki za kusherehekea mwisho wa safari' },
];

const TOUR_CATEGORIES = [
  { id: 'tourism', name: 'Utalii & Historia 🌍', desc: 'Kuongoza watalii Stone Town au maeneo ya kihistoria' },
  { id: 'retail', name: 'Supermarket & Retail 🛒', desc: 'Wayfinding ya bidhaa duka la TV, mikate, soda nk.' },
  { id: 'education', name: 'Makumbusho & Shule 🏛️', desc: 'Tour za kimasomo na makumbusho ya taifa' },
  { id: 'game', name: 'Mchezo & Treasure Hunt 🎯', desc: 'Kutafuta sarafu, kujibu maswali na kupata zawadi' },
];

interface Stop {
  stop: number;
  name: string;
  lat: number;
  lng: number;
  character: string;
  voiceText: string;
  animation: string;
  sound: string;
  rewardPoints: number;
  rewardCoupon: string;
  photoFrame?: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  quiz?: {
    question: string;
    options: string[];
    answer: number;
  };
}

interface ArRouteData {
  id?: string;
  vendorId: string;
  name: string;
  description: string;
  category: string;
  stops: Stop[];
  createdAt?: any;
}

interface ARTourCreatorProps {
  vendorProfile: any;
}

export default function ARTourCreator({ vendorProfile }: ARTourCreatorProps) {
  const [routes, setRoutes] = useState<ArRouteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [editingRoute, setEditingRoute] = useState<ArRouteData | null>(null);

  // Form states
  const [routeName, setRouteName] = useState('');
  const [routeDesc, setRouteDesc] = useState('');
  const [routeCategory, setRouteCategory] = useState('tourism');
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStopIdx, setSelectedStopIdx] = useState<number | null>(null);

  // Live Mapping States for Vendors on-site
  const [showLiveMapper, setShowLiveMapper] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingLiveLocation, setIsCapturingLiveLocation] = useState(false);
  const [mapperStream, setMapperStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  // Map states
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.7924, 39.2083]);

  // Start Camera for Live Mapping Setup
  const startLiveMapping = async () => {
    setShowLiveMapper(true);
    setIsCapturingLiveLocation(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setMapperStream(stream);
      
      // Grab accurate coordinates
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLiveLocation({ lat, lng });
            setIsCapturingLiveLocation(false);
            // Auto update selected stop coordinates
            if (selectedStopIdx !== null) {
              const updated = [...stops];
              updated[selectedStopIdx] = {
                ...updated[selectedStopIdx],
                lat,
                lng
              };
              setStops(updated);
              setMapCenter([lat, lng]);
              toast.success("📍 GPS imesasishwa kiotomatiki kwa kutumia eneo lako halisi!");
            }
          },
          (err) => {
            console.error("GPS capture error:", err);
            setIsCapturingLiveLocation(false);
            toast.error("Imeshindwa kupata GPS halisi ya simu.");
          },
          { enableHighAccuracy: true, timeout: 12000 }
        );
      }
    } catch (err) {
      console.error("Camera access error inside Live Mapping:", err);
      setIsCapturingLiveLocation(false);
      toast.error("Hali ya Visual Mapping inahitaji kamera ya simu kufanya mapping.");
    }
  };

  // Close Live Mapping
  const stopLiveMapping = () => {
    if (mapperStream) {
      mapperStream.getTracks().forEach(track => track.stop());
    }
    setMapperStream(null);
    setShowLiveMapper(false);
  };

  // Bind stream once liveVideoRef exists
  useEffect(() => {
    if (liveVideoRef.current && mapperStream) {
      liveVideoRef.current.srcObject = mapperStream;
      liveVideoRef.current.play().catch(err => {
        console.warn("Failed auto-play for liveVideoRef:", err);
      });
    }
  }, [mapperStream, showLiveMapper]);

  // QR state for printed stand
  const [selectedRouteForQR, setSelectedRouteForQR] = useState<ArRouteData | null>(null);
  const qrPreviewRef = useRef<HTMLDivElement>(null);
  const [qrInstance, setQrInstance] = useState<QRCodeStyling | null>(null);

  // Load user location for map defaults
  useEffect(() => {
    if (vendorProfile?.location?.lat && vendorProfile?.location?.lng) {
      setMapCenter([vendorProfile.location.lat, vendorProfile.location.lng]);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  }, [vendorProfile]);

  // Fetch routes from Firestore
  const fetchRoutes = async () => {
    if (!vendorProfile?.id) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'ar_routes'), 
        where('vendorId', '==', vendorProfile.id)
      );
      const snapshot = await getDocs(q);
      const fetched: ArRouteData[] = [];
      snapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as ArRouteData);
      });
      setRoutes(fetched);
    } catch (err) {
      console.error("Error fetching AR routes:", err);
      toast.error("Imeshindwa kupakia njia za AR.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [vendorProfile?.id]);

  // Handle route creation initialization
  const startNewRoute = () => {
    setEditingRoute(null);
    setRouteName('');
    setRouteDesc('');
    setRouteCategory('tourism');
    setStops([
      {
        stop: 1,
        name: 'Stop 1: Karibu Stone Town',
        lat: mapCenter[0],
        lng: mapCenter[1],
        character: 'guide',
        voiceText: 'Karibu katika Stone Town! Nifuate mimi nikuonyeshe vivutio vya kihistoria vya eneo hili.',
        animation: 'wave',
        sound: 'welcome',
        rewardPoints: 50,
        rewardCoupon: ''
      }
    ]);
    setSelectedStopIdx(0);
    setActiveTab('create');
  };

  // Handle route edit initialization
  const startEditRoute = (route: ArRouteData) => {
    setEditingRoute(route);
    setRouteName(route.name);
    setRouteDesc(route.description);
    setRouteCategory(route.category);
    setStops([...route.stops]);
    setSelectedStopIdx(0);
    if (route.stops.length > 0) {
      setMapCenter([route.stops[0].lat, route.stops[0].lng]);
    }
    setActiveTab('create');
  };

  // Add stop to current list
  const addNewStop = () => {
    const nextStopNum = stops.length + 1;
    // Offset slightly from the last stop coordinates so it is distinct
    const lastStop = stops[stops.length - 1];
    const offsetLat = lastStop ? lastStop.lat + 0.0003 : mapCenter[0];
    const offsetLng = lastStop ? lastStop.lng + 0.0003 : mapCenter[1];

    const newStop: Stop = {
      stop: nextStopNum,
      name: `Stop ${nextStopNum}: Vivutio Zaidi`,
      lat: offsetLat,
      lng: offsetLng,
      character: 'lion',
      voiceText: `Hapa ni Stop ${nextStopNum}! Tazama kitu gani kizuri kiko mbele yako.`,
      animation: 'roar',
      sound: 'roar',
      rewardPoints: 100,
      rewardCoupon: ''
    };

    setStops([...stops, newStop]);
    setSelectedStopIdx(stops.length);
    toast.success(`Kituo cha ${nextStopNum} kimeongezwa! Bonyeza kwenye ramani kurekebisha eneo lake.`);
  };

  // Delete specific stop
  const removeStop = (idx: number) => {
    if (stops.length <= 1) {
      toast.error("Njia ya AR lazima iwe na angalau kituo kimoja (1 stop)!");
      return;
    }
    const filtered = stops.filter((_, i) => i !== idx).map((s, i) => ({
      ...s,
      stop: i + 1,
      name: s.name.startsWith('Stop ') ? `Stop ${i + 1}:${s.name.substring(s.name.indexOf(':'))}` : s.name
    }));
    setStops(filtered);
    setSelectedStopIdx(0);
    toast.success("Kituo kimefutwa.");
  };

  // Map click handler to update current selected stop coordinates
  function MapEvents() {
    useMapEvents({
      click(e) {
        if (selectedStopIdx !== null && stops[selectedStopIdx]) {
          const updated = [...stops];
          updated[selectedStopIdx] = {
            ...updated[selectedStopIdx],
            lat: e.latlng.lat,
            lng: e.latlng.lng
          };
          setStops(updated);
          toast.success(`Kigingi cha Kituo cha ${selectedStopIdx + 1} kimehamishiwa hapa!`);
        }
      }
    });
    return null;
  }

  // Handle saving the route to Firestore
  const handleSaveRoute = async () => {
    if (!routeName.trim()) {
      toast.error("Tafadhali weka Jina la Njia!");
      return;
    }
    if (stops.length === 0) {
      toast.error("Tafadhali ongeza angalau kituo kimoja kwenye Njia!");
      return;
    }

    setIsSaving(true);
    try {
      const routeData: ArRouteData = {
        vendorId: vendorProfile.id,
        name: routeName,
        description: routeDesc,
        category: routeCategory,
        stops: stops
      };

      if (editingRoute?.id) {
        // Update existing route
        await updateDoc(doc(db, 'ar_routes', editingRoute.id), { ...routeData });
        toast.success("Njia ya AR imesasishwa kikamilifu! 🎉");
      } else {
        // Create new route
        await addDoc(collection(db, 'ar_routes'), {
          ...routeData,
          createdAt: new Date().toISOString()
        });
        toast.success("Njia mpya ya AR imeundwa kikamilifu! 🎉");
      }

      fetchRoutes();
      setActiveTab('list');
    } catch (err) {
      console.error("Error saving AR route:", err);
      toast.error("Imeshindwa kuhifadhi Njia ya AR.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting route
  const handleDeleteRoute = async (id: string) => {
    if (!window.confirm("Je, una uhakika unataka kufuta Njia hii ya AR pamoja na vituo vyake vyote?")) return;
    try {
      await deleteDoc(doc(db, 'ar_routes', id));
      toast.success("Njia ya AR imefutwa kikamilifu.");
      fetchRoutes();
    } catch (err) {
      console.error("Error deleting route:", err);
      toast.error("Imeshindwa kufuta Njia ya AR.");
    }
  };

  // Text-to-speech test narration using native Web Speech API
  const testSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Attempt to find a beautiful Swahili or English voice
      const voices = window.speechSynthesis.getVoices();
      const swVoice = voices.find(v => v.lang.startsWith('sw'));
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      
      if (swVoice) {
        utterance.voice = swVoice;
      } else if (enVoice) {
        utterance.voice = enVoice;
      }
      
      utterance.rate = 0.95; // Slightly slower for clear narration
      window.speechSynthesis.speak(utterance);
      toast.success("🎙 Sauti inasomeka live...", {
        icon: '🔊'
      });
    } else {
      toast.error("Kivinjari chako hakiauni sauti ya Text-to-Speech.");
    }
  };

  // Polyline coordinates for connecting dots
  const polylinePositions = useMemo(() => {
    return stops.map(s => [s.lat, s.lng] as [number, number]);
  }, [stops]);

  // Handle single stop details update
  const updateCurrentStopField = (field: keyof Stop, value: any) => {
    if (selectedStopIdx === null) return;
    const updated = [...stops];
    updated[selectedStopIdx] = {
      ...updated[selectedStopIdx],
      [field]: value
    };
    setStops(updated);
  };

  // Quiz details update helper
  const updateCurrentStopQuiz = (field: string, value: any) => {
    if (selectedStopIdx === null) return;
    const currentStop = stops[selectedStopIdx];
    const currentQuiz = currentStop.quiz || { question: '', options: ['', '', '', ''], answer: 0 };
    
    let updatedQuiz = { ...currentQuiz };
    if (field === 'question') {
      updatedQuiz.question = value;
    } else if (field.startsWith('option_')) {
      const optIdx = parseInt(field.split('_')[1]);
      const newOpts = [...updatedQuiz.options];
      newOpts[optIdx] = value;
      updatedQuiz.options = newOpts;
    } else if (field === 'answer') {
      updatedQuiz.answer = value;
    }

    updateCurrentStopField('quiz', updatedQuiz);
  };

  // Toggle quiz on/off
  const toggleQuiz = (enabled: boolean) => {
    if (selectedStopIdx === null) return;
    if (enabled) {
      updateCurrentStopField('quiz', {
        question: 'Swali la kihistoria: Ni nani aliyetawala eneo hili katika karne ya 19?',
        options: ['Sultan wa Oman', 'Wajerumani', 'Waingereza', 'Wareno'],
        answer: 0
      });
    } else {
      updateCurrentStopField('quiz', undefined);
    }
  };

  // Render QR Code in print preview when selecting a route
  useEffect(() => {
    if (typeof window === 'undefined' || !qrPreviewRef.current || !selectedRouteForQR) return;
    try {
      qrPreviewRef.current.innerHTML = '';
      
      const routeUrl = `${window.location.origin}/?ar_route_id=${selectedRouteForQR.id}`;
      
      const qr = new QRCodeStyling({
        width: 240,
        height: 240,
        type: 'svg',
        data: routeUrl,
        dotsOptions: {
          color: '#ea580c', // Bright orange
          type: 'extra-rounded'
        },
        backgroundOptions: {
          color: '#ffffff'
        },
        cornersSquareOptions: {
          color: '#ea580c',
          type: 'extra-rounded'
        },
        cornersDotOptions: {
          color: '#0f172a',
          type: 'dot'
        },
        margin: 4
      });

      qr.append(qrPreviewRef.current);
      setQrInstance(qr);
    } catch (err) {
      console.error("Error styling Route QR Code:", err);
    }
  }, [selectedRouteForQR]);

  // Handle Print Stand for specific Route
  const printRouteQRStand = (route: ArRouteData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const arColor = '#ea580c';
    const categoryName = TOUR_CATEGORIES.find(c => c.id === route.category)?.name || 'AR Route Navigation';

    printWindow.document.write(`
      <html>
        <head>
          <title>AR Tour QR Stand - ${route.name}</title>
          <style>
            @page {
              size: auto;
              margin: 10mm;
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              text-align: center;
              padding: 10px;
              margin: 0;
              color: #0f172a;
              background-color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container {
              max-width: 440px;
              width: 100%;
              margin: auto;
              background: white;
              padding: 35px 25px;
              border-radius: 30px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.03);
              border: 4px solid ${arColor};
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .header-badge {
              display: inline-block;
              background-color: ${arColor}15;
              color: ${arColor};
              padding: 8px 18px;
              border-radius: 30px;
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 26px;
              font-weight: 900;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: -1px;
              word-wrap: break-word;
            }
            .category-text {
              font-size: 12px;
              font-weight: 700;
              color: #059669;
              text-transform: uppercase;
              margin-bottom: 12px;
              letter-spacing: 1px;
            }
            p.sub {
              font-size: 13px;
              color: #64748b;
              margin: 0 0 30px 0;
              font-weight: 500;
              line-height: 1.5;
            }
            .qr-holder {
              display: inline-block;
              background: white;
              padding: 15px;
              border-radius: 24px;
              border: 2px solid #f1f5f9;
              box-shadow: 0 10px 20px rgba(0,0,0,0.01);
              margin-bottom: 30px;
            }
            .qr-holder svg {
              display: block;
              max-width: 100%;
              height: auto;
            }
            .stats-row {
              display: flex;
              justify-content: space-around;
              margin-bottom: 25px;
              background-color: #f8fafc;
              padding: 10px;
              border-radius: 16px;
            }
            .stat {
              text-align: center;
            }
            .stat-val {
              font-size: 16px;
              font-weight: 900;
              color: #0f172a;
            }
            .stat-lbl {
              font-size: 10px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
            .footer-banner {
              background-color: #0f172a;
              color: white;
              padding: 15px;
              border-radius: 16px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            @media print {
              html, body {
                height: 99%;
                overflow: hidden !important;
              }
              body {
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                border-radius: 24px;
                box-shadow: none !important;
                border: 4px solid ${arColor} !important;
                margin: auto !important;
                max-height: 95vh;
                padding: 20px 15px !important;
                max-width: 350px !important;
              }
              p.sub {
                margin-bottom: 15px !important;
                font-size: 11px !important;
              }
              .qr-holder {
                margin-bottom: 15px !important;
                padding: 10px !important;
              }
              .qr-holder svg {
                width: 140px !important;
                height: 140px !important;
              }
              h1 {
                font-size: 20px !important;
              }
              .header-badge {
                margin-bottom: 10px !important;
                padding: 4px 12px !important;
              }
              .stats-row {
                margin-bottom: 15px !important;
                padding: 6px !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-badge">AR Wayfinding & Treasure Hunt</div>
            <h1>${route.name}</h1>
            <div class="category-text">${categoryName}</div>
            <p class="sub">${route.description || 'Scan kuanza safari yako ya Augmented Reality inayokuongoza hatua kwa hatua kupitia vituo mbalimbali, kupata zawadi na kukamilisha changamoto.'}</p>
            
            <div class="stats-row">
              <div class="stat">
                <div class="stat-val">${route.stops.length}</div>
                <div class="stat-lbl">Vituo (Stops)</div>
              </div>
              <div class="stat">
                <div class="stat-val">${route.stops.reduce((acc, s) => acc + (s.rewardPoints || 0), 0)} pts</div>
                <div class="stat-lbl">Points Reward</div>
              </div>
            </div>

            <div class="qr-holder" id="print-qr"></div>
            <div class="footer-banner">PAPO HAPO SUPER APP NAVIGATOR</div>
          </div>
          <script>
            // Generate QR Code dynamically
            const routeUrl = "${window.location.origin}/?ar_route_id=${route.id}";
            // Create a small script representation to fetch QR or clone from opener
            // Since we can styling it, we'll draw it on the fly using the open-source library
            const parentSvg = window.opener.document.querySelector("#qr-route-print svg").cloneNode(true);
            parentSvg.setAttribute("width", "250");
            parentSvg.setAttribute("height", "250");
            document.getElementById("print-qr").appendChild(parentSvg);
            
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 text-left font-sans">
      
      {/* Header and statistics overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-orange-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 animate-pulse" />
            <span className="text-[10px] uppercase font-black tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/10">Vendor Feature</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none">AR Treasure Hunt & Tours</h2>
          <p className="text-xs text-orange-100 max-w-xl font-medium leading-relaxed">
            Panua uwezo wa ramani yako! Unda safari za Augmented Reality, andaa Njia (Routes) za kitalii, wayfinding dukani na michezo ya kusaka zawadi ukiwa kwenye eneo halisi.
          </p>
        </div>
        <div className="flex shrink-0 relative z-10">
          {activeTab === 'list' ? (
            <Button 
              onClick={startNewRoute}
              className="bg-white hover:bg-orange-50 text-orange-600 hover:text-orange-700 font-black h-14 rounded-2xl px-6 uppercase tracking-wider text-xs gap-2 shadow-lg shadow-black/10 shrink-0"
            >
              <Plus className="w-5 h-5" />
              Unda Njia Mpya ya AR
            </Button>
          ) : (
            <Button 
              onClick={() => setActiveTab('list')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 font-black h-14 rounded-2xl px-6 uppercase tracking-wider text-xs gap-2 shrink-0"
            >
              <ArrowRight className="w-5 h-5 rotate-180" />
              Rudi Kwenye Orodha
            </Button>
          )}
        </div>
        {/* Decorative ambient background blobs */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-orange-500 blur-3xl opacity-50" />
        <div className="absolute -left-10 -top-10 w-44 h-44 rounded-full bg-orange-700 blur-3xl opacity-50" />
      </div>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* List of AR Routes */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Orodha ya Njia za AR</h3>
                  <p className="text-xs text-neutral-500 mt-1">Unda, hariri au futa safari za AR unazotoa kwa wateja wako.</p>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-xs text-neutral-500 font-black uppercase tracking-wider">Inapakia Njia...</span>
                  </div>
                ) : routes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 bg-neutral-50/50 dark:bg-neutral-950/20">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-[2rem] flex items-center justify-center text-orange-600">
                      <Route className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white">Hakuna Njia za AR Bado</h4>
                      <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                        Hujatengeneza safari au tour yoyote ya AR bado. Anza kwa kubonyeza kitufe hapo juu kuandika historia, safari za utalii au wayfinding.
                      </p>
                    </div>
                    <Button 
                      onClick={startNewRoute}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-black h-12 rounded-xl text-xs uppercase tracking-wider px-5"
                    >
                      Anza Sasa
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {routes.map(route => {
                      const catInfo = TOUR_CATEGORIES.find(c => c.id === route.category);
                      const totalPoints = route.stops.reduce((sum, s) => sum + (s.rewardPoints || 0), 0);
                      const isSelected = selectedRouteForQR?.id === route.id;
                      
                      return (
                        <div 
                          key={route.id}
                          className={`p-6 rounded-[2rem] border transition-all duration-300 flex flex-col justify-between gap-4 ${
                            isSelected 
                              ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-500 shadow-lg' 
                              : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                                {catInfo?.name || 'Safari'}
                              </span>
                              <div className="flex items-center gap-1.5 text-neutral-400">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditRoute(route);
                                  }}
                                  className="p-1.5 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-neutral-900 rounded-lg transition-all"
                                  title="Edit Route"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoute(route.id!);
                                  }}
                                  className="p-1.5 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-neutral-900 rounded-lg transition-all"
                                  title="Delete Route"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <h4 className="font-black text-neutral-900 dark:text-white uppercase text-base tracking-tight leading-tight">{route.name}</h4>
                              <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{route.description || 'Hakuna maelezo yaliyowekwa bado.'}</p>
                            </div>

                            {/* Info Badges */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-full text-[10px] font-black uppercase text-neutral-600 dark:text-neutral-400">
                                {route.stops.length} Vituo (Stops)
                              </div>
                              <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-full text-[10px] font-black uppercase text-neutral-600 dark:text-neutral-400">
                                +{totalPoints} Points
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-neutral-200/50 dark:border-neutral-800/50 flex gap-2">
                            <Button
                              onClick={() => setSelectedRouteForQR(route)}
                              className={`flex-1 h-11 text-xs font-black uppercase tracking-wider rounded-xl gap-2 ${
                                isSelected 
                                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md' 
                                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800'
                              }`}
                            >
                              <QrCode className="w-4 h-4" />
                              Sanidi QR Stand
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stand QR Preview */}
          <div className="lg:col-span-4">
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl sticky top-6">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                <div>
                  <span className="px-3 py-1 bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                    Print / Share
                  </span>
                  <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-2 uppercase tracking-tight">QR Stand ya Safari</h3>
                  <p className="text-xs text-neutral-500 mt-1">Chagua Njia moja ya AR kutoka kushoto ili kutengeneza au kuchapa stand ya QR ya kuanzia safari hiyo.</p>
                </div>

                {selectedRouteForQR ? (
                  <div className="w-full flex flex-col items-center space-y-6">
                    {/* Render Canvas Hidden */}
                    <div id="qr-route-print" className="hidden" ref={qrPreviewRef}></div>

                    {/* Styled Mockup */}
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-[280px] space-y-4 shadow-sm relative">
                      <div className="text-[9px] font-black uppercase tracking-widest bg-orange-600 text-white px-2.5 py-1 rounded-full w-max mx-auto">
                        Augmented Reality (AR) Route
                      </div>
                      <div className="text-sm font-black text-neutral-900 dark:text-white uppercase truncate">
                        {selectedRouteForQR.name}
                      </div>
                      
                      {/* Interactive Canvas Stand */}
                      <div className="aspect-square bg-white border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-center p-4">
                        <div className="p-1 border-2 border-orange-500 rounded-xl">
                          {/* We clone here dynamically for visible preview */}
                          <div dangerouslySetInnerHTML={{
                            __html: qrPreviewRef.current?.innerHTML || '<div class="w-40 h-40 bg-neutral-100 animate-pulse rounded-lg"></div>'
                          }} />
                        </div>
                      </div>

                      <div className="text-[10px] text-neutral-400 font-mono font-bold leading-tight uppercase">
                        Skani kuanza safari!
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full">
                      <Button
                        onClick={() => qrInstance?.download({ name: `${selectedRouteForQR.name}_QR`, extension: 'png' })}
                        className="h-12 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white font-black uppercase text-[10px] tracking-wider rounded-xl gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                      <Button
                        onClick={() => printRouteQRStand(selectedRouteForQR)}
                        className="h-12 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl gap-2 shadow-lg shadow-orange-500/20"
                      >
                        <Printer className="w-4 h-4" />
                        Print Stand
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl w-full">
                    <QrCode className="w-12 h-12 text-neutral-300 dark:text-neutral-700 animate-pulse mb-3" />
                    <span className="text-[10px] uppercase font-black tracking-widest">Tafadhali chagua safari</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      ) : (
        // ROUTE CREATOR / MAP BUILDER INTERFACE
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Map & Stop Editor */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* General Info */}
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <CardContent className="p-8 space-y-4">
                <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                  {editingRoute ? 'Hariri Njia ya AR' : 'Sajili Njia Mpya ya AR'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Jina la Safari / Njia ya AR</label>
                    <Input 
                      type="text" 
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="Mfan: Stone Town History Tour"
                      className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-xl h-12 font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Jamii / Category</label>
                    <select
                      value={routeCategory}
                      onChange={(e) => setRouteCategory(e.target.value)}
                      className="w-full h-12 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    >
                      {TOUR_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-bold">Maelezo fupi ya Safari (Description)</label>
                  <textarea
                    value={routeDesc}
                    onChange={(e) => setRouteDesc(e.target.value)}
                    placeholder="Wasilisha maelezo mepesi ya safari hii, e.g. 'Gundua simulizi za ujenzi, utamaduni, na utalii mzuri wa mji mkongwe hatua kwa hatua kwa kutumia AR!'"
                    className="w-full h-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Interactive Stop Map builder */}
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-tight">Kupanga Vituo vya Safari</h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Click kituo kwenye orodha upande wa kulia, kisha bonyeza kwenye ramani kurekebisha eneo la kituo hicho.</p>
                  </div>
                  <Button 
                    onClick={addNewStop}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-black h-10 px-4 rounded-xl text-xs uppercase tracking-wider gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Ongeza Kituo
                  </Button>
                </div>

                {/* Leaflet Builder Map */}
                <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative z-10">
                  <MapContainer 
                    center={mapCenter} 
                    zoom={17} 
                    className="w-full h-full"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    
                    {stops.map((stop, sIdx) => (
                      <Marker 
                        key={stop.stop}
                        position={[stop.lat, stop.lng]} 
                        icon={StopIcon(stop.stop)}
                        eventHandlers={{
                          click: () => setSelectedStopIdx(sIdx)
                        }}
                      />
                    ))}

                    {/* Connecting line representing the route arrow wayfinding */}
                    {polylinePositions.length > 1 && (
                      <Polyline 
                        positions={polylinePositions} 
                        color="#ea580c" 
                        dashArray="6, 8" 
                        weight={3} 
                      />
                    )}

                    <MapEvents />
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Stops List & Detail Editor */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Stop Navigator */}
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <CardContent className="p-8 space-y-4">
                <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-tight">Vituo vya Safari ({stops.length})</h3>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {stops.map((stop, idx) => {
                    const isSelected = selectedStopIdx === idx;
                    const charInfo = CHARACTERS_LIST.find(c => c.id === stop.character);
                    
                    return (
                      <div 
                        key={stop.stop}
                        onClick={() => setSelectedStopIdx(idx)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-orange-500 text-white border-orange-500 shadow' 
                            : 'bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            isSelected ? 'bg-white text-orange-600' : 'bg-orange-600 text-white'
                          }`}>
                            {stop.stop}
                          </div>
                          <div>
                            <div className="text-xs font-black uppercase truncate max-w-[130px]">{stop.name}</div>
                            <div className={`text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-neutral-400'}`}>
                              Character: {charInfo?.icon || '🤖'} {charInfo?.name.split(' ')[0] || 'Guide'}
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStop(idx);
                          }}
                          className={`p-1.5 rounded-lg transition-all ${
                            isSelected ? 'hover:bg-orange-600 text-white/90 hover:text-white' : 'hover:bg-red-50 hover:text-red-600 text-neutral-400'
                          }`}
                          title="Futa Kituo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Stop Parameter Form */}
            {selectedStopIdx !== null && stops[selectedStopIdx] && (
              <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardContent className="p-8 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-[10px] uppercase font-black bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40 px-3 py-1 rounded-full">
                      Kituo cha {selectedStopIdx + 1}
                    </span>
                    <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase">Sanidi Kituo</h4>
                  </div>

                  {/* Visual Mapping na Kamera Button */}
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-2xl flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <Camera className="w-5 h-5 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider">Visual Mapping na Kamera</span>
                    </div>
                    <p className="text-[10.5px] text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">
                      Vendor, nenda kwenye eneo halisi, bonyeza kifungo hiki ili kufungua kamera ya simu na kuweka GPS kiotomatiki kwa kutumia eneo ulilosimama!
                    </p>
                    <Button 
                      onClick={startLiveMapping}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl py-2.5 shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>📍 Anza Visual Mapping na GPS</span>
                    </Button>
                  </div>

                  {/* Stop Name */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Jina la Kituo (Title)</label>
                    <Input 
                      type="text" 
                      value={stops[selectedStopIdx].name}
                      onChange={(e) => updateCurrentStopField('name', e.target.value)}
                      className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-xl h-10 text-xs font-semibold"
                    />
                  </div>

                  {/* Character Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Kikaragosi cha 3D / AR Guide</label>
                    <select
                      value={stops[selectedStopIdx].character}
                      onChange={(e) => updateCurrentStopField('character', e.target.value)}
                      className="w-full h-10 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    >
                      {CHARACTERS_LIST.map(char => (
                        <option key={char.id} value={char.id}>{char.icon} {char.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Audio Guide text-to-speech */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Sauti ya AR (Audio Narration TTS)</label>
                      <button 
                        onClick={() => testSpeech(stops[selectedStopIdx].voiceText)}
                        className="text-[9px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 dark:bg-orange-950/20 px-2 py-1 rounded-md"
                        title="Test with Voice"
                      >
                        <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                        Sikiliza Sauti
                      </button>
                    </div>
                    <textarea
                      value={stops[selectedStopIdx].voiceText}
                      onChange={(e) => updateCurrentStopField('voiceText', e.target.value)}
                      placeholder="Mfan: Karibu sana kwenye mji mkongwe, jengo hili lina historia ndefu..."
                      className="w-full h-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white resize-none leading-relaxed"
                    />
                  </div>

                  {/* Animation & Sound */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Miondoko (Animation)</label>
                      <select
                        value={stops[selectedStopIdx].animation}
                        onChange={(e) => updateCurrentStopField('animation', e.target.value)}
                        className="w-full h-9 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2 text-[11px] font-semibold focus:outline-none dark:text-white"
                      >
                        <option value="wave">Kupungia (Wave)</option>
                        <option value="roar">Nguruma (Roar)</option>
                        <option value="spin">Kuzunguka (Spin)</option>
                        <option value="bounce">Kudunda (Bounce)</option>
                        <option value="float">Kueleama (Float)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Mlio (Sound)</label>
                      <select
                        value={stops[selectedStopIdx].sound}
                        onChange={(e) => updateCurrentStopField('sound', e.target.value)}
                        className="w-full h-9 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2 text-[11px] font-semibold focus:outline-none dark:text-white"
                      >
                        <option value="welcome">Welcome chime</option>
                        <option value="roar">Roar effect</option>
                        <option value="collect">Collect coin</option>
                        <option value="chime">Magic chime</option>
                        <option value="applause">Applause</option>
                      </select>
                    </div>
                  </div>

                  {/* Points Reward */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Zawadi (Points)</label>
                      <Input 
                        type="number" 
                        value={stops[selectedStopIdx].rewardPoints}
                        onChange={(e) => updateCurrentStopField('rewardPoints', Number(e.target.value))}
                        className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-xl h-9 text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Kuponi / Coupon Code</label>
                      <Input 
                        type="text" 
                        value={stops[selectedStopIdx].rewardCoupon}
                        onChange={(e) => updateCurrentStopField('rewardCoupon', e.target.value)}
                        placeholder="Mfan: TOUR10"
                        className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-xl h-9 text-xs font-semibold uppercase"
                      />
                    </div>
                  </div>

                  {/* Photo Frame Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Photo Frame Overlay (Sura ya Picha)</label>
                    <select
                      value={stops[selectedStopIdx].photoFrame || 'none'}
                      onChange={(e) => updateCurrentStopField('photoFrame', e.target.value)}
                      className="w-full h-10 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    >
                      <option value="none">Hakuna Frame (Kawaida)</option>
                      <option value="retro_polaroid">Polaroid Ya Picha 📸</option>
                      <option value="cyberpunk_glow">Cyberpunk Glowing HUD 🤖</option>
                      <option value="vintage_safari">Vintage Safari Leaf Frame 🌿</option>
                      <option value="modern">Modern Camera Focus REC 📹</option>
                    </select>
                  </div>

                  {/* Rich Multimedia Fields */}
                  <div className="space-y-3 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Rich Media (Picha, Video & Viungo)</span>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Kiungo cha Picha (Image URL)</label>
                      <Input 
                        type="text" 
                        value={stops[selectedStopIdx].imageUrl || ''}
                        onChange={(e) => updateCurrentStopField('imageUrl', e.target.value)}
                        placeholder="https://example.com/picha.jpg"
                        className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Kiungo cha Video Clip (Video URL)</label>
                      <Input 
                        type="text" 
                        value={stops[selectedStopIdx].videoUrl || ''}
                        onChange={(e) => updateCurrentStopField('videoUrl', e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Kiungo cha Nje/Website (Redirect Link)</label>
                      <Input 
                        type="text" 
                        value={stops[selectedStopIdx].linkUrl || ''}
                        onChange={(e) => updateCurrentStopField('linkUrl', e.target.value)}
                        placeholder="https://duka-lako.com/bidhaa"
                        className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Interactive Quiz Toggle */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Swali la Quiz la AR</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!stops[selectedStopIdx].quiz}
                        onChange={(e) => toggleQuiz(e.target.checked)}
                        className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-neutral-300"
                      />
                    </div>

                    {stops[selectedStopIdx].quiz && (
                      <div className="space-y-3 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50 text-[11px]">
                        <div className="space-y-1">
                          <label className="font-bold text-neutral-400 uppercase text-[9px]">Swali (Question)</label>
                          <textarea
                            value={stops[selectedStopIdx].quiz.question}
                            onChange={(e) => updateCurrentStopQuiz('question', e.target.value)}
                            className="w-full h-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2 font-medium resize-none text-neutral-800 dark:text-neutral-200"
                          />
                        </div>

                        {/* Options */}
                        <div className="space-y-1.5">
                          <label className="font-bold text-neutral-400 uppercase text-[9px]">Chaguzi (4 Options)</label>
                          {stops[selectedStopIdx].quiz.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <span className="font-black text-neutral-400">{oIdx + 1}.</span>
                              <input 
                                type="text"
                                value={opt}
                                onChange={(e) => updateCurrentStopQuiz(`option_${oIdx}`, e.target.value)}
                                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 h-7 font-medium text-neutral-800 dark:text-neutral-200"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Correct Answer */}
                        <div className="space-y-1">
                          <label className="font-bold text-neutral-400 uppercase text-[9px]">Jibu sahihi (Correct Option)</label>
                          <select
                            value={stops[selectedStopIdx].quiz.answer}
                            onChange={(e) => updateCurrentStopQuiz('answer', Number(e.target.value))}
                            className="w-full h-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 text-[10px] font-semibold dark:text-white"
                          >
                            <option value={0}>Option 1</option>
                            <option value={1}>Option 2</option>
                            <option value={2}>Option 3</option>
                            <option value={3}>Option 4</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveRoute}
                      disabled={isSaving}
                      className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-lg shadow-orange-500/10 gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Inahifadhi...' : 'Hifadhi Njia'}
                    </Button>
                    <Button
                      onClick={() => setActiveTab('list')}
                      className="h-11 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white font-black uppercase text-[10px] tracking-wider rounded-xl px-4"
                    >
                      Ghairi
                    </Button>
                  </div>

                </CardContent>
              </Card>
            )}

          </div>

        </div>
      )}

      {/* 📍 LIVE VISUAL MAPPING OVERLAY MODAL */}
      {showLiveMapper && selectedStopIdx !== null && stops[selectedStopIdx] && (
        <div className="fixed inset-0 bg-black z-[999] flex flex-col overflow-hidden text-white font-sans select-none">
          
          {/* Header */}
          <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-500">Live Visual Mapping & Setup</h3>
            </div>
            <button 
              onClick={stopLiveMapping}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera Viewport Area */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <video 
              ref={liveVideoRef}
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* Simulated 3D Character Overlay mapping on-site */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center">
              {(() => {
                const stop = stops[selectedStopIdx];
                const charType = stop.character || 'guide';
                const charFound = [
                  { id: 'lion', name: 'Simba wa 3D 🦁', icon: '🦁' },
                  { id: 'castle', name: 'Jengo la Kale 🏰', icon: '🏰' },
                  { id: 'guide', name: 'Guide wa Katuni 🤖', icon: '🤖' },
                  { id: 'treasure', name: 'Sanduku la Hazina 🎁', icon: '🎁' },
                  { id: 'coin', name: 'Sarafu ya Dhahabu 🪙', icon: '🪙' },
                  { id: 'dragon', name: 'Joka la Ndoto 🐉', icon: '🐉' },
                  { id: 'bread', name: 'Mkate mtamu 🍞', icon: '🍞' },
                  { id: 'soda', name: 'Kinywaji baridi 🥤', icon: '🥤' },
                  { id: 'tv', name: 'TV/Televisheni 📺', icon: '📺' },
                  { id: 'teacher', name: 'Mwalimu msomi 👩‍🏫', icon: '👩‍🏫' },
                  { id: 'fireworks', name: 'Fataki za Sherehe 🎉', icon: '🎉' },
                ].find(c => c.id === charType);

                return (
                  <div className="flex flex-col items-center justify-center animate-bounce">
                    <div className="w-24 h-24 rounded-full bg-orange-600/30 border-4 border-orange-500 flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(234,88,12,0.6)]">
                      <span>{charFound?.icon || '📍'}</span>
                    </div>
                    <span className="mt-3 px-3 py-1 bg-black/80 rounded-full border border-orange-500 text-[10px] font-black uppercase text-orange-400 shadow-md">
                      Placing: {charFound?.name || 'Kiongozi'}
                    </span>
                    <span className="text-[9px] text-neutral-300 mt-1 font-mono">
                      (Tap or move phone to place)
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* GPS Lock status */}
            <div className="absolute top-4 left-4 right-4 bg-black/75 p-3 rounded-2xl border border-white/10 text-xs pointer-events-auto flex flex-col gap-1.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-400">GPS Status:</span>
                {isCapturingLiveLocation ? (
                  <span className="text-yellow-500 font-black animate-pulse uppercase text-[10px]">Inatafuta Mawimbi ya GPS...</span>
                ) : (
                  <span className="text-green-500 font-black uppercase text-[10px]">GPS LOCKED OK ●</span>
                )}
              </div>
              <div className="font-mono text-[10px] text-neutral-300 flex justify-between">
                <span>Lat: {stops[selectedStopIdx].lat?.toFixed(6) || '---'}</span>
                <span>Lng: {stops[selectedStopIdx].lng?.toFixed(6) || '---'}</span>
              </div>
            </div>

            {/* Custom Photo Frame preview on-site */}
            {stops[selectedStopIdx].photoFrame && stops[selectedStopIdx].photoFrame !== 'none' && (
              <div className="absolute inset-0 border-4 border-dashed border-orange-500/30 pointer-events-none flex items-center justify-center">
                <span className="bg-black/60 px-3 py-1.5 rounded-full text-[10px] font-bold text-orange-400 border border-orange-500/30">
                  📸 Active Frame: {stops[selectedStopIdx].photoFrame}
                </span>
              </div>
            )}
          </div>

          {/* Quick Setup Options & Controls at Bottom */}
          <div className="p-4 bg-neutral-950 border-t border-neutral-800 space-y-4 max-h-[40vh] overflow-y-auto">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">Hatua 1: Hakiki & Weka GPS Enneo Halisi</span>
              <Button 
                onClick={startLiveMapping}
                disabled={isCapturingLiveLocation}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4 animate-bounce" />
                {isCapturingLiveLocation ? 'Inatengeneza GPS ya sasa hivi...' : '📍 Sasisha GPS ya Kituo kwa Eneo Langu!'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Jaribu Sauti (TTS)</label>
                <Button 
                  onClick={() => testSpeech(stops[selectedStopIdx].voiceText)}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold"
                >
                  <Volume2 className="w-4 h-4 mr-1.5" /> Jaribu Sauti
                </Button>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Photo Frame</label>
                <select
                  value={stops[selectedStopIdx].photoFrame || 'none'}
                  onChange={(e) => updateCurrentStopField('photoFrame', e.target.value)}
                  className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-xl px-2 text-[10px] font-bold text-white focus:outline-none"
                >
                  <option value="none">No Frame</option>
                  <option value="retro_polaroid">Polaroid</option>
                  <option value="cyberpunk_glow">Cyberpunk HUD</option>
                  <option value="vintage_safari">Safari</option>
                  <option value="modern">REC View</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={stopLiveMapping}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest"
              >
                Kamilisha na Hifadhi Setup ya AR 🎉
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
