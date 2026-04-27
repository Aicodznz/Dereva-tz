import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import { DriverInfo, RideStatus } from '../types/ride.types';

export function useDriverActions(rideId: string | null) {
  const acceptRide = async (targetRideId: string, driverId: string, driverInfo: DriverInfo, currentLoc: { lat: number, lng: number }) => {
    try {
      await runTransaction(db, async (transaction) => {
        const rideRef = doc(db, 'rides', targetRideId);
        const rideDoc = await transaction.get(rideRef);
        
        if (!rideDoc.exists()) {
          throw new Error('Safari haipo');
        }
        
        const rideData = rideDoc.data();
        if (rideData.status !== 'pending') {
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
    } catch (error) {
      console.error("Accept ride transaction failed:", error);
      throw error;
    }
  };

  const arrivedAtPickup = async () => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'driver_arrived' as RideStatus,
        arrivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const startTrip = async () => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'on_trip' as RideStatus,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const completeTrip = async (customerId: string, driverId: string, amount: number) => {
    if (!rideId) return;

    try {
      await updateDoc(doc(db, 'rides', rideId), {
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
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const updateDriverLocation = async (lat: number, lng: number, heading?: number) => {
    if (!rideId) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        driverLocation: { lat, lng, heading, timestamp: new Date().toISOString() },
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  return { acceptRide, arrivedAtPickup, startTrip, completeTrip, updateDriverLocation };
}
