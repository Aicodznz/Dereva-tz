import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { VendorProfile, VendorCategory, Product, Order } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Plus, 
  Search, 
  Bell, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Clock, 
  DollarSign,
  BarChart3,
  Store,
  Truck,
  AlertCircle,
  MoreVertical,
  Filter,
  Download,
  Calendar,
  History,
  CreditCard,
  User,
  MapPin,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Camera,
  Trash2,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  LineChart,
  Line
} from 'recharts';
import { format } from 'date-fns';

type TabType = 'overview' | 'orders' | 'products' | 'pos' | 'customers' | 'settings';

const chartData = [
  { name: 'Mon', sales: 4000, orders: 24 },
  { name: 'Tue', sales: 3000, orders: 18 },
  { name: 'Wed', sales: 2000, orders: 12 },
  { name: 'Thu', sales: 2780, orders: 20 },
  { name: 'Fri', sales: 1890, orders: 15 },
  { name: 'Sat', sales: 2390, orders: 17 },
  { name: 'Sun', sales: 3490, orders: 22 },
];

import { useLanguage } from '../LanguageContext';

export default function VendorDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const tabs = [
    { id: 'overview', label: t('overview') || 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: t('orders') || 'Orders', icon: ShoppingCart, badge: orders.length > 0 ? orders.length : null },
    { id: 'products', label: t('inventory') || 'Inventory', icon: Package },
    { id: 'pos', label: t('pos_system') || 'POS System', icon: CreditCard },
    { id: 'customers', label: t('customers') || 'Customers', icon: Users },
    { id: 'settings', label: t('settings') || 'Settings', icon: Settings },
  ];

  // Onboarding Form State
  const [formData, setFormData] = useState({
    businessName: '',
    category: '' as VendorCategory,
    description: '',
    tin: '',
    address: '',
    deliveryRadius: 5,
    operatingHours: '9:00 AM - 9:00 PM',
  });

  // New Product Form State
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    category: '',
    stock: 0,
    unit: 'pcs',
    expiryDate: '',
    medicationType: 'otc',
    variations: [],
    addOns: [],
    imageUrl: '',
  });

  // POS Cart State
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setVendorProfile({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as VendorProfile);
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vendors');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!vendorProfile?.id) return;
    
    const ordersQ = query(
      collection(db, 'orders'), 
      where('vendorId', '==', vendorProfile.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    const productsQ = query(
      collection(db, 'products'), 
      where('vendorId', '==', vendorProfile.id)
    );
    
    const unsubProducts = onSnapshot(productsQ, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    return () => {
      unsubOrders();
      unsubProducts();
    };
  }, [vendorProfile?.id]);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'vendors'), {
        ...formData,
        ownerUid: user.uid,
        status: 'pending',
        rating: 0,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vendors');
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    if (!vendorProfile?.id) {
      alert('Tafadhali subiri wasifu wa biashara upakiwe kwanza.');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Tafadhali weka picha pekee.');
      return;
    }

    // Validate file size (removed limit as requested)
    // if (file.size > 2 * 1024 * 1024) { ... }

    setIsUploading(true);
    setUploadProgress(0);
    
    // Create a timeout to handle stuck uploads
    const uploadTimeout = setTimeout(() => {
      if (isUploading && uploadProgress === 0) {
        setIsUploading(false);
        toast.error("Upload is taking too long. Please try again or use a URL.");
      }
    }, 15000);

    try {
      const storageRef = ref(storage, `products/${vendorProfile.id}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          clearTimeout(uploadTimeout);
          console.error('Upload error:', error);
          setIsUploading(false);
          toast.error('Imeshindwa kupakia picha: ' + error.message);
        }, 
        async () => {
          clearTimeout(uploadTimeout);
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setNewProduct(prev => ({ ...prev, imageUrl: downloadURL }));
          setIsUploading(false);
          setUploadProgress(0);
          toast.success("Picha imepakiwa!");
        }
      );
    } catch (error) {
      clearTimeout(uploadTimeout);
      console.error('Error starting upload:', error);
      setIsUploading(false);
      toast.error('Imeshindwa kuanza kupakia picha.');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...newProduct,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...newProduct,
          vendorId: vendorProfile.id,
          createdAt: serverTimestamp(),
        });
      }
      setIsAddProductOpen(false);
      setEditingProduct(null);
      setNewProduct({
        name: '',
        description: '',
        price: 0,
        category: '',
        stock: 0,
        unit: 'pcs',
        expiryDate: '',
        medicationType: 'otc',
        variations: [],
        addOns: [],
        imageUrl: '',
      });
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      toast.success('Bidhaa imefutwa kikamilifu!');
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      stock: product.stock,
      unit: product.unit || 'pcs',
      expiryDate: product.expiryDate || '',
      medicationType: product.medicationType || 'otc',
      variations: product.variations || [],
      addOns: product.addOns || [],
      imageUrl: product.imageUrl || '',
    });
    setIsAddProductOpen(true);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0 || !vendorProfile?.id || !user) return;
    setIsProcessingSale(true);
    try {
      await addDoc(collection(db, 'orders'), {
        vendorId: vendorProfile.id,
        customerId: 'WALK_IN_CUSTOMER',
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity
        })),
        totalAmount: cartTotal,
        status: 'delivered',
        type: vendorProfile.category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deliveryAddress: 'In-Store POS',
      });
      setCart([]);
      setActiveTab('overview');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsProcessingSale(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-neutral-500 font-medium animate-pulse">Loading your business center...</p>
    </div>
  );

  if (showOnboarding) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl shadow-orange-100 overflow-hidden border border-neutral-100"
        >
          <div className="bg-orange-600 p-8 text-white">
            <h1 className="text-3xl font-bold">Vendor Onboarding</h1>
            <p className="text-orange-100 mt-2">Register your business to start selling on OmniServe.</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleOnboarding} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Business Name</label>
                  <Input required className="h-12 rounded-xl" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} placeholder="e.g. Healthy Meds Pharmacy" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Category</label>
                  <Select required onValueChange={val => setFormData({...formData, category: val as VendorCategory})}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="grocery">Grocery</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="ecommerce">eCommerce</SelectItem>
                      <SelectItem value="salon">Salon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Business Description</label>
                <Input required className="h-12 rounded-xl" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe your business..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">TIN Number</label>
                  <Input required className="h-12 rounded-xl" value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} placeholder="Tax Identification Number" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Delivery Radius (km)</label>
                  <Input type="number" className="h-12 rounded-xl" required value={formData.deliveryRadius} onChange={e => setFormData({...formData, deliveryRadius: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Physical Address</label>
                <Input required className="h-12 rounded-xl" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full business address" />
              </div>
              <Button type="submit" className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-200 transition-all hover:scale-[1.02]">
                Submit Application
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  if (vendorProfile?.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-yellow-50 text-yellow-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner"
        >
          <Clock className="w-12 h-12" />
        </motion.div>
        <h2 className="text-3xl font-bold text-neutral-900 mb-3">Application Pending</h2>
        <p className="text-neutral-500 max-w-md mx-auto text-lg leading-relaxed">
          Your application for <span className="font-bold text-orange-600">{vendorProfile.businessName}</span> is being reviewed. We'll notify you once it's approved.
        </p>
        <Button variant="outline" className="mt-8 rounded-xl px-8 h-12 font-semibold" onClick={() => window.location.reload()}>
          Check Status
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-12rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 bg-neutral-950 text-white overflow-hidden rounded-3xl border border-neutral-800 shadow-2xl">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-neutral-900/50 border-r border-neutral-800 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm truncate w-32">{vendorProfile?.businessName}</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{vendorProfile?.category}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                activeTab === item.id 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === item.id ? 'bg-white text-orange-600' : 'bg-orange-600 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-neutral-800">
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-neutral-400 hover:text-white transition-colors group">
            <History className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-medium text-sm">Switch Role</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 border-b border-neutral-800 px-8 flex items-center justify-between bg-neutral-900/20 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search orders, products..." 
                className="w-full bg-neutral-800/50 border-none rounded-xl pl-10 pr-4 h-10 text-sm focus:ring-2 focus:ring-orange-600 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setIsAddProductOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 gap-2 h-10 rounded-xl px-4 font-bold hidden md:flex"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
            <div className="h-8 w-px bg-neutral-800 mx-2 hidden md:block"></div>
            <button className="p-2.5 rounded-xl bg-neutral-800/50 text-neutral-400 hover:text-white transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-600 rounded-full border-2 border-neutral-900"></span>
            </button>
            <div className="h-8 w-px bg-neutral-800 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white">{profile?.displayName}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-tighter">Owner</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-600/30 flex items-center justify-center text-orange-600 font-bold">
                {profile?.displayName?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Total Revenue", value: "TZS 1.2M", icon: DollarSign, trend: "+12.5%", positive: true },
                    { label: "Active Orders", value: orders.length.toString(), icon: ShoppingCart, trend: "+3", positive: true },
                    { label: "Total Items", value: products.length.toString(), icon: Package, trend: "0", positive: true },
                    { label: "Avg. Rating", value: vendorProfile?.rating?.toFixed(1) || "0.0", icon: Users, trend: "+0.2", positive: true },
                  ].map((stat, i) => (
                    <Card key={i} className="bg-neutral-900 border-neutral-800 overflow-hidden group hover:border-orange-600/50 transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-2.5 rounded-xl bg-neutral-800 text-orange-600 group-hover:scale-110 transition-transform">
                            <stat.icon className="w-5 h-5" />
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                            stat.positive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {stat.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {stat.trend}
                          </div>
                        </div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-white mt-1 tracking-tight">{stat.value}</h3>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 bg-neutral-900 border-neutral-800 p-6">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <CardTitle className="text-lg font-bold text-white">Sales Analytics</CardTitle>
                        <CardDescription className="text-neutral-500">Weekly performance overview</CardDescription>
                      </div>
                      <Select defaultValue="7d">
                        <SelectTrigger className="w-32 bg-neutral-800 border-none h-9 text-xs">
                          <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                          <SelectItem value="24h">Last 24h</SelectItem>
                          <SelectItem value="7d">Last 7 days</SelectItem>
                          <SelectItem value="30d">Last 30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#525252" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            stroke="#525252" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${value/1000}k`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#ea580c' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="sales" 
                            stroke="#ea580c" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorSales)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="bg-neutral-900 border-neutral-800 p-6">
                    <CardTitle className="text-lg font-bold text-white mb-6">Recent Activity</CardTitle>
                    <div className="space-y-6">
                      {orders.slice(0, 5).map((order, i) => (
                        <div key={i} className="flex items-start gap-4 group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                            <ShoppingCart className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">New Order #{order.id?.slice(-4)}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">TZS {order.totalAmount.toLocaleString()}</p>
                          </div>
                          <p className="text-[10px] text-neutral-600 font-medium">2m ago</p>
                        </div>
                      ))}
                      {orders.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-12 h-12 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-600">
                            <History className="w-6 h-6" />
                          </div>
                          <p className="text-sm text-neutral-500">No recent activity</p>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" className="w-full mt-6 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl text-xs gap-2">
                      View All Activity <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'orders' && (
              <motion.div 
                key="orders"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Order Management</h2>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 rounded-xl gap-2">
                      <Filter className="w-4 h-4" /> Filter
                    </Button>
                    <Button variant="outline" className="bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 rounded-xl gap-2">
                      <Download className="w-4 h-4" /> Export
                    </Button>
                  </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/50">
                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-orange-600">#{order.id?.slice(-6)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-[10px] font-bold">
                                {order.customerId.charAt(0)}
                              </div>
                              <span className="text-sm font-medium text-white">Customer {order.customerId.slice(-4)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`rounded-full px-3 py-1 text-[10px] font-bold border-none ${
                              order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                              order.status === 'delivered' ? 'bg-green-500/10 text-green-500' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {order.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-white">TZS {order.totalAmount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs text-neutral-500">
                            {order.createdAt?.seconds ? format(new Date(order.createdAt.seconds * 1000), 'MMM d, HH:mm') : 'Just now'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="w-16 h-16 bg-neutral-800 rounded-3xl flex items-center justify-center mx-auto mb-4 text-neutral-600">
                              <ShoppingCart className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-white">No orders yet</h3>
                            <p className="text-neutral-500 text-sm">When customers buy from you, orders will appear here.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'pos' && (
              <motion.div 
                key="pos"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex flex-col lg:flex-row gap-8"
              >
                {/* Product Selection */}
                <div className="flex-1 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Quick Sale / POS</h2>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <Input placeholder="Search items..." className="bg-neutral-900 border-neutral-800 pl-10 h-10 rounded-xl" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.map((product) => (
                      <button 
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl hover:border-orange-600 transition-all text-left group"
                      >
                        <div className="aspect-square rounded-xl bg-neutral-800 mb-3 overflow-hidden">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                              <Package className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-white truncate">{product.name}</h4>
                        <p className="text-orange-600 font-bold text-xs mt-1">TZS {product.price.toLocaleString()}</p>
                        <p className="text-[10px] text-neutral-500 mt-1 uppercase font-bold">{product.stock} in stock</p>
                      </button>
                    ))}
                    {products.length === 0 && (
                      <div className="col-span-full py-20 text-center bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-800">
                        <Package className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                        <p className="text-neutral-500">No products available. Add some in Inventory.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart / Checkout */}
                <div className="w-full lg:w-96 bg-neutral-900 border border-neutral-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-neutral-800">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-orange-600" /> Current Order
                    </h3>
                  </div>
                  <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white truncate">{item.product.name}</p>
                          <p className="text-xs text-neutral-500">{item.quantity} x TZS {item.product.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-bold text-orange-600">TZS {(item.product.price * item.quantity).toLocaleString()}</p>
                          <button 
                            onClick={() => removeFromCart(item.product.id!)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 transition-all hover:text-white"
                          >
                            <Plus className="w-3 h-3 rotate-45" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="text-center py-12 text-neutral-600">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Cart is empty</p>
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-neutral-800/50 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-400">Subtotal</span>
                      <span className="text-white font-bold">TZS {cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-400">Tax (18%)</span>
                      <span className="text-white font-bold">TZS {(cartTotal * 0.18).toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-neutral-700 flex items-center justify-between">
                      <span className="font-bold text-white">Total</span>
                      <span className="text-2xl font-black text-orange-600">TZS {(cartTotal * 1.18).toLocaleString()}</span>
                    </div>
                    <Button 
                      disabled={cart.length === 0 || isProcessingSale}
                      onClick={handleCompleteSale}
                      className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-900/20 mt-4"
                    >
                      {isProcessingSale ? 'Processing...' : 'Complete Sale'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'products' && (
              <motion.div 
                key="products"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Inventory Management</h2>
                    <p className="text-neutral-500 text-sm mt-1">Manage your products and stock levels</p>
                  </div>
                  <Button 
                    onClick={() => setIsAddProductOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 h-11 rounded-xl gap-2 font-bold px-6"
                  >
                    <Plus className="w-5 h-5" /> Add New Product
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <Card key={product.id} className="bg-neutral-900 border-neutral-800 overflow-hidden group">
                      <div className="aspect-video bg-neutral-800 relative">
                        {product.imageUrl && (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Badge className="bg-neutral-900/80 backdrop-blur text-white border-none text-[10px] font-bold">
                            {product.stock} Left
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-white truncate w-40">{product.name}</h4>
                            <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{product.description}</p>
                          </div>
                          <p className="text-sm font-black text-orange-600">TZS {product.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-800">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditProduct(product)}
                            className="flex-1 text-xs font-bold hover:bg-neutral-800 rounded-lg gap-2"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteProduct(product.id!)}
                            className="flex-1 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-lg gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {products.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-neutral-900/50 rounded-3xl border-2 border-dashed border-neutral-800">
                      <Package className="w-16 h-16 text-neutral-800 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white">Your inventory is empty</h3>
                      <p className="text-neutral-500 mt-2 max-w-xs mx-auto">Start adding products to showcase them in the marketplace.</p>
                      <Button className="mt-8 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl px-8">
                        Add First Product
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddProductOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddProductOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                  <p className="text-xs text-neutral-500 font-medium">{editingProduct ? 'Hariri Bidhaa' : 'Ongeza Bidhaa Mpya'}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddProductOpen(false);
                    setEditingProduct(null);
                  }} 
                  className="text-neutral-500 hover:text-white p-2"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {/* Image Upload Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Product Image / Picha ya Bidhaa</label>
                  <div className="flex gap-4">
                    <div 
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-24 h-24 rounded-2xl bg-neutral-800 border-2 border-dashed flex flex-col items-center justify-center text-neutral-500 transition-all cursor-pointer group shrink-0 overflow-hidden relative ${
                        isUploading ? 'border-orange-600/50' : 'border-neutral-700 hover:text-orange-600 hover:border-orange-600'
                      }`}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="relative w-12 h-12 mb-2">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                              <path
                                className="text-neutral-700"
                                strokeDasharray="100, 100"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className="text-orange-600 transition-all duration-300"
                                strokeDasharray={`${uploadProgress}, 100`}
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold">{Math.round(uploadProgress)}%</span>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsUploading(false);
                              setUploadProgress(0);
                            }}
                            className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : newProduct.imageUrl ? (
                        <div className="relative w-full h-full group">
                          <img 
                            src={newProduct.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewProduct({...newProduct, imageUrl: ''});
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Camera className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase text-center px-1">Drop or Click</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input 
                        className="bg-neutral-800 border-none h-12 rounded-xl"
                        placeholder="Or paste Image URL here..."
                        value={newProduct.imageUrl}
                        onChange={e => {
                          const val = e.target.value;
                          // Extract URL if HTML is pasted
                          const srcMatch = val.match(/src=["']([^"']+)["']/);
                          const cleanUrl = srcMatch ? srcMatch[1] : val.trim();
                          
                          setNewProduct({...newProduct, imageUrl: cleanUrl});
                          if (isUploading) setIsUploading(false);
                        }}
                      />
                      {/* Removed Recommended text as requested */}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Product Name / Jina la Bidhaa</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="e.g. Paracetamol 500mg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Price / Bei (TZS)</label>
                    <Input 
                      type="number"
                      required 
                      className="bg-neutral-800 border-none h-12 rounded-xl"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Stock / Kiasi Kilichopo</label>
                    <Input 
                      type="number"
                      required 
                      className="bg-neutral-800 border-none h-12 rounded-xl"
                      value={newProduct.stock}
                      onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Category / Aina</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    placeholder="e.g. Pain Relief"
                  />
                </div>

                {/* Dynamic Fields based on Vendor Category */}
                {vendorProfile?.category === 'pharmacy' && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Expiry Date / Tarehe ya Kuisha</label>
                      <Input 
                        type="date"
                        className="bg-neutral-800 border-none h-12 rounded-xl"
                        value={newProduct.expiryDate}
                        onChange={e => setNewProduct({...newProduct, expiryDate: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                      <input 
                        type="checkbox"
                        id="prescription"
                        className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-orange-600 focus:ring-orange-600"
                        checked={newProduct.medicationType === 'prescription'}
                        onChange={e => setNewProduct({...newProduct, medicationType: e.target.checked ? 'prescription' : 'otc'})}
                      />
                      <label htmlFor="prescription" className="text-sm font-medium text-white cursor-pointer">
                        Requires Prescription? / Inahitaji Cheti?
                      </label>
                    </div>
                  </div>
                )}

                {(vendorProfile?.category === 'grocery' || vendorProfile?.category === 'restaurant' || vendorProfile?.category === 'ecommerce') && (
                  <div className="space-y-6 pt-2">
                    {/* Variations / Sizes */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Ukubwa / Sizes (e.g. Large, Small)</label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-orange-600 hover:bg-orange-600/10"
                          onClick={() => setNewProduct({
                            ...newProduct, 
                            variations: [...(newProduct.variations || []), { name: '', price: 0 }]
                          })}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Ongeza Ukubwa
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newProduct.variations?.map((v, idx) => (
                          <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                            <Input 
                              className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Jina (mfano: Kubwa)"
                              value={v.name}
                              onChange={e => {
                                const newVars = [...(newProduct.variations || [])];
                                newVars[idx].name = e.target.value;
                                setNewProduct({...newProduct, variations: newVars});
                              }}
                            />
                            <Input 
                              type="number"
                              className="w-24 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Bei (+)"
                              value={v.price}
                              onChange={e => {
                                const newVars = [...(newProduct.variations || [])];
                                newVars[idx].price = parseFloat(e.target.value);
                                setNewProduct({...newProduct, variations: newVars});
                              }}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-red-500 hover:bg-red-500/10 rounded-xl"
                              onClick={() => {
                                const newVars = newProduct.variations?.filter((_, i) => i !== idx);
                                setNewProduct({...newProduct, variations: newVars});
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(!newProduct.variations || newProduct.variations.length === 0) && (
                          <p className="text-[10px] text-neutral-600 italic">Hakuna ukubwa uliowekwa. Bonyeza ongeza ikiwa bidhaa ina saizi tofauti.</p>
                        )}
                      </div>
                    </div>

                    {/* Add-ons / Vionjo */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Vionjo / Add-ons (e.g. Soda, Pilipili)</label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-orange-600 hover:bg-orange-600/10"
                          onClick={() => setNewProduct({
                            ...newProduct, 
                            addOns: [...(newProduct.addOns || []), { name: '', price: 0 }]
                          })}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Ongeza Kionjo
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newProduct.addOns?.map((a, idx) => (
                          <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                            <Input 
                              className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Jina (mfano: Soda)"
                              value={a.name}
                              onChange={e => {
                                const newAddons = [...(newProduct.addOns || [])];
                                newAddons[idx].name = e.target.value;
                                setNewProduct({...newProduct, addOns: newAddons});
                              }}
                            />
                            <Input 
                              type="number"
                              className="w-24 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Bei"
                              value={a.price}
                              onChange={e => {
                                const newAddons = [...(newProduct.addOns || [])];
                                newAddons[idx].price = parseFloat(e.target.value);
                                setNewProduct({...newProduct, addOns: newAddons});
                              }}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-red-500 hover:bg-red-500/10 rounded-xl"
                              onClick={() => {
                                const newAddons = newProduct.addOns?.filter((_, i) => i !== idx);
                                setNewProduct({...newProduct, addOns: newAddons});
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(!newProduct.addOns || newProduct.addOns.length === 0) && (
                          <p className="text-[10px] text-neutral-600 italic">Hakuna vionjo vilivyowekwa. Bonyeza ongeza ikiwa unataka kutoa chaguzi za ziada.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Unit / Kipimo</label>
                      <Select 
                        value={newProduct.unit} 
                        onValueChange={val => setNewProduct({...newProduct, unit: val})}
                      >
                        <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                          <SelectItem value="kg">Kilogram (Kg)</SelectItem>
                          <SelectItem value="pcs">Piece (Pcs)</SelectItem>
                          <SelectItem value="pack">Pack</SelectItem>
                          <SelectItem value="ltr">Litre (Ltr)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Description / Maelezo</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                    placeholder="Brief details about the product"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  {editingProduct && (
                    <Button 
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsAddProductOpen(false);
                        handleDeleteProduct(editingProduct.id!);
                      }}
                      className="h-14 px-6 text-red-500 hover:bg-red-500/10 rounded-2xl font-bold"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={isUploading}
                    className="flex-1 h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-900/20"
                  >
                    {editingProduct ? 'Update Product' : 'Save Product'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Futa Bidhaa?</h3>
              <p className="text-neutral-400 text-sm mb-8">
                Je, una uhakika unataka kufuta bidhaa hii? Hatua hii haiwezi kurudishwa.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={confirmDeleteProduct}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-900/20"
                >
                  Ndiyo, Futa
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full h-14 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-2xl font-bold"
                >
                  Ghairi
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #404040;
        }
      `}} />
    </div>
  );
}
