import React, { useEffect, useState, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, addDoc, setDoc, getDoc, serverTimestamp, where } from 'firebase/firestore';
import { VendorProfile, Order, Product } from '../types';
import { storageService } from '../services/storageService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Check, X, ShieldAlert, Store, UserCheck, Image as ImageIcon, 
  Bell, Plus, Trash2, Send, LayoutDashboard, Megaphone, Home,
  Users, ShoppingBag, DollarSign, MessageCircle, AlertTriangle,
  ExternalLink, Search, Ban, History, BarChart3, Settings, Info, CreditCard, Star, Key,
  Package, Undo2, Bike, Trophy, Wallet, MessageSquare, Globe, Clock, Coins, Moon, Loader2, Zap,
  Bed, Wifi, Wind, Monitor, Car, Waves, MapPin, Mail, Phone, PhoneCall, FileText, User, Camera,
  Menu, MoreHorizontal, MoreVertical, LayoutGrid, LogOut, ArrowUp, ArrowDown
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polygon } from 'react-leaflet';
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
  password?: string;
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

function GeofenceMapSelector({
  center,
  radius,
  active,
  type,
  polygonPoints,
  onCenterChange,
  onPolygonAddPoint,
  onPolygonRemovePoint,
  onPolygonUpdatePoint
}: {
  center: [number, number];
  radius: number;
  active: boolean;
  type: 'circle' | 'polygon';
  polygonPoints: [number, number][];
  onCenterChange: (pos: [number, number]) => void;
  onPolygonAddPoint: (pos: [number, number]) => void;
  onPolygonRemovePoint: (index: number) => void;
  onPolygonUpdatePoint: (index: number, pos: [number, number]) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e: any) {
      if (type === 'circle') {
        onCenterChange([e.latlng.lat, e.latlng.lng]);
      } else {
        onPolygonAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });

  const lat = center[0];
  const lng = center[1];

  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);

  return (
    <>
      {type === 'circle' && (
        <>
          <Marker 
            position={center} 
            draggable={true} 
            eventHandlers={{
              dragend(e: any) {
                const marker = e.target;
                if (marker != null) {
                  const pos = marker.getLatLng();
                  onCenterChange([pos.lat, pos.lng]);
                }
              }
            }}
          >
            <Popup>
              <div className="p-1 text-center">
                <span className="font-extrabold text-[10px] text-orange-600 block uppercase">KATIKATI YA HUDUMA</span>
                <span className="text-[9px] text-neutral-450 font-medium">Unaweza kunidrag!</span>
              </div>
            </Popup>
          </Marker>
          <Circle
            center={center}
            radius={radius}
            pathOptions={{
              color: active ? '#f97316' : '#9ca3af',
              fillColor: active ? '#f97316' : '#9ca3af',
              fillOpacity: 0.18,
              weight: 2,
              dashArray: '5, 5'
            }}
          />
        </>
      )}

      {type === 'polygon' && (
        <>
          {polygonPoints.map((pt, idx) => (
            <Marker
              key={`poly-marker-${idx}`}
              position={pt}
              draggable={true}
              eventHandlers={{
                dragend(e: any) {
                  const marker = e.target;
                  if (marker != null) {
                    const pos = marker.getLatLng();
                    onPolygonUpdatePoint(idx, [pos.lat, pos.lng]);
                  }
                }
              }}
            >
              <Popup>
                <div className="p-1 text-center">
                  <p className="text-[10px] font-black uppercase text-neutral-400">Pointi #{idx + 1}</p>
                  <p className="text-[8px] opacity-70">Unaweza kuiburuza ili kubadili umbo</p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPolygonRemovePoint(idx);
                    }}
                    className="mt-2 px-2.5 py-1 text-[9px] bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                  >
                    Futa Pointi
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          {polygonPoints.length >= 3 && (
            <Polygon
              positions={polygonPoints}
              pathOptions={{
                color: active ? '#f97316' : '#9ca3af',
                fillColor: active ? '#f97316' : '#9ca3af',
                fillOpacity: 0.22,
                weight: 2
              }}
            />
          )}
        </>
      )}
    </>
  );
}

const DEFAULT_PRICING_RULES: Record<string, any> = {
  "Dar es Salaam": {
    name: "Dar es Salaam",
    state: "Coast",
    country: "Tanzania",
    lat: -6.7924,
    lng: 39.2083,
    active: true,
    serviceStart: "05:00 AM",
    serviceEnd: "11:59 PM",
    nightMultiplier: 1.15,
    nightStart: "10:00 PM",
    nightEnd: "05:00 AM",
    taxName: "VAT",
    taxRate: 15,
    taxDescription: "Kodi ya Ongezeko la Thamani",
    taxActive: true,
    rates: {
      mini: { baseFare: 1000, pricePerKm: 800, pricePerMin: 100, waitingRate: 120, surgeRush: 1.25, surgeRain: 1.5 },
      bajaj: { baseFare: 500, pricePerKm: 500, pricePerMin: 0, waitingRate: 50, surgeRush: 1.15, surgeRain: 1.3 },
      bike: { baseFare: 300, pricePerKm: 350, pricePerMin: 0, waitingRate: 30, surgeRush: 1.1, surgeRain: 1.2 }
    }
  },
  "Arusha": {
    name: "Arusha",
    state: "Arusha Rural",
    country: "Tanzania",
    lat: -3.3731,
    lng: 36.6853,
    active: true,
    serviceStart: "05:00 AM",
    serviceEnd: "11:00 PM",
    nightMultiplier: 1.20,
    nightStart: "10:00 PM",
    nightEnd: "06:00 AM",
    taxName: "Tourism Development Tax",
    taxRate: 5,
    taxDescription: "Kodi ya Huduma ya Utalii",
    taxActive: true,
    rates: {
      mini: { baseFare: 1200, pricePerKm: 880, pricePerMin: 110, waitingRate: 130, surgeRush: 1.3, surgeRain: 1.6 },
      bajaj: { baseFare: 600, pricePerKm: 550, pricePerMin: 0, waitingRate: 55, surgeRush: 1.2, surgeRain: 1.4 },
      bike: { baseFare: 400, pricePerKm: 385, pricePerMin: 0, waitingRate: 35, surgeRush: 1.15, surgeRain: 1.3 }
    }
  },
  "Dodoma": {
    name: "Dodoma",
    state: "Dodoma Urban",
    country: "Tanzania",
    lat: -6.1731,
    lng: 35.7419,
    active: true,
    serviceStart: "06:00 AM",
    serviceEnd: "10:30 PM",
    nightMultiplier: 1.10,
    nightStart: "10:00 PM",
    nightEnd: "06:00 AM",
    taxName: "Municipal Levy",
    taxRate: 2,
    taxDescription: "Kodi ya Maendeleo ya Halmashauri Ya Jiji",
    taxActive: false,
    rates: {
      mini: { baseFare: 900, pricePerKm: 720, pricePerMin: 90, waitingRate: 100, surgeRush: 1.2, surgeRain: 1.4 },
      bajaj: { baseFare: 450, pricePerKm: 450, pricePerMin: 0, waitingRate: 40, surgeRush: 1.1, surgeRain: 1.2 },
      bike: { baseFare: 270, pricePerKm: 315, pricePerMin: 0, waitingRate: 25, surgeRush: 1.05, surgeRain: 1.15 }
    }
  },
  "Mwanza": {
    name: "Mwanza",
    state: "Nyamagana",
    country: "Tanzania",
    lat: -2.5164,
    lng: 32.9009,
    active: true,
    serviceStart: "05:00 AM",
    serviceEnd: "11:00 PM",
    nightMultiplier: 1.15,
    nightStart: "10:00 PM",
    nightEnd: "05:30 AM",
    taxName: "Lakefront Service Tax",
    taxRate: 3,
    taxDescription: "Usajili na Kodi ya Huduma ya Bandari/Ziwa",
    taxActive: true,
    rates: {
      mini: { baseFare: 1000, pricePerKm: 760, pricePerMin: 95, waitingRate: 110, surgeRush: 1.25, surgeRain: 1.45 },
      bajaj: { baseFare: 500, pricePerKm: 475, pricePerMin: 0, waitingRate: 45, surgeRush: 1.15, surgeRain: 1.3 },
      bike: { baseFare: 300, pricePerKm: 332, pricePerMin: 0, waitingRate: 28, surgeRush: 1.1, surgeRain: 1.2 }
    }
  }
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('business_info');
  const [uploadingVehicleId, setUploadingVehicleId] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<'imageUrl' | 'mapMarkerUrl' | null>(null);
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);

  const handleSlideImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slideId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingSlideId(slideId);
      try {
        const path = `splash_slides/${slideId}/${Date.now()}_${file.name}`;
        const url = await storageService.uploadFile('vendors', path, file);
        
        const currentSlides = businessConfig.splashSlides || [
          {
            id: "slide_1",
            title: "Karibu Papo Hapo!",
            description: "App bora zaidi ya huduma za usafiri wa haraka na uwasilishaji mizigo/chakula papo hapo.",
            imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=600&q=80",
            color: "#0c0c0e",
            titleColor: "#ffffff",
            descColor: "#9ca3af"
          },
          {
            id: "slide_2",
            title: "Usafiri na Ubebaji Mizigo",
            description: "Chagua Gari, Bajaji au Pikipiki kulingana na mahitaji yako na ujionee safari isiyo na kelele.",
            imageUrl: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=600&q=80",
            color: "#0a1a0f",
            titleColor: "#ffffff",
            descColor: "#9ca3af"
          },
          {
            id: "slide_3",
            title: "Ulinzi na Usalama",
            description: "Madereva wetu wote wamehakikiwa vizuri na kupitishwa na mfumo ili kukuhakikishia usalama 100%.",
            imageUrl: "https://images.unsplash.com/photo-1494959764136-6be9eb3c261e?auto=format&fit=crop&w=600&q=80",
            color: "#0b161e",
            titleColor: "#ffffff",
            descColor: "#9ca3af"
          }
        ];

        const updatedSlides = currentSlides.map((s: any) => 
          s.id === slideId ? { ...s, imageUrl: url } : s
        );

        setBusinessConfig({
          ...businessConfig,
          splashSlides: updatedSlides
        });
        toast.success("Picha ya Slide imepakiwa vizuri!");
      } catch (err: any) {
        toast.error("Imeshindwa kupakia picha: " + err.message);
      } finally {
        setUploadingSlideId(null);
      }
    }
  };

  const handleVehicleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, vehicleId: string, field: 'imageUrl' | 'mapMarkerUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingVehicleId(vehicleId);
      setUploadingType(field);
      try {
        const path = `vehicles/${vehicleId}/${field}_${Date.now()}_${file.name}`;
        const url = await storageService.uploadFile('vendors', path, file);
        
        const currentVehicles = businessConfig.vehicles || {
          mini: { id: "mini", name: "Gari", price: 2800, sub: "Max 4 Siti", image: "🚗", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
          bajaj: { id: "bajaj", name: "Bajaji", price: 1500, sub: "3 Siti", image: "🛺", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
          bike: { id: "bike", name: "Pikipiki", price: 800, sub: "Usafiri Salama", image: "🏍️", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" }
        };

        const updatedVehicles = {
          ...currentVehicles,
          [vehicleId]: {
            ...currentVehicles[vehicleId],
            [field]: url,
            ...(field === 'imageUrl' ? { imageType: 'url' } : {})
          }
        };

        setBusinessConfig({
          ...businessConfig,
          vehicles: updatedVehicles
        });
        toast.success("Picha imepakiwa successfully!");
      } catch (err: any) {
        toast.error("Imeshindwa kupakia picha: " + err.message);
      } finally {
        setUploadingVehicleId(null);
        setUploadingType(null);
      }
    }
  };
  const [selectedAppProfile, setSelectedAppProfile] = useState<'customer' | 'driver' | 'vendor' | 'deliveryman'>('customer');
  const [selectedPricingCity, setSelectedPricingCity] = useState("Dar es Salaam");
  const [pricingSubTab, setPricingSubTab] = useState<'basic_info' | 'service_hours' | 'night_charges' | 'tariffs' | 'tax' | 'geofence'>('basic_info');
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [businessConfig, setBusinessConfig] = useState<any>({
    name: 'M-Duka Platform',
    email: 'admin@mduka.com',
    phone: '+255 700 000 000',
    country: 'Tanzania',
    address: 'Kariakoo, Dar es Salaam',
    maintenanceMode: false,
    enableAR: true,
    currencySymbol: 'Tsh',
    timeFormat: '24h',
    // App Design & Download Branding
    appLogo: 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png', // beautiful default taxi/car logo
    splashText: 'Usafiri wa Haraka, Salama na Uhakika',
    splashColor: '#0c0c0e',
    enableAppDownload: true,
    apkDownloadUrl: 'https://example.com/download/app-release.apk',
    playStoreUrl: 'https://play.google.com',
    appStoreUrl: 'https://apps.apple.com',
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
    refundRequestMode: true,
    vehicles: {
      mini: { id: "mini", name: "Gari", price: 2800, sub: "Max 4 Siti", image: "🚗", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      bajaj: { id: "bajaj", name: "Bajaji", price: 1500, sub: "3 Siti", image: "🛺", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
      bike: { id: "bike", name: "Pikipiki", price: 800, sub: "Usafiri Salama", image: "🏍️", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" }
    }
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
  const [selectedVendorForReview, setSelectedVendorForReview] = useState<VendorProfile | null>(null);
  
  // Modals
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');

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

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/login');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      // Configuration
      try {
        const configSnap = await getDoc(doc(db, 'config', 'business'));
        if (configSnap.exists()) {
          setBusinessConfig((prev: any) => ({ ...prev, ...configSnap.data() }));
        }
      } catch (err) {
        console.warn("Permission denied for config/business");
      }

      // Vendors
      try {
        const vendorsSnap = await getDocs(collection(db, 'vendors'));
        setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
      } catch (err) {
        console.warn("Permission denied for vendors");
      }

      // Users
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        setAllUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRecord)));
      } catch (err) {
        console.warn("Permission denied for users");
      }

      // Orders
      try {
        const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
        setAllOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      } catch (err) {
        console.warn("Permission denied for orders");
      }

      // Other collections with same pattern
      const fetchList = async (coll: string, setter: (data: any[]) => void) => {
        try {
          const snap = await getDocs(collection(db, coll));
          setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
          console.warn(`Permission denied for ${coll}`);
        }
      };

      fetchList('banners', setBanners);
      fetchList('coupons', setCoupons);
      fetchList('products', setAllProducts);
      fetchList('drivers', setDriverLocations);
      
      try {
        const payoutsSnap = await getDocs(query(collection(db, 'payouts'), orderBy('createdAt', 'desc')));
        setPayouts(payoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      } catch (err) {
        console.warn("Permission denied for payouts");
      }

      try {
        const activeRidesSnap = await getDocs(query(collection(db, 'rides'), where('status', 'in', ['accepted', 'arrived', 'started'])));
        setActiveRides(activeRidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.warn("Permission denied for rides");
      }
    };

    fetchData();

    const errorHandler = (path: string) => (error: any) => {
      console.warn(`Snapshot Error on ${path}:`, error.message);
      handleFirestoreError(error, OperationType.GET, path);
    };

    const unsubscribes = [
      onSnapshot(doc(db, 'config', 'business'), (snap) => {
        if (snap.exists()) setBusinessConfig((prev: any) => ({ ...prev, ...snap.data() }));
      }, errorHandler('config/business')),
      onSnapshot(collection(db, 'vendors'), (snap) => {
        setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
      }, errorHandler('vendors')),
      onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRecord)));
      }, errorHandler('users')),
      onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
        setAllOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      }, errorHandler('orders')),
      onSnapshot(collection(db, 'banners'), (snap) => {
        setBanners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
      }, errorHandler('banners')),
      onSnapshot(collection(db, 'coupons'), (snap) => {
        setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));
      }, errorHandler('coupons')),
      onSnapshot(query(collection(db, 'payouts'), orderBy('createdAt', 'desc')), (snap) => {
        setPayouts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }, errorHandler('payouts')),
      onSnapshot(query(collection(db, 'rides'), where('status', 'in', ['accepted', 'arrived', 'started'])), (snap) => {
        setActiveRides(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, errorHandler('rides')),
      onSnapshot(collection(db, 'drivers'), (snap) => {
        setDriverLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, errorHandler('drivers')),
      onSnapshot(collection(db, 'products'), (snap) => {
        setAllProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductWithVendor)));
      }, errorHandler('products')),
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

  const adminTabs = useMemo(() => [
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
  ], [t]);

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
      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 z-[110] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter">Admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-500">
            <Home className="w-5 h-5" />
          </Link>
          <Link to="/profile" className="w-10 h-10 rounded-xl overflow-hidden border-2 border-orange-600/20 shadow-sm">
            <img 
               src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid}`} 
               alt="Admin" 
               className="w-full h-full object-cover shadow-sm"
            />
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 md:px-0">
        <div className="hidden md:flex items-center gap-4">
          <div className="p-4 bg-red-600 text-white rounded-[2rem] shadow-lg shadow-red-200">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase italic">{t('admin_control_panel')}</h1>
            <p className="text-neutral-500 font-medium">Platform-wide management & financial oversight.</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" className="rounded-2xl font-bold gap-2">
              <Home className="w-4 h-4" />
              <span>Papo Hapo Home</span>
            </Button>
          </Link>
          <Link to="/profile">
            <Button variant="outline" className="rounded-2xl border-neutral-200 font-bold">Switch Profile</Button>
          </Link>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="rounded-2xl font-bold gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('sign_out')}</span>
          </Button>
          <div className="bg-neutral-900 dark:bg-neutral-800 border border-neutral-800 dark:border-neutral-700 text-white px-4 py-2 rounded-2xl flex items-center gap-2 transition-colors">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">Admin Live</span>
          </div>
        </div>
      </div>

      {/* Tabs Menu (Desktop) */}
      <div className="hidden md:flex flex-wrap gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-[2rem] w-fit transition-colors px-4 md:px-1.5">
        {adminTabs.map((tab) => (
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

      {/* Mobile Stats Summary (Only on Overview) */}
      {activeTab === 'overview' && (
        <div className="md:hidden grid grid-cols-2 gap-3 px-4">
          <div className="bg-neutral-900 p-4 rounded-3xl text-white">
            <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Gross Volume</p>
            <p className="text-lg font-black mt-1 tracking-tight">TZS {stats.totalRev.toLocaleString()}</p>
          </div>
          <div className="bg-orange-600 p-4 rounded-3xl text-white">
            <p className="text-[9px] font-black uppercase text-orange-200 tracking-widest">Platform Fees</p>
            <p className="text-lg font-black mt-1 tracking-tight">TZS {stats.platformFee.toLocaleString()}</p>
          </div>
        </div>
      )}

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
                            {(() => {
                              const roleLower = (user.role || '').toLowerCase();
                              if (roleLower === 'vendor') {
                                const vProf = vendors.find(v => v.ownerUid === user.id);
                                if (vProf) {
                                  if (vProf.category === 'bus_ticket') {
                                    return 'vendor/ wa Bus Tickets';
                                  }
                                  if (vProf.category === 'parcel') {
                                    return 'vendor/ wa Vifurushi';
                                  }
                                  const categoryNames: Record<string, string> = {
                                    pharmacy: 'Dawa',
                                    grocery: 'Soko',
                                    restaurant: 'Chakula',
                                    taxi: 'Taksi',
                                    car_rental: 'Kukodisha Gari',
                                    salon: 'Saluni',
                                    hotel: 'Hoteli',
                                    ecommerce: 'E-Commerce'
                                  };
                                  return `vendor/ ${categoryNames[vProf.category] || vProf.category}`;
                                }
                                return 'vendor';
                              }
                              if (roleLower === 'rider' || roleLower === 'driver') {
                                return 'rider/ wa Vifurushi';
                              }
                              return user.role;
                            })()}
                          </Badge>
                        </td>
                         <td className="px-8 py-6">
                           <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                               {editingUserId === user.id ? (
                                 <div className="flex items-center gap-1">
                                    <Input 
                                       className="h-8 w-24 text-[10px] bg-neutral-100 border-orange-200 rounded-lg"
                                       value={newUserPassword}
                                       onChange={(e) => setNewUserPassword(e.target.value)}
                                       placeholder="New Pass"
                                       autoFocus
                                    />
                                    <Button 
                                       size="icon" 
                                       className="h-8 w-8 bg-orange-600 rounded-lg"
                                       onClick={async () => {
                                          if (!newUserPassword) return setEditingUserId(null);
                                          await updateDoc(doc(db, 'users', user.id), { password: newUserPassword, updatedAt: serverTimestamp() });
                                          toast.success('Password updated & saved');
                                          setEditingUserId(null);
                                          setNewUserPassword('');
                                       }}
                                    >
                                       <Check className="w-4 h-4" />
                                    </Button>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-neutral-400 font-mono tracking-widest">{user.password || '••••••'}</span>
                                    <button onClick={() => {
                                       setEditingUserId(user.id);
                                       setNewUserPassword(user.password || '');
                                    }} className="text-orange-600 hover:text-orange-500 transition-colors">
                                       <Key className="w-3 h-3" />
                                    </button>
                                    {user.phone && (
                                      <a 
                                        href={`https://wa.me/${user.phone.replace('+', '')}?text=Habari ${user.displayName}, Password yako mpya ya M-Duka platform ni: ${user.password}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-center p-1.5 h-7 w-7 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all ml-1"
                                        title="Send to WhatsApp"
                                      >
                                        <Phone className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                 </div>
                               )}
                             </div>
                             <Badge className={`${user.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} border-none font-black uppercase text-[10px] w-fit`}>
                               {user.status || 'Active'}
                             </Badge>
                             {user.role === 'driver' && (
                               <Badge className={`${user.approvalStatus === 'approved' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'} border-none font-black uppercase text-[8px] w-fit`}>
                                 {user.approvalStatus || 'Pending'}
                               </Badge>
                             )}
                           </div>
                         </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                             {user.role === 'driver' && user.approvalStatus !== 'approved' && (
                               <Button 
                                 onClick={async () => {
                                   await updateDoc(doc(db, 'users', user.id), { approvalStatus: 'approved', updatedAt: serverTimestamp() });
                                   toast.success(`${user.displayName} approved successfully!`);
                                 }}
                                 size="sm"
                                 className="rounded-xl bg-orange-600 hover:bg-orange-700 font-black uppercase text-[10px]"
                               >
                                 Approve
                               </Button>
                             )}
                              {user.phone && (
                                <a href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Habari ${user.displayName}, Password yako ya login sasa ni: ${user.password || 'Tafadhali muulize admin'}. Ingia hapa: ${window.location.origin}/login`)}`} target="_blank" rel="noreferrer">
                                   <Button size="icon" variant="ghost" className="rounded-xl text-green-600 hover:bg-green-50" title="WhatsApp Password">
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
               maxZoom={22}
               className="w-full h-full z-0"
               scrollWheelZoom
             >
                <TileLayer 
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" 
                  maxZoom={22}
                  maxNativeZoom={19}
                />
                
                {/* Active Drivers */}
                {driverLocations.map((driver, idx) => {
                  const pos = driver.location || driver.currentPosition;
                  const isOnline = driver.networkStatus === 'online' || driver.status === 'online' || driver.isOnline === true;
                  
                  if (!pos) return null;
                  
                  return (
                    <Marker 
                      key={driver.id || `driver-${idx}`} 
                      position={[pos.lat, pos.lng]} 
                      icon={DRIVER_ICON}
                    >
                       <Popup className="rounded-2xl overflow-hidden">
                          <div className="p-2 space-y-2">
                             <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                                   {driver.displayName?.[0] || driver.name?.[0]}
                                </div>
                                <div>
                                   <p className="font-black text-xs uppercase leading-none">{driver.displayName || driver.name}</p>
                                   <p className="text-[10px] text-neutral-400 font-bold">{driver.licensePlate || driver.vehicle?.plate || 'No Plate'}</p>
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
                             {isOnline ? (
                               <Badge className="w-full justify-center bg-green-100 text-green-600 font-black uppercase text-[8px] py-1">Online</Badge>
                             ) : (
                               <Badge className="w-full justify-center bg-red-100 text-red-600 font-black uppercase text-[8px] py-1">Offline</Badge>
                             )}
                          </div>
                       </Popup>
                    </Marker>
                  );
                })}

                {/* Active Rides/Users */}
                {activeRides.map((ride, idx) => (
                  ride.pickup && (
                    <Marker 
                      key={ride.id || `ride-${idx}`} 
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
                      <span className="text-xl font-black uppercase italic leading-none">{driverLocations.filter(d => d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true).length} Nodes</span>
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
                          {payouts.filter(p => p.status === 'pending').map((p, idx) => {
                             const recipientUser = allUsers.find(u => u.id === p.recipientId);
                             const recipientVendor = vendors.find(v => v.id === p.recipientId);
                             const name = recipientUser?.displayName || recipientVendor?.businessName || 'Unknown';
                             
                             return (
                               <div key={p.id || `payout-${idx}`} className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700 flex items-center justify-between group hover:shadow-xl transition-all">
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
                          {payouts.filter(p => p.status !== 'pending').slice(0, 5).map((p, idx) => (
                             <div key={p.id || `payout-hist-${idx}`} className="flex items-center justify-between opacity-60">
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
                        onClick={() => setSelectedVendorForReview(v)}
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
                        onClick={() => setSelectedVendorForReview(v)}
                        className="rounded-[2rem] border-none shadow-lg group hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-orange-500/20 bg-white dark:bg-neutral-900 transition-colors"
                      >
                         <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <img 
                                  key={v.logoUrl || `dicebear-${v.businessName}`}
                                  src={v.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(v.businessName || 'vendor')}`} 
                                  alt="" 
                                  className="w-16 h-16 rounded-2xl object-cover group-hover:scale-105 transition-transform" 
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(v.businessName || 'vendor')}`;
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                               <div>
                                  <h4 className="font-black text-lg text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase italic leading-none">{v.businessName}</h4>
                                  <p className="text-xs text-neutral-400 mt-1">{v.address}</p>
                                  {v.rating > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                       <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                       <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">
                                          {(v.rating || 0).toFixed(1)} {v.ratingCount ? `(${v.ratingCount})` : ''}
                                       </span>
                                    </div>
                                  )}
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
                    {allUsers.filter(u => u.role === 'rider' && u.approvalStatus === 'pending').map((rider, idx) => (
                      <div 
                        key={rider.id || `rider-pending-${idx}`}
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
                    {allUsers.filter(u => u.role === 'rider' && u.approvalStatus === 'approved').map((rider, idx) => (
                      <Card 
                        key={rider.id || `rider-approved-${idx}`}
                        className="rounded-[2rem] border-none shadow-lg group hover:shadow-2xl transition-all border-2 border-transparent hover:border-blue-500/20 bg-white dark:bg-neutral-900 transition-colors"
                      >
                         <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl">
                                  {rider.displayName[0]}
                               </div>
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <h4 className="font-black text-lg text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase italic leading-none">{rider.displayName}</h4>
                                     {driverLocations.find(d => d.id === rider.id && (d.networkStatus === 'online' || d.status === 'online' || d.isOnline === true)) && (
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live Online" />
                                     )}
                                  </div>
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
                         {allOrders.map((order, idx) => (
                           <tr key={order.id || `order-row-${idx}`}>
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
              {banners.map((banner, idx) => banner.img && (
                <Card key={banner.id || `banner-${idx}`} className="overflow-hidden group rounded-[2.5rem] border-none shadow-xl">
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

              {isAddCouponOpen && (
                <Card className="border-orange-200 bg-orange-50/10 rounded-[2rem] p-6 mb-8">
                  <CardHeader>
                    <CardTitle className="text-xl font-black italic uppercase tracking-tighter">New Coupon Campaign</CardTitle>
                    <CardDescription>Create a discount for specific vendor, product, or platform-wide.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddCoupon} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-neutral-500">Coupon Code</label>
                          <Input 
                            required 
                            placeholder="e.g. KARIBU20" 
                            value={newCoupon.code} 
                            onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                            className="bg-white border-neutral-200 h-12 rounded-xl font-bold italic"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-neutral-500">Discount Type</label>
                          <Select 
                            value={newCoupon.discountType} 
                            onValueChange={(val: any) => setNewCoupon({...newCoupon, discountType: val})}
                          >
                            <SelectTrigger className="bg-white border-neutral-200 h-12 rounded-xl font-bold">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-neutral-200">
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                              <SelectItem value="fixed">Fixed Amount (TZS)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-neutral-500">Value</label>
                          <Input 
                            type="number" 
                            required 
                            placeholder="Value" 
                            value={newCoupon.discountValue === undefined || isNaN(newCoupon.discountValue) ? '' : newCoupon.discountValue} 
                            onChange={e => setNewCoupon({...newCoupon, discountValue: e.target.value ? Number(e.target.value) : 0})}
                            className="bg-white border-neutral-200 h-12 rounded-xl font-bold"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-neutral-500">Vendor Scope (Optional)</label>
                          <Select 
                            value={newCoupon.vendorId || 'all'} 
                            onValueChange={(val: any) => setNewCoupon({...newCoupon, vendorId: val === 'all' ? null : val, productId: null})}
                          >
                            <SelectTrigger className="bg-white border-neutral-200 h-12 rounded-xl font-bold">
                              <SelectValue placeholder="System Wide" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-neutral-200 h-[200px]">
                              <SelectItem value="all">Platform Wide (All Vendors)</SelectItem>
                              {vendors.map(v => (
                                <SelectItem key={v.id} value={v.id!}>{v.businessName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {newCoupon.vendorId && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-neutral-500">Product Scope (Optional)</label>
                            <Select 
                              value={newCoupon.productId || 'all'} 
                              onValueChange={(val: any) => setNewCoupon({...newCoupon, productId: val === 'all' ? null : val})}
                            >
                              <SelectTrigger className="bg-white border-neutral-200 h-12 rounded-xl font-bold">
                                <SelectValue placeholder="All Vendor Products" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-neutral-200 h-[200px]">
                                <SelectItem value="all">All products from {vendors.find(v => v.id === newCoupon.vendorId)?.businessName}</SelectItem>
                                {allProducts.filter(p => p.vendorId === newCoupon.vendorId).map(p => (
                                  <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                        <Button type="button" variant="ghost" className="rounded-xl px-8 h-12 font-bold" onClick={() => setIsAddCouponOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-orange-600 hover:bg-orange-700 rounded-xl px-12 h-12 font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-100">Activate Coupon</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
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
                        {allUsers.filter(u => u.role === 'admin' || u.role === 'customer').map((u, idx) => (
                          <option key={u.id || `notif-user-${idx}`} value={u.id}>{u.displayName} ({u.role})</option>
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
                { id: 'app_design', label: t('admin_settings_app_design'), icon: Monitor },
                { id: 'vehicles', label: 'Usafiri (Vehicles)', icon: Car },
                { id: 'pricing_rules', label: 'Miji & Bei (Tariffs/Pricing)', icon: Coins },
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
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-3 border-r-0 sm:border-r border-orange-200 pr-0 sm:pr-6">
                         <span className="text-xs font-bold uppercase text-neutral-400">{businessConfig.maintenanceMode ? 'Active' : 'Disabled'}</span>
                         <Switch 
                           checked={businessConfig.maintenanceMode}
                           onCheckedChange={(val) => setBusinessConfig({...businessConfig, maintenanceMode: val})}
                         />
                      </div>
                      <Button 
                        onClick={handleSaveSettings}
                        className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-8 font-black uppercase text-[11px] tracking-widest h-12 shadow-xl shadow-orange-200/50 w-full sm:w-auto"
                      >
                        HIFADHI / SAVE SETTINGS
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* AR Toggle */}
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-blue-50/50">
                  <CardContent className="p-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black uppercase italic tracking-tight">Enable AR Functionality</h3>
                        <p className="text-xs text-neutral-500 font-medium">Washa au zima uwezo wa wateja kuona bidhaa katika AR (3D).</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-3 border-r-0 sm:border-r border-blue-200 pr-0 sm:pr-6">
                         <span className="text-xs font-bold uppercase text-neutral-400">{businessConfig.enableAR ? 'Active' : 'Disabled'}</span>
                         <Switch 
                           checked={businessConfig.enableAR}
                           onCheckedChange={(val) => setBusinessConfig({...businessConfig, enableAR: val})}
                         />
                      </div>
                      <Button 
                        onClick={handleSaveSettings}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-black uppercase text-[11px] tracking-widest h-12 shadow-xl shadow-blue-200/50 w-full sm:w-auto"
                      >
                        HIFADHI / SAVE AR
                      </Button>
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

            {activeSettingsTab === 'app_design' && (
              <div className="space-y-8 animate-fade-in">
                {/* Intro Card */}
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-violet-50/50">
                  <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600">
                        <Monitor className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black uppercase italic tracking-tight text-neutral-900">Uhariri wa App na Branding</h3>
                        <p className="text-xs text-neutral-500 font-medium max-w-xl">
                          Weka muundo wa kipekee wa nembo na skrini za mwanzo (Splash Screen) tofauti kulingana na kila App/Wajibu. 
                          <span className="text-violet-650 font-bold block mt-1">💡 Splash Screen huonekana tu kwenye vifaa vya simu (App/Mobile View) na kuskipiwa kwenye kompyuta (Website) ili kufanya uzoefu kuwa wa haraka na mwepesi.</span>
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveSettings}
                      className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 font-black uppercase text-[11px] tracking-widest h-12 shadow-xl shadow-violet-200/50 whitespace-nowrap"
                    >
                      HIFADHI UHARIRI / SAVE BRANDING
                    </Button>
                  </CardContent>
                </Card>

                {/* Role Tabs for different Splash screen variants */}
                <div className="bg-neutral-100 p-2 rounded-2xl flex flex-wrap gap-2 max-w-3xl">
                  {[
                    { id: 'customer', label: 'Mteja (Customer App)', desc: 'Abiria / Customer Splash' },
                    { id: 'driver', label: 'Dereva (Driver App)', desc: 'Dereva / Driver Splash' },
                    { id: 'vendor', label: 'Muuzaji (Vendor App)', desc: 'Muuzaji / Vendor Splash' },
                    { id: 'deliveryman', label: 'Mjumbe (Delivery App)', desc: 'Mjumbe / Deliveryman Splash' },
                  ].map((profileTab) => (
                    <button
                      key={profileTab.id}
                      type="button"
                      onClick={() => setSelectedAppProfile(profileTab.id as any)}
                      className={`flex-1 min-w-[140px] text-center px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-350 ${
                        selectedAppProfile === profileTab.id
                          ? 'bg-neutral-900 text-white shadow-xl'
                          : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/50'
                      }`}
                    >
                      {profileTab.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Editor Fields for the selected profile */}
                  <Card className="lg:col-span-7 rounded-[3rem] border-none shadow-2xl p-8 space-y-6 bg-white">
                    <div className="border-b border-neutral-100 pb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-orange-150 text-orange-600 px-3 py-1 rounded-full">
                        Kiolesura cha {selectedAppProfile === 'customer' ? 'Mteja' : selectedAppProfile === 'driver' ? 'Dereva' : selectedAppProfile === 'vendor' ? 'Muuzaji' : 'Mjumbe'}
                      </span>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter text-neutral-900 mt-2">
                        Sanidi Skrini ya {selectedAppProfile === 'customer' ? 'Mteja (Customer)' : selectedAppProfile === 'driver' ? 'Dereva (Driver)' : selectedAppProfile === 'vendor' ? 'Muuzaji (Vendor)' : 'Mjumbe (Deliveryman)'}
                      </h4>
                    </div>

                    <div className="space-y-5">
                      {/* Logo URL Input */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Logo Image URL *</Label>
                        <Input 
                          value={
                            selectedAppProfile === 'customer' 
                              ? (businessConfig.customerAppLogo || businessConfig.appLogo || '') 
                              : selectedAppProfile === 'driver' 
                              ? (businessConfig.driverAppLogo || '') 
                              : selectedAppProfile === 'vendor' 
                              ? (businessConfig.vendorAppLogo || '') 
                              : (businessConfig.deliveryAppLogo || '')
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (selectedAppProfile === 'customer') {
                              setBusinessConfig({...businessConfig, customerAppLogo: val, appLogo: val});
                            } else if (selectedAppProfile === 'driver') {
                              setBusinessConfig({...businessConfig, driverAppLogo: val});
                            } else if (selectedAppProfile === 'vendor') {
                              setBusinessConfig({...businessConfig, vendorAppLogo: val});
                            } else {
                              setBusinessConfig({...businessConfig, deliveryAppLogo: val});
                            }
                          }}
                          placeholder="Mfano: https://yourdomain.com/logo.png"
                          className="h-12 rounded-xl border-none bg-neutral-100 font-bold px-4 text-xs"
                        />
                        <p className="text-[10.5px] text-neutral-400 font-medium">Nembo inayojivinjari juu ya splash asilimia 3:1 au 1:1.</p>
                      </div>

                      {/* Splash Text Input */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Maneno ya Splash Screen (Slogan) *</Label>
                        <Input 
                          value={
                            selectedAppProfile === 'customer' 
                              ? (businessConfig.customerSplashText || businessConfig.splashText || '') 
                              : selectedAppProfile === 'driver' 
                              ? (businessConfig.driverSplashText || '') 
                              : selectedAppProfile === 'vendor' 
                              ? (businessConfig.vendorSplashText || '') 
                              : (businessConfig.deliverySplashText || '')
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (selectedAppProfile === 'customer') {
                              setBusinessConfig({...businessConfig, customerSplashText: val, splashText: val});
                            } else if (selectedAppProfile === 'driver') {
                              setBusinessConfig({...businessConfig, driverSplashText: val});
                            } else if (selectedAppProfile === 'vendor') {
                              setBusinessConfig({...businessConfig, vendorSplashText: val});
                            } else {
                              setBusinessConfig({...businessConfig, deliverySplashText: val});
                            }
                          }}
                          placeholder="Mfano: Kusanya wateja na kuongeza mauzo sasa!"
                          className="h-12 rounded-xl border-none bg-neutral-100 font-bold px-4 text-xs"
                        />
                      </div>

                      {/* Splash Background Color */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Splash Background Color *</Label>
                        <div className="flex gap-3 items-center">
                          <Input 
                            type="color"
                            value={
                              selectedAppProfile === 'customer' 
                                ? (businessConfig.customerSplashColor || businessConfig.splashColor || '#0c0c0e') 
                                : selectedAppProfile === 'driver' 
                                ? (businessConfig.driverSplashColor || '#121214') 
                                : selectedAppProfile === 'vendor' 
                                ? (businessConfig.vendorSplashColor || '#0b161e') 
                                : (businessConfig.deliverySplashColor || '#0a1a0f')
                            }
                            onChange={e => {
                              const val = e.target.value;
                              if (selectedAppProfile === 'customer') {
                                setBusinessConfig({...businessConfig, customerSplashColor: val, splashColor: val});
                              } else if (selectedAppProfile === 'driver') {
                                setBusinessConfig({...businessConfig, driverSplashColor: val});
                              } else if (selectedAppProfile === 'vendor') {
                                setBusinessConfig({...businessConfig, vendorSplashColor: val});
                              } else {
                                setBusinessConfig({...businessConfig, deliverySplashColor: val});
                              }
                            }}
                            className="w-16 h-12 rounded-xl border-none bg-neutral-100 p-1 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-neutral-500 font-bold uppercase">
                            {
                              selectedAppProfile === 'customer' 
                                ? (businessConfig.customerSplashColor || businessConfig.splashColor || '#0c0c0e') 
                                : selectedAppProfile === 'driver' 
                                ? (businessConfig.driverSplashColor || '#121214') 
                                : selectedAppProfile === 'vendor' 
                                ? (businessConfig.vendorSplashColor || '#0b161e') 
                                : (businessConfig.deliverySplashColor || '#0a1a0f')
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Right Column: Premium Smartphone Mockup Live Preview */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center">
                    <div className="relative mx-auto border-[12px] border-neutral-900 rounded-[3rem] h-[520px] w-[270px] shadow-2xl bg-black overflow-hidden flex flex-col">
                      {/* Speaker / Camera bar */}
                      <div className="absolute top-0 inset-x-0 h-6 bg-black flex justify-center items-center z-20">
                        <div className="w-20 h-4 bg-neutral-900 rounded-b-2xl flex items-center justify-center">
                          <div className="w-2 h-2 bg-neutral-800 rounded-full" />
                          <div className="w-8 h-1 bg-neutral-800 rounded mx-1" />
                        </div>
                      </div>

                      {/* Smartphone Status Bar */}
                      <div className="absolute top-6 inset-x-0 h-4 px-4 flex justify-between items-center text-[8px] font-black font-semibold text-white/60 z-20 select-none">
                        <span>9:41</span>
                        <div className="flex items-center gap-1">
                          <span className="tracking-tighter">LTE</span>
                          <span className="w-3 h-2 bg-white/60 rounded-xs inline-block" />
                        </div>
                      </div>

                      {/* Splash Layout Frame content */}
                      <div 
                        className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none relative transition-colors duration-450"
                        style={{ 
                          backgroundColor: 
                            selectedAppProfile === 'customer' 
                              ? (businessConfig.customerSplashColor || businessConfig.splashColor || '#0c0c0e') 
                              : selectedAppProfile === 'driver' 
                              ? (businessConfig.driverSplashColor || '#121214') 
                              : selectedAppProfile === 'vendor' 
                              ? (businessConfig.vendorSplashColor || '#0b161e') 
                              : (businessConfig.deliverySplashColor || '#0a1a0f')
                        }}
                      >
                        <div className="flex flex-col items-center max-w-[190px] animate-pulse">
                          {
                            (selectedAppProfile === 'customer' 
                              ? (businessConfig.customerAppLogo || businessConfig.appLogo)
                              : selectedAppProfile === 'driver'
                              ? businessConfig.driverAppLogo
                              : selectedAppProfile === 'vendor'
                              ? businessConfig.vendorAppLogo
                              : businessConfig.deliveryAppLogo) ? (
                              <img 
                                src={
                                  selectedAppProfile === 'customer' 
                                    ? (businessConfig.customerAppLogo || businessConfig.appLogo)
                                    : selectedAppProfile === 'driver'
                                    ? businessConfig.driverAppLogo
                                    : selectedAppProfile === 'vendor'
                                    ? businessConfig.vendorAppLogo
                                    : businessConfig.deliveryAppLogo
                                } 
                                alt="App logo preview" 
                                className="w-14 h-14 object-contain mb-4 rounded-xl shadow-lg pointer-events-none"
                                onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center text-black mb-4 shadow-xl">
                                <Car className="w-8 h-8" />
                              </div>
                            )
                          }

                          <h5 className="text-[13px] font-black uppercase text-white tracking-widest mb-1 select-none">
                            {businessConfig.name || 'M-Duka'}
                          </h5>

                          <p className="text-[9px] text-white/70 font-bold uppercase tracking-wide leading-tight mt-1 select-none">
                            {
                              selectedAppProfile === 'customer' 
                                ? (businessConfig.customerSplashText || businessConfig.splashText || 'Usafiri wa Haraka, Salama na Uhakika') 
                                : selectedAppProfile === 'driver' 
                                ? (businessConfig.driverSplashText || 'Usafiri wa Haraka, Salama na Uhakika (Dereva)') 
                                : selectedAppProfile === 'vendor' 
                                ? (businessConfig.vendorSplashText || 'Sanidi Duka Lako Uweze Kuuza wepesi') 
                                : (businessConfig.deliverySplashText || 'Uwasilishaji Haraka wa Vifurushi na Chakula')
                            }
                          </p>

                          <div className="mt-6 flex flex-col items-center gap-1">
                            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                            <span className="text-[6px] text-white/50 font-mono font-black uppercase">Inapakia...</span>
                          </div>
                        </div>

                        {/* Interactive info overlay at bottom of phone mockup */}
                        <div className="absolute bottom-4 inset-x-0 flex flex-col items-center justify-center text-[7px] text-white/30 uppercase font-mono font-bold">
                          <span>App Splash PREVIEW</span>
                          <span className="text-[5px] mt-0.5">Showcase on Mobile View</span>
                        </div>
                      </div>

                      {/* iPhone Home key bar */}
                      <div className="absolute bottom-1 inset-x-0 h-4 flex justify-center items-center z-20">
                        <div className="w-24 h-1 bg-white/40 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SPLASH SCREEN SLIDES MULTI-MANAGER */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 space-y-6 bg-white max-w-5xl">
                  <div className="border-b border-neutral-100 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900">Usimamizi wa Slide za Splash (Splash Screen Slides)</h3>
                      <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Ongeza, hariri au panga slide za skrini ya mwanzo ambazo abiria/mteja anaweza kuzisogeza (swipe ili kuona maelezo ya huduma).</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        const currentSlides = businessConfig.splashSlides || [
                          {
                            id: "slide_1",
                            title: "Karibu Papo Hapo!",
                            description: "App bora zaidi ya huduma za usafiri wa haraka na uwasilishaji mizigo/chakula papo hapo.",
                            imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=600&q=80",
                            color: "#0c0c0e",
                            titleColor: "#ffffff",
                            descColor: "#9ca3af"
                          },
                          {
                            id: "slide_2",
                            title: "Usafiri na Ubebaji Mizigo",
                            description: "Chagua Gari, Bajaji au Pikipiki kulingana na mahitaji yako na ujionee safari isiyo na kelele.",
                            imageUrl: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=600&q=80",
                            color: "#0a1a0f",
                            titleColor: "#ffffff",
                            descColor: "#9ca3af"
                          },
                          {
                            id: "slide_3",
                            title: "Ulinzi na Usalama",
                            description: "Madereva wetu wote wamehakikiwa vizuri na kupitishwa na mfumo ili kukuhakikishia usalama 100%.",
                            imageUrl: "https://images.unsplash.com/photo-1494959764136-6be9eb3c261e?auto=format&fit=crop&w=600&q=80",
                            color: "#0b161e",
                            titleColor: "#ffffff",
                            descColor: "#9ca3af"
                          }
                        ];
                        const newId = `slide_${Date.now()}`;
                        const newSlide = {
                          id: newId,
                          title: `Slide Mpya #${currentSlides.length + 1}`,
                          description: "Maelezo mafupi ya slide hii mpya hapa.",
                          imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=600&q=80",
                          color: "#0c0c0e",
                          titleColor: "#ffffff",
                          descColor: "#9ca3af"
                        };
                        setBusinessConfig({
                          ...businessConfig,
                          splashSlides: [...currentSlides, newSlide]
                        });
                        toast.success("Slide mpya imeongezwa! Usisahau kuhifadhi.");
                      }}
                      className="h-11 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ongeza Slide Mpya
                    </Button>
                  </div>

                  <div className="space-y-6">
                    {(businessConfig.splashSlides || [
                      {
                        id: "slide_1",
                        title: "Karibu Papo Hapo!",
                        description: "App bora zaidi ya huduma za usafiri wa haraka na uwasilishaji mizigo/chakula papo hapo.",
                        imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=600&q=80",
                        color: "#0c0c0e",
                        titleColor: "#ffffff",
                        descColor: "#9ca3af"
                      },
                      {
                        id: "slide_2",
                        title: "Usafiri na Ubebaji Mizigo",
                        description: "Chagua Gari, Bajaji au Pikipiki kulingana na mahitaji yako na ujionee safari isiyo na kelele.",
                        imageUrl: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=600&q=80",
                        color: "#0a1a0f",
                        titleColor: "#ffffff",
                        descColor: "#9ca3af"
                      },
                      {
                        id: "slide_3",
                        title: "Ulinzi na Usalama",
                        description: "Madereva wetu wote wamehakikiwa vizuri na kupitishwa na mfumo ili kukuhakikishia usalama 100%.",
                        imageUrl: "https://images.unsplash.com/photo-1494959764136-6be9eb3c261e?auto=format&fit=crop&w=600&q=80",
                        color: "#0b161e",
                        titleColor: "#ffffff",
                        descColor: "#9ca3af"
                      }
                    ]).map((slide: any, idx: number, arr: any[]) => (
                      <div 
                        key={slide.id || idx} 
                        className="p-6 rounded-2xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/70 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-neutral-150 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-black uppercase text-neutral-800 tracking-wider">
                              Slide Details
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Move Up */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={idx === 0}
                              onClick={() => {
                                const newSlides = [...arr];
                                const temp = newSlides[idx];
                                newSlides[idx] = newSlides[idx - 1];
                                newSlides[idx - 1] = temp;
                                setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                              }}
                              className="w-8 h-8 text-neutral-500 hover:bg-neutral-200"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>

                            {/* Move Down */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={idx === arr.length - 1}
                              onClick={() => {
                                const newSlides = [...arr];
                                const temp = newSlides[idx];
                                newSlides[idx] = newSlides[idx + 1];
                                newSlides[idx + 1] = temp;
                                setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                              }}
                              className="w-8 h-8 text-neutral-500 hover:bg-neutral-200"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (arr.length <= 1) {
                                  toast.error("Lazima ubaki na angalau slide moja ya Splash screen!");
                                  return;
                                }
                                const newSlides = arr.filter((s: any) => s.id !== slide.id);
                                setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                toast.success("Slide imefutwa! Usisahau kuhifadhi.");
                              }}
                              className="w-8 h-8 text-red-500 hover:bg-red-50 hover:text-red-750"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Title and Description */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Slide Title (Kichwa cha Habari) *</Label>
                              <Input
                                value={slide.title || ''}
                                onChange={(e) => {
                                  const newSlides = arr.map((s: any) => 
                                    s.id === slide.id ? { ...s, title: e.target.value } : s
                                  );
                                  setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                }}
                                className="h-11 rounded-xl bg-white border border-neutral-200"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Slide Description (Maelezo ya Slide) *</Label>
                              <Textarea
                                value={slide.description || ''}
                                onChange={(e) => {
                                  const newSlides = arr.map((s: any) => 
                                    s.id === slide.id ? { ...s, description: e.target.value } : s
                                  );
                                  setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                }}
                                className="min-h-[80px] rounded-xl bg-white border border-neutral-200 text-xs font-semibold px-4 py-2"
                              />
                            </div>

                            <div className="flex items-center gap-3 pt-3 bg-white/40 dark:bg-black/10 p-3 rounded-xl border border-neutral-150">
                              <Switch
                                id={`hideText-${slide.id || idx}`}
                                checked={!!slide.hideText}
                                onCheckedChange={(val) => {
                                  const newSlides = arr.map((s: any) => 
                                    s.id === slide.id ? { ...s, hideText: val } : s
                                  );
                                  setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                }}
                              />
                              <Label 
                                htmlFor={`hideText-${slide.id || idx}`}
                                className="text-[11px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                              >
                                Ficha Maandishi (Onyesha Picha Tu Fulu Skrini)
                              </Label>
                            </div>
                          </div>

                          {/* Image Path and Color Settings */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Linki ya Picha (Image URL) au Upload *</Label>
                              <div className="flex gap-2">
                                <Input
                                  value={slide.imageUrl || ''}
                                  placeholder="https://images.unsplash.com/...au pakia"
                                  onChange={(e) => {
                                    const newSlides = arr.map((s: any) => 
                                      s.id === slide.id ? { ...s, imageUrl: e.target.value } : s
                                    );
                                    setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                  }}
                                  className="h-11 rounded-xl bg-white border border-neutral-200 text-xs flex-1"
                                />
                                <Label className="shrink-0 cursor-pointer text-xs font-black uppercase text-[#7F77DD] bg-[#7F77DD]/10 px-4 py-2.5 rounded-xl border border-dashed border-[#7F77DD]/35 hover:bg-[#7F77DD]/20 transition-all flex items-center justify-center">
                                  {uploadingSlideId === slide.id ? 'Inapakia...' : 'Pakia'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleSlideImageUpload(e, slide.id)}
                                    disabled={uploadingSlideId !== null}
                                  />
                                </Label>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[8.5px] font-black uppercase tracking-wider text-neutral-500">BG Color</Label>
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-neutral-250">
                                  <Input 
                                    type="color"
                                    value={slide.color || '#0c0c0e'}
                                    onChange={(e) => {
                                      const newSlides = arr.map((s: any) => 
                                        s.id === slide.id ? { ...s, color: e.target.value } : s
                                      );
                                      setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                    }}
                                    className="w-8 h-8 bg-transparent p-0 cursor-pointer border-none rounded-lg"
                                  />
                                  <span className="text-[9px] font-mono font-bold uppercase truncate">{slide.color || '#000'}</span>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[8.5px] font-black uppercase tracking-wider text-neutral-500">Title Color</Label>
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-neutral-250">
                                  <Input 
                                    type="color"
                                    value={slide.titleColor || '#ffffff'}
                                    onChange={(e) => {
                                      const newSlides = arr.map((s: any) => 
                                        s.id === slide.id ? { ...s, titleColor: e.target.value } : s
                                      );
                                      setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                    }}
                                    className="w-8 h-8 bg-transparent p-0 cursor-pointer border-none rounded-lg"
                                  />
                                  <span className="text-[9px] font-mono font-bold uppercase truncate">{slide.titleColor || '#fff'}</span>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[8.5px] font-black uppercase tracking-wider text-neutral-500">Desc Color</Label>
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-neutral-250">
                                  <Input 
                                    type="color"
                                    value={slide.descColor || '#9ca3af'}
                                    onChange={(e) => {
                                      const newSlides = arr.map((s: any) => 
                                        s.id === slide.id ? { ...s, descColor: e.target.value } : s
                                      );
                                      setBusinessConfig({ ...businessConfig, splashSlides: newSlides });
                                    }}
                                    className="w-8 h-8 bg-transparent p-0 cursor-pointer border-none rounded-lg"
                                  />
                                  <span className="text-[9px] font-mono font-bold uppercase truncate">{slide.descColor || '#aaa'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 gap-4">
                    <Button
                      onClick={handleSaveSettings}
                      className="h-14 px-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-100 font-black uppercase tracking-widest text-xs"
                    >
                      Hifadhi Slide za Splash zote (Save Splash Slides Settings)
                    </Button>
                  </div>
                </Card>

                {/* Outer Layout: Global Mobile App download configurations */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 space-y-6 bg-white max-w-5xl">
                  <div className="flex items-center justify-between col-span-2 border-b border-neutral-100 pb-4">
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900">Kitufe cha Kupakua App (App Downloads Button)</h3>
                      <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Sanidi kama unaruhusu wauzaji na abiria kuona vitufe vya kupakua play store / app store.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-neutral-400">{businessConfig.enableAppDownload ? 'ENABLED' : 'DISABLED'}</span>
                      <Switch 
                        checked={businessConfig.enableAppDownload}
                        onCheckedChange={(val) => setBusinessConfig({...businessConfig, enableAppDownload: val})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Android APK Direct Download Link *</Label>
                      <Input 
                        value={businessConfig.apkDownloadUrl || ''}
                        onChange={e => setBusinessConfig({...businessConfig, apkDownloadUrl: e.target.value})}
                        placeholder="Mfano: /app-release.apk au https://yourdomain.com/app.apk"
                        className="h-12 rounded-xl border-none bg-neutral-100 font-bold px-4 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Google Play Store Link</Label>
                       <Input 
                         value={businessConfig.playStoreUrl || ''}
                         onChange={e => setBusinessConfig({...businessConfig, playStoreUrl: e.target.value})}
                         placeholder="Mfano: https://play.google.com/store/apps/details?id=..."
                         className="h-12 rounded-xl border-none bg-neutral-100 font-bold px-4 text-xs"
                       />
                     </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Apple App Store Link</Label>
                      <Input 
                        value={businessConfig.appStoreUrl || ''}
                        onChange={e => setBusinessConfig({...businessConfig, appStoreUrl: e.target.value})}
                        placeholder="Mfano: https://apps.apple.com/app/id..."
                        className="h-12 rounded-xl border-none bg-neutral-100 font-bold px-4 text-xs"
                      />
                    </div>
                  </div>
                </Card>
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
                            value={isNaN(businessConfig.maxCashInHand) ? '' : businessConfig.maxCashInHand}
                            onChange={(e) => setBusinessConfig({...businessConfig, maxCashInHand: e.target.value ? Number(e.target.value) : 0})}
                            className="h-14 rounded-2xl border-none bg-neutral-100 font-black text-lg px-6"
                          />
                       </div>
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('admin_settings_vendor_min_pay')} ({businessConfig.currencySymbol})</Label>
                          <Input 
                            type="number"
                            value={isNaN(businessConfig.minPayAmount) ? '' : businessConfig.minPayAmount}
                            onChange={(e) => setBusinessConfig({...businessConfig, minPayAmount: e.target.value ? Number(e.target.value) : 0})}
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
                            value={isNaN(businessConfig.scheduledTimeInterval) ? '' : businessConfig.scheduledTimeInterval}
                            onChange={(e) => setBusinessConfig({...businessConfig, scheduledTimeInterval: e.target.value ? Number(e.target.value) : 0})}
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
                             value={isNaN(businessConfig.freeDeliveryOver) ? '' : businessConfig.freeDeliveryOver}
                             onChange={(e) => setBusinessConfig({...businessConfig, freeDeliveryOver: e.target.value ? Number(e.target.value) : 0})}
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

            {activeSettingsTab === 'vehicles' && (
              <div className="space-y-8 animate-in fade-in-50 duration-200">
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 bg-gradient-to-br from-neutral-900 to-indigo-950/40 border border-indigo-900/30 text-white space-y-4">
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">Usanidi wa Aina za Usafiri (Vehicle Configurations)</h3>
                    <p className="text-xs text-indigo-200/80 font-medium">Badilisha majina, bei, picha za kuonyesha kwenye orodha (booking cards) na picha ama icon za kuonyesha kwenye ramani (map markers) kwa ajili ya Gari, Bajaji na Pikipiki.</p>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(businessConfig.vehicles || {
                    mini: { id: "mini", name: "Gari", price: 2800, sub: "Max 4 Siti", image: "🚗", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
                    bajaj: { id: "bajaj", name: "Bajaji", price: 1500, sub: "3 Siti", image: "🛺", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" },
                    bike: { id: "bike", name: "Pikipiki", price: 800, sub: "Usafiri Salama", image: "🏍️", imageType: "emoji", imageUrl: "", mapMarkerUrl: "" }
                  }).map(([id, v]: [string, any]) => (
                    <Card key={id} className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 overflow-hidden flex flex-col justify-between transition-colors">
                      <CardHeader className="p-6 pb-2 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-[#7F77DD] uppercase bg-[#7F77DD]/10 px-3 py-1.5 rounded-full">{id.toUpperCase()} TYPE</span>
                        </div>
                        <div className="text-3xl">
                          {v.imageType === 'url' && v.imageUrl ? (
                            <img src={v.imageUrl} className="w-12 h-12 object-contain rounded-xl border border-neutral-200 dark:border-neutral-800" referrerPolicy="no-referrer" />
                          ) : (
                            v.image || '🚗'
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6 flex-1">
                        {/* Name/Label */}
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Jina la Usafiri (Gari / Bajaji / Bodaboda)</Label>
                          <Input
                            value={v.name || ''}
                            onChange={(e) => {
                              const updated = {
                                ...businessConfig.vehicles,
                                [id]: { ...v, name: e.target.value }
                              };
                              setBusinessConfig({ ...businessConfig, vehicles: updated });
                            }}
                            className="h-11 rounded-xl border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                          />
                        </div>

                        {/* Sub-label */}
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Maelezo/Siti</Label>
                          <Input
                            value={v.sub || ''}
                            onChange={(e) => {
                              const updated = {
                                ...businessConfig.vehicles,
                                [id]: { ...v, sub: e.target.value }
                              };
                              setBusinessConfig({ ...businessConfig, vehicles: updated });
                            }}
                            className="h-11 rounded-xl border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                          />
                        </div>

                        {/* Price */}
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Bei Kawaida / Chini kabisa (Flat / Min Price - TZS)</Label>
                          <Input
                            type="number"
                            value={v.price === undefined ? '' : v.price}
                            onChange={(e) => {
                              const updated = {
                                ...businessConfig.vehicles,
                                [id]: { ...v, price: Number(e.target.value) }
                              };
                              setBusinessConfig({ ...businessConfig, vehicles: updated });
                            }}
                            className="h-11 rounded-xl border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold"
                          />
                        </div>

                        {/* Transparent/Dynamic Pricing Breakdown Configuration */}
                        <div className="space-y-3.5 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black tracking-widest text-[#7F77DD] uppercase bg-[#7F77DD]/10 px-2.5 py-1 rounded-md">Nauli ya Uwazi (Dynamic Formula)</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {/* Base Fare */}
                            <div className="space-y-1">
                              <Label className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block truncate">Kuanza (Fungua Mlango)</Label>
                              <Input
                                type="number"
                                placeholder={id === 'mini' ? '1000' : id === 'bajaj' ? '500' : '300'}
                                value={v.baseFare === undefined ? '' : v.baseFare}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  const updated = {
                                    ...businessConfig.vehicles,
                                    [id]: { ...v, baseFare: val }
                                  };
                                  setBusinessConfig({ ...businessConfig, vehicles: updated });
                                }}
                                className="h-9 rounded-lg border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold text-center text-xs"
                              />
                            </div>

                            {/* Price per KM */}
                            <div className="space-y-1">
                              <Label className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block truncate">Kila KM (Umbali)</Label>
                              <Input
                                type="number"
                                placeholder={id === 'mini' ? '800' : id === 'bajaj' ? '500' : '350'}
                                value={v.pricePerKm === undefined ? '' : v.pricePerKm}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  const updated = {
                                    ...businessConfig.vehicles,
                                    [id]: { ...v, pricePerKm: val }
                                  };
                                  setBusinessConfig({ ...businessConfig, vehicles: updated });
                                }}
                                className="h-9 rounded-lg border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold text-center text-xs"
                              />
                            </div>

                            {/* Price per Min */}
                            <div className="space-y-1">
                              <Label className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block truncate">Kila Dk (Muda)</Label>
                              <Input
                                type="number"
                                placeholder={id === 'mini' ? '100' : '0'}
                                value={v.pricePerMin === undefined ? '' : v.pricePerMin}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  const updated = {
                                    ...businessConfig.vehicles,
                                    [id]: { ...v, pricePerMin: val }
                                  };
                                  setBusinessConfig({ ...businessConfig, vehicles: updated });
                                }}
                                className="h-9 rounded-lg border-none bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold text-center text-xs"
                              />
                            </div>
                          </div>
                          
                          <p className="text-[8px] text-neutral-400 leading-snug">
                            Kanuni: <code className="text-[#7F77DD] font-bold">Kuanza + (KM * Bei ya KM) + (Dakika * Bei ya Dakika)</code>.
                            {id !== 'mini' && ' (Pikipiki na Bajaji zina faida ya kutoshtakiwa foleni - weka Kila Dk kuwa 0!)'}
                          </p>
                        </div>

                        {/* Image Source Toggle */}
                        <div className="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Picha ya Orodha (List Image)</Label>
                          <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                            {['emoji', 'url'].map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  const updated = {
                                    ...businessConfig.vehicles,
                                    [id]: { ...v, imageType: type }
                                  };
                                  setBusinessConfig({ ...businessConfig, vehicles: updated });
                                }}
                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                                  (v.imageType || 'emoji') === type ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white font-black' : 'text-neutral-400 hover:text-neutral-600'
                                }`}
                              >
                                {type === 'emoji' ? 'Mtumiaji Emoji' : 'Mtumiaji Picha'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Emoji Input (if imageType is emoji) */}
                        {(v.imageType || 'emoji') === 'emoji' ? (
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Emoji (Mfano: 🚗, 🛺, 🏍️)</Label>
                            <Input
                              value={v.image || ''}
                              onChange={(e) => {
                                const updated = {
                                  ...businessConfig.vehicles,
                                  [id]: { ...v, image: e.target.value }
                                };
                                setBusinessConfig({ ...businessConfig, vehicles: updated });
                              }}
                              className="h-11 rounded-xl border-none bg-neutral-100 dark:bg-neutral-800 text-center text-xl"
                            />
                          </div>
                        ) : (
                          /* Custom Catalog Image URL / Upload (if imageType is url) */
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Linki ya Picha (Image Link)</Label>
                            <div className="space-y-2">
                              <Input
                                placeholder="Weka direct image URL au bofya pakia"
                                value={v.imageUrl || ''}
                                onChange={(e) => {
                                  const updated = {
                                    ...businessConfig.vehicles,
                                    [id]: { ...v, imageUrl: e.target.value }
                                  };
                                  setBusinessConfig({ ...businessConfig, vehicles: updated });
                                }}
                                className="h-11 rounded-xl border-none bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white font-medium"
                              />
                              <div className="flex items-center gap-3">
                                <Label className="shrink-0 cursor-pointer text-xs font-black uppercase text-[#7F77DD] bg-[#7F77DD]/10 px-4 py-2.5 rounded-xl border border-dashed border-[#7F77DD]/30 hover:bg-[#7F77DD]/20 transition-all">
                                  {uploadingVehicleId === id && uploadingType === 'imageUrl' ? 'Inapakia...' : 'Pakia Picha'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleVehicleImageUpload(e, id, 'imageUrl')}
                                    disabled={uploadingVehicleId !== null}
                                  />
                                </Label>
                                {v.imageUrl && (
                                  <span className="text-[9px] text-green-500 font-bold uppercase truncate">✓ Imewekwa</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Custom Map Marker Icon */}
                        <div className="space-y-2 border-t border-neutral-250 dark:border-neutral-800 pt-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Picha ya Kwenye Ramani (Map Marker)</Label>
                          <div className="space-y-2">
                            <Input
                              placeholder="Weka map icon direct image URL"
                              value={v.mapMarkerUrl || ''}
                              onChange={(e) => {
                                const updated = {
                                  ...businessConfig.vehicles,
                                  [id]: { ...v, mapMarkerUrl: e.target.value }
                                };
                                setBusinessConfig({ ...businessConfig, vehicles: updated });
                              }}
                              className="h-11 rounded-xl border-none bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white font-medium"
                            />
                            <div className="flex items-center gap-3">
                              <Label className="shrink-0 cursor-pointer text-xs font-black uppercase text-teal-600 bg-teal-50 dark:bg-teal-950/20 px-4 py-2.5 rounded-xl border border-dashed border-teal-200 dark:border-teal-900/40 hover:bg-teal-100 transition-all">
                                {uploadingVehicleId === id && uploadingType === 'mapMarkerUrl' ? 'Inapakia...' : 'Pakia Maps Icon'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleVehicleImageUpload(e, id, 'mapMarkerUrl')}
                                  disabled={uploadingVehicleId !== null}
                                />
                              </Label>
                              {v.mapMarkerUrl ? (
                                <div className="flex flex-col gap-3 w-full">
                                  <div className="flex items-center gap-2">
                                    <img src={v.mapMarkerUrl} className="w-8 h-8 object-contain rounded-lg border bg-neutral-50 dark:bg-neutral-800" referrerPolicy="no-referrer" />
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const updated = {
                                          ...businessConfig.vehicles,
                                          [id]: { ...v, mapMarkerUrl: '', mapMarkerLayout: 'top_down' }
                                        };
                                        setBusinessConfig({ ...businessConfig, vehicles: updated });
                                      }}
                                      className="text-[9px] text-red-500 font-bold uppercase hover:underline"
                                    >
                                      Ondoa
                                    </button>
                                  </div>

                                  <div className="space-y-2 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-[#7F77DD] block">Mtindo wa Ikoni ya Ramani (Map Marker Style)</Label>
                                    <div className="flex flex-col gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                      {[
                                        { id: 'top_down', label: '1. SVG ya Asili (Top-Down SVG)' },
                                        { id: 'custom_side', label: '2. Picha ya Pembeni (Side profile - flips East/West)' },
                                        { id: 'custom_top_down', label: '3. Picha ya Juu (Top-down - rotates 360°)' }
                                      ].map((style) => {
                                        const currentLayout = v.mapMarkerLayout || (v.mapMarkerLayout === 'custom' ? 'custom_side' : 'top_down');
                                        const isSelected = (style.id === 'custom_side' && currentLayout === 'custom') || currentLayout === style.id;
                                        return (
                                          <button
                                            key={style.id}
                                            type="button"
                                            onClick={() => {
                                              const updated = {
                                                ...businessConfig.vehicles,
                                                [id]: { ...v, mapMarkerLayout: style.id }
                                              };
                                              setBusinessConfig({ ...businessConfig, vehicles: updated });
                                            }}
                                            className={`text-left py-1.5 px-3 rounded-lg text-[8.5px] font-black uppercase transition-all ${
                                              isSelected ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white font-black' : 'text-neutral-500 hover:text-neutral-700'
                                            }`}
                                          >
                                            {style.label}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Show Orientation option ONLY when custom_top_down is selected */}
                                    {v.mapMarkerLayout === 'custom_top_down' && (
                                      <div className="space-y-1.5 pl-2 border-l-2 border-[#7F77DD]/40 pt-1">
                                        <Label className="text-[8.5px] font-black uppercase tracking-widest text-[#7F77DD] block">Mwelekeo wa Asili wa Picha (Image Original Facing)</Label>
                                        <div className="grid grid-cols-2 gap-1 bg-neutral-150 dark:bg-neutral-800 p-1 rounded-xl">
                                          {[
                                            { id: 'left', label: 'Inaangalia Kushoto (e.g. Pikipiki)' },
                                            { id: 'top', label: 'Inaangalia Juu' },
                                            { id: 'right', label: 'Inaangalia Kulia' },
                                            { id: 'bottom', label: 'Inaangalia Chini' }
                                          ].map((orient) => {
                                            const currentOrient = v.mapMarkerOrientation || 'left';
                                            const isSelected = currentOrient === orient.id;
                                            return (
                                              <button
                                                key={orient.id}
                                                type="button"
                                                onClick={() => {
                                                  const updated = {
                                                    ...businessConfig.vehicles,
                                                    [id]: { ...v, mapMarkerOrientation: orient.id }
                                                  };
                                                  setBusinessConfig({ ...businessConfig, vehicles: updated });
                                                }}
                                                className={`py-1 px-1.5 rounded-lg text-[7.5px] font-black uppercase transition-all ${
                                                  isSelected ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white font-black' : 'text-neutral-400 hover:text-neutral-500'
                                                }`}
                                              >
                                                {orient.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <p className="text-[7px] text-neutral-400 leading-normal">
                                          Teua uelekeo wa mbele ya chombo cha usafiri kwenye picha uliyopakia, ramani dhabiti itazungusha vizuri kulingana na barabara!
                                        </p>
                                      </div>
                                    )}

                                    <p className="text-[7.5px] text-neutral-400 leading-normal">
                                      <b>Top-Down SVG:</b> Inazunguka 360° kufuata barabara. <b>Picha ya Pembeni:</b> Inageuka kushoto/kulia bila kuzunguka kiupinde. <b>Picha ya Juu:</b> Inazunguka 360° barabarani kulingana na barabara!
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[9px] text-neutral-400 font-bold uppercase">Inatumia SVG ya asili (Top-Down)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button 
                    className="h-14 px-16 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-100 font-black uppercase tracking-widest" 
                    onClick={handleSaveSettings}
                  >
                    Hifadhi Mabadiliko (Save Vehicles Settings)
                  </Button>
                </div>
              </div>
            )}

            {activeSettingsTab === 'pricing_rules' && (
              <div className="space-y-8 animate-in fade-in-50 duration-200">
                {/* Description Card */}
                <Card className="rounded-[3rem] border-none shadow-2xl p-8 bg-gradient-to-br from-neutral-900 to-indigo-950/40 border border-indigo-900/30 text-white space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                        <Coins className="w-6 h-6 text-orange-500 animate-pulse" />
                        Meneja wa Ushuru na Bei za Safari (City Pricing & Tariffs)
                      </h3>
                      <p className="text-xs text-indigo-200/80 font-medium">
                        Mfumo huu unakuruhusu kupanga bei ya kuanza safari (Base fare), malipo kwa kila Kilometa (Distance charges), ada ya kusubiri (Waiting fees), kodi za kila mji, ada za usiku (Night charges), na bei ya kuongezeka kwa uhitaji (Surge logic) kwa kila aina ya safari na mji.
                      </p>
                    </div>
                  </div>
                </Card>

                {/* City Selection Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(businessConfig.pricingRules || DEFAULT_PRICING_RULES).map((cityName) => {
                      const cityData = (businessConfig.pricingRules || DEFAULT_PRICING_RULES)[cityName];
                      const isActive = cityData?.active;
                      return (
                        <button
                          key={cityName}
                          onClick={() => setSelectedPricingCity(cityName)}
                          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                            selectedPricingCity === cityName
                              ? 'bg-orange-600 text-white shadow-md'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{cityName}</span>
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    {isAddingCity ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newCityName}
                          placeholder="Jina la Mji Mpya"
                          onChange={(e) => setNewCityName(e.target.value)}
                          className="h-10 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-850"
                        />
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                          onClick={() => {
                            if (!newCityName.trim()) {
                              toast.error("Tafadhali weka jina la mji!");
                              return;
                            }
                            const name = newCityName.trim();
                            const rules = businessConfig.pricingRules || DEFAULT_PRICING_RULES;
                            if (rules[name]) {
                              toast.error("Mji huu tayari upo!");
                              return;
                            }
                            const updated = {
                              ...rules,
                              [name]: {
                                name: name,
                                state: "Mkoa mpya",
                                country: "Tanzania",
                                lat: -6.7924,
                                lng: 39.2083,
                                active: true,
                                serviceStart: "05:00 AM",
                                serviceEnd: "11:00 PM",
                                nightMultiplier: 1.15,
                                nightStart: "10:00 PM",
                                nightEnd: "06:00 AM",
                                taxName: "VAT",
                                taxRate: 15,
                                taxDescription: "Kodi ya Ongezeko la Thamani",
                                taxActive: true,
                                rates: {
                                  mini: { baseFare: 1000, pricePerKm: 800, pricePerMin: 100, waitingRate: 120, surgeRush: 1.25, surgeRain: 1.5 },
                                  bajaj: { baseFare: 500, pricePerKm: 500, pricePerMin: 0, waitingRate: 50, surgeRush: 1.15, surgeRain: 1.3 },
                                  bike: { baseFare: 300, pricePerKm: 350, pricePerMin: 0, waitingRate: 30, surgeRush: 1.1, surgeRain: 1.2 }
                                }
                              }
                            };
                            setBusinessConfig({ ...businessConfig, pricingRules: updated });
                            setSelectedPricingCity(name);
                            setNewCityName("");
                            setIsAddingCity(false);
                            toast.success(`Mji wa ${name} umeongezwa!`);
                          }}
                        >
                          Ongeza
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-bold text-xs"
                          onClick={() => setIsAddingCity(false)}
                        >
                          Futa
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setIsAddingCity(true)}
                        className="bg-neutral-900 hover:bg-neutral-900/90 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white font-bold text-xs uppercase flex items-center gap-2 rounded-xl"
                        size="sm"
                      >
                        <Plus className="w-4 h-4" />
                        + Ongeza Mji
                      </Button>
                    )}
                  </div>
                </div>

                {/* Actual Form for Selected City */}
                {(() => {
                  const rules = businessConfig.pricingRules || DEFAULT_PRICING_RULES;
                  const city = rules[selectedPricingCity];
                  if (!city) {
                    return (
                      <div className="bg-white dark:bg-neutral-950 p-12 rounded-3xl text-center border">
                        <MapPin className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                        <p className="text-neutral-400 font-bold uppercase text-xs">Mji huu ulikua umechaguliwa lakini haupo kwenye vigezo. Tafadhali chagua mwingine.</p>
                      </div>
                    );
                  }

                  const updateCityField = (field: string, value: any) => {
                    const updatedCity = { ...city, [field]: value };
                    const updatedPricing = { ...rules, [selectedPricingCity]: updatedCity };
                    setBusinessConfig({ ...businessConfig, pricingRules: updatedPricing });
                  };

                  const updateRideRate = (rideId: string, rateField: string, value: number) => {
                    const currentRates = city.rates || {
                      mini: { baseFare: 1000, pricePerKm: 800, pricePerMin: 100, waitingRate: 120, surgeRush: 1.25, surgeRain: 1.5 },
                      bajaj: { baseFare: 500, pricePerKm: 500, pricePerMin: 0, waitingRate: 50, surgeRush: 1.15, surgeRain: 1.3 },
                      bike: { baseFare: 300, pricePerKm: 350, pricePerMin: 0, waitingRate: 30, surgeRush: 1.1, surgeRain: 1.2 }
                    };
                    const updatedRideRates = {
                      ...currentRates,
                      [rideId]: {
                        ...currentRates[rideId],
                        [rateField]: value
                      }
                    };
                    updateCityField('rates', updatedRideRates);
                  };

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Subtabs Vertical menu */}
                      <div className="lg:col-span-1 space-y-2">
                        {[
                          { id: 'basic_info', label: 'Taarifa za Msingi', sub: 'Basic Location & Active State' },
                          { id: 'service_hours', label: 'Masaa ya Huduma', sub: 'Operating Service Window' },
                          { id: 'night_charges', label: 'Ada za Usiku (Night)', sub: 'Night Surcharges & Hours' },
                          { id: 'tariffs', label: 'Bei ya Kila Chombo', sub: 'Base & Distances Charges' },
                          { id: 'tax', label: 'Kodi za Mji (Tax Rules)', sub: 'GST / VAT / Service Levies' },
                          { id: 'geofence', label: 'Mipaka ya Eneo (Geofence)', sub: 'Tengeneza Mipaka na Kanda za Ramani' },
                        ].map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setPricingSubTab(sub.id as any)}
                            className={`w-full text-left p-4 rounded-3xl transition-all border ${
                              pricingSubTab === sub.id
                                ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-100/50 dark:shadow-none'
                                : 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                            }`}
                          >
                            <div className="font-extrabold text-xs uppercase tracking-tight">{sub.label}</div>
                            <div className={`text-[9px] font-medium mt-0.5 ${pricingSubTab === sub.id ? 'text-orange-100/80' : 'text-neutral-400'}`}>{sub.sub}</div>
                          </button>
                        ))}

                        {/* Delete City Option */}
                        {selectedPricingCity !== "Dar es Salaam" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Je, una uhakika unataka kuondoa kabisa mji wa ${selectedPricingCity}?`)) {
                                const clonedRules = { ...rules };
                                delete clonedRules[selectedPricingCity];
                                setBusinessConfig({ ...businessConfig, pricingRules: clonedRules });
                                setSelectedPricingCity("Dar es Salaam");
                                toast.success("Mji umeondolewa kutoka kwenye mfumo!");
                              }
                            }}
                            className="w-full text-left p-4 rounded-3xl bg-red-550/10 hover:bg-red-500/15 border border-red-500/20 text-red-600 transition-all flex items-center justify-between"
                          >
                            <div>
                              <div className="font-extrabold text-xs uppercase tracking-tight">Ondoa Mji</div>
                              <div className="text-[9px] opacity-85 font-semibold mt-0.5">Futa herufi na bei za mji huu</div>
                            </div>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Form Editor content container */}
                      <div className="lg:col-span-3">
                        <Card className="rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 space-y-6 bg-white dark:bg-neutral-900">
                          
                          {/* Basic Info Tab */}
                          {pricingSubTab === 'basic_info' && (
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">Hatua ya 1: Taarifa ya Eneo & Upatikanaji</h4>
                                <p className="text-[11px] text-neutral-400 font-medium mt-1">Hapa unaweka jina la mji, mkoa wake, na viwango vya kijiografia vya katikati ya mji huu kwa huduma za usafiri.</p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Jina la Mji (City Name)*</Label>
                                  <Input
                                    value={city.name || ""}
                                    disabled={selectedPricingCity === "Dar es Salaam"}
                                    onChange={(e) => updateCityField('name', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-805 dark:text-white"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Mkoa/Jimbo (State/Province)</Label>
                                  <Input
                                    value={city.state || ""}
                                    onChange={(e) => updateCityField('state', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-808 dark:text-white"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nchi (Country)*</Label>
                                  <Input
                                    value={city.country || ""}
                                    onChange={(e) => updateCityField('country', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Hali ya Utumishi (Status/Active)*</Label>
                                  <div className="flex items-center justify-between h-11 bg-neutral-50 dark:bg-neutral-950 px-4 rounded-xl border">
                                    <span className="text-xs font-semibold text-neutral-400">Ruhusu huduma mji huu</span>
                                    <Switch
                                      checked={city.active !== false}
                                      onCheckedChange={(checked) => updateCityField('active', checked)}
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 md:col-span-2">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Latitude (Lat)*</Label>
                                    <Input
                                      type="number"
                                      step="0.0001"
                                      value={city.lat || ""}
                                      onChange={(e) => updateCityField('lat', Number(e.target.value))}
                                      className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Longitude (Lng)*</Label>
                                    <Input
                                      type="number"
                                      step="0.0001"
                                      value={city.lng || ""}
                                      onChange={(e) => updateCityField('lng', Number(e.target.value))}
                                      className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Service Hours Tab */}
                          {pricingSubTab === 'service_hours' && (
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">Hatua ya 2: Masaa ya Huduma (Service Hours)</h4>
                                <p className="text-[11px] text-neutral-400 font-medium mt-1">Ufafanuzi wa muda kuanzia asubuhi hadi usiku ambapo wateja wanaweza kuagiza gari, bajaji au pikipiki mji huu.</p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                                    Muda wa Kuanza Huduma (Service Start Time)*
                                  </Label>
                                  <Input
                                    value={city.serviceStart || "05:00 AM"}
                                    placeholder="Mifano: 05:00 AM au 06:00 AM"
                                    onChange={(e) => updateCityField('serviceStart', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white font-bold"
                                  />
                                  <span className="text-[9px] text-neutral-400 font-semibold uppercase">Muda utakaofungua upatikanaji</span>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-red-550" />
                                    Muda wa Kufunga Huduma (Service End Time)*
                                  </Label>
                                  <Input
                                    value={city.serviceEnd || "11:50 PM"}
                                    placeholder="Mifano: 11:59 PM au 11:00 PM"
                                    onChange={(e) => updateCityField('serviceEnd', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white font-bold"
                                  />
                                  <span className="text-[9px] text-neutral-400 font-semibold uppercase">Muda wa kuzima maombi ya usafiri</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Night Charges Tab */}
                          {pricingSubTab === 'night_charges' && (
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">Hatua ya 3: Ada na Masaa ya Usiku (Night Surcharges)</h4>
                                <p className="text-[11px] text-neutral-400 font-medium mt-1">Usiku huletea changamoto kubwa na upungufu wa madereva. Customize nyongeza ya bei ya usiku (mfano nyongeza ya 1.15 ifanane na +15%, au 1.50 kwa +50%) na masaa husika.</p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1">
                                    <Zap className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                                    Kiwango cha Nyongeza (Multiplier)*
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.05"
                                    value={city.nightMultiplier || 1.15}
                                    onChange={(e) => updateCityField('nightMultiplier', Number(e.target.value))}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-indigo-500 dark:text-indigo-400 font-extrabold text-center"
                                  />
                                  <span className="text-[9px] text-neutral-450 font-semibold block uppercase">Mifano: 1.15 inamaanisha nyongeza ya salama ya 15%</span>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1">
                                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                    Saa ya Kuanza (Start Time)*
                                  </Label>
                                  <Input
                                    value={city.nightStart || "10:00 PM"}
                                    onChange={(e) => updateCityField('nightStart', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-bold"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1">
                                    <Moon className="w-3.5 h-3.5 text-indigo-505" />
                                    Saa ya Kuisha (End Time)*
                                  </Label>
                                  <Input
                                    value={city.nightEnd || "05:00 AM"}
                                    onChange={(e) => updateCityField('nightEnd', e.target.value)}
                                    className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-bold"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Tariffs / Rates Tab */}
                          {pricingSubTab === 'tariffs' && (
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">Hatua ya 4: Ada za Kila Aina ya Chombo (Tariffs & Surge per Ride Type)</h4>
                                <p className="text-[11px] text-neutral-400 font-medium mt-1">Ukurasa wa kuweka viwango halisi vya nauli ambavyo vitahesabiwa kwa mji ulioteuliwa ({selectedPricingCity}) kwa kila chombo.</p>
                              </div>

                              <div className="space-y-8 divide-y divide-neutral-100 dark:divide-neutral-800">
                                {[
                                  { id: 'mini', name: 'Gari / Taxi (🚗)', defBase: 1000, defKm: 800, defMin: 100, defWait: 120 },
                                  { id: 'bajaj', name: 'Bajaji (🛺)', defBase: 500, defKm: 500, defMin: 0, defWait: 50 },
                                  { id: 'bike', name: 'Pikipiki / Boda (🏍️)', defBase: 300, defKm: 350, defMin: 0, defWait: 30 },
                                ].map((vt, vIdx) => {
                                  const rates = city.rates || {};
                                  const vRate = rates[vt.id] || {
                                    baseFare: vt.defBase,
                                    pricePerKm: vt.defKm,
                                    pricePerMin: vt.defMin,
                                    waitingRate: vt.defWait,
                                    surgeRush: 1.25,
                                    surgeRain: 1.5
                                  };

                                  return (
                                    <div key={vt.id} className={`pt-6 ${vIdx === 0 ? 'pt-0' : ''} space-y-4`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-600/5 dark:bg-orange-600/10 px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                                          <span>{vt.name}</span>
                                        </span>
                                        <span className="text-[9px] text-neutral-400 uppercase font-black tracking-widest">Usanidi wa Viwango</span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {/* Base Fare */}
                                        <div className="space-y-1.5">
                                          <Label className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Base Fare (TZS)*</Label>
                                          <Input
                                            type="number"
                                            value={vRate.baseFare}
                                            onChange={(e) => updateRideRate(vt.id, 'baseFare', Number(e.target.value))}
                                            className="h-10 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-bold text-xs"
                                          />
                                        </div>

                                        {/* Distance Rate */}
                                        <div className="space-y-1.5">
                                          <Label className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Kila KM (TZS)*</Label>
                                          <Input
                                            type="number"
                                            value={vRate.pricePerKm}
                                            onChange={(e) => updateRideRate(vt.id, 'pricePerKm', Number(e.target.value))}
                                            className="h-10 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-bold text-xs"
                                          />
                                        </div>

                                        {/* Traffic Rate */}
                                        <div className="space-y-1.5">
                                          <Label className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Kila Dk Safari (TZS)*</Label>
                                          <Input
                                            type="number"
                                            value={vRate.pricePerMin}
                                            onChange={(e) => updateRideRate(vt.id, 'pricePerMin', Number(e.target.value))}
                                            className="h-10 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-bold text-xs"
                                          />
                                        </div>

                                        {/* Waiting Rate */}
                                        <div className="space-y-1.5">
                                          <Label className="text-[9px] font-black uppercase tracking-wider text-neutral-505">Kila Dk Subira/Waiting (TZS)*</Label>
                                          <Input
                                            type="number"
                                            value={vRate.waitingRate !== undefined ? vRate.waitingRate : vt.defWait}
                                            onChange={(e) => updateRideRate(vt.id, 'waitingRate', Number(e.target.value))}
                                            className="h-10 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-bold text-xs"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                        {/* Surge Rush hour multiplier */}
                                        <div className="space-y-1.5">
                                          <Label className="text-[8.5px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-amber-500 animate-pulse" /> 
                                            Rush Hour Multiplier (Nyakati za kazi, mfano 1.25)*
                                          </Label>
                                          <Input
                                            type="number"
                                            step="0.05"
                                            value={vRate.surgeRush !== undefined ? vRate.surgeRush : 1.25}
                                            onChange={(e) => updateRideRate(vt.id, 'surgeRush', Number(e.target.value))}
                                            className="h-10 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-extrabold text-xs text-amber-500"
                                          />
                                        </div>
                                        
                                        {/* Surge Rain multiplier */}
                                        <div className="space-y-1.5">
                                          <Label className="text-[8.5px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-emerald-500 animate-pulse" /> 
                                            Rain/Mvua Surge Multiplier (Mfano 1.50)*
                                          </Label>
                                          <Input
                                            type="number"
                                            step="0.05"
                                            value={vRate.surgeRain !== undefined ? vRate.surgeRain : 1.50}
                                            onChange={(e) => updateRideRate(vt.id, 'surgeRain', Number(e.target.value))}
                                            className="h-10 rounded-xl border bg-neutral-50 dark:bg-neutral-950 font-extrabold text-xs text-emerald-500"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Tax Tab */}
                          {pricingSubTab === 'tax' && (
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white">Hatua ya 5: Kodi ya Jiji na Udhibiti wa Mapato (City Tax Rules)</h4>
                                <p className="text-[11px] text-neutral-400 font-medium mt-1">Hapa unaweza kupanda kodi au tozo ya mji inayojumuishwa moja kwa moja wakati wa kuunganisha nauli kwa ajili ya serikali ya mji husika au huduma ya mkoa.</p>
                              </div>

                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Jina la Kodi / Tozo (Tax Name)*</Label>
                                    <Input
                                      placeholder="Mifano: VAT, GST, Tozo la Jiji"
                                      value={city.taxName || ""}
                                      onChange={(e) => updateCityField('taxName', e.target.value)}
                                      className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white font-black text-xs"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Kiwango cha Kodi (Tax Rate - %)*</Label>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="Mfano: 15"
                                        value={city.taxRate !== undefined ? city.taxRate : 15}
                                        onChange={(e) => updateCityField('taxRate', Number(e.target.value))}
                                        className="h-11 rounded-xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white font-extrabold text-xs pr-10"
                                      />
                                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-black text-xs">%</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Maelezo (Description)</Label>
                                  <Textarea
                                    placeholder="Ufafanuzi wa tozo hii..."
                                    value={city.taxDescription || ""}
                                    onChange={(e) => updateCityField('taxDescription', e.target.value)}
                                    className="rounded-2xl border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white text-xs max-h-24 font-semibold"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Kodi Inafanya Kazi (Active Status)</Label>
                                  <div className="flex items-center justify-between h-11 bg-neutral-50 dark:bg-neutral-950 px-4 rounded-xl border w-fit gap-4">
                                    <span className="text-xs font-semibold text-neutral-400">Ruhusu kodi hii kukatwa kwenye nauli</span>
                                    <Switch
                                      checked={city.taxActive !== false}
                                      onCheckedChange={(checked) => updateCityField('taxActive', checked)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Geofence Tab */}
                          {pricingSubTab === 'geofence' && (
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-white flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-orange-500 animate-bounce" />
                                  Hatua ya 6: Mipaka ya Eneo la Huduma (Geofencing Boundary)
                                </h4>
                                <p className="text-[11px] text-neutral-400 font-medium mt-1">
                                  Weka mipaka halisi ya kijiografia ya mji huo. Maombi yanayotoka au kuelekea nje ya mipaka hii yatazuiliwa na kuonyesha onyo kwa mteja.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  {/* Geofence Active Switch */}
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Udhibiti wa Mpaka (Geofence Restriction)</Label>
                                    <div className="flex items-center justify-between h-11 bg-neutral-50 dark:bg-neutral-950 px-4 rounded-xl border">
                                      <span className="text-xs font-semibold text-neutral-400">Amilisha Kizuizi cha Mpaka mji huu</span>
                                      <Switch
                                        checked={city.geofenceActive !== false}
                                        onCheckedChange={(checked) => updateCityField('geofenceActive', checked)}
                                      />
                                    </div>
                                  </div>

                                  {/* Geofence Type Selection */}
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Aina ya Mpaka (Shape Type)</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateCityField('geofenceType', 'circle')}
                                        className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase transition-all ${
                                          (city.geofenceType || 'circle') === 'circle'
                                            ? 'bg-orange-600 border-orange-600 text-white'
                                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 text-neutral-500'
                                        }`}
                                      >
                                        Mduara (Circle Radius)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateCityField('geofenceType', 'polygon')}
                                        className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase transition-all ${
                                          (city.geofenceType || 'circle') === 'polygon'
                                            ? 'bg-orange-600 border-orange-600 text-white'
                                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 text-neutral-500'
                                        }`}
                                      >
                                        Mchoro (Custom Polygon)
                                      </button>
                                    </div>
                                  </div>

                                  {/* Conditional Radius selection */}
                                  {(city.geofenceType || 'circle') === 'circle' ? (
                                    <div className="space-y-2.5">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Mduara wa Huduma (Radius)</Label>
                                        <span className="text-xs font-black text-orange-500 bg-orange-500/5 px-2.5 py-0.5 rounded-full">
                                          {Math.round((city.geofenceRadius || 15000) / 1000)} Km ({city.geofenceRadius || 15000} m)
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min="1000"
                                        max="100000"
                                        step="500"
                                        value={city.geofenceRadius || 15000}
                                        onChange={(e) => updateCityField('geofenceRadius', Number(e.target.value))}
                                        className="w-full accent-orange-600 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                                      />
                                      <p className="text-[10px] text-neutral-400 font-medium">Buruza slider hapo juu kubadilisha upana wa mduara wa mji. (Kiwango cha sasa hapa ni kutoka 1km hadi 100km).</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Viwango vya Pointi (Polygon Vertices)</Label>
                                        <span className="text-[10px] font-black text-orange-500 bg-orange-605/5 px-2.5 py-0.5 rounded-full">
                                          {(city.geofencePolygon || []).length} Pointi zilizopo
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-[9px] font-black uppercase py-1 border-dashed"
                                          onClick={() => {
                                            const lat_c = city.lat || -6.7924;
                                            const lng_c = city.lng || 39.2083;
                                            const box: [number, number][] = [
                                              [lat_c + 0.05, lng_c - 0.05],
                                              [lat_c + 0.05, lng_c + 0.05],
                                              [lat_c - 0.05, lng_c + 0.05],
                                              [lat_c - 0.05, lng_c - 0.05],
                                            ];
                                            updateCityField('geofencePolygon', box);
                                            toast.info("Mstatili wa kuanzia umetengenezwa karibu na mji!");
                                          }}
                                        >
                                          Tengeneza Mstatili wa Kuanzia
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-[9px] font-black uppercase py-1 text-red-500 border-red-500/30 hover:bg-red-500/5"
                                          onClick={() => {
                                            updateCityField('geofencePolygon', []);
                                            toast.success("Pointi zote za mchoro zimefutwa!");
                                          }}
                                        >
                                          Masihisha Zote (Clear All)
                                        </Button>
                                      </div>
                                      <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-tight">Viwango vya Kijiografia vya sasa:</p>
                                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1 bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-xl border">
                                        {((city.geofencePolygon || []) as [number, number][]).length === 0 ? (
                                          <p className="text-[10px] text-neutral-400 font-bold text-center py-2 uppercase">Hakuna pointi zilizochorwa. Bonyeza kwenye ramani ili upate pointi ya kwanza!</p>
                                        ) : (
                                          ((city.geofencePolygon || []) as [number, number][]).map((pt: [number, number], idx: number) => (
                                            <div key={`cord-${idx}`} className="flex justify-between items-center text-[9px] font-mono font-bold bg-white dark:bg-neutral-900 border px-2 py-1 rounded-lg">
                                              <span>Pointi #{idx + 1}: {pt[0].toFixed(5)}, {pt[1].toFixed(5)}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const cloned = [...(city.geofencePolygon || [])];
                                                  cloned.splice(idx, 1);
                                                  updateCityField('geofencePolygon', cloned);
                                                }}
                                                className="text-red-500 hover:text-red-700 font-bold uppercase text-[8px]"
                                              >
                                                Ondoa
                                              </button>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Display instructions */}
                                  <div className="bg-orange-600/5 border border-orange-500/10 p-4 rounded-2xl flex gap-2.5">
                                    <Info className="w-4 h-4 text-orange-500 shrink-0" />
                                    <div className="space-y-1">
                                      <p className="font-extrabold text-[10px] uppercase text-orange-600 dark:text-orange-400">Jinsi ya Kutumia:</p>
                                      <p className="text-[10px] text-neutral-400 font-semibold leading-relaxed">
                                        {(city.geofenceType || 'circle') === 'circle' 
                                          ? "Bofya popote kwenye ramani ya kulia ili kuweka alama ya kuanzia (City Center). Unaweza also kumburuta mchezo wa marker uliopo ili kuhamisha katikati ya mji wetu."
                                          : "Bonyeza mara kadhaa kwenye ramani ya kulia ili kupanda vertices za mchoro mpya wa huduma. Pointi 3 au zaidi zinajenga eneo lililofungwa kikamilifu kuzuia matumizi."
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Maingiliano na Ramani (Interactive Geofence Map)</Label>
                                  <div className="h-[28rem] rounded-[2rem] overflow-hidden border border-neutral-100 dark:border-neutral-800 z-0 relative">
                                    {(() => {
                                      const centerCoords: [number, number] = city.geofenceCenter 
                                        ? [city.geofenceCenter.lat, city.geofenceCenter.lng] 
                                        : [city.lat || -6.7924, city.lng || 39.2083];
                                      
                                      const radiusVal = city.geofenceRadius || 15000;
                                      const activeVal = city.geofenceActive !== false;
                                      const typeVal = city.geofenceType || 'circle';
                                      const polyPts: [number, number][] = city.geofencePolygon || [];

                                      return (
                                        <MapContainer
                                          center={centerCoords}
                                          zoom={11}
                                          className="w-full h-full"
                                        >
                                          <TileLayer
                                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                            maxZoom={20}
                                          />
                                          <GeofenceMapSelector
                                            center={centerCoords}
                                            radius={radiusVal}
                                            active={activeVal}
                                            type={typeVal}
                                            polygonPoints={polyPts}
                                            onCenterChange={(newCenter) => {
                                              updateCityField('geofenceCenter', { lat: newCenter[0], lng: newCenter[1] });
                                              updateCityField('lat', newCenter[0]);
                                              updateCityField('lng', newCenter[1]);
                                            }}
                                            onPolygonAddPoint={(newPt) => {
                                              const pts = [...polyPts];
                                              pts.push(newPt);
                                              updateCityField('geofencePolygon', pts);
                                            }}
                                            onPolygonRemovePoint={(idx) => {
                                              const pts = [...polyPts];
                                              pts.splice(idx, 1);
                                              updateCityField('geofencePolygon', pts);
                                            }}
                                            onPolygonUpdatePoint={(idx, newPt) => {
                                              const pts = [...polyPts];
                                              pts[idx] = newPt;
                                              updateCityField('geofencePolygon', pts);
                                            }}
                                          />
                                        </MapContainer>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Explicit save trigger at bottom of form card */}
                          <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                            <Button
                              onClick={handleSaveSettings}
                              className="h-12 px-8 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Hifadhi Vigezo vya {selectedPricingCity}
                            </Button>
                          </div>

                        </Card>
                      </div>
                    </div>
                  );
                })()}
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

      {/* Vendor Review Dialog */}
      <AnimatePresence>
        {selectedVendorForReview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVendorForReview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-neutral-950 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col transition-colors"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center text-white">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white leading-none">
                      {selectedVendorForReview.businessName}
                    </h3>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">
                      {selectedVendorForReview.category} • {selectedVendorForReview.status}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedVendorForReview(null)}
                  className="p-3 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {/* Basic Info & Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="relative h-48 rounded-[2rem] overflow-hidden group">
                      <img 
                        src={selectedVendorForReview.bannerUrl || 'https://picsum.photos/seed/banner/800/400'} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-3">
                        <img 
                          src={selectedVendorForReview.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedVendorForReview.businessName}`}
                          className="w-12 h-12 rounded-xl border-2 border-white shadow-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-white font-black uppercase italic tracking-tighter">Identity Verified</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2rem] text-neutral-400">Description</h4>
                      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 italic">
                        {selectedVendorForReview.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[1.5rem] space-y-2 border border-neutral-100 dark:border-neutral-800">
                      <PhoneCall className="w-5 h-5 text-orange-600" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Phone</p>
                      <p className="text-sm font-black text-neutral-900 dark:text-white uppercase italic">{selectedVendorForReview.phoneNumber || "N/A"}</p>
                    </div>
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[1.5rem] space-y-2 border border-neutral-100 dark:border-neutral-800">
                      <Mail className="w-5 h-5 text-orange-600" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Mail</p>
                      <p className="text-sm font-black text-neutral-900 dark:text-white truncate">{selectedVendorForReview.ownerUid.slice(0, 8)}...</p>
                    </div>
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[1.5rem] space-y-2 border border-neutral-100 dark:border-neutral-800">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Hours</p>
                      <p className="text-sm font-black text-neutral-900 dark:text-white uppercase italic">{selectedVendorForReview.operatingHours || "N/A"}</p>
                    </div>
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[1.5rem] space-y-2 border border-neutral-100 dark:border-neutral-800">
                      <MapPin className="w-5 h-5 text-orange-600" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Address</p>
                      <p className="text-xs font-black text-neutral-900 dark:text-white uppercase italic truncate" title={selectedVendorForReview.address}>{selectedVendorForReview.address || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Hotel Specific Information */}
                {selectedVendorForReview.category === 'hotel' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8 bg-orange-50/30 dark:bg-orange-950/10 p-8 rounded-[2.5rem] border border-orange-100 dark:border-orange-900/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white">
                        <Bed className="w-5 h-5" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white underline decoration-orange-600 decoration-2 underline-offset-4">Hotel Registration Details</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm space-y-1">
                        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Rooms</p>
                        <p className="text-sm font-black uppercase italic text-neutral-900 dark:text-white">{selectedVendorForReview.numberOfRooms || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm space-y-1">
                        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Pricing (VIP/Double/Single)</p>
                        <p className="text-sm font-black uppercase italic text-neutral-900 dark:text-white">
                          {selectedVendorForReview.roomPricing?.vip?.toLocaleString() || '-'} / {selectedVendorForReview.roomPricing?.double?.toLocaleString() || '-'} / {selectedVendorForReview.roomPricing?.single?.toLocaleString() || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Amenities</h5>
                        <div className="flex flex-wrap gap-2">
                          {selectedVendorForReview.amenities?.map((amenity, i) => (
                            <Badge key={i} className="bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 font-bold uppercase text-[9px] px-3 py-1">
                              {amenity}
                            </Badge>
                          ))}
                          {(!selectedVendorForReview.amenities || selectedVendorForReview.amenities.length === 0) && <p className="text-xs italic text-neutral-400">No amenities listed.</p>}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Hotel Gallery</h5>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {selectedVendorForReview.galleryPhotos?.map((photo, i) => (
                            <img 
                              key={i} 
                              src={photo} 
                              className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-md shrink-0" 
                              referrerPolicy="no-referrer"
                            />
                          ))}
                          {(!selectedVendorForReview.galleryPhotos || selectedVendorForReview.galleryPhotos.length === 0) && <p className="text-xs italic text-neutral-400">No gallery photos.</p>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Documents & Verification */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white">Documents & KYC</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 space-y-4">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                         <User className="w-4 h-4" /> Owner Information
                       </h5>
                       {selectedVendorForReview.ownerInfo ? (
                         <div className="space-y-3">
                           <p className="text-sm"><span className="text-[10px] font-black uppercase text-neutral-400 block">Name</span> <span className="font-bold text-neutral-900 dark:text-white uppercase">{selectedVendorForReview.ownerInfo.firstName} {selectedVendorForReview.ownerInfo.lastName}</span></p>
                           <p className="text-sm"><span className="text-[10px] font-black uppercase text-neutral-400 block">ID/Passport</span> <span className="font-bold text-neutral-900 dark:text-white">{selectedVendorForReview.ownerInfo.nationalId || 'N/A'}</span></p>
                           <p className="text-sm"><span className="text-[10px] font-black uppercase text-neutral-400 block">Email</span> <span className="font-bold text-neutral-900 dark:text-white">{selectedVendorForReview.ownerInfo.email}</span></p>
                           <p className="text-sm"><span className="text-[10px] font-black uppercase text-neutral-400 block">Phone/WhatsApp</span> <span className="font-bold text-neutral-900 dark:text-white">{selectedVendorForReview.ownerInfo.phone} / {selectedVendorForReview.ownerInfo.whatsapp || '-'}</span></p>
                         </div>
                       ) : (
                         <p className="text-xs italic text-neutral-400">Standard vendor profile - minimal owner info.</p>
                       )}
                    </div>

                    <div className="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 space-y-6">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                         <FileText className="w-4 h-4" /> Business License & Tax
                       </h5>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-xl">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">TIN Number</span>
                            <span className="font-black text-neutral-900 dark:text-white uppercase italic">{selectedVendorForReview.tin}</span>
                          </div>
                          {selectedVendorForReview.businessDocs?.licenseUrl ? (
                             <a 
                               href={selectedVendorForReview.businessDocs.licenseUrl} 
                               target="_blank" 
                               rel="noreferrer"
                               className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-xl hover:bg-orange-50 transition-colors group"
                             >
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Business License</span>
                                <ExternalLink className="w-4 h-4 text-orange-600 group-hover:scale-110 transition-transform" />
                             </a>
                          ) : (
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl opacity-50">
                               <p className="text-[10px] font-black uppercase text-neutral-400">License Not Uploaded</p>
                            </div>
                          )}
                          {selectedVendorForReview.businessDocs?.taxCertUrl && (
                             <a 
                               href={selectedVendorForReview.businessDocs.taxCertUrl} 
                               target="_blank" 
                               rel="noreferrer"
                               className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-xl hover:bg-orange-50 transition-colors group"
                             >
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tax Certificate</span>
                                <ExternalLink className="w-4 h-4 text-orange-600 group-hover:scale-110 transition-transform" />
                             </a>
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex gap-4">
                <Button 
                  onClick={() => {
                    handleApprove(selectedVendorForReview.id!);
                    setSelectedVendorForReview(null);
                  }}
                  disabled={selectedVendorForReview.status === 'active'}
                  className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-green-100"
                >
                  Approve Application
                </Button>
                <Button 
                  onClick={() => {
                    handleReject(selectedVendorForReview.id!);
                    setSelectedVendorForReview(null);
                  }}
                  variant="outline"
                  className="flex-1 h-14 border-red-200 text-red-500 hover:bg-red-50 rounded-[1.5rem] font-black uppercase tracking-widest text-xs"
                >
                  Reject & Suspend
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Admin Mobile More Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsMobileMenuOpen(false)}
               className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               className="md:hidden fixed top-0 right-0 h-full w-full max-w-[300px] bg-white dark:bg-neutral-900 z-[201] shadow-2xl flex flex-col p-6 overflow-y-auto"
            >
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black uppercase italic tracking-tighter">More Tabs</h2>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               <div className="flex flex-col gap-2">
                  {adminTabs.slice(3).map((tab) => (
                     <button
                        key={tab.id}
                        onClick={() => {
                           setActiveTab(tab.id as AdminTab);
                           setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center gap-4 px-6 p-4 rounded-2xl text-sm font-black uppercase tracking-tight transition-all ${
                          activeTab === tab.id 
                            ? 'bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white' 
                            : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                     >
                        <tab.icon className="w-5 h-5" />
                        <span>{tab.label}</span>
                     </button>
                  ))}
                  
                  <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-4 px-6 p-4 rounded-2xl text-sm font-black uppercase tracking-tight text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 w-full transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>{t('sign_out')}</span>
                    </button>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Admin Bottom Navigation */}
      <motion.nav 
        initial={{ y: 0 }}
        animate={{ y: isNavVisible ? 0 : 100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-[120] h-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] transition-colors duration-300"
      >
        <div className="h-full px-2 flex justify-around items-center max-w-md mx-auto">
           {adminTabs.slice(0, 4).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-all ${activeTab === tab.id ? 'text-red-600' : 'text-neutral-400'}`}
              >
                 <div className={`p-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-red-600/10' : ''}`}>
                   <tab.icon className="w-5 h-5" />
                 </div>
                 <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>
                    {tab.label.split(' ')[0]}
                 </span>
              </button>
           ))}
           <button
             onClick={() => setIsMobileMenuOpen(true)}
             className="flex flex-col items-center justify-center gap-1.5 flex-1 text-neutral-400"
           >
              <div className="p-2">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">More</span>
           </button>
        </div>
      </motion.nav>
    </div>
  );
}

function MapBoundsUpdater({ drivers, rides }: { drivers: any[], rides: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (drivers.length === 0 && rides.length === 0) return;
    
    const points: L.LatLngExpression[] = [];
    drivers.forEach(d => {
      const pos = d.location || d.currentPosition;
      if (pos) points.push([pos.lat, pos.lng]);
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
