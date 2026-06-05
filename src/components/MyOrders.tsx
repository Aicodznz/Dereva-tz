import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { Order } from '../types';
import { useLanguage } from '../LanguageContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { initiatePayment } from '../services/paymentService';
import { 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  ShoppingBag,
  Printer,
  CreditCard,
  Loader2,
  Navigation,
  Bus,
  MapPin,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import OrderTracker from './OrderTracker';

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

  const handlePayNow = async (order: Order) => {
    const userPhone = user?.phoneNumber || profile?.phoneNumber || '';
    if (!userPhone && !order.customerPhone) {
      toast.error("Tafadhali weka namba ya simu kwenye profile yako kwanza.");
      return;
    }

    setIsPaying(true);
    try {
      const response = await initiatePayment({
        order_id: order.id!,
        amount: order.totalAmount,
        buyer_phone: (order.customerPhone || userPhone || '').replace(/[^0-9]/g, ''),
        fee_payer: 'MERCHANT'
      });

      if (response.status === 'success') {
        toast.success("Ombi la malipo limetumwa kwenye simu yako. Tafadhali weka namba ya siri.");
      } else {
        toast.error(response.message || "Imeshindikana kuanzisha malipo.");
      }
    } catch (error) {
      console.error("Payment failed:", error);
      toast.error("Hitilafu imetokea wakati wa kulipia. Jaribu tena.");
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
          const dateA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt);
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
        const dateA = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : new Date(b.createdAt);
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
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
                {/* Background bus logo overlay */}
                <div className="absolute -right-16 -bottom-16 opacity-5 pointer-events-none">
                  <Package className="w-96 h-96" />
                </div>

                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-dashed divide-neutral-750">
                  {/* Left: Main Ticket Body */}
                  <div className="flex-1 lg:pr-8 pb-6 lg:pb-0 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                          <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest">{order.vendorName || "KILIMANJARO EXPRESS"}</h3>
                        </div>
                        <h2 className="text-xl lg:text-2xl font-black uppercase italic tracking-tighter mt-1 text-white">TIKETI YA SAFARI YA MIKOA</h2>
                        <span className="text-[9px] font-mono text-neutral-500 uppercase">Tanzania Intercity Passenger Ticket</span>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Ticket Number</span>
                        <div className="text-lg font-mono font-black text-orange-500">#{selectedOrder.id?.slice(-8).toUpperCase()}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 p-4 bg-neutral-950/60 rounded-3xl border border-neutral-800">
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase">Jina la Abiria</span>
                        <p className="text-xs font-bold text-white leading-tight">{order.customerName || "Abiria"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase">Namba ya Simu</span>
                        <p className="text-xs font-mono font-bold text-white leading-tight">{order.customerPhone || "-"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase">Namba ya Basi</span>
                        <p className="text-xs font-bold text-white leading-tight">{(selectedOrder.items[0] as any)?.registration || "T 123 ABC"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase">Darasa / Class</span>
                        <p className="text-xs font-bold text-orange-400 leading-tight">{(selectedOrder.items[0] as any)?.class || "Luxury"}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase">Njia / Route</span>
                        <p className="text-xs font-bold text-white leading-tight">
                          {(selectedOrder.items[0] as any)?.origin || "Kutoka"} ➔ {(selectedOrder.items[0] as any)?.destination || "Kwenda"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-neutral-500 uppercase">Viti / Seat Number</span>
                        <p className="text-xs font-mono font-black text-orange-500 leading-tight">
                          {Array.isArray(order.selectedSeats) ? order.selectedSeats.join(", ") : (selectedOrder as any).tableNumber || "A2"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase">Tarehe ya Safari</span>
                        <p className="text-xs font-black text-white mt-0.5">{(selectedOrder.items[0] as any)?.departureDate || "Leo"}</p>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase">Saa ya Safari</span>
                        <p className="text-xs font-black text-white mt-0.5">{(selectedOrder.items[0] as any)?.departureTime || "06:00 AM"}</p>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase">Boarding Point</span>
                        <p className="text-xs font-black text-white mt-0.5">{(selectedOrder.items[0] as any)?.boardingPoint || "Main Terminal"}</p>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 text-center">
                        <span className="text-[8px] font-black text-neutral-500 uppercase">Nauli / Total Fare</span>
                        <p className="text-xs font-black text-orange-400 mt-0.5">TZS {selectedOrder.totalAmount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between items-center text-[10px] text-neutral-400 border-t border-neutral-800">
                      <div>
                        Status ya Tiketi: <span className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${['delivered', 'completed', 'used'].includes(selectedOrder.status) ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                          {['delivered', 'completed', 'used'].includes(selectedOrder.status) ? 'USED / IMEKATWA' : 'VALID / HAIJAKATWA'}
                        </span>
                      </div>
                      <p className="text-[8px] italic text-neutral-500 font-bold">Inamilikiwa na Simba-Pay Ticketing Engine © 2026</p>
                    </div>
                  </div>

                  {/* Right: Passenger Stub */}
                  <div className="lg:w-72 lg:pl-8 pt-6 lg:pt-0 flex flex-col justify-between items-center space-y-6">
                    <div className="text-center w-full">
                      <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Kipande cha Abiria</span>
                      <h4 className="text-sm font-black text-white uppercase italic tracking-tighter">PASSENGER STUB</h4>
                      <div className="mt-2 border border-dashed border-neutral-800 p-2 rounded-2xl bg-white w-[130px] h-[130px] mx-auto flex items-center justify-center">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${selectedOrder.id}`} 
                          alt="Ticket QR Code" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full animate-fade-in"
                        />
                      </div>
                      <p className="text-[8px] text-neutral-500 font-mono mt-1">Scan boarding QR Code</p>
                    </div>

                    <div className="w-full space-y-2 p-3 bg-neutral-950 rounded-2xl border border-neutral-800 text-xs text-neutral-300">
                      <div className="flex justify-between">
                        <span className="text-[8px] font-bold text-neutral-500 uppercase">Abiria:</span>
                        <span className="font-bold text-white truncate max-w-[120px]">{order.customerName || "Abiria"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-bold text-neutral-500 uppercase">Safari:</span>
                        <span className="font-bold text-white truncate max-w-[120px]">{(selectedOrder.items[0] as any)?.origin || "Kutoka"} - {(selectedOrder.items[0] as any)?.destination || "Kwenda"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[8px] font-bold text-neutral-500 uppercase">Tarehe / Kiti:</span>
                        <span className="font-bold text-white">
                          {(selectedOrder.items[0] as any)?.departureDate || "Leo"} | #{Array.isArray(order.selectedSeats) ? order.selectedSeats[0] : (selectedOrder as any).tableNumber || "A2"}
                        </span>
                      </div>
                    </div>

                    <div className="w-full flex gap-2 print:hidden justify-center">
                      <Button 
                        onClick={() => window.print()}
                        className="bg-neutral-800 hover:bg-neutral-700 h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-neutral-750"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1" /> Print Stub
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
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
                        {selectedOrder.createdAt && typeof selectedOrder.createdAt.toDate === 'function' ? selectedOrder.createdAt.toDate().toLocaleString() : new Date(selectedOrder.createdAt).toLocaleString()}
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
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-neutral-900">
                <CardHeader className="bg-neutral-50/50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800 transition-colors">
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{t('order_details')}</h3>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={`order-item-${selectedOrder.id}-${idx}`} className="flex gap-4">
                        <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden relative shrink-0">
                          <img 
                            src={item.imageUrl || "https://picsum.photos/seed/food/200"} 
                            alt={item.name} 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
                            }}
                          />
                          <div className="absolute top-0 left-0 bg-neutral-900 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br-lg">
                            {item.quantity}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-sm truncate text-neutral-900 dark:text-white">{item.name}</h5>
                          {item.variation && <p className="text-[10px] text-neutral-500">Size: {item.variation.name}</p>}
                          <p className="text-sm font-bold text-orange-600 mt-1">TZS {item.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                    <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-400">
                      <span>{t('subtotal')}</span>
                      <span>TZS {selectedOrder.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-400">
                      <span>{t('discount')}</span>
                      <span>TZS 0</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium">
                      <span>{t('delivery_charge')}</span>
                      <span>TZS 0</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-neutral-900 dark:text-white pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800">
                      <span>{t('total')}</span>
                      <span>TZS {selectedOrder.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-6 space-y-3 print:hidden">
                    {['out_for_delivery', 'preparing', 'accepted'].includes(selectedOrder.status) && (
                      <Button 
                        onClick={() => setTrackingOrder(selectedOrder)}
                        className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold gap-2 shadow-lg shadow-orange-600/20"
                      >
                        <Navigation className="w-5 h-5" />
                        Fuatilia Oda Yako
                      </Button>
                    )}
                    <Button 
                      onClick={() => window.print()}
                      className="w-full h-14 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold gap-2"
                    >
                      <Printer className="w-5 h-5" />
                      {t('print_invoice')}
                    </Button>
                    {selectedOrder.paymentStatus !== 'paid' && (
                      <Button 
                        onClick={() => handlePayNow(selectedOrder)}
                        disabled={isPaying}
                        className="w-full h-14 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl font-bold gap-2"
                      >
                        {isPaying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                        {t('pay_now')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                      {order.createdAt && typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt).toLocaleString()}
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
                      {order.createdAt && typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt).toLocaleString()}
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
    </div>
  );
}
