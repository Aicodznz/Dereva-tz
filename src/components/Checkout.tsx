import React, { useState } from 'react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  MapPin, 
  CreditCard, 
  Truck, 
  ShoppingBag,
  Clock,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Checkout() {
  const { cartItems, totalAmount, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [address, setAddress] = useState(profile?.address || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money'>('mobile_money');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (!address.trim()) {
      toast.error('Tafadhali weka anwani ya kufika.');
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error('Tafadhali weka namba ya simu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        customerId: user.uid,
        customerName: profile?.displayName || user.displayName || 'Mteja',
        customerPhone: phoneNumber,
        items: cartItems,
        totalAmount: totalAmount,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: paymentMethod,
        deliveryAddress: address,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'orders'), orderData);
      
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-white dark:bg-neutral-900 rounded-full flex items-center justify-center shadow-sm text-neutral-600"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter">
            HAKIKISHA ODA
          </h1>
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Hatua ya mwisho kabla ya kuagiza</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Address */}
          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-black text-neutral-900 dark:text-white uppercase text-sm tracking-widest">{t('delivery_address') || 'Delivery Address'}</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Anwani</Label>
                  <Input 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Weka mtaa, jengo au namba ya nyumba"
                    className="h-14 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Namba ya Simu</Label>
                  <Input 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="h-14 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800 font-medium"
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
                <h3 className="font-black text-neutral-900 dark:text-white uppercase text-sm tracking-widest">Malipo</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'mobile_money' ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20' : 'border-neutral-100 dark:border-neutral-800 hover:border-orange-200'}`}
                >
                  <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xs font-bold text-orange-600">GSM</span>
                  </div>
                  <span className="text-[10px] font-black uppercase">Simu (M-Pesa/Tigo...)</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'cash' ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20' : 'border-neutral-100 dark:border-neutral-800 hover:border-orange-200'}`}
                >
                  <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xs font-bold text-orange-600">$$$</span>
                  </div>
                  <span className="text-[10px] font-black uppercase">Lipia Kesho (Cash)</span>
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
                  <span>Delivery</span>
                  <span className="text-orange-500 italic">Bure (Mteja Mwaminifu)</span>
                </div>
                <div className="flex justify-between items-end pt-4">
                  <span className="text-sm font-black uppercase text-neutral-400">Total to Pay</span>
                  <span className="text-3xl font-black text-orange-500 italic tracking-tighter">TZS {totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <Button 
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full h-16 bg-white hover:bg-neutral-100 text-neutral-900 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-xl mt-8 active:scale-95 transition-all flex items-center justify-center gap-3"
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
                    Agiza Sasa 
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl text-orange-600 border border-orange-100 dark:border-orange-900/50">
            <Truck className="w-5 h-5" />
            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
              Utapokea oda yako ndani ya dakika 30-45.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
