import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
    // We listen for online drivers who are receiving requests
    const q = query(
      collection(db, 'drivers'),
      where('isOnline', '==', true),
      where('receiving', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driverList: DriverMarker[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location && data.location.lat && data.location.lng) {
          driverList.push({
            id: doc.id,
            lat: data.location.lat,
            lng: data.location.lng,
            vehicleType: data.vehicleType || 'mini',
            name: data.name || 'Dereva'
          });
        }
      });
      setDrivers(driverList);
    }, (error) => {
      console.error("Error fetching nearby drivers:", error);
    });

    return () => unsubscribe();
  }, []);

  return { drivers };
}
