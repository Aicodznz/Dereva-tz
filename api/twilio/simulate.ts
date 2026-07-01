import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSMSInput } from '../../src/lib/smsBot';
import { getFirestoreDb } from '../_lib/getFirestoreDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbAdmin = getFirestoreDb();

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { phone, message } = req.body || {};
    if (!phone || !message) {
      return res.status(400).json({ error: "phone and message parameters are required" });
    }

    console.log(`[Twilio Simulator Vercel] Simulation from ${phone}: "${message}"`);

    const reply = await handleSMSInput(phone, message, dbAdmin);
    return res.status(200).json({ reply });
  } catch (error: any) {
    console.error("[Twilio Simulator Vercel] Processing error:", error);
    return res.status(500).json({ error: "Failed to simulate SMS response", details: error.message });
  }
}
