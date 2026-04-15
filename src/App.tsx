import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RoleSelection from './components/RoleSelection';
import Profile from './components/Profile';
import ProductDetail from './components/ProductDetail';
import AdminDashboard from './components/AdminDashboard';
import { Toaster } from '@/components/ui/sonner';

import Login from './components/auth/Login';
import RegisterChoice from './components/auth/RegisterChoice';
import RegisterCustomer from './components/auth/RegisterCustomer';
import RegisterDriver from './components/auth/RegisterDriver';
import RegisterVendor from './components/auth/RegisterVendor';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppContent() {
  const { user, loading } = useAuth();
  
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
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
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/role-selection" element={<PrivateRoute><RoleSelection /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
