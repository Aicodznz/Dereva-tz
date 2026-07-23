import React, { useState, useEffect } from 'react';
import { 
  MapPin, Clock, Star, ChevronRight, User, Phone, 
  MessageSquare, MoreVertical, Calendar, Bike, Car, Filter, Trash2, ArrowRight, X, DollarSign, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';

type RideTab = 'upcoming' | 'active' | 'past';

export default function RiderRides() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RideTab>('past'); // Default to past for reports view
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Selected ride for full details view
  const [selectedRide, setSelectedRide] = useState<any | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid index requirement
      ridesData.sort((a: any, b: any) => {
        const dateA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      setRides(ridesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching rides:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Earnings calculations
  const todayStr = new Date().toDateString();
  const todayEarnings = rides
    .filter(r => {
      if (r.status !== 'completed') return false;
      const rDate = r.createdAt && typeof r.createdAt.toDate === 'function' ? r.createdAt.toDate() : new Date(r.createdAt);
      return rDate.toDateString() === todayStr;
    })
    .reduce((sum, r) => sum + (r.fare || r.actualFare || r.estimatedFare || 0), 0);

  // Filter rides based on active tab & selected dates
  const filteredRides = rides.filter(r => {
    // 1. Tab filtering
    const isPast = ['completed', 'cancelled'].includes(r.status);
    const isUpcoming = ['accepted', 'driver_arriving'].includes(r.status);
    const isActive = ['driver_arrived', 'on_trip'].includes(r.status);

    if (activeTab === 'upcoming' && !isUpcoming) return false;
    if (activeTab === 'active' && !isActive) return false;
    if (activeTab === 'past' && !isPast) return false;

    // 2. Date Range filtering
    const rDate = r.createdAt && typeof r.createdAt.toDate === 'function' ? r.createdAt.toDate() : new Date(r.createdAt);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (rDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (rDate > end) return false;
    }
    return true;
  });

  // Calculate earnings for the filtered period
  const periodEarnings = filteredRides
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.fare || r.actualFare || r.estimatedFare || 0), 0);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="h-full overflow-y-auto p-6 pb-36 space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">Ripoti ya Safari & Mapato</h1>
        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Tazama na chuja mapato yako ya kila siku na safari zako</p>
      </div>

      {/* Earnings Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Today's Earnings */}
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet className="w-20 h-20" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100 mb-1">Mapato ya Leo (Today's Earnings)</p>
          <h2 className="text-3xl font-black italic tracking-tight">{todayEarnings.toLocaleString()} TZS</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <p className="text-[9px] font-bold text-emerald-200">Inajumuisha safari zilizokamilika leo</p>
          </div>
        </div>

        {/* Selected Period Earnings */}
        <div className="bg-neutral-900 text-white dark:bg-neutral-900/90 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group border border-neutral-800">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <Calendar className="w-20 h-20" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Mapato ya Kipindi (Period Earnings)</p>
          <h2 className="text-3xl font-black italic tracking-tight text-emerald-400">{periodEarnings.toLocaleString()} TZS</h2>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-[9px] font-bold text-neutral-400">
              {startDate || endDate 
                ? `Kipindi: ${startDate || 'Mwanzo'} hadi ${endDate || 'Leo'}` 
                : 'Chagua tarehe hapo chini kuchuja'}
            </p>
          </div>
        </div>
      </div>

      {/* Date Filter Panel */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">Chuja kwa Tarehe (Filter by Date)</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 text-left">
            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-2">Kuanzia Tarehe (Start Date)</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 outline-none font-bold text-xs"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-2">Hadi Tarehe (End Date)</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 outline-none font-bold text-xs"
            />
          </div>
        </div>

        {(startDate || endDate) && (
          <div className="flex justify-end">
            <button 
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Futa Chuja (Clear Filter)
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] shadow-inner">
        {(['upcoming', 'active', 'past'] as RideTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all ${
              activeTab === tab 
                ? 'bg-emerald-600 text-white shadow-lg' 
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab === 'upcoming' ? 'Zijazo' : tab === 'active' ? 'Zinazoendelea' : 'Historia / Zilizopita'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-20">
            <p className="animate-pulse font-black italic text-neutral-400">Inapakia safari...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {filteredRides.map((ride) => (
                <div key={ride.id} onClick={() => setSelectedRide(ride)} className="cursor-pointer">
                  <RideCard 
                    ride={ride} 
                    isUpcoming={activeTab === 'upcoming'} 
                    isActive={activeTab === 'active'} 
                  />
                </div>
              ))}
              {filteredRides.length === 0 && (
                <EmptyState message={`Hakuna safari zilizopatikana (${activeTab})`} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Ride Detail Modal / Slide-over */}
      <AnimatePresence>
        {selectedRide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedRide(null)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest">MAELEZO YA SAFARI</span>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">Trip Details</h3>
                </div>
                <button 
                  onClick={() => setSelectedRide(null)}
                  className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Avatar & Call Info */}
              <div className="flex justify-between items-center p-4 bg-neutral-50 dark:bg-neutral-950 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <img 
                    src={selectedRide.customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedRide.customerId}`} 
                    alt="Customer" 
                    className="w-14 h-14 rounded-2xl object-cover border border-neutral-200"
                  />
                  <div>
                    <h4 className="font-black italic uppercase text-neutral-900 dark:text-white leading-none">{selectedRide.customerInfo?.name || "Mteja wetu"}</h4>
                    <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 mt-1 block">Abiria / Passenger</span>
                  </div>
                </div>
                {selectedRide.customerInfo?.phone && (
                  <a 
                    href={`tel:${selectedRide.customerInfo.phone}`}
                    className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                )}
              </div>

              {/* Ride Address Details */}
              <div className="space-y-4 relative p-2">
                <div className="absolute left-[21px] top-6 bottom-10 w-0.5 border-l-2 border-dashed border-neutral-200 dark:border-neutral-800" />
                
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider leading-none">Mahali pa Kupanda (Pickup)</span>
                    <h4 className="text-xs font-black uppercase italic tracking-tighter text-neutral-800 dark:text-neutral-200 mt-0.5">{selectedRide.pickupAddress || "Dar es Salaam"}</h4>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-600" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider leading-none">Mahali pa Kushuka (Destination)</span>
                    <h4 className="text-xs font-black uppercase italic tracking-tighter text-neutral-800 dark:text-neutral-200 mt-0.5">{selectedRide.destinationAddress || "Dar es Salaam"}</h4>
                  </div>
                </div>
              </div>

              {/* Ride Fare & Payment Details */}
              <div className="bg-neutral-50 dark:bg-neutral-950 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800 space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 pb-2 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                  <span>Malipo & Gharama (Pricing breakdown)</span>
                  <span className="text-[8px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-black">
                    {selectedRide.paymentMethod?.toLowerCase().includes('ussd') || selectedRide.isUssd ? 'USSD Ride' : 'App / Web Ride'}
                  </span>
                </h5>

                {(() => {
                  const totalPaid = selectedRide.fare || selectedRide.actualFare || selectedRide.estimatedFare || 0;
                  const isUssd = Boolean(selectedRide.paymentMethod?.toLowerCase().includes('ussd') || selectedRide.isUssd);
                  const ussdFee = isUssd ? 500 : 0;
                  const baseFare = Math.max(0, totalPaid - ussdFee);
                  const commission = Math.round(baseFare * 0.15);
                  const driverNet = baseFare - commission;

                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500 font-bold">Nauli ya Safari (Customer Fare)</span>
                        <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">
                          {baseFare.toLocaleString()} TZS
                        </span>
                      </div>

                      {isUssd && (
                        <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                          <span className="text-xs font-bold">Ada ya Mtandao wa USSD</span>
                          <span className="text-sm font-black">+ {ussdFee.toLocaleString()} TZS</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-red-500/80">
                        <span className="text-xs font-bold">Kamisheni ya Mfumo (15% ya {baseFare.toLocaleString()})</span>
                        <span className="text-sm font-black">- {commission.toLocaleString()} TZS</span>
                      </div>

                      <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
                        <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">💰 Dereva Anapata (Net Earnings)</span>
                        <span className="text-base font-black italic text-emerald-600 dark:text-emerald-400">
                          {driverNet.toLocaleString()} TZS
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="text-xs font-black uppercase text-neutral-700 dark:text-neutral-300">Jumla Iliyolipwa na Mteja</span>
                        <span className="text-xl font-black italic text-neutral-900 dark:text-white">
                          {totalPaid.toLocaleString()} TZS
                        </span>
                      </div>
                    </>
                  );
                })()}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-[9px] font-black uppercase text-neutral-400">Njia ya Malipo (Payment Method)</span>
                  <Badge className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-none font-bold text-[9px] uppercase px-3 py-1">
                    {selectedRide.paymentMethod || 'Mobile Money'}
                  </Badge>
                </div>
              </div>

              {/* Timeline Info */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">Muda wa Kuanza</span>
                  <p className="text-xs font-black text-neutral-800 dark:text-neutral-200 mt-1">
                    {selectedRide.startedAt 
                      ? (selectedRide.startedAt.toDate ? selectedRide.startedAt.toDate().toLocaleTimeString() : new Date(selectedRide.startedAt).toLocaleTimeString()) 
                      : 'N/A'}
                  </p>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">Muda wa Kukamilisha</span>
                  <p className="text-xs font-black text-neutral-800 dark:text-neutral-200 mt-1">
                    {selectedRide.completedAt 
                      ? (selectedRide.completedAt.toDate ? selectedRide.completedAt.toDate().toLocaleTimeString() : new Date(selectedRide.completedAt).toLocaleTimeString()) 
                      : (selectedRide.createdAt && selectedRide.createdAt.toDate ? selectedRide.createdAt.toDate().toLocaleTimeString() : 'N/A')}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-center pt-2">
                <Badge className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-none tracking-widest ${
                  selectedRide.status === 'completed' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {selectedRide.status === 'completed' ? 'SAMBAMBA / COMPLETED' : selectedRide.status}
                </Badge>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RideCard({ ride, isUpcoming, isActive }: { ride: any, isUpcoming?: boolean, isActive?: boolean }) {
  const price = ride.fare || ride.actualFare || ride.estimatedFare || 0;
  const dateStr = ride.createdAt && typeof ride.createdAt.toDate === 'function' ? ride.createdAt.toDate().toLocaleDateString() : 'N/A';

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-6 shadow-xl shadow-neutral-100/50 border border-neutral-100 dark:border-neutral-800 space-y-6 overflow-hidden relative group text-left"
    >
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
        <Car className="w-20 h-20" />
      </div>

      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl border-2 border-emerald-500/20 p-1">
            <img 
              src={ride.customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
              alt={ride.customerInfo?.name || "User"} 
              className="w-full h-full rounded-xl object-cover" 
            />
          </div>
          <div>
            <h4 className="font-black italic uppercase tracking-tighter leading-none mb-1 text-neutral-800 dark:text-neutral-100">{ride.customerInfo?.name || "Mteja"}</h4>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-orange-500 font-bold text-[10px]">
                <Star className="w-3 h-3 fill-current" />
                <span>4.8</span>
              </div>
              <Badge variant="outline" className="text-[8px] font-black uppercase text-neutral-400 py-0 h-4 border-neutral-200 dark:border-neutral-800">
                {ride.vehicleType || 'Cab'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-black italic text-emerald-600 leading-none">TZS {price.toLocaleString()}</p>
          <p className="text-[9px] font-black uppercase text-neutral-400 mt-1">
            {dateStr}
          </p>
        </div>
      </div>

      {/* Locations */}
      <div className="space-y-4 relative">
        <div className="absolute left-[9px] top-3 bottom-10 w-0.5 border-l-2 border-dashed border-neutral-100 dark:border-neutral-800" />
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-white dark:border-neutral-900 shrink-0 mt-1 shadow-lg" />
          <div>
            <p className="text-[8px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-1">Pickup (Unapoanzia)</p>
            <h4 className="text-xs font-black uppercase italic tracking-tighter leading-tight line-clamp-1 text-neutral-800 dark:text-neutral-200">{ride.pickupAddress || "N/A"}</h4>
          </div>
        </div>

        <div className="flex items-start gap-4 relative z-10">
          <div className="w-5 h-5 rounded-full bg-orange-600 border-4 border-white dark:border-neutral-900 shrink-0 mt-1 shadow-lg" />
          <div>
            <p className="text-[8px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-1">Destination (Unapoishia)</p>
            <h4 className="text-xs font-black uppercase italic tracking-tighter leading-tight line-clamp-1 text-neutral-800 dark:text-neutral-200">{ride.destinationAddress || "N/A"}</h4>
          </div>
        </div>
      </div>

      {(isUpcoming || isActive) ? (
        <div className="flex gap-3 pt-2">
          <button className="flex-1 h-12 bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-2xl font-black uppercase tracking-widest italic text-xs shadow-xl text-white">
            Go to Map
          </button>
          <button className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-600 dark:text-neutral-400">
            <MessageSquare className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-red-500 border border-red-100 dark:border-red-900/30">
            <Phone className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center pt-2 border-t border-neutral-50 dark:border-neutral-800">
          <span className={`text-[10px] font-black uppercase tracking-widest ${
            ride.status === 'completed' ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {ride.status === 'completed' ? 'Tayari / Completed' : ride.status}
          </span>
          <button className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 italic">
            Maelezo Kamili <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-900/50 rounded-[3rem] border-2 border-dashed border-neutral-100 dark:border-neutral-800">
      <p className="text-neutral-400 font-black uppercase italic tracking-tighter text-sm">{message}</p>
    </div>
  );
}
