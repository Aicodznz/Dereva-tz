import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface DriverMarker {
  id: string;
  lat: number;
  lng: number;
  vehicleType: string;
  name: string;
  heading?: number;
  photoURL?: string;
  rating?: number;
  totalTrips?: number;
  etaMinutes?: number;
  vehiclePlate?: string;
  vehicleModel?: string;
  phone?: string;
}

export function useNearbyDrivers(userPos?: [number, number]) {
  const [firestoreDrivers, setFirestoreDrivers] = useState<DriverMarker[]>([]);

  // Default coordinate: Dar es Salaam center
  const centerLat = userPos?.[0] || -6.7924;
  const centerLng = userPos?.[1] || 39.2083;

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(
        collection(db, 'drivers'),
        where('isOnline', '==', true),
        where('receiving', '==', true)
      );

      unsub = onSnapshot(q, (snap) => {
        const now = Date.now();
        // 5 minutes threshold for active drivers
        const activeThreshold = now - (5 * 60 * 1000);

        const driverList: DriverMarker[] = snap.docs
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
            // Must have valid GPS coordinates
            if (!d.location || typeof d.location.lat !== 'number' || typeof d.location.lng !== 'number') return false;
            if (isNaN(d.location.lat) || isNaN(d.location.lng)) return false;
            // Only include CURRENT active drivers
            if (d.lastActiveTime && d.lastActiveTime < activeThreshold) return false;
            return true;
          })
          .map((d) => {
            const dLat = d.location.lat;
            const dLng = d.location.lng;
            // Calculate distance in km
            const distKm = Math.sqrt(Math.pow((dLat - centerLat) * 111, 2) + Math.pow((dLng - centerLng) * 111, 2));
            const calculatedEta = Math.max(1, Math.round(distKm * 2.5));

            return {
              id: d.id,
              lat: dLat,
              lng: dLng,
              vehicleType: d.vehicleType || d.driverType || d.driverRegVehicle || d.selectedService || 'mini',
              name: d.name || 'Dereva',
              heading: d.location.heading || d.bearing || d.heading || 0,
              photoURL: d.photoURL || d.photo || d.driverPhoto || d.avatar || d.profileImage,
              rating: typeof d.rating === 'number' ? d.rating : (typeof d.avgRating === 'number' ? d.avgRating : 4.9),
              totalTrips: typeof d.totalTrips === 'number' ? d.totalTrips : 120,
              etaMinutes: calculatedEta || 3,
              vehiclePlate: d.vehiclePlate || d.vehicle?.plate || 'T 240 ABC',
              vehicleModel: d.vehicleModel || d.vehicle?.model || 'Gari',
              phone: d.phone || d.phoneNumber || ''
            };
          });

        // Set ONLY real, current online drivers. If none are online, array is empty.
        setFirestoreDrivers(driverList);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'drivers');
        setFirestoreDrivers([]);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'drivers');
      setFirestoreDrivers([]);
    }

    return () => unsub();
  }, [centerLat, centerLng]);

  return useMemo(() => ({ drivers: firestoreDrivers }), [firestoreDrivers]);
}
