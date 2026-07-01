import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. GET METHOD: Meta Webhook Verification or Status Check
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

      // Browser test request GET response - 100% Guaranteed 200 OK
      return res.status(200).json({
        status: "active",
        service: "Papo Hapo Meta Webhook (WhatsApp, Messenger, Instagram)",
        verify_token: expectedToken,
        endpoint_url: "https://dereva-tz.vercel.app/api/meta/webhook",
        timestamp: new Date().toISOString()
      });
    }

    // 2. POST METHOD: Meta Webhook Incoming Event Callbacks
    if (req.method === 'POST') {
      const body = req.body || {};
      console.log("[Meta Webhook Vercel] Received webhook POST event:", JSON.stringify(body));

      let senderId = "";
      let textBody = "";
      let channel: 'whatsapp' | 'messenger' | 'instagram' = 'whatsapp';

      // WhatsApp Business Cloud API payload
      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const message = value?.messages?.[0];
        if (message) {
          senderId = message.from || "";
          textBody = message.text?.body || "";
          channel = 'whatsapp';
        }
      } 
      // Facebook Messenger / Instagram Messaging payload
      else if (body.object === "page" || body.object === "instagram") {
        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0];
        if (messaging) {
          senderId = messaging.sender?.id || "";
          textBody = messaging.message?.text || "";
          channel = body.object === "instagram" ? 'instagram' : 'messenger';
        }
      }

      if (senderId && textBody) {
        try {
          const { handleMetaInput } = await import('../../src/lib/metaBot');
          const { getFirestoreDb } = await import('../_lib/getFirestoreDb');
          const dbAdmin = getFirestoreDb();

          console.log(`[Meta Webhook Vercel] Processing message from ${channel}:${senderId}: "${textBody}"`);
          const reply = await handleMetaInput(senderId, textBody, channel, dbAdmin);
          console.log(`[Meta Webhook Vercel] Reply to ${channel}:${senderId} -> "${reply}"`);

          if (dbAdmin) {
            await dbAdmin.collection('meta_chats').add({
              channel,
              senderId,
              message: textBody,
              reply,
              timestamp: new Date()
            });
          }
        } catch (innerErr) {
          console.error("[Meta Webhook Vercel] Error processing inner message logic:", innerErr);
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
