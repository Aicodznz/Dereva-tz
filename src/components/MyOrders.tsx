import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { Order } from '../types';
import { useLanguage } from '../LanguageContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { initiatePayment } from '../services/paymentService';
import { toPng } from 'html-to-image';
import { 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  ShoppingBag,
  Printer,
  Download,
  CreditCard,
  Loader2,
  Navigation,
  Bus,
  MapPin,
  Ticket,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import OrderTracker from './OrderTracker';

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

interface MyOrdersProps {
  onBack?: () => void;
}

export default function MyOrders({ onBack }: MyOrdersProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedVendorProfile, setSelectedVendorProfile] = useState<any>(null);
  const [selectedOrientation, setSelectedOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [orientationModalOpen, setOrientationModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'print' | 'download'; elementId?: string } | null>(null);
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [cashOrderRefForPay, setCashOrderRefForPay] = useState<Order | null>(null);
  const [alternativePhoneNumber, setAlternativePhoneNumber] = useState('');

  useEffect(() => {
    if (!selectedOrder || !selectedOrder.vendorId) {
      setSelectedVendorProfile(null);
      return;
    }
    const fetchVendor = async () => {
      try {
        const docRef = doc(db, 'vendors', selectedOrder.vendorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSelectedVendorProfile({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching ticket vendor profile:", error);
      }
    };
    fetchVendor();
  }, [selectedOrder]);

  const getPresetColors = (preset?: string, primaryColor?: string, secondaryColor?: string) => {
    switch (preset) {
      case 'midnight-ocean':
        return { primary: '#1e3a8a', secondary: '#06b6d4', text: '#ffffff', accent: '#22d3ee' };
      case 'emerald-luxe':
        return { primary: '#064e3b', secondary: '#10b981', text: '#ffffff', accent: '#34d399' };
      case 'sunset-glow':
        return { primary: '#c2410c', secondary: '#eab308', text: '#ffffff', accent: '#fde047' };
      case 'charcoal-gold':
        return { primary: '#171717', secondary: '#d97706', text: '#ffffff', accent: '#fbbf24' };
      case 'royal-crimson':
        return { primary: '#991b1b', secondary: '#ec4899', text: '#ffffff', accent: '#f472b6' };
      case 'custom':
        return { primary: primaryColor || '#7c3aed', secondary: secondaryColor || '#d946ef', text: '#ffffff', accent: '#ffffff' };
      case 'classic-purple':
      default:
        return { primary: '#7c3aed', secondary: '#d946ef', text: '#ffffff', accent: '#fdf4ff' };
    }
  };

  const handleDownloadTicket = async (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      toast.error('Imeshindwa kupata kadi ya tiketi.');
      return;
    }
    setDownloading(true);
    const toastId = toast.loading('Inapakia picha ya tiketi...');
    try {
      await new Promise(r => setTimeout(r, 600));
      let dataUrl;
      try {
        dataUrl = await toPng(el, { 
          quality: 0.95, 
          pixelRatio: 2,
          backgroundColor: '#0a0a0a', 
          cacheBust: true,
          skipFonts: true,
        });
      } catch (firstErr) {
        console.warn('First export attempt failed, trying fallback...', firstErr);
        dataUrl = await toPng(el, {
          quality: 0.9,
          pixelRatio: 1.5,
          backgroundColor: '#0a0a0a',
          cacheBust: false,
          skipFonts: true,
        });
      }

      const link = document.createElement('a');
      link.download = `Tiketi_${selectedOrder?.id?.slice(-8).toUpperCase() || 'BUS'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Tiketi imepakuliwa kwenye kifaa chako!', { id: toastId });
    } catch (err) {
      console.error('Error exporting ticket image:', err);
      toast.error('Imeshindwa kupakua tiketi ya picha.', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handlePayNow = async (order: Order) => {
    if (order.paymentMethod === 'cash') {
      setCashOrderRefForPay(order);
      setAlternativePhoneNumber((order.customerPhone || user?.phoneNumber || profile?.phoneNumber || '').replace(/[^0-9]/g, ''));
      setShowCashPaymentModal(true);
      return;
    }

    const userPhone = user?.phoneNumber || profile?.phoneNumber || '';
    if (!userPhone && !order.customerPhone) {
      toast.error("Tafadhali weka namba ya simu kwenye profile yako kwanza.");
      return;
    }

    const rawPhone = (order.customerPhone || userPhone || '').trim();
    let formattedPhone = rawPhone;
    if (rawPhone.startsWith('0')) {
      formattedPhone = '255' + rawPhone.substring(1);
    } else if (rawPhone.startsWith('+')) {
      formattedPhone = rawPhone.substring(1);
    } else if (!rawPhone.startsWith('255') && rawPhone.replace(/[^0-9]/g, '').length === 9) {
      formattedPhone = '255' + rawPhone;
    }
    const cleanPhone = formattedPhone.replace(/[^0-9]/g, '');

    setIsPaying(true);
    try {
      const response = await initiatePayment({
        order_id: order.id!,
        amount: order.totalAmount,
        buyer_phone: cleanPhone,
        fee_payer: 'MERCHANT'
      });

      if (response.status === 'success') {
        toast.success("Ombi la malipo limetumwa kwenye simu yako. Tafadhali weka namba ya siri.");
      } else {
        toast.error(response.message || "Imeshindikana kuanzisha malipo.");
      }
    } catch (error: any) {
      console.error("Payment failed:", error);
      toast.error(error.message || "Hitilafu imetokea wakati wa kulipia. Jaribu tena.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleInitiateCashAlternativePayment = async () => {
    if (!cashOrderRefForPay) return;
    if (!alternativePhoneNumber.trim()) {
      toast.error("Tafadhali weka namba ya simu ya kufanyia malipo.");
      return;
    }

    setIsPaying(true);
    const toastId = toast.loading("Inatuma ombi la malipo ya simu...");
    try {
      const formattedPhone = alternativePhoneNumber.startsWith('0')
        ? '255' + alternativePhoneNumber.substring(1)
        : alternativePhoneNumber.replace('+', '');

      const response = await initiatePayment({
        order_id: cashOrderRefForPay.id!,
        amount: cashOrderRefForPay.totalAmount,
        buyer_phone: formattedPhone.replace(/[^0-9]/g, ''),
        fee_payer: 'MERCHANT'
      });

      if (response.status === 'success') {
        toast.success("Ombi la malipo limetumwa kwenye simu yako ya mkononi. Tafadhali weka namba yako ya siri.", { id: toastId });
        setShowCashPaymentModal(false);
      } else {
        toast.error(response.message || "Imeshindikana kuanzisha malipo.", { id: toastId });
      }
    } catch (error: any) {
      console.error("Alternative payment initiation failed:", error);
      toast.error(error.message || "Hitilafu imetokea wakati wa kuanzisha malipo ya simu. Jaribu tena.", { id: toastId });
    } finally {
      setIsPaying(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef, 
          where('customerId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const ordersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        
        // Client-side sorting
        ordersList.sort((a, b) => {
          const dateA = getSafeDate(a.createdAt);
          const dateB = getSafeDate(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setOrders(ordersList);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    const q = query(
      collection(db, 'orders'), 
      where('customerId', '==', user.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Client-side sorting
      ordersList.sort((a, b) => {
        const dateA = getSafeDate(a.createdAt);
        const dateB = getSafeDate(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setOrders(ordersList);
    }, (error: any) => {
      console.error('Error in orders snapshot:', error);
    });

    return () => unsub();
  }, [user?.uid]);

  const activeOrders = orders.filter(o => ['pending', 'preparing', 'out_for_delivery', 'accepted'].includes(o.status));
  const previousOrders = orders.filter(o => ['delivered', 'cancelled', 'completed'].includes(o.status));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'preparing': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'out_for_delivery': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'delivered':
      case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400';
    }
  };

  const isBusOrder = (order: Order | null) => {
    if (!order) return false;
    return order.type === 'bus_ticket' || 
           order.orderType === 'booking' ||
           order.items?.[0]?.productId?.includes('bus') || 
           order.items?.[0]?.name?.toLowerCase()?.includes('kiti') || 
           order.items?.[0]?.name?.toLowerCase()?.includes('ticket');
  };

  const getStatusLabel = (status: string, order?: Order) => {
    if (order && isBusOrder(order)) {
      switch (status) {
        case 'pending': return 'Booked (Imepokelewa)';
        case 'accepted': return 'Confirmed (Imethibitishwa)';
        case 'preparing': return 'Processing (Inashughulikiwa)';
        case 'prepared': return 'Boarding (Kupanda)';
        case 'out_for_delivery': return 'On Trip (Njiani)';
        case 'delivered': return 'Completed (Safari Imeisha)';
        case 'completed': return 'Completed (Safari Imeisha)';
        case 'cancelled': return 'Cancelled (Imeghairiwa)';
        default: return status;
      }
    }

    switch (status) {
      case 'pending': return 'Pending';
      case 'preparing': return 'Preparing';
      case 'out_for_delivery': return 'Out For Delivery';
      case 'delivered': return 'Delivered';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'accepted': return 'Accepted';
      default: return status;
    }
  };

  if (trackingOrder) {
    return <OrderTracker order={trackingOrder} onBack={() => setTrackingOrder(null)} />;
  }

  if (selectedOrder) {
    const order = selectedOrder as any;
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedOrder(null)}
          className="flex items-center gap-2 text-orange-600 font-bold hover:underline mb-4 print:hidden"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('back_to_orders')}
        </button>

        <div className="printable-receipt space-y-8">
          {isBusOrder(selectedOrder) ? (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Controller for Multi-Ticket Operations */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-xl gap-4 print:hidden">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-orange-600" />
                    TIKETI ZA ABIRIA ({(() => {
                      const ticketSeats = order.selectedSeats || (order.items && order.items[0]?.selectedSeats) || [];
                      const list = order.passengers && order.passengers.length > 0 ? order.passengers : ticketSeats;
                      return list.length;
                    })()})
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Kila msafiri (ikiwemo mtoto au mtu mwingine) ana kadi yake ya kujitegemea.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    onClick={() => {
                      setPendingAction({ type: 'print' });
                      setOrientationModalOpen(true);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-black h-12 rounded-2xl px-6 gap-2 w-full sm:w-auto shadow-xl shadow-orange-900/10"
                  >
                    <Printer className="w-4 h-4" /> Print / Pakua PDF (Zote)
                  </Button>
                </div>
              </div>

              {(() => {
                const ticketSeats = order.selectedSeats || (order.items && order.items[0]?.selectedSeats) || [];
                const passengersList = order.passengers && order.passengers.length > 0 
                  ? order.passengers 
                  : ticketSeats.map((seatNum: string, idx: number) => ({
                      fullName: idx === 0 ? (order.customerName || "Abiria") : `Abiria wa ziada (Kiti ${seatNum})`,
                      seat: seatNum,
                      age: '',
                      gender: 'male',
                      nationality: 'Tanzanian'
                    }));

                return passengersList.map((passenger: any, pIdx: number) => {
                  const cardId = `passenger-ticket-card-${passenger.seat}`;
                  const tc = selectedVendorProfile?.ticketConfig || { bgPreset: 'classic-purple' };
                  const colors = getPresetColors(tc.bgPreset, tc.primaryColor, tc.secondaryColor);
                  const ticketNumber = `${selectedOrder.id?.slice(-8).toUpperCase()}-${passenger.seat}`;
                  
                  return (
                    <div 
                      key={`passenger-card-item-${pIdx}`} 
                      className="bg-white dark:bg-neutral-950 p-4 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-850 shadow-lg space-y-4 print:p-0 print:border-none print:shadow-none print:bg-white print:break-after-page"
                      style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}
                    >
                      <div className="flex items-center justify-between px-4 print:hidden">
                        <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-black px-3 py-1 rounded-full uppercase">
                          👤 Msafiri {pIdx + 1} • Kiti: {passenger.seat} {passenger.age ? `• Umri: ${passenger.age}` : ''}
                        </span>
                      </div>

                      <div 
                        id={cardId} 
                        className="border border-neutral-805 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white"
                        style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)` }}
                      >
                        {/* Background watermark overlay */}
                        {tc.watermarkIcon !== 'none' && (
                          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none select-none">
                            {tc.watermarkIcon === 'bus' && <Bus className="w-80 h-80" />}
                            {tc.watermarkIcon === 'shield' && <CheckCircle2 className="w-80 h-80" />}
                            {tc.watermarkIcon === 'ticket' && <Ticket className="w-80 h-80" />}
                            {tc.watermarkIcon === 'star' && <Package className="w-80 h-80" />}
                            {tc.watermarkIcon === 'globe' && <Navigation className="w-80 h-80" />}
                          </div>
                        )}

                        <div className={selectedOrientation === 'portrait'
                          ? "flex flex-col divide-y divide-dashed divide-white/20 animate-fade-in"
                          : "flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-dashed divide-white/20 animate-fade-in"
                        }>
                          {/* Left: Main Ticket Body */}
                          <div className={selectedOrientation === 'portrait'
                            ? "flex-1 pb-6 space-y-6"
                            : "flex-1 lg:pr-8 pb-6 lg:pb-0 space-y-6"
                          }>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                                  <h3 className="text-xs font-black text-white/90 uppercase tracking-widest">{order.vendorName || "KILIMANJARO EXPRESS"}</h3>
                                </div>
                                <h2 className="text-xl lg:text-2xl font-black uppercase italic tracking-tighter mt-1 text-white">TIKETI YA SAFARI YA MIKOA</h2>
                                <span className="text-[9px] font-mono text-white/60 uppercase">Tanzania Intercity Passenger Ticket</span>
                              </div>
                              
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-white/70 uppercase">Ticket Number</span>
                                <div className="text-lg font-mono font-black text-amber-300">#{ticketNumber}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 p-4 bg-black/30 rounded-3xl border border-white/10">
                              <div>
                                <span className="text-[9px] font-black text-white/50 uppercase">Jina la Abiria</span>
                                <p className="text-xs font-bold text-white leading-tight uppercase">{passenger.fullName || "Abiria"}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-white/50 uppercase">Namba ya Simu</span>
                                <p className="text-xs font-mono font-bold text-white leading-tight">{order.customerPhone || "-"}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-white/50 uppercase">Namba ya Basi</span>
                                <p className="text-xs font-bold text-white leading-tight">{(selectedOrder.items[0] as any)?.registration || "T 124 ABC"}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-white/50 uppercase">Darasa / Class</span>
                                <p className="text-xs font-bold text-orange-200 leading-tight">{(selectedOrder.items[0] as any)?.class || "Luxury"}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-white/50 uppercase">Njia / Route</span>
                                <p className="text-xs font-bold text-white leading-tight">
                                  {(selectedOrder.items[0] as any)?.origin || "Kutoka"} ➔ {(selectedOrder.items[0] as any)?.destination || "Kwenda"}
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-white/50 uppercase">Kiti / Seat Number</span>
                                <p className="text-xs font-mono font-black text-orange-300 leading-tight">
                                  #{passenger.seat}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-center">
                                <span className="text-[8px] font-black text-white/50 uppercase">Tarehe ya Safari</span>
                                <p className="text-xs font-black text-white mt-0.5">{(selectedOrder.items[0] as any)?.departureDate || "Leo"}</p>
                              </div>
                              <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-center">
                                <span className="text-[8px] font-black text-white/50 uppercase">Saa ya Safari</span>
                                <p className="text-xs font-black text-white mt-0.5">{(selectedOrder.items[0] as any)?.departureTime || "06:00 AM"}</p>
                              </div>
                              <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-center">
                                <span className="text-[8px] font-black text-white/50 uppercase">Boarding Point</span>
                                <p className="text-xs font-black text-white mt-0.5">{(selectedOrder.items[0] as any)?.boardingPoint || "Main Terminal"}</p>
                              </div>
                              <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-center">
                                <span className="text-[8px] font-black text-white/50 uppercase">Nauli / Total Fare</span>
                                <p className="text-xs font-black text-orange-200 mt-0.5">TZS {(selectedOrder.totalAmount / passengersList.length).toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="pt-4 flex justify-between items-center text-[10px] text-white/70 border-t border-white/10">
                              <div>
                                Status ya Tiketi: <span className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${['delivered', 'completed', 'used'].includes(selectedOrder.status) ? 'bg-red-900/40 text-red-350' : 'bg-green-900/40 text-green-300'}`}>
                                  {['delivered', 'completed', 'used'].includes(selectedOrder.status) ? 'USED / IMEKATWA' : 'VALID / HAIJAKATWA'}
                                </span>
                              </div>
                              <p className="text-[8px] italic text-white/50 font-bold">Inamilikiwa na Simba-Pay Ticketing Engine © 2026</p>
                            </div>
                          </div>

                          {/* Right: Passenger Stub */}
                          <div className={selectedOrientation === 'portrait'
                            ? "pt-6 flex flex-col justify-between items-center space-y-6 w-full"
                            : "lg:w-72 lg:pl-8 pt-6 lg:pt-0 flex flex-col justify-between items-center space-y-6"
                          }>
                            <div className="text-center w-full">
                              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Kipande cha Abiria</span>
                              <h4 className="text-sm font-black text-white uppercase italic tracking-tighter">PASSENGER STUB</h4>
                              <div className="mt-2 border border-dashed border-white/10 p-2 rounded-2xl bg-white w-[130px] h-[130px] mx-auto flex items-center justify-center select-none">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${ticketNumber}`} 
                                  alt="Ticket QR Code" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full animate-fade-in"
                                />
                              </div>
                              <p className="text-[8px] text-white/60 font-mono mt-1">Scan boarding QR Code</p>
                            </div>

                            <div className="w-full space-y-2 p-3 bg-black/30 rounded-2xl border border-white/10 text-xs text-white/80">
                              <div className="flex justify-between">
                                <span className="text-[8px] font-bold text-white/50 uppercase">Abiria:</span>
                                <span className="font-bold text-white truncate max-w-[120px] uppercase">{passenger.fullName || "Abiria"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[8px] font-bold text-white/50 uppercase">Safari:</span>
                                <span className="font-bold text-white truncate max-w-[120px]">{(selectedOrder.items[0] as any)?.origin || "Kutoka"} - {(selectedOrder.items[0] as any)?.destination || "Kwenda"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[8px] font-bold text-white/50 uppercase">Tarehe / Kiti:</span>
                                <span className="font-bold text-white">
                                  {(selectedOrder.items[0] as any)?.departureDate || "Leo"} | #{passenger.seat}
                                </span>
                              </div>
                            </div>

                            <div className="w-full flex gap-2 print:hidden justify-center mt-4 text-[10px]">
                              <Button 
                                onClick={() => {
                                  setPendingAction({ type: 'download', elementId: cardId });
                                  setOrientationModalOpen(true);
                                }}
                                disabled={downloading}
                                className="bg-orange-600 hover:bg-orange-700 h-10 px-3 rounded-xl font-black uppercase tracking-wider text-white flex-1 flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20"
                              >
                                {downloading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 text-white" />
                                )}
                                Pakua PNG
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Terms and rules customized by the vendor */}
                        <div className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center text-[8px] font-bold text-white/70 tracking-wider gap-2">
                          <p className="uppercase truncate max-w-[400px]">
                            {tc.rulesText || '⚠️ HAKUNA KURUDISHA NAULI • MASHARTS YANAZINGATIWA • KUPITIA PAPO HAPO'}
                          </p>
                          <span>Msaada wa Wateja: {selectedVendorProfile?.phoneNumber || '+255 711 123 456'}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                        {t('order_id')}: <span className="text-orange-600">#{selectedOrder.id?.slice(-8).toUpperCase()}</span>
                      </h2>
                      <p className="text-neutral-500 mt-1">
                        {selectedOrder.createdAt ? getSafeDate(selectedOrder.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                    <Badge className={`${getStatusColor(selectedOrder.status)} border-none px-4 py-1.5 rounded-full font-bold`}>
                      {getStatusLabel(selectedOrder.status)}
                    </Badge>
                  </div>

                  <div className="flex flex-col items-center py-12 border-y border-neutral-100 dark:border-neutral-800 mb-8">
                    <div className="relative w-full max-w-md">
                      <div className="flex justify-between mb-8">
                        {['placed', 'accepted', 'preparing', 'prepared', 'out_for_delivery', 'delivered'].map((step, idx) => {
                          const steps = ['pending', 'accepted', 'preparing', 'prepared', 'out_for_delivery', 'delivered'];
                          const currentIdx = steps.indexOf(selectedOrder.status === 'completed' ? 'delivered' : selectedOrder.status);
                          const isCompleted = idx <= currentIdx;
                          
                          const isBus = isBusOrder(selectedOrder);
                          let stepLabel = step.replace(/_/g, ' ');
                          if (isBus) {
                            if (step === 'placed') stepLabel = 'Booked';
                            else if (step === 'accepted') stepLabel = 'Confirmed';
                            else if (step === 'preparing') stepLabel = 'Processing';
                            else if (step === 'prepared') stepLabel = 'Boarding';
                            else if (step === 'out_for_delivery') stepLabel = 'On Trip';
                            else if (step === 'delivered') stepLabel = 'Arrived';
                          }

                          return (
                            <div key={step} className="flex flex-col items-center gap-2 z-10">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-teal-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <span className="text-[10px] font-bold text-neutral-500 uppercase text-center w-12">
                                {stepLabel}
                              </span>
                            </div>
                          );
                        })}
                        <div className="absolute top-4 left-4 right-4 h-1 bg-neutral-100 dark:bg-neutral-800 -z-0">
                          <div 
                            className="h-full bg-teal-500 transition-all duration-500" 
                            style={{ width: `${(Math.max(0, ['pending', 'accepted', 'preparing', 'prepared', 'out_for_delivery', 'delivered'].indexOf(selectedOrder.status === 'completed' ? 'delivered' : selectedOrder.status)) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center mt-8">
                      <img 
                        src={isBusOrder(selectedOrder)
                          ? (selectedOrder.status === 'out_for_delivery' ? "https://cdn-icons-png.flaticon.com/512/1042/1042336.png" : "https://cdn-icons-png.flaticon.com/512/432/432291.png")
                          : (selectedOrder.status === 'out_for_delivery' ? "https://cdn-icons-png.flaticon.com/512/2972/2972185.png" : "https://cdn-icons-png.flaticon.com/512/3063/3063822.png")
                        } 
                        alt="Status" 
                        className="w-32 h-32 mx-auto mb-4 opacity-80"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = isBusOrder(selectedOrder) ? 'https://cdn-icons-png.flaticon.com/512/432/432291.png' : 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png';
                        }}
                      />
                      <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
                        {isBusOrder(selectedOrder) ? (
                          selectedOrder.status === 'pending' ? 'Uhifadhi wako wa tiketi umepokelewa. Subiri thibitisho la agent wetu.' :
                          selectedOrder.status === 'accepted' ? 'Tiketi yako imethibitishwa kikamilifu! Safiri salama.' :
                          selectedOrder.status === 'preparing' ? 'Taarifa za tiketi yako zinahakikiwa kwa sasa...' :
                          selectedOrder.status === 'prepared' ? 'Muda wa kupanda basi! Tafadhali fika kituoni na mizigo yako.' :
                          selectedOrder.status === 'out_for_delivery' ? 'Safari imeanza! Basi liko njiani kuelekea kule unakokwenda.' :
                          selectedOrder.status === 'delivered' || selectedOrder.status === 'completed' ? 'Safari imekamilika kikamilifu! Asante kwa kusafiri nasi.' : 'Tiketi yako inashughulikiwa...'
                        ) : (
                          selectedOrder.status === 'preparing' ? 'The chef is preparing your food.' : 
                          selectedOrder.status === 'out_for_delivery' ? 'The delivery man is on the way!' :
                          selectedOrder.status === 'delivered' ? 'Your order has been delivered' : 'Processing your order...'
                        )}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">
                        {isBusOrder(selectedOrder) ? 'Njia ya Safari & Kiti / Route & Seat' : t('delivery_address')}
                      </h4>
                      <div className="flex gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl">
                        <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-xl flex items-center justify-center shadow-sm">
                          {isBusOrder(selectedOrder) ? (
                            <MapPin className="w-5 h-5 text-orange-600" />
                          ) : (
                            <Truck className="w-5 h-5 text-orange-600" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {isBusOrder(selectedOrder) 
                            ? (selectedOrder.items?.[0]?.origin && selectedOrder.items?.[0]?.destination 
                              ? `${selectedOrder.items[0].origin} ➔ ${selectedOrder.items[0].destination} (${selectedOrder.items[0].name})` 
                              : selectedOrder.deliveryAddress || 'Kituo cha Kutokea/Mabasi')
                            : selectedOrder.deliveryAddress
                          }
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">{t('payment_info')}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl">
                          <p className="text-xs text-neutral-500 mb-1">{t('method')}</p>
                          <p className="text-sm font-bold uppercase text-neutral-900 dark:text-white">{selectedOrder.paymentMethod || 'Cash'}</p>
                        </div>
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl">
                          <p className="text-xs text-neutral-500 mb-1">{t('status')}</p>
                          <p className={`text-sm font-bold uppercase ${selectedOrder.paymentStatus === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                            {selectedOrder.paymentStatus || 'Unpaid'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Aesthetic Digital Thermal Receipt wrapper (What gets downloaded/captured) */}
              <div 
                id="aesthetic-customer-receipt"
                className="bg-white text-neutral-900 p-8 rounded-[2rem] border border-neutral-200 shadow-2xl relative overflow-hidden select-none font-sans"
                style={{ backgroundColor: '#ffffff', color: '#171717' }}
              >
                {/* Decorative cut thermal receipt wavy top pattern */}
                <div className="absolute top-0 inset-x-0 h-1.5 flex gap-1 justify-between overflow-hidden opacity-30">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={`zigzag-${i}`} className="w-3 h-3 bg-neutral-300 rotate-45 transform -translate-y-1.5 shrink-0" />
                  ))}
                </div>

                <div className="text-center space-y-2 mt-4">
                  {/* Store Name & Branding */}
                  <h3 className="font-[905] text-xl tracking-tight uppercase italic leading-none text-neutral-900">
                    {(selectedOrder as any).vendorName || selectedVendorProfile?.businessName || "RESTAURANT KISINIA"}
                  </h3>
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest text-center mt-1">
                    Orodha ya Kidijitali ya PAPO HAPO
                  </p>
                  
                  {/* Address and Contact info */}
                  <div className="text-[10px] font-mono text-neutral-500 leading-tight space-y-0.5 pt-1">
                    <p>Mwanza, Tanzania</p>
                    <p>Simu: {selectedVendorProfile?.phoneNumber || "+255 711 123 456"}</p>
                    <p>Meza: {selectedOrder.tableNumber ? `#${selectedOrder.tableNumber}` : "Chukua / Parcel"}</p>
                  </div>
                </div>

                {/* Decorative Separator */}
                <div className="border-t border-dashed border-neutral-300 my-5" />

                {/* Metadata details */}
                <div className="grid grid-cols-2 gap-y-1.5 text-[11px] font-mono text-neutral-600 pb-4">
                  <div>RISITI NA:</div>
                  <div className="text-right font-black text-neutral-900">#{selectedOrder.id?.slice(-8).toUpperCase()}</div>
                  
                  <div>TAREHE:</div>
                  <div className="text-right">
                    {selectedOrder.createdAt ? getSafeDate(selectedOrder.createdAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </div>
                  
                  <div>MUDA:</div>
                  <div className="text-right">
                    {selectedOrder.createdAt ? getSafeDate(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>

                  <div>MALIPO:</div>
                  <div className="text-right uppercase font-black text-neutral-900">
                    {selectedOrder.paymentMethod || "KASH / CASH"}
                  </div>

                  <div>STATUS:</div>
                  <div className="text-right uppercase font-black text-emerald-600">
                    {selectedOrder.paymentStatus === 'paid' ? 'IMELIPWA / PAID ✓' : 'HAIJALIPWA'}
                  </div>
                </div>

                {/* Column Headers */}
                <div className="border-t border-neutral-200 pt-3 pb-1 flex justify-between text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                  <span>Bidhaa (Qty)</span>
                  <span>Jumla TZS</span>
                </div>

                {/* Items breakdown */}
                <div className="space-y-2.5 pb-4">
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div key={`receipt-item-${idx}`} className="flex justify-between items-start text-xs font-mono text-neutral-800">
                      <div className="flex-1 pr-4">
                        <span className="font-bold text-neutral-950">{item.quantity}x</span> {item.name}
                        {item.variation && item.variation.name && <p className="text-[9px] text-neutral-400 mt-0.5">({item.variation.name})</p>}
                      </div>
                      <span className="font-black text-neutral-955 text-right">
                        {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-neutral-300 my-4" />

                {/* Calculations summary */}
                <div className="space-y-1.5 text-xs text-neutral-600 font-mono pb-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>
                      TZS {(
                        selectedOrder.subtotal !== undefined 
                          ? selectedOrder.subtotal 
                          : (selectedOrder.totalAmount - (selectedOrder.deliveryFee || 0))
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>Kodi / VAT (0%):</span>
                    <span>TZS 0</span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>Usafiri:</span>
                    <span>TZS {(selectedOrder.deliveryFee || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-t border-double border-neutral-200 pt-3 flex justify-between items-center text-sm font-black text-neutral-900 uppercase">
                  <span>Jumla / Total:</span>
                  <span className="text-base font-black">TZS {selectedOrder.totalAmount.toLocaleString()}</span>
                </div>

                <div className="border-t border-dashed border-neutral-300 my-5" />

                {/* QR Code and digital seal verification */}
                <div className="flex flex-col items-center justify-center space-y-2 pb-2">
                  <div className="p-2 border border-neutral-100 rounded-2xl bg-white shadow-sm inline-block">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=https://papo-hapo.com/verify-receipt/${selectedOrder.id}`} 
                      alt="Verification QR" 
                      referrerPolicy="no-referrer"
                      className="w-18 h-18 opacity-90 mx-auto"
                    />
                  </div>
                  <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest text-center mt-1">
                    RISITI YA KIDIJITALI YA PAPO HAPO
                  </p>
                  <p className="text-[7px] text-neutral-400 tracking-tight font-mono text-center">
                    Scan kuthibitisha uasili wa maagizo.
                  </p>
                </div>

                {/* Decorative cut thermal receipt wavy bottom pattern */}
                <div className="absolute bottom-0 inset-x-0 h-1.5 flex gap-1 justify-between overflow-hidden opacity-30">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={`zigzag-bot-${i}`} className="w-3 h-3 bg-neutral-300 rotate-45 transform translate-y-1.5 shrink-0" />
                  ))}
                </div>
              </div>

              {/* Action operations capsule directly below the beautiful receipt */}
              <div className="space-y-3.5 pt-2 print:hidden">
                <Button 
                  onClick={() => handleDownloadTicket('aesthetic-customer-receipt')}
                  disabled={downloading}
                  className="w-full h-14 bg-gradient-to-r from-orange-600 to-amber-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs gap-3 shadow-xl shadow-orange-600/15"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Download className="w-4 h-4 text-white" />
                  )}
                  Pakua Risiti Kwenye Simu (Image)
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => window.print()}
                    className="h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:text-orange-600 hover:bg-neutral-200 dark:hover:bg-neutral-750 rounded-2xl font-bold gap-2 text-xs border border-neutral-200 dark:border-white/5 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    {t('print_invoice')}
                  </Button>

                  {['out_for_delivery', 'preparing', 'accepted', 'pending'].includes(selectedOrder.status) && (
                    <Button 
                      onClick={() => setTrackingOrder(selectedOrder)}
                      className="h-12 bg-orange-600/10 border border-orange-600/20 text-orange-600 hover:bg-orange-600/20 rounded-2xl font-bold gap-2 text-xs transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Fuatilia Oda
                    </Button>
                  )}
                </div>

                {selectedOrder.paymentStatus !== 'paid' && (
                  <Button 
                    onClick={() => handlePayNow(selectedOrder)}
                    disabled={isPaying}
                    className="w-full h-14 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs gap-2"
                  >
                    {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {t('pay_now')}
                  </Button>
                )}
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-orange-600 font-bold hover:underline"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('back_to_home')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Active Orders */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-3 italic uppercase tracking-tighter transition-colors">
            <Clock className="w-6 h-6 text-orange-600" />
            {t('active_orders')}
          </h2>
          <div className="space-y-4">
            {activeOrders.map((order, idx) => (
              <Card 
                key={`active-order-${order.id}-${idx}`} 
                className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group bg-white dark:bg-neutral-900"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-orange-50 dark:bg-orange-950/20 rounded-2xl flex items-center justify-center text-orange-600 shrink-0">
                    {isBusOrder(order) ? (
                      <Bus className="w-8 h-8 text-orange-600 animate-pulse" />
                    ) : (
                      <ShoppingBag className="w-8 h-8" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-neutral-900 dark:text-white truncate">
                        {t('order_id')}: #{order.id?.slice(-8).toUpperCase()}
                      </h4>
                      <Badge className={`${getStatusColor(order.status)} border-none text-[10px] font-bold`}>
                        {getStatusLabel(order.status, order)}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {order.createdAt ? getSafeDate(order.createdAt).toLocaleString() : ''}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm font-black text-neutral-900 dark:text-neutral-200">
                        {t('total')}: <span className="text-orange-600">TZS {order.totalAmount.toLocaleString()}</span>
                      </p>
                      <span className="text-xs font-bold text-orange-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        {t('see_details')} <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {activeOrders.length === 0 && (
              <div className="py-12 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 transition-colors">
                <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">No active orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Previous Orders */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-3 italic uppercase tracking-tighter transition-colors">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            {t('previous_orders')}
          </h2>
          <div className="space-y-4">
            {previousOrders.map((order, idx) => (
              <Card 
                key={`past-order-${order.id}-${idx}`} 
                className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group opacity-80 hover:opacity-100 bg-white dark:bg-neutral-900 transition-all"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-400 shrink-0">
                    {isBusOrder(order) ? (
                      <Bus className="w-8 h-8 text-neutral-400" />
                    ) : (
                      <ShoppingBag className="w-8 h-8" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-neutral-900 dark:text-white truncate">
                        {t('order_id')}: #{order.id?.slice(-8).toUpperCase()}
                      </h4>
                      <Badge className={`${getStatusColor(order.status)} border-none text-[10px] font-bold`}>
                        {getStatusLabel(order.status, order)}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {order.createdAt ? getSafeDate(order.createdAt).toLocaleString() : ''}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm font-black text-neutral-900 dark:text-neutral-200">
                        {t('total')}: <span className="text-orange-600">TZS {order.totalAmount.toLocaleString()}</span>
                      </p>
                      <span className="text-xs font-bold text-orange-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        {t('see_details')} <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {previousOrders.length === 0 && (
              <div className="py-12 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 transition-colors">
                <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">No previous orders</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ORIENTATION SELECTION & PREVIEW MODAL */}
      {orientationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-fade-in print:hidden">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 relative">
            <button 
              onClick={() => setOrientationModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-205 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-neutral-900 dark:text-white">
                Chagua Mwelekeo wa Tiketi (Ticket Orientation)
              </h3>
              <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 font-medium font-sans">
                Hakiki muonekano wa tiketi yako ya safari kabla ya kuchapa (Print) au kupakua (Download).
              </p>
            </div>

            {/* Dynamic visual preview cards for Portrait and Landscape */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Portrait Selector Card */}
              <div 
                onClick={() => setSelectedOrientation('portrait')}
                className={`border-2 rounded-[2rem] p-5 cursor-pointer transition-all flex flex-col items-center space-y-4 hover:border-orange-500/50 bg-neutral-50 dark:bg-neutral-950/40 relative group ${
                  selectedOrientation === 'portrait' ? 'border-orange-600 ring-4 ring-orange-600/10' : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${selectedOrientation === 'portrait' ? 'border-orange-600' : 'border-[#8e8e8e]'}`}>
                    {selectedOrientation === 'portrait' && <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />}
                  </span>
                  <span className="font-extrabold text-sm text-neutral-900 dark:text-white uppercase">Wima (Portrait Orientation)</span>
                </div>
                
                {/* Visual Portrait Representative Simulation */}
                <div className="w-[180px] h-[260px] border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-2xl shadow-md p-3 space-y-3 relative overflow-hidden flex flex-col justify-between">
                  {/* Top main body mock */}
                  <div className="space-y-1.5">
                    <div className="bg-orange-600 h-2 rounded w-full"></div>
                    <div className="bg-neutral-200 dark:bg-neutral-800 h-3 rounded w-11/12"></div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2 rounded w-full"></div>
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2 rounded w-10/12"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2 rounded w-9/12"></div>
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2 rounded w-full"></div>
                    </div>
                  </div>
                  {/* Dash Divider representing perforation line */}
                  <div className="border-t border-dashed border-neutral-300 dark:border-neutral-700 w-full my-1"></div>
                  {/* Bottom stub mock */}
                  <div className="space-y-1.5 pb-1">
                    <div className="bg-neutral-200 dark:bg-neutral-800 h-2 rounded w-1/2 mx-auto"></div>
                    <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-800 mx-auto rounded-sm flex items-center justify-center">
                      <span className="text-[6px]">▣</span>
                    </div>
                    <div className="bg-neutral-150 dark:bg-neutral-850 h-1 rounded w-3/4 mx-auto"></div>
                  </div>
                </div>
                
                <p className="text-[10px] text-center text-neutral-400 font-bold uppercase">
                  Inapendekezwa kwa simu za mkononi na machapisho ya wima.
                </p>
              </div>

              {/* Landscape Selector Card */}
              <div 
                onClick={() => setSelectedOrientation('landscape')}
                className={`border-2 rounded-[2rem] p-5 cursor-pointer transition-all flex flex-col items-center space-y-4 hover:border-orange-500/50 bg-neutral-50 dark:bg-neutral-950/40 relative group ${
                  selectedOrientation === 'landscape' ? 'border-orange-600 ring-4 ring-orange-600/10' : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${selectedOrientation === 'landscape' ? 'border-orange-600' : 'border-[#8e8e8e]'}`}>
                    {selectedOrientation === 'landscape' && <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />}
                  </span>
                  <span className="font-extrabold text-sm text-neutral-900 dark:text-white uppercase">Mlalo (Landscape Orientation)</span>
                </div>
                
                {/* Visual Landscape Representative Simulation */}
                <div className="w-[320px] h-[180px] border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-2xl shadow-md p-3 flex gap-3 relative overflow-hidden items-stretch justify-between">
                  {/* Left main body mock */}
                  <div className="flex-1 space-y-2.5">
                    <div className="bg-orange-600 h-2 rounded w-3/4"></div>
                    <div className="bg-neutral-200 dark:bg-neutral-800 h-3 rounded w-11/12"></div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2.5 rounded w-full"></div>
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2.5 rounded w-10/12"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2.5 rounded w-9/12"></div>
                      <div className="bg-neutral-150 dark:bg-neutral-850 h-2.5 rounded w-full"></div>
                    </div>
                  </div>
                  
                  {/* Vertical Dash Divider */}
                  <div className="border-l border-dashed border-neutral-300 dark:border-neutral-700 h-full mx-1"></div>
                  
                  {/* Right stub mock */}
                  <div className="w-24 flex flex-col justify-between items-center py-1">
                    <div className="bg-neutral-200 dark:bg-neutral-800 h-2 rounded w-3/4 animate-pulse"></div>
                    <div className="w-11 h-11 bg-neutral-200 dark:bg-neutral-800 rounded-sm flex items-center justify-center">
                      <span className="text-[10px]">▣</span>
                    </div>
                    <div className="bg-neutral-150 dark:bg-neutral-850 h-1 rounded w-1/2"></div>
                  </div>
                </div>
                
                <p className="text-[10px] text-center text-neutral-400 font-bold uppercase">
                  Inapendekezwa kwa makadi ya printa na kukata makombora ya tiketi.
                </p>
              </div>
            </div>

            {/* Dynamic style tag that forces browser print settings based on selection */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: ${selectedOrientation === 'portrait' ? 'portrait' : 'landscape'};
                  margin: 10mm;
                }
              }
            `}} />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 font-sans">
              <Button 
                onClick={() => {
                  setOrientationModalOpen(false);
                  if (pendingAction) {
                    if (pendingAction.type === 'print') {
                      setTimeout(() => {
                        window.print();
                      }, 250);
                    } else if (pendingAction.type === 'download' && pendingAction.elementId) {
                      setTimeout(() => {
                        handleDownloadTicket(pendingAction.elementId!);
                      }, 250);
                    }
                  }
                }}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black h-12 rounded-2xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                {pendingAction?.type === 'print' ? (
                  <>
                    <Printer className="w-4 h-4" /> THIBITISHA & CHAPA (PRINT)
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> THIBITISHA & PAKUA IMAGE
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setOrientationModalOpen(false)}
                className="sm:w-36 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold h-12 rounded-2xl text-xs uppercase hover:bg-neutral-50 dark:hover:bg-neutral-950"
              >
                GHAIRI
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CASH PAYMENT EXPLANATORY & ALTERNATIVE MOBILE MONEY MODAL */}
      {showCashPaymentModal && cashOrderRefForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-fade-in print:hidden">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-6 relative">
            <button 
              onClick={() => setShowCashPaymentModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto text-amber-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-amber-600">
                LIPA UFIKAPO (CASH)
              </h3>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 font-bold leading-relaxed font-sans bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-500/10 rounded-2xl text-left">
                ⚠️ <span className="text-red-500 font-extrabold">MUHIMU:</span> Ili kuzuia ucheleweshaji na foleni, **chakula chako kitaanza kupikwa pindi utakapokamilisha malipo**.
                <br /><br />
                Tafadhali fika kwenye **Kaunta ya Malipo (Cashier)** au kabidhi pesa taslimu kwa **Mhudumu (Waiter)** aliyeko karibu nawe na umuombe asajili malipo yako sasa ili oda yako ipelekwe jikoni haraka!
              </p>
            </div>

            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Je, ungependa kubadilisha na kulipia sasa hivi kwa Simu (Mobile Money)?
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="Weka namba ya Simu: mfam. 07XXXXXXXX"
                    value={alternativePhoneNumber}
                    onChange={(e) => setAlternativePhoneNumber(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <Button 
                  onClick={handleInitiateCashAlternativePayment}
                  disabled={isPaying}
                  className="w-full h-12 bg-teal-500 hover:bg-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl gap-2 shadow-md transition-all cursor-pointer"
                >
                  {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  LIPA SASA KWA SIMU
                </Button>

                <Button 
                  variant="outline"
                  onClick={() => setShowCashPaymentModal(false)}
                  className="w-full h-12 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-950 transition-colors cursor-pointer"
                >
                  Nitamlipa Mhudumu (Cash)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
