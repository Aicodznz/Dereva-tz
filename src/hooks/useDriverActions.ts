import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { DriverInfo, RideStatus } from '../types/ride.types';

export function useDriverActions(rideId: string | null) {
  const acceptRide = async (driverId: string, driverInfo: DriverInfo) => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: 'driver_arriving' as RideStatus,
      driverId,
      driverInfo,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const arrivedAtPickup = async () => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: 'driver_arrived' as RideStatus,
      updatedAt: serverTimestamp()
    });
  };

  const startTrip = async () => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: 'on_trip' as RideStatus,
      updatedAt: serverTimestamp()
    });
  };

  const completeTrip = async (customerId: string, driverId: string, amount: number) => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    
    // Update ride status
    await updateDoc(rideRef, {
      status: 'completed' as RideStatus,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Trigger payment
    await addDoc(collection(db, 'payments'), {
      rideId,
      customerId,
      driverId,
      amount,
      method: 'mpesa', // Default for now
      status: 'pending',
      createdAt: serverTimestamp()
    });
  };

  const updateDriverLocation = async (lat: number, lng: number, eta?: { minutes: number, seconds: number, distanceKm: number }) => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      driverLocation: { lat, lng },
      ...(eta && { eta }),
      updatedAt: serverTimestamp()
    });
  };

  return { acceptRide, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation };
}
