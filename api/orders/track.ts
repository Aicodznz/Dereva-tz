import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { lookupCustomerAllTrackables } from '../_lib/metaBot';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dbAdmin = getFirestoreDb();
    const phone = typeof req.query?.phone === 'string' ? req.query.phone : '';
    const uid = typeof req.query?.uid === 'string' ? req.query.uid : '';
    const code = typeof req.query?.code === 'string' ? req.query.code : '';
    const senderId = typeof req.query?.senderId === 'string' ? req.query.senderId : '';

    if (!phone && !uid && !code && !senderId) {
      return res.status(200).json({ items: [] });
    }

    const items = await lookupCustomerAllTrackables(dbAdmin, { phone, uid, code, senderId });
    return res.status(200).json({ items });
  } catch (err: any) {
    console.error('[Vercel Orders Track] Error:', err);
    return res.status(500).json({ error: 'Failed to load orders', items: [] });
  }
}
