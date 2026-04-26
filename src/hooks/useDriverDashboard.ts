import { useState, useEffect } from 'react';

export function useDriverDashboard() {
  const [showEarnings, setShowEarnings] = useState(() => {
    const saved = localStorage.getItem('tegex_show_earnings');
    return saved === null ? true : saved === 'true';
  });

  const [stats, setStats] = useState({
    todayEarnings: 34500,
    todayTrips: 8,
    activeHours: 4.2
  });

  useEffect(() => {
    localStorage.setItem('tegex_show_earnings', showEarnings.toString());
  }, [showEarnings]);

  const toggleEarnings = () => setShowEarnings(!showEarnings);

  return {
    showEarnings,
    toggleEarnings,
    stats,
    setStats
  };
}
