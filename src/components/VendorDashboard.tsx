import React, { useEffect, useState, useMemo } from 'react';
import { initiatePayment } from '../services/paymentService';
import QRCodeStyling, { DotType, CornerSquareType, CornerDotType } from "qr-code-styling";
import { toPng } from 'html-to-image';
import { storageService } from '../services/storageService';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile, VendorCategory, Product, Order, OrderStatus } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Globe,
  LayoutDashboard, 
  Package, 
  Home,
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Plus, 
  Search, 
  Bell, 
  Settings, 
  LogOut, 
  Star,
  ChevronRight, 
  Clock, 
  DollarSign,
  BarChart3,
  Store,
  Truck,
  Bus,
  Ticket,
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
  X,
  Megaphone,
  UserPlus,
  Save,
  ShoppingBag,
  Beer,
  Smartphone,
  Banknote,
  QrCode,
  Layout,
  Zap,
  Gift,
  Tag,
  Edit2,
  Box,
  Check,
  Link as LinkIcon,
  Loader2,
  Printer,
  Utensils,
  UtensilsCrossed,
  Pill,
  FlaskConical,
  Scissors,
  Hotel,
  ChefHat,
  Monitor,
  ClipboardList,
  BadgeCheck,
  Printer as PrinterIcon,
  Volume2,
  VolumeX,
  UserCheck,
  ShieldCheck,
  UserCog,
  MessageSquare as MessageIcon
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
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';

type TabType = 'overview' | 'orders' | 'products' | 'pos' | 'inventory_stats' | 'customers' | 'coupons' | 'staff' | 'settings' | 'tables' | 'market_pulse' | 'freshness' | 'messages' | 'branches';

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
import LocationPicker from './LocationPicker';
import Chat from './Chat';

export default function VendorDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  // Dynamic context based on business category
  const vendorContext = useMemo(() => {
    const cat = vendorProfile?.category || 'grocery';
    switch (cat) {
      case 'restaurant':
        return {
          type: 'restaurant',
          ordersLabel: 'Kitchen Display',
          ordersDescription: 'Manage cooking orders and dining ready notifications.',
          ordersIcon: Beer,
          inventoryLabel: 'Menu Items',
          inventoryIcon: Utensils,
          locationLabel: 'Dining Tables',
          locationLabelSingular: 'Table',
          posLabel: 'Dine-in POS',
          posIcon: ShoppingCart,
          fulfillmentAction: 'Cooking',
          readyLabel: 'Ready to Serve',
          pickingLabel: 'In Kitchen',
          awaitingLabel: 'New Orders'
        };
      case 'pharmacy':
        return {
          type: 'pharmacy',
          ordersLabel: 'Prescriptions',
          ordersDescription: 'Dispense medication and manage clinical orders.',
          ordersIcon: Pill,
          inventoryLabel: 'Medications',
          inventoryIcon: FlaskConical,
          locationLabel: 'Storage Shelves',
          locationLabelSingular: 'Shelf',
          posLabel: 'Dispense Desk',
          posIcon: CreditCard,
          fulfillmentAction: 'Dispensing',
          readyLabel: 'Ready for Pickup',
          pickingLabel: 'Preparing Rx',
          awaitingLabel: 'Incoming Rx'
        };
      case 'salon':
      case 'hotel':
        return {
          type: 'service',
          ordersLabel: 'Appointments',
          ordersDescription: 'Track bookings, stylist schedules, and guest check-ins.',
          ordersIcon: Calendar,
          inventoryLabel: cat === 'hotel' ? 'Rooms & Rates' : 'Service Menu',
          inventoryIcon: cat === 'hotel' ? Hotel : Scissors,
          locationLabel: cat === 'hotel' ? 'Room Blocks' : 'Stylist Areas',
          locationLabelSingular: cat === 'hotel' ? 'Room' : 'Chair',
          posLabel: 'Front Desk',
          posIcon: Banknote,
          fulfillmentAction: 'Confirming',
          readyLabel: 'Confirmed',
          pickingLabel: 'In Progress',
          awaitingLabel: 'New Requests'
        };
      case 'taxi':
      case 'car_rental':
      case 'parcel':
      case 'bus_ticket':
        return {
          type: 'transit',
          ordersLabel: 'Tiketi & Abiria',
          ordersDescription: 'Manage bus ticket reservations and passenger lists.',
          ordersIcon: Bus,
          inventoryLabel: 'Ratiwa & Njia',
          inventoryIcon: Calendar,
          locationLabel: 'Vituo vya Mabasi',
          locationLabelSingular: 'Bus Station',
          posLabel: 'Counter ya Kukata Tiketi',
          posIcon: Ticket,
          fulfillmentAction: 'Booking',
          readyLabel: 'Safari Imeanza',
          pickingLabel: 'Boarding In-Progress',
          awaitingLabel: 'Zinasubiri'
        };
      default: // grocery, ecommerce, etc.
        return {
          type: 'retail',
          ordersLabel: 'Picking Hub',
          ordersDescription: 'Collect items from shelves for delivery or pickup.',
          ordersIcon: Box,
          inventoryLabel: 'Inventory',
          inventoryIcon: Package,
          locationLabel: 'Aisle Stands',
          locationLabelSingular: 'Aisle',
          posLabel: 'Register',
          posIcon: ShoppingCart,
          fulfillmentAction: 'Picking',
          readyLabel: 'Packed & Ready',
          pickingLabel: 'Currently Picking',
          awaitingLabel: 'Awaiting Picking',
          isGrocery: vendorProfile?.category === 'grocery'
        };
    }
  }, [vendorProfile?.category]);

  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const bestSellers = useMemo(() => {
    const itemCounts: Record<string, { name: string; count: number; revenue: number; imageUrl?: string; category: string }> = {};
    orders.forEach(order => {
      if (order.status === 'cancelled') return;
      order.items.forEach(item => {
        if (!itemCounts[item.productId]) {
          const prod = products.find(p => p.id === item.productId);
          itemCounts[item.productId] = { 
            name: item.name, 
            count: 0, 
            revenue: 0, 
            imageUrl: prod?.imageUrl,
            category: prod?.category || 'General'
          };
        }
        itemCounts[item.productId].count += (item as any).quantity || 1;
        itemCounts[item.productId].revenue += ((item as any).price || 0) * ((item as any).quantity || 1);
      });
    });
    return Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [orders, products]);

  const handleDownloadSalesReport = () => {
    const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Status', 'Payment Method'];
    const csvContent = [
      headers.join(','),
      ...orders.map(o => [
        o.id,
        o.createdAt instanceof Date ? o.createdAt.toLocaleDateString() : 'N/A',
        o.customerName,
        o.totalAmount,
        o.status,
        o.paymentMethod
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales report exported successfully!');
  };

  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [isProductUploading, setIsProductUploading] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteOrderModalOpen, setIsDeleteOrderModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    active: true,
    productId: null
  });

  // POS Enhanced States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderType, setOrderType] = useState<'walk_in' | 'pickup' | 'delivery'>('walk_in');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money'>('cash');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [posCustomer, setPosCustomer] = useState<any>(null);

  // Retail Location States (Formerly Tables)
  const [sections, setSections] = useState<any[]>([]);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [newSection, setNewSection] = useState({ number: '', capacity: 10 });
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

  // Settings State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [updatedProfile, setUpdatedProfile] = useState<Partial<VendorProfile>>({});
  const [inventorySearch, setInventorySearch] = useState('');
  const [stockLevelFilter, setStockLevelFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (!branchFilter) return orders;
    return orders.filter(o => o.branchId === branchFilter);
  }, [orders, branchFilter]);

  // QR Builder State
  const [isQrBuilderOpen, setIsQrBuilderOpen] = useState(false);
  const [printDetails, setPrintDetails] = useState({
    header: '',
    subHeader: 'ORODHA YA KIDIJITALI',
    footer: 'CHANGANUA HAPA KUTAZAMA BIDHAA & KUAGIZA',
    address: '',
    phone: '',
    isPrintMode: false,
    showLogo: true,
    accentColor: '#ea580c',
    headerBg: '#1A1A1A'
  });
  const [qrOptions, setQrOptions] = useState<any>({
    width: 300,
    height: 300,
    data: '',
    image: '',
    dotsOptions: {
      color: '#000000',
      type: 'square' as DotType
    },
    backgroundOptions: {
      color: '#ffffff',
    },
    cornersSquareOptions: {
      color: '#000000',
      type: 'square' as CornerSquareType
    },
    cornersDotOptions: {
      color: '#000000',
      type: 'square' as CornerDotType
    },
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: 'Q'
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 0
    }
  });

  const qrRef = React.useRef<HTMLDivElement>(null);
  const qrPrintRef = React.useRef<HTMLDivElement>(null);
  const [qrCodeInstance, setQrCodeInstance] = useState<QRCodeStyling | null>(null);

  useEffect(() => {
    if (vendorProfile && Object.keys(updatedProfile).length === 0) {
      setUpdatedProfile({
        businessName: vendorProfile.businessName || '',
        description: vendorProfile.description || '',
        address: vendorProfile.address || '',
        phoneNumber: vendorProfile.phoneNumber || '',
        operatingHours: vendorProfile.operatingHours || '',
        logoUrl: vendorProfile.logoUrl || '',
        bannerUrl: vendorProfile.bannerUrl || '',
        location: vendorProfile.location,
        deliveryFees: vendorProfile.deliveryFees || {},
        category: vendorProfile.category,
        orderInstructions: vendorProfile.orderInstructions || ''
      });
    }
  }, [vendorProfile]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const options = {
        ...qrOptions,
        width: 300,
        height: 300,
      };
      setQrCodeInstance(new QRCodeStyling(options));
    }
  }, [qrOptions]);

  useEffect(() => {
    if (isQrBuilderOpen && qrCodeInstance) {
      // Clear and append to both potential ref locations
      // Small timeout ensures the DOM has switched after state change
      const timer = setTimeout(() => {
        if (qrRef.current) {
          qrRef.current.innerHTML = "";
          qrCodeInstance.append(qrRef.current);
        }
        if (qrPrintRef.current) {
          qrPrintRef.current.innerHTML = "";
          qrCodeInstance.append(qrPrintRef.current);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isQrBuilderOpen, qrCodeInstance, printDetails.isPrintMode]);

  const downloadQr = () => {
    if (qrCodeInstance) {
      qrCodeInstance.download({
        name: 'Table Stand QR Code',
        extension: 'png'
      });
    }
  };

  useEffect(() => {
    if (vendorProfile && !printDetails.header) {
      setPrintDetails(prev => ({ 
        ...prev, 
        header: vendorProfile.businessName || 'KARIBU SOKONI',
        address: vendorProfile.address || '',
        phone: vendorProfile.phoneNumber || ''
      }));
    }
  }, [vendorProfile]);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintOrder = (order: Order) => {
    setOrderToPrint(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const [isExporting, setIsExporting] = useState(false);
  const handleDownloadStand = async () => {
    const el = document.getElementById('printable-stand');
    if (!el || isExporting) return;
    
    setIsExporting(true);
    const toastId = toast.loading('Inatengeneza picha ya Stand...', {
      style: { background: '#000', color: '#fff' }
    });

    try {
      // Small delay to ensure styles are applied
      await new Promise(r => setTimeout(r, 500));
      
      const dataUrl = await toPng(el, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: '#FCFAF2',
        style: {
          borderRadius: '0' // Remove rounded corners for export if needed
        }
      });
      
      const link = document.createElement('a');
      link.download = `QR-Stand-${selectedSection?.number || 'Vendor'}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Stand imepakuliwa kwa mafanikio!', { id: toastId });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Imeshindwa kupakua stand. Jaribu tena.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bulkPrices, setBulkPrices] = useState<Record<string, number>>({});

  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'overview', label: t('overview') || 'Overview', icon: LayoutDashboard },
      { id: 'orders', label: vendorContext.ordersLabel, icon: vendorContext.ordersIcon, badge: orders.length > 0 ? orders.length : null },
      { id: 'products', label: vendorContext.inventoryLabel, icon: vendorContext.inventoryIcon },
      { id: 'pos', label: vendorContext.posLabel, icon: vendorContext.posIcon },
      { id: 'messages', label: 'Messages', icon: MessageIcon },
    ];

    if (vendorProfile?.category === 'restaurant') {
      baseTabs.push({ id: 'tables', label: 'Dining Tables', icon: Store });
    }

    if (vendorProfile?.category === 'bus_ticket') {
      baseTabs.push({ id: 'branches', label: 'Matawi / Offices', icon: MapPin });
    }

    const additionalTabs = [];
    if (vendorProfile?.category === 'grocery') {
      additionalTabs.push({ id: 'market_pulse', label: 'Market Pulse', icon: Zap });
      additionalTabs.push({ id: 'freshness', label: 'Freshness Monitor', icon: AlertCircle });
    }

    return [
      ...baseTabs,
      ...additionalTabs,
      { id: 'inventory_stats', label: 'Analytics', icon: BarChart3 },
      { id: 'coupons', label: 'Promotions', icon: Tag },
      { id: 'customers', label: 'CRM', icon: Users },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'settings', label: t('settings') || 'Settings', icon: Settings },
    ];
  }, [orders.length, t, vendorContext, vendorProfile?.category]);

  const categories = Array.from(new Set(['all', ...products.map(p => p.category).filter(Boolean)]));
  const filteredProducts = products.filter(p => 
    (selectedCategory === 'all' || p.category === selectedCategory)
  );

  // Onboarding Form State
  const [formData, setFormData] = useState({
    businessName: '',
    category: 'restaurant' as VendorCategory,
    description: '',
    tin: '',
    address: '',
    phoneNumber: '',
    logoUrl: '',
    bannerUrl: '',
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
    imageUrls: [],
  });

  // POS Cart State
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [isPackingMode, setIsPackingMode] = useState(true);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isKdsView, setIsKdsView] = useState(false);
  const [isOssView, setIsOssView] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: 'waiter', phone: '', branchId: '' });
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '', type: 'office' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const prevOrdersCount = React.useRef(orders.length);

  useEffect(() => {
    if (isVoiceEnabled && orders.length > prevOrdersCount.current) {
      const newOrder = orders[0];
      if (newOrder && newOrder.status === 'pending') {
        const msg = new SpeechSynthesisUtterance(`New order from ${newOrder.customerName || 'Customer'}`);
        window.speechSynthesis.speak(msg);
      }
    }
    prevOrdersCount.current = orders.length;
  }, [orders, isVoiceEnabled]);

  useEffect(() => {
    if (!vendorProfile?.id) return;
    
    const fetchStaff = async () => {
      const q = query(collection(db, 'staff'), where('vendorId', '==', vendorProfile.id));
      const snap = await getDocs(q);
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchStaff();

    const unsub = onSnapshot(query(collection(db, 'staff'), where('vendorId', '==', vendorProfile.id)), () => fetchStaff());

    return () => unsub();
  }, [vendorProfile?.id]);

  useEffect(() => {
    if (!vendorProfile?.id) return;
    
    const fetchBranches = async () => {
      const q = query(collection(db, 'branches'), where('vendorId', '==', vendorProfile.id));
      const snap = await getDocs(q);
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchBranches();
    const unsub = onSnapshot(query(collection(db, 'branches'), where('vendorId', '==', vendorProfile.id)), () => fetchBranches());
    return () => unsub();
  }, [vendorProfile?.id]);

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      await addDoc(collection(db, 'branches'), {
        ...newBranch,
        vendorId: vendorProfile.id,
        createdAt: serverTimestamp()
      });
      setIsAddBranchOpen(false);
      setNewBranch({ name: '', address: '', phone: '', type: 'office' });
      toast.success('Branch / Office added successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add branch');
    }
  };

  const deleteBranch = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'branches', id));
      toast.success('Branch removed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete branch');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      await addDoc(collection(db, 'staff'), {
        ...newStaff,
        vendorId: vendorProfile.id,
        vendorOwnerUid: user?.uid,
        createdAt: serverTimestamp()
      });
      setIsAddStaffOpen(false);
      setNewStaff({ name: '', role: 'waiter', phone: '', branchId: '' });
      toast.success('Staff member added successfully');
    } catch (error) {
      console.error(error);
    }
  };

  const deleteStaff = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'staff', id));
      toast.success('Staff member removed');
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchVendor = async () => {
      const path = 'vendors';
      try {
        const q = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const doc = snap.docs[0];
          setVendorProfile({ id: doc.id, ...doc.data() } as VendorProfile);
          setShowOnboarding(false);
        } else {
          setShowOnboarding(true);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();

    const path = 'vendors';
    const unsub = onSnapshot(
      query(collection(db, path), where('ownerUid', '==', user.uid)), 
      () => fetchVendor(),
      (error) => handleFirestoreError(error, OperationType.GET, path)
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!vendorProfile?.id || !user) return;
    
    const fetchOrders = async () => {
      const path = 'orders';
      try {
        const q = query(
          collection(db, path), 
          where('vendorId', '==', vendorProfile.id),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    const fetchProducts = async () => {
      const path = 'products';
      try {
        const q = query(collection(db, path), where('vendorId', '==', vendorProfile.id));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    const fetchSections = async () => {
      const path = 'tables';
      try {
        const q = query(collection(db, path), where('vendorId', '==', vendorProfile.id));
        const snap = await getDocs(q);
        setSections(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    fetchOrders();
    fetchProducts();
    fetchSections();

    const errorHandler = (path: string) => (error: any) => {
      handleFirestoreError(error, OperationType.GET, path);
    };

    const unsubs = [
      onSnapshot(query(collection(db, 'orders'), where('vendorId', '==', vendorProfile.id)), () => fetchOrders(), errorHandler('orders')),
      onSnapshot(query(collection(db, 'products'), where('vendorId', '==', vendorProfile.id)), () => fetchProducts(), errorHandler('products')),
      onSnapshot(query(collection(db, 'tables'), where('vendorId', '==', vendorProfile.id)), () => fetchSections(), errorHandler('tables')),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [vendorProfile?.id, user?.uid]);

  // Auto-occupy tables on new Dine-In orders for restaurants
  useEffect(() => {
    if (vendorProfile?.category !== 'restaurant' || orders.length === 0) return;
    
    // Only process very recent orders to avoid infinite loop or flickering
    const now = Date.now();
    orders.forEach(order => {
      const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : 0;
      // If order is walk_in (Dine In) and pending, and has table number, and is relatively fresh (within last 5 mins)
      if (order.status === 'pending' && order.orderType === 'walk_in' && order.tableNumber && (now - orderTime < 300000)) {
        const table = sections.find(s => s.number === order.tableNumber);
        if (table && table.status === 'available') {
          updateTableStatus(table.id, 'occupied');
        }
      }
    });
  }, [orders, sections, vendorProfile?.category]);

  useEffect(() => {
    if (vendorProfile) {
      setUpdatedProfile({
        businessName: vendorProfile.businessName || '',
        description: vendorProfile.description || '',
        address: vendorProfile.address || '',
        phoneNumber: vendorProfile.phoneNumber || '',
        logoUrl: vendorProfile.logoUrl || '',
        bannerUrl: vendorProfile.bannerUrl || '',
        operatingHours: vendorProfile.operatingHours || '',
        location: vendorProfile.location || { lat: -6.7924, lng: 39.2083 },
        socialLinks: vendorProfile.socialLinks || {
          whatsapp: '',
          instagram: '',
          facebook: ''
        }
      });
    }
  }, [vendorProfile]);

  useEffect(() => {
    if (!vendorProfile?.id || !user) return;
    
    const fetchCoupons = async () => {
      const q = query(collection(db, 'coupons'), where('vendorId', '==', vendorProfile.id));
      const snap = await getDocs(q);
      setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchCoupons();

    const unsub = onSnapshot(query(collection(db, 'coupons'), where('vendorId', '==', vendorProfile.id)), () => fetchCoupons());

    return () => unsub();
  }, [vendorProfile?.id, user?.uid]);

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
      // Update user profile category as well
      await updateDoc(doc(db, 'users', user.uid), {
        category: formData.category
      });
    } catch (error) {
      console.error(error);
    }
  };


  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | File[], isProductUpload = true) => {
    if (!files || files.length === 0) return;
    
    if (!vendorProfile?.id) {
      toast.error('Tafadhali subiri wasifu wa biashara upakiwe kwanza.');
      return;
    }

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error('Tafadhali weka picha pekee.');
      return;
    }

    if (isProductUpload) setIsProductUploading(true);
    else setIsBannerUploading(true); // Fallback to banner if not product (though usually handled elsewhere)
    
    setUploadProgress(0);
    
    try {
      const uploadPromises = validFiles.map(async (file, index) => {
        let path = '';
        if (isProductUpload) {
          path = storageService.getProductPath(vendorProfile.id, editingProduct?.id || 'new', file.name);
        } else {
          path = `${vendorProfile.id}/misc/${Date.now()}_${file.name}`;
        }
        return await storageService.uploadFile(isProductUpload ? 'products' : 'vendors', path, file, (progress) => {
          if (isProductUpload) setUploadProgress(progress);
        });
      });

      const urls = await Promise.all(uploadPromises);
      
      if (isProductUpload) {
        setNewProduct(prev => ({ 
          ...prev, 
          imageUrls: [...(prev.imageUrls || []), ...urls],
          imageUrl: prev.imageUrl || urls[0]
        }));
        toast.success(`${urls.length} picha zimepakiwa!`);
      }
      return urls;
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || 'Kuna tatizo lilitokea wakati wa kupakia.');
    } finally {
      if (isProductUpload) setIsProductUploading(false);
      else setIsBannerUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && vendorProfile?.id) {
      setIsLogoUploading(true);
      try {
        const path = storageService.getVendorPath(vendorProfile.id, 'logo', file.name);
        const url = await storageService.uploadFile('vendors', path, file);
        setUpdatedProfile(prev => ({ ...prev, logoUrl: url }));
        
        // Immediately update Firestore
        await updateDoc(doc(db, 'vendors', vendorProfile.id), {
          logoUrl: url,
          updatedAt: serverTimestamp()
        });
        
        toast.success("Logo imepakiwa na kuhifadhiwa!");
      } catch (error: any) {
        console.error("Logo upload error:", error);
        toast.error("Imeshindwa kupakia logo: " + error.message, {
          description: "Hakikisha 'Storage' imewekwa (Enabled) kwenye Firebase Console na Mradi ni sahihi.",
          duration: 6000
        });
      } finally {
        setIsLogoUploading(false);
      }
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && vendorProfile?.id) {
      setIsBannerUploading(true);
      try {
        const path = storageService.getVendorPath(vendorProfile.id, 'banner', file.name);
        const url = await storageService.uploadFile('vendors', path, file);
        setUpdatedProfile(prev => ({ ...prev, bannerUrl: url }));
        
        // Immediately update Firestore
        await updateDoc(doc(db, 'vendors', vendorProfile.id), {
          bannerUrl: url,
          updatedAt: serverTimestamp()
        });
        
        toast.success("Banner imepakiwa na kuhifadhiwa!");
      } catch (error: any) {
        console.error("Banner upload error:", error);
        toast.error("Imeshindwa kupakia banner: " + error.message, {
          description: "Hakikisha 'Storage' imewekwa (Enabled) kwenye Firebase Console na Mradi ni sahihi.",
          duration: 6000
        });
      } finally {
        setIsBannerUploading(false);
      }
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
      handleFileUpload(files);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    const productData = Object.fromEntries(
      Object.entries(newProduct).filter(([_, v]) => v !== undefined)
    );

    try {
      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productData,
          vendorCategory: vendorProfile.category,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          vendorId: vendorProfile.id,
          vendorOwnerUid: user.uid,
          vendorCategory: vendorProfile.category,
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
        imageUrls: [],
        branchId: '',
      });
    } catch (error) {
      console.error(error);
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
      console.error(error);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrderToDelete(orderId);
    setIsDeleteOrderModalOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete));
      toast.success('Oda imefutwa kikamilifu!');
      setIsDeleteOrderModalOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error(error);
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
      imageUrls: product.imageUrls || (product.imageUrl ? [product.imageUrl] : []),
      branchId: (product as any).branchId || '',
    });
    setIsAddProductOpen(true);
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      await addDoc(collection(db, 'coupons'), {
        ...newCoupon,
        vendorId: vendorProfile.id,
        vendorOwnerUid: user?.uid,
        createdBy: user?.uid,
        createdAt: serverTimestamp()
      });
      setIsAddCouponOpen(false);
      setNewCoupon({ code: '', discountType: 'percentage', discountValue: 0, active: true, productId: null });
      toast.success('Coupon added successfully!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      toast.success('Coupon deleted.');
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    setIsSavingSettings(true);
    try {
      const cleanProfile = Object.entries(updatedProfile).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await updateDoc(doc(db, 'vendors', vendorProfile.id), {
        ...cleanProfile,
        updatedAt: serverTimestamp()
      });
      
      toast.success('Duka limefanyiwa maboresho!');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingSettings(false);
    }
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

  const filteredInventory = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || 
                         p.id?.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStock = stockLevelFilter === 'all' || 
                        (stockLevelFilter === 'low' && p.stock < 10) || 
                        (stockLevelFilter === 'out' && p.stock === 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0 || !vendorProfile?.id || !user) return;
    
    if (paymentMethod === 'mobile_money' && !posCustomer?.phone) {
      toast.error('Tafadhali ongeza namba ya simu ya mteja ili kufanya malipo ya simu.');
      setIsAddCustomerModalOpen(true);
      return;
    }

    setIsProcessingSale(true);
    try {
      const orderData = {
        vendorId: vendorProfile.id,
        vendorOwnerUid: user.uid,
        customerId: posCustomer ? (posCustomer.id || 'POS_CUSTOMER') : 'WALK_IN_CUSTOMER',
        customerName: posCustomer?.name || 'Walk-in Customer',
        customerPhone: posCustomer?.phone || '',
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity
        })),
        totalAmount: cartTotal * 1.18, // Total with tax
        subtotal: cartTotal,
        taxAmount: cartTotal * 0.18,
        status: 'pending',
        orderSource: 'pos',
        orderType: orderType,
        tableNumber: (orderType === 'walk_in' || orderType === 'pickup') ? tableNumber : null,
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deliveryAddress: orderType === 'delivery' ? (posCustomer?.address || 'POS Delivery') : 'In-Store POS',
        branchId: branchFilter || null,
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = orderRef.id;
      
      // Auto-occupy table if it's a restaurant Dine-In
      if (orderType === 'walk_in' && vendorProfile.category === 'restaurant' && tableNumber) {
        const tableToOccupy = sections.find(s => s.number === tableNumber);
        if (tableToOccupy) {
          await updateTableStatus(tableToOccupy.id, 'occupied');
        }
      }
      
      // If Mobile Money, initiate Mongike payment
      if (paymentMethod === 'mobile_money' && posCustomer?.phone) {
        toast.info('Inatuma ombi la malipo kwenye simu ya mteja...');
        try {
          const formattedPhone = posCustomer.phone.startsWith('0') 
            ? '255' + posCustomer.phone.substring(1) 
            : posCustomer.phone.replace('+', '');
            
          await initiatePayment({
            order_id: orderId,
            amount: Math.round(cartTotal * 1.18),
            buyer_phone: formattedPhone,
            fee_payer: 'MERCHANT'
          });
          toast.success('Ombi la malipo limetumwa! Mteja aweke siri kukamilisha.');
        } catch (payError: any) {
          console.error('Mongike initiation failed:', payError);
          toast.error('Imeshindwa kutuma ombi la malipo: ' + payError.message);
        }
      } else {
        toast.success('Malipo yamekamilika! Oda imehifadhiwa na kutumwa kwa Packaging.');
      }

      setCart([]);
      setPosCustomer(null);
      setTableNumber('');
      setOrderType('walk_in');
      setActiveTab('orders');
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    try {
      await addDoc(collection(db, 'tables'), {
        ...newSection,
        vendorId: vendorProfile.id,
        vendorOwnerUid: user?.uid,
        status: 'available',
        createdAt: serverTimestamp()
      });
      setIsAddSectionOpen(false);
      setNewSection({ number: '', capacity: 10 });
      toast.success('Shelf/Section added successfully!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteSection = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tables', id));
      toast.success('Section removed.');
    } catch (error) {
      console.error(error);
    }
  };

  const updateTableStatus = async (tableId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'tables', tableId), { status });
      toast.success('Table status updated!');
    } catch (error) {
      console.error(error);
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
            <h1 className="text-3xl font-bold italic uppercase tracking-tighter">Vendor Onboarding</h1>
            <p className="text-orange-100 mt-2 font-medium">Register your business to start selling on Papo Hapo's retail network.</p>
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
                      <SelectItem value="restaurant">Restaurant / Hoteli ya Chakula</SelectItem>
                      <SelectItem value="grocery">Grocery / Sokoni</SelectItem>
                      <SelectItem value="pharmacy">Pharmacy / Duka la Dawa</SelectItem>
                      <SelectItem value="ecommerce">Shop / Maduka</SelectItem>
                      <SelectItem value="salon">Salon / Kinyozi</SelectItem>
                      <SelectItem value="hotel">Hotel / Malazi</SelectItem>
                      <SelectItem value="bus_ticket">Bus Ticket Booking</SelectItem>
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
                <div className="flex gap-2">
                  <Input 
                    required 
                    className="h-12 rounded-xl flex-1" 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    placeholder="Full business address" 
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setIsLocationPickerOpen(true)}
                    className="h-12 px-4 rounded-xl border-orange-200 text-orange-600 font-bold shrink-0 gap-2"
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="hidden sm:inline">Chagua kwenye Ramani</span>
                  </Button>
                </div>
                {(formData as any).location && (
                  <p className="text-[10px] text-neutral-500 italic">
                    Location set: {(formData as any).location.lat.toFixed(4)}, {(formData as any).location.lng.toFixed(4)}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-lg font-bold rounded-2xl shadow-lg shadow-orange-200 transition-all hover:scale-[1.02]">
                Submit Application
              </Button>
            </form>
          </div>
        </motion.div>

        <LocationPicker 
          isOpen={isLocationPickerOpen}
          onClose={() => setIsLocationPickerOpen(false)}
          onSelect={(loc) => {
            setFormData({
              ...formData,
              address: loc.address,
              location: { lat: loc.lat, lng: loc.lng }
            } as any);
          }}
          initialLocation={(formData as any).location ? { ...(formData as any).location, address: formData.address || '' } : undefined}
        />
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


  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      const alertMsg = newStatus === 'accepted' ? 'Order Accepted' : (newStatus === 'cancelled' ? 'Order Cancelled' : `Order #${orderId.slice(-4)} moved to ${newStatus}`);
      toast.success(alertMsg);
    } catch (error) {
       console.error(error);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'accepted': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'preparing': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'prepared': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed': return 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20';
    }
  };

  const renderFulfillmentColumn = (title: string, statusList: OrderStatus[], color: string) => {
    const filteredOrders = orders.filter(o => statusList.includes(o.status));
    return (
      <div className="flex-1 min-w-[320px] bg-neutral-100/50 dark:bg-neutral-900/30 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800/50 flex flex-col gap-6 h-[calc(100vh-280px)] overflow-hidden transition-colors">
        <div className="flex items-center justify-between">
           <h3 className={`font-black uppercase tracking-widest text-[10px] ${color}`}>{title}</h3>
           <Badge variant="outline" className="bg-black/5 dark:bg-white/5 border-none text-neutral-500 font-black">{filteredOrders.length}</Badge>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
           {filteredOrders.map((order, idx) => (
             <motion.div 
               layout
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               key={`fulfillment-card-${order.id || idx}`}
               className="bg-card dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl space-y-4 hover:border-orange-600/30 transition-all cursor-pointer group"
             >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      {vendorProfile?.category === 'bus_ticket' ? 'Ticket ID' : 'Order ID'}
                    </span>
                    <p className="font-bold text-sm text-neutral-900 dark:text-white transition-colors">
                      {vendorProfile?.category === 'bus_ticket' ? `TKT-${order.id?.slice(-4).toUpperCase()}` : `#${order.id?.slice(-6).toUpperCase()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {order.orderType === 'walk_in' && (
                      <Badge className="bg-orange-600 text-white border-none text-[8px] font-black uppercase">
                        {vendorProfile?.category === 'bus_ticket' ? 'Counter' : 'Soko/In-Store'}
                      </Badge>
                    )}
                    {order.orderType === 'delivery' && (
                      <Badge className="bg-blue-600 text-white border-none text-[8px] font-black uppercase">
                        {vendorProfile?.category === 'bus_ticket' ? 'Booking' : 'Delivery'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                   {order.items.map((item: any, idx: number) => (
                     <div key={`kds-item-${order.id}-${idx}`} className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                          <span className="w-5 h-5 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-black text-neutral-900 dark:text-white transition-colors">
                            {item.quantity}
                          </span>
                          <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors">
                            {vendorProfile?.category === 'bus_ticket' ? `${item.name} Ticket` : item.name}
                          </span>
                        </div>
                     </div>
                   ))}
                </div>

                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-950 flex items-center justify-between transition-colors">
                   <div className="flex items-center gap-2 text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{order.createdAt ? format(new Date(order.createdAt), 'HH:mm') : 'Now'}</span>
                   </div>
                   <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'preparing')}
                        >
                          {vendorProfile?.category === 'bus_ticket' ? 'Verify Ticket' : 'Accept Order'}
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'prepared')}
                        >
                          {vendorProfile?.category === 'bus_ticket' ? 'Ready Board' : 'Mark Ready'}
                        </Button>
                      )}
                       {order.status === 'prepared' && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'completed')}
                        >
                          {vendorProfile?.category === 'bus_ticket' ? 'Departed' : 'Finish'}
                        </Button>
                      )}
                      <Button
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-neutral-600 hover:text-orange-500 hover:bg-orange-600/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintOrder(order);
                        }}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-neutral-600 hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrder(order.id!);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                </div>
             </motion.div>
           ))}
           {filteredOrders.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                <Layout className="w-12 h-12 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">No orders</p>
             </div>
           )}
        </div>
      </div>
    );
  };

  const ordersTab = (
    <motion.div 
      key="orders"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">{vendorContext.ordersLabel}</h1>
          <p className="text-neutral-500 font-medium">{vendorContext.ordersDescription}</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-neutral-900 rounded-2xl border border-neutral-800">
           {branches.length > 0 && (
             <Select value={branchFilter || 'all'} onValueChange={val => setBranchFilter(val === 'all' ? null : val)}>
               <SelectTrigger className="h-10 bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-neutral-400 w-32 md:w-40">
                 <SelectValue placeholder="Matawi Yote" />
               </SelectTrigger>
               <SelectContent className="bg-neutral-950 border-neutral-800 text-white">
                 <SelectItem value="all">Matawi Yote</SelectItem>
                 {branches.map(b => (
                   <SelectItem key={`ord-filter-br-${b.id}`} value={b.id || ''}>{b.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
           {branches.length > 0 && <div className="w-px h-6 bg-neutral-800 mx-1" />}
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
             className={`rounded-xl h-10 px-4 font-bold text-[10px] uppercase tracking-widest ${isVoiceEnabled ? 'text-orange-500 bg-orange-500/10' : 'text-neutral-500'}`}
             title="Voice Alerts"
           >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
           </Button>
           <div className="w-px h-6 bg-neutral-800 mx-1" />
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setIsKdsView(true)}
             className="rounded-xl h-10 px-4 font-bold text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white"
             title={vendorProfile?.category === 'bus_ticket' ? "Manifest View" : "Kitchen Display System"}
           >
              {vendorProfile?.category === 'bus_ticket' ? <ClipboardList className="w-4 h-4" /> : <ChefHat className="w-4 h-4" />}
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setIsOssView(true)}
             className="rounded-xl h-10 px-4 font-bold text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white"
             title={vendorProfile?.category === 'bus_ticket' ? "Passenger Display" : "Order Status Screen"}
           >
              {vendorProfile?.category === 'bus_ticket' ? <Users className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
           </Button>
           <div className="w-px h-6 bg-neutral-800 mx-1" />
           <Button 
             variant={isPackingMode ? 'default' : 'ghost'} 
             onClick={() => setIsPackingMode(true)}
             className={`rounded-xl h-10 px-6 font-bold text-[10px] uppercase tracking-widest ${isPackingMode ? 'bg-orange-600 shadow-lg shadow-orange-900/20' : 'text-neutral-500'}`}
           >
              Fulfillment
           </Button>
           <Button 
             variant={!isPackingMode ? 'default' : 'ghost'} 
             onClick={() => setIsPackingMode(false)}
             className={`rounded-xl h-10 px-6 font-bold text-[10px] uppercase tracking-widest ${!isPackingMode ? 'bg-orange-600 shadow-lg shadow-orange-900/20' : 'text-neutral-500'}`}
           >
              List View
           </Button>
        </div>
      </div>

      {isPackingMode ? (
        <div className="flex gap-8 overflow-x-auto no-scrollbar pb-8 min-h-[600px]">
           {renderFulfillmentColumn(vendorContext.awaitingLabel, ["pending"], "text-yellow-500")}
           {renderFulfillmentColumn(vendorContext.pickingLabel, ["preparing", "accepted"], "text-orange-500")}
           {renderFulfillmentColumn(vendorContext.readyLabel, ["prepared"], "text-purple-500")}
           {renderFulfillmentColumn("Archive / Sent", ["delivered", "completed"], "text-green-500")}
        </div>
      ) : (
         <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 transition-colors">
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    {vendorProfile?.category === 'bus_ticket' ? 'Tiketi / Abiria' : 'Order Details'}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    {vendorProfile?.category === 'bus_ticket' ? 'Trip Info' : 'Mode'}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    {vendorProfile?.category === 'bus_ticket' ? 'Seats' : 'Items'}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Amount</th>
                  {branches.length > 0 && (
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Tawi / Branch</th>
                  )}
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 transition-colors">
                {filteredOrders.map((order, idx) => (
                  <tr key={`orders-table-row-${order.id}-${idx}`} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                          {vendorProfile?.category === 'bus_ticket' ? <Ticket className="w-6 h-6" /> : <Receipt className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-white text-lg transition-colors">
                            {vendorProfile?.category === 'bus_ticket' ? `TKT-${order.id?.slice(-4).toUpperCase()}` : `#${order.id?.slice(-6).toUpperCase()}`}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">
                            {vendorProfile?.category === 'bus_ticket' ? `Passenger: ${order.customerName}` : order.customerName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={`border-none ${order.orderSource === 'pos' ? 'bg-orange-600/10 text-orange-600' : 'bg-blue-600/10 text-blue-600'} text-[10px] font-black px-2.5 py-1 uppercase`}>
                           {vendorProfile?.category === 'bus_ticket' 
                             ? (order.orderSource === 'pos' ? 'Counter' : 'Online') 
                             : (order.orderSource === 'pos' ? 'In-Store POS' : 'Online App')}
                        </Badge>
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest ml-1">
                          {vendorProfile?.category === 'bus_ticket' ? 'Bus Ticket' : order.orderType}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-neutral-500 dark:text-neutral-400 transition-colors">
                        {vendorProfile?.category === 'bus_ticket' ? `${order.items.length} Seats` : `${order.items.length} Items`}
                      </p>
                      <p className="text-[10px] text-neutral-600 truncate max-w-[150px]">
                        {vendorProfile?.category === 'bus_ticket' 
                          ? `${order.items[0]?.name || 'Unknown trip'}` 
                          : `${order.items[0]?.name}...`}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-neutral-900 dark:text-white text-lg transition-colors">TZS {order.totalAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{order.paymentMethod}</p>
                    </td>
                    {branches.length > 0 && (
                      <td className="px-8 py-6">
                         {order.branchId ? (
                           <div className="flex flex-col gap-0.5">
                             <div className="flex items-center gap-1.5">
                               <MapPin className="w-3 h-3 text-orange-600" />
                               <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-tighter transition-colors">
                                 {branches.find(b => b.id === order.branchId)?.name || 'Unknown'}
                               </span>
                             </div>
                             <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest pl-4">Branch Sale</span>
                           </div>
                         ) : (
                           <div className="flex items-center gap-1.5 opacity-50">
                              <Globe className="w-3 h-3 text-neutral-400" />
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Main / Online</span>
                           </div>
                         )}
                      </td>
                    )}
                    <td className="px-8 py-6 text-right">
                      <Badge className={`${getStatusColor(order.status)} border rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest`}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-neutral-500 hover:text-orange-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                          onClick={() => handlePrintOrder(order)}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-neutral-500 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                          onClick={() => handleDeleteOrder(order.id!)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-12rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl relative transition-colors duration-300">
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg">
            <Store className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-bold text-xs truncate max-w-[150px]">{vendorProfile?.businessName}</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-neutral-400"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <MoreVertical className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar - Desktop and Mobile Overlay */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 w-64 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-8 z-40 transition-all duration-300 lg:z-auto
      `}>
        <div className="hidden lg:flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm truncate w-32">{vendorProfile?.businessName}</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{vendorProfile?.category}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto no-scrollbar">
          {tabs.map((item) => (
            <button
              key={`tab-nav-${item.id}`}
              onClick={() => {
                setActiveTab(item.id as TabType);
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                activeTab === item.id 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                  : 'text-neutral-500 hover:bg-white dark:hover:bg-neutral-800 hover:text-orange-600 dark:hover:text-white border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
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

        <div className="mt-auto pt-6 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-neutral-400 dark:text-neutral-500 hover:text-orange-600 dark:hover:text-white transition-colors group">
            <History className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-medium text-sm">Switch Role</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Overlay Background */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto w-full">
        {/* Top Bar - Only on Desktop typically, but we adjust for mobile */}
        <header className="h-20 border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-8 flex items-center justify-between bg-white/80 dark:bg-neutral-900/20 backdrop-blur-xl sticky top-0 z-10 w-full transition-colors duration-300">
          <div className="hidden sm:flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search orders, products..." 
                className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-none rounded-xl pl-10 pr-4 h-10 text-sm focus:ring-2 focus:ring-orange-600 transition-all text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" className="rounded-xl font-bold gap-2 text-neutral-500 hover:text-orange-600 transition-colors">
                <Home className="w-5 h-5" />
                <span className="hidden lg:inline text-xs uppercase tracking-widest">Home</span>
              </Button>
            </Link>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2 hidden md:block"></div>
            <Button 
              onClick={() => setIsAddProductOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 gap-2 h-10 rounded-xl px-4 font-bold hidden md:flex"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2 hidden md:block transition-colors"></div>
            <button className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-white transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-600 rounded-full border-2 border-white dark:border-neutral-900 transition-colors"></span>
            </button>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2 transition-colors"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-neutral-900 dark:text-white">{profile?.displayName}</p>
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8 pb-12"
              >
                {/* Header Info */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter">Business Overview</h1>
                    <p className="text-neutral-500 font-medium">Monitoring your store performance in real-time.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white gap-2 h-11 px-5"
                      onClick={() => toast.info('Data export requested. Your report will be available shortly.')}
                    >
                      <Download className="w-4 h-4" /> Export Data
                    </Button>
                    <Button 
                      className="rounded-xl bg-orange-600 hover:bg-orange-700 gap-2 h-11 px-6 font-bold shadow-lg shadow-orange-900/20"
                      onClick={() => {
                        window.location.reload();
                      }}
                    >
                      <Zap className="w-4 h-4" /> Live Sync
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[
                    { label: "Add Item", icon: Plus, action: () => { setActiveTab('products'); setIsAddProductOpen(true); }, color: "bg-orange-600" },
                    { label: "New Order", icon: ShoppingBag, action: () => setActiveTab('pos'), color: "bg-blue-600" },
                    { label: "Stock Stats", icon: BarChart3, action: () => setActiveTab('inventory_stats'), color: "bg-purple-600" },
                    { label: "Customers", icon: Users, action: () => setActiveTab('customers'), color: "bg-emerald-600" },
                    { label: "Coupons", icon: Tag, action: () => setActiveTab('coupons'), color: "bg-pink-600" },
                    { label: "Help", icon: AlertCircle, action: () => toast.info('Support team contacted.'), color: "bg-neutral-800" },
                  ].map((action, i) => (
                    <motion.button
                      key={`quick-action-${action.label}-${i}`}
                      whileHover={{ y: -4, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={action.action}
                      className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-orange-600/30 transition-all gap-3 overflow-hidden relative group shadow-sm"
                    >
                      <div className="absolute inset-0 bg-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className={`p-4 rounded-2xl ${action.color} text-white shadow-lg relative z-10 transition-transform group-hover:scale-110`}>
                        <action.icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-white relative z-10">{action.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Main Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Gross Sales", value: `TZS ${(orders.reduce((s,o) => s + o.totalAmount, 0)).toLocaleString()}`, icon: Banknote, trend: "+12.5%", positive: true, sub: "Total revenue generated", data: chartData.map(d => ({ value: d.sales })) },
                    { label: "Processing", value: orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length.toString(), icon: Clock, trend: "+3 new", positive: true, sub: "Orders being packed/shipped", data: chartData.map(d => ({ value: d.orders })) },
                    { label: "Available Items", value: products.length.toString(), icon: Box, trend: "Stable", positive: true, sub: "Unique products listed", data: [{value: 4}, {value: 6}, {value: 5}, {value: 8}, {value: 7}, {value: 10}] },
                    { label: "Customer Rating", value: (vendorProfile?.rating || 0).toFixed(1), icon: Star, trend: `${vendorProfile?.ratingCount || 0} reviews`, positive: true, sub: "Average feedback score", data: [{value: 5}, {value: 4}, {value: 5}, {value: 5}, {value: 5}, {value: 5}] },
                    { label: "Low Stock", value: products.filter(p => p.stock < 10).length.toString(), icon: AlertCircle, trend: "Caution", positive: false, sub: "Products needing restock", data: [{value: 8}, {value: 5}, {value: 6}, {value: 4}, {value: 2}, {value: 3}] },
                  ].map((stat, i) => (
                    <Card key={`stat-card-${stat.label}-${i}`} className="bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 backdrop-blur-sm overflow-hidden group hover:border-orange-600/50 transition-all cursor-default shadow-sm relative">
                      <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                            <stat.icon className="w-6 h-6" />
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                            stat.positive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {stat.trend}
                          </div>
                        </div>
                        <h3 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tighter mb-1">{stat.value}</h3>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-[10px] text-neutral-600 font-medium mb-6">{stat.sub}</p>
                        
                        {/* Sparkline */}
                        <div className="h-10 w-full opacity-50 group-hover:opacity-100 transition-opacity">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stat.data}>
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={stat.positive ? "#10b981" : "#ef4444"} 
                                strokeWidth={2} 
                                dot={false} 
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {vendorProfile?.category === 'grocery' && products.some(p => p.expiryDate && new Date(p.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) && (
                    <Card className="bg-red-500/5 border-red-500/20 backdrop-blur-sm lg:col-span-4 p-6 border-2 border-dashed relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                         <AlertCircle className="w-32 h-32 rotate-12" />
                      </div>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="p-4 rounded-2xl bg-red-500 text-white shadow-lg animate-pulse">
                            <AlertCircle className="w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Freshness Alert / Tahadhari ya Ubora</h3>
                            <p className="text-sm text-neutral-400 font-medium">You have {products.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length} items expiring within 7 days.</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => setActiveTab('freshness')}
                          className="bg-white text-red-600 hover:bg-neutral-100 font-black uppercase tracking-widest text-xs px-8 h-12 rounded-xl shadow-xl"
                        >
                          Review Items Now
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Complex Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 p-8 transition-colors">
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic text-neutral-900 dark:text-white transition-colors">Revenue Stream</h3>
                        <p className="text-xs text-neutral-500">Hourly sales performance</p>
                      </div>
                      <div className="flex bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 transition-colors">
                        <button className="px-4 py-2 text-[10px] font-bold uppercase bg-orange-600 text-white rounded-lg">Sales</button>
                        <button className="px-4 py-2 text-[10px] font-bold uppercase text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Orders</button>
                      </div>
                    </div>
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                          <XAxis dataKey="name" stroke="#404040" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} dy={10} />
                          <YAxis stroke="#404040" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '16px', color: '#fff' }}
                            cursor={{ stroke: '#ea580c', strokeWidth: 2 }}
                          />
                          <Area type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="bg-white dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 p-8 flex flex-col justify-between transition-colors">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight italic text-neutral-900 dark:text-white transition-colors">Inventory Mix</h3>
                      <p className="text-xs text-neutral-500">Distribution by category</p>
                    </div>
                    <div className="h-[250px] w-full mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => ({
                              name: cat,
                              value: products.filter(p => p.category === cat).length
                            }))}
                            cx="50%" cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                          {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map((cat, index) => (
                            <Cell key={`insight-cell-${cat}-${index}`} fill={['#ea580c', '#f97316', '#fb923c', '#fdba74'][index % 4]} />
                          ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderRadius: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {Array.from(new Set(products.map(p => p.category).filter(Boolean))).slice(0, 4).map((cat, i) => (
                        <div key={`insight-legend-${cat}-${i}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#ea580c', '#f97316', '#fb923c', '#fdba74'][i % 4] }}></div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{cat}</span>
                          </div>
                          <span className="text-xs font-bold text-white">{products.filter(p => p.category === cat).length} items</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Stock Alerts & Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Low Stock Alerts</h3>
                        <p className="text-xs text-neutral-500">Items that need restocking soon</p>
                      </div>
                      <Badge className="bg-red-500/10 text-red-500 border-none font-black uppercase tracking-widest text-[10px]">
                        {products.filter(p => p.stock < 10).length} ALERTS
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      {products.filter(p => p.stock < 10).slice(0, 4).map((item, idx) => (
                        <div key={`low-stock-${item.id}-${idx}`} className="flex items-center justify-between bg-neutral-950/50 p-4 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-neutral-800 overflow-hidden">
                                {item.imageUrl ? (
                                  <img 
                                    src={item.imageUrl} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                    }}
                                  />
                                ) : (
                                  <Package className="w-full h-full p-2.5 opacity-10" />
                                )}
                             </div>
                             <div>
                                <p className="font-bold text-sm text-white">{item.name}</p>
                                <p className="text-[10px] text-neutral-500 uppercase font-black">{item.category}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-red-500 text-sm">{item.stock} left</p>
                             <button onClick={() => { setActiveTab('products'); handleEditProduct(item); }} className="text-[8px] font-black uppercase text-orange-600 hover:underline">Restock</button>
                          </div>
                        </div>
                      ))}
                      {products.filter(p => p.stock < 10).length === 0 && (
                        <div className="py-12 text-center opacity-20">
                           <Zap className="w-12 h-12 mx-auto mb-3" />
                           <p className="text-xs font-black uppercase tracking-[0.3em]">All stock stable</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight italic">Live Orders</h3>
                        <p className="text-xs text-neutral-500">Ongoing stock & fulfillment activity</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-orange-600" onClick={() => setActiveTab('orders')}>View Fulfillment</Button>
                    </div>
                    <div className="space-y-6">
                      {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').slice(0, 5).map((order, idx) => (
                        <div key={`live-order-${order.id || idx}`} className="flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                               order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 
                               order.status === 'preparing' ? 'bg-orange-600/10 text-orange-600' :
                               'bg-green-500/10 text-green-500'
                             }`}>
                                <Clock className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="font-bold text-white text-sm">#{order.id?.slice(-6).toUpperCase()}</p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase">{order.customerName}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <Badge className={`${getStatusColor(order.status)} border-none text-[8px] font-black uppercase tracking-widest px-2`}>{order.status}</Badge>
                             <p className="text-[10px] text-neutral-600 font-bold uppercase mt-1">{format(order.createdAt?.toDate() || new Date(), 'p')}</p>
                          </div>
                        </div>
                      ))}
                      {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length === 0 && (
                        <div className="py-20 text-center opacity-20">
                           <ShoppingCart className="w-16 h-16 mx-auto mb-4" />
                           <p className="font-black uppercase tracking-[0.5rem] text-xs">Awaiting Orders</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Second row of insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                    <h3 className="text-xl font-black uppercase tracking-tight italic mb-6">Recent Sales</h3>
                    <div className="space-y-6">
                      {orders.slice(0, 5).map((order, idx) => (
                        <div key={`recent-sale-${order.id || idx}`} className="flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                                <Receipt className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="font-bold text-white text-sm">#{order.id?.slice(-6).toUpperCase()}</p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase">{order.customerName}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-sm text-white">TZS {order.totalAmount.toLocaleString()}</p>
                             <p className="text-[9px] text-neutral-600 font-bold uppercase">{order.paymentMethod}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="bg-neutral-900/40 border-neutral-800 p-8 flex flex-col justify-center items-center text-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-orange-600/10 flex items-center justify-center mb-6">
                      <Store className="w-10 h-10 text-orange-600" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight italic text-white">Upgrade to Pro</h3>
                    <p className="text-neutral-500 text-sm mt-2 max-w-xs">Get advanced analytics, multi-store sync, and priority fulfillment routing.</p>
                    <Button className="mt-8 rounded-2xl bg-white text-black hover:bg-neutral-200 h-12 px-8 font-black uppercase tracking-widest text-xs">Learn More</Button>
                  </Card>
                </div>
              </motion.div>
            )}
            {activeTab === 'orders' && ordersTab}

            {activeTab === 'pos' && (
              <motion.div 
                key="pos"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col xl:flex-row gap-8 h-full min-h-[700px] overflow-hidden"
              >
                {/* Product Selection */}
                <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-black italic uppercase italic tracking-tighter">{vendorContext.posLabel}</h2>
                      <p className="text-neutral-500 font-medium">{vendorContext.type === 'service' ? 'Quick session check-in' : 'Quick checkout and service'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                       {branches.length > 0 && (
                         <Select value={branchFilter || 'all'} onValueChange={val => setBranchFilter(val === 'all' ? null : val)}>
                            <SelectTrigger className="bg-neutral-950 border-neutral-800 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest text-orange-600 w-44">
                               <div className="flex items-center gap-2">
                                  <MapPin className="w-3 h-3" />
                                  <SelectValue placeholder="Branch" />
                               </div>
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                               <SelectItem value="all">HQ / All Branches</SelectItem>
                               {branches.map(b => (
                                 <SelectItem key={`pos-br-filter-${b.id}`} value={b.id || ''}>{b.name}</SelectItem>
                               ))}
                            </SelectContent>
                         </Select>
                       )}
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="bg-neutral-900 border-neutral-800 rounded-xl gap-2 h-11 px-5 font-bold"
                         onClick={() => setIsAddCustomerModalOpen(true)}
                       >
                         <UserPlus className="w-4 h-4 text-orange-600" />
                         Add Customer
                       </Button>
                       <div className="relative w-full md:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                         <Input placeholder="Search manually..." className="bg-neutral-900 border-neutral-800 pl-10 h-11 rounded-xl text-sm" />
                       </div>
                    </div>
                  </div>

                  {/* Category Selection Carousel */}
                  <div className="flex gap-3 pb-4 overflow-x-auto no-scrollbar">
                    {categories.map((cat, idx) => (
                      <Button
                        key={`pos-cat-btn-${cat}-${idx}`}
                        variant={selectedCategory === cat ? 'default' : 'ghost'}
                        onClick={() => setSelectedCategory(cat)}
                        className={`rounded-2xl px-6 h-12 border border-neutral-800 whitespace-nowrap font-black text-[10px] uppercase tracking-widest transition-all ${
                          selectedCategory === cat 
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xl shadow-orange-900/30 ring-2 ring-orange-600/20' 
                            : 'bg-neutral-900/40 text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product, pIdx) => (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={`pos-prod-${product.id || pIdx}`}
                        onClick={() => addToCart(product)}
                        className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-[2.5rem] hover:border-orange-600/50 transition-all text-left flex flex-col group relative overflow-hidden h-full"
                      >
                        <div className="aspect-square rounded-[2rem] bg-neutral-800/50 mb-4 overflow-hidden relative">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                              <Package className="w-12 h-12 opacity-10" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-orange-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                             <div className="bg-white text-black p-3 rounded-2xl shadow-xl">
                                <Plus className="w-6 h-6" />
                             </div>
                          </div>
                        </div>
                        <div className="px-1 mt-auto">
                          <h4 className="font-black text-sm text-white truncate mb-1 italic uppercase tracking-tight">
                            {vendorProfile?.category === 'bus_ticket' ? `${(product as any).origin} → ${(product as any).destination}` : product.name}
                          </h4>
                          <div className="flex items-center justify-between">
                            <p className="text-orange-500 font-black text-xs">TZS {product.price.toLocaleString()}</p>
                            <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest bg-neutral-950 px-2 py-0.5 rounded-lg border border-neutral-800">
                              {vendorProfile?.category === 'bus_ticket' ? `${product.stock} Seats` : `${product.stock} left`}
                            </span>
                          </div>
                          {vendorProfile?.category === 'bus_ticket' && (
                             <p className="text-[8px] text-neutral-500 font-bold uppercase mt-1">Bus: {product.name}</p>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Cart / Invoice Sidebar */}
                <div className="w-full xl:w-[450px] bg-neutral-950 border border-neutral-800 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl relative">
                  <div className="p-8 border-b border-white/5 space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-2xl italic flex items-center gap-3">
                        <Smartphone className="w-7 h-7 text-orange-600" /> Order Summary
                      </h3>
                      {posCustomer ? (
                         <div className="flex items-center gap-2 bg-orange-600/10 py-1.5 px-3 rounded-xl">
                            <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse"></div>
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{posCustomer.name}</span>
                         </div>
                      ) : (
                         <button onClick={() => setIsAddCustomerModalOpen(true)} className="text-[10px] font-black text-neutral-500 hover:text-orange-500 uppercase tracking-widest">Walking Customer</button>
                      )}
                    </div>

                    {/* Order Meta Selection */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 bg-neutral-900/50 p-2 rounded-2xl border border-white/5">
                        {[
                          { id: 'walk_in', label: vendorProfile?.category === 'bus_ticket' ? 'Standard' : (vendorContext.type === 'restaurant' ? 'Dine In' : 'Soko (In-Store)'), icon: vendorProfile?.category === 'bus_ticket' ? Bus : Store },
                          { id: 'pickup', label: vendorProfile?.category === 'bus_ticket' ? 'V.I.P' : 'Pickup', icon: vendorProfile?.category === 'bus_ticket' ? Star : ShoppingBag },
                          { id: 'delivery', label: vendorProfile?.category === 'bus_ticket' ? 'Booking' : 'Delivery', icon: vendorProfile?.category === 'bus_ticket' ? Ticket : Truck },
                        ].map((type, idx) => (
                          <button
                            key={`ot-${type.id}-${idx}`}
                            onClick={() => setOrderType(type.id as any)}
                            className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                              orderType === type.id 
                                ? 'bg-orange-600 text-white shadow-lg' 
                                : 'text-neutral-500 hover:text-white'
                            }`}
                          >
                            <type.icon className="w-4 h-4" />
                            <span className="text-[8px] font-black uppercase tracking-widest">{type.label}</span>
                          </button>
                        ))}
                      </div>

                      {orderType === 'walk_in' && vendorProfile?.category === 'restaurant' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2"
                        >
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 block mb-2">Select Table</label>
                           <Select value={tableNumber} onValueChange={setTableNumber}>
                              <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12 rounded-xl font-bold">
                                 <SelectValue placeholder="Choose a table..." />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                 {sections.map((s, idx) => (
                                   <SelectItem key={`pos-table-opt-${s.id || idx}`} value={s.number}>
                                      Table {s.number} {s.status === 'occupied' ? ' (Occupied)' : ''}
                                   </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </motion.div>
                      )}

                      {(orderType === 'pickup' || (orderType === 'walk_in' && vendorProfile?.category !== 'restaurant')) && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2"
                        >
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 block mb-2">{vendorContext.locationLabelSingular} Ref (Optional)</label>
                           <Input 
                              placeholder={`e.g. ${vendorContext.locationLabelSingular} 1`} 
                              value={tableNumber} 
                              onChange={(e) => setTableNumber(e.target.value)}
                              className="bg-neutral-900 border-neutral-800 h-12 rounded-xl font-bold"
                           />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar min-h-[200px]">
                    {cart.map((item, idx) => (
                      <div key={`pos-cart-item-${item.product.id}-${idx}`} className="flex justify-between items-center group animate-in slide-in-from-right-4 duration-300">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden relative">
                             {item.product.imageUrl ? (
                               <img 
                                src={item.product.imageUrl} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                }}
                              />
                             ) : (
                               <Package className="w-full h-full p-4 opacity-10" />
                             )}
                          </div>
                          <div className="flex flex-col justify-center">
                             <p className="font-bold text-white text-sm">{item.product.name}</p>
                             <div className="flex items-center gap-3 mt-1">
                                <button onClick={() => {
                                  if(item.quantity > 1) {
                                    setCart(cart.map(i => i.product.id === item.product.id ? {...i, quantity: i.quantity - 1} : i));
                                  } else {
                                    removeFromCart(item.product.id!);
                                  }
                                }} className="p-1 rounded bg-neutral-900 text-neutral-500 hover:bg-orange-600 hover:text-white transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-black text-orange-500">{item.quantity}</span>
                                <button onClick={() => addToCart(item.product)} className="p-1 rounded bg-neutral-900 text-neutral-500 hover:bg-orange-600 hover:text-white transition-colors">
                                  <Plus className="w-3 h-3" />
                                </button>
                             </div>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="font-black text-sm text-white">TZS {(item.product.price * item.quantity).toLocaleString()}</p>
                           <button onClick={() => removeFromCart(item.product.id!)} className="text-[8px] font-black uppercase text-neutral-700 hover:text-red-500 mt-1">Remove</button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-20 opacity-10">
                         <ShoppingCart className="w-16 h-16 mb-4" />
                         <p className="font-black uppercase tracking-[0.5rem] text-xs">Empty Cart</p>
                      </div>
                    )}
                  </div>

                  <div className="p-8 bg-neutral-900/50 border-t border-white/5 space-y-6 mt-auto">
                    <div className="space-y-2">
                       <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-widest">
                          <span>Sub Total</span>
                          <span className="text-white">TZS {cartTotal.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-widest">
                          <span>TAX (18%)</span>
                          <span className="text-white">TZS {(cartTotal * 0.18).toLocaleString()}</span>
                       </div>
                       <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                          <span className="text-lg font-black uppercase italic tracking-tighter text-white">Total Payable</span>
                          <span className="text-2xl font-black text-orange-600 tracking-tighter">TZS {(cartTotal * 1.18).toLocaleString()}</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2">
                       <Button 
                         variant="outline" 
                         className={`rounded-[1.2rem] h-12 border-neutral-800 font-black uppercase text-[10px] tracking-widest ${paymentMethod === 'cash' ? 'bg-orange-600 border-none text-white' : 'bg-neutral-950 text-neutral-500'}`}
                         onClick={() => setPaymentMethod('cash')}
                       >
                         <Banknote className="w-4 h-4 mr-2" /> Cash
                       </Button>
                       <Button 
                         variant="outline" 
                         className={`rounded-[1.2rem] h-12 border-neutral-800 font-black uppercase text-[10px] tracking-widest ${paymentMethod === 'card' ? 'bg-orange-600 border-none text-white' : 'bg-neutral-950 text-neutral-500'}`}
                         onClick={() => setPaymentMethod('card')}
                       >
                         <CreditCard className="w-4 h-4 mr-2" /> Card
                       </Button>
                       <Button 
                         variant="outline" 
                         className={`rounded-[1.2rem] h-12 border-neutral-800 font-black uppercase text-[10px] tracking-widest col-span-2 ${paymentMethod === 'mobile_money' ? 'bg-orange-600 border-none text-white' : 'bg-neutral-950 text-neutral-500'}`}
                         onClick={() => setPaymentMethod('mobile_money')}
                       >
                         <Smartphone className="w-4 h-4 mr-2" /> Mobile Money
                       </Button>
                    </div>

                    <div className="flex gap-4">
                       <Button variant="ghost" className="flex-1 rounded-2xl h-14 font-black uppercase text-[10px] tracking-widest text-neutral-500 hover:text-white transition-all hover:bg-neutral-800" onClick={() => setCart([])}>Cancel</Button>
                       <Button 
                         disabled={cart.length === 0 || isProcessingSale}
                         onClick={handleCompleteSale}
                         className="flex-[2] rounded-2xl h-14 bg-orange-600 hover:bg-orange-700 font-black uppercase text-xs tracking-[0.2rem] shadow-xl shadow-orange-900/30 text-white transition-all active:scale-95"
                       >
                         {isProcessingSale ? 'Processing...' : 'Complete Order'}
                       </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'tables' && (
              <motion.div 
                key="tables"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pb-32"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Dining Floor</h2>
                    <p className="text-neutral-500 font-medium italic">Monitor occupancy and manage table availability</p>
                  </div>
                  <Button 
                    onClick={() => setIsAddSectionOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-orange-950/40 text-white"
                  >
                    <Plus className="w-5 h-5 mr-3" /> Add New Table
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {sections.map((section, idx) => {
                    const tableStatus = section.status || 'available';
                    return (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        key={`tables-tab-card-${section.id || idx}`}
                        className={`bg-neutral-900 border border-neutral-800 rounded-[3rem] p-8 relative overflow-hidden transition-all ${
                          tableStatus === 'occupied' ? 'ring-2 ring-red-500/20 border-red-500/30 shadow-[0_0_40px_-15px_rgba(239,68,68,0.3)]' : 
                          tableStatus === 'reserved' ? 'ring-2 ring-yellow-500/20 border-yellow-500/30' : 
                          'hover:border-orange-600/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center font-black text-xl ${
                            tableStatus === 'occupied' ? 'bg-red-500/10 text-red-500' :
                            tableStatus === 'reserved' ? 'bg-yellow-500/10 text-yellow-500' :
                            tableStatus === 'cleaning' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-orange-600/10 text-orange-600'
                          }`}>
                            {section.number}
                          </div>
                          <div className="flex gap-2">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-10 w-10 rounded-xl bg-neutral-950 text-neutral-500 hover:text-white border border-neutral-800"
                               onClick={() => {
                                 setSelectedSection(section);
                                 setQrOptions({ ...qrOptions, data: `${window.location.origin}/table/${vendorProfile?.id}/${section.number}` });
                                 setIsQrBuilderOpen(true);
                               }}
                             >
                               <QrCode className="w-4 h-4" />
                             </Button>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                               onClick={() => handleDeleteSection(section.id)}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                          </div>
                        </div>

                        <div className="space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Manage Status</label>
                              <Select 
                                value={tableStatus} 
                                onValueChange={(val) => updateTableStatus(section.id, val)}
                              >
                                <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-black italic uppercase text-[10px] tracking-widest text-white ring-offset-neutral-900">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-2xl shadow-2xl">
                                  <SelectItem value="available">✓ Available</SelectItem>
                                  <SelectItem value="occupied">! Occupied</SelectItem>
                                  <SelectItem value="reserved">★ Reserved</SelectItem>
                                  <SelectItem value="cleaning">∞ Cleaning</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>

                          <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-4">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-neutral-950 rounded-lg">
                                  <Users className="w-3 h-3 text-neutral-500" />
                                </div>
                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{section.capacity || 4} Seater</span>
                             </div>
                             {tableStatus === 'occupied' && (
                               <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                  <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">LIVE ORDER</span>
                               </div>
                             )}
                          </div>
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute -bottom-8 -right-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                           <UtensilsCrossed className="w-40 h-40" />
                        </div>

                        {/* Status Glow Overlay */}
                        {tableStatus === 'occupied' && (
                           <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                        )}
                        {tableStatus === 'available' && (
                           <div className="absolute top-0 left-0 w-1 h-full bg-orange-600" />
                        )}
                      </motion.div>
                    );
                  })}

                  {sections.length === 0 && (
                     <div className="col-span-full py-32 text-center bg-neutral-900/20 rounded-[3rem] border border-dashed border-neutral-800 flex flex-col items-center justify-center">
                        <div className="w-24 h-24 bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mb-8 border border-neutral-800">
                           <Layout className="w-10 h-10 text-neutral-700" />
                        </div>
              <h3 className="text-xl font-black text-neutral-900 dark:text-white italic uppercase mb-2 tracking-tight transition-colors">Floor Plan Empty</h3>
                        <p className="text-neutral-500 text-sm max-w-xs mx-auto mb-8">Design your dining experience by adding tables and generating unique QR codes for instant ordering.</p>
                        <Button 
                          onClick={() => setIsAddSectionOpen(true)} 
                          className="bg-orange-600 hover:bg-orange-700 h-14 px-10 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-orange-950/40 text-white"
                        >
                          Add First Table
                        </Button>
                     </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'coupons' && (
              <motion.div 
                key="coupons"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Promotions</h2>
                    <p className="text-neutral-500 font-medium">Create and manage high-conversion discount codes</p>
                  </div>
                  <Button 
                    onClick={() => setIsAddCouponOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" /> Launch New Coupon
                  </Button>
                </div>

                {isAddCouponOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-neutral-900/60 border-2 border-orange-600/30 p-8 rounded-[2.5rem] relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-8">
                       <Gift className="w-24 h-24 text-orange-600/5 rotate-12" />
                    </div>
                    <form onSubmit={handleAddCoupon} className="relative z-10 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Campaign Code</label>
                           <Input 
                             placeholder="e.g. SUMMER25" 
                             className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-black text-white italic placeholder:not-italic"
                             value={newCoupon.code}
                             onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Discount Config</label>
                           <div className="flex gap-3">
                              <Select value={newCoupon.discountType} onValueChange={val => setNewCoupon({...newCoupon, discountType: val as any})}>
                                 <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold flex-1">
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="bg-neutral-900 border-neutral-800 text-white border-neutral-700 shadow-2xl">
                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                    <SelectItem value="fixed">Fixed (TZS)</SelectItem>
                                 </SelectContent>
                              </Select>
                              <Input 
                                type="number" 
                                placeholder="Value" 
                                className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-black text-orange-600 w-32"
                                value={newCoupon.discountValue}
                                onChange={e => setNewCoupon({...newCoupon, discountValue: Number(e.target.value)})}
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Product Scope</label>
                           <Select value={newCoupon.productId || 'all'} onValueChange={val => setNewCoupon({...newCoupon, productId: val === 'all' ? null : val})}>
                              <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold">
                                 <SelectValue placeholder="Universal Discount" />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-900 border-neutral-800 text-white border-neutral-700 shadow-2xl">
                                 <SelectItem value="all">Apply to All Products</SelectItem>
                                {products.map((p, idx) => <SelectItem key={`coupon-prod-opt-${p.id || 'no-id'}-${idx}`} value={p.id || `idx-${idx}`}>{p.name}</SelectItem>)}
                              </SelectContent>
                           </Select>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Button type="submit" className="flex-1 bg-white text-black hover:bg-neutral-200 h-14 rounded-2xl font-black uppercase tracking-widest text-xs">Activate Promotion</Button>
                        <Button type="button" variant="ghost" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-neutral-500" onClick={() => setIsAddCouponOpen(false)}>Discard</Button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {coupons.map((coupon) => (
                    <motion.div 
                      key={`coupon-card-${coupon.id}`}
                      whileHover={{ scale: 1.02 }}
                      className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 relative group overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteCoupon(coupon.id!)}>
                               <Trash2 className="w-4 h-4" />
                            </Button>
                         </div>
                      </div>

                      <div className="flex items-start justify-between mb-8">
                         <div className="space-y-1">
                            <span className="text-[9px] font-black italic uppercase tracking-[0.2em] text-orange-600">Active Campaign</span>
                            <h3 className="text-3xl font-black text-white italic tracking-tighter">{coupon.code}</h3>
                         </div>
                         <div className="p-4 rounded-2xl bg-orange-600/10 text-orange-600">
                            <Zap className="w-6 h-6" />
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex justify-between items-end">
                            <div>
                               <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Discount</p>
                               <p className="text-2xl font-black text-white">
                                  {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `TZS ${coupon.discountValue?.toLocaleString()}`}
                               </p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Usage</p>
                               <p className="text-sm font-black text-neutral-400">{coupon.usageCount || 0} Redeemed</p>
                            </div>
                         </div>
                         <div className="pt-6 border-t border-neutral-800 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-neutral-600">Expires: {coupon.expiryDate ? format(new Date(coupon.expiryDate), 'MMM d, yyyy') : 'Never'}</span>
                            <span className={`px-3 py-1 rounded-full ${coupon.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                               {coupon.status}
                            </span>
                         </div>
                      </div>
                    </motion.div>
                  ))}

                  {coupons.length === 0 && !isAddCouponOpen && (
                    <div className="col-span-full py-32 text-center bg-neutral-900/20 rounded-[3rem] border border-dashed border-neutral-800">
                       <Tag className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                       <h3 className="text-xl font-black text-neutral-900 dark:text-white italic uppercase mb-2 transition-colors">No Active Coupons</h3>
                       <p className="text-neutral-500 text-sm max-w-xs mx-auto">Create promotional codes to drive sales and reward your loyal customers.</p>
                       <Button onClick={() => setIsAddCouponOpen(true)} variant="link" className="mt-4 text-orange-500 font-bold uppercase tracking-widest text-[10px]">Launch First Campaign</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-[calc(100vh-16rem)]"
              >
                <Chat />
              </motion.div>
            )}

            {activeTab === 'inventory_stats' && (
              <motion.div 
                key="inventory_stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Business Performance</h2>
                    <p className="text-neutral-500 font-medium italic">Strategic insights and revenue analytics</p>
                  </div>
                  <Button 
                    onClick={handleDownloadSalesReport}
                    variant="outline" 
                    className="h-14 px-8 border-neutral-800 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-900 text-white flex items-center gap-3"
                  >
                    <PrinterIcon className="w-4 h-4" /> Export CSV
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Total Inventory Value</h3>
                      <p className="text-3xl font-black text-neutral-900 dark:text-white italic transition-colors">TZS {(products.reduce((acc, p) => acc + (p.price * p.stock), 0)).toLocaleString()}</p>
                   </Card>
                   <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Unique Items</h3>
                      <p className="text-3xl font-black text-neutral-900 dark:text-white italic transition-colors small">{products.length} Products</p>
                   </Card>
                   <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Total Units in Stock</h3>
                      <p className="text-3xl font-black text-neutral-900 dark:text-white italic transition-colors">{products.reduce((acc, p) => acc + p.stock, 0)} Units</p>
                   </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-neutral-900/40 border-neutral-800 p-8 space-y-8">
                      <div className="flex items-center justify-between">
                         <div>
                            <h3 className="text-xl font-black uppercase tracking-tight italic">Top Sellers</h3>
                            <p className="text-xs text-neutral-500">Most popular choices this week</p>
                         </div>
                         <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
                            <Zap className="w-5 h-5 text-orange-600" />
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                         {bestSellers.map((item, idx) => (
                           <motion.div 
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: idx * 0.1 }}
                             key={`inventory-best-seller-${item.name}-${idx}`} 
                             className="flex items-center justify-between group"
                           >
                             <div className="flex items-center gap-4">
                                <div className="text-[10px] font-black text-neutral-700 w-4">0{idx + 1}</div>
                                <div className="w-14 h-14 rounded-2xl bg-neutral-950 border border-neutral-800 p-1 overflow-hidden relative">
                                   {item.imageUrl ? (
                                    <img 
                                      src={item.imageUrl} 
                                      className="w-full h-full object-cover rounded-xl" 
                                      referrerPolicy="no-referrer" 
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                      }}
                                    />
                                  ) : (
                                    <Package className="w-full h-full p-3 opacity-10" />
                                  )}
                                </div>
                                <div className="max-w-[120px]">
                                   <p className="font-bold text-sm text-white italic truncate">{item.name}</p>
                                   <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">{item.category}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="font-black text-sm text-white">TZS {item.revenue.toLocaleString()}</p>
                                <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{item.count} Sold</p>
                             </div>
                           </motion.div>
                         ))}
                         {bestSellers.length === 0 && (
                            <div className="py-10 text-center text-neutral-700 font-black uppercase tracking-[0.2em] text-[10px]">No sales recorded yet</div>
                         )}
                      </div>
                    </Card>

                   <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                      <h3 className="font-black italic uppercase tracking-tighter mb-6">Stock Level Distribution</h3>
                      <div className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={products.slice(0, 10)}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                               <XAxis dataKey="name" stroke="#525252" fontSize={10} axisLine={false} tickLine={false} />
                               <YAxis stroke="#525252" fontSize={10} axisLine={false} tickLine={false} />
                               <Tooltip 
                                 contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '12px' }}
                                 itemStyle={{ color: '#ea580c', fontWeight: 'bold' }}
                               />
                               <Bar dataKey="stock" fill="#ea580c" radius={[10, 10, 0, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </Card>
                   <Card className="bg-neutral-900/40 border-neutral-800 p-8">
                      <h3 className="font-black italic uppercase tracking-tighter mb-6">Units Breakdown</h3>
                      <div className="space-y-4">
                         {Array.from(new Set(products.map(p => p.unit || 'pcs'))).map((unit, i) => (
                           <div key={`unit-stats-${unit}`} className="flex items-center justify-between p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 font-black">
                                    {unit.toUpperCase()}
                                 </div>
                                 <span className="font-bold text-white uppercase text-xs">{unit} Products</span>
                              </div>
                              <span className="text-lg font-black italic">{products.filter(p => p.unit === unit).length}</span>
                           </div>
                         ))}
                      </div>
                   </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'customers' && (
              <motion.div 
                key="customers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">CRM & Loyalty</h2>
                    <p className="text-neutral-500 font-medium">Build relationships and track customer lifetime value</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="bg-neutral-900 border-neutral-800 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" /> Export CRM
                    </Button>
                    <Button 
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-2" /> Add Customer
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-900/40 p-3 rounded-[2rem] border border-neutral-800">
                   <div className="md:col-span-2 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <Input placeholder="Search by name or phone..." className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl pl-11 text-sm text-white" />
                   </div>
                   <Button variant="outline" className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] text-neutral-400">
                      <Filter className="w-4 h-4 mr-2" /> Advanced Filters
                   </Button>
                </div>

                <div className="bg-neutral-900/20 border border-neutral-800 rounded-[3rem] overflow-hidden">
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-neutral-800 bg-neutral-900/50">
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Customer Profile</th>
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Orders</th>
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Total Spent</th>
                             <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                          {Array.from(new Set(orders.map(o => o.customerPhone || o.customerId))).filter(id => id).map((cId, index) => {
                             const customerOrders = orders.filter(o => (o.customerPhone || o.customerId) === cId);
                             const name = customerOrders[0]?.customerName || `Loyal Guest ${cId?.toString().slice(-4)}`;
                             const phone = customerOrders[0]?.customerPhone || 'PRIVATE';
                             const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);

                             return (
                               <tr key={`crm-row-item-${cId}-${index}`} className="hover:bg-neutral-800/20 transition-all group">
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-600/10 flex items-center justify-center border border-orange-600/20">
                                           <User className="w-6 h-6 text-orange-600" />
                                        </div>
                                        <div>
                                           <p className="font-black text-white text-md uppercase tracking-tight italic">{name}</p>
                                           <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">{phone}</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <span className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-[10px] font-black text-neutral-400 uppercase tracking-widest">{customerOrders.length} Orders</span>
                                  </td>
                                  <td className="px-8 py-6 text-center">
                                     <p className="font-black text-white">TZS {totalSpent.toLocaleString()}</p>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                     <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white">
                                           <Receipt className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-950/50 rounded-xl text-neutral-600 hover:text-orange-600 hover:bg-neutral-900">
                                           <MoreVertical className="w-4 h-4" />
                                        </Button>
                                     </div>
                                  </td>
                               </tr>
                             );
                          })}
                      {orders.filter(o => o.customerPhone || o.customerId).length === 0 && (
                        <tr key="crm-empty-row">
                          <td colSpan={4} className="px-8 py-32 text-center bg-neutral-900/10">
                            <Users className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-white italic uppercase mb-2">No Customer Data</h3>
                            <p className="text-neutral-400 text-sm max-w-xs mx-auto">Start recording customer details during checkout to build your CRM database.</p>
                          </td>
                        </tr>
                      )}
                        </tbody>
                     </table>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'staff' && (
              <motion.div 
                key="staff"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pb-32"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                      {vendorProfile?.category === 'bus_ticket' ? 'Staff & Agents' : 'Team & Personnel'}
                    </h2>
                    <p className="text-neutral-500 font-medium italic">
                      {vendorProfile?.category === 'bus_ticket' 
                        ? 'Dhibiti madereva, makondakta na mawakala wa tiketi' 
                        : 'Manage roles for chefs, waiters, and managers'}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsAddStaffOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-orange-950/40 text-white"
                  >
                    <UserPlus className="w-5 h-5 mr-3" /> Add Team Member
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {staff.map((member, idx) => (
                    <motion.div 
                      key={`staff-card-${member.id || idx}`}
                      whileHover={{ scale: 1.02 }}
                      className="bg-neutral-900 border border-neutral-800 rounded-[3rem] p-8 relative group overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => deleteStaff(member.id)}>
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>

                      <div className="flex flex-col items-center text-center space-y-4 mb-8">
                         <div className="w-20 h-20 rounded-[2rem] bg-orange-600/10 flex items-center justify-center border-2 border-dashed border-orange-600/20 group-hover:bg-orange-600/20 transition-all">
                            {vendorProfile?.category === 'bus_ticket' ? (
                              <BadgeCheck className="w-10 h-10 text-orange-600" />
                            ) : (
                              <ChefHat className="w-10 h-10 text-orange-600" />
                            )}
                         </div>
                         <div>
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{member.name}</h3>
                            <div className="flex flex-col items-center justify-center gap-1 mt-1">
                               <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-3 h-3 text-orange-600" />
                                  <span className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">{member.role}</span>
                               </div>
                               {member.branchId && branches.find(b => b.id === member.branchId) && (
                                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                     <MapPin className="w-2 h-2 text-neutral-600 shadow-sm shadow-orange-600/20" />
                                     <span className="text-[8px] font-black text-neutral-400 capitalize">{branches.find(b => b.id === member.branchId)?.name}</span>
                                  </div>
                               )}
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4 bg-neutral-950/50 p-6 rounded-3xl border border-white/5">
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <span className="text-neutral-600">Contact</span>
                            <span className="text-neutral-300">{member.phone || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t border-white/5">
                            <span className="text-neutral-600">Operations</span>
                            <span className="text-green-500">Live</span>
                         </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {staff.length === 0 && (
                    <div className="col-span-full py-40 text-center bg-neutral-900/10 rounded-[4rem] border border-dashed border-neutral-800">
                       <div className="w-24 h-24 bg-neutral-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                          <Users className="w-10 h-10 text-neutral-600" />
                       </div>
                       <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Build Your Power Team</h3>
                       <p className="text-neutral-500 text-sm max-w-xs mx-auto mb-8">Scale your operations by assigning dedicated roles to your employees.</p>
                       <Button onClick={() => setIsAddStaffOpen(true)} className="bg-white text-black hover:bg-neutral-200 h-14 rounded-2xl px-10 font-black uppercase tracking-widest text-xs shadow-xl">Get Started</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
 
             {activeTab === 'branches' && (
              <motion.div 
                key="branches"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                      {vendorProfile?.category === 'bus_ticket' ? 'Vituo & Matawi' : 'Locations & Branches'}
                    </h2>
                    <p className="text-neutral-500 font-medium italic">
                      {vendorProfile?.category === 'bus_ticket' 
                        ? 'Simamia vituo vya kuuzia tiketi na matawi yako ya mikoani' 
                        : 'Manage multiple physical locations for your business'}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsAddBranchOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-900/30 text-white"
                  >
                    <Plus className="w-5 h-5 mr-2" /> 
                    {vendorProfile?.category === 'bus_ticket' ? 'Ongeza Kituo Kipya' : 'Add New Branch'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {branches.map((branch) => (
                    <motion.div 
                      key={`branch-card-${branch.id}`}
                      whileHover={{ y: -5 }}
                      className="bg-neutral-900/40 border border-neutral-800 rounded-[3rem] p-8 flex flex-col justify-between group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => deleteBranch(branch.id!)}>
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>

                      <div className="mb-8">
                         <div className="w-20 h-20 rounded-[2.5rem] bg-orange-600/10 flex items-center justify-center border-2 border-dashed border-orange-600/20 group-hover:bg-orange-600/20 transition-all mb-6">
                            <MapPin className="w-10 h-10 text-orange-600" />
                         </div>
                         <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{branch.name}</h3>
                         <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mt-1">{branch.type || 'Office'}</p>
                      </div>

                      <div className="space-y-4 bg-neutral-950/50 p-6 rounded-3xl border border-white/5">
                         <div className="flex flex-col space-y-1">
                            <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Address</span>
                            <span className="text-xs font-bold text-neutral-300">{branch.address}</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t border-white/5">
                            <span className="text-neutral-600">Contact</span>
                            <span className="text-neutral-300">{branch.phone || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t border-white/5">
                            <span className="text-neutral-600">Status</span>
                            <span className="text-green-500">Active</span>
                         </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {branches.length === 0 && (
                    <div className="col-span-full py-40 text-center bg-neutral-900/10 rounded-[4rem] border border-dashed border-neutral-800">
                       <div className="w-24 h-24 bg-neutral-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                          <MapPin className="w-10 h-10 text-neutral-600" />
                       </div>
                       <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Multi-Branch Operations</h3>
                       <p className="text-neutral-500 text-sm max-w-sm mx-auto mb-8">
                         {vendorProfile?.category === 'bus_ticket' 
                           ? 'Ongeza na dhibiti vituo vyako vyote vya kuuzia tiketi hapa ili kurahisisha ufuatiliaji wa mauzo'
                           : 'Scale your business by adding more locations and tracking their performance individually.'}
                       </p>
                       <Button onClick={() => setIsAddBranchOpen(true)} className="bg-white text-black hover:bg-neutral-200 h-14 rounded-2xl px-10 font-black uppercase tracking-widest text-xs shadow-xl">Add Branch</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'freshness' && (
              <motion.div
                key="freshness"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Freshness Monitor</h2>
                    <p className="text-neutral-500 font-medium">Track and manage items nearing their expiration date.</p>
                  </div>
                  <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-2xl">
                     <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest">System Status</p>
                     <p className="text-sm font-bold text-white">Monitoring {products.length} Items</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-neutral-900/60 border-neutral-800 p-8 rounded-[3rem]">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black italic uppercase tracking-tight">Expiring Soon / Karibu Na Tarehe</h3>
                        <Badge className="bg-red-500/10 text-red-500 border-none px-4 py-1 font-black uppercase tracking-widest text-[10px]">
                           Action Required
                        </Badge>
                      </div>

                      <div className="space-y-4">
                        {products
                          .filter(p => p.expiryDate && new Date(p.expiryDate) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
                          .sort((a,b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())
                          .map((product, idx) => {
                            const daysLeft = Math.ceil((new Date(product.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const isUrgent = daysLeft <= 3;
                            
                            return (
                              <div key={`freshness-item-${product.id || idx}`} className="flex items-center justify-between p-6 bg-neutral-950/50 rounded-3xl border border-white/5 hover:border-orange-600/30 transition-all group">
                                <div className="flex items-center gap-5">
                                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 overflow-hidden relative">
                                    {product.imageUrl ? (
                                      <img 
                                  src={product.imageUrl} 
                                  className="w-full h-full object-cover" 
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                  }}
                                />
                                    ) : (
                                      <Package className="w-full h-full p-4 opacity-10" />
                                    )}
                                    {isUrgent && <div className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full animate-pulse border-2 border-neutral-900" />}
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-bold text-white">{product.name}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{product.category}</p>
                                      <span className="w-1 h-1 bg-neutral-800 rounded-full" />
                                      <p className="text-[10px] font-black text-white uppercase tracking-widest">{product.stock} {product.unit || 'Units'} Available</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right space-y-2">
                                  <div className="flex flex-col items-end">
                                    <p className={`text-sm font-black uppercase italic ${isUrgent ? 'text-red-500' : 'text-orange-500'}`}>
                                      {daysLeft <= 0 ? 'Expired' : `${daysLeft} days left`}
                                    </p>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase">{format(new Date(product.expiryDate!), 'MMM d, yyyy')}</p>
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-8 rounded-lg text-[9px] font-black uppercase border-neutral-800 hover:bg-orange-600 hover:text-white"
                                      onClick={() => {
                                        // Set a quick flash sale
                                        setBulkPrices({ ...bulkPrices, [product.id!]: Math.round(product.price * 0.7) });
                                        setActiveTab('market_pulse');
                                        toast.info(`Proposed 30% discount for ${product.name}`);
                                      }}
                                    >
                                      Clearance Offer
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-8 rounded-lg text-[9px] font-black uppercase text-red-500"
                                      onClick={() => handleDeleteProduct(product.id!)}
                                    >
                                      Write Off
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {products.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)).length === 0 && (
                          <div className="py-20 text-center opacity-20">
                             <ShieldCheck className="w-20 h-20 mx-auto mb-4" />
                             <p className="text-sm font-black uppercase tracking-[0.4em]">Inventory Freshness Guaranteed</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="bg-neutral-900 border-neutral-800 p-8 rounded-[3rem]">
                      <h3 className="text-xl font-black italic uppercase italic tracking-tight mb-6">Stock Health</h3>
                      <div className="space-y-6">
                         <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl">
                            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Stable Stock</p>
                            <p className="text-3xl font-black text-white italic">{products.filter(p => p.stock >= 10).length}</p>
                            <div className="mt-4 w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                               <div className="h-full bg-green-500" style={{ width: `${(products.filter(p => p.stock >= 10).length / products.length) * 100}%` }}></div>
                            </div>
                         </div>
                         <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Critical Stock</p>
                            <p className="text-3xl font-black text-white italic">{products.filter(p => p.stock < 10).length}</p>
                            <div className="mt-4 w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                               <div className="h-full bg-red-500" style={{ width: `${(products.filter(p => p.stock < 10).length / products.length) * 100}%` }}></div>
                            </div>
                         </div>
                      </div>
                    </Card>

                    <Card className="bg-neutral-900 border-neutral-800 p-8 rounded-[3rem] overflow-hidden relative group">
                        <div className="absolute inset-0 bg-orange-600/5 translate-y-full group-hover:translate-y-0 transition-transform" />
                        <h3 className="text-xl font-black italic uppercase tracking-tight mb-4 relative z-10">Freshness Tip</h3>
                        <p className="text-sm text-neutral-400 font-medium relative z-10 leading-relaxed">
                          Implementing a "First-In, First-Out" (FIFO) shelf system can reduce spoilage by 25%. Try rotating your {vendorProfile?.category} stock today!
                        </p>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'market_pulse' && (
              <motion.div
                key="market_pulse"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Market Pulse</h2>
                    <p className="text-neutral-500 font-medium">Quickly adjust prices across multiple items to match market trends.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="rounded-xl border-neutral-800 bg-neutral-900 h-12 uppercase font-black text-[10px] tracking-widest px-6"
                      onClick={() => setBulkPrices({})}
                    >
                      Reset Changes
                    </Button>
                    <Button 
                      className="rounded-xl bg-orange-600 hover:bg-orange-700 h-12 uppercase font-black text-[10px] tracking-widest px-8 shadow-xl shadow-orange-950/30"
                      onClick={async () => {
                        const loadingToast = toast.loading('Applying price changes...');
                        try {
                          await Promise.all(Object.entries(bulkPrices).map(async ([id, price]) => {
                            await updateDoc(doc(db, 'products', id), { price });
                          }));
                          toast.success('Prices updated successfully!', { id: loadingToast });
                          setBulkPrices({});
                        } catch (err) {
                          toast.error('Failed to update prices.', { id: loadingToast });
                        }
                      }}
                      disabled={Object.keys(bulkPrices).length === 0}
                    >
                      Apply All Updates ({Object.keys(bulkPrices).length})
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {products.map((product, idx) => (
                    <div key={`market-pulse-row-${product.id || idx}`} className="bg-neutral-900/60 border border-neutral-800 p-6 rounded-[2rem] flex items-center justify-between group hover:border-orange-600/30 transition-all">
                       <div className="flex items-center gap-6">
                         <div className="w-16 h-16 rounded-[1.25rem] bg-neutral-800 overflow-hidden">
                           {product.imageUrl ? (
                             <img 
                              src={product.imageUrl} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                              }}
                            />
                           ) : (
                             <Package className="w-full h-full p-4 opacity-10" />
                           )}
                         </div>
                         <div>
                            <h4 className="text-lg font-bold text-white mb-1">{product.name}</h4>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Current Stock: {product.stock} {product.unit}</p>
                         </div>
                       </div>

                       <div className="flex items-center gap-12">
                          <div className="text-right">
                             <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Live Price</p>
                             <p className="text-xl font-black text-white italic">TZS {product.price.toLocaleString()}</p>
                          </div>
                          
                          <div className="flex items-center gap-4">
                             <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-bold">TZS</span>
                                <Input 
                                  type="number"
                                  className="w-40 bg-neutral-950 border-neutral-800 h-14 pl-12 rounded-2xl text-lg font-black italic focus:ring-orange-600 transition-all"
                                  value={bulkPrices[product.id!] || ''}
                                  placeholder={product.price.toString()}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      setBulkPrices({ ...bulkPrices, [product.id!]: val });
                                    } else {
                                      const newBP = { ...bulkPrices };
                                      delete newBP[product.id!];
                                      setBulkPrices(newBP);
                                    }
                                  }}
                                />
                             </div>
                             
                             {bulkPrices[product.id!] && (
                               <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${
                                 bulkPrices[product.id!] < product.price ? 'text-red-500' : 'text-green-500'
                               }`}>
                                 {bulkPrices[product.id!] < product.price ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                 {Math.abs(Math.round(((bulkPrices[product.id!] - product.price) / product.price) * 100))}%
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-neutral-900 dark:text-white px-1 italic uppercase tracking-tighter transition-colors duration-300">Duka Settings</h2>
                    <p className="text-neutral-500 font-medium">Manage your store profile, appearance, and contact info</p>
                  </div>
                  <Button 
                    form="settings-form"
                    type="submit" 
                    disabled={isSavingSettings}
                    className="h-14 px-8 bg-orange-600 hover:bg-orange-700 font-black rounded-2xl shadow-xl shadow-orange-950/30 gap-3"
                  >
                    {isSavingSettings ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Save Changes
                  </Button>
                </div>

                <form id="settings-form" onSubmit={handleUpdateSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-8 transition-colors">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 text-orange-600">
                          <Store className="w-6 h-6" />
                          <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">Basic Information</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Store Name / Jina la Duka</label>
                          <Input 
                            value={updatedProfile.businessName}
                            onChange={e => setUpdatedProfile({...updatedProfile, businessName: e.target.value})}
                            className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-lg font-bold text-neutral-900 dark:text-white transition-colors"
                            placeholder="e.g. Papo Hapo Soko"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Description / Maelezo</label>
                          <textarea 
                            value={updatedProfile.description || ''}
                            onChange={e => setUpdatedProfile({...updatedProfile, description: e.target.value})}
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-sm font-medium text-neutral-900 dark:text-white min-h-[120px] focus:ring-2 focus:ring-orange-600 focus:outline-none transition-all"
                            placeholder="Brief details about your store..."
                          />
                        </div>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
                        <div className="flex items-center gap-4 text-orange-600">
                          <MapPin className="w-6 h-6" />
                          <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">Location & Contact</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Address / Sehemu Ilipo</label>
                            <div className="flex gap-2">
                              <Input 
                                value={updatedProfile.address || ''}
                                onChange={e => setUpdatedProfile({...updatedProfile, address: e.target.value})}
                                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl font-bold flex-1 text-neutral-900 dark:text-white transition-colors"
                                placeholder="e.g. Kariakoo, Dar es Salaam"
                              />
                              <Button 
                                type="button"
                                variant="outline"
                                onClick={() => setIsLocationPickerOpen(true)}
                                className="h-14 px-6 rounded-2xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 border-2 gap-2 text-orange-600 font-bold shrink-0 transition-colors"
                              >
                                <MapPin className="w-5 h-5 text-orange-600" />
                                <span className="hidden sm:inline">Chagua kwenye Ramani</span>
                              </Button>
                            </div>
                            {updatedProfile.location && (
                              <p className="text-[10px] text-neutral-500 italic px-1">
                                Coordinates: {updatedProfile.location.lat.toFixed(4)}, {updatedProfile.location.lng.toFixed(4)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Phone / Namba ya Simu</label>
                            <Input 
                              value={updatedProfile.phoneNumber || ''}
                              onChange={e => setUpdatedProfile({...updatedProfile, phoneNumber: e.target.value})}
                              className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl font-bold text-neutral-900 dark:text-white transition-colors"
                              placeholder="+255..."
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-8 transition-colors">
                       <div className="flex items-center gap-4 text-orange-600">
                          <Clock className="w-6 h-6" />
                          <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">Opening Hours</h3>
                  </div>
                  <Input 
                    value={updatedProfile.operatingHours || ''}
                    onChange={e => setUpdatedProfile({...updatedProfile, operatingHours: e.target.value})}
                    className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl font-bold text-neutral-900 dark:text-white transition-colors"
                    placeholder="e.g. 7:00 AM - 9:00 PM"
                  />
              </Card>
                  </div>

                  <div className="space-y-8">
                    <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 space-y-6 transition-colors">
                      <div className="flex items-center gap-4 text-orange-600">
                        <Camera className="w-6 h-6" />
                        <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">Branding</h3>
                      </div>

                      <div className="space-y-8">
                        <div className="space-y-4">
                          <div className="space-y-3 text-center">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Logo / Picha ya Duka</label>
                            <div className="relative group mx-auto w-40 h-40">
                              <div 
                                onClick={() => logoInputRef.current?.click()}
                                className="w-full h-full rounded-[3rem] bg-neutral-50 dark:bg-neutral-950 border-4 border-dashed border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col items-center justify-center transition-all group-hover:border-orange-600/50 group-hover:bg-orange-600/5 cursor-pointer relative"
                              >
                                {(updatedProfile.logoUrl || vendorProfile?.logoUrl) ? (
                                  <img 
                                    key={updatedProfile.logoUrl || vendorProfile?.logoUrl}
                                    src={updatedProfile.logoUrl || vendorProfile?.logoUrl || ''} 
                                    className={`w-full h-full object-cover transition-all group-hover:scale-110 ${isLogoUploading ? 'opacity-30 grayscale' : ''}`} 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendorProfile?.businessName || 'vendor')}`;
                                    }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-2">
                                    <Store className="w-12 h-12 text-neutral-300 dark:text-neutral-700 group-hover:text-orange-600 transition-colors" />
                                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-tighter">Bofya kupakia</span>
                                  </div>
                                )}
                                
                                {isLogoUploading && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-2" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Inapakia...</span>
                                  </div>
                                )}

                                {!isLogoUploading && (
                                  <div className="absolute inset-0 bg-orange-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="flex flex-col items-center gap-2 p-4 text-center">
                                        <Camera className="w-8 h-8 text-white" />
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest leading-tight">Badili Logo</span>
                                     </div>
                                  </div>
                                )}
                              </div>

                              <Button
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                className="absolute -bottom-2 -right-2 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl h-12 w-12 shadow-xl shadow-orange-950/40 z-10 border-4 border-white dark:border-neutral-900"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={isLogoUploading}
                              >
                                {isLogoUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                              </Button>
                              <input 
                                type="file" 
                                ref={logoInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleLogoUpload} 
                              />
                            </div>
                            
                            <div className="pt-2 px-4">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 block text-left">Au weka Link ya Logo (URL)</label>
                              <Input 
                                value={updatedProfile.logoUrl || vendorProfile?.logoUrl || ''}
                                onChange={e => setUpdatedProfile({...updatedProfile, logoUrl: e.target.value})}
                                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-10 rounded-xl text-xs"
                                placeholder="https://mfano.com/picha.jpg"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 text-center block">Banner Image / Picha ya Juu</label>
                            <div className="relative group aspect-video rounded-3xl bg-neutral-50 dark:bg-neutral-950 border-2 border-dashed border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center transition-colors">
                              {(updatedProfile.bannerUrl || vendorProfile?.bannerUrl) ? (
                                <img 
                                  src={updatedProfile.bannerUrl || vendorProfile?.bannerUrl || ''} 
                                  className={`w-full h-full object-cover ${isBannerUploading ? 'opacity-30 grayscale' : ''}`} 
                                  referrerPolicy="no-referrer" 
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80';
                                  }}
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <Camera className="w-8 h-8 text-neutral-400 dark:text-neutral-700" />
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Weka Banner</span>
                                </div>
                              )}

                              {isBannerUploading && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-2" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Inapakia...</span>
                                  </div>
                              )}
                              
                              {!isBannerUploading && (
                                 <div 
                                   onClick={() => bannerInputRef.current?.click()}
                                   className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                 >
                                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                                       <Camera className="w-6 h-6 text-white" />
                                       <span className="text-[10px] font-black text-white uppercase tracking-widest leading-tight">Badili Banner</span>
                                    </div>
                                 </div>
                              )}
                              <Button
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                className="absolute bottom-3 right-3 bg-black/10 dark:bg-white/10 backdrop-blur-md hover:bg-black/20 dark:hover:bg-white/20 text-white rounded-xl h-10 w-10 shadow-lg"
                                onClick={() => bannerInputRef.current?.click()}
                                disabled={isBannerUploading}
                              >
                                {isBannerUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                              </Button>
                              <input 
                                type="file" 
                                ref={bannerInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleBannerUpload} 
                              />
                            </div>
                            
                            <div className="px-1 pt-1">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2 block">Au weka Link ya Banner (URL)</label>
                              <Input 
                                value={updatedProfile.bannerUrl || vendorProfile?.bannerUrl || ''}
                                onChange={e => setUpdatedProfile({...updatedProfile, bannerUrl: e.target.value})}
                                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-10 rounded-xl text-xs"
                                placeholder="https://mfano.com/banner.jpg"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden p-8 space-y-6 transition-colors">
                      <div className="flex items-center gap-4 text-orange-600">
                        <Smartphone className="w-6 h-6" />
                        <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">Social Links</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">WhatsApp Number</label>
                           <Input 
                            value={updatedProfile.socialLinks?.whatsapp || ''}
                            onChange={e => setUpdatedProfile({
                              ...updatedProfile, 
                              socialLinks: { ...updatedProfile.socialLinks, whatsapp: e.target.value }
                            })}
                            className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-sm font-medium"
                            placeholder="e.g. 255712345678"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Instagram (@Username)</label>
                           <Input 
                            value={updatedProfile.socialLinks?.instagram || ''}
                            onChange={e => setUpdatedProfile({
                              ...updatedProfile, 
                              socialLinks: { ...updatedProfile.socialLinks, instagram: e.target.value }
                            })}
                            className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-sm font-medium"
                            placeholder="username pekee"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Facebook Page / Profile</label>
                           <Input 
                            value={updatedProfile.socialLinks?.facebook || ''}
                            onChange={e => setUpdatedProfile({
                              ...updatedProfile, 
                              socialLinks: { ...updatedProfile.socialLinks, facebook: e.target.value }
                            })}
                            className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-sm font-medium"
                            placeholder="Link au jina la Page"
                           />
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-red-500/5 border-red-500/10 rounded-[2.5rem] overflow-hidden p-8 space-y-6">
                       <div className="flex items-center gap-4 text-red-500">
                        <Trash2 className="w-6 h-6" />
                        <h3 className="font-black text-xl">Danger Zone</h3>
                      </div>
                      <p className="text-xs text-red-500/60 font-medium">Hapa unaweza kusitisha duka lako kwa muda. Hatua hii itaficha bidhaa zako sokoni.</p>
                      <Button variant="ghost" className="w-full h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black">
                        Deactivate Store
                      </Button>
                    </Card>

                    <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden p-8 space-y-6 transition-colors">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4 text-orange-600">
                           <Layout className="w-6 h-6" />
                           <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">{vendorContext.locationLabel}</h3>
                         </div>
                         <Button 
                           onClick={() => setIsAddSectionOpen(true)}
                           className="bg-orange-600 hover:bg-orange-700 h-10 px-4 rounded-xl font-bold gap-2 text-white"
                         >
                           <Plus className="w-4 h-4" /> Add {vendorContext.locationLabelSingular}
                         </Button>
                       </div>
                       <p className="text-xs text-neutral-500 font-medium">Create QR codes for physical sections of your floor to allow customers to scan and spend instantly.</p>
                       
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {sections.map((section, idx) => (
                            <Card key={`section-card-${section.id || idx}`} className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 p-4 border relative group hover:border-orange-600/30 transition-all">
                               <button 
                                 onClick={() => handleDeleteSection(section.id)}
                                 className="absolute top-2 right-2 text-neutral-400 dark:text-neutral-600 hover:text-red-500 transition-colors"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                               <div className="w-10 h-10 bg-orange-600/10 rounded-lg flex items-center justify-center text-orange-600 font-black mb-3">
                                  {section.number}
                               </div>
                               <p className="text-[10px] font-black uppercase text-neutral-900 dark:text-white truncate transition-colors">{vendorContext.locationLabelSingular} {section.number}</p>
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="w-full mt-3 h-8 text-[9px] font-black uppercase hover:bg-orange-600 hover:text-white dark:text-neutral-400 group-hover:dark:text-white transition-colors"
                                 onClick={() => {
                                   setSelectedSection(section);
                                   setQrOptions({ ...qrOptions, data: `${window.location.origin}/table/${vendorProfile?.id}/${section.number}` });
                                   setIsQrBuilderOpen(true);
                                 }}
                               >
                                 QR Stand
                               </Button>
                            </Card>
                          ))}
                       </div>
                    </Card>
                  </div>
                </form>

                <LocationPicker 
                  isOpen={isLocationPickerOpen}
                  onClose={() => setIsLocationPickerOpen(false)}
                  onSelect={(loc) => {
                    setUpdatedProfile({
                      ...updatedProfile,
                      address: loc.address,
                      location: { lat: loc.lat, lng: loc.lng }
                    });
                  }}
                  initialLocation={updatedProfile.location ? { ...updatedProfile.location, address: updatedProfile.address || '' } : undefined}
                />
              </motion.div>
            )}

            {activeTab === 'products' && (
              <motion.div 
                key="products"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">{vendorContext.inventoryLabel} Control</h2>
                    <p className="text-neutral-500 font-medium">Manage your {vendorContext.inventoryLabel.toLowerCase()} and availability</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      className="bg-neutral-900 border-neutral-800 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" /> Bulk Export
                    </Button>
                    <Button 
                      onClick={() => setIsAddProductOpen(true)}
                      className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add New Item
                    </Button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-neutral-900/40 p-3 rounded-[2rem] border border-neutral-800">
                   <div className="md:col-span-2 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <Input 
                        placeholder="Search by name or SKU..." 
                        className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl pl-11 text-sm text-white" 
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                      />
                   </div>
                   <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-bold">
                         <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                         {categories.map((c, idx) => <SelectItem key={`inventory-cat-${c}-${idx}`} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                   </Select>
                   <Select value={stockLevelFilter} onValueChange={setStockLevelFilter}>
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-2xl font-bold">
                         <SelectValue placeholder="Stock Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                         <SelectItem value="all">All Items</SelectItem>
                         <SelectItem value="low">Low Stock</SelectItem>
                         <SelectItem value="out">Out of Stock</SelectItem>
                      </SelectContent>
                   </Select>
                </div>

                <div className="bg-neutral-900/20 border border-neutral-800 rounded-[3rem] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/50">
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Product Information</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Category</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Price</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Stock Level</th>
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                      {filteredInventory.map((product, idx) => {
                        const isBus = vendorProfile?.category === 'bus_ticket';
                        return (
                          <tr key={`inventory-row-${product.id}-${idx}`} className="hover:bg-neutral-800/20 transition-all group">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-900 overflow-hidden relative border border-neutral-800 group-hover:border-orange-600/50 transition-all">
                                   {product.imageUrl ? (
                                     <img 
                                      src={product.imageUrl} 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer" 
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                      }}
                                    />
                                   ) : (
                                     <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                       <Bus className="w-8 h-8 text-neutral-800" />
                                     </div>
                                   )}
                                </div>
                                <div>
                                   <p className="font-black text-white text-md uppercase tracking-tight italic">
                                     {isBus ? `${(product as any).origin || 'Dar'} → ${(product as any).destination || 'Arusha'}` : product.name}
                                   </p>
                                   <div className="flex flex-col gap-1">
                                      <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">
                                        {isBus ? `Departure: ${(product as any).departureTime || '06:00 AM'}` : `SKU: ${product.id?.slice(0, 8).toUpperCase()}`}
                                      </p>
                                      {isBus && (product as any).branchId && branches.find(b => b.id === (product as any).branchId) && (
                                         <p className="text-[9px] text-orange-600/70 font-black uppercase tracking-tight flex items-center gap-1">
                                           <MapPin className="w-2 h-2" />
                                           {branches.find(b => b.id === (product as any).branchId)?.name}
                                         </p>
                                      )}
                                   </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                               <span className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 rounded-full text-[10px] font-black text-neutral-400 uppercase tracking-widest">{product.category}</span>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <p className="font-black text-orange-500">TZS {product.price.toLocaleString()}</p>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex flex-col items-center gap-2">
                                  <div className="w-24 h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                                     <div 
                                       className={`h-full rounded-full transition-all duration-1000 ${
                                         product.stock < 10 ? 'bg-red-500' : product.stock < 50 ? 'bg-yellow-500' : 'bg-green-500'
                                       }`}
                                       style={{ width: `${Math.min(100, (product.stock / (isBus ? (product as any).totalSeats || 50 : 200)) * 100)}%` }}
                                     ></div>
                                  </div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                                    product.stock < 10 ? 'text-red-500' : 'text-neutral-500'
                                  }`}>
                                     {product.stock} {isBus ? 'Seats Left' : 'units'}
                                  </span>
                               </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white" onClick={() => handleEditProduct(product)}>
                                     <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-950/50 rounded-xl text-neutral-600 hover:text-red-500 hover:bg-neutral-900" onClick={() => handleDeleteProduct(product.id!)}>
                                     <Trash2 className="w-4 h-4" />
                                  </Button>
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add Customer Modal */}
      <AnimatePresence>
         {isAddCustomerModalOpen && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2rem] overflow-hidden shadow-2xl p-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-orange-600" />
                    Add Customer
                  </h3>
                  <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Customer Name</label>
                    <Input 
                      placeholder="Full Name" 
                      className="bg-neutral-800 border-none h-11 rounded-xl"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Phone Number</label>
                    <Input 
                      placeholder="+255..." 
                      className="bg-neutral-800 border-none h-11 rounded-xl"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      setPosCustomer(newCustomer);
                      setIsAddCustomerModalOpen(false);
                      toast.success(`Customer ${newCustomer.name} added!`);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-700 h-11 rounded-xl font-bold mt-4"
                  >
                    Confirm Customer
                  </Button>
                </div>
              </motion.div>
           </div>
         )}
      </AnimatePresence>

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
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Product Images / Picha za Bidhaa</label>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {newProduct.imageUrls?.map((url, idx) => url && (
                        <motion.div 
                          key={`np-img-${idx}-${url.slice(-20)}`}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="aspect-square rounded-2xl bg-neutral-800 border border-neutral-700 overflow-hidden relative group"
                        >
                          <img 
                            src={url} 
                            alt={`Preview ${idx}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newUrls = newProduct.imageUrls?.filter((_, i) => i !== idx);
                              setNewProduct({
                                ...newProduct, 
                                imageUrls: newUrls,
                                imageUrl: newUrls?.[0] || ''
                              });
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {idx === 0 && (
                            <div className="absolute bottom-0 inset-x-0 bg-orange-600 text-[8px] font-bold text-center py-0.5 uppercase">
                              Main
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isProductUploading && (
                      <div className="aspect-square rounded-2xl bg-neutral-800 border border-orange-600/50 flex flex-col items-center justify-center p-2 relative">
                        <div className="relative w-10 h-10 mb-1">
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
                              strokeDasharray={`${isNaN(uploadProgress) ? 0 : uploadProgress}, 100`}
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] font-bold">{Math.round(uploadProgress)}%</span>
                          </div>
                        </div>
                        <span className="text-[8px] text-neutral-500 font-bold uppercase">Uploading...</span>
                      </div>
                    )}

                    <button 
                      type="button"
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl bg-neutral-800 border-2 border-dashed border-neutral-700 hover:border-orange-600 hover:text-orange-600 flex flex-col items-center justify-center text-neutral-500 transition-all group"
                    >
                      <Plus className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold uppercase text-center px-1">Add Image</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Input 
                      className="bg-neutral-800 border-none h-11 rounded-xl text-xs"
                      placeholder="Or paste Image URL here..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value;
                          const srcMatch = val.match(/src=["']([^"']+)["']/);
                          const cleanUrl = srcMatch ? srcMatch[1] : val.trim();
                          if (cleanUrl) {
                            setNewProduct(prev => ({
                              ...prev,
                              imageUrls: [...(prev.imageUrls || []), cleanUrl],
                              imageUrl: prev.imageUrl || cleanUrl
                            }));
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 italic">
                    Drag and drop multiple images or click to upload. First image will be the main one.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">
                    {vendorProfile?.category === 'bus_ticket' ? 'Trip Label / Jina la Safari' : 'Product Name / Jina la Bidhaa'}
                  </label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder={vendorProfile?.category === 'bus_ticket' ? "Dar to Arusha (Morning)" : "e.g. Paracetamol 500mg"}
                  />
                </div>

                {vendorProfile?.category === 'bus_ticket' ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Origin (Kutoka)</label>
                        <Input 
                          placeholder="Dar es Salaam"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).origin || ''}
                          onChange={e => setNewProduct({...newProduct, origin: e.target.value} as any)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Boarding point (Eneo la Kupanda)</label>
                        <Input 
                          placeholder="Kibo Complex, Tegeta"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).boardingPoint || ''}
                          onChange={e => setNewProduct({...newProduct, boardingPoint: e.target.value} as any)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Destination (Kwenda)</label>
                        <Input 
                          placeholder="Arusha"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).destination || ''}
                          onChange={e => setNewProduct({...newProduct, destination: e.target.value} as any)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Total Seats (Idadi ya Viti)</label>
                        <Input 
                          type="number"
                          placeholder="45"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).totalSeats || 45}
                          onChange={e => setNewProduct({...newProduct, totalSeats: e.target.value ? parseInt(e.target.value) : 45, stock: e.target.value ? parseInt(e.target.value) : 45} as any)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Departure Time (Muda wa Kuondoka)</label>
                        <Input 
                          type="time"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).departureTime || ''}
                          onChange={e => setNewProduct({...newProduct, departureTime: e.target.value} as any)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Arrival Time (Muda wa Kufika)</label>
                        <Input 
                          type="time"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).arrivalTime || ''}
                          onChange={e => setNewProduct({...newProduct, arrivalTime: e.target.value} as any)}
                        />
                      </div>
                    </div>
                    {branches.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Managing Branch / Kituo Kinachosimamia</label>
                        <Select 
                          value={(newProduct as any).branchId || ''} 
                          onValueChange={val => setNewProduct({...newProduct, branchId: val} as any)}
                        >
                          <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                            <SelectValue placeholder="Select Branch (Optional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            {branches.map(b => (
                              <SelectItem key={`prod-branch-${b.id}`} value={b.id || ''}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Unit / Kipimo</label>
                      <Select 
                        value={newProduct.unit} 
                        onValueChange={v => setNewProduct({...newProduct, unit: v})}
                      >
                        <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                          <SelectItem value="kg">Kilogram (kg)</SelectItem>
                          <SelectItem value="g">Gram (g)</SelectItem>
                          <SelectItem value="unit">Unit (pcs)</SelectItem>
                          <SelectItem value="bunch">Bunch (Fungu)</SelectItem>
                          <SelectItem value="packet">Packet</SelectItem>
                          <SelectItem value="liter">Liter (L)</SelectItem>
                          <SelectItem value="ml">Milliliter (ml)</SelectItem>
                        </SelectContent>
                      </Select>
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
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Category / Aina</label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    placeholder="e.g. mboga, matunda, nyama"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Base Price / Bei ya Msingi (TZS)</label>
                    <Input 
                      type="number"
                      required 
                      className="bg-neutral-800 border-none h-12 rounded-xl"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                      placeholder="e.g. 1500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-orange-500 uppercase">Discount Price / Bei ya Punguzo (TZS)</label>
                    <Input 
                      type="number"
                      className="bg-neutral-800 border-none h-12 rounded-xl text-orange-500"
                      value={newProduct.discountPrice || ''}
                      onChange={e => setNewProduct({...newProduct, discountPrice: e.target.value ? parseFloat(e.target.value) : undefined})}
                      placeholder="Punguzo (Optional)"
                    />
                  </div>
                </div>

                {/* Dynamic Fields based on Vendor Category */}
                {(vendorProfile?.category === 'pharmacy' || vendorProfile?.category === 'grocery') && (
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
                    {vendorProfile?.category === 'pharmacy' && (
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
                    )}
                  </div>
                )}

                {(vendorProfile?.category === 'grocery' || vendorProfile?.category === 'restaurant' || vendorProfile?.category === 'ecommerce') && (
                  <div className="space-y-6 pt-2">
                    {/* Variations / Options */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Product Options (e.g. Color, Type)</label>
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
                          <Plus className="w-3 h-3 mr-1" /> Add Option
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newProduct.variations?.map((v, idx) => (
                          <div key={`var-edit-${idx}`} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                            <Input 
                              className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Name (e.g. Red, XL)"
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
                              placeholder="Price (+)"
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
                      </div>
                    </div>

                    {/* Add-ons */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Product Add-ons (e.g. Bag, Extra Ice)</label>
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
                          <Plus className="w-3 h-3 mr-1" /> Add Add-on
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {newProduct.addOns?.map((a, idx) => (
                          <div key={`addon-edit-${idx}`} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                            <Input 
                              className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                              placeholder="Name (e.g. Plastic Bag)"
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
                              placeholder="Price"
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
                      </div>
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
                    disabled={isProductUploading}
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
        {isAddStaffOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddStaffOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                  <UserPlus className="w-6 h-6 text-orange-600" />
                  {vendorProfile?.category === 'bus_ticket' ? 'Staff Mpya / Agent' : 'New Team Member'}
                </h3>
                <button onClick={() => setIsAddStaffOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddStaff} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Full Name / Jina Kamili</label>
                  <Input 
                    required
                    placeholder="e.g. John Doe" 
                    className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                    value={newStaff.name}
                    onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Role / Kazi</label>
                  <Select value={newStaff.role} onValueChange={val => setNewStaff({...newStaff, role: val})}>
                     <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-neutral-900 border-neutral-800 text-white shadow-2xl rounded-2xl">
                        {vendorProfile?.category === 'bus_ticket' ? (
                          <>
                            <SelectItem value="driver">Driver / Dereva</SelectItem>
                            <SelectItem value="conductor">Conductor / Kondakta</SelectItem>
                            <SelectItem value="agent">Booking Agent / Wakala</SelectItem>
                            <SelectItem value="manager">Manager / Meneja</SelectItem>
                            <SelectItem value="loader">Loader / Mpakuaji</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="chef">Chef / Mpishi</SelectItem>
                            <SelectItem value="waiter">Waiter / WaitRESS</SelectItem>
                            <SelectItem value="cashier">Cashier / Mhasibu</SelectItem>
                            <SelectItem value="manager">Manager / Meneja</SelectItem>
                          </>
                        )}
                     </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Phone Number / Simu</label>
                  <Input 
                    placeholder="+255..." 
                    className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                    value={newStaff.phone}
                    onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                  />
                </div>
                {branches.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Branch / Kituo</label>
                    <Select value={newStaff.branchId} onValueChange={val => setNewStaff({...newStaff, branchId: val})}>
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white">
                        <SelectValue placeholder="Select Branch (Optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white shadow-2xl rounded-2xl">
                        {branches.map(b => (
                          <SelectItem key={`staff-branch-${b.id}`} value={b.id || ''}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button 
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 h-16 rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl shadow-orange-950/40"
                >
                  {vendorProfile?.category === 'bus_ticket' ? 'Onboard Staff / Sajili' : 'Onboard Member'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddBranchOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddBranchOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-orange-600" />
                  {vendorProfile?.category === 'bus_ticket' ? 'Kituo Kipya / Tawi' : 'New Branch / Location'}
                </h3>
                <button onClick={() => setIsAddBranchOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddBranch} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Branch Name / Jina la Tawi</label>
                  <Input 
                    required
                    placeholder="e.g. Arusha Main Office" 
                    className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                    value={newBranch.name}
                    onChange={e => setNewBranch({...newBranch, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Physical Address / Mahali</label>
                  <Input 
                    required
                    placeholder="e.g. Mkunguni Street, Tanga" 
                    className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                    value={newBranch.address}
                    onChange={e => setNewBranch({...newBranch, address: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Contact Phone / Simu</label>
                  <Input 
                    placeholder="+255..." 
                    className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                    value={newBranch.phone}
                    onChange={e => setNewBranch({...newBranch, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Type / Aina</label>
                  <Select value={newBranch.type} onValueChange={val => setNewBranch({...newBranch, type: val})}>
                     <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-neutral-900 border-neutral-800 text-white shadow-2xl rounded-2xl">
                        <SelectItem value="office">Main Office / Ofisi Kuu</SelectItem>
                        <SelectItem value="station">Bus Station / Standi</SelectItem>
                        <SelectItem value="branch">Branch / Tawi</SelectItem>
                        <SelectItem value="agent_point">Agent Point / Kwa Wakala</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 h-16 rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl shadow-orange-950/40"
                >
                  {vendorProfile?.category === 'bus_ticket' ? 'Sajili Kituo / Tawi' : 'Create Branch'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Delete Order Confirmation Modal */}
      <AnimatePresence>
        {isDeleteOrderModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteOrderModalOpen(false)}
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
              <h3 className="text-xl font-bold text-white mb-2">Futa Oda?</h3>
              <p className="text-neutral-400 text-sm mb-8">
                Je, una uhakika unataka kufuta oda hii? Hatua hii haiwezi kurudishwa.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={confirmDeleteOrder}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-900/20"
                >
                  Ndiyo, Futa
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setIsDeleteOrderModalOpen(false)}
                  className="w-full h-14 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-2xl font-bold"
                >
                  Ghairi
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Section Modal */}
      <AnimatePresence>
        {isAddSectionOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddSectionOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2rem] overflow-hidden shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-600" />
                  Add New {vendorContext.locationLabelSingular}
                </h3>
                <button onClick={() => setIsAddSectionOpen(false)} className="text-neutral-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleAddSection} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">{vendorContext.locationLabelSingular} Label / Number</label>
                  <Input 
                    required
                    placeholder={`e.g. ${vendorContext.locationLabelSingular} 1`} 
                    className="bg-neutral-800 border-none h-11 rounded-xl"
                    value={newSection.number}
                    onChange={e => setNewSection({...newSection, number: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">
                    {vendorProfile?.category === 'restaurant' ? 'Seating Capacity' : 'Capacity (Approx. Items)'}
                  </label>
                  <Input 
                    type="number"
                    required
                    placeholder={vendorProfile?.category === 'restaurant' ? 'e.g. 4' : 'e.g. 50'} 
                    className="bg-neutral-800 border-none h-11 rounded-xl"
                    value={isNaN(newSection.capacity) ? '' : newSection.capacity}
                    onChange={e => setNewSection({...newSection, capacity: e.target.value ? parseInt(e.target.value) : 0})}
                  />
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 h-11 rounded-xl font-bold mt-4"
                >
                  Create Stand
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Builder Modal */}
      <AnimatePresence>
        {isQrBuilderOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQrBuilderOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-5xl bg-[#0F0F11] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                    Qr Builder {selectedSection && <span className="text-orange-600">— Aisle Stand: {selectedSection.number}</span>}
                  </h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                    {selectedSection ? `Design for Aisle ${selectedSection.number}` : 'Customize your digital experience'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsQrBuilderOpen(false)} 
                  className="text-white bg-white/5 hover:bg-white/10 p-3 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Options Panel */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar border-r border-white/5 bg-black/40">
                  
                  {/* QR Data Preview */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Target URL / Link ya Bidhaa</label>
                    <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                       <LinkIcon className="w-4 h-4 text-orange-600 shrink-0" />
                       <p className="text-[10px] font-mono text-neutral-400 break-all">{qrOptions.data || 'Hakuna Link...'}</p>
                    </div>
                  </div>

                  {/* QR Block Style */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Qr Block Style / Aina ya Michoro</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {(['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'] as DotType[]).map((type, tIdx) => (
                        <button
                          key={`qr-dot-style-${type}-${tIdx}`}
                          onClick={() => setQrOptions({ ...qrOptions, dotsOptions: { ...qrOptions.dotsOptions, type } })}
                          className={`aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${
                            qrOptions.dotsOptions.type === type 
                              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-950/20' 
                              : 'bg-neutral-900 border-white/5 text-neutral-500 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-8 h-8 border-2 border-current rounded-sm flex flex-wrap p-1 gap-1 overflow-hidden opacity-80`}>
                             {Array.from({length: 4}).map((_, i) => (
                               <div key={`qr-dot-sub-${type}-${i}`} className={`w-2 h-2 bg-current ${
                                 type === 'dots' ? 'rounded-full' : 
                                 type === 'rounded' ? 'rounded-sm' : 
                                 'rounded-none'
                               }`}></div>
                             ))}
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest">{type.replace('-', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Eye Style */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Eye Style / Aina ya Kona</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['square', 'dot', 'extra-rounded'] as CornerSquareType[]).map((type, tIdx) => (
                        <button
                          key={`qr-eye-style-${type}-${tIdx}`}
                          onClick={() => setQrOptions({ 
                            ...qrOptions, 
                            cornersSquareOptions: { ...qrOptions.cornersSquareOptions, type },
                            cornersDotOptions: { ...qrOptions.cornersDotOptions, type: type === 'extra-rounded' ? 'dot' : type as any }
                          })}
                          className={`h-14 rounded-2xl border transition-all flex items-center justify-center gap-3 ${
                            qrOptions.cornersSquareOptions.type === type 
                              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-950/20' 
                              : 'bg-neutral-900 border-white/5 text-neutral-500 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-6 h-6 border-2 border-current flex items-center justify-center ${
                             type === 'dot' ? 'rounded-full' : 
                             type === 'extra-rounded' ? 'rounded-lg' : 
                             'rounded-none'
                          }`}>
                             <div className={`w-2 h-2 bg-current ${type === 'dot' ? 'rounded-full' : type === 'extra-rounded' ? 'rounded-sm' : 'rounded-none'}`}></div>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Preset */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Color / Rangi</label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                       {[
                         '#000000', '#71717A', '#E2E8F0', '#F97316', '#EAB308', 
                         '#22C55E', '#3B82F6', '#06B6D4', '#EF4444', '#EC4899'
                       ].map((color, cIdx) => (
                         <button
                           key={`qr-color-${color}-${cIdx}`}
                           onClick={() => setQrOptions({ 
                             ...qrOptions, 
                             dotsOptions: { ...qrOptions.dotsOptions, color },
                             cornersSquareOptions: { ...qrOptions.cornersSquareOptions, color },
                             cornersDotOptions: { ...qrOptions.cornersDotOptions, color }
                           })}
                           className={`aspect-square rounded-xl border-2 transition-all relative flex items-center justify-center ${
                             qrOptions.dotsOptions.color === color ? 'border-white scale-110 z-10' : 'border-transparent'
                           }`}
                           style={{ backgroundColor: color }}
                         >
                           {qrOptions.dotsOptions.color === color && <Check className={`w-3 h-3 ${color === '#E2E8F0' ? 'text-black' : 'text-white'}`} />}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Background Color Preset */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Background Color / Rangi ya Nyuma</label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                       {[
                         '#ffffff', '#000000', '#71717A', '#E2E8F0', '#F97316', '#EAB308', 
                         '#22C55E', '#3B82F6', '#06B6D4', '#EF4444', '#EC4899'
                       ].map((color, cIdx) => (
                         <button
                           key={`qr-bg-color-${color}-${cIdx}`}
                           onClick={() => setQrOptions({ ...qrOptions, backgroundOptions: { color } })}
                           className={`aspect-square rounded-xl border-2 transition-all relative flex items-center justify-center ${
                             qrOptions.backgroundOptions.color === color ? 'border-orange-500 scale-110 z-10' : 'border-transparent'
                           }`}
                           style={{ backgroundColor: color }}
                         >
                           {color === '#ffffff' && <div className="absolute inset-0 border border-neutral-800 rounded-xl pointer-events-none"></div>}
                           {qrOptions.backgroundOptions.color === color && <Check className={`w-3 h-3 ${color === '#ffffff' || color === '#E2E8F0' ? 'text-black' : 'text-white'}`} />}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* QR Code Mode */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Qr Code Mode / Nembo ya Kati</label>
                    </div>
                    <Select 
                      value={qrOptions.image ? 'image' : 'none'}
                      onValueChange={(val) => {
                        if (val === 'image') {
                          setQrOptions((prev: any) => ({ 
                            ...prev, 
                            image: vendorProfile?.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${vendorProfile?.businessName || 'Vendor'}`,
                            imageOptions: { ...prev.imageOptions, hideBackgroundDots: true, imageSize: 0.35, margin: 5 }
                          }));
                        } else {
                          setQrOptions((prev: any) => ({ ...prev, image: '' }));
                        }
                      }}
                    >
                      <SelectTrigger className="bg-neutral-900 border-white/5 h-14 rounded-2xl text-white font-bold">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-white/10 text-white">
                        <SelectItem value="none">None (Plain QR)</SelectItem>
                        <SelectItem value="image">Business Logo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Print Customization */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Print Layout / Mpangilio wa Print</label>
                       <button 
                         onClick={() => setPrintDetails({...printDetails, isPrintMode: !printDetails.isPrintMode})}
                         className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest transition-all ${
                           printDetails.isPrintMode ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'
                         }`}
                       >
                         {printDetails.isPrintMode ? 'Layout Iwashwa' : 'Washa Mpangilio'}
                       </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-xl border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">Show Shop Logo</span>
                          <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-tighter">Onyesha nembo ya duka</span>
                        </div>
                        <button 
                          onClick={() => setPrintDetails({...printDetails, showLogo: !printDetails.showLogo})}
                          className={`w-10 h-5 rounded-full transition-all relative flex items-center px-1 ${printDetails.showLogo ? 'bg-orange-600' : 'bg-neutral-700'}`}
                        >
                          <div className={`w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm ${printDetails.showLogo ? 'translate-x-4.5' : 'translate-x-0'}`}></div>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1 text-center block mb-2">Stand Theme Color / Rangi ya Stand</span>
                        <div className="flex flex-wrap justify-center gap-2 pb-2">
                          {[
                            '#ea580c', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', 
                            '#ec4899', '#06b6d4', '#000000', '#71717a'
                          ].map((color, iIdx) => (
                            <button
                              key={`stand-color-${color}-${iIdx}`}
                              onClick={() => setPrintDetails({...printDetails, accentColor: color})}
                              className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                                printDetails.accentColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {printDetails.accentColor === color && <Check className="w-3 h-3 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1 text-center block mb-2">Header Color / Rangi ya Juu</span>
                        <div className="flex flex-wrap justify-center gap-2 pb-4 border-b border-white/5">
                          {[
                            '#1A1A1A', '#000000', '#ffffff', '#ea580c', '#3b82f6', 
                            '#22c55e', '#ef4444', '#71717a'
                          ].map((color, hIdx) => (
                            <button
                              key={`stand-header-color-${color}-${hIdx}`}
                              onClick={() => setPrintDetails({...printDetails, headerBg: color})}
                              className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                                printDetails.headerBg === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {printDetails.headerBg === color && <Check className={`w-3 h-3 ${color === '#ffffff' ? 'text-black' : 'text-white'}`} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Title / Jina la Biashara</span>
                        <Input 
                          placeholder="e.g. KARIBU SOKONI"
                          className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                          value={printDetails.header}
                          onChange={e => setPrintDetails({...printDetails, header: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Sub-header / Maelezo</span>
                        <Input 
                          placeholder="e.g. ORODHA YA KIDIJITALI"
                          className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                          value={printDetails.subHeader}
                          onChange={e => setPrintDetails({...printDetails, subHeader: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Footer / Maelekezo</span>
                        <Input 
                          placeholder="e.g. Scan to view items"
                          className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                          value={printDetails.footer}
                          onChange={e => setPrintDetails({...printDetails, footer: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Phone / Simu</span>
                          <Input 
                            className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                            value={printDetails.phone}
                            onChange={e => setPrintDetails({...printDetails, phone: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest px-1">Location / Mahali</span>
                          <Input 
                            className="bg-neutral-900 border-white/5 h-11 rounded-xl text-white text-xs focus:ring-1 focus:ring-orange-600"
                            value={printDetails.address}
                            onChange={e => setPrintDetails({...printDetails, address: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="lg:w-[480px] bg-[#0c0c0e] p-6 sm:p-10 flex flex-col items-center justify-start gap-8 relative overflow-y-auto custom-scrollbar min-h-[600px] lg:min-h-0">
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest italic">Live Content Preview</span>
                  </div>
                  
                  {/* Print Layout Preview */}
                  <div id="printable-stand" className={`
                    relative transition-all duration-500 flex flex-col items-stretch shrink-0
                    ${printDetails.isPrintMode 
                      ? 'bg-[#ffffff] shadow-2xl w-full max-w-[380px] min-h-[537px] border border-neutral-200 text-black' 
                      : 'hidden'
                    }
                  `}>
                    {printDetails.isPrintMode && (
                      <>
                        {/* Dark Header Section */}
                        <div 
                          className="p-5 flex flex-col items-center justify-center text-center relative overflow-hidden shrink-0 min-h-[110px]"
                          style={{ backgroundColor: printDetails.headerBg }}
                        >
                          {/* Subtle Pattern overlay */}
                          <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-wrap gap-4 p-2">
                             {Array.from({length: 12}).map((_, i) => <Zap key={`stand-zap-${i}`} className="w-8 h-8 rotate-12" />)}
                          </div>
                          
                          {vendorProfile?.logoUrl && printDetails.showLogo && (
                            <div className="w-12 h-12 mb-1.5 rounded-xl border border-white/10 overflow-hidden relative z-10 bg-white p-1">
                              <img 
                                src={vendorProfile.logoUrl} 
                                alt="Logo" 
                                className="w-full h-full object-contain" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${vendorProfile.businessName}`;
                                }}
                              />
                            </div>
                          )}
                          <h2 
                            className="text-lg font-black uppercase tracking-tight leading-tight relative z-10"
                            style={{ color: printDetails.headerBg === '#ffffff' || printDetails.headerBg === '#E2E8F0' ? '#000000' : '#ffffff' }}
                          >
                            {printDetails.header}
                          </h2>
                          <div 
                            className="w-8 h-0.5 mt-1.5 relative z-10"
                            style={{ backgroundColor: printDetails.accentColor }}
                          ></div>
                          <p 
                            className="text-[7.5px] font-black uppercase tracking-[0.2em] mt-1.5 relative z-10"
                            style={{ color: printDetails.accentColor }}
                          >{printDetails.subHeader}</p>
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 flex flex-col items-center justify-between py-6 px-6 text-center bg-white">
                          
                          {/* QR Code Section */}
                          <div className="w-full flex flex-col items-center">
                            {/* Title above QR */}
                            <div className="bg-neutral-50 px-5 py-1.5 border border-neutral-100 rounded-full mb-4 shadow-sm">
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">BIDHAA ZA {vendorProfile?.businessName?.toUpperCase() || 'DUKA'}</p>
                            </div>
                            
                            {/* The QR Code itself */}
                            <div 
                              className="relative p-5 bg-white rounded-[2.5rem] border shadow-xl flex items-center justify-center"
                              style={{ borderColor: `${printDetails.accentColor}15` }}
                            >
                               <div 
                                 ref={qrPrintRef} 
                                 className="flex items-center justify-center w-[160px] h-[160px] [&>canvas]:max-w-full [&>canvas]:max-h-full [&>svg]:max-w-full [&>svg]:max-h-full overflow-hidden"
                               ></div>
                            </div>
                          </div>

                          {/* Instructions */}
                          <div className="space-y-3 my-4">
                            <h3 className="text-2xl font-black uppercase leading-[0.85] tracking-tighter text-neutral-900 italic">
                              SCAN & AGIZA <br/> BIDHAA HAPA
                            </h3>
                            <div className="space-y-0.5">
                              <p 
                                className="text-[11px] font-black uppercase tracking-widest leading-none"
                                style={{ color: printDetails.accentColor }}
                              >Changanua kwa simu yako</p>
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight">Fungua Orodha & Pata Bidhaa!</p>
                            </div>
                          </div>

                          {/* Table Info & Footer */}
                          <div className="w-full space-y-4">
                            <div className="w-full grid grid-cols-2 gap-3">
                              {/* Table/Section Number */}
                              <div className="flex flex-col items-center p-3 bg-neutral-950 rounded-[1.25rem] shadow-lg text-white">
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">
                                  {vendorContext.locationLabelSingular ? vendorContext.locationLabelSingular.toUpperCase() : 'SECTION'}
                                </span>
                                <span 
                                  className="text-xl font-black italic tracking-tighter font-mono leading-none"
                                  style={{ color: printDetails.accentColor }}
                                >
                                  #{selectedSection?.number || '01'}
                                </span>
                              </div>

                              {/* Capacity */}
                              <div className="flex flex-col items-center p-3 bg-neutral-50 border border-neutral-100 rounded-[1.25rem] shadow-sm">
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1 leading-none">SEATING</span>
                                <div className="flex items-center gap-1">
                                  <Users className="w-2.5 h-2.5 text-neutral-400" />
                                  <span className="text-lg font-black italic tracking-tighter text-neutral-900 font-mono leading-none">
                                    {selectedSection?.capacity || '04'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-[8px] font-black italic text-neutral-400 uppercase tracking-widest max-w-[180px] mx-auto opacity-70">
                                {printDetails.footer}
                              </p>
                              
                              {(printDetails.phone || printDetails.address) && (
                                <div className="flex items-center justify-center gap-3 text-[7.5px] font-bold text-neutral-300 uppercase tracking-widest pt-2 border-t border-neutral-50 grayscale opacity-40">
                                   {printDetails.phone && <span>{printDetails.phone}</span>}
                                   {printDetails.address && <span className="max-w-[110px] truncate">{printDetails.address}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Non-Print Preview Mode */}
                  {!printDetails.isPrintMode && (
                    <div className="relative group p-10 flex flex-col items-center justify-center">
                      <div className="absolute -inset-4 bg-orange-600/20 rounded-[3rem] blur-2xl group-hover:bg-orange-600/30 transition-all duration-500"></div>
                      <div 
                        ref={qrRef} 
                        className="relative transition-all duration-500 shadow-sm p-8 bg-white rounded-[2.5rem] shadow-2xl group-hover:scale-[1.02]"
                      ></div>
                      
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-48 py-2 bg-neutral-900/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center gap-2">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest italic">Live Content Preview</span>
                      </div>
                    </div>
                  )}
                </div>

                  <div className="w-full space-y-4 max-w-[280px]">
                    {printDetails.isPrintMode ? (
                      <div className="space-y-3">
                        <Button 
                          onClick={handleDownloadStand}
                          disabled={isExporting}
                          className="w-full h-16 bg-orange-600 text-white hover:bg-orange-700 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl transition-all"
                        >
                          {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-4 h-4 mr-3" />} 
                          Pakua kama Picha (Stand)
                        </Button>
                        <Button 
                          onClick={handlePrint}
                          variant="outline"
                          className="w-full h-14 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all"
                        >
                          <Printer className="w-4 h-4 mr-3" /> Chapa (Print Stand)
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={downloadQr}
                        className="w-full h-16 bg-white text-black hover:bg-neutral-200 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl transition-all"
                      >
                        <Download className="w-4 h-4 mr-3" /> Download QR Only
                      </Button>
                    )}
                    <p className="text-center text-[9px] text-neutral-500 font-bold uppercase tracking-[0.15em] leading-relaxed">
                       {printDetails.isPrintMode 
                         ? 'This layout is optimized for acrylic store displays.' 
                         : `Scan this code to directly access the shop for Aisle ${selectedSection?.number || ''}`
                       }
                    </p>
                  </div>
                </div>
              
              <div className="p-8 border-t border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                 <div className="flex gap-4">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-neutral-500 uppercase">Format</span>
                       <span className="text-xs font-black text-white italic">PNG • 300x300</span>
                    </div>
                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-neutral-500 uppercase">Data Path</span>
                       <span className="text-xs font-black text-orange-500 italic opacity-80">/vendor/{vendorProfile?.id?.slice(0,8)}...</span>
                    </div>
                 </div>
                 <Button 
                   onClick={() => setIsQrBuilderOpen(false)}
                   className="h-14 px-10 bg-orange-600 hover:bg-orange-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white shadow-xl shadow-orange-950/20"
                 >
                   Save Changes
                 </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div id="order-receipt" className="hidden fixed left-0 top-0 w-[80mm] bg-white text-black p-6 font-sans">
        {orderToPrint && (
          <div className="flex flex-col">
            {/* Header / Brand */}
            <div className="w-full text-center mb-6">
               <h1 className="text-2xl font-black text-neutral-900 leading-tight mb-2">
                 {vendorProfile?.businessName || 'Soko App'}
               </h1>
               <p className="text-[10px] text-neutral-600 font-bold max-w-[200px] mx-auto leading-relaxed">
                 {vendorProfile?.address || 'Anuani ya Biashara'}
               </p>
               <p className="text-[10px] text-neutral-600 font-bold mt-1">
                 Tel: {vendorProfile?.phoneNumber || 'Simu'}
               </p>
            </div>

            {/* Receipt Divider */}
            <div className="w-full border-b border-dashed border-neutral-300 mb-4 h-0"></div>

            {/* Order Basics */}
            <div className="space-y-1 mb-4">
               <p className="text-[11px] font-bold text-neutral-900">Order #{orderToPrint.id?.slice(-8).toUpperCase()}</p>
               <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600">
                  <span>{format(orderToPrint.createdAt ? new Date(orderToPrint.createdAt) : new Date(), 'dd-MM-yyyy')}</span>
                  <span>{format(orderToPrint.createdAt ? new Date(orderToPrint.createdAt) : new Date(), 'HH:mm A')}</span>
               </div>
            </div>

            {/* Receipt Divider */}
            <div className="w-full border-b border-dashed border-neutral-300 mb-3 h-0"></div>

            {/* Table Header */}
            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-neutral-900 mb-3 px-1">
               <span className="w-8">Qty</span>
               <span className="flex-1 px-4">Item Description</span>
               <span className="w-20 text-right">Price</span>
            </div>

            {/* Receipt Divider (Inner) */}
            <div className="w-full border-b border-neutral-100 mb-3 h-0"></div>

            {/* Items List */}
            <div className="space-y-4 mb-6">
               {orderToPrint.items.map((item, idx) => (
                 <div key={`print-item-${orderToPrint.id}-${idx}`} className="flex justify-between items-start text-[11px] font-bold text-neutral-900">
                    <span className="w-8 shrink-0">{item.quantity}</span>
                    <div className="flex-1 px-4">
                       <p className="uppercase leading-tight">{item.name}</p>
                       <p className="text-[9px] text-neutral-500 font-bold mt-1 uppercase italic">
                         Size: {item.variation || 'Regular'}
                         {item.addOns && item.addOns.length > 0 && ` • Extras: ${item.addOns.map((a: any) => a.name).join(', ')}`}
                       </p>
                    </div>
                    <span className="w-20 text-right shrink-0">TZS {(item.price * item.quantity).toLocaleString()}</span>
                 </div>
               ))}
            </div>

            {/* Summary Totals Section */}
            <div className="w-full border-t border-dashed border-neutral-300 pt-4 space-y-2 mb-6">
               <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                  <span>SUBTOTAL:</span>
                  <span>TZS {orderToPrint.totalAmount.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                  <span>TOTAL TAX:</span>
                  <span>TZS 0.00</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                  <span>DISCOUNT:</span>
                  <span>TZS 0.00</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-relaxed">
                  <span>DELIVERY CHARGE:</span>
                  <span>TZS 0.00</span>
               </div>
               <div className="flex justify-between items-center pt-3 mt-1 border-t border-neutral-900">
                  <span className="text-sm font-black uppercase tracking-tighter text-neutral-900">TOTAL:</span>
                  <span className="text-lg font-black text-neutral-900 tracking-tighter italic">TZS {orderToPrint.totalAmount.toLocaleString()}</span>
               </div>
            </div>

            {/* Receipt Divider */}
            <div className="w-full border-b border-dashed border-neutral-300 mb-4 h-0"></div>

            {/* Detailed Info Section */}
            <div className="space-y-3 mb-6 px-1">
               <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold text-neutral-600">
                  <div className="flex flex-col decoration-neutral-200">
                     <span className="text-neutral-400 uppercase text-[8px] mb-0.5">Payment Type:</span>
                     <span className="text-neutral-900 uppercase">{orderToPrint.paymentMethod || 'Cash'}</span>
                  </div>
                  <div className="flex flex-col text-right">
                     <span className="text-neutral-400 uppercase text-[8px] mb-0.5">Order Type:</span>
                     <span className="text-neutral-900 uppercase">{orderToPrint.orderType || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                     <span className="text-neutral-400 uppercase text-[8px] mb-0.5">Delivery Time:</span>
                     <span className="text-neutral-900">19-04-2026 08:30 PM - 09:00 PM</span>
                  </div>
               </div>
            </div>

            {/* Customer Details */}
            <div className="w-full border-t border-dashed border-neutral-300 pt-4 mb-8 space-y-3 px-1">
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Customer:</span>
                  <p className="text-[10px] font-bold text-neutral-900 uppercase">{orderToPrint.customerName || 'Walk-in Customer'}</p>
               </div>
               {orderToPrint.customerPhone && (
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Phone:</span>
                    <p className="text-[10px] font-bold text-neutral-900">{orderToPrint.customerPhone}</p>
                 </div>
               )}
               {orderToPrint.deliveryAddress && (
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Address:</span>
                    <p className="text-[10px] font-bold text-neutral-900 leading-relaxed">{orderToPrint.deliveryAddress}</p>
                 </div>
               )}
            </div>

            {/* Receipt Footer */}
            <div className="w-full border-t border-dashed border-neutral-300 pt-6 text-center">
               <p className="text-[12px] font-black text-neutral-900 italic tracking-widest mb-12">Thank You</p>
               <div className="flex flex-col items-end opacity-40 grayscale">
                  <span className="text-[6px] font-bold uppercase tracking-tight">Powered by</span>
                  <p className="text-[7px] font-black uppercase tracking-tight text-neutral-900 leading-tight">
                    Papo Hapo - Grocery Store & Delivery App
                  </p>
               </div>
            </div>
          </div>
        )}
      </div>

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

        @media print {
          @page {
            size: A5;
            margin: 0;
          }
          body * {
            visibility: hidden;
            display: none !important;
          }
          #printable-stand, #printable-stand *, #order-receipt, #order-receipt * {
            visibility: visible !important;
            display: flex !important;
            flex-direction: column !important;
          }
          #printable-stand {
            position: relative !important;
            margin: auto !important;
            width: 148mm !important; /* A5 Width */
            height: 210mm !important; /* A5 Height */
            padding: 10mm !important;
            background: white !important;
            z-index: 10000 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
          }
          #order-receipt {
             position: fixed !important;
             left: 0 !important;
             top: 0 !important;
             width: 80mm !important;
             height: auto !important;
             background: white !important;
             color: black !important;
             padding: 10mm 6mm !important;
             z-index: 10000 !important;
             display: flex !important;
             flex-direction: column !important;
             border: none !important;
             box-shadow: none !important;
          }
          #order-receipt * {
             color: black !important;
             border-color: #d4d4d4 !important;
          }
          #order-receipt .border-dashed {
              border-style: dashed !important;
              border-bottom-width: 1pt !important;
          }
          #order-receipt h1 {
              font-size: 16pt !important;
              font-weight: 900 !important;
          }
          #order-receipt p, #order-receipt span, #order-receipt div {
              line-height: 1.4 !important;
          }
          #printable-stand h2 {
            font-size: 28pt !important;
            margin-bottom: 5pt !important;
          }
          #printable-stand p {
            font-size: 10pt !important;
          }
          #printable-stand .bg-white {
            width: 350px !important;
            height: 350px !important;
            margin: 40px 0 !important;
            border: 2px solid #ea580c20 !important;
          }
          #printable-stand .bg-orange-600 {
             background-color: #ea580c !important;
             color: white !important;
             -webkit-print-color-adjust: exact;
          }
        }
      `}} />
    </div>
  );
}
