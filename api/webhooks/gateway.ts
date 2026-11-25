import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { processDaliPayWebhook, verifyDaliPaySignature } from '../_lib/dalipay';
import { notifyMongikePaymentPaidToWhatsApp } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const rawBody =
      typeof (req as any).rawBody === 'string' || Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const sigCheck = verifyDaliPaySignature(rawBody, req.headers['x-signature']);
    if (!sigCheck.valid) {
      return res.status(401).json({ ok: false, error: sigCheck.reason || 'Invalid X-Signature' });
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const db = getFirestoreDb();
    const outcome = await processDaliPayWebhook(body, db);

    if (
      outcome.kind === 'collection' &&
      outcome.isPaid &&
      outcome.realOrderId &&
      outcome.targetType !== 'disbursements' &&
      db
    ) {
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

    return res.status(200).json({ ok: true, status: 'success', ...outcome });
  } catch (error: any) {
    console.error('[DaliPay Gateway Webhook] Error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Webhook processing failed' });
  }
}
