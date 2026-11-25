import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { processMongikeWebhook } from '../_lib/mongike';
import { processDaliPayWebhook, verifyDaliPaySignature } from '../_lib/dalipay';
import { notifyMongikePaymentPaidToWhatsApp } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getFirestoreDb();

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const rawBody =
      typeof (req as any).rawBody === 'string' || Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});
    const hasDaliSig = Boolean(req.headers['x-signature']);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const isDaliPayload =
      hasDaliSig ||
      Boolean(body?.event) ||
      Boolean(body?.data?.external_reference) ||
      Boolean(body?.external_reference);

    if (isDaliPayload) {
      const sigCheck = verifyDaliPaySignature(rawBody, req.headers['x-signature']);
      if (!sigCheck.valid) {
        return res.status(401).json({ status: 'error', message: sigCheck.reason || 'Invalid X-Signature' });
      }
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
      return res.status(200).json({ status: 'success', provider: 'dalipay', ...outcome });
    }

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
