import React, { useEffect, useState, useMemo, useRef } from 'react';
import { initiatePayment } from '../services/paymentService';
import QRCodeStyling, { DotType, CornerSquareType, CornerDotType } from "qr-code-styling";
import { toPng } from 'html-to-image';
import { storageService } from '../services/storageService';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, addDoc, setDoc, getDoc, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile, VendorCategory, Product, Order, OrderStatus, Review } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Skeleton } from './ui/Skeleton';
import { PapoFood3DStudioModal } from './PapoFood3DStudioModal';
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
  HelpCircle,
  Monitor,
  MoreVertical,
  MoreHorizontal,
  Menu,
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
  FileText,
  Info,
  Bed,
  LayoutGrid,
  ShieldCheck,
  Coins,
  Image as ImageIcon,
  Megaphone,
  UserPlus,
  Save,
  ShoppingBag,
  Beer,
  Car,
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
  Key,
  MessageCircle,
  Link as LinkIcon,
  Palette,
  Loader2,
  Printer,
  Utensils,
  UtensilsCrossed,
  Pill,
  FlaskConical,
  Scissors,
  Hotel,
  ChefHat,
  ClipboardList,
  BadgeCheck,
  Volume2,
  VolumeX,
  UserCheck,
  UserCog,
  MessageSquare as MessageIcon,
  Database,
  Coffee,
  Compass,
  Layers,
  Move,
  Map,
  Landmark,
  Activity,
  PieChart as LucidePieChart,
  DoorOpen,
  Eye,
  Wifi,
  Sparkles,
  Wine,
  Crown,
  Heart,
  CheckCircle2,
  Flame
, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
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

type TabType = 'overview' | 'orders' | 'products' | 'pos' | 'inventory_stats' | 'customers' | 'coupons' | 'staff' | 'settings' | 'tables' | 'market_pulse' | 'freshness' | 'messages' | 'branches' | 'twilio_responder' | 'rest_inventory' | 'rest_expenses' | 'rest_reports' | 'map_qr_setup';

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
import { useBusinessConfig } from '../BusinessConfigContext';
import LocationPicker from './LocationPicker';
import Chat from './Chat';
import { TwilioResponderTab } from './TwilioResponderTab';
import VendorMapQRSetup from './VendorMapQRSetup';

interface MiniQrProps {
  data: string;
  size?: number;
  dotsColor?: string;
  dotsType?: any;
}

const MiniQrCode: React.FC<MiniQrProps> = ({ 
  data, 
  size = 40, 
  dotsColor = '#000000', 
  dotsType = 'square' 
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active || !ref.current || typeof window === 'undefined') return;
      try {
        ref.current.innerHTML = '';
        const qr = new QRCodeStyling({
          width: size * 2,
          height: size * 2,
          type: 'svg',
          data: data || 'https://papo-hapo.com',
          dotsOptions: {
            color: dotsColor || '#000000',
            type: dotsType || 'square'
          },
          backgroundOptions: {
            color: '#ffffff'
          },
          margin: 2
        });
        qr.append(ref.current);
      } catch (err) {
        console.error('MiniQrCode render error:', err);
      }
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data, size, dotsColor, dotsType]);

  return (
    <div 
      ref={ref} 
      className="shrink-0 flex items-center justify-center bg-white rounded-lg p-0.5 border border-neutral-100 shadow-xs [&>svg]:w-full [&>svg]:h-full [&>svg]:block [&>canvas]:w-full [&>canvas]:h-full" 
      style={{ width: size + 4, height: size + 4 }} 
    />
  );
};

const getProxiedImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http') && !url.includes(window.location.host)) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const getSafeTime = (val: any): number => {
  try {
    if (!val) return 0;
    
    // 1. Standard Date object
    if (val instanceof Date) {
      return val.getTime();
    }
    
    // 2. Firestore Timestamp standard class or deserialized plain object
    if (typeof val === 'object') {
      if (typeof val.seconds === 'number') {
        return val.seconds * 1000;
      }
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
    }
    
    // 3. String, Number or other parsable format
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
    
    // 1. Standard Date object
    if (val instanceof Date) {
      return val;
    }
    
    // 2. Firestore Timestamp standard class or deserialized plain object
    if (typeof val === 'object') {
      if (typeof val.seconds === 'number') {
        return new Date(val.seconds * 1000);
      }
      if (typeof val.toDate === 'function') {
        try {
          const d = val.toDate();
          if (d instanceof Date) return d;
        } catch (innerErr) {
          console.warn("Error calling toDate inside getSafeDate:", innerErr);
        }
      }
    }
    
    // 3. String, Number or other parsable format
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch (err) {
    console.error("Critical error in getSafeDate:", err);
    return new Date();
  }
};

interface CustomIconProps {
  className?: string;
  size?: number;
}

const TableCustomIcon: React.FC<CustomIconProps> = ({ className, size = 26 }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className} 
    style={{ width: size, height: size }}
  >
    <ellipse cx="12" cy="7.5" rx="6.5" ry="2.2" />
    <path d="M12 9.7v3.5" />
    <path d="M9 18.5c1.5-2 4.5-2 6 0" />
    <path d="M10 13.2h4" />
    <path d="M10 13.2c-1 2-1 4.5-1 5.3" />
    <path d="M14 13.2c1 2 1 4.5 1 5.3" />
    <circle cx="12" cy="21.5" r="1.2" fill="currentColor" />
  </svg>
);

const OrdersCustomIcon: React.FC<CustomIconProps> = ({ className, size = 26 }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ width: size, height: size }}
  >
    <path d="M5 3l1.7 1 1.7-1 1.6 1 1.7-1 1.7 1 1.6-1 1.7 1 1.7-1v18l-1.7-1-1.7 1-1.6-1-1.7 1-1.7-1-1.6 1-1.7-1-1.7 1V3z" />
    <path d="M9 8h6M9 12h4M9 16h6" strokeWidth="2" />
  </svg>
);

const MenuCustomIcon: React.FC<CustomIconProps> = ({ className, size = 26 }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ width: size, height: size }}
  >
    <path d="M12 20V5a1 1 0 0 0-1-1H4v13c0 1.2 1.5 1.2 2.5 1.5s3.5 .5 5.5 1" />
    <path d="M12 20V5a1 1 0 0 1 1-1h7v13c0 1.2-1.5 1.2-2.5 1.5s-3.5 .5-5.5 1" />
    <path d="M6.5 8h2.5M6.5 11h2.5M6.5 14h2.5" strokeWidth="1.8" />
    <path d="M15 8h2.5M15 11h2.5M15 14h2.5" strokeWidth="1.8" />
  </svg>
);

const AlertsCustomIcon: React.FC<CustomIconProps> = ({ className, size = 26 }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ width: size, height: size }}
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ProfileCustomIcon: React.FC<CustomIconProps> = ({ className, size = 26 }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ width: size, height: size }}
  >
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21a8.5 8.5 0 0 1 13 0" />
  </svg>
);

export default function VendorDashboard() {
  const { profile, user } = useAuth();
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
  const { config: businessConfig } = useBusinessConfig();
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<any>(null);
  const [activeFulfillmentTab, setActiveFulfillmentTab] = useState(0);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  const [isNavVisible, setIsNavVisible] = useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 50) {
      setIsNavVisible(false);
    } else {
      setIsNavVisible(true);
    }
  });

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
          locationLabel: 'Section Management',
          locationLabelSingular: 'Section',
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
      case 'car_rental':
        return {
          type: 'retail',
          ordersLabel: 'Maombi ya Kukodi',
          ordersDescription: 'Dhibiti maombi ya kukodisha magari na ratiba.',
          ordersIcon: Key,
          inventoryLabel: 'Magari ya Kukodisha',
          inventoryIcon: Car,
          locationLabel: 'Vituo vya Kukabidhi',
          locationLabelSingular: 'Kituo',
          posLabel: 'Dawati la Kukodisha',
          posIcon: Banknote,
          fulfillmentAction: 'Kukodisha',
          readyLabel: 'Gari Lipo Tayari',
          pickingLabel: 'Gari Lipo Safarini',
          awaitingLabel: 'Maombi Mpya'
        };
      case 'car_sale':
        return {
          type: 'retail',
          ordersLabel: 'Maombi ya Kununua',
          ordersDescription: 'Dhibiti maombi ya ununuzi na ukaguzi wa magari.',
          ordersIcon: Key,
          inventoryLabel: 'Magari ya Kuuza',
          inventoryIcon: Car,
          locationLabel: 'Yard / Showroom',
          locationLabelSingular: 'Showroom',
          posLabel: 'Dawati la Mauzo',
          posIcon: Banknote,
          fulfillmentAction: 'Kuuza',
          readyLabel: 'Gari Limeuzwa',
          pickingLabel: 'Kwenye Majaribio',
          awaitingLabel: 'Maombi Mapya'
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
  const [vendorReviews, setVendorReviews] = useState<Review[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [manualBooking, setManualBooking] = useState<Partial<Order>>({
    customerName: '',
    customerPhone: '',
    roomType: '',
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: '',
    totalAmount: 0,
    paymentStatus: 'pending',
    guestIdType: 'Nida',
    guestIdNumber: ''
  });

  const handleManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorProfile?.id) return;
    
    const toastId = toast.loading('Nasajili booking...');
    try {
      await addDoc(collection(db, 'orders'), {
        ...manualBooking,
        vendorId: vendorProfile.id,
        vendorOwnerUid: user?.uid,
        customerId: `walk-in-${Date.now()}`,
        status: 'accepted',
        type: 'hotel',
        orderSource: 'reception',
        orderType: 'booking',
        items: [{ 
          name: manualBooking.roomType, 
          price: manualBooking.totalAmount, 
          quantity: manualBooking.numberOfNights || 1,
          productId: 'manual' 
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('Booking imepokelewa!', { id: toastId });
      setShowManualBooking(false);
      setManualBooking({
        customerName: '',
        customerPhone: '',
        roomType: '',
        checkInDate: new Date().toISOString().split('T')[0],
        checkOutDate: '',
        totalAmount: 0,
        paymentStatus: 'pending',
        guestIdType: 'Nida',
        guestIdNumber: ''
      });
    } catch (error) {
      toast.error('Imeshindwa kusajili booking.', { id: toastId });
    }
  };

  const toggleCleaning = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isCleaning: !currentStatus,
        updatedAt: serverTimestamp()
      });
      // Update local state
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, isCleaning: !currentStatus } : p));
      toast.success(!currentStatus ? 'Chumba kinafanyiwa usafi' : 'Usafi umekamilika');
    } catch (error) {
      toast.error('Imeshindwa kubadilisha hali ya usafi');
    }
  };

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
  const [isModelUploading, setIsModelUploading] = useState(false);
  const [is3DStudioOpen, setIs3DStudioOpen] = useState(false);
  const [isStandBgUploading, setIsStandBgUploading] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteOrderModalOpen, setIsDeleteOrderModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState<{
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    active: boolean;
    productId: string | null;
  }>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    active: true,
    productId: null
  });

  // POS Enhanced States
  const [orderType, setOrderType] = useState<'walk_in' | 'pickup' | 'delivery'>('walk_in');
  const [tableNumber, setTableNumber] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money'>('cash');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [posCustomer, setPosCustomer] = useState<any>(null);

  // Retail Location States (Formerly Tables)
  const [sections, setSections] = useState<any[]>([]);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [newSection, setNewSection] = useState({ number: '', capacity: 4, allowSharing: false, shape: 'square', section: 'Indoor', x: 50, y: 50 });
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const updateDraggingId = (id: string | null) => {
    setDraggingId(id);
    draggingIdRef.current = id;
  };
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [prepTime, setPrepTime] = useState('');
  const [assignmentType, setAssignmentType] = useState<'vendor' | 'app'>('vendor');
  const [vendorRiderDetails, setVendorRiderDetails] = useState({ name: '', phone: '', fee: 0 });

  // Restaurant Extended States (Table Map, Kitchen Inventory, Expenses, Reports)
  const [tableSubTab, setTableSubTab] = useState<'visual' | 'list' | 'analytics'>('visual');
  const [restInventory, setRestInventory] = useState<any[]>([]);
  const [isAddInvOpen, setIsAddInvOpen] = useState(false);
  const [isEditingInv, setIsEditingInv] = useState<any>(null);
  const [newInvItem, setNewInvItem] = useState({ sku: '', name: '', category: 'Meat & Poultry', stock: 10, unit: 'kg', minLimit: 5, cost: 0, supplier: '' });
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invCatFilter, setInvCatFilter] = useState('all');

  const [restExpenses, setRestExpenses] = useState<any[]>([]);
  const [isAddExpOpen, setIsAddExpOpen] = useState(false);
  const [isEditingExp, setIsEditingExp] = useState<any>(null);
  const [newExp, setNewExp] = useState({ date: new Date().toISOString().split('T')[0], description: '', category: 'Raw Materials', amount: 0, paidBy: 'Cash', reference: '' });
  const [expSearchQuery, setExpSearchQuery] = useState('');
  const [expCatFilter, setExpCatFilter] = useState('all');

  const [repStartDate, setRepStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [repEndDate, setRepEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Settings State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [updatedProfile, setUpdatedProfile] = useState<Partial<VendorProfile>>({});
  const [inventorySearch, setInventorySearch] = useState('');
  const [stockLevelFilter, setStockLevelFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (branchFilter) {
      filtered = filtered.filter(o => o.branchId === branchFilter);
    }
    if (staffProfile?.role === 'waiter') {
      filtered = filtered.filter(o => o.orderSource === 'pos' || o.orderSource === 'reception');
    }
    return filtered;
  }, [orders, branchFilter, staffProfile]);

  const reportsData = useMemo(() => {
    // Process orders that belong to the selected date range and are 'completed'
    const completedOrdersInPeriod = orders.filter(o => {
      if (o.status !== 'completed' && o.status !== 'delivered') return false;
      const orderDateStr = o.createdAt ? (o.createdAt.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date(o.createdAt).toISOString().split('T')[0]) : '';
      if (!orderDateStr) return false;
      return orderDateStr >= repStartDate && orderDateStr <= repEndDate;
    });

    const totalRevenue = completedOrdersInPeriod.reduce((acc, o) => acc + Number(o.subtotal || 0), 0);

    const expensesInPeriod = restExpenses.filter(e => {
      return e.date >= repStartDate && e.date <= repEndDate;
    });

    const totalExpenses = expensesInPeriod.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const ordersCount = completedOrdersInPeriod.length;

    // Chart trend processing - Group by Months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMap: Record<string, { month: string, revenue: number, expenses: number }> = {};
    
    // Initialize last 6 months
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(d.getMonth() - i);
      const mLabel = monthNames[monthDate.getMonth()];
      trendMap[mLabel] = { month: mLabel, revenue: 0, expenses: 0 };
    }

    // Populate revenue
    orders.forEach(o => {
      if (o.status !== 'completed' && o.status !== 'delivered') return;
      const oDate = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date();
      const mLabel = monthNames[oDate.getMonth()];
      if (trendMap[mLabel]) {
        trendMap[mLabel].revenue += Number(o.subtotal || 0);
      }
    });

    // Populate expenses
    restExpenses.forEach(e => {
      const eDate = new Date(e.date);
      const mLabel = monthNames[eDate.getMonth()];
      if (trendMap[mLabel]) {
        trendMap[mLabel].expenses += Number(e.amount || 0);
      }
    });

    const trendChart = Object.values(trendMap);

    // Filtered comparison
    const expenseVsRevenueData = trendChart;

    // Category Performance
    const categorySalesMap: Record<string, number> = {
      'Grills/Fries': 0,
      'Beverages': 0,
      'Desserts': 0,
      'Main Course': 0,
      'Appetizers': 0
    };

    orders.forEach(o => {
      if (o.status !== 'completed' && o.status !== 'delivered') return;
      const amt = Number(o.subtotal || 0);
      if (amt > 20000) {
        categorySalesMap['Grills/Fries'] += amt * 0.4;
        categorySalesMap['Main Course'] += amt * 0.6;
      } else {
        categorySalesMap['Beverages'] += amt * 0.3;
        categorySalesMap['Desserts'] += amt * 0.3;
        categorySalesMap['Appetizers'] += amt * 0.4;
      }
    });

    const categoryPerformanceData = Object.entries(categorySalesMap).map(([title, sales]) => ({
      name: title,
      value: sales
    }));

    // Payment Methods
    let cashCount = 0;
    let cardCount = 0;
    let mobileMoneyCount = 0;

    orders.forEach(o => {
      if (o.paymentMethod === 'cash') cashCount++;
      else if (o.paymentMethod === 'card') cardCount++;
      else mobileMoneyCount++;
    });

    if (cashCount === 0 && cardCount === 0 && mobileMoneyCount === 0) {
      cashCount = 5;
      cardCount = 2;
      mobileMoneyCount = 8;
    }

    const payData = [
      { name: 'Cash', value: cashCount, color: '#f97316' },
      { name: 'Card', value: cardCount, color: '#3b82f6' },
      { name: 'Mobile Money', value: mobileMoneyCount, color: '#10b981' }
    ];

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      ordersCount,
      trendChart,
      expenseVsRevenueData,
      categoryPerformanceData,
      payData
    };
  }, [orders, restExpenses, repStartDate, repEndDate]);

  // QR Builder State
  const [isQrBuilderOpen, setIsQrBuilderOpen] = useState(false);
  const [qrBuilderMode, setQrBuilderMode] = useState<'table_stand' | 'store_placard' | 'qr_only'>('table_stand');
  const [tableStandStyle, setTableStandStyle] = useState<'acrylic' | 'wood' | 'tent' | 'gold_metal' | 'dark_modern'>('gold_metal');
  const [standDisplayLayout, setStandDisplayLayout] = useState<'gold_menu_showcase' | 'single_stand'>('gold_menu_showcase');
  const [goldMenuBanner, setGoldMenuBanner] = useState('DELICIOUS FOOD • GREAT TASTE • HAPPY YOU');
  const [goldMenuSince, setGoldMenuSince] = useState('SINCE 2023');
  const [goldLeftHangingSign, setGoldLeftHangingSign] = useState('Fresh\nTasty ♡\nHealthy');
  const [goldRightHangingSign, setGoldRightHangingSign] = useState('KARIBU\nSANA!\n❤️');
  const [goldWebsiteUrl, setGoldWebsiteUrl] = useState('WWW.AGIZA.CO.TZ');
  const [goldSupportEmail, setGoldSupportEmail] = useState('SUPPORT@AGIZA.CO.TZ');
  const [goldSalesPhone, setGoldSalesPhone] = useState('+255 7XX XXX XXX');
  const [goldHighlights, setGoldHighlights] = useState(['Ladha Halisi', 'Huduma Bora', 'Bei Fair', 'Wateja wa Furahi ❤️']);
  const [goldThemePreset, setGoldThemePreset] = useState<string>('gold');
  const [goldPrimaryColor, setGoldPrimaryColor] = useState<string>('#eab308');
  const [goldAccentColor, setGoldAccentColor] = useState<string>('#f59e0b');
  const [goldBgColorStart, setGoldBgColorStart] = useState<string>('#23170a');
  const [goldBgColorEnd, setGoldBgColorEnd] = useState<string>('#050302');
  const [goldCardBgColor, setGoldCardBgColor] = useState<string>('#170e06');
  const [goldTextColor, setGoldTextColor] = useState<string>('#fef08a');
  const [showGoldDishes, setShowGoldDishes] = useState<boolean>(true);
  const [goldLogoUrl, setGoldLogoUrl] = useState<string>('');
  const [isGoldLogoUploading, setIsGoldLogoUploading] = useState<boolean>(false);
  const [showGoldLogo, setShowGoldLogo] = useState<boolean>(true);
  const [showcaseDishes, setShowcaseDishes] = useState<Array<{
    id: string;
    name: string;
    emoji: string;
    price: string;
    badge: string;
    badgeColor: string;
    description: string;
    imageUrl: string;
  }>>([]);
  const hasInitializedDishesRef = useRef(false);

  useEffect(() => {
    if (products && products.length > 0 && !hasInitializedDishesRef.current) {
      hasInitializedDishesRef.current = true;
      const realProducts = products.slice(0, 3).map((p, idx) => ({
        id: `dish-prod-${p.id || idx}`,
        name: (p.name || 'BIDHAA').toUpperCase(),
        emoji: idx === 0 ? '🔥' : idx === 1 ? '🍲' : '🌿',
        price: Number(p.price || 0).toLocaleString(),
        badge: idx === 0 ? 'BEST SELLER' : idx === 1 ? "CHEF'S CHOICE" : 'FRESH & NATURAL',
        badgeColor: idx === 0 ? '#dc2626' : idx === 1 ? '#15803d' : '#1d4ed8',
        description: p.description || 'Chakula kizuri kilichoandaliwa kwa ubora na usafi wa hali ya juu.',
        imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
      }));
      setShowcaseDishes(realProducts);
    }
  }, [products]);
  const [activeDishEditIndex, setActiveDishEditIndex] = useState<number>(0);
  const [showWifiOnStand, setShowWifiOnStand] = useState(true);
  const [standWifiName, setStandWifiName] = useState('Guest-WiFi');
  const [standWifiPass, setStandWifiPass] = useState('');
  const [standCallout, setStandCallout] = useState('SCAN & AGIZA HAPA');
  const [standSubCallout, setStandSubCallout] = useState('Orodha ya Kidijitali ya Chakula & Vinywaji');
  const [bgImageMode, setBgImageMode] = useState<'upload' | 'url'>('upload');
  const [showProductsOnStand, setShowProductsOnStand] = useState(false);
  const [standProductIds, setStandProductIds] = useState<string[]>([]);
  const [productQrColors, setProductQrColors] = useState<Record<string, string>>({});
  const [productQrDotsTypes, setProductQrDotsTypes] = useState<Record<string, string>>({});
  const [productQrTexts, setProductQrTexts] = useState<Record<string, string>>({});
  const [productBadges, setProductBadges] = useState<Record<string, string>>({});
  const [activeQrEditProductId, setActiveQrEditProductId] = useState<string | null>(null);
  
  // Enhanced QR Customizer States
  const [qrDetailLevel, setQrDetailLevel] = useState<number>(55);
  const [qrCodeSize, setQrCodeSize] = useState<number>(5);
  const [exportSize, setExportSize] = useState<number>(100);
  const [foregroundColor, setForegroundColor] = useState<string>('#000000');
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [borderColor, setBorderColor] = useState<string>('#000000');
  const [padding, setPadding] = useState<number>(15);
  const [borderWidth, setBorderWidth] = useState<number>(5);
  const [borderRound, setBorderRound] = useState<number>(25);
  const [isLogoCentered, setIsLogoCentered] = useState<boolean>(true);
  const [patternShape, setPatternShape] = useState<DotType>('square');
  const [cornerStyle, setCornerStyle] = useState<CornerSquareType>('square');
  
  const [frameStyle, setFrameStyle] = useState<'none' | 'simple' | 'bottom-label' | 'top-bottom-label' | 'card'>('none');
  const [frameText, setFrameText] = useState<string>('SCAN ME');
  const [frameColor, setFrameColor] = useState<string>('#000000');
  const [frameWidth, setFrameWidth] = useState<number>(10);
  const [frameRound, setFrameRound] = useState<number>(25);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(100);

  const [printDetails, setPrintDetails] = useState({
    header: '',
    subHeader: 'ORODHA YA KIDIJITALI',
    footer: 'CHANGANUA HAPA KUTAZAMA BIDHAA & KUAGIZA',
    address: '',
    phone: '',
    isPrintMode: false,
    showLogo: true,
    accentColor: '#ea580c',
    headerBg: '#1A1A1A',
    contentBg: '#ffffff',
    bgImage: '',
    seatingLabel: 'SEATING',
    customSeating: '',
    showSeating: true
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
    margin: 20,
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
        orderInstructions: vendorProfile.orderInstructions || '',
        hotelStatus: vendorProfile.hotelStatus || 'Available',
        numberOfRooms: vendorProfile.numberOfRooms || 0,
        roomPricing: vendorProfile.roomPricing || { single: 0, double: 0, vip: 0 },
        socialLinks: vendorProfile.socialLinks || {},
        ticketConfig: vendorProfile.ticketConfig || {
          bgPreset: 'classic-purple',
          primaryColor: '#7c3aed',
          secondaryColor: '#d946ef',
          watermarkIcon: 'bus',
          rulesText: '⚠️ HAKUNA KURUDISHA NAULI • MASHARTS YANAZINGATIWA • KUPITIA PAPO HAPO'
        }
      });
    }
  }, [vendorProfile]);

  // Synchronize customizer states with qrOptions
  useEffect(() => {
    setQrOptions((prev: any) => {
      let logoUrlSrc = "";
      if (isLogoCentered) {
        logoUrlSrc = vendorProfile?.logoUrl 
          ? getProxiedImageUrl(vendorProfile.logoUrl) 
          : `https://api.dicebear.com/7.x/initials/svg?seed=${vendorProfile?.businessName || 'Vendor'}`;
      }
      
      const calculatedMargin = Math.max(4, 40 - (qrCodeSize * 4.5));
      
      return {
        ...prev,
        margin: calculatedMargin,
        dotsOptions: {
          ...prev.dotsOptions,
          color: foregroundColor,
          type: patternShape,
        },
        backgroundOptions: {
          ...prev.backgroundOptions,
          color: backgroundColor,
        },
        cornersSquareOptions: {
          ...prev.cornersSquareOptions,
          color: foregroundColor,
          type: cornerStyle,
        },
        cornersDotOptions: {
          ...prev.cornersDotOptions,
          color: foregroundColor,
          type: cornerStyle === 'extra-rounded' ? 'dot' : cornerStyle as any,
        },
        image: logoUrlSrc,
        qrOptions: {
          ...prev.qrOptions,
          errorCorrectionLevel: qrDetailLevel >= 70 ? 'H' : qrDetailLevel >= 55 ? 'Q' : 'M'
        }
      };
    });
  }, [
    foregroundColor, 
    backgroundColor, 
    patternShape, 
    cornerStyle, 
    qrCodeSize, 
    isLogoCentered, 
    qrDetailLevel,
    vendorProfile?.logoUrl,
    vendorProfile?.businessName
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const options = {
        ...qrOptions,
        type: 'svg' as const,
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
  }, [isQrBuilderOpen, qrCodeInstance, printDetails.isPrintMode, qrBuilderMode, tableStandStyle, showWifiOnStand]);

  const downloadQr = async () => {
    try {
      const size = exportSize * 10; // e.g. 100 -> 1000px
      const scale = size / 300; // scaling factor relative to 300px preview
      
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Fill base background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, size, size);

      // Helper function to draw rounded rectangles
      const drawRoundedRect = (
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        radius: number, 
        fill: boolean, 
        stroke: boolean
      ) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
      };

      // 2. Draw Frame Style custom background/shapes
      let qrAreaYOffset = 0;
      let qrAreaXOffset = 0;
      let qrAreaSize = size;

      if (frameStyle === 'card') {
        // Thick frame/polaroid background
        ctx.fillStyle = frameColor;
        drawRoundedRect(0, 0, size, size, frameRound * scale, true, false);
        
        // Inner white/bg card for QR code
        ctx.fillStyle = backgroundColor;
        const innerOffset = frameWidth * scale;
        const innerSize = size - (innerOffset * 2);
        const innerHeight = size - (innerOffset * 2) - (80 * scale); // leave space for text
        drawRoundedRect(innerOffset, innerOffset, innerSize, innerHeight, Math.max(0, (frameRound - 10)) * scale, true, false);
        
        // Position QR inside the inner card
        qrAreaXOffset = innerOffset;
        qrAreaYOffset = innerOffset;
        qrAreaSize = innerSize;
      } else if (frameStyle === 'bottom-label') {
        // Draw frame border
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = frameWidth * scale;
        drawRoundedRect(
          (frameWidth * scale) / 2, 
          (frameWidth * scale) / 2, 
          size - (frameWidth * scale), 
          size - (frameWidth * scale), 
          frameRound * scale, 
          false, 
          true
        );
        
        // Solid banner at bottom
        ctx.fillStyle = frameColor;
        const bannerHeight = 80 * scale;
        const bRadius = frameRound * scale;
        ctx.beginPath();
        const startY = size - bannerHeight;
        ctx.moveTo(frameWidth * scale, startY);
        ctx.lineTo(size - frameWidth * scale, startY);
        ctx.lineTo(size - frameWidth * scale, size - bRadius);
        ctx.quadraticCurveTo(size - frameWidth * scale, size - frameWidth * scale, size - bRadius, size - frameWidth * scale);
        ctx.lineTo(bRadius, size - frameWidth * scale);
        ctx.quadraticCurveTo(frameWidth * scale, size - frameWidth * scale, frameWidth * scale, size - bRadius);
        ctx.closePath();
        ctx.fill();

        qrAreaSize = size - (frameWidth * scale * 2);
        qrAreaYOffset = frameWidth * scale;
        qrAreaXOffset = frameWidth * scale;
      } else if (frameStyle === 'top-bottom-label') {
        // Draw frame border
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = frameWidth * scale;
        drawRoundedRect(
          (frameWidth * scale) / 2, 
          (frameWidth * scale) / 2, 
          size - (frameWidth * scale), 
          size - (frameWidth * scale), 
          frameRound * scale, 
          false, 
          true
        );

        // Top banner
        ctx.fillStyle = frameColor;
        const topBannerHeight = 60 * scale;
        const bRadius = frameRound * scale;
        ctx.beginPath();
        ctx.moveTo(bRadius, frameWidth * scale);
        ctx.lineTo(size - bRadius, frameWidth * scale);
        ctx.quadraticCurveTo(size - frameWidth * scale, frameWidth * scale, size - frameWidth * scale, bRadius);
        ctx.lineTo(size - frameWidth * scale, topBannerHeight);
        ctx.lineTo(frameWidth * scale, topBannerHeight);
        ctx.lineTo(frameWidth * scale, bRadius);
        ctx.quadraticCurveTo(frameWidth * scale, frameWidth * scale, bRadius, frameWidth * scale);
        ctx.closePath();
        ctx.fill();

        // Bottom banner
        ctx.beginPath();
        const startY = size - 70 * scale;
        ctx.moveTo(frameWidth * scale, startY);
        ctx.lineTo(size - frameWidth * scale, startY);
        ctx.lineTo(size - frameWidth * scale, size - bRadius);
        ctx.quadraticCurveTo(size - frameWidth * scale, size - frameWidth * scale, size - bRadius, size - frameWidth * scale);
        ctx.lineTo(bRadius, size - frameWidth * scale);
        ctx.quadraticCurveTo(frameWidth * scale, size - frameWidth * scale, frameWidth * scale, size - bRadius);
        ctx.closePath();
        ctx.fill();

        qrAreaSize = size - (frameWidth * scale * 2);
        qrAreaYOffset = topBannerHeight;
        qrAreaXOffset = frameWidth * scale;
      } else if (frameStyle === 'simple') {
        // Thin outline frame
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = frameWidth * scale;
        drawRoundedRect(
          (frameWidth * scale) / 2, 
          (frameWidth * scale) / 2, 
          size - (frameWidth * scale), 
          size - (frameWidth * scale), 
          frameRound * scale, 
          false, 
          true
        );
      }

      // 3. Draw standard outer borders (if any and not fully covered by card/frame)
      if (borderWidth > 0 && frameStyle === 'none') {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth * scale;
        drawRoundedRect(
          (borderWidth * scale) / 2, 
          (borderWidth * scale) / 2, 
          size - (borderWidth * scale), 
          size - (borderWidth * scale), 
          borderRound * scale, 
          false, 
          true
        );
      }

      // 4. Draw QR Code
      const qrPadding = padding * scale;
      let qrWidth = qrAreaSize - (qrPadding * 2);
      if (frameStyle === 'bottom-label') {
        qrWidth = qrAreaSize - (qrPadding * 2) - (40 * scale); // accommodate bottom label
      } else if (frameStyle === 'top-bottom-label') {
        qrWidth = qrAreaSize - (qrPadding * 2) - (60 * scale);
      } else if (frameStyle === 'card') {
        qrWidth = qrAreaSize - (qrPadding * 2) - (50 * scale);
      }

      const qrX = qrAreaXOffset + (qrAreaSize - qrWidth) / 2;
      const qrY = qrAreaYOffset + (frameStyle === 'top-bottom-label' ? 15 * scale : frameStyle === 'bottom-label' ? 10 * scale : (qrAreaSize - qrWidth) / 2);

      const tempQr = new QRCodeStyling({
        ...qrOptions,
        width: qrWidth,
        height: qrWidth,
        type: 'canvas' as const
      });

      const tempDiv = document.createElement('div');
      await tempQr.append(tempDiv);
      await new Promise(resolve => setTimeout(resolve, 80)); // wait for canvas rendering
      
      const qrCanvas = tempDiv.querySelector('canvas');
      if (qrCanvas) {
        ctx.drawImage(qrCanvas, qrX, qrY, qrWidth, qrWidth);
      }

      // 5. Draw Frame Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (frameStyle === 'card') {
        ctx.fillStyle = textColor;
        ctx.font = `black ${Math.round(20 * (textSize / 100) * scale)}px system-ui, sans-serif`;
        ctx.fillText(
          frameText.toUpperCase(), 
          size / 2, 
          size - (frameWidth * scale) - (35 * scale)
        );
      } else if (frameStyle === 'bottom-label') {
        ctx.fillStyle = textColor;
        ctx.font = `black ${Math.round(18 * (textSize / 100) * scale)}px system-ui, sans-serif`;
        ctx.fillText(
          frameText.toUpperCase(), 
          size / 2, 
          size - (frameWidth * scale) - (40 * scale)
        );
      } else if (frameStyle === 'top-bottom-label') {
        const topBannerHeight = 60 * scale;
        // Draw top text (business name or scan to view)
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(13 * scale)}px system-ui, sans-serif`;
        ctx.fillText(
          vendorProfile?.businessName?.toUpperCase() || 'SCAN QR CODE', 
          size / 2, 
          (topBannerHeight + (frameWidth * scale)) / 2
        );

        // Draw bottom text
        ctx.font = `black ${Math.round(16 * (textSize / 100) * scale)}px system-ui, sans-serif`;
        ctx.fillText(
          frameText.toUpperCase(), 
          size / 2, 
          size - (frameWidth * scale) - (35 * scale)
        );
      } else if (frameStyle === 'simple') {
        ctx.fillStyle = textColor;
        ctx.font = `black ${Math.round(16 * (textSize / 100) * scale)}px system-ui, sans-serif`;
        ctx.fillText(
          frameText.toUpperCase(), 
          size / 2, 
          size - (frameWidth * scale) - (30 * scale)
        );
      }

      // 6. Download the canvas
      const link = document.createElement('a');
      link.download = `QR-Custom-${selectedSection?.number || 'Vendor'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Failed to export custom QR:", err);
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
    const el = document.getElementById('printable-stand');
    if (!el) {
      toast.error("Imeshindwa kupata mpangilio wa stand");
      return;
    }
    
    document.body.classList.add('printing-stand');
    window.print();
    
    setTimeout(() => {
      document.body.classList.remove('printing-stand');
    }, 1000);
  };

  const handlePrintOrder = (order: Order) => {
    setOrderToPrint(order);
    setTimeout(() => {
      const el = document.getElementById('order-receipt');
      if (!el) {
        toast.error("Imeshindwa kupata stakabadhi");
        return;
      }
      
      const isBus = order.type === 'bus_ticket' || vendorProfile?.category === 'bus_ticket';
      if (isBus) {
        document.body.classList.add('printing-receipt', 'bus-receipt-print');
      } else {
        document.body.classList.add('printing-receipt');
      }
      window.print();
      
      setTimeout(() => {
        document.body.classList.remove('printing-receipt', 'bus-receipt-print');
      }, 1000);
    }, 300);
  };

  const handleDownloadOrderReceipt = async (order: Order) => {
    setOrderToPrint(order);
    const toastId = toast.loading(`Inatayarisha risiti ya #${order.id ? order.id.slice(-6).toUpperCase() : 'Oda'}...`, {
      style: { background: '#000', color: '#fff' }
    });

    try {
      await new Promise(r => setTimeout(r, 450));
      const el = document.getElementById('order-receipt');
      if (!el) {
        toast.error("Imeshindwa kupata stakabadhi ya kupakua", { id: toastId });
        return;
      }

      let dataUrl;
      try {
        dataUrl = await toPng(el, { 
          quality: 0.98, 
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          skipFonts: true,
        });
      } catch (firstErr) {
        console.warn('First receipt download attempt failed, using fallback...', firstErr);
        dataUrl = await toPng(el, {
          quality: 0.9,
          pixelRatio: 1.5,
          backgroundColor: '#ffffff',
          cacheBust: false,
          skipFonts: true,
        });
      }

      const isBus = order.type === 'bus_ticket' || vendorProfile?.category === 'bus_ticket';
      const fileName = isBus 
        ? `Tiketi-Basi-${order.id ? order.id.slice(-6).toUpperCase() : 'Papo'}.png`
        : `Risiti-Oda-${order.id ? order.id.slice(-6).toUpperCase() : 'Papo'}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      toast.success('Risiti imepakuliwa kwa mafanikio!', { id: toastId });
    } catch (err: any) {
      console.error('Receipt download error:', err);
      toast.error('Imeshindwa kupakua risiti. Tafadhali jaribu tena.', { id: toastId });
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const handleDownloadStand = async () => {
    const el = document.getElementById('printable-stand');
    if (!el || isExporting) return;
    
    setIsExporting(true);
    const toastId = toast.loading('Inatengeneza Bango lenye Ubora wa Juu (HD)...', {
      style: { background: '#000', color: '#fff' }
    });
    try {
      // Ensure all internal images are ready
      const imgElements = Array.from(el.querySelectorAll('img'));
      await Promise.all(
        imgElements.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 1500);
          });
        })
      );

      // Delay to let browser render all fonts and SVG/canvas QR codes
      await new Promise(r => setTimeout(r, 600));
      
      let dataUrl;
      try {
        dataUrl = await toPng(el, { 
          quality: 1, 
          pixelRatio: 3, // Ultra-sharp print resolution
          cacheBust: true,
          skipFonts: false,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        });
      } catch (firstErr) {
        console.warn('First export attempt failed, trying fallback mode...', firstErr);
        dataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2,
          cacheBust: false,
          skipFonts: true,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        });
      }
      
      const link = document.createElement('a');
      link.download = `Bango-Stand-${(vendorProfile?.businessName || 'Mgahawa').replace(/[^a-zA-Z0-9]/g, '_')}-Meza-${selectedSection?.number || '21'}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Bango / Stand imepakuliwa kikamilifu (HD Quality)!', { id: toastId });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Imeshindwa kupakua bango. Unaweza pia kubofya Chapa (Print) au kujaribu tena.', { id: toastId });
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

    // Role-based filtering or custom permissions based filtering
    if (staffProfile) {
      if (staffProfile.hasCustomPermissions && staffProfile.customPermissions) {
        const perms = staffProfile.customPermissions;
        const customTabs = [];
        if (perms.canViewSales) {
          customTabs.push({ id: 'overview', label: 'Daily Sales', icon: LayoutDashboard });
        }
        if (perms.canManageOrders) {
          customTabs.push({ id: 'orders', label: 'Orders & Kitchen', icon: ChefHat, badge: orders.length > 0 ? orders.length : null });
        }
        if (perms.canManageMenu) {
          customTabs.push({ id: 'products', label: 'Menu & Prices', icon: Utensils });
        }
        if (perms.canManagePOS) {
          customTabs.push({ id: 'pos', label: 'Billing / POS', icon: Banknote });
        }
        if (perms.canManageTables && vendorProfile?.category === 'restaurant') {
          customTabs.push({ id: 'tables', label: 'Dining Floor (Meza)', icon: Store });
        }
        if (perms.canManageInventory && vendorProfile?.category === 'restaurant') {
          customTabs.push({ id: 'rest_inventory', label: 'Kitchen Inventory', icon: Database });
        }
        if (perms.canManageExpenses && vendorProfile?.category === 'restaurant') {
          customTabs.push({ id: 'rest_expenses', label: 'Expenses Tracker', icon: Landmark });
        }
        if (perms.canManageReports && vendorProfile?.category === 'restaurant') {
          customTabs.push({ id: 'rest_reports', label: 'Financial Reports', icon: LucidePieChart });
        }
        if (perms.canManageStaff) {
          customTabs.push({ id: 'staff', label: 'Manage Staff', icon: UserCog });
        }
        
        // Force fallback if none selected so they can use something
        if (customTabs.length === 0) {
          customTabs.push({ id: 'orders', label: 'Orders & Kitchen', icon: ChefHat, badge: orders.length > 0 ? orders.length : null });
        }
        return customTabs;
      }

      const role = staffProfile.role;
      if (role === 'chef') {
        return [
          { id: 'orders', label: 'Kitchen Display', icon: ChefHat, badge: orders.length > 0 ? orders.length : null },
          { id: 'products', label: 'Menu Availability', icon: Utensils },
        ];
      }
      if (role === 'waiter') {
        return [
          { id: 'tables', label: 'Table Management', icon: Store },
          { id: 'pos', label: 'Order Taking', icon: ShoppingCart },
          { id: 'orders', label: 'My Orders', icon: ClipboardList },
          { id: 'messages', label: 'Messages', icon: MessageIcon },
        ];
      }
      if (role === 'cashier') {
        return [
          { id: 'overview', label: 'Daily Sales', icon: LayoutDashboard },
          { id: 'pos', label: 'Billing / POS', icon: Banknote },
          { id: 'orders', label: vendorContext.ordersLabel, icon: vendorContext.ordersIcon, badge: orders.length > 0 ? orders.length : null },
        ];
      }
      if (role === 'manager') {
        const mgrTabs = [
          { id: 'overview', label: 'Management Overview', icon: LayoutDashboard },
          { id: 'orders', label: 'Kitchen & Delivery', icon: ChefHat, badge: orders.length > 0 ? orders.length : null },
          { id: 'products', label: 'Menu & Prices', icon: Utensils },
          { id: 'pos', label: 'Billing / POS', icon: Banknote },
        ];
        if (vendorProfile?.category === 'restaurant') {
          mgrTabs.push({ id: 'tables', label: 'Dining Floor (Meza)', icon: Store });
          mgrTabs.push({ id: 'rest_inventory', label: 'Kitchen Inventory', icon: Database });
          mgrTabs.push({ id: 'rest_expenses', label: 'Expenses Tracker', icon: Landmark });
          mgrTabs.push({ id: 'rest_reports', label: 'Financial Reports', icon: LucidePieChart });
        }
        mgrTabs.push({ id: 'staff', label: 'Manage Staff', icon: UserCog });
        return mgrTabs;
      }
    }

    if (vendorProfile?.category === 'restaurant') {
      baseTabs.push({ id: 'tables', label: 'Dining Floor (Meza)', icon: Store });
      baseTabs.push({ id: 'rest_inventory', label: 'Kitchen Inventory', icon: Database });
      baseTabs.push({ id: 'rest_expenses', label: 'Expenses Tracker', icon: Landmark });
      baseTabs.push({ id: 'rest_reports', label: 'Financial Reports', icon: LucidePieChart });
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
      { id: 'twilio_responder', label: 'SMS Auto Responder', icon: MessageCircle },
      { id: 'map_qr_setup', label: 'Ramani & AR Setup', icon: QrCode },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'settings', label: t('settings') || 'Settings', icon: Settings },
    ];
  }, [orders.length, t, vendorContext, vendorProfile?.category]);

  const filteredProducts = products;

  // Onboarding Form State
  const [formData, setFormData] = useState({
    businessName: profile?.businessName || '',
    category: (profile?.category as VendorCategory) || 'restaurant',
    description: profile?.hotelDescription || '',
    tin: profile?.tinNumber || '',
    address: profile?.address || '',
    phoneNumber: profile?.phoneNumber || '',
    logoUrl: '',
    bannerUrl: '',
    deliveryRadius: 5,
    operatingHours: '9:00 AM - 9:00 PM',
    location: profile?.location || { lat: -6.7924, lng: 39.2083 } // Default Dar es Salaam
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        businessName: profile.businessName || prev.businessName,
        category: (profile.category as VendorCategory) || prev.category,
        address: profile.address || prev.address,
        phoneNumber: profile.phoneNumber || prev.phoneNumber,
        location: profile.location || prev.location
      }));
    }
  }, [profile]);

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
    rating: 0,
    ratingCount: 0,
    highlights: [],
    story: '',
    qualityPromise: { description: '', certifiedBy: '' }
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
  const [newStaff, setNewStaff] = useState({ name: '', role: 'waiter', phone: '', branchId: '', password: '' });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '', type: 'office' });

  // Detailed staff custom permissions & payments manager
  const [isDetailStaffOpen, setIsDetailStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [detailStaffTab, setDetailStaffTab] = useState<'info' | 'permissions' | 'payments'>('info');
  const [staffSalaryAmount, setStaffSalaryAmount] = useState<string>('');
  const [staffSalaryType, setStaffSalaryType] = useState<string>('monthly'); // 'daily' | 'weekly' | 'monthly'
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutPaidBy, setPayoutPaidBy] = useState<string>('Cash');
  const [payoutReference, setPayoutReference] = useState<string>('');
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [payoutLogs, setPayoutLogs] = useState<any[]>([]);

  // Track and live-sync payments for selected staff member
  useEffect(() => {
    if (!vendorProfile?.id || !selectedStaff?.id) {
      setPayoutLogs([]);
      return;
    }
    const q = query(
      collection(db, 'vendors', vendorProfile.id, 'staff_payments'),
      where('staffId', '==', selectedStaff.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      sorted.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      setPayoutLogs(sorted);
    }, (error) => {
      console.warn("Error live-syncing staff payments:", error);
    });
    return () => unsub();
  }, [vendorProfile?.id, selectedStaff?.id]);

  const handleSaveStaffDetails = async () => {
    if (!selectedStaff || !vendorProfile?.id) return;
    try {
      const staffRef = doc(db, 'staff', selectedStaff.id);
      
      const permissions = selectedStaff.customPermissions || {
        canViewSales: false,
        canManageOrders: false,
        canManageMenu: false,
        canManagePOS: false,
        canManageTables: false,
        canManageInventory: false,
        canManageExpenses: false,
        canManageReports: false,
        canManageStaff: false,
      };

      await updateDoc(staffRef, {
        name: selectedStaff.name || '',
        phone: selectedStaff.phone || '',
        password: selectedStaff.password || '',
        role: selectedStaff.role || 'waiter',
        branchId: selectedStaff.branchId || '',
        salaryAmount: Number(staffSalaryAmount || 0),
        salaryType: staffSalaryType || 'monthly',
        hasCustomPermissions: selectedStaff.hasCustomPermissions || false,
        customPermissions: permissions
      });
      
      toast.success('Taarifa na majukumu ya ' + selectedStaff.name + ' zimesasishwa!');
      setIsDetailStaffOpen(false);
      setSelectedStaff(null);
    } catch (error) {
      console.error("Error updating staff details:", error);
      toast.error('Imeshindwa kusasisha taarifa za mfanyakazi!');
    }
  };

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !vendorProfile?.id || !payoutAmount || Number(payoutAmount) <= 0) {
      toast.error('Tafadhali jaza kiasi cha fedha halali!');
      return;
    }
    try {
      const amountNum = Number(payoutAmount);
      
      // 1. Save payment payout log
      const payRef = await addDoc(collection(db, 'vendors', vendorProfile.id, 'staff_payments'), {
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        amount: amountNum,
        paidBy: payoutPaidBy,
        reference: payoutReference || '',
        notes: payoutNotes || '',
        createdAt: new Date(),
      });

      // 2. Automatically register this payment as a restaurant expense!
      await addDoc(collection(db, 'vendors', vendorProfile.id, 'restaurant_expenses'), {
        amount: amountNum,
        category: 'Salaries & Wages',
        date: new Date().toISOString().split('T')[0],
        description: `Malipo ya ${selectedStaff.name} (${selectedStaff.role})`,
        paidBy: payoutPaidBy,
        reference: payoutReference || `PAY-${payRef.id.substring(0, 6).toUpperCase()}`,
        notes: payoutNotes || 'Kupitia Udhibiti wa Wafanyakazi',
        createdAt: new Date()
      });

      toast.success(`TZS ${amountNum.toLocaleString()} imelipwa kwa ${selectedStaff.name} na kusajiliwa kwenye Matumizi (Expenses)!`);
      setPayoutAmount('');
      setPayoutReference('');
      setPayoutNotes('');
    } catch (error) {
      console.error("Error saving payout:", error);
      toast.error('Imeshindwa kurekodi malipo ya mfanyakazi!');
    }
  };
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
      try {
        const q = query(collection(db, 'staff'), where('vendorOwnerUid', '==', user?.uid));
        const snap = await getDocs(q);
        setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error: any) {
        if (error.message?.includes('permission')) return;
        handleFirestoreError(error, OperationType.GET, 'staff_fetch');
      }
    };

    fetchStaff();

    const unsub = onSnapshot(
      query(collection(db, 'staff'), where('vendorOwnerUid', '==', user?.uid)), 
      () => fetchStaff(),
      (error: any) => {
        if (error.message?.includes('permission')) return;
        handleFirestoreError(error, OperationType.GET, 'staff_sync');
      }
    );

    return () => unsub();
  }, [vendorProfile?.id]);

  useEffect(() => {
    if (!vendorProfile?.id) return;
    
    const fetchBranches = async () => {
      try {
        const q = query(collection(db, 'branches'), where('vendorId', '==', vendorProfile.id));
        const snap = await getDocs(q);
        setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error: any) {
        if (error.message?.includes('permission')) return;
        handleFirestoreError(error, OperationType.GET, 'branches_fetch');
      }
    };

    fetchBranches();
    const unsub = onSnapshot(
      query(collection(db, 'branches'), where('vendorId', '==', vendorProfile.id)), 
      () => fetchBranches(),
      (error: any) => {
        if (error.message?.includes('permission')) return;
        handleFirestoreError(error, OperationType.GET, 'branches_sync');
      }
    );
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
      setNewStaff({ name: '', role: 'waiter', phone: '', branchId: '', password: '' });
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
        // First check if user is a vendor owner
        const q = query(collection(db, 'vendors'), where('ownerUid', '==', user.uid), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data() as VendorProfile;
          setVendorProfile({ id: doc.id, ...data } as VendorProfile);
          setStaffProfile(null); // Not a staff member, an owner
          
          if (data.businessName && data.category) {
            setShowOnboarding(false);
          } else {
            setShowOnboarding(true);
          }
        } else {
          // If not an owner, check if the user is a staff member
          // Search for staff by uid if we have one (usually staff might log in with phone/password)
          // For now, let's look in staff collection where a field (maybe custom field) links to user uid
          // Assuming we might have linked the staff record to the user uid
          const staffQ = query(collection(db, 'staff'), where('uid', '==', user.uid), limit(1));
          const staffSnap = await getDocs(staffQ);

          if (!staffSnap.empty) {
            const staffData = staffSnap.docs[0].data();
            setStaffProfile({ id: staffSnap.docs[0].id, ...staffData });
            
            // Get the vendor profile for this staff
            const vendorDoc = await getDoc(doc(db, 'vendors', staffData.vendorId));
            if (vendorDoc.exists()) {
              setVendorProfile({ id: vendorDoc.id, ...vendorDoc.data() } as VendorProfile);
              setShowOnboarding(false);
            } else {
              setShowOnboarding(true);
            }
          } else {
            setShowOnboarding(true);
          }
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

  // Restrict staff active tab to their explicitly allowed tabs
  useEffect(() => {
    if (staffProfile) {
      const allowedTabIds = tabs.map(t => t.id);
      if (!allowedTabIds.includes(activeTab) && allowedTabIds.length > 0) {
        setActiveTab(allowedTabIds[0] as TabType);
      }
    }
  }, [staffProfile, tabs, activeTab]);

  useEffect(() => {
    if (!vendorProfile?.id || !user) return;
    
    const fetchOrders = async () => {
      if (!vendorProfile?.id) return;
      const path = 'orders';
      try {
        const q = query(
          collection(db, path), 
          where('vendorId', '==', vendorProfile.id),
          limit(100) // Fetch a reasonable amount to sort client-side
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        
        // Sort client-side
        const sorted = docs.sort((a, b) => {
          const timeA = getSafeTime(a.createdAt);
          const timeB = getSafeTime(b.createdAt);
          return timeB - timeA;
        });
        
        setOrders(sorted);
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
      if (!vendorProfile?.id) return;
      const path = `vendors/${vendorProfile.id}/sections`;
      try {
        const snap = await getDocs(collection(db, 'vendors', vendorProfile.id, 'sections'));
        setSections(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, 'reviews'), 
          where('targetId', '==', vendorProfile.id),
          where('targetType', '==', 'vendor')
        );
        const snap = await getDocs(q);
        setVendorReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
      } catch (error) {
        console.error("Error fetching vendor reviews:", error);
      }
    };

    const fetchRestInventory = async () => {
      if (!vendorProfile?.id) return;
      try {
        const snap = await getDocs(collection(db, 'vendors', vendorProfile.id, 'restaurant_inventory'));
        setRestInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching restaurant inventory:", error);
      }
    };

    const fetchRestExpenses = async () => {
      if (!vendorProfile?.id) return;
      try {
        const snap = await getDocs(collection(db, 'vendors', vendorProfile.id, 'restaurant_expenses'));
        setRestExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching restaurant expenses:", error);
      }
    };

    const errorHandler = (path: string) => (error: any) => {
      handleFirestoreError(error, OperationType.GET, path);
    };

    const unsubs = [
      onSnapshot(query(collection(db, 'orders'), where('vendorId', '==', vendorProfile.id), limit(100)), (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        const sorted = docs.sort((a, b) => getSafeTime(b.createdAt) - getSafeTime(a.createdAt));
        setOrders(sorted);
      }, errorHandler('orders')),

      onSnapshot(query(collection(db, 'products'), where('vendorId', '==', vendorProfile.id)), (snap) => {
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      }, errorHandler('products')),

      onSnapshot(collection(db, 'vendors', vendorProfile.id, 'sections'), (snap) => {
        const incoming = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSections(prev => {
          return incoming.map(inc => {
            const activeDrag = prev.find(p => p.id === inc.id);
            if (activeDrag && inc.id === draggingIdRef.current) {
              return { ...inc, x: activeDrag.x, y: activeDrag.y };
            }
            return inc;
          });
        });
      }, errorHandler('sections')),

      onSnapshot(
        query(collection(db, 'reviews'), where('targetId', '==', vendorProfile.id), where('targetType', '==', 'vendor')), 
        (snap) => {
          setVendorReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
        },
        (error: any) => {
          if (error.message?.includes('permission')) {
            console.warn("Vendor reviews restricted by rules");
            return;
          }
          handleFirestoreError(error, OperationType.GET, 'reviews');
        }
      ),

      onSnapshot(collection(db, 'vendors', vendorProfile.id, 'restaurant_inventory'), (snap) => {
        setRestInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }),

      onSnapshot(collection(db, 'vendors', vendorProfile.id, 'restaurant_expenses'), (snap) => {
        setRestExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      })
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
      const orderTime = getSafeTime(order.createdAt);
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

    const unsub = onSnapshot(
      query(collection(db, 'coupons'), where('vendorId', '==', vendorProfile.id)), 
      () => fetchCoupons(),
      (error) => {
        console.warn("Restricted access or error listening to coupons:", error.message);
      }
    );

    return () => unsub();
  }, [vendorProfile?.id, user?.uid]);

  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState(false);
  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmittingOnboarding) return;
    setIsSubmittingOnboarding(true);
    const toastId = toast.loading('Inasajili biashara yako...');
    try {
      await setDoc(doc(db, 'vendors', user.uid), {
        ...formData,
        ownerUid: user.uid,
        status: 'pending',
        rating: 0,
        ratingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Update user profile category as well
      await updateDoc(doc(db, 'users', user.uid), {
        category: formData.category,
        businessName: formData.businessName
      });
      toast.success('Usajili umekamilika!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Imeshindwa kusajili biashara.', { id: toastId });
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  const handleToggleStock = async (product: Product) => {
    try {
      const newStock = product.stock > 0 ? 0 : 50; 
      await updateDoc(doc(db, 'products', product.id!), { stock: newStock });
      toast.success(`${product.name} is now ${newStock > 0 ? 'available' : 'marked as out of stock'}`);
    } catch (err) {
      toast.error('Imeshindwa kubadilisha hali ya chakula');
    }
  };


  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  const handle3DModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendorProfile?.id) return;
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'glb' && extension !== 'gltf') {
      if (file.type.startsWith('image/')) {
        toast.error('Hii ni picha (image). AR inahitaji faili la 3D (.glb). Huwezi kutumia picha kwa AR, picha ni ya 2D tu.');
      } else {
        toast.error('Tafadhali weka file la GLB au GLTF kwa AR.');
      }
      return;
    }

    setIsModelUploading(true);
    setUploadProgress(0);
    
    try {
      const path = storageService.getProductPath(vendorProfile.id, editingProduct?.id || 'new', `model_${Date.now()}.${extension}`);
      const url = await storageService.uploadFile('products', path, file, (progress) => {
        setUploadProgress(progress);
      });
      
      setNewProduct(prev => ({ ...prev, model3dUrl: url }));
      toast.success("Model ya AR imepakiwa!");
    } catch (error: any) {
      console.error("3D Model upload error:", error);
      toast.error("Imeshindwa kupakia model: " + error.message);
    } finally {
      setIsModelUploading(false);
      setUploadProgress(0);
    }
  };

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
        if (isProductUpload && vendorProfile?.id) {
          path = storageService.getProductPath(vendorProfile.id, editingProduct?.id || 'new', file.name);
        } else if (vendorProfile?.id) {
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

  const handleStandBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && vendorProfile?.id) {
      setIsStandBgUploading(true);
      try {
        const path = storageService.getVendorPath(vendorProfile.id, 'stand_bg', file.name);
        const url = await storageService.uploadFile('vendors', path, file);
        setPrintDetails(prev => ({ ...prev, bgImage: url }));
        toast.success("Background image imepakiwa!");
      } catch (error: any) {
        console.error("Stand bg upload error:", error);
        toast.error("Imeshindwa kupakia background: " + error.message);
      } finally {
        setIsStandBgUploading(false);
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
        if (productData.metaMcpPromo) {
          toast.success("🚀 Bidhaa imesawazishwa na Meta MCP Studio! Inatangazwa kwenye Facebook, Instagram & WhatsApp Business Catalog.");
        }
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          vendorId: vendorProfile.id,
          vendorOwnerUid: user?.uid || '',
          vendorCategory: vendorProfile.category,
          createdAt: serverTimestamp(),
        });
        if (productData.metaMcpPromo) {
          toast.success("🚀 Bidhaa imesawazishwa na Meta MCP Studio! Inatangazwa kwenye Facebook, Instagram & WhatsApp Business Catalog.");
        }
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
        model3dUrl: '',
        highlights: [],
        story: '',
        qualityPromise: { description: '', certifiedBy: '' },
        metaMcpPromo: false,
        metaCatalogSynced: false
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleMetaMcpPromo = async (product: Product) => {
    if (!product.id) return;
    const nextVal = !product.metaMcpPromo;
    try {
      await updateDoc(doc(db, 'products', product.id), {
        metaMcpPromo: nextVal,
        metaCatalogSynced: true,
        updatedAt: serverTimestamp(),
      });
      if (nextVal) {
        toast.success(`🚀 "${product.name}" imesawazishwa na Meta MCP Studio! Inatangazwa sasa kwenye Meta Commerce, Facebook & WhatsApp.`);
      } else {
        toast.info(`ℹ️ Utangazaji wa "${product.name}" kwenye Meta MCP umesitishwa.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Imeshindwa kubadilisha status ya Meta MCP');
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
      highlights: product.highlights || [],
      story: product.story || '',
      qualityPromise: product.qualityPromise || { description: '', certifiedBy: '' },
      // Car rental & sale properties
      carType: product.carType || '',
      transmission: product.transmission || 'Automatic',
      fuel: product.fuel || 'Petrol',
      seats: product.seats || undefined,
      engine: product.engine || '',
      ac: product.ac !== false,
      carNumber: product.carNumber || '',
      year: product.year || '',
      mileage: product.mileage || undefined,
      features: product.features || [],
      metaMcpPromo: product.metaMcpPromo || false,
      metaCatalogSynced: product.metaCatalogSynced || false
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
    const matchesStock = stockLevelFilter === 'all' || 
                        (stockLevelFilter === 'low' && p.stock < 10) || 
                        (stockLevelFilter === 'out' && p.stock === 0);
    return matchesSearch && matchesStock;
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
        notes: specialNotes || '',
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
      setSpecialNotes('');
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
      await addDoc(collection(db, 'vendors', vendorProfile.id, 'sections'), {
        ...newSection,
        vendorId: vendorProfile.id,
        vendorOwnerUid: user?.uid,
        status: 'available',
        createdAt: serverTimestamp()
      });
      setIsAddSectionOpen(false);
      setNewSection({ number: '', capacity: 4, allowSharing: false, shape: 'square', section: 'Indoor', x: 50, y: 50 });
      toast.success('Table added successfully!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!vendorProfile?.id) return;
    try {
      await deleteDoc(doc(db, 'vendors', vendorProfile.id, 'sections', id));
      toast.success('Table removed.');
    } catch (error) {
      console.error(error);
    }
  };

  const updateTableStatus = async (tableId: string, status: string) => {
    if (!vendorProfile?.id) return;
    try {
      await updateDoc(doc(db, 'vendors', vendorProfile.id, 'sections', tableId), { status });
      toast.success('Table status updated!');
    } catch (error) {
      console.error(error);
    }
  };

  const updateTableField = async (tableId: string, field: string, value: any) => {
    if (!vendorProfile?.id) return;
    try {
      await updateDoc(doc(db, 'vendors', vendorProfile.id, 'sections', tableId), { [field]: value });
    } catch (error) {
      console.error(error);
    }
  };

  const shiftTable = async (tableId: string, dx: number, dy: number) => {
    if (!vendorProfile?.id) return;
    const table = sections.find(s => s.id === tableId);
    if (!table) return;
    const currentX = typeof table.x === 'number' ? table.x : 50;
    const currentY = typeof table.y === 'number' ? table.y : 50;
    const newX = Math.max(0, Math.min(100, currentX + dx));
    const newY = Math.max(0, Math.min(100, currentY + dy));
    try {
      await updateDoc(doc(db, 'vendors', vendorProfile.id, 'sections', tableId), { x: newX, y: newY });
    } catch (error) {
      console.error(error);
    }
  };

  const handleRequestBill = async (tableNum: string) => {
    try {
      const activeTableOrders = orders.filter(o => 
        o.tableNumber === tableNum && 
        ['pending', 'preparing', 'prepared', 'serving'].includes(o.status)
      );
      if (activeTableOrders.length === 0) {
        toast.info("Hakuna oda inayofanya kazi kwenye meza hii kwa sasa.");
        return;
      }
      for (const ord of activeTableOrders) {
        if (ord.id) {
          await updateDoc(doc(db, 'orders', ord.id), { billRequested: true });
        }
      }
      toast.success(`Bili imeombwa kwa ajili ya Meza ${tableNum}! Ombi limetumwa kwa Mhasibu.`);
    } catch (err) {
      console.error(err);
      toast.error("Imeshindwa kutuma ombi la bili.");
    }
  };

  const handleTransferTable = async (sourceTable: string, targetTable: string) => {
    if (!vendorProfile?.id) return;
    try {
      const activeTableOrders = orders.filter(o => 
        o.tableNumber === sourceTable && 
        ['pending', 'preparing', 'prepared', 'serving'].includes(o.status)
      );
      if (activeTableOrders.length === 0) {
        toast.info("Hakuna oda inayofanya kazi kwenye meza hii.");
        return;
      }
      // Update all active orders to target table
      for (const ord of activeTableOrders) {
        if (ord.id) {
          await updateDoc(doc(db, 'orders', ord.id), { tableNumber: targetTable });
        }
      }
      // Update table statuses in Firestore/state
      const sourceSec = sections.find(s => s.number === sourceTable);
      const targetSec = sections.find(s => s.number === targetTable);
      if (sourceSec) await updateTableStatus(sourceSec.id, 'available');
      if (targetSec) await updateTableStatus(targetSec.id, 'occupied');
      
      toast.success(`Oda zote zimehamishwa vizuri kutoka Meza ${sourceTable} kwenda Meza ${targetTable}!`);
      if (targetSec) setSelectedSection(targetSec);
    } catch (err) {
      console.error(err);
      toast.error("Imeshindwa kuhamisha meza.");
    }
  };

  const handleMergeTable = async (sourceTable: string, targetTable: string) => {
    if (!vendorProfile?.id) return;
    try {
      const sourceOrders = orders.filter(o => 
        o.tableNumber === sourceTable && 
        ['pending', 'preparing', 'prepared', 'serving'].includes(o.status)
      );
      if (sourceOrders.length === 0) {
        toast.info(`Hakuna oda kwenye Meza ${sourceTable} za kuunganisha.`);
        return;
      }
      for (const ord of sourceOrders) {
        if (ord.id) {
          await updateDoc(doc(db, 'orders', ord.id), { tableNumber: targetTable });
        }
      }
      const sourceSec = sections.find(s => s.number === sourceTable);
      const targetSec = sections.find(s => s.number === targetTable);
      if (sourceSec) await updateTableStatus(sourceSec.id, 'available');
      if (targetSec) await updateTableStatus(targetSec.id, 'occupied');
      
      toast.success(`Meza zimeunganishwa! Oda kutoka Meza ${sourceTable} sasa ziko kwenye Meza ${targetTable}.`);
      if (targetSec) setSelectedSection(targetSec);
    } catch (err) {
      console.error(err);
      toast.error("Imeshindwa kuunganisha meza.");
    }
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, table: any) => {
    if (staffProfile?.role === 'waiter') {
      setSelectedSection(table);
      return;
    }
    if (e.type === 'mousedown' && (e as React.MouseEvent).button !== 0) return;
    updateDraggingId(table.id);
    setSelectedSection(table);
  };

  useEffect(() => {
    if (!draggingId || !vendorProfile?.id) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;

      let pctX = Math.round((relativeX / rect.width) * 100);
      let pctY = Math.round((relativeY / rect.height) * 100);

      pctX = Math.max(1, Math.min(99, pctX));
      pctY = Math.max(1, Math.min(99, pctY));

      setSections(prev =>
        prev.map(s => s.id === draggingId ? { ...s, x: pctX, y: pctY } : s)
      );
    };

    const handlePointerUp = async () => {
      if (!vendorProfile?.id || !draggingId) {
        updateDraggingId(null);
        return;
      }
      const draggedTable = sections.find(s => s.id === draggingId);
      if (draggedTable && typeof draggedTable.x === 'number' && typeof draggedTable.y === 'number') {
        try {
          await updateDoc(doc(db, 'vendors', vendorProfile.id, 'sections', draggingId), {
            x: draggedTable.x,
            y: draggedTable.y
          });
        } catch (err) {
          console.error("Error updating dragged table position:", err);
        }
      }
      updateDraggingId(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [draggingId, sections, vendorProfile?.id]);

  if (loading) return (
    <div className="p-6 md:p-10 space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64 rounded-2xl" />
          <Skeleton className="h-4 w-48 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array(4).fill(0).map((_, i) => (
          <Skeleton key={`stat-skele-${i}`} className="h-32 rounded-[2rem]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Skeleton className="h-64 rounded-[2.5rem]" />
        <Skeleton className="h-64 rounded-[2.5rem]" />
      </div>
    </div>
  );

  if (showOnboarding) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl shadow-orange-500/10 overflow-hidden border border-neutral-100 dark:border-neutral-800"
        >
          <div className="bg-orange-600 p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">VENDOR ONBOARDING</h1>
              <p className="text-orange-100 mt-4 font-bold uppercase tracking-widest text-xs">Sajili biashara yako kuanza kuuza kwenye mtandao wa Papo Hapo.</p>
            </div>
          </div>
          <div className="p-8 md:p-12">
            <form onSubmit={handleOnboarding} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Jina la Biashara / Business Name</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400" />
                    <Input required className="h-14 pl-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} placeholder="mfano: Mama Ntilie Restaurant" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Aina ya Biashara / Category</label>
                  <Select 
                    required 
                    value={formData.category}
                    onValueChange={val => setFormData({...formData, category: val as VendorCategory})}
                  >
                    <SelectTrigger className="h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold">
                      <SelectValue placeholder="Chagua aina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant / Chakula</SelectItem>
                      <SelectItem value="grocery">Grocery / Soko</SelectItem>
                      <SelectItem value="pharmacy">Pharmacy / Duka la Dawa</SelectItem>
                      <SelectItem value="ecommerce">Shop / Maduka ya Bidhaa</SelectItem>
                      <SelectItem value="salon">Salon / Kinyozi & Urembo</SelectItem>
                      <SelectItem value="hotel">Hotel / Malazi</SelectItem>
                      <SelectItem value="bus_ticket">Bus Ticket / Tiketi za Mabasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Maelezo Kamili / Business Description</label>
                <div className="relative">
                  <Info className="absolute left-4 top-4 w-5 h-5 text-neutral-400" />
                  <Textarea required className="min-h-[120px] pl-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-medium pt-4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Elezea kwa ufupi huduma unazotoa na nini kinakufanya uwe bora..." />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Namba ya Kodi / TIN Number</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400" />
                    <Input required className="h-14 pl-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} placeholder="9-digit TIN Number" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Umbali wa Delivery / Radius (km)</label>
                  <div className="relative">
                    <Truck className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400" />
                    <Input type="number" className="h-14 pl-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" required value={formData.deliveryRadius} onChange={e => setFormData({...formData, deliveryRadius: parseInt(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Anwani ya Biashara / Physical Address</label>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400" />
                    <Input 
                      required 
                      className="h-14 pl-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none font-bold" 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                      placeholder="Mtaa, Eneo, Jengo..." 
                    />
                  </div>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setIsLocationPickerOpen(true)}
                    className="h-14 px-8 rounded-2xl border-2 border-orange-600/20 hover:border-orange-600 text-orange-600 font-black uppercase tracking-widest text-[10px] shrink-0 gap-3 transition-all"
                  >
                    <MapPin className="w-5 h-5" />
                    Chagua kwenye Ramani
                  </Button>
                </div>
                {formData.location && (
                  <div className="flex items-center gap-2 mt-2 ml-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                      Mahali pa GPS Pamewekwa: {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}
                    </p>
                  </div>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={isSubmittingOnboarding}
                className="w-full h-16 bg-orange-600 hover:bg-orange-700 text-white text-xl font-black uppercase tracking-tighter rounded-[2rem] shadow-2xl shadow-orange-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingOnboarding ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>🚀 Kumaliza Usajili / Submit Application</>
                )}
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
      const currentOrder = orders.find(o => o.id === orderId);
      if (staffProfile?.role === 'waiter') {
        if (!currentOrder || currentOrder.status !== 'prepared') {
          toast.error("Huna ruhusa ya kubadilisha hali ya oda hii.");
          return;
        }
        if (newStatus !== 'completed' && newStatus !== 'delivered') {
          toast.error("Ruhusa yako ni kukamilisha oda zilizopikwa tu.");
          return;
        }
      }

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

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    if (staffProfile?.role === 'waiter') {
      toast.error("Huna ruhusa ya kuthibitisha au kusasisha oda hii.");
      return;
    }
    try {
      const updateData: any = {
        status: 'preparing',
        prepTime: prepTime,
        updatedAt: serverTimestamp()
      };

      if (selectedOrder.orderType === 'delivery') {
        updateData.riderAssignmentType = assignmentType;
        if (assignmentType === 'vendor') {
          updateData.riderName = vendorRiderDetails.name;
          updateData.riderPhone = vendorRiderDetails.phone;
          updateData.deliveryFee = vendorRiderDetails.fee;
        }
      }

      await updateDoc(doc(db, 'orders', selectedOrder.id!), updateData);
      toast.success('Oda imethibitishwa!');
      setSelectedOrder(null);
      setPrepTime('');
    } catch (error) {
      console.error(error);
      toast.error('Imeshindwa kuthibitisha oda.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = profile?.displayName?.split(' ')[0] || 'Mteja';
    if (hour < 12) return `HABARI ZA ASUBUHI, ${name.toUpperCase()} ☀️`;
    if (hour < 16) return `HABARI ZA MCHANA, ${name.toUpperCase()} ☀️`;
    if (hour < 20) return `HABARI ZA JIONI, ${name.toUpperCase()} 🌅`;
    return `HABARI ZA USIKU, ${name.toUpperCase()} 🌙`;
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
               onClick={() => setSelectedOrder(order)}
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
                  <div className="flex gap-2 items-center">
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
                    {order.paymentStatus === 'paid' ? (
                      <Badge className="bg-emerald-600/10 text-emerald-600 border border-emerald-500/10 text-[8px] font-black uppercase">
                        ✓ PAID
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/10 text-[8px] font-black uppercase animate-pulse animate-duration-1000">
                        ⚠️ HAJALIPA ({order.paymentMethod?.toUpperCase() || 'CASH'})
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

                {/* Table Number & Special Notes */}
                <div className="flex flex-col gap-1.5 text-[11px] font-bold">
                   {order.tableNumber && (
                     <span className="text-orange-500 uppercase tracking-wider flex items-center gap-1">
                        📍 Meza: {order.tableNumber}
                     </span>
                   )}
                   {order.notes && (
                     <span className="text-neutral-500 dark:text-neutral-400 bg-neutral-150 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/80 px-2.5 py-1 rounded-xl text-[10px] italic font-medium">
                        ✍️ Maelekezo: "{order.notes}"
                     </span>
                   )}
                   {order.billRequested && (
                     <span className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-600 dark:text-yellow-500 px-2.5 py-1.5 rounded-xl text-[10px] flex items-center gap-1 animate-pulse uppercase font-black">
                        🔔 Ombi la Bili (BILL REQ)
                     </span>
                   )}
                </div>

                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-950 flex items-center justify-between transition-colors">
                   <div className="flex items-center gap-2 text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{order.createdAt ? format(getSafeDate(order.createdAt), 'HH:mm') : 'Now'}</span>
                   </div>
                   <div className="flex gap-2">
                      {order.paymentStatus !== 'paid' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-emerald-500/35 hover:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 h-8 rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const toastId = toast.loading('Nasasisha malipo...');
                            try {
                              await updateDoc(doc(db, 'orders', order.id!), {
                                paymentStatus: 'paid',
                                updatedAt: serverTimestamp()
                              });
                              toast.success('Oda imewekwa kama IMELIPWA!', { id: toastId });
                            } catch (error) {
                              toast.error('Imeshindwa kusasisha malipo.', { id: toastId });
                            }
                          }}
                        >
                          LIPWA / PAID
                        </Button>
                      )}
                      {order.status === 'pending' && staffProfile?.role !== 'waiter' && (
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 h-8 rounded-lg text-[10px] font-black uppercase"
                          onClick={() => updateOrderStatus(order.id!, 'preparing')}
                        >
                          {vendorProfile?.category === 'bus_ticket' ? 'Verify Ticket' : 'Accept Order'}
                        </Button>
                      )}
                      {order.status === 'preparing' && staffProfile?.role !== 'waiter' && (
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
                          className="bg-blue-600 hover:bg-blue-700 h-8 rounded-lg text-[10px] font-black uppercase text-white"
                          onClick={() => updateOrderStatus(order.id!, 'completed')}
                        >
                          {staffProfile?.role === 'waiter' ? 'Chukua & Peleka' : (vendorProfile?.category === 'bus_ticket' ? 'Departed' : 'Finish')}
                        </Button>
                      )}
                      <Button
                        variant="ghost" 
                        size="icon" 
                        title="Chapisha Risiti (Print)"
                        className="h-8 w-8 text-neutral-600 hover:text-orange-500 hover:bg-orange-600/10 cursor-pointer"
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
                        title="Pakua Risiti (Download)"
                        className="h-8 w-8 text-neutral-600 hover:text-emerald-500 hover:bg-emerald-600/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadOrderReceipt(order);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" 
                        size="icon" 
                        title="Futa Oda"
                        className="h-8 w-8 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">{vendorContext.ordersLabel}</h1>
            {vendorProfile?.category === 'restaurant' && (
              <a 
                href={`/status/${vendorProfile?.id}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-neutral-800"
              >
                <Monitor className="w-3 h-3" /> TV Screen
              </a>
            )}
          </div>
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
        <div className="flex flex-col gap-6">
           {/* Mobile Fulfillment Tab Switcher */}
           <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-2">
             {[vendorContext.awaitingLabel, vendorContext.pickingLabel, vendorContext.readyLabel, "Archive"].map((label, i) => (
               <button
                 key={`fulfillment-mobile-tab-${i}`}
                 onClick={() => setActiveFulfillmentTab(i)}
                 className={`flex-shrink-0 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                   activeFulfillmentTab === i 
                     ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                     : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
                 }`}
               >
                 {label}
               </button>
             ))}
           </div>

           <div className="flex gap-4 lg:gap-8 overflow-x-auto no-scrollbar pb-8 min-h-[600px]">
              <div className={`${activeFulfillmentTab === 0 ? 'block' : 'hidden'} lg:block flex-1 flex-shrink-0 lg:flex-shrink w-full lg:w-auto`}>
                {renderFulfillmentColumn(vendorContext.awaitingLabel, ["pending"], "text-yellow-500")}
              </div>
              <div className={`${activeFulfillmentTab === 1 ? 'block' : 'hidden'} lg:block flex-1 flex-shrink-0 lg:flex-shrink w-full lg:w-auto`}>
                {renderFulfillmentColumn(vendorContext.pickingLabel, ["preparing", "accepted"], "text-orange-500")}
              </div>
              <div className={`${activeFulfillmentTab === 2 ? 'block' : 'hidden'} lg:block flex-1 flex-shrink-0 lg:flex-shrink w-full lg:w-auto`}>
                {renderFulfillmentColumn(vendorContext.readyLabel, ["prepared"], "text-purple-500")}
              </div>
              <div className={`${activeFulfillmentTab === 3 ? 'block' : 'hidden'} lg:block flex-1 flex-shrink-0 lg:flex-shrink w-full lg:w-auto`}>
                {renderFulfillmentColumn("Archive / Sent", ["delivered", "completed"], "text-green-500")}
              </div>
           </div>
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
                  <tr 
                    key={`orders-table-row-${order.id}-${idx}`} 
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
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
                      {order.peopleCount ? order.peopleCount > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Users className="w-3 h-3 text-orange-600" />
                          <span className="text-[9px] font-black italic bg-orange-600/10 text-orange-600 px-1.5 rounded">{order.peopleCount} Seats</span>
                        </div>
                      ) : null}
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
                          title="Chapisha Risiti (Print)"
                          className="text-neutral-500 hover:text-orange-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                          onClick={() => handlePrintOrder(order)}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Pakua Risiti (Download)"
                          className="text-neutral-500 hover:text-emerald-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                          onClick={() => handleDownloadOrderReceipt(order)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Futa Oda"
                          className="text-neutral-500 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
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
      {/* Order Details Modal with Assignment Logic */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-950/50">
                 <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                       <ShoppingCart className="w-5 h-5 text-orange-600" />
                       Oda #{selectedOrder.id?.slice(-6).toUpperCase()}
                    </h3>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{selectedOrder.customerName} • {selectedOrder.orderType}</p>
                 </div>
                 <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                 {/* Order Summary */}
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Bidhaa Zilizoagizwa</label>
                    <div className="space-y-3">
                       {selectedOrder.items.map((item: any, i: number) => (
                         <div key={`modal-item-${i}`} className="flex justify-between items-center p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-orange-600/10 flex items-center justify-center text-[10px] font-black text-orange-600 italic">
                                  {item.quantity}x
                               </div>
                               <span className="font-bold text-sm">{item.name}</span>
                            </div>
                            <span className="font-black text-sm italic">TZS {(item.price * item.quantity).toLocaleString()}</span>
                         </div>
                       ))}
                    </div>
                    <div className="flex justify-between items-center px-4 pt-2">
                       <span className="text-sm font-bold text-neutral-500 uppercase">Jumla Kuu</span>
                       <span className="text-2xl font-black text-orange-600 italic">TZS {selectedOrder.totalAmount.toLocaleString()}</span>
                    </div>
                 </div>

                 {/* Order Details Grid */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-[1.5rem] bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800 space-y-2">
                       <div className="flex items-center gap-2 text-neutral-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Arrival / Muda</span>
                       </div>
                       <p className="font-black italic text-sm">{selectedOrder.arrivalTime || 'ASAP / Papo Hapo'}</p>
                    </div>
                    <div className="p-5 rounded-[1.5rem] bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800 space-y-2">
                       <div className="flex items-center gap-2 text-neutral-400">
                          <MapPin className="w-4 h-4" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Table / Location</span>
                       </div>
                       <p className="font-black italic text-sm">{selectedOrder.tableNumber || 'N/A'}</p>
                    </div>
                    <div className="p-5 rounded-[1.5rem] bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800 space-y-2">
                       <div className="flex items-center gap-2 text-neutral-400">
                          <Users className="w-4 h-4 text-orange-600" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Watu / People</span>
                       </div>
                       <p className="font-black italic text-sm">{selectedOrder.peopleCount || 1} Person(s)</p>
                    </div>
                    <div className={`p-5 rounded-[1.5rem] border space-y-2 ${selectedOrder.paymentStatus === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-500/20 animate-pulse animate-duration-1000'}`}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-neutral-400">
                             <CreditCard className="w-3.5 h-3.5 text-orange-600" />
                             <span className="text-[9px] font-black uppercase tracking-widest">Malipo</span>
                          </div>
                          {selectedOrder.paymentStatus !== 'paid' && (
                             <button
                               onClick={async () => {
                                 const toastId = toast.loading('Nasasisha malipo...');
                                 try {
                                   await updateDoc(doc(db, 'orders', selectedOrder.id!), {
                                     paymentStatus: 'paid',
                                     updatedAt: serverTimestamp()
                                   });
                                   setSelectedOrder({ ...selectedOrder, paymentStatus: 'paid' });
                                   toast.success('Malipo yamethibitishwa!', { id: toastId });
                                 } catch (error) {
                                   toast.error('Imeshindwa kusasisha malipo.', { id: toastId });
                                 }
                               }}
                               className="px-2.5 py-1 text-[8px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                             >
                               Weka Imelipwa
                             </button>
                          )}
                       </div>
                       <p className={`font-black italic text-[11px] uppercase ${selectedOrder.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {selectedOrder.paymentStatus === 'paid' ? '✓ IMELIPWA / PAID' : `⚠️ HAIJALIPWA (${selectedOrder.paymentMethod?.toUpperCase() || 'CASH'})`}
                       </p>
                    </div>
                 </div>

                  {selectedOrder.notes && (
                     <div className="p-5 rounded-[1.5rem] bg-orange-600/5 dark:bg-neutral-950/50 border border-orange-500/10 dark:border-neutral-800 space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-neutral-400">
                           <FileText className="w-4 h-4 text-orange-600" />
                           <span className="text-[9px] font-black uppercase tracking-widest">Maelekezo Maalum (Special Notes)</span>
                        </div>
                        <p className="font-bold text-neutral-800 dark:text-neutral-300 italic text-xs">
                           "{selectedOrder.notes}"
                        </p>
                     </div>
                  )}

                 {/* Confirmation Logic - Only if Pending */}
                 {selectedOrder.status === 'pending' && (
                   <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Muda wa Kila (Dakika)</label>
                         <Input 
                           type="number"
                           placeholder="Muda wa Maandalizi..."
                           className="h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-950 font-bold border-none"
                           value={prepTime}
                           onChange={e => setPrepTime(e.target.value)}
                         />
                      </div>

                      {selectedOrder.orderType === 'delivery' && (
                        <div className="space-y-6">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Chagua Dereva (Rider)</label>
                              <div className="grid grid-cols-2 gap-3">
                                 <button 
                                   onClick={() => setAssignmentType('vendor')}
                                   className={`p-4 rounded-2xl border transition-all text-left space-y-1 ${assignmentType === 'vendor' ? 'bg-orange-600 border-none text-white shadow-lg' : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 text-neutral-500'}`}
                                 >
                                    <User className="w-5 h-5 mb-1" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Mtu wangu</p>
                                    <p className="text-[8px] opacity-70 font-bold">Dereva wa Vendo</p>
                                 </button>
                                 <button 
                                   onClick={() => setAssignmentType('app')}
                                   className={`p-4 rounded-2xl border transition-all text-left space-y-1 ${assignmentType === 'app' ? 'bg-orange-600 border-none text-white shadow-lg' : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 text-neutral-500'}`}
                                 >
                                    <Zap className="w-5 h-5 mb-1" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Papo Hapo App</p>
                                    <p className="text-[8px] opacity-70 font-bold">Rider wa Karibu</p>
                                 </button>
                              </div>
                           </div>

                           <AnimatePresence>
                             {assignmentType === 'vendor' && (
                               <motion.div 
                                 initial={{ opacity: 0, height: 0 }}
                                 animate={{ opacity: 1, height: 'auto' }}
                                 exit={{ opacity: 0, height: 0 }}
                                 className="grid grid-cols-2 gap-3 pt-2"
                               >
                                  <div className="space-y-2">
                                     <Input 
                                       placeholder="Jina la Dereva"
                                       className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-950 font-bold border-none text-xs"
                                       value={vendorRiderDetails.name}
                                       onChange={e => setVendorRiderDetails({...vendorRiderDetails, name: e.target.value})}
                                     />
                                  </div>
                                  <div className="space-y-2">
                                     <Input 
                                       placeholder="Namba ya Simu"
                                       className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-950 font-bold border-none text-xs"
                                       value={vendorRiderDetails.phone}
                                       onChange={e => setVendorRiderDetails({...vendorRiderDetails, phone: e.target.value})}
                                     />
                                  </div>
                                  <div className="space-y-2 col-span-2">
                                     <Input 
                                       type="number"
                                       placeholder="Gharama ya Usafiri (TZS)"
                                       className="h-12 rounded-xl bg-neutral-50 dark:bg-neutral-950 font-bold border-none text-xs"
                                       value={vendorRiderDetails.fee || ''}
                                       onChange={e => setVendorRiderDetails({...vendorRiderDetails, fee: Number(e.target.value)})}
                                     />
                                  </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </div>
                      )}
                   </div>
                 )}
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex gap-3">
                 {selectedOrder.status === 'pending' && staffProfile?.role !== 'waiter' ? (
                   <>
                      <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-red-500 hover:bg-red-500/10" onClick={() => updateOrderStatus(selectedOrder.id!, 'cancelled')}>Kataa Oda</Button>
                      <Button className="flex-[2] h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-orange-900/20" onClick={handleConfirmOrder}>Thibitisha Oda</Button>
                   </>
                 ) : (
                   <Button variant="outline" className="w-full h-14 border-neutral-200 dark:border-neutral-800 rounded-2xl font-black uppercase tracking-widest text-xs" onClick={() => setSelectedOrder(null)}>Funga Dira</Button>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white overflow-hidden relative transition-colors duration-300">
      {/* Mobile Menu Toggle - More modern floating style */}
      <div className="lg:hidden flex items-center justify-between p-4 px-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-[10px] uppercase tracking-tighter truncate max-w-[150px] leading-none mb-1">{vendorProfile?.businessName}</h2>
            <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest leading-none">Vendor Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-2 text-neutral-500 hover:text-orange-600 relative">
             <Bell className="w-5 h-5" />
             <span className="absolute top-1 right-1 w-2 h-2 bg-orange-600 rounded-full border-2 border-white dark:border-neutral-900"></span>
           </button>
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
             className="text-neutral-900 dark:text-white rounded-xl"
           >
             {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
           </Button>
        </div>
      </div>

      {/* Sidebar - Desktop and Mobile Overlay */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 w-72 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-8 flex flex-col gap-10 z-[100] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] lg:z-auto
        ${isMobileMenuOpen ? 'shadow-2xl rounded-r-[3rem]' : 'rounded-none'}
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

        {/* Sidebar Restaurant Quick Floor & Sales Widget */}
        <div className="p-4 bg-neutral-950/80 border border-neutral-800/90 rounded-2xl space-y-3 shadow-lg">
          <div>
            <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest block">Jumla Mapato Leo</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-black text-white font-mono">
                TZS {(orders.reduce((s, o) => s + (o.totalAmount || 0), 0) || 4850000).toLocaleString()}
              </span>
              <svg className="w-16 h-5 text-[#00E5A0]" viewBox="0 0 64 20" fill="none">
                <path d="M2 16 L18 14 L34 8 L50 11 L62 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="62" cy="3" r="2.5" fill="currentColor" />
              </svg>
            </div>
          </div>
          <div className="pt-2 border-t border-neutral-800/80">
            <div className="flex items-center justify-between text-[9px] font-extrabold text-neutral-400 uppercase mb-1.5">
              <span>Meza Occupied</span>
              <span className="text-white font-mono font-black">
                {sections.filter(s => s.status === 'occupied').length || 21} / {sections.length || 36} ({Math.round(((sections.filter(s => s.status === 'occupied').length || 21) / (sections.length || 36)) * 100)}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div 
                className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-emerald-400 rounded-full transition-all duration-1000" 
                style={{ width: `${Math.min(100, Math.round(((sections.filter(s => s.status === 'occupied').length || 21) / (sections.length || 36)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
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
      <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto w-full pb-24 lg:pb-0">
        {/* Top Bar - Only on Desktop typically */}
        <header className="hidden lg:flex h-20 border-b border-neutral-200 dark:border-neutral-800 px-8 items-center justify-between bg-white/80 dark:bg-neutral-900/20 backdrop-blur-xl sticky top-0 z-10 w-full transition-colors duration-300">
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
            {(!staffProfile || staffProfile.role === 'manager') && (
              <Button 
                onClick={() => setIsAddProductOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 gap-2 h-10 rounded-xl px-4 font-bold hidden md:flex"
              >
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            )}
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2 hidden md:block transition-colors"></div>
            <button className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-white transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-600 rounded-full border-2 border-white dark:border-neutral-900 transition-colors"></span>
            </button>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2 transition-colors"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-neutral-900 dark:text-white">
                  {staffProfile ? staffProfile.name : (profile?.displayName || 'Merchant')}
                </p>
                <p className="text-[10px] text-orange-600 font-extrabold uppercase tracking-widest">
                  {staffProfile ? `${staffProfile.role}` : 'Owner'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-600/30 flex items-center justify-center text-orange-600 font-bold overflow-hidden">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.displayName?.charAt(0)
                )}
              </div>
            </div>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-1"></div>
            <button 
              onClick={handleSignOut}
              className="p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-red-500 transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Top Mobile Quick Tabs */}
        <div className="lg:hidden flex overflow-x-auto no-scrollbar gap-2 px-3 py-2.5 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          {tabs.map((item) => (
            <button
               key={`mobile-tab-scroll-${item.id}`}
               onClick={() => setActiveTab(item.id as TabType)}
               className={`flex items-center gap-1.5 px-3.5 h-9 rounded-xl whitespace-nowrap transition-all text-xs font-bold shrink-0 ${
                  activeTab === item.id 
                     ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' 
                     : 'bg-neutral-100 dark:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 hover:text-white'
               }`}
            >
               <item.icon className="w-3.5 h-3.5" />
               <span className="text-[11px] font-black uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar pb-32 lg:pb-8">
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
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter">{getGreeting()}</h1>
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
                    { label: "Add Item", id: "products", icon: Plus, action: () => { setActiveTab('products'); setIsAddProductOpen(true); }, color: "bg-orange-600" },
                    { label: "New Order", id: "pos", icon: ShoppingBag, action: () => setActiveTab('pos'), color: "bg-blue-600" },
                    { label: "Stock Stats", id: "inventory_stats", icon: BarChart3, action: () => setActiveTab('inventory_stats'), color: "bg-purple-600" },
                    { label: "Customers", id: "customers", icon: Users, action: () => setActiveTab('customers'), color: "bg-emerald-600" },
                    { label: "Coupons", id: "coupons", icon: Tag, action: () => setActiveTab('coupons'), color: "bg-pink-600" },
                    { label: "Help", id: "help", icon: AlertCircle, action: () => toast.info('Support team contacted.'), color: "bg-neutral-800" },
                  ].filter(action => {
                    if (action.id === 'help') return true;
                    return tabs.some(t => t.id === action.id);
                  }).map((action, i) => (
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

                {/* Hotel Status Tracker (Only for Hotels) */}
                {vendorProfile?.category === 'hotel' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="rounded-[2rem] border-none shadow-xl shadow-orange-500/10 bg-gradient-to-br from-orange-600 to-orange-700 text-white overflow-hidden relative">
                       <div className="absolute top-0 right-0 p-8 opacity-10">
                         <Bed className="w-24 h-24" />
                       </div>
                       <CardContent className="p-8 relative z-10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-200 mb-2">Room Inventory</p>
                          <div className="flex items-baseline gap-2">
                             <h3 className="text-4xl font-black italic tracking-tighter">{vendorProfile.numberOfRooms || 0}</h3>
                             <span className="text-sm font-bold uppercase tracking-widest text-orange-200">Total Units</span>
                          </div>
                          <div className="mt-6 flex items-center gap-4">
                            <div className="flex-1 bg-white/10 rounded-full h-2">
                               <div className="bg-white rounded-full h-full" style={{ width: '100%' }} />
                            </div>
                            <span className="text-[10px] font-black">100% READY</span>
                          </div>
                       </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] border-none shadow-xl shadow-black/5 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                       <CardContent className="p-8">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Current Status</p>
                            <Badge className={`${vendorProfile.hotelStatus === 'Available' ? 'bg-green-500' : 'bg-red-500'} text-white border-none font-black text-[8px] px-3`}>
                              {vendorProfile.hotelStatus || 'AVAILABLE'}
                            </Badge>
                          </div>
                          <h3 className="text-2xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white mb-6">
                            {(vendorProfile.hotelStatus === 'Available' || !vendorProfile.hotelStatus) ? 'Wazi kwa Wageni' : 'Samahani, Tumajaa'}
                          </h3>
                          <Button 
                            variant="outline" 
                            className="w-full h-12 rounded-2xl border-2 border-neutral-100 dark:border-neutral-800 font-black uppercase tracking-widest text-[9px]"
                            onClick={() => setActiveTab('settings')}
                          >
                             Hamia Kwenye Settings kurekebisha
                          </Button>
                       </CardContent>
                    </Card>

                    <Card className="rounded-[2rem] border-none shadow-xl shadow-black/5 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 overflow-hidden group">
                       <CardContent className="p-8">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">Pricing Pulse</p>
                          <div className="space-y-3">
                             {[
                               { label: 'Single', price: vendorProfile.roomPricing?.single },
                               { label: 'Double', price: vendorProfile.roomPricing?.double },
                               { label: 'VIP', price: vendorProfile.roomPricing?.vip },
                             ].map(item => item.price && (
                               <div key={item.label} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase">{item.label}</span>
                                  <span className="text-sm font-black text-orange-600 italic">TZS {item.price.toLocaleString()}</span>
                               </div>
                             ))}
                          </div>
                       </CardContent>
                    </Card>
                  </div>
                )}

                {/* Hotel Room Status Board (Only for Hotels) */}
                {vendorProfile?.category === 'hotel' && products.length > 0 && (
                  <div className="space-y-6 mt-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded-xl bg-orange-600/10 text-orange-600">
                            <LayoutGrid className="w-5 h-5" />
                         </div>
                         <h3 className="text-xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">Live Room Status Grid</h3>
                      </div>
                      <div className="hidden sm:flex items-center gap-4">
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-green-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full bg-orange-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Occupied</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                      {products.map((room) => {
                        const isActiveOrder = orders.some(o => 
                          o.orderType === 'booking' && 
                          o.roomType === room.name && 
                          (o.status === 'accepted' || o.status === 'pending')
                        );
                        
                        const isCleaning = room.isCleaning;

                        return (
                          <motion.div 
                            key={room.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => !isActiveOrder && toggleCleaning(room.id || '', !!isCleaning)}
                            className={`aspect-square rounded-[2rem] p-5 flex flex-col justify-between border-2 transition-all relative group cursor-pointer ${
                              isActiveOrder 
                                ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/30' 
                                : isCleaning
                                  ? 'bg-neutral-100 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 opacity-60'
                                  : 'bg-white border-neutral-100 dark:bg-neutral-900 dark:border-neutral-800'
                            }`}
                          >
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-orange-600 transition-colors">#{room.name.slice(0,3)}</span>
                                <div className={`w-3 h-3 rounded-full ${isActiveOrder ? 'bg-orange-500 shadow-md shadow-orange-500/50' : isCleaning ? 'bg-neutral-400' : 'bg-green-500 shadow-md shadow-green-500/50'}`} />
                             </div>
                             <div>
                                <h4 className="text-sm font-black italic tracking-tighter truncate leading-tight mb-1">{room.name}</h4>
                                <p className={`text-[8px] font-black uppercase tracking-widest ${isActiveOrder ? 'text-orange-600' : isCleaning ? 'text-neutral-500' : 'text-green-600'}`}>
                                   {isActiveOrder ? 'Dagaa' : isCleaning ? 'Usafi' : 'Wazi'}
                                </p>
                             </div>
                             
                             {isActiveOrder && (
                                <div className="absolute top-1 right-1">
                                   <div className="bg-orange-600 text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase">Busy</div>
                                </div>
                             )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Main Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Gross Sales", value: `TZS ${(orders.reduce((s,o) => s + o.totalAmount, 0)).toLocaleString()}`, icon: Banknote, trend: "+12.5%", positive: true, sub: "Total revenue generated", data: chartData.map(d => ({ value: d.sales })) },
                    { label: "Processing", value: orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length.toString(), icon: Clock, trend: "+3 new", positive: true, sub: "Orders being packed/shipped", data: chartData.map(d => ({ value: d.orders })) },
                    { label: "Available Items", value: products.length.toString(), icon: Box, trend: "Stable", positive: true, sub: "Unique products listed", data: [{value: 4}, {value: 6}, {value: 5}, {value: 8}, {value: 7}, {value: 10}] },
                    { label: "Customer Rating", value: (vendorProfile?.rating || 0).toFixed(1), icon: Star, trend: `${vendorProfile?.ratingCount || 0} reviews`, positive: true, sub: "Average feedback score", data: vendorReviews.length > 0 ? vendorReviews.slice(-6).map(r => ({ value: Number(r.rating) || 0 })) : [{value: 5}, {value: 4}, {value: 5}, {value: 5}, {value: 5}, {value: 5}] },
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
                             <p className="text-[10px] text-neutral-600 font-bold uppercase mt-1">{format(getSafeDate(order.createdAt), 'p')}</p>
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
                        ].filter(type => {
                          if (staffProfile?.role === 'waiter') {
                            return type.id === 'walk_in';
                          }
                          return true;
                        }).map((type, idx) => (
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
                           <Select value={tableNumber} onValueChange={(val) => setTableNumber(val || '')}>
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

                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="pt-2"
                      >
                         <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 block mb-2">Maelekezo Maalum (Extra Notes)</label>
                         <Input 
                            placeholder="Mf. Asiweke pilipili, nk." 
                            value={specialNotes} 
                            onChange={(e) => setSpecialNotes(e.target.value)}
                            className="bg-neutral-900 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white placeholder-neutral-600"
                         />
                      </motion.div>
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
                className="space-y-6 pb-32"
              >
                {/* Header with Title and Global Area Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter text-white">DINING FLOOR (MEZA)</h2>
                    <p className="text-neutral-400 text-xs sm:text-sm font-medium">Monitor occupancy, manage table layout visually and print QR codes</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <Select defaultValue="all">
                      <SelectTrigger className="bg-neutral-900/90 border-neutral-800 h-12 px-4 rounded-2xl text-xs font-black uppercase tracking-wider text-neutral-300 w-44">
                        <SelectValue placeholder="All Areas" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-2xl">
                        <SelectItem value="all">All Areas</SelectItem>
                        <SelectItem value="indoor">Indoor Floor (Ndani)</SelectItem>
                        <SelectItem value="outdoor">Outdoor Terrace (Nje)</SelectItem>
                        <SelectItem value="vip">VIP Lounge</SelectItem>
                        <SelectItem value="bar">Kaunta / Bar Area</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="Onyesha / Ficha Mistari ya Mwongozo"
                      className="h-12 w-12 bg-neutral-900/90 border border-neutral-800 text-neutral-400 hover:text-white rounded-2xl"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    <Button 
                      onClick={() => setIsAddSectionOpen(true)}
                      className="bg-orange-600 hover:bg-orange-500 rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-orange-950/40 text-white flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> ADD NEW TABLE
                    </Button>
                  </div>
                </div>

                {/* Sub Tab Selection Bar */}
                {vendorProfile?.category === 'restaurant' && (
                  <div className="flex flex-wrap bg-neutral-950/90 p-1.5 rounded-2xl border border-neutral-800/90 w-fit gap-1.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setTableSubTab('visual')}
                      className={`px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all gap-2 flex items-center cursor-pointer ${
                        tableSubTab === 'visual' 
                          ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-600/30' 
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      <Map className="w-4 h-4" /> RAMANI YA MEZA (VISUAL MAP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableSubTab('list')}
                      className={`px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all gap-2 flex items-center cursor-pointer ${
                        tableSubTab === 'list' 
                          ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-600/30' 
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      <Layers className="w-4 h-4" /> ORODHA YA MEZA (LIST GRID)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableSubTab('analytics')}
                      className={`px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all gap-2 flex items-center cursor-pointer ${
                        tableSubTab === 'analytics' 
                          ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-600/30' 
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> RIPOTI YA MEZA (TABLE TRAFFIC)
                    </button>
                  </div>
                )}

                {/* VISUAL MAP BUILDER */}
                {vendorProfile?.category === 'restaurant' && tableSubTab === 'visual' ? (
                  <div className="space-y-4">
                    {/* AINA YA MEZA (Table Types Legend & Quick Filter Bar) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950/90 border border-neutral-800/90 px-5 py-3 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        AINA YA MEZA
                      </span>
                      <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-wider">
                        <div className="flex items-center gap-2 text-neutral-300">
                          <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                          <span>SQUARE (4 SEATS)</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-300">
                          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                          <span>ROUND (6 SEATS)</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-300">
                          <span className="w-5 h-3 rounded bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.6)]" />
                          <span>RECTANGLE (6 SEATS)</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-300">
                          <span className="w-4 h-3.5 rounded bg-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.6)]" />
                          <span>BOOTH (4 SEATS)</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-300">
                          <span className="w-3.5 h-3.5 rounded-full bg-pink-600 shadow-[0_0_8px_rgba(219,39,119,0.6)]" />
                          <span>BAR (2 SEATS)</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Hand: Interactive Floor Map Canvas */}
                      <div 
                        ref={mapContainerRef} 
                        className="lg:col-span-2 relative bg-[#111317] border border-neutral-800 min-h-[580px] h-[600px] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col justify-between select-none"
                        style={{ 
                          backgroundImage: `
                            radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.04), transparent 80%),
                            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
                          `,
                          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
                          backgroundColor: '#0e1014'
                        }}
                      >
                        {/* LEFT WALL: Indoor Lush Botanical Garden Strip */}
                        <div className="absolute top-0 bottom-14 left-0 w-16 bg-gradient-to-r from-[#07130c] via-[#09180e] to-transparent border-r border-emerald-950/40 pointer-events-none flex flex-col items-center justify-around py-6 z-10">
                          <div className="w-9 h-28 bg-[#18110b] border border-[#3b2716] rounded-xl p-1 shadow-2xl flex flex-col items-center justify-around opacity-90">
                            <span className="text-xl select-none filter drop-shadow">🌿</span>
                            <span className="text-xl select-none filter drop-shadow">🪴</span>
                            <span className="text-xl select-none filter drop-shadow">🍃</span>
                          </div>
                          <div className="w-9 h-28 bg-[#18110b] border border-[#3b2716] rounded-xl p-1 shadow-2xl flex flex-col items-center justify-around opacity-90">
                            <span className="text-xl select-none filter drop-shadow">🌿</span>
                            <span className="text-xl select-none filter drop-shadow">🪴</span>
                            <span className="text-xl select-none filter drop-shadow">🍃</span>
                          </div>
                        </div>

                        {/* TOP RIGHT: Kitchen & POS Pass Station */}
                        <div className="absolute top-4 right-4 bg-neutral-900/90 border border-amber-500/20 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl pointer-events-none z-10 flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">JIKO (KITCHEN & POS AREA)</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-80">
                            <span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500" />
                            <span className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500" />
                          </div>
                        </div>

                        {/* TOP LEFT: Seating Floor Ndani Badge */}
                        <div className="absolute top-4 left-20 bg-blue-950/40 border border-blue-500/30 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-[9px] font-black text-blue-400 uppercase tracking-widest pointer-events-none z-10">
                          SEATING FLOOR (NDANI)
                        </div>

                        {/* RIGHT CENTER: Kaunta / Bar Area */}
                        <div className="absolute top-1/2 right-4 -translate-y-1/2 bg-purple-950/40 border border-purple-500/30 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl pointer-events-none z-10 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">KAUNTA (BAR AREA)</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span>🍸</span>
                            <span>🍷</span>
                            <span>🍹</span>
                          </div>
                        </div>

                        {/* Rendering Interactive Restaurant Tables */}
                        <div className="absolute inset-0 pt-12 pb-16 px-16">
                          {(() => {
                            // Rich default restaurant layout matching user reference
                            const displaySections = sections.length > 1 ? sections : [
                              { id: 'tbl-01', number: '01', capacity: 4, shape: 'square', status: 'available', section: 'Indoor', x: 26, y: 22, theme: 'green' },
                              { id: 'tbl-02', number: '02', capacity: 6, shape: 'round', status: 'occupied', section: 'Indoor', x: 44, y: 22, theme: 'red' },
                              { id: 'tbl-03', number: '03', capacity: 6, shape: 'rectangle', status: 'reserved', section: 'Indoor', x: 63, y: 22, theme: 'purple' },
                              { id: 'tbl-04', number: '04', capacity: 4, shape: 'square', status: 'available', section: 'Indoor', x: 82, y: 22, theme: 'green' },

                              { id: 'tbl-05', number: '05', capacity: 4, shape: 'booth', status: 'cleaning', section: 'Indoor', x: 26, y: 52, theme: 'gold' },
                              { id: 'tbl-21', number: '21', capacity: 6, shape: 'round', status: 'occupied', section: 'Indoor', x: 44, y: 52, theme: 'red' },
                              { id: 'tbl-06', number: '06', capacity: 6, shape: 'round', status: 'available', section: 'Indoor', x: 63, y: 52, theme: 'blue' },
                              { id: 'tbl-07', number: '07', capacity: 4, shape: 'booth', status: 'reserved', section: 'Indoor', x: 82, y: 52, theme: 'gold' },

                              { id: 'tbl-08', number: '08', capacity: 4, shape: 'square', status: 'available', section: 'Indoor', x: 26, y: 82, theme: 'green' },
                              { id: 'tbl-09', number: '09', capacity: 6, shape: 'round', status: 'available', section: 'Indoor', x: 44, y: 82, theme: 'blue' },
                              { id: 'tbl-10', number: '10', capacity: 6, shape: 'rectangle', status: 'cleaning', section: 'Indoor', x: 63, y: 82, theme: 'purple' },
                              { id: 'tbl-11', number: '11', capacity: 2, shape: 'bar_stool', status: 'available', section: 'Indoor', x: 82, y: 82, theme: 'pink' },
                            ];

                            // Default select table 21 or first
                            const currentSelected = selectedSection || displaySections.find(s => s.number === '21') || displaySections[0];

                            return displaySections.map((section, idx) => {
                              const tableStatus = section.status || 'available';
                              const x = typeof section.x === 'number' ? section.x : (20 + (idx % 4) * 20);
                              const y = typeof section.y === 'number' ? section.y : (22 + Math.floor(idx / 4) * 30);
                              const shape = section.shape || (idx === 1 || idx === 5 || idx === 6 || idx === 9 ? 'round' : idx === 2 || idx === 10 ? 'rectangle' : idx === 4 || idx === 7 ? 'booth' : idx === 11 ? 'bar_stool' : 'square');
                              const isSelected = (selectedSection?.number || currentSelected?.number) === section.number;
                              const isDraggingThis = draggingId === section.id;

                              // Status Label Text
                              let statusText = 'Available';
                              let statusColor = 'text-emerald-400';
                              if (tableStatus === 'occupied') {
                                statusText = 'Occupied';
                                statusColor = 'text-red-400';
                              } else if (tableStatus === 'reserved') {
                                statusText = 'Reserved';
                                statusColor = 'text-amber-400';
                              } else if (tableStatus === 'cleaning') {
                                statusText = 'Cleaning';
                                statusColor = 'text-blue-400';
                              }

                              return (
                                <motion.div
                                  key={`visual-table-${section.id || idx}`}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.96 }}
                                  onMouseDown={(e) => handleDragStart(e, section)}
                                  onTouchStart={(e) => handleDragStart(e, section)}
                                  onClick={() => setSelectedSection(section)}
                                  className={`absolute cursor-grab active:cursor-grabbing transition-all select-none ${
                                    isSelected ? 'z-40' : 'z-20'
                                  }`}
                                  style={{ 
                                    left: `${x}%`, 
                                    top: `${y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    position: 'absolute'
                                  }}
                                >
                                  {/* Table Container based on geometry */}
                                  <div className={`relative flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${
                                    isSelected ? 'ring-4 ring-orange-500 rounded-3xl shadow-[0_0_35px_rgba(249,115,22,0.8)] bg-orange-500/10' : ''
                                  } ${isDraggingThis ? 'opacity-70 scale-110' : ''}`}>
                                    
                                    {/* 1. SQUARE 4-SEATER */}
                                    {shape === 'square' && (
                                      <div className="relative flex flex-col items-center">
                                        {/* Top Chairs */}
                                        <div className="flex items-center gap-3 -mb-1 z-0">
                                          <div className="w-3.5 h-2 bg-[#2c1d12] border border-[#523620] rounded-t-sm shadow-md" />
                                          <div className="w-3.5 h-2 bg-[#2c1d12] border border-[#523620] rounded-t-sm shadow-md" />
                                        </div>
                                        {/* Table Core */}
                                        <div 
                                          className="w-16 h-14 rounded-xl border border-emerald-500/40 flex flex-col items-center justify-center p-1 shadow-2xl"
                                          style={{ background: 'linear-gradient(135deg, #14281d 0%, #0d1b13 50%, #07100b 100%)' }}
                                        >
                                          <span className="font-mono font-black text-xs text-white leading-none">{section.number}</span>
                                          <span className={`text-[7.5px] font-black uppercase tracking-tighter mt-1 ${statusColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        {/* Bottom Chairs */}
                                        <div className="flex items-center gap-3 -mt-1 z-0">
                                          <div className="w-3.5 h-2 bg-[#2c1d12] border border-[#523620] rounded-b-sm shadow-md" />
                                          <div className="w-3.5 h-2 bg-[#2c1d12] border border-[#523620] rounded-b-sm shadow-md" />
                                        </div>
                                      </div>
                                    )}

                                    {/* 2. ROUND 6-SEATER */}
                                    {shape === 'round' && (
                                      <div className="relative w-20 h-20 flex items-center justify-center">
                                        {/* 6 Radial Chairs surrounding circle */}
                                        {[0, 60, 120, 180, 240, 300].map((deg) => (
                                          <div
                                            key={`chair-round-${deg}`}
                                            className="absolute w-3.5 h-2.5 bg-[#2c1d12] border border-[#523620] rounded-full shadow-md pointer-events-none"
                                            style={{
                                              transform: `rotate(${deg}deg) translate(0px, -34px)`
                                            }}
                                          />
                                        ))}
                                        {/* Round Table Core */}
                                        <div 
                                          className={`w-16 h-16 rounded-full border flex flex-col items-center justify-center p-1 shadow-2xl z-10 ${
                                            tableStatus === 'occupied' 
                                              ? 'border-red-500/50' 
                                              : 'border-blue-500/50'
                                          }`}
                                          style={{ 
                                            background: tableStatus === 'occupied' 
                                              ? 'linear-gradient(135deg, #3d1414 0%, #280b0b 50%, #150505 100%)'
                                              : 'linear-gradient(135deg, #10243d 0%, #0a1728 50%, #050d18 100%)'
                                          }}
                                        >
                                          <span className="font-mono font-black text-xs text-white leading-none">{section.number}</span>
                                          <span className={`text-[7px] font-black uppercase tracking-tighter mt-1 ${statusColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* 3. RECTANGLE 6-SEATER */}
                                    {shape === 'rectangle' && (
                                      <div className="relative flex flex-col items-center">
                                        {/* Top Chairs (3) */}
                                        <div className="flex items-center gap-2 -mb-1 z-0">
                                          <div className="w-3 h-2 bg-[#2c1d12] border border-[#523620] rounded-t-sm shadow-md" />
                                          <div className="w-3 h-2 bg-[#2c1d12] border border-[#523620] rounded-t-sm shadow-md" />
                                          <div className="w-3 h-2 bg-[#2c1d12] border border-[#523620] rounded-t-sm shadow-md" />
                                        </div>
                                        {/* Rectangle Core */}
                                        <div 
                                          className="w-22 h-14 rounded-xl border border-purple-500/40 flex flex-col items-center justify-center p-1 shadow-2xl"
                                          style={{ background: 'linear-gradient(135deg, #2b143d 0%, #1c0a28 50%, #0e0515 100%)' }}
                                        >
                                          <span className="font-mono font-black text-xs text-white leading-none">{section.number}</span>
                                          <span className={`text-[7.5px] font-black uppercase tracking-tighter mt-1 ${statusColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        {/* Bottom Chairs (3) */}
                                        <div className="flex items-center gap-2 -mt-1 z-0">
                                          <div className="w-3 h-2 bg-[#2c1d12] border border-[#523620] rounded-b-sm shadow-md" />
                                          <div className="w-3 h-2 bg-[#2c1d12] border border-[#523620] rounded-b-sm shadow-md" />
                                          <div className="w-3 h-2 bg-[#2c1d12] border border-[#523620] rounded-b-sm shadow-md" />
                                        </div>
                                      </div>
                                    )}

                                    {/* 4. BOOTH 4-SEATER (High Back Sofa Cushions) */}
                                    {shape === 'booth' && (
                                      <div className="relative flex flex-col items-center">
                                        {/* Top Leather Sofa Back */}
                                        <div className="w-18 h-3.5 bg-[#42220f] border border-[#783e1b] rounded-t-lg shadow-md -mb-1 z-0 flex items-center justify-around px-1">
                                          <div className="w-3 h-1 bg-[#291408] rounded-full" />
                                          <div className="w-3 h-1 bg-[#291408] rounded-full" />
                                        </div>
                                        {/* Center Wood Table */}
                                        <div 
                                          className="w-18 h-12 rounded-lg border border-amber-600/40 flex flex-col items-center justify-center p-1 shadow-2xl"
                                          style={{ background: 'linear-gradient(135deg, #3d2614 0%, #29180b 50%, #150b04 100%)' }}
                                        >
                                          <span className="font-mono font-black text-xs text-white leading-none">{section.number}</span>
                                          <span className={`text-[7.5px] font-black uppercase tracking-tighter mt-0.5 ${statusColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        {/* Bottom Leather Sofa Back */}
                                        <div className="w-18 h-3.5 bg-[#42220f] border border-[#783e1b] rounded-b-lg shadow-md -mt-1 z-0 flex items-center justify-around px-1">
                                          <div className="w-3 h-1 bg-[#291408] rounded-full" />
                                          <div className="w-3 h-1 bg-[#291408] rounded-full" />
                                        </div>
                                      </div>
                                    )}

                                    {/* 5. BAR STOOL / HIGH TOP 2-SEATER */}
                                    {shape === 'bar_stool' && (
                                      <div className="relative flex items-center justify-center">
                                        {/* Left Bar Stool */}
                                        <div className="w-3 h-3 rounded-full bg-[#3d1a29] border border-pink-500/40 shadow -mr-1 z-0" />
                                        {/* Center High Round Table */}
                                        <div 
                                          className="w-14 h-14 rounded-full border border-pink-500/50 flex flex-col items-center justify-center p-1 shadow-2xl z-10"
                                          style={{ background: 'linear-gradient(135deg, #3b1025 0%, #260917 50%, #14040c 100%)' }}
                                        >
                                          <span className="font-mono font-black text-xs text-white leading-none">{section.number}</span>
                                          <span className={`text-[7px] font-black uppercase tracking-tighter mt-0.5 ${statusColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        {/* Right Bar Stool */}
                                        <div className="w-3 h-3 rounded-full bg-[#3d1a29] border border-pink-500/40 shadow -ml-1 z-0" />
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            });
                          })()}
                        </div>

                        {/* Floor Canvas Bottom Status Legend Bar */}
                        <div className="relative z-20 mx-4 mb-3 p-3 bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                          <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-wider text-neutral-300">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Available</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" /> Occupied</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Reserved</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> Cleaning</span>
                          </div>
                          <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-tight flex items-center gap-1.5">
                            Buruta & achia (drag & drop) meza, milango au mimea popote <Info className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* Right Hand: Table Inspector Panel */}
                      <div className="bg-neutral-900/95 border border-neutral-800 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-2xl">
                        {(() => {
                          const activeTable = selectedSection || sections.find(s => s.number === '21') || sections[0] || {
                            id: 'tbl-21',
                            number: '21',
                            capacity: 6,
                            shape: 'round',
                            status: 'occupied',
                            section: 'Indoor'
                          };

                          const isSectionInfra = ['entrance', 'reception', 'kitchen_window', 'bar_counter', 'restroom', 'indoor_plant', 'structure_divider'].includes(activeTable.shape);

                          return (
                            <div className="flex flex-col justify-between h-full w-full space-y-5">
                              <div className="space-y-4">
                                {/* Header with Table Graphic Preview */}
                                <div className="flex items-center gap-4">
                                  {/* 3D CAD Preview of Table */}
                                  <div className="relative w-14 h-14 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center shadow-inner flex-shrink-0">
                                    {/* Mini Radial Chairs preview */}
                                    {[0, 60, 120, 180, 240, 300].map((deg) => (
                                      <div
                                        key={`cad-chair-${deg}`}
                                        className="absolute w-2 h-1.5 bg-[#42220f] border border-[#783e1b] rounded-full"
                                        style={{ transform: `rotate(${deg}deg) translate(0px, -22px)` }}
                                      />
                                    ))}
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-950 border border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)] flex items-center justify-center font-mono font-black text-[10px] text-white">
                                      {activeTable.number}
                                    </div>
                                  </div>

                                  <div>
                                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest block">
                                      KIHARIRI CHA MEZA (TABLE INSPECTOR)
                                    </span>
                                    <h3 className="text-xl font-black text-white italic uppercase tracking-tight">
                                      MEZA AU KIBANDA: {activeTable.number}
                                    </h3>
                                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                      {activeTable.shape ? `${activeTable.shape.toUpperCase()} TABLE (${activeTable.capacity || 6} SEATS)` : 'ROUND TABLE (6 SEATS)'}
                                    </p>
                                  </div>
                                </div>

                                {/* Table Label Input */}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                                    NAMBA / JINA LA MEZA (TABLE LABEL)
                                  </label>
                                  <Input 
                                    className="bg-neutral-950 border-neutral-800 h-11 rounded-xl text-white font-bold text-sm"
                                    value={activeTable.number || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateTableField(activeTable.id, 'number', val);
                                      setSelectedSection({...activeTable, number: val});
                                    }}
                                    placeholder="21"
                                  />
                                </div>

                                {/* Occupancy Status Selector */}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                                    HALI (OCCUPANCY STATUS)
                                  </label>
                                  <Select 
                                    value={activeTable.status || 'occupied'} 
                                    onValueChange={(val) => {
                                      updateTableStatus(activeTable.id, val);
                                      setSelectedSection({...activeTable, status: val});
                                    }}
                                  >
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 h-11 rounded-xl text-xs font-bold text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                                      <SelectItem value="available">🟢 Available (Meza Huru)</SelectItem>
                                      <SelectItem value="occupied">🔴 Occupied (Ameketi Mteja)</SelectItem>
                                      <SelectItem value="reserved">🟡 Reserved (Imewekewa Nafasi)</SelectItem>
                                      <SelectItem value="cleaning">🔵 Cleaning (Inasafishwa)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Active Orders Box */}
                                <div className="p-3.5 bg-neutral-950 border border-neutral-800/90 rounded-2xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-[#00E5A0] uppercase tracking-widest flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 bg-[#00E5A0] rounded-full animate-ping" />
                                      ODA ZINAZOENDELEA (1)
                                    </span>
                                  </div>

                                  <div className="p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-xl flex items-center justify-between text-xs">
                                    <div className="flex flex-col gap-0.5 text-left">
                                      <span className="font-mono font-black text-white text-[11px]">#ORD-2026-00541 • 12:35 PM</span>
                                      <span className="text-[10px] text-neutral-400 font-bold">Wateja: 4 • 4 Items</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="font-mono font-black text-orange-400 text-xs">TZS 64,000</span>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-6 px-2 text-[9px] font-black uppercase text-neutral-300 hover:text-white bg-neutral-800 rounded-lg"
                                        onClick={() => setActiveTab('orders')}
                                      >
                                        View Order
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Shape & Capacity */}
                                {!isSectionInfra && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">AINA YA MEZA</label>
                                      <Select 
                                        value={activeTable.shape || 'round'} 
                                        onValueChange={(val) => {
                                          updateTableField(activeTable.id, 'shape', val);
                                          setSelectedSection({...activeTable, shape: val});
                                        }}
                                      >
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 h-10 rounded-xl text-xs text-white font-bold">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                                          <SelectItem value="round">Round (6 Seats)</SelectItem>
                                          <SelectItem value="square">Square (4 Seats)</SelectItem>
                                          <SelectItem value="rectangle">Rectangle (6 Seats)</SelectItem>
                                          <SelectItem value="booth">Booth (4 Seats)</SelectItem>
                                          <SelectItem value="bar_stool">Bar (2 Seats)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">VITI (CAPACITY)</label>
                                      <Input 
                                        type="number" 
                                        className="bg-neutral-950 border-neutral-800 h-10 rounded-xl text-white font-mono font-bold"
                                        value={activeTable.capacity || 6}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 2;
                                          updateTableField(activeTable.id, 'capacity', val);
                                          setSelectedSection({...activeTable, capacity: val});
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Direction Pad Precision Adjustment */}
                                <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800/80 space-y-2">
                                  <div className="text-center">
                                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">SOGEZA KWA USAHIHI (%)</span>
                                    <p className="text-[9px] text-neutral-500 font-mono font-bold">X: {activeTable.x || 46}% | Y: {activeTable.y || 24}%</p>
                                  </div>
                                  
                                  <div className="flex flex-col items-center gap-1.5">
                                    <button 
                                      onClick={() => shiftTable(activeTable.id, 0, -4)} 
                                      className="w-9 h-8 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-lg flex items-center justify-center transition-all active:scale-90 text-xs"
                                    >
                                      ▲
                                    </button>
                                    
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={() => shiftTable(activeTable.id, -4, 0)} 
                                        className="w-9 h-8 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-lg flex items-center justify-center transition-all active:scale-90 text-xs"
                                      >
                                        ◀
                                      </button>
                                      
                                      <div className="w-7 h-7 rounded-full border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                                        <Move className="w-3.5 h-3.5 text-orange-500" />
                                      </div>

                                      <button 
                                        onClick={() => shiftTable(activeTable.id, 4, 0)} 
                                        className="w-9 h-8 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-lg flex items-center justify-center transition-all active:scale-90 text-xs"
                                      >
                                        ▶
                                      </button>
                                    </div>

                                    <button 
                                      onClick={() => shiftTable(activeTable.id, 0, 4)} 
                                      className="w-9 h-8 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-lg flex items-center justify-center transition-all active:scale-90 text-xs"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
                                <Button 
                                  onClick={() => {
                                    setTableNumber(activeTable.number);
                                    setActiveTab('pos');
                                    setOrderType('walk_in');
                                  }}
                                  className="w-full h-12 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black uppercase tracking-widest text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 cursor-pointer"
                                >
                                  <ShoppingCart className="w-4 h-4" /> FUNGUA RISITI / POKEA ODA
                                </Button>

                                <div className="flex gap-2 w-full">
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 h-11 bg-neutral-950 border-neutral-800 text-[10px] font-black uppercase text-white rounded-xl gap-2 hover:border-orange-500/50"
                                    onClick={() => {
                                      const tableNum = activeTable.number || '01';
                                      setSelectedSection(activeTable);
                                      setQrBuilderMode('table_stand');
                                      setPrintDetails((prev: any) => ({
                                        ...prev,
                                        isPrintMode: true,
                                        seatingLabel: 'TABLE',
                                        customSeating: activeTable.capacity ? `${activeTable.capacity} VITI` : '4 VITI',
                                        header: vendorProfile?.businessName || 'RESTAURANT',
                                        subHeader: `MEZA #${tableNum}`
                                      }));
                                      setQrOptions({ ...qrOptions, data: `${window.location.origin}/table/${vendorProfile?.id || ''}/${tableNum}` });
                                      setIsQrBuilderOpen(true);
                                    }}
                                  >
                                    <QrCode className="w-4 h-4" /> JENGA QR CODE
                                  </Button>
                                  <Button 
                                    className="bg-neutral-950 border border-neutral-800 hover:border-red-500/50 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 h-11 px-4 rounded-xl transition-all"
                                    onClick={async () => {
                                      if (confirm('Futa meza hii?')) {
                                        await handleDeleteSection(activeTable.id);
                                        setSelectedSection(null);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Bottom Status Summary Cards Grid (Exact matching Screenshot) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {/* Available */}
                      <div className="p-4 bg-[#0d1612] border border-emerald-900/60 rounded-3xl space-y-1.5 shadow-lg relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Available</span>
                          <span className="text-emerald-500/50 text-lg">🪑</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white font-mono">11</span>
                          <span className="text-xs font-bold text-emerald-400">30.6%</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold block">Meza Huru</span>
                      </div>

                      {/* Occupied */}
                      <div className="p-4 bg-[#1a0f0f] border border-red-900/60 rounded-3xl space-y-1.5 shadow-lg relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Occupied</span>
                          <span className="text-red-500/50 text-lg">👥</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white font-mono">21</span>
                          <span className="text-xs font-bold text-red-400">58.3%</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold block">Meza Occupied</span>
                      </div>

                      {/* Reserved */}
                      <div className="p-4 bg-[#1a140a] border border-amber-900/60 rounded-3xl space-y-1.5 shadow-lg relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Reserved</span>
                          <span className="text-amber-500/50 text-lg">⏰</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white font-mono">3</span>
                          <span className="text-xs font-bold text-amber-400">8.3%</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold block">Meza Reserved</span>
                      </div>

                      {/* Cleaning */}
                      <div className="p-4 bg-[#0d1520] border border-blue-900/60 rounded-3xl space-y-1.5 shadow-lg relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Cleaning</span>
                          <span className="text-blue-500/50 text-lg">🧹</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white font-mono">1</span>
                          <span className="text-xs font-bold text-blue-400">2.8%</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold block">Meza Inasafishwa</span>
                      </div>

                      {/* Total Tables */}
                      <div className="p-4 bg-[#111317] border border-neutral-800 rounded-3xl space-y-1.5 shadow-lg col-span-2 sm:col-span-1 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Tables</span>
                          <span className="text-neutral-500 text-lg">🍽️</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white font-mono">36</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold block">Meza Zote</span>
                      </div>
                    </div>
                  </div>
                ) : tableSubTab === 'analytics' ? (
                  /* TABLE TRAFFIC ANALYTICS VIEW */
                  (() => {
                    const walkInOrders = orders.filter(o => o.tableNumber);
                    
                    // Calculate revenue per table
                    const revenuePerTable: Record<string, number> = {};
                    const freqPerTable: Record<string, number> = {};
                    const busiestTimePerTable: Record<string, {morning: number, afternoon: number, evening: number}> = {};
                    
                    sections.forEach(s => {
                      if (!['entrance', 'reception', 'kitchen_window', 'bar_counter', 'restroom', 'indoor_plant', 'structure_divider'].includes(s.shape)) {
                        revenuePerTable[s.number] = 0;
                        freqPerTable[s.number] = 0;
                        busiestTimePerTable[s.number] = { morning: 0, afternoon: 0, evening: 0 };
                      }
                    });
                    
                    walkInOrders.forEach(o => {
                      const tNo = o.tableNumber;
                      if (tNo) {
                        revenuePerTable[tNo] = (revenuePerTable[tNo] || 0) + (o.totalAmount || 0);
                        freqPerTable[tNo] = (freqPerTable[tNo] || 0) + 1;
                        
                        const ts = o.createdAt;
                        if (ts) {
                          const date = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1050) : new Date(ts));
                          const h = date.getHours();
                          if (!busiestTimePerTable[tNo]) {
                            busiestTimePerTable[tNo] = { morning: 0, afternoon: 0, evening: 0 };
                          }
                          if (h >= 5 && h < 12) busiestTimePerTable[tNo].morning++;
                          else if (h >= 12 && h < 17) busiestTimePerTable[tNo].afternoon++;
                          else busiestTimePerTable[tNo].evening++;
                        }
                      }
                    });
                    
                    // Find most popular table
                    const sortedTablesByFreq = Object.entries(freqPerTable).sort((a,b) => b[1] - a[1]);
                    const mostPopularTable = sortedTablesByFreq[0] ? `Meza ${sortedTablesByFreq[0][0]} (${sortedTablesByFreq[0][1]} oda)` : 'Hakuna data';
                    
                    // Find highest earning table
                    const sortedTablesByRevenue = Object.entries(revenuePerTable).sort((a,b) => b[1] - a[1]);
                    const highestEarningTable = sortedTablesByRevenue[0] ? `Meza ${sortedTablesByRevenue[0][0]} (TZS ${sortedTablesByRevenue[0][1].toLocaleString()})` : 'Hakuna data';
                    
                    // Total walk-in table traffic
                    const totalTableRevenue = Object.values(revenuePerTable).reduce((a,b) => a+b, 0);
                    
                    return (
                      <div className="space-y-8 select-none">
                        {/* Traffic KPI Summary Bento Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">MAPATO YOTE YA MEZA</span>
                            <h3 className="text-2xl font-black italic text-orange-500 tracking-tighter mt-1">TZS {totalTableRevenue.toLocaleString()}</h3>
                            <p className="text-[8.5px] text-neutral-500 font-bold mt-2 uppercase">Kutokana na walk-in QR dining</p>
                          </div>
                          
                          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">MEZA INAYOPENDWA ZAIDI</span>
                            <h3 className="text-lg font-black uppercase text-white tracking-tight mt-1.5 truncate">{mostPopularTable}</h3>
                            <p className="text-[8.5px] text-[#00E5A0] font-bold mt-2 uppercase">✓ Kituo chenye wateja wengi zaidi</p>
                          </div>

                          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">MEZA INAYOINGIZA MKWANJA</span>
                            <h3 className="text-lg font-black uppercase text-white tracking-tight mt-1.5 truncate">{highestEarningTable}</h3>
                            <p className="text-[8.5px] text-[#00E5A0] font-bold mt-2 uppercase">★ Mapato ya juu kabisa (Top Earner)</p>
                          </div>

                          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
                            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">JUMLA YA ODA ZA MEZA</span>
                            <h3 className="text-2xl font-black italic text-[#00E5A0] tracking-tighter mt-1">{walkInOrders.length} Oda</h3>
                            <p className="text-[8.5px] text-neutral-500 font-bold mt-2 uppercase">Historical check-ins verified</p>
                          </div>
                        </div>

                        {/* Detailed Table Performance Analytics Spreadsheet Report */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                            <div>
                              <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Orodha na Mchanganuo wa Meza zote</h3>
                              <p className="text-xs text-neutral-500 font-bold">Kila meza inayoingiza oda inapokea takwimu hizi kwa kila sekunde.</p>
                            </div>
                            <span className="px-3 py-1 bg-[#00E5A0]/10 border border-[#00E5A0]/20 text-[#00E5A0] text-[9px] font-black rounded-full uppercase tracking-widest">LIVE REPORT</span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-neutral-800 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                                  <th className="py-4">Namba ya Meza</th>
                                  <th className="py-4">Viti (Capacity)</th>
                                  <th className="py-4">Jumla ya Oda</th>
                                  <th className="py-4">Muda wa Trafiki Kuu (Peak Time)</th>
                                  <th className="py-4 text-right">Jumla ya Mapato</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-800">
                                {sections.filter(s => !['entrance', 'reception', 'kitchen_window', 'bar_counter', 'restroom', 'indoor_plant', 'structure_divider'].includes(s.shape)).map((section) => {
                                  const tableNum = section.number;
                                  const rev = revenuePerTable[tableNum] || 0;
                                  const freq = freqPerTable[tableNum] || 0;
                                  
                                  const hours = busiestTimePerTable[tableNum] || { morning: 0, afternoon: 0, evening: 0 };
                                  let peakLabel = 'N/A';
                                  if (freq > 0) {
                                    const mx = Math.max(hours.morning, hours.afternoon, hours.evening);
                                    if (mx === hours.morning) peakLabel = '☀️ Asubuhi (07:00 - 11:00)';
                                    else if (mx === hours.afternoon) peakLabel = '🌤️ Mchana (12:00 - 16:00)';
                                    else peakLabel = '🌙 Jioni/Usiku (18:00 - 22:00)';
                                  }

                                  return (
                                    <tr key={`table-analytics-record-${section.id}`} className="hover:bg-white/5 transition-all text-xs font-bold text-neutral-300">
                                      <td className="py-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded bg-orange-600/10 text-orange-500 font-mono font-black border border-orange-500/20 flex items-center justify-center text-[10px]">{tableNum}</span>
                                        <span className="uppercase text-[11px] font-black">Meza {tableNum}</span>
                                      </td>
                                      <td className="py-4 text-neutral-400 font-mono">{section.capacity || 4} Viti</td>
                                      <td className="py-4 font-mono text-[#00E5A0]">{freq} check-ins</td>
                                      <td className="py-4 text-neutral-400">{peakLabel}</td>
                                      <td className="py-4 text-right font-mono text-white">TZS {rev.toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* LIST GRID VIEW (STANDARD) */
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
                                  const tableNum = section.number || '01';
                                  setSelectedSection(section);
                                  setQrBuilderMode('table_stand');
                                  setPrintDetails((prev: any) => ({
                                    ...prev,
                                    isPrintMode: true,
                                    seatingLabel: 'TABLE',
                                    customSeating: section.capacity ? `${section.capacity} VITI` : '4 VITI',
                                    header: vendorProfile?.businessName || 'RESTAURANT',
                                    subHeader: `MEZA #${tableNum}`
                                  }));
                                  setQrOptions({ ...qrOptions, data: `${window.location.origin}/table/${vendorProfile?.id || ''}/${tableNum}` });
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
                                  <SelectItem value="occupied font-bold text-red-500">! Occupied</SelectItem>
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
                                {section.allowSharing && (
                                  <Badge className="bg-orange-600/10 text-orange-600 border-none text-[8px] font-black italic">SHARING ON</Badge>
                                )}
                              </div>
                              {tableStatus === 'occupied' && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                  <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">LIVE ORDER</span>
                                </div>
                              )}
                            </div>
                            {(staffProfile?.role === 'waiter' || !staffProfile) && (
                              <Button 
                                className="w-full mt-4 h-12 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-orange-900/20 gap-2"
                                onClick={() => {
                                  setTableNumber(section.number);
                                  setActiveTab('pos');
                                  setOrderType('walk_in');
                                }}
                              >
                                <ShoppingCart className="w-4 h-4" /> Pokea Oda (Take Order)
                              </Button>
                            )}
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
                )}
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

            {activeTab === 'rest_inventory' && (
              <motion.div 
                key="rest_inventory"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pb-32"
              >
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Kitchen Inventory</h2>
                    <p className="text-neutral-500 font-medium italic">Dhibiti na kufuatilia stoki ya viambato vya chakula na vinywaji (Raw Materials)</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setIsEditingInv(null);
                      setNewInvItem({ 
                        sku: `KTR-${Math.floor(Math.random() * 900) + 100}`, 
                        name: '', 
                        category: 'Meat & Poultry', 
                        stock: 10, 
                        unit: 'kg', 
                        minLimit: 5, 
                        cost: 15000, 
                        supplier: '' 
                      });
                      setIsAddInvOpen(true);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-orange-950/40 text-white"
                  >
                    <Plus className="w-5 h-5 mr-3" /> Weka Bidhaa ya Stoki
                  </Button>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">ITEMS IN KITCHEN</h3>
                    <p className="text-3xl font-black text-white italic">{restInventory.length}</p>
                  </Card>
                  <Card className="bg-neutral-900/60 border-red-500/10 p-6 rounded-[2rem] border">
                    <h3 className="text-[10px] font-black uppercase text-red-500 mb-2">LOW STOCK ALERTS</h3>
                    <p className="text-3xl font-black text-red-500 italic">
                      {restInventory.filter(item => Number(item.stock || 0) <= Number(item.minLimit || 0)).length}
                    </p>
                  </Card>
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">INVENTORY VALUE</h3>
                    <p className="text-3xl font-black text-white italic">
                      TZS {restInventory.reduce((acc, item) => acc + (Number(item.stock || 0) * Number(item.cost || 0)), 0).toLocaleString()}
                    </p>
                  </Card>
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">ACTIVE SUPPLIERS</h3>
                    <p className="text-3xl font-black text-white italic">
                      {new Set(restInventory.map(i => i.supplier).filter(Boolean)).size || 1}
                    </p>
                  </Card>
                </div>

                {/* Filters & Table Card */}
                <Card className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex flex-1 gap-4 max-w-xl">
                      <Input 
                        placeholder="Tafuta stoki kwa jina au SKU..." 
                        value={invSearchQuery}
                        onChange={e => setInvSearchQuery(e.target.value)}
                        className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-white placeholder:text-neutral-500"
                      />
                      <Select value={invCatFilter} onValueChange={val => setInvCatFilter(val || 'all')}>
                        <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-white text-xs w-48">
                          <SelectValue placeholder="Chuja kundi" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                          <SelectItem value="all">Makundi Yote</SelectItem>
                          <SelectItem value="Meat & Poultry">Nyama na Kuku (Meat & Poultry)</SelectItem>
                          <SelectItem value="Vegetables & Fruits">Mboga na Matunda (Vegetables)</SelectItem>
                          <SelectItem value="Beverages">Vinywaji (Beverages)</SelectItem>
                          <SelectItem value="Grains & Flour">Nafaka na Unga (Grains & Flour)</SelectItem>
                          <SelectItem value="Dairy & Cheese">Maziwa na Jibini (Dairy)</SelectItem>
                          <SelectItem value="Spices & Oils">Viungo na Mafuta (Spices & Oils)</SelectItem>
                          <SelectItem value="Others">Zinginezo (Others)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[1.5rem] border border-neutral-800 bg-neutral-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500 uppercase tracking-widest font-black text-[9px] bg-neutral-900/40">
                          <th className="p-4">SKU</th>
                          <th className="p-4">Name</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Stock</th>
                          <th className="p-4">Unit</th>
                          <th className="p-4">Min Limit</th>
                          <th className="p-4">Price/Unit</th>
                          <th className="p-4">Supplier</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-white font-medium">
                        {restInventory
                          .filter(item => {
                            const searchMatch = (item.name || '').toLowerCase().includes(invSearchQuery.toLowerCase()) || (item.sku || '').toLowerCase().includes(invSearchQuery.toLowerCase());
                            const catMatch = invCatFilter === 'all' || item.category === invCatFilter;
                            return searchMatch && catMatch;
                          })
                          .map((item, idx) => {
                            const stockCount = Number(item.stock || 0);
                            const limitCount = Number(item.minLimit || 5);
                            const isLow = stockCount <= limitCount;
                            const isOut = stockCount === 0;
                            return (
                              <tr key={`inv-row-${item.id || idx}`} className="hover:bg-neutral-900/40 transition-all">
                                <td className="p-4 font-mono font-bold tracking-tight text-neutral-400">{item.sku}</td>
                                <td className="p-4 font-bold">{item.name}</td>
                                <td className="p-4 text-neutral-400">{item.category}</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-black ${isOut ? 'text-red-500' : isLow ? 'text-yellow-500' : 'text-green-500'}`}>{stockCount}</span>
                                    <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${isOut ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (stockCount / (limitCount * 3 || 15)) * 100)}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 text-neutral-400">{item.unit}</td>
                                <td className="p-4 text-neutral-400">{item.minLimit}</td>
                                <td className="p-4">TZS {Number(item.cost || 0).toLocaleString()}</td>
                                <td className="p-4 text-neutral-400">{item.supplier || '-'}</td>
                                <td className="p-4">
                                  {isOut ? (
                                    <Badge className="bg-red-500/10 text-red-500 border-none rounded-full px-2_py-0.5 font-bold uppercase tracking-widest text-[8px]">Mwisho</Badge>
                                  ) : isLow ? (
                                    <Badge className="bg-yellow-500/10 text-yellow-500 border-none rounded-full px-2_py-0.5 font-bold uppercase tracking-widest text-[8px]">Chini</Badge>
                                  ) : (
                                    <Badge className="bg-green-500/10 text-green-500 border-none rounded-full px-2_py-0.5 font-bold uppercase tracking-widest text-[8px]">Inapatikana</Badge>
                                  )}
                                </td>
                                <td className="p-4 flex gap-2 justify-center">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg bg-neutral-900 text-neutral-450 hover:text-white border border-neutral-800"
                                    onClick={() => {
                                      setIsEditingInv(item);
                                      setNewInvItem({ ...item });
                                      setIsAddInvOpen(true);
                                    }}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                                    onClick={async () => {
                                      if (confirm('Futa bidhaa hii kwenye stoki?')) {
                                        if (vendorProfile?.id) {
                                          await deleteDoc(doc(db, 'vendors', vendorProfile.id, 'restaurant_inventory', item.id));
                                          toast.success('Bidhaa imefutwa!');
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}

                        {restInventory.length === 0 && (
                          <tr>
                            <td colSpan={10} className="p-12 text-center text-neutral-500 font-bold uppercase tracking-wider">
                              Hakuna stoki iliyopo sasa jikoni. Bonyeza "Weka Bidhaa ya Stoki" kuanza!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'rest_expenses' && (
              <motion.div 
                key="rest_expenses"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pb-32"
              >
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Expenses Tracker (Matumizi)</h2>
                    <p className="text-neutral-500 font-medium italic">Fuatilia na kudhibiti gharama zote za ununuzi wa bidhaa na malipo mengineyo (Expenses)</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setIsEditingExp(null);
                      setNewExp({ 
                        date: new Date().toISOString().split('T')[0], 
                        description: '', 
                        category: 'Raw Materials', 
                        amount: 0, 
                        paidBy: 'Cash', 
                        reference: '' 
                      });
                      setIsAddExpOpen(true);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-orange-950/40 text-white"
                  >
                    <Plus className="w-5 h-5 mr-3" /> Weka Matumizi Mapya
                  </Button>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">TOTAL EXPENSES</h3>
                    <p className="text-3xl font-black text-white italic">
                      TZS {restExpenses.reduce((acc, item) => acc + Number(item.amount || 0), 0).toLocaleString()}
                    </p>
                  </Card>
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">RAW FOOD MATERIALS</h3>
                    <p className="text-3xl font-black text-white italic text-orange-500">
                      TZS {restExpenses.filter(i => i.category === 'Raw Materials').reduce((acc, item) => acc + Number(item.amount || 0), 0).toLocaleString()}
                    </p>
                  </Card>
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">SALARY & STAFF</h3>
                    <p className="text-3xl font-black text-white italic">
                      TZS {restExpenses.filter(i => i.category === 'Salary & Wages').reduce((acc, item) => acc + Number(item.amount || 0), 0).toLocaleString()}
                    </p>
                  </Card>
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">UTILITIES & RENT</h3>
                    <p className="text-3xl font-black text-white italic">
                      TZS {restExpenses.filter(i => i.category === 'Utilities' || i.category === 'Rent').reduce((acc, item) => acc + Number(item.amount || 0), 0).toLocaleString()}
                    </p>
                  </Card>
                </div>

                {/* Filters & Expenses List */}
                <Card className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex flex-1 gap-4 max-w-xl">
                      <Input 
                        placeholder="Tafuta matumizi kwa maelezo au marejeo..." 
                        value={expSearchQuery}
                        onChange={e => setExpSearchQuery(e.target.value)}
                        className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-white placeholder:text-neutral-500"
                      />
                      <Select value={expCatFilter} onValueChange={val => setExpCatFilter(val || 'all')}>
                        <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-white text-xs w-48">
                          <SelectValue placeholder="Kundi la Matumizi" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                          <SelectItem value="all">Makundi Yote</SelectItem>
                          <SelectItem value="Raw Materials">Raw Materials (Ununuzi viungo)</SelectItem>
                          <SelectItem value="Salary & Wages">Salary & Wages (Mishahara)</SelectItem>
                          <SelectItem value="Utilities">Utilities (Bili, Umeme, Maji)</SelectItem>
                          <SelectItem value="Rent">Rent (Kodi ya Pishi/Eneo)</SelectItem>
                          <SelectItem value="Marketing">Marketing (Promosheni)</SelectItem>
                          <SelectItem value="Miscellaneous">Miscellaneous (Gharama Ndogondogo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[1.5rem] border border-neutral-800 bg-neutral-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500 uppercase tracking-widest font-black text-[9px] bg-neutral-900/40">
                          <th className="p-4">Date</th>
                          <th className="p-4">Description</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Paid By</th>
                          <th className="p-4">Reference No</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-white font-medium">
                        {restExpenses
                          .filter(item => {
                            const searchMatch = (item.description || '').toLowerCase().includes(expSearchQuery.toLowerCase()) || (item.reference || '').toLowerCase().includes(expSearchQuery.toLowerCase());
                            const catMatch = expCatFilter === 'all' || item.category === expCatFilter;
                            return searchMatch && catMatch;
                          })
                          .map((item, idx) => (
                            <tr key={`exp-row-${item.id || idx}`} className="hover:bg-neutral-900/40 transition-all">
                              <td className="p-4 font-mono text-neutral-400">{item.date}</td>
                              <td className="p-4 font-bold">{item.description}</td>
                              <td className="p-4">
                                <span className="bg-neutral-800 py-1 px-2.5 rounded-lg text-neutral-400 font-bold tracking-tight uppercase text-[9px]">
                                  {item.category}
                                </span>
                              </td>
                              <td className="p-4 font-black text-red-400">TZS {Number(item.amount || 0).toLocaleString()}</td>
                              <td className="p-4 text-neutral-400">{item.paidBy}</td>
                              <td className="p-4 font-mono text-neutral-400">{item.reference || '-'}</td>
                              <td className="p-4 flex gap-2 justify-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg bg-neutral-900 text-neutral-405 hover:text-white border border-neutral-800"
                                  onClick={() => {
                                    setIsEditingExp(item);
                                    setNewExp({ ...item });
                                    setIsAddExpOpen(true);
                                  }}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                                  onClick={async () => {
                                    if (confirm('Futa kumbukumbu hii ya matumizi?')) {
                                      if (vendorProfile?.id) {
                                        await deleteDoc(doc(db, 'vendors', vendorProfile.id, 'restaurant_expenses', item.id));
                                        toast.success('Matumizi yamefutwa!');
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}

                        {restExpenses.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-neutral-500 font-bold uppercase tracking-wider">
                              Hakuna matumizi yaliyosajiliwa kipindi hiki. Bonyeza "Weka Matumizi Mapya" kuanza!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'rest_reports' && (
              <motion.div 
                key="rest_reports"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pb-32"
              >
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Financial Reports (Ripoti)</h2>
                    <p className="text-neutral-500 font-medium italic">Strategic business summaries comparing revenues, orders, and operating expenses</p>
                  </div>

                  {/* Date Filter Controls */}
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 p-2 rounded-2xl">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-neutral-500 uppercase px-1">START</span>
                      <input 
                        type="date" 
                        value={repStartDate} 
                        onChange={e => setRepStartDate(e.target.value)}
                        className="bg-transparent text-white border-none text-[10px] uppercase font-black px-1 focus:ring-0" 
                      />
                    </div>
                    <div className="w-px h-6 bg-neutral-800" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-neutral-500 uppercase px-1">END</span>
                      <input 
                        type="date" 
                        value={repEndDate} 
                        onChange={e => setRepEndDate(e.target.value)}
                        className="bg-transparent text-white border-none text-[10px] uppercase font-black px-1 focus:ring-0" 
                      />
                    </div>
                  </div>
                </div>

                {/* Financial Summary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem] relative overflow-hidden">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-orange-500" /> PERIOD REVENUE
                    </h3>
                    <p className="text-3xl font-black text-emerald-500 italic">
                      TZS {reportsData.totalRevenue.toLocaleString()}
                    </p>
                    <span className="text-[8px] text-neutral-500 uppercase font-black">Gross Sales processed from POS in selected period</span>
                  </Card>
                  
                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-red-500" /> PERIOD EXPENSES
                    </h3>
                    <p className="text-3xl font-black text-red-400 italic">
                      TZS {reportsData.totalExpenses.toLocaleString()}
                    </p>
                    <span className="text-[8px] text-neutral-500 uppercase font-black font-semibold">Total registered raw materials, utility costs, etc.</span>
                  </Card>

                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem] border-emerald-500/10 border relative overflow-hidden">
                    <h3 className="text-[10px] font-black uppercase text-emerald-500 mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> NET PROFIT (FAIDA)
                    </h3>
                    <p className={`text-3xl font-black italic ${reportsData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                      TZS {reportsData.netProfit.toLocaleString()}
                    </p>
                    <span className="text-[8px] text-neutral-400 uppercase font-black">Profit Margins: {reportsData.totalRevenue ? Math.round((reportsData.netProfit / reportsData.totalRevenue) * 100) : 0}%</span>
                  </Card>

                  <Card className="bg-neutral-900/60 border-neutral-800 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black uppercase text-neutral-400 mb-2">COMPLETED SALES</h3>
                    <p className="text-3xl font-black text-white italic">
                      {reportsData.ordersCount} Orders
                    </p>
                    <span className="text-[8px] text-neutral-500 uppercase font-neutral">Total successful checkouts in database</span>
                  </Card>
                </div>

                {/* Grid Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Revenue vs Expenses Trend Analysis */}
                  <Card className="lg:col-span-2 bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Revenue vs Expense Trend</h3>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Monthly cost analysis comparisons</p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportsData.expenseVsRevenueData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                          <XAxis dataKey="month" stroke="#525252" fontSize={10} tickLine={false} />
                          <YAxis stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f0f11', borderColor: '#262626', borderRadius: '12px' }} 
                            labelClassName="text-white font-bold text-xs"
                          />
                          <Bar dataKey="revenue" name="Sales TZS" fill="#10b981" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="expenses" name="Expenses TZS" fill="#ef4444" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Payment Methods Utilization Pie Chart */}
                  <Card className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Payment Split</h3>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Aina ya Malipo inayopendwa na wateja</p>
                    </div>

                    <div className="h-60 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="105%">
                        <PieChart>
                          <Pie
                            data={reportsData.payData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {reportsData.payData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f0f11', borderColor: '#262626', borderRadius: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-neutral-500 uppercase">Miamala</span>
                        <span className="text-2xl font-black text-white italic">{reportsData.ordersCount}</span>
                      </div>
                    </div>

                    {/* Legend Split */}
                    <div className="space-y-2">
                      {reportsData.payData.map((item, index) => (
                        <div key={`legend-pay-${index}`} className="flex justify-between items-center text-xs">
                          <span className="flex items-center gap-2 text-neutral-400">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                          <span className="font-bold text-white font-mono">{item.value} times</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Category Performance Sales Distribution (BarChart) */}
                  <Card className="lg:col-span-3 bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Food Category Sales Distribution</h3>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Bora kulingana na muuzano kwenye POS</p>
                    </div>

                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportsData.categoryPerformanceData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                          <XAxis dataKey="name" stroke="#525252" fontSize={10} tickLine={false} />
                          <YAxis stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f0f11', borderColor: '#262626', borderRadius: '12px' }}
                            itemStyle={{ color: '#f97316' }}
                          />
                          <Bar dataKey="value" name="sales TZS" fill="#f97316" radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
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
                    <Printer className="w-4 h-4" /> Export CSV
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
                  {(!staffProfile || staffProfile.role === 'manager') && (
                    <Button 
                      onClick={() => setIsAddStaffOpen(true)}
                      className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-orange-950/40 text-white"
                    >
                      <UserPlus className="w-5 h-5 mr-3" /> Add Team Member
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {staff.map((member, idx) => (
                    <motion.div 
                      key={`staff-card-${member.id || idx}`}
                      whileHover={{ scale: 1.02 }}
                      className="bg-neutral-900 border border-neutral-800 rounded-[3rem] p-8 relative group overflow-hidden"
                    >
                      {(!staffProfile || staffProfile.role === 'manager') && (
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => deleteStaff(member.id)}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                      )}

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
                         <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-neutral-600">Password</span>
                               <div className="flex items-center gap-2">
                                  {editingStaffId === member.id ? (
                                     <div className="flex items-center gap-1">
                                        <input 
                                           type="text" 
                                           className="bg-neutral-900 border border-orange-600/30 rounded px-2 py-0.5 w-20 text-[8px] focus:ring-1 focus:ring-orange-600 outline-none uppercase italic"
                                           value={newStaffPassword}
                                           onChange={(e) => setNewStaffPassword(e.target.value)}
                                           placeholder="NEW PASS"
                                           autoFocus
                                        />
                                        <button 
                                           onClick={async () => {
                                              if (!newStaffPassword) return setEditingStaffId(null);
                                              await updateDoc(doc(db, 'staff', member.id), { password: newStaffPassword });
                                              toast.success('Password updated');
                                              setEditingStaffId(null);
                                              setNewStaffPassword('');
                                           }}
                                           className="bg-orange-600 p-1 rounded hover:bg-orange-700"
                                        >
                                           <Check className="w-3 h-3 text-white" />
                                        </button>
                                     </div>
                                  ) : (
                                     <div className="flex items-center gap-2">
                                        <span className="text-neutral-400 font-mono tracking-wider">{member.password || '••••••'}</span>
                                        <button onClick={() => {
                                           setEditingStaffId(member.id);
                                           setNewStaffPassword(member.password || '');
                                        }} className="text-orange-600 hover:text-orange-500 transition-colors">
                                           <Key className="w-3 h-3" />
                                        </button>
                                     </div>
                                  )}
                               </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-2 border-t border-white/5">
                               <span className="text-neutral-600">Share Login</span>
                               <a 
                                  href={`https://wa.me/${member.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Habari ${member.name}, Password yako mpya ya login ni: ${member.password || 'Tafadhali muulize admin'}. Unaweza kulogin hapa: ${window.location.origin}/staff/login`)}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                               >
                                  <Button variant="ghost" size="sm" className="h-6 px-3 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest">
                                     <MessageCircle className="w-3 h-3 mr-1.5" /> WhatsApp
                                  </Button>
                               </a>
                            </div>

                            {member.salaryAmount ? (
                               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-2 border-t border-white/5">
                                  <span className="text-neutral-600">Rate / Mshahara</span>
                                  <span className="text-orange-500 font-extrabold">TZS {member.salaryAmount.toLocaleString()} / {member.salaryType === 'daily' ? 'siku' : member.salaryType === 'weekly' ? 'wiki' : 'mwezi'}</span>
                               </div>
                            ) : (
                               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-2 border-t border-white/5">
                                  <span className="text-neutral-600">Rate / Mshahara</span>
                                  <span className="text-neutral-500 font-bold italic">Bado haijawekwa</span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-white/5">
                               <Button 
                                  onClick={() => {
                                     setSelectedStaff({
                                        ...member,
                                        customPermissions: member.customPermissions || {
                                           canViewSales: false,
                                           canManageOrders: false,
                                           canManageMenu: false,
                                           canManagePOS: false,
                                           canManageTables: false,
                                           canManageInventory: false,
                                           canManageExpenses: false,
                                           canManageReports: false,
                                           canManageStaff: false,
                                        }
                                     });
                                     setStaffSalaryAmount(member.salaryAmount ? String(member.salaryAmount) : '');
                                     setStaffSalaryType(member.salaryType || 'monthly');
                                     setDetailStaffTab('info');
                                     setIsDetailStaffOpen(true);
                                  }}
                                  className="w-full bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white rounded-xl h-10 text-[9px] font-black uppercase tracking-widest transition-all animate-none"
                               >
                                  <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                                  Majukumu & Malipo
                               </Button>
                            </div>
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

            {activeTab === 'twilio_responder' && (
              <motion.div
                key="twilio_responder"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-7xl mx-auto space-y-6 px-1 sm:px-4 lg:px-6"
              >
                <TwilioResponderTab vendorId={vendorProfile?.id || 'papo-hapo-express'} vendorCategory={vendorProfile?.category || 'bus_ticket'} />
              </motion.div>
            )}

            {activeTab === 'map_qr_setup' && (
              <motion.div
                key="map_qr_setup"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-7xl mx-auto space-y-6 px-1 sm:px-4 lg:px-6"
              >
                <VendorMapQRSetup vendorProfile={vendorProfile} />
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
                        
                        {/* Hotel Status Management (Only for Hotels) */}
                        {vendorProfile?.category === 'hotel' && (
                          <div className="bg-orange-50/50 dark:bg-orange-950/20 p-8 rounded-3xl border-2 border-dashed border-orange-200 dark:border-orange-900/30 space-y-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-widest text-orange-600">Hotel Operational Status</h4>
                                <p className="text-[10px] text-neutral-500 font-medium">Badilisha hali ya upatikanaji wa vyumba.</p>
                              </div>
                              <Badge className={`${vendorProfile.hotelStatus === 'Available' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                                {vendorProfile.hotelStatus || 'Available'}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="space-y-2">
                                 <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Availability</label>
                                 <Select 
                                   value={updatedProfile.hotelStatus || 'Available'} 
                                   onValueChange={(val: any) => {
                                      setUpdatedProfile({ ...updatedProfile, hotelStatus: val as any });
                                   }}
                                 >
                                   <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-none font-bold">
                                      <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent>
                                      <SelectItem value="Available">🟢 Available (Upo Wazi)</SelectItem>
                                      <SelectItem value="Fully Booked">🔴 Fully Booked (Vyumba Vimejaa)</SelectItem>
                                      <SelectItem value="Maintenance">🟡 Under Maintenance (Maboresho)</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </div>

                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Total Rooms</label>
                                  <Input 
                                    type="number" 
                                    className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-none font-bold text-orange-600"
                                    value={updatedProfile.numberOfRooms}
                                    onChange={(e) => setUpdatedProfile({ ...updatedProfile, numberOfRooms: parseInt(e.target.value) || 0 })}
                                  />
                               </div>
                            </div>

                       <div className="space-y-4">
                               <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Room Pricing Adjustment (TZS)</label>
                               <div className="grid grid-cols-3 gap-4">
                                  {[
                                    { label: 'Single', key: 'single', value: vendorProfile.roomPricing?.single },
                                    { label: 'Double', key: 'double', value: vendorProfile.roomPricing?.double },
                                    { label: 'VIP', key: 'vip', value: vendorProfile.roomPricing?.vip },
                                  ].map(item => (
                                    <div key={item.key} className="space-y-2">
                                      <span className="text-[9px] font-bold text-neutral-500 uppercase">{item.label}</span>
                                      <Input 
                                        type="number" 
                                        className="h-12 rounded-xl bg-white dark:bg-neutral-900 border-none font-black"
                                        value={updatedProfile.roomPricing?.[item.key as keyof typeof updatedProfile.roomPricing] || 0}
                                        onChange={(e) => {
                                          const newPricing = { 
                                            ...(updatedProfile.roomPricing || { single: 0, double: 0, vip: 0 }), 
                                            [item.key]: parseInt(e.target.value) || 0 
                                          };
                                          setUpdatedProfile({ ...updatedProfile, roomPricing: newPricing });
                                        }}
                                      />
                                    </div>
                                  ))}
                               </div>
                            </div>

                            {/* Hotel Gallery Management */}
                            <div className="space-y-6 pt-6 border-t border-orange-100 dark:border-orange-900/20">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> Hotel Photo Gallery
                                  </h4>
                                  <p className="text-[10px] text-neutral-500 font-medium">Pakia picha za vyumba na mazingira ya hoteli.</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="rounded-xl border-orange-200 text-orange-600 gap-2 font-bold"
                                  onClick={() => toast.info('Click below to add photos!')}
                                >
                                  <Plus className="w-3 h-3" /> Add Photos
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                                {vendorProfile.galleryPhotos?.map((photo, idx) => (
                                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group">
                                    <img src={photo} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    <button 
                                      onClick={async () => {
                                        const newPhotos = vendorProfile.galleryPhotos?.filter((_, i) => i !== idx);
                                        await updateDoc(doc(db, 'vendors', vendorProfile.id!), { galleryPhotos: newPhotos });
                                        toast.success("Picha imeondolewa.");
                                      }}
                                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.multiple = true;
                                    input.accept = 'image/*';
                                    input.onchange = async (e: any) => {
                                      const files = e.target.files;
                                      if (files && files.length > 0 && vendorProfile.id) {
                                        const toastId = toast.loading('Tunapakia picha...');
                                        try {
                                          const uploadPromises = Array.from(files as FileList).map(file => {
                                            const path = storageService.getVendorPath(vendorProfile.id!, 'gallery', file.name);
                                            return storageService.uploadFile('vendors', path, file);
                                          });
                                          const urls = await Promise.all(uploadPromises);
                                          const currentPhotos = vendorProfile.galleryPhotos || [];
                                          await updateDoc(doc(db, 'vendors', vendorProfile.id!), { 
                                            galleryPhotos: [...currentPhotos, ...urls] 
                                          });
                                          toast.success("Picha zimepakiwa!", { id: toastId });
                                        } catch (err) {
                                          toast.error("Imeshindwa kupakia picha.", { id: toastId });
                                        }
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="aspect-square rounded-2xl border-4 border-dashed border-neutral-100 dark:border-neutral-800 flex flex-col items-center justify-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 transition-all text-neutral-400 hover:text-orange-600"
                                >
                                  <Plus className="w-6 h-6" />
                                  <span className="text-[10px] font-black uppercase">Add Photos</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

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
                                    src={updatedProfile.logoUrl || vendorProfile?.logoUrl || undefined} 
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
                                  src={updatedProfile.bannerUrl || vendorProfile?.bannerUrl || undefined} 
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

                    {/* CUSTOM TICKET APPEARANCE AND BRANDING & RULES SECTION */}
                    <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden p-8 space-y-6 transition-colors">
                      <div className="flex items-center gap-4 text-orange-600">
                        <Palette className="w-6 h-6" />
                        <div>
                          <h3 className="font-black text-xl text-neutral-900 dark:text-white transition-colors">Muonekano wa Tiketi za Abiria</h3>
                          <p className="text-[10px] text-neutral-500 font-medium">Buni na weka staili maalum ya rangi, nembo, na herufi za tiketi mteja anazopakua au kuchapa.</p>
                        </div>
                      </div>

                      {(() => {
                        const tc = updatedProfile.ticketConfig || {
                          bgPreset: 'classic-purple',
                          primaryColor: '#7c3aed',
                          secondaryColor: '#d946ef',
                          watermarkIcon: 'bus',
                          rulesText: '⚠️ HAKUNA KURUDISHA NAULI • MASHARTS YANAZINGATIWA • KUPITIA PAPO HAPO'
                        };

                        const setTC = (newTc: any) => {
                          setUpdatedProfile({
                            ...updatedProfile,
                            ticketConfig: { ...tc, ...newTc }
                          });
                        };

                        return (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Background Preset select */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Rangi & Mavazi ya Tiketi (Theme Preset)</label>
                                <select
                                  value={tc.bgPreset}
                                  onChange={e => setTC({ bgPreset: e.target.value })}
                                  className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-sm font-medium px-4 focus:ring-2 focus:ring-orange-500"
                                >
                                  <option value="classic-purple">Royal Purple (Classic)</option>
                                  <option value="midnight-ocean">Midnight Ocean (Sky Blue)</option>
                                  <option value="emerald-luxe">Emerald Luxe (Green/Teal)</option>
                                  <option value="sunset-glow">Sunset Glow (Orange/Yellow)</option>
                                  <option value="charcoal-gold">Charcoal Gold (Black/Amber)</option>
                                  <option value="royal-crimson">Royal Crimson (Red/Pink)</option>
                                  <option value="custom">Custom Hex (Customize Below)</option>
                                </select>
                              </div>

                              {/* Watermark Selector */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Alama ya Alama-maji (Watermark Logo)</label>
                                <select
                                  value={tc.watermarkIcon}
                                  onChange={e => setTC({ watermarkIcon: e.target.value })}
                                  className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-sm font-medium px-4 focus:ring-2 focus:ring-orange-500"
                                >
                                  <option value="bus">Bus Icon (🚌)</option>
                                  <option value="shield">Shield Verified (🛡️)</option>
                                  <option value="ticket">Ticket Stub (🎟️)</option>
                                  <option value="star">Star Banner (⭐)</option>
                                  <option value="globe">Globe Navigation (🌐)</option>
                                  <option value="none">Empty / Bila Alama</option>
                                </select>
                              </div>
                            </div>

                            {/* Color customization if bgPreset === 'custom' */}
                            {tc.bgPreset === 'custom' && (
                              <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-3xl border border-neutral-150 dark:border-neutral-800/40 space-y-4">
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Customize Hex Gradients</span>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-neutral-500 block">Rangi ya Kwanza (Primary Col)</label>
                                    <div className="flex gap-2">
                                      <input 
                                        type="color" 
                                        value={tc.primaryColor || '#7c3aed'} 
                                        onChange={e => setTC({ primaryColor: e.target.value })}
                                        className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={tc.primaryColor || '#7c3aed'} 
                                        onChange={e => setTC({ primaryColor: e.target.value })}
                                        className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 text-sm font-semibold h-10 uppercase font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-neutral-500 block">Rangi ya Pili (Secondary Col)</label>
                                    <div className="flex gap-2">
                                      <input 
                                        type="color" 
                                        value={tc.secondaryColor || '#d946ef'} 
                                        onChange={e => setTC({ secondaryColor: e.target.value })}
                                        className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                                      />
                                      <input 
                                        type="text" 
                                        value={tc.secondaryColor || '#d946ef'} 
                                        onChange={e => setTC({ secondaryColor: e.target.value })}
                                        className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 text-sm font-semibold h-10 uppercase font-mono"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Ticket Rules/T&C */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Masharti ya tiketi chini (Ticket Terms Footer)</label>
                              <Input
                                value={tc.rulesText}
                                onChange={e => setTC({ rulesText: e.target.value })}
                                className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-14 rounded-2xl text-sm font-medium"
                                placeholder="Mfano: ⚠️ HAKUNA KURUDISHA NAULI • MASHARTS YANAZINGATIWA"
                              />
                            </div>
                          </div>
                        );
                      })()}
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
                       
                       <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 space-y-2">
                          <div className="flex items-center gap-2 text-orange-600">
                            <HelpCircle className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Jinsi ya Kuitumia / Guide</span>
                          </div>
                          <ul className="text-[10px] text-neutral-600 dark:text-neutral-400 font-medium space-y-1 list-disc pl-4">
                            <li>Ukiongeza meza mpya, kagua sehemu ya <b>"Sharing / Multi-Booking"</b>.</li>
                            <li>Kwa meza kubwa, washa sharing ili wateja tofauti waweze kuagiza pamoja.</li>
                            <li>Kwenye <b>QR Stand Builder</b>, tumia <b>"Seating Label"</b> kuonyesha idadi ya viti (mfano: "Viti 10").</li>
                          </ul>
                       </div>
                       
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
                               <div className="flex items-center justify-between mb-1">
                                 <p className="text-[10px] font-black uppercase text-neutral-900 dark:text-white truncate transition-colors">{vendorContext.locationLabelSingular} {section.number}</p>
                                 {section.allowSharing && (
                                   <span className="text-[7px] bg-blue-600 text-white px-1 rounded font-black uppercase tracking-tighter">Shared</span>
                                 )}
                               </div>
                               <p className="text-[8px] text-neutral-500 font-bold uppercase transition-colors">Capacity: {section.capacity || 4}</p>
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 className="w-full mt-3 h-8 text-[9px] font-black uppercase hover:bg-orange-600 hover:text-white dark:text-neutral-400 group-hover:dark:text-white transition-colors"
                                 onClick={() => {
                                   setSelectedSection(section);
                                   setQrOptions({ ...qrOptions, data: `${window.location.origin}/table/${vendorProfile?.id || ''}/${section.number}` });
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">{vendorContext.inventoryLabel} Control</h2>
                    <p className="text-neutral-500 text-xs sm:text-sm font-medium">Manage your {vendorContext.inventoryLabel.toLowerCase()} and availability</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {vendorProfile?.category === 'hotel' && (
                      <Button 
                        onClick={() => setShowManualBooking(true)}
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl h-11 sm:h-12 px-4 sm:px-6 font-black uppercase tracking-widest text-[10px] text-orange-600 hover:bg-neutral-800"
                      >
                        <Calendar className="w-4 h-4 mr-1.5" /> Booking ya Reception
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="bg-neutral-900 border-neutral-800 rounded-2xl h-11 sm:h-12 px-4 sm:px-6 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-1.5" /> Bulk Export
                    </Button>
                    {(!staffProfile || staffProfile.role === 'manager') && (
                      <Button 
                        onClick={() => setIsAddProductOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-11 sm:h-12 px-4 sm:px-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/30 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> 
                        {vendorProfile?.category === 'hotel' ? 'Sajili Chumba' : 'Add New Item'}
                      </Button>
                    )}
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
                   <Select value={stockLevelFilter} onValueChange={(val) => setStockLevelFilter(val || 'all')}>
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

                {/* MOBILE VIEW: Product Cards (Fully Responsive for Phones) */}
                <div className="block md:hidden space-y-4">
                  {filteredInventory.map((product, idx) => {
                    const isBus = vendorProfile?.category === 'bus_ticket';
                    return (
                      <div 
                        key={`inventory-mobile-card-${product.id}-${idx}`}
                        className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-4 shadow-xl space-y-3.5 hover:border-neutral-700 transition-all"
                      >
                        {/* Top Section: Photo + Name + Price */}
                        <div className="flex items-start gap-3.5">
                          <div className="w-16 h-16 rounded-2xl bg-neutral-950 overflow-hidden relative border border-neutral-800 shrink-0">
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
                                {vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale' ? (
                                  <Car className="w-6 h-6 text-neutral-600" />
                                ) : (
                                  <Bus className="w-6 h-6 text-neutral-600" />
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-black text-white text-sm uppercase tracking-tight italic truncate">
                                {isBus 
                                  ? `${(product as any).origin || 'Dar'} → ${(product as any).destination || 'Arusha'}` 
                                  : (vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale')
                                    ? `${product.category} ${product.name}`
                                    : product.name
                                }
                              </h3>
                            </div>

                            <p className="font-black text-orange-500 text-sm mt-0.5">
                              TZS {product.price.toLocaleString()}
                            </p>

                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                              {isBus ? `Ondoka: ${(product as any).departureTime || '06:00 AM'}` : `SKU: ${product.id?.slice(0, 8).toUpperCase()}`}
                            </p>

                            {isBus && (product as any).branchId && branches.find(b => b.id === (product as any).branchId) && (
                              <p className="text-[9px] text-orange-600/80 font-black uppercase tracking-tight flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {branches.find(b => b.id === (product as any).branchId)?.name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Middle Section: Stock Status Bar & Toggle */}
                        <div className="bg-neutral-950/80 p-3 rounded-2xl border border-neutral-800/80 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                              <span className="text-neutral-400">Hali ya Stoo:</span>
                              <span className={product.stock < 10 ? 'text-red-500 font-black' : 'text-emerald-400 font-black'}>
                                {product.stock} {isBus ? 'Seats Left' : 'units'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  product.stock < 10 ? 'bg-red-500' : product.stock < 50 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (product.stock / (isBus ? (product as any).totalSeats || 50 : 200)) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {(!staffProfile || staffProfile.role === 'chef' || staffProfile.role === 'manager' || staffProfile.customPermissions?.canManageMenu) && (
                            <Button 
                              size="sm" 
                              variant={product.stock > 0 ? "outline" : "destructive"}
                              className="h-8 px-3 text-[10px] font-black uppercase rounded-xl border-2 shrink-0 cursor-pointer"
                              onClick={() => handleToggleStock(product)}
                            >
                              {product.stock > 0 ? "Imeisha?" : "Ipo Tena?"}
                            </Button>
                          )}
                        </div>

                        {/* Bottom Actions Row: Meta Ads + Edit + Delete */}
                        <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/60">
                          {(!staffProfile || staffProfile.role === 'manager') ? (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                title={product.metaMcpPromo ? "Sitisha utangazaji kwenye Meta MCP" : "Tangaza kwenye Meta MCP Hub & Catalog"}
                                className={`flex-1 h-9 px-2.5 rounded-xl font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  product.metaMcpPromo 
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/30' 
                                    : 'bg-neutral-950 text-neutral-300 hover:text-blue-400 hover:bg-neutral-800 border border-neutral-800'
                                }`} 
                                onClick={() => handleToggleMetaMcpPromo(product)}
                              >
                                <Zap className="w-3.5 h-3.5 text-blue-400" />
                                <span>{product.metaMcpPromo ? 'Meta Live' : 'Tangaza Meta'}</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer" 
                                onClick={() => handleEditProduct(product)}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-orange-400" />
                                <span>Hariri</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 bg-neutral-950/80 border border-neutral-800 hover:border-red-500/50 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-500/10 shrink-0 cursor-pointer" 
                                onClick={() => handleDeleteProduct(product.id!)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[9px] text-neutral-500 font-extrabold uppercase tracking-widest bg-neutral-800/50 px-3 py-1.5 rounded-xl">
                              View Only
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW: Table (Hidden on Mobile) */}
                <div className="hidden md:block bg-neutral-900/20 border border-neutral-800 rounded-[3rem] overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/50">
                        <th className="px-8 py-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Product Information</th>
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
                                       {vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale' ? (
                                         <Car className="w-8 h-8 text-neutral-800" />
                                       ) : (
                                         <Bus className="w-8 h-8 text-neutral-800" />
                                       )}
                                     </div>
                                   )}
                                </div>
                                <div>
                                   <p className="font-black text-white text-md uppercase tracking-tight italic flex items-center gap-2">
                                     {isBus 
                                       ? `${(product as any).origin || 'Dar'} → ${(product as any).destination || 'Arusha'}` 
                                       : (vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale')
                                         ? `${product.category} ${product.name}`
                                         : product.name
                                     }
                                     {(vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale') && (
                                       <span className="text-[10px] font-bold text-orange-500 normal-case bg-orange-500/10 px-2 py-0.5 rounded-full">
                                         {vendorProfile?.category === 'car_rental' ? 'Rental' : 'For Sale'}
                                       </span>
                                     )}
                                   </p>
                                   <div className="flex flex-col gap-1">
                                      {vendorProfile?.category === 'car_rental' ? (
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                          <span>Plate: {product.carNumber}</span>
                                          <span>•</span>
                                          <span>{product.transmission}</span>
                                          <span>•</span>
                                          <span>{product.fuel}</span>
                                          <span>•</span>
                                          <span>{product.seats} Seats</span>
                                        </p>
                                      ) : vendorProfile?.category === 'car_sale' ? (
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                          <span>Year: {product.year}</span>
                                          <span>•</span>
                                          <span>Mileage: {product.mileage?.toLocaleString()} km</span>
                                          <span>•</span>
                                          <span>{product.transmission}</span>
                                          <span>•</span>
                                          <span>{product.fuel}</span>
                                        </p>
                                      ) : (
                                        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">
                                          {isBus ? `Departure: ${(product as any).departureTime || '06:00 AM'}` : `SKU: ${product.id?.slice(0, 8).toUpperCase()}`}
                                        </p>
                                      )}
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
                            <td className="px-8 py-6 text-center">
                               <p className="font-black text-orange-500">TZS {product.price.toLocaleString()}</p>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex flex-col items-center gap-2">
                                  {(!staffProfile || staffProfile.role === 'chef' || staffProfile.role === 'manager' || staffProfile.customPermissions?.canManageMenu) && (
                                    <Button 
                                      size="sm" 
                                      variant={product.stock > 0 ? "outline" : "destructive"}
                                      className="h-8 text-[9px] font-black uppercase rounded-lg border-2 cursor-pointer"
                                      onClick={() => handleToggleStock(product)}
                                    >
                                      {product.stock > 0 ? "Imeisha?" : "Ipo Tena?"}
                                    </Button>
                                  )}
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
                                  {(!staffProfile || staffProfile.role === 'manager') ? (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        title={product.metaMcpPromo ? "Sitisha utangazaji kwenye Meta MCP" : "Tangaza kwenye Meta MCP Hub & Catalog"}
                                        className={`h-10 px-3 rounded-xl font-bold text-[10px] uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                                          product.metaMcpPromo 
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/30' 
                                            : 'bg-neutral-900 text-neutral-400 hover:text-blue-400 hover:bg-neutral-800 border border-neutral-800'
                                        }`} 
                                        onClick={() => handleToggleMetaMcpPromo(product)}
                                      >
                                        <Zap className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{product.metaMcpPromo ? 'Meta Live' : 'Tangaza Meta MCP'}</span>
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white cursor-pointer" onClick={() => handleEditProduct(product)}>
                                         <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-10 w-10 bg-neutral-950/50 rounded-xl text-neutral-600 hover:text-red-500 hover:bg-neutral-900 cursor-pointer" onClick={() => handleDeleteProduct(product.id!)}>
                                         <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="text-[9px] text-neutral-500 font-extrabold uppercase tracking-widest bg-neutral-800/50 px-3 py-1.5 rounded-xl">
                                      View Only
                                    </span>
                                  )}
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

      {/* Mobile More Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsMobileMenuOpen(false)}
               className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
            />
            <motion.div 
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="lg:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white dark:bg-neutral-950 z-[201] shadow-2xl p-8 overflow-y-auto flex flex-col rounded-t-[3rem] border-t border-neutral-200 dark:border-neutral-800 transition-colors duration-300"
            >
               <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto mb-8 flex-shrink-0" />
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
                      <LayoutGrid size={20} />
                    </div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-orange-600 dark:text-orange-500">Zaidi / More</h2>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                     <X size={20} className="text-neutral-500" />
                  </button>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  {tabs.slice(4).map((item) => (
                     <button
                        key={`mobile-more-${item.id}`}
                        onClick={() => {
                           setActiveTab(item.id as TabType);
                           setIsMobileMenuOpen(false);
                        }}
                        className={`flex flex-col items-center gap-3 p-6 rounded-3xl transition-all ${
                          activeTab === item.id 
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                            : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-500 border border-neutral-100 dark:border-neutral-800'
                        }`}
                     >
                        <item.icon className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                     </button>
                  ))}
                  <div className="col-span-2 grid grid-cols-1 gap-3 mt-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                    <button 
                      onClick={() => navigate('/profile')}
                      className="flex items-center gap-4 px-6 p-5 rounded-2xl text-sm font-black uppercase tracking-tight text-neutral-500 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 w-full"
                    >
                      <User size={20} className="text-neutral-400" />
                      <span>Account Settings</span>
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="flex items-center gap-4 px-6 p-5 rounded-2xl text-sm font-black uppercase tracking-tight text-red-500 bg-red-500/10 border border-red-500/10 w-full"
                    >
                      <LogOut size={20} />
                      <span>Sign Out</span>
                    </button>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation for Mobile */}
      <motion.nav 
        initial={{ y: 0 }}
        animate={{ y: isNavVisible ? 0 : 100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] h-[85px] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200/80 dark:border-neutral-800 transition-colors duration-300 shadow-[0_-10px_30px_rgba(0,0,0,0.06)] pb-2"
      >
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="h-full px-2 flex justify-around items-end max-w-md mx-auto relative"
        >
          {staffProfile?.role === 'waiter' ? (
            <>
              {/* Tables */}
              <button
                onClick={() => {
                  setActiveTab('tables');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center pb-2 flex-1 transition-all relative h-full group"
              >
                <div className={`transition-all duration-300 ${activeTab === 'tables' ? 'text-neutral-900 dark:text-orange-500 scale-110' : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600'}`}>
                  <TableCustomIcon size={25} />
                </div>
                {activeTab === 'tables' && (
                  <motion.div layoutId="activeDot" className="w-[5px] h-[5px] rounded-full bg-neutral-900 dark:bg-orange-500 mt-1" />
                )}
                <span className={`text-[10px] font-bold mt-1 tracking-wider ${activeTab === 'tables' ? 'text-neutral-900 dark:text-orange-500 font-extrabold' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  Tables
                </span>
              </button>

              {/* Orders */}
              <button
                onClick={() => {
                  setActiveTab('orders');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center pb-2 flex-1 transition-all relative h-full group"
              >
                <div className={`transition-all duration-300 ${activeTab === 'orders' ? 'text-neutral-900 dark:text-orange-500 scale-110' : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600'}`}>
                  <OrdersCustomIcon size={25} />
                </div>
                {activeTab === 'orders' && (
                  <motion.div layoutId="activeDot" className="w-[5px] h-[5px] rounded-full bg-neutral-900 dark:bg-orange-500 mt-1" />
                )}
                <span className={`text-[10px] font-bold mt-1 tracking-wider ${activeTab === 'orders' ? 'text-neutral-900 dark:text-orange-500 font-extrabold' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  Orders
                </span>
              </button>

              {/* Menu (Large Orange FAB) */}
              <div className="flex-1 flex flex-col items-center justify-center relative h-full pb-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setActiveTab('pos');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-500 flex items-center justify-center shadow-[0_6px_20px_rgba(253,176,34,0.4)] border-4 border-white dark:border-neutral-900 absolute -top-5 z-[101]"
                >
                  <MenuCustomIcon size={26} className="text-[#1e1103] dark:text-neutral-950 font-black" />
                </motion.button>
                <span className={`text-[10px] font-bold tracking-wider mb-1 z-[100] ${activeTab === 'pos' ? 'text-neutral-900 dark:text-orange-500 font-black' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  Menu
                </span>
              </div>

              {/* Alerts (Messages) */}
              <button
                onClick={() => {
                  setActiveTab('messages');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center pb-2 flex-1 transition-all relative h-full group"
              >
                <div className="relative">
                  <div className={`transition-all duration-300 ${activeTab === 'messages' ? 'text-neutral-900 dark:text-orange-500 scale-110' : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600'}`}>
                    <AlertsCustomIcon size={25} />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-[9px] h-[9px] bg-red-600 rounded-full border border-white dark:border-neutral-900" />
                </div>
                {activeTab === 'messages' && (
                  <motion.div layoutId="activeDot" className="w-[5px] h-[5px] rounded-full bg-neutral-900 dark:bg-orange-500 mt-1" />
                )}
                <span className={`text-[10px] font-bold mt-1 tracking-wider ${activeTab === 'messages' ? 'text-neutral-900 dark:text-orange-500 font-extrabold' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  Alerts
                </span>
              </button>

              {/* Profile */}
              <button
                onClick={() => {
                  navigate('/profile');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center pb-2 flex-1 transition-all relative h-full group"
              >
                <div className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600">
                  <ProfileCustomIcon size={25} />
                </div>
                <span className="text-[10px] font-bold mt-1 tracking-wider text-neutral-400 dark:text-neutral-500">
                  Profile
                </span>
              </button>
            </>
          ) : (
            <>
              {[
                { id: 'overview', label: 'Home', icon: BarChart3 },
                { id: 'orders', label: 'Orders', icon: ShoppingBag },
                { id: 'pos', label: 'POS', icon: Plus },
                { id: 'products', label: 'Store', icon: Store },
              ].map((item) => (
                <button
                  key={`mobile-nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id as TabType);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-all duration-300 ${
                    activeTab === item.id ? 'text-orange-600' : 'text-neutral-500'
                  }`}
                >
                  <div className={`p-2 rounded-2xl transition-all ${activeTab === item.id ? 'bg-orange-600/10' : ''}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-all ${isMobileMenuOpen ? 'text-orange-600' : 'text-neutral-400'}`}
              >
                <div className={`p-2 rounded-2xl transition-all ${isMobileMenuOpen ? 'bg-orange-600/10' : ''}`}>
                  <Menu className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">More</span>
              </button>
            </>
          )}
        </motion.div>
      </motion.nav>

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

      {/* Kitchen Inventory Modal */}
      <AnimatePresence>
        {isAddInvOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddInvOpen(false);
                setIsEditingInv(null);
              }}
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
                  <h3 className="text-xl font-bold">
                    {isEditingInv ? 'Hariri Bidhaa ya Stoki' : 'Sajili Bidhaa ya Stoki'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Jaza taarifa kupanga stoki mbalimbali za mapishi</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddInvOpen(false);
                    setIsEditingInv(null);
                  }} 
                  className="text-neutral-500 hover:text-white p-2"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Jina la Kitu (Item Name)</label>
                    <Input 
                      placeholder="e.g. Nyama ya Ng'ombe, Kitunguu, Majani ya Chai" 
                      value={newInvItem.name}
                      onChange={e => setNewInvItem({ ...newInvItem, name: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">SKU Code</label>
                    <Input 
                      placeholder="e.g. KTR-203" 
                      value={newInvItem.sku}
                      onChange={e => setNewInvItem({ ...newInvItem, sku: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Supplier</label>
                    <Input 
                      placeholder="e.g. Bakhresa Co." 
                      value={newInvItem.supplier || ''}
                      onChange={e => setNewInvItem({ ...newInvItem, supplier: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Kundi (Category)</label>
                    <Select 
                      value={newInvItem.category || 'Meat & Poultry'} 
                      onValueChange={val => setNewInvItem({ ...newInvItem, category: val || 'Meat & Poultry' })}
                    >
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-11 text-white rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                        <SelectItem value="Meat & Poultry">Nyama na Kuku</SelectItem>
                        <SelectItem value="Vegetables & Fruits">Mboga na Matunda</SelectItem>
                        <SelectItem value="Beverages">Vinywaji (Beverages)</SelectItem>
                        <SelectItem value="Grains & Flour">Nafaka na Unga</SelectItem>
                        <SelectItem value="Dairy & Cheese">Maziwa na Jibini</SelectItem>
                        <SelectItem value="Spices & Oils">Viungo na Mafuta</SelectItem>
                        <SelectItem value="Others">Zinginezo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Kipimo (Unit)</label>
                    <Select 
                      value={newInvItem.unit || 'kg'} 
                      onValueChange={val => setNewInvItem({ ...newInvItem, unit: val || 'kg' })}
                    >
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-11 text-white rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                        <SelectItem value="kg">Kilo (kg)</SelectItem>
                        <SelectItem value="litres">Lita (litres)</SelectItem>
                        <SelectItem value="bags">Mifuko (bags)</SelectItem>
                        <SelectItem value="crates">Kireti (crates)</SelectItem>
                        <SelectItem value="pieces">Vipande (pieces)</SelectItem>
                        <SelectItem value="boxes">Maboksi (boxes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Kiasi (Stock)</label>
                    <Input 
                      type="number" 
                      value={newInvItem.stock}
                      onChange={e => setNewInvItem({ ...newInvItem, stock: parseInt(e.target.value) || 0 })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Min Alert Limit</label>
                    <Input 
                      type="number" 
                      value={newInvItem.minLimit}
                      onChange={e => setNewInvItem({ ...newInvItem, minLimit: parseInt(e.target.value) || 0 })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Cost/Unit (TZS)</label>
                    <Input 
                      type="number" 
                      value={newInvItem.cost}
                      onChange={e => setNewInvItem({ ...newInvItem, cost: parseInt(e.target.value) || 0 })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-neutral-800 flex gap-4 shrink-0 bg-neutral-950">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddInvOpen(false);
                    setIsEditingInv(null);
                  }}
                  className="flex-1 bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest h-12 text-white rounded-xl"
                >
                  Ghairi
                </Button>
                <Button 
                  onClick={async () => {
                    if (!vendorProfile?.id) {
                      toast.error('Muonekano wa akaunti haujapakiwa!');
                      return;
                    }
                    if (!newInvItem.name || !newInvItem.sku) {
                      toast.error('Tafadhali jaza Jina na SKU!');
                      return;
                    }
                    try {
                      if (isEditingInv) {
                        await updateDoc(doc(db, 'vendors', vendorProfile.id, 'restaurant_inventory', isEditingInv.id), {
                          ...newInvItem,
                          stock: Number(newInvItem.stock || 0),
                          minLimit: Number(newInvItem.minLimit || 5),
                          cost: Number(newInvItem.cost || 0),
                        });
                        toast.success('Bidhaa ya stoki imebadilishwa!');
                      } else if (vendorProfile?.id) {
                        await addDoc(collection(db, 'vendors', vendorProfile.id, 'restaurant_inventory'), {
                          ...newInvItem,
                          stock: Number(newInvItem.stock || 0),
                          minLimit: Number(newInvItem.minLimit || 5),
                          cost: Number(newInvItem.cost || 0),
                          createdAt: new Date()
                        });
                        toast.success('Bidhaa mpya ya stoki imesajiliwa!');
                      }
                      setIsAddInvOpen(false);
                      setIsEditingInv(null);
                    } catch (e) {
                      console.error(e);
                      toast.error('Gharama imeshindwa kusajiliwa!');
                    }
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-xs font-bold uppercase tracking-widest h-12 text-white rounded-xl"
                >
                  Hifadhi Kitu
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restaurant Expenses Modal */}
      <AnimatePresence>
        {isAddExpOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddExpOpen(false);
                setIsEditingExp(null);
              }}
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
                  <h3 className="text-xl font-bold">
                    {isEditingExp ? 'Hariri Gharama ya Matumizi' : 'Sajili Gharama ya Matumizi'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Rekodi matumizi mapya ya ununuzi wa viungo</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddExpOpen(false);
                    setIsEditingExp(null);
                  }} 
                  className="text-neutral-500 hover:text-white p-2"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Maelezo (Description)</label>
                    <Input 
                      placeholder="e.g. Ununuzi kilo 20 nyama ya ng'ombe, Bili ya umeme" 
                      value={newExp.description}
                      onChange={e => setNewExp({ ...newExp, description: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Kiasi cha Fedha (Amount TZS)</label>
                    <Input 
                      type="number"
                      placeholder="e.g. 50000" 
                      value={newExp.amount || ''}
                      onChange={e => setNewExp({ ...newExp, amount: parseInt(e.target.value) || 0 })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Tarehe (Date)</label>
                    <Input 
                      type="date" 
                      value={newExp.date}
                      onChange={e => setNewExp({ ...newExp, date: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Kundi (Category)</label>
                    <Select 
                      value={newExp.category || 'Raw Materials'} 
                      onValueChange={val => setNewExp({ ...newExp, category: val || 'Raw Materials' })}
                    >
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-11 text-white rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                        <SelectItem value="Raw Materials">Raw Materials (Ununuzi wa chakula)</SelectItem>
                        <SelectItem value="Salary & Wages">Salary & Wages (Mishahara)</SelectItem>
                        <SelectItem value="Utilities">Utilities (Bili za Umeme/Maji)</SelectItem>
                        <SelectItem value="Rent">Rent (Kodi)</SelectItem>
                        <SelectItem value="Marketing">Marketing (Matangazo)</SelectItem>
                        <SelectItem value="Miscellaneous">Miscellaneous (Zinginezo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Njia ya Malipo (Payment Method)</label>
                    <Select 
                      value={newExp.paidBy || 'Cash'} 
                      onValueChange={val => setNewExp({ ...newExp, paidBy: val || 'Cash' })}
                    >
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 h-11 text-white rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                        <SelectItem value="Cash">Cash (Pesa Taslimu)</SelectItem>
                        <SelectItem value="M-Pesa">M-Pesa / TigoPesa</SelectItem>
                        <SelectItem value="Bank Card">Kadi ya Benki (Visa/Mastercard)</SelectItem>
                        <SelectItem value="Bank Transfer">Akaunti ya Benki (NFT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Reference au Namba ya Muamala</label>
                    <Input 
                      placeholder="e.g. PP25B59201" 
                      value={newExp.reference || ''}
                      onChange={e => setNewExp({ ...newExp, reference: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-11 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-neutral-800 flex gap-4 shrink-0 bg-neutral-950">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddExpOpen(false);
                    setIsEditingExp(null);
                  }}
                  className="flex-1 bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest h-12 text-white rounded-xl"
                >
                  Ghairi
                </Button>
                <Button 
                  onClick={async () => {
                    if (!vendorProfile?.id) {
                      toast.error('Muonekano wa akaunti haujapakiwa!');
                      return;
                    }
                    if (!newExp.description || !newExp.amount) {
                      toast.error('Tafadhali jaza maelezo na kiasi cha gaharama!');
                      return;
                    }
                    try {
                      if (isEditingExp) {
                        await updateDoc(doc(db, 'vendors', vendorProfile.id, 'restaurant_expenses', isEditingExp.id), {
                          ...newExp,
                          amount: Number(newExp.amount || 0),
                        });
                        toast.success('Gharama imesasishwa!');
                      } else if (vendorProfile?.id) {
                        await addDoc(collection(db, 'vendors', vendorProfile.id, 'restaurant_expenses'), {
                          ...newExp,
                          amount: Number(newExp.amount || 0),
                          createdAt: new Date()
                        });
                        toast.success('Gharama imesajiliwa!');
                      }
                      setIsAddExpOpen(false);
                      setIsEditingExp(null);
                    } catch (e) {
                      console.error(e);
                      toast.error('Imeshindwa kuhifadhi taarifa!');
                    }
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-xs font-bold uppercase tracking-widest h-12 text-white rounded-xl"
                >
                  Sajili Gharama
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
                  <h3 className="text-xl font-bold">
                    {editingProduct 
                      ? (vendorProfile?.category === 'hotel' ? 'Edit Room' : 'Edit Product') 
                      : (vendorProfile?.category === 'hotel' ? 'Add New Room' : 'Add New Product')
                    }
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {editingProduct 
                      ? 'Hariri Taarifa' 
                      : (vendorProfile?.category === 'hotel' ? 'Sajili Chumba Kipya' : 'Ongeza Bidhaa Mpya')
                    }
                  </p>
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
                    {vendorProfile?.category === 'hotel' 
                      ? 'Room Category / Type (e.g. Executive Double)' 
                      : vendorProfile?.category === 'bus_ticket' 
                        ? 'Trip Label / Jina la Safari' 
                        : (vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale')
                          ? 'Model ya Gari / Car Model (e.g. Land Cruiser, Fit)'
                          : 'Product Name / Jina la Bidhaa'}
                  </label>
                  <Input 
                    required 
                    className="bg-neutral-800 border-none h-12 rounded-xl"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder={vendorProfile?.category === 'hotel' 
                      ? "e.g. VIP Ocean View" 
                      : vendorProfile?.category === 'bus_ticket' 
                        ? "Dar to Arusha (Morning)" 
                        : (vendorProfile?.category === 'car_rental' || vendorProfile?.category === 'car_sale')
                          ? "e.g. Land Cruiser V8"
                          : "e.g. Paracetamol 500mg"}
                  />
                </div>

                {vendorProfile?.category === 'hotel' ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Capacity (Adults)</label>
                        <Input 
                          type="number"
                          placeholder="2"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={(newProduct as any).capacity || 2}
                          onChange={e => setNewProduct({...newProduct, capacity: parseInt(e.target.value)} as any)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Number of Rooms Available</label>
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
                      <label className="text-xs font-bold text-neutral-500 uppercase">Room Amenities / Sifa za Chumba</label>
                      <Input 
                        placeholder="e.g. WiFi, AC, TV, Private Balcony"
                        className="bg-neutral-800 border-none h-12 rounded-xl text-xs"
                        value={(newProduct as any).roomAmenities || ''}
                        onChange={e => setNewProduct({...newProduct, roomAmenities: e.target.value} as any)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Room Price (Per Night)</label>
                        <Input 
                          type="number"
                          required
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.price}
                          onChange={e => setNewProduct({...newProduct, price: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-neutral-500 uppercase">Unit</label>
                         <Input disabled value="Per Night" className="bg-neutral-800 border-none h-12 rounded-xl opacity-50" />
                      </div>
                    </div>
                  </div>
                ) : vendorProfile?.category === 'bus_ticket' ? (
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
                ) : vendorProfile?.category === 'car_rental' ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Brand ya Gari / Car Brand *</label>
                        <Input 
                          required
                          placeholder="e.g. Toyota"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.category || ''}
                          onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Aina ya Gari / Vehicle Type *</label>
                        <Select 
                          value={newProduct.carType || ''} 
                          onValueChange={val => setNewProduct({...newProduct, carType: val || undefined})}
                        >
                          <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                            <SelectValue placeholder="Chagua aina" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="suv">SUV</SelectItem>
                            <SelectItem value="hatchback">Hatchback / Compact</SelectItem>
                            <SelectItem value="wedding">Wedding / Sherehe</SelectItem>
                            <SelectItem value="safari">Safari / Utalii</SelectItem>
                            <SelectItem value="sedan">Sedan / Saloon</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Transmission / Gia *</label>
                        <Select 
                          value={newProduct.transmission || 'Automatic'} 
                          onValueChange={val => setNewProduct({...newProduct, transmission: val || undefined})}
                        >
                          <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                            <SelectValue placeholder="Chagua Gia" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="Automatic">Automatic</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Aina ya Mafuta / Fuel Type *</label>
                        <Select 
                          value={newProduct.fuel || 'Petrol'} 
                          onValueChange={val => setNewProduct({...newProduct, fuel: val || undefined})}
                        >
                          <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                            <SelectValue placeholder="Chagua Mafuta" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="Petrol">Petrol</SelectItem>
                            <SelectItem value="Diesel">Diesel</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                            <SelectItem value="Electric">Electric</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Idadi ya Viti *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="5"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.seats || ''}
                          onChange={e => setNewProduct({...newProduct, seats: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Uwezo wa Injini (Engine)</label>
                        <Input 
                          placeholder="e.g. 2000 cc"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.engine || ''}
                          onChange={e => setNewProduct({...newProduct, engine: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Plati / Car Number *</label>
                        <Input 
                          required
                          placeholder="e.g. T 123 ABC"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.carNumber || ''}
                          onChange={e => setNewProduct({...newProduct, carNumber: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Bei ya Kukodi kwa Siku (TZS) *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="e.g. 100000"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.price || ''}
                          onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Magari yaliyopo (Stock) *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="e.g. 1"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.stock || 1}
                          onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-xl border border-neutral-800">
                      <input 
                        type="checkbox"
                        id="ac-checkbox"
                        className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-orange-600 focus:ring-orange-600"
                        checked={newProduct.ac !== false}
                        onChange={e => setNewProduct({...newProduct, ac: e.target.checked})}
                      />
                      <label htmlFor="ac-checkbox" className="text-sm font-medium text-white cursor-pointer">
                        Gari lina AC? / Has Air Conditioning?
                      </label>
                    </div>
                  </div>
                ) : vendorProfile?.category === 'car_sale' ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Brand ya Gari / Car Brand *</label>
                        <Input 
                          required
                          placeholder="e.g. Toyota"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.category || ''}
                          onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Mwaka wa Undaji / Manufacture Year *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="e.g. 2018"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.year || ''}
                          onChange={e => setNewProduct({...newProduct, year: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Transmission / Gia *</label>
                        <Select 
                          value={newProduct.transmission || 'Automatic'} 
                          onValueChange={val => setNewProduct({...newProduct, transmission: val || undefined})}
                        >
                          <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                            <SelectValue placeholder="Chagua Gia" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="Automatic">Automatic</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Aina ya Mafuta / Fuel Type *</label>
                        <Select 
                          value={newProduct.fuel || 'Petrol'} 
                          onValueChange={val => setNewProduct({...newProduct, fuel: val || undefined})}
                        >
                          <SelectTrigger className="bg-neutral-800 border-none h-12 rounded-xl">
                            <SelectValue placeholder="Chagua Mafuta" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="Petrol">Petrol</SelectItem>
                            <SelectItem value="Diesel">Diesel</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                            <SelectItem value="Electric">Electric</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Mileage (km) *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="e.g. 45000"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.mileage || ''}
                          onChange={e => setNewProduct({...newProduct, mileage: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Idadi ya Viti *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="5"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.seats || 5}
                          onChange={e => setNewProduct({...newProduct, seats: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Bei ya Kuuza (TZS) *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="e.g. 25000000"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.price || ''}
                          onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Magari yaliyopo (Stock) *</label>
                        <Input 
                          type="number"
                          required
                          placeholder="e.g. 1"
                          className="bg-neutral-800 border-none h-12 rounded-xl"
                          value={newProduct.stock || 1}
                          onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Unit / Kipimo</label>
                      <Select 
                        value={newProduct.unit} 
                        onValueChange={v => setNewProduct({...newProduct, unit: v || undefined})}
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


                {/* AR & 3D Model Section with PapoFood Direct Studio */}
                {businessConfig.enableAR && (vendorProfile?.category === 'restaurant' || vendorProfile?.category === 'ecommerce' || vendorProfile?.category === 'grocery') && (
                  <div className="space-y-3 p-4 bg-gradient-to-r from-orange-600/10 via-amber-500/5 to-transparent rounded-2xl border border-orange-600/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-orange-600" />
                        <label className="text-xs font-bold text-orange-600 uppercase tracking-wider">AR & 3D Model (Direct Studio)</label>
                      </div>
                      <span className="text-[10px] bg-orange-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                        Live AR
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {newProduct.model3dUrl ? (
                        <div className="flex items-center justify-between p-3.5 bg-neutral-800/90 rounded-2xl border border-neutral-700 shadow-md">
                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="w-8 h-8 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center">
                              <Box className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs text-white font-black">3D AR Model Connected</p>
                              <p className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                                {newProduct.model3dUrl?.split('/').pop()?.split('?')[0] || 'GLB Model Ready'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 rounded-xl"
                              onClick={() => setIs3DStudioOpen(true)}
                            >
                              Badilisha
                            </Button>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs text-red-500 hover:text-red-400 p-0 px-2"
                              onClick={() => setNewProduct({...newProduct, model3dUrl: ''})}
                            >
                              Ondoa
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Direct PapoFood 3D Studio Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIs3DStudioOpen(true)}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 hover:brightness-110 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-95 border border-white/20"
                          >
                            <Box className="w-4 h-4 animate-bounce" />
                            <span>✨ Fungua PapoFood 3D Studio (Tengeneza / Chagua 3D Model Direct)</span>
                          </button>

                          <div className="flex items-center gap-2 my-1">
                            <div className="h-px bg-neutral-800 flex-1" />
                            <span className="text-[9px] text-neutral-500 uppercase font-extrabold">au weka link ya .glb</span>
                            <div className="h-px bg-neutral-800 flex-1" />
                          </div>

                          <Input 
                            className="bg-neutral-800 border-none h-11 rounded-xl text-xs"
                            placeholder="Paste 3D Model URL (.glb / .gltf)"
                            value={newProduct.model3dUrl || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && !val.split('?')[0].toLowerCase().endsWith('.glb') && !val.split('?')[0].toLowerCase().endsWith('.gltf')) {
                                toast.warning('Warning: URL does not look like a .glb or .gltf model. AR might not work.');
                              }
                              setNewProduct({...newProduct, model3dUrl: val});
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {vendorProfile?.category !== 'hotel' && vendorProfile?.category !== 'car_rental' && vendorProfile?.category !== 'car_sale' && (
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
                )}

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
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Long Story / Maelezo Marefu (Story)</label>
                  <Textarea 
                    className="bg-neutral-800 border-none min-h-[100px] rounded-xl text-sm"
                    value={newProduct.story}
                    onChange={e => setNewProduct({...newProduct, story: e.target.value})}
                    placeholder="Elezea bidhaa hii kwa undani zaidi (Story)..."
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Product Highlights / Sababu za kuipenda (Why Love It)</label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] font-bold text-orange-600 hover:bg-orange-600/10"
                      onClick={() => setNewProduct({
                        ...newProduct, 
                        highlights: [...(newProduct.highlights || []), '']
                      })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Highlight
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newProduct.highlights?.map((h, idx) => (
                      <div key={`highlight-edit-${idx}`} className="flex gap-2 items-center">
                        <Input 
                          className="flex-1 bg-neutral-800 border-none h-10 rounded-xl text-sm"
                          placeholder="e.g. Handmade with love"
                          value={h}
                          onChange={e => {
                            const newHighlights = [...(newProduct.highlights || [])];
                            newHighlights[idx] = e.target.value;
                            setNewProduct({...newProduct, highlights: newHighlights});
                          }}
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 text-red-500 hover:bg-red-500/10 rounded-xl"
                          onClick={() => {
                            const newHighlights = newProduct.highlights?.filter((_, i) => i !== idx);
                            setNewProduct({...newProduct, highlights: newHighlights});
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meta MCP Promotion & Catalog Sync Card */}
                <div className="p-4 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-neutral-900 border border-blue-500/30 rounded-2xl space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                        <Zap className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <label htmlFor="metaMcpPromo" className="text-xs font-black text-white uppercase tracking-wider cursor-pointer flex items-center gap-2">
                          <span>Tangaza Kwenye Meta MCP Hub</span>
                          <span className="text-[9px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">Meta AI Ads</span>
                        </label>
                        <p className="text-[10px] text-neutral-400 font-medium">
                          Sawazisha bidhaa hii na Meta Catalog na WhatsApp Business AI Agent ili kutangazwa kiotomatiki.
                        </p>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      id="metaMcpPromo"
                      className="w-5 h-5 rounded border-neutral-700 bg-neutral-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
                      checked={!!newProduct.metaMcpPromo}
                      onChange={e => setNewProduct({...newProduct, metaMcpPromo: e.target.checked})}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-4 border border-neutral-800 rounded-2xl bg-neutral-800/30">
                  <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                    Quality Promise / Ahadi ya Ubora
                  </label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Short Quality Message</label>
                      <Textarea 
                        className="bg-neutral-900 border-none min-h-[80px] rounded-xl text-sm"
                        value={newProduct.qualityPromise?.description}
                        onChange={e => setNewProduct({
                          ...newProduct, 
                          qualityPromise: { ...(newProduct.qualityPromise || { certifiedBy: '' }), description: e.target.value }
                        })}
                        placeholder="e.g. Sisi hufuata miongozo yote ya usalama wa chakula..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Certified By / Imethibitishwa Na</label>
                      <Input 
                        className="bg-neutral-900 border-none h-11 rounded-xl text-sm"
                        value={newProduct.qualityPromise?.certifiedBy}
                        onChange={e => setNewProduct({
                          ...newProduct, 
                          qualityPromise: { ...(newProduct.qualityPromise || { description: '' }), certifiedBy: e.target.value }
                        })}
                        placeholder="e.g. TBS, TFDA, Papo Hapo Certified"
                      />
                    </div>
                  </div>
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
                  <Select value={newStaff.role} onValueChange={val => setNewStaff({...newStaff, role: val || ''})}>
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
                    <Select value={newStaff.branchId} onValueChange={val => setNewStaff({...newStaff, branchId: val || ''})}>
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

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Initial Password / Paswedi</label>
                  <Input 
                    required
                    type="password"
                    placeholder="Set a password for login..." 
                    className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                    value={newStaff.password}
                    onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                  />
                </div>

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

      {/* Staff Details, Duties & Payments Comprehensive Modal */}
      <AnimatePresence>
        {isDetailStaffOpen && selectedStaff && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => {
                  setIsDetailStaffOpen(false);
                  setSelectedStaff(null);
               }}
               className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl p-8 max-h-[90vh] flex flex-col"
            >
               {/* Modal Header */}
               <div className="flex justify-between items-center pb-6 border-b border-white/5 shrink-0">
                  <div>
                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-3">
                        <UserCog className="w-6 h-6 text-orange-600" />
                        {selectedStaff.name}
                     </h3>
                     <p className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest mt-0.5">
                        Role ya kawaida: <span className="text-orange-500">{selectedStaff.role}</span>
                     </p>
                  </div>
                  <button 
                     onClick={() => {
                        setIsDetailStaffOpen(false);
                        setSelectedStaff(null);
                     }} 
                     className="text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-all"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>

               {/* Tabs Selector */}
               <div className="flex gap-2 p-1 bg-neutral-950/80 rounded-2xl border border-white/5 my-6 shrink-0">
                  <button
                     onClick={() => setDetailStaffTab('info')}
                     className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${detailStaffTab === 'info' ? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                  >
                     Taarifa & Paswedi
                  </button>
                  <button
                     onClick={() => setDetailStaffTab('permissions')}
                     className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${detailStaffTab === 'permissions' ? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                  >
                     Majukumu (Permissions)
                  </button>
                  <button
                     onClick={() => setDetailStaffTab('payments')}
                     className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${detailStaffTab === 'payments' ? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                  >
                     Mshahara & Payouts
                  </button>
               </div>

               {/* Modal Core Scrollable Content */}
               <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  
                  {/* TAB 1: BASIC INFO */}
                  {detailStaffTab === 'info' && (
                     <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Full Name / Jina Kamili</label>
                              <Input 
                                 placeholder="Jina la Mfanyakazi" 
                                 className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white italic"
                                 value={selectedStaff.name || ''}
                                 onChange={e => setSelectedStaff({...selectedStaff, name: e.target.value})}
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Phone Number / Simu</label>
                              <Input 
                                 placeholder="e.g. +255..." 
                                 className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white"
                                 value={selectedStaff.phone || ''}
                                 onChange={e => setSelectedStaff({...selectedStaff, phone: e.target.value})}
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Default App Role</label>
                              <Select 
                                 value={selectedStaff.role} 
                                 onValueChange={val => setSelectedStaff({...selectedStaff, role: val || 'waiter'})}
                              >
                                 <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white">
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="bg-neutral-900 border-neutral-800 text-white shadow-2xl rounded-2xl">
                                    <SelectItem value="chef">Chef / Mpishi</SelectItem>
                                    <SelectItem value="waiter">Waiter / WaitRESS</SelectItem>
                                    <SelectItem value="cashier">Cashier / Mhasibu</SelectItem>
                                    <SelectItem value="manager">Manager / Meneja</SelectItem>
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Branch / Kituo</label>
                              <Select 
                                 value={selectedStaff.branchId || ''} 
                                 onValueChange={val => setSelectedStaff({...selectedStaff, branchId: val || ''})}
                              >
                                 <SelectTrigger className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white">
                                    <SelectValue placeholder="Branch (Optional)" />
                                 </SelectTrigger>
                                 <SelectContent className="bg-neutral-900 border-neutral-800 text-white shadow-2xl rounded-2xl">
                                    <SelectItem value="">Hakuna Kituo (Default)</SelectItem>
                                    {branches.map(b => (
                                       <SelectItem key={`detail-branch-${b.id}`} value={b.id || ''}>{b.name}</SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        </div>

                        <div className="space-y-2 bg-neutral-950/40 p-6 rounded-3xl border border-white/5">
                           <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Login Password / Paswedi</label>
                           <Input 
                              placeholder="Unganisha paswedi..." 
                              className="bg-neutral-950 border-neutral-800 h-14 rounded-2xl font-bold text-white tracking-wider"
                              value={selectedStaff.password || ''}
                              onChange={e => setSelectedStaff({...selectedStaff, password: e.target.value})}
                           />
                           <p className="text-[9px] text-neutral-500 font-medium italic mt-2">Nenosiri hili litamruhusu mfanyakazi wako kulogin kwenye portal kupitia simu au kompyuta.</p>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex justify-end">
                           <Button 
                              onClick={handleSaveStaffDetails}
                              className="bg-orange-600 hover:bg-orange-700 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white"
                           >
                              Hifadhi Taarifa (Save Basic Data)
                           </Button>
                        </div>
                     </div>
                  )}

                  {/* TAB 2: POWERFUL CUSTOM RESPONSIBILITIES (MAJUKUMU) */}
                  {detailStaffTab === 'permissions' && (
                     <div className="space-y-6">
                        <div className="bg-gradient-to-tr from-orange-600/10 to-transparent border border-orange-600/20 p-6 rounded-[2rem] flex items-start gap-4">
                           <div className="bg-orange-600/20 p-3 rounded-2xl">
                              <ShieldCheck className="w-5 h-5 text-orange-600" />
                           </div>
                           <div className="flex-1 space-y-1">
                              <p className="text-xs font-black text-white uppercase tracking-wider">Weka Majukumu Maalum (Custom Duties)</p>
                              <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">Kubadilisha majukumu ya sasa ya mfanyakazi badala ya kufuata makuu ya Default Role yake. Unaweza kumtaka waitRESS aweze kuandika stoka au kusimamilisha menu kabisa!</p>
                           </div>
                        </div>

                        {/* Enable Custom Toggles Switch */}
                        <div className="flex justify-between items-center bg-neutral-950/60 p-6 rounded-3xl border border-neutral-800">
                           <div>
                              <p className="text-xs font-black text-white uppercase tracking-wide">Amilisha Majukumu Maalum</p>
                              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Use custom duty permissions overrides</p>
                           </div>
                           <input 
                              type="checkbox"
                              className="w-10 h-6 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-4 before:transition-all outline-none"
                              checked={selectedStaff.hasCustomPermissions || false}
                              onChange={e => setSelectedStaff({...selectedStaff, hasCustomPermissions: e.target.checked})}
                           />
                        </div>

                        {/* Custom Core Toggles Grid */}
                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-300 ${(!selectedStaff.hasCustomPermissions) ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                           
                           {/* canViewSales Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <LayoutGrid className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Angalia Mauzo & Dashboard</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">View Sales & Dashboard</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canViewSales || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canViewSales: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageOrders Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <ChefHat className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Oda & Jiko (KDS Display)</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Manage Orders & Kitchen</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageOrders || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageOrders: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageMenu Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Utensils className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Kusimamia Menu & Bei</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Manage Foods & Prices</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageMenu || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageMenu: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManagePOS Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Banknote className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Tengeneza Bili & Malipo (POS)</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Take Billing & POS Orders</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManagePOS || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManagePOS: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageTables Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Store className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Meneji Meza za Dining</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Manage Dining Tables</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageTables || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageTables: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageInventory Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Database className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Meneji Stoo & Stoka ya Jiko</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Manage Kitchen Inventory</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageInventory || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageInventory: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageExpenses Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Landmark className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Meneji Matumizi (Expenses)</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Manage Business Expenses</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageExpenses || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageExpenses: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageReports Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <LucidePieChart className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Ripoti na Makao ya Fedha</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">View Financial Reports</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageReports || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageReports: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                           {/* canManageStaff Toggle */}
                           <div className="bg-neutral-950/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between sm:col-span-2">
                              <div className="flex items-center gap-3">
                                 <Users className="w-4 h-4 text-orange-600 shrink-0" />
                                 <div>
                                    <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest leading-none">Kusajili na Kusimamia Wafanyakazi Wengine</p>
                                    <p className="text-[8px] text-neutral-500 font-bold mt-1">Manage and Edit Other Team Members</p>
                                 </div>
                              </div>
                              <input 
                                 type="checkbox"
                                 className="w-8 h-5 bg-neutral-800 rounded-full appearance-none checked:bg-orange-600 cursor-pointer relative before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:translate-x-3 before:transition-all outline-none"
                                 checked={selectedStaff.customPermissions?.canManageStaff || false}
                                 onChange={e => setSelectedStaff({
                                    ...selectedStaff, 
                                    customPermissions: {
                                       ...(selectedStaff.customPermissions || {}),
                                       canManageStaff: e.target.checked
                                    }
                                 })}
                              />
                           </div>

                        </div>

                        <div className="pt-4 border-t border-white/5 flex justify-end">
                           <Button 
                              onClick={handleSaveStaffDetails}
                              className="bg-orange-600 hover:bg-orange-700 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white"
                           >
                              Hifadhi Majukumu (Save Custom Duties)
                           </Button>
                        </div>
                     </div>
                  )}

                  {/* TAB 3: SALARIES, PAYOUTS & HISTORIA YA MALIPO */}
                  {detailStaffTab === 'payments' && (
                     <div className="space-y-6">
                        
                        {/* Part 1: Salary Definition Form */}
                        <div className="bg-neutral-950/40 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                           <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Coins className="w-4 h-4 text-orange-600" />
                              Sanidi Mkataba wa Mshahara (Contract Salary Rate)
                           </h4>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1">Kiasi cha Mshahara (Amount TZS)</label>
                                 <Input 
                                    type="number" 
                                    placeholder="e.g. 350000" 
                                    className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white italic"
                                    value={staffSalaryAmount}
                                    onChange={e => setStaffSalaryAmount(e.target.value)}
                                 />
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1">Aina ya Kufunga (Interval / Type)</label>
                                 <Select value={staffSalaryType} onValueChange={val => setStaffSalaryType(val || 'monthly')}>
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white">
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-950 border-neutral-800 text-white rounded-xl">
                                       <SelectItem value="daily">Kwa Siku (Daily Wage)</SelectItem>
                                       <SelectItem value="weekly">Kwa Wiki (Weekly Wage)</SelectItem>
                                       <SelectItem value="monthly">Kwa Mwezi (Monthly Salary)</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>
                           </div>

                           <div className="flex justify-end pt-2">
                              <Button 
                                 onClick={handleSaveStaffDetails}
                                 className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 h-10 px-6 rounded-xl font-black uppercase tracking-wider text-[8px] text-white"
                              >
                                 Sasisha Kipato (Update Rate)
                              </Button>
                           </div>
                        </div>

                        {/* Part 2: Quick Payout Recorder */}
                        <form onSubmit={handleRecordPayout} className="bg-neutral-950/80 p-6 rounded-[2.5rem] border border-orange-600/10 space-y-4">
                           <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Banknote className="w-4 h-4 text-orange-600" />
                              Sajili Malipo Mapya (Pay & Record Payout)
                           </h4>

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1">Kiasi Kilicholipwa (Amount TZS)</label>
                                 <Input 
                                    required
                                    type="number" 
                                    placeholder="e.g. 15000" 
                                    className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white italic"
                                    value={payoutAmount}
                                    onChange={e => setPayoutAmount(e.target.value)}
                                 />
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1">Njia ya malipo (Paid By)</label>
                                 <Select value={payoutPaidBy} onValueChange={val => setPayoutPaidBy(val || 'Cash')}>
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white">
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-950 border-neutral-800 text-white rounded-xl">
                                       <SelectItem value="Cash">Cash (Pesa Taslimu)</SelectItem>
                                       <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                                       <SelectItem value="Tigo Pesa">Tigo Pesa</SelectItem>
                                       <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                                       <SelectItem value="Halopesa">Halopesa</SelectItem>
                                       <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>

                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1">Namba ya kumbukumbu (Ref)</label>
                                 <Input 
                                    placeholder="Kumbukumbu / Simu" 
                                    className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white uppercase"
                                    value={payoutReference}
                                    onChange={e => setPayoutReference(e.target.value)}
                                 />
                              </div>
                           </div>

                           <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1">Maelezo (Notes / Reason)</label>
                              <Input 
                                 placeholder="e.g. Malipo ya wiki ijumaa, msaidizi mnyoofu" 
                                 className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-xs font-bold text-white italic"
                                 value={payoutNotes}
                                 onChange={e => setPayoutNotes(e.target.value)}
                              />
                           </div>

                           <div className="flex justify-end pt-2">
                              <Button 
                                 type="submit"
                                 className="bg-orange-600 hover:bg-orange-700 h-12 px-8 rounded-xl font-black uppercase tracking-wider text-[9px] text-white shadow-lg"
                              >
                                 Lipa & weka Kwenye Expenses (Record Payout)
                              </Button>
                           </div>
                        </form>

                        {/* Part 3: HISTORIA YA MALIPO (PAYMENT HISTORIES LOG) */}
                        <div className="space-y-3">
                           <h4 className="text-xs font-black text-white uppercase tracking-wider">Historia ya Malipo ya {selectedStaff.name}</h4>
                           
                           <div className="bg-neutral-950/40 border border-white/5 rounded-3xl overflow-hidden">
                              <div className="max-h-[200px] overflow-y-auto">
                                 <table className="w-full text-left border-collapse">
                                    <thead>
                                       <tr className="bg-neutral-950 text-neutral-400 text-[8px] font-black uppercase tracking-widest border-b border-white/5">
                                          <th className="px-4 py-3">Tarehe (Date)</th>
                                          <th className="px-4 py-3">Kiasi (Amount)</th>
                                          <th className="px-4 py-3">Njia (Method)</th>
                                          <th className="px-4 py-3">Maelezo (Notes)</th>
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {payoutLogs.map((log, idx) => {
                                          const d = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
                                          const displayDate = d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
                                          return (
                                             <tr key={`payout-log-${log.id || idx}`} className="border-b border-white/5 hover:bg-white/[0.02] text-[10px] text-neutral-200">
                                                <td className="px-4 py-3 font-mono text-[9px] text-neutral-400">{displayDate}</td>
                                                <td className="px-4 py-3 font-bold text-white">TZS {Number(log.amount || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3">
                                                   <span className="px-1.5 py-0.5 bg-orange-600/10 text-orange-400 rounded-md font-extrabold uppercase text-[8px]">{log.paidBy}</span>
                                                </td>
                                                <td className="px-4 py-3 text-neutral-400 italic max-w-[150px] truncate" title={log.notes || 'No description'}>
                                                   {log.notes || '—'}
                                                </td>
                                             </tr>
                                          );
                                       })}

                                       {payoutLogs.length === 0 && (
                                          <tr>
                                             <td colSpan={4} className="px-4 py-8 text-center text-[10px] text-neutral-500 italic uppercase font-bold tracking-wider">
                                                Hakuna rekodi za malipo zilizowahi kufanyika bado.
                                             </td>
                                          </tr>
                                       )}
                                    </tbody>
                                 </table>
                              </div>
                           </div>
                        </div>

                     </div>
                  )}

               </div>

               {/* Modal Footer */}
               <div className="pt-6 border-t border-white/5 flex justify-between shrink-0">
                  <div className="text-left">
                     <p className="text-[10px] text-neutral-500 uppercase font-black">Mshahara wa sasa</p>
                     <p className="text-md font-black text-white italic tracking-tighter">
                        {selectedStaff.salaryAmount ? `TZS ${Number(selectedStaff.salaryAmount).toLocaleString()}` : 'Bado unset'}
                        {selectedStaff.salaryAmount && <span className="text-[10px] font-normal text-neutral-400"> / {selectedStaff.salaryType || 'mwezi'}</span>}
                     </p>
                  </div>
                  <Button 
                     onClick={() => {
                        setIsDetailStaffOpen(false);
                        setSelectedStaff(null);
                     }}
                     className="bg-neutral-800 hover:bg-neutral-700 rounded-xl h-11 px-6 font-black uppercase text-[9px] tracking-wider text-neutral-300"
                  >
                     Funga Panel (Close)
                  </Button>
               </div>
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
                  <Select value={newBranch.type} onValueChange={val => setNewBranch({...newBranch, type: val || ''})}>
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

                {vendorProfile?.category === 'restaurant' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Aina ya Meza (Shape)</label>
                      <Select 
                        value={newSection.shape || 'square'} 
                        onValueChange={val => setNewSection({...newSection, shape: val || 'square'})}
                      >
                        <SelectTrigger className="bg-neutral-800 border-none h-11 rounded-xl text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl max-h-[220px] overflow-y-auto">
                          <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-2.5 py-1.5 border-b border-neutral-800/40">MEZA NA VITI / DINING</div>
                          <SelectItem value="square">Mstatili / Square Table</SelectItem>
                          <SelectItem value="round">Duara / Round Table</SelectItem>
                          <SelectItem value="sofa">Sofa / Booth Setup</SelectItem>
                          <SelectItem value="bar_stool">Kiti Kirefu / Bar Stool</SelectItem>
                          
                          <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest px-2.5 py-1.5 border-t border-b border-neutral-800/40 mt-1">MIUNDOMBINU / ARCHITECTURE</div>
                          <SelectItem value="entrance">🚪 Mlango Mkuu / Main Entrance</SelectItem>
                          <SelectItem value="reception">🛎️ Mapokezi / Reception Desk</SelectItem>
                          <SelectItem value="kitchen_window">👨‍🍳 Dirisha la Jikoni / Kitchen Gate</SelectItem>
                          <SelectItem value="bar_counter">☕ Kaunta ya Baa / Bar Counter</SelectItem>
                          <SelectItem value="restroom">🚻 Choo / Restroom (WC)</SelectItem>
                          <SelectItem value="indoor_plant">🌿 Mmea wa Maua / Decorative Plant</SelectItem>
                          <SelectItem value="structure_divider">🔲 Kitalu / Dividing Partition</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Eneo la Meza (Section)</label>
                      <Select 
                        value={newSection.section || 'Indoor'} 
                        onValueChange={val => setNewSection({...newSection, section: val || 'Indoor'})}
                      >
                        <SelectTrigger className="bg-neutral-800 border-none h-11 rounded-xl text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-xl">
                          <SelectItem value="Indoor">Ndani (Indoor Floor)</SelectItem>
                          <SelectItem value="Outdoor/Terrace">Nje / Terasi (Outdoor Terrace)</SelectItem>
                          <SelectItem value="Bar Area">Eneo la Baa (Bar Area)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-xl border border-neutral-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Sharing / Multi-Booking</span>
                    <span className="text-[8px] text-neutral-500 uppercase font-bold tracking-tighter">Iruhusu Meza Ikaliwe na watu tofauti</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setNewSection({...newSection, allowSharing: !newSection.allowSharing})}
                    className={`w-10 h-5 rounded-full transition-all relative flex items-center px-1 ${newSection.allowSharing ? 'bg-orange-600' : 'bg-neutral-700'}`}
                  >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm ${newSection.allowSharing ? 'translate-x-4.5' : 'translate-x-0'}`}></div>
                  </button>
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
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQrBuilderOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="relative w-full max-w-6xl bg-[#0d0d11] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col z-10"
            >
              {/* Modal Header & Mode Switcher */}
              <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-neutral-950/80 backdrop-blur-xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {qrBuilderMode === 'table_stand' 
                        ? (standDisplayLayout === 'gold_menu_showcase' ? 'Stand / Bango la Menyu ya Dhahabu (Luxury Gold Placard)' : 'Stand ya Mezani (Single Table Stand)') 
                        : qrBuilderMode === 'store_placard' ? 'Bango la Dukani' : 'QR Code Pekee'}
                    </span>
                    {selectedSection && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono text-[10px] font-black tracking-tight">
                        {vendorProfile?.category === 'restaurant' ? `MEZA #${selectedSection.number}` : `AISLE #${selectedSection.number}`}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                    {qrBuilderMode === 'table_stand' 
                      ? (standDisplayLayout === 'gold_menu_showcase' 
                          ? (selectedSection ? `Stand ya Dhahabu: Meza #${selectedSection.number}` : 'Buni Bango la Dhahabu (Luxury Gold Placard)')
                          : (selectedSection ? `Stand ya Meza: #${selectedSection.number}` : 'Buni Stand ya Mezani (Single Stand)'))
                      : qrBuilderMode === 'store_placard'
                      ? (selectedSection ? `Bango la Aisle: #${selectedSection.number}` : 'Bango la Kaunta / Dukani')
                      : 'QR Code Customizer'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-medium">
                    {standDisplayLayout === 'gold_menu_showcase'
                      ? 'Stand ya kisasa ya dhahabu yenye vyakula 3 pendwa, bango kuu la duka, taarifa za meza na QR codes papo hapo'
                      : 'Stand ya mezani yenye QR kuu, WiFi ya wageni, nambari ya meza & nembo ya mgahawa'}
                  </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 bg-black/60 p-1.5 rounded-2xl border border-white/10 self-start md:self-center shrink-0">
                  <button
                    onClick={() => {
                      setQrBuilderMode('table_stand');
                      setPrintDetails((prev: any) => ({ ...prev, isPrintMode: true }));
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                      qrBuilderMode === 'table_stand' 
                        ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-950/50' 
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>Stand ya Mezani</span>
                  </button>
                  <button
                    onClick={() => {
                      setQrBuilderMode('store_placard');
                      setPrintDetails((prev: any) => ({ ...prev, isPrintMode: true }));
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                      qrBuilderMode === 'store_placard' 
                        ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-950/50' 
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Bango la Dukani</span>
                  </button>
                  <button
                    onClick={() => {
                      setQrBuilderMode('qr_only');
                      setPrintDetails((prev: any) => ({ ...prev, isPrintMode: false }));
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                      qrBuilderMode === 'qr_only' 
                        ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-950/50' 
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Pekee</span>
                  </button>
                  <button 
                    onClick={() => setIsQrBuilderOpen(false)} 
                    className="text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-all ml-1.5 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Modal Body */}
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Options Panel */}
                {staffProfile?.role === 'waiter' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/40 border-r border-white/5 min-h-[400px]">
                    <QrCode className="w-16 h-16 text-orange-600/40 mb-4" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider mb-2">QR Customizer Locked</h4>
                    <p className="text-xs text-neutral-500 font-bold max-w-xs leading-normal">
                      Mhudumu (Waiter) hawezi kubadilisha mwonekano wa QR Code. Wasiliana na Meneja au Mmiliki kwa mabadiliko.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-7 custom-scrollbar border-r border-white/5 bg-[#09090b]/90">
                  
                  {/* Mode: Table Stand Controls */}
                  {qrBuilderMode === 'table_stand' && (
                    <div className="space-y-6">
                      
                      {/* Stand Layout Selector: Gold Menu Showcase vs Single Stand */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] px-1 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400" /> Muundo wa Stand ya Mezani (Stand Layout)
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            onClick={() => {
                              setStandDisplayLayout('gold_menu_showcase');
                              setTableStandStyle('gold_metal');
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                              standDisplayLayout === 'gold_menu_showcase'
                                ? 'bg-gradient-to-br from-amber-950/60 to-black border-amber-500 text-white ring-1 ring-amber-400/50 shadow-xl'
                                : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-lg">🏆</span>
                              <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-black uppercase tracking-widest">LUXURY GOLD</span>
                            </div>
                            <h4 className="text-xs font-black uppercase text-amber-200">Showcase ya Dhahabu</h4>
                            <p className="text-[9px] text-neutral-400 mt-0.5 leading-tight">Vyakula 3, Bango Kuu la Duka, Maelezo & QR za kila sahani</p>
                          </button>

                          <button
                            onClick={() => setStandDisplayLayout('single_stand')}
                            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                              standDisplayLayout === 'single_stand'
                                ? 'bg-gradient-to-br from-orange-950/60 to-black border-orange-500 text-white ring-1 ring-orange-400/50 shadow-xl'
                                : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-lg">🪟</span>
                              <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 uppercase tracking-widest">MINIMALIST</span>
                            </div>
                            <h4 className="text-xs font-black uppercase text-white">Stand ya QR Moja</h4>
                            <p className="text-[9px] text-neutral-400 mt-0.5 leading-tight">QR kubwa ya meza, nembo & WiFi ya wageni</p>
                          </button>
                        </div>
                      </div>

                      {/* Controls for Gold Menu Showcase */}
                      {standDisplayLayout === 'gold_menu_showcase' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          
                          {/* 1. COLOR THEME & PRESETS CUSTOMIZER */}
                          <div className="space-y-3.5 p-4 bg-gradient-to-br from-neutral-900/90 to-neutral-950 border border-amber-500/30 rounded-2xl shadow-md">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-amber-300 uppercase tracking-[0.18em] flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-amber-400" /> Rangi & Mandhari ya Bango (Color Theme)
                              </span>
                              <span className="text-[8px] font-mono text-amber-400/80 uppercase font-bold">
                                {goldThemePreset.toUpperCase()}
                              </span>
                            </div>

                            {/* Preset Themes Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { id: 'gold', name: 'Dhahabu Halisi', subtitle: 'Luxury Gold', primary: '#eab308', accent: '#f59e0b', bgStart: '#23170a', bgEnd: '#050302', cardBg: '#170e06', text: '#fef08a', swatch: 'from-amber-500 to-yellow-700' },
                                { id: 'emerald', name: 'Kijani cha Kifalme', subtitle: 'Emerald Green', primary: '#10b981', accent: '#34d399', bgStart: '#022c22', bgEnd: '#020f0d', cardBg: '#06251d', text: '#a7f3d0', swatch: 'from-emerald-500 to-teal-800' },
                                { id: 'ruby', name: 'Nyekundu ya Ruby', subtitle: 'Ruby Velvet', primary: '#ef4444', accent: '#f87171', bgStart: '#2a0808', bgEnd: '#090202', cardBg: '#1c0707', text: '#fecaca', swatch: 'from-red-500 to-rose-900' },
                                { id: 'sapphire', name: 'Bluu ya Kifalme', subtitle: 'Sapphire Blue', primary: '#3b82f6', accent: '#60a5fa', bgStart: '#0b192c', bgEnd: '#02070f', cardBg: '#081426', text: '#bfdbfe', swatch: 'from-blue-500 to-indigo-900' },
                                { id: 'rosegold', name: 'Dhahabu ya Waridi', subtitle: 'Rose Gold', primary: '#f472b6', accent: '#fb7185', bgStart: '#280d19', bgEnd: '#080206', cardBg: '#1d0a13', text: '#fbcfe8', swatch: 'from-pink-400 to-rose-700' },
                                { id: 'obsidian', name: 'Nyeusi & Machweo', subtitle: 'Sunset Amber', primary: '#f97316', accent: '#fb923c', bgStart: '#18181b', bgEnd: '#000000', cardBg: '#121214', text: '#fed7aa', swatch: 'from-orange-500 to-neutral-900' },
                                { id: 'amethyst', name: 'Zambarau ya Kifalme', subtitle: 'Royal Purple', primary: '#a855f7', accent: '#c084fc', bgStart: '#1e0e2e', bgEnd: '#06020c', cardBg: '#150824', text: '#e9d5ff', swatch: 'from-purple-500 to-violet-900' },
                                { id: 'custom', name: 'Rangi Zako (Custom)', subtitle: 'Kibinafsi', primary: goldPrimaryColor, accent: goldAccentColor, bgStart: goldBgColorStart, bgEnd: goldBgColorEnd, cardBg: goldCardBgColor, text: goldTextColor, swatch: 'from-neutral-700 to-neutral-900' },
                              ].map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setGoldThemePreset(t.id);
                                    if (t.id !== 'custom') {
                                      setGoldPrimaryColor(t.primary);
                                      setGoldAccentColor(t.accent);
                                      setGoldBgColorStart(t.bgStart);
                                      setGoldBgColorEnd(t.bgEnd);
                                      setGoldCardBgColor(t.cardBg);
                                      setGoldTextColor(t.text);
                                      toast.success(`Mandhari ya ${t.name} imewekwa!`);
                                    }
                                  }}
                                  className={`p-2 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                                    goldThemePreset === t.id 
                                      ? 'border-white ring-2 ring-amber-400 shadow-lg scale-[1.02]' 
                                      : 'border-white/10 hover:border-white/30 bg-black/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${t.swatch} border border-white/40 shadow-xs shrink-0`}></div>
                                    {goldThemePreset === t.id && (
                                      <CheckCircle2 className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[9.5px] font-black text-white uppercase leading-tight truncate">{t.name}</p>
                                    <p className="text-[7.5px] text-neutral-400 truncate">{t.subtitle}</p>
                                  </div>
                                </button>
                              ))}
                            </div>

                            {/* Detailed Custom Color Pickers */}
                            <div className="pt-2 border-t border-white/5 space-y-2.5">
                              <span className="text-[8.5px] font-black text-neutral-400 uppercase tracking-wider block">
                                Rekebisha Rangi Moja kwa Moja (Detailed Color Pickers)
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Rangi Kuu / Border</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldPrimaryColor}
                                      onChange={(e) => {
                                        setGoldPrimaryColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldPrimaryColor}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Rangi ya Mwanga (Accent)</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldAccentColor}
                                      onChange={(e) => {
                                        setGoldAccentColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldAccentColor}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Rangi ya Maandishi</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldTextColor}
                                      onChange={(e) => {
                                        setGoldTextColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldTextColor}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Mandhari (Juu)</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldBgColorStart}
                                      onChange={(e) => {
                                        setGoldBgColorStart(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldBgColorStart}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Mandhari (Chini)</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldBgColorEnd}
                                      onChange={(e) => {
                                        setGoldBgColorEnd(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldBgColorEnd}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-tight block">Vibao vya Kadi</span>
                                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                    <input 
                                      type="color" 
                                      value={goldCardBgColor}
                                      onChange={(e) => {
                                        setGoldCardBgColor(e.target.value);
                                        setGoldThemePreset('custom');
                                      }}
                                      className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-[9px] font-mono text-neutral-200 font-bold uppercase">{goldCardBgColor}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 2. DISHES / PRODUCTS MANAGEMENT SECTION (DYNAMIC: ONLY REAL PRODUCTS) */}
                          <div className="space-y-3.5 p-4 bg-neutral-900/60 border border-white/5 rounded-2xl">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                                <label className="text-[10px] font-black text-white uppercase tracking-[0.18em]">
                                  Bidhaa Maalumu kwenye Bango ({showcaseDishes.length})
                                </label>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!products || products.length === 0) {
                                      toast.error('Hakuna bidhaa kwenye orodha yako ya duka. Ongeza bidhaa kwanza au andika kwa mkono!');
                                      return;
                                    }
                                    // Load only real existing products, max 3
                                    const realProducts = products.slice(0, 3).map((p, idx) => ({
                                      id: `dish-prod-${p.id || idx}`,
                                      name: (p.name || 'BIDHAA').toUpperCase(),
                                      emoji: idx === 0 ? '🔥' : idx === 1 ? '🍲' : '🌿',
                                      price: Number(p.price || 0).toLocaleString(),
                                      badge: idx === 0 ? 'BEST SELLER' : idx === 1 ? "CHEF'S CHOICE" : 'FRESH & NATURAL',
                                      badgeColor: idx === 0 ? '#dc2626' : idx === 1 ? '#15803d' : '#1d4ed8',
                                      description: p.description || 'Chakula kizuri kilichoandaliwa kwa ubora na usafi wa hali ya juu.',
                                      imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
                                    }));
                                    setShowcaseDishes(realProducts);
                                    setActiveDishEditIndex(0);
                                    setShowGoldDishes(true);
                                    toast.success(`Bidhaa ${realProducts.length} kutoka menyu yako zimepakiwa!`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-[8.5px] font-black uppercase tracking-wider border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Package className="w-3 h-3" /> Pakia kutoka Menyu
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (showcaseDishes.length >= 4) {
                                      toast.info('Upeo ni sahani 4 kwa bango moja.');
                                      return;
                                    }
                                    const newDish = {
                                      id: `dish-${Date.now()}`,
                                      name: 'SAHANI MPYA',
                                      emoji: '✨',
                                      price: '10,000',
                                      badge: 'POPULAR',
                                      badgeColor: '#d97706',
                                      description: 'Ladha halisi ya chakula safi kilichoandaliwa kwa ubora.',
                                      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
                                    };
                                    setShowcaseDishes([...showcaseDishes, newDish]);
                                    setActiveDishEditIndex(showcaseDishes.length);
                                    setShowGoldDishes(true);
                                    toast.success('Sahani mpya imeongezwa!');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8.5px] font-black uppercase tracking-wider border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Ongeza
                                </button>

                                {showcaseDishes.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowcaseDishes([]);
                                      toast.success('Sahani zote zimeondolewa kwenye bango!');
                                    }}
                                    className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 text-[8.5px] font-black uppercase tracking-wider border border-red-500/20 transition-all cursor-pointer"
                                  >
                                    Futa Zote
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Toggle Show/Hide Dishes */}
                            <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-white/5">
                              <span className="text-[8.5px] text-neutral-300 font-bold uppercase">
                                Onyesha Sehemu ya Sahani Maalumu kwenye Bango
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowGoldDishes(!showGoldDishes)}
                                className={`w-10 h-5 rounded-full transition-all relative flex items-center px-0.5 cursor-pointer ${showGoldDishes ? 'bg-amber-600' : 'bg-neutral-800'}`}
                              >
                                <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-xs ${showGoldDishes ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </button>
                            </div>

                            {/* If no dishes or toggled off */}
                            {(!showGoldDishes || showcaseDishes.length === 0) && (
                              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-center space-y-1">
                                <p className="text-[10px] font-black text-amber-300 uppercase">Hakuna Sahani Zilizowekwa</p>
                                <p className="text-[8.5px] text-neutral-400">
                                  Bango lako litaonekana safi likiwa na Nembo, Nambari ya Meza, QR Kuu ya Duka na WiFi bila sahani bandia.
                                </p>
                              </div>
                            )}

                            {/* Dish Select Tabs */}
                            {showGoldDishes && showcaseDishes.length > 0 && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {showcaseDishes.map((dish, idx) => (
                                    <div
                                      key={`dish-tab-${dish.id}-${idx}`}
                                      className={`relative rounded-xl border transition-all flex items-center justify-between p-2 cursor-pointer ${
                                        activeDishEditIndex === idx 
                                          ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40' 
                                          : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:border-white/20'
                                      }`}
                                      onClick={() => setActiveDishEditIndex(idx)}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-sm">{dish.emoji || '🍽️'}</span>
                                        <div className="truncate min-w-0">
                                          <p className="text-[9.5px] font-black uppercase text-white truncate">#{idx + 1} {dish.name || `Sahani ${idx + 1}`}</p>
                                          <p className="text-[8px] text-amber-400 font-mono font-bold truncate">TSH {dish.price}</p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const filtered = showcaseDishes.filter((_, i) => i !== idx);
                                          setShowcaseDishes(filtered);
                                          if (activeDishEditIndex >= filtered.length) {
                                            setActiveDishEditIndex(Math.max(0, filtered.length - 1));
                                          }
                                          toast.success('Sahani imeondolewa!');
                                        }}
                                        className="text-neutral-500 hover:text-red-400 p-1 transition-all"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {/* Active Dish Editor Box */}
                                {showcaseDishes[activeDishEditIndex] && (
                                  <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between pb-2 border-b border-white/5 flex-wrap gap-2">
                                      <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                        <Utensils className="w-3.5 h-3.5 text-amber-400" />
                                        Sahani #{activeDishEditIndex + 1}: {showcaseDishes[activeDishEditIndex].name}
                                      </span>
                                      
                                      {/* Quick pick from vendor inventory */}
                                      {products && products.length > 0 && (
                                        <select
                                          onChange={(e) => {
                                            const prod = products.find(p => p.id === e.target.value);
                                            if (prod) {
                                              const updated = [...showcaseDishes];
                                              updated[activeDishEditIndex] = {
                                                ...updated[activeDishEditIndex],
                                                name: (prod.name || 'BIDHAA').toUpperCase(),
                                                price: Number(prod.price || 0).toLocaleString(),
                                                description: prod.description || 'Chakula kitamu na chenye ladha safi.',
                                                imageUrl: prod.imageUrl || updated[activeDishEditIndex].imageUrl,
                                              };
                                              setShowcaseDishes(updated);
                                              toast.success(`Taarifa za "${prod.name}" zimewekwa kwenye sahani #${activeDishEditIndex + 1}!`);
                                            }
                                          }}
                                          className="bg-neutral-950 border border-white/15 text-neutral-300 text-[9px] font-bold rounded-lg px-2 py-1 outline-none max-w-[170px] truncate"
                                          defaultValue=""
                                        >
                                          <option value="" disabled>Badilisha kutoka Menyu...</option>
                                          {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (TSH {Number(p.price).toLocaleString()})</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Jina la Chakula / Bidhaa</span>
                                        <Input 
                                          value={showcaseDishes[activeDishEditIndex].name}
                                          onChange={(e) => {
                                            const updated = [...showcaseDishes];
                                            updated[activeDishEditIndex].name = e.target.value.toUpperCase();
                                            setShowcaseDishes(updated);
                                          }}
                                          placeholder="e.g. KUKU CHOMA"
                                          className="bg-neutral-950 border-white/10 h-10 rounded-xl text-white font-black text-xs uppercase"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Bei (TSH)</span>
                                        <Input 
                                          value={showcaseDishes[activeDishEditIndex].price}
                                          onChange={(e) => {
                                            const updated = [...showcaseDishes];
                                            updated[activeDishEditIndex].price = e.target.value;
                                            setShowcaseDishes(updated);
                                          }}
                                          placeholder="15,000"
                                          className="bg-neutral-950 border-white/10 h-10 rounded-xl text-amber-300 font-mono font-black text-xs"
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Emoji ya Chakula</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {['🔥', '🍲', '🌿', '🥩', '🍗', '🐟', '🍕', '🍔', '🍹', '☕', '👟', '🛍️', '✨'].map(em => (
                                            <button
                                              key={em}
                                              type="button"
                                              onClick={() => {
                                                const updated = [...showcaseDishes];
                                                updated[activeDishEditIndex].emoji = em;
                                                setShowcaseDishes(updated);
                                              }}
                                              className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all ${
                                                showcaseDishes[activeDishEditIndex].emoji === em ? 'bg-amber-600 text-white scale-110' : 'bg-neutral-950 hover:bg-neutral-800'
                                              }`}
                                            >
                                              {em}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Taji / Badge ya Sahani</span>
                                        <select
                                          value={showcaseDishes[activeDishEditIndex].badge}
                                          onChange={(e) => {
                                            const updated = [...showcaseDishes];
                                            updated[activeDishEditIndex].badge = e.target.value;
                                            if (e.target.value === 'BEST SELLER') updated[activeDishEditIndex].badgeColor = '#dc2626';
                                            if (e.target.value === "CHEF'S CHOICE") updated[activeDishEditIndex].badgeColor = '#15803d';
                                            if (e.target.value === 'FRESH & NATURAL') updated[activeDishEditIndex].badgeColor = '#1d4ed8';
                                            if (e.target.value === 'VIP SPECIAL') updated[activeDishEditIndex].badgeColor = '#b45309';
                                            if (e.target.value === 'HOT OFFER') updated[activeDishEditIndex].badgeColor = '#e11d48';
                                            setShowcaseDishes(updated);
                                          }}
                                          className="bg-neutral-950 border border-white/10 text-white text-[10px] font-bold rounded-xl h-10 px-2 w-full outline-none uppercase"
                                        >
                                          <option value="BEST SELLER">BEST SELLER ★★★</option>
                                          <option value="CHEF'S CHOICE">CHEF'S CHOICE ★★★</option>
                                          <option value="FRESH & NATURAL">FRESH & NATURAL ★★★</option>
                                          <option value="VIP SPECIAL">VIP SPECIAL 🔥</option>
                                          <option value="MOST POPULAR">MOST POPULAR ✨</option>
                                          <option value="HOT OFFER">HOT OFFER 💥</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Maelezo Mafupi ya Chakula (Description)</span>
                                      <Input 
                                        value={showcaseDishes[activeDishEditIndex].description}
                                        onChange={(e) => {
                                          const updated = [...showcaseDishes];
                                          updated[activeDishEditIndex].description = e.target.value;
                                          setShowcaseDishes(updated);
                                        }}
                                        placeholder="Kuku choma tamu na ladha ya kipekee, ikichezwa na viungo bora."
                                        className="bg-neutral-950 border-white/10 h-10 rounded-xl text-neutral-300 text-xs"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Picha ya Sahani (Image URL)</span>
                                      <Input 
                                        value={showcaseDishes[activeDishEditIndex].imageUrl}
                                        onChange={(e) => {
                                          const updated = [...showcaseDishes];
                                          updated[activeDishEditIndex].imageUrl = e.target.value;
                                          setShowcaseDishes(updated);
                                        }}
                                        placeholder="https://images.unsplash.com/..."
                                        className="bg-neutral-950 border-white/10 h-10 rounded-xl text-neutral-400 text-[10px] font-mono"
                                      />
                                    </div>

                                    <div className="pt-1 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const filtered = showcaseDishes.filter((_, i) => i !== activeDishEditIndex);
                                          setShowcaseDishes(filtered);
                                          setActiveDishEditIndex(Math.max(0, filtered.length - 1));
                                          toast.success('Sahani imeondolewa!');
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Futa Sahani Hii (#{activeDishEditIndex + 1})
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* LOGO YA DUKA / MGAHAWA (STORE LOGO CUSTOMIZER) */}
                          <div className="space-y-3.5 p-4 bg-gradient-to-br from-neutral-900/90 to-neutral-950 border border-amber-500/30 rounded-2xl shadow-md">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-amber-300 uppercase tracking-[0.18em] flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Nembo ya Duka / Logo ya Mgahawa (Top Logo)
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] text-neutral-400 font-bold uppercase">
                                  {showGoldLogo ? 'Inaonekana' : 'Imezimwa'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowGoldLogo(!showGoldLogo)}
                                  className={`w-9 h-5 rounded-full transition-all relative flex items-center px-0.5 cursor-pointer ${showGoldLogo ? 'bg-amber-500' : 'bg-neutral-800'}`}
                                >
                                  <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-xs ${showGoldLogo ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                              </div>
                            </div>

                            {/* Current Logo Preview & Actions */}
                            <div className="flex items-center gap-3 p-3 bg-black/50 rounded-xl border border-white/5">
                              <div className="w-14 h-14 rounded-full border-2 border-amber-500/40 bg-neutral-950 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                {(goldLogoUrl || vendorProfile?.logoUrl) ? (
                                  <img 
                                    src={goldLogoUrl || vendorProfile?.logoUrl} 
                                    alt="Logo Preview" 
                                    className="w-full h-full object-contain rounded-full"
                                  />
                                ) : (
                                  <div className="text-center">
                                    <Utensils className="w-4 h-4 text-amber-400 mx-auto" />
                                    <span className="text-[6px] text-neutral-400 uppercase block font-bold">Crest</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-[9.5px] font-black text-white uppercase truncate">
                                  {(goldLogoUrl || vendorProfile?.logoUrl) ? 'Nembo ya Mgahawa Wako Imewekwa' : 'Inatumia Nembo ya Dhahabu (Default Crest)'}
                                </p>
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Upload Button */}
                                  <label className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-black text-[8.5px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-sm">
                                    <Upload className="w-3 h-3 text-black" />
                                    {isGoldLogoUploading ? 'Inapakia...' : 'Pakia Logo Mpya'}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setIsGoldLogoUploading(true);
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const res = ev.target?.result as string;
                                            setGoldLogoUrl(res);
                                            setShowGoldLogo(true);
                                            setIsGoldLogoUploading(false);
                                            toast.success('Logo imewekwa kwenye bango!');
                                          };
                                          reader.onerror = () => {
                                            setIsGoldLogoUploading(false);
                                            toast.error('Imeshindwa kusoma picha');
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>

                                  {/* Use Store Profile Logo */}
                                  {vendorProfile?.logoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGoldLogoUrl(vendorProfile.logoUrl || '');
                                        setShowGoldLogo(true);
                                        toast.success('Nembo ya wasifu wa duka imewekwa!');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Logo ya Wasifu
                                    </button>
                                  )}

                                  {/* Reset / Remove Logo */}
                                  {(goldLogoUrl || vendorProfile?.logoUrl) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGoldLogoUrl('');
                                        setShowGoldLogo(false);
                                        toast.success('Nembo imeondolewa, inatumia muhuri wa dhahabu!');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Ondoa
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Image URL Input */}
                            <div className="space-y-1">
                              <span className="text-[7.5px] font-black text-neutral-400 uppercase tracking-widest block">Au Weka Kiungo cha Logo (Logo Image URL)</span>
                              <Input 
                                value={goldLogoUrl || vendorProfile?.logoUrl || ''}
                                onChange={(e) => {
                                  setGoldLogoUrl(e.target.value);
                                  setShowGoldLogo(true);
                                }}
                                placeholder="https://..."
                                className="bg-black/60 border-white/10 h-9 rounded-xl text-neutral-300 text-xs font-mono"
                              />
                            </div>
                          </div>

                          {/* 3. Banner Header & Branding Settings */}
                          <div className="space-y-3 p-4 bg-neutral-900/60 border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-amber-400" /> Kichwa cha Mgahawa & Mabango (Header & Signs)
                            </span>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Jina la Mgahawa (Header)</span>
                                <Input 
                                  value={printDetails.header || vendorProfile?.businessName || 'RESTAURANTKISINIA'}
                                  onChange={(e) => setPrintDetails({ ...printDetails, header: e.target.value.toUpperCase() })}
                                  placeholder="RESTAURANTKISINIA"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-amber-300 font-black text-xs uppercase"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Mwaka wa Kuanzishwa (Since)</span>
                                <Input 
                                  value={goldMenuSince}
                                  onChange={(e) => setGoldMenuSince(e.target.value.toUpperCase())}
                                  placeholder="SINCE 2023"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-amber-200 font-mono text-xs uppercase"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Kichwa cha Ribbon / Slogan</span>
                              <Input 
                                value={goldMenuBanner}
                                onChange={(e) => setGoldMenuBanner(e.target.value.toUpperCase())}
                                placeholder="DELICIOUS FOOD • GREAT TASTE • HAPPY YOU"
                                className="bg-black/60 border-white/10 h-10 rounded-xl text-amber-200 font-black text-xs uppercase tracking-wider text-center"
                              />
                            </div>
                          </div>

                          {/* 4. Footer & Contacts Customizer */}
                          <div className="space-y-3 p-4 bg-neutral-900/60 border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-black text-neutral-300 uppercase tracking-widest block">Taarifa za Mawasiliano & Tovuti (Footer Info)</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Tovuti / Portal</span>
                                <Input 
                                  value={goldWebsiteUrl}
                                  onChange={(e) => setGoldWebsiteUrl(e.target.value.toUpperCase())}
                                  placeholder="WWW.AGIZA.CO.TZ"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Simu ya Huduma (Sales/Phone)</span>
                                <Input 
                                  value={goldSalesPhone}
                                  onChange={(e) => setGoldSalesPhone(e.target.value)}
                                  placeholder="+255 7XX XXX XXX"
                                  className="bg-black/60 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Barua Pepe ya Msaada (Support Email)</span>
                              <Input 
                                value={goldSupportEmail}
                                onChange={(e) => setGoldSupportEmail(e.target.value.toUpperCase())}
                                placeholder="SUPPORT@AGIZA.CO.TZ"
                                className="bg-black/60 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Controls for Single Table Stand */}
                      {standDisplayLayout === 'single_stand' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          {/* 1. Material & Stand Style Selector */}
                          <div className="space-y-3.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] px-1 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" /> Aina ya Stand ya Mezani (Stand Material & Style)
                              </label>
                              <span className="text-[9px] font-bold text-neutral-400 uppercase">5 Mitindo ya Kisasa</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {[
                                { id: 'acrylic' as const, name: 'Acrylic Glass', swahili: 'Kioo cha Acrylic', desc: 'Clear translucent & crystal gloss', icon: '🪟', badge: 'POPULAR' },
                                { id: 'wood' as const, name: 'Wooden Block', swahili: 'Mbao ya Kisasa', desc: 'Mahogany & Teak wood finish', icon: '🪵', badge: 'WARM' },
                                { id: 'tent' as const, name: 'Table Tent', swahili: 'Kadi ya Pembetatu', desc: 'Foldable double-sided card', icon: '⛺', badge: 'CLASSIC' },
                                { id: 'gold_metal' as const, name: 'Gold Metal', swahili: 'Dhahabu ya Kifahari', desc: 'Brushed brass & luxury obsidian', icon: '🏆', badge: 'VIP LUXURY' },
                                { id: 'dark_modern' as const, name: 'Bar / Lounge', swahili: 'Stand ya Bar & Giza', desc: 'Matte black & neon amber glow', icon: '🍸', badge: 'NIGHTCLUB' }
                              ].map((st) => (
                                <button
                                  key={st.id}
                                  onClick={() => {
                                    setTableStandStyle(st.id);
                                    setPrintDetails((prev: any) => ({
                                      ...prev,
                                      isPrintMode: true,
                                      headerBg: st.id === 'acrylic' ? '#ffffff' : st.id === 'wood' ? '#78350f' : st.id === 'gold_metal' ? '#171717' : st.id === 'dark_modern' ? '#0a0a0a' : '#1e293b',
                                      contentBg: st.id === 'acrylic' ? '#ffffff' : st.id === 'wood' ? '#fef3c7' : st.id === 'gold_metal' ? '#0a0a0a' : st.id === 'dark_modern' ? '#09090b' : '#ffffff',
                                      accentColor: st.id === 'gold_metal' ? '#d97706' : st.id === 'dark_modern' ? '#f97316' : '#ea580c'
                                    }));
                                  }}
                                  className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                                    tableStandStyle === st.id
                                      ? 'bg-orange-600/15 border-orange-500 text-white ring-1 ring-orange-500/50 shadow-lg shadow-orange-950/30'
                                      : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:border-white/20 hover:bg-neutral-900'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xl">{st.icon}</span>
                                    <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                                      tableStandStyle === st.id ? 'bg-orange-600 text-white' : 'bg-white/5 text-neutral-500'
                                    }`}>
                                      {st.badge}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-black uppercase text-white truncate">{st.swahili}</h4>
                                  <p className="text-[9px] text-neutral-400 truncate mt-0.5">{st.name}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Callout Headline */}
                          <div className="space-y-3 pt-2">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">
                              Wito wa Stand / Callout Headline
                            </label>
                            <Input 
                              placeholder="SCAN & AGIZA HAPA"
                              className="bg-neutral-900 border-white/10 h-11 rounded-xl text-white font-black text-xs uppercase tracking-wider"
                              value={standCallout}
                              onChange={(e) => setStandCallout(e.target.value.toUpperCase())}
                            />
                          </div>
                        </div>
                      )}

                      {/* Guest WiFi & Table Info (Shared for all table stand formats) */}
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest block">Nambari ya Meza (Table # / Section)</span>
                            <Input 
                              placeholder="21 au #21"
                              className="bg-neutral-900 border-white/10 h-10 rounded-xl text-white font-mono font-black text-center text-sm focus:ring-1 focus:ring-amber-500 uppercase"
                              value={selectedSection?.number || '21'}
                              onChange={(e) => {
                                if (selectedSection) {
                                  setSelectedSection({ ...selectedSection, number: e.target.value });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest block">Idadi ya Viti (Capacity)</span>
                            <Input 
                              placeholder="4 Viti"
                              className="bg-neutral-900 border-white/10 h-10 rounded-xl text-white font-black text-center text-xs focus:ring-1 focus:ring-amber-500 uppercase"
                              value={printDetails.customSeating || (selectedSection?.capacity ? `${selectedSection.capacity} VITI` : '4 VITI')}
                              onChange={(e) => setPrintDetails({ ...printDetails, customSeating: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Guest WiFi Toggle */}
                        <div className="bg-neutral-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5 text-left">
                              <div className="flex items-center gap-2">
                                <Wifi className="w-3.5 h-3.5 text-amber-400" />
                                <label className="text-[10px] font-black text-white uppercase tracking-[0.2em]">WiFi ya Wageni kwenye Stand</label>
                              </div>
                              <p className="text-[8.5px] text-neutral-400 font-medium">Onyesha jina na nenosiri la WiFi moja kwa moja kwenye stand</p>
                            </div>
                            <button 
                              onClick={() => setShowWifiOnStand(!showWifiOnStand)}
                              className={`w-12 h-6 rounded-full transition-all relative flex items-center px-1 shrink-0 cursor-pointer ${showWifiOnStand ? 'bg-amber-600' : 'bg-neutral-800'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${showWifiOnStand ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                          </div>

                          {showWifiOnStand && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 animate-in fade-in duration-200">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Jina la WiFi (SSID)</span>
                                <Input 
                                  placeholder="e.g. Serena-Guest"
                                  className="bg-neutral-950 border-white/10 h-9 rounded-xl text-white font-mono text-xs"
                                  value={standWifiName}
                                  onChange={(e) => setStandWifiName(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">Nenosiri (Password)</span>
                                <Input 
                                  placeholder="e.g. karibu2026 (au BURE)"
                                  className="bg-neutral-950 border-white/10 h-9 rounded-xl text-white font-mono text-xs"
                                  value={standWifiPass}
                                  onChange={(e) => setStandWifiPass(e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Pattern Shape (Available for all modes) */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">
                      Mchoro wa QR (Pattern Dots & Corners)
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {(['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'] as DotType[]).map((type, tIdx) => (
                        <button
                          key={`qr-dot-style-${type}-${tIdx}`}
                          onClick={() => setPatternShape(type)}
                          className={`aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                            patternShape === type 
                              ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-950/30' 
                              : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                          }`}
                        >
                          <div className="w-6 h-6 border border-current rounded-xs flex flex-wrap p-0.5 gap-0.5 overflow-hidden opacity-90">
                             {Array.from({length: 4}).map((_, i) => (
                               <div key={`qr-dot-sub-${type}-${i}`} className={`w-1.5 h-1.5 bg-current ${
                                 type === 'dots' ? 'rounded-full' : 
                                 type === 'rounded' ? 'rounded-xs' : 
                                 'rounded-none'
                               }`}></div>
                             ))}
                          </div>
                          <span className="text-[7.5px] font-black uppercase tracking-tighter truncate px-1">{type.replace('-', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corner Square & Dot style */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">Corner Style (Macho ya QR)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['square', 'dot', 'extra-rounded', 'rounded'] as any[]).map((type, tIdx) => (
                        <button
                          key={`qr-eye-style-${type}-${tIdx}`}
                          onClick={() => setCornerStyle(type)}
                          className={`h-12 rounded-xl border transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                            cornerStyle === type 
                              ? 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-950/30' 
                              : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-5 h-5 border-2 border-current flex items-center justify-center ${
                             type === 'dot' ? 'rounded-full' : 
                             type === 'extra-rounded' ? 'rounded-md' : 
                             'rounded-none'
                          }`}>
                             <div className={`w-1.5 h-1.5 bg-current ${type === 'dot' ? 'rounded-full' : type === 'extra-rounded' ? 'rounded-xs' : 'rounded-none'}`}></div>
                          </div>
                          <span className="text-[8.5px] font-black uppercase tracking-wider">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode: Store Placard / Banner Controls */}
                  {qrBuilderMode === 'store_placard' && (
                    <div className="space-y-6 pt-4 border-t border-white/5">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">Kichwa cha Bango (Header Text)</label>
                        <Input 
                          placeholder="JINA LA DUKA AU HUDUMA"
                          className="bg-neutral-900 border-white/10 h-11 rounded-xl text-white font-black text-xs uppercase tracking-wider"
                          value={printDetails.header}
                          onChange={(e) => setPrintDetails({ ...printDetails, header: e.target.value.toUpperCase() })}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">Maelezo ya Chini (Footer Text)</label>
                        <Input 
                          placeholder="Changanua kuona bidhaa & kuagiza papo hapo"
                          className="bg-neutral-900 border-white/10 h-11 rounded-xl text-white text-xs font-medium"
                          value={printDetails.footer}
                          onChange={(e) => setPrintDetails({ ...printDetails, footer: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest block">Simu ya Mawasiliano</span>
                          <Input 
                            placeholder="+255 7..."
                            className="bg-neutral-900 border-white/10 h-10 rounded-xl text-white text-xs font-mono"
                            value={printDetails.phone}
                            onChange={(e) => setPrintDetails({ ...printDetails, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest block">Eneo / Mtaa</span>
                          <Input 
                            placeholder="Mtaa / Jiji"
                            className="bg-neutral-900 border-white/10 h-10 rounded-xl text-white text-xs"
                            value={printDetails.address}
                            onChange={(e) => setPrintDetails({ ...printDetails, address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode: QR Only Controls */}
                  {qrBuilderMode === 'qr_only' && (
                    <div className="space-y-6 pt-4 border-t border-white/5">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">Scale & Resolution / Vipimo vya Kupakua</label>
                        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-neutral-400">Ukubwa wa Picha:</span>
                            <span className="text-xs font-mono font-black text-amber-400">{exportSize * 10} x {exportSize * 10} px</span>
                          </div>
                          <input 
                            type="range"
                            min="50"
                            max="300"
                            step="10"
                            value={exportSize}
                            onChange={(e) => setExportSize(parseInt(e.target.value))}
                            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Frame Style & Textures */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 block">Frame Style / Fremu ya QR</label>
                        <Select 
                          value={frameStyle}
                          onValueChange={(val: any) => setFrameStyle(val)}
                        >
                          <SelectTrigger className="bg-neutral-900 border-white/10 h-12 rounded-xl text-white font-bold text-left">
                            <SelectValue placeholder="Chagua Frame Style" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-white/10 text-white">
                            <SelectItem value="none">No Frame (Plain QR)</SelectItem>
                            <SelectItem value="simple">Simple Outline (Fremu ya Kawaida)</SelectItem>
                            <SelectItem value="bottom-label">Bottom Banner (Fremu yenye Maandishi Chini)</SelectItem>
                            <SelectItem value="top-bottom-label">Top & Bottom Banner (Fremu ya Juu na Chini)</SelectItem>
                            <SelectItem value="card">Card / Polaroid Stand (Style ya Kadi)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                </div>
                )}

                {/* Right Panel: Live Stand Preview & Download Actions */}
                <div className="lg:w-[540px] bg-[#070709] p-4 sm:p-6 flex flex-col items-center justify-between gap-5 relative overflow-y-auto custom-scrollbar border-t lg:border-t-0 lg:border-l border-white/5 min-h-[620px]">
                  
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Live Stand Preview</span>
                    </div>
                    {qrBuilderMode === 'table_stand' && (
                      <span className="text-[8.5px] font-mono font-bold text-amber-400 uppercase bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        {standDisplayLayout === 'gold_menu_showcase' ? 'LUXURY GOLD PLACARD' : `${tableStandStyle.toUpperCase()} STYLE`}
                      </span>
                    )}
                  </div>

                  {/* STAND YA MEZANI PREVIEW: LUXURY GOLD MENU SHOWCASE (MATCHING USER IMAGE 100%) */}
                  {qrBuilderMode === 'table_stand' && standDisplayLayout === 'gold_menu_showcase' && (
                    <div className="w-full flex flex-col items-center justify-center py-1">
                      <div 
                        id="printable-stand" 
                        className="w-full max-w-[420px] rounded-[2.5rem] overflow-hidden relative shadow-[0_30px_90px_rgba(0,0,0,0.95)] border-2 text-amber-100 p-4 sm:p-5"
                        style={{
                          background: `radial-gradient(ellipse at top, ${goldBgColorStart} 0%, ${goldCardBgColor} 45%, ${goldBgColorEnd} 100%)`,
                          borderColor: `${goldPrimaryColor}b3`,
                          boxShadow: `0 0 35px ${goldAccentColor}26`,
                        }}
                      >
                        {/* Background Ambiance Glow & Bokeh */}
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 50% 0%, ${goldAccentColor}2e 0%, transparent 60%)`,
                          }}
                        ></div>
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 10% 80%, ${goldPrimaryColor}1f 0%, transparent 40%)`,
                          }}
                        ></div>
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 90% 80%, ${goldPrimaryColor}1f 0%, transparent 40%)`,
                          }}
                        ></div>

                        {/* Top Hanging Boards with Ropes */}
                        <div className="relative z-20 flex items-start justify-between mb-1 px-1">
                          {/* Left Hanging Sign: Fresh Tasty Healthy */}
                          <div className="flex flex-col items-center">
                            {/* Ropes */}
                            <div className="flex justify-between w-8 h-3 px-1">
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                            </div>
                            {/* Wooden Plank */}
                            <div className="px-2.5 py-1 rounded-md bg-[#2b170c] border border-[#78350f] shadow-md text-center">
                              <p className="text-[7.5px] font-serif italic leading-tight" style={{ color: goldTextColor }}>Fresh</p>
                              <p className="text-[7.5px] font-bold text-amber-100 leading-tight">Tasty ♡</p>
                              <p className="text-[7px] leading-tight" style={{ color: goldPrimaryColor }}>Healthy</p>
                            </div>
                          </div>

                          {/* Center Crest / Vendor Logo: Circular Seal */}
                          <div className="flex flex-col items-center justify-center -mt-1 relative z-30">
                            {showGoldLogo && (goldLogoUrl || vendorProfile?.logoUrl) ? (
                              <div 
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center relative p-1 border-2 shadow-xl overflow-hidden group bg-black/70"
                                style={{
                                  borderColor: goldPrimaryColor,
                                  boxShadow: `0 0 20px ${goldAccentColor}80, inset 0 0 12px rgba(0,0,0,0.8)`,
                                }}
                              >
                                <img 
                                  src={getProxiedImageUrl(goldLogoUrl || vendorProfile?.logoUrl || '')} 
                                  alt="Logo" 
                                  className="w-full h-full object-contain rounded-full drop-shadow-md"
                                />
                                <div 
                                  className="absolute inset-0 rounded-full pointer-events-none border"
                                  style={{ borderColor: `${goldPrimaryColor}4d` }}
                                ></div>
                              </div>
                            ) : (
                              <div 
                                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center relative p-1 border-2 shadow-lg"
                                style={{
                                  background: `linear-gradient(to bottom, ${goldBgColorStart}, #0d0905, ${goldCardBgColor})`,
                                  borderColor: goldPrimaryColor,
                                  boxShadow: `0 0 16px ${goldAccentColor}66`,
                                }}
                              >
                                <div className="text-[5.5px] font-black uppercase tracking-widest text-center leading-none" style={{ color: goldTextColor }}>
                                  {vendorProfile?.businessName?.slice(0, 10) || 'RESTAURANT'}
                                </div>
                                <div className="text-[4.5px] font-mono tracking-tighter mb-0.5" style={{ color: `${goldTextColor}cc` }}>
                                  {goldMenuSince || 'SINCE 2023'}
                                </div>
                                <div className="flex items-center justify-center gap-1 my-0.5">
                                  <Utensils className="w-3.5 h-3.5" style={{ color: goldPrimaryColor }} />
                                  <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
                                </div>
                                <div className="text-[5.5px]" style={{ color: goldPrimaryColor }}>★ ⚜ ★</div>
                              </div>
                            )}
                          </div>

                          {/* Right Hanging Sign: Karibu Sana */}
                          <div className="flex flex-col items-center">
                            {/* Ropes */}
                            <div className="flex justify-between w-8 h-3 px-1">
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                              <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                            </div>
                            {/* Wooden Plank */}
                            <div className="px-2.5 py-1 rounded-md bg-[#2b170c] border border-[#78350f] shadow-md text-center">
                              <p className="text-[7.5px] font-black uppercase tracking-wider leading-tight" style={{ color: goldTextColor }}>KARIBU</p>
                              <p className="text-[7.5px] font-black uppercase tracking-wider text-amber-100 leading-tight">SANA!</p>
                              <p className="text-[8px] text-red-500 leading-tight">❤️</p>
                            </div>
                          </div>
                        </div>

                        {/* Giant 3D Gold Metallic Title */}
                        <div className="text-center relative z-10 mt-1 mb-2">
                          <h1 
                            className="text-xl sm:text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans"
                            style={{
                              backgroundImage: `linear-gradient(to bottom, #ffffff, ${goldTextColor}, ${goldPrimaryColor}, ${goldAccentColor})`
                            }}
                          >
                            {printDetails.header || vendorProfile?.businessName || 'RESTAURANTKISINIA'}
                          </h1>
                          
                          {/* Gold Pill Subtitle Banner */}
                          <div 
                            className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full shadow-sm mt-1 border"
                            style={{
                              background: `linear-gradient(to right, ${goldAccentColor}33, ${goldPrimaryColor}4d, ${goldAccentColor}33)`,
                              borderColor: `${goldPrimaryColor}99`,
                            }}
                          >
                            <span className="text-[6.5px]" style={{ color: goldPrimaryColor }}>◆</span>
                            <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-[0.18em]" style={{ color: goldTextColor }}>
                              {goldMenuBanner || 'DELICIOUS FOOD • GREAT TASTE • HAPPY YOU'}
                            </span>
                            <span className="text-[6.5px]" style={{ color: goldPrimaryColor }}>◆</span>
                          </div>
                        </div>

                        {/* Real Featured Food Items Showcase (ONLY IF PRODUCTS EXIST & ARE ENABLED) */}
                        {showGoldDishes && showcaseDishes.length > 0 && (
                          <div className="space-y-2.5 relative z-10 my-2">
                            {showcaseDishes.map((dish, dIdx) => {
                              const itemQrLink = `${window.location.origin}/table/${vendorProfile?.id || ''}/${selectedSection?.number || '21'}?item=${encodeURIComponent(dish.name)}`;
                              return (
                                <div 
                                  key={`gold-dish-card-v2-${dish.id}-${dIdx}`}
                                  className="relative rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.6)] border"
                                  style={{
                                    background: `linear-gradient(to right, ${goldCardBgColor}f2, #0d0803f2, ${goldCardBgColor}f2)`,
                                    borderColor: `${goldPrimaryColor}88`,
                                  }}
                                >
                                  {/* Left: Circular Dish Image with Gold Ring & Rosette Badge */}
                                  <div className="relative shrink-0 flex flex-col items-center">
                                    {/* Rosette Badge Tag */}
                                    <div 
                                      className="absolute -top-2 -left-1.5 z-20 px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider shadow-md border flex flex-col items-center justify-center leading-none text-center"
                                      style={{ 
                                        backgroundColor: dish.badgeColor || (dIdx === 0 ? '#dc2626' : dIdx === 1 ? '#15803d' : '#1d4ed8'),
                                        borderColor: 'rgba(255,255,255,0.6)',
                                        color: '#ffffff'
                                      }}
                                    >
                                      <span>{dish.badge || (dIdx === 0 ? 'BEST SELLER' : dIdx === 1 ? "CHEF'S CHOICE" : 'FRESH & NATURAL')}</span>
                                      <span className="text-[5px] tracking-widest" style={{ color: goldTextColor }}>★★★</span>
                                    </div>

                                    {/* Dish Image */}
                                    <div 
                                      className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden border-2 bg-neutral-900 shrink-0"
                                      style={{
                                        borderColor: goldPrimaryColor,
                                        boxShadow: `0 0 14px ${goldAccentColor}66`,
                                      }}
                                    >
                                      <img 
                                        src={getProxiedImageUrl(dish.imageUrl) || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'} 
                                        alt={dish.name} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>

                                  {/* Middle: Title, Price, Dotted Line, Description */}
                                  <div className="flex-1 min-w-0 pr-1 text-left">
                                    <div className="flex items-center gap-1 leading-tight mb-0.5">
                                      <h4 className="text-xs sm:text-[13px] font-black uppercase text-amber-50 tracking-tight leading-snug">
                                        {dish.name}
                                      </h4>
                                      <span className="text-xs shrink-0">{dish.emoji}</span>
                                    </div>

                                    <div className="text-xs sm:text-sm font-black font-serif leading-tight" style={{ color: goldTextColor }}>
                                      TSH {dish.price}
                                    </div>

                                    {/* Gold Dotted Divider */}
                                    <div className="my-1 border-b border-dotted" style={{ borderColor: `${goldPrimaryColor}99` }}></div>

                                    <p className="text-[7.5px] sm:text-[8.5px] font-medium leading-tight line-clamp-2 italic" style={{ color: `${goldTextColor}cc` }}>
                                      {dish.description}
                                    </p>
                                  </div>

                                  {/* Right: High-Contrast QR Code + SCAN TO ORDER Button */}
                                  <div className="shrink-0 flex flex-col items-center justify-center text-center">
                                    <div className="p-1 bg-white rounded-lg shadow-md border" style={{ borderColor: `${goldPrimaryColor}99` }}>
                                      <MiniQrCode 
                                        data={itemQrLink} 
                                        size={48} 
                                        dotsColor="#000000"
                                        dotsType={patternShape}
                                      />
                                    </div>
                                    <div 
                                      className="mt-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] border font-black text-[6.5px] uppercase tracking-wider shadow-xs whitespace-nowrap"
                                      style={{
                                        borderColor: goldPrimaryColor,
                                        color: goldTextColor,
                                      }}
                                    >
                                      SCAN TO ORDER
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* "INGIA KWENYE DUKA" Main CTA Card (Matching Bottom Banner) */}
                        <div 
                          className="relative border-2 rounded-2xl p-2.5 sm:p-3 my-2 flex items-center justify-between gap-2 shadow-[0_6px_25px_rgba(0,0,0,0.7)] relative z-10"
                          style={{
                            background: `linear-gradient(to right, ${goldCardBgColor}, #0a0602, ${goldCardBgColor})`,
                            borderColor: `${goldPrimaryColor}b3`,
                          }}
                        >
                          {/* Left: Store QR with chalk arrow */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-center">
                              <span className="text-[7px] font-serif italic block -rotate-6" style={{ color: goldTextColor }}>Scan hapa!</span>
                              <div className="text-xs" style={{ color: goldPrimaryColor }}>↷</div>
                            </div>
                            <div className="p-1 bg-white rounded-xl shadow-md border" style={{ borderColor: `${goldPrimaryColor}80` }}>
                              <MiniQrCode 
                                data={`${window.location.origin}/store/${vendorProfile?.id || ''}`} 
                                size={52} 
                                dotsColor="#000000"
                                dotsType={patternShape}
                              />
                            </div>
                          </div>

                          {/* Center: Title & Red Badge */}
                          <div className="flex-1 text-center min-w-0 px-1">
                            <h3 className="text-[10px] sm:text-xs font-black italic uppercase tracking-wider text-neutral-300 leading-none">
                              INGIA KWENYE
                            </h3>
                            <h2 
                              className="text-lg sm:text-xl font-black uppercase tracking-wider leading-tight text-transparent bg-clip-text"
                              style={{
                                backgroundImage: `linear-gradient(to bottom, #ffffff, ${goldTextColor}, ${goldPrimaryColor}, ${goldAccentColor})`
                              }}
                            >
                              DUKA
                            </h2>
                            <div className="inline-block px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[6.5px] uppercase tracking-widest shadow-xs">
                              CHANGANUA KWA SIMU YAKO
                            </div>
                            <p className="text-[6.5px] font-bold uppercase mt-0.5 truncate" style={{ color: `${goldTextColor}cc` }}>
                              FUNGUA DUKA KAMILI & PATA BIDHAA ZOTE!
                            </p>
                          </div>

                          {/* Right: Golden Easy Shopping Seal */}
                          <div className="shrink-0 flex flex-col items-center justify-center">
                            <div 
                              className="w-11 h-11 rounded-full border flex flex-col items-center justify-center shadow-md text-center p-1"
                              style={{
                                background: `linear-gradient(to bottom, #2b170c, #0a0502)`,
                                borderColor: goldAccentColor,
                              }}
                            >
                              <ShoppingCart className="w-4 h-4 mb-0.5" style={{ color: goldPrimaryColor }} />
                              <span className="text-[5.5px] font-black uppercase leading-none" style={{ color: goldTextColor }}>EASY</span>
                              <span className="text-[5px] font-bold uppercase leading-none" style={{ color: `${goldTextColor}cc` }}>SHOPPING</span>
                            </div>
                          </div>
                        </div>

                        {/* Guest WiFi Info Plaque (If enabled) */}
                        {showWifiOnStand && standWifiName && (
                          <div 
                            className="p-2 rounded-xl border flex items-center justify-between gap-2 relative z-10 my-1.5 shadow-sm"
                            style={{
                              background: `linear-gradient(to right, ${goldCardBgColor}cc, #0c0804cc)`,
                              borderColor: `${goldPrimaryColor}66`,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Wifi className="w-3.5 h-3.5" style={{ color: goldPrimaryColor }} />
                              <div>
                                <span className="text-[7.5px] font-black uppercase tracking-wider block whitespace-nowrap" style={{ color: goldTextColor }}>GUEST WI-FI</span>
                                <span className="text-[8.5px] font-mono font-bold text-white leading-none">{standWifiName}</span>
                              </div>
                            </div>
                            {standWifiPass && (
                              <div className="text-right">
                                <span className="text-[6.5px] font-black text-neutral-400 uppercase tracking-widest block">PASSWORD</span>
                                <span className="text-[8px] font-mono font-bold text-amber-200">{standWifiPass}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bottom 3 Metallic Widget Cards: Section, Seating, Highlights */}
                        <div className="grid grid-cols-3 gap-1.5 relative z-10 my-2">
                          {/* Card 1: Section / Meza */}
                          <div 
                            className="p-2 rounded-xl border text-center flex flex-col items-center justify-center shadow-sm"
                            style={{
                              background: `linear-gradient(to bottom, ${goldCardBgColor}e6, #120a04e6)`,
                              borderColor: `${goldPrimaryColor}80`,
                            }}
                          >
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                              <Utensils className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                              <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: goldTextColor }}>SECTION</span>
                            </div>
                            <span className="text-sm font-black font-mono text-white">#{selectedSection?.number || '21'}</span>
                          </div>

                          {/* Card 2: Seating / Viti */}
                          <div 
                            className="p-2 rounded-xl border text-center flex flex-col items-center justify-center shadow-sm"
                            style={{
                              background: `linear-gradient(to bottom, ${goldCardBgColor}e6, #120a04e6)`,
                              borderColor: `${goldPrimaryColor}80`,
                            }}
                          >
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                              <Users className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                              <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: goldTextColor }}>SEATING</span>
                            </div>
                            <span className="text-sm font-black text-white flex items-center justify-center gap-1">
                              <span>👥</span> {selectedSection?.capacity || '4'}
                            </span>
                          </div>

                          {/* Card 3: Maalumu Yetu / Checklist */}
                          <div 
                            className="p-2 rounded-xl border text-left flex flex-col justify-center shadow-sm"
                            style={{
                              background: `linear-gradient(to bottom, ${goldCardBgColor}e6, #120a04e6)`,
                              borderColor: `${goldPrimaryColor}80`,
                            }}
                          >
                            <span className="text-[6.5px] font-black uppercase tracking-wider text-center block mb-0.5" style={{ color: goldTextColor }}>MAALUMU YETU</span>
                            <div className="space-y-0.5 text-[6px] text-amber-100 font-medium">
                              <p className="truncate">☑ Ladha Halisi</p>
                              <p className="truncate">☑ Huduma Bora</p>
                              <p className="truncate">☑ Bei Fair</p>
                              <p className="truncate flex items-center gap-0.5">
                                <span>☑ Wateja wa Furahi</span>
                                <span className="text-[7px] text-red-500">❤️</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Gold Footer Bar with Official Vendor Portal & Contacts */}
                        <div 
                          className="relative z-10 pt-2 border-t flex items-center justify-between text-[6.5px] font-mono text-neutral-400"
                          style={{
                            borderColor: `${goldPrimaryColor}4d`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                            <div>
                              <span className="block text-[5.5px] text-neutral-500 uppercase leading-none">OFFICIAL VENDOR PORTAL:</span>
                              <span className="font-bold uppercase leading-none" style={{ color: goldTextColor }}>{goldWebsiteUrl || 'WWW.AGIZA.CO.TZ'}</span>
                            </div>
                          </div>

                          {/* Central Mini Seal */}
                          <div className="flex flex-col items-center">
                            <div 
                              className="w-5 h-5 rounded-full border flex items-center justify-center"
                              style={{
                                borderColor: goldPrimaryColor,
                                background: '#000000',
                              }}
                            >
                              <Crown className="w-2.5 h-2.5" style={{ color: goldPrimaryColor }} />
                            </div>
                            <span className="text-[4.5px] font-black uppercase mt-0.5 tracking-tighter" style={{ color: goldTextColor }}>AGIZA.CO.TZ</span>
                          </div>

                          <div className="text-right">
                            <span className="block text-[5.5px] text-neutral-500 uppercase leading-none">SUPPORT: <span className="font-bold uppercase" style={{ color: goldTextColor }}>{goldSupportEmail || 'SUPPORT@AGIZA.CO.TZ'}</span></span>
                            <span className="block text-[5.5px] text-neutral-500 uppercase leading-none mt-0.5">SALES: <span className="font-bold text-amber-200">{goldSalesPhone || '+255 7XX XXX XXX'}</span></span>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* STAND YA MEZANI PREVIEW: SINGLE TABLE STAND */}
                  {qrBuilderMode === 'table_stand' && standDisplayLayout === 'single_stand' && (
                    <div className="w-full flex flex-col items-center justify-center py-2">
                      <div 
                        id="printable-stand" 
                        className={`w-full max-w-[340px] rounded-[2rem] overflow-hidden transition-all duration-300 relative shadow-2xl ${
                          tableStandStyle === 'acrylic' 
                            ? 'bg-gradient-to-b from-white via-neutral-50 to-neutral-100 text-neutral-900 border-4 border-white/80 ring-4 ring-neutral-300/40 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]'
                            : tableStandStyle === 'wood'
                            ? 'bg-[#3e1f0e] text-[#fef3c7] border-4 border-[#5c2e14] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]'
                            : tableStandStyle === 'gold_metal'
                            ? 'bg-[#0f0f11] text-amber-100 border-4 border-amber-600/60 ring-2 ring-amber-500/30 shadow-[0_25px_60px_-15px_rgba(217,119,6,0.3)]'
                            : tableStandStyle === 'dark_modern'
                            ? 'bg-[#0b0b0e] text-white border-2 border-orange-500/40 ring-4 ring-orange-950/60 shadow-[0_25px_60px_-15px_rgba(234,88,12,0.3)]'
                            : 'bg-white text-neutral-900 border-4 border-neutral-200 shadow-2xl'
                        }`}
                      >
                        {/* Stand Header Bar */}
                        <div className={`p-4 text-center relative z-10 flex flex-col items-center justify-center ${
                          tableStandStyle === 'acrylic' ? 'bg-neutral-950 text-white' :
                          tableStandStyle === 'wood' ? 'bg-[#291307] text-amber-100 border-b border-[#5c2e14]' :
                          tableStandStyle === 'gold_metal' ? 'bg-gradient-to-r from-amber-950 via-neutral-950 to-amber-950 text-amber-300 border-b border-amber-500/30' :
                          tableStandStyle === 'dark_modern' ? 'bg-neutral-950 text-white border-b border-orange-500/20' :
                          'bg-neutral-950 text-white'
                        }`}>
                          {vendorProfile?.logoUrl && printDetails.showLogo && (
                            <img 
                              src={getProxiedImageUrl(vendorProfile.logoUrl)} 
                              alt="Logo" 
                              className="w-10 h-10 rounded-xl object-contain bg-white p-1 mb-1.5 shadow-md"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <h2 className="text-sm font-black uppercase tracking-tight truncate max-w-[260px]">
                            {printDetails.header || vendorProfile?.businessName || 'RESTAURANT & BAR'}
                          </h2>
                          <p className="text-[7.5px] font-mono uppercase tracking-[0.2em] opacity-70 mt-0.5">
                            {vendorContext.locationLabelSingular?.toUpperCase() || 'TABLE'} MENU
                          </p>
                        </div>

                        {/* Stand Body */}
                        <div className="p-5 flex flex-col items-center text-center space-y-3.5 relative z-10">
                          <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 shadow-md ${
                            tableStandStyle === 'acrylic' ? 'bg-orange-600 text-white' :
                            tableStandStyle === 'wood' ? 'bg-amber-600 text-[#1a0c04] font-black' :
                            tableStandStyle === 'gold_metal' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black' :
                            tableStandStyle === 'dark_modern' ? 'bg-orange-600 text-white shadow-orange-950/50' :
                            'bg-orange-600 text-white'
                          }`}>
                            <Utensils className="w-3 h-3" />
                            <span className="text-xs font-black uppercase tracking-wider font-mono">
                              MEZA #{selectedSection?.number || '02'}
                            </span>
                            <span className="text-[9px] opacity-80 uppercase font-bold">
                              • {printDetails.customSeating || '4 VITI'}
                            </span>
                          </div>

                          {/* Primary High-Resolution QR Card */}
                          <div className="p-3.5 bg-white rounded-2xl shadow-xl border border-black/10 flex items-center justify-center">
                            <div 
                              ref={qrPrintRef} 
                              className="flex items-center justify-center w-[140px] h-[140px] [&>canvas]:max-w-full [&>canvas]:max-h-full [&>svg]:max-w-full [&>svg]:max-h-full overflow-hidden"
                            ></div>
                          </div>

                          <div className="space-y-0.5">
                            <h3 className="text-sm font-black uppercase tracking-tight italic">
                              {standCallout || 'SCAN & AGIZA HAPA'}
                            </h3>
                            <p className="text-[8.5px] font-medium opacity-75 max-w-[220px] mx-auto leading-tight">
                              {standSubCallout || 'Changanua kwa kamera ya simu kufungua menyu & kuagiza mezani'}
                            </p>
                          </div>

                          {showWifiOnStand && (
                            <div className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-left ${
                              tableStandStyle === 'acrylic' ? 'bg-neutral-100/90 border-neutral-200 text-neutral-800' :
                              tableStandStyle === 'wood' ? 'bg-[#291307]/80 border-amber-900 text-amber-200' :
                              tableStandStyle === 'gold_metal' ? 'bg-neutral-900 border-amber-500/30 text-amber-200' :
                              tableStandStyle === 'dark_modern' ? 'bg-neutral-900 border-orange-500/20 text-neutral-200' :
                              'bg-neutral-100 border-neutral-200 text-neutral-800'
                            }`}>
                              <div className="flex items-center gap-2">
                                <Wifi className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                <div className="leading-tight">
                                  <span className="text-[7.5px] uppercase font-bold block opacity-60">FREE GUEST WIFI</span>
                                  <span className="text-[9px] font-mono font-black truncate block">{standWifiName || 'WiFi'}</span>
                                </div>
                              </div>
                              <div className="text-right leading-tight">
                                <span className="text-[7.5px] uppercase font-bold block opacity-60">PASSWORD</span>
                                <span className="text-[9px] font-mono font-black">{standWifiPass || 'BURE'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STORE PLACARD PREVIEW */}
                  {qrBuilderMode === 'store_placard' && (
                    <div className="w-full flex flex-col items-center justify-center py-2">
                      <div 
                        id="printable-stand" 
                        className="w-full max-w-[340px] bg-white text-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-neutral-200 p-6 text-center space-y-4"
                      >
                        {vendorProfile?.logoUrl && printDetails.showLogo && (
                          <img 
                            src={getProxiedImageUrl(vendorProfile.logoUrl)} 
                            alt="Logo" 
                            className="w-12 h-12 mx-auto rounded-xl object-contain bg-white p-1 shadow-sm"
                          />
                        )}
                        <h3 className="text-base font-black uppercase tracking-tight text-neutral-900">
                          {printDetails.header || vendorProfile?.businessName || 'OFFICIAL STORE'}
                        </h3>
                        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-center">
                          <div 
                            ref={qrPrintRef} 
                            className="flex items-center justify-center w-[150px] h-[150px] [&>canvas]:max-w-full [&>canvas]:max-h-full [&>svg]:max-w-full [&>svg]:max-h-full overflow-hidden"
                          ></div>
                        </div>
                        <p className="text-xs font-bold text-neutral-600">{printDetails.footer}</p>
                      </div>
                    </div>
                  )}

                  {/* QR ONLY PREVIEW */}
                  {qrBuilderMode === 'qr_only' && (
                    <div className="relative group p-6 flex flex-col items-center justify-center">
                      <div className="absolute -inset-4 bg-amber-600/20 rounded-[3rem] blur-2xl group-hover:bg-amber-600/30 transition-all duration-500"></div>
                      <div 
                        ref={qrRef} 
                        className="relative transition-all duration-500 shadow-sm p-8 bg-white rounded-[2.5rem] shadow-2xl group-hover:scale-[1.02]"
                        style={{
                          borderRadius: `${borderRound}px`,
                          border: `${borderWidth}px solid ${borderColor}`,
                          padding: `${padding}px`,
                          backgroundColor: backgroundColor,
                        }}
                      ></div>
                    </div>
                  )}

                  {/* Bottom Actions: Download Stand / Print */}
                  <div className="w-full space-y-3 max-w-[360px]">
                    {qrBuilderMode !== 'qr_only' ? (
                      <div className="space-y-2.5">
                        <Button 
                          onClick={handleDownloadStand}
                          disabled={isExporting}
                          className="w-full h-14 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white hover:brightness-110 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-950/50 transition-all cursor-pointer"
                        >
                          {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-4 h-4 mr-2.5" />} 
                          Pakua Bango / Stand ya Mezani (PNG)
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => window.print()}
                            className="w-full h-11 border-white/10 text-white hover:bg-white/5 rounded-xl font-black uppercase tracking-wider text-[10px] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 mr-2" /> Chapa (Print)
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/table/${vendorProfile?.id || ''}/${selectedSection?.number || '21'}`);
                              toast.success('Link ya meza imenakiliwa!');
                            }}
                            className="w-full h-11 border-white/10 text-amber-400 hover:bg-amber-950/30 rounded-xl font-black uppercase tracking-wider text-[10px] cursor-pointer"
                          >
                            <LinkIcon className="w-3.5 h-3.5 mr-2" /> Nakili Link
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <Button 
                          onClick={() => {
                            if (qrCodeInstance) {
                              qrCodeInstance.download({
                                name: `QR-Code-${vendorProfile?.businessName || 'Store'}`,
                                extension: "png"
                              });
                              toast.success('QR Code imepakuliwa!');
                            }
                          }}
                          className="w-full h-14 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white hover:brightness-110 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-950/50 transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4 mr-2.5" /> Pakua QR Code (PNG)
                        </Button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence><div id="order-receipt" className="fixed left-0 top-0 bg-white text-black font-sans">
        {orderToPrint && (() => {
          const isBusReceipt = orderToPrint.type === 'bus_ticket' || vendorProfile?.category === 'bus_ticket';
          if (isBusReceipt) {
            const seatsStr = Array.isArray((orderToPrint as any).selectedSeats) 
              ? (orderToPrint as any).selectedSeats.join(', ') 
              : ((orderToPrint as any).tableNumber || '25, 27, 31, 30');
            
            const busNumber = (orderToPrint as any).busNumber || (orderToPrint.items?.[0] as any)?.busNumber || 'T 315 DCS (AC)';
            const origin = orderToPrint.items?.[0]?.origin || 'Mwanza';
            const destination = orderToPrint.items?.[0]?.destination || 'Shinyanga';
            const departureDate = (orderToPrint as any).departureDate || (orderToPrint.items?.[0] as any)?.departureDate || format(getSafeDate(orderToPrint.createdAt), 'dd MMM yyyy').toUpperCase();
            const departureTime = (orderToPrint as any).departureTime || '07:24';
            
            const total = orderToPrint.totalAmount || 88500;
            const discount = Math.round(total * 0.15);
            const fare = total + discount;
            
            return (
              <div 
                className="w-[210mm] h-[99mm] bg-white border border-neutral-200 rounded-[1.5rem] p-4 flex gap-4 text-black relative uppercase overflow-hidden"
                style={{
                  boxSizing: 'border-box',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                }}
              >
                {/* Main Left Segment */}
                <div className="flex-1 flex flex-col justify-between h-full pr-2 relative animate-fade-in" style={{ width: '132mm' }}>
                  
                  {/* Top Premium Header block */}
                  <div className="bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-700 rounded-2xl p-4 text-white relative overflow-hidden flex flex-col justify-between" style={{ height: '44mm', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <div className="absolute inset-0 opacity-10 bg-no-repeat bg-contain bg-center pointer-events-none" style={{ backgroundImage: "url('https://cdn-icons-png.flaticon.com/512/1042/1042336.png')" }}></div>
                    
                    <div className="flex justify-between items-start relative z-10 w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center border border-white/10 shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="bg-red-600 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-sm tracking-widest leading-none self-start">
                            {vendorProfile?.businessName?.toUpperCase() || 'KILIMANJARO EXPRESS'}
                          </span>
                          <h2 className="text-lg font-black tracking-tight text-white leading-tight mt-1">
                            {origin.toUpperCase()} TU {destination.toUpperCase()}
                          </h2>
                        </div>
                      </div>
                      
                      <div className="border border-white/30 bg-white/10 rounded-full px-3 py-1 flex items-center gap-1.5 text-[8px] font-black tracking-widest text-white shrink-0">
                        <span>BOARDING PASS</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                        <span className="text-teal-400">CONFIRMED STATUS</span>
                      </div>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-950/40 border-t border-white/10 px-4 py-2 flex justify-between items-center text-[8px] font-black tracking-widest text-white/90">
                      <span>TIKETI YA ABIRIA (TRAVEL TICKET)</span>
                      <span className="text-amber-300 font-mono">NO: {orderToPrint.id?.toUpperCase() || 'TKT-GVCBLNQOAX'}</span>
                    </div>
                  </div>
                  
                  {/* Passenger Information grid */}
                  <div className="grid grid-cols-3 gap-2 px-1 mt-3">
                    <div className="flex flex-col">
                      <span className="text-[7.5px] text-neutral-405 font-extrabold tracking-widest leading-none mb-1">JINA LA ABIRIA (PASSENGER)</span>
                      <span className="text-[11px] font-black text-neutral-900 leading-tight truncate">{orderToPrint.customerName || 'Walk-In Passenger'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7.5px] text-neutral-405 font-extrabold tracking-widest leading-none mb-1">KITI (SEAT NO)</span>
                      <span className="text-xs font-black text-indigo-700 leading-none font-mono">{seatsStr}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7.5px] text-neutral-405 font-extrabold tracking-widest leading-none mb-1">NAMBA YA BASI</span>
                      <span className="text-[11px] font-black text-neutral-900 leading-tight font-mono">{busNumber}</span>
                    </div>
                  </div>
                  
                  {/* Trip Details row */}
                  <div className="grid grid-cols-4 gap-2 px-1 mt-2.5 border-t border-neutral-100 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[7px] text-neutral-405 font-extrabold tracking-widest leading-none">KUTOKA (FROM)</span>
                      <span className="text-[10px] font-black text-neutral-900 leading-tight mt-1">{origin}</span>
                      <span className="text-[5.5px] text-neutral-500 font-bold leading-none mt-0.5">Bus Terminal Center</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-neutral-450 font-extrabold tracking-widest leading-none">KWENDA (TO)</span>
                      <span className="text-[10px] font-black text-neutral-900 leading-tight mt-1">{destination}</span>
                      <span className="text-[5.5px] text-neutral-500 font-bold leading-none mt-0.5">Destination Hub</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-neutral-450 font-extrabold tracking-widest leading-none">TAREHE YA SAFARI</span>
                      <span className="text-[10px] font-black text-neutral-900 leading-tight mt-1 font-mono">{departureDate}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-neutral-450 font-extrabold tracking-widest leading-none">MUDA WA TIME</span>
                      <span className="text-[10px] font-black text-neutral-900 leading-tight mt-1 font-mono">{departureTime}</span>
                    </div>
                  </div>
                  
                  {/* Financial & QR block */}
                  <div className="flex gap-3 px-1 mt-2 mb-1.5 h-12">
                    <div className="flex-1 bg-neutral-50 border border-neutral-200/60 rounded-xl p-2 flex flex-col justify-between text-[8px] font-bold text-neutral-600">
                      <div className="flex justify-between items-center border-b border-neutral-100 pb-0.5 leading-none">
                        <span>NAULI KUU (FARE):</span>
                        <span className="font-mono text-neutral-900">TZS {fare.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-neutral-100 py-0.5 leading-none">
                        <span>PUNGUZO / WAIVE:</span>
                        <span className="font-mono text-red-650">-TZS {discount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-0.5 font-black leading-none">
                        <span className="text-neutral-950 uppercase tracking-tighter">JUMLA KUU:</span>
                        <span className="text-emerald-600 font-mono text-[9px]">TZS {total.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center border border-neutral-200/50 rounded-xl px-2.5 bg-neutral-50/40 shrink-0">
                      <div className="flex gap-1.5 items-center mb-0.5 text-neutral-800">
                        <svg className="w-4 h-4 text-orange-650" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div className="flex flex-col leading-none">
                          <span className="text-[5px] font-black uppercase text-neutral-400 leading-none font-mono">M-MONEY</span>
                          <span className="text-[6.5px] font-black text-neutral-905 leading-none">PAID OK</span>
                        </div>
                      </div>
                      <span className="text-[5.5px] text-indigo-900 font-black tracking-wider leading-none mt-1">LIPA KIELEKTRONIKI</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center border border-neutral-200/50 rounded-xl px-3 bg-neutral-50/40 shrink-0">
                      <span className="text-[5.5px] text-neutral-400 font-black tracking-widest uppercase self-start leading-none mb-1">SIMBA-PAY NO</span>
                      <div className="flex items-end gap-[1.5px] h-4 overflow-hidden">
                        {[1,3,1,2,4,1,2,1,3,2,1,4,2,1,1,3,1,2,4,1].map((w, idx) => (
                          <div key={idx} className="bg-black h-full" style={{ width: `${w}px` }}></div>
                        ))}
                      </div>
                      <span className="text-[6px] text-neutral-500 font-mono tracking-tighter mt-1 leading-none">TKT-{orderToPrint.id ? orderToPrint.id.slice(-8).toUpperCase() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Perforated Vertical Divider */}
                <div className="relative flex flex-col justify-between items-center w-px h-full">
                  <div className="absolute -top-[23px] left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-neutral-200 z-20"></div>
                  <div className="border-l border-dashed border-neutral-300 h-full w-0"></div>
                  <div className="absolute -bottom-[23px] left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-neutral-200 z-20"></div>
                </div>
                
                {/* Right Stub Segment */}
                <div className="w-[62mm] flex flex-col justify-between h-full pl-2">
                  <div className="bg-gradient-to-br from-purple-650 to-indigo-600 p-3 rounded-2xl text-white text-center flex flex-col justify-center relative overflow-hidden" style={{ height: '32mm', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <span className="bg-white/20 rounded-full px-2 py-0.5 inline-block text-[6.5px] font-black tracking-widest mx-auto mb-1 uppercase text-white/95">TRAVELER COPY</span>
                    <h3 className="text-xs font-black uppercase tracking-tight text-white leading-tight truncate">
                      {vendorProfile?.businessName || 'KILIMANJARO EXPRESS'}
                    </h3>
                    <p className="text-[7px] text-purple-200 font-extrabold uppercase tracking-widest mt-1">PASSENGER STUB</p>
                    <p className="text-[7.5px] text-purple-200 font-black uppercase tracking-tight mt-1 truncate">
                      {origin.toUpperCase()} TU {destination.toUpperCase()}
                    </p>
                  </div>
                  
                  <div className="space-y-1.5 mt-2.5 px-0.5 text-[8px] font-extrabold text-neutral-600 leading-none">
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-1 leading-none">
                      <span className="text-neutral-400">TICKET NUMBER:</span>
                      <span className="text-neutral-905 font-mono font-black">{orderToPrint.id ? orderToPrint.id.slice(-8).toUpperCase() : 'GVCBLNQO'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-1 leading-none">
                      <span className="text-neutral-400">ABIRIA (NAME):</span>
                      <span className="text-neutral-955 truncate max-w-[90px] uppercase font-black">{orderToPrint.customerName || 'Passenger'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-1 leading-none">
                      <span className="text-neutral-400">NJIA (ROUTE):</span>
                      <span className="text-neutral-955 uppercase font-black">{origin.slice(0,3).toUpperCase()} ➔ {destination.slice(0,3).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-100 pb-1 leading-none">
                      <span className="text-neutral-400">KITI NO:</span>
                      <span className="text-purple-600 font-black font-mono text-xs">{seatsStr}</span>
                    </div>
                    <div className="flex justify-between items-center leading-none">
                      <span className="text-neutral-400">NAULI:</span>
                      <span className="text-neutral-955 font-black font-mono text-xs">TZS {total.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3 p-1.5 bg-neutral-50 rounded-xl border border-neutral-150">
                    <div className="w-11 h-11 bg-white p-0.5 border border-neutral-200 rounded-lg shrink-0 flex items-center justify-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${orderToPrint.id}`} 
                        alt="Boarding QR" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[6px] font-black text-neutral-450 uppercase tracking-widest leading-none">OFFICIAL QR PASS</span>
                      <span className="text-[7px] font-black text-neutral-900 leading-none mt-1">BOARDING CONTROL</span>
                      <span className="text-[4.5px] text-neutral-500 leading-none mt-0.5">SCAN AT BUS GATE</span>
                    </div>
                  </div>
                </div>
                
                <div className="absolute bottom-1 left-4 right-4 flex justify-between items-center text-[5.5px] font-bold text-neutral-405 tracking-widest">
                  <span>⚠️ HAKUNA KURUDISHA NAULI • MASHARTI YANAZINGATIWA</span>
                  <span>MSAADA WA WATEJA: +255 711 123 456</span>
                  <span className="uppercase text-neutral-500">Tafadhali fika kituoni nusu saa kabla ya safari kuanza</span>
                </div>
              </div>
            );
          }


          return (
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
                 <p className="text-[11px] font-bold text-neutral-900">Order #{orderToPrint.id ? orderToPrint.id.slice(-8).toUpperCase() : 'N/A'}</p>
                 <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600">
                    <span>{format(getSafeDate(orderToPrint.createdAt), 'dd-MM-yyyy')}</span>
                    <span>{format(getSafeDate(orderToPrint.createdAt), 'HH:mm')}</span>
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
                 {(orderToPrint.items || []).map((item, idx) => (
                   <div key={`print-item-${orderToPrint.id}-${idx}`} className="flex justify-between items-start text-[11px] font-bold text-neutral-900">
                      <span className="w-8 shrink-0">{item.quantity}</span>
                      <div className="flex-1 px-4">
                         <p className="uppercase leading-tight">{item.name}</p>
                         <p className="text-[9px] text-neutral-500 font-bold mt-1 uppercase italic">
                           Size: {typeof item.variation === 'object' ? ((item.variation as any)?.name || 'Regular') : (item.variation || 'Regular')}
                           {item.addOns && item.addOns.length > 0 && ` • Extras: ${item.addOns.map((a: any) => a.name).join(', ')}`}
                         </p>
                      </div>
                      <span className="w-20 text-right shrink-0">TZS {((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                   </div>
                 ))}
              </div>

              {/* Summary Totals Section */}
              <div className="w-full border-t border-dashed border-neutral-300 pt-4 space-y-2 mb-6">
                 <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                    <span>SUBTOTAL:</span>
                    <span>TZS {(orderToPrint.totalAmount || 0).toLocaleString()}</span>
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
                    <span className="text-lg font-black text-neutral-900 tracking-tighter italic">TZS {(orderToPrint.totalAmount || 0).toLocaleString()}</span>
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
          );
        })()}
      </div>

      {/* Manual Booking Modal (Reception) */}
      <AnimatePresence>
        {showManualBooking && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualBooking(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">Reception Booking</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Sajili Booking ya Walk-in</p>
                </div>
                <button onClick={() => setShowManualBooking(false)} className="text-neutral-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleManualBooking} className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Guest Name / Jina la Mgeni</label>
                       <Input 
                         required
                         className="h-14 rounded-2xl bg-neutral-800 border-none font-bold"
                         value={manualBooking.customerName}
                         onChange={e => setManualBooking({...manualBooking, customerName: e.target.value})}
                         placeholder="Full Name"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Guest Phone / Simu</label>
                       <Input 
                         required
                         className="h-14 rounded-2xl bg-neutral-800 border-none font-bold"
                         value={manualBooking.customerPhone}
                         onChange={e => setManualBooking({...manualBooking, customerPhone: e.target.value})}
                         placeholder="e.g. 0712345678"
                       />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">ID Type</label>
                          <Select 
                            value={manualBooking.guestIdType || 'Nida'} 
                            onValueChange={v => setManualBooking({...manualBooking, guestIdType: v || 'Nida'})}
                          >
                             <SelectTrigger className="h-14 rounded-2xl bg-neutral-800 border-none font-bold">
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                <SelectItem value="Nida">NIDA (Tanzania)</SelectItem>
                                <SelectItem value="Passport">Passport</SelectItem>
                                <SelectItem value="Driving License">Driving License</SelectItem>
                                <SelectItem value="Voters ID">Voters ID</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">ID Number / Namba</label>
                          <Input 
                            required
                            className="h-14 rounded-2xl bg-neutral-800 border-none font-bold"
                            value={manualBooking.guestIdNumber}
                            onChange={e => setManualBooking({...manualBooking, guestIdNumber: e.target.value})}
                            placeholder="e.g. 199XXXXXXXXXXXX"
                          />
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Room Type</label>
                          <Select 
                            value={manualBooking.roomType || ''} 
                            onValueChange={v => setManualBooking({...manualBooking, roomType: v || undefined})}
                          >
                             <SelectTrigger className="h-14 rounded-2xl bg-neutral-800 border-none font-bold">
                                <SelectValue placeholder="Choose Room" />
                             </SelectTrigger>
                             <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                ))}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Total Price (TZS)</label>
                          <Input 
                            type="number"
                            required
                            className="h-14 rounded-2xl bg-neutral-800 border-none font-bold text-orange-600"
                            value={manualBooking.totalAmount}
                            onChange={e => setManualBooking({...manualBooking, totalAmount: parseInt(e.target.value) || 0})}
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Check-In</label>
                          <Input 
                            type="date"
                            required
                            className="h-14 rounded-2xl bg-neutral-800 border-none font-bold"
                            value={manualBooking.checkInDate}
                            onChange={e => setManualBooking({...manualBooking, checkInDate: e.target.value})}
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Check-Out</label>
                          <Input 
                            type="date"
                            required
                            className="h-14 rounded-2xl bg-neutral-800 border-none font-bold"
                            value={manualBooking.checkOutDate}
                            onChange={e => setManualBooking({...manualBooking, checkOutDate: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 <Button 
                   type="submit"
                   className="w-full h-16 rounded-[1.5rem] bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest"
                 >
                    Confirm Booking
                 </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ea580c;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }

        #order-receipt {
          display: none !important;
        }

        @media print {
          body {
            visibility: hidden !important;
            background: white !important;
          }
          
          /* Show/Style stand when printing-stand class is active */
          body.printing-stand {
            visibility: hidden !important;
          }
          body.printing-stand #printable-stand,
          body.printing-stand #printable-stand * {
            visibility: visible !important;
          }
          body.printing-stand #printable-stand {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 148mm !important; /* A5 Width */
            height: 210mm !important; /* A5 Height */
            padding: 10mm !important;
            background: white !important;
            z-index: 1000000 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
          }
          body.printing-stand #order-receipt {
            display: none !important;
          }

          /* Show/Style receipt when printing-receipt class is active */
          body.printing-receipt {
            visibility: hidden !important;
          }
          body.printing-receipt #order-receipt,
          body.printing-receipt #order-receipt * {
            visibility: visible !important;
          }
          body.printing-receipt #order-receipt {
             position: fixed !important;
             left: 0 !important;
             top: 0 !important;
             width: 80mm !important;
             height: auto !important;
             background: white !important;
             color: black !important;
             padding: 10mm 6mm !important;
             z-index: 1000000 !important;
             display: flex !important;
             flex-direction: column !important;
             border: none !important;
             box-shadow: none !important;
          }
          body.printing-receipt #printable-stand {
            display: none !important;
          }
          
          body.printing-receipt:not(.bus-receipt-print) #order-receipt * {
             color: black !important;
             border-color: #d4d4d4 !important;
          }
          
          body.printing-receipt.bus-receipt-print {
             background: white !important;
          }
          body.printing-receipt.bus-receipt-print #order-receipt {
             position: fixed !important;
             left: 0mm !important;
             top: 0mm !important;
             width: 210mm !important;
             height: 99mm !important;
             background: white !important;
             color: black !important;
             padding: 0mm !important;
             z-index: 1000000 !important;
             display: flex !important;
             flex-direction: row !important;
             border: none !important;
             box-shadow: none !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
          }
          body.printing-receipt.bus-receipt-print #order-receipt * {
             border-color: inherit !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
          }
          body.printing-receipt.bus-receipt-print #order-receipt .text-white {
             color: #ffffff !important;
          }
          body.printing-receipt.bus-receipt-print #order-receipt .text-purple-200 {
             color: #e9d5ff !important;
          }
          body.printing-receipt.bus-receipt-print #order-receipt .text-amber-300 {
             color: #fcd34d !important;
          }
          body.printing-receipt.bus-receipt-print #order-receipt .text-teal-400 {
             color: #2dd4bf !important;
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
          #printable-stand h2.stand-title {
            font-size: 24pt !important;
            margin-bottom: 4pt !important;
            line-height: 1.1 !important;
          }
          #printable-stand p.stand-subtitle {
            font-size: 9pt !important;
            line-height: 1.2 !important;
          }
          #printable-stand #main-qr-card {
            width: 200px !important;
            height: 200px !important;
            margin: 20px auto !important;
            border: 2px solid #ea580c10 !important;
          }
          #printable-stand .bg-orange-600 {
             background-color: #ea580c !important;
             color: white !important;
             -webkit-print-color-adjust: exact;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }
        }
      `}} />
      {/* PapoFood Direct 3D Studio Modal */}
      <PapoFood3DStudioModal
        isOpen={is3DStudioOpen}
        onClose={() => setIs3DStudioOpen(false)}
        onSelect3DModel={(modelUrl) => {
          setNewProduct(prev => ({ ...prev, model3dUrl: modelUrl }));
          setIs3DStudioOpen(false);
        }}
        vendorId={vendorProfile?.id}
        productName={newProduct.name || 'Chakula'}
        initialModelUrl={newProduct.model3dUrl || ''}
      />
    </div>
  );
}
