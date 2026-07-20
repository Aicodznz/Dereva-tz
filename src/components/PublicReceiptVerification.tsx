import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Order } from '../types';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Calendar, 
  Clock, 
  Store, 
  DollarSign, 
  User, 
  ShieldCheck, 
  ArrowLeft,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PublicReceiptVerification() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID ya risiti haipo.');
      setLoading(false);
      return;
    }

    const fetchOrderAndVendor = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const orderDocRef = doc(db, 'orders', id);
        const orderDoc = await getDoc(orderDocRef);
        
        if (!orderDoc.exists()) {
          setError('Risiti hii haipatikani kwenye mfumo. Tafadhali thibitisha kama umeskani QR sahihi.');
          setLoading(false);
          return;
        }

        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
        setOrder(orderData);

        if (orderData.vendorId) {
          const vendorDocRef = doc(db, 'vendors', orderData.vendorId);
          const vendorDoc = await getDoc(vendorDocRef);
          if (vendorDoc.exists()) {
            setVendor({ id: vendorDoc.id, ...vendorDoc.data() });
          }
        }
      } catch (err) {
        console.error('Error verifying receipt:', err);
        setError('Itilafu imetokea wakati wa kuthibitisha risiti. Tafadhali jaribu tena.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderAndVendor();
  }, [id]);

  const getSafeDate = (val: any): string => {
    try {
      if (!val) return new Date().toLocaleDateString('sw-TZ');
      if (val instanceof Date) return val.toLocaleDateString('sw-TZ');
      if (typeof val === 'object' && typeof val.seconds === 'number') {
        return new Date(val.seconds * 1000).toLocaleDateString('sw-TZ');
      }
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? new Date().toLocaleDateString('sw-TZ') : parsed.toLocaleDateString('sw-TZ');
    } catch {
      return new Date().toLocaleDateString('sw-TZ');
    }
  };

  const getSafeTime = (val: any): string => {
    try {
      if (!val) return '03:00 PM';
      let dateObj: Date;
      if (val instanceof Date) {
        dateObj = val;
      } else if (typeof val === 'object' && typeof val.seconds === 'number') {
        dateObj = new Date(val.seconds * 1000);
      } else {
        dateObj = new Date(val);
      }
      return isNaN(dateObj.getTime()) ? '03:00 PM' : dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '03:00 PM';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-neutral-400">
          Inathibitisha Risiti...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-full bg-red-550/10 flex items-center justify-center mb-6 border border-red-500/20">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-black mb-2 uppercase tracking-wide">
          Risiti Haikuthibitishwa
        </h1>
        <p className="text-sm text-neutral-400 max-w-sm mb-8 leading-relaxed">
          {error || 'Mwamala au risiti haipatikani kwenye mfumo wetu rasmi.'}
        </p>
        <Button 
          onClick={() => navigate('/')}
          className="bg-neutral-900 border border-neutral-800 text-white rounded-2xl px-6 h-12 text-xs font-bold uppercase tracking-wider hover:bg-neutral-850"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Rudi Nyumbani
        </Button>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'paid' || order.status === 'completed';

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        
        {/* Verification Status Header Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              IMETHIBITISHWA / VERIFIED
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase">
            RISITI RASMI YA KIDIJITALI
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Mwamala ni halali na umeidhinishwa
          </p>
        </motion.div>

        {/* Real-looking Premium Digital Thermal Receipt */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative bg-white text-neutral-950 p-6 sm:p-8 rounded-[2rem] shadow-2xl overflow-hidden"
        >
          {/* Top wavy jagged border effect */}
          <div className="absolute top-0 inset-x-0 h-1.5 flex gap-1 justify-between overflow-hidden opacity-30">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={`zigzag-top-${i}`} className="w-3 h-3 bg-neutral-300 rotate-45 transform -translate-y-1.5 shrink-0" />
            ))}
          </div>

          {/* Receipt Header details */}
          <div className="text-center space-y-1.5 pt-4">
            <h2 className="text-xl font-black tracking-tighter uppercase text-neutral-900">
              {vendor?.businessName || vendor?.ownerName || 'RESTAURANT KISINIA'}
            </h2>
            <p className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
              {vendor?.businessAddress || vendor?.address || 'Mwanza, Tanzania'}
            </p>
            <p className="text-[10px] font-mono text-neutral-400">
              Simu: {vendor?.phoneNumber || '+255 711 123 456'}
            </p>
          </div>

          <div className="border-t border-dashed border-neutral-300 my-5" />

          {/* Audit Metadata Table */}
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-neutral-400">RISITI NA:</span>
              <span className="font-bold text-neutral-900">#{order.id.substring(0, 10).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">TAREHE:</span>
              <span className="font-bold text-neutral-900">{getSafeDate(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">MUDA:</span>
              <span className="font-bold text-neutral-900">{getSafeTime(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">MALIPO:</span>
              <span className="font-bold text-neutral-900 uppercase">
                {order.paymentMethod?.replace('_', ' ') || 'MOBILE MONEY'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">STATUS:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                isPaid 
                  ? 'bg-emerald-100 text-emerald-850' 
                  : 'bg-amber-100 text-amber-850'
              }`}>
                {isPaid ? 'IMELIPWA / PAID ✓' : 'HAJALIPA / UNPAID'}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-neutral-300 my-5" />

          {/* Purchased Items Section */}
          <div className="space-y-4">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
              <span>BIDHAA (QTY)</span>
              <span>JUMLA TZS</span>
            </div>

            <div className="space-y-3">
              {order.items && order.items.map((item: any, idx: number) => (
                <div key={`receipt-item-${idx}`} className="flex justify-between items-start text-xs font-mono text-neutral-800">
                  <div className="flex-1 pr-4">
                    <span className="font-bold text-neutral-950">{item.quantity}x</span> {item.name}
                    {item.variation && item.variation.name && (
                      <p className="text-[9px] text-neutral-400 mt-0.5">({item.variation.name})</p>
                    )}
                  </div>
                  <span className="font-black text-neutral-950 text-right">
                    {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-neutral-300 my-5" />

          {/* Math calculation pricing summary */}
          <div className="space-y-1.5 text-xs text-neutral-600 font-mono pb-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>
                TZS {(
                  order.subtotal !== undefined 
                    ? order.subtotal 
                    : (order.totalAmount - (order.deliveryFee || 0))
                ).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Kodi / VAT (0%):</span>
              <span>TZS 0</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Usafiri:</span>
              <span>TZS {(order.deliveryFee || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-4 mt-2 flex justify-between items-center">
            <span className="text-sm font-black uppercase tracking-tight text-neutral-900">JUMLA / TOTAL:</span>
            <span className="text-lg font-black text-neutral-950">
              TZS {order.totalAmount.toLocaleString()}
            </span>
          </div>

          {/* Verification Shield Seal */}
          <div className="mt-8 flex flex-col items-center justify-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mb-1" />
            <span className="text-[9px] font-black uppercase text-emerald-700 tracking-widest text-center">
              CHAPA YA USALAMA / SECURITY SEAL
            </span>
            <span className="text-[7px] text-neutral-400 font-mono select-all uppercase">
              SEC-{order.id.substring(0, 14)}-VERIFIED
            </span>
          </div>

          {/* Bottom wavy jagged border effect */}
          <div className="absolute bottom-0 inset-x-0 h-1.5 flex gap-1 justify-between overflow-hidden opacity-30">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={`zigzag-bot-${i}`} className="w-3 h-3 bg-neutral-300 rotate-45 transform translate-y-1.5 shrink-0" />
            ))}
          </div>
        </motion.div>

        {/* Back CTA Button */}
        <div className="text-center mt-8">
          <Button 
            onClick={() => navigate('/')}
            className="w-full h-12 bg-neutral-900 border border-neutral-800 text-white rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-850 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Rudi Nyumbani (Back to App)
          </Button>
        </div>

      </div>
    </div>
  );
}
