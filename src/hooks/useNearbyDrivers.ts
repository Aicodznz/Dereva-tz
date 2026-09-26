import { useState, useEffect, useMemo, useRef } from 'react';
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

// Curated realistic driver profiles with authentic East African names, ratings, vehicles, and photos
const DEFAULT_CURATED_DRIVERS: Omit<DriverMarker, 'lat' | 'lng' | 'heading'>[] = [
  {
    id: 'drv-mock-1',
    name: 'Juma Bakari',
    vehicleType: 'mini',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&h=160&q=80',
    rating: 4.9,
    totalTrips: 1420,
    etaMinutes: 3,
    vehiclePlate: 'T 382 DKX',
    vehicleModel: 'Toyota IST (Nyeusi)'
  },
  {
    id: 'drv-mock-2',
    name: 'Emmanuel Mwita',
    vehicleType: 'bajaj',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=80',
    rating: 4.8,
    totalTrips: 980,
    etaMinutes: 4,
    vehiclePlate: 'T 912 BZA',
    vehicleModel: 'TVS King (Njano)'
  },
  {
    id: 'drv-mock-3',
    name: 'Baraka Said',
    vehicleType: 'bike',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&h=160&q=80',
    rating: 5.0,
    totalTrips: 2150,
    etaMinutes: 2,
    vehiclePlate: 'MC 410 CKP',
    vehicleModel: 'Boxer 150 (Nyekundu)'
  },
  {
    id: 'drv-mock-4',
    name: 'Grace Kweka',
    vehicleType: 'mini',
    photoURL: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&h=160&q=80',
    rating: 4.9,
    totalTrips: 760,
    etaMinutes: 5,
    vehiclePlate: 'T 541 EFH',
    vehicleModel: 'Suzuki Alto (Nyeupe)'
  },
  {
    id: 'drv-mock-5',
    name: 'Hassan Mwinyi',
    vehicleType: 'bajaj',
    photoURL: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=160&h=160&q=80',
    rating: 4.9,
    totalTrips: 1680,
    etaMinutes: 3,
    vehiclePlate: 'T 630 ABR',
    vehicleModel: 'Bajaj RE Compact'
  },
  {
    id: 'drv-mock-6',
    name: 'Kelvin Shirima',
    vehicleType: 'bike',
    photoURL: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&h=160&q=80',
    rating: 4.8,
    totalTrips: 1120,
    etaMinutes: 2,
    vehiclePlate: 'MC 882 DDF',
    vehicleModel: 'TVS HLX 125'
  }
];

export function useNearbyDrivers(userPos?: [number, number]) {
  const [firestoreDrivers, setFirestoreDrivers] = useState<DriverMarker[]>([]);
  const simulatedOffsetsRef = useRef<{ id: string; angle: number; dist: number; speed: number }[]>([]);

  // Default coordinate: Dar es Salaam center
  const centerLat = userPos?.[0] || -6.7924;
  const centerLng = userPos?.[1] || 39.2083;

  // Initialize radial offsets around user location once
  useEffect(() => {
    if (simulatedOffsetsRef.current.length === 0) {
      simulatedOffsetsRef.current = DEFAULT_CURATED_DRIVERS.map((d, index) => {
        const angle = (index * (360 / DEFAULT_CURATED_DRIVERS.length) + (index * 17)) * (Math.PI / 180);
        // Distance between 250m and 850m
        const dist = 0.0025 + (index % 3) * 0.0025;
        const speed = (index % 2 === 0 ? 1 : -1) * (0.00002 + Math.random() * 0.00003);
        return { id: d.id, angle, dist, speed };
      });
    }
  }, []);

  // Listen to Firestore real drivers
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
        const twoMinutesAgo = now - (2 * 60 * 1000);

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
            if (!d.location || !d.location.lat || !d.location.lng) return false;
            if (d.lastActiveTime && d.lastActiveTime < twoMinutesAgo) return false;
            return true;
          })
          .map((d, idx) => {
            const fallbackCurated = DEFAULT_CURATED_DRIVERS[idx % DEFAULT_CURATED_DRIVERS.length];
            const dLat = d.location.lat;
            const dLng = d.location.lng;
            // Calculate distance in km
            const distKm = Math.sqrt(Math.pow((dLat - centerLat) * 111, 2) + Math.pow((dLng - centerLng) * 111, 2));
            const calculatedEta = Math.max(1, Math.round(distKm * 2.5));

            return {
              id: d.id,
              lat: dLat,
              lng: dLng,
              vehicleType: d.vehicleType || d.driverType || d.driverRegVehicle || d.selectedService || fallbackCurated.vehicleType,
              name: d.name || fallbackCurated.name,
              heading: d.location.heading || d.bearing || d.heading || 0,
              photoURL: d.photoURL || d.photo || d.driverPhoto || d.avatar || d.profileImage || fallbackCurated.photoURL,
              rating: typeof d.rating === 'number' ? d.rating : fallbackCurated.rating,
              totalTrips: typeof d.totalTrips === 'number' ? d.totalTrips : fallbackCurated.totalTrips,
              etaMinutes: calculatedEta || fallbackCurated.etaMinutes,
              vehiclePlate: d.vehiclePlate || d.vehicle?.plate || fallbackCurated.vehiclePlate,
              vehicleModel: d.vehicleModel || d.vehicle?.model || fallbackCurated.vehicleModel,
              phone: d.phone || d.phoneNumber || ''
            };
          });

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

  // Combine real drivers + fallback drivers if fewer than 4 online
  const combinedDrivers = useMemo(() => {
    if (firestoreDrivers.length >= 4) {
      return firestoreDrivers;
    }

    // Generate positions around center coordinates for curated drivers
    const needed = 6 - firestoreDrivers.length;
    const additional = DEFAULT_CURATED_DRIVERS.slice(0, needed).map((d, i) => {
      const offset = simulatedOffsetsRef.current[i] || {
        angle: (i * 60) * (Math.PI / 180),
        dist: 0.003 + (i * 0.001),
        speed: 0.00002
      };

      const lat = centerLat + Math.sin(offset.angle) * offset.dist;
      const lng = centerLng + Math.cos(offset.angle) * offset.dist * 1.05;
      const heading = Math.round(((offset.angle * 180 / Math.PI) + 90) % 360);

      return {
        ...d,
        lat,
        lng,
        heading
      };
    });

    return [...firestoreDrivers, ...additional];
  }, [firestoreDrivers, centerLat, centerLng]);

  return useMemo(() => ({ drivers: combinedDrivers }), [combinedDrivers]);
}
