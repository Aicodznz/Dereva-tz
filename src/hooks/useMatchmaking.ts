import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
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
  // Not throwing here to prevent component crash
  toast.error("Salama: Tatizo la kupata dereva, tafadhali jaribu tena.");
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
          console.log("Real drivers found nearby. Manual acceptance enabled.");
        } else {
          console.log("No real drivers found yet...");
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
