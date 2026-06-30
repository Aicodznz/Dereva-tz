import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleMetaInput } from '../../src/lib/metaBot';
import fs from 'fs';
import path from 'path';

let dbAdmin: any = null;
let initError: any = null;

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
      console.log(`[Firebase Admin Vercel] Initialized Meta Webhook Firestore with Project ID: ${appletConfig.projectId}`);
    }
  }
} catch (err: any) {
  console.error("[Firebase Admin Vercel] Initialization error in Meta webhook:", err);
  initError = {
    message: err?.message || String(err),
    stack: err?.stack || ""
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // If there was an initialization error, report it directly so the user/developer can see it
  if (initError) {
    return res.status(500).json({
      error: "Firebase Admin Initialization Failed",
      details: initError.message,
      stack: initError.stack
    });
  }

  try {
    if (req.method === 'GET') {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      const expectedToken = process.env.META_VERIFY_TOKEN || "papo_hapo_meta_secure_token_2026";
      
      if (mode && token) {
        if (mode === "subscribe" && token === expectedToken) {
          console.log("[Meta Webhook Vercel] GET Verification successful!");
          res.setHeader('Content-Type', 'text/plain');
          return res.status(200).send(String(challenge));
        }
        console.warn(`[Meta Webhook Vercel] GET Verification failed: Expected "${expectedToken}", received "${token}"`);
        return res.status(403).send(`Forbidden - Token mismatch. Expected: ${expectedToken}, Received: ${token}`);
      }
      
      // If someone opens this in the browser, provide a status report instead of crashing or a raw bad request!
      return res.status(200).json({
        status: "active",
        service: "Meta Webhook for WhatsApp, Messenger, Instagram",
        verify_token_configured: !!process.env.META_VERIFY_TOKEN,
        verify_token_value_preview: process.env.META_VERIFY_TOKEN ? `${process.env.META_VERIFY_TOKEN.substring(0, 3)}...` : "using_default"
      });
    }

    if (req.method === 'POST') {
      console.log("[Meta Webhook Vercel] Received webhook POST event:", JSON.stringify(req.body));
      
      let senderId = "";
      let textBody = "";
      let channel: 'whatsapp' | 'messenger' | 'instagram' = 'whatsapp';
      
      // 1. WhatsApp Business Cloud API payload detection
      if (req.body.object === "whatsapp_business_account") {
        const entry = req.body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const message = value?.messages?.[0];
        if (message) {
          senderId = message.from || "";
          textBody = message.text?.body || "";
          channel = 'whatsapp';
        }
      } 
      // 2. Facebook Messenger / Instagram Messaging payload detection
      else if (req.body.object === "page" || req.body.object === "instagram") {
        const entry = req.body.entry?.[0];
        const messaging = entry?.messaging?.[0];
        if (messaging) {
          senderId = messaging.sender?.id || "";
          textBody = messaging.message?.text || "";
          channel = req.body.object === "instagram" ? 'instagram' : 'messenger';
        }
      }
      
      if (senderId && textBody) {
        console.log(`[Meta Webhook Vercel] Incoming message on ${channel} from ${senderId}: "${textBody}"`);
        const reply = await handleMetaInput(senderId, textBody, channel, dbAdmin);
        console.log(`[Meta Webhook Vercel] Responding to ${channel}:${senderId} -> "${reply}"`);
        
        // Log in Firestore for dashboard visibility
        if (dbAdmin) {
          await dbAdmin.collection('meta_chats').add({
            channel,
            senderId,
            message: textBody,
            reply,
            timestamp: new Date()
          });
        }
      }
      
      return res.status(200).send("EVENT_RECEIVED");
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });

  } catch (error: any) {
    console.error("[Meta Webhook Vercel] Critical Handler Crash:", error);
    return res.status(500).json({
      error: "Critical Webhook Handler Crash",
      message: error?.message || String(error),
      stack: error?.stack || ""
    });
  }
}
