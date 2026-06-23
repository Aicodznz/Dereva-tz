import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Order } from '../types';
import { getDistanceKm } from '../utils/distanceHelper';
import { playAlertSound } from '../utils/soundAlert';

export function useIncomingOrders(isOnline: boolean, driverLocation: { lat: number; lng: number } | null) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!isOnline || !driverLocation) {
      setOrders([]);
      return;
    }

    // Look for orders that are 'preparing' or 'prepared', are 'delivery', and assigned to 'app'
    const q = query(
      collection(db, 'orders'),
      where('orderType', '==', 'delivery'),
      where('riderAssignmentType', '==', 'app'),
      where('status', 'in', ['accepted', 'preparing', 'prepared']),
      limit(20)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const pendingOrders = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .filter(order => !order.riderId); // Only unassigned orders

      // Filter by proximity to the VENDOR location
      // We need vendor location for each order
      const nearbyOrders: Order[] = [];

      for (const order of pendingOrders) {
        try {
          // In a real app, we might store vendorLocation on the order itself for fast indexing
          // For now, we fetch it or assume it's there if we added it (we should add it in Checkout)
          const vendorLoc = (order as any).vendorLocation;
          if (vendorLoc && typeof vendorLoc.lat === 'number' && typeof vendorLoc.lng === 'number') {
            const dist = getDistanceKm(
              vendorLoc.lat,
              vendorLoc.lng,
              driverLocation.lat,
              driverLocation.lng
            );
            if (dist <= 5) {
              (order as any).distanceToVendor = dist;
              nearbyOrders.push(order);
            }
          }
        } catch (e) {
          console.error("Order distance error:", e);
        }
      }

      setOrders(prev => {
        const newOrders = nearbyOrders.filter(no => !prev.find(po => po.id === no.id));
        if (newOrders.length > 0) {
          playAlertSound();
        }
        return nearbyOrders;
      });
    }, (error) => {
      console.warn("Restricted access or error listening to incoming orders:", error.message);
    });

    return () => unsub();
  }, [isOnline, driverLocation?.lat, driverLocation?.lng]);

  return orders;
}
