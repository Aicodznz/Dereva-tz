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
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q as string)}&format=json&limit=${limit || 5}&addressdetails=${addressdetails || 1}&email=aicodtznation@gmail.com`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'sw,en', 'User-Agent': 'PapoHapoSuperApp/1.0' }
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Nominatim search proxy error:", error);
      res.status(500).json({ error: "Failed to fetch location data" });
    }
  });

  // Proxy for Nominatim Reverse Geocoding
  app.get("/api/geo/reverse", async (req, res) => {
    const { lat, lon, zoom } = req.query;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=${zoom || 18}&addressdetails=1&email=aicodtznation@gmail.com`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'sw,en', 'User-Agent': 'PapoHapoSuperApp/1.0' }
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Nominatim reverse proxy error:", error);
      res.status(500).json({ error: "Failed to fetch address data" });
    }
  });

  // Proxy for OSRM Routing
  app.get("/api/geo/route", async (req, res) => {
    const { coords } = req.query; // format: lng,lat;lng,lat
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("OSRM route proxy error:", error);
      res.status(500).json({ error: "Failed to fetch routing data" });
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
