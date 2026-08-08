import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Ride } from '../types/ride.types';

export function useNearbyRides(vehicleType: string) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'pending'),
        where('vehicleType', '==', vehicleType),
        limit(10)
      );

      unsub = onSnapshot(q, (snap) => {
        setRides(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride)));
        setIsLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'rides');
        setIsLoading(false);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'rides');
      setIsLoading(false);
    }

    return () => unsub();
  }, [vehicleType]);

  return { rides, isLoading };
}
