import { useState } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TripLocation, RideStatus } from '../types/trip.types';
import { CustomerInfo } from '../types/ride.types';

export function useCreateRide() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);

  const createRide = async (
    customerId: string,
    customerInfo: CustomerInfo,
    pickup: TripLocation,
    destination: TripLocation,
    vehicleType: 'mini' | 'bajaj' | 'bike',
    fare: number,
    distance: number,
    duration: number,
    routeCoords: { lat: number; lng: number }[]
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      // Calculate expiration: 5 minutes from now
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      const docRef = await addDoc(collection(db, 'rides'), {
        status: 'pending' as RideStatus,
        customerId,
        customerInfo,
        driverId: null,
        pickup,
        destination,
        vehicleType,
        fare,
        distance,
        duration,
        routeCoords,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        driverInfo: null,
        driverLocation: null,
      });
      setRideId(docRef.id);
      return docRef.id;
    } catch (err: any) {
      console.error("Firebase Create Ride Error:", err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { createRide, rideId, isLoading, error };
}
