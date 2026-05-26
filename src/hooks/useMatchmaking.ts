import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Ride } from '../types/trip.types';
import { generateSimulatedRoads } from './useRouting';

export function useMatchmaking(ride: Ride | null) {
  const [isSearching, setIsSearching] = useState(false);
  const simulationIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!ride) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    const rideId = ride.id;

    // Phase 1: Pending Matchmaking -> Auto-assign Mock Driver after 5 seconds
    if (ride.status === 'pending') {
      if (isSearching) return;
      setIsSearching(true);

      const timer = setTimeout(async () => {
        try {
          const q = query(
            collection(db, 'drivers'),
            where('status', '==', 'online'),
            where('receiving', '==', true),
            where('vehicleType', '==', ride.vehicleType)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            console.log("Real drivers online. Let manual acceptance take place first.");
          }

          console.log("[Simulation] Automatching mock driver for live route tracking simulation...");
          const pickupLat = ride.pickup.lat;
          const pickupLng = ride.pickup.lng;

          // Put initial driver position slightly offset (approx 500m to 1km away)
          const offsetLat = (Math.random() - 0.5) * 0.009;
          const offsetLng = (Math.random() - 0.5) * 0.009;
          const driverStartLat = pickupLat + (offsetLat === 0 ? 0.004 : offsetLat);
          const driverStartLng = pickupLng + (offsetLng === 0 ? 0.004 : offsetLng);

          const mockDriverInfo = {
            name: "Omari Juma",
            phone: "+255 712 345 678",
            photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=Omari_${Math.floor(Math.random() * 100)}`,
            rating: 4.9,
            vehicle: {
              model: ride.vehicleType === 'bike' ? 'Boxer 150' : ride.vehicleType === 'bajaj' ? 'TVS King' : 'Toyota Passo',
              plate: `T ${Math.floor(100 + Math.random() * 900)} ${String.fromCharCode(65 + Math.random() * 26)}${String.fromCharCode(65 + Math.random() * 26)}${String.fromCharCode(65 + Math.random() * 26)}`
            }
          };

          await updateDoc(doc(db, 'rides', rideId), {
            status: 'accepted',
            driverId: 'mock_driver_123',
            driverInfo: mockDriverInfo,
            driverLocation: { lat: driverStartLat, lng: driverStartLng },
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error("[Simulation] Failed to match mock driver:", error);
        } finally {
          setIsSearching(false);
        }
      }, 5000);

      return () => clearTimeout(timer);
    }

    // Only run simulation if the assigned driver is the mock driver
    if (ride.driverId !== 'mock_driver_123') {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    // Phase 2: Driver is heading to Pickup
    if (ride.status === 'accepted' || ride.status === 'driver_arriving') {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

      const driverPos = ride.driverLocation || { lat: ride.pickup.lat + 0.005, lng: ride.pickup.lng + 0.005 };
      const approachRoute = generateSimulatedRoads(
        [driverPos.lat, driverPos.lng],
        [ride.pickup.lat, ride.pickup.lng]
      );

      let stepIdx = 0;
      console.log(`[Simulation] Starting approach simulation to pickup. Route steps: ${approachRoute.length}`);

      simulationIntervalRef.current = setInterval(async () => {
        if (stepIdx < approachRoute.length) {
          const nextCoord = approachRoute[stepIdx];
          
          await updateDoc(doc(db, 'rides', rideId), {
            driverLocation: { lat: nextCoord[0], lng: nextCoord[1] },
            updatedAt: serverTimestamp()
          });
          stepIdx += 2; // Move 2 steps at a time for smooth pace
        } else {
          console.log("[Simulation] Mock Driver arrived at pickup!");
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;

          await updateDoc(doc(db, 'rides', rideId), {
            status: 'driver_arrived',
            driverLocation: { lat: ride.pickup.lat, lng: ride.pickup.lng },
            updatedAt: serverTimestamp()
          });
        }
      }, 1500);

      return () => {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
      };
    }

    // Phase 3: Wait at pickup, then auto-start trip after 5 seconds
    if (ride.status === 'driver_arrived') {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

      const startTripTimer = setTimeout(async () => {
        console.log("[Simulation] Auto-starting trip to destination...");
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'on_trip',
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }, 5000);

      return () => clearTimeout(startTripTimer);
    }

    // Phase 4: Active Trip (Moving towards Destination)
    if (ride.status === 'on_trip') {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

      let tripCoords: [number, number][] = [];
      if (ride.routeCoords && Array.isArray(ride.routeCoords) && ride.routeCoords.length > 0) {
        tripCoords = ride.routeCoords.map((c: any) => {
          if (Array.isArray(c)) return [Number(c[0]), Number(c[1])];
          return [Number(c.lat), Number(c.lng)];
        });
      }

      if (tripCoords.length === 0) {
        tripCoords = generateSimulatedRoads(
          [ride.pickup.lat, ride.pickup.lng],
          [ride.destination.lat, ride.destination.lng]
        );
      }

      let currentIdx = 0;
      if (ride.driverLocation) {
        let minD = Infinity;
        for (let i = 0; i < tripCoords.length; i++) {
          const d = Math.hypot(tripCoords[i][0] - ride.driverLocation.lat, tripCoords[i][1] - ride.driverLocation.lng);
          if (d < minD) {
            minD = d;
            currentIdx = i;
          }
        }
      }

      console.log(`[Simulation] Active trip started. Steps: ${tripCoords.length}. Resuming index: ${currentIdx}`);

      simulationIntervalRef.current = setInterval(async () => {
        if (currentIdx < tripCoords.length) {
          const nextCoord = tripCoords[currentIdx];

          await updateDoc(doc(db, 'rides', rideId), {
            driverLocation: { lat: nextCoord[0], lng: nextCoord[1] },
            updatedAt: serverTimestamp()
          });
          currentIdx += 2;
        } else {
          console.log("[Simulation] Reached destination!");
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;

          await updateDoc(doc(db, 'rides', rideId), {
            status: 'completed',
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }, 1500);

      return () => {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
      };
    }

  }, [ride?.id, ride?.status, isSearching]);

  return { isSearching };
}
