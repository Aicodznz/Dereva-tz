import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, FileText, Smartphone, Box, Pill, Dog, 
  ChevronRight, ArrowLeft, ShieldCheck, Clock, MapPin,
  TrendingUp, CheckCircle2, Truck, Home
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';

const categories = [
  { id: 'house_shifting', label: 'House Shifting', sub: 'Kuhamisha Nyumba & Ofisi / Movers & Canter 🚚', icon: Truck, color: 'bg-emerald-600', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop', badge: 'POPULAR' },
  { id: 'gifts', label: 'Gifts & Presents', sub: 'Send heartfelt presents', icon: Package, color: 'bg-pink-500', img: 'https://images.unsplash.com/photo-1549465220-1d8c9708458c?w=600&h=400&fit=crop' },
  { id: 'documents', label: 'Documents', sub: 'From IDs to legal forms', icon: FileText, color: 'bg-blue-500', img: 'https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?w=600&h=400&fit=crop' },
  { id: 'electronics', label: 'Electronics', sub: 'Safeguard your gadgets', icon: Smartphone, color: 'bg-amber-500', img: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&h=400&fit=crop' },
  { id: 'package', label: 'Package & Boxes', sub: 'Small or large packages', icon: Box, color: 'bg-neutral-500', img: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaad5b?w=600&h=400&fit=crop' },
  { id: 'medicines', label: 'Medicines', sub: 'Medical essentials fast', icon: Pill, color: 'bg-red-500', img: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&h=400&fit=crop' },
  { id: 'pet_supplies', label: 'Pet Supplies', sub: 'Furry friend needs', icon: Dog, color: 'bg-green-500', img: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=400&fit=crop' }
];

const ParcelHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeParcel, setActiveParcel] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'parcels'),
      where('senderId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted', 'picked_up']),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveParcel({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveParcel(null);
      }
    }, (error) => {
      console.warn("Restricted access or error listening to active parcel:", error.message);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-32">
      {/* Header */}
      <div className="p-6 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl z-50">
        <button onClick={() => navigate('/')} className="w-12 h-12 rounded-[1.5rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center shadow-lg transform active:scale-95 transition-all shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter truncate">Vifurushi & Pacho 📦</h1>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-0.5">Huduma ya uhakika ya usafirishaji</p>
        </div>
        <button 
          onClick={() => navigate('/parcel/history')}
          className="w-12 h-12 rounded-[1.5rem] bg-orange-600 text-white flex items-center justify-center shadow-xl shadow-orange-600/20 active:scale-95 transition-all shrink-0"
        >
          <Clock size={20} />
        </button>
      </div>

      <div className="px-6 space-y-12 max-w-2xl mx-auto mt-6">
        {/* Hero Card */}
        <section className="relative h-64 rounded-[3rem] overflow-hidden shadow-2xl group">
          <img 
            src="https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=800&q=80" 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5s]" 
            alt="Delivery"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-2">Tuma Chochote,<br />PoPote kwa Sekunde</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Bei nafuu • Rider rafiki • Usalama 100%</p>
          </div>
        </section>

        <AnimatePresence>
          {activeParcel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <button 
                onClick={() => navigate('/parcel/history')}
                className="w-full bg-orange-600 rounded-[2.5rem] p-6 text-white text-left shadow-2xl shadow-orange-600/30 flex items-center gap-4 relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Package size={80} />
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">Oda Moja Inaendelea</span>
                    <TrendingUp size={12} />
                  </div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter leading-tight">
                    {activeParcel.status === 'pending' ? 'Inatafuta Dereva...' : activeParcel.status === 'accepted' ? 'Dereva anakuja kwako' : 'Mzigo upo njiani'}
                  </h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mt-1">Gusa kuona maelezo zaidi</p>
                </div>
                <ChevronRight size={24} className="opacity-40" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link 
                to={`/parcel-request/${cat.id}`}
                className="group block bg-white dark:bg-neutral-900 rounded-[2.5rem] overflow-hidden border border-neutral-100 dark:border-neutral-800 shadow-xl shadow-neutral-900/5"
              >
                <div className="h-44 relative overflow-hidden">
                  <img src={cat.img} alt={cat.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                  <div className={`absolute top-4 left-4 w-12 h-12 ${cat.color} rounded-2xl flex items-center justify-center text-white shadow-2xl`}>
                    <cat.icon size={24} />
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-xl text-neutral-900 dark:text-white uppercase italic tracking-tighter">{cat.label}</h4>
                      <p className="text-xs text-neutral-400 mt-1 font-bold italic">{cat.sub}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-all">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Benefits */}
        <section className="bg-neutral-900 text-white rounded-[3rem] p-10 space-y-8">
           <h3 className="text-2xl font-black italic uppercase tracking-tighter">Kwanini papo haPo?</h3>
           <div className="grid gap-6">
             <div className="flex gap-5">
               <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                 <ShieldCheck className="text-orange-600" />
               </div>
               <div>
                  <p className="font-black uppercase italic tracking-tighter">Bima ya Mzigo</p>
                  <p className="text-xs text-white/40 font-bold leading-relaxed">Mizigo yote ipo salama na imekadiriwa bima dhidi ya upotevu au uharibifu.</p>
               </div>
             </div>
             <div className="flex gap-5">
               <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                 <Clock className="text-blue-500" />
               </div>
               <div>
                  <p className="font-black uppercase italic tracking-tighter">Real-Time Tracking</p>
                  <p className="text-xs text-white/40 font-bold leading-relaxed">Fuatilia mzigo wako kuanzia unapochukuliwa mpaka unafika mikononi mwa mpokeaji.</p>
               </div>
             </div>
             <div className="flex gap-5">
               <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                 <MapPin className="text-emerald-500" />
               </div>
               <div>
                  <p className="font-black uppercase italic tracking-tighter">Mtandao Mpana</p>
                  <p className="text-xs text-white/40 font-bold leading-relaxed">Tuna maelfu ya rida walio tayari kusafirisha mzigo wako popote jijini.</p>
               </div>
             </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default ParcelHome;
