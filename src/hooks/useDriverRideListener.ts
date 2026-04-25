import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride } from '../types/ride.types';

export function useDriverRideListener(driverId: string | undefined, isOnline: boolean) {
  const [assignedRide, setAssignedRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (!driverId || !isOnline) {
      setAssignedRide(null);
      return;
    }

    // Listen for rides CURRENTLY assigned to this driver that are not completed or cancelled
    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId),
      where('status', 'in', ['accepted', 'driver_arriving', 'driver_arrived', 'on_trip']),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const rideData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ride;
        setAssignedRide(rideData);
      } else {
        setAssignedRide(null);
      }
    });

    return () => unsubscribe();
  }, [driverId, isOnline]);

  return { assignedRide };
}
