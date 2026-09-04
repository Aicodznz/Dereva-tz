import React, { useState, useEffect } from 'react';
import { 
  Users, MapPin, Compass, DollarSign, 
  CheckCircle2, AlertCircle, Trash2, Phone,
  RefreshCw, Car, ShieldCheck, Eye, ArrowRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { StandPoolingRoute } from '../../services/standPoolingService';
import { toast } from 'sonner';

export default function AdminPapoShareStendi() {
  const [routes, setRoutes] = useState<StandPoolingRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<StandPoolingRoute | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'stand_pooling_routes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StandPoolingRoute[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as StandPoolingRoute;
        data.id = d.id;
        list.push(data);
      });
      // Sort newest or active first
      list.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
      });
      setRoutes(list);
      setLoading(false);
    }, (err) => {
      console.error("Admin Stand Routes listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleForceCancel = async (routeId: string) => {
    if (confirm("Je, una uhakika unataka kufuta au kufunga safari hii ya stendi kutoka kwa dereva huyu?")) {
      try {
        await updateDoc(doc(db, 'stand_pooling_routes', routeId), {
          status: 'cancelled',
          isActive: false
        });
        toast.success("Safari imefungwa na mfumo.");
      } catch (err) {
        toast.error("Imeshindikana kusitisha safari.");
      }
    }
  };

  const filtered = routes.filter((r) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return r.isActive;
    if (filterStatus === 'boarding') return r.status === 'boarding';
    if (filterStatus === 'started') return r.status === 'started';
    if (filterStatus === 'completed') return r.status === 'completed';
    return true;
  });

  const activeCount = routes.filter(r => r.isActive).length;
  const totalPassengers = routes.reduce((acc, r) => acc + (r.passengers?.length || 0), 0);
  const totalAvailableSeats = routes.filter(r => r.isActive).reduce((acc, r) => acc + (r.availableSeats || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
            <span>🚕</span> PAPOSHARE STENDI
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Usimamizi wa njia za stendi na kijiweni, madereva walio hewani na abiria
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Njia Zilizo Hewani</span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{activeCount}</p>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
            <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Viti Vilivyopo</span>
            <p className="text-lg font-black text-blue-700 dark:text-blue-300">{totalAvailableSeats}</p>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-center">
            <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">Abiria Waliohifadhi</span>
            <p className="text-lg font-black text-purple-700 dark:text-purple-300">{totalPassengers}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {['all', 'active', 'boarding', 'started', 'completed'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all ${
              filterStatus === st
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            {st === 'all' ? 'Zote' : st === 'active' ? 'Zilizo Hewani' : st === 'boarding' ? 'Inajaza Viti' : st === 'started' ? 'Safari Zimeanza' : 'Zilizokamilika'}
          </button>
        ))}
      </div>

      {/* Routes List / Table */}
      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-neutral-500">Inapakia taarifa za stendi...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-3xl bg-neutral-50 dark:bg-[#161622] border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
          <Car className="w-10 h-10 text-neutral-400 mx-auto" />
          <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Hakuna safari zilizopatikana kwenye kichujio hiki.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((route) => (
            <div
              key={route.id}
              className="p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161622] shadow-sm space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                    {route.vehicleType === 'bajaj' ? '🚕' : '🚗'}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {route.driverName}
                      <span className="text-[10px] text-neutral-400 font-normal">({route.vehiclePlate || 'Bila Namba'})</span>
                    </h4>
                    <p className="text-[10px] text-neutral-500">
                      Simu: {route.driverPhone || 'Haipo'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    route.status === 'started'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : route.status === 'boarding'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}>
                    {route.status}
                  </span>
                </div>
              </div>

              {/* Route */}
              <div className="p-2.5 rounded-2xl bg-neutral-50 dark:bg-[#1b1b2a] border border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{route.standLocation?.name}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                  <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{route.destination?.name}</span>
                </div>
              </div>

              {/* Pricing & Seats */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-neutral-100 dark:border-neutral-800">
                <div>
                  <span className="text-neutral-500 font-medium">Bei ya Kiti:</span>
                  <p className="font-black text-emerald-600 dark:text-emerald-400">
                    {route.pricingModel === 'custom_fixed'
                      ? `TZS ${route.fixedPricePerSeat?.toLocaleString()} (Dereva)`
                      : `TZS ${route.systemFarePerSeat?.toLocaleString()} (Mfumo KM)`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-neutral-500 font-medium">Viti:</span>
                  <p className="font-black text-neutral-800 dark:text-neutral-200">
                    {route.occupiedSeats} zimejaa / {route.availableSeats} wazi (Jumla {route.totalSeats})
                  </p>
                </div>
              </div>

              {/* Passengers Accordion / Summary */}
              {route.passengers && route.passengers.length > 0 && (
                <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 space-y-1">
                  <p className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                    Abiria ({route.passengers.length})
                  </p>
                  {route.passengers.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10.5px]">
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">{p.passengerName}</span>
                      <span className="text-neutral-500">
                        {p.seats} viti • TZS {p.fare?.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Admin Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {route.isActive && (
                  <button
                    onClick={() => handleForceCancel(route.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Sitisha Safari Hii</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
