import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import {
  buildAdminOpsBriefing,
  dispatchOpsWebhookEvent,
  normalizeAdminPhoneForWhatsApp,
  resolveWhatsAppPhoneNumberId,
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
    const normalizedPhone = normalizeAdminPhoneForWhatsApp(rawPhone);

    let whatsappSent = false;
    let whatsappReason = '';
    if (normalizedPhone.length >= 11) {
      const phoneNumberId = await resolveWhatsAppPhoneNumberId(db, normalizedPhone);
      const sendRes = await sendMetaOutboundMessage({
        channel: 'whatsapp',
        recipientId: normalizedPhone,
        phoneNumberId,
        text: briefing.whatsappSummaryText,
        templateFallback: {
          category: 'utility',
          bodyParams: [
            `Lipa Namba: ${briefing.lipaNambaPendingCount} pending (TZS ${briefing.lipaNambaPendingTotalTzs.toLocaleString()}) • DaliPay OK: ${briefing.dalipay.completedCount}`,
          ],
        },
      });
      whatsappSent = Boolean(sendRes?.sent);
      whatsappReason = String(sendRes?.reason || '');
    } else {
      whatsappReason = 'MISSING_PHONE';
    }

    const webhookDispatched = await dispatchOpsWebhookEvent('ops.daily_briefing', briefing);

    return res.status(200).json({
      ok: true,
      whatsappSent,
      whatsappReason: whatsappReason || undefined,
      recipientPhone: normalizedPhone || undefined,
      webhookDispatched,
      briefing,
    });
  } catch (err: any) {
    console.error('[Ops Send Briefing API] Error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to send ops briefing' });
  }
}
