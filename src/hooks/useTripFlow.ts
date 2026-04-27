import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Ride, RideStatus } from '../types/trip.types';
import { toast } from 'sonner';

export function useTripFlow(rideId: string | null) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      console.error('Error fetching ride:', err);
      setError(err.message);
      setIsLoading(false);
    });

    return () => unsub();
  }, [rideId]);

  const updateStatus = async (status: RideStatus) => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Imeshindwa kusasisha hali ya safari');
    }
  };

  const cancelRide = async () => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Safari imeghairiwa');
    } catch (err) {
      console.error('Error cancelling ride:', err);
      toast.error('Imeshindwa kughairi safari');
    }
  };

  const deleteRide = async () => {
    if (!rideId) return;
    try {
      await deleteDoc(doc(db, 'rides', rideId));
    } catch (err) {
      console.error('Error deleting ride:', err);
    }
  };

  return {
    ride,
    isLoading,
    error,
    updateStatus,
    cancelRide,
    deleteRide
  };
}
