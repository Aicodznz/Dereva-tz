import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
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
    const twoMinutesAgo = new Timestamp(Math.floor((Date.now() - 2 * 60 * 1000) / 1000), 0);
    
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      where('createdAt', '>=', twoMinutesAgo),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rides = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      
      const allNearby = rides.filter(ride => {
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

      // Sound alert logic: if we have a NEW request that we didn't have before
      setRequests(prev => {
        const newRequests = allNearby.filter(nr => !prev.find(pr => pr.id === nr.id));
        if (newRequests.length > 0) {
          playAlertSound();
          if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
        }
        return allNearby;
      });
    }, (error) => {
      console.error("Incoming requests error:", error);
    });

    return () => unsub();
  }, [vehicleType, isOnline, driverLocation?.lat, driverLocation?.lng, currentUserId]);

  return requests;
}
