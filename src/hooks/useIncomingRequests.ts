import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Ride } from '../types/ride.types';
import { getDistanceKm } from '../utils/distanceHelper';
import { playAlertSound } from '../utils/soundAlert';

export function useIncomingRequests(vehicleType: string, isOnline: boolean, driverLocation: { lat: number; lng: number } | null, currentUserId?: string) {
  const [requests, setRequests] = useState<Ride[]>([]);

  useEffect(() => {
    if (!isOnline || !driverLocation) {
      setRequests([]);
      return;
    }

    // Query pending rides without locking to rigid vehicleType string in Firestore query
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fifteenMinutesAgoMs = Date.now() - 15 * 60 * 1000;
      const getSafeTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val.seconds) return val.seconds * 1000;
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      const isMatchingVehicle = (rideVType: string | undefined, driverVType: string) => {
        if (!rideVType || !driverVType) return true;
        const r = rideVType.toLowerCase();
        const d = driverVType.toLowerCase();
        if (r === d) return true;
        if ((r.includes('bike') || r.includes('piki') || r.includes('boda')) && 
            (d.includes('bike') || d.includes('piki') || d.includes('boda'))) return true;
        if (r.includes('bajaj') && d.includes('bajaj')) return true;
        if ((r.includes('mini') || r.includes('gari') || r.includes('cab') || r.includes('car') || r.includes('taxi') || r.includes('xl') || r.includes('comfort')) && 
            (d.includes('mini') || d.includes('gari') || d.includes('cab') || d.includes('car') || d.includes('taxi') || d.includes('xl') || d.includes('comfort'))) return true;
        return false;
      };

      const rides = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Ride))
        .filter(ride => {
          // If createdAt is null/undefined (pending serverTimestamp local write), it's brand new (NOW)!
          if (!ride.createdAt) return true;
          const createdAtMs = getSafeTime(ride.createdAt);
          if (createdAtMs === 0) return true; // Brand new write snapshot
          return createdAtMs >= fifteenMinutesAgoMs;
        })
        .filter(ride => isMatchingVehicle(ride.vehicleType, vehicleType))
        .sort((a, b) => {
          const timeA = getSafeTime(a.createdAt);
          const timeB = getSafeTime(b.createdAt);
          return timeB - timeA;
        });
      
      const allNearby = rides.filter(ride => {
        if (!ride.pickup) return false;
        const pLat = Number(ride.pickup.lat);
        const pLng = Number(ride.pickup.lng);

        if (isNaN(pLat) || isNaN(pLng)) {
          return false;
        }

        const dist = getDistanceKm(
          pLat, 
          pLng, 
          driverLocation.lat, 
          driverLocation.lng
        );
        
        // Attach distance to pickup for the UI
        (ride as any).distanceToPickup = dist;
        
        return dist <= 30; // 30km radius for nearby requests
      });

      // Sound alert logic: if we have a NEW request that we didn't have before
      setRequests(prev => {
        const newRequests = allNearby.filter(nr => !prev.find(pr => pr.id === nr.id));
        if (newRequests.length > 0) {
          playAlertSound();
          try {
            if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
          } catch (e) {
            console.warn("Navigator vibrate blocked or not supported", e);
          }
        }
        return allNearby;
      });
    }, (error) => {
      console.error("Incoming requests error:", error);
    });

    return () => unsub();
  }, [vehicleType, isOnline, driverLocation?.lat, driverLocation?.lng, currentUserId]);

  return requests;
}
