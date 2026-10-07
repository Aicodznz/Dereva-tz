import React, { useState, useEffect, useMemo } from 'react';
import { 
  DaladalaVehicle, 
  DaladalaRoute, 
  DaladalaPassengerRecord, 
  DaladalaSessionUser,
  DaladalaSeatHold,
  ConductorShiftTrip
} from '../../types/daladala.types';
import { 
  Users, 
  QrCode, 
  Banknote, 
  AlertTriangle, 
  Gauge, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Minus, 
  RefreshCw,
  Send,
  Radio,
  UserPlus,
  Building2,
  FileText,
  LogOut,
  Clock,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Coins,
  Check,
  PhoneCall,
  Armchair,
  Compass,
  Megaphone,
  Share2,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { speakKiswahili } from '../../utils/daladalaAudioVoice';

interface DaladalaConductorModeProps {
  vehicle: DaladalaVehicle;
  route?: DaladalaRoute;
  onUpdateVehicle: (updated: Partial<DaladalaVehicle>) => void;
  passengers?: DaladalaPassengerRecord[];
  onOpenRegisterPassenger?: () => void;
  onOpenDashboard?: () => void;
  sessionUser?: DaladalaSessionUser | null;
  onLogout?: () => void;
}

export default function DaladalaConductorMode({
  vehicle,
  route,
  onUpdateVehicle,
  passengers = [],
  onOpenRegisterPassenger,
  onOpenDashboard,
  sessionUser,
  onLogout,
}: DaladalaConductorModeProps) {
  // Main tabs: seats, driver, cash, shift, megaphone, scanner, passengers
  const [activeTab, setActiveTab] = useState<'seats' | 'driver' | 'cash' | 'shift' | 'megaphone' | 'scanner' | 'passengers'>('seats');

  // Scanner state
  const [scannedTicketCode, setScannedTicketCode] = useState('');
  const [scanResult, setScanResult] = useState<{ valid: boolean; message: string; passenger?: string } | null>(null);

  // Cash / Change calculator state
  const [receivedAmount, setReceivedAmount] = useState<number>(1000);
  const [ticketFare, setTicketFare] = useState<number>(600);

  // Off route / Traffic report state
  const [isReportingDeviation, setIsReportingDeviation] = useState(false);
  const [deviationReason, setDeviationReason] = useState('Njia ya kawaida ina foleni kali');

  // Driver Stendi Dwell Timer (3-minute terminal limit rule)
  const [isDwellRunning, setIsDwellRunning] = useState(false);
  const [dwellSeconds, setDwellSeconds] = useState(0);

  // Driver Speed Limit Warning state
  const speedLimit = 50; // LATRA 50 km/h city limit
  const isSpeeding = vehicle.speedKmH > speedLimit;

  // Passenger Seat Holds (read from localStorage)
  const [seatHolds, setSeatHolds] = useState<DaladalaSeatHold[]>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_seat_holds');
      if (saved) {
        const parsed: DaladalaSeatHold[] = JSON.parse(saved);
        return parsed.filter((h) => h.vehicleId === vehicle.id && h.expiresAt > Date.now());
      }
    } catch (e) {}
    return [];
  });

  // Shift trips ledger
  const [shiftTrips, setShiftTrips] = useState<ConductorShiftTrip[]>(() => {
    try {
      const key = `papo_daladala_shift_trips_${vehicle.plateNumber}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'trip_1',
        tripNumber: 1,
        departureTime: '06:15 Asubuhi',
        origin: route?.origin || 'Kimara',
        destination: route?.destination || 'Kivukoni',
        passengersCount: 32,
        cashCollected: 16800,
        digitalCollected: 2400,
        fuelSpent: 5000,
        standFee: 1000,
        notes: 'Safari ya asubuhi, abiria wengi wa mjini',
      },
      {
        id: 'trip_2',
        tripNumber: 2,
        departureTime: '08:45 Asubuhi',
        origin: route?.destination || 'Kivukoni',
        destination: route?.origin || 'Kimara',
        passengersCount: 28,
        cashCollected: 14200,
        digitalCollected: 1800,
        fuelSpent: 0,
        standFee: 1000,
        notes: 'Foleni Magomeni Mapipa',
      }
    ];
  });

  // Modal for adding a new trip in shift ledger
  const [isAddTripModalOpen, setIsAddTripModalOpen] = useState(false);
  const [newTripOrigin, setNewTripOrigin] = useState(route?.origin || 'Kimara');
  const [newTripDest, setNewTripDest] = useState(route?.destination || 'Kivukoni');
  const [newTripPax, setNewTripPax] = useState(25);
  const [newTripCash, setNewTripCash] = useState(15000);
  const [newTripDigital, setNewTripDigital] = useState(2000);
  const [newTripFuel, setNewTripFuel] = useState(0);
  const [newTripStandFee, setNewTripStandFee] = useState(1000);

  // Sync shift trips to storage
  useEffect(() => {
    try {
      const key = `papo_daladala_shift_trips_${vehicle.plateNumber}`;
      localStorage.setItem(key, JSON.stringify(shiftTrips));
    } catch (e) {}
  }, [shiftTrips, vehicle.plateNumber]);

  // Terminal Dwell Timer Effect
  useEffect(() => {
    let interval: any;
    if (isDwellRunning) {
      interval = setInterval(() => {
        setDwellSeconds((prev) => {
          const next = prev + 1;
          if (next === 165) {
            // 2m 45s warning
            playSwahiliVoice('Dakika mbili na sekunde arobaini na tano. Ondoa gari kuzuia faini ya stendi!');
            toast.warning('⚠️ Tahadhari ya Stendi: Sekunde 15 zimebaki kabla ya faini ya kukaa kituoni!');
          }
          if (next === 180) {
            // 3 mins exceeded
            toast.error('🚨 Dk 3 Zimeisha! Gari linatakiwa kuondoka sasa kulingana na sheria ya LATRA!');
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isDwellRunning]);

  // Swahili voice synthesis helper with chime & clear transit audio
  const playSwahiliVoice = (text: string) => {
    speakKiswahili(text, true);
    toast.info(`📢 Tangazo: "${text}"`);
  };

  // Audio beep & vibration for quick tap-in/out
  const playBeep = (freq = 600) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {}

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (e) {}
    }
  };

  // Fast Seat adjustments (#6, #20)
  const handleSeatChange = (delta: number) => {
    // delta < 0 means seat freed (+1 seat available), delta > 0 means passenger boarded (-1 seat available)
    const newTaken = Math.max(0, Math.min(vehicle.capacity, vehicle.seatsTaken + delta));
    const seatsRemaining = vehicle.capacity - newTaken;

    let newStatus: DaladalaVehicle['seatStatus'] = 'available';
    if (seatsRemaining === 0) newStatus = vehicle.standingCount > 0 ? 'standing' : 'full';
    else if (seatsRemaining <= 3) newStatus = 'few';

    playBeep(delta > 0 ? 750 : 500);

    onUpdateVehicle({
      seatsTaken: newTaken,
      seatStatus: newStatus,
      lastUpdated: 'Muda huu',
    });

    if (delta > 0) {
      toast.success(`Abiria Amepanda! Viti vilivyobaki: ${seatsRemaining}`);
    } else {
      toast.info(`Abiria Ameshuka! Viti vilivyobaki: ${seatsRemaining}`);
    }
  };

  const handleSetFull = () => {
    playBeep(400);
    onUpdateVehicle({
      seatsTaken: vehicle.capacity,
      seatStatus: 'full',
      lastUpdated: 'Muda huu',
    });
    toast.warning('Gari limewekwa FULL! Abiria hawataona viti wazi.');
  };

  const handleSetStanding = () => {
    playBeep(650);
    onUpdateVehicle({
      seatsTaken: vehicle.capacity,
      standingCount: Math.min(25, vehicle.standingCount + 2),
      seatStatus: 'standing',
      lastUpdated: 'Muda huu',
    });
    toast.info(`Hali ya Msimamo: +2 Abiria wamesimama (Jumla ${vehicle.standingCount + 2})`);
  };

  const handleClearStanding = () => {
    playBeep(550);
    onUpdateVehicle({
      standingCount: 0,
      seatStatus: vehicle.seatsTaken >= vehicle.capacity ? 'full' : 'available',
      lastUpdated: 'Muda huu',
    });
    toast.success('Msimamo umefutwa (Wote wamekaa au wameshuka).');
  };

  // QR Ticket Validator (#19, #20)
  const handleVerifyTicket = () => {
    if (!scannedTicketCode.trim()) {
      toast.error('Weka namba au skani msimbo wa tiketi');
      return;
    }

    if (scannedTicketCode.toUpperCase().includes('DL-') || scannedTicketCode.includes('PAPO-DALADALA')) {
      setScanResult({
        valid: true,
        message: 'Tiketi Halali! Nauli Imethibitishwa.',
        passenger: 'Mteja wa Papo Hapo',
      });
      toast.success('Tiketi imethibitishwa vizuri!');
    } else {
      setScanResult({
        valid: false,
        message: 'Tiketi siyo halali au imekwisha muda wake!',
      });
      toast.error('Tiketi batili!');
    }
  };

  // Confirm seat hold
  const handleVerifySeatHold = (holdId: string) => {
    try {
      const savedRaw = localStorage.getItem('papo_daladala_seat_holds');
      if (savedRaw) {
        const parsed: DaladalaSeatHold[] = JSON.parse(savedRaw);
        const updated = parsed.map((h) => (h.id === holdId ? { ...h, status: 'boarded' as const } : h));
        localStorage.setItem('papo_daladala_seat_holds', JSON.stringify(updated));
        setSeatHolds(updated.filter((h) => h.vehicleId === vehicle.id && h.status === 'active'));
      }
    } catch (e) {}

    // Consume seat
    handleSeatChange(1);
    toast.success('Abiria mwenye namba ya kushikilia amethibitishwa kupanda!');
  };

  // Next Stop Voice Announcer (#21: Driver Mode)
  const handleAnnounceNextStop = () => {
    if (!vehicle.nextStopName) return;
    const text = `Kituo kinachofuata ni ${vehicle.nextStopName}. Abiria wa kushuka tafadhali sogea mlangoni.`;
    playSwahiliVoice(text);
  };

  // Broadcast Route Deviation (#10)
  const handleBroadcastDeviation = () => {
    onUpdateVehicle({
      isOffRoute: true,
      offRouteReason: deviationReason,
      lastUpdated: 'Muda huu',
    });
    setIsReportingDeviation(false);
    toast.warning('Taarifa ya kuchepuka ruti imetumwa kwa abiria wote!');
  };

  // Change Calculation & Currency Breakdown
  const changeDue = Math.max(0, receivedAmount - ticketFare);

  const currencyBreakdown = useMemo(() => {
    let rem = changeDue;
    const notes2000 = Math.floor(rem / 2000);
    rem %= 2000;
    const notes1000 = Math.floor(rem / 1000);
    rem %= 1000;
    const coins500 = Math.floor(rem / 500);
    rem %= 500;
    const coins200 = Math.floor(rem / 200);
    rem %= 200;
    const coins100 = Math.floor(rem / 100);
    rem %= 100;
    const coins50 = Math.floor(rem / 50);

    const parts: string[] = [];
    if (notes2000 > 0) parts.push(`${notes2000} ya 2,000`);
    if (notes1000 > 0) parts.push(`${notes1000} ya 1,000`);
    if (coins500 > 0) parts.push(`${coins500} ya 500`);
    if (coins200 > 0) parts.push(`${coins200} ya 200`);
    if (coins100 > 0) parts.push(`${coins100} ya 100`);
    if (coins50 > 0) parts.push(`${coins50} ya 50`);

    return parts.length > 0 ? parts.join(' + ') : 'Hakuna Chenji (Pesa Kamili)';
  }, [changeDue]);

  // Shift Totals
  const shiftTotals = useMemo(() => {
    const totalCash = shiftTrips.reduce((acc, t) => acc + t.cashCollected, 0);
    const totalDigital = shiftTrips.reduce((acc, t) => acc + t.digitalCollected, 0);
    const totalGross = totalCash + totalDigital;
    const totalFuel = shiftTrips.reduce((acc, t) => acc + t.fuelSpent, 0);
    const totalStand = shiftTrips.reduce((acc, t) => acc + t.standFee, 0);
    const totalExpenses = totalFuel + totalStand;
    const netRevenue = totalGross - totalExpenses;
    const target = 140000; // Demo daily target for Mzee Mwinyi
    const targetPercent = Math.min(100, Math.round((netRevenue / target) * 100));

    return {
      totalCash,
      totalDigital,
      totalGross,
      totalFuel,
      totalStand,
      totalExpenses,
      netRevenue,
      target,
      targetPercent,
    };
  }, [shiftTrips]);

  const handleAddTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const newTrip: ConductorShiftTrip = {
      id: `trip_${Date.now()}`,
      tripNumber: shiftTrips.length + 1,
      departureTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      origin: newTripOrigin,
      destination: newTripDest,
      passengersCount: Number(newTripPax),
      cashCollected: Number(newTripCash),
      digitalCollected: Number(newTripDigital),
      fuelSpent: Number(newTripFuel),
      standFee: Number(newTripStandFee),
      notes: `Tripu ya ${shiftTrips.length + 1}`,
    };

    setShiftTrips((prev) => [...prev, newTrip]);
    setIsAddTripModalOpen(false);
    toast.success(`Tripu ya ${newTrip.tripNumber} imerekodiwa kikamilifu!`);
  };

  const handleSendShiftSummaryWhatsApp = () => {
    const text = `📊 RIPOTI YA MAPATO YA LEO (GARI ${vehicle.plateNumber})\n` +
      `Dereva: ${vehicle.driverName} | Konda: ${vehicle.conductorName}\n` +
      `Jumla ya Tripu: ${shiftTrips.length}\n` +
      `Mapato Jumla (Gross): TSh ${shiftTotals.totalGross.toLocaleString()}\n` +
      `Taslimu (Cash): TSh ${shiftTotals.totalCash.toLocaleString()}\n` +
      `Pesa ya Simu (Digital): TSh ${shiftTotals.totalDigital.toLocaleString()}\n` +
      `Gharama (Mafuta + Stendi): TSh ${shiftTotals.totalExpenses.toLocaleString()}\n` +
      `SALIO LA TAJIRI (Net): TSh ${shiftTotals.netRevenue.toLocaleString()}\n` +
      `Lengo la Siku: TSh ${shiftTotals.target.toLocaleString()} (${shiftTotals.targetPercent}% Imefikiwa)`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* HUD Header: Operator Identity & Plate Capsule */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-black text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
              Njia ya Dereva & Kondakta (Driver & Conductor Command Center)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>Chombo:</span>
            <div className="tz-number-plate text-xs">
              <span className="tz-strip">TZ</span>
              <span>{vehicle.plateNumber}</span>
            </div>
            <span>"{vehicle.nickname}"</span>
            <span>•</span>
            <span className="font-bold text-neutral-800 dark:text-neutral-200">Ruti {vehicle.routeCode}</span>
          </div>
        </div>

        {/* User Identity and Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {sessionUser && (
            <div className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>{sessionUser.fullName.split(' ')[0]}</span>
              <span className="text-[10px] opacity-75">({sessionUser.role === 'driver' ? 'Dereva' : 'Konda'})</span>
            </div>
          )}

          {onOpenRegisterPassenger && (
            <button
              onClick={onOpenRegisterPassenger}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Sajili Abiria</span>
            </button>
          )}

          {onOpenDashboard && sessionUser?.role === 'owner' && (
            <button
              onClick={onOpenDashboard}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Dasibodi</span>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 text-xs font-bold flex items-center gap-1 transition active:scale-95"
              title="Toka kwenye akaunti"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Toka</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation Buttons */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveTab('seats')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'seats'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <span>🪑 Viti & Mlangoni</span>
          <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
            {vehicle.capacity - vehicle.seatsTaken}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('driver')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'driver'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>🚍 Dereva HUD & Spidi</span>
        </button>

        <button
          onClick={() => setActiveTab('cash')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'cash'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>💰 Chenji & Noti</span>
        </button>

        <button
          onClick={() => setActiveTab('shift')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'shift'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>📑 Kitabu cha Tripu</span>
        </button>

        <button
          onClick={() => setActiveTab('megaphone')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'megaphone'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>📢 Vipaza Sauti</span>
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'scanner'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>🎫 Skani QR</span>
        </button>

        <button
          onClick={() => setActiveTab('passengers')}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'passengers'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>👥 Abiria</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FAST DOOR OCCUPANCY COUNTER & SEAT HOLDS          */}
      {/* ========================================================= */}
      {activeTab === 'seats' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Main Seat Capacity Banner */}
          <div className="bg-neutral-50 dark:bg-neutral-800/60 p-4 sm:p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
                Viti Vilivyobaki Wazi (Real-Time Availability)
              </span>
              <div className="flex items-baseline justify-center sm:justify-start gap-2 mt-1">
                <span className="text-4xl sm:text-5xl font-black text-neutral-900 dark:text-white">
                  {Math.max(0, vehicle.capacity - vehicle.seatsTaken)}
                </span>
                <span className="text-sm font-bold text-neutral-400">/ {vehicle.capacity} viti jumla</span>
              </div>
            </div>

            <div className="text-center sm:text-right space-y-1">
              <span className={`inline-block px-3.5 py-1.5 rounded-full font-black text-xs uppercase shadow-xs ${
                vehicle.seatStatus === 'available'
                  ? 'bg-emerald-500 text-white'
                  : vehicle.seatStatus === 'few'
                  ? 'bg-amber-500 text-white'
                  : vehicle.seatStatus === 'standing'
                  ? 'bg-orange-500 text-white'
                  : 'bg-red-600 text-white'
              }`}>
                Hali: {vehicle.seatStatus === 'available' ? '🟢 Kuna Viti Vingi' : vehicle.seatStatus === 'few' ? '🟡 Viti Vichache' : vehicle.seatStatus === 'standing' ? '🟠 Msimamo Tu' : '🔴 FULL (LIMEJAA)'}
              </span>
              {vehicle.standingCount > 0 && (
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                  {vehicle.standingCount} abiria wamesimama
                </p>
              )}
            </div>
          </div>

          {/* Big Door Single-Hand Tap Buttons for Conductor */}
          <div>
            <span className="text-xs font-black text-neutral-700 dark:text-neutral-300 block mb-2 uppercase tracking-wider">
              Kaunta ya Haraka Mlangoni (Door Tap-In / Tap-Out):
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSeatChange(1)}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base flex flex-col items-center justify-center gap-1 shadow-md transition active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-6 h-6 stroke-[3]" />
                  <span>PANDISHA (+1)</span>
                </div>
                <span className="text-[11px] font-normal opacity-90">Abiria amepanda / Kiti kimepungua</span>
              </button>

              <button
                type="button"
                onClick={() => handleSeatChange(-1)}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base flex flex-col items-center justify-center gap-1 shadow-md transition active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Minus className="w-6 h-6 stroke-[3]" />
                  <span>SHUSHA (-1)</span>
                </div>
                <span className="text-[11px] font-normal opacity-90">Abiria ameshuka / Kiti kimefunguka</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons: Full, Standing, Clear */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleSetFull}
              className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm transition active:scale-95"
            >
              🔴 Weka FULL
            </button>
            <button
              onClick={handleSetStanding}
              className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-sm transition active:scale-95"
            >
              🟠 +2 Msimamo
            </button>
            <button
              onClick={handleClearStanding}
              className="py-2.5 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition active:scale-95"
            >
              Futa Msimamo
            </button>
          </div>

          {/* Active Passenger Seat Holds (Kiti Kilichoshikiliwa na Abiria) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Armchair className="w-4 h-4 text-amber-600" />
                <span>Viti Vilivyoshikiliwa na Abiria ({seatHolds.length})</span>
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                Hold ya Dakika 5
              </span>
            </div>

            {seatHolds.length === 0 ? (
              <p className="text-xs text-neutral-500 py-1">
                Hakuna abiria anayeshikilia kiti kwa sasa. Viti vyote viko wazi kupakiwa.
              </p>
            ) : (
              <div className="space-y-2">
                {seatHolds.map((hold) => (
                  <div
                    key={hold.id}
                    className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-mono font-black text-xs">
                          {hold.holdCode}
                        </span>
                        <strong className="text-xs text-neutral-900 dark:text-white">
                          {hold.passengerName}
                        </strong>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Anapandia: <strong>{hold.boardingStop}</strong> • Kushukia: {hold.alightStop} • Nauli: TSh {hold.fareTzs}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${hold.passengerPhone}`}
                        className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300"
                        title="Piga simu kwa abiria huyu"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleVerifySeatHold(hold.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Amepanda</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DRIVER COCKPIT HUD, SPEEDOMETER & DWELL TIMER      */}
      {/* ========================================================= */}
      {activeTab === 'driver' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Speed Limit Alarm Banner if exceeding LATRA 50 km/h */}
          {isSpeeding && (
            <div className="p-3.5 rounded-2xl bg-red-600 text-white flex items-center justify-between gap-3 shadow-lg animate-bounce">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h4 className="font-black text-sm">TAHADHARINI: UMEZIDI KIKOMO CHA SPIDI!</h4>
                  <p className="text-xs text-white/90">
                    Kasi ya sasa ni {vehicle.speedKmH} km/h (Kikomo cha LATRA mjini ni 50 km/h). Punguza mwendo kuzuia faini au ajali!
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onUpdateVehicle({ speedKmH: 45 });
                  toast.info('Mwendo umepunguzwa hadi 45 km/h.');
                }}
                className="px-3 py-1.5 rounded-xl bg-white text-red-700 font-black text-xs shrink-0"
              >
                Punguza Spidi
              </button>
            </div>
          )}

          {/* Cockpit HUD Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Speedometer */}
            <div className="p-4 rounded-2xl bg-neutral-900 text-white flex flex-col items-center justify-center text-center space-y-1 relative overflow-hidden">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">
                Spidi ya Sasa (HUD)
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                  isSpeeding ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                }`}>
                  {vehicle.speedKmH}
                </span>
                <span className="text-xs font-bold text-neutral-400">km/h</span>
              </div>
              <span className="text-[10px] text-neutral-400">
                Kikomo LATRA: <strong className="text-white">50 km/h</strong> mjini
              </span>
            </div>

            {/* Next Stop & Voice Announce */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">
                  Kituo Kinachofuata
                </span>
                <h4 className="text-base font-black text-neutral-900 dark:text-white truncate mt-0.5">
                  {vehicle.nextStopName || 'Kituo cha Mbele'}
                </h4>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  ETA: Dk ~{vehicle.etaMinutesToNextStop}
                </p>
              </div>

              <button
                onClick={handleAnnounceNextStop}
                className="mt-3 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                <span>Tangaza kwa Sauti</span>
              </button>
            </div>

            {/* Terminal Dwell Timer (3-minute rule) */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                    Kipima Muda Stendi
                  </span>
                  <span className="text-[10px] text-neutral-400 font-bold">Max Dk 3</span>
                </div>
                <div className="flex items-baseline gap-1 my-1">
                  <span className={`text-2xl sm:text-3xl font-black font-mono ${
                    dwellSeconds >= 165 ? 'text-red-600 animate-pulse' : 'text-neutral-900 dark:text-white'
                  }`}>
                    {Math.floor(dwellSeconds / 60)}:{(dwellSeconds % 60) < 10 ? '0' : ''}{dwellSeconds % 60}
                  </span>
                  <span className="text-xs text-neutral-400">/ 03:00</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsDwellRunning(!isDwellRunning)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition ${
                    isDwellRunning
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isDwellRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isDwellRunning ? 'Sitisha' : 'Anza'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDwellRunning(false);
                    setDwellSeconds(0);
                  }}
                  className="p-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  title="Weka sifuri"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Traffic Police & Speed Radar Alerts */}
          <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2">
            <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-wider block">
              Vituo vya Ukaguzi wa Trafiki & Kamera za Spidi (Radar Alerts):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <strong className="block text-neutral-900 dark:text-white">Kamera ya Selander Bridge</strong>
                  <span className="text-[11px] text-neutral-500">Spidi Max: 50 km/h • Kamera ya picha inafanya kazi</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">HAI</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <strong className="block text-neutral-900 dark:text-white">Ukaguzi Magomeni Mapipa</strong>
                  <span className="text-[11px] text-neutral-500">Askari wa Trafiki wanakagua leseni na stika ya LATRA</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black">TAHADHARI</span>
              </div>
            </div>
          </div>

          {/* Route Deviation Broadcaster (#10) */}
          <div className="p-3.5 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Arifa ya Kuchepuka Ruti (Off-Route Deviation)
              </span>
              <button
                onClick={() => setIsReportingDeviation(!isReportingDeviation)}
                className="text-xs font-bold text-red-600 underline"
              >
                {isReportingDeviation ? 'Funga' : 'Badili Njia'}
              </button>
            </div>

            {isReportingDeviation && (
              <div className="space-y-2 pt-2 border-t border-red-200 dark:border-red-900">
                <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block">
                  Sababu ya Kukatisha/Kuchepuka Ruti:
                </label>
                <select
                  value={deviationReason}
                  onChange={(e) => setDeviationReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs bg-white dark:bg-neutral-800"
                >
                  <option value="Njia ya kawaida ina foleni kali sana">Njia ya kawaida ina foleni kali</option>
                  <option value="Kuna ajali imefunga barabara mbele">Kuna ajali imefunga barabara mbele</option>
                  <option value="Barabara imejaa maji ya mvua">Barabara imejaa maji ya mvua</option>
                  <option value="Matengenezo ya barabara (Roadworks)">Matengenezo ya barabara (Roadworks)</option>
                </select>
                <button
                  onClick={handleBroadcastDeviation}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md"
                >
                  Tuma Arifa kwa Abiria Wote
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SMART TZS CHANGE CALCULATOR & CURRENCY BREAKDOWN   */}
      {/* ========================================================= */}
      {activeTab === 'cash' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount Received from Passenger */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                Pesa Iliyotolewa na Abiria (Received):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1000, 2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setReceivedAmount(amt)}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition border ${
                      receivedAmount === amt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    TSh {amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(Number(e.target.value))}
                className="w-full mt-2 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold font-mono"
                placeholder="Andika kiasi kingine..."
              />
            </div>

            {/* Ticket Fare */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                Nauli ya Safari (Fare):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[200, 500, 600, 700].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTicketFare(f)}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition border ${
                      ticketFare === f
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {f === 200 ? '200 (Mwnz)' : `TSh ${f}`}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setTicketFare(800)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border ${
                    ticketFare === 800 ? 'bg-emerald-600 text-white' : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  TSh 800
                </button>
                <button
                  type="button"
                  onClick={() => setTicketFare(1000)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border ${
                    ticketFare === 1000 ? 'bg-emerald-600 text-white' : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  TSh 1,000
                </button>
              </div>
            </div>
          </div>

          {/* Change Display Hero Card with Breakdown */}
          <div className="p-5 rounded-2xl bg-neutral-900 text-white space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider block">
                  Chenji ya Kumrudishia Abiria
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight">
                    TSh {changeDue.toLocaleString()}
                  </span>
                  <span className="text-xs text-neutral-400">
                    ({receivedAmount.toLocaleString()} - {ticketFare.toLocaleString()})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  toast.success(`Chenji ya TSh ${changeDue.toLocaleString()} imelipwa kikamilifu!`);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs transition active:scale-95 shadow-md"
              >
                Nimempa Chenji
              </button>
            </div>

            {/* Currency Breakdown Helper */}
            <div className="p-3 rounded-xl bg-white/10 flex items-start gap-2 text-xs">
              <Coins className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-200 font-bold">Mchanganuo wa Sarafu & Noti:</strong>
                <p className="text-white/90 font-mono mt-0.5">
                  {currencyBreakdown}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: SHIFT TRIPS LEDGER & REVENUE TRACKING              */}
      {/* ========================================================= */}
      {activeTab === 'shift' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header & Quick Add Trip Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-black text-sm text-neutral-900 dark:text-white">
                Kitabu cha Tripu na Hesabu ya Tajiri (Shift Ledger)
              </h4>
              <p className="text-xs text-neutral-500">
                Gari {vehicle.plateNumber} • Dereva: {vehicle.driverName} • Konda: {vehicle.conductorName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendShiftSummaryWhatsApp}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Tuma kwa Tajiri (WhatsApp)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddTripModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Rekodi Tripu Mpya</span>
              </button>
            </div>
          </div>

          {/* Shift Performance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 font-bold block uppercase">Mapato Jumla (Gross)</span>
              <strong className="text-base font-black text-blue-600 font-mono block mt-1">
                TSh {shiftTotals.totalGross.toLocaleString()}
              </strong>
              <span className="text-[10px] text-neutral-400">Taslimu + Simu</span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 font-bold block uppercase">Gharama za Njia</span>
              <strong className="text-base font-black text-red-600 font-mono block mt-1">
                TSh {shiftTotals.totalExpenses.toLocaleString()}
              </strong>
              <span className="text-[10px] text-neutral-400">Mafuta: {shiftTotals.totalFuel.toLocaleString()}</span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 font-bold block uppercase">Salio la Tajiri (Net)</span>
              <strong className="text-base font-black text-emerald-600 font-mono block mt-1">
                TSh {shiftTotals.netRevenue.toLocaleString()}
              </strong>
              <span className="text-[10px] text-neutral-400">Iliyobaki mkononi</span>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-500 font-bold block uppercase">Lengo la Siku</span>
              <strong className="text-base font-black text-amber-600 font-mono block mt-1">
                {shiftTotals.targetPercent}%
              </strong>
              <span className="text-[10px] text-neutral-400">Target: TSh 140,000</span>
            </div>
          </div>

          {/* List of Shift Trips */}
          <div className="space-y-2">
            {shiftTrips.map((trip) => (
              <div
                key={trip.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-black text-xs">
                      Tripu {trip.tripNumber}
                    </span>
                    <strong className="text-xs text-neutral-900 dark:text-white">
                      {trip.origin} ➔ {trip.destination}
                    </strong>
                    <span className="text-[10px] text-neutral-400">({trip.departureTime})</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Abiria: <strong>{trip.passengersCount}</strong> • Taslimu: TSh {trip.cashCollected.toLocaleString()} • Simu: TSh {trip.digitalCollected.toLocaleString()}
                    {trip.fuelSpent > 0 ? ` • Mafuta: TSh ${trip.fuelSpent.toLocaleString()}` : ''}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400 block">
                    +TSh {(trip.cashCollected + trip.digitalCollected - trip.fuelSpent - trip.standFee).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-400">Salio la Tripu</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: SWAHILI VOICE MEGAPHONE FOR CONDUCTORS             */}
      {/* ========================================================= */}
      {activeTab === 'megaphone' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div>
            <h4 className="font-black text-sm text-neutral-900 dark:text-white">
              Vipaza Sauti vya Konda (Audio Megaphone & Calls)
            </h4>
            <p className="text-xs text-neutral-500">
              Vifungo vya papo hapo vya kupiga sauti ya Kiswahili ya konda kuita abiria na kutangaza vituo
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                title: 'Kariakoo Wawili Wazima!',
                text: 'Kariakoo! Kariakoo posta! Wawili wazima viti vipo mbele!',
                icon: '📢',
              },
              {
                title: 'Nani Anashuka Kituo Mbele?',
                text: 'Kituo mbele! Nani anashuka Mbuyuni au Makumbusho sogea mlangoni!',
                icon: '🚪',
              },
              {
                title: 'Wanafunzi Kaeni Wawili Kiti Kimoja!',
                text: 'Wanafunzi kaeni wawili kiti kimoja kutoa nafasi kwa wakubwa!',
                icon: '🎒',
              },
              {
                title: 'Wenye Chenji Kubwa Toeni Mapema!',
                text: 'Wenye noti kubwa za elfu tano na elfu kumi toeni mapema kabla hatujafika kituoni!',
                icon: '💵',
              },
              {
                title: 'Konda Shusha Hapo Mbele ya Mataa!',
                text: 'Dereva shusha hapo mbele ya mataa kwa usalama wa abiria!',
                icon: '🚦',
              },
              {
                title: 'Mwisho wa Safari - Kila Mtu Ashuke!',
                text: 'Mwisho wa safari! Hakikisha hujaacha mzigo au simu yako kwenye kiti!',
                icon: '🛑',
              },
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => playSwahiliVoice(item.text)}
                className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-neutral-200 dark:border-neutral-800 text-left flex items-start gap-3 transition active:scale-95 group"
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <strong className="text-xs text-neutral-900 dark:text-white group-hover:text-blue-600 block">
                    {item.title}
                  </strong>
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                    "{item.text}"
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: TICKET SCANNER & QR VALIDATOR                      */}
      {/* ========================================================= */}
      {activeTab === 'scanner' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
              Thibitisha Namba ya Tiketi au Skani QR:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scannedTicketCode}
                onChange={(e) => setScannedTicketCode(e.target.value)}
                placeholder="Mf. DL-482910 au PAPO-DALADALA..."
                className="flex-1 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleVerifyTicket}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition active:scale-95"
              >
                Thibitisha
              </button>
            </div>
          </div>

          {scanResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
              scanResult.valid
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}>
              {scanResult.valid ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
              <div>
                <p className="font-black text-sm">{scanResult.message}</p>
                {scanResult.passenger && <p className="text-xs opacity-90">Abiria: {scanResult.passenger}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: PASSENGERS LIST                                    */}
      {/* ========================================================= */}
      {activeTab === 'passengers' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-xs uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Orodha ya Abiria Waliopo Kwenye Gari ({passengers.length})
            </h4>
            {onOpenRegisterPassenger && (
              <button
                onClick={onOpenRegisterPassenger}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Sajili Abiria
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {passengers.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">
                Hakuna abiria aliyesajiliwa kwenye chombo hiki kwa sasa.
              </p>
            ) : (
              passengers.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <strong className="text-neutral-900 dark:text-white block">{p.passengerName}</strong>
                    <span className="text-[11px] text-neutral-500">
                      {p.boardingStop} ➔ {p.destinationStop} • Nauli: TSh {p.fareTzs} ({p.paymentMethod})
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    p.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.paymentStatus === 'paid' ? 'Imelipwa' : 'Haijalipwa'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal for Recording a New Shift Trip */}
      {isAddTripModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <h4 className="font-black text-sm text-neutral-900 dark:text-white">
                Rekodi Tripu Mpya (Trip {shiftTrips.length + 1})
              </h4>
              <button
                onClick={() => setIsAddTripModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrip} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="font-bold block mb-1">Kuanzia:</label>
                  <input
                    type="text"
                    required
                    value={newTripOrigin}
                    onChange={(e) => setNewTripOrigin(e.target.value)}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Kuelekea:</label>
                  <input
                    type="text"
                    required
                    value={newTripDest}
                    onChange={(e) => setNewTripDest(e.target.value)}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="font-bold block mb-1">Idadi ya Abiria:</label>
                  <input
                    type="number"
                    required
                    value={newTripPax}
                    onChange={(e) => setNewTripPax(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Pesa Taslimu:</label>
                  <input
                    type="number"
                    required
                    value={newTripCash}
                    onChange={(e) => setNewTripCash(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Pesa ya Simu:</label>
                  <input
                    type="number"
                    value={newTripDigital}
                    onChange={(e) => setNewTripDigital(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="font-bold block mb-1">Gharama ya Mafuta (TSh):</label>
                  <input
                    type="number"
                    value={newTripFuel}
                    onChange={(e) => setNewTripFuel(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Ushuru wa Stendi (TSh):</label>
                  <input
                    type="number"
                    value={newTripStandFee}
                    onChange={(e) => setNewTripStandFee(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTripModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md"
                >
                  Hifadhi Tripu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
