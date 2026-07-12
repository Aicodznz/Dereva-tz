import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

export interface DriverStats {
  todayEarnings: number;
  todayTrips: number;
  activeHours: number;
  thisMonthEarnings: number;
  thisMonthTrips: number;
  thisYearEarnings: number;
  thisYearTrips: number;
  lifetimeEarnings: number;
  lifetimeTrips: number;
  monthlyStats: { [key: string]: { earnings: number; trips: number } };
  yearlyStats: { [key: string]: { earnings: number; trips: number } };
  completedRides: any[];
}

export function useDriverDashboard() {
  const { user } = useAuth();
  const [showEarnings, setShowEarnings] = useState(() => {
    const saved = localStorage.getItem('tegex_show_earnings');
    return saved === null ? true : saved === 'true';
  });

  const [stats, setStats] = useState<DriverStats>({
    todayEarnings: 0,
    todayTrips: 0,
    activeHours: 0,
    thisMonthEarnings: 0,
    thisMonthTrips: 0,
    thisYearEarnings: 0,
    thisYearTrips: 0,
    lifetimeEarnings: 0,
    lifetimeTrips: 0,
    monthlyStats: {},
    yearlyStats: {},
    completedRides: []
  });

  useEffect(() => {
    localStorage.setItem('tegex_show_earnings', showEarnings.toString());
  }, [showEarnings]);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let todayEarnings = 0;
      let todayTrips = 0;
      let thisMonthEarnings = 0;
      let thisMonthTrips = 0;
      let thisYearEarnings = 0;
      let thisYearTrips = 0;
      let lifetimeEarnings = 0;
      let lifetimeTrips = 0;

      const monthlyMap: { [key: string]: { earnings: number; trips: number } } = {};
      const yearlyMap: { [key: string]: { earnings: number; trips: number } } = {};
      const completedRidesList: any[] = [];

      const now = new Date();
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const thisYearStart = new Date();
      thisYearStart.setMonth(0, 1);
      thisYearStart.setHours(0, 0, 0, 0);

      snapshot.forEach(doc => {
        const data = doc.data();
        
        if (data.status === 'completed') {
          const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function' 
            ? data.createdAt.toDate() 
            : new Date(data.createdAt);
          
          const fare = data.fare || 0;

          // Lifetime
          lifetimeTrips++;
          lifetimeEarnings += fare;

          // Today
          if (createdAt >= todayStart) {
            todayTrips++;
            todayEarnings += fare;
          }

          // This Month
          if (createdAt >= thisMonthStart) {
            thisMonthTrips++;
            thisMonthEarnings += fare;
          }

          // This Year
          if (createdAt >= thisYearStart) {
            thisYearTrips++;
            thisYearEarnings += fare;
          }

          // Monthly grouping (Swahili month names)
          const swahiliMonths = [
            "Januari", "Februari", "Machi", "Aprili", "Mei", "Juni",
            "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"
          ];
          const monthName = swahiliMonths[createdAt.getMonth()];
          const year = createdAt.getFullYear();
          const monthKey = `${monthName} ${year}`;
          const yearKey = `${year}`;

          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { earnings: 0, trips: 0 };
          }
          monthlyMap[monthKey].earnings += fare;
          monthlyMap[monthKey].trips++;

          if (!yearlyMap[yearKey]) {
            yearlyMap[yearKey] = { earnings: 0, trips: 0 };
          }
          yearlyMap[yearKey].earnings += fare;
          yearlyMap[yearKey].trips++;

          completedRidesList.push({
            id: doc.id,
            ...data,
            formattedDate: createdAt.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            createdAtDate: createdAt
          });
        }
      });

      // Sort completed rides by date descending
      completedRidesList.sort((a, b) => b.createdAtDate.getTime() - a.createdAtDate.getTime());

      setStats({
        todayEarnings,
        todayTrips,
        activeHours: todayTrips * 0.5,
        thisMonthEarnings,
        thisMonthTrips,
        thisYearEarnings,
        thisYearTrips,
        lifetimeEarnings,
        lifetimeTrips,
        monthlyStats: monthlyMap,
        yearlyStats: yearlyMap,
        completedRides: completedRidesList
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
