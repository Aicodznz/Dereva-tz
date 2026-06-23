import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { q, limit, addressdetails } = req.query;
  if (!q) {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q as string)}&format=json&limit=${limit || 5}&addressdetails=${addressdetails || 1}&countrycodes=tz&email=aicodtznation@gmail.com`;
    
    const response = await fetch(url, {
      headers: { 
        'Accept-Language': 'sw,en', 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType?.includes("application/json")) {
      const text = await response.text();
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
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ 
      error: "Failed to reach location service",
      detail: error.message 
    });
  }
}
