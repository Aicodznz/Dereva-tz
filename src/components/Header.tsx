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

  const languages = [
    { code: 'en', label: 'English', short: 'En' },
    { code: 'sw', label: 'Kiswahili', short: 'Sw' },
    { code: 'ar', label: 'العربية', short: 'Ar' }
  ];

  const currentLang = languages.find(l => l.code === language);
  const isDashboard = routerLocation.pathname === '/' || routerLocation.pathname === '/dashboard';

  return (
    <div className="sticky top-0 z-[150] bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-2 md:px-4 h-18 flex items-center justify-between gap-2 md:gap-4">
        
        {/* Left: Logo & Location */}
        <div className="flex items-center gap-2 md:gap-6 min-w-0 flex-shrink">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-lg shadow-orange-600/20">
              <span className="text-white font-black text-xl italic tracking-tighter">O</span>
            </div>
            <span className="hidden lg:block font-black text-lg uppercase italic tracking-tighter text-neutral-900 dark:text-white">OmniServe</span>
          </Link>

          {isDashboard && (
            <button 
              onClick={onLocationClick}
              className="flex items-center gap-1 min-w-0 max-w-[100px] md:max-w-[200px] group"
            >
              <div className="p-1 rounded-lg bg-orange-600/10 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all">
                <MapPin className="w-3 h-3" />
              </div>
              <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-neutral-900 dark:text-white truncate">
                  {currentAddress}
                </span>
                <ChevronDown className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
              </div>
            </button>
          )}
        </div>

        {/* Center: Search (Visible on desktop only in main row) */}
        {isDashboard && (
          <div className="flex-1 max-w-md relative group hidden md:block">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-orange-600 transition-colors`} />
            <input 
              type="text"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-10 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all font-medium`}
            />
          </div>
        )}

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
                  src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </Link>
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

      {/* Mobile Search Row */}
      {isDashboard && (
        <div className="px-3 pb-3 md:hidden">
          <div className="relative group">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-orange-600 transition-colors`} />
            <input 
              type="text"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-11 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} bg-neutral-100 dark:bg-neutral-800 border boder-border rounded-[18px] text-sm focus:ring-2 focus:ring-orange-500/20 transition-all font-medium`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
