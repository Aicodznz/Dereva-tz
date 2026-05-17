import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, MapPin, TrendingUp, Package, FileText, Smartphone, Box, Pill, Dog, Power, User, Car, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Partner } from '../../../types/parcel';
import CategoryBadge from './CategoryBadge';
import ParcelMapView from './ParcelMapView';
import { useTheme } from 'next-themes';
import { usePartnerLocation } from '../../../hooks/parcel/partner/usePartnerLocation';

const PartnerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const { location, error: gpsError } = usePartnerLocation();

  const profileRef = React.useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(doc(db, 'partners', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Partner;
        setPartner(data);
        setIsOnline(data.isOnline);
      } else {
        const currentProfile = profileRef.current;
        const initialPartner: any = {
          name: currentProfile?.displayName || currentProfile?.fullName || 'Partner',
          phone: (currentProfile as any)?.phoneNumber || '',
          vehicleType: (currentProfile as any)?.vehicleType || 'pikipiki',
          isOnline: false,
          earnings: { today: 0, week: 0, total: 0 },
          activeParcelIds: [],
          location: { lat: -6.7924, lng: 39.2083, updatedAt: serverTimestamp() }
        };
        setDoc(doc(db, 'partners', user.uid), initialPartner);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const toggleOnline = async () => {
    if (!user) return;
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    await updateDoc(doc(db, 'partners', user.uid), {
      isOnline: nextStatus,
      lastOnlineAt: serverTimestamp()
    });
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-[#0a0a0f] transition-colors">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between border-b border-black/10 dark:border-white/5 bg-white dark:bg-[#0a0a0f] shadow-sm relative z-20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
            {profile?.photoURL ? (
                <img src={profile.photoURL} alt="p" className="w-full h-full object-cover" />
            ) : (
                <User className="text-indigo-600 dark:text-indigo-400 transition-colors" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tighter transition-colors leading-none">Swift Driver</h1>
            <p className="text-[10px] text-neutral-500 dark:text-white/40 font-bold uppercase tracking-widest mt-1">Habari, {profile?.displayName?.split(' ')[0] || 'Dereva'}!</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <motion.button
            onClick={toggleOnline}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border transition-all ${
              isOnline 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
              : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-400 dark:text-white/40'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300 dark:bg-white/20'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </motion.button>
          
          <button 
            onClick={async () => {
                if (window.confirm("Je, unataka kurudi kwenye Dashboard ya Teksi?")) {
                    if (user) await updateDoc(doc(db, 'users', user.uid), { driverType: 'taxi' });
                }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
          >
            <Car className="w-4 h-4 text-orange-500 dark:text-orange-400 transition-colors" />
            <span className="text-[9px] font-black uppercase text-neutral-500 dark:text-white/60">Taxi Mode</span>
          </button>

          <button className="relative p-2">
            <Bell className="w-5 h-5 text-neutral-400 dark:text-white/60 transition-colors" />
            <div className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full border-2 border-white dark:border-[#0a0a0f]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-[#0a0a0f] transition-colors">
        <div className="max-w-[1600px] mx-auto w-full lg:grid lg:grid-cols-[1fr_400px] lg:h-[calc(100vh-73px)] overflow-hidden">
          
          {/* Scrollable Content Area (Mobile: Stacked, Desktop: Sidebar) */}
          <div className="lg:order-2 flex flex-col h-full bg-white dark:bg-[#0a0a0f] border-l border-black/5 dark:border-white/5 overflow-y-auto no-scrollbar">
            
            {/* 1. Main Stats Section */}
            <div className="p-4 sm:p-6 space-y-6 pb-24 lg:pb-6">
               {/* Earnings Grid */}
               <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-100/50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-sm transition-colors group">
                  <p className="text-[10px] uppercase text-neutral-400 dark:text-white/30 font-black mb-1 group-hover:text-pink-500 transition-colors">Leo</p>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-500 dark:text-white/50 font-extrabold">TZS</span>
                    <span className="text-xl font-black text-neutral-900 dark:text-white leading-tight tracking-tighter">
                      {partner?.earnings?.today?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
                <div className="bg-neutral-100/50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 shadow-sm transition-colors group">
                  <p className="text-[10px] uppercase text-neutral-400 dark:text-white/30 font-black mb-1 group-hover:text-indigo-500 transition-colors">Wiki</p>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-500 dark:text-white/50 font-extrabold">TZS</span>
                    <span className="text-xl font-black text-neutral-900 dark:text-white leading-tight tracking-tighter">
                      {partner?.earnings?.week?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 transition-colors group">
                  <p className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-black mb-1">Safari</p>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400 group-hover:translate-y--1 transition-transform" />
                    <span className="text-xl font-black text-indigo-500 leading-tight tracking-tighter">
                      {(partner as any)?.totalDeliveries || '0'}
                    </span>
                  </div>
                </div>
               </div>

               {/* Analytics Grid */}
               <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                 {[
                   { icon: Package, color: '#D4537E', label: 'Zawadi', count: 3 },
                   { icon: FileText, color: '#378ADD', label: 'Nyaraka', count: 5 },
                   { icon: Smartphone, color: '#EF9F27', label: 'Elek', count: 2 },
                   { icon: Box, color: '#888780', label: 'Vifurushi', count: 8 },
                   { icon: Pill, color: '#E24B4A', label: 'Dawa', count: 1 },
                   { icon: Dog, color: '#639922', label: 'Pets', count: 1 }
                 ].map((cat, i) => (
                   <div key={i} className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-3 flex items-center gap-3 shadow-sm hover:border-pink-500/30 transition-all cursor-default">
                     <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: `${cat.color}15` }}>
                       <cat.icon className="w-5 h-5" style={{ color: cat.color }} />
                     </div>
                     <div className="min-w-0">
                       <p className="text-[9px] text-neutral-400 dark:text-white/40 truncate font-black uppercase tracking-widest">{cat.label}</p>
                       <p className="text-base font-black text-neutral-900 dark:text-white leading-none tracking-tighter transition-colors">{cat.count}</p>
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            {/* Online/Offline Large Toggle Control for Desktop/Tablet */}
            <div className="hidden lg:block p-6 mt-auto border-t border-black/5 dark:border-white/5">
               <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleOnline}
                  className={`w-full py-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all ${
                    isOnline 
                    ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20' 
                    : 'bg-neutral-100 dark:bg-white/5 border-2 border-dashed border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-white/40'
                  }`}
               >
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${isOnline ? 'bg-white/20 border-white/40' : 'bg-neutral-200 dark:bg-white/10 border-neutral-300 dark:border-white/10'}`}>
                    <Power size={32} className={isOnline ? 'text-white' : 'text-neutral-400 dark:text-white/20'} />
                 </div>
                 <span className="text-sm font-black uppercase tracking-[0.2em]">
                    {isOnline ? 'UKO MTANDAONI • TAYARI' : 'INGIA MTANDAONI'}
                 </span>
               </motion.button>
            </div>
          </div>

          {/* Map Section (Mobile: Center, Desktop: Left Side) */}
          <div className="lg:order-1 h-[450px] sm:h-[550px] lg:h-full relative overflow-hidden">
            <div className="absolute inset-0 transition-colors">
              <ParcelMapView />
            </div>

            {gpsError && (
              <div className="absolute top-6 left-6 right-6 z-[60] lg:left-12 lg:right-12">
                <div className="max-w-sm mx-auto bg-red-500 text-white p-4 rounded-3xl flex items-center gap-4 shadow-2xl border-2 border-white/20 backdrop-blur-xl">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Hitilafu ya GPS!</p>
                    <p className="text-[11px] font-bold opacity-90 leading-tight">TAFADHALI RUHUSU LOCATION ILI UWEZE KUFANYA KAZI.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Status Overlays */}
            {!isOnline && (
              <div className="absolute inset-x-0 bottom-6 px-6 z-[45] lg:bottom-12 lg:px-12">
                <div className="bg-white/95 dark:bg-[#111118]/95 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-[2.5rem] p-8 text-center shadow-2xl max-w-sm mx-auto">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center mx-auto mb-6">
                      <Power className="w-8 h-8 text-neutral-400 dark:text-white/30 transition-colors" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 text-neutral-900 dark:text-white uppercase tracking-tighter italic">Uko Offline!</h3>
                  <p className="text-xs text-neutral-500 dark:text-white/40 mb-8 px-4 font-bold uppercase tracking-widest leading-relaxed">
                    Ungana na seva ili kuanza kupokea oda za usafirishaji katika eneo lako.
                  </p>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleOnline}
                    className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black font-black py-5 rounded-2xl shadow-2xl shadow-neutral-950/20 dark:shadow-white/10 uppercase tracking-[0.2em] text-[10px] transition-all"
                  >
                    BONYEZA KUANZA ⚡️
                  </motion.button>
                </div>
              </div>
            )}

            {isOnline && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[50]">
                 <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-emerald-500 text-white text-[10px] font-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 uppercase tracking-[0.2em] border-2 border-white/30 backdrop-blur-md"
                 >
                   <div className="flex gap-1">
                     <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                     <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse" />
                   </div>
                   UNAPOKEA MAOMBI • LIVE 🚀
                 </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default PartnerDashboard;
