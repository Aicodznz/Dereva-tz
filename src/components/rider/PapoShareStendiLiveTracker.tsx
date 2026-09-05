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
  Sparkles
} from 'lucide-react';
import { StandPoolingRoute, StandPassenger, cancelStandPassengerSeat } from '../../services/standPoolingService';
import { toast } from 'sonner';

interface PapoShareStendiLiveTrackerProps {
  route: StandPoolingRoute;
  passenger: StandPassenger;
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

  // Second ticker for countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Distance & ETA calculation from driver location to passenger dropoff
  const { distanceKm, etaMinutes } = useMemo(() => {
    const driverLat = route.driverLocation?.lat ?? route.standLocation.lat;
    const driverLng = route.driverLocation?.lng ?? route.standLocation.lng;
    const targetLat = passenger.dropoffLat ?? route.destination.lat;
    const targetLng = passenger.dropoffLng ?? route.destination.lng;

    const dist = getDistanceKm(driverLat, driverLng, targetLat, targetLng);
    // Average urban speed 25 km/h in Dar es Salaam
    const etaMin = Math.max(1, Math.round((dist / 25) * 60));
    return {
      distanceKm: dist.toFixed(1),
      etaMinutes: etaMin
    };
  }, [route.driverLocation, route.standLocation, passenger.dropoffLat, passenger.dropoffLng, route.destination]);

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

  const handleShare = () => {
    const shareText = `Ninafuatilia safari yangu ya PapoShare Stendi na dereva ${route.driverName} (${route.vehiclePlate || 'Chombo'}) kuelekea ${passenger.dropoffName || route.destination.name}!`;
    if (navigator.share) {
      navigator.share({
        title: 'Fuatilia Safari Yangu - PapoShare Stendi',
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareText} - ${window.location.href}`);
      toast.success("Kiungo cha safari kimenakiliwa!");
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
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Shiriki Safari</span>
                  </button>
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
                  <>
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
                      Maliza & Funga ✓
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
