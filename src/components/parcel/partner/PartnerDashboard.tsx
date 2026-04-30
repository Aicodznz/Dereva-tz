import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, MapPin, TrendingUp, Package, FileText, Smartphone, Box, Pill, Dog, Power, User, Car } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Partner } from '../../../types/parcel';
import CategoryBadge from './CategoryBadge';
import ParcelMapView from './ParcelMapView';
import { useTheme } from 'next-themes';

const PartnerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isOnline, setIsOnline] = useState(false);

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
                    await updateDoc(doc(db, 'users', user.uid), { driverType: 'taxi' });
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

      <div className="flex-1 overflow-y-auto pb-24 bg-neutral-50 dark:bg-[#0a0a0f] transition-colors">
        {/* Earnings Summary */}
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-3 shadow-sm transition-colors">
            <p className="text-[10px] uppercase text-neutral-400 dark:text-white/30 font-black mb-1">Leo</p>
            <div className="flex flex-col">
              <span className="text-[9px] text-neutral-500 dark:text-white/50 font-bold">TZS</span>
              <span className="text-lg font-black text-neutral-900 dark:text-white leading-tight tracking-tighter">
                {partner?.earnings?.today?.toLocaleString() || '0'}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-3 shadow-sm transition-colors">
            <p className="text-[10px] uppercase text-neutral-400 dark:text-white/30 font-black mb-1">Wiki</p>
            <div className="flex flex-col">
              <span className="text-[9px] text-neutral-500 dark:text-white/50 font-bold">TZS</span>
              <span className="text-lg font-black text-neutral-900 dark:text-white leading-tight tracking-tighter">
                {partner?.earnings?.week?.toLocaleString() || '0'}
              </span>
            </div>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 transition-colors">
            <p className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-black mb-1">Safari</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-lg font-black text-indigo-500 leading-tight tracking-tighter">
                {(partner as any)?.totalDeliveries || '0'}
              </span>
            </div>
          </div>
        </div>

        {/* Category Stats */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Package, color: '#D4537E', label: 'Zawadi', count: 3 },
              { icon: FileText, color: '#378ADD', label: 'Nyaraka', count: 5 },
              { icon: Smartphone, color: '#EF9F27', label: 'Elek', count: 2 },
              { icon: Box, color: '#888780', label: 'Vifurushi', count: 8 },
              { icon: Pill, color: '#E24B4A', label: 'Dawa', count: 1 },
              { icon: Dog, color: '#639922', label: 'Pets', count: 1 }
            ].map((cat, i) => (
              <div key={i} className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-2 flex items-center gap-2 shadow-sm transition-colors">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ backgroundColor: `${cat.color}15` }}>
                  <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-neutral-400 dark:text-white/40 truncate font-bold">{cat.label}</p>
                  <p className="text-sm font-black text-neutral-900 dark:text-white leading-none tracking-tighter transition-colors">{cat.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map Section */}
        <div className="w-full h-[55dvh] min-h-[450px] relative mb-12">
          <div className="absolute inset-0 overflow-hidden border-y border-neutral-200 dark:border-white/5 shadow-inner transition-colors">
            <ParcelMapView />
          </div>
          
          {/* Status Overlay */}
          {!isOnline && (
            <div className="absolute inset-x-0 bottom-4 px-8 z-[50]">
              <div className="bg-white/90 dark:bg-[#111118]/90 backdrop-blur-md border border-neutral-200 dark:border-white/10 rounded-2xl p-6 text-center shadow-2xl transition-colors">
                <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4 transition-colors">
                    <Power className="w-6 h-6 text-neutral-300 dark:text-white/20 transition-colors" />
                </div>
                <h3 className="text-lg font-black mb-1 text-neutral-900 dark:text-white uppercase tracking-tighter">Uko Offline</h3>
                <p className="text-[11px] text-neutral-500 dark:text-white/40 mb-6 px-4 font-bold">ANZA KUINGIA MTANDAONI ILI UANZE KUPOKEA MAOMBI YA KAZI LEO.</p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleOnline}
                  className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-xl shadow-xl shadow-neutral-950/20 dark:shadow-white/10 uppercase tracking-widest text-xs transition-colors"
                >
                  BONYEZA KUANZA
                </motion.button>
              </div>
            </div>
          )}

          {isOnline && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[50]">
               <div className="bg-emerald-500 text-white text-[10px] font-black px-5 py-2 rounded-full shadow-lg flex items-center gap-2 uppercase tracking-widest border-2 border-white/20">
                 <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                 UNAPOKEA MAOMBI 🚀
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
