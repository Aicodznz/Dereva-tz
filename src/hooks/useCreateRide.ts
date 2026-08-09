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
    vehicleType: string,
    fare: number,
    distance: number,
    duration: number,
    routeCoords: { lat: number; lng: number }[],
    options?: {
      scheduledAt?: string | null;
      stops?: { address: string; lat?: number; lng?: number }[];
      pointsUsed?: number;
      discountAmount?: number;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      // Calculate expiration: 5 minutes from now
      const expiresAtDate = new Date();
      expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 5);

      // Generate a random 4-digit Ride Verification PIN
      const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();

      const rideData = {
        status: 'pending' as RideStatus,
        customerId,
        customerInfo,
        driverId: null,
        pickup,
        destination,
        vehicleType,
        fare,
        originalFare: fare + (options?.discountAmount || 0),
        discountAmount: options?.discountAmount || 0,
        pointsUsed: options?.pointsUsed || 0,
        distance,
        duration,
        routeCoords,
        createdAt: serverTimestamp(),
        expiresAt: expiresAtDate.toISOString(),
        driverInfo: null,
        driverLocation: null,
        verificationPin,
        isScheduled: Boolean(options?.scheduledAt),
        scheduledAt: options?.scheduledAt || null,
        stops: options?.stops || [],
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
