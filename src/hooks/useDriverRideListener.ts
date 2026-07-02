import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Ride } from '../types/ride.types';

export function useDriverRideListener(driverId: string | undefined, isOnline: boolean) {
  const [assignedRide, setAssignedRide] = useState<Ride | null>(() => {
    // Initial state from localStorage for instant restoration
    const savedRideId = localStorage.getItem('active_driver_ride_id');
    return savedRideId ? ({ id: savedRideId, status: 'on_trip' } as any) : null;
  });

  useEffect(() => {
    if (!driverId) {
      setAssignedRide(null);
      localStorage.removeItem('active_driver_ride_id');
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
        const rideId = snap.docs[0].id;
        const rideData = { id: rideId, ...snap.docs[0].data() } as Ride;
        setAssignedRide(rideData);
        localStorage.setItem('active_driver_ride_id', rideId);
        localStorage.setItem('active_ride_id', rideId);
      } else {
        setAssignedRide(null);
        localStorage.removeItem('active_driver_ride_id');
      }
    }, (error) => {
      console.error("Error listening for assigned ride:", error);
    });

    return () => unsub();
  }, [driverId]);

  return { assignedRide };
}
