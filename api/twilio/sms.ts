import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSMSInput } from '../_lib/smsBot';
import { getFirestoreDb } from '../_lib/getFirestoreDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbAdmin = getFirestoreDb();

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const fromPhone = body.From || body.from || "unknown";
    const textBody = body.Body || body.body || "";

    console.log(`[Twilio Webhook Vercel] Message from ${fromPhone}: "${textBody}"`);

    const replyMessage = await handleSMSInput(fromPhone, textBody, dbAdmin);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${replyMessage}</Message>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  } catch (error: any) {
    console.error("[Twilio Webhook Vercel] Error:", error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Mfumo una hitilafu kidogo, tafadhali jaribu tena baadae.</Message>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(errorTwiml);
  }
}
