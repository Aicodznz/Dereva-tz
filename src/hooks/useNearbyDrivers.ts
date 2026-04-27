import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface DriverMarker {
  id: string;
  lat: number;
  lng: number;
  vehicleType: 'mini' | 'bajaj' | 'bike';
  name: string;
}

export function useNearbyDrivers() {
  const [drivers, setDrivers] = useState<DriverMarker[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'drivers'),
      where('isOnline', '==', true),
      where('receiving', '==', true)
    );

    const unsub = onSnapshot(q, (snap) => {
      const driverList = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(d => d.location && d.location.lat && d.location.lng)
        .map(d => ({
          id: d.id,
          lat: d.location.lat,
          lng: d.location.lng,
          vehicleType: d.vehicleType || 'mini',
          name: d.name || 'Dereva'
        }));
      setDrivers(driverList);
    }, (error) => {
      console.error("Error fetching nearby drivers:", error);
    });

    return () => unsub();
  }, []);

  return { drivers };
}
