import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
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
    
    const unsub = onSnapshot(doc(db, 'rides', rideId), (snap) => {
      if (snap.exists()) {
        setRide({ id: snap.id, ...snap.data() } as Ride);
        setError(null);
      } else {
        setRide(null);
        setError('Ride not found');
      }
      setIsLoading(false);
    }, (err) => {
      setError(err.message);
      setIsLoading(false);
    });

    return () => unsub();
  }, [rideId]);

  return { ride, isLoading, error };
}
