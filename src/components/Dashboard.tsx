import React from 'react';
import { useAuth } from '../AuthContext';
import CustomerDashboard from './CustomerDashboard';
import VendorDashboard from './VendorDashboard';
import RiderDashboard from './RiderDashboard';
import AdminDashboard from './AdminDashboard';

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  if (!profile) return <div className="text-center py-12">Please sign in to access your dashboard.</div>;

  console.log('Current profile role:', profile.role);

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'vendor':
      return <VendorDashboard />;
    case 'rider':
      return <RiderDashboard />;
    case 'customer':
      return <CustomerDashboard />;
    default:
      return <CustomerDashboard />;
  }
}
