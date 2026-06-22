import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Ride } from '../types/ride.types';

export function useNearbyRides(vehicleType: string) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      setRides(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching nearby rides:", error);
      setIsLoading(false);
    });

    return () => unsub();
  }, [vehicleType]);

  return { rides, isLoading };
}
