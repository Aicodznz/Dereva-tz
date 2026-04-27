import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Ride } from '../types/ride.types';

export function useDriverRideListener(driverId: string | undefined, isOnline: boolean) {
  const [assignedRide, setAssignedRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (!driverId || !isOnline) {
      setAssignedRide(null);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId),
      where('status', 'in', ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip']),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setAssignedRide({ id: snap.docs[0].id, ...snap.docs[0].data() } as Ride);
      } else {
        setAssignedRide(null);
      }
    }, (error) => {
      console.error("Error listening for assigned ride:", error);
    });

    return () => unsub();
  }, [driverId, isOnline]);

  return { assignedRide };
}
