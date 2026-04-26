import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride } from '../types/ride.types';
import { getDistanceKm } from '../utils/distanceHelper';
import { playAlertSound } from '../utils/soundAlert';

export function useIncomingRequests(vehicleType: string, isOnline: boolean, driverLocation: { lat: number; lng: number } | null) {
  const [requests, setRequests] = useState<Ride[]>([]);

  useEffect(() => {
    if (!isOnline || !driverLocation) {
      setRequests([]);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const ride = { id: change.doc.id, ...change.doc.data() } as Ride;
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
  }, [vehicleType, isOnline, driverLocation?.lat, driverLocation?.lng]);

  return requests;
}
