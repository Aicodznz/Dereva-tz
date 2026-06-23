import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { lat, lon, zoom } = req.query;

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType?.includes("application/json")) {
      const text = await response.text();
      return res.status(response.status || 502).json({ error: "External service error", detail: text.substring(0, 100) });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch address data", detail: error.message });
  }
}
