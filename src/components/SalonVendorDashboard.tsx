import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  Scissors, 
  TrendingUp, 
  Plus, 
  Search, 
  Bell, 
  Settings, 
  LogOut,
  ChevronRight,
  Clock,
  DollarSign,
  Star,
  UserPlus,
  MessageSquare,
  LayoutGrid,
  MoreVertical,
  Filter,
  CheckCircle2,
  Clock3,
  XCircle,
  Menu,
  ChevronLeft,
  Smartphone,
  CreditCard,
  UserCheck,
  Award,
  Store,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { VendorProfile, Product, Order } from '../types';
import { handleFirestoreError, OperationType } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useLanguage } from '../LanguageContext';

type TabType = 'overview' | 'appointments' | 'services' | 'staff' | 'clients' | 'analytics' | 'settings';

const COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74'];

const getSafeTime = (val: any): number => {
  try {
    if (!val) return 0;
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        if (d && typeof d.getTime === 'function') {
          return d.getTime();
        }
      } catch (innerErr) {
        console.warn("Error calling toDate inside getSafeTime:", innerErr);
      }
    }
    if (val.seconds) return val.seconds * 1000;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  } catch (err) {
    console.error("Critical error in getSafeTime:", err);
    return 0;
  }
};

const getSafeDate = (val: any): Date => {
  try {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        if (d instanceof Date) return d;
      } catch (innerErr) {
        console.warn("Error calling toDate inside getSafeDate:", innerErr);
      }
    }
    if (val.seconds) return new Date(val.seconds * 1000);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch (err) {
    console.error("Critical error in getSafeDate:", err);
    return new Date();
  }
};

export default function SalonVendorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [appointments, setAppointments] = useState<Order[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  const salonTabs = useMemo(() => [
    { id: 'overview', label: 'Home', icon: LayoutGrid },
    { id: 'appointments', label: 'Miadi', icon: Calendar },
    { id: 'services', label: 'Huduma', icon: Scissors },
    { id: 'staff', label: 'Team', icon: Users },
    { id: 'clients', label: 'Wateja', icon: UserPlus },
    { id: 'analytics', label: 'Data', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ], []);

  useEffect(() => {
    if (!user) return;

    const fetchVendor = async () => {
      try {
        const q = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setVendorProfile({ id: snap.docs[0].id, ...snap.docs[0].data() } as VendorProfile);
        }
      } catch (error) {
        console.error('Error fetching vendor:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [user]);

  useEffect(() => {
    if (!vendorProfile?.id) return;

    // Fetch Appointments (Orders)
    const qApt = query(
      collection(db, 'orders'),
      where('vendorOwnerUid', '==', user?.uid)
    );
    const unsubApt = onSnapshot(qApt, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Sort client-side
      const sorted = docs.sort((a, b) => {
        const timeA = getSafeTime(a.createdAt);
        const timeB = getSafeTime(b.createdAt);
        return timeB - timeA;
      });
      
      setAppointments(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders_salon');
    });

    // Fetch Services (Products)
    const qSrv = query(
      collection(db, 'products'),
      where('vendorId', '==', vendorProfile.id)
    );
    const unsubSrv = onSnapshot(qSrv, (snap) => {
      setServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products_salon');
    });

    // Fetch Staff
    const qStaff = query(
      collection(db, 'staff'),
      where('vendorOwnerUid', '==', user?.uid)
    );
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      if (error.message?.includes('permission')) {
        console.warn("Staff collection access restricted. Ensure firestore.rules includes 'staff' collection.");
        return;
      }
      handleFirestoreError(error, OperationType.GET, 'staff_salon');
    });

    return () => {
      unsubApt();
      unsubSrv();
      unsubStaff();
    };
  }, [vendorProfile?.id]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayApts = appointments.filter(a => {
      const d = getSafeDate(a.createdAt);
      return d >= today;
    });

    const revenue = appointments
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.totalAmount || 0), 0);

    return {
      revenue,
      todayApts: todayApts.length,
      pendingApts: appointments.filter(a => a.status === 'pending').length,
      activeStaff: staff.filter(s => s.status !== 'on_leave').length,
    };
  }, [appointments, staff]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-[#ea580c] border-t-transparent rounded-full"
          />
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">Inapakia Data za Saluni...</p>
        </div>
      </div>
    );
  }

  if (!vendorProfile && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0f] text-white p-8 text-center">
        <div className="w-24 h-24 bg-neutral-900 rounded-[40px] flex items-center justify-center mb-8 border border-white/5">
          <Store className="w-10 h-10 text-neutral-700" />
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4">Hujatengeneza Wasifu</h2>
        <p className="text-neutral-500 mb-10 max-w-sm leading-relaxed">Inaonekana bado hujasajili biashara yako ya saluni. Tafadhali rudi kwenye Dashboard kuu kukamilisha usajili.</p>
        <Button 
          onClick={() => window.location.href = '/'} 
          className="bg-[#ea580c] hover:bg-orange-700 h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-950/20"
        >
          Rudi Kwenye Dashboard
        </Button>
      </div>
    );
  }

  const SidebarItem = ({ id, label, icon: Icon }: { id: TabType, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
        activeTab === id 
          ? 'bg-[#ea580c] text-white shadow-lg shadow-orange-600/20' 
          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className={`font-medium ${!isSidebarOpen && 'hidden md:hidden'}`}>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#060608] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="hidden md:flex flex-col border-r border-white/5 bg-[#0a0a0f] p-4 relative z-50"
      >
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-600/20">
            <Scissors className="text-white" size={24} />
          </div>
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-xl tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent"
            >
              SALON PRO
            </motion.h1>
          )}
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem id="overview" label="Mwanzo (Home)" icon={LayoutGrid} />
          <SidebarItem id="appointments" label="Miadi (Appointments)" icon={Calendar} />
          <SidebarItem id="services" label="Huduma (Services)" icon={Scissors} />
          <SidebarItem id="staff" label="Wataalamu (Staff)" icon={Users} />
          <SidebarItem id="clients" label="Wateja (Clients)" icon={UserPlus} />
          <SidebarItem id="analytics" label="Takwimu (Insights)" icon={BarChart3} />
          <SidebarItem id="settings" label="Mipangilio (Settings)" icon={Settings} />
        </nav>

        <div className="pt-4 border-t border-white/5 space-y-2">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-neutral-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative pb-24 md:pb-8">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#060608]/95 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-neutral-800 rounded-xl transition-colors md:flex hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3 md:hidden">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
                 <Scissors size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-black uppercase italic tracking-tighter">Salon</h1>
            </div>
            <h2 className="text-xl font-bold capitalize hidden md:block">
              {activeTab === 'overview' ? 'Welcome Back!' : activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-2xl border border-white/5">
              <Search className="text-neutral-500" size={18} />
              <input 
                placeholder="Find customer or stylist..." 
                className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-neutral-600"
              />
            </div>
            
            <button className="relative p-2 hover:bg-neutral-800 rounded-xl transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-600 rounded-full border-2 border-[#060608]" />
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold truncate max-w-[120px]">{vendorProfile?.businessName}</p>
                <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">Premium Vendor</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/5 flex items-center justify-center overflow-hidden">
                {vendorProfile?.logoUrl ? (
                  <img 
                    src={vendorProfile.logoUrl} 
                    alt="Logo" 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${vendorProfile?.businessName || 'vendor'}`;
                    }}
                  />
                ) : (
                  <Store size={20} className="text-neutral-500" />
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-8">
          {activeTab === 'overview' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: 'Mapato (Total Revenue)', value: `TZS ${stats.revenue.toLocaleString()}`, icon: DollarSign, trend: '+12.5%', color: 'border-orange-500/20' },
                  { label: 'Miadi Leo (Today)', value: stats.todayApts, icon: Calendar, trend: '+4', color: 'border-blue-500/20' },
                  { label: 'Maombi Mpya (Pending)', value: stats.pendingApts, icon: Clock, trend: '-2', color: 'border-yellow-500/20' },
                  { label: 'Wataalamu (Active Staff)', value: stats.activeStaff, icon: UserCheck, trend: 'Full Team', color: 'border-emerald-500/20' },
                ].map((stat, i) => (
                  <Card key={i} className={`bg-neutral-900/50 backdrop-blur-xl border-white/5 ${stat.color} rounded-[32px] overflow-hidden group`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <stat.icon className="text-orange-500" size={24} />
                        </div>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 rounded-full">
                          {stat.trend}
                        </Badge>
                      </div>
                      <p className="text-neutral-400 text-sm font-medium mb-1">{stat.label}</p>
                      <h3 className="text-2xl font-black">{stat.value}</h3>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Main Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Bookings Table */}
                <Card className="lg:col-span-2 bg-neutral-900/50 backdrop-blur-xl border-white/5 rounded-[40px] overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
                    <div>
                      <CardTitle className="text-xl font-black">Miadi ya Hivi Karibuni</CardTitle>
                      <CardDescription className="text-neutral-500">Upcoming bookings and their status</CardDescription>
                    </div>
                    <Button variant="outline" className="rounded-2xl border-white/10 hover:bg-neutral-800">
                      Tazama Zote
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-neutral-500 text-xs uppercase tracking-widest border-b border-white/5">
                            <th className="px-6 py-4 font-black">Mteja (Client)</th>
                            <th className="px-6 py-4 font-black">Huduma (Service)</th>
                            <th className="px-6 py-4 font-black">Muda (Time)</th>
                            <th className="px-6 py-4 font-black">Mtaalamu (Staff)</th>
                            <th className="px-6 py-4 font-black">Hali (Status)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {appointments.slice(0, 6).map((apt, i) => (
                            <tr key={`apt-row-${apt.id || i}`} className="group hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center text-orange-500 font-bold text-xs">
                                    {apt.customerName?.charAt(0) || 'C'}
                                  </div>
                                  <span className="font-bold text-sm">{apt.customerName || 'Anonymous'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-neutral-400 text-sm">{apt.items?.[0]?.name || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-neutral-400 text-sm">
                                  <Clock3 size={14} />
                                  {apt.createdAt ? format(getSafeDate(apt.createdAt), 'HH:mm') : 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className="rounded-lg border-white/5 text-neutral-500 text-[10px]">
                                  {apt.riderId ? 'Assigned' : 'Unassigned'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <Badge className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                                  apt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' :
                                  apt.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                  'bg-red-500/20 text-red-500'
                                }`}>
                                  {apt.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                          {appointments.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                <Calendar size={40} className="mx-auto mb-4 opacity-20" />
                                <p>No appointments scheduled yet</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Right Column: Stylists & Insights */}
                <div className="space-y-8">
                   <Card className="bg-neutral-900/50 backdrop-blur-xl border-white/5 rounded-[40px] p-6">
                    <CardTitle className="text-lg font-black mb-6">Top Stylists</CardTitle>
                    <div className="space-y-4">
                      {staff.slice(0, 4).map((s, i) => (
                        <div key={`top-stylist-${s.id || i}`} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center overflow-hidden border border-white/5">
                              {s.photoUrl ? (
                                <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                <UserCheck className="text-orange-500" size={20} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{s.name}</p>
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{s.role || 'Junior'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {s.rating > 0 && (
                              <div className="flex items-center gap-1">
                                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                <span className="text-sm font-bold">{(s.rating || 0).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full mt-6 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10" variant="outline">
                      Manage Team
                    </Button>
                  </Card>

                   <Card className="bg-[#ea580c] rounded-[40px] p-8 text-white relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                    <div className="relative z-10">
                      <Zap className="mb-4" size={32} />
                      <h3 className="text-xl font-black mb-2">Weekend Special?</h3>
                      <p className="text-orange-100 text-sm mb-6 leading-relaxed">Boost your bookings by creating a flash promotion for this Saturday.</p>
                      <Button className="w-full bg-white text-orange-600 font-black rounded-2xl hover:bg-orange-50 py-6">
                        Create Offer
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="grid grid-cols-1 md:grid-cols-2 gap-8"
             >
               <Card className="bg-neutral-900/50 border-white/5 rounded-[40px] p-8">
                 <CardTitle className="mb-8">Revenue Trends</CardTitle>
                 <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={[
                        { name: 'Mon', revenue: 4000 },
                        { name: 'Tue', revenue: 3000 },
                        { name: 'Wed', revenue: 5000 },
                        { name: 'Thu', revenue: 2780 },
                        { name: 'Fri', revenue: 4890 },
                        { name: 'Sat', revenue: 7390 },
                        { name: 'Sun', revenue: 6490 },
                     ]}>
                       <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <XAxis dataKey="name" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                       <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                       <Tooltip 
                         contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                         itemStyle={{ color: '#ea580c' }}
                       />
                       <Area type="monotone" dataKey="revenue" stroke="#ea580c" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               </Card>

               <Card className="bg-neutral-900/50 border-white/5 rounded-[40px] p-8">
                 <CardTitle className="mb-8">Service Distribution</CardTitle>
                 <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={[
                           { name: 'Hair Cut', value: 400 },
                           { name: 'Bridal', value: 300 },
                           { name: 'SPA', value: 300 },
                           { name: 'Treatments', value: 200 },
                         ]}
                         cx="50%"
                         cy="50%"
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={5}
                         dataKey="value"
                       >
                         {COLORS.map((color, index) => (
                           <Cell key={`cell-${index}`} fill={color} />
                         ))}
                       </Pie>
                       <Tooltip />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
               </Card>
             </motion.div>
          )}

          {activeTab === 'services' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black italic">Service Menu</h3>
                <Button className="bg-[#ea580c] hover:bg-orange-700 rounded-2xl gap-2 font-bold h-12 px-6">
                  <Plus size={20} /> Add Service
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service, i) => (
                  <Card key={`salon-service-${service.id || i}`} className="bg-neutral-900/50 border-white/5 rounded-[32px] overflow-hidden group">
                    <div className="aspect-video relative overflow-hidden">
                      {service.imageUrl ? (
                        <img 
                          src={service.imageUrl} 
                          alt={service.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                          <Scissors className="text-neutral-600" size={40} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 animate-in fade-in zoom-in duration-300">
                        <Badge className="bg-black/60 backdrop-blur-md text-white border-white/10 rounded-xl px-3 py-1 font-black">
                          TZS {service.price.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <h4 className="text-lg font-black mb-2">{service.name}</h4>
                      <p className="text-neutral-500 text-sm line-clamp-2 mb-4">{service.description}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-orange-500" />
                          <span className="text-xs font-medium text-neutral-400">45 - 60 min</span>
                        </div>
                        <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white rounded-xl">
                          <MoreVertical size={20} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {services.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-neutral-900/30 rounded-[40px] border-2 border-dashed border-white/5">
                    <Scissors size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-neutral-500 font-bold">Your service menu is empty</p>
                    <p className="text-neutral-600 text-sm">Start adding services to get bookings</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'staff' && (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="space-y-6"
             >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black italic">Team & Availability</h3>
                  <Button className="bg-[#ea580c] hover:bg-orange-700 rounded-2xl gap-2 font-bold h-12 px-6">
                    <UserPlus size={20} /> New Stylist
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {staff.map((s, i) => (
                    <Card key={`staff-card-${s.id || i}`} className="bg-neutral-900/50 border-white/5 rounded-[32px] p-6 flex flex-col items-center text-center group relative">
                      <div className="absolute top-4 right-4">
                        <Badge className={`${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'} border-none text-[8px] font-black uppercase tracking-widest`}>
                          {s.status || 'Offline'}
                        </Badge>
                      </div>
                      <div className="w-24 h-24 rounded-[32px] bg-neutral-800 p-1 mb-6 relative group-hover:scale-105 transition-transform">
                        <div className="w-full h-full rounded-[28px] overflow-hidden">
                           {s.photoUrl ? (
                            <img 
                              src={s.photoUrl} 
                              alt={s.name} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name || 'stylist'}`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-neutral-700 flex items-center justify-center">
                              <UserCheck size={32} className="text-neutral-500" />
                            </div>
                          )}
                        </div>
                      </div>
                      <h4 className="text-lg font-black mb-1">{s.name}</h4>
                      <p className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">{s.role || 'Junior Stylist'}</p>
                      
                      <div className="w-full grid grid-cols-2 gap-2 mt-auto">
                        <Button variant="outline" size="sm" className="rounded-xl border-white/10 text-xs font-bold bg-neutral-800">
                          Profile
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl border-white/10 text-xs font-bold bg-neutral-800">
                          Schedule
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
             </motion.div>
          )}
        </div>
      </main>

      {/* Mobile More Menu Drawer - Improved as Bottom Sheet for better mobile UX */}
      <AnimatePresence>
        {isMobileMoreOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsMobileMoreOpen(false)}
               className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div 
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="md:hidden fixed bottom-0 left-0 right-0 max-h-[80vh] bg-[#0a0a0f] z-[201] shadow-2xl p-8 overflow-y-auto flex flex-col rounded-t-[3rem] border-t border-white/10"
            >
               <div className="w-12 h-1.5 bg-neutral-800 rounded-full mx-auto mb-8 flex-shrink-0" />
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-orange-500">Zaidi (More)</h2>
                  <button onClick={() => setIsMobileMoreOpen(false)} className="p-2 bg-neutral-900 rounded-xl">
                     <XCircle className="w-6 h-6 text-neutral-500" />
                  </button>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  {salonTabs.slice(4).map((tab) => (
                     <button
                        key={tab.id}
                        onClick={() => {
                           setActiveTab(tab.id as TabType);
                           setIsMobileMoreOpen(false);
                        }}
                        className={`flex flex-col items-center gap-3 p-6 rounded-3xl transition-all ${
                          activeTab === tab.id 
                            ? 'bg-orange-600 text-white' 
                            : 'bg-neutral-900/50 text-neutral-400 border border-white/5'
                        }`}
                     >
                        <tab.icon className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                     </button>
                  ))}
                  <button 
                    onClick={handleSignOut}
                    className="flex flex-col items-center gap-3 p-6 rounded-3xl text-red-500 bg-red-500/10 border border-red-500/20 col-span-2 mt-4"
                  >
                     <LogOut className="w-6 h-6" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
                  </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modern Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] h-20 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/5 transition-colors duration-300 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="h-full px-2 flex justify-around items-center max-w-md mx-auto"
        >
          {salonTabs.slice(0, 3).map((tab) => (
            <button
              key={`mobile-nav-${tab.id}`}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-all duration-300 ${
                activeTab === tab.id ? 'text-orange-600' : 'text-neutral-500'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-orange-600/10' : ''}`}>
                <tab.icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>
                {tab.label}
              </span>
            </button>
          ))}
          <button
            onClick={() => {
                setActiveTab('staff');
                setIsMobileMoreOpen(false);
            }}
             className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-all duration-300 ${
                activeTab === 'staff' ? 'text-orange-600' : 'text-neutral-500'
              }`}
          >
             <div className={`p-2 rounded-2xl transition-all ${activeTab === 'staff' ? 'bg-orange-600/10' : ''}`}>
              <Users className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'staff' ? 'opacity-100' : 'opacity-60'}`}>Team</span>
          </button>
          <button
            onClick={() => setIsMobileMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1.5 flex-1 text-neutral-400"
          >
            <div className="p-2">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">More</span>
          </button>
        </motion.div>
      </nav>
    </div>
  );
}
