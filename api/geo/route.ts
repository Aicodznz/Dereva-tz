import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper functions for straight-line georouting fallback
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

function estimateDistanceMultiple(pairs: number[][]): number {
  let total = 0;
  for (let i = 0; i < pairs.length - 1; i++) {
    total += calculateDistance(pairs[i][1], pairs[i][0], pairs[i + 1][1], pairs[i + 1][0]);
  }
  return total;
}

function generateStraightLineRoute(pairs: number[][]) {
  if (pairs.length < 2) {
    return {
      code: "Ok",
      isFallback: true,
      routes: [{
        geometry: { coordinates: pairs, type: "LineString" },
        legs: [{ summary: "Kituo kimoja", duration: 0, distance: 0, steps: [] }]
      }],
      waypoints: []
    };
  }

  const polylinePoints: number[][] = [];
  const customSteps: any[] = [];
  let totalDist = 0;

  // Process each consecutive segment and add simulated block-by-block street turns
  for (let segmentIdx = 0; segmentIdx < pairs.length - 1; segmentIdx++) {
    const start = pairs[segmentIdx];
    const end = pairs[segmentIdx + 1];

    const lng1 = start[0];
    const lat1 = start[1];
    const lng2 = end[0];
    const lat2 = end[1];

    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;

    // Define local corners for direct path interpolation
    const segmentCorners: number[][] = [];
    segmentCorners.push(start);

    const absDLng = Math.abs(dLng);
    const absDLat = Math.abs(dLat);

    if (absDLng > 0.00015 && absDLat > 0.00015) {
      if (absDLng > absDLat) {
        // Travel 60% of longitude first (lng, lat)
        const midLng = lng1 + dLng * 0.6;
        segmentCorners.push([midLng, lat1]);
        segmentCorners.push([midLng, lat2]);
      } else {
        // Travel 60% of latitude first
        const midLat = lat1 + dLat * 0.6;
        segmentCorners.push([lng1, midLat]);
        segmentCorners.push([lng2, midLat]);
      }
    }
    segmentCorners.push(end);

    const dist = calculateDistance(lat1, lng1, lat2, lng2);

    // Interpolate points along these street corners to make the line perfectly smooth and detailed
    const segmentInterp: number[][] = [];
    for (let i = 0; i < segmentCorners.length - 1; i++) {
      const c1 = segmentCorners[i];
      const c2 = segmentCorners[i + 1];

      if (segmentInterp.length === 0 || 
          segmentInterp[segmentInterp.length - 1][0] !== c1[0] || 
          segmentInterp[segmentInterp.length - 1][1] !== c1[1]) {
        segmentInterp.push(c1);
      }

      const subDist = calculateDistance(c1[1], c1[0], c2[1], c2[0]);
      // Interpolate every ~15-20 meters for a smooth animation sequence
      const numSteps = Math.max(1, Math.floor(subDist / 18));
      for (let k = 1; k < numSteps; k++) {
        const ratio = k / numSteps;
        segmentInterp.push([
          c1[0] + (c2[0] - c1[0]) * ratio,
          c1[1] + (c2[1] - c1[1]) * ratio
        ]);
      }
    }
    segmentInterp.push(end);

    // Append coordinates
    segmentInterp.forEach(pt => {
      if (polylinePoints.length === 0 || 
          polylinePoints[polylinePoints.length - 1][0] !== pt[0] || 
          polylinePoints[polylinePoints.length - 1][1] !== pt[1]) {
        polylinePoints.push(pt);
      }
    });

    // Calculate distance for this segment
    const segmentDistance = estimateDistanceMultiple(segmentInterp);
    totalDist += segmentDistance;

    // Construct steps with Swahili directions
    const stepDuration = segmentDistance / 8.3; // ~30 km/h in city traffic
    for (let idx = 0; idx < segmentCorners.length; idx++) {
      const p = segmentCorners[idx];
      let info = "Endelea mbele barabarani";
      let type = "turn";

      if (segmentIdx === 0 && idx === 0) {
        info = "Anza safari, nenda mbele kuelekea barabara kuu";
        type = "depart";
      } else if (segmentIdx === pairs.length - 2 && idx === segmentCorners.length - 1) {
        info = "Umekaribia kufika kituo cha mteja, nenda mbele polepole";
        type = "arrive";
      } else if (idx > 0 && idx < segmentCorners.length - 1) {
        const prev = segmentCorners[idx - 1];
        const next = segmentCorners[idx + 1] || end;
        // Determine cross product sign to detect turn direction (left or right)
        const v1 = [prev[0] - p[0], prev[1] - p[1]];
        const v2 = [next[0] - p[0], next[1] - p[1]];
        const cross = v1[0] * v2[1] - v1[1] * v2[0];
        info = Math.abs(cross) > 1e-10 
          ? (cross > 0 ? "Kunja kulia barabarani" : "Kunja kushoto barabarani")
          : "Nenda moja kwa moja kufuata barabara";
      }

      customSteps.push({
        distance: segmentDistance / segmentCorners.length,
        duration: stepDuration / segmentCorners.length,
        geometry: {
          coordinates: [p],
          type: "Point"
        },
        name: info,
        mode: "driving",
        maneuver: {
          location: p,
          bearing_before: 0,
          bearing_after: 0,
          type: type
        }
      });
    }
  }

  const estDuration = totalDist / 8.3; // ~30 km/h in urban streets

  return {
    code: "Ok",
    isFallback: true,
    routes: [
      {
        geometry: {
          coordinates: polylinePoints,
          type: "LineString"
        },
        legs: [
          {
            summary: "Barabara ya mjini (Dar es Salaam Street Route)",
            weight: estDuration,
            duration: estDuration,
            distance: totalDist,
            steps: customSteps
          }
        ],
        weight_name: "routability",
        weight: estDuration,
        duration: estDuration,
        distance: totalDist
      }
    ],
    waypoints: pairs.map(p => ({
      hint: "",
      distance: 0,
      name: "",
      location: p
    }))
  };
}

const routeCache = new Map<string, any>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { coords } = req.query; // format: lng,lat;lng,lat

  if (!coords || typeof coords !== "string" || !coords.includes(",")) {
    return res.status(400).json({ error: "Invalid coordinates format. Expected lng,lat;lng,lat" });
  }

  let coordsPairs: number[][] = [];
  try {
    coordsPairs = coords.split(";").map(pair => {
       const parts = pair.split(",");
       return [parseFloat(parts[0]), parseFloat(parts[1])]; // [lng, lat]
    });
  } catch (e: any) {
    console.log("[Proxy] Info: Parsing coords pair skipped:", e?.message || e);
  }

  if (coordsPairs.length < 2) {
    return res.status(400).json({ error: "Missing source or destination coordinates" });
  }

  const cacheKey = coordsPairs.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(";");
  if (routeCache.has(cacheKey)) {
    return res.status(200).json(routeCache.get(cacheKey));
  }

  const encodedCoords = coordsPairs.map(p => `${p[0]},${p[1]}`).join(";");

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const raceServices = async (urls: string[], timeoutMs = 3500): Promise<{ data: any, source: string }> => {
    const fetchOne = async (url: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          headers,
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Invalid Content-Type");
        }
        const json = await res.json();
        if (json && json.code === "Ok") {
          return { data: json, source: url };
        }
        throw new Error(`JSON code non-Ok: ${json?.code}`);
      } catch (e: any) {
        throw new Error(`Failed url ${url}: ${e.message}`);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      return await Promise.any(urls.map(url => fetchOne(url)));
    } catch (err) {
      throw new Error("All raced endpoints failed");
    }
  };

  const carUrls = [
    `https://router.project-osrm.org/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `http://router.project-osrm.org/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `http://routing.openstreetmap.de/routed-car/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `http://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
    `http://routing.openstreetmap.de/routed-foot/route/v1/foot/${encodedCoords}?overview=full&geometries=geojson&steps=true`
  ];

  try {
    const winner = await raceServices(carUrls, 12000);
    routeCache.set(cacheKey, winner.data);
    return res.status(200).json(winner.data);
  } catch (eCar) {
    if (coordsPairs.length >= 2) {
      try {
        const p1 = coordsPairs[0];
        const p2 = coordsPairs[coordsPairs.length - 1];
        const brouterUrl = `https://brouter.de/brouter?lon1=${p1[0]}&lat1=${p1[1]}&lon2=${p2[0]}&lat2=${p2[1]}&profile=car-fast&alternativeidx=0&format=geojson`;
        
        const bRes = await fetch(brouterUrl, { headers });
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData && bData.features && bData.features.length > 0) {
            const feat = bData.features[0];
            const coordinates = feat.geometry.coordinates; // array of [lng, lat]
            const totalDistance = parseFloat(feat.properties["track-length"] || "0");
            const totalDuration = parseFloat(feat.properties["total-time"] || "0");
            
            const brouterFallbackData = {
              code: "Ok",
              routes: [
                {
                  geometry: {
                    coordinates: coordinates,
                    type: "LineString"
                  },
                  legs: [
                    {
                      summary: "Barabara kuu (Real Street Route via BRouter)",
                      weight: totalDuration,
                      duration: totalDuration,
                      distance: totalDistance,
                      steps: []
                    }
                  ],
                  weight_name: "routability",
                  weight: totalDuration,
                  duration: totalDuration,
                  distance: totalDistance
                }
              ],
              waypoints: [
                {
                  hint: "",
                  distance: 0,
                  name: "Mwanzo",
                  location: p1
                },
                {
                  hint: "",
                  distance: 0,
                  name: "Mwisho",
                  location: p2
                }
              ]
            };
            
            routeCache.set(cacheKey, brouterFallbackData);
            return res.status(200).json(brouterFallbackData);
          }
        }
      } catch (errBrouter: any) {
        console.log(`[Proxy] Info: BRouter fallback not active or timed out`);
      }
    }

    if (coordsPairs.length >= 2) {
      const altUrls = [
        `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
        `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
        `http://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`
      ];
      try {
        const winner = await raceServices(altUrls, 8000);
        routeCache.set(cacheKey, winner.data);
        return res.status(200).json(winner.data);
      } catch (errAlt: any) {
        console.log(`[Proxy] Info: Secondary profiles not active or timed out`);
      }
    }

    if (coordsPairs.length >= 2) {
      const fallbackData = generateStraightLineRoute(coordsPairs);
      routeCache.set(cacheKey, fallbackData);
      return res.status(200).json(fallbackData);
    } else {
      return res.status(502).json({ error: "Could not fetch or generate routing data." });
    }
  }
}
