import React, { useState, useEffect } from 'react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
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
  Users
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Checkout() {
  const { cartItems, totalAmount, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [address, setAddress] = useState(profile?.address || '');
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

  const initiatePayment = async (data: any) => {
    console.log("Initiating payment:", data);
    return { success: true };
  };

  useEffect(() => {
    const vendorId = cartItems[0]?.vendorId;
    if (vendorId) {
      // Fetch Vendor Tables (Sections)
      const unsubTables = onSnapshot(collection(db, 'vendors', vendorId, 'sections'), (snap) => {
        setVendorTables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
      });

      return () => {
        unsubTables();
        unsubOrders();
      };
    }
  }, [cartItems[0]?.vendorId]);

  const deliveryFee = orderType === 'delivery' ? 2000 : 0; // Default or calculated

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
        totalAmount: totalAmount + deliveryFee,
        subtotal: totalAmount,
        deliveryFee: deliveryFee,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: paymentMethod,
        orderType: orderType,
        tableNumber: orderType === 'walk_in' ? tableNumber : null,
        arrivalTime: (orderType === 'pickup' || orderType === 'walk_in') ? arrivalTime : null,
        notes: notes,
        deliveryAddress: orderType === 'delivery' ? address : null,
        type: vendorCategory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
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
      
      clearCart();
      navigate('/my-orders');
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Imeshindikana kutuma agizo lako. Jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                    <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Anwani ya Kufika</Label>
                    <Input 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Weka mtaa, jengo au namba ya nyumba"
                      className="h-14 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium"
                    />
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

              <div className="space-y-3 pt-6 border-t border-neutral-800">
                <div className="flex justify-between text-xs text-neutral-400 font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>TZS {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-400 font-bold uppercase tracking-widest">
                  <span>{orderType === 'delivery' ? 'Usafiri (Delivery Fee)' : 'Processing Fee'}</span>
                  <span className={deliveryFee > 0 ? 'text-white' : 'text-orange-500 italic'}>
                    {deliveryFee > 0 ? `TZS ${deliveryFee.toLocaleString()}` : 'Bure'}
                  </span>
                </div>
                <div className="flex justify-between items-end pt-4">
                  <span className="text-sm font-black uppercase text-neutral-400">Total to Pay</span>
                  <span className="text-3xl font-black text-orange-500 italic tracking-tighter">TZS {(totalAmount + deliveryFee).toLocaleString()}</span>
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
    </div>
  );
}
