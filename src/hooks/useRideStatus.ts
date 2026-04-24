import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride } from '../types/ride.types';

export function useRideStatus(rideId: string | null) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rideId) {
      setRide(null);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'rides', rideId),
      (docSnap) => {
        if (docSnap.exists()) {
          setRide({ id: docSnap.id, ...docSnap.data() } as Ride);
          setError(null);
        } else {
          setError('Ride not found');
          setRide(null);
        }
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [rideId]);

  return { ride, isLoading, error };
}
