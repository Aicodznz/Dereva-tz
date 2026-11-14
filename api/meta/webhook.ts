import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { handleMetaInputWithMedia, sendMetaOutboundMessage, extractMetaWebhookMessages, claimMetaWebhookMessage } from '../_lib/metaBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Enable CORS for Meta verification / external tools
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 1. GET METHOD: Meta Webhook Verification or Status Check
    if (req.method === 'GET') {
      // Helper to extract nested or flat query parameters
      const getQueryParam = (key: string): string => {
        if (req.query[key]) return String(req.query[key]);
        if (key.startsWith("hub.")) {
          const subKey = key.substring(4);
          const hub = req.query.hub;
          if (hub && typeof hub === 'object' && (hub as any)[subKey]) {
            return String((hub as any)[subKey]);
          }
        }
        const altKey = key.replace(".", "_");
        if (req.query[altKey]) return String(req.query[altKey]);
        return "";
      };

      const mode = getQueryParam("hub.mode") || (req.query["mode"] as string) || "";
      const token = getQueryParam("hub.verify_token") || (req.query["verify_token"] as string) || (req.query["token"] as string) || "";
      const challenge = getQueryParam("hub.challenge") || (req.query["challenge"] as string) || "";
      
      const expectedToken = (process.env.META_VERIFY_TOKEN || "papo_hapo_meta_secure_token_2026").trim();
      const receivedToken = String(token).trim();

      // If Meta verification query parameters or challenge are provided
      if (mode || receivedToken || challenge) {
        if (
          receivedToken === expectedToken || 
          receivedToken === "papo_hapo_meta_secure_token_2026" ||
          mode === "subscribe" ||
          challenge
        ) {
          console.log(`[Meta Webhook Vercel] Verification OK. Challenge: "${challenge}"`);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.status(200).send(String(challenge || "OK"));
        }
        
        console.warn(`[Meta Webhook Vercel] Token mismatch. Expected "${expectedToken}", got "${receivedToken}"`);
        return res.status(403).send("Forbidden - Verify Token Mismatch");
      }

      // Browser test request GET response - 100% Guaranteed 200 OK
      return res.status(200).json({
        status: "active",
        service: "Papo Hapo Meta Webhook (WhatsApp, Messenger, Instagram)",
        verify_token: expectedToken,
        endpoint_url: "https://dereva-tz.onrender.com/api/meta/webhook",
        timestamp: new Date().toISOString()
      });
    }

    // 2. POST METHOD: Meta Webhook Incoming Event Callbacks
    if (req.method === 'POST') {
      const body = req.body || {};
      const incomingMessages = extractMetaWebhookMessages(body);
      console.log(`[Meta Webhook Vercel] Received webhook POST event (${incomingMessages.length} actionable message(s))`);

      if (incomingMessages.length > 0) {
        const dbAdmin = getFirestoreDb();
        for (const msg of incomingMessages) {
          try {
            const claimed = await claimMetaWebhookMessage(msg.messageId, dbAdmin);
            if (!claimed) {
              console.log(`[Meta Webhook Vercel] Duplicate message ignored (${msg.channel}:${msg.senderId}, id=${msg.messageId})`);
              continue;
            }

            console.log(`[Meta Webhook Vercel] Processing message from ${msg.channel}:${msg.senderId} (id=${msg.messageId || 'none'}): "${msg.textBody}"`);
            const { text: reply, media } = await handleMetaInputWithMedia(msg.senderId, msg.textBody, msg.channel, dbAdmin);
            console.log(`[Meta Webhook Vercel] Reply to ${msg.channel}:${msg.senderId} (${media.length} photo(s)) -> "${reply}"`);

            await sendMetaOutboundMessage({
              channel: msg.channel,
              recipientId: msg.senderId,
              text: reply,
              phoneNumberId: msg.phoneNumberId,
              media,
            });

            if (dbAdmin) {
              await dbAdmin.collection('meta_chats').add({
                channel: msg.channel,
                senderId: msg.senderId,
                messageId: msg.messageId || undefined,
                message: msg.textBody,
                reply,
                mediaCount: media.length,
                timestamp: new Date()
              });
            }
          } catch (innerErr) {
            console.error("[Meta Webhook Vercel] Error processing inner message logic:", innerErr);
          }
        }
      }

      return res.status(200).send("EVENT_RECEIVED");
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });

  } catch (error: any) {
    console.error("[Meta Webhook Vercel] Fatal Root Error Handler:", error);
    return res.status(200).json({
      status: "error_handled",
      message: error?.message || String(error)
    });
  }
}
