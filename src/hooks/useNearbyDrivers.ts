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
      const now = Date.now();
      const twoMinutesAgo = now - (2 * 60 * 1000);

      const driverList = snap.docs
        .map(doc => {
          const data = doc.data();
          const lastActive = data.lastActive?.toDate?.()?.getTime() || 0;
          return { id: doc.id, ...data, lastActiveTime: lastActive } as any;
        })
        .filter(d => {
          // Check if driver has location
          if (!d.location || !d.location.lat || !d.location.lng) return false;
          
          // Check for staleness: if lastActive is significantly old, hide them
          // (allowing 2 minutes of grace for intermittent connection)
          if (d.lastActiveTime && d.lastActiveTime < twoMinutesAgo) return false;
          
          return true;
        })
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
