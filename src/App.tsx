import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LanguageProvider } from './LanguageContext';
import { CartProvider } from './CartContext';
import { ThemeProvider } from './ThemeContext';
import { HeaderProvider } from './HeaderContext';
import { BusinessConfigProvider, useBusinessConfig } from './BusinessConfigContext';
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
import InstantQrRide from './components/public/InstantQrRide';
import { Toaster } from '@/components/ui/sonner';

import Login from './components/auth/Login';
import StaffLogin from './components/auth/StaffLogin';
import RegisterChoice from './components/auth/RegisterChoice';
import RegisterCustomer from './components/auth/RegisterCustomer';
import RegisterDriver from './components/auth/RegisterDriver';
import RegisterVendor from './components/auth/RegisterVendor';

import TaxiBooking from './components/TaxiBooking';
import CarRental from './components/CarRental';
import PrintService from './components/PrintService';
import EventsBooking from './components/EventsBooking';
import ParcelPartnerController from './components/parcel/partner/ParcelPartnerController';
import ParcelRequestFlow from './components/parcel/ParcelRequestFlow';
import ParcelHome from './components/parcel/ParcelHome';
import ParcelHistory from './components/parcel/ParcelHistory';
import TaxiHistory from './components/tegex/TaxiHistory';

import DeliveryRobotManager from './components/DeliveryRobotManager';
import SuperServicesHub from './components/services/SuperServicesHub';
import PublicLiveTripTracker from './components/tegex/PublicLiveTripTracker';
import ScrollToTop from './components/ScrollToTop';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const { config, loading: configLoading } = useBusinessConfig();

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const activeColor = isDarkMode ? '#0a0a0f' : '#ffffff';

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
  }, []);

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Auth & Public Standalone Routes (No Layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/status/:vendorId" element={<PublicStatusDisplay />} />
        <Route path="/verify-receipt/:id" element={<PublicReceiptVerification />} />
        <Route path="/track/:rideId" element={<PublicLiveTripTracker />} />
        <Route path="/track" element={<PublicLiveTripTracker />} />
        <Route path="/safari/track" element={<PublicLiveTripTracker />} />
        <Route path="/instant-ride/:driverId" element={<InstantQrRide />} />
        <Route path="/instant-ride" element={<InstantQrRide />} />
        <Route path="/ride/qr/:driverId" element={<InstantQrRide />} />
        <Route path="/ride/qr" element={<InstantQrRide />} />
        <Route path="/instant-ride/trip/:rideId" element={<InstantQrRide />} />
        <Route path="/register" element={<RegisterChoice />} />
        <Route path="/register/customer" element={<RegisterCustomer />} />
        <Route path="/register/driver" element={<RegisterDriver />} />
        <Route path="/register/vendor" element={<RegisterVendor />} />

        {/* App Routes (With Layout) */}
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/taxi/track" element={<PublicLiveTripTracker />} />
          <Route path="/table/:vendorId/:tableId" element={<TableSession />} />
          <Route path="/services" element={<SuperServicesHub />} />
          <Route path="/services-hub" element={<SuperServicesHub />} />
          <Route path="/services/:serviceId" element={<SuperServicesHub />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/vendor/:id" element={<VendorStore />} />
          <Route path="/taxi" element={<TaxiBooking />} />
          <Route path="/car-rental" element={<CarRental />} />
          <Route path="/print" element={<PrintService />} />
          <Route path="/service/print" element={<PrintService />} />
          <Route path="/events" element={<EventsBooking />} />
          <Route path="/service/matukio" element={<EventsBooking />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  const basename = React.useMemo(() => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts.length > 0 ? `/${parts[0]}` : undefined;
    }
    return undefined;
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <LanguageProvider>
          <BusinessConfigProvider>
            <HeaderProvider>
              <CartProvider>
                <Router basename={basename}>
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
