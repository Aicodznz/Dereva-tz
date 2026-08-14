import React, { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  LogOut, 
  Camera, 
  Save, 
  X, 
  Loader2, 
  Trash2,
  ShoppingBag,
  MessageCircle,
  MapPin,
  Lock,
  Globe,
  ChevronRight,
  ChevronLeft,
  Check,
  Bell,
  Star,
  Sun,
  Moon,
  Bike,
  Car,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import MyOrders from './MyOrders';
import Chat from './Chat';
import { storageService } from '../services/storageService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

type ProfileView = 'menu' | 'edit' | 'orders' | 'chat' | 'password' | 'language';

export default function Profile() {
  const { profile, user, logout, updateProfileData, updateRole, changePassword } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<ProfileView>('menu');
  const [loading, setLoading] = useState(false);
  const [orderCount, setOrderCount] = useState({ orders: 0, rides: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real-time order count listener
  React.useEffect(() => {
    if (!user) return;
    
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid)
    );
    
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrderCount(prev => ({ ...prev, orders: snapshot.size }));
    }, (error) => {
      console.error("Error fetching order count:", error);
    });

    const ridesQuery = query(
      collection(db, 'rides'),
      where('customerId', '==', user.uid)
    );

    const unsubRides = onSnapshot(ridesQuery, (snapshot) => {
      setOrderCount(prev => ({ ...prev, rides: snapshot.size }));
    }, (error) => {
      console.error("Error fetching rides count:", error);
    });
    
    return () => {
      unsubOrders();
      unsubRides();
    };
  }, [user]);

  const totalActivityCount = orderCount.orders + orderCount.rides;
  
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    email: profile?.email || '',
    phoneNumber: profile?.phoneNumber || '',
    photoURL: profile?.photoURL || '',
    gender: (profile?.gender as string) || ''
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  if (!profile) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfileData(formData);
      toast.success("Profile updated successfully!");
      setView('menu');
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await changePassword(passwordData.newPassword);
      toast.success("Password updated successfully!");
      setView('menu');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error("Failed to update password: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
    if (view === 'edit') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setLoading(true);
      try {
        const path = storageService.getProfilePath(user.uid, file.name);
        const publicUrl = await storageService.uploadFile('profiles', path, file);
        
        setFormData({ ...formData, photoURL: publicUrl });
        await updateProfileData({ ...formData, photoURL: publicUrl });
        toast.success("Profile photo updated!");
      } catch (error: any) {
        toast.error("Failed to upload photo: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, photoURL: '' });
    toast.info("Picha imeondolewa. Kumbuka kuhifadhi.");
  };

  if (view === 'orders') return <MyOrders onBack={() => setView('menu')} />;
  if (view === 'chat') return <Chat onBack={() => setView('menu')} />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      {/* Top Navigation Bar / Breadcrumb */}
      <div className="flex items-center justify-between pt-4">
        <Link 
          to="/" 
          className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors font-black uppercase text-xs tracking-widest bg-white dark:bg-neutral-900 px-4 py-2.5 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800"
        >
          <ChevronLeft className="w-4 h-4 text-orange-600" />
          <span>Rudi Nyumbani</span>
        </Link>
        
        <div className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider hidden sm:block">
          Wasifu Wa Mtumiaji
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Header Info */}
        <div className="lg:col-span-5 w-full">
          {/* Header Section - ENHANCED BOMBA LOOK */}
          <div className="relative pt-12 pb-8">
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-br from-orange-400 via-orange-600 to-orange-800 rounded-b-[4rem] shadow-xl" />
        
        <div className="relative z-10 px-6">
          <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl rounded-[3rem] p-8 shadow-2xl shadow-orange-900/10 border border-white/50 dark:border-neutral-800 text-center transition-colors">
            <div className="relative inline-block mt-[-5rem] mb-4">
              <div 
                className={`w-32 h-32 rounded-[2.5rem] overflow-hidden border-[6px] border-white dark:border-neutral-900 shadow-2xl mx-auto relative group transition-transform hover:scale-105 active:scale-95 ${view === 'edit' ? 'cursor-pointer' : ''}`}
                onClick={handleImageClick}
              >
                <img 
                  src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {view === 'edit' && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white mb-1" />
                    <span className="text-[10px] text-white font-black uppercase tracking-widest">Badili</span>
                  </div>
                )}
              </div>

              {view === 'edit' && formData.photoURL && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto();
                  }}
                  className="absolute -top-1 -right-1 w-10 h-10 bg-red-500 text-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-white"
                >
                  <Trash2 className="w-5 h-5" />
                </motion.button>
              )}
            </div>
            
            <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase italic">{profile.displayName}</h1>
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
               <Badge className="bg-orange-100 text-orange-600 font-black px-3 py-1 text-[10px] uppercase border-none hover:bg-orange-200">{profile.role}</Badge>
               {profile.gender && (
                 <Badge className={`font-black px-3 py-1 text-[10px] uppercase border-none ${
                   profile.gender === 'female' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                 }`}>
                   {profile.gender === 'female' ? '👩 Mwanamke' : '👨 Mwanaume'}
                 </Badge>
               )}
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </div>

            {/* Stats Bar/Wallet */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
               <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Salio</p>
                  <p className="text-lg font-black text-neutral-900 dark:text-white italic mt-1 leading-none">
                    {profile.walletBalance ? (profile.walletBalance > 1000 ? `${(profile.walletBalance / 1000).toFixed(1)}k` : profile.walletBalance) : '0'}
                  </p>
               </div>
               <div className="border-x border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Points</p>
                  <p className="text-lg font-black text-orange-600 italic mt-1 leading-none">{profile.points || 0}</p>
               </div>
               <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Oda</p>
                  <p className="text-lg font-black text-neutral-900 dark:text-white italic mt-1 leading-none">{totalActivityCount}</p>
               </div>
            </div>

            {/* Driver Role Switcher / Driver Card */}
            {(profile.role === 'rider' || (profile.role as string) === 'driver' || profile.driverType || profile.licensePlate) ? (
              <div className="mt-6 p-4 rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-xl space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bike className="w-5 h-5 text-orange-400" />
                    <span className="font-black text-xs uppercase tracking-wider text-orange-400">Akaunti ya Dereva</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 font-bold text-[9px] uppercase border-none">
                    {profile.approvalStatus || 'Approved'}
                  </Badge>
                </div>

                <div className="text-xs space-y-1 opacity-90 font-mono">
                  <p><strong className="text-neutral-400">Aina:</strong> {profile.driverType === 'delivery' ? 'Kifurushi (Delivery)' : 'Teksi / Bodaboda'}</p>
                  {profile.vehicleType && <p><strong className="text-neutral-400">Chombo:</strong> {profile.vehicleType} {profile.vehicleBrand || ''}</p>}
                  {profile.licensePlate && <p><strong className="text-neutral-400">Namba ya Bamba:</strong> {profile.licensePlate}</p>}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={async () => {
                      if (profile.role !== 'rider') {
                        await updateRole('rider');
                      }
                      navigate('/');
                    }}
                    className="flex-1 h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-600/20"
                  >
                    Ingia Dashboard ya Dereva
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => updateRole('customer')}
                    className="h-10 border-neutral-700 text-neutral-300 hover:bg-neutral-800 rounded-2xl font-bold text-xs"
                  >
                    Badili kuwa Mteja
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 rounded-3xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-orange-600" />
                  <span className="font-black text-xs uppercase tracking-wider text-orange-700 dark:text-orange-400">Unataka Kazi ya Udereva?</span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  Jiunge kama Dereva wa Teksi au Bodaboda wa Papo Hapo ili uanze kupata kipato leo.
                </p>
                <Link to="/register/driver">
                  <Button className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider mt-1">
                    Sajili / Badili kuwa Dereva
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
      </div>

        </div>

      {/* Right Column: Menu & Edit Subviews */}
      <div className="lg:col-span-7 w-full space-y-6">
        {view === 'menu' && (
        <div className="space-y-4">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-neutral-900 transition-colors">
            <CardContent className="p-2">
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                <button 
                  onClick={() => setView('orders')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/20 rounded-xl flex items-center justify-center text-orange-600">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{t('my_orders')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-orange-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('edit')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/20 rounded-xl flex items-center justify-center text-blue-600">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{t('edit_profile')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-blue-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('chat')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-950/20 rounded-xl flex items-center justify-center text-green-600">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{t('chat')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-green-600 transition-colors" />
                </button>

                <Link 
                  to="/notifications"
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/20 rounded-xl flex items-center justify-center text-orange-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{t('notifications') || 'Notifications'}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-orange-600 transition-colors" />
                </Link>

                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                       <span className="font-bold text-neutral-700 dark:text-neutral-200 block">Theme</span>
                       <span className="text-[10px] text-neutral-400 font-bold uppercase">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-orange-600' : 'bg-neutral-200'}`}>
                     <div className={`w-4 h-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </button>

                <button 
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('address')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-purple-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('password')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600">
                      <Lock className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('change_password')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-yellow-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('language')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/20 rounded-xl flex items-center justify-center text-teal-600">
                      <Globe className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{t('change_language')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-400 uppercase">{language === 'en' ? 'English' : 'Kiswahili'}</span>
                    <span className="text-neutral-300">|</span>
                    <Badge className="bg-orange-600/10 text-orange-600 border-none px-2 py-0.5 text-[8px] font-black uppercase">Points: {profile.points || 0}</Badge>
                    <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-teal-600 transition-colors" />
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-gradient-to-br from-orange-600 to-orange-800 text-white p-8 relative group cursor-pointer hover:scale-[1.02] transition-transform">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
               <Star className="w-32 h-32 rotate-12" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-white fill-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Papo Hapo Rewards</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Loyalty Program</p>
                </div>
              </div>
              
              <div className="pt-4 space-y-1">
                 <p className="text-4xl font-black italic tracking-tighter">{profile.points || 0} <span className="text-sm font-bold uppercase not-italic tracking-widest text-white/60 ml-2">Points</span></p>
                 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((profile.points || 0) / 1000) * 100, 100)}%` }}
                      className="h-full bg-white shadow-[0_0_20px_white]"
                    />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Pata points nyingine 240 ili upate vocha ya TZS 5,000</p>
              </div>

              <Button className="w-full h-12 bg-white text-orange-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-100 border-none shadow-xl">
                 Komboa Zawadi
              </Button>
            </div>
          </Card>

          <Button 
            variant="ghost" 
            onClick={logout}
            className="w-full h-14 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700 justify-start px-6 gap-3"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold">{t('sign_out')}</span>
          </Button>
        </div>
      )}

      {view === 'edit' && (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
            <button onClick={() => setView('menu')} className="text-neutral-500 hover:text-neutral-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-orange-600" />
              {t('personal_info')}
            </CardTitle>
            <div className="w-6" /> {/* Spacer */}
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('email')}</label>
                <Input 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('phone')}</label>
                <Input 
                  value={formData.phoneNumber} 
                  onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                  placeholder="e.g. 0712345678"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">Jinsia / Gender</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: 'male' })}
                    className={`h-11 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      formData.gender === 'male'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <span>👨 Mwanaume (Male)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: 'female' })}
                    className={`h-11 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      formData.gender === 'female'
                        ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500'
                        : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <span>👩 Mwanamke (Female)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-xl"
                onClick={() => setView('menu')}
              >
                {t('cancel')}
              </Button>
              <Button 
                className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'password' && (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
            <button onClick={() => setView('menu')} className="text-neutral-500 hover:text-neutral-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-600" />
              {t('change_password')}
            </CardTitle>
            <div className="w-6" />
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('new_password')}</label>
                <Input 
                  type="password"
                  value={passwordData.newPassword} 
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('confirm_password')}</label>
                <Input 
                  type="password"
                  value={passwordData.confirmPassword} 
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
              onClick={handleChangePassword}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('update_password')}
            </Button>
          </CardContent>
        </Card>
      )}

      {view === 'language' && (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
            <button onClick={() => setView('menu')} className="text-neutral-500 hover:text-neutral-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-600" />
              {t('change_language')}
            </CardTitle>
            <div className="w-6" />
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <button 
              onClick={() => {
                setLanguage('en');
                toast.success("Language changed to English");
              }}
              className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                language === 'en' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src="https://flagcdn.com/w40/gb.png" alt="English" className="w-8 rounded-sm shadow-sm" />
                <span className="font-bold text-neutral-800">English</span>
              </div>
              {language === 'en' && <Check className="w-5 h-5 text-orange-600" />}
            </button>

            <button 
              onClick={() => {
                setLanguage('sw');
                toast.success("Lugha imebadilishwa kuwa Kiswahili");
              }}
              className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                language === 'sw' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src="https://flagcdn.com/w40/tz.png" alt="Kiswahili" className="w-8 rounded-sm shadow-sm" />
                <span className="font-bold text-neutral-800">Kiswahili</span>
              </div>
              {language === 'sw' && <Check className="w-5 h-5 text-orange-600" />}
            </button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
    </div>
  );
}
