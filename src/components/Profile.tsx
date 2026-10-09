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
  Compass,
  Plus,
  GraduationCap
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
    if (!user?.uid) return;

    let unsubOrders = () => {};
    let unsubRides = () => {};
    let unsubNotifs = () => {};

    let currentOrders = {
      toPay: 0,
      preparing: 0,
      onTheWay: 0,
      toReview: 0,
      returns: 0,
      total: 0
    };
    let currentActiveRides = 0;
    let currentRidesTotal = 0;

    const computeAndSetStats = () => {
      setOrderStats({
        toPay: currentOrders.toPay,
        preparing: currentOrders.preparing,
        onTheWay: currentOrders.onTheWay + currentActiveRides,
        toReview: currentOrders.toReview,
        returns: currentOrders.returns,
        total: currentOrders.total + currentRidesTotal
      });
    };

    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid)
    );

    unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
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

      currentOrders = {
        toPay,
        preparing,
        onTheWay,
        toReview,
        returns,
        total: snapshot.size
      };
      computeAndSetStats();
    }, (error) => {
      console.error("Error fetching order stats:", error);
    });

    const ridesQuery = query(
      collection(db, 'rides'),
      where('customerId', '==', user.uid)
    );

    unsubRides = onSnapshot(ridesQuery, (snapshot) => {
      let activeRides = 0;
      snapshot.docs.forEach(doc => {
        const r = doc.data();
        if (r.status === 'requested' || r.status === 'accepted' || r.status === 'arrived' || r.status === 'ongoing') {
          activeRides++;
        }
      });
      currentActiveRides = activeRides;
      currentRidesTotal = snapshot.size;
      computeAndSetStats();
    }, (error) => {
      console.error("Error fetching rides count:", error);
    });

    // Unread notifications listener
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );
    unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
      const unread = snapshot.docs.filter(d => !d.data().read).length;
      setUnreadNotifications(prev => (prev !== unread ? unread : prev));
    }, () => {});

    return () => {
      unsubOrders();
      unsubRides();
      unsubNotifs();
    };
  }, [user?.uid]);

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
    <div className="max-w-2xl mx-auto min-h-screen bg-neutral-100/70 dark:bg-neutral-950 pb-36 sm:pb-28 text-neutral-900 dark:text-neutral-100 font-sans select-none">
      
      {/* 1. TOP USER HEADER */}
      <div className="bg-white dark:bg-neutral-900 px-4 pt-4 pb-4 border-b border-neutral-200/70 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          
          {/* User Avatar + Display Name */}
          <div 
            onClick={() => setView('edit')}
            className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
          >
            <div className="relative shrink-0">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-gradient-to-tr from-orange-600 via-amber-500 to-red-600 p-[2px] shadow-sm group-hover:scale-105 transition-transform">
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight truncate text-neutral-900 dark:text-white capitalize">
                  {userDisplayName}
                </h1>
                <span className="text-[10px] sm:text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full shrink-0 border border-orange-200/50 dark:border-orange-900/30">
                  {profile.role === 'rider' ? 'Dereva' : 'VIP Member'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                {profile.phoneNumber || profile.email || 'Papo Hapo Super App'}
              </p>
            </div>
          </div>

          {/* Quick Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Dark/Light Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Washa Hali ya Mchana' : 'Washa Hali ya Usiku'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-neutral-700 dark:text-neutral-300 bg-neutral-100/80 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Country Flag (Tanzania) with Language Toggle */}
            <button
              onClick={() => setActiveModal({ type: 'settings' })}
              title="Tanzania / Swahili"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 hover:scale-105 active:scale-95 transition-transform"
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
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-neutral-700 dark:text-neutral-300 bg-neutral-100/80 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Notification Bell with Badge */}
            <Link
              to="/notifications"
              title="Taarifa / Notifications"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center relative text-neutral-700 dark:text-neutral-300 bg-neutral-100/80 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-sm">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
          </div>

        </div>
      </div>

      {/* 2. PROMOTIONAL TICKER / BANNER */}
      <div 
        onClick={() => setActiveModal({ type: 'coupons' })}
        className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200/60 dark:border-neutral-800 px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-orange-50/50 dark:hover:bg-neutral-800/60 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black text-[10px] sm:text-xs tracking-wider text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/20 px-2 py-0.5 rounded-full uppercase shrink-0">
            SUPER SALE
          </span>
          <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate font-medium">
            {language === 'sw' ? 'Ofa za Usafiri & Chakula: Pata hadi 20% Punguzo!' : 'Ride & Food Offers: Get up to 20% off!'}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
      </div>

      <div className="p-3.5 space-y-3.5">
        
        {/* 3. PAPO HAPO FINTECH WALLET & COINS CARD */}
        <div className="rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white shadow-md border border-neutral-800/80 p-4 sm:p-5 relative">
          {/* Subtle Ambient Light Gradients */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-orange-500/20 via-amber-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-purple-500/15 via-pink-500/10 to-transparent rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 space-y-3.5">
            {/* Header: Title & Badges */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    {language === 'sw' ? 'Pochi & Sarafu' : 'Wallet & Coins'}
                  </h3>
                  <p className="text-[11px] text-amber-300/90 font-medium">
                    Papo Hapo Digital Account
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModal({ type: 'coupons' })}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold transition-colors"
              >
                <Ticket className="w-3.5 h-3.5 text-orange-400" />
                <span>{language === 'sw' ? 'Vocha 4' : '4 Coupons'}</span>
              </button>
            </div>

            {/* Balances Display: Dual Column (Wallet Cash + Coins) */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
              <div 
                onClick={() => setActiveModal({ type: 'wallet' })}
                className="cursor-pointer hover:opacity-90 transition-opacity p-2.5 rounded-xl bg-white/5 border border-white/5"
              >
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                  {language === 'sw' ? 'Salio la Pochi' : 'Wallet Balance'}
                </span>
                <p className="text-lg sm:text-xl font-black text-white font-mono tracking-tight mt-0.5">
                  TZS {(profile.walletBalance || 0).toLocaleString()}
                </p>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  {language === 'sw' ? 'Tayari kwa malipo' : 'Ready for payment'}
                </span>
              </div>

              <div 
                onClick={() => setActiveModal({ type: 'daily_coins' })}
                className="cursor-pointer hover:opacity-90 transition-opacity p-2.5 rounded-xl bg-white/5 border border-white/5"
              >
                <span className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider block">
                  {language === 'sw' ? 'Sarafu za Papo' : 'Papo Coins'}
                </span>
                <p className="text-lg sm:text-xl font-black text-amber-300 font-mono tracking-tight mt-0.5 flex items-center gap-1">
                  <span>{profile.points || 0}</span>
                  <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                </p>
                <span className="text-[10px] text-amber-200/70 font-medium mt-0.5 block truncate">
                  ≈ TZS {((profile.points || 0) * 10).toLocaleString()} {language === 'sw' ? 'punguzo' : 'value'}
                </span>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <Button
                size="sm"
                onClick={() => navigate('/papopay?tab=transit')}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl shadow-md border-none flex items-center justify-center gap-1"
              >
                <Wallet className="w-3.5 h-3.5 text-white" />
                <span>PapoPay 💳</span>
              </Button>

              <Button
                size="sm"
                onClick={() => navigate('/papopay?tab=student_card')}
                className="h-9 bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] rounded-xl border border-white/10 shadow-none flex items-center justify-center gap-1"
              >
                <GraduationCap className="w-3.5 h-3.5 text-pink-400" />
                <span>Mwanafunzi 🎒</span>
              </Button>

              <Button
                size="sm"
                onClick={handleClaimDailyCoins}
                disabled={claimingCoins}
                className="h-9 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-neutral-950 font-black text-[11px] rounded-xl shadow-md border-none flex items-center justify-center gap-1"
              >
                {claimingCoins ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-neutral-950" />
                    <span>+15 Sarafu</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 4. "MY ORDERS" SECTION */}
        <Card className="border-none shadow-sm rounded-2xl sm:rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardContent className="p-4 space-y-3.5">
            
            {/* Header: Title & View All */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
                  {language === 'sw' ? 'Oda na Safari Zangu' : 'My Orders & Rides'}
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {language === 'sw' ? 'Fuatilia safari, chakula na vifurushi' : 'Track your rides, food & packages'}
                </p>
              </div>
              <button 
                onClick={() => setView('orders')}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 transition-colors"
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
                className="flex flex-col items-center gap-1.5 py-1 px-0.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 transition-colors">
                    <CreditCard className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  </div>
                  {orderStats.toPay > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-neutral-900">
                      {orderStats.toPay}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Kulipa' : 'To pay'}
                </span>
              </button>

              {/* In Prep (To ship) */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 py-1 px-0.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 transition-colors">
                    <Package className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  </div>
                  {orderStats.preparing > 0 && (
                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-neutral-900">
                      {orderStats.preparing}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Inaandaliwa' : 'To ship'}
                </span>
              </button>

              {/* Shipped (On the way) */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 py-1 px-0.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 transition-colors">
                    <Truck className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-emerald-600 transition-colors stroke-[1.75]" />
                  </div>
                  {orderStats.onTheWay > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-neutral-900 animate-pulse">
                      {orderStats.onTheWay}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Safarini' : 'Shipped'}
                </span>
              </button>

              {/* To review */}
              <button 
                onClick={() => setView('orders')}
                className="flex flex-col items-center gap-1.5 py-1 px-0.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors">
                    <MessageSquare className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-blue-600 transition-colors stroke-[1.75]" />
                  </div>
                  {orderStats.toReview > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-neutral-900">
                      {orderStats.toReview}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Tathmini' : 'Review'}
                </span>
              </button>

              {/* Returns / Msaada */}
              <button 
                onClick={() => setView('chat')}
                className="flex flex-col items-center gap-1.5 py-1 px-0.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
              >
                <div className="relative">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
                    <RotateCcw className="w-5 h-5 text-neutral-700 dark:text-neutral-300 group-hover:text-orange-600 transition-colors stroke-[1.75]" />
                  </div>
                  {orderStats.returns > 0 && (
                    <span className="absolute -top-1 -right-1 bg-neutral-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-neutral-900">
                      {orderStats.returns}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
                  {language === 'sw' ? 'Msaada' : 'Help'}
                </span>
              </button>

            </div>

            {/* Secondary Row: History, Wishlist, Coupons, Followed Stores */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center">
              
              <button 
                onClick={() => setView('orders')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-neutral-50/80 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-95"
              >
                <Clock className="w-4 h-4 text-neutral-600 dark:text-neutral-400 stroke-[1.75]" />
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Historia' : 'History'}
                </span>
              </button>

              <button 
                onClick={() => setActiveModal({ type: 'wishlist' })}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-neutral-50/80 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-95"
              >
                <Heart className="w-4 h-4 text-pink-500 stroke-[1.75]" />
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Vipendwa' : 'Wishlist'}
                </span>
              </button>

              <button 
                onClick={() => setActiveModal({ type: 'coupons' })}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-neutral-50/80 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-95"
              >
                <Ticket className="w-4 h-4 text-orange-500 stroke-[1.75]" />
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Kuponi' : 'Coupons'}
                </span>
              </button>

              <button 
                onClick={() => navigate('/services')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-neutral-50/80 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-95"
              >
                <Store className="w-4 h-4 text-purple-500 stroke-[1.75]" />
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  {language === 'sw' ? 'Maduka' : 'Stores'}
                </span>
              </button>

            </div>

          </CardContent>
        </Card>

        {/* 5. 2-COLUMN SPLIT CARDS (Bundle Deals & Daily Coins) */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Bundle Deals */}
          <div 
            onClick={() => navigate('/services')}
            className="bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-neutral-900 dark:to-neutral-900 border border-amber-200/50 dark:border-neutral-800 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full uppercase">
                  {language === 'sw' ? 'Ofa Moto' : 'Hot Sale'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <h4 className="font-black text-sm text-neutral-900 dark:text-white mt-2">
                {language === 'sw' ? 'Ofa za Vifurushi' : 'Bundle Deals'}
              </h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                {language === 'sw' ? 'Punguzo la bei ya jumla' : 'Wholesale discounts'}
              </p>
            </div>

            <div className="pt-3">
              <span className="inline-flex items-center gap-1 text-xs font-black text-orange-600 group-hover:underline">
                <span>{language === 'sw' ? 'Nunua sasa' : 'Shop now'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Daily Coins Task */}
          <div 
            onClick={() => setActiveModal({ type: 'daily_coins' })}
            className="bg-gradient-to-br from-amber-50 to-yellow-50/60 dark:from-neutral-900 dark:to-neutral-900 border border-amber-200/50 dark:border-neutral-800 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="bg-amber-400 text-neutral-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                  +15 COINS
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <h4 className="font-black text-sm text-neutral-900 dark:text-white mt-2">
                {language === 'sw' ? 'Sarafu za Leo' : 'Daily Coins'}
              </h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                {language === 'sw' ? 'Kusanya bure kila siku' : 'Collect free daily'}
              </p>
            </div>

            <div className="pt-3">
              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 group-hover:underline">
                <span>{language === 'sw' ? 'Kusanya sasa' : 'Collect now'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

        </div>

        {/* 6. GAMIFIED PERKS ROW (Prize Land, Play & Earn, Merge Boss, GoGo Match) */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {language === 'sw' ? 'Zawadi na Burudani' : 'Rewards & Perks'}
            </h3>
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">
              Papo Hapo Play
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            
            {/* Prize Land */}
            <button 
              onClick={() => setActiveModal({ type: 'game_prize' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 shadow-sm group-hover:scale-105 transition-transform">
                <Gift className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate w-full">
                {language === 'sw' ? 'Zawadi' : 'Prize Land'}
              </span>
            </button>

            {/* Play & Earn */}
            <button 
              onClick={() => setActiveModal({ type: 'game_trivia' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate w-full">
                {language === 'sw' ? 'Jibu & Pata' : 'Trivia Quiz'}
              </span>
            </button>

            {/* Ride Perks */}
            <button 
              onClick={() => navigate('/taxi')}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 shadow-sm group-hover:scale-105 transition-transform">
                <Award className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate w-full">
                {language === 'sw' ? 'Bonasi' : 'Ride Perks'}
              </span>
            </button>

            {/* GoGo Match */}
            <button 
              onClick={() => setActiveModal({ type: 'coupons' })}
              className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-transform active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center text-pink-600 shadow-sm group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate w-full">
                {language === 'sw' ? 'Bahati' : 'Lucky Land'}
              </span>
            </button>

          </div>
        </div>

        {/* 7. PAPO HAPO SUPER APP SERVICES HUB */}
        <Card className="border-none shadow-sm rounded-2xl sm:rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
                  {language === 'sw' ? 'Huduma za Papo Hapo' : 'Super App Services'}
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {language === 'sw' ? 'Huduma zote kiganjani mwako' : 'All on-demand daily services'}
                </p>
              </div>
              <Link 
                to="/services" 
                className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-0.5"
              >
                <span>{language === 'sw' ? 'Zote' : 'All'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              
              {/* 0. PapoPay Fintech */}
              <Link
                to="/papopay"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all text-center group active:scale-95 border border-emerald-200/50 dark:border-emerald-800/40"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 leading-tight">
                  PapoPay 💳
                </span>
              </Link>

              {/* 1. Usafiri / Taxi & Boda */}
              <Link
                to="/taxi"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-orange-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Car className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Teksi & Boda' : 'Taxi & Rides'}
                </span>
              </Link>

              {/* 2. Chakula / Food Delivery */}
              <Link
                to="/"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-amber-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Chakula' : 'Food'}
                </span>
              </Link>

              {/* 3. Supermarket & Mboga */}
              <Link
                to="/"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-emerald-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Supermarket' : 'Grocery'}
                </span>
              </Link>

              {/* 4. Vifurushi & Mizigo */}
              <Link
                to="/service/vifurushi"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-blue-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Vifurushi' : 'Courier'}
                </span>
              </Link>

              {/* 5. Dawa / Pharmacy */}
              <Link
                to="/"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-red-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Pill className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Dawa' : 'Pharmacy'}
                </span>
              </Link>

              {/* 6. Saluni & Urembo */}
              <Link
                to="/services"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-purple-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Scissors className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Saluni' : 'Salon'}
                </span>
              </Link>

              {/* 7. Kukodisha Magari */}
              <Link
                to="/car-rental"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-sky-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Kodi Gari' : 'Rental'}
                </span>
              </Link>

              {/* 8. Print & Nyaraka */}
              <Link
                to="/print"
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 hover:bg-teal-50 dark:hover:bg-neutral-800 transition-all text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                  {language === 'sw' ? 'Print' : 'Print'}
                </span>
              </Link>

            </div>

          </CardContent>
        </Card>

        {/* 8. DRIVER ACCOUNT / UPGRADE BANNER */}
        {(profile.role === 'rider' || (profile.role as string) === 'driver' || profile.driverType || profile.licensePlate) ? (
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-neutral-900 text-white shadow-sm space-y-3 border border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-black text-xs uppercase tracking-wider text-orange-400 block">
                    {language === 'sw' ? 'Akaunti ya Dereva' : 'Driver Account'}
                  </span>
                  <span className="text-[11px] text-neutral-400">Papo Hapo Driver Partner</span>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase border-none px-2 py-0.5">
                {profile.approvalStatus || 'Approved'}
              </Badge>
            </div>

            <div className="text-xs space-y-1 opacity-90 font-mono bg-white/5 p-2.5 rounded-xl border border-white/5">
              <p><strong className="text-neutral-400">Chombo:</strong> {profile.vehicleType || 'Bodaboda / Taxi'} {profile.vehicleBrand || ''}</p>
              {profile.licensePlate && <p><strong className="text-neutral-400">Bamba:</strong> {profile.licensePlate}</p>}
            </div>

            <Button 
              onClick={async () => {
                if (profile.role !== 'rider') {
                  await updateRole('rider');
                }
                navigate('/');
              }}
              className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-wider"
            >
              {language === 'sw' ? 'Ingia Dashboard ya Dereva' : 'Go to Driver Mode'}
            </Button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-600/10 border border-orange-200/80 dark:border-orange-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-black text-xs uppercase tracking-wider">
                <Car className="w-4 h-4" />
                <span>{language === 'sw' ? 'Unataka Kazi ya Udereva?' : 'Drive with Papo Hapo'}</span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                {language === 'sw' ? 'Sajili pikipiki, bajaji au teksi upate kipato kila siku kwa usalama.' : 'Earn money by driving passengers and delivering goods.'}
              </p>
            </div>
            <Link to="/register/driver" className="w-full sm:w-auto shrink-0">
              <Button size="sm" className="w-full sm:w-auto h-9 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-sm px-4">
                {language === 'sw' ? 'Sajili Dereva Sasa' : 'Register as Driver'}
              </Button>
            </Link>
          </div>
        )}

        {/* 9. ACCOUNT SETTINGS & PREFERENCES LIST */}
        <Card className="border-none shadow-sm rounded-2xl sm:rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
          <CardContent className="p-4 space-y-1">
            <div className="pb-2 mb-1 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {language === 'sw' ? 'Akaunti & Mipangilio' : 'Account & Preferences'}
              </h3>
            </div>

            {/* Wallet & Payment */}
            <button
              onClick={() => setActiveModal({ type: 'wallet' })}
              className="w-full py-2.5 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    {language === 'sw' ? 'Pochi & Malipo' : 'Wallet & Payment'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    TZS {(profile.walletBalance || 0).toLocaleString()} • M-Pesa, Tigo Pesa
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>

            {/* Coupons & Vouchers */}
            <button
              onClick={() => setActiveModal({ type: 'coupons' })}
              className="w-full py-2.5 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center">
                  <Ticket className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    {language === 'sw' ? 'Vocha na Kuponi Zangu' : 'My Coupons & Vouchers'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {language === 'sw' ? 'Punguzo la safari na vyakula' : 'Discounts on rides & orders'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>

            {/* Referral / Bonus */}
            <button
              onClick={() => setActiveModal({ type: 'bonus' })}
              className="w-full py-2.5 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    {language === 'sw' ? 'Mwalike Rafiki & Pata TZS 2,500' : 'Invite Friends & Earn'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {language === 'sw' ? 'Msimbo wako wa mwaliko' : 'Your referral code'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>

            {/* Edit Profile Info */}
            <button
              onClick={() => setView('edit')}
              className="w-full py-2.5 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    {language === 'sw' ? 'Badili Wasifu & Maelezo' : 'Edit Profile Info'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {language === 'sw' ? 'Jina, picha na simu' : 'Name, photo & phone number'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>

            {/* Change Password */}
            <button
              onClick={() => setView('password')}
              className="w-full py-2.5 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    {language === 'sw' ? 'Usalama & Nenosiri' : 'Security & Password'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {language === 'sw' ? 'Badili nenosiri la akaunti' : 'Update your password'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>

            {/* Customer Help & Support */}
            <button
              onClick={() => setActiveModal({ type: 'help' })}
              className="w-full py-2.5 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    {language === 'sw' ? 'Msaada kwa Wateja (24/7)' : 'Customer Help & Support'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Live Chat, WhatsApp & Simu
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </button>

            {/* Logout Button */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={logout}
                className="w-full py-2.5 px-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-between transition-colors text-red-600 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold block">
                      {language === 'sw' ? 'Ondoka kwenye Akaunti' : 'Sign Out'}
                    </span>
                    <span className="text-[11px] text-red-500/80">
                      {language === 'sw' ? 'Funga kikao cha sasa' : 'End current session'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 group-hover:text-red-600 transition-colors" />
              </button>
            </div>

          </CardContent>
        </Card>

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
