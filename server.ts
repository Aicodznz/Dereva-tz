import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

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
    const listCoord = pairs;
    const dist = estimateDistanceMultiple(pairs);
    const estDuration = dist / 11.1; // ~40 km/h

    return {
      code: "Ok",
      routes: [
        {
          geometry: {
            coordinates: listCoord,
            type: "LineString"
          },
          legs: [
            {
              summary: "Straight line routing fallback",
              weight: estDuration,
              duration: estDuration,
              distance: dist,
              steps: pairs.map((p, idx) => ({
                distance: idx === 0 ? dist : 0,
                duration: idx === 0 ? estDuration : 0,
                geometry: {
                  coordinates: [p],
                  type: "Point"
                },
                name: idx === 0 ? "Barabara ya kawaida" : "",
                mode: "driving",
                maneuver: {
                  location: p,
                  bearing_before: 0,
                  bearing_after: 0,
                  type: idx === 0 ? "depart" : "arrive"
                }
              }))
            }
          ],
          weight_name: "routability",
          weight: estDuration,
          duration: estDuration,
          distance: dist
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

  // Proxy for OSRM Routing
  app.get("/api/geo/route", async (req, res) => {
    const { coords } = req.query; // format: lng,lat;lng,lat
    
    console.log(`[Proxy] OSRM Route: ${coords}`);

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

    // 1. Try URL 1 (router.project-osrm.org)
    try {
      const url1 = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
      console.log(`[Proxy] Attempting primary OSRM: ${url1}`);
      const response = await fetch(url1, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5s timeout
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType?.includes("application/json")) {
        const data = await response.json();
        if (data && data.code === "Ok") {
          console.log(`[Proxy] Primary OSRM success!`);
          return res.json(data);
        }
      }
      throw new Error(`Primary OSRM responded with status ${response.status}`);
    } catch (e1: any) {
      console.warn(`[Proxy] Primary OSRM failed: ${e1.message || e1}. Trying secondary...`);

      // 2. Try URL 2 (routing.openstreetmap.de)
      try {
        const url2 = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
        console.log(`[Proxy] Attempting secondary OSM.de: ${url2}`);
        const response2 = await fetch(url2, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5s timeout
        });

        const contentType2 = response2.headers.get("content-type");
        if (response2.ok && contentType2?.includes("application/json")) {
          const data2 = await response2.json();
          if (data2 && data2.code === "Ok") {
            console.log(`[Proxy] Secondary OSM.de success!`);
            return res.json(data2);
          }
        }
        throw new Error(`Secondary OSM.de responded with status ${response2.status}`);
      } catch (e2: any) {
        console.error(`[Proxy] Secondary OSM.de failed: ${e2.message || e2}. Using straight line fallback.`);

        // 3. Fallback to straight line
        if (coordsPairs.length >= 2) {
          const fallbackData = generateStraightLineRoute(coordsPairs);
          console.log(`[Proxy] Straight line fallback generated successfully.`);
          return res.json(fallbackData);
        } else {
          return res.status(502).json({ error: "All routing attempts failed and could not generate straight line fallback." });
        }
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
