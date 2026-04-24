import { useState, useEffect } from 'react';

export interface RouteData {
  routeCoords: [number, number][];
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  isLoading: boolean;
  error: string | null;
}

export function useRouting(pickup: [number, number], destination: [number, number]): RouteData {
  const [data, setData] = useState<RouteData>({
    routeCoords: [],
    totalDistance: 0,
    totalDuration: 0,
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
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('OSRM request failed');
        const json = await response.json();

        if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
          throw new Error('No route found');
        }

        const route = json.routes[0];
        // Coordinates in OSRM GeoJSON are [lon, lat], Leaflet needs [lat, lon]
        const coords: [number, number][] = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);

        setData({
          routeCoords: coords,
          totalDistance: route.distance,
          totalDuration: route.duration,
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
