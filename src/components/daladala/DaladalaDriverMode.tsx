import React, { useState, useEffect, useMemo } from 'react';
import { 
  DaladalaVehicle, 
  DaladalaRoute, 
  DaladalaPassengerRecord, 
  DaladalaSessionUser,
  FleetVehicleRecord 
} from '../../types/daladala.types';
import { 
  Gauge, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  MapPin, 
  Users, 
  ArrowRight, 
  ShieldAlert, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Clock, 
  Compass, 
  Radio, 
  PhoneCall, 
  FileText, 
  Share2, 
  Wrench, 
  AlertOctagon, 
  Car, 
  ChevronRight, 
  Eye, 
  RefreshCw,
  Zap,
  Info,
  Ban,
  Smartphone,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  announceNextStation, 
  announceArrivalAtStation, 
  announceSpeedLimitExceeded, 
  announceEmergencyReport,
  speakKiswahili,
  playTransitChime
} from '../../utils/daladalaAudioVoice';
import DaladalaDailyOwnerReportModal from './DaladalaDailyOwnerReportModal';

interface DaladalaDriverModeProps {
  vehicle: DaladalaVehicle;
  route?: DaladalaRoute;
  allVehicles?: DaladalaVehicle[];
  onSelectVehicle?: (v: DaladalaVehicle) => void;
  onUpdateVehicle: (updated: Partial<DaladalaVehicle>) => void;
  passengers?: DaladalaPassengerRecord[];
  fleetRecords?: FleetVehicleRecord[];
  sessionUser?: DaladalaSessionUser | null;
  onOpenConductorMode?: () => void;
  onOpenFleetDashboard?: () => void;
  onLogout?: () => void;
}

export default function DaladalaDriverMode({
  vehicle,
  route,
  allVehicles = [],
  onSelectVehicle,
  onUpdateVehicle,
  passengers = [],
  fleetRecords = [],
  sessionUser,
  onOpenConductorMode,
  onOpenFleetDashboard,
  onLogout,
}: DaladalaDriverModeProps) {
  // Speed simulation / live speed state (km/h)
  const [speed, setSpeed] = useState<number>(vehicle.speedKmH || 38);
  const LATRA_SPEED_LIMIT = 50; // Standard urban speed limit in km/h

  // Stop progression state
  const stops = route?.stops || [];
  const initialStopIndex = Math.max(
    0,
    stops.findIndex((s) => s.id === vehicle.nextStopId || s.name === vehicle.nextStopName)
  );
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(
    initialStopIndex >= 0 ? initialStopIndex : 0
  );

  // Audio Voice State
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [lastSpeedWarning, setLastSpeedWarning] = useState<number>(0);

  // Emergency Modal State
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('Pancha ya Tairi');
  const [emergencyDetails, setEmergencyDetails] = useState<string>('');
  const [isEmergencyDispatched, setIsEmergencyDispatched] = useState(false);

  // Daily Accounting Report Modal State
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);

  // Road Safety & Hands-Free Mount Mode
  const [handsFreeLocked, setHandsFreeLocked] = useState<boolean>(true);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);

  // Active stop object
  const currentStop = stops[currentStopIndex] || {
    id: vehicle.nextStopId,
    name: vehicle.nextStopName,
    lat: vehicle.currentLat,
    lng: vehicle.currentLng,
  };

  // Next subsequent stop (the one after the current target)
  const upcomingStop = stops[currentStopIndex + 1] || null;

  // Passengers getting off at current stop
  const passengersAlightingHere = useMemo(() => {
    return passengers.filter(
      (p) =>
        p.plateNumber.toLowerCase().replace(/\s+/g, '') === vehicle.plateNumber.toLowerCase().replace(/\s+/g, '') &&
        (p.destinationStop.toLowerCase().includes(currentStop.name.toLowerCase()) ||
         currentStop.name.toLowerCase().includes(p.destinationStop.toLowerCase()))
    );
  }, [passengers, vehicle.plateNumber, currentStop.name]);

  // Approximate passengers waiting at this stop (sample simulation)
  const waitingPassengersCount = useMemo(() => {
    const hash = currentStop.name.length;
    return (hash % 6) + 2;
  }, [currentStop.name]);

  // Speed Status Classification
  const speedStatus: 'safe' | 'warning' | 'danger' = useMemo(() => {
    if (speed > LATRA_SPEED_LIMIT) return 'danger';
    if (speed >= LATRA_SPEED_LIMIT - 5) return 'warning';
    return 'safe';
  }, [speed]);

  // Trigger audio alert when speed exceeds LATRA limit
  useEffect(() => {
    if (speed > LATRA_SPEED_LIMIT && voiceEnabled) {
      const now = Date.now();
      // Throttle speech alerts to once every 10 seconds
      if (now - lastSpeedWarning > 10000) {
        setLastSpeedWarning(now);
        announceSpeedLimitExceeded(speed, LATRA_SPEED_LIMIT);
        toast.error(`🚨 TAHADHARI: Umezidisha Spidi ya LATRA (${speed} km/h)! Punguza mwendo mara moja!`);
      }
    }
  }, [speed, voiceEnabled, lastSpeedWarning]);

  // Speed handlers
  const handleIncreaseSpeed = (amount: number = 5) => {
    const newSpeed = Math.min(95, speed + amount);
    setSpeed(newSpeed);
    onUpdateVehicle({ speedKmH: newSpeed });
  };

  const handleDecreaseSpeed = (amount: number = 5) => {
    const newSpeed = Math.max(0, speed - amount);
    setSpeed(newSpeed);
    onUpdateVehicle({ speedKmH: newSpeed });
  };

  const handleSetPresetSpeed = (preset: number) => {
    setSpeed(preset);
    onUpdateVehicle({ speedKmH: preset });
  };

  // Station Announcement Actions
  const handleAnnounceCurrentStop = () => {
    if (!voiceEnabled) {
      toast.info('Washa sauti kwanza ili kutangaza.');
      return;
    }
    announceNextStation(currentStop.name, passengersAlightingHere.length);
    toast.success(`Inatangaza kwa sauti: Kituo cha ${currentStop.name}`);
  };

  const handleAnnounceArrival = () => {
    if (!voiceEnabled) {
      toast.info('Washa sauti kwanza ili kutangaza.');
      return;
    }
    announceArrivalAtStation(currentStop.name);
    toast.success(`Inatangaza kuwasili kituoni: ${currentStop.name}`);
  };

  // Next Stop Progression
  const handleAdvanceToNextStop = () => {
    if (currentStopIndex < stops.length - 1) {
      const nextIdx = currentStopIndex + 1;
      setCurrentStopIndex(nextIdx);
      const nextStp = stops[nextIdx];
      onUpdateVehicle({
        nextStopId: nextStp.id,
        nextStopName: nextStp.name,
      });

      if (voiceEnabled) {
        setTimeout(() => {
          announceNextStation(nextStp.name);
        }, 500);
      }
      toast.success(`Kituo kimewekwa: ${nextStp.name}`);
    } else {
      toast.success('Umefika mwisho wa safari (Mwisho wa Ruti)!');
      speakKiswahili('Umefika mwisho wa safari. Washushe abiria wote salama.');
    }
  };

  // Emergency Dispatch Action
  const handleDispatchEmergency = () => {
    announceEmergencyReport(emergencyReason);
    setIsEmergencyDispatched(true);
    setIsEmergencyModalOpen(false);
    onUpdateVehicle({
      isOffRoute: true,
      offRouteReason: `${emergencyReason}: ${emergencyDetails || 'Imeripotiwa na dereva'}`,
    });
    toast.error(`Taarifa ya ${emergencyReason} imetumwa kwa mmiliki na kituo cha stendi!`, {
      duration: 6000,
    });
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-200">
      
      {/* Top Cockpit Status Bar */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-neutral-900 text-white border border-neutral-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Left: Driver Identity & Selected Daladala */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20">
            <Car className="w-6 h-6 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-neutral-950 text-xs font-black tracking-wider uppercase">
                {vehicle.plateNumber}
              </span>
              <h2 className="text-sm sm:text-base font-black text-white">
                {vehicle.nickname || 'Daladala'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                HUD DEREVA LIVE
              </span>
            </div>

            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              Dereva: <strong className="text-white">{sessionUser?.fullName || vehicle.driverName}</strong> • Ruti: {vehicle.routeName} ({vehicle.routeCode})
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Voice Switcher Toggle */}
          <button
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              if (next) {
                playTransitChime();
                toast.success('Sauti za Kiswahili zimewashwa!');
              } else {
                toast.info('Sauti zimezimwa.');
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
              voiceEnabled
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
            title="Washa au Zima Sauti ya Vituo na Mwendo Kasi"
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{voiceEnabled ? 'Sauti: IMEWASHWA' : 'Sauti: IMEZIMWA'}</span>
          </button>

          {/* Test Voice Audio Button */}
          <button
            onClick={() => {
              announceNextStation(currentStop.name, passengersAlightingHere.length);
            }}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-neutral-700"
            title="Jaribu Sauti ya Kiswahili"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Jaribu Sauti</span>
          </button>

          {/* Switch to Conductor Mode */}
          {onOpenConductorMode && (
            <button
              onClick={onOpenConductorMode}
              className="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Skrini ya Konda</span>
            </button>
          )}

          {/* End of Day Report Button */}
          <button
            onClick={() => setIsDailyReportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition active:scale-95"
            title="Tuma Hesabu ya Leo WhatsApp ya Tajiri"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Hesabu ya Tajiri</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🛡️ ROAD SAFETY & HANDS-FREE MOUNT PROTOCOL BANNER         */}
      {/* ========================================================= */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/40 text-white border border-amber-500/40 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 relative">
              <Smartphone className="w-5 h-5 text-amber-400" />
              <Ban className="w-3.5 h-3.5 text-rose-500 absolute -top-1 -right-1" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  SHERIA YA USALAMA BARABARANI
                </span>
                <span className="text-xs font-black text-amber-400">
                  Simu Haishikwi Mkononi! Weka Kwenye Stendi (Phone Mount)
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                Dereva hapaswi kuchezea simu akiwa kwenye usukani. Skrini hii inajiendesha <strong className="text-white">100% kwa Sauti (Hands-Free) na GPS</strong>. Shughuli zote za kukata nauli na ripoti hufanywa na <strong className="text-amber-300">Kondakta (Konda)</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            {/* Drive Lock Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !handsFreeLocked;
                setHandsFreeLocked(next);
                if (next) {
                  toast.success('Hali ya Usalama (Hands-Free Lock) Imewashwa: Skrini imefungwa ili usichezee simu!');
                } else {
                  toast.info('Hali ya Usalama imefunguliwa kwa matengenezo.');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                handsFreeLocked
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
              title="Funga skrini ili dereva asibonyeze kimakosa akiwa barabarani"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{handsFreeLocked ? 'Skrini Imelindwa (Drive Lock)' : 'Fungua Skrini'}</span>
            </button>

            {/* Read Safety Guide Modal Button */}
            <button
              type="button"
              onClick={() => setIsSafetyModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 transition active:scale-95"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Kwanini Usichezee Simu?</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Speedometer Gauge & Right Next Stop Station HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ========================================================= */}
        {/* 1. SPEEDOMETER & LATRA SPEED COMPLIANCE (5 Columns)        */}
        {/* ========================================================= */}
        <div className={`lg:col-span-5 p-5 rounded-3xl border shadow-xl flex flex-col justify-between transition-colors duration-300 ${
          speedStatus === 'danger'
            ? 'bg-rose-950/90 border-rose-500 text-white animate-pulse'
            : speedStatus === 'warning'
            ? 'bg-amber-950/70 border-amber-500 text-white'
            : 'bg-neutral-900 border-neutral-800 text-white'
        }`}>
          
          {/* Speedometer Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className={`w-5 h-5 ${
                speedStatus === 'danger' ? 'text-rose-400' : speedStatus === 'warning' ? 'text-amber-400' : 'text-emerald-400'
              }`} />
              <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                Speedometer ya LATRA
              </span>
            </div>

            {/* LATRA Limit Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-neutral-700">
              <span className="text-[10px] text-neutral-400 font-bold uppercase">Kikomo:</span>
              <span className="text-xs font-black text-amber-400">{LATRA_SPEED_LIMIT} km/h</span>
            </div>
          </div>

          {/* Giant Speed Number Display */}
          <div className="py-6 sm:py-8 text-center flex flex-col items-center justify-center">
            
            <div className="relative">
              {/* Outer decorative speed arc */}
              <div className="text-7xl sm:text-8xl font-black tracking-tighter select-none font-mono flex items-baseline justify-center">
                <span className={
                  speedStatus === 'danger' 
                    ? 'text-rose-400 drop-shadow-[0_0_25px_rgba(244,63,94,0.8)]' 
                    : speedStatus === 'warning' 
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }>
                  {speed}
                </span>
                <span className="text-xl sm:text-2xl font-bold ml-2 text-neutral-400">
                  km/h
                </span>
              </div>
            </div>

            {/* Status Alert Message Under Speed */}
            <div className="mt-3">
              {speedStatus === 'danger' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-rose-600 text-white text-xs font-black shadow-lg animate-bounce">
                  <AlertTriangle className="w-4 h-4" />
                  <span>🚨 UMEZIDISHA SPIDI YA LATRA! (Faini TSh 30,000)</span>
                </div>
              )}

              {speedStatus === 'warning' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 text-neutral-950 text-xs font-black">
                  <AlertTriangle className="w-4 h-4" />
                  <span>⚠️ Unakaribia Kikomo cha LATRA ({LATRA_SPEED_LIMIT} km/h)</span>
                </div>
              )}

              {speedStatus === 'safe' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mwendo Salama (Ndani ya Sheria)</span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Driver Speed Controls / Simulator */}
          <div className="space-y-2.5 pt-3 border-t border-neutral-800/80">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-bold">
              <span>Vidhibiti vya Spidi ya Dereva:</span>
              <span>Kikomo cha Mjini: 50 km/h</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <button
                onClick={() => handleDecreaseSpeed(5)}
                className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs transition active:scale-95 border border-neutral-700"
              >
                -5 km/h
              </button>

              <button
                onClick={() => handleDecreaseSpeed(15)}
                className="py-2.5 rounded-xl bg-rose-900/60 hover:bg-rose-900 text-rose-200 font-black text-xs transition active:scale-95 border border-rose-700"
                title="Piga Breki"
              >
                🛑 Breki
              </button>

              <button
                onClick={() => handleIncreaseSpeed(5)}
                className="py-2.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 font-black text-xs transition active:scale-95 border border-emerald-700"
                title="Kanyaga Gasi"
              >
                🚀 +5 km/h
              </button>

              <button
                onClick={() => handleIncreaseSpeed(10)}
                className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs transition active:scale-95 border border-neutral-700"
              >
                +10 km/h
              </button>
            </div>

            {/* Quick Speed Presets */}
            <div className="flex items-center justify-between gap-1 pt-1">
              {[
                { label: 'Foleni (15)', val: 15 },
                { label: 'Stendi (0)', val: 0 },
                { label: 'Kawaida (38)', val: 38 },
                { label: 'Kikomo (49)', val: 49 },
                { label: 'Zidisha (58)', val: 58 },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => handleSetPresetSpeed(p.val)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                    speed === p.val
                      ? 'bg-amber-400 text-neutral-950 font-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. KITUO KINACHOFUATA & ABIRIA WA KUSHUKA (7 Columns)       */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Next Stop Big HUD Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-5">
            
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    Kituo Kinachofuata (Next Stop)
                  </span>
                  <span className="text-xs text-neutral-500 font-medium">
                    Kituo #{currentStopIndex + 1} kati ya {stops.length} kwenye Ruti
                  </span>
                </div>
              </div>

              {/* Step indicator */}
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-black">
                  Meta ~350 • Dakika 2
                </span>
              </div>
            </div>

            {/* Giant Station Name */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                  {currentStop.name}
                </h3>
                {upcomingStop && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1">
                    <span>Kinachofuata baadaye:</span>
                    <strong className="text-neutral-700 dark:text-neutral-200">{upcomingStop.name}</strong>
                  </p>
                )}
              </div>

              {/* Announce Stop Voice Button */}
              <button
                onClick={handleAnnounceCurrentStop}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition active:scale-95 whitespace-nowrap"
              >
                <Volume2 className="w-4 h-4" />
                <span>Tangaza Sauti</span>
              </button>
            </div>

            {/* Badges: Alighting passengers & Waiting passengers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Alighting Passengers Count */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                    Abiria Wanaoshuka Hapa:
                  </span>
                  <div className="text-lg font-black text-amber-800 dark:text-amber-300">
                    {passengersAlightingHere.length > 0 ? (
                      <span>👥 Abiria {passengersAlightingHere.length} Wanashuka</span>
                    ) : (
                      <span className="text-neutral-500 text-sm font-bold">Hakuna ombi la kushuka</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Waiting at Stop count */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-blue-900 dark:text-blue-200 block">
                    Wanaosubiri Kituoni:
                  </span>
                  <div className="text-lg font-black text-blue-800 dark:text-blue-300">
                    🚏 ~Abiria {waitingPassengersCount} kituoni
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Arrival & Next Stop Progression */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleAnnounceArrival}
                className="w-full sm:w-1/2 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95"
              >
                <span>🔔 "Tunawasili Kituoni"</span>
              </button>

              <button
                onClick={handleAdvanceToNextStop}
                className="w-full sm:w-1/2 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition active:scale-95"
              >
                <span>Fika Kituo / Kituo Kijacho</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. EMERGENCY & TERMINAL QUEUE BAR                         */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Quick Emergency Red Button */}
            <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  Kitufe cha Dharura
                </span>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 font-medium">
                  Ripoti pancha, ajali au foleni kali mara moja
                </p>
              </div>

              <button
                onClick={() => setIsEmergencyModalOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition active:scale-95 whitespace-nowrap animate-pulse"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Ripoti Sasa</span>
              </button>
            </div>

            {/* Stand Queue Position Status */}
            <div className="p-4 rounded-3xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-blue-500" />
                  Foleni ya Stendi Kuu
                </span>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Stendi ya Simu2000 (Mawasiliano)
                </p>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-black text-blue-600 dark:text-blue-400">
                #2 Kwenye Foleni
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* EMERGENCY MODAL DRAWER                                    */}
      {/* ========================================================= */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-rose-300 dark:border-rose-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertOctagon className="w-6 h-6" />
                <h3 className="text-base font-black">Ripoti Dharura ya Barabarani</h3>
              </div>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Taarifa hii itatumwa papo hapo kwa <strong>Mmiliki (Tajiri)</strong> na <strong>Meneja wa Stendi</strong> ili wajue hali ya chombo chako:
            </p>

            {/* Quick Reason Selector */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {[
                '🛞 Pancha ya Tairi',
                '⚙️ Hitilafu ya Injini',
                '🚨 Ajali ya Barabarani',
                '🛑 Foleni Kali / Njia Imefungwa',
                '👮 Ukaguzi wa Trafiki / LATRA',
                '⛽ Kuishiwa Mafuta',
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => setEmergencyReason(r)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    emergencyReason === r
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200 font-black'
                      : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Optional Note */}
            <div>
              <label className="text-xs font-bold text-neutral-500 block mb-1">
                Maelezo ya Ziada (Hiari):
              </label>
              <textarea
                value={emergencyDetails}
                onChange={(e) => setEmergencyDetails(e.target.value)}
                placeholder="Mfano: Tairi la nyuma limepasuka karibu na Mwenge mataa..."
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={2}
              />
            </div>

            {/* Send Dispatch */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="w-1/3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300"
              >
                Ghairi
              </button>

              <button
                onClick={handleDispatchEmergency}
                className="w-2/3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                <Send className="w-4 h-4" />
                <span>Tuma Taarifa Sasa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ROAD SAFETY EXPLANATION MODAL (USALAMA BARABARANI)        */}
      {/* ========================================================= */}
      {isSafetyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-3xl p-6 shadow-2xl text-white space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 relative">
                  <Smartphone className="w-6 h-6" />
                  <Ban className="w-4 h-4 text-rose-500 absolute -top-1 -right-1" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-rose-600 text-white">
                    Sheria ya Trafiki & LATRA
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    Kwanini Dereva Hapaswi Kuchezea Simu?
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSafetyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Core Pillars */}
            <div className="space-y-3.5 text-xs">
              
              {/* Point 1 */}
              <div className="p-3.5 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex gap-3">
                <span className="text-xl">🛑</span>
                <div>
                  <h4 className="font-bold text-amber-400 text-sm">
                    1. Sheria Inakataza Dereva Kushika Simu
                  </h4>
                  <p className="text-neutral-300 mt-1 leading-relaxed">
                    Kwa mujibu wa Sheria za Usalama Barabarani na miongozo ya LATRA, dereva yeyote <strong>hapaswi kushika simu mkononi, kuandika meseji, wala kuchezea skrini</strong> anapoendesha gari. Kufanya hivyo husababisha ajali mbaya na faini ya papo hapo ya Trafiki.
                  </p>
                </div>
              </div>

              {/* Point 2 */}
              <div className="p-3.5 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex gap-3">
                <span className="text-xl">📱</span>
                <div>
                  <h4 className="font-bold text-emerald-400 text-sm">
                    2. Simu Inakaa Kwenye Kishikio (Phone Mount) cha Dashibodi
                  </h4>
                  <p className="text-neutral-300 mt-1 leading-relaxed">
                    Dereva haishiki simu mkononi. Simu inafungwa kwenye stendi maalum ya dashibodi (cradle/mount) mbele ya usukani na kutumika kama <strong>Dashibodi ya Kidijitali (HUD)</strong> tu, kama unavyotazama kioo au mshale wa spidi wa gari.
                  </p>
                </div>
              </div>

              {/* Point 3 */}
              <div className="p-3.5 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex gap-3">
                <span className="text-xl">🔊</span>
                <div>
                  <h4 className="font-bold text-blue-400 text-sm">
                    3. Mfumo Unatumia Sauti ya Kiswahili Pekee (Hands-Free)
                  </h4>
                  <p className="text-neutral-300 mt-1 leading-relaxed">
                    Dereva hahitaji hata kusoma skrini! Gari likikaribia kituo au likizidisha spidi ya 50km/h, simu yenyewe <strong>inatamka kwa sauti ya Kiswahili</strong> kupitia spika au redio ya gari: <em>"Kituo kinachofuata ni Mwenge"</em> au <em>"Punguza mwendo, umepitiliza spidi ya LATRA!"</em>.
                  </p>
                </div>
              </div>

              {/* Point 4 */}
              <div className="p-3.5 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex gap-3">
                <span className="text-xl">🤝</span>
                <div>
                  <h4 className="font-bold text-purple-400 text-sm">
                    4. Kondakta (Konda) Ndiye Anayeshika Simu
                  </h4>
                  <p className="text-neutral-300 mt-1 leading-relaxed">
                    Kazi zote za kuingiza abiria, kukata nauli, kuthibitisha malipo ya M-Pesa, na kutuma hesabu ya siku WhatsApp ya tajiri <strong>hufanywa na Kondakta</strong> kwenye simu yake. Mikono miwili ya dereva inabaki kwenye usukani (saa 10 na dakika 10).
                  </p>
                </div>
              </div>

            </div>

            {/* Bottom Button */}
            <button
              type="button"
              onClick={() => setIsSafetyModalOpen(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-neutral-950 font-black text-sm transition shadow-lg shadow-amber-500/20"
            >
              Nimeelewa, Zingatia Usalama Barabarani!
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DAILY OWNER REPORT MODAL (HESABU YA TAJIRI)               */}
      {/* ========================================================= */}
      {isDailyReportOpen && (
        <DaladalaDailyOwnerReportModal
          vehicle={fleetRecords.find((f) => f.plateNumber === vehicle.plateNumber) || null}
          fleetRecords={fleetRecords}
          passengers={passengers}
          ownerName={sessionUser?.organizationName || 'Mzee Juma Rashidi Mwinyi'}
          ownerPhone={sessionUser?.phone || '+255754123456'}
          onClose={() => setIsDailyReportOpen(false)}
        />
      )}

    </div>
  );
}
