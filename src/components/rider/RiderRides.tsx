import React, { useState, useEffect } from 'react';
import { 
  MapPin, Clock, Star, ChevronRight, User, Phone, 
  MessageSquare, MoreVertical, Calendar, Bike, Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';

type RideTab = 'upcoming' | 'active' | 'past';

export default function RiderRides() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RideTab>('upcoming');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const upcomingRides = rides.filter(r => ['accepted', 'driver_arriving'].includes(r.status));
  const activeRides = rides.filter(r => ['driver_arrived', 'on_trip'].includes(r.status));
  const pastRides = rides.filter(r => ['completed', 'cancelled'].includes(r.status));

  return (
    <div className="h-full overflow-y-auto p-6 pb-36 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">My Rides</h1>
        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Manage your trips</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] shadow-inner">
        {(['upcoming', 'active', 'past'] as RideTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all ${
              activeTab === tab 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-20">
            <p className="animate-pulse font-black italic text-neutral-400">Loading trips...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'upcoming' && (
              <motion.div 
                key="upcoming"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {upcomingRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} isUpcoming />
                ))}
                {upcomingRides.length === 0 && <EmptyState message="No upcoming rides found" />}
              </motion.div>
            )}

            {activeTab === 'active' && (
              <motion.div 
                key="active"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                {activeRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} isActive />
                ))}
                {activeRides.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-100 dark:border-neutral-800">
                    <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-950/30 rounded-[2.5rem] flex items-center justify-center text-emerald-600">
                       <MoreVertical className="w-12 h-12 rotate-90" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black italic uppercase tracking-tighter">No Active Trip</h3>
                       <p className="text-xs text-neutral-500">Go online to start receiving requests</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'past' && (
              <motion.div 
                key="past"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {pastRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
                {pastRides.length === 0 && <EmptyState message="No past rides found" />}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function RideCard({ ride, isUpcoming, isActive }: { ride: any, isUpcoming?: boolean, isActive?: boolean }) {
  const price = ride.fare || ride.actualFare || ride.estimatedFare || 0;
  const dateStr = ride.createdAt && typeof ride.createdAt.toDate === 'function' ? ride.createdAt.toDate().toLocaleDateString() : 'N/A';

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-6 shadow-xl shadow-neutral-100/50 border border-neutral-100 dark:border-neutral-800 space-y-6 overflow-hidden relative group"
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
              <h4 className="font-black italic uppercase tracking-tighter leading-none mb-1">{ride.customerInfo?.name || "Mteja"}</h4>
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-1 text-orange-500 font-bold text-[10px]">
                    <Star className="w-3 h-3 fill-current" />
                    <span>4.8</span>
                 </div>
                 <Badge variant="outline" className="text-[8px] font-black uppercase text-neutral-400 py-0 h-4 border-neutral-200">
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
               <p className="text-[8px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-1">Pickup</p>
               <h4 className="text-xs font-black uppercase italic tracking-tighter leading-tight line-clamp-1">{ride.pickupAddress || "N/A"}</h4>
            </div>
         </div>

         <div className="flex items-start gap-4 relative z-10">
            <div className="w-5 h-5 rounded-full bg-orange-600 border-4 border-white dark:border-neutral-900 shrink-0 mt-1 shadow-lg" />
            <div>
               <p className="text-[8px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-1">Destination</p>
               <h4 className="text-xs font-black uppercase italic tracking-tighter leading-tight line-clamp-1">{ride.destinationAddress || "N/A"}</h4>
            </div>
         </div>
      </div>

      {(isUpcoming || isActive) ? (
        <div className="flex gap-3 pt-2">
           <button className="flex-1 h-12 bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-2xl font-black uppercase tracking-widest italic text-xs shadow-xl">
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
              {ride.status}
           </span>
           <button className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 italic">
              View Details <ChevronRight className="w-3 h-3" />
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
