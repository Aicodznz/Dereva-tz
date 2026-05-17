import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  orderBy 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Utensils, Bell, Clock, ChefHat, CheckCircle2 } from 'lucide-react';
import { Order } from '../types';

export default function PublicStatusDisplay() {
  const { vendorId } = useParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorName, setVendorName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) return;

    // Fetch vendor info
    const fetchVendor = async () => {
      const vendorDoc = await getDoc(doc(db, 'vendors', vendorId));
      if (vendorDoc.exists()) {
        setVendorName(vendorDoc.data().businessName);
      }
    };
    fetchVendor();

    // Listen to active orders
    const q = query(
      collection(db, 'orders'),
      where('vendorId', '==', vendorId),
      where('status', 'in', ['accepted', 'preparing', 'prepared']),
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
  }, [vendorId]);

  const readyOrders = orders.filter(o => o.status === 'prepared');
  const cookingOrders = orders.filter(o => ['accepted', 'preparing'].includes(o.status));

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-black uppercase tracking-widest text-sm">Inapakia Mfumo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-950/20">
            <Utensils className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">{vendorName}</h1>
            <p className="text-orange-500 font-black uppercase tracking-[0.2em] text-[10px] mt-1">Order Status Display</p>
          </div>
        </div>
        <div className="bg-neutral-900 px-6 py-4 rounded-2xl border border-white/5 flex items-center gap-4">
          <Clock className="w-6 h-6 text-neutral-500" />
          <span className="text-2xl font-black">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-8 h-[calc(100vh-180px)]">
        {/* Cooking Section */}
        <div className="bg-neutral-900/50 rounded-[2.5rem] border border-white/5 p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ChefHat className="w-48 h-48 rotate-12" />
          </div>
          
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tight text-amber-500">INAPIKWA / COOKING</h2>
            <span className="ml-auto bg-neutral-800 px-4 py-1 rounded-full text-sm font-black">{cookingOrders.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {cookingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, x: 100 }}
                    className="bg-neutral-800/50 border border-white/5 p-6 rounded-3xl flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-black text-white italic">#{order.id?.slice(-4).toUpperCase()}</span>
                      {order.tableNumber && (
                        <span className="bg-orange-600/10 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Meza {order.tableNumber}</span>
                      )}
                    </div>
                    <p className="text-neutral-500 text-sm font-bold truncate">
                      {order.items.map(i => i.name).join(', ')}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                       <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                             {[1,2,3].map(i => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse delay-${i*100}`} />
                             ))}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Processing</span>
                       </div>
                       {order.prepTime && (
                         <div className="flex items-center gap-1.5 text-amber-500/50 bg-amber-500/5 px-2 py-0.5 rounded-lg">
                           <Clock className="w-2.5 h-2.5" />
                           <span className="text-[9px] font-black italic">{order.prepTime} Mins</span>
                         </div>
                       )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {cookingOrders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 bg-neutral-950/30 rounded-3xl border border-dashed border-white/10">
                <ChefHat className="w-20 h-20 mb-4" />
                <p className="font-black uppercase tracking-widest">Hakuna Oda Zinazopikwa</p>
              </div>
            )}
          </div>
        </div>

        {/* Ready Section */}
        <div className="bg-orange-600 rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden shadow-2xl shadow-orange-950/40">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Bell className="w-48 h-48 rotate-12" />
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tight text-white">ODA ZIKO TAYARI / READY</h2>
            <span className="ml-auto bg-white/20 px-4 py-1 rounded-full text-sm font-black">{readyOrders.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {readyOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="bg-white p-6 rounded-3xl flex flex-col gap-2 shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-5xl font-black text-black italic leading-none">#{order.id?.slice(-4).toUpperCase()}</span>
                      <div className="bg-black text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase animate-bounce">
                        CHUKUA ODA
                      </div>
                    </div>
                    {order.customerName && (
                      <p className="text-neutral-900 font-black text-lg mt-2 uppercase italic tracking-tighter">{order.customerName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-4 text-green-600 font-black uppercase text-[10px] tracking-widest">
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                       Ready to serve
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {readyOrders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 bg-black/10 rounded-3xl border border-dashed border-white/30">
                <Bell className="w-20 h-20 mb-4" />
                <p className="font-black uppercase tracking-widest text-center px-10">Tafadhali subiri oda yako ikamilike</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
