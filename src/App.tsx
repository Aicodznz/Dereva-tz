import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RoleSelection from './components/RoleSelection';
import Profile from './components/Profile';
import ProductDetail from './components/ProductDetail';
import AdminDashboard from './components/AdminDashboard';
import MyOrders from './components/MyOrders';
import Chat from './components/Chat';
import Notifications from './components/Notifications';
import VendorStore from './components/VendorStore';
import ServiceDetail from './components/ServiceDetail';
import TableSession from './components/TableSession';
import Checkout from './components/Checkout';
import PublicStatusDisplay from './components/PublicStatusDisplay';
import PublicReceiptVerification from './components/PublicReceiptVerification';
import { Toaster } from '@/components/ui/sonner';

import Login from './components/auth/Login';
import StaffLogin from './components/auth/StaffLogin';
import RegisterChoice from './components/auth/RegisterChoice';
import RegisterCustomer from './components/auth/RegisterCustomer';
import RegisterDriver from './components/auth/RegisterDriver';
import RegisterVendor from './components/auth/RegisterVendor';

import TaxiBooking from './components/TaxiBooking';
import CarRental from './components/CarRental';
import ParcelPartnerController from './components/parcel/partner/ParcelPartnerController';
import ParcelRequestFlow from './components/parcel/ParcelRequestFlow';
import ParcelHome from './components/parcel/ParcelHome';
import ParcelHistory from './components/parcel/ParcelHistory';
import TaxiHistory from './components/tegex/TaxiHistory';

import DeliveryRobotManager from './components/DeliveryRobotManager';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

import { useBusinessConfig } from './BusinessConfigContext';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const { config, loading: configLoading } = useBusinessConfig();
  const [showSplash, setShowSplash] = React.useState(() => {
    // Show splash once per tab session for smooth PWA/user experience
    const shown = sessionStorage.getItem('app_splash_screen_shown');
    return !shown;
  });
  const [isMobile, setIsMobile] = React.useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0);

  const slides = config.splashSlides || [];
  const hasSlides = slides.length > 0;

  const getSplashConfig = () => {
    const role = profile?.role as string | undefined;
    const driverType = profile?.driverType as string | undefined;

    if (role === 'rider' && driverType === 'taxi') {
      return {
        logo: config.driverAppLogo || config.appLogo || 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
        text: config.driverSplashText || 'Usafiri wa Haraka, Salama na Uhakika (Dereva)',
        color: config.driverSplashColor || '#121214',
      };
    }
    if (role === 'rider' && driverType === 'delivery') {
      return {
        logo: config.deliveryAppLogo || config.appLogo || 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
        text: config.deliverySplashText || 'Uwasilishaji Haraka wa Vifurushi na Chakula',
        color: config.deliverySplashColor || '#0a1a0f',
      };
    }
    if (role === 'vendor') {
      return {
        logo: config.vendorAppLogo || config.appLogo || 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
        text: config.vendorSplashText || 'Sanidi Duka Lako Uweze Kuuza wepesi',
        color: config.vendorSplashColor || '#0b161e',
      };
    }
    // Default to Customer splash
    return {
      logo: config.customerAppLogo || config.appLogo || 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
      text: config.customerSplashText || config.splashText || 'Usafiri wa Haraka, Salama na Uhakika',
      color: config.customerSplashColor || config.splashColor || '#0c0c0e',
    };
  };

  const activeSplash = getSplashConfig();

  React.useEffect(() => {
    const checkMobile = () => {
      // Only show splash on mobile screen size (< 768px Width) - meaning inside "the App", not the desktop website
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  React.useEffect(() => {
    if (showSplash) {
      if (hasSlides) return; // Do not auto-dismiss when slides are present!
      
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('app_splash_screen_shown', 'true');
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [showSplash, hasSlides]);

  React.useEffect(() => {
    let activeColor = '#ffffff';
    if (showSplash && isMobile) {
      if (hasSlides && slides[currentSlideIndex]) {
        activeColor = slides[currentSlideIndex].color || '#0c0c0e';
      } else {
        activeColor = activeSplash?.color || '#0c0c0e';
      }
    } else {
      const isDarkMode = document.documentElement.classList.contains('dark') || 
                         window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeColor = isDarkMode ? '#0a0a0f' : '#ffffff';
    }

    const metaTags = document.querySelectorAll('meta[name="theme-color"]');
    if (metaTags.length > 0) {
      metaTags.forEach(tag => {
        tag.setAttribute('content', activeColor);
      });
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = activeColor;
      document.head.appendChild(meta);
    }
  }, [showSplash, isMobile, currentSlideIndex, hasSlides, slides, activeSplash?.color]);

  const handleSkip = () => {
    setShowSplash(false);
    sessionStorage.setItem('app_splash_screen_shown', 'true');
  };

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      handleSkip();
    }
  };

  const handleBack = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  // Swiping support
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handleBack();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <>
      <AnimatePresence>
        {(showSplash && isMobile) && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-[9999] flex flex-col justify-between px-6 select-none overflow-hidden"
            style={{ 
              backgroundColor: hasSlides && slides[currentSlideIndex] 
                ? (slides[currentSlideIndex].color || '#0c0c0e') 
                : activeSplash.color,
              paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {hasSlides && slides[currentSlideIndex] && slides[currentSlideIndex].imageUrl && (
              <div className="absolute inset-0 z-0">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentSlideIndex}
                    src={slides[currentSlideIndex].imageUrl}
                    alt=""
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>
                <div className={`absolute inset-0 transition-opacity duration-300 ${
                  slides[currentSlideIndex].hideText 
                    ? "bg-gradient-to-t from-black/60 to-transparent" 
                    : "bg-gradient-to-t from-black/90 via-black/40 to-transparent"
                }`} />
              </div>
            )}

            {hasSlides ? (
              // MULTI-SLIDE SPLASH/ONBOARDING INTERACTIVE VIEW
              <div className="flex-1 flex flex-col justify-between py-4 relative z-10 h-full">
                {/* Header of Splash Screen: Skip Button & Progress dots */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex gap-1.55 bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                    {slides.map((s: any, idx: number) => (
                      <button
                        key={s.id || idx}
                        onClick={() => setCurrentSlideIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          idx === currentSlideIndex 
                            ? 'bg-orange-500 w-6' 
                            : 'bg-white/30 w-2 hover:bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                  <button 
                    onClick={handleSkip}
                    className="text-xs font-black uppercase tracking-wider text-white/90 hover:text-white px-4 py-2 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full border border-white/5 transition-all"
                  >
                    Ruka (Skip)
                  </button>
                </div>

                {/* Main Content Area (With Swipe Motion transitions) */}
                <div className="flex-1 flex flex-col items-center justify-end text-center pb-12">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSlideIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      className="max-w-xs flex flex-col items-center"
                    >
                      {!slides[currentSlideIndex].hideText && (
                        <>
                          <h2 
                            className="text-3xl font-black tracking-tight mb-4 drop-shadow-md leading-tight"
                            style={{ color: slides[currentSlideIndex].titleColor || '#ffffff' }}
                          >
                            {slides[currentSlideIndex].title}
                          </h2>

                          <p 
                            className="text-sm font-semibold leading-relaxed drop-shadow"
                            style={{ color: slides[currentSlideIndex].descColor || '#e5e7eb' }}
                          >
                            {slides[currentSlideIndex].description}
                          </p>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer Controls: back icon button and primary Next CTA */}
                <div className="flex items-center justify-between w-full pt-4">
                  {currentSlideIndex > 0 ? (
                    <button
                      onClick={handleBack}
                      className="w-12 h-12 rounded-full border border-white/20 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="w-12" /> // spacer
                  )}

                  <button
                    onClick={handleNext}
                    className="px-8 h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/30 flex items-center gap-2 transition-all active:scale-95"
                  >
                    <span>{currentSlideIndex === slides.length - 1 ? 'Anza Sasa (Get Started)' : 'Endelea (Next)'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              // ORIGINAL SIMPLE/SINGLE LOADER VIEW FALLBACK
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.6, type: 'spring' }}
                className="flex-1 flex flex-col items-center justify-center max-w-sm"
              >
                {activeSplash.logo ? (
                  <img 
                    src={activeSplash.logo} 
                    alt="App Logo" 
                    className="w-24 h-24 object-contain mb-6 rounded-2xl shadow-2xl shadow-amber-500/10 pointer-events-none"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-amber-400 flex items-center justify-center text-black shadow-2xl shadow-amber-400/20 mb-6">
                    <Car className="w-10 h-10" />
                  </div>
                )}

                <h1 className="text-xl font-black uppercase tracking-wider text-white mb-2">
                  {config.name || 'Tegex Taxi'}
                </h1>
                
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest max-w-[280px]">
                  {activeSplash.text}
                </p>

                <div className="mt-8 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  <span className="text-[9px] text-neutral-500 font-mono font-black uppercase tracking-[0.2em]">Inapakia...</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Routes>
        {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/status/:vendorId" element={<PublicStatusDisplay />} />
      <Route path="/verify-receipt/:id" element={<PublicReceiptVerification />} />
      <Route path="/register" element={<RegisterChoice />} />
      <Route path="/register/customer" element={<RegisterCustomer />} />
      <Route path="/register/driver" element={<RegisterDriver />} />
      <Route path="/register/vendor" element={<RegisterVendor />} />

      {/* App Routes */}
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/table/:vendorId/:tableId" element={<TableSession />} />
            <Route path="/service/:id" element={<ServiceDetail />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/vendor/:id" element={<VendorStore />} />
            <Route path="/taxi" element={<TaxiBooking />} />
            <Route path="/car-rental" element={<CarRental />} />
            <Route path="/taxi/history" element={<PrivateRoute><TaxiHistory /></PrivateRoute>} />
            <Route path="/service/vifurushi" element={<PrivateRoute><ParcelHome /></PrivateRoute>} />
            <Route path="/parcel/history" element={<PrivateRoute><ParcelHistory /></PrivateRoute>} />
            <Route path="/parcel-partner" element={<PrivateRoute><ParcelPartnerController /></PrivateRoute>} />
            <Route path="/parcel-request/:category" element={<PrivateRoute><ParcelRequestFlow /></PrivateRoute>} />
            <Route path="/checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
            <Route path="/role-selection" element={<PrivateRoute><RoleSelection /></PrivateRoute>} />
            <Route path="/delivery-robot" element={<DeliveryRobotManager />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          </Routes>
        </Layout>
      } />
    </Routes>
    </>
  );
}

import { LanguageProvider } from './LanguageContext';
import { CartProvider } from './CartContext';
import { ThemeProvider } from 'next-themes';
import { HeaderProvider } from './HeaderContext';
import { BusinessConfigProvider } from './BusinessConfigContext';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <LanguageProvider>
          <BusinessConfigProvider>
            <HeaderProvider>
              <CartProvider>
                <Router>
                  <AppContent />
                  <Toaster />
                </Router>
              </CartProvider>
            </HeaderProvider>
          </BusinessConfigProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
