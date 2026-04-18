import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MyOrdersProps {
  onBack?: () => void;
}

export default function MyOrders({ onBack }: MyOrdersProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const handlePayNow = async (order: Order) => {
    if (!user?.phoneNumber && !order.customerPhone) {
      toast.error("Tafadhali weka namba ya simu kwenye profile yako kwanza.");
      return;
    }

    setIsPaying(true);
    try {
      const response = await initiatePayment({
        order_id: order.id!,
        amount: order.totalAmount,
        buyer_phone: (order.customerPhone || user?.phoneNumber || '').replace(/[^0-9]/g, ''),
        fee_payer: 'MERCHANT'
      });

      if (response.status === 'success') {
        toast.success("Ombi la malipo limetumwa kwenye simu yako. Tafadhali weka namba ya siri.");
        // We rely on the snapshot listener to update when paymentStatus changes to 'paid'
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

    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const activeOrders = orders.filter(o => ['pending', 'preparing', 'out_for_delivery', 'accepted'].includes(o.status));
  const previousOrders = orders.filter(o => ['delivered', 'cancelled', 'completed'].includes(o.status));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'preparing': return 'bg-blue-100 text-blue-700';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-700';
      case 'delivered':
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getStatusLabel = (status: string) => {
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

  if (selectedOrder) {
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">
                      {t('order_id')}: <span className="text-orange-600">#{selectedOrder.id?.slice(-8).toUpperCase()}</span>
                    </h2>
                    <p className="text-neutral-500 mt-1">
                      {selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString() : new Date(selectedOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={`${getStatusColor(selectedOrder.status)} border-none px-4 py-1.5 rounded-full font-bold`}>
                    {getStatusLabel(selectedOrder.status)}
                  </Badge>
                </div>

                <div className="flex flex-col items-center py-12 border-y border-neutral-100 mb-8">
                  <div className="relative w-full max-w-md">
                    <div className="flex justify-between mb-8">
                      {['placed', 'accepted', 'preparing', 'prepared', 'out_for_delivery', 'delivered'].map((step, idx) => {
                        const steps = ['pending', 'accepted', 'preparing', 'prepared', 'out_for_delivery', 'delivered'];
                        const currentIdx = steps.indexOf(selectedOrder.status === 'completed' ? 'delivered' : selectedOrder.status);
                        const isCompleted = idx <= currentIdx;
                        
                        return (
                          <div key={step} className="flex flex-col items-center gap-2 z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-teal-500 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 uppercase text-center w-12">
                              {step.replace(/_/g, ' ')}
                            </span>
                          </div>
                        );
                      })}
                      <div className="absolute top-4 left-4 right-4 h-1 bg-neutral-100 -z-0">
                        <div 
                          className="h-full bg-teal-500 transition-all duration-500" 
                          style={{ width: `${(Math.max(0, ['pending', 'accepted', 'preparing', 'prepared', 'out_for_delivery', 'delivered'].indexOf(selectedOrder.status === 'completed' ? 'delivered' : selectedOrder.status)) / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center mt-8">
                    <img 
                      src={selectedOrder.status === 'out_for_delivery' ? "https://cdn-icons-png.flaticon.com/512/2972/2972185.png" : "https://cdn-icons-png.flaticon.com/512/3063/3063822.png"} 
                      alt="Status" 
                      className="w-32 h-32 mx-auto mb-4 opacity-80"
                    />
                    <h3 className="text-xl font-bold text-neutral-800">
                      {selectedOrder.status === 'preparing' ? 'The chef is preparing your food.' : 
                       selectedOrder.status === 'out_for_delivery' ? 'The delivery man is on the way!' :
                       selectedOrder.status === 'delivered' ? 'Your order has been delivered' : 'Processing your order...'}
                    </h3>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">{t('delivery_address')}</h4>
                    <div className="flex gap-3 p-4 bg-neutral-50 rounded-2xl">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Truck className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-sm font-medium text-neutral-700">{selectedOrder.deliveryAddress}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">{t('payment_info')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-neutral-50 rounded-2xl">
                        <p className="text-xs text-neutral-500 mb-1">{t('method')}</p>
                        <p className="text-sm font-bold uppercase">{selectedOrder.paymentMethod || 'Cash'}</p>
                      </div>
                      <div className="p-4 bg-neutral-50 rounded-2xl">
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
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
                <h3 className="font-bold text-lg">{t('order_details')}</h3>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-16 h-16 bg-neutral-100 rounded-2xl overflow-hidden relative shrink-0">
                        <img src={item.imageUrl || "https://picsum.photos/seed/food/200"} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute top-0 left-0 bg-neutral-900 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br-lg">
                          {item.quantity}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-sm truncate">{item.name}</h5>
                        {item.variation && <p className="text-[10px] text-neutral-500">Size: {item.variation.name}</p>}
                        <p className="text-sm font-bold text-orange-600 mt-1">TZS {item.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-neutral-100 space-y-3">
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>{t('subtotal')}</span>
                    <span>TZS {selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-neutral-600">
                    <span>{t('discount')}</span>
                    <span>TZS 0</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>{t('delivery_charge')}</span>
                    <span>TZS 0</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-neutral-900 pt-2 border-t border-dashed border-neutral-200">
                    <span>{t('total')}</span>
                    <span>TZS {selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-6 space-y-3 print:hidden">
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
          <h2 className="text-2xl font-black text-neutral-900 flex items-center gap-3">
            <Clock className="w-6 h-6 text-orange-600" />
            {t('active_orders')}
          </h2>
          <div className="space-y-4">
            {activeOrders.map(order => (
              <Card 
                key={order.id} 
                className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shrink-0">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-neutral-900 truncate">
                        {t('order_id')}: #{order.id?.slice(-8).toUpperCase()}
                      </h4>
                      <Badge className={`${getStatusColor(order.status)} border-none text-[10px] font-bold`}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt).toLocaleString()}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm font-black text-neutral-900">
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
              <div className="py-12 text-center bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200">
                <Package className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 font-medium">No active orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Previous Orders */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-neutral-900 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            {t('previous_orders')}
          </h2>
          <div className="space-y-4">
            {previousOrders.map(order => (
              <Card 
                key={order.id} 
                className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group opacity-80 hover:opacity-100"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400 shrink-0">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-neutral-900 truncate">
                        {t('order_id')}: #{order.id?.slice(-8).toUpperCase()}
                      </h4>
                      <Badge className={`${getStatusColor(order.status)} border-none text-[10px] font-bold`}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt).toLocaleString()}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm font-black text-neutral-900">
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
              <div className="py-12 text-center bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200">
                <Package className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 font-medium">No previous orders</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
