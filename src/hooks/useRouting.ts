import { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (!pickup || !destination) return;

    const fetchRoute = async () => {
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

        setData({
          routeCoords: coords,
          totalDistance: route.distance,
          totalDuration: route.duration,
          steps,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        setData(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    };

    fetchRoute();
  }, [pickup[0], pickup[1], destination[0], destination[1]]);

  return data;
}
