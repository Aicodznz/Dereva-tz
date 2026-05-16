import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { useBusinessConfig } from '../BusinessConfigContext';
import { initiatePayment } from '../services/paymentService';
import { Product, VendorProfile, FAQ } from '../types';
import ReviewSection from './reviews/ReviewSection';
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
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  ThumbsUp,
  MessageSquare,
  Trash2,
  Reply,
  Megaphone,
  Smartphone,
  Phone,
  Utensils,
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
  const [activeTab, setActiveTab] = useState('Maelezo');
  const arViewerRef = useRef<any>(null);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({ 
      ...product, 
      quantity,
      variation: selectedSize,
      addons: selectedAddons,
      orderType,
      tableNumber: orderType === 'walk_in' ? tableNumber : null,
      arrivalTime: orderType === 'walk_in' ? arrivalTime : null
    });
    toast.success('Imeongezwa kwenye kikapu', {
      description: `${quantity}x ${product.name} imewekwa.`,
      icon: <ShoppingBag className="w-5 h-5 text-orange-600" />
    });
  };

  const isModelValid = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.split('?')[0].toLowerCase();
    return lowerUrl.endsWith('.glb') || lowerUrl.endsWith('.gltf');
  };

  useEffect(() => {
    if (showARView && product) {
      const viewer = document.getElementById('main-ar-viewer');
      if (viewer) {
        const handleError = (e: any) => {
          console.error('Model viewer error:', e);
          if (!isModelValid(product?.model3dUrl || '')) {
            toast.error('Faili uliyoweka siyo ya 3D (AR). Tafadhali tumia faili la .glb badala ya picha.', {
              duration: 5000
            });
          } else {
            toast.error('Imeshindwa kupakia model ya 3D. Hakikisha internet ni nzuri.');
          }
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
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'walk_in' | 'pickup'>('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [tableSession, setTableSession] = useState<any>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('papo_hapo_table_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      // Only use if same vendor
      if (session.vendorId === id || session.vendorId === product?.vendorId) {
        setTableSession(session);
        setOrderType('walk_in');
        setTableNumber(session.tableId);
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
          addons: selectedAddons
        }],
        orderType: orderType,
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
            <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-400">Chagua Ukubwa (Size)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {product.variations.map((v, idx) => (
                <button
                  key={`variation-${v.name}-${idx}`}
                  onClick={() => setSelectedSize(v.name)}
                  className={`py-3 px-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedSize === v.name 
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-600/10 text-orange-600' 
                      : 'border-neutral-100 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  <span className="font-bold text-sm">{v.name}</span>
                  {(v.price ?? 0) > 0 && (
                    <span className="text-[10px] font-medium">+{(v.price ?? 0).toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Add-ons (Vionjo) */}
        {product.addOns && product.addOns.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-400">Vionjo vya Ziada (Add-ons)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {product.addOns.map((addon, idx) => (
                <button
                  key={`addon-${addon.name}-${idx}`}
                  onClick={() => toggleAddon(addon.name)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                    selectedAddons.includes(addon.name)
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-600/10'
                      : 'border-neutral-100 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${selectedAddons.includes(addon.name) ? 'text-orange-600' : 'text-neutral-700 dark:text-neutral-200'}`}>
                      {addon.name}
                    </span>
                    {addon.price > 0 && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">TZS {addon.price.toLocaleString()}</span>
                    )}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedAddons.includes(addon.name) ? 'border-orange-600 bg-orange-600' : 'border-neutral-300 dark:border-neutral-700'
                  }`}>
                    {selectedAddons.includes(addon.name) && <Plus className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Specific Info */}
        {category === 'restaurant' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 transition-colors">
            <h3 className="font-black text-xs uppercase tracking-widest text-neutral-400">Jinsi ya Kupokea Chakula</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setOrderType('delivery')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                  orderType === 'delivery' 
                  ? 'border-orange-600 bg-orange-50 dark:bg-orange-600/10 text-orange-600' 
                  : 'border-neutral-100 dark:border-neutral-800 text-neutral-400'
                }`}
              >
                <Truck className="w-5 h-5" />
                <span className="font-bold text-xs uppercase tracking-tighter">Delivery</span>
              </button>
              <button 
                onClick={() => setOrderType('walk_in')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                  orderType === 'walk_in' 
                  ? 'border-orange-600 bg-orange-50 dark:bg-orange-600/10 text-orange-600' 
                  : 'border-neutral-100 dark:border-neutral-800 text-neutral-400'
                }`}
              >
                <UtensilsCrossed className="w-5 h-5" />
                <span className="font-bold text-xs uppercase tracking-tighter">Kula Hapa (Dine-in)</span>
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
                      onClick={() => setTableNumber('')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!tableNumber ? 'bg-white dark:bg-neutral-700 text-orange-600 shadow-sm' : 'text-neutral-500'}`}
                    >
                      Agiza Mapema
                    </button>
                    <button 
                      onClick={() => setTableNumber('1')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tableNumber ? 'bg-white dark:bg-neutral-700 text-orange-600 shadow-sm' : 'text-neutral-500'}`}
                    >
                      Nipo Mezani
                    </button>
                  </div>

                  {!tableNumber ? (
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
                  ) : (
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Namba ya Meza (Table Number)</label>
                       <div className="relative">
                          <Hash className="absolute left-4 top-3.5 w-4 h-4 text-orange-600" />
                          <Input 
                            placeholder="mfano: B1, 14..."
                            className="pl-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none font-bold"
                            value={tableNumber}
                            onChange={e => setTableNumber(e.target.value)}
                          />
                       </div>
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
            
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase italic transition-colors">Chagua Kiti (Select Seat)</h4>
                <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 transition-colors">{(product as any).availableSeats || '45'} available</p>
              </div>
              <div className="grid grid-cols-5 gap-2 h-48 overflow-y-auto p-4 bg-neutral-900 dark:bg-black rounded-3xl no-scrollbar border-4 border-neutral-800 dark:border-neutral-900 transition-colors">
                {Array.from({ length: 48 }).map((_, i) => {
                  const isBooked = [3, 7, 12, 14, 22, 23, 30].includes(i);
                  return (
                    <button 
                      key={`bus-seat-${i}`}
                      disabled={isBooked}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${
                        isBooked 
                        ? 'bg-neutral-800 text-neutral-700 cursor-not-allowed' 
                        : 'bg-neutral-700 text-white hover:bg-orange-600 hover:scale-110 active:scale-95'
                      }`}
                    >
                      <Armchair className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-800" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-600" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Selected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 lg:bg-neutral-50 lg:dark:bg-neutral-950 pb-12 transition-colors">
      {/* AR Viewer Overlay */}
      <AnimatePresence>
        {showARView && product?.model3dUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black flex flex-col"
          >
            <div className="p-6 flex items-center justify-between z-[2001] bg-gradient-to-b from-black/90 via-black/40 to-transparent absolute top-0 inset-x-0 h-32">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
                  <Box className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-white font-black italic text-xl uppercase tracking-tighter leading-none">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">AR Experience Live</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowARView(false)}
                className="w-12 h-12 bg-white/10 hover:bg-white text-white hover:text-black rounded-2xl flex items-center justify-center backdrop-blur-xl transition-all active:scale-90 border border-white/20"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 relative">
              {/* @ts-ignore */}
              <model-viewer
                id="main-ar-viewer"
                src={product?.model3dUrl}
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-placement="floor"
                camera-controls
                touch-action="pan-y"
                poster={product?.imageUrl}
                shadow-intensity="1"
                autoplay
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                <button 
                  slot="ar-button" 
                  onClick={() => {
                    const viewer = document.getElementById('main-ar-viewer') as any;
                    if (viewer && viewer.canActivateAR) {
                      viewer.activateAR();
                    }
                  }}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-4 rounded-full font-black uppercase italic tracking-tighter shadow-2xl flex items-center gap-3 border-4 border-orange-600 animate-bounce active:scale-95 transition-all z-[2005]"
                >
                  <Smartphone className="w-5 h-5 text-orange-600" />
                  View in Space / TAZAMA AR
                </button>
                
                <div slot="ar-failure" className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center gap-4 z-[2003]">
                   <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center text-red-500 mb-4">
                      <Box className="w-10 h-10" />
                   </div>
                   <h4 className="text-white font-black italic text-xl uppercase tracking-tighter">AR haipatikani</h4>
                   <p className="text-white/60 text-sm max-w-xs">
                     {isModelValid(product?.model3dUrl || '') 
                       ? "Simu yako huenda haisupport AR au unapaswa kutoa ruhusa ya kamera kwenye browser yako."
                       : "Bidhaa hii haina faili halali la 3D (GLB). Huwezi kutumia picha ya PNG/JPG kwa AR."
                     }
                   </p>
                   {!isModelValid(product?.model3dUrl || '') && (
                     <div className="bg-orange-600/10 border border-orange-600/20 p-4 rounded-2xl max-w-xs">
                        <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-1">Kidokezo (Tip)</p>
                        <p className="text-white/80 text-xs text-left">Huwezi kutumia picha (PNG/JPG) kwa AR. Bidhaa hii inahitaji faili la 3D (.glb). Unaweza kutumia <b>Luma AI</b>, <b>Meshy.ai</b>, au <b>Polycam</b> kubadilisha picha kuwa GLB.</p>
                     </div>
                   )}
                   <button 
                     onClick={() => setShowARView(false)}
                     className="mt-4 px-6 py-2 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl font-bold transition-all"
                   >
                     Rudi nyuma
                   </button>
                </div>
                {/* @ts-ignore */}
              </model-viewer>

              <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-4 pointer-events-none">
                 <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
                    <p className="text-white/60 text-[10px] font-medium text-center">Use your fingers to rotate and zoom • Bonyeza 'View in your space' kwa AR</p>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <div className="space-y-4">
            <div className="aspect-square bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden relative group shadow-2xl shadow-neutral-200 dark:shadow-black/50">
              <img 
                src={(product.imageUrls?.[activeImageIndex] || product.imageUrl) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Overlay sharing */}
              <button 
                onClick={handleShare}
                className="absolute top-6 right-6 w-12 h-12 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-full flex items-center justify-center text-neutral-900 dark:text-white shadow-xl hover:bg-white dark:hover:bg-neutral-800 transition-all active:scale-90"
              >
                <Share2 className="w-5 h-5" />
              </button>

              {/* 3D/AR Trigger */}
              {product?.model3dUrl && businessConfig?.enableAR === true && (
                <button 
                  onClick={() => setShowARView(true)}
                  className="absolute bottom-6 left-6 px-5 py-2.5 bg-orange-600 text-white rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-600/30 hover:bg-orange-700 transition-all hover:scale-105 active:scale-95"
                >
                  <Box className="w-4 h-4" />
                  View in Space
                </button>
              )}
            </div>

            {/* Thumbnails */}
            {product.imageUrls && product.imageUrls.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-2">
                {product.imageUrls.map((url, idx) => (
                  <button 
                    key={`thumb-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-24 h-24 rounded-3xl overflow-hidden border-2 flex-shrink-0 cursor-pointer transition-all ${activeImageIndex === idx ? 'border-orange-500 ring-8 ring-orange-500/5 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={url} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Right: Product Content */}
          <div className="space-y-6 lg:pl-0">
            {/* Category & Title */}
            <div className="space-y-0.5 mt-2 lg:mt-0">
              <span className="text-neutral-400 dark:text-neutral-500 text-[8px] lg:text-[10px] font-black uppercase tracking-[0.2em]">{product.category || 'Daily Meals'}</span>
              <h1 className="text-xl lg:text-4xl font-black text-neutral-900 dark:text-white leading-tight tracking-tight font-display italic uppercase transition-colors">{product.name}</h1>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs lg:text-base leading-relaxed max-w-xl font-medium line-clamp-2 lg:line-clamp-none transition-colors">
                {product.description || 'Flavorful and freshly prepared meal made with premium ingredients.'}
              </p>
            </div>

            {/* Rating & Veg/Non-Veg Indicator */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl transition-colors">
                <Star className="w-4 h-4 text-orange-500 fill-current" />
                <span className="font-bold text-neutral-900 dark:text-white text-xs">{(product.ratingCount || 0) > 0 ? (product.rating || 0).toFixed(1) : '0'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 dark:text-neutral-500 font-bold uppercase text-[10px] tracking-widest underline underline-offset-4 decoration-neutral-100 dark:decoration-neutral-800">({(product.ratingCount || 0)} Reviews)</span>
                <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1" />
                <div className="w-5 h-5 border border-red-500 rounded-md flex items-center justify-center p-1 shadow-sm">
                  <div className="w-full h-full bg-red-500 rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* Price section */}
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl lg:text-4xl font-black text-neutral-900 dark:text-white italic tracking-tighter transition-colors">
                  {formatCurrency(calculateDiscountedPrice())}
                </span>
                {product.discountPrice && (
                  <span className="text-lg text-neutral-300 dark:text-neutral-600 line-through font-bold italic transition-colors">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>
              <p className="text-neutral-400 dark:text-neutral-500 text-[9px] font-black uppercase tracking-widest transition-colors">( Include all taxes )</p>
            </div>

            <div className="h-px bg-neutral-100 dark:bg-neutral-800 w-full transition-colors" />

            {/* Options Selector Section */}
            <div className="space-y-6 lg:space-y-8">
              <div className="space-y-3 lg:space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-black text-neutral-900 dark:text-white uppercase tracking-widest transition-colors">Select Options</h3>
                   <div className="flex items-center gap-3">
                     <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest">Stock: <span className="text-neutral-900 dark:text-neutral-300 transition-colors">{product.stock || 848} items</span></span>
                     <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest">SKU: <span className="text-neutral-900 dark:text-neutral-300 transition-colors">PPH-{id?.slice(0, 4).toUpperCase()}</span></span>
                   </div>
                 </div>

                 {/* Use Adaptive Options based on category */}
                 <div className="space-y-6">
                    {renderAdaptiveOptions()}
                 </div>
              </div>

              {/* Action and Delivery info */}
              <div className="flex flex-wrap items-center gap-4 lg:gap-6 py-1 lg:py-2">
                <div className="flex items-center gap-2 lg:gap-3">
                  <span className="text-[9px] lg:text-[10px] font-black text-neutral-400 dark:text-neutral-600 uppercase tracking-widest transition-colors">Quantity:</span>
                  <div className="flex items-center gap-3 lg:gap-4 bg-neutral-100 dark:bg-neutral-800 p-1 lg:p-1.5 rounded-full border border-neutral-200/50 dark:border-neutral-700/50 shadow-inner transition-colors">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center text-orange-600 disabled:opacity-50"
                      disabled={quantity <= 1}
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span className="w-3 lg:w-4 text-center font-black text-sm lg:text-lg italic tabular-nums text-neutral-900 dark:text-white transition-colors">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center text-orange-600"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50/50 text-blue-600 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg lg:rounded-xl flex items-center gap-2 font-black text-[8px] lg:text-[10px] uppercase tracking-widest border border-blue-100/50">
                  <Clock className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                  Delivery: 55 Mins
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row gap-2 lg:gap-4 pt-2">
                <Button 
                  onClick={handleAddToCart}
                  className="flex-1 h-12 lg:h-14 bg-neutral-900 hover:bg-black text-white rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-xs tracking-tighter lg:tracking-widest shadow-lg shadow-black/5 gap-1.5 lg:gap-2 transition-all active:scale-[0.98]"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Weka Kikapuni
                </Button>
                <Button 
                  onClick={() => {
                      handleAddToCart();
                      setIsCartOpen(true);
                  }}
                  className="flex-1 h-12 lg:h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-xl lg:rounded-2xl font-black uppercase text-[10px] lg:text-xs tracking-tighter lg:tracking-widest shadow-lg shadow-orange-600/10 gap-1.5 lg:gap-2 transition-all active:scale-[0.98]"
                >
                  Agiza Sasa <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

            {/* Info Tabs Section */}
        <div className="mt-2 lg:mt-6 border-t border-neutral-100 dark:border-neutral-800 pt-3 lg:pt-6 transition-colors">
           <div className="flex flex-wrap gap-1.5 mb-3 p-1.5 bg-neutral-100/50 dark:bg-neutral-900/50 rounded-2xl w-full lg:w-fit border border-neutral-200/50 dark:border-neutral-800/50 transition-colors">
              {['Maelezo', 'Maoni', 'Maswali', 'Muuzaji'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 lg:flex-none px-3 py-1.5 rounded-xl font-black uppercase text-[8px] lg:text-[10px] tracking-widest transition-all duration-300 ${activeTab === tab ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm border border-neutral-200/50 dark:border-neutral-700/50' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {tab === 'Maelezo' && <Info className="w-3.5 h-3.5" />}
                    {tab === 'Maoni' && <Star className="w-3.5 h-3.5" />}
                    {tab === 'Maswali' && <MessageSquare className="w-3.5 h-3.5" />}
                    {tab === 'Muuzaji' && <Store className="w-3.5 h-3.5" />}
                    <span>{tab}</span>
                  </div>
                </button>
              ))}
           </div>

           <div className="space-y-4 max-w-6xl">
              {activeTab === 'Maelezo' && (
                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <h2 className="text-xl lg:text-3xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter transition-colors">Maelezo</h2>
                    <p className="text-neutral-400 dark:text-neutral-500 font-black uppercase text-[8px] tracking-widest">Taarifa za Bidhaa</p>
                  </div>

                  <div className="space-y-4">
                      <p className="text-sm lg:text-lg text-neutral-800 dark:text-neutral-100 leading-relaxed font-bold italic tracking-tight underline decoration-orange-200 dark:decoration-orange-900 underline-offset-4 decoration-2">
                        {product.story || (
                          <>
                            Prepared with premium ingredients and time-honored techniques for the perfect balance of taste.
                          </>
                        )}
                      </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-neutral-900 p-4 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 shadow-md">
                        <h3 className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-2 italic tracking-tighter uppercase mb-3">
                          ✨ Kwa Nini Utakupenda:
                        </h3>
                        <ul className="space-y-2">
                          {(product.highlights && product.highlights.length > 0) ? (
                            product.highlights.map((highlight, idx) => (
                              <li key={`highlight-${idx}`} className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 font-bold group">
                                <div className="w-5 h-5 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-600/20 flex items-center justify-center text-orange-600 text-[8px]">{idx + 1}</div>
                                <span className="text-[11px] leading-tight">{highlight}</span>
                              </li>
                            ))
                          ) : (
                            <>
                              <li className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 font-bold group">
                                <div className="w-5 h-5 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-600/20 flex items-center justify-center text-orange-600 text-[8px]">1</div>
                                <span className="text-[11px]">Viungo vya hali ya juu</span>
                              </li>
                              <li className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300 font-bold group">
                                <div className="w-5 h-5 shrink-0 rounded-lg bg-orange-50 dark:bg-orange-600/20 flex items-center justify-center text-orange-600 text-[8px]">2</div>
                                <span className="text-[11px]">Maandalizi ya kiasili</span>
                              </li>
                            </>
                          )}
                        </ul>
                      </div>

                      <div className="bg-neutral-900 dark:bg-black p-4 rounded-[1.5rem] text-white shadow-lg transition-colors">
                        <h3 className="text-xs font-black text-white flex items-center gap-2 italic tracking-tighter uppercase mb-3">
                          📝 Ahadi ya Ubora:
                        </h3>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-3">
                          <p className="text-neutral-400 dark:text-neutral-500 italic font-medium leading-relaxed text-[10px] transition-colors">
                            {product.qualityPromise?.description || `"Viwango vikali vya ubora vinavyozingatiwa kila hatua."`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-orange-600" />
                          <span className="font-black uppercase tracking-widest text-[7px] text-neutral-300">
                            {product.qualityPromise?.certifiedBy || "Imethibitishwa"}
                          </span>
                        </div>
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
  );
}
