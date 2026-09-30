import React, { useState, useEffect } from 'react';
import { 
  DaladalaRoute, 
  DaladalaVehicle, 
  DaladalaStop, 
  TrafficReport, 
  DaladalaTicket,
  AlightReminder,
  DaladalaSessionUser
} from '../../types/daladala.types';
import { 
  Bus, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Bell, 
  BellOff, 
  ShieldAlert, 
  Star, 
  QrCode, 
  Receipt, 
  CheckCircle2, 
  CloudRain, 
  Search, 
  PhoneCall, 
  Volume2, 
  Share2, 
  ChevronRight, 
  X,
  CreditCard,
  UserCheck,
  Building2,
  UserPlus,
  Lock,
  Radio,
  LogOut,
  Calculator,
  Armchair,
  Flame,
  Users,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';
import DaladalaJourneyFilter from './DaladalaJourneyFilter';
import DaladalaLatraFareCalculatorModal from './DaladalaLatraFareCalculatorModal';
import DaladalaSeatHoldModal from './DaladalaSeatHoldModal';
import { mockStopCrowdLevels } from '../../data/daladalaCrowdData';

interface DaladalaPassengerViewProps {
  routes: DaladalaRoute[];
  vehicles: DaladalaVehicle[];
  selectedVehicle: DaladalaVehicle | null;
  onSelectVehicle: (v: DaladalaVehicle) => void;
  onDeselectVehicle?: () => void;
  trafficReports: TrafficReport[];
  userCoords: { lat: number; lng: number } | null;
  onOpenRoutePlanner: () => void;
  onOpenRegisterVehicle?: () => void;
  onOpenRegisterPassenger?: () => void;
  onOpenDashboard?: () => void;
  onOpenConductorMode?: () => void;
  sessionUser?: DaladalaSessionUser | null;
  onOpenAuthModal?: (role?: 'owner' | 'conductor' | 'passenger') => void;
  onLogout?: () => void;
  filterOwnerOnly?: boolean;
  onToggleOwnerOnly?: () => void;
  ownerPlatesCount?: number;

  // Controlled Journey Filter Props
  boardingStop?: string;
  onBoardingStopChange?: (val: string) => void;
  selectedRouteFilter?: string;
  onRouteChange?: (val: string) => void;
  alightStop?: string;
  onAlightStopChange?: (val: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
  seatFilter?: 'all' | 'available_only';
  onSeatFilterChange?: (val: 'all' | 'available_only') => void;
  onSwapStops?: () => void;
  onResetFilters?: () => void;
  totalVehiclesCount?: number;
}

export default function DaladalaPassengerView({
  routes,
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  onDeselectVehicle,
  trafficReports,
  userCoords,
  onOpenRoutePlanner,
  onOpenRegisterVehicle,
  onOpenRegisterPassenger,
  onOpenDashboard,
  onOpenConductorMode,
  sessionUser,
  onOpenAuthModal,
  onLogout,
  filterOwnerOnly = false,
  onToggleOwnerOnly,
  ownerPlatesCount = 0,
  boardingStop: controlledBoardingStop,
  onBoardingStopChange: controlledOnBoardingStopChange,
  selectedRouteFilter: controlledSelectedRouteFilter,
  onRouteChange: controlledOnRouteChange,
  alightStop: controlledAlightStop,
  onAlightStopChange: controlledOnAlightStopChange,
  searchQuery: controlledSearchQuery,
  onSearchQueryChange: controlledOnSearchQueryChange,
  seatFilter: controlledSeatFilter,
  onSeatFilterChange: controlledOnSeatFilterChange,
  onSwapStops: controlledOnSwapStops,
  onResetFilters: controlledOnResetFilters,
  totalVehiclesCount,
}: DaladalaPassengerViewProps) {
  // Local fallback state if not controlled by parent
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localRouteFilter, setLocalRouteFilter] = useState<string>('all');
  const [localSeatFilter, setLocalSeatFilter] = useState<'all' | 'available_only'>('all');
  const [localBoardingStop, setLocalBoardingStop] = useState('');
  const [localAlightStop, setLocalAlightStop] = useState('');

  const activeBoardingStop = controlledBoardingStop !== undefined ? controlledBoardingStop : localBoardingStop;
  const activeAlightStop = controlledAlightStop !== undefined ? controlledAlightStop : localAlightStop;
  const activeRouteFilter = controlledSelectedRouteFilter !== undefined ? controlledSelectedRouteFilter : localRouteFilter;
  const activeSearchQuery = controlledSearchQuery !== undefined ? controlledSearchQuery : localSearchQuery;
  const activeSeatFilter = controlledSeatFilter !== undefined ? controlledSeatFilter : localSeatFilter;

  const handleBoardingStopChange = (val: string) => {
    if (controlledOnBoardingStopChange) controlledOnBoardingStopChange(val);
    else setLocalBoardingStop(val);
  };

  const handleAlightStopChange = (val: string) => {
    if (controlledOnAlightStopChange) controlledOnAlightStopChange(val);
    else setLocalAlightStop(val);
  };

  const handleRouteChange = (val: string) => {
    if (controlledOnRouteChange) controlledOnRouteChange(val);
    else setLocalRouteFilter(val);
  };

  const handleSearchQueryChange = (val: string) => {
    if (controlledOnSearchQueryChange) controlledOnSearchQueryChange(val);
    else setLocalSearchQuery(val);
  };

  const handleSeatFilterChange = (val: 'all' | 'available_only') => {
    if (controlledOnSeatFilterChange) controlledOnSeatFilterChange(val);
    else setLocalSeatFilter(val);
  };

  const handleSwapStops = () => {
    if (controlledOnSwapStops) {
      controlledOnSwapStops();
    } else {
      const prevB = localBoardingStop;
      setLocalBoardingStop(localAlightStop);
      setLocalAlightStop(prevB);
    }
  };

  const handleResetFilters = () => {
    if (controlledOnResetFilters) {
      controlledOnResetFilters();
    } else {
      setLocalBoardingStop('');
      setLocalAlightStop('');
      setLocalRouteFilter('all');
      setLocalSearchQuery('');
      setLocalSeatFilter('all');
    }
  };

  // Nishushe Hapa (Alight Reminder) state
  const [alightReminder, setAlightReminder] = useState<AlightReminder | null>(() => {
    const saved = localStorage.getItem('papo_daladala_alight_reminder');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAlightModalOpen, setIsAlightModalOpen] = useState(false);
  const [targetAlightStopId, setTargetAlightStopId] = useState<string>('');
  const [alightProximityDistanceM, setAlightProximityDistanceM] = useState<number>(500);

  // LATRA Fare Calculator & Seat Hold modal states
  const [isFareCalculatorOpen, setIsFareCalculatorOpen] = useState(false);
  const [isSeatHoldModalOpen, setIsSeatHoldModalOpen] = useState(false);
  const [showCrowdDrawer, setShowCrowdDrawer] = useState(false);

  // Ticket Modal & Wallet state
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketOriginStop, setTicketOriginStop] = useState<string>('');
  const [ticketDestinationStop, setTicketDestinationStop] = useState<string>('');
  const [activeTicket, setActiveTicket] = useState<DaladalaTicket | null>(() => {
    const saved = localStorage.getItem('papo_daladala_active_ticket');
    return saved ? JSON.parse(saved) : null;
  });

  // SOS Modal state
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  // Rating Modal state
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [driverRating, setDriverRating] = useState(5);
  const [conductorRating, setConductorRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  // Save active ticket and reminder
  useEffect(() => {
    if (alightReminder) {
      localStorage.setItem('papo_daladala_alight_reminder', JSON.stringify(alightReminder));
    } else {
      localStorage.removeItem('papo_daladala_alight_reminder');
    }
  }, [alightReminder]);

  useEffect(() => {
    if (activeTicket) {
      localStorage.setItem('papo_daladala_active_ticket', JSON.stringify(activeTicket));
    } else {
      localStorage.removeItem('papo_daladala_active_ticket');
    }
  }, [activeTicket]);

  // Nishushe Hapa Watcher Simulation
  useEffect(() => {
    if (!alightReminder || !alightReminder.active || alightReminder.triggered) return;

    // Check if the monitored vehicle is near the destination stop
    const monitoredVehicle = vehicles.find((v) => v.id === alightReminder.vehicleId);
    if (!monitoredVehicle) return;

    const route = routes.find((r) => r.id === monitoredVehicle.routeId);
    const targetStop = route?.stops.find((s) => s.id === alightReminder.targetStopId);

    if (targetStop) {
      // Calculate distance between daladala and stop (approximate degrees to meters)
      const dLat = (monitoredVehicle.currentLat - targetStop.lat) * 111000;
      const dLng = (monitoredVehicle.currentLng - targetStop.lng) * 111000 * Math.cos(targetStop.lat * (Math.PI / 180));
      const distMeters = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));

      setAlightReminder((prev) => (prev ? { ...prev, distanceRemainingM: distMeters } : null));

      // Trigger alarm if within user selected proximity distance or next stop
      const targetThreshold = (alightReminder as any).triggerDistanceM || alightProximityDistanceM || 450;
      if (distMeters <= targetThreshold || monitoredVehicle.nextStopId === targetStop.id) {
        setAlightReminder((prev) => (prev ? { ...prev, triggered: true } : null));
        
        // Vibration and Sound Chime
        if ('vibrate' in navigator) {
          navigator.vibrate([400, 200, 400, 200, 600]);
        }

        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        } catch (e) {}

        if ('speechSynthesis' in window) {
          try {
            const u = new SpeechSynthesisUtterance(`Shusha hapa! Umekaribia kituo cha ${targetStop.name}`);
            u.lang = 'sw-TZ';
            window.speechSynthesis.speak(u);
          } catch (e) {}
        }

        toast.warning(`🔔 SHUSHA DEREVA! Kituo cha ${targetStop.name} kiko mbele yako (Mita ${distMeters})!`, {
          duration: 10000,
        });
      }
    }
  }, [vehicles, alightReminder, routes, alightProximityDistanceM]);

  // Filter daladalas: if controlled by parent, vehicles is already filtered; otherwise filter locally
  const filteredVehicles = controlledBoardingStop !== undefined
    ? vehicles 
    : vehicles.filter((v) => {
        if (activeRouteFilter !== 'all' && v.routeId !== activeRouteFilter && v.routeCode !== activeRouteFilter) return false;
        if (activeSeatFilter === 'available_only' && v.seatStatus !== 'available' && v.seatStatus !== 'few') return false;

        const vehicleRoute = routes.find((r) => r.id === v.routeId);

        if (activeBoardingStop.trim()) {
          const bTerm = activeBoardingStop.trim().toLowerCase();
          const hasBoardingStop = 
            vehicleRoute?.stops.some((s) => s.name.toLowerCase().includes(bTerm) || (s.zone && s.zone.toLowerCase().includes(bTerm))) ||
            v.nextStopName.toLowerCase().includes(bTerm) ||
            v.routeName.toLowerCase().includes(bTerm);
          if (!hasBoardingStop) return false;
        }

        if (activeAlightStop.trim()) {
          const aTerm = activeAlightStop.trim().toLowerCase();
          const hasAlightStop = 
            vehicleRoute?.stops.some((s) => s.name.toLowerCase().includes(aTerm) || (s.zone && s.zone.toLowerCase().includes(aTerm))) ||
            vehicleRoute?.destination.toLowerCase().includes(aTerm) ||
            v.routeName.toLowerCase().includes(aTerm);
          if (!hasAlightStop) return false;
        }

        if (activeBoardingStop.trim() && activeAlightStop.trim() && vehicleRoute) {
          const bTerm = activeBoardingStop.trim().toLowerCase();
          const aTerm = activeAlightStop.trim().toLowerCase();
          const hasBoth = 
            vehicleRoute.stops.some((s) => s.name.toLowerCase().includes(bTerm) || (s.zone && s.zone.toLowerCase().includes(bTerm))) &&
            vehicleRoute.stops.some((s) => s.name.toLowerCase().includes(aTerm) || (s.zone && s.zone.toLowerCase().includes(aTerm)));
          if (!hasBoth) return false;
        }

        if (activeSearchQuery.trim()) {
          const q = activeSearchQuery.toLowerCase();
          const matchPlate = v.plateNumber.toLowerCase().includes(q);
          const matchNickname = v.nickname.toLowerCase().includes(q);
          const matchRoute = v.routeName.toLowerCase().includes(q);
          const matchNextStop = v.nextStopName.toLowerCase().includes(q);
          const matchDriver = v.driverName.toLowerCase().includes(q);
          if (!matchPlate && !matchNickname && !matchRoute && !matchNextStop && !matchDriver) return false;
        }
        return true;
      });

  // Current active route for selected vehicle
  const currentRoute = selectedVehicle
    ? routes.find((r) => r.id === selectedVehicle.routeId)
    : null;

  // Handle buying ticket
  const handlePurchaseTicket = (method: 'papo_wallet' | 'mpesa') => {
    if (!selectedVehicle || !ticketOriginStop || !ticketDestinationStop) {
      toast.error('Tafadhali chagua kituo cha kupandia na kushukia');
      return;
    }

    const fare = currentRoute?.baseFareTzs || 600;
    const fromStopObj = currentRoute?.stops.find((s) => s.id === ticketOriginStop);
    const toStopObj = currentRoute?.stops.find((s) => s.id === ticketDestinationStop);

    const newTicket: DaladalaTicket = {
      id: `tkt_${Date.now()}`,
      ticketNumber: `DL-${Math.floor(100000 + Math.random() * 900000)}`,
      vehicleId: selectedVehicle.id,
      plateNumber: selectedVehicle.plateNumber,
      routeId: selectedVehicle.routeId,
      routeName: selectedVehicle.routeName,
      fromStop: fromStopObj?.name || 'Kituo cha Mwanzo',
      toStop: toStopObj?.name || 'Kituo cha Mwisho',
      fareTzs: fare,
      passengerName: 'Mteja wa Papo Hapo',
      passengerPhone: '+255 7XX XXX XXX',
      paymentMethod: method,
      paymentRef: `TXN${Date.now().toString().slice(-6)}`,
      purchasedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'valid',
      qrCodeData: `PAPO-DALADALA:${selectedVehicle.plateNumber}:${fare}:${Date.now()}`,
    };

    setActiveTicket(newTicket);
    setIsTicketModalOpen(false);
    toast.success(`Tiketi imekatwa kikamilifu! Nauli TSh ${fare.toLocaleString()} kupitia ${method === 'papo_wallet' ? 'Papo Wallet' : 'M-Pesa'}`);
  };

  // Handle setting Alight Reminder
  const handleSetAlightReminder = () => {
    if (!selectedVehicle || !targetAlightStopId) {
      toast.error('Tafadhali chagua kituo unachotaka kushuka');
      return;
    }

    const targetStop = currentRoute?.stops.find((s) => s.id === targetAlightStopId);
    if (!targetStop) return;

    setAlightReminder({
      active: true,
      vehicleId: selectedVehicle.id,
      targetStopId: targetStop.id,
      targetStopName: targetStop.name,
      targetLat: targetStop.lat,
      targetLng: targetStop.lng,
      distanceRemainingM: 1200,
      triggered: false,
      ...({ triggerDistanceM: alightProximityDistanceM } as any),
    });

    setIsAlightModalOpen(false);
    toast.success(`Kengele imewashwa! Utapata arifa ukiwa mita ${alightProximityDistanceM} kabla ya kufika kituo cha ${targetStop.name}`);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 14: Weather & Traffic Status Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-emerald-500/10 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-sky-600 animate-pulse" />
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            Hali ya Hewa: Dar es Salaam (29°C) • Ucheleweshaji wa kawaida wa foleni (+Dk 5–8)
          </span>
        </div>
        {trafficReports.length > 0 && (
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
            {trafficReports.length} Taarifa za Trafiki
          </span>
        )}
      </div>

      {/* 9: Active Alight Alarm Banner (If Enabled) */}
      {alightReminder?.active && (
        <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
          alightReminder.triggered 
            ? 'bg-red-500 text-white border-red-600 animate-bounce' 
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <Bell className={`w-5 h-5 ${alightReminder.triggered ? 'animate-spin' : 'text-emerald-600 animate-pulse'}`} />
            <div>
              <p className="font-bold text-xs">
                {alightReminder.triggered ? 'SHUSHA HAPA! UMEFIKA!' : 'Kengele ya "Nishushe Hapa" Inafanya Kazi'}
              </p>
              <p className="text-[11px] opacity-90">
                Kituo: <strong>{alightReminder.targetStopName}</strong> 
                {alightReminder.distanceRemainingM ? ` • Mita ~${alightReminder.distanceRemainingM} zimebaki` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setAlightReminder(null);
              toast.info('Kengele ya kushuka imezimwa.');
            }}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-neutral-900/10 hover:bg-neutral-900/20 dark:bg-white/10 dark:hover:bg-white/20 transition"
          >
            Zima Kengele
          </button>
        </div>
      )}

      {/* 🚀 HUDUMA MUHIMU ZA ABIRIA WA KAWAIDA (LATRA FARE & CROWD STATUS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIsFareCalculatorOpen(true)}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white flex items-center justify-between shadow-md transition active:scale-[0.98] group text-left border border-blue-500/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition shadow-inner">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <strong className="text-xs sm:text-sm font-black">Kikokotoo Rasmi cha Nauli cha LATRA</strong>
                <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-neutral-950 font-black text-[9px] uppercase">
                  GN 416
                </span>
              </div>
              <p className="text-[11px] text-white/80 mt-0.5">
                Hesabu nauli halali kisheria (TSh 500, 600, au 200 ya mwanafunzi)
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 transition shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setShowCrowdDrawer(!showCrowdDrawer)}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 flex items-center justify-between shadow-md transition active:scale-[0.98] group text-left border border-amber-400/40"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Users className="w-5 h-5 text-neutral-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <strong className="text-xs sm:text-sm font-black">Msongamano wa Vituo vya Dar</strong>
                <span className="px-1.5 py-0.5 rounded bg-black text-amber-300 font-mono font-black text-[9px] uppercase">
                  {mockStopCrowdLevels.length} VITUO
                </span>
              </div>
              <p className="text-[11px] text-neutral-900/80 mt-0.5">
                Wanaosubiri Ubungo Maji, Mwenge, Kariakoo na Kivukoni
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-950/70 group-hover:translate-x-0.5 transition shrink-0" />
        </button>
      </div>

      {/* Stop Crowd Drawer Section */}
      {showCrowdDrawer && (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h4 className="font-black text-xs uppercase tracking-wider text-neutral-900 dark:text-white">
                Hali ya Msongamano na Foleni Vituo Vikuu vya Dar es Salaam
              </h4>
            </div>
            <button
              onClick={() => setShowCrowdDrawer(false)}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Funga
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {mockStopCrowdLevels.map((st) => (
              <div
                key={st.stopId}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-neutral-900 dark:text-white truncate">
                    {st.stopName}
                  </strong>
                  <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                    st.crowdLevel === 'surge'
                      ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                      : st.crowdLevel === 'high'
                      ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300'
                      : st.crowdLevel === 'moderate'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {st.crowdLevel === 'surge' ? 'Kumesheheni' : st.crowdLevel === 'high' ? 'Watu Wengi' : st.crowdLevel === 'moderate' ? 'Wastani' : 'Tulivu'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>Wanaosubiri: ~{st.waitingPassengersApprox} abiria</span>
                  <span className="font-mono">Subira: Dk ~{st.avgWaitTimeMinutes}</span>
                </div>
                <p className="text-[10px] text-neutral-400 italic">
                  {st.peakStatusText}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🚏 Role-Aware Operator Access Hub for Wahusika wa Daladala */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              sessionUser?.role === 'owner'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                : sessionUser?.role === 'conductor' || sessionUser?.role === 'driver'
                ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
            }`}>
              {sessionUser?.role === 'owner' ? (
                <Building2 className="w-5 h-5" />
              ) : sessionUser?.role === 'conductor' || sessionUser?.role === 'driver' ? (
                <Radio className="w-5 h-5" />
              ) : (
                <Bus className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  {sessionUser ? `Mhusika: ${sessionUser.role === 'owner' ? 'Mmiliki' : sessionUser.role === 'conductor' ? 'Kondakta' : sessionUser.role === 'driver' ? 'Dereva' : 'Abiria'}` : 'Eneo la Wahusika wa Daladala'}
                </span>
                <span className="text-[11px] text-neutral-500 hidden sm:inline">• LATRA & UWADAR Portal</span>
              </div>

              {sessionUser ? (
                <h3 className="text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                  {sessionUser.role === 'owner'
                    ? `Karibu, Mmiliki ${sessionUser.fullName} • Tazama hesabu na magari yako`
                    : sessionUser.role === 'conductor' || sessionUser.role === 'driver'
                    ? `Karibu, ${sessionUser.fullName} (${sessionUser.assignedPlate || 'Chombo'}) • Simamia viti & tiketi`
                    : `Karibu, ${sessionUser.fullName} • Huduma za Abiria na Safari`}
                </h3>
              ) : (
                <h3 className="text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                  Wamiliki & Makondakta: Ingia au Jisajili Kuona Dasibodi na Kusajili Gari
                </h3>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
            {sessionUser ? (
              <>
                {sessionUser.role === 'owner' && onOpenRegisterVehicle && (
                  <button
                    type="button"
                    onClick={onOpenRegisterVehicle}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                  >
                    <Bus className="w-3.5 h-3.5" />
                    <span>Sajili Chombo</span>
                  </button>
                )}

                {(sessionUser.role === 'owner' || sessionUser.role === 'conductor' || sessionUser.role === 'driver') && onOpenRegisterPassenger && (
                  <button
                    type="button"
                    onClick={onOpenRegisterPassenger}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Sajili Abiria</span>
                  </button>
                )}

                {sessionUser.role === 'owner' && onOpenDashboard && (
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Dasibodi Yangu</span>
                  </button>
                )}

                {/* Owner specific quick dual-toggle: Gari Zangu Tu vs Mabasi Yote */}
                {sessionUser.role === 'owner' && onToggleOwnerOnly && (
                  <div className="flex items-center p-0.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 gap-1">
                    <button
                      type="button"
                      onClick={() => !filterOwnerOnly && onToggleOwnerOnly()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 transition ${
                        filterOwnerOnly
                          ? 'bg-amber-500 text-neutral-950 shadow-sm'
                          : 'text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Gari Zangu Tu ({ownerPlatesCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => filterOwnerOnly && onToggleOwnerOnly()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                        !filterOwnerOnly
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-sm font-black'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span>Mabasi Yote ({totalVehiclesCount})</span>
                    </button>
                  </div>
                )}

                {(sessionUser.role === 'conductor' || sessionUser.role === 'driver') && onOpenConductorMode && (
                  <button
                    type="button"
                    onClick={onOpenConductorMode}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Njia ya Konda HUD</span>
                  </button>
                )}

                {/* Direct Logout Button */}
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap shadow-sm"
                    title="Ondoka kwenye akaunti (Logout)"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span>Toka</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('owner')}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 whitespace-nowrap"
              >
                <Lock className="w-4 h-4 text-neutral-950" />
                <span>Ingia / Jisajili kama Mhusika</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 15: Find My Daladala: Interactive Journey Filter (Kituo, Ruti, Kituo cha Kushukia) */}
      <DaladalaJourneyFilter
        routes={routes}
        boardingStop={activeBoardingStop}
        onBoardingStopChange={handleBoardingStopChange}
        selectedRoute={activeRouteFilter}
        onRouteChange={handleRouteChange}
        alightStop={activeAlightStop}
        onAlightStopChange={handleAlightStopChange}
        searchQuery={activeSearchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        seatFilter={activeSeatFilter}
        onSeatFilterChange={handleSeatFilterChange}
        onSwapStops={handleSwapStops}
        onResetFilters={handleResetFilters}
        matchingCount={filteredVehicles.length}
        totalCount={totalVehiclesCount || vehicles.length}
      />

      {/* Main Content Area: Left/Top Selected Vehicle Card, Right/Bottom List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Selected Daladala Detail Card */}
        {selectedVehicle ? (
          <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col space-y-4">
            {/* Header: Plate, Nickname, Model & Route */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="tz-number-plate text-sm">
                    <span className="tz-strip">TZ</span>
                    <span>{selectedVehicle.plateNumber}</span>
                  </div>
                  <span 
                    className="px-2 py-0.5 rounded text-white font-black text-[10px] shadow-xs"
                    style={{ backgroundColor: selectedVehicle.colorHex || '#2563eb' }}
                  >
                    {selectedVehicle.routeCode}
                  </span>
                </div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
                  "{selectedVehicle.nickname}"
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{selectedVehicle.vehicleModel}</span>
                  <span>•</span>
                  <span>{selectedVehicle.routeName}</span>
                </div>
              </div>
              
              {/* Status Badge & Close Button */}
              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full font-black text-[10px] uppercase shadow-xs ${
                    selectedVehicle.seatStatus === 'available'
                      ? 'bg-emerald-500 text-white'
                      : selectedVehicle.seatStatus === 'few'
                      ? 'bg-amber-500 text-white'
                      : selectedVehicle.seatStatus === 'standing'
                      ? 'bg-orange-500 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {selectedVehicle.seatStatus === 'available'
                      ? `🟢 Viti ${selectedVehicle.capacity - selectedVehicle.seatsTaken} Wazi`
                      : selectedVehicle.seatStatus === 'few'
                      ? `🟡 Viti ${selectedVehicle.capacity - selectedVehicle.seatsTaken} Wazi`
                      : selectedVehicle.seatStatus === 'standing'
                      ? '🟠 Msimamo Tu'
                      : '🔴 FULL'}
                  </span>
                  <p className="text-[10px] text-neutral-400 mt-1 font-mono">LATRA Verified</p>
                </div>

                {onDeselectVehicle && (
                  <button
                    onClick={onDeselectVehicle}
                    className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
                    title="Funga taarifa za gari hili / Rudi kwenye ramani nzima"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 🪑 Visual Seat Capacity Meter Gauge */}
            <div className="bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-xl space-y-1.5 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <span>Uwezo wa Viti:</span>
                  <span className="font-mono">{selectedVehicle.seatsTaken} / {selectedVehicle.capacity}</span>
                </span>
                <span className={`font-black text-[11px] ${
                  selectedVehicle.capacity - selectedVehicle.seatsTaken > 3 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : selectedVehicle.capacity - selectedVehicle.seatsTaken > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {selectedVehicle.capacity - selectedVehicle.seatsTaken} Viti Vimebaki Wazi
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2.5 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-500 ${
                    selectedVehicle.seatsTaken / selectedVehicle.capacity > 0.9
                      ? 'bg-red-500'
                      : selectedVehicle.seatsTaken / selectedVehicle.capacity > 0.75
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (selectedVehicle.seatsTaken / selectedVehicle.capacity) * 100)}%` }}
                />
              </div>

              {selectedVehicle.standingCount > 0 && (
                <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">
                  + Abiria {selectedVehicle.standingCount} wamesimama (Msimamo)
                </p>
              )}
            </div>

            {/* 10: Route Change / Off-Route Warning Alert */}
            {selectedVehicle.isOffRoute && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-2.5 flex items-start gap-2 text-xs text-red-900 dark:text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Tahadhari: Gari limechepuka ruti!</strong>
                  <span className="text-[11px] opacity-90">{selectedVehicle.offRouteReason}</span>
                </div>
              </div>
            )}

            {/* Live Metrics: ETA, Next Stop, Speed */}
            <div className="grid grid-cols-3 gap-2 bg-neutral-50 dark:bg-neutral-800/60 p-2.5 rounded-xl text-center border border-neutral-100 dark:border-neutral-800">
              <div>
                <span className="text-[10px] text-neutral-500 font-semibold block">Kituo Kinachofuata</span>
                <strong className="text-xs text-neutral-900 dark:text-neutral-100 truncate block">
                  {selectedVehicle.nextStopName}
                </strong>
              </div>
              <div className="border-x border-neutral-200 dark:border-neutral-700 px-1">
                <span className="text-[10px] text-neutral-500 font-semibold block">Muda wa Kufika (ETA)</span>
                <strong className="text-xs text-emerald-600 dark:text-emerald-400 block font-mono">
                  Dk {selectedVehicle.etaMinutesToNextStop}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 font-semibold block">Kasi ya Sasa</span>
                <strong className="text-xs text-neutral-900 dark:text-neutral-100 block font-mono">
                  {selectedVehicle.speedKmH} km/h
                </strong>
              </div>
            </div>

            {/* 🚏 Live Route Progression Stepper */}
            {currentRoute && (
              <div className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-neutral-500">Muelekeo wa Safari</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                    Nauli: TSh {currentRoute.baseFareTzs.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200 gap-2">
                  <div className="flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{currentRoute.origin.split(' ')[0]}</span>
                  </div>

                  <div className="flex-1 flex items-center px-1">
                    <div className="h-0.5 flex-1 bg-neutral-300 dark:bg-neutral-700 relative flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-neutral-900 shadow-sm animate-pulse" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 truncate text-right">
                    <span className="truncate">{currentRoute.destination.split(' ')[0]}</span>
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* Conductor & Driver Info with Rating & Calling */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs">
              <div>
                <p className="font-black text-neutral-900 dark:text-neutral-100">
                  {selectedVehicle.conductorName}
                </p>
                <p className="text-[10px] text-neutral-500 font-medium">Dereva: {selectedVehicle.driverName}</p>
                <div className="flex items-center gap-1 text-amber-500 text-[11px] mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-black">{selectedVehicle.rating}</span>
                  <span className="text-[10px] text-neutral-400">({selectedVehicle.ratingCount} kura)</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${selectedVehicle.conductorPhone}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition"
                  title="Piga simu kwa Konda"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Piga</span>
                </a>
                <button
                  onClick={() => setIsRatingModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] font-bold"
                >
                  Tathmini
                </button>
              </div>
            </div>

            {/* Quick Action Buttons: Shikilia Kiti, Nishushe Hapa, Kata Tiketi QR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSeatHoldModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-xs shadow-md transition active:scale-95"
              >
                <Armchair className="w-4 h-4" />
                <span>Shikilia Kiti (Dk 5)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetAlightStopId(currentRoute?.stops[3]?.id || '');
                  setIsAlightModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 font-extrabold text-xs shadow-md transition active:scale-95"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Nishushe Hapa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTicketOriginStop(currentRoute?.stops[0]?.id || '');
                  setTicketDestinationStop(currentRoute?.stops[currentRoute.stops.length - 1]?.id || '');
                  setIsTicketModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span>Kata Tiketi / QR</span>
              </button>
            </div>

            {/* SOS & Route Planner link */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsSosModalOpen(true)}
                className="text-red-600 hover:text-red-700 font-extrabold text-xs flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Ripoti Dharura (SOS)</span>
              </button>
              <button
                onClick={onOpenRoutePlanner}
                className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1"
              >
                <span>Panga Ruti Yote</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
              <Bus className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                Chagua Daladala Kwenye Orodha au Ramani
              </h3>
              <p className="text-xs text-neutral-500 max-w-xs mt-1">
                Bofya gari lolote kuona idadi ya viti vilivyopo wazi, dereva, muda wa kufika na kuwasha kengele ya "Nishushe Hapa".
              </p>
            </div>
            <button
              onClick={onOpenRoutePlanner}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
            >
              🔀 Fungua Mpangaji wa Ruti (Route Planner)
            </button>
          </div>
        )}

        {/* Right / Secondary: Live Daladala Feed List */}
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {sessionUser?.role === 'owner' && filterOwnerOnly ? (
                  <span>👑 Magari Yako Yaliyopo Barabarani ({filteredVehicles.length})</span>
                ) : (
                  <span>Magari Yaliyopo Barabarani ({filteredVehicles.length})</span>
                )}
              </h3>
              {sessionUser?.role === 'owner' && filterOwnerOnly && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  Unaangalia vyombo vyako pekee vilivyo chini ya usimamizi wako
                </p>
              )}
            </div>
            <span className="text-[11px] text-neutral-500 font-semibold">Live GPS Updates</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
            {filteredVehicles.length === 0 ? (
              <div className="py-10 px-4 text-center bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                  <Bus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                    Hakuna Mabasi Yaliyopatikana
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mt-1">
                    Hakuna daladala iliyopatikana inayokidhi vituo au ruti uliyoweka. Jaribu kubadilisha kituo cha kupandia, ruti au kituo cha kushukia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition active:scale-95 shadow-sm"
                >
                  Onyesha Mabasi Yote (Reset)
                </button>
              </div>
            ) : (
              filteredVehicles.map((v) => {
              const isSelected = selectedVehicle?.id === v.id;
              const seatsLeft = Math.max(0, v.capacity - v.seatsTaken);
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    if (isSelected && onDeselectVehicle) {
                      onDeselectVehicle();
                    } else {
                      onSelectVehicle(v);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-sm ring-1 ring-blue-500'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm relative"
                      style={{ backgroundColor: v.colorHex || '#2563eb' }}
                    >
                      <Bus className="w-5 h-5" />
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="tz-number-plate text-xs">
                          <span className="tz-strip">TZ</span>
                          <span>{v.plateNumber}</span>
                        </div>
                        {sessionUser?.role === 'owner' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 text-[9px] font-black uppercase shadow-xs">
                            <Crown className="w-2.5 h-2.5" />
                            Gari Lako
                          </span>
                        )}
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">
                          "{v.nickname}"
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                        {v.routeName}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        Inakaribia: <strong className="text-neutral-700 dark:text-neutral-200">{v.nextStopName}</strong> ({v.etaMinutesToNextStop} min)
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                      v.seatStatus === 'available'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : v.seatStatus === 'few'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : v.seatStatus === 'standing'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {v.seatStatus === 'available' 
                        ? `${seatsLeft} Viti Wazi` 
                        : v.seatStatus === 'few' 
                        ? `${seatsLeft} Viti` 
                        : v.seatStatus === 'standing' 
                        ? 'Msimamo' 
                        : 'FULL'}
                    </span>
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
                      TSh 500 - 600
                    </p>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      </div>

      {/* ACTIVE TICKET BANNER (#18, #19: Digital Receipt & QR Ticket) */}
      {activeTicket && (
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <QrCode className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10px]">
                  Tiketi Halali ya Daladala
                </span>
                <span className="text-xs font-mono font-bold text-amber-300">{activeTicket.ticketNumber}</span>
              </div>
              <p className="text-sm font-black mt-0.5">
                {activeTicket.plateNumber} • {activeTicket.fromStop} ➔ {activeTicket.toStop}
              </p>
              <p className="text-[11px] text-white/80">
                Nauli: TSh {activeTicket.fareTzs.toLocaleString()} • Imelipiwa: {activeTicket.purchasedAt}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                toast.success('Risiti imehifadhiwa kwenye simu yako!');
              }}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Risiti</span>
            </button>
            <button
              onClick={() => {
                setActiveTicket(null);
                toast.info('Tiketi imehitimishwa.');
              }}
              className="px-3 py-1.5 rounded-lg bg-white text-blue-800 font-extrabold text-xs hover:bg-white/90 transition"
            >
              Nimeshuka
            </button>
          </div>
        </div>
      )}

      {/* 9: Nishushe Hapa (Alight Reminder) Modal */}
      {isAlightModalOpen && selectedVehicle && currentRoute && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                    Kengele ya "Nishushe Hapa"
                  </h3>
                  <p className="text-[10px] text-neutral-500">{selectedVehicle.plateNumber} • {selectedVehicle.routeName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAlightModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Chagua Kituo Utakachoshuka:
                </label>
                <select
                  value={targetAlightStopId}
                  onChange={(e) => setTargetAlightStopId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Chagua Kituo --</option>
                  {currentRoute.stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name} {stop.isTerminal ? '(Stendi Kuu)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Umbali wa Kuanza Kengele na Arifa:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 300, label: 'Mita 300', desc: 'Karibu kabisa' },
                    { val: 500, label: 'Mita 500', desc: 'Wastani' },
                    { val: 1000, label: 'Mita 1,000', desc: 'Kujiandaa mapema' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setAlightProximityDistanceM(item.val)}
                      className={`p-2 rounded-xl text-left border transition ${
                        alightProximityDistanceM === item.val
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <strong className="text-xs block font-bold">{item.label}</strong>
                      <span className="text-[10px] opacity-75 block">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  Jinsi Inavyofanya Kazi:
                </p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  Gari likiwa umbali wa mita {alightProximityDistanceM} kabla ya kufika kituoni, simu yako itatoa mlio maalum wa kengele, sauti ya Kiswahili ("Shusha hapa! Umekaribia kituoni") na mtetemo (vibrate) ili ujiandae kushuka salama bila kusahau mzigo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsAlightModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition"
              >
                Ghairi
              </button>
              <button
                onClick={handleSetAlightReminder}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-extrabold hover:from-amber-600 hover:to-orange-700 shadow-md transition"
              >
                Washa Kengele Sasa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 17, 19: Ticket Purchase Modal */}
      {isTicketModalOpen && selectedVehicle && currentRoute && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                    Kata Tiketi ya Daladala
                  </h3>
                  <p className="text-[10px] text-neutral-500">{selectedVehicle.plateNumber} • {selectedVehicle.routeName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsTicketModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Kituo cha Kupandia:
                </label>
                <select
                  value={ticketOriginStop}
                  onChange={(e) => setTicketOriginStop(e.target.value)}
                  className="w-full p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold"
                >
                  {currentRoute.stops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Kituo cha Kushukia:
                </label>
                <select
                  value={ticketDestinationStop}
                  onChange={(e) => setTicketDestinationStop(e.target.value)}
                  className="w-full p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold"
                >
                  {currentRoute.stops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Nauli ya LATRA:</span>
                <span className="text-base font-black text-blue-600 dark:text-blue-400">
                  TSh {currentRoute.baseFareTzs.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handlePurchaseTicket('papo_wallet')}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Lipia kupitia Papo Wallet (TSh {currentRoute.baseFareTzs})</span>
              </button>
              <button
                onClick={() => handlePurchaseTicket('mpesa')}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Lipia kupitia M-Pesa / Tigo Pesa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11: Emergency / SOS Modal */}
      {isSosModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-600" />
                <h3 className="font-extrabold text-sm text-red-600">
                  Msaada wa Dharura & Usalama (SOS)
                </h3>
              </div>
              <button onClick={() => setIsSosModalOpen(false)}>
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              Ikiwa unashuhudia uhalifu, uendeshaji hatarishi, udhalilishaji, au ajali kwenye daladala, bofya namba hizi mara moja:
            </p>

            <div className="space-y-2">
              <a
                href="tel:112"
                className="w-full py-3 px-4 rounded-xl bg-red-600 text-white font-extrabold text-xs flex items-center justify-between shadow-md"
              >
                <span>Jeshi la Polisi / Namba ya Dharura</span>
                <span className="font-mono text-sm">Piga 112</span>
              </a>
              <a
                href="tel:199"
                className="w-full py-3 px-4 rounded-xl bg-amber-600 text-white font-extrabold text-xs flex items-center justify-between shadow-md"
              >
                <span>Usalama Barabarani (Traffic Police)</span>
                <span className="font-mono text-sm">Piga 199</span>
              </a>
              <a
                href="tel:116"
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-between shadow-md"
              >
                <span>Dawati la Jinsia na Watoto</span>
                <span className="font-mono text-sm">Piga 116</span>
              </a>
            </div>

            <button
              onClick={() => {
                const text = `Niko ndani ya daladala ${selectedVehicle?.plateNumber || ''} ruti ya ${selectedVehicle?.routeName || ''}, naomba msaada wa kiusalama.`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-full py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Tuma Mahali Nilipo WhatsApp kwa Ndugu</span>
            </button>
          </div>
        </div>
      )}

      {/* 12: Driver / Conductor Rating Modal */}
      {isRatingModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                Tathmini Huduma ya Daladala
              </h3>
              <button onClick={() => setIsRatingModalOpen(false)}>
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Ustaarabu wa Konda ({selectedVehicle.conductorName}):
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onClick={() => setConductorRating(star)}
                      className={`w-6 h-6 cursor-pointer transition ${
                        star <= conductorRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-neutral-300 dark:text-neutral-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Uendeshaji wa Dereva ({selectedVehicle.driverName}):
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      onClick={() => setDriverRating(star)}
                      className={`w-6 h-6 cursor-pointer transition ${
                        star <= driverRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-neutral-300 dark:text-neutral-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Maoni Yako:
                </label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Konda alikuwa mstaarabu? Chenji ilirudishwa kwa wakati? Gari lilikimbizwa sana?..."
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs h-20"
                />
              </div>
            </div>

            <button
              onClick={() => {
                toast.success('Asante kwa kutoa tathmini yako! Inasaidia kuboresha nidhamu ya madereva na makondakta.');
                setIsRatingModalOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition"
            >
              Wasilisha Tathmini
            </button>
          </div>
        </div>
      )}

      {/* 🚀 LATRA FARE CALCULATOR MODAL */}
      {isFareCalculatorOpen && (
        <DaladalaLatraFareCalculatorModal
          routes={routes}
          initialOriginStop={activeBoardingStop || selectedVehicle?.nextStopName}
          initialDestinationStop={activeAlightStop || currentRoute?.destination}
          initialRouteId={selectedVehicle?.routeId || (activeRouteFilter !== 'all' ? activeRouteFilter : undefined)}
          onClose={() => setIsFareCalculatorOpen(false)}
        />
      )}

      {/* 🪑 SEAT HOLD MODAL */}
      {isSeatHoldModalOpen && selectedVehicle && (
        <DaladalaSeatHoldModal
          vehicle={selectedVehicle}
          route={currentRoute || undefined}
          initialBoardingStop={activeBoardingStop || selectedVehicle.nextStopName}
          initialAlightStop={activeAlightStop || currentRoute?.destination}
          onClose={() => setIsSeatHoldModalOpen(false)}
        />
      )}
    </div>
  );
}
