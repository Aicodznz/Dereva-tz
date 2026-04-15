import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ShieldAlert, Store, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [pendingVendors, setPendingVendors] = useState<VendorProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'vendors'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vendors');
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    const vendorRef = doc(db, 'vendors', id);
    try {
      await updateDoc(vendorRef, { status: 'active' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  const handleReject = async (id: string) => {
    const vendorRef = doc(db, 'vendors', id);
    try {
      await updateDoc(vendorRef, { status: 'suspended' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vendors/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Super Admin Panel</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-neutral-500">Platform-wide management and oversight.</p>
            <span className="text-neutral-300">•</span>
            <Link to="/profile" className="text-sm text-orange-600 font-medium hover:underline">
              Switch Role
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Store className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingVendors.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingVendors.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              No pending applications.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVendors.map((vendor) => (
                <div key={vendor.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center font-bold text-neutral-400">
                      {vendor.businessName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900">{vendor.businessName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="capitalize">{vendor.category}</Badge>
                        <span className="text-xs text-neutral-500">TIN: {vendor.tin}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleReject(vendor.id!)}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(vendor.id!)}>
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
