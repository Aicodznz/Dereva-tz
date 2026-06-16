import React, { useEffect, useState, useRef } from 'react';
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
import { Utensils, Bell, Clock, ChefHat, CheckCircle2, Volume2, Calendar, Sparkles, AlertTriangle } from 'lucide-react';
import { Order } from '../types';

export default function PublicStatusDisplay() {
  const { vendorId } = useParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorName, setVendorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  
  // Rotating/Sliding announcements list in Swahili
  const announcements = [
    "Karibu PAPO HAPO Express! Tafadhali kagua namba yako ya oda wakati wa kukabidhiwa.",
    "Boresha maisha yako kwa kuweka oda na kulipa papo hapo ukitumia QR Kadi yetu ya meza!",
    "Chakula chako kikijaa kwenye upande wa machungwa 'READY', fika kaunta na risiti yako.",
    "Afya yako kipaumbele chetu! Chakula chote kinaandaliwa kwa uzingatiaji mkubwa wa usafi. Enjoy!",
    "Sasa unaweza kuagiza vinywaji baridi na vishawishi vya ziada bila kuondoka kwenye kiti chako."
  ];
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  useEffect(() => {
    // Interlaced clock interval
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Announcement rotator interval
    const rotator = setInterval(() => {
      setAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(rotator);
    };
  }, [announcements.length]);

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
    }, (error) => {
      console.warn("Restricted access or error listening to public orders display:", error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const readyOrders = orders.filter(o => o.status === 'prepared');
  const cookingOrders = orders.filter(o => ['accepted', 'preparing'].includes(o.status));

  // Elegant Date formatting in Swahili/Universal format
  const formattedDate = time.toLocaleDateString('sw-TZ', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const formattedTime = time.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-black uppercase tracking-widest text-sm animate-pulse">Inapakia Mfumo Wa Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 font-sans flex flex-col justify-between overflow-hidden">
      <div>
        {/* Header with ticking clock and date */}
        <header className="flex justify-between items-center mb-6 border-b border-white/10 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-950/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent)]" />
              <Utensils className="w-8 h-8 text-white relative z-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none bg-gradient-to-r from-white via-white to-neutral-400 bg-clip-text text-transparent">
                {vendorName || 'RESTAURANT KISINIA'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-orange-500 font-extrabold uppercase tracking-[0.25em] text-[10px]">TV ORDER STATUS PRESENTATION</span>
                <span className="w-1.5 h-1.5 bg-[#00E5A0] rounded-full animate-ping" />
                <span className="text-[#00E5A0] text-[9px] font-black uppercase tracking-widest">LIVE</span>
              </div>
            </div>
          </div>

          {/* Time & Date Display */}
          <div className="flex gap-4">
            {/* Elegant Calendar Element */}
            <div className="bg-neutral-900 px-5 py-3.5 rounded-2xl border border-white/5 flex items-center gap-3 shadow-inner">
              <Calendar className="w-5 h-5 text-orange-500" />
              <div className="flex flex-col items-start leading-none gap-0.5">
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">LEO</span>
                <span className="text-xs font-black uppercase text-neutral-200">{formattedDate}</span>
              </div>
            </div>

            {/* Live Ticking Clock */}
            <div className="bg-neutral-900 px-6 py-3.5 rounded-2xl border border-white/5 flex items-center gap-3 relative shadow-inner">
              <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <Clock className="w-5 h-5 text-orange-500 animate-pulse" />
              <div className="flex flex-col items-start leading-none gap-0.5">
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">SAWA SASA</span>
                <span className="text-xl font-mono font-black text-white">{formattedTime}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Outer Split Columns Layout */}
        <div className="grid grid-cols-2 gap-8 h-[calc(100vh-210px)] min-h-[480px]">
          {/* Cooking Column Section */}
          <div className="bg-neutral-900/40 rounded-[2.5rem] border border-white/5 p-8 flex flex-col relative overflow-hidden">
            {/* Faint Background Logo */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] select-none pointer-events-none">
              <ChefHat className="w-[28rem] h-[28rem] rotate-12" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-md">
                <ChefHat className="w-6 h-6 text-amber-500 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div className="flex flex-col leading-none gap-0.5">
                <h2 className="text-3xl font-black italic uppercase tracking-tight text-amber-500">INAPIKWA / COOKING</h2>
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Oda zinazoandaliwa jikoni sasa</span>
              </div>
              <span className="ml-auto bg-neutral-800 border border-white/5 px-4 py-2 rounded-2xl text-lg font-mono font-black text-amber-500">
                {cookingOrders.length}
              </span>
            </div>

            {/* List Screen Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {cookingOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, x: 120 }}
                      className="bg-neutral-950/40 border border-neutral-800/80 p-5 rounded-[2rem] flex flex-col justify-between h-36 hover:border-amber-500/30 transition-all shadow-md group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Oda Namba</span>
                          <span className="text-3xl font-mono font-black text-white italic group-hover:text-amber-400 transition-colors">
                            #{order.id?.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        {order.tableNumber ? (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-[9px] font-black uppercase">
                            Meza {order.tableNumber}
                          </span>
                        ) : (
                          <span className="bg-neutral-850 border border-white/5 text-neutral-400 px-3 py-1 rounded-full text-[9px] font-black uppercase">
                            Chukua
                          </span>
                        )}
                      </div>

                      <div className="border-t border-neutral-850 pt-3 flex flex-col gap-1">
                        <p className="text-neutral-450 text-[11px] font-bold truncate">
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-1.5 w-1.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-550 leading-none">Inaliwa Hivi Karibuni</span>
                          </div>
                          {order.prepTime && (
                            <div className="flex items-center gap-1 text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10">
                              <Clock className="w-2.5 h-2.5" />
                              <span className="text-[8.5px] font-black font-mono italic">{order.prepTime} min</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {cookingOrders.length === 0 && (
                <div className="h-full min-h-[290px] flex flex-col items-center justify-center opacity-40 bg-neutral-950/20 rounded-[2rem] border border-dashed border-white/5 p-10">
                  <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center justify-center mb-4">
                    <ChefHat className="w-8 h-8 text-neutral-500" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-neutral-400">Hakuna Oda Zinazopikwa</h3>
                  <p className="text-[10px] text-neutral-500 font-bold max-w-xs text-center mt-1">Kwa sasa jiko lipo tayari kupokea oda mpya.</p>
                </div>
              )}
            </div>
          </div>

          {/* Ready & Finished Dining Section Column */}
          <div className="bg-gradient-to-b from-orange-600 to-orange-700 rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden shadow-2xl shadow-orange-950/40 border border-orange-500/20">
            {/* Background Icon */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.06] select-none pointer-events-none">
              <Bell className="w-[28rem] h-[28rem] rotate-12" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-md">
                <CheckCircle2 className="w-6 h-6 text-white animate-bounce" />
              </div>
              <div className="flex flex-col leading-none gap-0.5 text-white">
                <h2 className="text-3xl font-black italic uppercase tracking-tight">ODA TAYARI / READY</h2>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80 decoration-white">Tafadhali fika kaunta kuchukua chakula</span>
              </div>
              <span className="ml-auto bg-white/20 border border-white/5 px-4 py-2 rounded-2xl text-lg font-mono font-black text-white">
                {readyOrders.length}
              </span>
            </div>

            {/* List Screen Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {readyOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, rotate: -2 }}
                      className="bg-white p-5 rounded-[2rem] flex flex-col justify-between h-38 shadow-xl relative overflow-hidden"
                    >
                      {/* Top ribbon layout decoration */}
                      <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-teal-400 to-emerald-500" />

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">ODA NUMBA</span>
                          <span className="text-4xl font-mono font-black text-black italic">
                            #{order.id?.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        <div className="bg-orange-650 text-white px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse border border-orange-600">
                          {order.tableNumber ? `MEZA ${order.tableNumber}` : "CHUKUA"}
                        </div>
                      </div>

                      <div className="border-t border-neutral-100 pt-3 mt-1 flex flex-col gap-1.5">
                        {order.customerName && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-neutral-450">MTEJA:</span>
                            <span className="text-neutral-900 font-black text-sm uppercase italic tracking-tighter truncate max-w-[130px]">
                              {order.customerName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-emerald-600 font-extrabold uppercase text-[8.5px] tracking-widest">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                            Tayari kwa Kukabidhiwa
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {readyOrders.length === 0 && (
                <div className="h-full min-h-[290px] flex flex-col items-center justify-center opacity-60 bg-black/10 rounded-[2rem] border border-dashed border-white/20 p-10">
                  <div className="w-16 h-16 bg-white/10 border border-white/25 rounded-3xl flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-white">Subiri Kwanza</h3>
                  <p className="text-[10px] text-orange-200 font-bold max-w-xs text-center mt-1.5">Oda yako inapokuwa tayari itaonekana hapa ikiambatana na kengele.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Sliding Announcement Bar Footer */}
      <footer className="mt-6 select-none relative z-20">
        <div className="relative h-14 bg-neutral-900 rounded-2xl border border-white/5 overflow-hidden flex items-center px-6">
          {/* Static Title Box Badge */}
          <div className="bg-orange-600/10 border border-orange-600/30 text-orange-500 px-4 py-1.5 rounded-xl flex items-center gap-2 mr-6 shrink-0 shadow-sm">
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest">Matangazo / Info</span>
          </div>

          {/* AnimatePresence Fading Slider for Swahili notices */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={announcementIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="absolute text-xs font-semibold text-neutral-300 flex items-center gap-2 pl-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0 select-none" />
                <span className="truncate pr-4">{announcements[announcementIndex]}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress Indicator Dots */}
          <div className="flex gap-1.5 items-center shrink-0 ml-4">
            {announcements.map((_, idx) => (
              <div 
                key={`dot-adv-${idx}`}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  idx === announcementIndex ? 'bg-orange-500 w-3' : 'bg-neutral-800'
                }`}
              />
            ))}
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}} />
    </div>
  );
}
