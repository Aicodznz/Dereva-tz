import { useState, useEffect, useRef } from 'react';

export interface RouteStep {
  distance: number;
  duration: number;
  instruction: string;
  location: [number, number];
}

export interface RouteData {
  routeCoords: [number, number][];
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  steps: RouteStep[];
  isLoading: boolean;
  error: string | null;
}

export function useRouting(pickup: [number, number], destination: [number, number]): RouteData {
  const [data, setData] = useState<RouteData>({
    routeCoords: [],
    totalDistance: 0,
    totalDuration: 0,
    steps: [],
    isLoading: false,
    error: null,
  });

  const lastFetchedRef = useRef<{
    pickup: [number, number];
    destination: [number, number];
    data: RouteData;
    time: number;
  } | null>(null);

  useEffect(() => {
    if (!pickup || !destination) return;

    // Helper to calculate distance in meters
    const getDistMeters = (p1: [number, number], p2: [number, number]) => {
      const R = 6371000; // meters
      const dLat = (p2[0] - p1[0]) * Math.PI / 180;
      const dLon = (p2[1] - p1[1]) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const fetchRoute = async () => {
      // Check cache/rate-limiting first
      if (lastFetchedRef.current) {
        const distPickup = getDistMeters(pickup, lastFetchedRef.current.pickup);
        const distDest = getDistMeters(destination, lastFetchedRef.current.destination);

        // If the destination is identical (or shifted less than 50 meters)
        if (distDest < 50 && lastFetchedRef.current.data.routeCoords.length > 0) {
          // Find the index of the point on the cached route that is closest to our new pickup (current position)
          const cachedCoords = lastFetchedRef.current.data.routeCoords;
          let minDistance = Infinity;
          let closestIndex = 0;

          for (let i = 0; i < cachedCoords.length; i++) {
            const dist = getDistMeters(pickup, cachedCoords[i]);
            if (dist < minDistance) {
              minDistance = dist;
              closestIndex = i;
            }
          }

          // If the closest point is within 500 meters, we can slice of the portion of the route we already covered!
          if (minDistance < 500) {
            const slicedCoords = cachedCoords.slice(closestIndex);
            
            // Adjust step directions if available to reflect sliced steps
            const cachedSteps = lastFetchedRef.current.data.steps;
            const slicedSteps = cachedSteps.filter(s => {
              const distToStep = getDistMeters(pickup, s.location);
              return distToStep > 30; // steps further than 30m ahead
            });

            const nextData: RouteData = {
              routeCoords: slicedCoords.length > 0 ? slicedCoords : [[pickup[0], pickup[1]]],
              totalDistance: Math.max(0, lastFetchedRef.current.data.totalDistance - (closestIndex * 15)),
              totalDuration: Math.max(0, lastFetchedRef.current.data.totalDuration - (closestIndex * 2)),
              steps: slicedSteps,
              isLoading: false,
              error: null,
            };

            setData(nextData);
            
            // Update lastfetched ref but preserve original full route coordinates for subsequent slicing!
            lastFetchedRef.current = {
              pickup,
              destination,
              data: {
                ...nextData,
                routeCoords: cachedCoords, // Keep original complete route coords so if we continue moving we can slice again from it!
              },
              time: Date.now()
            };
            return;
          }
        }
      }

      setData(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        // OSRM expects [lon, lat]
        const pickupStr = `${pickup[1]},${pickup[0]}`;
        const destStr = `${destination[1]},${destination[0]}`;
        const url = `/api/geo/route?coords=${pickupStr};${destStr}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('OSRM request failed');
        const json = await response.json();

        if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
          throw new Error('No route found');
        }

        const route = json.routes[0];
        // Coordinates in OSRM GeoJSON are [lon, lat], Leaflet needs [lat, lon]
        const coords: [number, number][] = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);

        // Process steps if available
        const steps: RouteStep[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((step: any) => {
            steps.push({
              distance: step.distance,
              duration: step.duration,
              instruction: step.maneuver.type + ' ' + (step.name || ''),
              location: [step.maneuver.location[1], step.maneuver.location[0]]
            });
          });
        }

        const nextData: RouteData = {
          routeCoords: coords,
          totalDistance: route.distance,
          totalDuration: route.duration,
          steps,
          isLoading: false,
          error: null,
        };

        setData(nextData);
        lastFetchedRef.current = {
          pickup,
          destination,
          data: nextData,
          time: Date.now()
        };
      } catch (err: any) {
        setData(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    };

    fetchRoute();
  }, [pickup[0], pickup[1], destination[0], destination[1]]);

  return data;
}
