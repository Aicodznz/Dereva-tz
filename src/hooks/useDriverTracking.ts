import { useState, useEffect } from 'react';
import { LatLng } from '../types/trip.types';

export function useDriverTracking(driverLocation?: LatLng, targetLocation?: LatLng) {
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<{ minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!driverLocation || !targetLocation) {
      setDistance(null);
      setEta(null);
      return;
    }

    // Haversine formula for straight-line distance (approximate)
    const R = 6371e3; // metres
    const φ1 = (driverLocation.lat * Math.PI) / 180;
    const φ2 = (targetLocation.lat * Math.PI) / 180;
    const Δφ = ((targetLocation.lat - driverLocation.lat) * Math.PI) / 180;
    const Δλ = ((targetLocation.lng - driverLocation.lng) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const dist = R * c; // in metres
    const distKm = dist / 1000;
    setDistance(distKm);

    // Dynamic speed based on distance (slower as it gets closer for realistic arrival)
    const speedKmH = distKm < 0.5 ? 20 : 35;
    const timeHours = distKm / speedKmH;
    let totalSeconds = Math.round(timeHours * 3600);
    
    // Add a minimum floor for ETA if not yet arrived
    if (distKm > 0.05 && totalSeconds < 10) totalSeconds = 10;
    if (distKm <= 0.02) totalSeconds = 0;

    setEta({
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60
    });
  }, [driverLocation?.lat, driverLocation?.lng, targetLocation?.lat, targetLocation?.lng]);

  return { distance, eta };
}
