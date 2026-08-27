import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, MapPin, Navigation, Car, Bike, Sparkles, 
  Share2, QrCode, Phone, User, DollarSign, CheckCircle2, 
  ArrowRight, X, Clock, Compass, ShieldCheck, ChevronRight,
  TrendingUp, Download, Copy, AlertCircle, RefreshCw
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { playArrivalChime } from '../../utils/driverVoiceAlerts';

interface StreetHailModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverUser: any;
  driverProfile: any;
  driverLocation: [number, number] | null;
  onRideStarted?: (rideId: string) => void;
}

const POPULAR_DESTINATIONS = [
  { name: 'Kariakoo Market', address: 'Kariakoo, Dar es Salaam', lat: -6.8222, lng: 39.2748, icon: '🛍️' },
  { name: 'Posta Mpya / Kivukoni', address: 'Posta Mpya, Dar es Salaam', lat: -6.8162, lng: 39.2894, icon: '🏢' },
  { name: 'Mlimani City / Mwenge', address: 'Mlimani City Mall, Sam Nujoma Rd', lat: -6.7725, lng: 39.2222, icon: '🎓' },
  { name: 'Masaki / Slipway', address: 'Slipway, Masaki, Dar es Salaam', lat: -6.7461, lng: 39.2758, icon: '🌴' },
  { name: 'Ubungo Simu 2000', address: 'Ubungo, Morogoro Rd, Dar es Salaam', lat: -6.7865, lng: 39.2132, icon: '🚌' },
  { name: 'Kigamboni Ferry', address: 'Ferry Terminal, Kigamboni', lat: -6.8260, lng: 39.3005, icon: '🏖️' },
  { name: 'Sinza Mori', address: 'Sinza Mori, Shekilango Rd', lat: -6.7801, lng: 39.2312, icon: '🌴' },
  { name: 'JNIA Airport Terminal 3', address: 'Julius Nyerere Int Airport, Nyerere Rd', lat: -6.8781, lng: 39.2026, icon: '✈️' },
  { name: 'Morocco Square', address: 'Morocco Square, Ali Hassan Mwinyi Rd', lat: -6.7818, lng: 39.2624, icon: '🏬' },
  { name: 'Muhimbili Hospital', address: 'Muhimbili National Hospital, Upanga', lat: -6.8080, lng: 39.2740, icon: '🏥' },
];

export default function StreetHailModal({
  isOpen,
  onClose,
  driverUser,
  driverProfile,
  driverLocation,
  onRideStarted
}: StreetHailModalProps) {
  const [activeTab, setActiveTab] = useState<'direct' | 'qr' | 'history'>('direct');
  
  // Direct trip form state
  const [passengerName, setPassengerName] = useState('Mteja wa Barabarani');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('Mahali Ulipo (GPS)');
  const [pickupCoords, setPickupCoords] = useState<[number, number]>(driverLocation || [-6.7924, 39.2083]);
  
  const [destSearch, setDestSearch] = useState('');
  const [selectedDest, setSelectedDest] = useState<{ name: string; address: string; lat: number; lng: number } | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  
  // Vehicle & pricing
  const defaultVehicleType = driverProfile?.vehicleType?.toLowerCase() || 'boda';
  const [vehicleType, setVehicleType] = useState<string>(
    defaultVehicleType.includes('bajaj') ? 'bajaj' : (defaultVehicleType.includes('car') || defaultVehicleType.includes('taxi') ? 'taxi' : 'boda')
  );
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'ussd' | 'wallet'>('cash');
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [welcomeDiscountApplied, setWelcomeDiscountApplied] = useState(true);
  
  // History state
  const [streetHailHistory, setStreetHailHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Update pickup coordinates when driverLocation updates
  useEffect(() => {
    if (driverLocation) {
      setPickupCoords(driverLocation);
      // Reverse geocode driver position
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${driverLocation[0]}&lon=${driverLocation[1]}&zoom=18&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            const shortName = (parts.slice(0, 2).join(',') || 'Mahali Ulipo (GPS)').trim();
            setPickupAddress(shortName);
          }
        })
        .catch(() => {
          setPickupAddress('Mahali Ulipo (GPS)');
        });
    }
  }, [driverLocation]);

  // Destination autocomplete search
  useEffect(() => {
    if (!destSearch.trim() || destSearch.length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingDest(true);
      try {
        const query = `${destSearch.trim()}, Tanzania`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=tz`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setDestSuggestions(data);
        }
      } catch (e) {
        console.warn("Geocoding failed:", e);
      } finally {
        setIsSearchingDest(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [destSearch]);

  // Calculate distance in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const tripDistanceKm = selectedDest 
    ? Math.max(1.2, Number(calculateDistance(pickupCoords[0], pickupCoords[1], selectedDest.lat, selectedDest.lng).toFixed(1)))
    : 3.5;

  const tripDurationMinutes = Math.max(5, Math.round(tripDistanceKm * 2.8));

  // Compute live fare based on vehicle and distance
  const getFareBreakdown = () => {
    let base = 500;
    let ratePerKm = 700;
    let minFare = 1500;

    if (vehicleType === 'boda') {
      base = 400;
      ratePerKm = 550;
      minFare = 1500;
    } else if (vehicleType === 'bajaj') {
      base = 700;
      ratePerKm = 800;
      minFare = 2500;
    } else if (vehicleType === 'taxi') {
      base = 1500;
      ratePerKm = 1400;
      minFare = 5000;
    }

    const calculatedRaw = Math.max(minFare, Math.round(base + (tripDistanceKm * ratePerKm)));
    // Round to nearest 500 TZS
    const roundedNormalFare = Math.ceil(calculatedRaw / 500) * 500;
    
    // Welcome discount for new passenger onboarding
    const discountAmount = welcomeDiscountApplied ? Math.min(1000, roundedNormalFare - minFare) : 0;
    const finalPayableFare = Math.max(minFare, roundedNormalFare - discountAmount);

    return {
      normalFare: roundedNormalFare,
      discount: discountAmount,
      finalFare: finalPayableFare
    };
  };

  const fareInfo = getFareBreakdown();

  // Load history when tab is opened
  useEffect(() => {
    if (activeTab === 'history' && driverUser?.uid) {
      setIsLoadingHistory(true);
      const q = query(
        collection(db, 'rides'),
        where('driverId', '==', driverUser.uid),
        where('isStreetHail', '==', true),
        limit(20)
      );

      getDocs(q).then((snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStreetHailHistory(list);
      }).catch((e) => {
        console.warn("Failed to load street hail history:", e);
      }).finally(() => {
        setIsLoadingHistory(false);
      });
    }
  }, [activeTab, driverUser?.uid]);

  // Handle direct street ride launch
  const handleStartDirectTrip = async () => {
    if (!selectedDest) {
      toast.error("Tafadhali chagua au andika eneo la hatima (Destination)!");
      return;
    }

    if (!driverUser?.uid) {
      toast.error("Hujatambuliwa kama dereva! Tafadhali ingia upya.");
      return;
    }

    setIsStartingTrip(true);
    try {
      const cleanPassengerName = passengerName.trim() || 'Mteja wa Barabarani';
      const cleanPhone = passengerPhone.trim() || '07XXXXXXXX';

      const ridePayload = {
        userId: `street_guest_${Date.now()}`,
        driverId: driverUser.uid,
        passengerName: cleanPassengerName,
        passengerPhone: cleanPhone,
        pickup: {
          address: pickupAddress || 'Mahali Ulipo (GPS)',
          name: pickupAddress?.split(',')[0] || 'Pickup',
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
        fare: fareInfo.finalFare,
        originalFare: fareInfo.normalFare,
        discount: fareInfo.discount,
        distance: tripDistanceKm,
        duration: tripDurationMinutes,
        paymentMethod: paymentMethod,
        paymentStatus: 'pending',
        status: 'on_trip', // Direct active trip!
        isStreetHail: true,
        isDirectOnboard: true,
        welcomeBonusGiven: true,
        driverInfo: {
          id: driverUser.uid,
          name: driverProfile?.name || 'Dereva Mzoefu',
          phone: driverProfile?.phone || driverUser.phoneNumber || '',
          vehiclePlate: driverProfile?.vehiclePlate || 'T 123 ABC',
          vehicleModel: driverProfile?.vehicleModel || (vehicleType === 'boda' ? 'Boxer 150' : vehicleType === 'bajaj' ? 'TVS King' : 'Toyota IST'),
          rating: driverProfile?.rating || 5.0
        },
        createdAt: serverTimestamp(),
        startedAt: serverTimestamp(),
        acceptedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'rides'), ridePayload);
      
      // Store local storage for persistence
      localStorage.setItem('active_driver_ride_id', docRef.id);
      localStorage.setItem('active_ride_id', docRef.id);

      // Play audio chime
      playArrivalChime();

      toast.success(`🎉 Safari ya ${cleanPassengerName} Imeanza Hapo Hapo!`, {
        description: `Nauli: TZS ${fareInfo.finalFare.toLocaleString()} | Eneo: ${selectedDest.name}`,
        duration: 4000
      });

      if (onRideStarted) {
        onRideStarted(docRef.id);
      }

      onClose();
    } catch (e: any) {
      console.error("Failed to start direct street trip:", e);
      toast.error("Hitilafu wakati wa kuanzisha safari: " + (e?.message || "Jaribu tena"));
    } finally {
      setIsStartingTrip(false);
    }
  };

  const referralUrl = `${window.location.origin}/?ref=${driverUser?.uid || 'papo'}&promo=KARIBU1000`;

  const handleShareWhatsApp = () => {
    const driverName = driverProfile?.name || 'Dereva';
    const message = `Habari! Panda nami leo (${driverName}) kwa safari salama na ya bei nafuu kupitia Pata! Pata punguzo la TZS 1,000 la safari yako ya kwanza kwa kubofya kiunganishi hiki:\n${referralUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success("Kiunganishi cha mualiko kimenakiliwa! Shiriki na wateja wako.");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#12121c] border border-neutral-200/80 dark:border-neutral-800 rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 z-10"
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <UserPlus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5 leading-tight">
                  Pakia & Alika Mteja
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Hapo Hapo
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Pakia abiria wa mtaani moja kwa moja na anza safari
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-5 pt-3 pb-1 flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'direct'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Pakia Moja kwa Moja</span>
            </button>

            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'qr'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR & Link ya Mualiko</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60'
              }`}
              title="Historia ya Wateja wa Barabarani"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === 'direct' && (
              <div className="space-y-4">
                {/* Promo Incentive Ribbon */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                      🎁
                    </span>
                    <div>
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 leading-tight">
                        Punguzo la Ukaribisho TZS 1,000
                      </p>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-medium">
                        Mteja anapata punguzo, wewe unapata pointi na safari ya papo hapo!
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={welcomeDiscountApplied}
                      onChange={(e) => setWelcomeDiscountApplied(e.target.checked)}
                      className="accent-emerald-600 w-4 h-4 rounded"
                    />
                    <span className="text-[10px] font-bold text-neutral-500">Tumia</span>
                  </label>
                </div>

                {/* Pickup Location Info */}
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Eneo la Kupandia (Mahali Ulipo Sasa)
                    </span>
                    <span className="text-neutral-400">GPS Live</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold border-none outline-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
                      placeholder="Mahali ulipo..."
                    />
                  </div>
                </div>

                {/* Passenger Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                      <User className="w-3 h-3 text-neutral-400" /> Jina la Mteja
                    </label>
                    <input
                      type="text"
                      value={passengerName}
                      onChange={(e) => setPassengerName(e.target.value)}
                      placeholder="e.g. Mteja wa Barabarani / Juma"
                      className="w-full h-11 px-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-xs font-bold outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-neutral-400" /> Namba ya Simu (Hiari)
                    </label>
                    <input
                      type="tel"
                      value={passengerPhone}
                      onChange={(e) => setPassengerPhone(e.target.value)}
                      placeholder="07XX XXX XXX (kwa risiti & SMS)"
                      className="w-full h-11 px-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-xs font-bold outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Destination Search */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Navigation className="w-3 h-3 text-emerald-500" /> Eneo la Hatima (Destination)
                    </span>
                    {selectedDest && (
                      <span className="text-[9px] font-extrabold text-emerald-500">
                        {tripDistanceKm} KM (~{tripDurationMinutes} dk)
                      </span>
                    )}
                  </label>

                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={selectedDest ? selectedDest.name : destSearch}
                      onChange={(e) => {
                        setSelectedDest(null);
                        setDestSearch(e.target.value);
                      }}
                      placeholder="Tafuta eneo anapokwenda mteja (e.g. Kariakoo, Posta)..."
                      className="w-full h-12 pl-10 pr-10 rounded-2xl bg-neutral-100/90 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-xs font-bold outline-none focus:border-emerald-500 transition-all shadow-inner"
                    />
                    <MapPin className="w-4 h-4 text-emerald-500 absolute left-3.5 pointer-events-none" />
                    
                    {isSearchingDest ? (
                      <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin absolute right-3.5" />
                    ) : (selectedDest || destSearch) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDest(null);
                          setDestSearch('');
                          setDestSuggestions([]);
                        }}
                        className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 absolute right-3"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Suggestions list */}
                  {destSuggestions.length > 0 && !selectedDest && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-48 overflow-y-auto">
                      {destSuggestions.map((item, idx) => {
                        const parts = (item.display_name || '').split(',');
                        const mainName = parts[0] || 'Eneo';
                        const subName = parts.slice(1, 3).join(', ').trim();
                        return (
                          <button
                            key={`suggest-${idx}`}
                            type="button"
                            onClick={() => {
                              setSelectedDest({
                                name: mainName,
                                address: item.display_name,
                                lat: parseFloat(item.lat),
                                lng: parseFloat(item.lon)
                              });
                              setDestSuggestions([]);
                            }}
                            className="w-full text-left p-3 hover:bg-emerald-50/70 dark:hover:bg-neutral-800/80 flex items-center gap-3 border-b last:border-none border-neutral-100 dark:border-neutral-800/60 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black truncate">{mainName}</p>
                              <p className="text-[10px] text-neutral-500 truncate">{subName}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 1-Click Popular Destination Chips */}
                  <div className="pt-1">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Maeneo Maarufu ya Haraka:
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
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-all border ${
                            selectedDest?.name === dest.name
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200/80 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/50 dark:border-neutral-750'
                          }`}
                        >
                          <span>{dest.icon}</span>
                          <span>{dest.name.split('/')[0].trim()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vehicle Selection & Live Fare Preview */}
                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    Aina ya Chombo cha Safari
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setVehicleType('boda')}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                        vehicleType === 'boda'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-sm ring-1 ring-emerald-500'
                          : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <span className="text-xl">🏍️</span>
                      <span className="text-xs font-black">BODA</span>
                      <span className="text-[9px] text-neutral-500 font-bold">Nafuu & Haraka</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVehicleType('bajaj')}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                        vehicleType === 'bajaj'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-sm ring-1 ring-emerald-500'
                          : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <span className="text-xl">🛺</span>
                      <span className="text-xs font-black">BAJAJI</span>
                      <span className="text-[9px] text-neutral-500 font-bold">Watu 3</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVehicleType('taxi')}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                        vehicleType === 'taxi'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-sm ring-1 ring-emerald-500'
                          : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <span className="text-xl">🚗</span>
                      <span className="text-xs font-black">GARI / TAXI</span>
                      <span className="text-[9px] text-neutral-500 font-bold">AC & Faragha</span>
                    </button>
                  </div>
                </div>

                {/* Fare Summary & Payment Method */}
                <div className="p-4 rounded-3xl bg-neutral-900 dark:bg-black text-white border border-neutral-800 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-medium">Umbali & Muda Uliokadiriwa:</span>
                    <span className="font-black text-emerald-400">{tripDistanceKm} KM • ~{tripDurationMinutes} dk</span>
                  </div>

                  {welcomeDiscountApplied && (
                    <div className="flex items-center justify-between text-xs text-amber-300">
                      <span className="flex items-center gap-1">
                        <span>🎁 Punguzo la Mteja Mpya:</span>
                      </span>
                      <span className="font-bold">- TZS {fareInfo.discount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="h-[1px] bg-neutral-800" />

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-neutral-400 font-black">
                        Nauli ya Kupokea
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white tracking-tight">
                          TZS {fareInfo.finalFare.toLocaleString()}
                        </span>
                        {welcomeDiscountApplied && (
                          <span className="text-xs text-neutral-500 line-through font-bold">
                            {fareInfo.normalFare.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment Mode Selector */}
                    <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                          paymentMethod === 'cash' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Pesa Taslimu
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('ussd')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                          paymentMethod === 'ussd' ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        USSD / Simu
                      </button>
                    </div>
                  </div>
                </div>

                {/* Big Action Button */}
                <button
                  type="button"
                  onClick={handleStartDirectTrip}
                  disabled={isStartingTrip || !selectedDest}
                  className={`w-full h-14 rounded-2xl font-black italic uppercase text-xs sm:text-sm tracking-wider flex items-center justify-between px-6 shadow-xl transition-all active:scale-[0.98] relative overflow-hidden ${
                    !selectedDest
                      ? 'bg-neutral-300 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isStartingTrip ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Inaanzisha Safari...
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        Anzisha Safari Hapo Hapo
                      </>
                    )}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {activeTab === 'qr' && (
              <div className="space-y-4 text-center">
                <div className="p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex flex-col items-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-6 h-6 stroke-[2.5]" />
                  </div>

                  <div>
                    <h4 className="text-sm font-black tracking-tight">
                      Mualiko wa QR Code ya Dereva
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto mt-0.5">
                      Mteja anapochanganua (scan) QR hii kwa kamera yake, atafungua programu na kupata vocha ya <b>TZS 1,000</b> papo hapo!
                    </p>
                  </div>

                  {/* QR Code Frame */}
                  <div className="p-4 bg-white rounded-3xl shadow-xl border-4 border-emerald-500/30 flex flex-col items-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralUrl)}&color=059669`}
                      alt="Driver Referral QR Code"
                      className="w-48 h-48 rounded-xl object-contain"
                    />
                    <div className="mt-3 flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      <span>🏷️ {driverProfile?.vehiclePlate || 'T 123 ABC'}</span>
                      <span>•</span>
                      <span>{driverProfile?.name || 'Dereva'}</span>
                    </div>
                  </div>

                  {/* Share buttons */}
                  <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Nakili Link</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Safari Zilizopakiwa Moja kwa Moja
                  </h4>
                  <span className="text-[10px] font-extrabold text-emerald-600">
                    Jumla: {streetHailHistory.length}
                  </span>
                </div>

                {isLoadingHistory ? (
                  <div className="p-8 text-center text-xs text-neutral-400 font-bold flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                    Inapakia kumbukumbu...
                  </div>
                ) : streetHailHistory.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <span className="text-3xl">🚖</span>
                    <p className="text-xs font-black text-neutral-700 dark:text-neutral-300">
                      Bado hujapakia mteja wa barabarani
                    </p>
                    <p className="text-[10px] text-neutral-400 max-w-xs mx-auto">
                      Tumia kichupo cha "Pakia Moja kwa Moja" kuanzisha safari ya kwanza kwa abiria uliyekutana naye mtaani.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {streetHailHistory.map((ride, idx) => (
                      <div
                        key={ride.id || idx}
                        className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-neutral-900 dark:text-white truncate">
                              {ride.passengerName || 'Mteja wa Barabarani'}
                            </span>
                            <span className="text-[8px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">
                              Direct Hail
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                            📍 {ride.destination?.name || ride.destination?.address || 'Hatima'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="font-black text-emerald-600 dark:text-emerald-400">
                            TZS {(ride.fare || 0).toLocaleString()}
                          </span>
                          <p className="text-[9px] text-neutral-400">
                            {ride.distance ? `${ride.distance} km` : 'Imekamilika'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
