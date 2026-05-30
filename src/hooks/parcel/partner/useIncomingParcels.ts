import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Parcel } from '../../../types/parcel';
import { usePartnerLocation } from './usePartnerLocation';

// Haversine formula to calculate distance between two points in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useIncomingParcels() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const { location: partnerLocation } = usePartnerLocation();
  const locationRef = useRef(partnerLocation);

  useEffect(() => {
    locationRef.current = partnerLocation;
  }, [partnerLocation?.lat, partnerLocation?.lng]);

  useEffect(() => {
    const q = query(collection(db, 'parcels'), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incomingParcels: Parcel[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Parcel, 'id'> & { id: string };
        const loc = locationRef.current;
        if (loc) {
          const dist = calculateDistance(
            loc.lat,
            loc.lng,
            data.sender.lat,
            data.sender.lng
          );
          if (dist <= 6) {
            incomingParcels.push({ ...data, id: doc.id });
            // Alert logic 
            if (snapshot.docChanges().some(change => change.type === 'added' && change.doc.id === doc.id)) {
                triggerAlert();
            }
          }
        }
      });
      setParcels(incomingParcels);
    }, (error) => {
      console.warn("Restricted access or error listening to incoming parcels:", error.message);
    });

    return () => unsubscribe();
  }, []); // No dependencies - subscription is stable

  const triggerAlert = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 100, 400, 100, 400]);
    }
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (delay: number) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, audioContext.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + delay + 0.01);
      gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + 0.1);
      osc.start(audioContext.currentTime + delay);
      osc.stop(audioContext.currentTime + delay + 0.1);
    };
    playBeep(0);
    playBeep(0.2);
    playBeep(0.4);
  };

  return parcels;
}
