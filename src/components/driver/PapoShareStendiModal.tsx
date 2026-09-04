import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, MapPin, Navigation, Users, DollarSign, 
  CheckCircle2, AlertCircle, Phone, MessageSquare, 
  Play, Pause, Trash2, Edit3, Sparkles, ShieldCheck,
  ChevronRight, Car, Compass, ArrowRight, Check, Map as MapIcon,
  Plus, Minus, RefreshCw, Clock, Bell, Volume2, Timer
} from 'lucide-react';
import { 
  StandPoolingRoute, 
  StandLocation, 
  StandPricingModel, 
  StandDepartureEstimate,
  POPULAR_STANDS, 
  POPULAR_DESTINATIONS,
  createOrUpdateStandRoute, 
  listenDriverActiveStandRoute, 
  updateStandRouteStatus,
  calculateStandSystemKmFare,
  getDistanceKm
} from '../../services/standPoolingService';
import LocationPicker from '../LocationPicker';
import { playSyntheticImportant } from '../../utils/soundAlert';
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

  // 1. AUTO-DETECT VEHICLE TYPE
  const detectedVehicleType = useMemo<'boda' | 'bajaj' | 'mini'>(() => {
    const raw = (
      driverProfile?.vehicleType || 
      driverProfile?.category || 
      driverProfile?.serviceType ||
      driverUser?.vehicleType || 
      ''
    ).toLowerCase();

    if (raw.includes('boda') || raw.includes('piki') || raw.includes('motorcycle') || raw.includes('bike')) {
      return 'boda';
    }
    if (raw.includes('bajaj') || raw.includes('rickshaw') || raw.includes('tuktuk')) {
      return 'bajaj';
    }
    return 'mini'; // default to mini / car
  }, [driverProfile, driverUser]);

  const [activeRoute, setActiveRoute] = useState<StandPoolingRoute | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedStand, setSelectedStand] = useState<StandLocation>(POPULAR_STANDS[0]);
  const [standSearchInput, setStandSearchInput] = useState(POPULAR_STANDS[0].name);

  const [selectedDestination, setSelectedDestination] = useState<StandLocation>(POPULAR_DESTINATIONS[0]);
  const [destSearchInput, setDestSearchInput] = useState(POPULAR_DESTINATIONS[0].name);

  const [chosenVehicleType, setChosenVehicleType] = useState<'boda' | 'bajaj' | 'mini'>(detectedVehicleType);
  const [totalSeats, setTotalSeats] = useState<number>(
    detectedVehicleType === 'boda' ? 1 : detectedVehicleType === 'mini' ? 4 : 3
  );
  const [pricingModel, setPricingModel] = useState<StandPricingModel>('custom_fixed');
  const [fixedFare, setFixedFare] = useState<number>(2500);
  const [departureEstimate, setDepartureEstimate] = useState<StandDepartureEstimate>('when_full');

  // Track passenger count for sound & haptic alert when rider books
  const prevPassengerCountRef = useRef<number | null>(null);

  // Map Picker State
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState<'stand' | 'destination'>('stand');

  // Keep chosenVehicleType in sync if profile updates and no active custom selection
  useEffect(() => {
    if (!activeRoute) {
      setChosenVehicleType(detectedVehicleType);
      if (detectedVehicleType === 'boda') {
        setTotalSeats(1);
      } else if (detectedVehicleType === 'bajaj') {
        setTotalSeats(3);
      } else {
        setTotalSeats(4);
      }
    }
  }, [detectedVehicleType, activeRoute]);

  // When vehicle type changes, enforce rules: Pikipiki = max 1 seat
  const handleVehicleTypeChange = (type: 'boda' | 'bajaj' | 'mini') => {
    setChosenVehicleType(type);
    if (type === 'boda') {
      setTotalSeats(1);
    } else if (type === 'bajaj') {
      setTotalSeats(Math.min(4, Math.max(1, totalSeats || 3)));
    } else {
      setTotalSeats(Math.min(7, Math.max(1, totalSeats || 4)));
    }
  };

  // Adjust seats with stepper (+/-)
  const handleStepperSeats = (delta: number) => {
    if (chosenVehicleType === 'boda') return; // Pikipiki is strictly 1 seat
    const maxAllowed = chosenVehicleType === 'mini' ? 7 : 4;
    setTotalSeats((prev) => Math.max(1, Math.min(maxAllowed, prev + delta)));
  };

  // Listen to driver's active route in real-time
  useEffect(() => {
    if (!driverId) return;
    const unsubscribe = listenDriverActiveStandRoute(driverId, (route) => {
      setActiveRoute(route);
      if (route) {
        setChosenVehicleType(route.vehicleType || detectedVehicleType);
        setTotalSeats(route.totalSeats);
        setPricingModel(route.pricingModel);
        setFixedFare(route.fixedPricePerSeat || 2500);
        setSelectedStand(route.standLocation);
        setStandSearchInput(route.standLocation?.name || '');
        setSelectedDestination(route.destination);
        setDestSearchInput(route.destination?.name || '');
        if (route.departureEstimate) {
          setDepartureEstimate(route.departureEstimate);
        }

        // Check if a new passenger booked a seat -> trigger audio chime + vibration
        const bookedPassengers = (route.passengers || []).filter(p => p.status === 'booked');
        const currentCount = bookedPassengers.length;
        if (prevPassengerCountRef.current !== null && currentCount > prevPassengerCountRef.current) {
          playSyntheticImportant();
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([250, 100, 250]);
            } catch (e) {}
          }
          const latest = bookedPassengers[bookedPassengers.length - 1];
          toast.success(
            `🔔 ABIRIA MPYA KIJIWENI! ${latest?.passengerName || 'Abiria'} amehifadhi siti ${latest?.seats || 1} kuelekea ${latest?.dropoffName}!`,
            { duration: 6000 }
          );
        }
        prevPassengerCountRef.current = currentCount;
      } else {
        prevPassengerCountRef.current = null;
      }
    });
    return () => unsubscribe();
  }, [driverId, detectedVehicleType]);

  // Use current GPS if available
  const handleUseCurrentLocation = () => {
    if (currentGpsPosition && currentGpsPosition[0] && currentGpsPosition[1]) {
      const gpsLocation: StandLocation = {
        name: 'Eneo Langu la Sasa (GPS)',
        lat: currentGpsPosition[0],
        lng: currentGpsPosition[1],
        address: 'GPS Stand Location'
      };
      setSelectedStand(gpsLocation);
      setStandSearchInput(gpsLocation.name);
      toast.success("Eneo lako la GPS limewekwa kama stendi/kijiwe!");
    } else {
      toast.info("GPS haipatikani kwa sasa. Unaweza kuchagua kwenye Ramani.");
    }
  };

  // Open Map Picker
  const handleOpenMapPicker = (target: 'stand' | 'destination') => {
    setMapPickerTarget(target);
    setIsMapPickerOpen(true);
  };

  // Distance and calculated system fare preview
  const estimatedDistanceKm = useMemo(() => {
    return getDistanceKm(selectedStand.lat, selectedStand.lng, selectedDestination.lat, selectedDestination.lng);
  }, [selectedStand, selectedDestination]);

  const estimatedSystemFare = useMemo(() => {
    return calculateStandSystemKmFare(estimatedDistanceKm, chosenVehicleType);
  }, [estimatedDistanceKm, chosenVehicleType]);

  // Handle Publishing Route
  const handlePublishRoute = async () => {
    setLoading(true);
    try {
      const standToUse: StandLocation = {
        name: standSearchInput.trim() || selectedStand.name,
        lat: selectedStand.lat,
        lng: selectedStand.lng,
        address: selectedStand.address || standSearchInput.trim()
      };

      const destToUse: StandLocation = {
        name: destSearchInput.trim() || selectedDestination.name,
        lat: selectedDestination.lat,
        lng: selectedDestination.lng,
        address: selectedDestination.address || destSearchInput.trim()
      };

      const dist = getDistanceKm(standToUse.lat, standToUse.lng, destToUse.lat, destToUse.lng);
      const systemFare = calculateStandSystemKmFare(dist, chosenVehicleType);

      // Pikipiki strictly 1 seat
      const finalSeats = chosenVehicleType === 'boda' ? 1 : totalSeats;

      const vehicleDefaultModel = 
        chosenVehicleType === 'boda' ? 'Pikipiki Boxer / TVS' :
        chosenVehicleType === 'bajaj' ? 'Bajaji TVS King' : 'Toyota Passo';

      // Departure calculation
      let departureTimeText = '⚡ Huondoka likijaa tu';
      let departureTargetTimestamp: number | undefined = undefined;

      if (departureEstimate === 'in_5_min') {
        departureTimeText = '⏱️ Ondoka dk 5';
        departureTargetTimestamp = Date.now() + 5 * 60 * 1000;
      } else if (departureEstimate === 'in_10_min') {
        departureTimeText = '⏱️ Ondoka dk 10';
        departureTargetTimestamp = Date.now() + 10 * 60 * 1000;
      } else if (departureEstimate === 'in_15_min') {
        departureTimeText = '⏱️ Ondoka dk 15';
        departureTargetTimestamp = Date.now() + 15 * 60 * 1000;
      }

      await createOrUpdateStandRoute(driverId, {
        driverName,
        driverPhone,
        driverPhoto: driverProfile?.photoURL || '',
        driverRating: driverProfile?.rating || 4.9,
        isVerifiedDriver: true,
        vehicleType: chosenVehicleType,
        vehiclePlate: driverProfile?.licensePlate || driverProfile?.vehiclePlate || 'T 240 ABC',
        vehicleModel: driverProfile?.vehicleModel || vehicleDefaultModel,
        isActive: true,
        standLocation: standToUse,
        destination: destToUse,
        pricingModel,
        fixedPricePerSeat: Number(fixedFare) || 2500,
        systemFarePerSeat: systemFare,
        totalSeats: finalSeats,
        availableSeats: finalSeats,
        occupiedSeats: 0,
        passengers: [],
        status: 'boarding',
        departureEstimate,
        departureTimeText,
        departureTargetTimestamp: departureTargetTimestamp || null as any,
        notes: 'Safari ya PapoShare kuanzia stendi/kijiweni'
      });

      toast.success("🎉 Safari ya PapoShare Stendi imetangazwa hewani!");
    } catch (err: any) {
      toast.error(err?.message || "Imeshindikana kutangaza safari. Tafadhali jaribu tena.");
    } finally {
      setLoading(false);
    }
  };

  // Live timer tick for departure countdown
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingCountdownText = useMemo(() => {
    if (!activeRoute?.departureTargetTimestamp) return null;
    const diff = activeRoute.departureTargetTimestamp - nowMs;
    if (diff <= 0) return '⏳ Muda umefika wa kuondoka!';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `⏳ Ondoka baada ya: ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }, [activeRoute?.departureTargetTimestamp, nowMs]);

  // Driver updates departure time while route is active
  const handleUpdateDepartureLive = async (newEstimate: StandDepartureEstimate) => {
    if (!activeRoute) return;
    try {
      let departureTimeText = '⚡ Huondoka likijaa tu';
      let departureTargetTimestamp: number | undefined = undefined;

      if (newEstimate === 'in_5_min') {
        departureTimeText = '⏱️ Ondoka dk 5';
        departureTargetTimestamp = Date.now() + 5 * 60 * 1000;
      } else if (newEstimate === 'in_10_min') {
        departureTimeText = '⏱️ Ondoka dk 10';
        departureTargetTimestamp = Date.now() + 10 * 60 * 1000;
      } else if (newEstimate === 'in_15_min') {
        departureTimeText = '⏱️ Ondoka dk 15';
        departureTargetTimestamp = Date.now() + 15 * 60 * 1000;
      }

      await createOrUpdateStandRoute(driverId, {
        departureEstimate: newEstimate,
        departureTimeText,
        departureTargetTimestamp: departureTargetTimestamp || null as any,
      });
      setDepartureEstimate(newEstimate);
      toast.success(`Muda wa kuondoka umesasishwa: ${departureTimeText}`);
    } catch (e) {
      toast.error("Imeshindikana kusasisha muda wa kuondoka.");
    }
  };

  const handleStartTrip = async () => {
    if (!activeRoute) return;
    try {
      const startLoc = currentGpsPosition
        ? { lat: currentGpsPosition[0], lng: currentGpsPosition[1] }
        : { lat: activeRoute.standLocation.lat, lng: activeRoute.standLocation.lng };
      await updateStandRouteStatus(driverId, 'started', {
        driverLocation: { ...startLoc, heading: 0 }
      });
      toast.success("🚀 Safari imeanza! Abiria wote wamearifiwa.");
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

  const handleAdjustSeatsLive = async (delta: number) => {
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
    <>
      <AnimatePresence>
        {/* z-[100000] ensures complete isolation and prevents any app bars or widgets from bleeding through */}
        <div 
          id="papo-share-stendi-modal-overlay"
          className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            id="papo-share-stendi-modal-card"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="w-full max-w-lg bg-white dark:bg-[#12121c] rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-[#222235] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Elegant Header */}
            <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">
                  {chosenVehicleType === 'boda' ? '🏍️' : chosenVehicleType === 'bajaj' ? '🛺' : '🚗'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                      PAPOSHARE STENDI
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-neutral-950 tracking-wider shadow-xs">
                      Kijiweni
                    </span>
                  </div>
                  <p className="text-[11px] text-white/90 font-medium">
                    Tangaza viti stendi • Chagua bei yako au ya mfumo
                  </p>
                </div>
              </div>
              <button
                id="close-papo-share-stendi-modal"
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors text-white"
                title="Funga"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
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

                      <button
                        onClick={handleTogglePause}
                        className="px-2.5 py-1 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1 hover:bg-neutral-300 transition-colors"
                      >
                        {activeRoute.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{activeRoute.isActive ? 'Pumzika' : 'Washa'}</span>
                      </button>
                    </div>

                    {/* Route details */}
                    <div className="bg-white dark:bg-[#181826] p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                          {activeRoute.standLocation?.name || 'Stendi'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                        <Compass className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                          {activeRoute.destination?.name || 'Uelekeo'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800/80 text-[11px]">
                        <span className="font-semibold text-neutral-500">
                          Chombo: <span className="text-neutral-800 dark:text-neutral-200 font-bold uppercase">
                            {activeRoute.vehicleType === 'boda' ? '🏍️ Boda' : activeRoute.vehicleType === 'bajaj' ? '🛺 Bajaji' : '🚗 Mini'}
                          </span>
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
                    <div className="flex items-center justify-between bg-white dark:bg-[#181826] p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Hali ya Viti</p>
                        <p className="text-sm font-black text-neutral-900 dark:text-white">
                          {activeRoute.occupiedSeats} zimejaa / {activeRoute.totalSeats} jumla
                        </p>
                        <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          Viti {activeRoute.availableSeats} vimebaki
                        </p>
                      </div>

                      {/* Stepper for live available seats */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdjustSeatsLive(-1)}
                          disabled={activeRoute.availableSeats <= 0}
                          className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-black text-sm flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-black text-base w-6 text-center">
                          {activeRoute.availableSeats}
                        </span>
                        <button
                          onClick={() => handleAdjustSeatsLive(1)}
                          disabled={activeRoute.availableSeats + activeRoute.occupiedSeats >= activeRoute.totalSeats}
                          className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-black text-sm flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Departure Countdown & Quick Schedule Adjustment */}
                    <div className="bg-white dark:bg-[#181826] p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                            Ratiba ya Kuondoka
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          {remainingCountdownText || activeRoute.departureTimeText || '⚡ Huondoka likijaa tu'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {[
                          { id: 'when_full', label: '⚡ Nikijaza' },
                          { id: 'in_5_min', label: '⏱️ Dk 5' },
                          { id: 'in_10_min', label: '⏱️ Dk 10' },
                          { id: 'in_15_min', label: '⏱️ Dk 15' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleUpdateDepartureLive(item.id as StandDepartureEstimate)}
                            className={`py-1.5 px-1 rounded-lg text-[9.5px] font-black transition-all border text-center ${
                              (activeRoute.departureEstimate || 'when_full') === item.id
                                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                                : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700/60 hover:bg-neutral-100'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Booked Passengers Section */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      Abiria Waliohifadhi Viti ({activeRoute.passengers?.filter(p => p.status === 'booked').length || 0})
                    </h3>

                    {(!activeRoute.passengers || activeRoute.passengers.filter(p => p.status === 'booked').length === 0) ? (
                      <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center">
                        <Users className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700 mb-1" />
                        <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                          Bado hakuna abiria aliyehifadhi kiti
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          Safari yako inaonekana live kwa abiria waliopo karibu nawe kuelekea {activeRoute.destination?.name}.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeRoute.passengers
                          .filter(p => p.status === 'booked')
                          .map((p, idx) => (
                            <div
                              key={p.passengerId || idx}
                              className="p-3 rounded-xl bg-neutral-50 dark:bg-[#181826] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2"
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

                              {p.passengerPhone && (
                                <a
                                  href={`tel:${p.passengerPhone}`}
                                  className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 hover:bg-emerald-500 transition-colors"
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

                  {/* Primary Actions */}
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
                /* SLEEK, UNCLUTTERED SETUP FORM */
                <div className="space-y-4">
                  {/* UNIFIED ROUTE CARD (Origin + Destination with Map Select) */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-[#181826] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
                    
                    {/* 1. Kituo / Stendi Ulipo */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/30"></span>
                          <span>Stendi / Kijiwe Ulipo (Kuanzia)</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Eneo Langu (GPS)</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Weka jina la stendi ulipo..."
                            value={standSearchInput}
                            onChange={(e) => setStandSearchInput(e.target.value)}
                            className="w-full text-xs font-semibold py-2.5 pl-3 pr-8 rounded-xl bg-white dark:bg-[#11111a] border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                          {standSearchInput && (
                            <button
                              type="button"
                              onClick={() => setStandSearchInput('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Dedicated Map Selection Button */}
                        <button
                          id="btn-select-stand-map"
                          type="button"
                          onClick={() => handleOpenMapPicker('stand')}
                          className="px-3 py-2.5 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
                          title="Chagua kwenye ramani"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          <span>Ramani</span>
                        </button>
                      </div>
                    </div>

                    {/* Divider with Direction Arrow */}
                    <div className="relative flex items-center justify-center my-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-dashed border-neutral-300 dark:border-neutral-700"></div>
                      </div>
                      <span className="relative px-2 bg-neutral-50 dark:bg-[#181826] text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-emerald-500" />
                        <span>Kuelekea</span>
                      </span>
                    </div>

                    {/* 2. Uelekeo (Destination) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block ring-2 ring-indigo-500/30"></span>
                        <span>Uelekeo / Mwisho wa Safari</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Weka eneo unaloelekea..."
                            value={destSearchInput}
                            onChange={(e) => setDestSearchInput(e.target.value)}
                            className="w-full text-xs font-semibold py-2.5 pl-3 pr-8 rounded-xl bg-white dark:bg-[#11111a] border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                          {destSearchInput && (
                            <button
                              type="button"
                              onClick={() => setDestSearchInput('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Dedicated Map Selection Button */}
                        <button
                          id="btn-select-dest-map"
                          type="button"
                          onClick={() => handleOpenMapPicker('destination')}
                          className="px-3 py-2.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600/20 border border-indigo-500/30 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
                          title="Chagua kwenye ramani"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          <span>Ramani</span>
                        </button>
                      </div>
                    </div>

                    {/* Compact Horizontal Quick-Pills for Transit Hubs */}
                    <div className="pt-1">
                      <p className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                        Kituo Maarufu cha Haraka:
                      </p>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {POPULAR_STANDS.slice(0, 6).map((hub) => (
                          <button
                            key={hub.name}
                            type="button"
                            onClick={() => {
                              setSelectedDestination(hub);
                              setDestSearchInput(hub.name);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-all border shrink-0 ${
                              destSearchInput.toLowerCase().includes(hub.name.split(' ')[0].toLowerCase())
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white dark:bg-[#11111a] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-indigo-400'
                            }`}
                          >
                            {hub.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. AINA YA CHOMBO (AUTO-DETECTED) NA SITI */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-[#181826] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                          Chombo na Siti
                        </label>
                        <p className="text-[10.5px] text-neutral-400">
                          Mfumo umegundua chombo chako moja kwa moja
                        </p>
                      </div>

                      {/* Auto-detected badge */}
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ✓ Imetambuliwa
                      </span>
                    </div>

                    {/* Vehicle Type Selector (Auto-detected default) */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        id="vehicle-type-boda"
                        type="button"
                        onClick={() => handleVehicleTypeChange('boda')}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          chosenVehicleType === 'boda'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                            : 'bg-white dark:bg-[#11111a] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="text-lg mb-0.5">🏍️</div>
                        <div className="text-xs font-black">Pikipiki</div>
                        <div className="text-[9px] opacity-80">Max 1 Siti</div>
                      </button>

                      <button
                        id="vehicle-type-bajaj"
                        type="button"
                        onClick={() => handleVehicleTypeChange('bajaj')}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          chosenVehicleType === 'bajaj'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                            : 'bg-white dark:bg-[#11111a] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="text-lg mb-0.5">🛺</div>
                        <div className="text-xs font-black">Bajaji</div>
                        <div className="text-[9px] opacity-80">1–4 Viti</div>
                      </button>

                      <button
                        id="vehicle-type-mini"
                        type="button"
                        onClick={() => handleVehicleTypeChange('mini')}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          chosenVehicleType === 'mini'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                            : 'bg-white dark:bg-[#11111a] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="text-lg mb-0.5">🚗</div>
                        <div className="text-xs font-black">Gari / Mini</div>
                        <div className="text-[9px] opacity-80">1–7 Viti</div>
                      </button>
                    </div>

                    {/* Interactive Seat Adjustment Stepper */}
                    <div className="bg-white dark:bg-[#11111a] p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 block">
                          💺 Idadi ya Viti vya Kupakia
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {chosenVehicleType === 'boda'
                            ? 'Pikipiki hubeba abiria 1 pekee kisheria'
                            : 'Ongeza au punguza kulingana na nafasi yako'}
                        </span>
                      </div>

                      {chosenVehicleType === 'boda' ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs border border-emerald-500/20">
                          1 Kiti
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStepperSeats(-1)}
                            disabled={totalSeats <= 1}
                            className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-black text-sm flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-black text-base w-8 text-center text-neutral-900 dark:text-white">
                            {totalSeats}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepperSeats(1)}
                            disabled={totalSeats >= (chosenVehicleType === 'mini' ? 7 : 4)}
                            className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-black text-sm flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. MIPANGILIO YA BEI (PRICING) */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-[#181826] border border-neutral-200/80 dark:border-neutral-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                        Mpangilio wa Bei kwa Kiti
                      </label>
                      <span className="text-[10px] text-neutral-400 font-bold">
                        Umbali: ~{estimatedDistanceKm} km
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Option A: Bei Yangu */}
                      <button
                        type="button"
                        onClick={() => setPricingModel('custom_fixed')}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          pricingModel === 'custom_fixed'
                            ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-white dark:bg-[#11111a] border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-neutral-900 dark:text-white">
                            Option A: Bei Yangu
                          </span>
                          {pricingModel === 'custom_fixed' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-600/20" />
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                          Weka kiasi chako cha moja kwa moja
                        </p>
                      </button>

                      {/* Option B: Bei ya Mfumo */}
                      <button
                        type="button"
                        onClick={() => setPricingModel('system_km')}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          pricingModel === 'system_km'
                            ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-white dark:bg-[#11111a] border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-neutral-900 dark:text-white">
                            Option B: Bei ya KM
                          </span>
                          {pricingModel === 'system_km' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-600/20" />
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                          Inakokotolewa kulingana na umbali
                        </p>
                      </button>
                    </div>

                    {/* Price Input or Display */}
                    {pricingModel === 'custom_fixed' ? (
                      <div className="bg-white dark:bg-[#11111a] p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase">Nauli kwa Kiti (TZS)</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm font-bold text-neutral-400">TZS</span>
                            <input
                              type="number"
                              step="500"
                              min="500"
                              value={fixedFare}
                              onChange={(e) => setFixedFare(Number(e.target.value))}
                              className="text-lg font-black text-emerald-600 dark:text-emerald-400 bg-transparent w-full focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Quick increment/decrement buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setFixedFare((prev) => Math.max(500, prev - 500))}
                            className="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold hover:bg-neutral-200"
                          >
                            -500
                          </button>
                          <button
                            type="button"
                            onClick={() => setFixedFare((prev) => prev + 500)}
                            className="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold hover:bg-neutral-200"
                          >
                            +500
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-[#11111a] p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase">Bei ya Mfumo Inayopendekezwa</span>
                          <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            TZS {estimatedSystemFare.toLocaleString()} <span className="text-xs font-normal text-neutral-400">/ kiti</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-extrabold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">
                          Formula ya PapoRide
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 5. RATIBA YA KUONDOKA STENDI (DEPARTURE SCHEDULE) */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-[#181826] border border-neutral-200/80 dark:border-neutral-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                          Muda wa Kuondoka Stendi
                        </label>
                      </div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {departureEstimate === 'when_full' ? '⚡ Nikijaza tu' : `⏱️ ${departureEstimate.replace('in_', 'Dk ').replace('_min', ' zilizobaki')}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'when_full', label: '⚡ Nikijaza Tu', desc: 'Viti vikikamilika' },
                        { id: 'in_5_min', label: '⏱️ Dakika 5', desc: 'Ondoka baada ya dk 5' },
                        { id: 'in_10_min', label: '⏱️ Dakika 10', desc: 'Ondoka baada ya dk 10' },
                        { id: 'in_15_min', label: '⏱️ Dakika 15', desc: 'Ondoka baada ya dk 15' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDepartureEstimate(item.id as StandDepartureEstimate)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            departureEstimate === item.id
                              ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                              : 'bg-white dark:bg-[#11111a] border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100'
                          }`}
                        >
                          <span className="text-xs font-black block text-neutral-900 dark:text-white">
                            {item.label}
                          </span>
                          <span className="text-[9.5px] text-neutral-400 block mt-0.5">
                            {item.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary & Publish CTA Button */}
                  <div className="pt-2">
                    <button
                      id="btn-publish-stand-trip"
                      type="button"
                      disabled={loading || !standSearchInput.trim() || !destSearchInput.trim()}
                      onClick={handlePublishRoute}
                      className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Inachapisha Safari...</span>
                        </>
                      ) : (
                        <>
                          <span>TANGAZA VITI HEWANI SASA</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-neutral-400 font-medium mt-1.5">
                      Abiria kijiweni na walio njiani wataona gari lako na kiti kitakachobaki.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* INTERACTIVE MAP PICKER MODAL (Full Leaflet Picker with z-[110000]) */}
      <LocationPicker
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        pickerType={mapPickerTarget === 'stand' ? 'pickup' : 'delivery'}
        title={
          mapPickerTarget === 'stand' 
            ? "Chagua Stendi / Kijiwe Kwenye Ramani" 
            : "Chagua Eneo la Kuelekea Kwenye Ramani"
        }
        subtitle="Gusa au buruta pini kwenye ramani kuweka eneo kamili"
        initialLocation={
          mapPickerTarget === 'stand'
            ? { lat: selectedStand.lat, lng: selectedStand.lng, address: standSearchInput }
            : { lat: selectedDestination.lat, lng: selectedDestination.lng, address: destSearchInput }
        }
        zIndex="z-[110000]"
        onSelect={(loc) => {
          if (mapPickerTarget === 'stand') {
            setSelectedStand({
              name: loc.address || 'Stendi / Kijiwe Kwenye Ramani',
              lat: loc.lat,
              lng: loc.lng,
              address: loc.address
            });
            setStandSearchInput(loc.address || 'Eneo Teule la Stendi');
          } else {
            setSelectedDestination({
              name: loc.address || 'Eneo la Kuelekea Kwenye Ramani',
              lat: loc.lat,
              lng: loc.lng,
              address: loc.address
            });
            setDestSearchInput(loc.address || 'Eneo Teule la Kuelekea');
          }
          setIsMapPickerOpen(false);
          toast.success("Eneo limewekwa kikamilifu kutoka kwenye ramani! 📍");
        }}
      />
    </>
  );
}
