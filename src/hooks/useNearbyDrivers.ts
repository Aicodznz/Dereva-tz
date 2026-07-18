import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface DriverMarker {
  id: string;
  lat: number;
  lng: number;
  vehicleType: string;
  name: string;
  heading?: number;
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
      const twoMinutesAgo = now - (2 * 60 * 1000); // 2 minutes threshold for live active/moving vehicles

      const driverList = snap.docs
        .map(doc => {
          const data = doc.data();
          const getSafeTime = (val: any): number => {
            if (!val) return 0;
            if (typeof val.toDate === 'function') return val.toDate().getTime();
            if (val.seconds) return val.seconds * 1000;
            const parsed = new Date(val).getTime();
            return isNaN(parsed) ? 0 : parsed;
          };
          const lastActive = getSafeTime(data.lastActive) || getSafeTime(data.updatedAt);
          return { id: doc.id, ...data, lastActiveTime: lastActive } as any;
        })
        .filter(d => {
          // Check if driver has location
          if (!d.location || !d.location.lat || !d.location.lng) return false;
          
          // Check for staleness: if lastActive is older than 2 minutes, hide them
          if (d.lastActiveTime && d.lastActiveTime < twoMinutesAgo) return false;
          
          return true;
        })
        .map(d => ({
          id: d.id,
          lat: d.location.lat,
          lng: d.location.lng,
          vehicleType: d.vehicleType || 'mini',
          name: d.name || 'Dereva',
          heading: d.location.heading || d.bearing || d.heading || 0
        }));
      setDrivers(driverList);
    }, (error) => {
      console.error("Error fetching nearby drivers:", error);
    });

    return () => unsub();
  }, []);

  return { drivers };
}
