import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { processMongikeWebhook } from '../_lib/mongike';
import { notifyMongikePaymentPaidToWhatsApp } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getFirestoreDb();

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const outcome = await processMongikeWebhook(body, db);

    if (outcome.isPaid && outcome.realOrderId && db) {
      await notifyMongikePaymentPaidToWhatsApp(
        {
          targetId: outcome.realOrderId,
          targetType: outcome.targetType,
          amount: outcome.amount,
          gatewayRef: outcome.gatewayRef,
        },
        db
      ).catch(() => {});
    }

    return res.status(200).json({ status: 'success', message: 'Webhook received successfully', ...outcome });
  } catch (error: any) {
    console.error("[Payment Webhook Vercel] Error:", error);
    return res.status(200).json({ status: 'error', message: error?.message || 'Internal processing failed' });
  }
}
