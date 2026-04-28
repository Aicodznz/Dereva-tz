import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, TrendingDown, Calendar, ArrowUpRight, 
  Clock, DollarSign, Bike
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';

export default function RiderStats() {
  const { user } = useAuth();
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
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      setRides(ridesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching stats:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Derived stats
  const completedRides = rides.filter(r => r.status === 'completed');
  const pendingRides = rides.filter(r => r.status === 'pending' || r.status === 'accepted' || r.status === 'started');
  const cancelledRides = rides.filter(r => r.status === 'cancelled');

  const totalEarnings = completedRides.reduce((sum, r) => sum + (r.actualFare || r.estimatedFare || 0), 0);
  const totalTrips = completedRides.length;

  const bookingData = [
    { name: 'Completed', value: rides.length > 0 ? (completedRides.length / rides.length) * 100 : 0, color: '#10b981' },
    { name: 'Pending', value: rides.length > 0 ? (pendingRides.length / rides.length) * 100 : 0, color: '#f59e0b' },
    { name: 'Cancelled', value: rides.length > 0 ? (cancelledRides.length / rides.length) * 100 : 0, color: '#ef4444' },
  ];

  // Group by day for earnings chart (last 7 days)
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }).reverse();

  const earningsByDay = last7Days.map(day => {
    const amount = completedRides
      .filter(r => {
        const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
        return date.toLocaleDateString('en-US', { weekday: 'short' }) === day;
      })
      .reduce((sum, r) => sum + (r.actualFare || r.estimatedFare || 0), 0);
    return { day, amount };
  });

  return (
    <div className="p-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
         <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">Performance</h1>
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Real-time stats overview</p>
         </div>
         <motion.button 
          whileTap={{ scale: 0.95 }}
          className="p-3 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800"
         >
            <Calendar className="w-5 h-5 text-neutral-500" />
         </motion.button>
      </div>

      <AnimatePresence>
        {loading ? (
          <div className="py-20 text-center">
            <p className="animate-pulse font-black italic uppercase tracking-tighter text-neutral-400">Loading Stats...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total Booking Chart */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 overflow-hidden">
                <CardHeader className="p-6 pb-0">
                   <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Total Booking</CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex items-center justify-between">
                   <div className="w-1/2 h-[150px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bookingData}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={8}
                            dataKey="value"
                          >
                            {bookingData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="w-1/2 space-y-3">
                      {bookingData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider flex-1">{item.name}</span>
                          <span className="text-sm font-black italic">{Math.round(item.value)}%</span>
                        </div>
                      ))}
                   </div>
                </CardContent>
              </Card>

              {/* Total Earnings Card */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-emerald-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <DollarSign className="w-24 h-24" />
                </div>
                <CardHeader className="p-8 pb-0">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Earnings</p>
                   <div className="flex items-baseline gap-2">
                      <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                        TZS {totalEarnings >= 1000000 ? `${(totalEarnings / 1000000).toFixed(1)}M` : totalEarnings.toLocaleString()}
                      </h2>
                      <div className="flex items-center text-xs font-bold gap-0.5 bg-white/20 px-2 py-0.5 rounded-full">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>0%</span>
                      </div>
                   </div>
                </CardHeader>
                <CardContent className="p-8 h-[120px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={earningsByDay}>
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="amount" stroke="#fff" fillOpacity={1} fill="url(#colorAmount)" strokeWidth={3} />
                      </AreaChart>
                   </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Drive Performance Summary */}
            <div className="bg-neutral-100 dark:bg-neutral-900/50 rounded-[2rem] p-6 grid grid-cols-2 gap-4">
              {[
                { label: "Active Minutes", value: (totalTrips * 30).toString(), color: "text-emerald-500" },
                { label: "Total Trips", value: totalTrips.toString(), color: "text-blue-500" },
                { label: "Top Rated", value: "0.0", color: "text-orange-500" },
                { label: "Revenue Share", value: "85%", color: "text-purple-500" }
              ].map((item, idx) => (
                <div key={idx} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm border border-neutral-100 dark:border-neutral-800">
                   <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest mb-1">{item.label}</p>
                   <h4 className={`text-lg font-black italic uppercase tracking-tighter ${item.color}`}>{item.value}</h4>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
