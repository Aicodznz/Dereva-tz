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
        const secsPassed = (Date.now() - lastFetchedRef.current.time) / 1000;

        // If pickup shifted less than 80m, destination is same, and let's say less than 20s passed,
        // we can reuse the existing route, just slicing off passed points if needed.
        if (distPickup < 80 && distDest < 10 && secsPassed < 20) {
          console.log("[useRouting] Reusing cached route coordinates. Pickup shift:", distPickup.toFixed(1), "m");
          return;
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
