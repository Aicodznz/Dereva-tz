import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../AuthContext';

export function usePartnerLocation() {
  const { user } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user) return;

    let watchId: number;

    const updatePosition = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });

      try {
        const partnerRef = doc(db, 'partners', user.uid);
        await updateDoc(partnerRef, {
          location: {
            lat: latitude,
            lng: longitude,
            updatedAt: serverTimestamp(),
          },
        });
      } catch (error) {
        console.error('Pigo la kusasisha eneo:', error);
      }
    };

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        updatePosition,
        (error) => console.error('Hitilafu ya GPS:', error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  return location;
}
