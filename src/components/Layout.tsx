import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { Button } from '@/components/ui/button';
import { 
  LogOut, User, LayoutDashboard, ShoppingBag, Truck, 
  ShieldCheck, Tag, Receipt, Home, ShoppingCart, 
  MessageSquare, X, Minus, Trash2, Plus, ChevronRight
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import Header from './Header';
import MayaAIChat from './MayaAIChat';
import { useLanguage } from '../LanguageContext';
import { useTheme } from 'next-themes';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, logout, signIn, user } = useAuth();
  const { cartCount, cartItems, totalAmount, removeItem, addItem, clearCart, isCartOpen, setIsCartOpen } = useCart();
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { isRTL, t } = useLanguage();

  const [isNavVisible, setIsNavVisible] = useState(true);
  const [badgeAnimateKey, setBadgeAnimateKey] = useState(0);
  const { scrollY } = useScroll();

  useEffect(() => {
    const handleCartAdded = () => {
      setBadgeAnimateKey(prev => prev + 1);
    };
    window.addEventListener('cart-item-added', handleCartAdded);
    return () => window.removeEventListener('cart-item-added', handleCartAdded);
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 100) {
      setIsNavVisible(false);
    } else {
      setIsNavVisible(true);
    }
  });

  const isTaxiRoute = location.pathname === '/taxi';
  const isCarRentalRoute = location.pathname === '/car-rental';
  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/';
  const isRiderDashboard = profile?.role === 'rider' && isDashboardRoute;
  const isPartnerRoute = location.pathname === '/parcel-partner' || (isDashboardRoute && profile?.role === 'rider' && profile?.driverType === 'delivery');
  const isFullscreen = isTaxiRoute || isPartnerRoute || isRiderDashboard;
  const isVendorOrAdmin = profile?.role === 'vendor' || profile?.role === 'admin';
  const hideBottomNav = isFullscreen || isCarRentalRoute || profile?.role === 'rider' || isVendorOrAdmin;
  const isFullWidthPage = location.pathname.startsWith('/vendor/') || location.pathname.startsWith('/service/') || isFullscreen || isCarRentalRoute;
  const isDarkBackgroundRoute = (isFullscreen || isCarRentalRoute) && resolvedTheme !== 'light';

  return (
    <div className={`${isFullscreen ? 'h-screen w-full overflow-hidden' : 'min-h-screen overflow-x-hidden'} ${isDarkBackgroundRoute ? 'bg-[#0a0a0f] text-white animate-fade-in' : 'bg-neutral-50 dark:bg-[#0a0a0f] text-neutral-900 dark:text-[#f0eeff]'} flex flex-col font-sans selection:bg-orange-100 dark:selection:bg-orange-900/30 selection:text-orange-900 ${isRTL ? 'font-arabic' : ''}`}>
      {/* Visual Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1000] opacity-[0.03] contrast-150 mix-blend-multiply flex-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {!isVendorOrAdmin && !isFullscreen && !isCarRentalRoute && <Header />}

      <main className={`flex-1 ${isFullscreen ? 'h-screen w-full overflow-hidden' : `max-w-[2400px] mx-auto w-full ${isFullWidthPage ? 'px-0 pt-0' : 'px-2 pt-1.5 md:pt-2 pb-16'} md:px-4 lg:px-6 relative z-10`}`}>
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      {!hideBottomNav && (
        <div className="md:hidden fixed bottom-6 left-0 right-0 z-[100] px-4 flex justify-center pointer-events-none">
          <motion.nav 
            initial={{ y: 100, opacity: 0 }}
            animate={{ 
              y: isNavVisible ? 0 : 120, 
              opacity: isNavVisible ? 1 : 0,
              scale: isNavVisible ? 1 : 0.9
            }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 200,
              opacity: { duration: 0.2 }
            }}
            className="pointer-events-auto bg-neutral-900/90 dark:bg-black/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] px-2 py-2 flex items-center justify-around w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            {/* Top Shine Effect */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <Link 
              to="/" 
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${location.pathname === '/' || location.pathname === '/dashboard' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {(location.pathname === '/' || location.pathname === '/dashboard') && (
                <>
                  <motion.div layoutId="nav-active" className="absolute top-[-8px] w-8 h-[3px] bg-orange-600 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
                  <div className="absolute inset-0 bg-orange-500/10 blur-xl rounded-full" />
                </>
              )}
              <Home className="w-6 h-6 relative z-10" />
            </Link>

            <Link 
              to="/my-orders" 
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${location.pathname === '/my-orders' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {location.pathname === '/my-orders' && (
                <>
                  <motion.div layoutId="nav-active" className="absolute top-[-8px] w-8 h-[3px] bg-orange-600 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
                  <div className="absolute inset-0 bg-orange-500/10 blur-xl rounded-full" />
                </>
              )}
              <Receipt className="w-6 h-6 relative z-10" />
            </Link>

            <button 
              onClick={() => setIsCartOpen(true)}
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl group transition-all duration-300 ${isCartOpen ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(234,88,12,0.5)]' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {(isCartOpen || cartCount > 0) && (
                <div className="absolute inset-0 bg-orange-500/10 blur-xl rounded-full animate-pulse" />
              )}
              <div className="relative">
                <ShoppingCart className="w-6 h-6 relative z-10 group-active:scale-110 transition-transform" />
                {cartCount > 0 && (
                  <motion.span 
                    key={`nav-badge-${badgeAnimateKey}`}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: [1, 1.45, 0.85, 1.15, 1], rotate: [0, 15, -15, 10, 0] }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-orange-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-neutral-900 shadow-lg z-20"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </div>
            </button>

            <Link 
              to="/chat" 
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${location.pathname === '/chat' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {location.pathname === '/chat' && (
                <>
                  <motion.div layoutId="nav-active" className="absolute top-[-8px] w-8 h-[3px] bg-orange-600 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
                  <div className="absolute inset-0 bg-orange-500/10 blur-xl rounded-full" />
                </>
              )}
              <MessageSquare className="w-6 h-6 relative z-10" />
            </Link>

            <Link 
              to="/profile" 
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${location.pathname === '/profile' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {location.pathname === '/profile' && (
                <>
                  <motion.div layoutId="nav-active" className="absolute top-[-8px] w-8 h-[3px] bg-orange-600 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
                  <div className="absolute inset-0 bg-orange-500/10 blur-xl rounded-full" />
                </>
              )}
              <User className="w-6 h-6 relative z-10" />
            </Link>
          </motion.nav>
        </div>
      )}

      {/* Floating Cart Button (Global fallback) */}
      <AnimatePresence>
        {cartCount > 0 && !isCartOpen && (
          <motion.button
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-24 right-6 z-[160] w-16 h-16 bg-neutral-900 text-white rounded-2xl flex items-center justify-center shadow-2xl border-2 border-orange-600 group active:scale-95"
          >
            <motion.div 
              key={`float-badge-${badgeAnimateKey}`}
              animate={{ 
                scale: [1, 1.35, 0.9, 1.15, 1],
                rotate: [0, 10, -10, 5, 0]
              }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              <ShoppingCart className="w-7 h-7 group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-3 -right-3 w-7 h-7 bg-orange-600 text-white text-xs font-black flex items-center justify-center rounded-full border-4 border-neutral-900 shadow-lg">
                {cartCount}
              </span>
            </motion.div>
            <div className="absolute -left-32 top-1/2 -translate-y-1/2 bg-neutral-900 border border-white/10 px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
               <p className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Agiza Kilichopo ({cartCount})</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>


      {/* Cart Drawer / Side Panel */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 z-[201] shadow-2xl flex flex-col border-l border-neutral-100 dark:border-neutral-800 transition-colors"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    Kikapu <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm">{cartCount}</span>
                  </h2>
                  <Link 
                    to="/checkout" 
                    onClick={() => setIsCartOpen(false)}
                    className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1 hover:text-orange-600 transition-colors flex items-center gap-1 group"
                  >
                    Hakikisha oda yako kabla ya kuagiza
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-neutral-900 dark:text-white hover:bg-orange-600 hover:text-white transition-all transform active:scale-90"
                  >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
                      <ShoppingBag className="w-16 h-16 text-neutral-200" />
                    </div>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white">Kikapu chako ni tupu</h3>
                    <p className="text-neutral-400 text-sm mt-2 max-w-[200px]">Ongeza bidhaa unazopenda sasa ili ufurahie huduma zetu.</p>
                    <Button 
                      onClick={() => setIsCartOpen(false)} 
                      className="mt-8 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl h-14 px-8 font-black uppercase tracking-widest shadow-xl shadow-orange-600/30"
                    >
                      Anza Ununuzi
                    </Button>
                  </div>
                ) : (
                  cartItems.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex gap-4 group">
                      <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden shadow-sm relative shrink-0">
                        <img 
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-black text-neutral-900 dark:text-white text-sm uppercase leading-tight line-clamp-1">{item.name}</h4>
                            <button 
                              onClick={() => removeItem(item.id!, (item as any).variation, (item as any).addons)}
                              className="text-neutral-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {(item as any).variation && (
                            <p className="text-[10px] text-neutral-400 font-bold uppercase mt-0.5">Size: {(item as any).variation}</p>
                          )}
                          {(item as any).addons && (item as any).addons.length > 0 && (
                            <p className="text-[10px] text-neutral-400 font-bold uppercase line-clamp-1">Addons: {(item as any).addons.join(', ')}</p>
                          )}
                          <p className="text-xs text-orange-600 font-black mt-1">TZS {item.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 gap-3 transition-colors">
                            <button 
                              onClick={() => removeItem(item.id!, (item as any).variation, (item as any).addons)}
                              className="w-8 h-8 bg-white dark:bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-900 dark:text-white hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-black text-sm w-4 text-center text-neutral-900 dark:text-white">{item.quantity}</span>
                            <button 
                              onClick={() => addItem(item)}
                              className="w-8 h-8 bg-white dark:bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-900 dark:text-white hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="font-black text-sm text-neutral-900 dark:text-white">
                             TZS {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 transition-colors">
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-neutral-500 text-sm font-bold uppercase tracking-wider">
                      <span>Jumla Ndogo</span>
                      <span>TZS {totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-500 text-sm font-bold uppercase tracking-wider">
                      <span>Ada ya Huduma</span>
                      <span>TZS 0</span>
                    </div>
                    <div className="flex justify-between items-end pt-2">
                      <span className="text-lg font-black text-neutral-900 dark:text-white">JUMLA KUU</span>
                      <span className="text-2xl font-black text-orange-600 tracking-tighter">TZS {totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Button 
                      className="w-full h-16 bg-orange-600 hover:bg-orange-700 text-white rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-[0_15px_30px_rgba(234,88,12,0.3)] transition-all transform active:scale-95"
                      onClick={() => {
                        setIsCartOpen(false);
                        navigate('/checkout');
                      }}
                    >
                      Lipia Sasa
                    </Button>
                    <button 
                      onClick={() => clearCart()}
                      className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-2"
                    >
                      Futa Kikapu
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAYA AI Floating Assistant */}
      <MayaAIChat />
    </div>
  );
}
