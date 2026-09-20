import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Search, ChevronDown, Sun, Moon, ShoppingCart, MessageSquare, Receipt, LogOut, Bike, Car, Bot, Bell, Globe, Zap, Edit3 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { useHeader } from '../HeaderContext';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import LocationPicker from './LocationPicker';

export default function Header() {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { searchQuery, setSearchQuery, location: currentAddress, setLocation: setHeaderLocation, onLocationClick } = useHeader();
  const { cartCount, setIsCartOpen } = useCart();
  const { profile, logout, updateRole, user } = useAuth();
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [targetLangName, setTargetLangName] = useState('');
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [isHeaderLocationPickerOpen, setIsHeaderLocationPickerOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadNotifsCount(0);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('isRead', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadNotifsCount(snap.size);
    }, (err) => {
      console.warn("Header unread notifications listener error", err);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const handleLocUpdate = (e: any) => {
      if (e?.detail?.address) {
        setHeaderLocation(e.detail.address);
      }
    };
    window.addEventListener('omniserve_location_updated', handleLocUpdate);
    return () => window.removeEventListener('omniserve_location_updated', handleLocUpdate);
  }, [setHeaderLocation]);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: t('good_morning'), emoji: '☀️' };
    if (hour >= 12 && hour < 18) return { text: t('good_afternoon'), emoji: '🌤️' };
    if (hour >= 18 && hour < 22) return { text: t('good_evening'), emoji: '🌙' };
    return { text: t('good_night'), emoji: '🌌' };
  };

  const greeting = getTimeGreeting();

  const isTaxiRoute = routerLocation.pathname === '/taxi';
  const isDashboardRoute = routerLocation.pathname === '/dashboard' || routerLocation.pathname === '/';
  const isRiderDashboard = profile?.role === 'rider' && isDashboardRoute;
  const isPartnerRoute = routerLocation.pathname === '/parcel-partner' || (isDashboardRoute && profile?.role === 'rider' && profile?.driverType === 'delivery');
  const isFullscreen = isTaxiRoute || isPartnerRoute || isRiderDashboard;

  const languages = [
    { code: 'en', label: 'English', short: 'En' },
    { code: 'sw', label: 'Kiswahili', short: 'Sw' },
    { code: 'ar', label: 'العربية', short: 'Ar' }
  ];

  const currentLang = languages.find(l => l.code === language);
  const isDashboard = routerLocation.pathname === '/' || routerLocation.pathname === '/dashboard';

  const displayAddress = useMemo(() => {
    if (currentAddress && currentAddress !== 'Papo Hapo' && currentAddress.trim().length > 0) {
      return currentAddress;
    }
    try {
      const saved = localStorage.getItem('omniserve_user_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.address || parsed.name) {
          return parsed.address || parsed.name;
        }
      }
    } catch {}
    return 'Chagua Eneo Lako';
  }, [currentAddress]);

  const handleOpenLocationEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHeaderLocationPickerOpen(true);
  };

  const handleHeaderLocationSelect = (newLoc: { address: string; lat: number; lng: number }) => {
    try {
      localStorage.setItem('omniserve_user_location', JSON.stringify(newLoc));
      localStorage.setItem('omniserve_location_verified', 'true');
      setHeaderLocation(newLoc.address);
      window.dispatchEvent(new CustomEvent('omniserve_location_updated', { detail: newLoc }));
    } catch (e) {
      console.error(e);
    }
    setIsHeaderLocationPickerOpen(false);
  };

  return (
    <nav 
      className="sticky top-0 z-[150] bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)'
      }}
    >
      <div className={`${isFullscreen ? 'w-full px-3 sm:px-4 md:px-6' : 'max-w-[2400px] mx-auto px-3 sm:px-4 md:px-6'} h-15 sm:h-16 md:h-20 flex items-center justify-between gap-1.5 sm:gap-4 flex-shrink-0`}>
        
        {/* Left: Logo and Brand + Location Directly Under Express */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <Link to="/" className="flex items-center shrink-0 group touch-manipulation" title="Papo Hapo Express">
            {/* Attractive High-Speed 3D Emblem Icon */}
            <div className="relative group shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-0.5 shadow-[0_4px_16px_rgba(234,88,12,0.4)] border border-amber-300/50 transform group-hover:scale-105 transition-all duration-300">
                <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-orange-950 rounded-[14px] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/25 via-transparent to-amber-400/20" />
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 fill-amber-400/90 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] relative z-10 transform -rotate-6 group-hover:rotate-0 group-hover:scale-110 transition-transform duration-300" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 shadow-sm flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </span>
            </div>
          </Link>

          <div className="flex flex-col leading-none shrink-0 justify-center min-w-0">
            <Link to="/" className="flex items-center gap-1 group/brand">
              <span className="font-black text-sm sm:text-base md:text-lg uppercase italic tracking-tight text-neutral-900 dark:text-white whitespace-nowrap group-hover/brand:text-orange-600 transition-colors">
                Papo Hapo
              </span>
              <span className="text-xs sm:text-sm leading-none select-none">🇹🇿</span>
            </Link>

            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 block font-mono">
                EXPRESS
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-orange-500" />
              <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider hidden xs:inline">Dakika 15–30</span>
            </div>

            {/* CHINI YA EXPRESS: Aone eneo alipo + akibonyeza aweze kuediti */}
            <button
              type="button"
              onClick={handleOpenLocationEdit}
              className="flex items-center gap-1.5 mt-1 -ml-0.5 py-1 px-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 dark:bg-orange-950/40 dark:hover:bg-orange-900/60 border border-orange-500/30 hover:border-orange-500/60 transition-all text-left group/loc cursor-pointer max-w-[145px] xs:max-w-[200px] sm:max-w-[280px] md:max-w-[360px] shadow-xs active:scale-95 touch-manipulation"
              title={`Eneo lako la sasa: ${displayAddress}. Bonyeza kubadili au kuediti.`}
            >
              <div className="w-4 h-4 rounded-md bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover/loc:scale-110 transition-transform">
                <MapPin className="w-2.5 h-2.5 fill-white/40 text-white" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-neutral-800 dark:text-neutral-200 truncate leading-none">
                {displayAddress}
              </span>
              <span className="text-[7.5px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300 bg-orange-200/80 dark:bg-orange-900/80 px-1.5 py-0.5 rounded-md shrink-0 group-hover/loc:bg-orange-600 group-hover/loc:text-white transition-colors flex items-center gap-0.5">
                <Edit3 className="w-2 h-2" />
                <span>Badili</span>
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar Removed as per user request */}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          
          {/* Language Selector */}
          <div className="relative shrink-0">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all font-black text-[11px] uppercase text-neutral-800 dark:text-neutral-200 shadow-2xs shrink-0"
              title="Chagua Lugha"
            >
              <Globe className="w-3 h-3 text-orange-600 dark:text-orange-400 hidden xs:inline shrink-0" />
              <span className="leading-none">{currentLang?.short}</span>
              <ChevronDown className={`w-2.5 h-2.5 text-neutral-400 transition-transform shrink-0 ${showLangMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white dark:bg-neutral-900 border border-border rounded-2xl shadow-2xl overflow-hidden p-1.5 z-[200]`}
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLangName(lang.label);
                        setIsChangingLanguage(true);
                        setLanguage(lang.code as any);
                        setShowLangMenu(false);
                        setTimeout(() => {
                          setIsChangingLanguage(false);
                        }, 750);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all ${
                        language === lang.code 
                          ? 'bg-orange-600 text-white font-bold' 
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="font-bold">{lang.label}</span>
                      {language === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-px h-5 bg-border hidden sm:block mx-0.5" />

          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all shrink-0"
            title="Badili Mandhari (Theme Toggle)"
          >
            {theme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-orange-500" />}
          </button>

          {/* Notification Icon (Right next to Theme Toggle) */}
          <Link
            to="/notifications"
            className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all relative shrink-0"
            title="Arifa Na Taarifa (Notifications)"
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-neutral-700 dark:text-neutral-300" />
            <AnimatePresence>
              {unreadNotifsCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900 shadow-sm"
                >
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Persistent Cart Icon for Tablet/Desktop */}
          <button 
            onClick={() => setIsCartOpen(true)}
            className="hidden md:flex w-10 h-10 items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all relative shrink-0"
          >
            <ShoppingCart className="w-5 h-5" />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-orange-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900 shadow-sm"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Driver Mode Toggle Badge if user is rider or has driver details */}
              {(profile?.role === 'rider' || (profile?.role as string) === 'driver' || profile?.driverType || profile?.licensePlate) && (
                <button
                  onClick={async () => {
                    if (profile?.role !== 'rider' && profile?.role !== 'driver') {
                      await updateRole('rider');
                    }
                    navigate('/');
                  }}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black text-[9px] sm:text-[10px] uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
                  title={t('driver_mode')}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('driver_mode')}</span>
                </button>
              )}

              <div className="hidden lg:flex flex-col items-end leading-tight shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {greeting.text} {greeting.emoji}
                </span>
                <span className="text-xs font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter truncate max-w-[120px]">
                  {profile?.displayName?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Mpendwa'}
                </span>
              </div>
              <Link to="/profile" className="flex items-center gap-2 group shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg sm:rounded-xl overflow-hidden border-2 border-orange-600/20 group-hover:border-orange-600 transition-all shadow-sm shrink-0">
                  <img 
                    key={profile?.photoURL || user?.uid}
                    src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`;
                    }}
                  />
                </div>
              </Link>
            </div>
          )}

          {/* Cart for Mobile (fallback when bottom nav is hidden) */}
          {routerLocation.pathname.startsWith('/vendor/') && (
            <button 
              onClick={() => setIsCartOpen(true)}
              className="md:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl bg-orange-600 text-white shadow-lg active:scale-90 relative shrink-0"
            >
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-orange-600 text-[8px] font-black flex items-center justify-center rounded-full border border-orange-600">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Logout (Visible for all logged in users on mobile/desktop) */}
          {user && (
            <button 
              onClick={logout}
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-all shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Row Removed as per user request */}
      
      {/* Dynamic Screen Language Change Overlay */}
      <AnimatePresence>
        {isChangingLanguage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-[#0A0C14]/90 backdrop-blur-xl flex flex-col items-center justify-center text-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="space-y-4"
            >
              <div className="w-16 h-16 bg-orange-600/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">
                🌐
              </div>
              <div>
                <h4 className="text-xl font-black text-white uppercase tracking-tight italic">
                  {targetLangName === 'English' ? 'Switching Language...' : 'Inabadilisha Lugha...'}
                </h4>
                <p className="text-sm text-orange-600 font-bold uppercase tracking-widest mt-1">
                  {targetLangName === 'English' ? 'Setting to English En' : 'Inaweka Kiswahili Sw'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Picker Modal from Header */}
      {isHeaderLocationPickerOpen && (
        <LocationPicker
          isOpen={isHeaderLocationPickerOpen}
          onClose={() => setIsHeaderLocationPickerOpen(false)}
          onSelect={handleHeaderLocationSelect}
          zIndex="z-[99999]"
        />
      )}
    </nav>
  );
}
