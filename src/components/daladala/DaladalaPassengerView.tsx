import React, { useState, useEffect } from 'react';
import { 
  DaladalaRoute, 
  DaladalaVehicle, 
  DaladalaStop, 
  TrafficReport, 
  DaladalaTicket,
  AlightReminder 
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
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaPassengerViewProps {
  routes: DaladalaRoute[];
  vehicles: DaladalaVehicle[];
  selectedVehicle: DaladalaVehicle | null;
  onSelectVehicle: (v: DaladalaVehicle) => void;
  trafficReports: TrafficReport[];
  userCoords: { lat: number; lng: number } | null;
  onOpenRoutePlanner: () => void;
}

export default function DaladalaPassengerView({
  routes,
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  trafficReports,
  userCoords,
  onOpenRoutePlanner,
}: DaladalaPassengerViewProps) {
  // Search query & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('all');
  const [seatFilter, setSeatFilter] = useState<'all' | 'available_only'>('all');

  // Nishushe Hapa (Alight Reminder) state
  const [alightReminder, setAlightReminder] = useState<AlightReminder | null>(() => {
    const saved = localStorage.getItem('papo_daladala_alight_reminder');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAlightModalOpen, setIsAlightModalOpen] = useState(false);
  const [targetAlightStopId, setTargetAlightStopId] = useState<string>('');

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

      // Trigger alarm if within 450 meters or if next stop is the target stop
      if (distMeters <= 450 || monitoredVehicle.nextStopId === targetStop.id) {
        setAlightReminder((prev) => (prev ? { ...prev, triggered: true } : null));
        
        // Vibration and Sound Chime
        if ('vibrate' in navigator) {
          navigator.vibrate([400, 200, 400, 200, 600]);
        }

        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        } catch (e) {}

        toast.warning(`🔔 SHUSHA DEREVA! Kituo cha ${targetStop.name} kiko mbele yako (Mita ${distMeters})!`, {
          duration: 10000,
        });
      }
    }
  }, [vehicles, alightReminder, routes]);

  // Filter daladalas
  const filteredVehicles = vehicles.filter((v) => {
    if (selectedRouteFilter !== 'all' && v.routeId !== selectedRouteFilter) return false;
    if (seatFilter === 'available_only' && v.seatStatus !== 'available' && v.seatStatus !== 'few') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlate = v.plateNumber.toLowerCase().includes(q);
      const matchNickname = v.nickname.toLowerCase().includes(q);
      const matchRoute = v.routeName.toLowerCase().includes(q);
      const matchNextStop = v.nextStopName.toLowerCase().includes(q);
      if (!matchPlate && !matchNickname && !matchRoute && !matchNextStop) return false;
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
    });

    setIsAlightModalOpen(false);
    toast.success(`Kengele imewashwa! Utapata arifa kabla ya kufika kituo cha ${targetStop.name}`);
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

      {/* 15: Find My Daladala Search Bar & Quick Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta daladala, ruti au kituo (k.m. Mbagala, Posta, Kimara, T 392 DKR)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
            >
              Futa
            </button>
          )}
        </div>

        {/* Route & Seat Availability Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <button
            onClick={() => setSelectedRouteFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition ${
              selectedRouteFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
          >
            Ruti Zote
          </button>
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRouteFilter(r.id)}
              className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                selectedRouteFilter === r.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
              {r.routeCode}: {r.name.split('⇄')[0].trim()}
            </button>
          ))}
          <button
            onClick={() => setSeatFilter(seatFilter === 'all' ? 'available_only' : 'all')}
            className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition border ${
              seatFilter === 'available_only'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            🪑 Viti Wazi Tu
          </button>
        </div>
      </div>

      {/* Main Content Area: Left/Top Selected Vehicle Card, Right/Bottom List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Selected Daladala Detail Card (Features 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19) */}
        {selectedVehicle ? (
          <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col space-y-3.5">
            {/* Header: Plate, Nickname, Model & Close */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-neutral-900 dark:text-white">
                    {selectedVehicle.plateNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold text-[10px]">
                    {selectedVehicle.routeCode}
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 italic">
                  "{selectedVehicle.nickname}" • {selectedVehicle.vehicleModel}
                </p>
                <p className="text-[11px] text-neutral-500">{selectedVehicle.routeName}</p>
              </div>
              
              {/* Seat Availability Badge (#6) */}
              <div className="text-right">
                <span className={`inline-block px-2.5 py-1 rounded-full font-black text-[10px] uppercase shadow-sm ${
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
                    : '🔴 FULL (Imejaa)'}
                </span>
                <p className="text-[9px] text-neutral-400 mt-0.5">{selectedVehicle.lastUpdated}</p>
              </div>
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
            <div className="grid grid-cols-3 gap-2 bg-neutral-50 dark:bg-neutral-800/60 p-2.5 rounded-xl text-center">
              <div>
                <span className="text-[10px] text-neutral-500 font-semibold block">Kituo Kinachofuata</span>
                <strong className="text-xs text-neutral-900 dark:text-neutral-100 truncate block">
                  {selectedVehicle.nextStopName}
                </strong>
              </div>
              <div className="border-x border-neutral-200 dark:border-neutral-700 px-1">
                <span className="text-[10px] text-neutral-500 font-semibold block">Muda wa Kufika (ETA)</span>
                <strong className="text-xs text-emerald-600 dark:text-emerald-400 block">
                  Dk {selectedVehicle.etaMinutesToNextStop}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 font-semibold block">Kasi ya Gari</span>
                <strong className="text-xs text-neutral-900 dark:text-neutral-100 block">
                  {selectedVehicle.speedKmH} km/h
                </strong>
              </div>
            </div>

            {/* Conductor & Driver Info with Rating (#12) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-xs">
              <div>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  {selectedVehicle.conductorName}
                </p>
                <p className="text-[10px] text-neutral-500">Dereva: {selectedVehicle.driverName}</p>
                <div className="flex items-center gap-1 text-amber-500 text-[11px] mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{selectedVehicle.rating}</span>
                  <span className="text-[10px] text-neutral-400">({selectedVehicle.ratingCount} kura)</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${selectedVehicle.conductorPhone}`}
                  className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition"
                  title="Piga simu kwa Konda"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setIsRatingModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] font-bold"
                >
                  Tathmini
                </button>
              </div>
            </div>

            {/* Quick Action Buttons: Nishushe Hapa, Kata Tiketi QR, SOS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* #9: Nishushe Hapa Alarm Button */}
              <button
                onClick={() => {
                  setTargetAlightStopId(currentRoute?.stops[3]?.id || '');
                  setIsAlightModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md transition"
              >
                <Bell className="w-4 h-4" />
                <span>Nishushe Hapa</span>
              </button>

              {/* #17, #19: QR Ticket & Wallet Payment */}
              <button
                onClick={() => {
                  setTicketOriginStop(currentRoute?.stops[0]?.id || '');
                  setTicketDestinationStop(currentRoute?.stops[currentRoute.stops.length - 1]?.id || '');
                  setIsTicketModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs shadow-md transition"
              >
                <QrCode className="w-4 h-4" />
                <span>Kata Tiketi / QR</span>
              </button>
            </div>

            {/* #11: Emergency / SOS Button */}
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
            <h3 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Magari Yaliyopo Barabarani ({filteredVehicles.length})
            </h3>
            <span className="text-[11px] text-neutral-500 font-semibold">Live GPS Updates</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
            {filteredVehicles.map((v) => {
              const isSelected = selectedVehicle?.id === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => onSelectVehicle(v)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm"
                      style={{ backgroundColor: v.colorHex || '#2563eb' }}
                    >
                      <Bus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-neutral-900 dark:text-white">
                          {v.plateNumber}
                        </span>
                        <span className="text-[10px] font-bold text-neutral-500">"{v.nickname}"</span>
                      </div>
                      <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[200px] sm:max-w-xs">
                        {v.routeName}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        Inakaribia: <strong className="text-neutral-600 dark:text-neutral-300">{v.nextStopName}</strong> ({v.etaMinutesToNextStop} min)
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                      v.seatStatus === 'available'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : v.seatStatus === 'few'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : v.seatStatus === 'standing'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {v.seatStatus === 'available' ? 'Viti Wazi' : v.seatStatus === 'few' ? 'Viti Vichache' : v.seatStatus === 'standing' ? 'Msimamo' : 'FULL'}
                    </span>
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 mt-1">
                      TSh 500 - 600
                    </p>
                  </div>
                </div>
              );
            })}
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

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  Jinsi Inavyofanya Kazi:
                </p>
                <p className="text-[11px] opacity-90">
                  Gari likiwa mita 450 kabla ya kufika kituoni, simu yako itatoa sauti ya kengele (chime) na mtetemo (vibrate) ili ujiandae kushuka salama.
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
    </div>
  );
}
