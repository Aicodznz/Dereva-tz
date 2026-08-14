import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Ride } from '../types/trip.types';
import { generateSimulatedRoads, interpolatePoints } from './useRouting';
import { optimizePapoShareSequence, calculateDistanceBasedPapoShareFare } from '../services/papoShareEngine';

function getBearing(startLat: number, startLng: number, endLat: number, endLng: number): number {
  const radians = Math.PI / 180;
  const dLngRad = (endLng - startLng) * radians;
  const lat1Rad = startLat * radians;
  const lat2Rad = endLat * radians;
  
  const y = Math.sin(dLngRad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLngRad);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export function useMatchmaking(ride: Ride | null) {
  const [isSearching, setIsSearching] = useState(false);
  const [isTakeoverActive, setIsTakeoverActive] = useState(false);
  
  const simulationIntervalRef = useRef<any>(null);
  const rideRef = useRef<Ride | null>(ride);
  
  const lastRealLocationUpdateRef = useRef<number>(Date.now());
  const lastLocationRef = useRef<{ lat: number, lng: number } | null>(null);
  const lastSimulatedCoordsRef = useRef<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    rideRef.current = ride;
  }, [ride]);

  const isMockDriver = ride?.driverId === 'mock_driver_123';

  // Watchdog timer to monitor driver inactivity (ONLY for mock drivers)
  useEffect(() => {
    if (!ride) {
      setIsTakeoverActive(false);
      return;
    }
    if (isMockDriver) {
      setIsTakeoverActive(true);
      return;
    }

    // Completely disable simulation/takeover writes for real drivers
    setIsTakeoverActive(false);
  }, [ride?.id, ride?.status, isMockDriver]);

  // Monitor location changes to reset watchdog timer
  useEffect(() => {
    if (ride?.driverLocation) {
      const { lat, lng } = ride.driverLocation;
      const simulated = lastSimulatedCoordsRef.current;
      
      // Check if this incoming coordinate is exactly our simulated coordinate (to avoid counting our own writes)
      const isOurSimulation = simulated && Math.abs(simulated.lat - lat) < 0.00001 && Math.abs(simulated.lng - lng) < 0.00001;
      
      if (!isOurSimulation) {
        lastRealLocationUpdateRef.current = Date.now();
        if (!isMockDriver && isTakeoverActive) {
          console.log("[Watchdog] Received real driver GPS coordinate. Suspending client-side simulation takeover.");
          setIsTakeoverActive(false);
        }
      }
    }
  }, [ride?.driverLocation?.lat, ride?.driverLocation?.lng, isMockDriver]);

  useEffect(() => {
    if (!ride) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    const rideId = ride.id;

    // Phase 1: Pending Matchmaking -> Auto-assign Mock Driver ONLY IF no real drivers are online
    if (ride.status === 'pending') {
      if (isSearching) return;
      setIsSearching(true);

      const timer = setTimeout(async () => {
        try {
          // Check if ANY real drivers are online in the 'drivers' collection
          const qOnline = query(
            collection(db, 'drivers'),
            where('isOnline', '==', true)
          );
          const snapOnline = await getDocs(qOnline);

          const qStatus = query(
            collection(db, 'drivers'),
            where('status', '==', 'online')
          );
          const snapStatus = await getDocs(qStatus);

          const onlineDocs = [...snapOnline.docs, ...snapStatus.docs];
          if (onlineDocs.length > 0) {
            console.log("[Matchmaking] Real online drivers found. Leaving request pending for manual acceptance by nearby driver.");
            return;
          }

          console.log("[Simulation] No real online drivers found. Automatching mock driver for simulation fallback...");
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

          let papoShareData: Record<string, any> = {};

          if (ride.shareMode === 'share') {
            const customerNameA = (ride as any).customerInfo?.name || 'Mteja A';
            const riderNameB = ride.womenOnlySharing ? 'Neema Mwajuma' : 'Baraka Ally';
            const midLat = (pickupLat + ride.destination.lat) / 2;
            const midLng = (pickupLng + ride.destination.lng) / 2;

            // Coordinate for rider B along the corridor
            const pickupB = {
              lat: midLat + 0.002,
              lng: midLng - 0.002,
              address: 'Kituo cha Kati (Njiani)',
            };
            const dropB = {
              lat: ride.destination.lat - 0.003,
              lng: ride.destination.lng + 0.002,
              address: 'Kituo cha Kushukia B',
            };

            const sequenceOpt = optimizePapoShareSequence({
              pickupA: ride.pickup,
              dropA: ride.destination,
              riderNameA: customerNameA,
              riderIdA: ride.customerId || 'rider_a',
              pickupB,
              dropB,
              riderNameB,
              riderIdB: 'rider_b_matched',
              durationA_Min: Number(ride.duration) || 15,
            });

            papoShareData = {
              poolStatus: 'matched',
              sharedRidersCount: 2,
              sharedRiders: [
                {
                  riderId: ride.customerId || 'rider_a',
                  riderName: customerNameA,
                  pickup: ride.pickup,
                  destination: ride.destination,
                  role: 'primary',
                },
                {
                  riderId: 'rider_b_matched',
                  riderName: riderNameB,
                  pickup: pickupB,
                  destination: dropB,
                  role: 'pooled',
                  fare: Math.round(ride.fare * 0.7),
                },
              ],
              waypoints: sequenceOpt.optimalSequence,
              detourMinutes: sequenceOpt.detourMinutesForA,
              maxDetourBudgetMinutes: sequenceOpt.maxDetourBudgetMinutes,
              chosenSequencePattern: sequenceOpt.chosenPattern,
            };
          } else if (ride.vehicleType === 'bike' && ride.shareMode === 'parcel_addon') {
            papoShareData = {
              parcelAddon: {
                id: `pkg-${Date.now().toString().slice(-4)}`,
                senderName: 'Duka la Vifaa Dar',
                recipientName: 'Mhandisi John',
                packageType: 'Bahasha ya Nyaraka',
                pickup: {
                  lat: pickupLat + 0.001,
                  lng: pickupLng + 0.001,
                  address: 'Mbele ya Kituo (Mita 200)',
                },
                delivery: {
                  lat: ride.destination.lat - 0.001,
                  lng: ride.destination.lng - 0.001,
                  address: 'Karibu na Eneo la Kushuka',
                },
                bonusEarningsTZS: 2500,
                detourMinutes: 1,
              },
            };
          }

          lastSimulatedCoordsRef.current = { lat: driverStartLat, lng: driverStartLng };
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'accepted',
            driverId: 'mock_driver_123',
            driverInfo: mockDriverInfo,
            driverLocation: { lat: driverStartLat, lng: driverStartLng },
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...papoShareData,
          });
        } catch (error) {
          console.error("[Simulation] Failed to match mock driver:", error);
        } finally {
          setIsSearching(false);
        }
      }, 15000); // 15-second grace period before fallback simulation if no real drivers online

      return () => clearTimeout(timer);
    }

    // Only run simulation if the assigned driver is the mock driver OR if client-side takeover is active
    if (!isTakeoverActive) {
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

      const runSimulation = (coords: [number, number][]) => {
        let stepIdx = 0;
        console.log(`[Simulation] Starting approach simulation to pickup. Route steps: ${coords.length}`);

        simulationIntervalRef.current = setInterval(async () => {
          if (stepIdx < coords.length) {
            const nextCoord = coords[stepIdx];
            let heading = 0;
            if (stepIdx > 0) {
              const prevCoord = coords[Math.max(0, stepIdx - 1)];
              heading = getBearing(prevCoord[0], prevCoord[1], nextCoord[0], nextCoord[1]);
            } else {
              heading = getBearing(driverPos.lat, driverPos.lng, nextCoord[0], nextCoord[1]);
            }
            
            lastSimulatedCoordsRef.current = { lat: nextCoord[0], lng: nextCoord[1] };
            await updateDoc(doc(db, 'rides', rideId), {
              driverLocation: { lat: nextCoord[0], lng: nextCoord[1], heading },
              updatedAt: serverTimestamp()
            });
            stepIdx += 1; // Move 1 step at a time every 1.1s for realistic ~54 km/h urban speed
          } else {
            console.log("[Simulation] Mock Driver arrived at pickup!");
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;

            const finalHeading = coords.length > 1 
              ? getBearing(coords[coords.length - 2][0], coords[coords.length - 2][1], ride.pickup.lat, ride.pickup.lng)
              : 0;

            lastSimulatedCoordsRef.current = { lat: ride.pickup.lat, lng: ride.pickup.lng };
            await updateDoc(doc(db, 'rides', rideId), {
              status: 'driver_arrived',
              driverLocation: { lat: ride.pickup.lat, lng: ride.pickup.lng, heading: finalHeading },
              updatedAt: serverTimestamp()
            });
          }
        }, 1100);
      };

      // Fetch real routing coordinates asynchronously
      const fetchRealApproach = async () => {
        const pickupStr = `${ride.pickup.lng},${ride.pickup.lat}`;
        const startStr = `${driverPos.lng},${driverPos.lat}`;
        const url = `/api/geo/route?coords=${encodeURIComponent(startStr + ";" + pickupStr)}`;

        try {
          const res = await fetch(url);
          if (res.ok) {
            let json = await res.json();
            if (json.isFallback) {
              const directUrls = [
                `https://router.project-osrm.org/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`,
                `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`,
                `http://router.project-osrm.org/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`,
                `http://routing.openstreetmap.de/routed-car/route/v1/driving/${startStr};${pickupStr}?overview=full&geometries=geojson&steps=true`
              ];
              for (const directUrl of directUrls) {
                try {
                  const clientRes = await fetch(directUrl);
                  if (clientRes.ok) {
                    const clientJson = await clientRes.json();
                    if (clientJson && clientJson.code === "Ok" && clientJson.routes && clientJson.routes.length > 0) {
                      json = clientJson;
                      break;
                    }
                  }
                } catch (e) {
                  console.warn("Direct approach fetch failed in matchmaking:", e);
                }
              }
            }

            if (json.code === "Ok" && json.routes && json.routes.length > 0) {
              const route = json.routes[0];
              const coords: [number, number][] = route.geometry.coordinates.map(
                (c: number[]) => [c[1], c[0]] as [number, number]
              );
              if (coords.length > 0) {
                console.log("[Simulation] Successfully fetched real roads for driver approach route!");
                const interpolated = interpolatePoints(coords);
                runSimulation(interpolated);
                return;
              }
            }
          }
        } catch (e) {
          console.error("[Simulation] Failed to fetch real approach route:", e);
        }

        // Fallback simulated roads
        const fallbackRoute = generateSimulatedRoads(
          [driverPos.lat, driverPos.lng],
          [ride.pickup.lat, ride.pickup.lng]
        );
        runSimulation(fallbackRoute);
      };

      fetchRealApproach();

      return () => {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
      };
    }

    // Phase 3: Wait at pickup, then auto-start trip after 4 seconds
    if (ride.status === 'driver_arrived') {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

      const startTripTimer = setTimeout(async () => {
        console.log("[Simulation] Auto-starting trip to destination...");
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'on_trip',
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }, 4000);

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

      const interpolatedTripCoords = interpolatePoints(tripCoords);

      let currentIdx = 0;
      if (ride.driverLocation) {
        let minD = Infinity;
        for (let i = 0; i < interpolatedTripCoords.length; i++) {
          const d = Math.hypot(interpolatedTripCoords[i][0] - ride.driverLocation.lat, interpolatedTripCoords[i][1] - ride.driverLocation.lng);
          if (d < minD) {
            minD = d;
            currentIdx = i;
          }
        }
      }

      console.log(`[Simulation] Active trip started. Steps: ${interpolatedTripCoords.length}. Resuming index: ${currentIdx}`);

      simulationIntervalRef.current = setInterval(async () => {
        // Pause active movement if client is in the middle of a route recalculation
        if ((rideRef.current as any)?.isRerouting === true) {
          console.log("[Simulation] Suspended movement tick: waiting for client rerouting...");
          return;
        }

        if (currentIdx < interpolatedTripCoords.length) {
          const nextCoord = interpolatedTripCoords[currentIdx];

          // Simulate automatic driver deviation (taking a different turn) at ~35% of the journey
          const hasDeviatedFlag = (rideRef.current as any)?.hasDeviated === true;
          if (!hasDeviatedFlag && currentIdx >= Math.floor(interpolatedTripCoords.length * 0.35) && currentIdx <= Math.floor(interpolatedTripCoords.length * 0.42)) {
            console.log("[Simulation] Driver is changing path/turning on another road! Simulating deviation...");
            const devLat = nextCoord[0] + 0.0022; // shift 240 meters away
            const devLng = nextCoord[1] - 0.0022;
            const heading = getBearing(nextCoord[0], nextCoord[1], devLat, devLng);

            lastSimulatedCoordsRef.current = { lat: devLat, lng: devLng };
            await updateDoc(doc(db, 'rides', rideId), {
              driverLocation: { lat: devLat, lng: devLng, heading },
              hasDeviated: true,
              isRerouting: true,
              navigationMessage: "Mteja, dereva amebadilisha njia! Antway inakuelekeza upya...",
              updatedAt: serverTimestamp()
            });
            // Stop this cycle, wait for reroute coordinates to update
            return;
          }

          let heading = 0;
          if (currentIdx > 0) {
            const prevCoord = interpolatedTripCoords[Math.max(0, currentIdx - 1)];
            heading = getBearing(prevCoord[0], prevCoord[1], nextCoord[0], nextCoord[1]);
          } else if (ride.driverLocation) {
            heading = getBearing(ride.driverLocation.lat, ride.driverLocation.lng, nextCoord[0], nextCoord[1]);
          }

          lastSimulatedCoordsRef.current = { lat: nextCoord[0], lng: nextCoord[1] };
          await updateDoc(doc(db, 'rides', rideId), {
            driverLocation: { lat: nextCoord[0], lng: nextCoord[1], heading },
            updatedAt: serverTimestamp()
          });
          currentIdx += 1; // Advance 1 index per tick every 1.1s for realistic ~54 km/h urban speed
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
      }, 1100);

      return () => {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
          simulationIntervalRef.current = null;
        }
      };
    }

  }, [ride?.id, ride?.status, isSearching, isTakeoverActive, ride?.routeCoords ? JSON.stringify(ride.routeCoords) : '']);

  return { isSearching };
}
