import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getFirestoreDb();

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const { order_id, status, gateway_ref, reference_id, amount } = body;

    console.log(`[Payment Webhook Vercel] Callback for order ${order_id}: status=${status}`);

    if (db && order_id) {
      if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'PAID') {
        await db.collection('orders').doc(String(order_id)).update({
          paymentStatus: 'paid',
          updatedAt: new Date().toISOString(),
          gatewayRef: gateway_ref || reference_id || null
        });
      }

      await db.collection('payment_callbacks').doc(String(order_id)).set({
        order_id,
        status: status || "SUCCESS",
        reference_id: gateway_ref || reference_id || "",
        amount: amount || 0,
        raw_payload: body,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    return res.status(200).json({ status: 'success', message: 'Webhook received successfully' });
  } catch (error: any) {
    console.error("[Payment Webhook Vercel] Error:", error);
    return res.status(200).json({ status: 'error', message: error?.message || 'Internal processing failed' });
  }
}
