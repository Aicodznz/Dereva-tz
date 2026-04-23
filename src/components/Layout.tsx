import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { Button } from '@/components/ui/button';
import { 
  LogOut, User, LayoutDashboard, ShoppingBag, Truck, 
  ShieldCheck, Tag, Receipt, Home, ShoppingCart, 
  MessageSquare, X, Minus, Trash2, Plus 
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import Header from './Header';
import { useLanguage } from '../LanguageContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, logout, signIn, user } = useAuth();
  const { cartCount, cartItems, totalAmount, removeItem, addItem, clearCart, isCartOpen, setIsCartOpen } = useCart();
  const location = useLocation();
  const { isRTL, t } = useLanguage();

  const navItems = [
    { label: t('welcome') || 'Nyumbani', path: '/', icon: Home },
    { label: t('my_orders') || 'Oda', path: '/my-orders', icon: Receipt },
    { label: t('chat') || 'Chat', path: '/chat', icon: MessageSquare },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ label: 'Admin', path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className={`min-h-screen bg-background dark:bg-neutral-950 flex flex-col font-sans selection:bg-orange-100 dark:selection:bg-orange-900/30 selection:text-orange-900 ${isRTL ? 'font-arabic' : ''}`}>
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-2 sm:px-6 lg:px-8 py-4 md:py-8 pb-32">
        {children}
      </main>

      {/* Mobile Bottom Navigation - Redesigned Modern Style - Hidden for riders as they have their own menu */}
      {profile?.role !== 'rider' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] h-24 pointer-events-none flex flex-col justify-end">
          <div className="relative w-full h-18 pointer-events-auto">
            {/* Background SVG for the curved cutout */}
            <div className="absolute inset-x-0 bottom-0 top-0">
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full fill-white dark:fill-neutral-900 backdrop-blur-xl drop-shadow-[0_-5px_25px_rgba(0,0,0,0.05)]">
                 <path d="M0,30 L100,30 L100,2 C90,2 85,2 80,2 C70,2 65,22 50,22 C35,22 30,2 20,2 C15,2 10,2 0,2 Z" />
              </svg>
            </div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative h-full px-6 flex justify-between items-center max-w-md mx-auto"
            >
              {/* Left Icons */}
              <motion.div 
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -2 }}
                className="flex-1"
              >
                <Link 
                  to="/" 
                  className={`flex flex-col items-center gap-1.5 transition-all w-full relative group ${location.pathname === '/' || location.pathname === '/dashboard' ? 'text-orange-600' : 'text-neutral-400'}`}
                >
                  <div className="relative">
                    <motion.div
                      animate={location.pathname === '/' ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <Home className={`w-5 h-5 relative z-10 transition-transform ${location.pathname === '/' ? 'scale-110' : 'group-hover:scale-110'}`} />
                    </motion.div>
                    {location.pathname === '/' && (
                      <motion.div 
                        layoutId="nav-glow"
                        className="absolute inset-0 bg-orange-400/30 blur-lg rounded-full -z-0"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tight transition-all ${location.pathname === '/' ? 'opacity-100 translate-y-0 text-orange-600' : 'opacity-70 group-hover:opacity-100'}`}>Nyumbani</span>
                </Link>
              </motion.div>

              <motion.div 
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -2 }}
                className="flex-1 mr-8"
              >
                <Link 
                  to="/my-orders" 
                  className={`flex flex-col items-center gap-1.5 transition-all w-full group ${location.pathname === '/my-orders' ? 'text-orange-600' : 'text-neutral-400'}`}
                >
                  <div className="relative">
                    <motion.div
                      animate={location.pathname === '/my-orders' ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <Receipt className={`w-5 h-5 relative z-10 transition-transform ${location.pathname === '/my-orders' ? 'scale-110' : 'group-hover:scale-110'}`} />
                    </motion.div>
                    {location.pathname === '/my-orders' && (
                      <motion.div 
                        layoutId="nav-glow"
                        className="absolute inset-0 bg-orange-400/30 blur-lg rounded-full -z-0"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tight transition-all ${location.pathname === '/my-orders' ? 'opacity-100 text-orange-600' : 'opacity-70'}`}>Oda</span>
                </Link>
              </motion.div>

              {/* Central Floating Action Button (Kikapu) */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-10 w-20 h-20 pointer-events-auto">
                <motion.div
                  animate={{
                    y: [0, -6, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-full h-full p-2"
                >
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: [-1, 1, -1] }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsCartOpen(true)}
                    className="w-full h-full bg-gradient-to-br from-orange-400 via-orange-600 to-orange-800 rounded-full flex items-center justify-center text-white shadow-[0_15px_40px_rgba(234,88,12,0.5)] border-[4px] border-white active:scale-90 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <ShoppingCart className="w-8 h-8 relative z-10 drop-shadow-md" />
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                      className="absolute top-1 right-1 w-6 h-6 bg-white text-orange-600 text-[10px] font-black flex items-center justify-center rounded-full border-2 border-orange-600 shadow-xl"
                    >
                      {cartCount}
                    </motion.div>
                  </motion.button>
                  <motion.div 
                    animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-black text-orange-600 uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
                  >
                    Kikapu
                  </motion.div>
                </motion.div>
              </div>

              {/* Right Icons */}
              <motion.div 
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -2 }}
                className="flex-1 ml-8"
              >
                <Link 
                  to="/chat" 
                  className={`flex flex-col items-center gap-1.5 transition-all w-full group ${location.pathname === '/chat' ? 'text-orange-600' : 'text-neutral-400'}`}
                >
                  <div className="relative">
                    <motion.div
                      animate={location.pathname === '/chat' ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <MessageSquare className={`w-5 h-5 relative z-10 transition-transform ${location.pathname === '/chat' ? 'scale-110' : 'group-hover:scale-110'}`} />
                    </motion.div>
                    {location.pathname === '/chat' && (
                      <motion.div 
                        layoutId="nav-glow"
                        className="absolute inset-0 bg-orange-400/30 blur-lg rounded-full -z-0"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tight transition-all ${location.pathname === '/chat' ? 'opacity-100 text-orange-600' : 'opacity-70'}`}>Chat</span>
                </Link>
              </motion.div>

              <motion.div 
                whileTap={{ scale: 0.9 }}
                whileHover={{ y: -2 }}
                className="flex-1"
              >
                <Link 
                  to="/profile" 
                  className={`flex flex-col items-center gap-1.5 transition-all w-full group ${location.pathname === '/profile' ? 'text-orange-600' : 'text-neutral-400'}`}
                >
                  <div className="relative">
                    <motion.div
                      animate={location.pathname === '/profile' ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                      className="w-5 h-5 relative z-10"
                    >
                      {user ? (
                        <div className={`w-full h-full rounded-lg overflow-hidden border-2 transition-all ${location.pathname === '/profile' ? 'border-orange-600 shadow-md shadow-orange-600/20' : 'border-neutral-300 group-hover:border-neutral-400'}`}>
                          <img 
                            src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <User className={`w-full h-full transition-transform ${location.pathname === '/profile' ? 'scale-110' : 'group-hover:scale-110'}`} />
                      )}
                    </motion.div>
                    {location.pathname === '/profile' && (
                      <motion.div 
                        layoutId="nav-glow"
                        className="absolute inset-0 bg-orange-400/30 blur-lg rounded-full -z-0"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tight transition-all ${location.pathname === '/profile' ? 'opacity-100 text-orange-600' : 'opacity-70'}`}>Akaunti</span>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      )}

      <footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-neutral-500">© 2026 OmniServe Super App. All rights reserved.</p>
        </div>
      </footer>

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
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">Hakikisha oda yako kabla ya kuagiza</p>
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
                              onClick={() => removeItem(item.id!)}
                              className="text-neutral-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-orange-600 font-black mt-1">TZS {item.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 gap-3 transition-colors">
                            <button 
                              onClick={() => removeItem(item.id!)}
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
                        toast.success('Agizo lako limepokelewa! 🚀', {
                          description: 'Tunashughulikia oda yako sasa hivi.',
                          icon: '✅'
                        });
                        clearCart();
                        setIsCartOpen(false);
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
    </div>
  );
}
