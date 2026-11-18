import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { notifyCustomerOrderStatusToMeta } from '../_lib/metaBot';

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
    const { orderId, status, orderData, vendorName, reason } = req.body || {};
    if (!orderId || !status) {
      return res.status(400).json({ error: 'orderId and status are required' });
    }

    const dbAdmin = getFirestoreDb();
    const result = await notifyCustomerOrderStatusToMeta(
      { orderId, status, orderData, vendorName, reason },
      dbAdmin
    );
    return res.status(200).json({ status: 'ok', ...result });
  } catch (err: any) {
    console.error('[Order Status Notify Vercel] Error:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
