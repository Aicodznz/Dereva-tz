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
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '../LanguageContext';
import MyOrders from './MyOrders';
import Chat from './Chat';
import { storageService } from '../services/storageService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

type ProfileView = 'menu' | 'edit' | 'orders' | 'chat' | 'password' | 'language';

export default function Profile() {
  const { profile, user, logout, updateProfileData, changePassword } = useAuth();
  const { t, language, setLanguage } = useLanguage();
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
    photoURL: profile?.photoURL || ''
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
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
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
            <div className="flex items-center justify-center gap-2 mt-1">
               <Badge className="bg-orange-100 text-orange-600 font-black px-3 py-1 text-[10px] uppercase border-none hover:bg-orange-200">{profile.role}</Badge>
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
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('notifications') || 'Notifications'}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-orange-600 transition-colors" />
                </Link>

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
                    <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-teal-600 transition-colors" />
                  </div>
                </button>
              </div>
            </CardContent>
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
  );
}
