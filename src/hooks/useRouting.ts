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

export function generateSimulatedRoads(start: [number, number], end: [number, number]): [number, number][] {
  const lat1 = start[0];
  const lng1 = start[1];
  const lat2 = end[0];
  const lng2 = end[1];

  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return [start, end];

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;

  // Interpolate smoothly every ~15 meters directly along trajectory (no 90-degree box turns)
  const numSteps = Math.max(2, Math.floor(dist / 15));
  const route: [number, number][] = [];

  for (let k = 0; k <= numSteps; k++) {
    const r = k / numSteps;
    route.push([
      lat1 + dLat * r,
      lng1 + dLng * r
    ]);
  }

  return route;
}

export function interpolatePoints(coords: [number, number][], intervalMeters = 15): [number, number][] {
  if (!coords || coords.length < 2) return coords;

  const result: [number, number][] = [];
  result.push(coords[0]);

  const getDistMeters = (p1: [number, number], p2: [number, number]) => {
    const R = 6371000; // meters
    const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
    const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1[0] * Math.PI) / 180) *
        Math.cos((p2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];

    const dist = getDistMeters(start, end);
    if (dist <= intervalMeters) {
      result.push(end);
      continue;
    }

    const numSteps = Math.max(2, Math.floor(dist / intervalMeters));
    const latDiff = end[0] - start[0];
    const lngDiff = end[1] - start[1];

    for (let k = 1; k < numSteps; k++) {
      const r = k / numSteps;
      result.push([
        start[0] + latDiff * r,
        start[1] + lngDiff * r
      ]);
    }
    result.push(end);
  }

  // Deduplicate consecutive coordinates
  const uniqueResult: [number, number][] = [];
  for (const c of result) {
    if (uniqueResult.length === 0) {
      uniqueResult.push(c);
    } else {
      const last = uniqueResult[uniqueResult.length - 1];
      if (Math.abs(last[0] - c[0]) > 1e-7 || Math.abs(last[1] - c[1]) > 1e-7) {
        uniqueResult.push(c);
      }
    }
  }

  return uniqueResult;
}

export function useRouting(pickup: [number, number], destination: [number, number], enableSlicing: boolean = false): RouteData {
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

  const lastFetchingPositionRef = useRef<[number, number] | null>(null);
  const lastFetchingDestinationRef = useRef<[number, number] | null>(null);

  const lat1 = pickup ? Number(pickup[0]) : NaN;
  const lng1 = pickup ? Number(pickup[1]) : NaN;
  const lat2 = destination ? Number(destination[0]) : NaN;
  const lng2 = destination ? Number(destination[1]) : NaN;

  useEffect(() => {
    if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return;

    const currentPickup: [number, number] = [lat1, lng1];
    const currentDest: [number, number] = [lat2, lng2];

    // Helper to calculate distance in meters
    const getDistMeters = (p1: [number, number], p2: [number, number]) => {
      const R = 6371000; // meters
      const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
      const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1[0] * Math.PI) / 180) *
          Math.cos((p2[0] * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const fetchRoute = async () => {
      // Check if we already have an in-flight fetch for almost the exact same path to prevent request loops
      if (lastFetchingPositionRef.current && lastFetchingDestinationRef.current) {
        const distPickup = getDistMeters(currentPickup, lastFetchingPositionRef.current);
        const distDest = getDistMeters(currentDest, lastFetchingDestinationRef.current);
        if (distPickup < 30 && distDest < 30) {
          return;
        }
      }

      // Check cache/rate-limiting first
      if (lastFetchedRef.current) {
        const distPickup = getDistMeters(currentPickup, lastFetchedRef.current.pickup);
        const distDest = getDistMeters(currentDest, lastFetchedRef.current.destination);

        // If the coordinate shifts are extremely tiny (less than 2.5 meters), bypass to avoid useless API requests
        if (distDest < 2.5 && distPickup < 2.5 && lastFetchedRef.current.data.routeCoords.length > 0) {
          return;
        }

        // Only perform slicing optimization if requested (useful for driver live positioning)
        if (enableSlicing) {
          // If the destination is identical (or shifted less than 50 meters)
          if (distDest < 50 && lastFetchedRef.current.data.routeCoords.length > 0) {
            // Find the index of the point on the cached route that is closest to our new pickup (current position)
            const cachedCoords = lastFetchedRef.current.data.routeCoords;
            let minDistance = Infinity;
            let closestIndex = 0;

            for (let i = 0; i < cachedCoords.length; i++) {
              const dist = getDistMeters(currentPickup, cachedCoords[i]);
              if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
              }
            }

            // If the closest point is within 500 meters, we can slice off the portion of the route we already covered!
            if (minDistance < 500) {
              const slicedCoords = cachedCoords.slice(closestIndex);

              // Adjust step directions if available to reflect sliced steps
              const cachedSteps = lastFetchedRef.current.data.steps;
              const slicedSteps = cachedSteps.filter((s) => {
                const distToStep = getDistMeters(currentPickup, s.location);
                return distToStep > 30; // steps further than 30m ahead
              });

              const nextData: RouteData = {
                routeCoords: slicedCoords.length > 0 ? slicedCoords : [[lat1, lng1]],
                totalDistance: Math.max(0, lastFetchedRef.current.data.totalDistance - closestIndex * 15),
                totalDuration: Math.max(0, lastFetchedRef.current.data.totalDuration - closestIndex * 2),
                steps: slicedSteps,
                isLoading: false,
                error: null,
              };

              setData(nextData);

              // Update lastfetched ref but preserve original full route coordinates for subsequent slicing!
              lastFetchedRef.current = {
                pickup: currentPickup,
                destination: currentDest,
                data: {
                  ...nextData,
                  routeCoords: cachedCoords, // Keep original complete route coords so if we continue moving we can slice again from it!
                },
                time: Date.now(),
              };
              return;
            }
          }
        }
      }

      // Record in-flight fetch coordinates
      lastFetchingPositionRef.current = currentPickup;
      lastFetchingDestinationRef.current = currentDest;

      // Initialize route with simulated roads grid immediately so we never have layout jumps or straight line flashes!
      setData((prev) => {
        // ONLY generate a fresh simulated route if we don't have RouteCoords yet OR if the destination has shifted significantly
        const hasPrevCoords = prev.routeCoords && prev.routeCoords.length > 0;
        const destShifted = lastFetchedRef.current
          ? getDistMeters(currentDest, lastFetchedRef.current.destination) > 100
          : true;

        if (hasPrevCoords && !destShifted) {
          return {
            ...prev,
            isLoading: true,
            error: null,
          };
        }

        const initialSimRoute = generateSimulatedRoads(currentPickup, currentDest);
        return {
          ...prev,
          routeCoords: initialSimRoute,
          isLoading: true,
          error: null,
        };
      });

      try {
        // OSRM expects [lon, lat]
        const pickupStr = `${lng1},${lat1}`;
        const destStr = `${lng2},${lat2}`;
        const url = `/api/geo/route?coords=${encodeURIComponent(pickupStr + ";" + destStr)}`;

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`[useRouting] HTTP error fetching route: ${response.status} ${response.statusText}`);
          throw new Error(`OSRM request failed with HTTP ${response.status}`);
        }
        let json = await response.json();

        // If the server-side API returned a simulated fallback because it was blocked or failed,
        // we attempt to fetch directly from the user's browser, which has a clean residential/mobile IP!
        if (json.isFallback) {
          console.log("[useRouting] Server proxy returned a fallback route. Attempting DIRECT client-side browser fetch instead...");
          const directUrls = [
            `https://router.project-osrm.org/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `https://routing.openstreetmap.de/routed-car/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `http://router.project-osrm.org/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `http://routing.openstreetmap.de/routed-car/route/v1/driving/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `http://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`,
            `http://routing.openstreetmap.de/routed-foot/route/v1/foot/${pickupStr};${destStr}?overview=full&geometries=geojson&steps=true`
          ];

          for (const directUrl of directUrls) {
            try {
              console.log(`[useRouting] Trying direct browser fetch: ${directUrl}`);
              const clientRes = await fetch(directUrl);
              if (clientRes.ok) {
                const clientJson = await clientRes.json();
                if (clientJson && clientJson.code === "Ok" && clientJson.routes && clientJson.routes.length > 0) {
                  console.log(`[useRouting] Browser DIRECT fetch succeeded! Real street route found via ${directUrl}`);
                  json = clientJson;
                  break;
                }
              }
            } catch (errDirect) {
              console.warn(`[useRouting] Direct browser fetch failed for URL ${directUrl}:`, errDirect);
            }
          }
        }

        if (json.code !== "Ok" || !json.routes || json.routes.length === 0) {
          console.error(`[useRouting] OSRM service returned invalid code or empty routes:`, json);
          throw new Error("No route found from API");
        }

        const route = json.routes[0];
        // Coordinates in OSRM GeoJSON are [lon, lat], Leaflet needs [lat, lon]
        const coords: [number, number][] = route.geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]] as [number, number],
        );

        console.log(`[useRouting] Successfully fetched route from API! Coordinates length: ${coords.length}`);

        // Ensure the route connects exactly to the pickup and destination points only if they are reasonably close (under 500 meters)
        // This avoids creating long straight-line diagonal connectors that cross buildings/off-road terrain
        if (coords.length > 0) {
          const firstDist = getDistMeters(currentPickup, coords[0]);
          if (firstDist > 1 && firstDist < 500) {
            coords.unshift(currentPickup);
          }
          const lastDist = getDistMeters(currentDest, coords[coords.length - 1]);
          if (lastDist > 1 && lastDist < 500) {
            coords.push(currentDest);
          }
        }

        const interpolatedCoords = interpolatePoints(coords);

        // Process steps if available
        const steps: RouteStep[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((step: any) => {
            steps.push({
              distance: step.distance,
              duration: step.duration,
              instruction: step.maneuver.type + " " + (step.name || ""),
              location: [step.maneuver.location[1], step.maneuver.location[0]],
            });
          });
        }

        const nextData: RouteData = {
          routeCoords: interpolatedCoords,
          totalDistance: route.distance,
          totalDuration: route.duration,
          steps,
          isLoading: false,
          error: null,
        };

        setData(nextData);
        lastFetchedRef.current = {
          pickup: currentPickup,
          destination: currentDest,
          data: nextData,
          time: Date.now(),
        };
      } catch (err: any) {
        console.error("[useRouting] Real OSRM failed! Retaining simulated roads fallback. Error detail:", err);
        // Retain beautiful simulated grids on fail instead of blanking out or creating straight line jumps!
        setData((prev) => ({
          ...prev,
          routeCoords: generateSimulatedRoads(currentPickup, currentDest),
          isLoading: false,
          error: err.message || "Unknown routing failure",
        }));
      }
    };

    fetchRoute();
  }, [lat1, lng1, lat2, lng2, enableSlicing]);

  return data;
}
