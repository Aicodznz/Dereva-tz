import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { verifyAdminRequest } from '../_lib/adminAuth';
import { confirmManualOrderPayment } from '../_lib/mongike';
import { notifyMongikePaymentPaidToWhatsApp } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const dbAdmin = getFirestoreDb();
    const authRes = await verifyAdminRequest(req.headers.authorization, dbAdmin);
    if ('error' in authRes) {
      return res.status(authRes.status).json({ ok: false, error: authRes.error });
    }

    const { orderId, collection, transactionRef, note } = req.body || {};
    const cleanOrderId = String(orderId || '').trim();
    if (!cleanOrderId || cleanOrderId.length > 128) {
      return res.status(400).json({ ok: false, error: 'Kitambulisho cha oda hakipo au si sahihi.' });
    }

    const colName: 'orders' | 'rides' = collection === 'rides' ? 'rides' : 'orders';
    const result = await confirmManualOrderPayment(dbAdmin, {
      orderId: cleanOrderId,
      collection: colName,
      adminUid: authRes.admin.uid,
      adminEmail: authRes.admin.email,
      transactionRef: typeof transactionRef === 'string' ? transactionRef.trim().slice(0, 80) : undefined,
      note: typeof note === 'string' ? note.trim().slice(0, 200) : undefined,
      onConfirmedPaid: (info) => notifyMongikePaymentPaidToWhatsApp(info, dbAdmin),
    });

    if (!result.ok) {
      return res.status(result.statusCode || 400).json({ ok: false, error: result.error });
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Confirm Manual Payment] Error:', err);
    return res.status(500).json({ ok: false, error: 'Hitilafu ya seva wakati wa kuthibitisha malipo.' });
  }
}
