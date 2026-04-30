import React from 'react';
import { useAuth } from '../AuthContext';
import CustomerDashboard from './CustomerDashboard';
import VendorDashboard from './VendorDashboard';
import RiderDashboard from './RiderDashboard';
import AdminDashboard from './AdminDashboard';
import ParcelHome from './parcel/ParcelHome';
import ParcelPartnerController from './parcel/partner/ParcelPartnerController';

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  if (!profile) return <CustomerDashboard />;

  console.log('Current profile role:', profile.role);

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'vendor':
      return <VendorDashboard />;
    case 'rider':
      if (profile.driverType === 'delivery') {
        return <ParcelPartnerController />;
      }
      return <RiderDashboard />;
    case 'customer':
      return <CustomerDashboard />;
    default:
      return <CustomerDashboard />;
  }
}
