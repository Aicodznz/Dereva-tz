import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearHistory } from '../_lib/historyStore';
import { getFirestoreDb } from '../_lib/getFirestoreDb';

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

    // Clear local persistent history store
    clearHistory();

    console.log("[Meta Clear Logs] Logs successfully cleared.");
    return res.status(200).json({ status: "success", message: "Logs cleared successfully" });
  } catch (error: any) {
    console.error("[Meta Clear Logs] Error:", error);
    return res.status(500).json({ error: "Failed to clear logs", details: error?.message || String(error) });
  }
}
