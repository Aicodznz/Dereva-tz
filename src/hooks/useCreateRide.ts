import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { LocationInfo, RideStatus } from '../types/ride.types';

export function useCreateRide() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);

  const createRide = async (
    customerId: string,
    pickup: LocationInfo,
    destination: LocationInfo,
    vehicleType: 'mini' | 'bajaj' | 'bike',
    fare: number,
    routeCoords: [number, number][]
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'rides'), {
        status: 'pending' as RideStatus,
        customerId,
        driverId: null,
        pickup,
        destination,
        vehicleType,
        fare,
        routeCoords,
        createdAt: serverTimestamp(),
        acceptedAt: null,
        completedAt: null,
        driverInfo: null,
        driverLocation: { lat: pickup.lat, lng: pickup.lng }
      });
      setRideId(docRef.id);
      return docRef.id;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { createRide, rideId, isLoading, error };
}
