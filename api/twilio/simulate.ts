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
      console.log(`[Firebase Admin Vercel] Initialized Simulator Firestore with Project ID: ${appletConfig.projectId}`);
    }
  }
} catch (err) {
  console.error("[Firebase Admin Vercel] Initialization error in simulator:", err);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message parameters are required" });
  }

  console.log(`[Twilio Simulator Vercel] Simulation from ${phone}: "${message}"`);

  try {
    const reply = await handleSMSInput(phone, message, dbAdmin);
    return res.status(200).json({ reply });
  } catch (error: any) {
    console.error("[Twilio Simulator Vercel] Processing error:", error);
    return res.status(500).json({ error: "Failed to simulate SMS response", details: error.message });
  }
}
