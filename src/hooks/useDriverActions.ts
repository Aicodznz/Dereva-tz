import { doc, updateDoc, serverTimestamp, addDoc, collection, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { DriverInfo, RideStatus } from '../types/ride.types';

export function useDriverActions(rideId: string | null) {
  const acceptRide = async (driverId: string, driverInfo: DriverInfo, currentLoc: { lat: number, lng: number }) => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    
    await runTransaction(db, async (transaction) => {
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists()) throw new Error('Safari haipo');
      
      const data = rideDoc.data();
      if (data.status !== 'pending') {
        throw new Error('Ombi hili limechukuliwa na dereva mwingine');
      }

      transaction.update(rideRef, {
        status: 'accepted' as RideStatus,
        driverId,
        driverInfo,
        driverLocation: currentLoc,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  };

  const arrivedAtPickup = async () => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: 'driver_arrived' as RideStatus,
      arrivedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const startTrip = async () => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: 'on_trip' as RideStatus,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const completeTrip = async (customerId: string, driverId: string, amount: number) => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    
    await updateDoc(rideRef, {
      status: 'completed' as RideStatus,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, 'payments'), {
      rideId,
      customerId,
      driverId,
      amount,
      method: 'cash',
      status: 'paid',
      createdAt: serverTimestamp()
    });
  };

  const updateDriverLocation = async (lat: number, lng: number, heading?: number) => {
    if (!rideId) return;
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      driverLocation: { lat, lng, heading, timestamp: serverTimestamp() },
      updatedAt: serverTimestamp()
    });
  };

  return { acceptRide, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation };
}
