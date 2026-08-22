import React, { useState, useEffect } from 'react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import LocationPicker from './LocationPicker';
import { useLanguage } from '../LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import { Coupon, VendorProfile } from '../types';
import { 
  ChevronLeft, 
  MapPin, 
  CreditCard, 
  Truck, 
  ShoppingBag,
  Clock,
  ArrowRight,
  Home,
  Utensils,
  Smartphone,
  Users,
  Tag,
  Zap,
  Percent,
  X,
  Sparkles,
  CheckCircle2,
  Award,
  Gift,
  Printer,
  Share2,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { LoyaltyCardModal } from './LoyaltyCardModal';
import { loyaltyService } from '../services/loyaltyService';
import { buildCustomerReceiptWhatsAppUrl, buildKitchenOrderWhatsAppUrl } from '../utils/whatsappHelper';

export default function Checkout() {
  const { cartItems, totalAmount, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [address, setAddress] = useState(profile?.address || '');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'online'>('mobile_money');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'walk_in'>('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendorTables, setVendorTables] = useState<any[]>([]);
  const [occupiedTables, setOccupiedTables] = useState<string[]>([]);

  // Promo / Coupon & Happy Hour States
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [vendorCoupons, setVendorCoupons] = useState<Coupon[]>([]);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);

  // Loyalty & Printing States
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<{ amount: number; desc: string } | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);
  const [loyaltyResult, setLoyaltyResult] = useState<{ card: any; earnedStamp: boolean; earnedReward: boolean; earnedPoints: number } | null>(null);

  const initiatePayment = async (data: any) => {
    console.log("Initiating payment:", data);
    return { success: true };
  };

  // Pre-fill table number if saved in localStorage
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('papo_hapo_table_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.tableId) {
          setTableNumber(parsed.tableId);
          setOrderType('walk_in');
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    const vendorId = cartItems[0]?.vendorId;
    if (vendorId) {
      // Fetch Vendor Tables (Sections)
      const unsubTables = onSnapshot(collection(db, 'vendors', vendorId, 'sections'), (snap) => {
        setVendorTables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.warn("Restricted access or error listening to vendor areas:", error.message);
      });

      // Fetch Active Orders to find occupied tables
      const q = query(
        collection(db, 'orders'),
        where('vendorId', '==', vendorId),
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

      // Fetch Available Coupons / Happy Hours for this Vendor
      const unsubCoupons = onSnapshot(
        query(collection(db, 'coupons'), where('vendorId', '==', vendorId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
          setVendorCoupons(list);
        },
        (error) => {
          console.warn("Coupons fetch error:", error.message);
        }
      );

      // Fetch Vendor Profile
      const unsubVendor = onSnapshot(doc(db, 'vendors', vendorId), (snap) => {
        if (snap.exists()) {
          setVendorProfile({ id: snap.id, ...snap.data() } as VendorProfile);
        }
      }, (error) => {
        console.warn("Vendor profile fetch warning:", error.message);
      });

      return () => {
        unsubTables();
        unsubOrders();
        unsubCoupons();
        unsubVendor();
      };
    }
  }, [cartItems[0]?.vendorId]);

  // Check Happy Hour validity
  const isCouponValidForTime = (c: Coupon) => {
    if (!c.isHappyHour) return true;
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = days[now.getDay()];
    if (c.activeDays && c.activeDays.length > 0 && !c.activeDays.includes(currentDay)) {
      return false;
    }
    if (c.happyHourStart && c.happyHourEnd) {
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = c.happyHourStart.split(':').map(Number);
      const [eH, eM] = c.happyHourEnd.split(':').map(Number);
      const startMins = sH * 60 + (sM || 0);
      const endMins = eH * 60 + (eM || 0);
      if (currentMins < startMins || currentMins > endMins) return false;
    }
    return true;
  };

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = (codeToApply || promoCodeInput).trim().toUpperCase();
    if (!code) {
      toast.error('Tafadhali weka nambari ya ofa au kuponi.');
      return;
    }

    const matched = vendorCoupons.find(c => c.code.toUpperCase() === code);
    if (!matched) {
      toast.error(`Kuponi '${code}' haipatikani au imemalizika.`);
      return;
    }

    if (matched.status && matched.status !== 'active') {
      toast.error('Kuponi hii haifanyi kazi kwa sasa.');
      return;
    }

    if (matched.minOrderAmount && totalAmount < matched.minOrderAmount) {
      toast.error(`Kuponi hii inahitaji oda ya kuanzia TZS ${matched.minOrderAmount.toLocaleString()}.`);
      return;
    }

    if (matched.isTableOnly && orderType !== 'walk_in') {
      toast.error('Kuponi hii ni maalum kwa ajili ya wateja wanaokula mezani (Dining QR) pekee.');
      return;
    }

    if (matched.isHappyHour && !isCouponValidForTime(matched)) {
      toast.error(`Ofa ya Happy Hour (${matched.code}) inafanya kazi kati ya saa ${matched.happyHourStart || ''} hadi ${matched.happyHourEnd || ''}.`);
      return;
    }

    setAppliedCoupon(matched);
    setPromoCodeInput(matched.code);
    toast.success(`🎉 Punguzo limewekwa! (${matched.code})`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setPromoCodeInput('');
    toast.info('Punguzo limeondolewa.');
  };

  // Calculate discount (Coupons + Loyalty Rewards)
  const discountAmount = React.useMemo(() => {
    let couponDisc = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        couponDisc = Math.round((totalAmount * appliedCoupon.discountValue) / 100);
      } else {
        couponDisc = Math.min(appliedCoupon.discountValue, totalAmount);
      }
    }
    const loyaltyDisc = loyaltyDiscount ? Math.min(loyaltyDiscount.amount, totalAmount - couponDisc) : 0;
    return couponDisc + loyaltyDisc;
  }, [appliedCoupon, loyaltyDiscount, totalAmount]);

  const deliveryFee = orderType === 'delivery' ? 2000 : 0; // Default or calculated
  const finalTotalAmount = Math.max(0, totalAmount - discountAmount) + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('Tafadhali ingia kwenye akaunti yako ili kuagiza.');
      navigate('/login');
      return;
    }

    if (cartItems.length === 0) {
      toast.error('Kikapu chako ni tupu!');
      return;
    }

    if (orderType === 'delivery' && !address.trim()) {
      toast.error('Tafadhali weka anwani ya kufika.');
      return;
    }

    if (orderType === 'walk_in' && !tableNumber.trim() && !arrivalTime.trim()) {
      toast.error('Tafadhali weka namba ya meza au muda wa kufika.');
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error('Tafadhali weka namba ya simu.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find a vendorId from cart items (assuming single vendor per order for now)
      const primaryVendorId = cartItems[0]?.vendorId;
      let vendorOwnerUid = '';
      let vendorCategory = 'ecommerce';
      let vendorLocation = null;
      let vendorName = '';

      if (primaryVendorId) {
        const vSnap = await getDoc(doc(db, 'vendors', primaryVendorId));
        if (vSnap.exists()) {
          const vData = vSnap.data();
          vendorOwnerUid = vData.ownerUid;
          vendorCategory = vData.category;
          vendorLocation = vData.location || null;
          vendorName = vData.businessName || '';
        }
      }

      // Get selectedSeats if any item has them
      const itemsWithSeats = cartItems.filter(item => Array.isArray((item as any).selectedSeats));
      const orderSeats = itemsWithSeats.length > 0 ? (itemsWithSeats[0] as any).selectedSeats : null;

      const orderData = {
        customerId: user.uid,
        customerName: profile?.displayName || user.displayName || 'Mteja',
        customerPhone: phoneNumber,
        vendorId: primaryVendorId || '',
        vendorOwnerUid: vendorOwnerUid,
        vendorName: vendorName,
        vendorLocation: vendorLocation,
        items: cartItems,
        peopleCount: orderType === 'walk_in' ? peopleCount : 1,
        totalAmount: finalTotalAmount,
        subtotal: totalAmount - discountAmount,
        originalSubtotal: totalAmount,
        discountAmount: discountAmount,
        couponCode: appliedCoupon ? appliedCoupon.code : (loyaltyDiscount ? loyaltyDiscount.desc : null),
        deliveryFee: deliveryFee,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: paymentMethod,
        orderType: orderType,
        tableNumber: orderType === 'walk_in' ? tableNumber : null,
        arrivalTime: (orderType === 'pickup' || orderType === 'walk_in') ? arrivalTime : null,
        notes: notes,
        deliveryAddress: orderType === 'delivery' ? address : null,
        customerLocation: orderType === 'delivery' && latitude && longitude ? { lat: latitude, lng: longitude } : null,
        deliveryLocation: orderType === 'delivery' && latitude && longitude ? { lat: latitude, lng: longitude } : null,
        type: vendorCategory,
        selectedSeats: orderSeats,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Process Loyalty Stamps and Points
      if (primaryVendorId && phoneNumber) {
        try {
          const resLoyalty = await loyaltyService.processOrderLoyalty(
            primaryVendorId,
            phoneNumber,
            profile?.displayName || user.displayName || 'Mteja',
            finalTotalAmount,
            vendorProfile?.loyaltyProgram
          );
          if (resLoyalty) {
            setLoyaltyResult(resLoyalty);
            if (resLoyalty.earnedReward) {
              toast.success('🎁 Hongera! Umekamilisha Kadi ya Uaminifu na umeshinda Zawadi BURE!', { duration: 6000 });
            }
          }
        } catch (lErr) {
          console.warn("Loyalty point error:", lErr);
        }
      }

      // Update coupon usage count if used
      if (appliedCoupon?.id) {
        try {
          await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
            usageCount: (appliedCoupon.usageCount || 0) + 1
          });
        } catch (e) {
          console.warn("Coupon usage update:", e);
        }
      }
      
      // Mark selected seats as permanently booked in tables collection
      if (Array.isArray(orderSeats) && orderSeats.length > 0) {
        try {
          for (const seat of orderSeats) {
            const docId = `seat_${primaryVendorId}_${seat}`;
            await setDoc(doc(db, 'tables', docId), {
              id: docId,
              productId: cartItems[0]?.id || '',
              seatNum: String(seat),
              customerId: user.uid,
              orderId: orderRef.id,
              status: 'booked',
              expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year expiry
            });
          }
        } catch (err) {
          console.warn("Failed to lock booked seats in tables collection:", err);
        }
      }
      
      if (paymentMethod === 'online' || paymentMethod === 'mobile_money') {
        const formattedPhone = phoneNumber.startsWith('0') 
          ? '255' + phoneNumber.substring(1) 
          : phoneNumber.replace('+', '');

        await initiatePayment({
          order_id: orderRef.id,
          amount: Math.round(totalAmount + deliveryFee),
          buyer_phone: formattedPhone,
          fee_payer: 'CUSTOMER'
        });
        toast.info('Ombi la malipo limetumwa kwenye simu yako!');
      }

      toast.success('Agizo lako limepokelewa! 🚀', {
        description: 'Tunashughulikia oda yako sasa hivi.',
        icon: '✅'
      });
      
      setConfirmedOrder({
        id: orderRef.id,
        ...orderData,
        createdAt: new Date()
      });
      clearCart();
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Imeshindikana kutuma agizo lako. Jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmedOrder) {
    const primaryVendorName = confirmedOrder.vendorName || vendorProfile?.businessName || 'Papo Hapo Mgahawa';
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 sm:p-8 rounded-[2.5rem] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black border border-amber-500/40 shadow-2xl text-center space-y-5 text-white relative overflow-hidden"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-600 mx-auto flex items-center justify-center text-black font-black shadow-xl shadow-orange-950/50">
            <CheckCircle2 className="w-8 h-8 text-black" />
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
              ODA IMEPOKELEWA KIKAMILIFU!
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mt-1">
              {primaryVendorName}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Namba ya Oda: <strong className="text-white font-mono">#{String(confirmedOrder.id).slice(-6).toUpperCase()}</strong>
              {confirmedOrder.tableNumber ? ` • Meza #${confirmedOrder.tableNumber}` : ''}
            </p>
          </div>

          {/* Loyalty Reward Banner */}
          {loyaltyResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-neutral-900 to-amber-950/60 border border-amber-500/40 text-left flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shrink-0">
                  <Award className="w-5 h-5 text-black" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1">
                    {loyaltyResult.earnedReward ? '🎉 Zawadi Mpya ya BURE Imeshindwa!' : '⭐️ Stempu ya Uaminifu Imeongezwa!'}
                  </span>
                  <p className="text-[11px] text-neutral-400">
                    Kadi yako: <strong>{loyaltyResult.card.currentStamps}/{vendorProfile?.loyaltyProgram?.stampsRequired || 5} Stempu</strong>
                    {loyaltyResult.earnedPoints > 0 ? ` • +${loyaltyResult.earnedPoints} Points` : ''}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsLoyaltyModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase px-3 h-8 rounded-xl shrink-0 cursor-pointer"
              >
                Kadi
              </Button>
            </motion.div>
          )}

          {/* Quick Action Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {/* WhatsApp Receipt */}
            <Button
              type="button"
              onClick={() => {
                const url = buildCustomerReceiptWhatsAppUrl(confirmedOrder, primaryVendorName, phoneNumber);
                window.open(url, '_blank');
              }}
              className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Tuma Risiti WhatsApp
            </Button>

            {/* Thermal Print */}
            <Button
              type="button"
              onClick={() => setIsThermalModalOpen(true)}
              className="h-12 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-black text-xs uppercase tracking-wider rounded-2xl border border-amber-500/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Chapa Risiti (Thermal)
            </Button>

            {/* Kitchen WhatsApp Alert */}
            <Button
              type="button"
              onClick={() => {
                const kitchenPhone = vendorProfile?.kitchenWhatsappPhone || vendorProfile?.phoneNumber || '';
                const url = buildKitchenOrderWhatsAppUrl(kitchenPhone, confirmedOrder, primaryVendorName);
                window.open(url, '_blank');
              }}
              className="h-12 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 cursor-pointer sm:col-span-2"
            >
              <Utensils className="w-4 h-4" />
              Tuma Oda Jikoni (Kitchen WhatsApp)
            </Button>
          </div>

          <div className="pt-4 border-t border-neutral-800 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => navigate('/my-orders')}
              className="w-full h-12 bg-white hover:bg-neutral-200 text-black font-black uppercase text-xs rounded-2xl cursor-pointer"
            >
              Fuatilia Oda Yangu Sasa (Live Tracking)
            </Button>

            <Link
              to="/"
              className="text-xs text-neutral-400 hover:text-white font-bold uppercase tracking-wider py-2"
            >
              Rudi Ukurasa Mkuu
            </Link>
          </div>
        </motion.div>

        {/* Thermal Modal */}
        {vendorProfile && (
          <ThermalReceiptModal
            isOpen={isThermalModalOpen}
            onClose={() => setIsThermalModalOpen(false)}
            order={confirmedOrder}
            vendor={vendorProfile}
          />
        )}

        {/* Loyalty Modal */}
        {vendorProfile && (
          <LoyaltyCardModal
            isOpen={isLoyaltyModalOpen}
            onClose={() => setIsLoyaltyModalOpen(false)}
            vendor={vendorProfile}
            initialPhone={phoneNumber}
          />
        )}
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-neutral-300" />
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white">Kikapu ni tupu</h2>
        <p className="text-neutral-500 mt-2">Ongeza bidhaa ili kuendelea na malipo.</p>
        <Button 
          onClick={() => navigate('/')}
          className="mt-8 bg-orange-600 rounded-2xl h-14 px-8 font-black uppercase tracking-widest"
        >
          Anza Ununuzi
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white dark:bg-neutral-900 rounded-full flex items-center justify-center shadow-sm text-neutral-600"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter transition-colors">
              HAKIKISHA ODA
            </h1>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Hatua ya mwisho kabla ya kuagiza</p>
          </div>
        </div>

        <Link 
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-900 hover:text-white transition-all active:scale-95 group shadow-sm"
        >
          <Home className="w-4 h-4 text-orange-600" />
          <span className="font-black uppercase text-[10px] tracking-widest hidden sm:inline">Rudi Nyumbani</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Order Type Selection */}
          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="font-black text-neutral-900 dark:text-white uppercase text-sm tracking-widest">Aina ya Oda</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'delivery', label: 'Delivery', icon: Truck },
                  { id: 'pickup', label: 'Pickup', icon: ShoppingBag },
                  { id: 'walk_in', label: 'Dine-in', icon: Utensils }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setOrderType(type.id as any)}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5 ${orderType === type.id ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-neutral-100 dark:border-neutral-800 text-neutral-500'}`}
                  >
                    <type.icon className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">{type.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Details based on Order Type */}
          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-black text-neutral-900 dark:text-white uppercase text-sm tracking-widest">Maelezo</h3>
              </div>
              <div className="space-y-4">
                {orderType === 'delivery' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Anwani ya Kufika</Label>
                      <button
                        type="button"
                        onClick={() => setIsLocationPickerOpen(true)}
                        className="text-[10px] font-black text-orange-600 hover:underline uppercase tracking-wider flex items-center gap-1 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-xl transition-all"
                      >
                        <MapPin className="w-3 h-3 text-orange-600" /> Chagua kwenye Ramani
                      </button>
                    </div>
                    <div className="relative">
                      <Input 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Weka mtaa, jengo au namba ya nyumba"
                        className="h-14 pr-12 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setIsLocationPickerOpen(true)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 rounded-xl flex items-center justify-center text-orange-600 transition-colors"
                        title="Chagua kwenye Ramani"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {orderType === 'walk_in' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Chagua Meza Yako</Label>
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-red-500" />
                             <span className="text-[8px] font-bold text-neutral-400 uppercase">Imekaliwa</span>
                          </div>
                       </div>
                    </div>

                    {vendorTables.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {vendorTables.map((table) => {
                          const isOccupied = occupiedTables.includes(table.number);
                          const isFull = isOccupied && !table.allowSharing;
                          const isSelected = tableNumber === table.number;
                          return (
                            <button
                              key={table.id}
                              onClick={() => {
                                if (isFull) {
                                   toast.error('Meza Imejaa', {
                                     description: 'Hii meza haijaruhusiwa kugawana (Sharing is disabled).'
                                   });
                                   return;
                                }
                                setTableNumber(table.number);
                              }}
                              className={`h-11 rounded-xl border-2 flex items-center justify-center font-black transition-all relative ${
                                isSelected 
                                  ? 'border-orange-600 bg-orange-600 text-white' 
                                  : isFull 
                                    ? 'border-red-100 bg-red-50 text-red-100 dark:bg-red-950/20 dark:border-red-900/40' 
                                    : isOccupied
                                      ? 'border-blue-100 bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                                      : 'border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              <span className="text-xs">{table.number}</span>
                              {isOccupied && !isFull && (
                                <div className="absolute -top-2 px-1 bg-blue-600 text-[7px] text-white rounded font-bold uppercase">Shared</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Input 
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="e.g. Meza Na. 5"
                        className="h-14 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium"
                      />
                    )}
                  </div>
                )}

                {orderType === 'walk_in' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Idadi ya Watu (Number of People)</Label>
                    <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 rounded-2xl h-14 px-4">
                       <Users className="w-5 h-5 text-orange-600" />
                       <input 
                         type="number"
                         min="1"
                         value={peopleCount}
                         onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
                         className="bg-transparent border-none w-full text-base font-black focus:ring-0"
                       />
                       <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded-lg">Seats</span>
                    </div>
                  </div>
                )}

                {(orderType === 'pickup' || orderType === 'walk_in') && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Muda wa Kufika (Optional)</Label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input 
                        type="time"
                        value={arrivalTime}
                        onChange={(e) => setArrivalTime(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-600"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Namba ya Simu</Label>
                  <Input 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="h-14 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Ujumbe/Notes (Optional)</Label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agizo maalum (e.g. msiweke pilipili)"
                    className="w-full h-24 p-4 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium text-sm focus:ring-2 focus:ring-orange-600"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="font-black text-neutral-900 dark:text-white uppercase text-sm tracking-widest">Lipia Oda Yako</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'mobile_money' ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20' : 'border-neutral-100 dark:border-neutral-800 hover:border-orange-200'}`}
                >
                  <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-sm">
                    <Smartphone className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-center">Simu (M-Pesa/Airtel...)</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'cash' ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20' : 'border-neutral-100 dark:border-neutral-800 hover:border-orange-200'}`}
                >
                  <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-sm">
                    <Home className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-center">Lipia Ufikapo (Cash)</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="border-none shadow-sm rounded-3xl bg-neutral-900 text-white overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black italic uppercase tracking-tighter text-xl">Order Summary</h3>
                <span className="bg-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{cartItems.length} {t('items')}</span>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mb-8 custom-scrollbar">
                {cartItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-800 rounded-lg overflow-hidden shrink-0">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate uppercase tracking-tight">{item.name}</p>
                        <p className="text-[10px] text-neutral-400">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="text-xs font-black">TZS {(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Digital Loyalty Stamp Card Banner */}
              {vendorProfile && (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-neutral-900 to-amber-950/40 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shrink-0">
                      <Award className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase text-amber-300 block">
                        Kadi ya Uaminifu (Stamps)
                      </span>
                      <p className="text-[10px] text-neutral-400">
                        {loyaltyDiscount ? `Imetumika: ${loyaltyDiscount.desc}` : 'Kusanya stempu upate zawadi bure!'}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsLoyaltyModalOpen(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase px-3 h-8 rounded-xl cursor-pointer"
                  >
                    Angalia Kadi
                  </Button>
                </div>
              )}

              {/* Promo Code Input & Happy Hour Suggestions */}
              <div className="pt-4 pb-4 border-t border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-500" /> Kuponi ya Punguzo / Promo
                  </span>
                  {appliedCoupon && (
                    <span className="text-[10px] font-bold text-emerald-400">
                      {appliedCoupon.discountValue}{appliedCoupon.discountType === 'percentage' ? '%' : ' TZS'} OFF
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs font-black text-white">{appliedCoupon.code}</p>
                        <p className="text-[10px] text-emerald-300">Punguzo limetumika!</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Weka Nambari ya Punguzo"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 h-11 px-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-bold text-white uppercase placeholder:text-neutral-600 focus:outline-none focus:border-orange-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleApplyCoupon()}
                      className="h-11 px-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase rounded-xl cursor-pointer"
                    >
                      Hakiki
                    </Button>
                  </div>
                )}

                {/* Available Vendor Coupons / Happy Hour Quick Chips */}
                {vendorCoupons.length > 0 && !appliedCoupon && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {vendorCoupons
                      .filter(c => c.status === 'active' && isCouponValidForTime(c))
                      .slice(0, 3)
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleApplyCoupon(c.code)}
                          className="px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-[10px] font-black text-orange-400 flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {c.code} ({c.discountValue}{c.discountType === 'percentage' ? '%' : ' TZS'})
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <div className="flex justify-between text-xs text-neutral-400 font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>TZS {totalAmount.toLocaleString()}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-400 font-bold uppercase tracking-widest">
                    <span>Punguzo ({appliedCoupon?.code})</span>
                    <span>- TZS {discountAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-neutral-400 font-bold uppercase tracking-widest">
                  <span>{orderType === 'delivery' ? 'Usafiri (Delivery Fee)' : 'Processing Fee'}</span>
                  <span className={deliveryFee > 0 ? 'text-white' : 'text-orange-500 italic'}>
                    {deliveryFee > 0 ? `TZS ${deliveryFee.toLocaleString()}` : 'Bure'}
                  </span>
                </div>

                <div className="flex justify-between items-end pt-4 border-t border-neutral-800">
                  <div>
                    <span className="text-xs font-black uppercase text-neutral-400 block">Total to Pay</span>
                    {discountAmount > 0 && (
                      <span className="text-[10px] text-emerald-400 font-bold">
                        Umeokoa TZS {discountAmount.toLocaleString()} 🎉
                      </span>
                    )}
                  </div>
                  <span className="text-3xl font-black text-orange-500 italic tracking-tighter">
                    TZS {finalTotalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button 
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full h-16 bg-white hover:bg-neutral-100 text-neutral-900 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-xl mt-8 active:scale-95 transition-all flex items-center justify-center gap-3 underline-offset-8"
              >
                {isSubmitting ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Clock className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <>
                    Weka Agizo
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl text-orange-600 border border-orange-100 dark:border-orange-900/50">
            <Truck className="w-5 h-5" />
            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
              {orderType === 'delivery' 
                ? 'Utapokea oda yako ndani ya dakika 30-45.' 
                : orderType === 'pickup' 
                ? 'Itakuwa tayari kwa ajili ya kuchukua.' 
                : 'Meza yako itaandaliwa.'}
            </p>
          </div>
        </div>
      </div>

      <LocationPicker 
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        pickerType="delivery"
        title="Atapokelea Wapi?"
        subtitle="Chagua eneo la kufikishiwa oda yako"
        onSelect={(loc) => {
          setAddress(loc.address);
          setLatitude(loc.lat);
          setLongitude(loc.lng);
          setIsLocationPickerOpen(false);
        }}
      />

      {vendorProfile && (
        <LoyaltyCardModal
          isOpen={isLoyaltyModalOpen}
          onClose={() => setIsLoyaltyModalOpen(false)}
          vendor={vendorProfile}
          initialPhone={phoneNumber}
          onApplyRewardDiscount={(discAmt, desc) => {
            setLoyaltyDiscount({ amount: discAmt, desc });
          }}
        />
      )}
    </div>
  );
}
