import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { isMongikeLiveConfigured, MONGIKE_TANZANIA_MOMO_ENDPOINT } from '../_lib/mongike';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const dbAdmin = getFirestoreDb();
    const configured = isMongikeLiveConfigured();
    let recentCallbacks: any[] = [];

    if (dbAdmin) {
      try {
        const snap = await dbAdmin.collection('payment_callbacks').limit(15).get();
        recentCallbacks = (snap.docs || [])
          .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
          .sort((a: any, b: any) => {
            const ta = Date.parse(String(a.updated_at || 0)) || 0;
            const tb = Date.parse(String(b.updated_at || 0)) || 0;
            return tb - ta;
          })
          .slice(0, 8);
      } catch {}
    }

    return res.status(200).json({
      provider: 'mongike',
      configured,
      mode: configured ? 'live' : 'sandbox',
      endpoint: MONGIKE_TANZANIA_MOMO_ENDPOINT,
      webhookPath: '/api/payments/webhook',
      recentCallbacks,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to read Mongike status',
    });
  }
}
