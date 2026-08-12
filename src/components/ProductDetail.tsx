import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, limit, setDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { useBusinessConfig } from '../BusinessConfigContext';
import { initiatePayment } from '../services/paymentService';
import { Product, VendorProfile, FAQ } from '../types';
import ReviewSection from './reviews/ReviewSection';
import MabasiMaarufuFlow from './MabasiMaarufuFlow';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight,
  Star, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Info, 
  Calendar, 
  Clock, 
  Users,
  MapPin,
  Sliders,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  ThumbsUp,
  MessageSquare,
  MessageCircle,
  Trash2,
  Reply,
  Megaphone,
  Smartphone,
  Phone,
  Utensils,
  UtensilsCrossed,
  Truck,
  Hash,
  ShoppingBag,
  Store,
  Package,
  Armchair,
  CheckCircle2,
  Share2,
  Box,
  Layout,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const formatCurrency = (amount: number) => {
  return `TZS ${amount.toLocaleString()}`;
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config: businessConfig } = useBusinessConfig();
  const { user, profile } = useAuth();
  const { addItem, setIsCartOpen } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showARView, setShowARView] = useState(false);
  const [activeTab, setActiveTab] = useState('Chaguzi');
  const arViewerRef = useRef<any>(null);

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);

  useEffect(() => {
    if (!product?.id || !db) return;
    const vendorCategory = vendor?.category || product?.category || '';
    if (vendorCategory === 'bus_ticket') {
      const q = query(
        collection(db, 'tables'),
        where('productId', '==', product.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        const booked: string[] = [];
        snap.docs.forEach((doc) => {
          const data = doc.data();
          const isPendingActive = data.status === 'pending' && data.expiresAt && data.expiresAt > Date.now();
          const isBooked = data.status === 'booked';
          if (isBooked || isPendingActive) {
            booked.push(String(data.seatNum));
          }
        });
        setBookedSeats(Array.from(new Set(booked)));
      }, (error) => {
        console.warn("Error listening to booked seats in tables:", error.message);
      });
      return () => unsub();
    }
  }, [product?.id, product?.vendorId, vendor?.category, product?.category]);

  const handleAddToCart = async () => {
    if (!product) return;
    const vendorCategory = vendor?.category || product?.category || '';
    if (vendorCategory === 'bus_ticket' && selectedSeats.length === 0) {
      toast.error('Tafadhali chagua kiti angalau kimoja! (Please select at least one seat!)');
      return;
    }

    if (vendorCategory === 'bus_ticket') {
      try {
        // Reserve selected seats for 10 minutes temporary hold during checkout
        for (const seat of selectedSeats) {
          const docId = `seat_${product.id}_${seat}`;
          await setDoc(doc(db, 'tables', docId), {
            id: docId,
            productId: product.id,
            seatNum: seat,
            customerId: user?.uid || 'anonymous',
            status: 'pending',
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
          });
        }
      } catch (err) {
        console.warn("Could not write temporary seat hold:", err);
      }
    }

    addItem({ 
      ...product, 
      quantity,
      variation: selectedSize,
      addons: selectedAddons,
      orderType,
      tableNumber: orderType === 'walk_in' ? tableNumber : null,
      arrivalTime: orderType === 'walk_in' ? arrivalTime : null,
      selectedSeats: vendorCategory === 'bus_ticket' ? selectedSeats : undefined,
      departureDate: vendorCategory === 'bus_ticket' ? travelDate : undefined
    });
    toast.success('Imeongezwa kwenye kikapu', {
      description: `${quantity}x ${product.name} imewekwa.`,
      icon: <ShoppingBag className="w-5 h-5 text-orange-600" />
    });
  };

  // 3D & WebAR Camera State
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [autoRotate3D, setAutoRotate3D] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startLiveCamera = async () => {
    try {
      if (streamRef.current) {
        stopLiveCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsLiveCameraActive(true);
      toast.success('Kamera imefunguka! Sasa unaweza kuona chakula kwenye mazingira yako halisi.');
    } catch (err: any) {
      console.error('Camera stream error:', err);
      toast.error('Imeshindwa kufungua kamera. Hakikisha umetoa ruhusa ya Kamera kwenye browser yako.');
    }
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLiveCameraActive(false);
  };

  useEffect(() => {
    if (!showARView) {
      stopLiveCamera();
    }
  }, [showARView]);

  const format3dUrl = (url: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('sketchfab.com')) {
      const match = trimmed.match(/([a-f0-9]{32})/i);
      if (match && match[1]) {
        return `https://sketchfab.com/models/${match[1]}/embed?autostart=1&internal=1&tracking=0&ui_ar=1&ui_infos=0&ui_controls=1&ui_watermark=0&camera=0`;
      }
    }
    return trimmed;
  };

  const isModelValid = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.glb') || cleanUrl.endsWith('.gltf') || url.toLowerCase().includes('sketchfab.com') || checkIfPageOrWebAR(url);
  };

  const checkIfPageOrWebAR = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.glb') || cleanUrl.endsWith('.gltf')) {
      return false;
    }
    const lower = url.toLowerCase();
    return (lower.startsWith('http://') || lower.startsWith('https://')) && !lower.includes('sketchfab.com');
  };

  useEffect(() => {
    if (showARView && product) {
      const viewer = document.getElementById('main-ar-viewer');
      if (viewer) {
        const handleError = (e: any) => {
          console.warn('Model viewer event notice:', e);
        };
        viewer.addEventListener('error', handleError);
        return () => viewer.removeEventListener('error', handleError);
      }
    }
  }, [showARView, product?.model3dUrl]);

  // Adaptive States
  const [selectedSize, setSelectedSize] = useState('Normal');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [travelDate, setTravelDate] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('date') || new Date().toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'walk_in' | 'pickup'>('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [showManualTable, setShowManualTable] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('');
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [tableSession, setTableSession] = useState<any>(null);
  const [vendorTables, setVendorTables] = useState<any[]>([]);
  const [occupiedTables, setOccupiedTables] = useState<string[]>([]);

  useEffect(() => {
    if (vendor?.id) {
      // Fetch Vendor Tables (Sections)
      const unsubTables = onSnapshot(collection(db, 'vendors', vendor.id, 'sections'), (snap) => {
        setVendorTables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.warn("Restricted access or error listening to vendor areas:", error.message);
      });

      // Fetch Active Orders to find occupied tables
      const q = query(
        collection(db, 'orders'),
        where('vendorId', '==', vendor.id),
        where('status', 'in', ['pending', 'accepted', 'preparing', 'prepared']),
        where('orderType', '==', 'walk_in')
      );

      const unsubOrders = onSnapshot(q, (snap) => {
        const occupied = snap.docs
          .map(doc => doc.data().tableNumber)
          .filter(t => !!t);
        setOccupiedTables(occupied);
      }, (error) => {
        console.warn("Restricted access or error listening to active table orders:", error.message);
      });

      return () => {
        unsubTables();
        unsubOrders();
      };
    }
  }, [vendor?.id]);

  useEffect(() => {
    // 1. Process search query parameters first
    const params = new URLSearchParams(window.location.search);
    const urlTableId = params.get('tableId');
    const urlVendorId = params.get('vendorId');

    if (urlTableId && urlVendorId) {
      const session = {
        tableId: urlTableId,
        vendorId: urlVendorId,
        timestamp: Date.now()
      };
      localStorage.setItem('papo_hapo_table_session', JSON.stringify(session));
      setTableSession(session);
      setOrderType('walk_in');
      setTableNumber(urlTableId);
    } else {
      // 2. Fallback to existing saved session
      const savedSession = localStorage.getItem('papo_hapo_table_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          // check if same vendor
          const isSameVendor = product && session.vendorId === product.vendorId;
          if (isSameVendor || !product) {
            setTableSession(session);
            setOrderType('walk_in');
            setTableNumber(session.tableId);
          }
        } catch (e) {
          console.error("Failed to parse table session:", e);
        }
      }
    }
  }, [id, product]);

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      try {
        const pSnap = await getDoc(doc(db, 'products', id));
        if (pSnap.exists()) {
          const pData = { id: pSnap.id, ...pSnap.data() } as Product;
          setProduct(pData);
          
          const vSnap = await getDoc(doc(db, 'vendors', pData.vendorId));
          if (vSnap.exists()) {
            setVendor({ id: vSnap.id, ...vSnap.data() } as VendorProfile);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product?.category) {
      const fetchSimilarProducts = async (category: string) => {
        try {
          const q = query(
            collection(db, 'products'),
            where('category', '==', category),
            limit(6)
          );
          const snap = await getDocs(q);
          const products = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => p.id !== id);
          setSimilarProducts(products);
        } catch (error) {
          console.error(error);
        }
      };
      fetchSimilarProducts(product.category);
    }
  }, [id, product?.category]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', couponCode.toUpperCase()),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error('Msimbo huu wa punguzo haupo au haufanyi kazi');
        setAppliedCoupon(null);
      } else {
        const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        
        // Check if coupon is valid for this vendor/product
        if (coupon.vendorId && coupon.vendorId !== product?.vendorId) {
          toast.error('Msimbo huu haufanyi kazi kwa muuzaji huyu');
          setIsApplyingCoupon(false);
          return;
        }
        if (coupon.productId && coupon.productId !== product?.id) {
          toast.error('Msimbo huu haufanyi kazi kwa bidhaa hii');
          setIsApplyingCoupon(false);
          return;
        }
        
        setAppliedCoupon(coupon);
        toast.success('Punguzo limetumika!');
      }
    } catch (error) {
      toast.error('Hitilafu imetokea wakati wa kuhakiki msimbo');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const calculateDiscountedPrice = () => {
    if (!product) return 0;
    let basePrice = product.price;
    
    // Add variations price
    const selectedVar = product.variations?.find(v => v.name === selectedSize);
    if (selectedVar && typeof selectedVar.price === 'number') basePrice += selectedVar.price;
    
    // Add addons price
    selectedAddons.forEach(addonName => {
      const addon = product.addOns?.find(a => a.name === addonName);
      if (addon) basePrice += addon.price;
    });

    const totalBeforeCoupon = basePrice * quantity;

    if (!appliedCoupon) return totalBeforeCoupon;

    if (appliedCoupon.discountType === 'percentage') {
      return totalBeforeCoupon * (1 - appliedCoupon.discountValue / 100);
    } else {
      return Math.max(0, totalBeforeCoupon - appliedCoupon.discountValue);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Tafadhali ingia ili uweze kuagiza');
      navigate('/login');
      return;
    }
    setIsCheckoutModalOpen(true);
  };

  const processPayment = async () => {
    if (!product) return;
    const vendorCategory = vendor?.category || product?.category || '';
    if (vendorCategory === 'bus_ticket' && selectedSeats.length === 0) {
      toast.error('Tafadhali chagua kiti angalau kimoja! (Please select at least one seat!)');
      return;
    }
    if (!buyerPhone.trim()) {
      toast.error('Tafadhali ingia namba yako ya simu');
      return;
    }
    
    setIsProcessingPayment(true);
    try {
      const orderData = {
        vendorId: product.vendorId,
        vendorOwnerUid: vendor?.ownerUid,
        customerId: user?.uid,
        customerName: profile?.displayName || user?.displayName || 'Mteja',
        customerPhone: buyerPhone,
        branchId: product?.branchId || null,
        items: [{
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          variation: selectedSize,
          addons: selectedAddons,
          selectedSeats: vendorCategory === 'bus_ticket' ? selectedSeats : undefined,
          departureDate: vendorCategory === 'bus_ticket' ? travelDate : undefined
        }],
        selectedSeats: vendorCategory === 'bus_ticket' ? selectedSeats : undefined,
        orderType: orderType,
        peopleCount: orderType === 'walk_in' ? peopleCount : 1,
        tableNumber: orderType === 'walk_in' ? tableNumber : null,
        arrivalTime: orderType === 'walk_in' ? arrivalTime : null,
        totalAmount: calculateDiscountedPrice(),
        status: 'pending',
        paymentStatus: 'pending',
        orderSource: 'app_direct',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = orderRef.id;
      
      const formattedPhone = buyerPhone.startsWith('0') 
        ? '255' + buyerPhone.substring(1) 
        : buyerPhone.replace('+', '');

      toast.info('Inatuma ombi la malipo kwenye simu yako...');
      
      await initiatePayment({
        order_id: orderId,
        amount: Math.round(calculateDiscountedPrice()),
        buyer_phone: formattedPhone,
        fee_payer: 'CUSTOMER'
      });

      toast.success('Ombi la malipo limetumwa! Tafadhali weka siri kwenye simu yako.');
      setIsCheckoutModalOpen(false);
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error('Checkout failed: ' + error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: `Angalia bidhaa hii kwenye Papo Hapo: ${product?.name}`,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link imenakiliwa!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Bidhaa haijapatikana</h2>
        <Button onClick={() => navigate(-1)} className="mt-4">Rudi Nyuma</Button>
      </div>
    );
  }

  const toggleAddon = (addon: string) => {
    setSelectedAddons(prev => 
      prev.includes(addon) ? prev.filter(a => a !== addon) : [...prev, addon]
    );
  };

  const getCategoryLabel = () => {
    if (!vendor) return 'product';
    return vendor.category;
  };

  const renderAdaptiveOptions = () => {
    const category = getCategoryLabel();

    return (
      <div className="space-y-4">
        {/* Dynamic Variations (Sizes) */}
        {product.variations && product.variations.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-neutral-400">CHAGUA UKUBWA (SIZE)</h3>
            <div className="grid grid-cols-3 gap-2">
              {product.variations.map((v, idx) => {
                const isSelected = selectedSize === v.name;
                return (
                  <button
                    key={`variation-${v.name}-${idx}`}
                    onClick={() => setSelectedSize(v.name)}
                    className={`py-2 px-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-0.5 ${
                      isSelected 
                        ? 'border-orange-600 bg-orange-50/40 dark:bg-orange-600/10 text-orange-600 font-black shadow-sm' 
                        : 'border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <span className="font-extrabold text-xs uppercase tracking-wider">{v.name}</span>
                    <span className="text-[9px] font-bold text-neutral-400">
                      +{(v.price ?? 0) > 0 ? (v.price ?? 0).toLocaleString() : '0'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Add-ons (Vionjo) */}
        {product.addOns && product.addOns.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-neutral-400">VIONJO VYA ZIADA (ADD-ONS)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {product.addOns.map((addon, idx) => {
                const isSelected = selectedAddons.includes(addon.name);
                return (
                  <button
                    key={`addon-${addon.name}-${idx}`}
                    onClick={() => toggleAddon(addon.name)}
                    className={`p-2 rounded-xl border-2 text-left transition-all duration-300 flex items-center justify-between bg-white dark:bg-neutral-900 ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50/40 dark:bg-orange-600/10 shadow-sm text-orange-600'
                        : 'border-neutral-100 dark:border-neutral-800 hover:border-neutral-200'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={`font-extrabold text-[10px] uppercase tracking-wider truncate ${isSelected ? 'text-orange-600 font-black' : 'text-neutral-800 dark:text-neutral-200'}`}>
                        {addon.name}
                      </span>
                      <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider">
                        {addon.price > 0 ? `+TZS ${addon.price.toLocaleString()}` : 'Bure'}
                      </span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-1 transition-all ${
                      isSelected ? 'border-orange-600 bg-orange-600 text-white' : 'border-neutral-200 dark:border-neutral-700'
                    }`}>
                      {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Specific Info */}
        {category === 'restaurant' && (
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 transition-colors">
            <h3 className="font-extrabold text-[10px] uppercase tracking-widest text-neutral-400">JINSI YA KUPOKEA CHAKULA</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setOrderType('delivery')}
                className={`flex flex-row items-center justify-center py-2.5 px-4 rounded-xl border-2 transition-all duration-300 gap-2 ${
                  orderType === 'delivery' 
                  ? 'border-orange-600 bg-orange-50/40 dark:bg-orange-600/10 text-orange-600 shadow-sm' 
                  : 'border-neutral-100 dark:border-neutral-800 text-neutral-400 bg-white dark:bg-neutral-900 hover:border-neutral-200'
                }`}
              >
                <Truck className={`w-4 h-4 ${orderType === 'delivery' ? 'text-orange-600' : 'text-neutral-400'}`} />
                <span className="font-extrabold text-xs uppercase tracking-wider">DELIVERY</span>
              </button>
              <button 
                onClick={() => setOrderType('walk_in')}
                className={`flex flex-row items-center justify-center py-2.5 px-4 rounded-xl border-2 transition-all duration-300 gap-2 ${
                  orderType === 'walk_in' 
                  ? 'border-orange-600 bg-orange-50/40 dark:bg-orange-600/10 text-orange-600 shadow-sm' 
                  : 'border-neutral-100 dark:border-neutral-800 text-neutral-400 bg-white dark:bg-neutral-900 hover:border-neutral-200'
                }`}
              >
                <Utensils className={`w-4 h-4 ${orderType === 'walk_in' ? 'text-orange-600' : 'text-neutral-400'}`} />
                <span className="font-extrabold text-xs uppercase tracking-wider">KULA HAPA (DINE-IN)</span>
              </button>
            </div>

            <AnimatePresence>
              {orderType === 'walk_in' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-2 overflow-hidden"
                >
                  <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                    <button 
                      onClick={() => { setTableNumber(''); setArrivalTime(''); }}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!tableNumber ? 'bg-white dark:bg-neutral-700 text-orange-600 shadow-sm' : 'text-neutral-500'}`}
                    >
                      Agiza Mapema
                    </button>
                    <button 
                      onClick={() => {
                        if (vendorTables.length > 0) {
                          const firstFree = vendorTables.find(t => !occupiedTables.includes(t.number));
                          setTableNumber(firstFree?.number || vendorTables[0]?.number || '1');
                        } else {
                          setTableNumber('1');
                        }
                      }}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tableNumber ? 'bg-white dark:bg-neutral-700 text-orange-600 shadow-sm' : 'text-neutral-500'}`}
                    >
                      Nipo Mezani
                    </button>
                  </div>

                  {orderType === 'walk_in' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Idadi ya Watu (Number of People)</label>
                      <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 h-14 px-4 rounded-2xl">
                         <Users className="w-5 h-5 text-orange-600" />
                         <input 
                           type="number"
                           min="1"
                           value={peopleCount}
                           onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                           className="bg-transparent border-none w-full text-base font-black focus:ring-0"
                         />
                         <span className="text-[9px] font-black text-white uppercase tracking-widest bg-orange-600 px-2 py-1 rounded-lg">Seats</span>
                      </div>
                    </div>
                  )}

                  {orderType === 'walk_in' && !tableNumber && (
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Muda wa Kufika (Arrival Time)</label>
                       <div className="relative">
                          <Clock className="absolute left-4 top-3.5 w-4 h-4 text-orange-600" />
                          <Input 
                            type="time"
                            className="pl-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none font-bold"
                            value={arrivalTime}
                            onChange={e => setArrivalTime(e.target.value)}
                          />
                       </div>
                    </div>
                  )}

                  {orderType === 'walk_in' && tableNumber && (
                    <div className="space-y-4 pt-2">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Chagua Meza Yako</label>
                          <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-[8px] font-bold text-neutral-400 uppercase">Imekaliwa</span>
                             </div>
                             <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                                <span className="text-[8px] font-bold text-neutral-400 uppercase">Wazi</span>
                             </div>
                          </div>
                       </div>
                       
                       {!showManualTable ? (
                         <>
                           <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 animate-fade-in">
                           {(vendorTables.length > 0 
                             ? vendorTables 
                             : Array.from({ length: 16 }, (_, i) => ({
                                 id: `default-table-${i + 1}`,
                                 number: `${i + 1}`,
                                 allowSharing: true
                               }))
                           ).map((table) => {
                             const isOccupied = occupiedTables.includes(table.number);
                             const isFull = isOccupied && !table.allowSharing;
                             const isSelected = tableNumber === table.number;
                             return (
                               <button
                                 key={table.id}
                                 onClick={() => {
                                   if (isFull) {
                                      toast.error('Meza Imejaa', {
                                        description: 'Hii meza hairuhusu kugawana (sharing).'
                                      });
                                      return;
                                   }
                                   setTableNumber(table.number);
                                 }}
                                 className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center font-black transition-all relative ${
                                   isSelected 
                                     ? 'border-orange-600 bg-orange-600 text-white shadow-lg' 
                                     : isFull 
                                       ? 'border-red-100 bg-red-50 text-red-100 dark:bg-red-950/20 dark:border-red-900/40' 
                                       : isOccupied
                                         ? 'border-blue-100 bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                                         : 'border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-orange-600/30'
                                 }`}
                               >
                                 <span className="text-sm">{table.number}</span>
                                 {isOccupied && !isFull && (
                                   <div className="absolute top-0.5 right-0.5 bg-blue-600 text-[6px] text-white px-1 rounded-sm uppercase tracking-tighter">Shared</div>
                                 )}
                                 {isFull && (
                                   <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-neutral-900 animate-pulse" />
                                 )}
                               </button>
                             );
                           })}
                         </div>
                         <div className="flex justify-end pt-1">
                           <button
                             type="button"
                             onClick={() => setShowManualTable(true)}
                             className="text-[10px] font-black text-orange-600 hover:underline uppercase tracking-wider flex items-center gap-1"
                           >
                             <Sliders className="w-3 h-3" /> Andika namba ya meza
                           </button>
                         </div>
                       </>
                       ) : (
                         <div className="space-y-3">
                           <div className="relative">
                             <Hash className="absolute left-4 top-3.5 w-4 h-4 text-orange-600" />
                             <Input 
                               placeholder="mfano: B1, 14..."
                               className="pl-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none font-bold"
                               value={tableNumber}
                               onChange={e => setTableNumber(e.target.value)}
                             />
                           </div>
                           <div className="flex justify-end">
                             <button
                               type="button"
                               onClick={() => setShowManualTable(false)}
                               className="text-[10px] font-black text-orange-600 hover:underline uppercase tracking-wider flex items-center gap-1"
                             >
                               <Sliders className="w-3 h-3" /> Chagua kwenye orodha
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {category === 'pharmacy' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 transition-colors">
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white transition-colors">Taarifa za Dawa</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 space-y-3 transition-colors">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600 dark:text-blue-400 font-medium">Aina ya Dawa:</span>
                <span className="font-bold text-blue-900 dark:text-blue-100 transition-colors">{product.medicationType === 'prescription' ? 'Prescription-only' : 'Over-the-counter'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600 dark:text-blue-400 font-medium">Expiry Date:</span>
                <span className="font-bold text-blue-900 dark:text-blue-100 transition-colors">{product.expiryDate || 'N/A'}</span>
              </div>
            </div>
            {product.medicationType === 'prescription' && (
              <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl gap-2 shadow-lg shadow-blue-200">
                <Camera className="w-5 h-5" />
                Pakia Prescription Yako Hapa
              </Button>
            )}
          </div>
        )}

        {category === 'hotel' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 transition-colors">
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white transition-colors">Weka Tarehe Zako</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest transition-colors">Check-in</label>
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center px-4 gap-2 transition-colors">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <input type="date" className="bg-transparent border-none text-sm w-full focus:ring-0 text-neutral-900 dark:text-white transition-colors" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest transition-colors">Check-out</label>
                <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center px-4 gap-2 transition-colors">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <input type="date" className="bg-transparent border-none text-sm w-full focus:ring-0 text-neutral-900 dark:text-white transition-colors" />
                </div>
              </div>
            </div>
          </div>
        )}

        {category === 'bus_ticket' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white transition-colors">Maelezo ya Safari</h3>
              <Badge className="bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border-none font-black text-[10px] uppercase">Active Trip</Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 transition-colors">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase mb-1">Boarding Point</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-1 transition-colors">{(product as any).boardingPoint || 'Main Office, Ubungo'}</p>
                <div className="flex items-center gap-1 mt-1 text-orange-600">
                  <MapPin className="w-3 h-3" />
                  <span className="text-[10px] font-bold">Open in Maps</span>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 transition-colors">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase mb-1">Departure Time</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-white transition-colors">{(product as any).departureTime || '06:00 AM'}</p>
                <div className="flex items-center gap-1 mt-1 text-orange-600">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold">Local Time</span>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 transition-colors">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase mb-1">Tarehe ya Safari</p>
                <input 
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-neutral-905 dark:text-white border-none p-0 focus:ring-0 cursor-pointer text-orange-600 uppercase"
                />
                <div className="flex items-center gap-1 mt-1 text-orange-600">
                  <Calendar className="w-3 h-3" />
                  <span className="text-[10px] font-bold">Departure Date</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase italic transition-colors">Chagua Kiti (Select Seat)</h4>
                <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 transition-colors">{(product as any).availableSeats || '45'} available</p>
              </div>

              {/* Driving Cabin Info / Steering wheel */}
              <div className="flex justify-between items-center px-4 py-2 bg-neutral-900/60 rounded-2xl border border-neutral-800 text-[10px] font-bold text-neutral-400">
                <span className="flex items-center gap-1">🪟 Dirisha (Left)</span>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950 rounded-xl border border-neutral-800 text-orange-600 animate-pulse">
                  <span>●</span> Mbele ya Basi (Front)
                </div>
                <span className="flex items-center gap-1">(Right) Dirisha 🪟</span>
              </div>

              <div className="space-y-3 h-[320px] overflow-y-auto p-4 bg-neutral-950 rounded-3xl border-4 border-neutral-900 transition-colors no-scrollbar">
                {(() => {
                  const totalSeatsCount = (product as any).totalSeats || 55;
                  const layoutType = (product as any).seatLayout || 'A1 A2 || A3 A4';
                  
                  // Generate seats list based on layout rules
                  const seatsList: string[] = [];
                  if (layoutType === '1A 1B || 1C 1D') {
                    const rowsCount = Math.ceil(totalSeatsCount / 4);
                    const seatLetters = ['A', 'B', 'C', 'D'];
                    for (let r = 1; r <= rowsCount; r++) {
                      for (let s = 0; s < 4; s++) {
                        const id = `${r}${seatLetters[s]}`;
                        if (seatsList.length < totalSeatsCount) seatsList.push(id);
                      }
                    }
                  } else if (layoutType === 'A1 A2 || A3 A4') {
                    const rowsCount = Math.ceil(totalSeatsCount / 4);
                    const rowLetters = "ABCDEFGHJKLMNOPQRSTUVWXYZ".split("");
                    for (let r = 0; r < rowsCount; r++) {
                      const letter = rowLetters[r % rowLetters.length] || `X${r}`;
                      for (let s = 1; s <= 4; s++) {
                        const id = `${letter}${s}`;
                        if (seatsList.length < totalSeatsCount) seatsList.push(id);
                      }
                    }
                  } else {
                    for (let i = 1; i <= totalSeatsCount; i++) {
                      seatsList.push(String(i));
                    }
                  }

                  // Break into rows of 4
                  const rows: string[][] = [];
                  for (let i = 0; i < seatsList.length; i += 4) {
                    rows.push(seatsList.slice(i, i + 4));
                  }

                  return rows.map((rowChunk, rowIdx) => (
                    <div key={`row-grid-${rowIdx}`} className="grid grid-cols-5 gap-2 items-center">
                      {/* Left Side (Col 1 & 2) */}
                      {rowChunk[0] ? (
                        (() => {
                          const seatNum = rowChunk[0];
                          const isBooked = bookedSeats.includes(seatNum);
                          const isSelected = selectedSeats.includes(seatNum);
                          return (
                            <button
                              disabled={isBooked}
                              type="button"
                              onClick={() => {
                                setSelectedSeats(prev => {
                                  const nextSelected = prev.includes(seatNum) ? prev.filter(s => s !== seatNum) : [...prev, seatNum];
                                  setQuantity(nextSelected.length > 0 ? nextSelected.length : 1);
                                  return nextSelected;
                                });
                              }}
                              className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-[10px] font-black transition-all gap-0.5 ${
                                isBooked ? 'bg-neutral-900 border border-neutral-800/50 text-neutral-600 cursor-not-allowed' :
                                isSelected ? 'bg-orange-600 text-white border border-orange-400 font-bold scale-105 shadow-md' :
                                'bg-neutral-800 hover:bg-neutral-705 text-neutral-300 border border-neutral-700/50'
                              }`}
                            >
                              <Armchair className="w-3.5 h-3.5" />
                              <span className="text-[7px] leading-none">{seatNum}</span>
                            </button>
                          );
                        })()
                      ) : <div />}

                      {rowChunk[1] ? (
                        (() => {
                          const seatNum = rowChunk[1];
                          const isBooked = bookedSeats.includes(seatNum);
                          const isSelected = selectedSeats.includes(seatNum);
                          return (
                            <button
                              disabled={isBooked}
                              type="button"
                              onClick={() => {
                                setSelectedSeats(prev => {
                                  const nextSelected = prev.includes(seatNum) ? prev.filter(s => s !== seatNum) : [...prev, seatNum];
                                  setQuantity(nextSelected.length > 0 ? nextSelected.length : 1);
                                  return nextSelected;
                                });
                              }}
                              className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-[10px] font-black transition-all gap-0.5 ${
                                isBooked ? 'bg-neutral-900 border border-neutral-800/50 text-neutral-600 cursor-not-allowed' :
                                isSelected ? 'bg-orange-600 text-white border border-orange-400 font-bold scale-105 shadow-md' :
                                'bg-neutral-800 hover:bg-neutral-705 text-neutral-300 border border-neutral-700/50'
                              }`}
                            >
                              <Armchair className="w-3.5 h-3.5" />
                              <span className="text-[7px] leading-none">{seatNum}</span>
                            </button>
                          );
                        })()
                      ) : <div />}

                      {/* Aisle */}
                      <div className="flex items-center justify-center text-neutral-700 text-[10px] font-black italic">
                        ||
                      </div>

                      {/* Right Side (Col 3 & 4) */}
                      {rowChunk[2] ? (
                        (() => {
                          const seatNum = rowChunk[2];
                          const isBooked = bookedSeats.includes(seatNum);
                          const isSelected = selectedSeats.includes(seatNum);
                          return (
                            <button
                              disabled={isBooked}
                              type="button"
                              onClick={() => {
                                setSelectedSeats(prev => {
                                  const nextSelected = prev.includes(seatNum) ? prev.filter(s => s !== seatNum) : [...prev, seatNum];
                                  setQuantity(nextSelected.length > 0 ? nextSelected.length : 1);
                                  return nextSelected;
                                });
                              }}
                              className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-[10px] font-black transition-all gap-0.5 ${
                                isBooked ? 'bg-neutral-900 border border-neutral-800/50 text-neutral-600 cursor-not-allowed' :
                                isSelected ? 'bg-orange-600 text-white border border-orange-400 font-bold scale-105 shadow-md' :
                                'bg-neutral-800 hover:bg-neutral-705 text-neutral-300 border border-neutral-700/50'
                              }`}
                            >
                              <Armchair className="w-3.5 h-3.5" />
                              <span className="text-[7px] leading-none">{seatNum}</span>
                            </button>
                          );
                        })()
                      ) : <div />}

                      {rowChunk[3] ? (
                        (() => {
                          const seatNum = rowChunk[3];
                          const isBooked = bookedSeats.includes(seatNum);
                          const isSelected = selectedSeats.includes(seatNum);
                          return (
                            <button
                              disabled={isBooked}
                              type="button"
                              onClick={() => {
                                setSelectedSeats(prev => {
                                  const nextSelected = prev.includes(seatNum) ? prev.filter(s => s !== seatNum) : [...prev, seatNum];
                                  setQuantity(nextSelected.length > 0 ? nextSelected.length : 1);
                                  return nextSelected;
                                });
                              }}
                              className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-[10px] font-black transition-all gap-0.5 ${
                                isBooked ? 'bg-neutral-900 border border-neutral-800/50 text-neutral-600 cursor-not-allowed' :
                                isSelected ? 'bg-orange-600 text-white border border-orange-400 font-bold scale-105 shadow-md' :
                                'bg-neutral-800 hover:bg-neutral-705 text-neutral-300 border border-neutral-700/50'
                              }`}
                            >
                              <Armchair className="w-3.5 h-3.5" />
                              <span className="text-[7px] leading-none">{seatNum}</span>
                            </button>
                          );
                        })()
                      ) : <div />}
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-center gap-4 bg-neutral-900/40 p-3 rounded-2xl border border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-750" />
                  <span className="text-[9px] font-bold text-neutral-400 uppercase">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-800" />
                  <span className="text-[9px] font-bold text-neutral-600 uppercase">Booked / Hold</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-600" />
                  <span className="text-[9px] font-bold text-orange-500 uppercase font-black">Selected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const isBusTrip = product?.category === 'bus_ticket' || 
                    vendor?.category === 'bus_ticket' || 
                    product?.vendorCategory === 'bus_ticket' ||
                    (product?.name || '').toLowerCase().includes('mwanza') ||
                    (product?.name || '').toLowerCase().includes('shinyanga') ||
                    (product?.name || '').toLowerCase().includes('arusha') ||
                    (product?.name || '').toLowerCase().includes('safari') ||
                    (product?.name || '').toLowerCase().includes('bus') ||
                    (product?.name || '').toLowerCase().includes('mabasi') ||
                    !!(product as any).boardingPoint ||
                    !!(product as any).departureTime ||
                    !!(product as any).origin ||
                    !!(product as any).destination;

  if (isBusTrip && product) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-12 flex justify-center items-center transition-colors duration-200">
        <div className="w-full max-w-7xl px-2 md:px-6 py-6">
          <MabasiMaarufuFlow product={product} vendor={vendor} standalone={true} onBackToTripSelection={() => navigate(-1)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 lg:bg-neutral-50 lg:dark:bg-neutral-950 pb-36 lg:pb-16 transition-colors">
      {/* AR Viewer Overlay Modal Portal */}
      {showARView && product?.model3dUrl && createPortal(
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-black flex flex-col overflow-hidden"
          >
            {/* Solid Dark Header Bar */}
            <div className="px-4 py-2.5 flex items-center justify-between z-[999999] bg-black/95 backdrop-blur-2xl border-b border-white/15 absolute top-0 inset-x-0 h-16 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-600/30 shrink-0">
                  <Box className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-white font-black italic text-base sm:text-lg uppercase tracking-tight truncate leading-tight max-w-[200px] sm:max-w-md">{product.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">AR Experience Live</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowARView(false)}
                className="w-10 h-10 bg-white/10 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center backdrop-blur-xl transition-all active:scale-90 border border-white/20 shrink-0"
                title="Funga AR"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Interactive 3D / Camera Canvas */}
            <div className="flex-1 relative bg-black overflow-hidden pt-16">
              {/* Background Live Camera Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-0 ${
                  isLiveCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />

              {checkIfPageOrWebAR(product?.model3dUrl || '') ? (
                <div className="w-full h-full flex flex-col pt-16 bg-neutral-950 relative z-10">
                  <iframe
                    id="main-webar-iframe"
                    src={format3dUrl(product?.model3dUrl || '')}
                    allow="camera; geolocation; microphone; xr-spatial-tracking; gyroscope; accelerometer; xr; webxr"
                    className="w-full h-full border-0 absolute inset-0 pt-16"
                    style={{ width: '100%', height: '100%' }}
                    title={`WebAR for ${product.name}`}
                  />
                  <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 pointer-events-none z-20">
                    <div className="bg-black/90 backdrop-blur-md px-6 py-2 rounded-full border border-white/15 shadow-2xl">
                      <p className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-orange-500 animate-bounce" />
                        Gusa & Zungusha Model 3D
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 3D Model Viewer with Camera Overlay */}
                  {/* @ts-ignore */}
                  <model-viewer
                    id="main-ar-viewer"
                    src={product?.model3dUrl}
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    ar-scale="auto"
                    camera-controls
                    touch-action="none"
                    interaction-prompt="auto"
                    auto-rotate={autoRotate3D ? true : undefined}
                    poster={product?.imageUrl}
                    shadow-intensity="1.5"
                    shadow-softness="1"
                    exposure="1"
                    autoplay
                    className="w-full h-full relative z-10"
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      backgroundColor: isLiveCameraActive ? 'transparent' : '#09090b' 
                    }}
                  >
                    <div slot="ar-failure" className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8 text-center gap-4 z-[2003]">
                       <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center text-red-500 mb-2">
                          <Box className="w-8 h-8" />
                       </div>
                       <h4 className="text-white font-black italic text-lg uppercase tracking-tight">AR Native haipatikani</h4>
                       <p className="text-white/70 text-xs max-w-xs font-medium leading-relaxed">
                         {isModelValid(product?.model3dUrl || '') 
                           ? "Simu yako haina WebXR/SceneViewer. Tumia kitufe cha 'Washa Kamera' chini kuona chakula kwenye kamera yako."
                           : "Bidhaa hii haina faili halali la 3D (.glb)."
                         }
                       </p>
                       <button 
                         onClick={() => setShowARView(false)}
                         className="mt-2 px-6 py-2.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                       >
                         Rudi Nyuma
                       </button>
                    </div>
                    {/* @ts-ignore */}
                  </model-viewer>

                  {/* Sleek Floating Bottom Control Dock */}
                  <div className="absolute bottom-6 inset-x-0 z-[999999] flex flex-col items-center gap-2 px-4 pointer-events-none">
                    <div className="pointer-events-auto flex items-center justify-between gap-2 max-w-sm sm:max-w-md w-full bg-black/90 backdrop-blur-2xl p-2 rounded-full border border-white/20 shadow-2xl">
                      {/* Live Camera Toggle Button */}
                      <button
                        onClick={isLiveCameraActive ? stopLiveCamera : startLiveCamera}
                        className={`px-4 py-2.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-md ${
                          isLiveCameraActive
                            ? 'bg-red-600 text-white shadow-red-600/30'
                            : 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-orange-600/30 hover:brightness-110'
                        }`}
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isLiveCameraActive ? 'Zima Kamera' : '📷 Washa Kamera'}</span>
                      </button>

                      {/* Auto Rotate Toggle */}
                      <button
                        onClick={() => setAutoRotate3D(!autoRotate3D)}
                        className={`px-3 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 border ${
                          autoRotate3D 
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                            : 'bg-white/10 border-white/15 text-white/70 hover:bg-white/20'
                        }`}
                        title="Zungusha 360°"
                      >
                        <span>🔄 {autoRotate3D ? 'Spin ON' : 'Spin OFF'}</span>
                      </button>

                      {/* Native AR Mode Button */}
                      <button
                        onClick={() => {
                          const viewer = document.getElementById('main-ar-viewer') as any;
                          if (viewer && viewer.canActivateAR) {
                            viewer.activateAR();
                          } else {
                            if (!isLiveCameraActive) startLiveCamera();
                          }
                        }}
                        className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                        title="Tazama katika AR ya simu"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                        <span>AR Mode</span>
                      </button>
                    </div>

                    <div className="pointer-events-auto bg-black/70 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 shadow-lg">
                      <p className="text-white/80 text-[10px] font-semibold text-center tracking-wide">
                        💡 Kidole 1: Zungusha 360° • Vidole 2: Kuza / Punguza
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-4 lg:pt-8">
        {/* Back Button */}
        <div className="mb-4 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 group bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-2xl text-neutral-900 dark:text-white hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-black uppercase text-[10px] tracking-widest whitespace-nowrap">Rudi Nyuma</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Product Images */}
          <div className="space-y-3">
            <div className="aspect-[16/10] sm:aspect-square sm:max-h-none max-h-[260px] bg-neutral-100 dark:bg-neutral-900 rounded-[1.5rem] lg:rounded-[2rem] overflow-hidden relative group shadow-xl shadow-neutral-200 dark:shadow-black/50">
              <img 
                src={(product.imageUrls?.[activeImageIndex] || product.imageUrl) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
                }}
              />
              
              {/* Star Rating Badge on top-left overlay */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg border border-neutral-100/10 transition-colors">
                <Star className="w-3 h-3 text-orange-500 fill-current" />
                <span className="font-extrabold text-neutral-900 dark:text-white text-[10px]">
                  {(product.ratingCount || 0) > 0 ? (product.rating || 0).toFixed(1) : '0'}
                </span>
                <span className="text-neutral-400 dark:text-neutral-500 font-extrabold text-[8px] tracking-widest ml-0.5 uppercase">
                  ({(product.ratingCount || 0)} REVIEWS)
                </span>
              </div>

              {/* Overlay sharing */}
              <button 
                onClick={handleShare}
                className="absolute top-3 right-3 w-9 h-9 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-full flex items-center justify-center text-neutral-900 dark:text-white shadow-xl hover:bg-white dark:hover:bg-neutral-800 transition-all active:scale-90 z-10"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* Bottom Actions Overlay Bar (3D Trigger + Gallery Thumbnails) */}
              <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
                {/* 3D/AR Trigger */}
                {product?.model3dUrl && businessConfig?.enableAR === true ? (
                  <button 
                    onClick={() => setShowARView(true)}
                    className="pointer-events-auto px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-500 text-white rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-xl shadow-orange-600/30 hover:brightness-110 transition-all active:scale-95 shrink-0 border border-white/20"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>View 3D</span>
                  </button>
                ) : <div />}

                {/* Floating thumbnails inside wrapper */}
                {product.imageUrls && product.imageUrls.length > 1 && (
                  <div className="pointer-events-auto flex gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/20 max-w-[calc(100%-110px)] overflow-x-auto scrollbar-none shrink-0">
                    {product.imageUrls.map((url, idx) => (
                      <button 
                        key={`thumb-${idx}`}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg overflow-hidden border-2 flex-shrink-0 cursor-pointer transition-all ${activeImageIndex === idx ? 'border-orange-500 scale-105 shadow-md' : 'border-white/20 opacity-70 hover:opacity-100'}`}
                      >
                        <img 
                          src={url} 
                          className="w-full h-full object-cover" 
                          alt="" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Right: Product Content */}
          <div className="space-y-5 lg:pl-0">
            {/* Category & Title */}
            <div className="space-y-1.5 mt-2 lg:mt-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider">
                  {product.category || 'Chakula'}
                </span>
                {vendor?.category === 'restaurant' && (
                  <span className="px-2 py-0.5 rounded text-[8px] font-black border border-red-500/20 bg-red-500/5 text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                    Non-Veg
                  </span>
                )}
                {vendor?.businessName && (
                  <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-extrabold uppercase tracking-widest">
                    • {vendor.businessName}
                  </span>
                )}
              </div>
              <h1 className="text-2xl lg:text-4xl font-black text-neutral-900 dark:text-white leading-tight tracking-tight font-sans italic uppercase transition-colors">
                {product.name}
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed max-w-xl font-medium transition-colors">
                {product.description || 'Flavorful and freshly prepared meal made with premium ingredients.'}
              </p>
            </div>

            {/* Price section */}
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl lg:text-3xl font-black text-neutral-900 dark:text-white italic tracking-tighter transition-colors">
                  {formatCurrency(calculateDiscountedPrice())}
                </span>
                {product.discountPrice && product.discountPrice < product.price && (
                  <span className="text-sm text-neutral-300 dark:text-neutral-600 line-through font-bold italic transition-colors">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>
            </div>

            <div className="h-px bg-neutral-100 dark:bg-neutral-800 w-full transition-colors" />

            <div className="space-y-4 lg:space-y-5">
              {/* Action and Delivery info - compact horizontal layout */}
              <div className="flex flex-row items-center justify-between gap-4 py-2.5 border-y border-neutral-100 dark:border-neutral-800 my-1 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[10px] uppercase tracking-widest text-neutral-400">QUANTITY:</span>
                  <div className="flex items-center gap-3 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-full shadow-inner transition-colors">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-6.5 h-6.5 rounded-full bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center text-orange-600 disabled:opacity-50 active:scale-95 transition-transform"
                      disabled={quantity <= 1}
                    >
                      <Minus size={10} strokeWidth={3} />
                    </button>
                    <span className="w-5 text-center font-black text-xs tabular-nums text-neutral-900 dark:text-white transition-colors">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-6.5 h-6.5 rounded-full bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center text-orange-600 active:scale-95 transition-transform"
                    >
                      <Plus size={10} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50/80 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest border border-blue-100/30">
                  <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  DELIVERY: 55 MINS
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={handleAddToCart}
                    className="h-13 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-855 dark:hover:bg-neutral-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg gap-2 transition-all duration-300 active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4 text-orange-500" />
                    WEKA KIKAPUNI
                  </Button>
                  <Button 
                    onClick={() => {
                        handleAddToCart();
                        setIsCartOpen(true);
                    }}
                    className="h-13 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-600/20 gap-2 transition-all duration-300 active:scale-95"
                  >
                    AGIZA SASA <ChevronRight className="w-4 h-4 text-white" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {/* Info Tabs Section */}
          <div className="col-span-full mt-6 lg:mt-10 border-t border-neutral-100 dark:border-neutral-800 pt-5 lg:pt-6 transition-colors">
            <div className="flex overflow-x-auto scrollbar-none border-b border-neutral-100 dark:border-neutral-800 gap-6 mb-6">
              {['Chaguzi', 'Maelezo', 'Maoni', 'Maswali', 'Muuzaji'].map((tab) => {
                const isSelected = activeTab === tab;
                const tabLabelMap: Record<string, string> = {
                  'Chaguzi': 'CHAGUA SIZE & VIONJO',
                  'Maelezo': 'MAELEZO',
                  'Maoni': 'MAONI',
                  'Maswali': 'MASWALI',
                  'Muuzaji': 'MUUZAJI'
                };
                return (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 font-black text-xs uppercase tracking-wider relative whitespace-nowrap transition-colors flex items-center gap-2 ${
                      isSelected 
                        ? 'text-orange-600 font-black' 
                        : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    {tab === 'Chaguzi' && <Sliders className="w-3.5 h-3.5" />}
                    {tab === 'Maelezo' && <Info className="w-3.5 h-3.5" />}
                    {tab === 'Maoni' && <Star className="w-3.5 h-3.5" />}
                    {tab === 'Maswali' && <MessageSquare className="w-3.5 h-3.5" />}
                    {tab === 'Muuzaji' && <Store className="w-3.5 h-3.5" />}
                    <span>{tabLabelMap[tab] || tab.toUpperCase()}</span>
                    {isSelected && (
                      <motion.div 
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 inset-x-0 h-0.5 bg-orange-600 rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
 
            <div className="space-y-5 max-w-6xl">
              {activeTab === 'Chaguzi' && (
                <div className="space-y-4">
                  <div className="p-5 sm:p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60 shadow-sm transition-all duration-300">
                    <div className="flex items-center gap-2 pb-3 mb-4 border-b border-neutral-100 dark:border-neutral-800/80">
                      <Sliders className="w-4 h-4 text-orange-600" />
                      <h3 className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                        CHAGUA UKUBWA (SIZE) / VIONJO VYA ZIADA (ADD-ONS)
                      </h3>
                    </div>
                    {renderAdaptiveOptions()}
                  </div>
                </div>
              )}
              {activeTab === 'Maelezo' && (
                <div className="space-y-4">
                  <div className="pl-4 border-l-4 border-orange-500 text-neutral-700 dark:text-neutral-300 text-sm lg:text-base italic leading-relaxed font-medium py-1">
                    {product.story || `Prepared with premium ingredients and time-honored techniques for the perfect balance of taste.`}
                  </div>
 
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60">
                      <h3 className="text-xs font-black text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider mb-2.5">
                        ✨ KWA NINI UTAKUPENDA:
                      </h3>
                      <ul className="space-y-2">
                        {(product.highlights && product.highlights.length > 0) ? (
                          product.highlights.map((highlight, idx) => (
                            <li key={`highlight-${idx}`} className="flex items-start gap-2.5 text-neutral-600 dark:text-neutral-400 font-semibold text-xs leading-normal">
                              <div className="w-5 h-5 shrink-0 rounded-lg bg-orange-100/60 dark:bg-orange-600/20 flex items-center justify-center text-orange-600 text-[10px] font-black">{idx + 1}</div>
                              <span className="flex-1 pt-0.5">{highlight}</span>
                            </li>
                          ))
                        ) : (
                          <>
                            <li className="flex items-start gap-2.5 text-neutral-600 dark:text-neutral-400 font-semibold text-xs leading-normal">
                              <div className="w-5 h-5 shrink-0 rounded-lg bg-orange-100/60 dark:bg-orange-600/20 flex items-center justify-center text-orange-600 text-[10px] font-black">1</div>
                              <span className="flex-1 pt-0.5">Viungo vya hali ya juu vya asili</span>
                            </li>
                            <li className="flex items-start gap-2.5 text-neutral-600 dark:text-neutral-400 font-semibold text-xs leading-normal">
                              <div className="w-5 h-5 shrink-0 rounded-lg bg-orange-100/60 dark:bg-orange-600/20 flex items-center justify-center text-orange-600 text-[10px] font-black">2</div>
                              <span className="flex-1 pt-0.5">Maandalizi salama na ya kiasili</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
 
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60">
                      <h3 className="text-xs font-black text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider mb-2.5">
                        📝 AHADI YA UBORA:
                      </h3>
                      <div className="p-3 bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 mb-3">
                        <p className="text-neutral-500 dark:text-neutral-400 italic font-semibold leading-relaxed text-xs">
                          {product.qualityPromise?.description || `"Viwango vikali vya ubora vinavyozingatiwa kila hatua kwa afya yako."`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-orange-600" />
                        <span className="font-black uppercase tracking-widest text-[9px] text-orange-600">
                          {product.qualityPromise?.certifiedBy || "IMETHIBITISHWA NA TFDA"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'Maoni' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl lg:text-5xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter transition-colors">Maoni</h2>
                      <p className="text-neutral-400 font-black uppercase text-[8px] tracking-widest mt-1">Maoni yaliyohakikiwa kwa ununuzi</p>
                    </div>
                  </div>

                  {id && (
                    <ReviewSection 
                      targetId={id} 
                      targetType="product"
                      isVendor={profile?.role === 'vendor' && vendor?.ownerUid === user?.uid}
                    />
                  )}
                </div>
              )}
              {activeTab === 'Maswali' && (
                <div className="space-y-4">
                  <h2 className="text-xl lg:text-5xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter transition-colors">Maswali</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[1.5rem] space-y-2 transition-colors">
                      <h4 className="font-black text-neutral-900 dark:text-white uppercase italic tracking-tight text-[11px]">Muda wa Kufika</h4>
                      <p className="text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed text-[11px]">Dakika 55-90 kulingana na eneo lako.</p>
                    </div>
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[1.5rem] space-y-2 transition-colors">
                      <h4 className="font-black text-neutral-900 dark:text-white uppercase italic tracking-tight text-[11px]">Njia za Malipo</h4>
                      <p className="text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed text-[11px]">M-Pesa, Airtel Money na kadi zinakubaliwa.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Muuzaji' && (
                <div className="bg-neutral-900 rounded-[2.5rem] p-6 lg:p-12 text-white overflow-hidden relative shadow-2xl shadow-black/20 group min-h-[300px] flex flex-col justify-end">
                   {/* Banner Background */}
                   <div className="absolute inset-0 z-0">
                      <img 
                        src={vendor?.bannerUrl || product?.imageUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=1974&auto=format&fit=crop'} 
                        className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-1000" 
                        alt="" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-transparent" />
                   </div>

                   {/* Background Elements */}
                   <div className="absolute top-0 right-0 p-6 lg:p-10 opacity-20 group-hover:scale-110 transition-transform duration-1000 z-1">
                      <Store className="w-32 h-32 lg:w-64 lg:h-64 rotate-12" />
                   </div>
                   
                   <div className="relative z-10 space-y-6">
                      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 lg:gap-10">
                        <div className="w-24 h-24 lg:w-40 lg:h-40 rounded-[2.5rem] bg-white p-1.5 flex items-center justify-center overflow-hidden shadow-2xl relative group-hover:scale-105 transition-transform duration-500 border-4 border-orange-600/20">
                           {vendor?.logoUrl ? (
                             <img src={vendor.logoUrl} className="w-full h-full rounded-[2rem] object-cover" alt="" />
                           ) : (
                             <div className="w-full h-full rounded-[2rem] bg-neutral-900 flex items-center justify-center text-4xl lg:text-6xl font-black text-white italic select-none">
                               {vendor?.businessName?.slice(0, 2).toUpperCase() || 'RE'}
                             </div>
                           )}
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-2 lg:space-y-4">
                           <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-600 rounded-full border border-orange-500/50 mb-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[8px] font-black uppercase tracking-[0.2em] italic text-white">Duka Lililothibitishwa</span>
                           </div>
                           <h2 className="text-3xl lg:text-7xl font-black italic tracking-tighter uppercase leading-tight break-words text-white drop-shadow-lg">
                              {vendor?.businessName}
                           </h2>
                           <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 lg:gap-8 text-white/70 text-[10px] lg:text-xs font-black uppercase tracking-widest pt-2">
                              <span className="flex items-center gap-2 group/loc cursor-default bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                <MapPin className="w-4 h-4 text-orange-500 group-hover/loc:scale-120 transition-transform" /> 
                                {vendor?.address || 'Tanzania'}
                              </span>
                              <span className="flex items-center gap-2 group/time cursor-default bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                <Clock className="w-4 h-4 text-orange-500 group-hover/time:rotate-12 transition-transform" /> 
                                Fungua 24/7
                              </span>
                           </div>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-white/10">
                        <p className="text-white/60 text-xs lg:text-lg leading-relaxed max-w-2xl font-bold italic text-center md:text-left drop-shadow-sm">
                          {vendor?.description || 'Tumebobea katika kutoa huduma bora kabisa kwa wateja wetu. Karibu upate bidhaa zenye viwango vya hali ya juu nchini Tanzania.'}
                        </p>
                        <Button 
                          onClick={() => navigate(`/vendor/${vendor?.id}`)}
                          className="w-full md:w-auto h-16 px-16 bg-white text-neutral-900 hover:bg-orange-600 hover:text-white rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-2xl active:scale-95 shrink-0 group/btn"
                        >
                           Tembelea Duka
                           <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform ml-2" />
                        </Button>
                      </div>
                   </div>
                </div>
              )}
            </div>
         </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <div className="space-y-6 pt-12">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter transition-colors">Similar Products</h3>
              <button className="text-orange-600 text-xs font-black uppercase tracking-widest underline underline-offset-4 decoration-2">View All</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {similarProducts.map((p) => (
                <Link 
                  key={p.id} 
                  to={`/product/${p.id}`}
                  className="w-40 md:w-56 shrink-0 group"
                >
                  <Card className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-square relative overflow-hidden">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      {p.discountPrice && (
                        <Badge className="absolute top-2 left-2 bg-orange-600 text-white border-none font-black text-[8px] px-1.5 py-0.5">SALE</Badge>
                      )}
                    </div>
                    <CardContent className="p-3 md:p-4 space-y-1">
                      <h4 className="font-bold text-xs md:text-sm text-neutral-900 dark:text-white truncate uppercase tracking-tight transition-colors">{p.name}</h4>
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-black text-orange-600 italic">TZS {p.discountPrice ? p.discountPrice.toLocaleString() : p.price.toLocaleString()}</span>
                         {p.discountPrice && (
                           <span className="text-[10px] text-neutral-400 line-through font-medium">{p.price.toLocaleString()}</span>
                         )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
            >
               <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white transition-colors">Kamilisha Malipo</h3>
                <button onClick={() => setIsCheckoutModalOpen(false)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {tableSession && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 transition-colors flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">In-Store Session Active</p>
                      <p className="text-sm font-black text-blue-900 dark:text-white uppercase italic transition-colors">Section: {tableSession.tableId}</p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900 transition-colors">
                  <div className="flex justify-between items-center text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest transition-colors">
                    <span>Jumla:</span>
                    <span className="text-xl font-black text-orange-600 italic">TZS {calculateDiscountedPrice().toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest transition-colors">Chagua Aina ya Oda</label>
                    <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl transition-colors">
                      {[
                        { id: 'delivery', label: 'Delivery' },
                        { id: 'pickup', label: 'Takeaway' },
                        { id: 'walk_in', label: 'In-Store' }
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setOrderType(type.id as any)}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                            orderType === type.id ? 'bg-white dark:bg-neutral-700 text-orange-600 shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {orderType === 'walk_in' && !tableSession && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest transition-colors">Namba ya Section / Shelf</label>
                      <input 
                        type="text"
                        placeholder="Ingiza namba ya eneo"
                        className="w-full h-14 px-6 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-lg font-black uppercase italic focus:ring-2 focus:ring-orange-600 outline-none text-neutral-900 dark:text-white transition-colors placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest transition-colors">Namba ya Simu (Mobile Money)</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                      <input 
                        type="tel"
                        placeholder="07XXXXXXXX"
                        className="w-full h-14 pl-12 pr-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-lg font-black italic focus:ring-2 focus:ring-orange-500 outline-none text-neutral-900 dark:text-white transition-colors placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  disabled={isProcessingPayment}
                  onClick={processPayment}
                  className="w-full h-18 bg-orange-600 hover:bg-neutral-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-orange-600/20 uppercase italic tracking-tighter"
                >
                  {isProcessingPayment ? 'Inatuma Ombi...' : 'Lipa Sasa'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
