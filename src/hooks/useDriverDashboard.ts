import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

export function useDriverDashboard() {
  const { user } = useAuth();
  const [showEarnings, setShowEarnings] = useState(() => {
    const saved = localStorage.getItem('tegex_show_earnings');
    return saved === null ? true : saved === 'true';
  });

  const [stats, setStats] = useState({
    todayEarnings: 0,
    todayTrips: 0,
    activeHours: 0
  });

  useEffect(() => {
    localStorage.setItem('tegex_show_earnings', showEarnings.toString());
  }, [showEarnings]);

  useEffect(() => {
    if (!user?.uid) return;

    // Set today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let earnings = 0;
      let trips = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        
        // Client-side filtering for today's completed trips
        if (data.status === 'completed' && createdAt >= today) {
          trips++;
          earnings += (data.actualFare || data.estimatedFare || 0);
        }
      });

      setStats({
        todayEarnings: earnings,
        todayTrips: trips,
        activeHours: trips * 0.5 // Rough estimate for now
      });
    }, (error) => {
      console.error("Error fetching driver stats:", error);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const toggleEarnings = () => setShowEarnings(!showEarnings);

  return {
    showEarnings,
    toggleEarnings,
    stats,
    setStats
  };
}
