import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Package, Clock, CheckCircle2, ChevronRight, 
  MapPin, User, Phone, Map, Search, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { format } from 'date-fns';

interface Parcel {
  id: string;
  category: string;
  status: 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  createdAt: any;
  sender: {
    address: string;
    name: string;
    phone: string;
  };
  recipient: {
    address: string;
    name: string;
    phone: string;
  };
  pricing: {
    total: number;
  };
}

const ParcelHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'parcels'),
      where('senderId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parcelData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Parcel[];

      // Sort in memory to avoid missing index error
      parcelData.sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const dateB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return dateB - dateA;
      });

      setParcels(parcelData);
      setLoading(false);
    }, (error) => {
      console.warn("Restricted access or error listening to parcel history:", error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-emerald-500 bg-emerald-500/10';
      case 'cancelled': return 'text-red-500 bg-red-500/10';
      case 'pending': return 'text-orange-500 bg-orange-500/10';
      default: return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Inasubiri Dereva';
      case 'accepted': return 'Dereva anakuja';
      case 'picked_up': return 'Imeshachukuliwa';
      case 'delivered': return 'Imeshafika';
      case 'cancelled': return 'Imeghairiwa';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-32">
      <div className="p-6 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl z-50">
        <button onClick={() => navigate('/parcel')} className="w-12 h-12 rounded-[1.2rem] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center shadow-lg active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter italic">Oda Zangu</h1>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-1">Historia ya vifurushi vyako</p>
        </div>
      </div>

      <div className="px-6 mt-6 max-w-xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest italic">Pakia data...</p>
          </div>
        ) : parcels.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-neutral-100 dark:border-neutral-800">
            <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={40} className="text-neutral-300" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter italic mb-2">Huna Oda Bado</h3>
            <p className="text-xs text-neutral-400 font-bold leading-relaxed mb-8">Anza kutuma mzigo wako sasa kwa kutumia huduma yetu ya haraka.</p>
            <button 
              onClick={() => navigate('/parcel')}
              className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-600/20 active:scale-95 transition-all"
            >
              Tuma Kifurushi Sasa
            </button>
          </div>
        ) : (
          parcels.map((parcel) => (
            <motion.div
              layoutId={parcel.id}
              key={parcel.id}
              onClick={() => setSelectedParcel(parcel)}
              className="bg-white dark:bg-neutral-900 rounded-[2rem] p-5 shadow-xl shadow-neutral-900/5 border border-neutral-100 dark:border-neutral-800 cursor-pointer active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
                    <Package size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tighter italic">{parcel.category}</h4>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                      {parcel.createdAt ? format(typeof parcel.createdAt.toDate === 'function' ? parcel.createdAt.toDate() : (parcel.createdAt.seconds ? new Date(parcel.createdAt.seconds * 1000) : new Date(parcel.createdAt)), 'dd MMM, HH:mm') : 'Hivi sasa'}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(parcel.status)}`}>
                  {getStatusLabel(parcel.status)}
                </div>
              </div>

              <div className="space-y-3 pl-2">
                <div className="flex items-start gap-4 h-full relative">
                  <div className="flex flex-col items-center gap-1.5 pt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600" />
                    <div className="w-0.5 h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-orange-500 bg-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Kutoka</p>
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{parcel.sender.address}</p>
                    <div className="mt-3">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Kwenda</p>
                      <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{parcel.recipient.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-50 dark:border-neutral-800/50 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Gharama</span>
                  <span className="text-sm font-black text-orange-600">TZS {(parcel.pricing?.total || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400 font-black uppercase tracking-widest text-[9px] group-hover:text-orange-500 transition-colors">
                  Maelezo zaidi <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedParcel && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedParcel(null)}
              className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
            />
            <motion.div
              layoutId={selectedParcel.id}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden relative shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-600/10 rounded-2xl flex items-center justify-center">
                      <Package size={28} className="text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter italic">{selectedParcel.category}</h2>
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">ID: {selectedParcel.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedParcel(null)}
                    className="w-10 h-10 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-neutral-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-3xl">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 italic">Hali</p>
                      <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${getStatusColor(selectedParcel.status)}`}>
                        {getStatusLabel(selectedParcel.status)}
                      </span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-3xl">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1 italic">Iliwekwa</p>
                      <p className="text-xs font-black italic">{selectedParcel.createdAt ? format(typeof selectedParcel.createdAt.toDate === 'function' ? selectedParcel.createdAt.toDate() : (selectedParcel.createdAt.seconds ? new Date(selectedParcel.createdAt.seconds * 1000) : new Date(selectedParcel.createdAt)), 'dd MMM, HH:mm') : 'Leo'}</p>
                    </div>
                  </div>

                  {/* 🏍️ Scenic Live Transit tracking simulator box (motion) */}
                  {selectedParcel.status !== 'cancelled' && (
                    <div className="relative h-20 bg-neutral-950/90 dark:bg-neutral-950/60 rounded-[2rem] border border-neutral-800 p-3.5 flex flex-col justify-end overflow-hidden">
                      {/* Interactive clouds or scenery */}
                      <div className="absolute inset-x-0 top-1.5 opacity-20 flex justify-between px-6 text-xs select-none pointer-events-none">
                        <span>☁️</span>
                        <span>🌲</span>
                        <span>🏠</span>
                        <span>☁️</span>
                        <span>🌲</span>
                      </div>

                      {/* Animated scenic road strip */}
                      {selectedParcel.status !== 'delivered' && (
                        <div 
                          className="absolute inset-0 opacity-5 pointer-events-none select-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] bg-[size:16px_16px]" 
                          style={{ animation: 'shimmer 4s linear infinite' }} 
                        />
                      )}

                      {/* Linear road tracking progression */}
                      {(() => {
                        const score = selectedParcel.status === 'pending' ? 15 : selectedParcel.status === 'accepted' ? 42 : selectedParcel.status === 'picked_up' ? 74 : selectedParcel.status === 'delivered' ? 100 : 0;
                        const label = selectedParcel.status === 'pending' ? 'Kutafuta msafirishaji...' : selectedParcel.status === 'accepted' ? 'Rider anafuata mzigo' : selectedParcel.status === 'picked_up' ? 'Mzigo upo njiani sasa!' : 'Uwasilishaji Umekamilika 🎉';
                        return (
                          <div className="w-full space-y-3">
                            <div className="h-1 bg-neutral-800 rounded-full relative overflow-visible flex items-center">
                              {/* Left origin point Pin */}
                              <div className="absolute left-0 -translate-x-1/2 -top-4 text-xs">
                                📦
                              </div>

                              {/* Right destination point Flag */}
                              <div className="absolute right-0 translate-x-1/2 -top-4 text-xs">
                                🏠
                              </div>

                              {/* Highlight road progression */}
                              <div 
                                className="absolute left-0 h-full bg-gradient-to-r from-orange-600 to-emerald-500 rounded-full"
                                style={{ width: `${score}%` }}
                              />

                              {/* Animating dynamic delivery agent */}
                              <motion.div 
                                className="absolute -top-[1.35rem] w-8 h-8 flex items-center justify-center text-xl select-none"
                                style={{ left: `calc(${score}% - 16px)` }}
                                animate={selectedParcel.status !== 'delivered' ? {
                                  y: [0, -1.5, 0],
                                  scale: [1, 1.05, 1]
                                } : {}}
                                transition={{ repeat: Infinity, duration: 0.32 }}
                              >
                                {selectedParcel.category?.toLowerCase() === 'vip' ? '🚗' : '🏍️'}
                                
                                {selectedParcel.status !== 'delivered' && (
                                  <motion.div 
                                    className="absolute -left-1 bottom-2 w-1.5 h-1.5 bg-orange-600/35 rounded-full blur-[1px]"
                                    animate={{ scale: [1, 2, 0], opacity: [0.7, 0.2, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.4 }}
                                  />
                                )}
                              </motion.div>
                            </div>

                            {/* Human state labeling in Swahili */}
                            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-neutral-400">
                              <span className="text-[#ea580c]">{label}</span>
                              <span className="font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white">{score}%</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center shrink-0">
                        <User size={20} className="text-neutral-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Mpokeaji</p>
                        <p className="text-sm font-black italic">{selectedParcel.recipient.name}</p>
                        <p className="text-xs font-bold text-neutral-500">{selectedParcel.recipient.phone}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center shrink-0">
                        <MapPin size={20} className="text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Maelezo ya Mahali</p>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white leading-relaxed">{selectedParcel.recipient.address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-neutral-900 rounded-[2rem] text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Gharama ya Usafirishaji</span>
                        <span className="text-2xl font-black italic tracking-tighter">TZS {(selectedParcel.pricing?.total || 0).toLocaleString()}</span>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 className="text-orange-500" />
                      </div>
                    </div>
                  </div>

                  {selectedParcel.status !== 'delivered' && selectedParcel.status !== 'cancelled' && (
                    <button className="w-full py-5 bg-white dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-700 text-neutral-900 dark:text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all flex items-center justify-center gap-3">
                      <Phone size={16} /> Piga Simu msaada
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParcelHistory;
