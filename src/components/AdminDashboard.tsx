import React, { useEffect, useState, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, addDoc, setDoc, getDoc, serverTimestamp, where } from 'firebase/firestore';
import { VendorProfile, Order, Product } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Check, X, ShieldAlert, Store, UserCheck, Image as ImageIcon, 
  Bell, Plus, Trash2, Send, LayoutDashboard, Megaphone,
  Users, ShoppingBag, DollarSign, MessageCircle, AlertTriangle,
  ExternalLink, Search, Ban, History, BarChart3, Settings, Info, CreditCard,
  Package, Undo2, Bike, Trophy, Wallet, MessageSquare, Globe, Clock, Coins, Loader2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';

// Fix Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DRIVER_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const USER_ICON = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface Banner {
  id?: string;
  title: string;
  sub: string;
  img: string;
  active: boolean;
}

interface UserRecord {
  id: string;
  displayName: string;
  email: string;
  role: string;
  phone?: string;
  status: 'active' | 'blocked';
  approvalStatus?: 'pending' | 'approved' | 'suspended';
  driverType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  licensePlate?: string;
  balance?: number;
  totalEarnings?: number;
  currentPosition?: { lat: number; lng: number };
  heading?: number;
  speed?: number;
  battery?: number;
  networkStatus?: 'online' | 'offline';
  createdAt: any;
}

interface PayoutRequest {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  recipientId: string;
  recipientRole: 'rider' | 'vendor';
  method: string;
  status: 'pending' | 'processed' | 'rejected';
  details?: any;
  createdAt: any;
}

interface ProductWithVendor extends Product {
  vendorName?: string;
}

type AdminTab = 'overview' | 'vendors' | 'drivers' | 'products' | 'users' | 'orders' | 'banners' | 'notifications' | 'coupons' | 'settings' | 'live_map' | 'payouts' | 'analytics';

interface Coupon {
  id?: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  active: boolean;
  vendorId?: string | null;
  productId?: string | null;
  validUntil?: any;
  createdBy: string;
  createdAt?: any;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [activeSettingsTab, setActiveSettingsTab] = useState('business_info');
  const [businessConfig, setBusinessConfig] = useState({
    name: 'M-Duka Platform',
    email: 'admin@mduka.com',
    phone: '+255 700 000 000',
    country: 'Tanzania',
    address: 'Kariakoo, Dar es Salaam',
    maintenanceMode: false,
    currencySymbol: 'Tsh',
    timeFormat: '24h',
    // Vendor Settings
    vendorCancelOrder: true,
    vendorSelfRegistration: true,
    vendorProductGallery: true,
    vendorAccessAllProducts: true,
    vendorCanReplyReview: true,
    needApprovalForNewProduct: true,
    needApprovalForUpdateProduct: true,
    cashInHandOverflow: true,
    maxCashInHand: 20000,
    minPayAmount: 50,
    // Order Settings
    homeDelivery: true,
    takeaway: true,
    scheduledOrder: true,
    scheduledTimeInterval: 30,
    freeDelivery: true,
    freeDeliveryOver: 5000,
    extraPackagingCharge: false,
    orderByPrescription: true,
    deliveryVerifyStatus: false,
    whoConfirmOrder: 'store',
    refundRequestMode: true
  });
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allProducts, setAllProducts] = useState<ProductWithVendor[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [driverLocations, setDriverLocations] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    active: true,
    vendorId: null,
    productId: null
  });
  const [newBanner, setNewBanner] = useState<Banner>({ title: '', sub: '', img: '', active: true });
  const [isSeeding, setIsSeeding] = useState(false);

  const seedDemoStores = async () => {
    setIsSeeding(true);
    try {
      const demoVendors = [
        {
          businessName: "Lulu Grocery & Store",
          category: "grocery",
          description: "Fresh vegetables and daily essentials.",
          location: { lat: -6.7924, lng: 39.2083 },
          status: "active",
          rating: 4.9,
          logoUrl: "https://picsum.photos/seed/grocery/200",
          bannerUrl: "https://picsum.photos/seed/store/800/400",
          address: "Mlimani City Area, DSM",
          deliveryRadius: 10,
          tin: "123-456-789",
          ownerUid: "admin",
          operatingHours: "08:00 - 22:00",
          createdAt: serverTimestamp()
        },
        {
          businessName: "Papo Hapo Pizza",
          category: "food",
          description: "Best Italian pizza in town.",
          location: { lat: -6.8147, lng: 39.2801 },
          status: "active",
          rating: 4.7,
          logoUrl: "https://picsum.photos/seed/pizza/200",
          bannerUrl: "https://picsum.photos/seed/restaurant/800/400",
          address: "Ohio Street, DSM",
          deliveryRadius: 8,
          tin: "987-654-321",
          ownerUid: "admin",
          operatingHours: "10:00 - 23:00",
          createdAt: serverTimestamp()
        },
        {
          businessName: "Afya Pharmacy",
          category: "pharmacy",
          description: "Your health, our priority.",
          location: { lat: -6.7725, lng: 39.2312 },
          status: "active",
          rating: 4.8,
          logoUrl: "https://picsum.photos/seed/health/200",
          bannerUrl: "https://picsum.photos/seed/pharmacy/800/400",
          address: "Mikocheni B, DSM",
          deliveryRadius: 5,
          tin: "456-789-123",
          ownerUid: "admin",
          operatingHours: "24 Hours",
          createdAt: serverTimestamp()
        }
      ];

      for (const v of demoVendors) {
        await addDoc(collection(db, 'vendors'), v);
      }
      toast.success("3 Demo Stores created! Check the Map now.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to seed stores.");
    } finally {
      setIsSeeding(false);
    }
  };

  // Notification State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifImage, setNotifImage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | string>('all');
  const [isSending, setIsSending] = useState(false);

  // Stats / Finances (Mongike 3.5% fee estimated)
  const stats = useMemo(() => {
    const totalRev = allOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
    const platformFee = totalRev * 0.10; // Assuming 10% platform commission
    const mongikeFees = totalRev * 0.035; // Assuming 3.5% PG fee
    return {
      totalRev,
      platformFee,
      mongikeFees,
      netProfit: platformFee - mongikeFees,
      totalOrders: allOrders.length,
      activeVendors: vendors.filter(v => v.status === 'active').length,
      totalUsers: allUsers.length
    };
  }, [allOrders, vendors, allUsers]);

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'config', 'business'), { ...businessConfig, updatedAt: serverTimestamp() });
      toast.success('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/business');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'business'));
        if (configSnap.exists()) {
          setBusinessConfig(prev => ({ ...prev, ...configSnap.data() }));
        }

        const vendorsSnap = await getDocs(collection(db, 'vendors'));
        setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));

        const usersSnap = await getDocs(collection(db, 'users'));
        setAllUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRecord)));

        const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
        setAllOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));

        const bannersSnap = await getDocs(collection(db, 'banners'));
        setBanners(bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));

        const couponsSnap = await getDocs(collection(db, 'coupons'));
        setCoupons(couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));

        const payoutsSnap = await getDocs(query(collection(db, 'payouts'), orderBy('createdAt', 'desc')));
        setPayouts(payoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

        const activeRidesSnap = await getDocs(query(collection(db, 'rides'), where('status', 'in', ['accepted', 'arrived', 'started'])));
        setActiveRides(activeRidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const driverLocsSnap = await getDocs(collection(db, 'drivers'));
        setDriverLocations(driverLocsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const productsSnap = await getDocs(collection(db, 'products'));
        setAllProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductWithVendor)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'admin_overview');
      }
    };

    fetchData();

    const errorHandler = (path: string) => (error: any) => handleFirestoreError(error, OperationType.GET, path);

    const unsubscribes = [
      onSnapshot(doc(db, 'config', 'business'), (snap) => {
        if (snap.exists()) setBusinessConfig(prev => ({ ...prev, ...snap.data() }));
      }),
      onSnapshot(collection(db, 'vendors'), () => fetchData(), errorHandler('vendors')),
      onSnapshot(collection(db, 'users'), () => fetchData(), errorHandler('users')),
      onSnapshot(collection(db, 'orders'), () => fetchData(), errorHandler('orders')),
      onSnapshot(collection(db, 'banners'), () => fetchData(), errorHandler('banners')),
      onSnapshot(collection(db, 'coupons'), () => fetchData(), errorHandler('coupons')),
      onSnapshot(collection(db, 'payouts'), (snap) => setPayouts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))), errorHandler('payouts')),
      onSnapshot(query(collection(db, 'rides'), where('status', 'in', ['accepted', 'arrived', 'started'])), (snap) => setActiveRides(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), errorHandler('rides')),
      onSnapshot(collection(db, 'drivers'), (snap) => setDriverLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), errorHandler('drivers')),
      onSnapshot(collection(db, 'products'), () => fetchData(), errorHandler('products')),
    ];

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const handleApproveDriver = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { approvalStatus: 'approved' });
      toast.success('Driver approved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleRejectDriver = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { approvalStatus: 'suspended' });
      toast.error('Driver status updated to suspended.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'vendors', id), { status: 'active' });
      toast.success('Vendor approved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'vendors', id), { status: 'suspended' });
      toast.error('Vendor status updated to suspended.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleBlockUser = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    try {
      await updateDoc(doc(db, 'users', id), { status: newStatus });
      toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('User deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'banners'), { ...newBanner, createdAt: serverTimestamp() });
      setIsAddBannerOpen(false);
      setNewBanner({ title: '', sub: '', img: '', active: true });
      toast.success('Banner added successfully!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'coupons'), { ...newCoupon, createdBy: 'admin', createdAt: serverTimestamp() });
      setIsAddCouponOpen(false);
      setNewCoupon({ code: '', discountType: 'percentage', discountValue: 0, active: true, vendorId: null, productId: null });
      toast.success('Coupon added successfully!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifBody) return;
    setIsSending(true);
    try {
      let targetUsers = [];
      if (notifTarget === 'all') {
        const usersSnap = await getDocs(collection(db, 'users'));
        targetUsers = usersSnap.docs.map(d => d.id);
      } else {
        targetUsers = [notifTarget];
      }
      
      const batchPromises = targetUsers.map(uid => 
        addDoc(collection(db, 'notifications'), {
          title: notifTitle,
          body: notifBody,
          imageUrl: notifImage || null,
          userId: uid,
          type: 'system',
          isRead: false,
          createdAt: serverTimestamp()
        })
      );

      await Promise.all(batchPromises);

      setNotifTitle('');
      setNotifBody('');
      setNotifImage('');
      toast.success(`Notification sent to ${targetUsers.length} users!`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => 
    v.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-red-600 text-white rounded-[2rem] shadow-lg shadow-red-200">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase italic">{t('admin_control_panel')}</h1>
            <p className="text-neutral-500 font-medium">Platform-wide management & financial oversight.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="outline" className="rounded-2xl border-neutral-200 font-bold">Switch Profile</Button>
          </Link>
          <div className="bg-neutral-900 dark:bg-neutral-800 border border-neutral-800 dark:border-neutral-700 text-white px-4 py-2 rounded-2xl flex items-center gap-2 transition-colors">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">Admin Live</span>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-[2rem] w-fit transition-colors">
        {[
          { id: 'overview', label: t('admin_overview'), icon: BarChart3 },
          { id: 'vendors', label: t('admin_businesses'), icon: Store },
          { id: 'drivers', label: 'Drivers', icon: Bike },
          { id: 'products', label: t('admin_products'), icon: ShoppingBag },
          { id: 'users', label: t('admin_communities'), icon: Users },
          { id: 'orders', label: t('admin_sales_feed'), icon: ShoppingBag },
          { id: 'banners', label: t('admin_marketing'), icon: Megaphone },
          { id: 'notifications', label: t('admin_broadcast'), icon: Bell },
          { id: 'live_map', label: 'Monitor', icon: Globe },
          { id: 'payouts', label: 'Payouts', icon: Wallet },
          { id: 'analytics', label: 'Insights', icon: BarChart3 },
          { id: 'settings', label: t('admin_settings'), icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-tight transition-all ${
              activeTab === tab.id 
                ? 'bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white shadow-xl shadow-neutral-200 dark:shadow-neutral-950' 
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-none text-neutral-900 dark:text-white rounded-[2.5rem] shadow-2xl overflow-hidden relative group transition-colors">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <DollarSign className="w-24 h-24 text-neutral-400 dark:text-white" />
              </div>
              <CardHeader>
                <CardTitle className="text-neutral-500 dark:text-neutral-400 text-xs font-black uppercase tracking-[0.2rem] transition-colors">{t('admin_gross_volume')}</CardTitle>
                <div className="text-3xl font-black mt-2">TZS {stats.totalRev.toLocaleString()}</div>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-400 dark:text-neutral-500 text-[10px] font-bold uppercase transition-colors">Total processed via Mongike</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-teal-50 dark:bg-teal-950/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-24 h-24 text-teal-600" />
              </div>
              <CardHeader>
                <CardTitle className="text-teal-600/60 text-xs font-black uppercase tracking-[0.2rem]">{t('admin_commission')}</CardTitle>
                <div className="text-3xl font-black text-teal-900 dark:text-teal-400 mt-2">TZS {stats.platformFee.toLocaleString()}</div>
              </CardHeader>
              <CardContent>
                <p className="text-teal-600/50 text-[10px] font-bold uppercase">Target revenue (10%)</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-red-50 dark:bg-red-950/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-24 h-24 text-red-600" />
              </div>
              <CardHeader>
                <CardTitle className="text-red-400 text-xs font-black uppercase tracking-[0.2rem]">{t('admin_fees')}</CardTitle>
                <div className="text-3xl font-black text-red-900 dark:text-red-400 mt-2">- TZS {stats.mongikeFees.toLocaleString()}</div>
              </CardHeader>
              <CardContent>
                <p className="text-red-400 text-[10px] font-bold uppercase">Mongike Gateway Costs (3.5%)</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-600 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-24 h-24" />
              </div>
              <CardHeader>
                <CardTitle className="text-white/60 text-xs font-black uppercase tracking-[0.2rem]">{t('admin_total_sales')}</CardTitle>
                <div className="text-3xl font-black mt-2">{stats.totalOrders}</div>
              </CardHeader>
              <CardContent>
                <p className="text-white/40 text-[10px] font-bold uppercase">Successful conversions</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'products' && (
          <motion.div key="products" className="space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">{t('admin_inventory_oversight')}</h3>
                <div className="relative w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                   <Input 
                     placeholder={t('admin_search_placeholder')} 
                     className="pl-10 h-10 rounded-xl"
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                   />
                </div>
             </div>
             <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white dark:bg-neutral-900">
                <div className="overflow-x-auto">
                   <table className="w-full">
                      <thead className="bg-neutral-50 dark:bg-neutral-800">
                        <tr className="text-left">
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('admin_products')}</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('admin_merchant')}</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('total')} (Gross)</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Net (Est)</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                         {allProducts.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((product, idx) => {
                            const currentVendor = vendors.find(v => v.id === product.vendorId);
                           const mongikeFee = product.price * 0.035;
                           const platformCommission = product.price * 0.10;
                           const netToVendor = product.price - platformCommission;
                           
                           return (
                             <tr key={product.id || `prod-${idx}`}>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-4">
                                      <img src={product.imageUrl || "https://picsum.photos/seed/food/100"} className="w-12 h-12 rounded-xl object-cover" />
                                      <span className="font-bold">{product.name}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-2">
                                      {currentVendor?.logoUrl && <img src={currentVendor.logoUrl} className="w-6 h-6 rounded-lg object-cover" />}
                                      <span className="text-xs font-bold text-neutral-600">
                                         {currentVendor?.businessName || 'Unknown Vendor'}
                                      </span>
                                   </div>
                                </td>
                                <td className="px-8 py-6 font-bold">TZS {product.price.toLocaleString()}</td>
                                <td className="px-8 py-6">
                                   <div className="space-y-1 text-[10px] font-bold">
                                      <p className="text-neutral-400">Gateway Fee: -{mongikeFee.toLocaleString()}</p>
                                      <p className="text-orange-600 italic tracking-tighter uppercase">Platform Net (10%): -{platformCommission.toLocaleString()}</p>
                                      <p className="text-teal-600 font-black text-xs">Vendor Gets: TZS {netToVendor.toLocaleString()}</p>
                                   </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                   <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="outline"
                                        size="sm"
                                        className={`rounded-xl font-bold text-[10px] ${product.status === 'out_of_stock' ? 'border-red-200 text-red-500' : 'border-green-200 text-green-500'}`}
                                        onClick={async () => {
                                          const newStatus = product.status === 'active' ? 'out_of_stock' : 'active';
                                          await updateDoc(doc(db, 'products', product.id!), { status: newStatus });
                                        }}
                                      >
                                        {product.status === 'active' ? 'Deactivate' : 'Activate'}
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => deleteDoc(doc(db, 'products', product.id!))}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                      >
                                         <Trash2 className="w-5 h-5" />
                                      </Button>
                                   </div>
                                </td>
                             </tr>
                           );
                         })}
                      </tbody>
                   </table>
                </div>
             </Card>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div key="users" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input 
                  placeholder={t('admin_members_search_placeholder')} 
                  className="pl-12 h-14 rounded-2xl border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white transition-colors font-bold"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-neutral-500 uppercase">
                <span>{t('admin_total_members')}: <span className="text-neutral-900">{allUsers.length}</span></span>
              </div>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white dark:bg-neutral-900 transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 transition-colors">
                    <tr className="text-left">
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400">{t('admin_identity')}</th>
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400">{t('admin_role')}</th>
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400">{t('admin_status')}</th>
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-neutral-400 text-right">{t('admin_interactions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 transition-colors">
                    {filteredUsers.map((user, idx) => (
                        <tr key={user.id || idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center font-black text-orange-600">
                              {user.displayName[0]}
                            </div>
                            <div>
                              <p className="font-black text-neutral-900 dark:text-white">{user.displayName}</p>
                              <p className="text-xs text-neutral-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <Badge className="bg-neutral-100 text-neutral-600 border-none font-bold uppercase text-[10px] tracking-tighter">
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-8 py-6">
                          <Badge className={`${user.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} border-none font-black uppercase text-[10px]`}>
                            {user.status || 'Active'}
                          </Badge>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                             {user.phone && (
                               <a href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                                  <Button size="icon" variant="ghost" className="rounded-xl text-green-600 hover:bg-green-50">
                                    <MessageCircle className="w-5 h-5" />
                                  </Button>
                               </a>
                             )}
                             <Button 
                               onClick={() => handleBlockUser(user.id, user.status)}
                               size="icon" 
                               variant="ghost" 
                               className={`rounded-xl ${user.status === 'blocked' ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                             >
                                <Ban className="w-5 h-5" />
                             </Button>
                             <Button 
                               onClick={() => handleDeleteUser(user.id)}
                               size="icon" 
                               variant="ghost" 
                               className="rounded-xl text-neutral-300 hover:text-red-600 hover:bg-red-50"
                             >
                                <Trash2 className="w-5 h-5" />
                             </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" className="space-y-8 pb-10">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-8 rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-neutral-900">
                   <h3 className="text-xl font-black uppercase mb-8">Growth Revenue</h3>
                   <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={allOrders.filter(o => o.paymentStatus === 'paid').slice(-20).map(o => ({
                            name: new Date(o.createdAt?.seconds * 1000).toLocaleDateString(),
                            amount: o.totalAmount
                         }))}>
                            <defs>
                               <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <XAxis dataKey="name" hide />
                            <YAxis hide />
                            <Tooltip />
                            <Area type="monotone" dataKey="amount" stroke="#ea580c" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={4} />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </Card>

                <Card className="p-8 rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-neutral-900">
                   <h3 className="text-xl font-black uppercase mb-8">Order Volume</h3>
                   <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={vendors.slice(0, 5).map(v => ({
                            name: v.businessName,
                            orders: allOrders.filter(o => o.vendorId === v.id).length
                         }))}>
                            <XAxis dataKey="name" hide />
                            <YAxis hide />
                            <Tooltip />
                            <Bar dataKey="orders" fill="#0d9488" radius={[10, 10, 10, 10]} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </Card>
             </div>
          </motion.div>
        )}

        {activeTab === 'live_map' && (
          <motion.div key="live_map" className="h-[70vh] rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white relative">
             <MapContainer 
               center={[-6.7924, 39.2083]} 
               zoom={12} 
               className="w-full h-full z-0"
               scrollWheelZoom
             >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                
                {/* Active Drivers */}
                {driverLocations.map((driver) => (
                  driver.currentPosition && (
                    <Marker 
                      key={driver.id} 
                      position={[driver.currentPosition.lat, driver.currentPosition.lng]} 
                      icon={DRIVER_ICON}
                    >
                       <Popup className="rounded-2xl overflow-hidden">
                          <div className="p-2 space-y-2">
                             <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                                   {driver.displayName?.[0]}
                                </div>
                                <div>
                                   <p className="font-black text-xs uppercase leading-none">{driver.displayName}</p>
                                   <p className="text-[10px] text-neutral-400 font-bold">{driver.licensePlate || 'No Plate'}</p>
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
                                <div className="p-2 bg-neutral-50 rounded-xl">
                                   <p className="text-[8px] font-black uppercase text-neutral-400">Battery</p>
                                   <p className="font-black text-xs">{driver.battery || 0}%</p>
                                </div>
                                <div className="p-2 bg-neutral-50 rounded-xl">
                                   <p className="text-[8px] font-black uppercase text-neutral-400">Speed</p>
                                   <p className="font-black text-xs">{Math.round(driver.speed || 0)} km/h</p>
                                </div>
                             </div>
                             {driver.networkStatus === 'online' ? (
                               <Badge className="w-full justify-center bg-green-100 text-green-600 font-black uppercase text-[8px] py-1">Online</Badge>
                             ) : (
                               <Badge className="w-full justify-center bg-red-100 text-red-600 font-black uppercase text-[8px] py-1">Offline</Badge>
                             )}
                          </div>
                       </Popup>
                    </Marker>
                  )
                ))}

                {/* Active Rides/Users */}
                {activeRides.map((ride) => (
                  ride.pickup && (
                    <Marker 
                      key={ride.id} 
                      position={[ride.pickup.lat, ride.pickup.lng]} 
                      icon={USER_ICON}
                    >
                       <Popup>
                          <div className="p-1">
                             <p className="font-black text-xs uppercase tracking-tight">Active Request</p>
                             <p className="text-[10px] text-orange-600 font-black italic">{ride.status.toUpperCase()}</p>
                             <p className="text-[9px] mt-2 opacity-60">To: {ride.destinationAddress?.substring(0, 30)}...</p>
                          </div>
                       </Popup>
                    </Marker>
                  )
                ))}

                <MapBoundsUpdater drivers={driverLocations} rides={activeRides} />
             </MapContainer>
             
             {/* Floating Controls */}
             <div className="absolute top-6 right-6 z-[1000] space-y-2">
                <Card className="p-4 bg-white/90 backdrop-blur shadow-2xl rounded-[2rem] border-none flex items-center gap-4">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-neutral-400">Live Traffic</span>
                      <span className="text-xl font-black uppercase italic leading-none">{driverLocations.filter(d => d.networkStatus === 'online').length} Nodes</span>
                   </div>
                   <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center text-white">
                      <Globe className="animate-spin-slow" />
                   </div>
                </Card>
             </div>
          </motion.div>
        )}

        {activeTab === 'payouts' && (
           <motion.div key="payouts" className="space-y-8">
              <div className="flex justify-between items-center">
                 <h3 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white transition-colors">Financial Treasury</h3>
                 <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl border-neutral-200 font-bold uppercase text-xs">Export CSV</Button>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl transition-colors bg-white dark:bg-neutral-900 overflow-hidden">
                    <div className="p-8">
                       <h4 className="text-xs font-black uppercase tracking-[0.2rem] text-neutral-400 mb-6 underline decoration-orange-600 decoration-4 underline-offset-8">Pending Withdrawals</h4>
                       <div className="space-y-4">
                          {payouts.filter(p => p.status === 'pending').map((p) => {
                             const recipientUser = allUsers.find(u => u.id === p.recipientId);
                             const recipientVendor = vendors.find(v => v.id === p.recipientId);
                             const name = recipientUser?.displayName || recipientVendor?.businessName || 'Unknown';
                             
                             return (
                               <div key={p.id} className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700 flex items-center justify-between group hover:shadow-xl transition-all">
                                  <div className="flex items-center gap-4">
                                     <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center font-black text-orange-600">
                                        <Wallet className="w-6 h-6" />
                                     </div>
                                     <div>
                                        <p className="font-black text-lg text-neutral-900 dark:text-white uppercase italic leading-none">{name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                           <Badge className="bg-neutral-200 text-neutral-600 font-bold text-[8px] uppercase">{p.method}</Badge>
                                           <p className="text-[10px] text-neutral-400 font-bold uppercase">{p.recipientRole}</p>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-6">
                                     <div className="text-right">
                                        <p className="text-xl font-black text-neutral-900 dark:text-white">TZS {p.amount.toLocaleString()}</p>
                                        <p className="text-[10px] font-black text-orange-600 italic uppercase">Fee: -{p.fee.toLocaleString()}</p>
                                     </div>
                                     <div className="flex gap-2">
                                        <Button 
                                          size="sm" 
                                          className="bg-green-600 hover:bg-green-700 rounded-xl font-black uppercase text-[10px]"
                                          onClick={async () => {
                                             await updateDoc(doc(db, 'payouts', p.id), { status: 'processed', processedAt: serverTimestamp() });
                                             toast.success('Payout processed successfully!');
                                          }}
                                        >
                                           Complete
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="text-red-500 hover:bg-red-50 rounded-xl font-black uppercase text-[10px]"
                                          onClick={async () => {
                                             await updateDoc(doc(db, 'payouts', p.id), { status: 'rejected', processedAt: serverTimestamp() });
                                             toast.error('Payout application rejected.');
                                          }}
                                        >
                                           Reject
                                        </Button>
                                     </div>
                                  </div>
                               </div>
                             );
                          })}
                          {payouts.filter(p => p.status === 'pending').length === 0 && (
                             <p className="text-center py-10 text-neutral-400 font-bold italic">No pending payouts found.</p>
                          )}
                       </div>
                    </div>
                 </Card>

                 <div className="space-y-6">
                    <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-teal-600 text-white relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                          <Coins className="w-24 h-24" />
                       </div>
                       <CardHeader className="p-0">
                          <CardTitle className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">Platform Float</CardTitle>
                          <div className="text-3xl font-black tracking-tighter">TZS {(stats.totalRev * 0.065).toLocaleString()}</div>
                          <p className="opacity-60 text-[8px] font-bold mt-2 uppercase">Estimated liquid cash in hand</p>
                       </CardHeader>
                    </Card>

                    <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 transition-colors">
                       <h4 className="text-xs font-black uppercase tracking-[0.1rem] mb-6">Recent History</h4>
                       <div className="space-y-4">
                          {payouts.filter(p => p.status !== 'pending').slice(0, 5).map(p => (
                             <div key={p.id} className="flex items-center justify-between opacity-60">
                                <div>
                                   <p className="font-bold text-xs uppercase leading-none">{p.id.slice(0, 8)}</p>
                                   <p className="text-[10px] font-black text-neutral-400 mt-1 uppercase italic">{p.status}</p>
                                </div>
                                <p className="font-black text-xs">TZS {p.amount.toLocaleString()}</p>
                             </div>
                          ))}
                       </div>
                    </Card>
                 </div>
              </div>
           </motion.div>
        )}


        {activeTab === 'vendors' && (
          <motion.div key="vendors" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-50 text-orange-900 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2rem]">Onboarding Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {vendors.filter(v => v.status === 'pending').map((v, idx) => (
                      <div 
                        key={v.id || `pend-${idx}`} 
                        onClick={() => navigate(`/vendor/${v.id}`)}
                        className="flex items-center justify-between p-4 bg-white rounded-3xl shadow-sm cursor-pointer hover:bg-neutral-50 transition-colors border border-transparent hover:border-orange-100 group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center font-black group-hover:scale-110 transition-transform text-orange-600">
                               {v.businessName[0]}
                            </div>
                            <div>
                               <p className="font-bold text-sm group-hover:text-orange-600 transition-colors uppercase italic leading-none">{v.businessName}</p>
                               <p className="text-[10px] opacity-60 uppercase font-black">{v.category}</p>
                            </div>
                         </div>
                         <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <Button size="sm" onClick={() => handleApprove(v.id!)} className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-[10px] h-8">{t('admin_approve')}</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleReject(v.id!)} className="text-red-500 hover:bg-red-50 rounded-xl font-bold text-[10px] h-8">{t('admin_reject')}</Button>
                         </div>
                      </div>
                    ))}
                    {vendors.filter(v => v.status === 'pending').length === 0 && (
                      <p className="text-center py-8 text-neutral-400 font-bold italic text-sm">No pending applications</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white transition-colors">Active Network</h3>
                 <div className="grid grid-cols-1 gap-4">
                    {vendors.filter(v => v.status === 'active').map((v, idx) => (
                      <Card 
                        key={v.id || `actv-${idx}`} 
                        onClick={() => navigate(`/vendor/${v.id}`)}
                        className="rounded-[2rem] border-none shadow-lg group hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-orange-500/20 bg-white dark:bg-neutral-900 transition-colors"
                      >
                         <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <img src={v.logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${v.businessName}`} alt="" className="w-16 h-16 rounded-2xl object-cover group-hover:scale-105 transition-transform" />
                               <div>
                                  <h4 className="font-black text-lg text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase italic leading-none">{v.businessName}</h4>
                                  <p className="text-xs text-neutral-400 mt-1">{v.address}</p>
                                  <Badge className="mt-2 bg-neutral-100 text-neutral-500 border-none font-bold uppercase text-[8px]">{v.category}</Badge>
                               </div>
                            </div>
                            <div className="flex flex-col items-end gap-2" onClick={e => e.stopPropagation()}>
                               <div className="flex gap-2">
                                  {v.phoneNumber && (
                                    <a href={`https://wa.me/${v.phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                                       <Button size="icon" variant="ghost" className="rounded-xl text-green-600 hover:bg-green-50">
                                         <MessageCircle className="w-5 h-5" />
                                       </Button>
                                    </a>
                                  )}
                                  <Button variant="ghost" onClick={() => handleReject(v.id!)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl size-10">
                                     <Ban className="w-5 h-5" />
                                  </Button>
                               </div>
                            </div>
                         </CardContent>
                      </Card>
                    ))}
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'drivers' && (
          <motion.div key="drivers" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2rem]">Driver Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {allUsers.filter(u => u.role === 'rider' && u.approvalStatus === 'pending').map(rider => (
                      <div 
                        key={rider.id}
                        className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800 group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-black group-hover:scale-110 transition-transform text-blue-600">
                               {rider.displayName[0]}
                            </div>
                            <div>
                               <p className="font-bold text-sm group-hover:text-blue-600 transition-colors uppercase italic leading-none">{rider.displayName}</p>
                               <p className="text-[10px] opacity-60 uppercase font-black">{rider.driverType || 'Driver'}</p>
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApproveDriver(rider.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] h-8 uppercase">Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRejectDriver(rider.id)} className="text-red-500 hover:bg-red-50 rounded-xl font-bold text-[10px] h-8 uppercase">Reject</Button>
                         </div>
                      </div>
                    ))}
                    {allUsers.filter(u => u.role === 'rider' && u.approvalStatus === 'pending').length === 0 && (
                      <p className="text-center py-8 text-neutral-400 font-bold italic text-sm">No pending drivers</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white transition-colors">Verified Drivers</h3>
                 <div className="grid grid-cols-1 gap-4">
                    {allUsers.filter(u => u.role === 'rider' && u.approvalStatus === 'approved').map(rider => (
                      <Card 
                        key={rider.id}
                        className="rounded-[2rem] border-none shadow-lg group hover:shadow-2xl transition-all border-2 border-transparent hover:border-blue-500/20 bg-white dark:bg-neutral-900 transition-colors"
                      >
                         <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl">
                                  {rider.displayName[0]}
                               </div>
                               <div>
                                  <h4 className="font-black text-lg text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase italic leading-none">{rider.displayName}</h4>
                                  <p className="text-xs text-neutral-400 mt-1">{rider.email}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className="bg-blue-50 text-blue-600 border-none font-bold uppercase text-[8px]">{rider.driverType}</Badge>
                                    <span className="text-[10px] font-black uppercase text-neutral-400">{rider.licensePlate}</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               {rider.phone && (
                                  <a href={`https://wa.me/${rider.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                                     <Button size="icon" variant="ghost" className="rounded-xl text-green-600 hover:bg-green-50">
                                       <MessageCircle className="w-5 h-5" />
                                     </Button>
                                  </a>
                               )}
                               <Button variant="ghost" onClick={() => handleRejectDriver(rider.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl size-10">
                                  <Ban className="w-5 h-5" />
                               </Button>
                            </div>
                         </CardContent>
                      </Card>
                    ))}
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div key="orders" className="space-y-6">
             <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
                <div className="p-8 bg-neutral-900 text-white flex justify-between items-center">
                   <h3 className="text-2xl font-black uppercase italic tracking-widest">{t('admin_global_live_feed')}</h3>
                   <Badge className="bg-orange-600 border-none px-4 py-1 animate-pulse">{t('admin_live_monitoring')}</Badge>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 text-left">
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('admin_order_ref')}</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('admin_merchant')}</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('admin_payment')}</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('status')}</th>
                           <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">{t('admin_value')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                         {allOrders.map(order => (
                           <tr key={order.id}>
                              <td className="px-8 py-6">
                                 <span className="font-black text-neutral-900">#{order.id?.slice(-8).toUpperCase()}</span>
                                 <p className="text-[10px] text-neutral-400">{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Just now'}</p>
                              </td>
                              <td className="px-8 py-6 italic font-bold text-sm text-neutral-600">
                                 {vendors.find(v => v.id === order.vendorId)?.businessName || (order.vendorId ? `ID: ${order.vendorId.slice(0, 8)}...` : 'Unknown Merchant')}
                              </td>
                              <td className="px-8 py-6">
                                 <Badge className={`${order.paymentStatus === 'paid' ? 'bg-green-400' : 'bg-red-400'} text-white border-none font-black text-[8px] uppercase`}>
                                   {order.paymentStatus || 'pending'}
                                 </Badge>
                              </td>
                              <td className="px-8 py-6">
                                 <Badge variant="outline" className="border-neutral-200 text-neutral-400 font-bold uppercase text-[8px]">
                                   {order.status}
                                 </Badge>
                              </td>
                              <td className="px-8 py-6 text-right">
                                 <div className="flex justify-end gap-2">
                                    {order.paymentStatus !== 'paid' && (
                                      <Button 
                                        size="sm" 
                                        className="bg-green-600 text-white rounded-xl font-bold text-[10px]"
                                        onClick={async () => {
                                          await updateDoc(doc(db, 'orders', order.id!), { paymentStatus: 'paid' });
                                          toast.success('Markup as Paid');
                                        }}
                                      >
                                        Mark Paid
                                      </Button>
                                    )}
                                    <span className="font-black text-orange-600">TZS {order.totalAmount.toLocaleString()}</span>
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </Card>
          </motion.div>
        )}

        {/* Marketing Tabs */}
        {activeTab === 'banners' && (
          <motion.div
            key="banners"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold uppercase italic font-black">{t('admin_manage_banners')}</h2>
              <Button onClick={() => setIsAddBannerOpen(true)} className="bg-orange-600 hover:bg-orange-700 rounded-[1.2rem] gap-2">
                <Plus className="w-4 h-4" /> {t('admin_add_banner')}
              </Button>
            </div>

            {isAddBannerOpen && (
              <Card className="border-orange-200 bg-orange-50/30 rounded-[2rem]">
                <CardHeader>
                  <CardTitle className="text-lg">{t('admin_new_banner')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddBanner} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">{t('admin_title')}</label>
                      <Input required placeholder="e.g. 50% OFF Chakula" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">{t('admin_subtitle')}</label>
                      <Input required placeholder="e.g. Order from your favorite restaurants" value={newBanner.sub} onChange={e => setNewBanner({...newBanner, sub: e.target.value})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold uppercase text-neutral-500">{t('admin_image_url')}</label>
                      <Input required placeholder="https://images.unsplash.com/..." value={newBanner.img} onChange={e => setNewBanner({...newBanner, img: e.target.value})} />
                    </div>
                    <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                      <Button type="button" variant="ghost" onClick={() => setIsAddBannerOpen(false)}>{t('cancel')}</Button>
                      <Button type="submit" className="bg-orange-600 hover:bg-orange-700">{t('admin_save_banner')}</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {banners.map((banner) => banner.img && (
                <Card key={banner.id} className="overflow-hidden group rounded-[2.5rem] border-none shadow-xl">
                  <div className="h-48 relative">
                    <img src={banner.img} alt={banner.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-8 text-white">
                      <h3 className="font-black text-2xl uppercase italic leading-tight">{banner.title}</h3>
                      <p className="text-xs opacity-80 font-bold uppercase tracking-widest">{banner.sub}</p>
                    </div>
                    <button onClick={() => deleteDoc(doc(db, 'banners', banner.id!))} className="absolute top-4 right-4 p-3 bg-white/90 text-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:text-white">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'coupons' && (
          <motion.div key="coupons" className="space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">{t('admin_manage_coupons')}</h2>
                <Button onClick={() => setIsAddCouponOpen(true)} className="bg-orange-600 hover:bg-orange-700 rounded-2xl gap-2">
                   <Plus className="w-4 h-4" /> {t('admin_add_coupon')}
                </Button>
             </div>
             {/* ... reuse existing coupon mapping ... */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map(coupon => (
                  <Card key={coupon.id} className="p-8 border-none shadow-xl rounded-[2.5rem] bg-white relative group">
                     <div className="flex justify-between items-start">
                        <div>
                           <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-orange-100 text-orange-600 border-none font-black text-[8px] tracking-[0.2rem] uppercase">{t('admin_official_coupon')}</Badge>
                           </div>
                           <h3 className="font-black text-3xl text-neutral-900 tracking-tighter uppercase italic">{coupon.code}</h3>
                           <p className="text-lg font-black text-orange-600 mt-1">
                              {coupon.discountType === 'percentage' ? `${coupon.discountValue}% ${t('admin_off')}` : `TZS ${coupon.discountValue.toLocaleString()} ${t('admin_off')}`}
                           </p>
                        </div>
                        <Button variant="ghost" className="text-red-400 hover:text-red-600 rounded-2xl p-4 size-14" onClick={() => deleteDoc(doc(db, 'coupons', coupon.id!))}>
                           <Trash2 className="w-6 h-6" />
                        </Button>
                     </div>
                  </Card>
                ))}
             </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" className="max-w-2xl mx-auto py-12">
             <Card className="rounded-[3rem] border-none shadow-2xl p-12 bg-neutral-900 text-white">
                <CardHeader className="text-center">
                   <Megaphone className="w-16 h-16 text-orange-600 mx-auto mb-6" />
                   <CardTitle className="text-3xl font-black italic uppercase tracking-widest">{t('admin_broadcast_title')}</CardTitle>
                   <CardDescription className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">{t('admin_broadcast_subtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 mt-8">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3rem] text-neutral-500">Target Audience</label>
                      <select 
                        className="w-full h-16 px-6 rounded-2xl bg-neutral-800 border-none transition-colors outline-none font-bold text-white"
                        value={notifTarget}
                        onChange={(e) => setNotifTarget(e.target.value)}
                      >
                        <option value="all">All Users & Drivers</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>
                        ))}
                      </select>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3rem] text-neutral-500">{t('admin_alert_title')}</label>
                      <Input className="bg-neutral-800 border-none h-16 rounded-2xl font-bold text-white placeholder:text-neutral-600" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="What's happening?" />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3rem] text-neutral-500">Image URL (Optional)</label>
                      <Input className="bg-neutral-800 border-none h-16 rounded-2xl font-bold text-white placeholder:text-neutral-600" value={notifImage} onChange={e => setNotifImage(e.target.value)} placeholder="https://..." />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3rem] text-neutral-500">{t('admin_alert_content')}</label>
                      <Textarea className="bg-neutral-800 border-none min-h-[160px] rounded-[2rem] font-bold text-white placeholder:text-neutral-600" value={notifBody} onChange={e => setNotifBody(e.target.value)} placeholder="Tell them everything..." />
                   </div>
                   <Button disabled={isSending} onClick={handleSendNotification} className="w-full h-20 bg-orange-600 hover:bg-orange-700 text-xl font-black uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-orange-900/50">
                      {isSending ? 'Transmitting...' : t('admin_initiate_broadcast')}
                   </Button>
                </CardContent>
             </Card>
          </motion.div>
        )}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            {/* Settings Sub-navigation */}
            <div className="flex flex-wrap gap-4 border-b border-neutral-100 pb-4">
              {[
                { id: 'business_info', label: t('admin_settings_business_info'), icon: Info },
                { id: 'payment', label: t('admin_settings_payment'), icon: CreditCard },
                { id: 'vendor', label: t('admin_settings_vendor'), icon: Store },
                { id: 'order', label: t('admin_settings_order'), icon: Package },
                { id: 'refund', label: t('admin_settings_refund'), icon: Undo2 },
                { id: 'deliveryman', label: t('admin_settings_deliveryman'), icon: Bike },
                { id: 'customer', label: t('admin_settings_customer'), icon: Users },
              ].map((stab) => (
                <button
                  key={stab.id}
                  onClick={() => setActiveSettingsTab(stab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                    activeSettingsTab === stab.id
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-100'
                      : 'text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  <stab.icon className="w-4 h-4" />
                  {stab.label}
                </button>
              ))}
            </div>

            {activeSettingsTab === 'business_info' && (
              <div className="space-y-8">
                {/* Maintenance Mode */}
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-50/50">
                  <CardContent className="p-8 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase italic tracking-tight">{t('admin_settings_maintenance_mode')}</h3>
                      <p className="text-xs text-neutral-500 font-medium">Turn on the Maintenance Mode will temporarily deactivate your selected systems.</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-xs font-bold uppercase text-neutral-400">{businessConfig.maintenanceMode ? 'Active' : 'Disabled'}</span>
                       <Switch 
                         checked={businessConfig.maintenanceMode}
                         onCheckedChange={(val) => setBusinessConfig({...businessConfig, maintenanceMode: val})}
                       />
                    </div>
                  </CardContent>
                </Card>

                {/* Basic Information */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-4 overflow-hidden">
                  <CardHeader className="p-8 pb-0">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter italic">{t('admin_settings_basic_info')}</CardTitle>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">Setup your global business details here.</p>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_business_name')} *</Label>
                             <Input 
                               value={businessConfig.name}
                               onChange={e => setBusinessConfig({...businessConfig, name: e.target.value})}
                               className="h-14 rounded-2xl border-none bg-neutral-100 font-bold px-6"
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Email *</Label>
                             <Input 
                               value={businessConfig.email}
                               onChange={e => setBusinessConfig({...businessConfig, email: e.target.value})}
                               className="h-14 rounded-2xl border-none bg-neutral-100 font-bold px-6"
                             />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Phone *</Label>
                             <Input 
                               value={businessConfig.phone}
                               onChange={e => setBusinessConfig({...businessConfig, phone: e.target.value})}
                               className="h-14 rounded-2xl border-none bg-neutral-100 font-bold px-6"
                             />
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_country')} *</Label>
                             <Input 
                               value={businessConfig.country}
                               onChange={e => setBusinessConfig({...businessConfig, country: e.target.value})}
                               className="h-14 rounded-2xl border-none bg-neutral-100 font-bold px-6"
                             />
                          </div>
                          <div className="space-y-2 flex flex-col h-full">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Address *</Label>
                             <Textarea 
                               value={businessConfig.address}
                               onChange={e => setBusinessConfig({...businessConfig, address: e.target.value})}
                               className="flex-1 rounded-2xl border-none bg-neutral-100 font-bold px-6 py-4 min-h-[120px]"
                             />
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-neutral-100 pt-8">
                       <div className="p-8 rounded-[2rem] border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-4 group hover:border-orange-200 transition-colors cursor-pointer">
                          <ImageIcon className="w-12 h-12 text-neutral-300 group-hover:text-orange-300" />
                          <div className="text-center">
                             <p className="font-black uppercase italic text-sm text-neutral-900">{t('admin_settings_upload_logo')} *</p>
                             <p className="text-[10px] font-bold text-neutral-400 mt-1 uppercase">3:1 Ratio recommended (Less than 2MB)</p>
                          </div>
                       </div>

                       <div className="p-8 rounded-[2rem] border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-4 group hover:border-orange-200 transition-colors cursor-pointer">
                          <Globe className="w-12 h-12 text-neutral-300 group-hover:text-orange-300" />
                          <div className="text-center">
                             <p className="font-black uppercase italic text-sm text-neutral-900">{t('admin_settings_upload_favicon')} *</p>
                             <p className="text-[10px] font-bold text-neutral-400 mt-1 uppercase">1:1 Ratio recommended (Less than 2MB)</p>
                          </div>
                       </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-4">
                       <Button 
                          variant="outline"
                          onClick={seedDemoStores}
                          disabled={isSeeding}
                          className="h-16 px-8 rounded-2xl border-2 border-blue-100 text-blue-600 hover:bg-blue-50 font-black uppercase tracking-widest"
                       >
                          {isSeeding ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Plus className="w-6 h-6 mr-2" />}
                          Add Demo Stores
                       </Button>
                       <Button className="h-16 px-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-lg font-black uppercase tracking-widest shadow-2xl shadow-orange-500/20" onClick={handleSaveSettings}>
                          {t('admin_settings_save_information')}
                       </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* General Setup */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Card className="rounded-[2.5rem] border-none shadow-xl p-8 space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                            <Clock className="w-5 h-5" />
                         </div>
                         <h3 className="font-black uppercase italic text-neutral-900">{t('admin_settings_time_setup')}</h3>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Time Zone</Label>
                           <Input value="(GMT+03:00) East Africa/Nairobi" readOnly className="h-12 rounded-xl bg-neutral-50 border-none px-4" />
                         </div>
                         <div className="flex gap-4">
                            <Button variant="outline" className="flex-1 rounded-xl font-bold uppercase h-12 border-orange-200 text-orange-600 bg-orange-50/50">12 Hours</Button>
                            <Button variant="outline" className="flex-1 rounded-xl font-bold uppercase h-12 border-neutral-100 text-neutral-400">24 Hours</Button>
                         </div>
                      </div>
                   </Card>

                   <Card className="rounded-[2.5rem] border-none shadow-xl p-8 space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-teal-100 text-teal-600 rounded-xl">
                            <Coins className="w-5 h-5" />
                         </div>
                         <h3 className="font-black uppercase italic text-neutral-900">{t('admin_settings_currency_setup')}</h3>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Currency Symbol</Label>
                           <Input 
                             value={businessConfig.currencySymbol} 
                             onChange={e => setBusinessConfig({...businessConfig, currencySymbol: e.target.value})}
                             className="h-12 rounded-xl bg-neutral-100 border-none px-4 font-bold" 
                           />
                         </div>
                         <div className="flex gap-4">
                            <Button variant="outline" className="flex-1 rounded-xl font-bold uppercase h-12 border-neutral-100 text-neutral-900">Left ($)</Button>
                            <Button variant="outline" className="flex-1 rounded-xl font-bold uppercase h-12 border-neutral-100 text-neutral-400">Right ($)</Button>
                         </div>
                      </div>
                   </Card>
                </div>
              </div>
            )}

            {activeSettingsTab === 'payment' && (
              <div className="space-y-8">
                 <h3 className="text-2xl font-black uppercase italic tracking-tight">{t('admin_settings_payment')} Options</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { id: 'cod', label: 'Cash on Delivery', sub: 'Receive payments in person', icon: Wallet },
                      { id: 'digital', label: 'Digital Payment', sub: 'Cards & Online Wallets', icon: CreditCard },
                      { id: 'offline', label: 'Offline Payment', sub: 'Direct bank transfers', icon: History },
                    ].map((method) => (
                      <Card key={method.id} className="p-6 rounded-[2rem] border-none shadow-xl relative overflow-hidden group">
                         <div className="flex items-start justify-between">
                            <div className="p-4 bg-neutral-100 rounded-2xl group-hover:bg-orange-100 transition-colors">
                               <method.icon className="w-8 h-8 text-neutral-500 group-hover:text-orange-600" />
                            </div>
                            <Switch checked={true} />
                         </div>
                         <div className="mt-6">
                            <h4 className="font-black uppercase italic text-neutral-900">{method.label}</h4>
                            <p className="text-xs text-neutral-400 font-bold uppercase mt-1">{method.sub}</p>
                         </div>
                      </Card>
                    ))}
                 </div>
              </div>
            )}

            {activeSettingsTab === 'vendor' && (
              <div className="space-y-12 pb-20">
                {/* General Setup */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_vendor_general_setup')}</h3>
                    <p className="text-xs text-neutral-500 font-medium">{t('admin_settings_vendor_general_desc')}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { id: 'vendorCancelOrder', label: t('admin_settings_vendor_cancel_order'), key: 'vendorCancelOrder' },
                      { id: 'vendorSelfRegistration', label: t('admin_settings_vendor_self_reg'), key: 'vendorSelfRegistration' },
                      { id: 'vendorProductGallery', label: t('admin_settings_vendor_gallery'), key: 'vendorProductGallery' },
                      { id: 'vendorAccessAllProducts', label: t('admin_settings_vendor_access_prods'), key: 'vendorAccessAllProducts' },
                      { id: 'vendorCanReplyReview', label: t('admin_settings_vendor_can_reply'), key: 'vendorCanReplyReview' },
                    ].map((setting) => (
                      <Card key={setting.id} className="p-6 rounded-[2rem] border-none shadow-md bg-neutral-50/50 flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase text-neutral-700 leading-tight pr-4">{setting.label}</Label>
                        <Switch 
                          checked={(businessConfig as any)[setting.key]} 
                          onCheckedChange={(val) => setBusinessConfig({...businessConfig, [setting.key]: val})}
                        />
                      </Card>
                    ))}
                  </div>
                </section>

                {/* Need Approval For */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_vendor_approval')}</h3>
                    <p className="text-xs text-neutral-500 font-medium">{t('admin_settings_vendor_approval_desc')}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                                <Plus className="w-5 h-5" />
                             </div>
                             <h4 className="font-black uppercase italic text-neutral-900">{t('admin_settings_vendor_add_prod')}</h4>
                          </div>
                          <Switch 
                            checked={businessConfig.needApprovalForNewProduct}
                            onCheckedChange={(val) => setBusinessConfig({...businessConfig, needApprovalForNewProduct: val})}
                          />
                       </div>
                       <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">If enabled, admin approval is required each time a vendor submits a new product.</p>
                    </Card>

                    <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                <Undo2 className="w-5 h-5" />
                             </div>
                             <h4 className="font-black uppercase italic text-neutral-900">{t('admin_settings_vendor_edit_prod')}</h4>
                          </div>
                          <Switch 
                            checked={businessConfig.needApprovalForUpdateProduct}
                            onCheckedChange={(val) => setBusinessConfig({...businessConfig, needApprovalForUpdateProduct: val})}
                          />
                       </div>
                       <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">If enabled, admin approval is required each time a vendor updates an existing product.</p>
                    </Card>
                  </div>
                </section>

                {/* Cash in Hand Controls */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_vendor_cash_ctrl')}</h3>
                    <p className="text-xs text-neutral-500 font-medium">{t('admin_settings_vendor_cash_desc')}</p>
                  </div>
                  <Card className="rounded-[3rem] border-none shadow-2xl p-8 space-y-8 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_vendor_cash_overflow')}</Label>
                          <div className="h-14 rounded-2xl bg-neutral-100 flex items-center justify-between px-6">
                             <span className="text-xs font-bold uppercase text-neutral-400">Status</span>
                             <Switch 
                               checked={businessConfig.cashInHandOverflow}
                               onCheckedChange={(val) => setBusinessConfig({...businessConfig, cashInHandOverflow: val})}
                             />
                          </div>
                       </div>
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_vendor_max_cash')} ({businessConfig.currencySymbol})</Label>
                          <Input 
                            type="number"
                            value={businessConfig.maxCashInHand}
                            onChange={(e) => setBusinessConfig({...businessConfig, maxCashInHand: Number(e.target.value)})}
                            className="h-14 rounded-2xl border-none bg-neutral-100 font-black text-lg px-6"
                          />
                       </div>
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_vendor_min_pay')} ({businessConfig.currencySymbol})</Label>
                          <Input 
                            type="number"
                            value={businessConfig.minPayAmount}
                            onChange={(e) => setBusinessConfig({...businessConfig, minPayAmount: Number(e.target.value)})}
                            className="h-14 rounded-2xl border-none bg-neutral-100 font-black text-lg px-6"
                          />
                       </div>
                    </div>

                    <div className="flex justify-end pt-4">
                       <Button onClick={handleSaveSettings} className="h-16 px-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-lg font-black uppercase tracking-widest shadow-2xl shadow-orange-500/20">
                          {t('admin_settings_save_information')}
                       </Button>
                    </div>
                  </Card>
                </section>
              </div>
            )}

            {activeSettingsTab === 'order' && (
              <div className="space-y-12 pb-20">
                {/* Order Type */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_order_type')}</h3>
                    <p className="text-xs text-neutral-500 font-medium">{t('admin_settings_order_type_desc')}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { id: 'homeDelivery', label: t('admin_settings_home_delivery'), key: 'homeDelivery', sub: 'Receive at your doorstep' },
                      { id: 'takeaway', label: t('admin_settings_takeaway'), key: 'takeaway', sub: 'Pick up from store' },
                      { id: 'scheduledOrder', label: t('admin_settings_scheduled_order'), key: 'scheduledOrder', sub: 'Pre-order for later' },
                    ].map((type) => (
                      <Card key={type.id} className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="font-black uppercase italic text-neutral-900">{type.label}</h4>
                           <Switch 
                             checked={(businessConfig as any)[type.key]}
                             onCheckedChange={(val) => setBusinessConfig({...businessConfig, [type.key]: val})}
                           />
                        </div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">{type.sub}</p>
                      </Card>
                    ))}
                  </div>
                  {businessConfig.scheduledOrder && (
                    <Card className="p-8 rounded-[2.5rem] border-none shadow-md bg-neutral-50/50">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <Label className="text-xs font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_time_interval')} (Min)</Label>
                          <Input 
                            type="number"
                            value={businessConfig.scheduledTimeInterval}
                            onChange={(e) => setBusinessConfig({...businessConfig, scheduledTimeInterval: Number(e.target.value)})}
                            className="h-12 w-32 rounded-xl border-none bg-white font-black text-center"
                          />
                       </div>
                    </Card>
                  )}
                </section>

                {/* Free Delivery & Extra Packaging */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Card className="p-8 rounded-[3rem] border-none shadow-2xl space-y-6">
                      <div className="flex items-center justify-between">
                         <div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight">{t('admin_settings_free_delivery')}</h3>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase">{t('admin_settings_free_delivery_desc')}</p>
                         </div>
                         <Switch 
                           checked={businessConfig.freeDelivery}
                           onCheckedChange={(val) => setBusinessConfig({...businessConfig, freeDelivery: val})}
                         />
                      </div>
                      {businessConfig.freeDelivery && (
                        <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Free Delivery Over ({businessConfig.currencySymbol})</Label>
                           <Input 
                             type="number"
                             value={businessConfig.freeDeliveryOver}
                             onChange={(e) => setBusinessConfig({...businessConfig, freeDeliveryOver: Number(e.target.value)})}
                             className="h-12 w-32 rounded-xl border-none bg-neutral-100 font-black text-center"
                           />
                        </div>
                      )}
                   </Card>

                   <Card className="p-8 rounded-[3rem] border-none shadow-2xl space-y-6">
                      <div className="flex items-center justify-between">
                         <div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight">{t('admin_settings_extra_packaging')}</h3>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase">{t('admin_settings_extra_packaging_desc')}</p>
                         </div>
                         <Switch 
                           checked={businessConfig.extraPackagingCharge}
                           onCheckedChange={(val) => setBusinessConfig({...businessConfig, extraPackagingCharge: val})}
                         />
                      </div>
                   </Card>
                </div>

                {/* Other Setup & Order Verification */}
                <section className="space-y-6">
                   <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_other_setup')}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="p-6 rounded-[2rem] border-none shadow-lg flex items-center justify-between">
                         <Label className="text-xs font-bold uppercase text-neutral-700">{t('admin_settings_prescription_order')}</Label>
                         <Switch 
                           checked={businessConfig.orderByPrescription}
                           onCheckedChange={(val) => setBusinessConfig({...businessConfig, orderByPrescription: val})}
                         />
                      </Card>
                      <Card className="p-6 rounded-[2rem] border-none shadow-lg flex items-center justify-between">
                         <Label className="text-xs font-bold uppercase text-neutral-700">{t('admin_settings_delivery_verification')}</Label>
                         <Switch 
                           checked={businessConfig.deliveryVerifyStatus}
                           onCheckedChange={(val) => setBusinessConfig({...businessConfig, deliveryVerifyStatus: val})}
                         />
                      </Card>
                      <Card className="p-6 rounded-[2rem] border-none shadow-lg space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block">{t('admin_settings_confirm_order')}</Label>
                         <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
                            {['store', 'deliveryman'].map(role => (
                               <button
                                 key={role}
                                 onClick={() => setBusinessConfig({...businessConfig, whoConfirmOrder: role})}
                                 className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                   businessConfig.whoConfirmOrder === role ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-400'
                                 }`}
                               >
                                 {role}
                               </button>
                            ))}
                         </div>
                      </Card>
                   </div>
                </section>

                {/* Cancellation Messages */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 space-y-8 overflow-hidden">
                   <div className="flex items-center justify-between">
                      <div>
                         <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_cancellation_msg')}</h3>
                         <p className="text-xs text-neutral-500 font-medium">{t('admin_settings_cancellation_msg_desc')}</p>
                      </div>
                      <Button variant="outline" className="rounded-xl border-orange-200 text-orange-600 font-black uppercase h-12 px-6">
                         <Plus className="w-4 h-4 mr-2" /> Add Reason
                      </Button>
                   </div>

                   <table className="w-full text-left">
                      <thead>
                         <tr className="border-b border-neutral-100">
                            <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">SL</th>
                            <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('admin_settings_cancellation_reason')}</th>
                            <th className="pb-4 text-[10px) font-black uppercase tracking-widest text-neutral-400">{t('admin_settings_user_type')}</th>
                            <th className="pb-4 text-right text-[10px] font-black uppercase tracking-widest text-neutral-400">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                         {[
                           { id: 1, reason: 'I ordered the wrong food', type: 'Customer' },
                           { id: 2, reason: 'Busy with other delivery', type: 'Deliveryman' },
                           { id: 3, reason: 'Restaurant closing soon', type: 'Store' },
                         ].map((item) => (
                           <tr key={item.id} className="group hover:bg-neutral-50/50 transition-colors">
                              <td className="py-4 text-xs font-bold text-neutral-400">{item.id}</td>
                              <td className="py-4 text-xs font-black text-neutral-900 group-hover:text-orange-600 transition-colors">{item.reason}</td>
                              <td className="py-4">
                                 <Badge variant="outline" className="rounded-lg font-black uppercase text-[8px] border-neutral-100 bg-white">{item.type}</Badge>
                              </td>
                              <td className="py-4 text-right">
                                 <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50"><History className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>

                   <div className="flex justify-end pt-4">
                      <Button onClick={handleSaveSettings} className="h-16 px-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-lg font-black uppercase tracking-widest shadow-2xl shadow-orange-500/20">
                         {t('admin_settings_save_information')}
                      </Button>
                   </div>
                </Card>
              </div>
            )}

            {activeSettingsTab === 'refund' && (
              <div className="space-y-12 pb-20">
                {/* Refund Request Mode */}
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-50/50">
                  <CardContent className="p-8 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase italic tracking-tight">{t('admin_settings_refund_mode')}</h3>
                      <p className="text-xs text-neutral-500 font-medium">{t('admin_settings_refund_mode_desc')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-xs font-bold uppercase text-neutral-400">{businessConfig.refundRequestMode ? 'Active' : 'Disabled'}</span>
                       <Switch 
                         checked={businessConfig.refundRequestMode}
                         onCheckedChange={(val) => setBusinessConfig({...businessConfig, refundRequestMode: val})}
                       />
                    </div>
                  </CardContent>
                </Card>

                {/* Add Refund Reason */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 space-y-8 overflow-hidden">
                   <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_add_refund_reason')}</h3>
                      <p className="text-xs text-neutral-500 font-medium italic">Users cannot cancel an order if the Admin does not specify a cause for cancellation even though</p>
                   </div>

                   <div className="space-y-6">
                      <div className="flex gap-4 border-b border-neutral-100">
                         {['Default', 'English(EN)', 'Arabic(AR)'].map((l, i) => (
                           <button key={l} className={`pb-3 text-xs font-black uppercase tracking-widest ${i === 0 ? 'text-orange-600 border-b-2 border-orange-600' : 'text-neutral-400'}`}>
                              {l}
                           </button>
                         ))}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_refund_reason')} (Default) *</Label>
                        <Textarea placeholder="Ex: Item is Broken" className="min-h-[120px] rounded-2xl border-none bg-neutral-100 font-bold px-6 py-4" />
                        <p className="text-right text-[10px] font-bold text-neutral-300 uppercase">0/150</p>
                      </div>
                   </div>

                   <div className="flex justify-end gap-4">
                      <Button variant="outline" className="h-12 px-8 rounded-xl border-neutral-200 font-black uppercase tracking-widest">Reset</Button>
                      <Button className="h-12 px-12 rounded-xl bg-orange-600 hover:bg-orange-700 font-black uppercase tracking-widest" onClick={handleSaveSettings}>Save</Button>
                   </div>
                </Card>

                {/* Refund Reason List */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 space-y-8">
                   <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black uppercase italic tracking-tight">{t('admin_settings_refund_reason_list')}</h3>
                      <div className="flex gap-4">
                         <div className="relative">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <Input placeholder="Ex: search here" className="h-12 pl-12 pr-6 rounded-xl border-none bg-neutral-100 w-64" />
                         </div>
                      </div>
                   </div>

                   <table className="w-full text-left">
                      <thead>
                         <tr className="border-b border-neutral-100">
                            <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">SL</th>
                            <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Reason</th>
                            <th className="pb-4 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</th>
                            <th className="pb-4 text-right text-[10px] font-black uppercase tracking-widest text-neutral-400">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                         {[
                           { id: 1, reason: 'The Merchant Shipped the Wrong Item.' },
                           { id: 2, reason: 'The Product Was Damaged Upon Arrival.' },
                           { id: 3, reason: "Delivery man didn't arrived timely." },
                           { id: 4, reason: 'Food was Rotten' },
                           { id: 5, reason: 'Item quality is not so good.' },
                         ].map((item) => (
                           <tr key={item.id} className="group hover:bg-neutral-50/50 transition-colors">
                              <td className="py-4 text-xs font-bold text-neutral-400">{item.id}</td>
                              <td className="py-4 text-xs font-black text-neutral-900 group-hover:text-orange-600 transition-colors">{item.reason}</td>
                              <td className="py-4 text-center">
                                 <Switch checked={true} />
                              </td>
                              <td className="py-4 text-right">
                                 <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50"><History className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </Card>
              </div>
            )}

            {/* Placeholder for other tabs - extensible */}
            {['deliveryman', 'customer'].includes(activeSettingsTab) && (
              <div className="py-20 text-center space-y-4">
                 <LayoutDashboard className="w-16 h-16 text-neutral-200 mx-auto" />
                 <div>
                    <h3 className="text-xl font-black uppercase italic text-neutral-400">{t(`admin_settings_${activeSettingsTab}`)} Setup</h3>
                    <p className="text-neutral-300 font-bold uppercase text-[10px] tracking-widest mt-1">Detailed configuration panel under construction.</p>
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MapBoundsUpdater({ drivers, rides }: { drivers: any[], rides: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (drivers.length === 0 && rides.length === 0) return;
    
    const points: L.LatLngExpression[] = [];
    drivers.forEach(d => {
      if (d.currentPosition) points.push([d.currentPosition.lat, d.currentPosition.lng]);
    });
    rides.forEach(r => {
      if (r.pickup) points.push([r.pickup.lat, r.pickup.lng]);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [drivers, rides, map]);

  return null;
}
