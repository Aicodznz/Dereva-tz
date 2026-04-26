import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Ride } from '../types/ride.types';

export function useIncomingRequests(vehicleType: string, isOnline: boolean) {
  const [requests, setRequests] = useState<Ride[]>([]);

  useEffect(() => {
    if (!isOnline) {
      setRequests([]);
      return;
    }

    const q = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', vehicleType),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      setRequests(data);
    }, (error) => {
      console.error("Incoming requests error:", error);
    });

    return () => unsubscribe();
  }, [vehicleType, isOnline]);

  return requests;
}
