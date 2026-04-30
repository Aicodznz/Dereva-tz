import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, MapPin, TrendingUp, Package, FileText, Smartphone, Box, Pill, Dog, Power, User, Car } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Partner } from '../../../types/parcel';
import CategoryBadge from './CategoryBadge';
import ParcelMapView from './ParcelMapView';

const PartnerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
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
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
            {profile?.photoURL ? (
                <img src={profile.photoURL} alt="p" className="w-full h-full object-cover" />
            ) : (
                <User className="text-indigo-400" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90">SwiftApp Parcel</h1>
            <p className="text-xs text-white/40">Habari, {profile?.displayName?.split(' ')[0] || 'Juma'}!</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <motion.button
            onClick={toggleOnline}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
              isOnline 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
              : 'bg-white/5 border-white/10 text-white/40'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
            <span className="text-xs font-bold uppercase tracking-wider">
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </motion.button>
          
          <button 
            onClick={async () => {
                if (window.confirm("Je, unataka kurudi kwenye Dashboard ya Teksi?")) {
                    await updateDoc(doc(db, 'users', user.uid), { driverType: 'taxi' });
                }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Car className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-black uppercase text-white/60">Taxi Mode</span>
          </button>

          <button className="relative">
            <Bell className="w-5 h-5 text-white/60" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 rounded-full" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Earnings Summary */}
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[10px] uppercase text-white/30 font-bold mb-1">Leo</p>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/50">TZS</span>
              <span className="text-lg font-bold text-white/90 leading-tight">
                {partner?.earnings?.today?.toLocaleString() || '0'}
              </span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[10px] uppercase text-white/30 font-bold mb-1">Wiki</p>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/50">TZS</span>
              <span className="text-lg font-bold text-white/90 leading-tight">
                {partner?.earnings?.week?.toLocaleString() || '0'}
              </span>
            </div>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3">
            <p className="text-[10px] uppercase text-indigo-400/70 font-bold mb-1">Safari</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span className="text-lg font-bold text-indigo-400 leading-tight">
                {(partner as any)?.totalDeliveries || '0'}
              </span>
            </div>
          </div>
        </div>

        {/* Category Stats */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Package, color: '#D4537E', label: 'Gifts', count: 3 },
              { icon: FileText, color: '#378ADD', label: 'Docs', count: 5 },
              { icon: Smartphone, color: '#EF9F27', label: 'Elec', count: 2 },
              { icon: Box, color: '#888780', label: 'Package', count: 8 },
              { icon: Pill, color: '#E24B4A', label: 'Meds', count: 1 },
              { icon: Dog, color: '#639922', label: 'Pet', count: 1 }
            ].map((cat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                  <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <div>
                  <p className="text-[10px] text-white/40">{cat.label}</p>
                  <p className="text-sm font-bold text-white/90 leading-none">{cat.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map Section */}
        <div className="px-4 h-[400px] relative">
          <div className="absolute inset-0 mx-4 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
            <ParcelMapView />
          </div>
          
          {/* Status Overlay */}
          {!isOnline && (
            <div className="absolute inset-x-0 bottom-4 px-8 z-[50]">
              <div className="bg-[#111118]/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Power className="w-8 h-8 text-white/20" />
                </div>
                <h3 className="text-lg font-bold mb-1">Uko Offline</h3>
                <p className="text-sm text-white/40 mb-6 px-4">Anza kuingia mtandaoni ili uanze kupokea maombi ya kazi leo.</p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleOnline}
                  className="w-full bg-white text-black font-bold py-4 rounded-xl"
                >
                  BONYEZA KUANZA
                </motion.button>
              </div>
            </div>
          )}

          {isOnline && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[50]">
               <div className="bg-emerald-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                 UNAPOKEA MAOMBI
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
