import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride } from '../types/ride.types';

export function useNearbyRides(vehicleType: 'mini' | 'bajaj' | 'bike') {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingRides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      setRides(pendingRides);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [vehicleType]);

  return { rides, isLoading };
}
