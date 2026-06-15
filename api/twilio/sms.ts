import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleSMSInput } from '../../src/lib/smsBot';
import fs from 'fs';
import path from 'path';

let dbAdmin: any = null;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const configRaw = fs.readFileSync(configPath, 'utf8');
    const appletConfig = JSON.parse(configRaw);
    if (appletConfig && appletConfig.projectId) {
      if (!getApps().length) {
        initializeApp({
          projectId: appletConfig.projectId
        });
      }
      dbAdmin = getFirestore();
      console.log(`[Firebase Admin Vercel] Initialized Webhook Firestore with Project ID: ${appletConfig.projectId}`);
    }
  }
} catch (err) {
  console.error("[Firebase Admin Vercel] Initialization error in webhook:", err);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Twilio sends POST urlencoded data with Form params 'From' and 'Body'
  const fromPhone = req.body.From || req.body.from || "unknown";
  const textBody = req.body.Body || req.body.body || "";

  console.log(`[Twilio Webhook Vercel] Message from ${fromPhone}: "${textBody}"`);

  try {
    const replyMessage = await handleSMSInput(fromPhone, textBody, dbAdmin);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${replyMessage}</Message>
</Response>`;
    
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  } catch (error: any) {
    console.error("[Twilio Hook Vercel] Process error:", error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Mfumo una hitilafu kidogo, tafadhali jaribu tena baadae.</Message>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(errorTwiml);
  }
}
