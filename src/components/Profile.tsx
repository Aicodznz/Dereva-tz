import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Mail, 
  Phone, 
  LogOut, 
  Camera, 
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
  RotateCcw,
  CreditCard,
  Package,
  Truck,
  MessageSquare,
  Clock,
  Heart,
  Ticket,
  Store,
  Coins,
  Gift,
  Sparkles,
  UtensilsCrossed,
  Pill,
  Scissors,
  HelpCircle,
  Headphones,
  Settings,
  Share2,
  Copy,
  Zap,
  Flame,
  Award,
  Wallet,
  X,
  Loader2,
  Printer,
  Compass
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

interface ActiveModal {
  type: 'coupons' | 'daily_coins' | 'game_prize' | 'game_trivia' | 'wallet' | 'bonus' | 'wishlist' | 'settings' | 'help' | null;
}

export default function Profile() {
  const { profile, user, logout, updateProfileData, updateRole, changePassword } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  
  const [view, setView] = useState<ProfileView>('menu');
  const [loading, setLoading] = useState(false);
  const [claimingCoins, setClaimingCoins] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>({ type: null });
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  // Status breakdown for orders
  const [orderStats, setOrderStats] = useState({
    toPay: 0,
    preparing: 0,
    onTheWay: 0,
    toReview: 0,
    returns: 0,
    total: 0
  });

  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trivia Game state
  const [selectedTriviaAnswer, setSelectedTriviaAnswer] = useState<number | null>(null);
  const [triviaWon, setTriviaWon] = useState(false);

  // Real-time order stats listener
  useEffect(() => {
    if (!user) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid)
    );

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      let toPay = 0;
      let preparing = 0;
      let onTheWay = 0;
      let toReview = 0;
      let returns = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const status = data.status;
        const paymentStatus = data.paymentStatus;

        if (paymentStatus === 'pending' || status === 'pending') {
          toPay++;
        }
        if (status === 'accepted' || status === 'preparing' || status === 'prepared') {
          preparing++;
        }
        if (status === 'out_for_delivery') {
          onTheWay++;
        }
        if (status === 'delivered' || status === 'completed') {
          toReview++;
        }
        if (status === 'cancelled') {
          returns++;
        }
      });

      setOrderStats(prev => ({
        ...prev,
        toPay,
        preparing,
        onTheWay,
        toReview,
        returns,
        total: snapshot.size
      }));
    }, (error) => {
      console.error("Error fetching order stats:", error);
    });

    const ridesQuery = query(
      collection(db, 'rides'),
      where('customerId', '==', user.uid)
    );

    const unsubRides = onSnapshot(ridesQuery, (snapshot) => {
      let activeRides = 0;
      snapshot.docs.forEach(doc => {
        const r = doc.data();
        if (r.status === 'requested' || r.status === 'accepted' || r.status === 'arrived' || r.status === 'ongoing') {
          activeRides++;
        }
      });
      setOrderStats(prev => ({
        ...prev,
        onTheWay: prev.onTheWay + activeRides,
        total: prev.total + snapshot.size
      }));
    }, (error) => {
      console.error("Error fetching rides count:", error);
    });

    // Unread notifications listener
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );
    const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
      const unread = snapshot.docs.filter(d => !d.data().read).length;
      if (unread > 0) setUnreadNotifications(unread);
    }, () => {});

    return () => {
      unsubOrders();
      unsubRides();
      unsubNotifs();
    };
  }, [user]);

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

  // Handle Profile Update
  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfileData(formData);
      toast.success(language === 'sw' ? "Wasifu umesasishwa kikamilifu!" : "Profile updated successfully!");
      setView('menu');
    } catch (error) {
      toast.error(language === 'sw' ? "Imeshindwa kusasisha wasifu" : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async () => {
    if (!user) return;
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(language === 'sw' ? "Nenosiri halilingani!" : "Passwords do not match!");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error(language === 'sw' ? "Nenosiri liwe na herufi 6 au zaidi" : "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await changePassword(passwordData.newPassword);
      toast.success(language === 'sw' ? "Nenosiri limebadilishwa!" : "Password updated successfully!");
      setView('menu');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  // Handle Photo Upload
  const handleImageClick = () => {
    fileInputRef.current?.click();
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
        toast.success(language === 'sw' ? "Picha ya wasifu imesasishwa!" : "Profile photo updated!");
      } catch (error: any) {
        toast.error(error.message || "Failed to upload photo");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, photoURL: '' });
    toast.info(language === 'sw' ? "Picha imeondolewa. Bonyeza Hifadhi." : "Photo removed. Remember to save.");
  };

  // Daily coins claim handler
  const handleClaimDailyCoins = async () => {
    if (claimingCoins) return;
    setClaimingCoins(true);
    try {
      const newPoints = (profile.points || 0) + 15;
      await updateProfileData({ points: newPoints });
      toast.success(
        language === 'sw'
          ? "🎉 Hongera! Umepata sarafu +15 za Papo Hapo bure leo!"
          : "🎉 Congrats! You earned +15 free Papo Hapo Coins today!"
      );
      setActiveModal({ type: null });
    } catch {
      toast.error("Imeshindwa kukusanya sarafu, jaribu tena.");
    } finally {
      setClaimingCoins(false);
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    toast.success(language === 'sw' ? `Kuponi ${code} imenakiliwa!` : `Coupon ${code} copied!`);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  // Subview routing
  if (view === 'orders') return <MyOrders onBack={() => setView('menu')} />;
  if (view === 'chat') return <Chat onBack={() => setView('menu')} />;

  // Display name fallback
  const userDisplayName = profile.displayName || profile.fullName || user?.email?.split('@')[0] || 'Mteja';
  const initialLetter = userDisplayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-neutral-100/70 dark:bg-neutral-950 pb-28 text-neutral-900 dark:text-neutral-100 font-sans select-none">
      
      {/* 1. TOP USER HEADER (AliExpress / Temu Style) */}
      <div className="bg-white dark:bg-neutral-900 px-4 pt-3 pb-3 border-b border-neutral-200/70 dark:border-neutral-800 shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between gap-2">
          
          {/* User Avatar + Display Name */}
          <div 
            onClick={() => setView('edit')}
            className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
          >
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-orange-600 via-amber-500 to-red-600 p-[2px] shadow-sm group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-neutral-800 flex items-center justify-center">
                  {profile.photoURL ? (
                    <img 
                      src={profile.photoURL} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white font-black text-xl">
                      {initialLetter}
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-black tracking-tight truncate text-neutral-900 dark:text-white capitalize">
                  {userDisplayName}
                </h1>
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded-md shrink-0">
                  {profile.role === 'rider' ? 'Dereva' : 'VIP'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {profile.phoneNumber || profile.email || 'Papo Hapo Super App'}
              </p>
            </div>
          </div>

          {/* Right Header Controls: Flag, Settings Cog, Bell with Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Country Flag (Tanzania) with Language Toggle */}
            <button
              onClick={() => setActiveModal({ type: 'settings' })}
              title="Tanzania / Swahili"
              className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 hover:scale-105 active:scale-95 transition-transform"
            >
              <img 
                src="https://flagcdn.com/w40/tz.png" 
                alt="Tanzania Flag" 
                className="w-full h-full object-cover"
              />
            </button>

            {/* Settings Cog */}
            <button
              onClick={() => setActiveModal({ type: 'settings' })}
              title="Mipangilio / Settings"
              className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Notification Bell with Badge */}
            <Link
              to="/notifications"
              title="Taarifa / Notifications"
              className="w-9 h-9 rounded-full flex items-center justify-center relative text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-sm">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
          </div>

        </div>
      </div>

      {/* 2. PROMOTIONAL TICKER / BANNER (Spring Sale / Super Sale) */}
      <div 
        onClick={() => setActiveModal({ type: 'coupons' })}
        className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200/60 dark:border-neutral-800 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-orange-50/50 dark:hover:bg-neutral-800/60 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black text-[11px] sm:text-xs tracking-wider text-neutral-900 dark:text-white uppercase bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">
            SUPER SALE
          </span>
          <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
            {language === 'sw' ? 'Ofa za Usafiri & Chakula: Pata hadi 20% Punguzo!' : 'Ends: Leo 23:59 EAT'}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
      </div>

      <div className="p-3.5 space-y-3.5">
        
        {/* 3. "MY ORDERS" SECTION (Exact match to uploaded layout) */}
        <Card className="border-none shadow-sm rounded-2xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardContent className="p-4 space-y-4">
            
            {/* Header: Title & View All */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
                {language === 'sw' ? 'Oda na Safari Zangu' : 'My orders'}
              </h2>
              <button 
                onClick={() => setView('orders')}
                className="text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-500 flex items-center gap-1 transition-colors"
              >
                <span>{language === 'sw' ? 'Tazama zote' : 'View all'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 5 Status Steps: To Pay, In Prep, On The Way, To Review, Returns */}
            <div className="grid grid-cols-5 gap-1 pt-1 text-center">
              
              {/* To pay */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <CreditCard className="w-6 h-6 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  {orderStats.toPay > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {orderStats.toPay}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Ya Kulipa' : 'To pay'}
                </span>
              </button>

              {/* In Prep (To ship) */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <Package className="w-6 h-6 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  {orderStats.preparing > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-orange-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {orderStats.preparing}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Jikoni/Duka' : 'To ship'}
                </span>
              </button>

              {/* Shipped (On the way) */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <Truck className="w-6 h-6 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  {orderStats.onTheWay > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                      {orderStats.onTheWay}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Safarini' : 'Shipped'}
                </span>
              </button>

              {/* To review */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <MessageSquare className="w-6 h-6 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  {orderStats.toReview > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {orderStats.toReview}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Tathmini' : 'To review'}
                </span>
              </button>

              {/* Returns / Msaada */}
              <button 
                onClick={() => setView('chat')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <RotateCcw className="w-6 h-6 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  {orderStats.returns > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-neutral-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {orderStats.returns}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Msaada' : 'Returns'}
                </span>
              </button>

            </div>

            {/* Secondary Row: History, Wishlist, Coupons, Followed Stores */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center">
              
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
              >
                <Clock className="w-5 h-5 text-neutral-700 dark:text-neutral-300 stroke-[1.75]" />
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Historia' : 'History'}
                </span>
              </button>

              <button 
                onClick={() => setActiveModal({ type: 'wishlist' })}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
              >
                <Heart className="w-5 h-5 text-neutral-700 dark:text-neutral-300 stroke-[1.75]" />
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Vipendwa' : 'Wishlist'}
                </span>
              </button>

              <button 
                onClick={() => setActiveModal({ type: 'coupons' })}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
              >
                <Ticket className="w-5 h-5 text-neutral-700 dark:text-neutral-300 stroke-[1.75]" />
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Kuponi' : 'Coupons'}
                </span>
              </button>

              <button 
                onClick={() => navigate('/services')}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
              >
                <Store className="w-5 h-5 text-neutral-700 dark:text-neutral-300 stroke-[1.75]" />
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Maduka' : 'Followed stores'}
                </span>
              </button>

            </div>

          </CardContent>
        </Card>

        {/* 4. HERO GAMIFICATION / SAVINGS BANNER ("Stack coins & coupons for more savings") */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md p-4 cursor-pointer"
          onClick={() => setActiveModal({ type: 'daily_coins' })}
        >
          {/* Background Decorative Circles */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight drop-shadow-sm">
                  {language === 'sw' ? 'Kusanya Sarafu na Vocha' : 'Stack coins & coupons for more savings'}
                </h3>
                <p className="text-xs text-white/80 font-medium">
                  {language === 'sw' ? 'Sarafu zako:' : 'Your balance:'} <strong className="text-amber-300 font-black">{profile.points || 0} Papo Coins</strong> (≈ TZS {((profile.points || 0) * 10).toLocaleString()})
                </p>
              </div>

              <div>
                <Button 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClaimDailyCoins();
                  }}
                  className="h-8 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs px-4 rounded-xl shadow-md border-none"
                >
                  {claimingCoins ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (language === 'sw' ? 'Chukua Sasa' : 'Get now')}
                </Button>
              </div>
            </div>

            {/* 3D Coin Badge & Indicator */}
            <div className="flex flex-col items-end shrink-0 gap-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-300/20 rounded-2xl flex items-center justify-center p-1 border border-white/20 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-inner text-amber-950">
                  <Coins className="w-7 h-7" />
                </div>
              </div>
              <span className="text-[10px] text-white/70 font-black px-1.5 py-0.5 bg-black/20 rounded-full">
                2 / 2
              </span>
            </div>
          </div>
        </motion.div>

        {/* 5. 2-COLUMN SPLIT CARDS (Bundle Deals & Coins +10) */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Bundle Deals */}
          <div 
            onClick={() => navigate('/services')}
            className="bg-amber-50/80 dark:bg-neutral-900 border border-amber-200/50 dark:border-neutral-800 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-sm transition-all"
          >
            <div>
              <h4 className="font-black text-sm text-neutral-900 dark:text-white">
                {language === 'sw' ? 'Ofa za Vifurushi' : 'Bundle deals'}
              </h4>
              <p className="text-[11px] text-red-600 dark:text-red-400 font-bold mt-0.5">
                {language === 'sw' ? 'Bei ya Jumla' : 'Hot sale'}
              </p>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2">
              <Button 
                size="sm"
                className="h-7 bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-900 dark:text-white font-black text-[10px] px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-none"
              >
                {language === 'sw' ? 'Nunua sasa' : 'Shop now'}
              </Button>
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-orange-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Coins +10 */}
          <div 
            onClick={() => handleClaimDailyCoins()}
            className="bg-amber-50/80 dark:bg-neutral-900 border border-amber-200/50 dark:border-neutral-800 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-sm transition-all"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-black text-sm text-neutral-900 dark:text-white">
                  {language === 'sw' ? 'Sarafu' : 'Coins'}
                </h4>
                <span className="bg-amber-400 text-neutral-950 font-black text-[9px] px-1.5 py-0.2 rounded">
                  +10
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5 truncate">
                {language === 'sw' ? 'Kusanya bure' : 'Get more coins'}
              </p>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2">
              <Button 
                size="sm"
                className="h-7 bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-900 dark:text-white font-black text-[10px] px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-none"
              >
                {language === 'sw' ? 'Kusanya' : 'Collect'}
              </Button>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </div>

        </div>

        {/* 6. GAMIFIED PERKS ROW (Prize Land, Play & Earn, Merge Boss, GoGo Match) */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-3.5 shadow-sm">
          <div className="grid grid-cols-4 gap-2 text-center">
            
            {/* Prize Land */}
            <button 
              onClick={() => setActiveModal({ type: 'game_prize' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
            >
              <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 shadow-sm">
                <Gift className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">
                {language === 'sw' ? 'Zawadi Papo' : 'Prize Land'}
              </span>
            </button>

            {/* Play & Earn */}
            <button 
              onClick={() => setActiveModal({ type: 'game_trivia' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 shadow-sm">
                <Zap className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">
                {language === 'sw' ? 'Jibu & Pata' : 'Play & Earn'}
              </span>
            </button>

            {/* Merge Boss / Ride Perks */}
            <button 
              onClick={() => navigate('/taxi')}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
            >
              <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 shadow-sm">
                <Award className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">
                {language === 'sw' ? 'Bonasi Safari' : 'Ride Perks'}
              </span>
            </button>

            {/* GoGo Match */}
            <button 
              onClick={() => setActiveModal({ type: 'coupons' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95"
            >
              <div className="w-11 h-11 rounded-2xl bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center text-pink-600 shadow-sm">
                <Flame className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">
                {language === 'sw' ? 'Bahati Papo' : 'GoGo Match'}
              </span>
            </button>

          </div>
        </div>

        {/* 7. PAPO HAPO SUPER APP SERVICES HUB (Explicitly answering the user prompt) */}
        <Card className="border-none shadow-sm rounded-2xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardContent className="p-4 space-y-3.5">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
                  {language === 'sw' ? 'Huduma za Papo Hapo' : 'Papo Hapo Super App Services'}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {language === 'sw' ? 'Huduma zote kiganjani mwako' : 'All daily on-demand services'}
                </p>
              </div>
              <Link 
                to="/services" 
                className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1"
              >
                <span>{language === 'sw' ? 'Zote' : 'All'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-2.5 pt-1">
              
              {/* 1. Usafiri / Taxi & Boda */}
              <Link
                to="/taxi"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-orange-50/50 dark:bg-neutral-800/60 hover:bg-orange-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Car className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Teksi & Boda' : 'Taxi & Rides'}
                </span>
              </Link>

              {/* 2. Chakula / Food Delivery */}
              <Link
                to="/"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-amber-50/50 dark:bg-neutral-800/60 hover:bg-amber-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Chakula' : 'Food'}
                </span>
              </Link>

              {/* 3. Supermarket & Mboga */}
              <Link
                to="/"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-emerald-50/50 dark:bg-neutral-800/60 hover:bg-emerald-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Supermarket' : 'Grocery'}
                </span>
              </Link>

              {/* 4. Vifurushi & Mizigo */}
              <Link
                to="/service/vifurushi"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-blue-50/50 dark:bg-neutral-800/60 hover:bg-blue-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Vifurushi' : 'Courier'}
                </span>
              </Link>

              {/* 5. Dawa / Pharmacy */}
              <Link
                to="/"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-red-50/50 dark:bg-neutral-800/60 hover:bg-red-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Pill className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Dawa' : 'Pharmacy'}
                </span>
              </Link>

              {/* 6. Saluni & Urembo */}
              <Link
                to="/services"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-purple-50/50 dark:bg-neutral-800/60 hover:bg-purple-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Scissors className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Saluni' : 'Salon'}
                </span>
              </Link>

              {/* 7. Kukodisha Magari */}
              <Link
                to="/car-rental"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-sky-50/50 dark:bg-neutral-800/60 hover:bg-sky-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Kodi Gari' : 'Car Rental'}
                </span>
              </Link>

              {/* 8. Print & Nyaraka */}
              <Link
                to="/print"
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-teal-50/50 dark:bg-neutral-800/60 hover:bg-teal-100/50 dark:hover:bg-neutral-800 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Print' : 'Print'}
                </span>
              </Link>

            </div>

          </CardContent>
        </Card>

        {/* 8. DRIVER ACCOUNT / UPGRADE BANNER */}
        {(profile.role === 'rider' || (profile.role as string) === 'driver' || profile.driverType || profile.licensePlate) ? (
          <div className="p-4 rounded-2xl bg-neutral-900 text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-orange-400" />
                <span className="font-black text-xs uppercase tracking-wider text-orange-400">
                  {language === 'sw' ? 'Akaunti ya Dereva' : 'Driver Account'}
                </span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 font-bold text-[9px] uppercase border-none">
                {profile.approvalStatus || 'Approved'}
              </Badge>
            </div>

            <div className="text-xs space-y-1 opacity-90 font-mono">
              <p><strong className="text-neutral-400">Chombo:</strong> {profile.vehicleType || 'Bodaboda / Taxi'} {profile.vehicleBrand || ''}</p>
              {profile.licensePlate && <p><strong className="text-neutral-400">Namba ya Bamba:</strong> {profile.licensePlate}</p>}
            </div>

            <div className="pt-1 flex gap-2">
              <Button 
                onClick={async () => {
                  if (profile.role !== 'rider') {
                    await updateRole('rider');
                  }
                  navigate('/');
                }}
                className="flex-1 h-9 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase"
              >
                {language === 'sw' ? 'Ingia Dashboard ya Dereva' : 'Go to Driver Mode'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-600/10 border border-orange-200 dark:border-orange-900/50 flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <h4 className="font-black text-xs uppercase tracking-wider text-orange-700 dark:text-orange-400">
                {language === 'sw' ? 'Unataka Kazi ya Udereva?' : 'Drive with Papo Hapo'}
              </h4>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                {language === 'sw' ? 'Sajili pikipiki, bajaji au teksi upate kipato kila siku.' : 'Earn money by driving passengers and deliveries.'}
              </p>
            </div>
            <Link to="/register/driver" className="shrink-0">
              <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-sm">
                {language === 'sw' ? 'Sajili' : 'Register'}
              </Button>
            </Link>
          </div>
        )}

        {/* 9. BOTTOM UTILITY ICONS BAR (Payment, Bonus, Shopping credits, Perks, Help Center) */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-5 gap-1 text-center">
            
            {/* Payment */}
            <button 
              onClick={() => setActiveModal({ type: 'wallet' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <Wallet className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                {language === 'sw' ? 'Malipo' : 'Payment'}
              </span>
            </button>

            {/* Bonus */}
            <button 
              onClick={() => setActiveModal({ type: 'bonus' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <Coins className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                {language === 'sw' ? 'Bonasi' : 'Bonus'}
              </span>
            </button>

            {/* Shopping credits */}
            <button 
              onClick={() => setActiveModal({ type: 'wallet' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <CreditCard className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                {language === 'sw' ? 'Salio' : 'Credits'}
              </span>
            </button>

            {/* Perks */}
            <button 
              onClick={() => setActiveModal({ type: 'coupons' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <Award className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                {language === 'sw' ? 'Faida' : 'Perks'}
              </span>
            </button>

            {/* Help Center */}
            <button 
              onClick={() => setActiveModal({ type: 'help' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <Headphones className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                {language === 'sw' ? 'Msaada' : 'Help'}
              </span>
            </button>

          </div>
        </div>

      </div>

      {/* Hidden file input for profile photo */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      {/* ========================================================================= */}
      {/* MODALS & BOTTOM SHEETS */}
      {/* ========================================================================= */}

      {/* 1. SETTINGS / EDIT PROFILE MODAL */}
      <AnimatePresence>
        {activeModal.type === 'settings' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-600" />
                  <h3 className="font-black text-base text-neutral-900 dark:text-white">
                    {language === 'sw' ? 'Mipangilio ya Akaunti' : 'Account Settings'}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveModal({ type: null })}
                  className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photo & Basic Details */}
              <div className="flex items-center gap-4 py-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-orange-500 bg-neutral-100 dark:bg-neutral-800">
                    <img 
                      src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button 
                    onClick={handleImageClick}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center shadow"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="font-black text-sm text-neutral-900 dark:text-white">{userDisplayName}</p>
                  <p className="text-xs text-neutral-500">{profile.email}</p>
                  <button 
                    onClick={handleImageClick}
                    className="text-xs text-orange-600 font-bold hover:underline"
                  >
                    {language === 'sw' ? 'Badili Picha' : 'Change Photo'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                
                {/* Edit Profile Form Trigger */}
                <button
                  onClick={() => {
                    setActiveModal({ type: null });
                    setView('edit');
                  }}
                  className="w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 hover:bg-neutral-100 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-xs">{language === 'sw' ? 'Badili Wasifu & Maelezo' : 'Edit Profile Info'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                {/* Change Password */}
                <button
                  onClick={() => {
                    setActiveModal({ type: null });
                    setView('password');
                  }}
                  className="w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 hover:bg-neutral-100 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-xs">{language === 'sw' ? 'Badili Nenosiri' : 'Change Password'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                {/* Dark/Light Mode */}
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                    <span className="font-bold text-xs">{language === 'sw' ? 'Muonekano (Theme)' : 'Theme Mode'}</span>
                  </div>
                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="text-xs font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-lg"
                  >
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </button>
                </div>

                {/* Language Switch */}
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-teal-600" />
                    <span className="font-bold text-xs">{language === 'sw' ? 'Lugha (Language)' : 'Language'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => {
                        setLanguage('sw');
                        toast.success("Lugha imewekwa Kiswahili");
                      }}
                      className={`text-xs font-black px-2.5 py-1 rounded-lg ${language === 'sw' ? 'bg-orange-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                    >
                      Swahili
                    </button>
                    <button 
                      onClick={() => {
                        setLanguage('en');
                        toast.success("Language set to English");
                      }}
                      className={`text-xs font-black px-2.5 py-1 rounded-lg ${language === 'en' ? 'bg-orange-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Sign Out */}
                <Button 
                  variant="ghost" 
                  onClick={logout}
                  className="w-full h-11 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-xs rounded-xl justify-center gap-2 mt-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'sw' ? 'Ondoka (Sign Out)' : 'Sign Out'}</span>
                </Button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. COUPONS MODAL */}
      <AnimatePresence>
        {activeModal.type === 'coupons' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-orange-600" />
                  <h3 className="font-black text-base text-neutral-900 dark:text-white">
                    {language === 'sw' ? 'Vocha na Kuponi za Papo Hapo' : 'Papo Hapo Vouchers'}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveModal({ type: null })}
                  className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { code: 'PAPO20', desc: 'Punguzo la 20% kwenye Safari ya Teksi au Boda', tag: 'Usafiri' },
                  { code: 'CHAKULA5K', desc: 'Punguzo la TZS 5,000 unapoagiza chakula kuanzia TZS 20,000', tag: 'Chakula' },
                  { code: 'BODABODA', desc: 'Delivery ya bure kwa agizo la kwanza la vifurushi', tag: 'Vifurushi' },
                  { code: 'SUPERDISCOUNT', desc: 'Punguzo la 15% kwenye Supermarket na Dawa', tag: 'Manunuzi' }
                ].map(coupon => (
                  <div 
                    key={coupon.code}
                    className="p-3.5 rounded-2xl border border-dashed border-orange-300 dark:border-orange-800/80 bg-orange-50/40 dark:bg-orange-950/20 flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-orange-600 dark:text-orange-400 font-mono tracking-wider">{coupon.code}</span>
                        <span className="text-[9px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.2 rounded">
                          {coupon.tag}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">{coupon.desc}</p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => copyCouponCode(coupon.code)}
                      className="h-8 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shrink-0"
                    >
                      {copiedCoupon === coupon.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. DAILY COINS / REWARDS MODAL */}
      <AnimatePresence>
        {activeModal.type === 'daily_coins' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 mx-auto flex items-center justify-center shadow-lg text-amber-950">
                <Coins className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                  {language === 'sw' ? 'Kusanya Sarafu za Bure!' : 'Daily Free Coins!'}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {language === 'sw' 
                    ? 'Kila siku unapofungua Papo Hapo Super App unapata sarafu za kubadilisha na punguzo.' 
                    : 'Claim coins every day to convert into discount vouchers on rides and foods.'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 font-bold text-xs">
                Salio lako sasa: <strong>{profile.points || 0} Coins</strong>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline"
                  onClick={() => setActiveModal({ type: null })}
                  className="flex-1 h-11 rounded-xl"
                >
                  Funga
                </Button>
                <Button 
                  onClick={handleClaimDailyCoins}
                  disabled={claimingCoins}
                  className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl"
                >
                  {claimingCoins ? <Loader2 className="w-4 h-4 animate-spin" /> : '+15 Coins'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. GAME TRIVIA MODAL (Play & Earn) */}
      <AnimatePresence>
        {activeModal.type === 'game_trivia' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 space-y-4 shadow-2xl text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-base text-neutral-900 dark:text-white">
                  {language === 'sw' ? 'Swali la Papo Hapo' : 'Papo Hapo Quick Trivia'}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  {language === 'sw' 
                    ? 'Jibu kwa usahihi ujishindie kuponi ya punguzo ya TZS 2,000 ya chakula au usafiri!' 
                    : 'Answer correctly to win an instant TZS 2,000 coupon!'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 text-left font-bold text-xs">
                {language === 'sw' 
                  ? 'Swali: Papo Hapo Super App inakuruhusu kuagiza huduma gani?' 
                  : 'Question: Which services can you request on Papo Hapo?'}
              </div>

              <div className="space-y-2">
                {[
                  { id: 1, label: language === 'sw' ? 'Teksi na Bodaboda pekee' : 'Taxi only', correct: false },
                  { id: 2, label: language === 'sw' ? 'Teksi, Chakula, Supermarket, Vifurushi & Dawa' : 'Taxi, Food, Groceries, Courier & Pharmacy', correct: true },
                  { id: 3, label: language === 'sw' ? 'Hakuna huduma' : 'None of the above', correct: false }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedTriviaAnswer(opt.id);
                      if (opt.correct) {
                        setTriviaWon(true);
                        toast.success("Hongera! Jibu lako ni sahihi! Tumekupa kuponi: PAPOWIN");
                      } else {
                        toast.error("Jaribu tena!");
                      }
                    }}
                    className={`w-full p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      selectedTriviaAnswer === opt.id 
                        ? (opt.correct ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 border-red-500 text-red-700')
                        : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <Button 
                onClick={() => {
                  setActiveModal({ type: null });
                  setSelectedTriviaAnswer(null);
                  setTriviaWon(false);
                }}
                className="w-full h-10 bg-neutral-900 text-white dark:bg-neutral-800 rounded-xl font-bold text-xs"
              >
                Funga
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. PRIZE LAND (Mystery Gift Box) */}
      <AnimatePresence>
        {activeModal.type === 'game_prize' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 space-y-4 shadow-2xl text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <Gift className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-base text-neutral-900 dark:text-white">
                  {language === 'sw' ? 'Sanduku la Zawadi' : 'Mystery Prize Box'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {language === 'sw' 
                    ? 'Fungua sanduku la zawadi leo kupata punguzo la safari au chakula.' 
                    : 'Open your daily lucky box for instant discounts.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md space-y-1">
                <span className="text-xs uppercase font-bold tracking-widest text-amber-100">Zawadi Yako</span>
                <p className="text-xl font-black">🎁 TZS 3,000 Vocha</p>
                <p className="text-[10px] text-white/80">Kuponi: PRIZE3K</p>
              </div>

              <Button 
                onClick={() => {
                  copyCouponCode('PRIZE3K');
                  setActiveModal({ type: null });
                }}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs"
              >
                {language === 'sw' ? 'Nakili Kuponi & Tumia' : 'Copy Coupon & Use'}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. WALLET / SALIO MODAL */}
      <AnimatePresence>
        {activeModal.type === 'wallet' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-orange-600" />
                  <h3 className="font-black text-base text-neutral-900 dark:text-white">
                    {language === 'sw' ? 'Pochi ya Papo Hapo' : 'Papo Hapo Wallet'}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveModal({ type: null })}
                  className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3">
                <div className="flex justify-between items-center text-xs opacity-70 font-mono">
                  <span>Papo Hapo Card</span>
                  <span>M-Pesa / TigoPesa</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Salio Lako</span>
                  <p className="text-2xl font-black tracking-tight text-amber-400 font-mono">
                    TZS {(profile.walletBalance || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10">
                  <span className="opacity-80">{userDisplayName}</span>
                  <span className="text-amber-400 font-bold">{profile.points || 0} Points</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  {language === 'sw' ? 'Njia za Kuweka Salio' : 'Top Up Options'}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-orange-500 cursor-pointer">
                    M-Pesa
                  </div>
                  <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-orange-500 cursor-pointer">
                    Tigo Pesa
                  </div>
                  <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-orange-500 cursor-pointer">
                    Airtel Money
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => {
                  toast.success(language === 'sw' ? "Lango la malipo linafunguka..." : "Opening payment gateway...");
                  setActiveModal({ type: null });
                }}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs"
              >
                {language === 'sw' ? 'Weka Salio Kwenye Pochi' : 'Top Up Wallet'}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. HELP / CUSTOMER CARE MODAL */}
      <AnimatePresence>
        {activeModal.type === 'help' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-orange-600" />
                  <h3 className="font-black text-base text-neutral-900 dark:text-white">
                    {language === 'sw' ? 'Kituo cha Msaada' : 'Customer Help Center'}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveModal({ type: null })}
                  className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setActiveModal({ type: null });
                    setView('chat');
                  }}
                  className="w-full p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-bold text-xs text-neutral-900 dark:text-white">Chat ya Moja kwa Moja (Live Chat)</p>
                      <p className="text-[11px] text-neutral-500">Mhudumu anapatikana masaa 24/7</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                <a
                  href="https://wa.me/255712345678"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full p-3.5 rounded-2xl bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-800/60 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-bold text-xs text-neutral-900 dark:text-white">Msaada wa WhatsApp</p>
                      <p className="text-[11px] text-neutral-500">Tuma ujumbe haraka kwa msaada wa haraka</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </a>

                <a
                  href="tel:+255712345678"
                  className="w-full p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-bold text-xs text-neutral-900 dark:text-white">Piga Simu Moja kwa Moja</p>
                      <p className="text-[11px] text-neutral-500">0712 345 678 (Toll Free)</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. WISHLIST MODAL */}
      <AnimatePresence>
        {activeModal.type === 'wishlist' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-base text-neutral-900 dark:text-white">
                  {language === 'sw' ? 'Vipendwa Vyako' : 'Your Wishlist'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {language === 'sw' 
                    ? 'Migahawa na vyakula ulivyohifadhi viko salama hapa kwa kuagiza haraka.' 
                    : 'Your saved favorite meals, drivers, and stores.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                ❤️ Migahawa 3 & Madereva 2 wamehifadhiwa
              </div>

              <Button 
                onClick={() => {
                  setActiveModal({ type: null });
                  navigate('/');
                }}
                className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs"
              >
                {language === 'sw' ? 'Agiza Sasa' : 'Browse & Order'}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. BONUS & CASHBACK MODAL */}
      <AnimatePresence>
        {activeModal.type === 'bonus' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Coins className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-base text-neutral-900 dark:text-white">
                  {language === 'sw' ? 'Bonasi & Mwaliko' : 'Bonus & Referral'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {language === 'sw' 
                    ? 'Mwalike rafiki yako ajiunge na Papo Hapo Super App na ujishindie TZS 2,500 kwa kila mmoja!' 
                    : 'Invite friends to Papo Hapo and earn TZS 2,500 on their first trip or order!'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 font-mono text-sm font-black text-amber-700 dark:text-amber-300">
                Msimbo: PAPO-{user?.uid?.slice(0, 6)?.toUpperCase()}
              </div>

              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(`Jiunge na Papo Hapo Super App kwa msimbo: PAPO-${user?.uid?.slice(0, 6)?.toUpperCase()}`);
                  toast.success("Msimbo wa mwaliko umenakiliwa!");
                  setActiveModal({ type: null });
                }}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs"
              >
                {language === 'sw' ? 'Nakili & Sambaza' : 'Copy & Share Code'}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* SUBVIEWS: EDIT PROFILE & PASSWORD */}
      {/* ========================================================================= */}

      {/* EDIT PROFILE SUBVIEW */}
      {view === 'edit' && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 overflow-y-auto p-4 max-w-xl mx-auto space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <button 
              onClick={() => setView('menu')}
              className="flex items-center gap-1 text-xs font-black uppercase text-neutral-600 dark:text-neutral-300 hover:text-orange-600"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Rudi</span>
            </button>
            <h2 className="font-black text-base">{language === 'sw' ? 'Badili Wasifu' : 'Edit Profile'}</h2>
            <div className="w-6" />
          </div>

          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <div 
                onClick={handleImageClick}
                className="w-24 h-24 rounded-full overflow-hidden border-4 border-orange-500 mx-auto cursor-pointer shadow-md group relative"
              >
                <img 
                  src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              {formData.photoURL && (
                <button
                  onClick={handleRemovePhoto}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-500">{language === 'sw' ? 'Bonyeza picha kubadilisha' : 'Tap photo to change'}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'sw' ? 'Jina Kamili' : 'Full Name'}</label>
              <Input 
                value={formData.displayName} 
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                className="h-11 rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'sw' ? 'Barua Pepe' : 'Email'}</label>
              <Input 
                value={formData.email} 
                disabled
                className="h-11 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 text-neutral-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'sw' ? 'Namba ya Simu' : 'Phone Number'}</label>
              <Input 
                value={formData.phoneNumber} 
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                placeholder="0712 345 678"
                className="h-11 rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'sw' ? 'Jinsia' : 'Gender'}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'male' })}
                  className={`h-11 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    formData.gender === 'male'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                      : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <span>👨 Mwanaume (Male)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'female' })}
                  className={`h-11 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    formData.gender === 'female'
                      ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500'
                      : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <span>👩 Mwanamke (Female)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <Button 
              variant="outline" 
              className="flex-1 h-11 rounded-xl"
              onClick={() => setView('menu')}
            >
              Ghairi
            </Button>
            <Button 
              className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Hifadhi Wasifu'}
            </Button>
          </div>
        </div>
      )}

      {/* PASSWORD CHANGE SUBVIEW */}
      {view === 'password' && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 overflow-y-auto p-4 max-w-xl mx-auto space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <button 
              onClick={() => setView('menu')}
              className="flex items-center gap-1 text-xs font-black uppercase text-neutral-600 dark:text-neutral-300 hover:text-orange-600"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Rudi</span>
            </button>
            <h2 className="font-black text-base">{language === 'sw' ? 'Badili Nenosiri' : 'Change Password'}</h2>
            <div className="w-6" />
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'sw' ? 'Nenosiri Jipya' : 'New Password'}</label>
              <Input 
                type="password"
                value={passwordData.newPassword} 
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="h-11 rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'sw' ? 'Thibitisha Nenosiri' : 'Confirm Password'}</label>
              <Input 
                type="password"
                value={passwordData.confirmPassword} 
                onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="h-11 rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              className="flex-1 h-11 rounded-xl"
              onClick={() => setView('menu')}
            >
              Ghairi
            </Button>
            <Button 
              className="flex-1 h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
              onClick={handleChangePassword}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Hifadhi Nenosiri'}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
