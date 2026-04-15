import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Order, RiderProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bike, MapPin, Package, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RiderDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'), where('status', '==', 'ready_for_pickup'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
            <Bike className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Rider Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-neutral-500">Manage your deliveries and status.</p>
              <span className="text-neutral-300">•</span>
              <Link to="/profile" className="text-sm text-orange-600 font-medium hover:underline">
                Switch Role
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge className="bg-green-100 text-green-600 hover:bg-green-100">Online</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5" /> Available Deliveries
          </h2>
          {orders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
              <p className="text-neutral-500">No active delivery requests nearby.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge variant="outline" className="mb-2">{order.type}</Badge>
                        <h3 className="font-bold text-lg">Order #{order.id?.slice(-6)}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-500">Est. Earnings</p>
                        <p className="text-lg font-bold text-green-600">$5.50</p>
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-neutral-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-neutral-500 uppercase font-bold">Pickup</p>
                          <p className="text-sm font-medium">Vendor Address</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-neutral-500 uppercase font-bold">Delivery</p>
                          <p className="text-sm font-medium">{order.deliveryAddress}</p>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full bg-orange-600 hover:bg-orange-700">Accept Delivery</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Your Stats
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Today's Earnings</span>
                <span className="font-bold">$0.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Deliveries Completed</span>
                <span className="font-bold">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Rating</span>
                <span className="font-bold">5.0 ★</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
