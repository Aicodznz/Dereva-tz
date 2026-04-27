import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ride } from '../types/trip.types';

export function useMatchmaking(ride: Ride | null) {
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!ride || ride.status !== 'pending' || isSearching) return;

    const findDriver = async () => {
      setIsSearching(true);
      
      // Artificial delay to simulate real-world searching
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const q = query(
          collection(db, 'drivers'),
          where('status', '==', 'online'),
          where('receiving', '==', true),
          where('vehicleType', '==', ride.vehicleType)
        );

        const snap = await getDocs(q);

        if (!snap.empty) {
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
