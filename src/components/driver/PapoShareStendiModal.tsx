import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, MapPin, Navigation, Users, DollarSign, 
  CheckCircle2, AlertCircle, Phone, MessageSquare, 
  Play, Pause, Trash2, Edit3, Sparkles, ShieldCheck,
  ChevronRight, Car, Compass, ArrowRight, Check
} from 'lucide-react';
import { 
  StandPoolingRoute, 
  StandLocation, 
  StandPricingModel, 
  POPULAR_STANDS, 
  POPULAR_DESTINATIONS,
  createOrUpdateStandRoute, 
  listenDriverActiveStandRoute, 
  updateStandRouteStatus,
  calculateStandSystemKmFare,
  getDistanceKm
} from '../../services/standPoolingService';
import { toast } from 'sonner';

interface PapoShareStendiModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverUser: any;
  driverProfile: any;
  currentGpsPosition?: [number, number];
}

export default function PapoShareStendiModal({
  isOpen,
  onClose,
  driverUser,
  driverProfile,
  currentGpsPosition
}: PapoShareStendiModalProps) {
  const driverId = driverUser?.uid || driverProfile?.id || 'demo_driver';
  const driverName = driverProfile?.displayName || driverUser?.displayName || 'Dereva';
  const driverPhone = driverProfile?.phoneNumber || driverProfile?.phone || '';
  const vehicleType = (driverProfile?.vehicleType === 'mini' ? 'mini' : 'bajaj') as 'bajaj' | 'mini';

  const [activeRoute, setActiveRoute] = useState<StandPoolingRoute | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedStand, setSelectedStand] = useState<StandLocation>(POPULAR_STANDS[0]);
  const [customStandName, setCustomStandName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<StandLocation>(POPULAR_DESTINATIONS[0]);
  const [customDestName, setCustomDestName] = useState('');

  const [chosenVehicleType, setChosenVehicleType] = useState<'bajaj' | 'mini'>(vehicleType);
  const [totalSeats, setTotalSeats] = useState<number>(vehicleType === 'mini' ? 4 : 3);
  const [pricingModel, setPricingModel] = useState<StandPricingModel>('custom_fixed');
  const [fixedFare, setFixedFare] = useState<number>(2500);

  // Listen to driver's active route in real-time
  useEffect(() => {
    if (!driverId) return;
    const unsubscribe = listenDriverActiveStandRoute(driverId, (route) => {
      setActiveRoute(route);
      if (route) {
        setChosenVehicleType(route.vehicleType);
        setPricingModel(route.pricingModel);
        setFixedFare(route.fixedPricePerSeat || 2500);
      }
    });
    return () => unsubscribe();
  }, [driverId]);

  // Use current GPS if available
  const handleUseCurrentLocation = () => {
    if (currentGpsPosition && currentGpsPosition[0] && currentGpsPosition[1]) {
      setSelectedStand({
        name: 'Eneo Langu la Sasa (GPS)',
        lat: currentGpsPosition[0],
        lng: currentGpsPosition[1],
        address: 'GPS Stand Location'
      });
      toast.success("Eneo lako la GPS limewekwa kama kituo cha kuanzia!");
    } else {
      toast.info("GPS haipatikani kwa sasa, tafadhali chagua stendi hapa chini.");
    }
  };

  const handlePublishRoute = async () => {
    setLoading(true);
    try {
      const standToUse: StandLocation = customStandName.trim()
        ? {
            name: customStandName.trim(),
            lat: selectedStand.lat,
            lng: selectedStand.lng,
            address: customStandName.trim()
          }
        : selectedStand;

      const destToUse: StandLocation = customDestName.trim()
        ? {
            name: customDestName.trim(),
            lat: selectedDestination.lat,
            lng: selectedDestination.lng,
            address: customDestName.trim()
          }
        : selectedDestination;

      const dist = getDistanceKm(standToUse.lat, standToUse.lng, destToUse.lat, destToUse.lng);
      const systemFare = calculateStandSystemKmFare(dist, chosenVehicleType);

      await createOrUpdateStandRoute(driverId, {
        driverName,
        driverPhone,
        driverPhoto: driverProfile?.photoURL || '',
        driverRating: driverProfile?.rating || 4.9,
        isVerifiedDriver: true,
        vehicleType: chosenVehicleType,
        vehiclePlate: driverProfile?.licensePlate || driverProfile?.vehiclePlate || 'T 240 ABC',
        vehicleModel: driverProfile?.vehicleModel || (chosenVehicleType === 'bajaj' ? 'Bajaji TVS King' : 'Toyota Passo'),
        isActive: true,
        standLocation: standToUse,
        destination: destToUse,
        pricingModel,
        fixedPricePerSeat: Number(fixedFare) || 2500,
        systemFarePerSeat: systemFare,
        totalSeats,
        availableSeats: totalSeats,
        occupiedSeats: 0,
        passengers: [],
        status: 'boarding',
        notes: 'Safari ya PapoShare kuanzia stendi/kijiweni'
      });

      toast.success("🎉 Safari ya PapoShare Stendi imetangazwa hewani!");
    } catch (err: any) {
      toast.error(err?.message || "Imeshindikana kutangaza safari. Tafadhali jaribu tena.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!activeRoute) return;
    try {
      await updateStandRouteStatus(driverId, 'started');
      toast.success("🚀 Safari imeanza! Abiria wote wamearifiwa moja kwa moja.");
    } catch (err) {
      toast.error("Imeshindikana kuanza safari.");
    }
  };

  const handleTogglePause = async () => {
    if (!activeRoute) return;
    try {
      const newActive = !activeRoute.isActive;
      await createOrUpdateStandRoute(driverId, { isActive: newActive });
      toast.info(newActive ? "Safari imewashwa hewani tena!" : "Safari imesitishwa kwa muda.");
    } catch (err) {
      toast.error("Hitilafu imetokea.");
    }
  };

  const handleCloseTrip = async () => {
    if (!activeRoute) return;
    if (confirm("Je, una uhakika unataka kufunga au kughairi safari hii ya stendi?")) {
      try {
        await updateStandRouteStatus(driverId, 'cancelled');
        toast.info("Safari ya stendi imefungwa.");
      } catch (err) {
        toast.error("Imeshindikana kufunga safari.");
      }
    }
  };

  const handleAdjustSeats = async (delta: number) => {
    if (!activeRoute) return;
    const currentAvail = activeRoute.availableSeats;
    const newAvail = Math.max(0, Math.min(activeRoute.totalSeats - activeRoute.occupiedSeats, currentAvail + delta));
    try {
      await createOrUpdateStandRoute(driverId, {
        availableSeats: newAvail,
        status: newAvail === 0 ? 'full' : 'boarding'
      });
      toast.success(`Viti vimesasishwa: ${newAvail} vilivyobaki`);
    } catch (err) {
      toast.error("Hitilafu katika kubadili viti.");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="w-full max-w-lg bg-white dark:bg-[#111118] rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-[#222233] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                🚕
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight">PAPOSHARE STENDI</h2>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-neutral-950 tracking-wider">
                    Kijiweni
                  </span>
                </div>
                <p className="text-[11px] text-white/80 font-medium">
                  Tangaza viti ukiwa stendi • Chagua bei yako au ya mfumo
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* IF DRIVER HAS AN ACTIVE STAND ROUTE */}
            {activeRoute && activeRoute.status !== 'cancelled' && activeRoute.status !== 'completed' ? (
              <div className="space-y-4">
                {/* Active Route Status Card */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                        {activeRoute.status === 'started'
                          ? '🚀 Safari Imeanza'
                          : activeRoute.availableSeats === 0
                          ? '🟡 Viti Vimejaa (Tayari Kuondoka)'
                          : activeRoute.isActive
                          ? '🟢 Inajaza Viti Kijiweni'
                          : '⏸️ Imesitishwa kwa Muda'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleTogglePause}
                        className="px-2.5 py-1 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1 hover:bg-neutral-300"
                      >
                        {activeRoute.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{activeRoute.isActive ? 'Pumzika' : 'Washa'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Route details */}
                  <div className="bg-white dark:bg-[#161622] p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {activeRoute.standLocation?.name || 'Stendi'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-neutral-400" />
                      <Compass className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {activeRoute.destination?.name || 'Uelekeo'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800/80 text-[11px]">
                      <span className="font-semibold text-neutral-500">
                        Chombo: <span className="text-neutral-800 dark:text-neutral-200 font-bold uppercase">{activeRoute.vehicleType === 'bajaj' ? '🚕 Bajaji' : '🚗 Mini'}</span>
                      </span>
                      <span className="font-semibold text-neutral-500">
                        Bei: <span className="text-emerald-600 dark:text-emerald-400 font-black">
                          {activeRoute.pricingModel === 'custom_fixed'
                            ? `TZS ${activeRoute.fixedPricePerSeat?.toLocaleString()} / kiti`
                            : '📏 Bei ya Mfumo (KM)'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Seats Summary & Adjustment */}
                  <div className="flex items-center justify-between bg-white dark:bg-[#161622] p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Hali ya Viti</p>
                      <p className="text-sm font-black text-neutral-900 dark:text-white">
                        {activeRoute.occupiedSeats} zimejaa / {activeRoute.totalSeats} jumla
                      </p>
                      <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        Viti {activeRoute.availableSeats} vimebaki
                      </p>
                    </div>

                    {/* Stepper for available seats */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdjustSeats(-1)}
                        disabled={activeRoute.availableSeats <= 0}
                        className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-black text-sm flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-base w-5 text-center">
                        {activeRoute.availableSeats}
                      </span>
                      <button
                        onClick={() => handleAdjustSeats(1)}
                        disabled={activeRoute.availableSeats + activeRoute.occupiedSeats >= activeRoute.totalSeats}
                        className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-black text-sm flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Booked Passengers Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      Abiria Waliohifadhi Viti ({activeRoute.passengers?.filter(p => p.status === 'booked').length || 0})
                    </h3>
                  </div>

                  {(!activeRoute.passengers || activeRoute.passengers.filter(p => p.status === 'booked').length === 0) ? (
                    <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center">
                      <Users className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700 mb-1" />
                      <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                        Bado hakuna abiria aliyehifadhi kiti
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        Safari yako inaonekana kwa wateja waliopo karibu na stendi yako.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeRoute.passengers
                        .filter(p => p.status === 'booked')
                        .map((p, idx) => (
                          <div
                            key={p.passengerId || idx}
                            className="p-3 rounded-xl bg-neutral-50 dark:bg-[#161622] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200 truncate">
                                  {p.passengerName || 'Abiria'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-extrabold text-[9px]">
                                  Siti {p.seats || 1}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                                📍 Kushuka: {p.dropoffName} • TZS {p.fare?.toLocaleString()}
                              </p>
                            </div>

                            {/* Direct Call / Contact button */}
                            {p.passengerPhone && (
                              <a
                                href={`tel:${p.passengerPhone}`}
                                className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 hover:bg-emerald-500"
                                title="Piga simu kwa abiria"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2 pt-2">
                  {activeRoute.status !== 'started' ? (
                    <button
                      onClick={handleStartTrip}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-98 transition-all"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>ANZA SAFARI (ONDOKA STENDI)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        updateStandRouteStatus(driverId, 'completed');
                        toast.success("Safiri imekamilika kikamilifu!");
                      }}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>KAMILISHA SAFARI HII</span>
                    </button>
                  )}

                  <button
                    onClick={handleCloseTrip}
                    className="w-full py-2.5 bg-transparent hover:bg-red-500/10 text-red-500 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Funga / Ghairi Safari Hii</span>
                  </button>
                </div>
              </div>
            ) : (
              /* FORM TO CREATE / PUBLISH A NEW STAND ROUTE */
              <div className="space-y-4">
                {/* 1. Stendi Ulipo (Pickup Hub) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>📍 Stendi / Kijiwe Ulipo</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>📍 Eneo Langu (GPS)</span>
                    </button>
                  </div>

                  {/* Selected stand pill */}
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300/60 dark:border-emerald-800/60 flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      {customStandName.trim() || selectedStand.name}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Imeteuliwa</span>
                  </div>

                  {/* Quick Select Popular Stands */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {POPULAR_STANDS.slice(0, 8).map((st) => (
                      <button
                        key={st.name}
                        type="button"
                        onClick={() => {
                          setSelectedStand(st);
                          setCustomStandName('');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          selectedStand.name === st.name && !customStandName
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                        }`}
                      >
                        {st.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Au andika jina la stendi nyingine..."
                    value={customStandName}
                    onChange={(e) => setCustomStandName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-[#161622] border border-neutral-200 dark:border-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* 2. Uelekeo (Destination Hub) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-indigo-600" />
                    <span>🎯 Ninaelekea (Destination)</span>
                  </label>

                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-300/60 dark:border-indigo-800/60 flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-800 dark:text-indigo-300">
                      {customDestName.trim() || selectedDestination.name}
                    </span>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase">Uelekeo</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {POPULAR_DESTINATIONS.slice(0, 8).map((dst) => (
                      <button
                        key={dst.name}
                        type="button"
                        onClick={() => {
                          setSelectedDestination(dst);
                          setCustomDestName('');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          selectedDestination.name === dst.name && !customDestName
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                        }`}
                      >
                        {dst.name}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Au andika eneo unaloelekea..."
                    value={customDestName}
                    onChange={(e) => setCustomDestName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-[#161622] border border-neutral-200 dark:border-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 3. Aina ya Chombo na Idadi ya Viti */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      Aina ya Chombo
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setChosenVehicleType('bajaj');
                          setTotalSeats(3);
                        }}
                        className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                          chosenVehicleType === 'bajaj'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        🚕 Bajaji
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChosenVehicleType('mini');
                          setTotalSeats(4);
                        }}
                        className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                          chosenVehicleType === 'mini'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        🚗 Mini
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      💺 Viti Vilivyopo
                    </label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTotalSeats(num)}
                          className={`flex-1 py-2 rounded-xl border text-center font-black text-xs transition-all ${
                            totalSeats === num
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. PRICING OPTIONS (OPTION A vs OPTION B) */}
                <div className="space-y-2 pt-1 border-t border-neutral-200 dark:border-neutral-800">
                  <label className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    Mipangilio ya Bei (Pricing Options)
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* OPTION A: Bei Yangu */}
                    <div
                      onClick={() => setPricingModel('custom_fixed')}
                      className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                        pricingModel === 'custom_fixed'
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-600 ring-1 ring-emerald-600'
                          : 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                          🔘 Option A: Weka Bei Yangu
                        </span>
                        {pricingModel === 'custom_fixed' && (
                          <div className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2">
                        Weka kiasi halisi unachotaka kwa kila kiti kuelekea huko.
                      </p>

                      {pricingModel === 'custom_fixed' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 bg-white dark:bg-[#111118] px-2.5 py-1.5 rounded-xl border border-emerald-400">
                            <span className="text-xs font-bold text-neutral-500">TZS</span>
                            <input
                              type="number"
                              step="500"
                              min="500"
                              max="50000"
                              value={fixedFare}
                              onChange={(e) => setFixedFare(Number(e.target.value))}
                              className="w-full text-xs font-black bg-transparent focus:outline-hidden"
                            />
                            <span className="text-[10px] text-neutral-400 shrink-0">/ kiti</span>
                          </div>
                          <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                            💰 TZS {fixedFare.toLocaleString()} / kiti
                          </p>
                        </div>
                      )}
                    </div>

                    {/* OPTION B: Bei ya Mfumo */}
                    <div
                      onClick={() => setPricingModel('system_km')}
                      className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                        pricingModel === 'system_km'
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-600 ring-1 ring-indigo-600'
                          : 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-indigo-800 dark:text-indigo-300">
                          🔘 Option B: Bei ya Mfumo
                        </span>
                        {pricingModel === 'system_km' && (
                          <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2">
                        Mfumo ukokotoe nauli kulingana na umbali wa KM za kila abiria kiotomatiki.
                      </p>
                      <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">
                        📏 Nauli ya kilometa ya PapoShare
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePublishRoute}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Inatangaza...' : '🟢 TANGAZA PAPOSHARE STENDI'}</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
