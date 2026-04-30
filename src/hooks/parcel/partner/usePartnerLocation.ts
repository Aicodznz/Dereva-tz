import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../AuthContext';

export function usePartnerLocation() {
  const { user } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  useEffect(() => {
    if (!user) return;

    let watchId: number;

    const updatePosition = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setError(null);
      
      setLocation(prev => {
        if (prev && prev.lat === latitude && prev.lng === longitude) return prev;
        return { lat: latitude, lng: longitude };
      });

      try {
        const partnerRef = doc(db, 'partners', user.uid);
        await setDoc(partnerRef, {
          location: {
            lat: latitude,
            lng: longitude,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Pigo la kusasisha eneo:', err);
      }
    };

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        updatePosition,
        (err) => {
          console.error('Hitilafu ya GPS:', err);
          setError(err);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user?.uid]);

  return { location, error };
}
