import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Navigation, 
  Phone, 
  MessageSquare, 
  Shield, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Share2, 
  Compass, 
  ArrowRight, 
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Bell,
  MessageCircle,
  Copy,
  Check,
  Star
} from 'lucide-react';
import { StandPoolingRoute, StandPassenger, cancelStandPassengerSeat } from '../../services/standPoolingService';
import { toast } from 'sonner';
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { playSyntheticImportant } from '../../utils/soundAlert';
import { RatingScreen } from '../tegex/RatingScreen';

interface PapoShareStendiLiveTrackerProps {
  route: StandPoolingRoute;
  passenger: StandPassenger;
  liveDriverPos?: { lat: number; lng: number; heading?: number } | null;
  onCenterMap?: () => void;
  onCancelBooking?: () => void;
  onCloseOrFinish?: () => void;
  onViewHistory?: () => void;
  theme?: 'dark' | 'light';
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function PapoShareStendiLiveTracker({
  route,
  passenger,
  liveDriverPos,
  onCenterMap,
  onCancelBooking,
  onCloseOrFinish,
  onViewHistory,
  theme = 'light'
}: PapoShareStendiLiveTrackerProps) {
  const isDark = theme === 'dark';
  const [isExpanded, setIsExpanded] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isCancelling, setIsCancelling] = useState(false);
  const [autoDismissSeconds, setAutoDismissSeconds] = useState<number | null>(null);

  // Rating & Tip state for post-trip
  const [hasRatedDriver, setHasRatedDriver] = useState(() => {
    const currentP = (route.passengers || []).find(p => p.passengerId === passenger.passengerId);
    return !!(currentP && (currentP as any).rating);
  });
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  // Stand ride representation for RatingScreen
  const standRideForRating = useMemo(() => ({
    id: route.id,
    status: 'completed',
    customerId: passenger.passengerId,
    customerName: passenger.passengerName,
    driverId: route.driverId,
    driverInfo: {
      name: route.driverName || 'Dereva wa Stendi',
      phone: route.driverPhone || '0700000000',
      photo: '',
      vehicle: {
        plate: route.vehiclePlate || 'T 000 AAA',
        model: route.vehicleModel || 'Toyota Hiace / Coaster',
        color: 'Nyeupe',
      },
      rating: route.driverRating || 4.9,
    },
    pickup: {
      name: route.standLocation?.name || 'Stendi Kuu',
      address: route.standLocation?.name || 'Stendi Kuu',
      lat: route.standLocation?.lat || -6.7924,
      lng: route.standLocation?.lng || 39.2083,
    },
    destination: {
      name: passenger.dropoffName,
      address: passenger.dropoffName,
      lat: passenger.dropoffLat,
      lng: passenger.dropoffLng,
    },
    fare: passenger.fare || route.fixedPricePerSeat,
    serviceType: 'stendi',
  } as any), [route, passenger]);

  const handleStandRatingSubmit = async (
    ratingVal: number,
    feedback: string[],
    commentText?: string,
    tipAmountVal?: number
  ) => {
    try {
      const routeRef = doc(db, 'stand_pooling_routes', route.id);
      const updatedPassengers = (route.passengers || []).map((p: any) => {
        if (p.passengerId === passenger.passengerId) {
          return {
            ...p,
            rating: ratingVal,
            feedback,
            comment: commentText || '',
            tip: tipAmountVal || 0,
            ratedAt: new Date().toISOString(),
          };
        }
        return p;
      });

      await updateDoc(routeRef, {
        passengers: updatedPassengers,
        updatedAt: serverTimestamp(),
      });

      if (route.driverId) {
        const driverRef = doc(db, 'users', route.driverId);
        const snap = await getDoc(driverRef);
        if (snap.exists()) {
          const uData = snap.data();
          const curR = uData.rating !== undefined ? Number(uData.rating) : 4.8;
          const curC = uData.ratingCount !== undefined ? Number(uData.ratingCount) : 0;
          const newC = curC + 1;
          const newR = ((curR * curC) + ratingVal) / newC;
          const updateP: any = {
            rating: parseFloat(newR.toFixed(1)),
            ratingCount: newC,
            updatedAt: serverTimestamp(),
          };
          if (tipAmountVal && tipAmountVal > 0) {
            updateP.walletBalance = increment(tipAmountVal);
            updateP.totalTips = increment(tipAmountVal);
          }
          await updateDoc(driverRef, updateP);
        }
      }

      setHasRatedDriver(true);
      setIsRatingModalOpen(false);
      if (tipAmountVal && tipAmountVal > 0) {
        toast.success(`Asante kwa kumpa ${route.driverName} nyota ${ratingVal} na bakshishi ya TZS ${tipAmountVal.toLocaleString()}! ⭐🎉`);
      } else {
        toast.success(`Asante kwa tathmini ya nyota ${ratingVal} kwa ${route.driverName}! ⭐`);
      }
      setAutoDismissSeconds(4);
    } catch (e) {
      console.error(e);
      toast.error('Hitilafu katika kutuma tathmini.');
    }
  };

  // Real-time listener for driver location fallback directly from drivers collection
  const [internalDriverPos, setInternalDriverPos] = useState<{ lat: number; lng: number; heading?: number } | null>(null);

  useEffect(() => {
    if (liveDriverPos) {
      setInternalDriverPos(liveDriverPos);
      return;
    }
    const driverUid = route.driverId;
    if (!driverUid) return;

    const unsub = onSnapshot(doc(db, 'drivers', driverUid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const pos = d.location || d.currentPosition;
        if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
          setInternalDriverPos({ lat: pos.lat, lng: pos.lng, heading: pos.heading ?? 0 });
        }
      }
    }, (err) => {
      console.warn("Stand live tracker driver listener:", err);
    });

    return () => unsub();
  }, [liveDriverPos, route.driverId]);

  const isTripStarted = route.status === 'started';
  const isThisPassengerDroppedOff = passenger.status === 'dropped_off';
  const isTripCompleted = route.status === 'completed' || isThisPassengerDroppedOff || passenger.status === 'completed';

  const otherActivePassengersCount = useMemo(() => {
    if (!route.passengers) return 0;
    return route.passengers.filter(
      (p) => p.passengerId !== passenger.passengerId && (p.status === 'booked' || p.status === 'boarded')
    ).length;
  }, [route.passengers, passenger.passengerId]);

  const droppedOtherPassengersCount = useMemo(() => {
    if (!route.passengers) return 0;
    return route.passengers.filter(
      (p) => p.passengerId !== passenger.passengerId && p.status === 'dropped_off'
    ).length;
  }, [route.passengers, passenger.passengerId]);

  useEffect(() => {
    if (isTripCompleted) {
      setIsExpanded(true);
    }
  }, [isTripCompleted]);

  // Once the driver marks the passenger as dropped off or trip is completed,
  // allow the customer to rate and tip the driver.
  useEffect(() => {
    if (isTripCompleted && hasRatedDriver && autoDismissSeconds === null) {
      setAutoDismissSeconds(3);
    }
  }, [isTripCompleted, hasRatedDriver, autoDismissSeconds]);

  useEffect(() => {
    if (autoDismissSeconds === null || isRatingModalOpen) return;
    if (autoDismissSeconds <= 0) {
      if (onCloseOrFinish) {
        onCloseOrFinish();
      }
      return;
    }
    const timer = setTimeout(() => {
      setAutoDismissSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoDismissSeconds, isRatingModalOpen, onCloseOrFinish]);

  // Second ticker for countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Distance & ETA calculation from driver location to passenger dropoff
  const { distanceKm, etaMinutes } = useMemo(() => {
    const driverLat = liveDriverPos?.lat ?? internalDriverPos?.lat ?? route.driverLocation?.lat ?? route.standLocation.lat;
    const driverLng = liveDriverPos?.lng ?? internalDriverPos?.lng ?? route.driverLocation?.lng ?? route.standLocation.lng;
    const targetLat = passenger.dropoffLat ?? route.destination.lat;
    const targetLng = passenger.dropoffLng ?? route.destination.lng;

    const dist = getDistanceKm(driverLat, driverLng, targetLat, targetLng);
    // Average urban speed 25 km/h in Dar es Salaam
    const etaMin = Math.max(1, Math.round((dist / 25) * 60));
    return {
      distanceKm: dist.toFixed(1),
      etaMinutes: etaMin
    };
  }, [liveDriverPos, internalDriverPos, route.driverLocation, route.standLocation, passenger.dropoffLat, passenger.dropoffLng, route.destination]);

  // 1. MPANGILIO WA VITUO VYA ABIRIA (DROP-OFF SEQUENCE)
  const dropoffSequence = useMemo(() => {
    const driverLat = liveDriverPos?.lat ?? internalDriverPos?.lat ?? route.driverLocation?.lat ?? route.standLocation.lat;
    const driverLng = liveDriverPos?.lng ?? internalDriverPos?.lng ?? route.driverLocation?.lng ?? route.standLocation.lng;

    if (!route.passengers || route.passengers.length === 0) {
      return [{
        passengerId: passenger.passengerId,
        passengerName: passenger.passengerName || 'Wewe',
        dropoffName: passenger.dropoffName || route.destination.name,
        dropoffLat: passenger.dropoffLat ?? route.destination.lat,
        dropoffLng: passenger.dropoffLng ?? route.destination.lng,
        seats: passenger.seats,
        status: passenger.status,
        remainingDistanceKm: getDistanceKm(driverLat, driverLng, passenger.dropoffLat ?? route.destination.lat, passenger.dropoffLng ?? route.destination.lng),
        isMe: true
      }];
    }

    const activeList = route.passengers
      .filter((p) => p.status === 'booked' || p.status === 'boarded' || p.passengerId === passenger.passengerId)
      .map((p) => {
        const pLat = p.dropoffLat ?? route.destination.lat;
        const pLng = p.dropoffLng ?? route.destination.lng;
        const dist = getDistanceKm(driverLat, driverLng, pLat, pLng);
        return {
          ...p,
          remainingDistanceKm: dist,
          isMe: p.passengerId === passenger.passengerId
        };
      });

    // Sort ascending by remaining distance from driver
    activeList.sort((a, b) => a.remainingDistanceKm - b.remainingDistanceKm);
    return activeList;
  }, [route.passengers, passenger.passengerId, liveDriverPos, internalDriverPos, route.driverLocation, route.standLocation]);

  const myDropoffIndex = useMemo(() => {
    return dropoffSequence.findIndex(p => p.passengerId === passenger.passengerId);
  }, [dropoffSequence, passenger.passengerId]);

  const myDropoffRank = myDropoffIndex !== -1 ? myDropoffIndex + 1 : 1;
  const totalActiveDropoffs = dropoffSequence.length;

  // 2. MAELEKEZO YA SAUTI NA ARIFA ZA NJIA (VOICE NAVIGATION & SOUND ALERTS)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const voiceAnnouncedRef = React.useRef<{ started?: boolean; near?: boolean; arrived?: boolean }>({});

  const speakPrompt = (text: string) => {
    if (!isVoiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'sw-TZ';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech error:", e);
    }
  };

  useEffect(() => {
    if (isTripStarted && !isTripCompleted) {
      // 1. Trip started announcement
      if (!voiceAnnouncedRef.current.started) {
        voiceAnnouncedRef.current.started = true;
        playSyntheticImportant();
        speakPrompt(`Safari ya stendi imeanza. Dereva ${route.driverName} yupo njiani kuelekea vituoni.`);
      }

      // 2. Proximity alert: when within 400m from passenger's dropoff
      const distKmNum = parseFloat(distanceKm);
      if (!isNaN(distKmNum) && distKmNum <= 0.40 && !voiceAnnouncedRef.current.near) {
        voiceAnnouncedRef.current.near = true;
        playSyntheticImportant();
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        speakPrompt(`Umekaribia kituo chako cha ${passenger.dropoffName || 'kushukia'}. Tafadhali jiandae kushuka!`);
        toast.info(`🔔 Umekaribia kituo chako (${Math.round(distKmNum * 1000)}m)! Jiandae kushuka.`, {
          duration: 6000
        });
      }
    }

    // 3. Dropoff completed
    if (isThisPassengerDroppedOff && !voiceAnnouncedRef.current.arrived) {
      voiceAnnouncedRef.current.arrived = true;
      playSyntheticImportant();
      speakPrompt(`Umefika kituo chako salama. Asante kwa kusafiri na Papo!`);
    }
  }, [isTripStarted, isTripCompleted, isThisPassengerDroppedOff, distanceKm, passenger.dropoffName, route.driverName]);

  // Departure countdown string if waiting at stand
  const countdownText = useMemo(() => {
    if (route.status !== 'boarding' && route.status !== 'full') return null;
    if (!route.departureTargetTimestamp) {
      return route.departureEstimate === 'when_full' ? 'Likijaa huondoka' : (route.departureTimeText || 'Inasubiri...');
    }
    const diff = Math.max(0, Math.floor((route.departureTargetTimestamp - nowMs) / 1000));
    if (diff === 0) return 'Muda wa kuondoka umefika!';
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `Inaondoka baada ya: ${minutes}d ${seconds < 10 ? '0' : ''}${seconds}s`;
  }, [route.status, route.departureTargetTimestamp, route.departureEstimate, route.departureTimeText, nowMs]);

  const handleCancel = async () => {
    if (route.status === 'started') {
      toast.error("Safari tayari imeanza, huwezi kughairi kiti kwa sasa.");
      return;
    }
    if (!window.confirm("Je, una uhakika unataka kughairi nafasi yako kwenye safari hii ya stendi?")) {
      return;
    }

    setIsCancelling(true);
    try {
      await cancelStandPassengerSeat(route.id, passenger.passengerId);
      try {
        localStorage.removeItem('papo_active_stand_trip');
      } catch {}
      toast.success("Umeghairi kiti chako cha stendi kikamilifu.");
      if (onCancelBooking) onCancelBooking();
    } catch (e: any) {
      toast.error(e?.message || "Imeshindikana kughairi kiti.");
    } finally {
      setIsCancelling(false);
    }
  };

  // 3. KUSHIRIKI SAFARI MOJA KWA MOJA WHATSAPP (SHARE TRIP LINK)
  const trackingUrl = `${window.location.origin}/track/${route.id}?type=stendi`;

  const handleWhatsAppShare = () => {
    const text = `🚗 *Habari! Nipo kwenye safari ya PapoShare Stendi.*\n\n` +
      `👤 *Dereva:* ${route.driverName} (${route.vehiclePlate || 'Chombo'})\n` +
      `📍 *Kupandia:* ${passenger.pickupName || route.standLocation.name}\n` +
      `🏁 *Kushukia:* ${passenger.dropoffName || route.destination.name}\n` +
      `⏱️ *Muda Uliobaki:* Dk ${etaMinutes} (${distanceKm} km)\n\n` +
      `🔗 *Fuatilia safari yangu moja kwa moja hapa:*\n${trackingUrl}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(trackingUrl);
      toast.success("Kiungo cha safari kimenakiliwa!");
    } else if (navigator.share) {
      navigator.share({
        title: 'Fuatilia Safari Yangu - PapoShare Stendi',
        text: `Fuatilia safari yangu ya stendi na dereva ${route.driverName}:`,
        url: trackingUrl
      }).catch(() => {});
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto pointer-events-auto select-none font-sans">
      {/* 1. TOP FLOATING STATUS PILL */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-2 px-3 py-2 rounded-2xl backdrop-blur-xl shadow-xl border flex items-center justify-between text-xs font-bold transition-all"
        style={{
          background: isTripCompleted 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))'
            : isTripStarted 
              ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.95), rgba(16, 185, 129, 0.95))' 
              : isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isTripStarted || isTripCompleted ? 'rgba(255, 255, 255, 0.3)' : (isDark ? '#334155' : '#e2e8f0'),
          color: isTripStarted || isTripCompleted ? '#ffffff' : (isDark ? '#f8fafc' : '#0f172a')
        }}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {isTripStarted && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              isTripCompleted ? 'bg-white' : isTripStarted ? 'bg-emerald-300' : 'bg-amber-400'
            }`}></span>
          </span>
          <div className="leading-tight">
            <span className="font-black text-[11px] uppercase tracking-wider block">
              {isThisPassengerDroppedOff
                ? '🏁 UMEFIKA KITUO CHAKO!'
                : route.status === 'completed'
                  ? '🏁 SAFARI YOTE IMEKAMILIKA'
                  : isTripStarted
                    ? '🚀 SAFARI IMEANZA • DEREVA YUPO NJIANI'
                    : '🟡 KIJIWENI • INASUBIRI KUONDOKA'}
            </span>
            <span className="text-[10px] opacity-90 font-medium">
              {isThisPassengerDroppedOff
                ? `Umeshushwa salama (${passenger.dropoffName}). Karibu tena!`
                : route.status === 'completed'
                  ? 'Safari imekamilika! Asante kwa kusafiri na Papo.'
                  : isTripStarted
                    ? (droppedOtherPassengersCount > 0 
                        ? `Njiani kuelekea kwako (${passenger.dropoffName}) • Wenzako ${otherActivePassengersCount} safarini`
                        : `Takriban Dk ${etaMinutes} (${distanceKm} km) • Wenzako ${otherActivePassengersCount} safarini`)
                    : countdownText}
            </span>
          </div>
        </div>

        {onCenterMap && (
          <button
            type="button"
            onClick={onCenterMap}
            className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
            title="Weka Ramani Katikati"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Ramani</span>
          </button>
        )}
      </motion.div>

      {/* 2. MAIN BOTTOM TRACKING CARD */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`rounded-3xl shadow-2xl border-2 transition-all overflow-hidden ${
          isDark ? 'bg-[#0f1422] border-emerald-500/30 text-white' : 'bg-white border-emerald-500/40 text-slate-900'
        }`}
      >
        {/* Card Header with Minimizer */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-3.5 flex items-center justify-between cursor-pointer border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
              {route.vehicleType === 'boda' ? '🏍️' : route.vehicleType === 'bajaj' ? '🛺' : '🚗'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                  {route.driverName}
                </h4>
                {route.isVerifiedDriver && (
                  <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                )}
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                  ★ {route.driverRating || 4.9}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                {route.vehicleModel || (route.vehicleType === 'boda' ? 'Pikipiki Boxer' : route.vehicleType === 'bajaj' ? 'Bajaji TVS' : 'Mini Car')} • <b className="text-neutral-700 dark:text-neutral-200">{route.vehiclePlate || 'T 240 ABC'}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice and sound toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsVoiceEnabled(!isVoiceEnabled);
                toast.info(!isVoiceEnabled ? "Sauti za safari zimewashwa 🔊" : "Sauti za safari zimezimwa 🔇");
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isVoiceEnabled 
                  ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' 
                  : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-400'
              }`}
              title={isVoiceEnabled ? "Zima Maelekezo ya Sauti" : "Washa Maelekezo ya Sauti"}
            >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {route.driverPhone && (
              <a
                href={`tel:${route.driverPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition-all active:scale-95"
                title="Piga Simu Dereva"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 space-y-3.5"
            >
              {/* Proximity Alert: within 400 meters of passenger drop-off */}
              {isTripStarted && !isTripCompleted && parseFloat(distanceKm) <= 0.40 && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/70 flex items-center gap-3 animate-pulse shadow-sm"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
                    🔔
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        Umekaribia Kituo Chako ({Math.round(parseFloat(distanceKm) * 1000)}m)
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white shrink-0">
                        Jiandae
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 dark:text-amber-100 font-medium">
                      Kituo chako cha <b>{passenger.dropoffName || route.destination.name}</b> kiko mbele kidogo. Chombo kinakaribia kukusimamishia!
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Trip Stepper: Kijiweni -> Njiani -> Ushukapo */}
              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-2xl bg-neutral-100 dark:bg-neutral-900/80 text-center text-[10px] font-bold">
                <div className={`p-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-all ${
                  !isTripStarted && !isTripCompleted 
                    ? 'bg-emerald-600 text-white shadow-xs font-black' 
                    : 'text-neutral-500'
                }`}>
                  <span>1. Kijiweni</span>
                  <span className="text-[8px] opacity-80">
                    {!isTripStarted ? `${route.availableSeats} viti vipo` : 'Umeondoka ✓'}
                  </span>
                </div>
                <div className={`p-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-all ${
                  isTripStarted && !isTripCompleted 
                    ? 'bg-teal-600 text-white shadow-xs font-black' 
                    : 'text-neutral-500'
                }`}>
                  <span>2. Njiani 🚀</span>
                  <span className="text-[8px] opacity-80">
                    {isTripStarted ? `Dk ${etaMinutes} (${distanceKm} km)` : 'Inasubiriwa'}
                  </span>
                </div>
                <div className={`p-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-all ${
                  isTripCompleted 
                    ? 'bg-emerald-600 text-white shadow-xs font-black' 
                    : 'text-neutral-500'
                }`}>
                  <span>3. Umefika</span>
                  <span className="text-[8px] opacity-80">
                    {isTripCompleted ? 'Tayari ✓' : 'Mwisho'}
                  </span>
                </div>
              </div>

              {/* 1. DROP-OFF SEQUENCE CARD (MPANGILIO WA VITUO VYA KUSHUKA) */}
              {isTripStarted && !isTripCompleted && totalActiveDropoffs > 1 && (
                <div className="p-3 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Mpangilio wa Kushuka ({totalActiveDropoffs} vituo)</span>
                    </span>
                    <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                      myDropoffRank === 1 
                        ? 'bg-emerald-500 text-white animate-pulse' 
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {myDropoffRank === 1 ? '🎯 Unafuata Wewe Sasa' : `Kituo #${myDropoffRank}`}
                    </span>
                  </div>

                  <div className="text-[11.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    {myDropoffRank === 1 ? (
                      <span>Wewe ndiye abiria wa <b>kwanza</b> kushuka njiani. Dereva anaelekea kituo chako cha <b>{passenger.dropoffName}</b> moja kwa moja!</span>
                    ) : (
                      <span>Wewe ni abiria wa <b>{myDropoffRank}</b> kushuka. Kuna kituo <b>{myDropoffRank - 1}</b> cha abiria mwenzako kabla ya kufika kituo chako cha <b>{passenger.dropoffName}</b>.</span>
                    )}
                  </div>

                  {/* Horizontal visual sequence steps */}
                  <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 no-scrollbar">
                    {dropoffSequence.map((stepP, idx) => {
                      const isMe = stepP.passengerId === passenger.passengerId;
                      return (
                        <div
                          key={stepP.passengerId}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold shrink-0 flex items-center gap-1.5 border transition-all ${
                            isMe 
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm' 
                              : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[9px] font-black">
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[100px]">
                            {isMe ? 'Wewe' : (stepP.passengerName || 'Abiria')}
                          </span>
                          {isMe && <span className="text-amber-300">★</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Waypoints route display */}
              <div className="space-y-2 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 bg-neutral-50/70 dark:bg-[#141926]">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Kupandia (Stendi / Kijiwe)</span>
                    <p className="text-xs font-black text-neutral-800 dark:text-neutral-200 truncate">
                      {passenger.pickupName || route.standLocation.name}
                    </p>
                  </div>
                </div>

                <div className="ml-2.5 pl-3 border-l-2 border-dashed border-emerald-400/50 py-1 space-y-1">
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>Safari ya Pamoja (Stendi Pooling) • Siti {passenger.seats}</span>
                  </span>
                  {isTripStarted && !isTripCompleted && otherActivePassengersCount > 0 && (
                    <p className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400">
                      👥 Wapo abiria wengine {otherActivePassengersCount} kwenye chombo kuelekea vituo vyao
                    </p>
                  )}
                  {droppedOtherPassengersCount > 0 && (
                    <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Abiria mwingine ameshushwa kituo chake njiani
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                    B
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">Kushukia (Drop-off Yako)</span>
                    <p className="text-xs font-black text-neutral-800 dark:text-neutral-200 truncate">
                      {passenger.dropoffName || route.destination.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fare and Seats summary */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                    NAULI YA STENDI
                  </span>
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                    {passenger.seats} {passenger.seats > 1 ? 'Viti' : 'Kiti'} • Lipa Taslimu / Simu
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    TZS {passenger.fare.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-1 flex items-center gap-2">
                {!isTripCompleted && (
                  <>
                    {/* Direct WhatsApp Share Button */}
                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
                      title="Tuma kiungo cha safari moja kwa moja WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Shiriki WhatsApp</span>
                    </button>

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="py-2.5 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                      title="Nakili Kiungo cha Safari"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Nakili</span>
                    </button>
                  </>
                )}

                {!isTripStarted && !isTripCompleted && (
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={handleCancel}
                    className="py-2.5 px-3 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-[11px] font-bold text-rose-500 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCancelling ? 'Inaghairi...' : 'Ghairi Kiti'}
                  </button>
                )}

                {isTripCompleted && (
                  <div className="w-full flex flex-col gap-2">
                    {/* Clear status badge informing customer that drop-off is already finalized by the driver */}
                    <div className="w-full py-2 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center justify-between text-xs font-bold shadow-xs">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">Dereva amekamilisha kukushusha</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-extrabold shrink-0 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        {autoDismissSeconds !== null && autoDismissSeconds > 0 
                          ? `Inafunga (${autoDismissSeconds}s)` 
                          : 'Imekamilika ✓'}
                      </span>
                    </div>

                    {/* Rating & Tip CTA if not yet rated */}
                    {!hasRatedDriver ? (
                      <button
                        type="button"
                        onClick={() => setIsRatingModalOpen(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                      >
                        <Star className="w-4 h-4 fill-white text-white" />
                        <span>Tathmini Dereva & Toa Bakshishi ⭐</span>
                      </button>
                    ) : (
                      <div className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                        <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                        <span>Umemtathmini dereva na kutoa bakshishi! Asante.</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {onViewHistory && (
                        <button
                          type="button"
                          onClick={onViewHistory}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Safari Zangu</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onCloseOrFinish}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 text-center"
                      >
                        Sawa, Asante ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stand Rating & Tip Modal */}
      {isRatingModalOpen && (
        <RatingScreen
          ride={standRideForRating}
          onSubmit={handleStandRatingSubmit}
          onSkip={() => {
            setIsRatingModalOpen(false);
            setAutoDismissSeconds(3);
          }}
        />
      )}
    </div>
  );
}
