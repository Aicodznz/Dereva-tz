import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const config = req.body;
    if (!config) {
      return res.status(400).json({ error: "Missing config body" });
    }

    const localPath = path.join(process.cwd(), 'meta_config.json');
    fs.writeFileSync(localPath, JSON.stringify(config, null, 2), 'utf8');

    console.log("[Meta Config Save] Config successfully saved locally:", localPath);
    return res.status(200).json({ status: "success", message: "Config saved successfully" });
  } catch (error: any) {
    console.error("[Meta Config Save] Error saving config:", error);
    return res.status(500).json({ error: "Failed to save config", details: error?.message || String(error) });
  }
}
