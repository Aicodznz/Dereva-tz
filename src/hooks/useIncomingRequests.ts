import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride } from '../types/ride.types';
import { getDistanceKm } from '../utils/distanceHelper';
import { playAlertSound } from '../utils/soundAlert';

export function useIncomingRequests(vehicleType: string, isOnline: boolean, driverLocation: { lat: number; lng: number } | null, currentUserId?: string) {
  const [requests, setRequests] = useState<Ride[]>([]);

  useEffect(() => {
    if (!isOnline || !driverLocation) {
      setRequests([]);
      return;
    }

    // Only look for rides created in the last 2 minutes to avoid "ghost" old orders
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      where('createdAt', '>=', Timestamp.fromDate(twoMinutesAgo)),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const ride = { id: change.doc.id, ...change.doc.data() } as Ride;
          
          // Don't alert for your own test rides
          if (ride.customerId === currentUserId) return;

          const dist = getDistanceKm(
            ride.pickup.lat, 
            ride.pickup.lng, 
            driverLocation.lat, 
            driverLocation.lng
          );

          if (dist <= 5) {
            playAlertSound();
            if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
          }
        }
      });

      const allNearby = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride))
        .filter(ride => {
          // Filter out own rides
          if (ride.customerId === currentUserId) return false;

          const dist = getDistanceKm(
            ride.pickup.lat, 
            ride.pickup.lng, 
            driverLocation.lat, 
            driverLocation.lng
          );
          return dist <= 5;
        });

      setRequests(allNearby);
    }, (error) => {
      console.error("Incoming requests error:", error);
    });

    return () => unsubscribe();
  }, [vehicleType, isOnline, driverLocation?.lat, driverLocation?.lng, currentUserId]);

  return requests;
}
