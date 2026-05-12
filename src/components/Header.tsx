import React from 'react';
import { MapPin, Search, ChevronDown, Sun, Moon, ShoppingCart, MessageSquare, Receipt, LogOut } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'motion/react';
import { useHeader } from '../HeaderContext';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { searchQuery, setSearchQuery, location: currentAddress, onLocationClick } = useHeader();
  const { cartCount, setIsCartOpen } = useCart();
  const { profile, logout, user } = useAuth();
  const routerLocation = useLocation();
  const [showLangMenu, setShowLangMenu] = React.useState(false);

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

  return (
    <div className="sticky top-0 z-[150] bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
      <div className={`${isFullscreen ? 'w-full px-4 md:px-6' : 'max-w-[2400px] mx-auto px-4 md:px-6'} h-16 md:h-20 flex items-center justify-between gap-2 md:gap-4 flex-shrink-0`}>
        
        {/* Left: Logo & Location */}
        <div className="flex items-center gap-2 md:gap-6 min-w-0 flex-shrink">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-700 rounded-2xl flex items-center justify-center transform group-hover:rotate-12 group-hover:scale-110 transition-all shadow-[0_10px_20px_rgba(234,88,12,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-white font-black text-2xl italic tracking-tighter relative z-10 px-0.5">P</span>
            </div>
            <div className="hidden lg:flex flex-col leading-none">
              <span className="font-black text-lg uppercase italic tracking-tighter text-neutral-900 dark:text-white">Papo Hapo</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-orange-600 block text-right mt-0.5">Express</span>
            </div>
          </Link>

          {isDashboard && !isRiderDashboard && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-600/10 dark:bg-orange-600/20 rounded-full border border-orange-600/20 shadow-sm transition-all">
              <MapPin className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-xs font-black text-orange-600 uppercase tracking-widest leading-none">Papo Hapo</span>
            </div>
          )}
        </div>

        {/* Search Bar Removed as per user request */}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          
          {/* Language Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-0.5 h-10 px-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all font-black text-[10px] uppercase text-neutral-700 dark:text-neutral-200"
            >
              <span>{currentLang?.short}</span>
              <ChevronDown className={`w-2.5 h-2.5 text-neutral-400 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white dark:bg-neutral-900 border border-border rounded-2xl shadow-2xl overflow-hidden p-1.5`}
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code as any);
                        setShowLangMenu(false);
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

          <div className="w-px h-6 bg-border hidden sm:block mx-1" />

          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all"
          >
            {theme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-orange-500" />}
          </button>

          {/* User Profile */}
          {user && (
            <Link to="/profile" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-orange-600/20 group-hover:border-orange-600 transition-all shadow-sm shrink-0">
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
          )}

          {/* Cart for Mobile (fallback when bottom nav is hidden) */}
          {routerLocation.pathname.startsWith('/vendor/') && (
            <button 
              onClick={() => setIsCartOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg active:scale-90 relative"
            >
              <ShoppingCart className="w-5 h-5 text-white" />
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
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-all"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Row Removed as per user request */}
    </div>
  );
}
