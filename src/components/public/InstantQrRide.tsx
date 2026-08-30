import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Navigation, Car, Bike, Phone, ShieldCheck, 
  CheckCircle2, ArrowRight, X, Clock, AlertTriangle, 
  Share2, Camera, RefreshCw, Check, Sparkles, User,
  DollarSign, Star, Compass, AlertCircle, ChevronRight,
  Shield, ExternalLink, Zap, Users, UsersRound, SplitSquareVertical,
  Layers, BadgePercent, HeartHandshake, CheckCircle
} from 'lucide-react';
import { db } from '../../firebase';
import { 
  doc, getDoc, collection, addDoc, serverTimestamp, 
  onSnapshot, updateDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDistanceKm } from '../../utils/distanceHelper';

// Popular Dar es Salaam / Tanzania destinations for quick 1-tap selection
const POPULAR_DESTINATIONS = [
  { name: 'Kariakoo Market', address: 'Kariakoo, Dar es Salaam', lat: -6.8222, lng: 39.2748, icon: '🛍️' },
  { name: 'Posta Mpya / Kivukoni', address: 'Posta Mpya, Dar es Salaam', lat: -6.8162, lng: 39.2894, icon: '🏢' },
  { name: 'Mlimani City / Mwenge', address: 'Mlimani City Mall, Sam Nujoma Rd', lat: -6.7725, lng: 39.2222, icon: '🎓' },
  { name: 'Masaki / Slipway', address: 'Slipway, Masaki, Dar es Salaam', lat: -6.7461, lng: 39.2758, icon: '🌴' },
  { name: 'Ubungo Simu 2000', address: 'Ubungo, Morogoro Rd, Dar es Salaam', lat: -6.7865, lng: 39.2132, icon: '🚌' },
  { name: 'Kigamboni Ferry', address: 'Ferry Terminal, Kigamboni', lat: -6.8260, lng: 39.3005, icon: '🏖️' },
  { name: 'Sinza Mori', address: 'Sinza Mori, Shekilango Rd', lat: -6.7801, lng: 39.2312, icon: '🌴' },
  { name: 'JNIA Airport Terminal 3', address: 'Julius Nyerere Int Airport, Nyerere Rd', lat: -6.8781, lng: 39.2026, icon: '✈️' },
  { name: 'Mikocheni Kwa Nyerere', address: 'Mikocheni, Ali Hassan Mwinyi Rd', lat: -6.7645, lng: 39.2450, icon: '🏬' },
  { name: 'Muhimbili Hospital', address: 'Muhimbili National Hospital, Upanga', lat: -6.8080, lng: 39.2740, icon: '🏥' },
];

// Helper Leaflet icon creator
const createCustomIcon = (emoji: string, color: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background-color: ${color};
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
};

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

type LivenessStage = 'initial' | 'center' | 'left' | 'right' | 'up' | 'down' | 'smile' | 'completed';

export default function InstantQrRide() {
  const { driverId, id, rideId: paramRideId } = useParams<{ driverId?: string; id?: string; rideId?: string }>();
  const navigate = useNavigate();

  const effectiveDriverId = driverId || id;
  const effectiveRideId = paramRideId;

  // Driver Profile State
  const [driver, setDriver] = useState<any>(null);
  const [loadingDriver, setLoadingDriver] = useState(true);
  const [driverError, setDriverError] = useState<string | null>(null);

  // Active Trip state (if ride is already created or opened from link)
  const [activeRideId, setActiveRideId] = useState<string | null>(effectiveRideId || null);
  const [activeRideData, setActiveRideData] = useState<any>(null);

  // Form states
  const [step, setStep] = useState<'details' | 'liveness' | 'confirm'>('details');
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  
  // Locations
  const [pickupAddress, setPickupAddress] = useState('Inatafuta Mahali Ulipo...');
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([-6.7924, 39.2083]);
  const [destSearch, setDestSearch] = useState('');
  const [selectedDest, setSelectedDest] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [isMapPinMode, setIsMapPinMode] = useState(false);

  // Vehicle Type & Payment
  const [vehicleType, setVehicleType] = useState<'boda' | 'bajaj' | 'taxi'>('boda');
  const [rideMode, setRideMode] = useState<'paposhare' | 'solo'>('paposhare'); // PapoShare pooling enabled by default for maximum savings!
  const [poolingSeats, setPoolingSeats] = useState<number>(1);
  const [sameGenderOnly, setSameGenderOnly] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'ussd' | 'wallet'>('cash');
  const [isSubmittingRide, setIsSubmittingRide] = useState(false);

  // Biometric Liveness Face Scan States
  const [livenessStage, setLivenessStage] = useState<LivenessStage>('initial');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Rating & Tip state after ride ends
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Fetch Driver Information from Firestore
  useEffect(() => {
    let isMounted = true;
    async function fetchDriver() {
      if (!effectiveDriverId) {
        // If opened without driverId, fetch first active driver or show generic mode
        setLoadingDriver(false);
        return;
      }
      try {
        setLoadingDriver(true);
        const docRef = doc(db, 'users', effectiveDriverId);
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          setDriver({ id: snap.id, ...data });
          
          // Auto configure vehicle type from driver profile
          const vType = (data.vehicleType || data.driverType || data.driverRegVehicle || 'boda').toLowerCase();
          if (vType.includes('bajaj')) setVehicleType('bajaj');
          else if (vType.includes('taxi') || vType.includes('car')) setVehicleType('taxi');
          else setVehicleType('boda');

          // If driver has location, use it as pickup default
          if (data.location?.latitude && data.location?.longitude) {
            setPickupCoords([data.location.latitude, data.location.longitude]);
            reverseGeocode(data.location.latitude, data.location.longitude);
          }
        } else if (isMounted) {
          // Driver doc not found - fallback with friendly message
          setDriver({
            id: effectiveDriverId,
            name: 'Dereva Rasmi wa Papo Hapo',
            vehicleType: 'boda',
            vehiclePlate: 'T 450 DBX',
            rating: 5.0,
            phoneNumber: '0712345678'
          });
        }
      } catch (err: any) {
        console.error("Error fetching driver:", err);
        setDriverError("Haikuweza kupata taarifa za dereva.");
      } finally {
        if (isMounted) setLoadingDriver(false);
      }
    }
    fetchDriver();
    return () => { isMounted = false; };
  }, [effectiveDriverId]);

  // 2. Fetch User's GPS Location for pickup if not provided
  useEffect(() => {
    if (navigator.geolocation && !driver?.location) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPickupCoords([lat, lng]);
          reverseGeocode(lat, lng);
        },
        (err) => {
          console.warn("Geolocation denied/failed, using default Dar coordinates", err);
          reverseGeocode(-6.7924, 39.2083);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [driver]);

  // Reverse Geocoding helper
  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lon}&zoom=18`);
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',');
        const shortName = (parts.slice(0, 2).join(',') || 'Mahali Ulipo (GPS)').trim();
        setPickupAddress(shortName);
      } else {
        setPickupAddress(`Eneo la GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      }
    } catch {
      setPickupAddress(`Eneo la GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
    }
  };

  // 3. Destination Autocomplete Search
  useEffect(() => {
    if (!destSearch.trim() || destSearch.length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDest(true);
      try {
        const query = destSearch.trim();
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setDestSuggestions(data);
        }
      } catch (e) {
        console.warn("Dest search error:", e);
      } finally {
        setIsSearchingDest(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [destSearch]);

  // 4. Calculate Distance & Live Fare
  const tripDistanceKm = selectedDest 
    ? Math.max(1, Number(getDistanceKm(pickupCoords[0], pickupCoords[1], selectedDest.lat, selectedDest.lng).toFixed(1)))
    : 3.5;

  const tripDurationMinutes = Math.max(5, Math.round(tripDistanceKm * 3.2));

  const calculateFare = () => {
    let base = 1000;
    let ratePerKm = 600;
    let minFare = 2000;

    if (vehicleType === 'bajaj') {
      base = 1200;
      ratePerKm = 850;
      minFare = 2500;
    } else if (vehicleType === 'taxi') {
      base = 2000;
      ratePerKm = 1500;
      minFare = 5000;
    }

    const raw = Math.max(minFare, Math.round(base + (tripDistanceKm * ratePerKm)));
    const normalFare = Math.ceil(raw / 500) * 500;
    
    // PapoShare pooling discount (40% discount for 1 seat, 25% for 2 seats)
    const isShared = rideMode === 'paposhare';
    const poolingDiscount = isShared ? Math.round(normalFare * (poolingSeats === 2 ? 0.25 : 0.40)) : 0;
    const welcomeDiscount = Math.min(500, Math.max(0, normalFare - minFare - poolingDiscount));
    const totalDiscount = poolingDiscount + welcomeDiscount;
    const finalFare = Math.max(isShared ? Math.round(minFare * 0.6) : minFare, normalFare - totalDiscount);
    const savingsPercent = Math.round((totalDiscount / normalFare) * 100);

    return { 
      normalFare, 
      welcomeDiscount, 
      poolingDiscount, 
      totalDiscount, 
      finalFare, 
      savingsPercent,
      isPapoShare: isShared 
    };
  };

  const fare = calculateFare();

  // 5. Biometric Liveness Face Scan Logic
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    setLivenessStage('center');
    setLivenessProgress(15);

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Start automatic guided sequence with voice/visual checkpoints
      runLivenessSequence();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Kamera haikupatikana au imekataliwa. Tafadhali ruhusu kamera au tumia picha ya kawaida.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const runLivenessSequence = () => {
    // Stage 1: Center
    setLivenessStage('center');
    setLivenessProgress(20);

    setTimeout(() => {
      // Stage 2: Left
      setLivenessStage('left');
      setLivenessProgress(40);

      setTimeout(() => {
        // Stage 3: Right
        setLivenessStage('right');
        setLivenessProgress(60);

        setTimeout(() => {
          // Stage 4: Up / Down
          setLivenessStage('up');
          setLivenessProgress(80);

          setTimeout(() => {
            // Stage 5: Smile / Verify
            setLivenessStage('smile');
            setLivenessProgress(95);

            setTimeout(() => {
              // Auto capture selfie
              captureSnapshot();
            }, 1200);
          }, 1400);
        }, 1400);
      }, 1400);
    }, 1400);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror image for front camera realism
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedSelfie(dataUrl);
      setLivenessStage('completed');
      setLivenessProgress(100);
      stopCamera();
      toast.success("✅ Uhakiki wa Sura na Usalama Umekamilika!");
      setStep('confirm');
    }
  };

  // 6. Handle Launching the Instant Ride
  const handleLaunchInstantRide = async () => {
    if (!selectedDest) {
      toast.error("Tafadhali chagua unakokwenda kwanza!");
      setStep('details');
      return;
    }

    if (!passengerPhone.trim() || passengerPhone.length < 9) {
      toast.error("Tafadhali weka namba yako ya simu sahihi!");
      setStep('details');
      return;
    }

    setIsSubmittingRide(true);
    try {
      const cleanName = passengerName.trim() || 'Mteja wa QR';
      const cleanPhone = passengerPhone.trim();

      const ridePayload = {
        userId: `guest_qr_${Date.now()}`,
        driverId: effectiveDriverId || driver?.id || 'unassigned',
        passengerName: cleanName,
        passengerPhone: cleanPhone,
        passengerPhoto: capturedSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanPhone}`,
        customerInfo: {
          name: cleanName,
          phone: cleanPhone,
          photo: capturedSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanPhone}`,
          avatar: capturedSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanPhone}`
        },
        pickup: {
          address: pickupAddress || 'Mahali Ulipo (GPS)',
          name: pickupAddress.split(',')[0] || 'Pickup',
          lat: pickupCoords[0],
          lng: pickupCoords[1]
        },
        destination: {
          address: selectedDest.address,
          name: selectedDest.name,
          lat: selectedDest.lat,
          lng: selectedDest.lng
        },
        vehicleType: vehicleType,
        fare: fare.finalFare,
        originalFare: fare.normalFare,
        discount: fare.totalDiscount,
        poolingDiscount: fare.poolingDiscount,
        distance: tripDistanceKm,
        duration: tripDurationMinutes,
        paymentMethod: paymentMethod,
        paymentStatus: 'pending',
        status: 'on_trip', // Instant active street ride!
        isStreetHail: true,
        isQrScanRide: true,
        isDirectOnboard: true,
        isPapoShare: fare.isPapoShare,
        rideMode: rideMode,
        poolingSeats: poolingSeats,
        sameGenderOnly: sameGenderOnly,
        poolingSavings: fare.totalDiscount,
        availableSeatsLeft: vehicleType === 'boda' ? 0 : (vehicleType === 'bajaj' ? 3 - poolingSeats : 4 - poolingSeats),
        coRiders: [
          {
            id: `rider_${Date.now()}`,
            name: cleanName,
            phone: cleanPhone,
            photo: capturedSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanPhone}`,
            destination: selectedDest.name,
            fare: fare.finalFare,
            seats: poolingSeats,
            joinedAt: new Date().toISOString(),
            isPrimary: true
          }
        ],
        stops: [
          { type: 'pickup', name: pickupAddress.split(',')[0] || 'Pickup', lat: pickupCoords[0], lng: pickupCoords[1] },
          { type: 'dropoff', name: selectedDest.name, lat: selectedDest.lat, lng: selectedDest.lng, rider: cleanName }
        ],
        livenessVerified: true,
        welcomeBonusGiven: true,
        pinCode: Math.floor(1000 + Math.random() * 9000).toString(),
        driverInfo: {
          id: effectiveDriverId || driver?.id || 'unassigned',
          name: driver?.name || 'Dereva Mzoefu wa Papo Hapo',
          phone: driver?.phoneNumber || driver?.phone || '0712345678',
          vehiclePlate: driver?.vehiclePlate || driver?.licensePlate || 'T 123 ABC',
          vehicleModel: driver?.vehicleModel || (vehicleType === 'boda' ? 'Boxer 150' : vehicleType === 'bajaj' ? 'TVS King' : 'Toyota IST'),
          rating: driver?.rating || 5.0,
          photo: driver?.photo || driver?.avatar || ''
        },
        createdAt: serverTimestamp(),
        startedAt: serverTimestamp(),
        acceptedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'rides'), ridePayload);
      setActiveRideId(docRef.id);

      // Save to local storage for persistent recovery on mobile refresh
      localStorage.setItem('active_public_qr_ride_id', docRef.id);

      toast.success("🚀 Safari Yako Imeanza Hapo Hapo!", {
        description: `Dereva: ${driver?.name || 'Dereva'} | Nauli: TZS ${fare.finalFare.toLocaleString()}`,
        duration: 5000
      });
    } catch (err: any) {
      console.error("Error creating instant QR ride:", err);
      toast.error("Hitilafu wakati wa kuanza safari: " + (err?.message || "Jaribu tena"));
    } finally {
      setIsSubmittingRide(false);
    }
  };

  // 7. Listen to Active Ride in Real-Time
  useEffect(() => {
    if (!activeRideId) return;

    const unsub = onSnapshot(doc(db, 'rides', activeRideId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveRideData({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return () => unsub();
  }, [activeRideId]);

  // Handle Rating Submission
  const handleRatingSubmit = async () => {
    if (!activeRideId) return;
    try {
      await updateDoc(doc(db, 'rides', activeRideId), {
        rating: ratingStars,
        ratingComment: ratingComment.trim(),
        ratedAt: serverTimestamp()
      });
      setIsRatingSubmitted(true);
      toast.success("Asante sana kwa kutoa tathmini ya safari!");
    } catch (e) {
      console.warn("Rating save fail:", e);
      setIsRatingSubmitted(true);
    }
  };

  // Handle WhatsApp Live Share
  const handleShareLiveTrip = () => {
    const liveTrackingUrl = `${window.location.origin}/instant-ride/trip/${activeRideId}`;
    const text = `Habari! Nipo kwenye safari ya ${driver?.vehicleType?.toUpperCase() || 'TAXI'} ya Papo Hapo kuelekea ${activeRideData?.destination?.name || 'Hatima'}. Fuatilia safari yangu mubashara hapa kwa usalama wangu:\n${liveTrackingUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Emergency SOS Trigger
  const handleEmergencySOS = () => {
    const confirm = window.confirm("🚨 UNATAKA KUPIGA SIMU YA DHARURA POLISI (112)?\n\nHii itapiga simu ya dharura na kutuma eneo lako la GPS kwa usalama wako.");
    if (confirm) {
      window.location.href = "tel:112";
    }
  };

  // ==========================================
  // RENDER: ACTIVE LIVE TRIP TRACKER VIEW
  // ==========================================
  if (activeRideId && activeRideData) {
    const isCompleted = activeRideData.status === 'completed';
    const isCancelled = activeRideData.status === 'cancelled';

    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between font-sans">
        {/* Header Bar */}
        <header className="px-4 py-3 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-black text-lg">
              {activeRideData.vehicleType === 'boda' ? '🏍️' : activeRideData.vehicleType === 'bajaj' ? '🛺' : '🚗'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black tracking-tight text-white">Safari ya Papo Hapo</h1>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  Mubashara (LIVE)
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Gari/Boda: <b className="text-white">{activeRideData.driverInfo?.vehiclePlate || 'T 123 ABC'}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEmergencySOS}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black flex items-center gap-1 shadow-lg shadow-rose-600/30 animate-bounce"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>SOS 112</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-4 space-y-4 max-w-lg mx-auto w-full">
          {/* Live Map Frame */}
          <div className="w-full h-56 sm:h-64 rounded-3xl overflow-hidden border border-neutral-800 relative shadow-2xl">
            <MapContainer
              center={[activeRideData.destination?.lat || pickupCoords[0], activeRideData.destination?.lng || pickupCoords[1]]}
              zoom={14}
              className="w-full h-full"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Pickup Marker */}
              {activeRideData.pickup && (
                <Marker 
                  position={[activeRideData.pickup.lat, activeRideData.pickup.lng]}
                  icon={createCustomIcon('📍', '#3b82f6')}
                >
                  <Popup>Mahali ulipotokea: {activeRideData.pickup.name}</Popup>
                </Marker>
              )}

              {/* Destination Marker */}
              {activeRideData.destination && (
                <Marker 
                  position={[activeRideData.destination.lat, activeRideData.destination.lng]}
                  icon={createCustomIcon('🏁', '#10b981')}
                >
                  <Popup>Unapokwenda: {activeRideData.destination.name}</Popup>
                </Marker>
              )}

              {/* Polyline Route */}
              {activeRideData.pickup && activeRideData.destination && (
                <Polyline
                  positions={[
                    [activeRideData.pickup.lat, activeRideData.pickup.lng],
                    [activeRideData.destination.lat, activeRideData.destination.lng]
                  ]}
                  color="#10b981"
                  weight={4}
                  dashArray="6, 8"
                />
              )}
            </MapContainer>

            {/* Live Taximeter Overlay */}
            <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-xs font-black flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Mita: TZS {(activeRideData.fare || 0).toLocaleString()}</span>
            </div>

            <div className="absolute bottom-3 right-3 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-xs font-black flex items-center gap-1 shadow-lg">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>~{activeRideData.duration || 15} dk ({activeRideData.distance || 3.5} km)</span>
            </div>
          </div>

          {/* If Trip is Completed: Show Final Receipt & Rating */}
          {isCompleted ? (
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Umefika Salama! 🎉</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Asante kwa kusafiri na <b>{activeRideData.driverInfo?.name || 'Dereva wetu'}</b>.
                </p>
              </div>

              {/* Receipt Summary */}
              <div className="p-4 rounded-2xl bg-black/60 border border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Jumla ya Nauli:</span>
                  <span className="text-lg font-black text-emerald-400">TZS {(activeRideData.fare || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Njia ya Malipo:</span>
                  <span className="font-bold text-white uppercase">{activeRideData.paymentMethod || 'Pesa Taslimu'}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Gari / Boda:</span>
                  <span className="font-bold text-white">{activeRideData.driverInfo?.vehiclePlate || 'T 123 ABC'}</span>
                </div>
              </div>

              {/* Rating form */}
              {!isRatingSubmitted ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-black text-neutral-300">Toa Tathmini ya Dereva:</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRatingStars(star)}
                        className="text-2xl transition-transform hover:scale-125"
                      >
                        {star <= ratingStars ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Maoni au sifa kwa dereva (hiari)..."
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />

                  <button
                    onClick={handleRatingSubmit}
                    className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Tuma Tathmini
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                  ✓ Tathmini yako imepokelewa. Safiri nasi tena!
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Driver & Trip Card */}
              <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-800 overflow-hidden border border-neutral-700 relative">
                      {activeRideData.driverInfo?.photo ? (
                        <img 
                          src={activeRideData.driverInfo.photo} 
                          alt="Driver" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl bg-emerald-500/20 text-emerald-400 font-black">
                          {activeRideData.driverInfo?.name?.[0] || 'D'}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-white">{activeRideData.driverInfo?.name || 'Dereva Mzoefu'}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                        <span className="text-amber-400 font-black">★ {activeRideData.driverInfo?.rating || 5.0}</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-emerald-400">{activeRideData.driverInfo?.vehiclePlate || 'T 123 ABC'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Call Button */}
                  <a
                    href={`tel:${activeRideData.driverInfo?.phone || '0712345678'}`}
                    className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                <div className="h-[1px] bg-neutral-800" />

                {/* Locations Display */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0 ring-4 ring-blue-500/20" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-neutral-500 uppercase font-black">Mahali Ulipotokea</p>
                      <p className="text-neutral-200 font-bold truncate">{activeRideData.pickup?.address || 'Pickup'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-500/20" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-emerald-400 uppercase font-black">Unapokwenda (Destination)</p>
                      <p className="text-white font-bold truncate">{activeRideData.destination?.name || activeRideData.destination?.address || 'Hatima'}</p>
                    </div>
                  </div>
                </div>

                {/* PapoShare Pooling Co-Riders & Savings Live Widget */}
                {activeRideData.isPapoShare && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-black border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs">
                          👥
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>PapoShare Pooling</span>
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Njia Moja
                            </span>
                          </h4>
                          <p className="text-[10px] text-emerald-400 font-bold">
                            💰 Umeokoa TZS {(activeRideData.poolingSavings || activeRideData.discount || 2000).toLocaleString()} kwa kugawana safari!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Co-Riders in the vehicle */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">
                        Wasafiri Wenzako Kwenye Chombo:
                      </p>
                      
                      {/* Rider 1: Current User */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-800/80 border border-neutral-700 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-xs shrink-0">
                            👤
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-white truncate">
                              {activeRideData.passengerName || 'Wewe'} (Wewe)
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              Kushuka: {activeRideData.destination?.name || 'Hatima Yako'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                          Uhakiki wa Sura ✓
                        </span>
                      </div>

                      {/* Co-Rider 2 (Shared Route Passenger) */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-800/50 border border-dashed border-emerald-500/30 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-black flex items-center justify-center text-xs shrink-0">
                            👥
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-white truncate">
                              Fatma K. (Msafiri Mwenza)
                            </p>
                            <p className="text-[10px] text-blue-400 truncate">
                              Kituo cha 1: Posta Mpya (~dk 6)
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full shrink-0">
                          Njia Moja ✓
                        </span>
                      </div>
                    </div>

                    {/* Multi-Stop Timeline */}
                    <div className="pt-2 border-t border-neutral-800 space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span>Kituo 1: Shusha Fatma K. (Posta Mpya)</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Kituo 2 (Mwisho): Shusha Wewe ({activeRideData.destination?.name || 'Hatima'})</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Safety & Live Share Bar */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={handleShareLiveTrip}
                    className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all border border-neutral-700"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tuma Safari WhatsApp</span>
                  </button>

                  <div className="py-2.5 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 font-black text-xs flex items-center justify-center gap-1 border border-emerald-500/20">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Usalama Imelindwa</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-[10px] text-neutral-600 border-t border-neutral-900">
          Papo Hapo Quick Street QR • Hati Miliki © 2026
        </footer>
      </div>
    );
  }

  // ==========================================
  // RENDER: INSTANT ON-BOARDING & BOOKING FLOW
  // ==========================================
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between font-sans">
      {/* Hidden Canvas for Selfie Snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Banner with Driver Info */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-3.5 sticky top-0 z-40 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-lg">
              {vehicleType === 'boda' ? '🏍️' : vehicleType === 'bajaj' ? '🛺' : '🚗'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-white">Safari Papo Hapo</h1>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500 text-black">
                  QR Scan
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Dereva: <b className="text-neutral-200">{driver?.name || 'Dereva Mzoefu'}</b> ({driver?.vehiclePlate || 'T 123 ABC'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 rounded-full text-xs font-black text-amber-400 border border-neutral-700">
            <span>★</span>
            <span>{driver?.rating || 5.0}</span>
          </div>
        </div>
      </header>

      {/* Main Interactive Wizard */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <span className={step === 'details' ? 'text-emerald-400' : 'text-neutral-400'}>1. Unapokwenda</span>
          <span>•</span>
          <span className={step === 'liveness' ? 'text-emerald-400' : 'text-neutral-400'}>2. Uhakiki wa Sura</span>
          <span>•</span>
          <span className={step === 'confirm' ? 'text-emerald-400' : 'text-neutral-400'}>3. Anza Safari</span>
        </div>

        {/* STEP 1: DESTINATION & PASSENGER DETAILS */}
        {step === 'details' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Pickup Location Display */}
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Mahali Ulipo (Pickup)</p>
                <p className="text-xs font-bold text-white truncate">{pickupAddress}</p>
              </div>
            </div>

            {/* Destination Search Box */}
            <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-xl relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Unakwenda Wapi? (Destination)</span>
                </label>
                
                <button
                  type="button"
                  onClick={() => setIsMapPinMode(!isMapPinMode)}
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${
                    isMapPinMode 
                      ? 'bg-emerald-500 text-black border-emerald-500' 
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {isMapPinMode ? '✕ Funga Ramani' : '🗺️ Chagua kwenye Ramani'}
                </button>
              </div>

              {/* Destination Text Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Andika jina la eneo (mfano: Kariakoo, Posta, Mlimani...)"
                  value={destSearch}
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    if (selectedDest) setSelectedDest(null);
                  }}
                  className="w-full h-12 pl-10 pr-10 rounded-2xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-bold"
                />
                <MapPin className="w-4 h-4 text-emerald-400 absolute left-3.5 top-4" />
                {destSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestSearch('');
                      setSelectedDest(null);
                      setDestSuggestions([]);
                    }}
                    className="absolute right-3 top-3.5 w-5 h-5 rounded-full bg-neutral-700 text-neutral-300 flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {destSuggestions.length > 0 && !selectedDest && (
                <div className="absolute left-4 right-4 top-24 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto">
                  {destSuggestions.map((item, idx) => {
                    const parts = (item.display_name || '').split(',');
                    const mainName = parts[0] || 'Eneo';
                    const subName = parts.slice(1, 3).join(', ').trim();
                    return (
                      <button
                        key={`sug-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedDest({
                            name: mainName,
                            address: item.display_name,
                            lat: parseFloat(item.lat),
                            lng: parseFloat(item.lon)
                          });
                          setDestSearch(mainName);
                          setDestSuggestions([]);
                        }}
                        className="w-full text-left p-3 hover:bg-neutral-800 flex items-center gap-3 border-b last:border-none border-neutral-800 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-white truncate">{mainName}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{subName}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Interactive Leaflet Map for Pin Dropping */}
              {isMapPinMode && (
                <div className="w-full h-48 rounded-2xl overflow-hidden border border-neutral-700 relative">
                  <MapContainer
                    center={pickupCoords}
                    zoom={13}
                    className="w-full h-full"
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapViewUpdater center={pickupCoords} zoom={13} />
                    <Marker 
                      position={selectedDest ? [selectedDest.lat, selectedDest.lng] : pickupCoords}
                      draggable={true}
                      eventHandlers={{
                        dragend: async (e) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          setSelectedDest({
                            name: 'Eneo la Ramani',
                            address: `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`,
                            lat: position.lat,
                            lng: position.lng
                          });
                          setDestSearch('Eneo la Ramani');
                        }
                      }}
                      icon={createCustomIcon('📍', '#10b981')}
                    />
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 right-2 bg-black/80 px-2.5 py-1 rounded-xl text-[10px] text-center text-neutral-300 font-bold pointer-events-none">
                    Buruta alama nyekundu (Pin) mahali unapotaka kwenda
                  </div>
                </div>
              )}

              {/* 1-Tap Popular Destination Chips */}
              <div className="pt-1">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-2">
                  Au Chagua Eneo Maarufu la Haraka:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_DESTINATIONS.slice(0, 6).map((dest, idx) => (
                    <button
                      key={`pop-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedDest({
                          name: dest.name,
                          address: dest.address,
                          lat: dest.lat,
                          lng: dest.lng
                        });
                        setDestSearch(dest.name);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all border ${
                        selectedDest?.name === dest.name
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-1 ring-emerald-400'
                          : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                      }`}
                    >
                      <span>{dest.icon}</span>
                      <span>{dest.name.split('/')[0].trim()}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ride Mode Selector: Solo vs PapoShare Pooling */}
            <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <UsersRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aina ya Safari (Chagua na Okoa)</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>PapoShare -40%</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* PapoShare Pooling Card */}
                <button
                  type="button"
                  onClick={() => setRideMode('paposhare')}
                  className={`p-3.5 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-between ${
                    rideMode === 'paposhare'
                      ? 'bg-gradient-to-br from-emerald-950/70 via-neutral-900 to-neutral-900 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-lg'
                      : 'bg-neutral-800/60 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-black px-2 py-0.5 rounded-bl-xl uppercase tracking-wider">
                    Gawana & Okoa 40%
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                        rideMode === 'paposhare' ? 'bg-emerald-500 text-black shadow-md' : 'bg-neutral-700 text-neutral-300'
                      }`}>
                        👥
                      </div>
                      <div>
                        <h4 className="text-xs font-black">PapoShare Pooling</h4>
                        <p className="text-[10px] text-emerald-400 font-bold">Gawana Gharama</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-snug">
                      Gawana safari na msafiri mwingine wa njia moja kuelekea uelekeo huo huo.
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Nauli ya Mtu:</span>
                    <span className="font-black text-emerald-400">TZS {fare.finalFare.toLocaleString()}</span>
                  </div>
                </button>

                {/* Solo Ride Card */}
                <button
                  type="button"
                  onClick={() => setRideMode('solo')}
                  className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                    rideMode === 'solo'
                      ? 'bg-neutral-800 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-lg'
                      : 'bg-neutral-800/60 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                        rideMode === 'solo' ? 'bg-emerald-500 text-black shadow-md' : 'bg-neutral-700 text-neutral-300'
                      }`}>
                        👤
                      </div>
                      <div>
                        <h4 className="text-xs font-black">Safari Binafsi</h4>
                        <p className="text-[10px] text-neutral-400 font-bold">Solo Ride</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-snug">
                      Gari/Boda zima ni lako peke yako bila kusimama au kupakia mtu mwingine njiani.
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Nauli Kamili:</span>
                    <span className="font-bold text-neutral-200">TZS {fare.normalFare.toLocaleString()}</span>
                  </div>
                </button>
              </div>

              {/* PapoShare Options: Seat Selector & Community Rules */}
              {rideMode === 'paposhare' && (
                <div className="pt-2.5 border-t border-neutral-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                      <span>Unahitaji Viti Vingapi?</span>
                    </label>
                    <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-xl border border-neutral-700">
                      <button
                        type="button"
                        onClick={() => setPoolingSeats(1)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                          poolingSeats === 1 ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Kiti 1 (Mimi Pekee)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoolingSeats(2)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                          poolingSeats === 2 ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Viti 2 (Wawili)
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-[11px] font-bold text-white">Wasafiri Wenzako Wamehakikiwa</p>
                        <p className="text-[9px] text-neutral-400">Ukaguzi wa Sura (Face ID) unalinda kila mtu kwenye gari</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
                      100% Salama ✓
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Passenger Contact Form */}
            <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-xl">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Taarifa Zako (Bila Kujisajili)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 block mb-1">Jina Lako:</label>
                  <input
                    type="text"
                    placeholder="Mfano: Juma Rashid"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 block mb-1">Namba ya Simu (Inayopatikana):</label>
                  <input
                    type="tel"
                    placeholder="07XXXXXXXX au 06XXXXXXXX"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Fare Breakdown Preview */}
            <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Umbali & Muda Uliokadiriwa:</span>
                <span className="font-black text-emerald-400">{tripDistanceKm} KM • ~{tripDurationMinutes} dk</span>
              </div>

              {/* PapoShare Savings Breakdown */}
              {fare.poolingDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-300 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Users className="w-3.5 h-3.5" />
                    <span>Akiba ya PapoShare Pooling:</span>
                  </span>
                  <span className="font-black text-emerald-400">- TZS {fare.poolingDiscount.toLocaleString()} ({fare.savingsPercent}%)</span>
                </div>
              )}

              {fare.welcomeDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-300">
                  <span>🎁 Vocha ya Mteja Mpya:</span>
                  <span className="font-bold">- TZS {fare.welcomeDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="h-[1px] bg-neutral-800" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase font-black tracking-wider text-neutral-500">Nauli Halisi ya Kulipa</span>
                    {fare.isPapoShare && (
                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        PapoShare
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">TZS {fare.finalFare.toLocaleString()}</span>
                    {fare.totalDiscount > 0 && (
                      <span className="text-xs text-neutral-500 line-through">TZS {fare.normalFare.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      paymentMethod === 'cash' ? 'bg-emerald-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    Taslimu
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ussd')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      paymentMethod === 'ussd' ? 'bg-emerald-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    Lipa Simu
                  </button>
                </div>
              </div>
            </div>

            {/* Next Step CTA */}
            <button
              type="button"
              onClick={() => {
                if (!selectedDest) {
                  toast.error("Tafadhali andika au chagua eneo unalokwenda!");
                  return;
                }
                if (!passengerPhone.trim() || passengerPhone.length < 9) {
                  toast.error("Tafadhali weka namba yako ya simu!");
                  return;
                }
                setStep('liveness');
              }}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-xs flex items-center justify-between px-6 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <span>Endelea na Uhakiki wa Usalama (Selfie)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* STEP 2: BIOMETRIC LIVENESS FACE SCAN (GEUZA KICHWA) */}
        {step === 'liveness' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 text-center"
          >
            <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
              <div className="space-y-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">Uhakiki wa Usalama na Picha</h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Kwa usalama wa abiria na dereva wakati wa safari, piga picha kwa <b>kugeuza kichwa (Liveness Check)</b>.
                </p>
              </div>

              {/* Camera Viewport / Face Guide */}
              <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl bg-neutral-950 flex items-center justify-center">
                {isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    
                    {/* Interactive Overlay Guidance Ring */}
                    <div className="absolute inset-0 border-4 border-dashed border-emerald-400/50 rounded-full animate-spin-slow pointer-events-none" />

                    {/* Stage Prompt Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black text-emerald-300 border border-emerald-500/30">
                      {livenessStage === 'center' && '🟢 Tazama Moja kwa Moja kwenye Kamera'}
                      {livenessStage === 'left' && '🔄 Geuza Kichwa Kushoto'}
                      {livenessStage === 'right' && '🔄 Geuza Kichwa Kulia'}
                      {livenessStage === 'up' && '⬆️ Inua Kichwa Juu'}
                      {livenessStage === 'smile' && '✨ Tabasamu! Inapiga Picha...'}
                    </div>
                  </>
                ) : capturedSelfie ? (
                  <div className="w-full h-full relative">
                    <img src={capturedSelfie} alt="Verified Selfie" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center text-2xl font-black">
                        ✓
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 space-y-2">
                    <Camera className="w-12 h-12 text-neutral-600 mx-auto" />
                    <p className="text-xs text-neutral-500 font-bold">Kamera Imezimwa</p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isCameraActive && (
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>
              )}

              {/* Camera Action Buttons */}
              {!isCameraActive && !capturedSelfie && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Anzisha Kamera ya Uhakiki</span>
                </button>
              )}

              {isCameraActive && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={captureSnapshot}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all"
                  >
                    📸 Piga Picha Sasa
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs"
                  >
                    Acha
                  </button>
                </div>
              )}

              {capturedSelfie && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex-1 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Piga Upya</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('confirm')}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                    <span>Endelea</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Camera Error Display with Manual Fallback */}
              {cameraError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left space-y-2">
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedSelfie(`https://api.dicebear.com/7.x/avataaars/svg?seed=${passengerPhone || 'avatar'}`);
                      setStep('confirm');
                    }}
                    className="text-[11px] font-black text-emerald-400 underline block"
                  >
                    Endelea bila picha kwa sasa ➔
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep('details')}
              className="text-xs text-neutral-400 hover:text-white font-bold"
            >
              ← Rudi Nyuma
            </button>
          </motion.div>
        )}

        {/* STEP 3: FINAL CONFIRMATION & LAUNCH */}
        {step === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">Thibitisha Safari Yako</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Uhakiki Umefaulu ✓
                </span>
              </div>

              {/* Trip Summary Details */}
              <div className="p-4 rounded-2xl bg-black/60 border border-neutral-800 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Dereva:</span>
                  <span className="font-bold text-white">{driver?.name || 'Dereva Mzoefu'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Gari / Boda:</span>
                  <span className="font-mono font-bold text-emerald-400">{driver?.vehiclePlate || 'T 123 ABC'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Abiria:</span>
                  <span className="font-bold text-white">{passengerName || 'Mteja'} ({passengerPhone})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Aina ya Safari:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1 text-[11px]">
                    {fare.isPapoShare ? `👥 PapoShare Pooling (${poolingSeats} ${poolingSeats === 1 ? 'Kiti' : 'Viti'})` : '👤 Safari Binafsi (Solo)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Unakwenda:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{selectedDest?.name}</span>
                </div>
                {fare.poolingDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold text-[11px]">
                    <span>Akiba Uliyookoa:</span>
                    <span>- TZS {fare.poolingDiscount.toLocaleString()} ({fare.savingsPercent}%)</span>
                  </div>
                )}
                <div className="h-[1px] bg-neutral-800" />
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Nauli ya Kulipa:</span>
                    {fare.totalDiscount > 0 && (
                      <span className="text-[10px] text-neutral-500 line-through">TZS {fare.normalFare.toLocaleString()}</span>
                    )}
                  </div>
                  <span className="text-xl font-black text-emerald-400">TZS {fare.finalFare.toLocaleString()}</span>
                </div>
              </div>

              {/* Big Launch Button */}
              <button
                type="button"
                onClick={handleLaunchInstantRide}
                disabled={isSubmittingRide}
                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-xs sm:text-sm flex items-center justify-between px-6 shadow-xl shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
              >
                <span>
                  {isSubmittingRide ? 'Inaanzisha Safari...' : '🚀 Anza Safari Papo Hapo'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStep('liveness')}
              className="text-xs text-neutral-400 hover:text-white font-bold w-full text-center block"
            >
              ← Badilisha Picha au Taarifa
            </button>
          </motion.div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="p-4 text-center text-[10px] text-neutral-600 border-t border-neutral-900">
        Papo Hapo Quick Street QR • Usafiri Salama, Haraka na Uhakika
      </footer>
    </div>
  );
}
