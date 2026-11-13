import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { notifyRideStatusToMeta } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { rideId, status, driverInfo, driverLocation, rideData } = req.body || {};
    if (!rideId || !status) {
      return res.status(400).json({ error: 'rideId and status are required' });
    }

    const dbAdmin = getFirestoreDb();
    const result = await notifyRideStatusToMeta(
      { rideId, status, driverInfo, driverLocation, rideData },
      dbAdmin
    );

    return res.status(200).json({ status: 'ok', ...result });
  } catch (err: any) {
    console.error('[Meta Ride Notify Vercel] Error:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
