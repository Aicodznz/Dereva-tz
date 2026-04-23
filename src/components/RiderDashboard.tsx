import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Order, RiderProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bike, MapPin, Package, CheckCircle, Power, Navigation, 
  DollarSign, Clock, Star, History, Bell, ChevronRight, User,
  MoreVertical, Activity, Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function RiderDashboard() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'history' | 'earnings'>('requests');

  useEffect(() => {
    if (!user || profile?.approvalStatus !== 'approved') return;
    const q = query(collection(db, 'orders'), where('status', '==', 'ready_for_pickup'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      console.error("Rider orders listener error:", error);
    });
    return () => unsubscribe();
  }, [user, profile?.approvalStatus]);

  const toggleStatus = () => {
    setIsOnline(!isOnline);
  };

  if (profile?.approvalStatus === 'pending') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="relative">
          <motion.div 
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="w-32 h-32 bg-orange-100 dark:bg-orange-950/30 rounded-[3rem] flex items-center justify-center text-orange-600 shadow-2xl shadow-orange-500/20"
          >
            <Shield className="w-16 h-16" />
          </motion.div>
          <motion.div 
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white dark:border-neutral-950"
          />
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none text-neutral-900 dark:text-white">
            Uthibitisho Unashughulikiwa
          </h1>
          <p className="text-neutral-500 font-medium leading-relaxed">
            Asante kwa kujiunga na familia ya <span className="text-orange-600 font-bold italic underline">TegeX</span>. 
            Taarifa zako zinakaguliwa na timu yetu ya Admin. Utapokea taarifa punde tu utakapoidhinishwa kuanza kazi.
          </p>
          <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-xs font-black uppercase tracking-widest text-neutral-400">
            Hali ya Sasa: <span className="text-orange-600">Pending Approval ⏳</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button variant="outline" className="h-14 rounded-2xl font-black uppercase tracking-widest italic" onClick={() => window.location.reload()}>
            Refresh Hali
          </Button>
          <Link to="/" className="text-[10px] font-black uppercase text-neutral-400 hover:text-orange-600 transition-colors">
            Rudi Nyumbani
          </Link>
        </div>
      </div>
    );
  }

  const statusColor = isOnline ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20';

  return (
    <div className="pb-24 space-y-8">
      {/* 1. Dynamic Header with Status Toggle */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
           <Activity className="w-24 h-24 text-orange-600" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-[2rem] border-2 border-orange-600 p-1 relative overflow-hidden">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="Profile" className="w-full h-full object-cover rounded-[1.5rem]" />
               <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-neutral-900 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Karibu Tena,</p>
               <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">{profile?.displayName || 'Moses'}</h1>
               <div className="flex items-center gap-2 mt-2">
                 <Badge className="bg-orange-600 border-none font-black text-[9px] px-3 py-1 rounded-full">{profile?.vehicleType || 'Motorcycle'}</Badge>
                 <div className="flex items-center gap-1 text-orange-500 font-bold text-xs">
                    <Star className="w-3 h-3 fill-current" />
                    <span>4.9 (124)</span>
                 </div>
               </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
             <button 
               onClick={toggleStatus}
               className={`flex items-center gap-3 px-8 py-4 rounded-3xl font-black uppercase tracking-widest transition-all ${
                 isOnline ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'
               }`}
             >
                <Power className="w-5 h-5" />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
             </button>
             <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mr-2">GPS Tracking Active 🛰️</p>
          </div>
        </div>
      </div>

      {/* 2. Earnings & Stats Slider */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Earnings", value: "TZS 45,000", icon: DollarSign, color: "text-emerald-500" },
          { label: "Trips Today", value: "12", icon: Bike, color: "text-orange-500" },
          { label: "Hours Online", value: "6.5h", icon: Clock, color: "text-blue-500" },
          { label: "Completion Rate", value: "98%", icon: Shield, color: "text-purple-500" }
        ].map((stat, idx) => (
          <Card key={idx} className="bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl shadow-neutral-100/5 group hover:border-orange-500/20 transition-all">
            <CardContent className="p-6 flex flex-col items-center text-center">
               <div className={`w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center mb-3 ${stat.color} group-hover:scale-110 transition-transform`}>
                 <stat.icon className="w-5 h-5" />
               </div>
               <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-1">{stat.label}</p>
               <h4 className="text-xl font-black italic uppercase tracking-tighter leading-none">{stat.value}</h4>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Main Dashboard Tabs */}
      <div className="space-y-6">
        <div className="flex gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] w-fit mx-auto shadow-inner">
           {['requests', 'history', 'earnings'].map((tab) => (
             <button 
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                 activeTab === tab ? 'bg-orange-600 text-white shadow-xl' : 'text-neutral-400 hover:text-neutral-600'
               }`}
             >
               {tab}
             </button>
           ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'requests' && (
            <motion.div 
               key="requests" 
               initial={{ opacity: 0, y: 20 }} 
               animate={{ opacity: 1, y: 0 }} 
               exit={{ opacity: 0, y: -20 }}
               className="space-y-6"
            >
               <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Available Jobs</h2>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-neutral-400">{orders.length} Nearby Jobs</span>
                  </div>
               </div>

               {orders.length === 0 ? (
                 <div className="text-center py-24 bg-white dark:bg-neutral-900 rounded-[3rem] border-2 border-dashed border-neutral-100 dark:border-neutral-800">
                    <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-neutral-300">
                       <Bell className="w-10 h-10" />
                    </div>
                    <p className="text-neutral-500 font-bold uppercase italic tracking-tighter">Waiting for new requests...</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map((order) => (
                      <Card key={order.id} className="bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 shadow-2xl rounded-[2.5rem] overflow-hidden group hover:border-orange-500/30 transition-all border-2">
                        <CardContent className="p-6">
                           <div className="flex justify-between items-start mb-6">
                              <div className="bg-orange-50 dark:bg-orange-950/30 px-4 py-2 rounded-2xl flex items-center gap-2">
                                 <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                    <Activity className="w-4 h-4 text-orange-600" />
                                 </motion.div>
                                 <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{order.type}</span>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black uppercase text-neutral-400">Earnings</p>
                                 <p className="text-xl font-black italic text-emerald-500">TZS 12,500</p>
                              </div>
                           </div>

                           <div className="space-y-6 mb-8 relative">
                              <div className="absolute left-[9px] top-3 bottom-3 w-0.5 border-l-2 border-dashed border-neutral-100 dark:border-neutral-800" />
                              <div className="flex items-start gap-4 relative z-10">
                                 <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-white dark:border-neutral-900 shrink-0 mt-1 shadow-lg" />
                                 <div>
                                   <p className="text-[9px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-1">Pickup Store</p>
                                   <h4 className="text-sm font-black uppercase italic tracking-tighter leading-tight">Downtown Mall, Block 4</h4>
                                 </div>
                              </div>
                              <div className="flex items-start gap-4 relative z-10">
                                 <div className="w-5 h-5 rounded-full bg-orange-600 border-4 border-white dark:border-neutral-900 shrink-0 mt-1 shadow-lg" />
                                 <div>
                                   <p className="text-[9px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-1">Deliver To</p>
                                   <h4 className="text-sm font-black uppercase italic tracking-tighter leading-tight line-clamp-1">{order.deliveryAddress}</h4>
                                 </div>
                              </div>
                           </div>

                           <Button className="w-full h-14 bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-2xl font-black uppercase tracking-widest italic group-hover:bg-orange-600 group-hover:text-white transition-all shadow-xl shadow-neutral-900/10">
                              Accept Trip
                           </Button>
                        </CardContent>
                      </Card>
                    ))}
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
               <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Trip History</h2>
                  <button className="text-[10px] font-black uppercase text-orange-600 underline">View Full History</button>
               </div>
               {[1, 2, 3].map((i) => (
                 <div key={i} className="flex items-center p-6 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] gap-4 group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:bg-orange-600/10 group-hover:text-orange-600 transition-all">
                       <History className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                       <h4 className="font-black uppercase italic text-sm tracking-tighter">Deliver to Sea Cliff Hotel</h4>
                       <p className="text-[10px] font-bold text-neutral-500 uppercase">Yesterday • 4:20 PM • Completed</p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black italic">TZS 18,000</p>
                       <div className="flex items-center gap-1 text-orange-500 justify-end">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="text-[10px] font-black">5.0</span>
                       </div>
                    </div>
                 </div>
               ))}
            </motion.div>
          )}

          {activeTab === 'earnings' && (
            <motion.div key="earnings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
               <div className="bg-emerald-500/10 border border-emerald-500/20 p-10 rounded-[3rem] text-center space-y-4">
                  <p className="text-sm font-black uppercase text-emerald-600 tracking-widest leading-none mb-2">Total Balance Available</p>
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">TZS 324,500</h2>
                  <Button className="bg-emerald-600 hover:bg-emerald-500 px-10 h-14 rounded-3xl font-black uppercase tracking-widest italic shadow-xl shadow-emerald-500/20">
                     Withdraw to M-Pesa
                  </Button>
               </div>
               
               <div className="space-y-4">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Recent Payouts</h3>
                  {[1, 2].map((i) => (
                    <div key={i} className="flex justify-between items-center p-6 bg-neutral-50 dark:bg-neutral-800/30 rounded-3xl">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                             <CheckCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-black italic text-sm">Payout to 082***081</p>
                            <p className="text-[10px] font-medium text-neutral-500">22 April 2024</p>
                          </div>
                       </div>
                       <p className="font-black italic text-emerald-500">TZS 85,000</p>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
