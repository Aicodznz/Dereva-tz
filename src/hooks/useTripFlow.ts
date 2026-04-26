import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
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
    const unsubscribe = onSnapshot(
      doc(db, 'rides', rideId),
      (docSnap) => {
        setIsLoading(false);
        if (docSnap.exists()) {
          const data = docSnap.data() as Ride;
          const currentRide = { id: docSnap.id, ...data } as Ride;
          setRide(currentRide);
        } else {
          setRide(null);
          setError('Ride not found');
        }
      },
      (err) => {
        setIsLoading(false);
        console.error('Error listening to ride:', err);
        setError(err.message);
      }
    );

    return () => unsubscribe();
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
