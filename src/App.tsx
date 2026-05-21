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
import { Toaster } from '@/components/ui/sonner';

import Login from './components/auth/Login';
import StaffLogin from './components/auth/StaffLogin';
import RegisterChoice from './components/auth/RegisterChoice';
import RegisterCustomer from './components/auth/RegisterCustomer';
import RegisterDriver from './components/auth/RegisterDriver';
import RegisterVendor from './components/auth/RegisterVendor';

import TaxiBooking from './components/TaxiBooking';
import ParcelPartnerController from './components/parcel/partner/ParcelPartnerController';
import ParcelRequestFlow from './components/parcel/ParcelRequestFlow';
import ParcelHome from './components/parcel/ParcelHome';
import ParcelHistory from './components/parcel/ParcelHistory';
import TaxiHistory from './components/tegex/TaxiHistory';

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
import { Car, Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const { config, loading: configLoading } = useBusinessConfig();
  const [showSplash, setShowSplash] = React.useState(() => {
    // Show splash once per tab session for smooth PWA/user experience
    const shown = sessionStorage.getItem('app_splash_screen_shown');
    return !shown;
  });

  React.useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('app_splash_screen_shown', 'true');
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-center p-6 select-none"
            style={{ backgroundColor: config.splashColor || '#0c0c0e' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.6, type: 'spring' }}
              className="flex flex-col items-center max-w-sm"
            >
              {config.appLogo ? (
                <img 
                  src={config.appLogo} 
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
                {config.splashText || 'Usafiri wa Haraka, Salama na Uhakika'}
              </p>

              <div className="mt-8 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                <span className="text-[9px] text-neutral-500 font-mono font-black uppercase tracking-[0.2em]">Inapakia...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Routes>
        {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/status/:vendorId" element={<PublicStatusDisplay />} />
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
            <Route path="/taxi" element={<PrivateRoute><TaxiBooking /></PrivateRoute>} />
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
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
