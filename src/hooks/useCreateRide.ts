import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
      const expiresAtDate = new Date();
      expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 5);

      const rideData = {
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
        expiresAt: expiresAtDate.toISOString(), // Keep as ISO for simple comparison or change to timestamp if needed
        driverInfo: null,
        driverLocation: null,
      };

      const docRef = await addDoc(collection(db, 'rides'), rideData);
      const newId = docRef.id;
      setRideId(newId);
      return newId;
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
