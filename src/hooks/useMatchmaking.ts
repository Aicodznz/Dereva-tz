import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Ride, DriverInfo } from '../types/trip.types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function useMatchmaking(ride: Ride | null) {
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!ride || ride.status !== 'pending' || isSearching) return;

    const findDriver = async () => {
      setIsSearching(true);
      
      // Artificial delay to simulate real-world searching
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        // In a real app, we would use a geo-query here.
        // For this implementation, we query for available riders with matching vehicle type
        const ridersRef = collection(db, 'drivers'); 
        const q = query(
          ridersRef, 
          where('status', '==', 'online'),
          where('receiving', '==', true),
          where('vehicleType', '==', ride.vehicleType)
        );

        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'drivers');
          return;
        }

        let selectedDriver: any = null;

        if (!querySnapshot.empty) {
          // Find the closest driver (simulated here since we don't have many real drivers)
          // For now, take the first one that matches
          const driverDoc = querySnapshot.docs[0];
          selectedDriver = { id: driverDoc.id, ...driverDoc.data() };
        } else {
          // FALLBACK FOR DEMO: If no real drivers exist in DB, create a mock one
          // This ensures the user sees the flow even in an empty database
          selectedDriver = {
            id: 'mock_driver_' + Math.random().toString(36).substr(2, 9),
            name: 'Juma Matata',
            phone: '+255 712 345 678',
            photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juma',
            vehicle: {
              model: ride.vehicleType === 'mini' ? 'Toyota Axio' : ride.vehicleType === 'bajaj' ? 'TVS King' : 'Boxer BM150',
              plate: 'T ' + Math.floor(Math.random() * 999) + ' DAR',
              color: 'Nyeupe'
            },
            rating: 4.8,
            location: {
              lat: ride.pickup.lat + (Math.random() - 0.5) * 0.01,
              lng: ride.pickup.lng + (Math.random() - 0.5) * 0.01
            }
          };
        }

        if (selectedDriver) {
          const path = `rides/${ride.id}`;
          try {
            await updateDoc(doc(db, 'rides', ride.id), {
              status: 'accepted',
              driverId: selectedDriver.id,
              driverInfo: {
                name: selectedDriver.name,
                phone: selectedDriver.phone,
                photo: selectedDriver.photo,
                vehicle: selectedDriver.vehicle,
                rating: selectedDriver.rating,
                id: selectedDriver.id
              },
              driverLocation: selectedDriver.location,
              acceptedAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, path);
          }
        }
      } catch (error) {
        console.error("Matchmaking error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    findDriver();
  }, [ride?.id, ride?.status, ride?.vehicleType, isSearching]);

  return { isSearching };
}
