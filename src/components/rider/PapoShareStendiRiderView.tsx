import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, MapPin, Compass, Star, ShieldCheck, 
  ArrowRight, AlertCircle, Clock, Check, 
  Filter, ArrowUpDown, ChevronRight, Phone, Sparkles,
  RefreshCw, CheckCircle2, X
} from 'lucide-react';
import { 
  StandPoolingRoute, 
  StandPassenger, 
  listenActiveStandRoutes, 
  matchRiderToStandRoute, 
  reserveStandSeatTransaction 
} from '../../services/standPoolingService';
import { toast } from 'sonner';

interface PapoShareStendiRiderViewProps {
  pickupLocation: { name: string; lat: number; lng: number } | null;
  destinationLocation: { name: string; lat: number; lng: number } | null;
  riderUser: any;
  riderProfile: any;
  onSelectAutomaticMatch: () => void;
  onSelectSolo: () => void;
  onTripConfirmed?: (route: StandPoolingRoute, passenger: StandPassenger) => void;
}

type SortOption = 'price_asc' | 'nearby' | 'rating' | 'seats_desc';
type FilterType = 'all' | 'custom_fixed' | 'system_km' | 'verified' | 'bajaj' | 'mini';

export default function PapoShareStendiRiderView({
  pickupLocation,
  destinationLocation,
  riderUser,
  riderProfile,
  onSelectAutomaticMatch,
  onSelectSolo,
  onTripConfirmed
}: PapoShareStendiRiderViewProps) {
  const [allRoutes, setAllRoutes] = useState<StandPoolingRoute[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting & Filters
  const [sortBy, setSortBy] = useState<SortOption>('price_asc');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Selected route for seat booking confirmation
  const [bookingRoute, setBookingRoute] = useState<StandPoolingRoute | null>(null);
  const [seatsToBook, setSeatsToBook] = useState<number>(1);
  const [isReserving, setIsReserving] = useState(false);

  // Active confirmed booking for this user if already booked
  const [myConfirmedRoute, setMyConfirmedRoute] = useState<{
    route: StandPoolingRoute;
    passenger: StandPassenger;
  } | null>(null);

  // Real-time listener for active stand routes
  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenActiveStandRoutes((routes) => {
      setAllRoutes(routes);
      setLoading(false);

      // Check if current user is already booked on any active route
      const currentUserId = riderUser?.uid || riderProfile?.id;
      if (currentUserId) {
        for (const r of routes) {
          const matchedP = r.passengers?.find(
            (p) => p.passengerId === currentUserId && p.status === 'booked'
          );
          if (matchedP && r.status !== 'completed' && r.status !== 'cancelled') {
            setMyConfirmedRoute({ route: r, passenger: matchedP });
            break;
          }
        }
      }
    });

    return () => unsubscribe();
  }, [riderUser, riderProfile]);

  // Match routes to passenger's pickup & destination
  const matchedRoutes = useMemo(() => {
    if (!pickupLocation || !destinationLocation) {
      // If pickup or destination is not yet set, return all active boarding routes
      return allRoutes.map((route) => ({
        route,
        isMatch: true,
        distanceToStandKm: 0,
        riderTripKm: 0,
        calculatedPrice: route.pricingModel === 'custom_fixed' ? route.fixedPricePerSeat : (route.systemFarePerSeat || 2500),
        matchScore: 100
      }));
    }

    const matches: Array<{
      route: StandPoolingRoute;
      isMatch: boolean;
      distanceToStandKm: number;
      riderTripKm: number;
      calculatedPrice: number;
      matchScore: number;
    }> = [];

    for (const route of allRoutes) {
      const result = matchRiderToStandRoute(
        route,
        { lat: pickupLocation.lat, lng: pickupLocation.lng },
        { lat: destinationLocation.lat, lng: destinationLocation.lng }
      );

      if (result.isMatch) {
        matches.push({
          route,
          ...result
        });
      }
    }

    return matches;
  }, [allRoutes, pickupLocation, destinationLocation]);

  // Apply Filters
  const filteredRoutes = useMemo(() => {
    return matchedRoutes.filter((item) => {
      const r = item.route;
      if (activeFilter === 'custom_fixed') return r.pricingModel === 'custom_fixed';
      if (activeFilter === 'system_km') return r.pricingModel === 'system_km';
      if (activeFilter === 'verified') return r.isVerifiedDriver;
      if (activeFilter === 'bajaj') return r.vehicleType === 'bajaj';
      if (activeFilter === 'mini') return r.vehicleType === 'mini';
      return true;
    });
  }, [matchedRoutes, activeFilter]);

  // Apply Sorting
  const sortedRoutes = useMemo(() => {
    return [...filteredRoutes].sort((a, b) => {
      if (sortBy === 'price_asc') {
        return a.calculatedPrice - b.calculatedPrice;
      }
      if (sortBy === 'nearby') {
        return a.distanceToStandKm - b.distanceToStandKm;
      }
      if (sortBy === 'rating') {
        return (b.route.driverRating || 4.5) - (a.route.driverRating || 4.5);
      }
      if (sortBy === 'seats_desc') {
        return b.route.availableSeats - a.route.availableSeats;
      }
      return 0;
    });
  }, [filteredRoutes, sortBy]);

  // Handle Confirming Seat Reservation
  const handleConfirmReservation = async () => {
    if (!bookingRoute) return;
    setIsReserving(true);

    const passengerId = riderUser?.uid || riderProfile?.id || `guest_${Date.now()}`;
    const passengerName = riderProfile?.displayName || riderUser?.displayName || 'Abiria';
    const passengerPhone = riderProfile?.phoneNumber || riderProfile?.phone || '';

    const pricePerSeat = bookingRoute.pricingModel === 'custom_fixed'
      ? bookingRoute.fixedPricePerSeat
      : (bookingRoute.systemFarePerSeat || 2500);

    const totalFare = pricePerSeat * seatsToBook;

    const passengerData: StandPassenger = {
      passengerId,
      passengerName,
      passengerPhone,
      pickupName: pickupLocation?.name || bookingRoute.standLocation.name,
      pickupLat: pickupLocation?.lat || bookingRoute.standLocation.lat,
      pickupLng: pickupLocation?.lng || bookingRoute.standLocation.lng,
      dropoffName: destinationLocation?.name || bookingRoute.destination.name,
      dropoffLat: destinationLocation?.lat || bookingRoute.destination.lat,
      dropoffLng: destinationLocation?.lng || bookingRoute.destination.lng,
      seats: seatsToBook,
      fare: totalFare,
      status: 'booked',
      bookedAt: new Date().toISOString()
    };

    const res = await reserveStandSeatTransaction(bookingRoute.id, passengerData);

    setIsReserving(false);

    if (res.success) {
      toast.success("🎉 Kiti kimethibitishwa kikamilifu! Dereva amearifiwa.");
      setMyConfirmedRoute({
        route: bookingRoute,
        passenger: passengerData
      });
      setBookingRoute(null);
      if (onTripConfirmed) {
        onTripConfirmed(bookingRoute, passengerData);
      }
    } else {
      toast.error(res.message);
    }
  };

  // IF ALREADY HAS CONFIRMED RESERVATION
  if (myConfirmedRoute) {
    const r = myConfirmedRoute.route;
    const p = myConfirmedRoute.passenger;
    return (
      <div className="p-4 rounded-3xl bg-white dark:bg-[#151520] border-2 border-emerald-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-black">
              ✓
            </span>
            <div>
              <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                Booking Yako ya Stendi Imethibitishwa
              </h4>
              <p className="text-[10px] text-neutral-500">
                {r.status === 'started' ? '🚀 Dereva ameanza safari!' : 'Inasubiri kuondoka kijiweni...'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase">
            {r.status === 'started' ? 'Imeanza' : 'Imethibitishwa'}
          </span>
        </div>

        {/* Driver Card Info */}
        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-[#1c1c2b] border border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                {r.vehicleType === 'bajaj' ? '🚕' : '🚗'}
              </div>
              <div>
                <h5 className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1">
                  {r.driverName}
                  {r.isVerifiedDriver && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                </h5>
                <p className="text-[10px] text-neutral-500">
                  {r.vehicleModel || (r.vehicleType === 'bajaj' ? 'Bajaji TVS King' : 'Gari')} • {r.vehiclePlate || 'T 240 ABC'}
                </p>
              </div>
            </div>

            {r.driverPhone && (
              <a
                href={`tel:${r.driverPhone}`}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center gap-1 shadow-xs"
              >
                <Phone className="w-3 h-3" />
                <span>Piga Simu</span>
              </a>
            )}
          </div>

          <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>{r.standLocation.name}</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
              <span>{r.destination.name}</span>
            </div>
            <div className="font-black text-emerald-600 dark:text-emerald-400">
              TZS {p.fare.toLocaleString()} ({p.seats} Siti)
            </div>
          </div>
        </div>

        <div className="text-center pt-1">
          <button
            onClick={() => setMyConfirmedRoute(null)}
            className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-white font-bold underline"
          >
            Angalia madereva wengine wa stendi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Intro Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🟢</span>
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              PapoShare Stendi (Madereva Walio Kijiweni)
            </h4>
            <p className="text-[9px] text-neutral-500 dark:text-neutral-400">
              Chagua gari au bajaji iliyo tayari stendi na uone bei yake
            </p>
          </div>
        </div>

        <button
          onClick={onSelectAutomaticMatch}
          className="text-[9.5px] font-black text-purple-600 dark:text-purple-400 hover:underline bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60"
        >
          🔵 Automatic Match ➔
        </button>
      </div>

      {/* Sorting & Filters Bar */}
      <div className="space-y-2">
        {/* Filters Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
              activeFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            Zote ({matchedRoutes.length})
          </button>
          <button
            onClick={() => setActiveFilter('custom_fixed')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
              activeFilter === 'custom_fixed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            💰 Bei ya Dereva
          </button>
          <button
            onClick={() => setActiveFilter('system_km')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
              activeFilter === 'system_km'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            📏 Bei ya Mfumo
          </button>
          <button
            onClick={() => setActiveFilter('verified')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
              activeFilter === 'verified'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            ✓ Verified
          </button>
          <button
            onClick={() => setActiveFilter('bajaj')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
              activeFilter === 'bajaj'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            🚕 Bajaji
          </button>
          <button
            onClick={() => setActiveFilter('mini')}
            className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
              activeFilter === 'mini'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            🚗 Mini
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1">
          <span className="font-semibold">Madereva {sortedRoutes.length} wapo tayari</span>
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent font-bold text-neutral-700 dark:text-neutral-300 focus:outline-hidden cursor-pointer"
            >
              <option value="price_asc">Bei ya chini</option>
              <option value="nearby">Aliye karibu nawe</option>
              <option value="rating">Rating kubwa</option>
              <option value="seats_desc">Viti vilivyopo vingi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Driver Cards List */}
      {loading ? (
        <div className="p-8 text-center space-y-2">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-neutral-500">Inatafuta madereva wa stendi...</p>
        </div>
      ) : sortedRoutes.length === 0 ? (
        /* FALLBACK VIEW (Section 17) */
        <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#151520] text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
              Hakuna PapoShare Stendi inayopatikana kwa route hii kwa sasa
            </h5>
            <p className="text-[10.5px] text-neutral-500 mt-1 max-w-xs mx-auto">
              Hakuna dereva aliyetangaza safari ya kuelekea huko kijiweni. Unaweza kutumia Automatic Match au safari ya Solo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onSelectAutomaticMatch}
              className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1"
            >
              <span>🔵 Tumia Automatic Match</span>
            </button>
            <button
              onClick={onSelectSolo}
              className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-black text-[10px] uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1"
            >
              <span>🚕 Tumia Solo</span>
            </button>
          </div>
        </div>
      ) : (
        /* LIST OF ACTIVE STAND DRIVERS */
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {sortedRoutes.map(({ route, distanceToStandKm, calculatedPrice }) => (
            <motion.div
              key={route.id}
              whileHover={{ scale: 1.01 }}
              className="p-3.5 rounded-2xl border-2 border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#14141e] hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-xs space-y-2.5"
            >
              {/* Top Row: Driver info & Vehicle badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-base font-black shadow-sm shrink-0">
                    {route.vehicleType === 'bajaj' ? '🚕' : '🚗'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-neutral-900 dark:text-white">
                        {route.driverName}
                      </h4>
                      {route.isVerifiedDriver && (
                        <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md">
                          <Check className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                      <span className="flex items-center gap-0.5 font-bold text-amber-500">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {route.driverRating || 4.8}
                      </span>
                      <span>•</span>
                      <span className="font-semibold uppercase">
                        {route.vehicleType === 'bajaj' ? 'Bajaji' : 'Mini Car'}
                      </span>
                      <span>•</span>
                      <span className="font-semibold">{route.vehiclePlate || 'T 240 ABC'}</span>
                    </div>
                  </div>
                </div>

                {/* Seats left indicator pill */}
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-800">
                    💺 Viti {route.availableSeats} vimebaki
                  </span>
                </div>
              </div>

              {/* Middle Row: Route Locations */}
              <div className="bg-neutral-50 dark:bg-[#1a1a27] p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                    {route.standLocation.name}
                  </span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                  <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                    {route.destination.name}
                  </span>
                </div>

                {distanceToStandKm > 0 && (
                  <span className="text-[9.5px] text-neutral-400 shrink-0 ml-2 font-medium">
                    {distanceToStandKm.toFixed(1)} km toka ulipo
                  </span>
                )}
              </div>

              {/* Bottom Row: Price & Action */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      TZS {calculatedPrice.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-semibold">/ kiti</span>
                  </div>
                  <span className="text-[8.5px] font-bold uppercase text-neutral-500">
                    {route.pricingModel === 'custom_fixed' ? '💰 Bei ya Dereva' : '📏 Bei ya Mfumo (KM)'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBookingRoute(route);
                    setSeatsToBook(1);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-1"
                >
                  <span>CHAGUA SAFARI</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* SEAT RESERVATION CONFIRMATION MODAL (Section 10) */}
      {bookingRoute && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm bg-white dark:bg-[#12121c] rounded-3xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚕</span>
                <h3 className="text-sm font-black uppercase text-neutral-900 dark:text-white">
                  PapoShare Stendi Booking
                </h3>
              </div>
              <button
                onClick={() => setBookingRoute(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Route Summary */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-bold">Dereva:</span>
                <span className="font-black text-neutral-900 dark:text-white">{bookingRoute.driverName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-bold">Njia:</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {bookingRoute.standLocation.name} ➔ {bookingRoute.destination.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-bold">Chombo:</span>
                <span className="font-bold uppercase text-neutral-900 dark:text-white">
                  {bookingRoute.vehicleType === 'bajaj' ? '🚕 Bajaji' : '🚗 Mini'}
                </span>
              </div>
            </div>

            {/* Seat Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Idadi ya Viti Unavyohitaji:
              </label>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(bookingRoute.availableSeats, 4) }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSeatsToBook(num)}
                    className={`flex-1 py-2 rounded-xl font-black text-xs border transition-all ${
                      seatsToBook === num
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {num} Siti
                  </button>
                ))}
              </div>
            </div>

            {/* Fare Calculation */}
            <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-850 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Jumla ya Nauli</p>
                <p className="text-[9px] text-neutral-400">
                  {seatsToBook} x TZS {(
                    bookingRoute.pricingModel === 'custom_fixed'
                      ? bookingRoute.fixedPricePerSeat
                      : (bookingRoute.systemFarePerSeat || 2500)
                  ).toLocaleString()}
                </p>
              </div>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                TZS {(
                  (bookingRoute.pricingModel === 'custom_fixed'
                    ? bookingRoute.fixedPricePerSeat
                    : (bookingRoute.systemFarePerSeat || 2500)) * seatsToBook
                ).toLocaleString()}
              </span>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isReserving}
                onClick={handleConfirmReservation}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                {isReserving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Inathibitisha...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>THIBITISHA BOOKING YA KITI</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setBookingRoute(null)}
                className="w-full py-2 text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
              >
                Ghairi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
