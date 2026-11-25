import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import {
  buildAdminOpsBriefing,
  dispatchOpsWebhookEvent,
  verifyOpsOrAdminRequest,
} from '../_lib/opsBriefing';
import { sendMetaOutboundMessage } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const auth = await verifyOpsOrAdminRequest(req, db);
    if (!auth.authorized) {
      return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized' });
    }
    const briefing = await buildAdminOpsBriefing(db);
    const rawPhone = String(
      (req.body as any)?.phone || process.env.ADMIN_WHATSAPP_PHONE || ''
    ).trim();
    const digits = rawPhone.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('0') && digits.length >= 10
      ? `255${digits.slice(1, 10)}`
      : digits.length === 9
      ? `255${digits}`
      : digits;

    let whatsappSent = false;
    if (normalizedPhone.length >= 11) {
      const sendRes = await sendMetaOutboundMessage({
        channel: 'whatsapp',
        recipientId: normalizedPhone,
        text: briefing.whatsappSummaryText,
      });
      whatsappSent = Boolean(sendRes?.sent);
    }

    const webhookDispatched = await dispatchOpsWebhookEvent('ops.daily_briefing', briefing);

    return res.status(200).json({
      ok: true,
      whatsappSent,
      recipientPhone: normalizedPhone || undefined,
      webhookDispatched,
      briefing,
    });
  } catch (err: any) {
    console.error('[Ops Send Briefing API] Error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to send ops briefing' });
  }
}
