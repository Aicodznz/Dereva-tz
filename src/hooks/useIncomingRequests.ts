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
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const twoMinutesAgoMs = Date.now() - 2 * 60 * 1000;
      const rides = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Ride))
        .filter(ride => {
          const createdAtMs = ride.createdAt?.toMillis ? ride.createdAt.toMillis() : 0;
          return createdAtMs >= twoMinutesAgoMs;
        })
        .sort((a, b) => {
          // Manual sort by createdAt desc
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
      
      const allNearby = rides.filter(ride => {
        // For testing/prototype, we allow self-ordering.
        // if (ride.customerId === currentUserId) return false;

        const dist = getDistanceKm(
          ride.pickup.lat, 
          ride.pickup.lng, 
          driverLocation.lat, 
          driverLocation.lng
        );
        
        // Attach distance to pickup for the UI
        (ride as any).distanceToPickup = dist;
        
        return dist <= 10; // Increased to 10km
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
