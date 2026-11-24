import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { processPapoPayWhatsAppCheckout } from '../_lib/papopayWhatsAppCheckout';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const dbAdmin = getFirestoreDb();
    const { statusCode, payload } = await processPapoPayWhatsAppCheckout(dbAdmin, req.body || {});
    return res.status(statusCode).json(payload);
  } catch (err: any) {
    console.error('[PapoPay WhatsApp Checkout Vercel] Error:', err);
    return res.status(500).json({ ok: false, error: 'Hitilafu ya mfumo wakati wa kuchakata malipo.' });
  }
}
