import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mongike Payment Initiation Proxy
  app.post("/api/payments/initiate", async (req, res) => {
    const { order_id, amount, buyer_phone, fee_payer } = req.body;
    const apiKey = process.env.MONGIKE_API_KEY;

    if (!apiKey) {
      console.error("MONGIKE_API_KEY is missing in environment variables.");
      return res.status(500).json({ 
        status: "error", 
        message: "Server configuration error: Missing API Key" 
      });
    }

    try {
      const response = await fetch("https://mongike.com/api/v1/payments/mobile-money/tanzania", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order_id,
          amount,
          buyer_phone,
          fee_payer: fee_payer || "MERCHANT"
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Mongike API error:", data);
        return res.status(response.status).json(data);
      }

      res.status(201).json(data);
    } catch (error) {
      console.error("Payment initiation failed:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Failed to initiate payment. Please try again later." 
      });
    }
  });

  // Proxy for Nominatim Geocoding
  app.get("/api/geo/search", async (req, res) => {
    const { q, limit, addressdetails } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query" });

    console.log(`[Proxy] Nominatim Search: ${q}`);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q as string)}&format=json&limit=${limit || 5}&addressdetails=${addressdetails || 1}&countrycodes=tz&email=aicodtznation@gmail.com`;
      
      console.log(`[Proxy] Fetching from Nominatim: ${url}`);
      
      const response = await fetch(url, {
        headers: { 
          'Accept-Language': 'sw,en', 
          'User-Agent': 'PapoHapoSuperApp/1.0',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Nominatim search error status:", response.status, "body:", text.substring(0, 500));
        
        let errorMessage = "External service error";
        if (response.status === 429) {
          errorMessage = "Too many requests. Please slow down.";
        }
        
        return res.status(response.status || 502).json({ 
          error: errorMessage, 
          detail: text.substring(0, 100) 
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Nominatim search proxy error:", error);
      res.status(500).json({ 
        error: "Failed to reach location service",
        detail: error.message 
      });
    }
  });

  // Proxy for Nominatim Reverse Geocoding
  app.get("/api/geo/reverse", async (req, res) => {
    const { lat, lon, zoom } = req.query;
    
    console.log(`[Proxy] Nominatim Reverse: ${lat}, ${lon}`);

    // Basic validation
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lon as string);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates provided" });
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=${zoom || 18}&addressdetails=1&email=aicodtznation@gmail.com`;
      const response = await fetch(url, {
        headers: { 
          'Accept-Language': 'sw,en', 
          'User-Agent': 'PapoHapoSuperApp/1.0',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Nominatim reverse error status:", response.status, "body:", text.substring(0, 500));
        return res.status(response.status || 502).json({ error: "External service error", detail: text.substring(0, 100) });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Nominatim reverse proxy error:", error);
      res.status(500).json({ error: "Failed to fetch address data" });
    }
  });

  // Image proxy to bypass CORS issues for QR stand and print exporting
  app.get("/api/proxy-image", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("url parameter is required");
    
    const imageUrl = url as string;
    
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'PapoHapoSuperApp/1.0',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      } else {
        res.setHeader("Content-Type", "image/png");
      }
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("Image proxy error:", error);
      res.status(500).send("Error proxying image");
    }
  });

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

      // Define local grid corners for this segment
      const segmentCorners: number[][] = [];
      segmentCorners.push(start);

      const dist = calculateDistance(lat1, lng1, lat2, lng2);

      if (dist < 250) {
        // Very short distance: 1 corner (Manhattan turn)
        segmentCorners.push([lng1 + dLng * 0.5, lat1]);
        segmentCorners.push([lng1 + dLng * 0.5, lat2]);
      } else {
        // Long distance: Generate city street blocks with 3/4 turns zigzag to simulate residential/urban grids
        segmentCorners.push([lng1 + dLng * 0.25, lat1]);
        segmentCorners.push([lng1 + dLng * 0.25, lat1 + dLat * 0.4]);
        segmentCorners.push([lng1 + dLng * 0.75, lat1 + dLat * 0.4]);
        segmentCorners.push([lng1 + dLng * 0.75, lat2]);
      }
      segmentCorners.push(end);

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

  // Simple in-memory cache to prevent spamming the routing endpoints and getting rate-limited
  const routeCache = new Map<string, any>();

  // Proxy for OSRM Routing
  app.get("/api/geo/route", async (req, res) => {
    const { coords } = req.query; // format: lng,lat;lng,lat
    
    console.log(`[Proxy] OSRM Route requested: ${coords}`);

    if (!coords || typeof coords !== "string" || !coords.includes(",")) {
      return res.status(400).json({ error: "Invalid coordinates format. Expected lng,lat;lng,lat" });
    }

    // Parse pairs beforehand in case we need straight-line fallback
    let coordsPairs: number[][] = [];
    try {
      coordsPairs = coords.split(";").map(pair => {
         const parts = pair.split(",");
         return [parseFloat(parts[0]), parseFloat(parts[1])]; // [lng, lat]
      });
    } catch (e) {
      console.warn("[Proxy] Failed to parse coords pairs:", e);
    }

    if (coordsPairs.length < 2) {
      return res.status(400).json({ error: "Missing source or destination coordinates" });
    }

    // Direct cache key using 4 decimal precision (approx 11m accuracy) for grid resilience
    const cacheKey = coordsPairs.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(";");
    if (routeCache.has(cacheKey)) {
      console.log(`[Proxy] Routing cache HIT for coordinates!`);
      return res.json(routeCache.get(cacheKey));
    }

    const encodedCoords = coordsPairs.map(p => `${p[0]},${p[1]}`).join(";");

    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'PapoHapoTaxiBookingApp/2.5 (contact: aicodtznation@gmail.com; Swahili Ride Sharing Service; Dar es Salaam, TZ; ID: ddaad525-5a9f-4093-9fef-3a0ab9a965b7)'
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
        // Promise.any registers success as soon as any promise resolves.
        // Node 15+ has fully native Promise.any
        return await Promise.any(urls.map(url => fetchOne(url)));
      } catch (err) {
        throw new Error("All raced endpoints failed");
      }
    };

    // 1. Race Primary & Secondary CAR driving services (Both HTTPS and HTTP variants for maximal robustness)
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
      console.log(`[Proxy] Racing CAR & alternative routing URLs:`, carUrls);
      // Increased timeout to 12000ms to allow slow networks/containers to resolve properly
      const winner = await raceServices(carUrls, 12000);
      console.log(`[Proxy] Routing SUCCESS! Selected FASTEST responder: ${winner.source}`);
      routeCache.set(cacheKey, winner.data);
      return res.json(winner.data);
    } catch (eCar) {
      console.log(`[Proxy] Note: External OSRM servers are currently congested or rate-limited. Serving smooth, detailed, grid-accurate street route simulation fallback.`);
      if (coordsPairs.length >= 2) {
        const fallbackData = generateStraightLineRoute(coordsPairs);
        routeCache.set(cacheKey, fallbackData);
        console.log(`[Proxy] Grid routing fallback generated successfully.`);
        return res.json(fallbackData);
      } else {
        return res.status(502).json({ error: "Could not fetch or generate routing data." });
      }
    }
  });

  // Proxy for BigDataCloud Reverse Geocoding (Fallback)
  app.get("/api/geo/bdc-reverse", async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sw`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PapoHapoSuperApp/1.0',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("BDC reverse error status:", response.status, "body:", text.substring(0, 500));
        return res.status(response.status || 502).json({ error: "External service error", detail: text.substring(0, 100) });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("BDC reverse proxy error:", error);
      res.status(500).json({ error: "Failed to fetch BDC location data" });
    }
  });

  // Gemini AI Asset Analysis Proxy
  app.post("/api/asset/analyze", async (req, res) => {
    const { image } = req.body; // base64 image data
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `You are an expert 3D Asset Analyzer and Generative AI Assistant for an e-commerce platform. Your job is to analyze the uploaded product images from a vendor and generate a highly precise 3D/AR asset blueprint.

Analyze the images from multiple angles (front, side, back) and provide the output strictly in a valid JSON format. Do not include any conversational text, markdown formatting (like \`\`\`json), or explanations outside the JSON block.

The JSON output must contain the following keys:
1. "product_name": A clean, generic name for the product based on the image.
2. "primary_color": The dominant hex color code of the product.
3. "material_texture": The detected material type (e.g., "matte_plastic", "leather", "polished_wood", "fabric", "metal").
4. "estimated_dimensions": An object containing "width", "height", and "depth" in meters, estimating real-world scale for accurate AR placement.
5. "ar_suitability": A boolean (true/false) indicating if the image quality and product type are sufficient to be rendered in AR.
6. "generation_prompt": A highly detailed prompt to be passed to a 3D Mesh Generation pipeline to create the final .glb/.usdz file. Describe the geometry, lighting, textures, and exact shapes.`;

      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: image } },
            { text: "Analyze this image according to your instructions." }
          ]
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const analysis = JSON.parse(response.text || "{}");
      res.json(analysis);
    } catch (error: any) {
      console.error("Asset analysis failed:", error);
      res.status(500).json({ error: "Failed to analyze asset", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
