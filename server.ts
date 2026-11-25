import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { handleSMSInput, getSession, saveSession } from "./src/lib/smsBot";
import { handleMetaInputWithMedia, sendMetaOutboundMessage, sendWhatsAppReadAndTyping, notifyRideStatusToMeta, notifyVendorNewOrderToWhatsApp, notifyCustomerOrderStatusToMeta, notifyMongikePaymentPaidToWhatsApp, notifyPartnerApprovedToWhatsApp, notifyDriversNewJobToWhatsApp, notifyFundisNewJobToWhatsApp, processDueScheduledBookings, sendWhatsAppPromoBroadcast, generateVisualReceiptQrBuffer, clearMetaHumanHandoverState, extractMetaWebhookMessages, claimMetaWebhookMessage, enqueueMetaSenderTask, lookupCustomerAllTrackables, recordInboundMetaPhoneNumberId, getMetaWelcomeSettings, saveMetaWelcomeSettings, syncMetaConversationalAutomation, getMetaConversationalAutomationStatus, listMetaCustomersForAdmin, setMetaCustomerBlockedState, deleteMetaCustomerCompletely, processAbandonedSessionsRecovery, listSosAlerts, resolveSosAlert, getMetaTemplateSettings, saveMetaTemplateSettings } from "./src/lib/metaBot";
import { getFirestoreDb, subscribeCollectionChanges } from "./api/_lib/getFirestoreDb";
import { getHistory, addMessageToHistory, clearHistory } from "./api/_lib/historyStore";
import { initiateMongikePayment, isMongikeLiveConfigured, MONGIKE_TANZANIA_MOMO_ENDPOINT, PAPO_LIPA_NAMBA, processMongikeWebhook, confirmManualOrderPayment } from "./api/_lib/mongike";
import { getDaliPayConfig, getPublicWebhookCallbackUrl, processDaliPayWebhook, verifyDaliPaySignature } from "./api/_lib/dalipay";
import { verifyAdminRequest } from "./api/_lib/adminAuth";
import { processPapoPayWhatsAppCheckout } from "./api/_lib/papopayWhatsAppCheckout";
import { getPapoWalletSummaryAndStatement } from "./api/_lib/papoWalletSettlement";
import { buildAdminOpsBriefing, dispatchOpsWebhookEvent, normalizeAdminPhoneForWhatsApp, resolveWhatsAppPhoneNumberId, verifyOpsOrAdminRequest } from "./api/_lib/opsBriefing";

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err);
});

async function startServer() {
  const app = express();
  const PORT =
    process.env.NODE_ENV !== "production" ||
    (process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT)
      ? parseInt(process.env.DEFAULT_APP_PORT || "3000", 10)
      : process.env.PORT
      ? parseInt(process.env.PORT, 10)
      : 3000;

  app.use(express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Chat history log using local historyStore file
  const recordMetaChatInMemory = (channel: string, senderId: string, message: string, reply: string) => {
    addMessageToHistory(channel, senderId, message, reply);
  };

  // Safe, crash-proof Firestore instance using Web SDK (no service account admin permission required)
  const dbAdmin = getFirestoreDb();


  // Twilio incoming Webhook (receives URL-encoded POST with Form params 'From' and 'Body')
  app.post("/api/twilio/sms", async (req, res) => {
    const fromPhone = req.body.From || req.body.from || "unknown";
    const textBody = req.body.Body || req.body.body || "";
    
    console.log(`[Twilio Webhook] Received message from ${fromPhone}: "${textBody}"`);
    
    try {
      const replyMessage = await handleSMSInput(fromPhone, textBody, dbAdmin);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${replyMessage}</Message>
</Response>`;
      
      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      console.error("[Twilio Hook] Failed to process SMS:", error);
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Mfumo una hitilafu kidogo, tafadhali jaribu tena baadae.</Message>
</Response>`;
      res.type('text/xml');
      res.send(errorTwiml);
    }
  });

  // Twilio Interactive Voice IVR Webhook (Handles incoming or outbound callback calls)
  app.post("/api/twilio/voice", (req, res) => {
    const fromPhone = req.body.From || req.body.from || "mteja";
    console.log(`[Twilio Voice Hook] Call connected with ${fromPhone}`);

    const voiceTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather numDigits="1" action="/api/twilio/voice/gather" method="POST" timeout="10">
        <Say language="sw-TZ" voice="Polly.Astrid">
            Habari! Umepokea simu kutoka Papo Hapo. Agizo lako liko tayari. Bofya 1 kuongea na dereva, au Bofya 2 kuthibitisha umepokea mzigo wako.
        </Say>
    </Gather>
    <Say language="sw-TZ">Hutujapokea chaguo lako. Asante kwa kutumia Papo Hapo.</Say>
</Response>`;

    res.type('text/xml');
    res.send(voiceTwiml);
  });

  // Twilio Voice Gather Action endpoint (processes DTMF keypad choice 1 or 2)
  app.post("/api/twilio/voice/gather", (req, res) => {
    const digits = req.body.Digits || req.body.digits || "";
    console.log(`[Twilio Voice Gather] User pressed key: ${digits}`);

    let responseScript = "";
    if (digits === "1") {
      responseScript = `<Say language="sw-TZ">Tunakuunganisha na dereva wako sasa hivi. Tafadhali subiri kigogo...</Say><Dial>+255712345678</Dial>`;
    } else if (digits === "2") {
      responseScript = `<Say language="sw-TZ">Hongera! Agizo lako limethibitishwa kupokelewa kikamilifu. Asante kwa kutumia Papo Hapo!</Say>`;
    } else {
      responseScript = `<Say language="sw-TZ">Chaguo si sahihi. Asante kwa kutumia Papo Hapo.</Say>`;
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    ${responseScript}
</Response>`;

    res.type('text/xml');
    res.send(twiml);
  });

  // Africa's Talking incoming Webhook (receives Form urlencoded POST with 'from' and 'text')
  app.post("/api/africastalking/sms", async (req, res) => {
    const fromPhone = req.body.from || "unknown";
    const textBody = req.body.text || "";
    const vendorId = req.query.vendorId ? String(req.query.vendorId) : "admin-global";

    console.log(`[Africa's Talking Webhook] Received from ${fromPhone}: "${textBody}" for vendor: ${vendorId}`);

    if (fromPhone === "unknown") {
      return res.status(400).json({ error: "Missing sender phone number (from)" });
    }

    try {
      // 1. Process message through SMS Bot logic
      const replyMessage = await handleSMSInput(fromPhone, textBody, dbAdmin, vendorId);

      // 2. Send the reply back to the user via Africa's Talking
      const { sendAfricaTalkingSMS } = await import("./src/lib/smsBot.js");
      const result = await sendAfricaTalkingSMS(fromPhone, replyMessage, dbAdmin, vendorId);

      if (result.success) {
        res.status(200).json({ status: "success", reply: replyMessage });
      } else {
        console.error("[Africa's Talking Hook] Failed to send response back:", result.error);
        res.status(500).json({ error: "Failed to send SMS reply", details: result.error });
      }
    } catch (error: any) {
      console.error("[Africa's Talking Hook] Error processing SMS:", error);
      res.status(500).json({ error: "Failed to process Africa's Talking webhook", details: error.message });
    }
  });

  // Africa's Talking USSD Webhook (receives Form urlencoded POST with sessionId, serviceCode, phoneNumber, text)
  app.post("/api/africastalking/ussd", async (req, res) => {
    const sessionId = req.body.sessionId || req.body.sessionid || req.body.session_id;
    const serviceCode = req.body.serviceCode || req.body.servicecode || req.body.service_code;
    const phoneNumber = req.body.phoneNumber || req.body.phonenumber || req.body.phone_number;
    const text = req.body.text !== undefined ? String(req.body.text) : "";
    const vendorId = req.query.vendorId ? String(req.query.vendorId) : "admin-global";

    console.log(`[Africa's Talking USSD] Received: sessionId=${sessionId}, phoneNumber=${phoneNumber}, text="${text}" for vendor=${vendorId}`);

    if (!phoneNumber) {
      res.type("text/plain");
      return res.send("END Missing phone number. Please try again.");
    }

    try {
      // 1. Split the text by '*' to get the sequence of choices
      const rawInputs = text && typeof text === 'string' && text.trim() !== "" ? text.trim().split("*") : [];
      // Clean inputs to avoid empty/whitespace values
      const inputs = rawInputs.map(i => i.trim()).filter(i => i !== "");

      // Use a specific prefix to isolate USSD sessions from normal SMS sessions
      const ussdPhoneKey = `ussd:${phoneNumber}`;

      // Reset the session state to START to replay the sequence cleanly from the beginning
      const session = await getSession(ussdPhoneKey, dbAdmin);
      session.step = 'START';
      session.selectedService = undefined;
      session.busRoute = undefined;
      session.selectedOperatorId = undefined;
      session.selectedOperatorName = undefined;
      session.selectedSeat = undefined;
      session.taxiRoute = undefined;
      session.selectedDriverName = undefined;
      session.selectedDriverPrice = undefined;
      session.selectedSalonCategory = undefined;
      session.selectedSalonName = undefined;
      session.selectedProductId = undefined;
      session.selectedProductName = undefined;
      session.selectedProductPrice = undefined;
      session.optionsList = [];
      await saveSession(session, dbAdmin);

      // Replay the sequence of user choices
      // First, trigger the greeting/welcome message
      let lastReply = await handleSMSInput(ussdPhoneKey, "Hi", dbAdmin, vendorId);

      // Now, feed each input in the sequence sequentially
      for (const input of inputs) {
        lastReply = await handleSMSInput(ussdPhoneKey, input, dbAdmin, vendorId);
      }

      // Check the final step of the session after playing all inputs
      const finalSession = await getSession(ussdPhoneKey, dbAdmin);

      // Remove emojis or special characters that don't play well with USSD menus
      const cleanReply = lastReply
        .replace(/🚕|💇‍♀️|🚌|🥗|🥦|💊|🏍️|🛺|💵|📌|🚖|✨|🎉|💅|💆‍♀️|🍹|🍔/g, "")
        .replace(/\n\s*\n/g, "\n") // remove double blank lines
        .trim();

      // If the step is START (meaning the flow completed or was reset), transition to SELECT_SERVICE so the session stays active
      if (finalSession.step === 'START') {
        finalSession.step = 'SELECT_SERVICE';
        await saveSession(finalSession, dbAdmin);
      }

      res.type('text/plain');
      res.send(`CON ${cleanReply}`);
    } catch (error: any) {
      console.error("[Africa's Talking USSD] Error:", error);
      res.type('text/plain');
      res.send("END Mfumo una hitilafu kwa sasa. Tafadhali jaribu tena baadae.");
    }
  });

  // GET Meta Webhook Verification (WhatsApp, Facebook Messenger, Instagram)
  app.get("/api/meta/webhook", (req, res) => {
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
    
    if (mode || receivedToken || challenge) {
      if (
        receivedToken === expectedToken || 
        receivedToken === "papo_hapo_meta_secure_token_2026" ||
        mode === "subscribe" ||
        challenge
      ) {
        console.log(`[Meta Webhook] GET Verification successful! Challenge: "${challenge}"`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(String(challenge || "OK"));
      }
      console.warn(`[Meta Webhook] GET Verification failed: Expected "${expectedToken}", received "${receivedToken}"`);
      return res.status(403).send("Forbidden");
    }
    return res.status(200).json({
      status: "active",
      service: "Papo Hapo Meta Webhook",
      verify_token: expectedToken,
      endpoint_url: "https://dereva-tz.onrender.com/api/meta/webhook"
    });
  });

  // POST Meta Webhook Event Handler (WhatsApp, Messenger, Instagram)
  app.post("/api/meta/webhook", (req, res) => {
    const incomingMessages = extractMetaWebhookMessages(req.body);
    console.log(`[Meta Webhook] Received webhook POST event (${incomingMessages.length} actionable message(s))`);

    // Acknowledge Meta immediately (<10ms) so Meta Cloud API never times out or retries the webhook
    res.status(200).send("EVENT_RECEIVED");

    for (const msg of incomingMessages) {
      enqueueMetaSenderTask(`${msg.channel}:${msg.senderId}`, async () => {
        const claimed = await claimMetaWebhookMessage(msg.messageId, dbAdmin);
        if (!claimed) {
          console.log(`[Meta Webhook] Duplicate message ignored (${msg.channel}:${msg.senderId}, id=${msg.messageId})`);
          return;
        }

        recordInboundMetaPhoneNumberId(msg.senderId, msg.phoneNumberId);
        if (msg.channel === 'whatsapp' && msg.messageId) {
          void sendWhatsAppReadAndTyping({
            phoneNumberId: msg.phoneNumberId,
            messageId: msg.messageId,
            senderId: msg.senderId,
          });
        }
        console.log(`[Meta Webhook] Incoming message on ${msg.channel} from ${msg.senderId} (id=${msg.messageId || 'none'}): "${msg.textBody}"`);
        const { text: reply, media, interactive } = await handleMetaInputWithMedia(
          msg.senderId,
          msg.textBody,
          msg.channel,
          dbAdmin,
          {
            mediaAttachment: msg.mediaAttachment,
            catalogOrder: msg.catalogOrder,
          }
        );
        console.log(`[Meta Webhook] Responding to ${msg.channel}:${msg.senderId} (${media.length} photo(s)${interactive ? `, interactive=${interactive.type}` : ''}) -> "${reply}"`);

        await sendMetaOutboundMessage({
          channel: msg.channel,
          recipientId: msg.senderId,
          text: reply,
          phoneNumberId: msg.phoneNumberId,
          media,
          interactive,
        });

        recordMetaChatInMemory(msg.channel, msg.senderId, msg.textBody, reply);

        // Log in Firestore for dashboard visibility if available
        if (dbAdmin) {
          try {
            await dbAdmin.collection('meta_chats').add({
              channel: msg.channel,
              senderId: msg.senderId,
              messageId: msg.messageId || undefined,
              message: msg.textBody,
              reply,
              mediaCount: media.length,
              timestamp: new Date()
            });
          } catch (dbErr) {
            console.warn("[Meta Webhook] Notice: Firestore write skipped or failed, saved to memory.");
          }
        }
      });
    }
  });

  // Notify Meta customer (WhatsApp / Messenger / Instagram) when driver updates ride status
  app.post("/api/meta/ride-status-notify", async (req, res) => {
    try {
      const { rideId, status, driverInfo, driverLocation, rideData } = req.body || {};
      if (!rideId || !status) {
        return res.status(400).json({ error: "rideId and status are required" });
      }
      const result = await notifyRideStatusToMeta(
        { rideId, status, driverInfo, driverLocation, rideData },
        dbAdmin
      );
      return res.json({ status: "ok", ...result });
    } catch (err: any) {
      console.error("[Meta Ride Status Notify] Error:", err);
      return res.status(500).json({ error: err?.message || "Failed to send ride status notification" });
    }
  });

  // Notify vendor on WhatsApp with interactive Kubali / Kataa buttons when a new order/booking arrives
  app.post("/api/meta/vendor-order-notify", async (req, res) => {
    try {
      const { orderId, orderData } = req.body || {};
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
      }
      const result = await notifyVendorNewOrderToWhatsApp({ orderId, orderData }, dbAdmin);
      return res.json({ status: "ok", ...result });
    } catch (err: any) {
      console.error("[Meta Vendor Order Notify] Error:", err);
      return res.status(500).json({ error: err?.message || "Failed to notify vendor on WhatsApp" });
    }
  });

  // Notify Meta/WhatsApp customer when vendor accepts, prepares, completes, or rejects an order
  app.post("/api/meta/order-status-notify", async (req, res) => {
    try {
      const { orderId, status, orderData, vendorName, reason } = req.body || {};
      if (!orderId || !status) {
        return res.status(400).json({ error: "orderId and status are required" });
      }
      const result = await notifyCustomerOrderStatusToMeta(
        { orderId, status, orderData, vendorName, reason },
        dbAdmin
      );
      return res.json({ status: "ok", ...result });
    } catch (err: any) {
      console.error("[Meta Order Status Notify] Error:", err);
      return res.status(500).json({ error: err?.message || "Failed to send order status notification" });
    }
  });

  // Notify newly approved vendor or driver on WhatsApp with quick-action buttons
  app.post("/api/meta/notify-partner-approved", async (req, res) => {
    try {
      const { partnerType, partnerId, partnerData } = req.body || {};
      if (!partnerType || !partnerId || !['vendor', 'driver'].includes(partnerType)) {
        return res.status(400).json({ error: "Valid partnerType ('vendor' | 'driver') and partnerId are required" });
      }
      const result = await notifyPartnerApprovedToWhatsApp(
        { partnerType, partnerId, partnerData },
        dbAdmin,
        sendMetaOutboundMessage
      );
      return res.json({ status: "ok", ...result });
    } catch (err: any) {
      console.error("[Meta Partner Approved Notify] Error:", err);
      return res.status(500).json({ error: err?.message || "Failed to notify approved partner on WhatsApp" });
    }
  });

  // Meta Omni-Channel Simulator endpoint for front-end testing
  app.post("/api/meta/simulate", async (req, res) => {
    const { senderId, message, channel, audioBase64, imageBase64, mimeType, caption, catalogOrder } = req.body || {};
    const effectiveMessage =
      message ||
      (audioBase64 ? "__WA_VOICE_NOTE__" : "") ||
      (imageBase64 ? (caption ? `__WA_IMAGE__:${caption}` : "__WA_IMAGE__") : "") ||
      (catalogOrder ? `__WA_CATALOG_ORDER__:${JSON.stringify(catalogOrder)}` : "");
    if (!senderId || !effectiveMessage || !channel) {
      return res.status(400).json({ error: "senderId, channel, and message (or audio/image/catalog payload) are required parameters." });
    }
    
    console.log(`[Meta Simulator] Received simulated message from ${channel}:${senderId}: "${effectiveMessage}"`);
    
    try {
      const { text: reply, media, interactive } = await handleMetaInputWithMedia(
        senderId,
        effectiveMessage,
        channel,
        dbAdmin,
        { audioBase64, imageBase64, mimeType, caption, catalogOrder }
      );
      
      recordMetaChatInMemory(channel, senderId, effectiveMessage, reply);

      // Save simulated conversation in FireStore for real-time monitoring if available
      if (dbAdmin) {
        try {
          await dbAdmin.collection('meta_chats').add({
            channel,
            senderId,
            message: effectiveMessage,
            reply,
            mediaCount: media.length,
            timestamp: new Date()
          });
        } catch (dbErr) {
          console.warn("[Meta Simulator] Notice: Firestore write skipped or failed, saved to memory.");
        }
      }
      
      res.json({ reply, media, interactive, status: "success" });
    } catch (error: any) {
      console.error("[Meta Simulator] Failed to simulate:", error);
      res.status(500).json({ error: "Failed to simulate Meta response", details: error.message });
    }
  });

  // Retrieve Meta live chat logs for Admin Console
  app.get("/api/meta/history", async (req, res) => {
    try {
      let chats: any[] = getHistory();
      const clearedPath = path.join(process.cwd(), 'logs_cleared.txt');
      const isCleared = fs.existsSync(clearedPath);
      
      // Fallback to beautiful mock history if no logs yet and not explicitly cleared by the user
      if (chats.length === 0 && !isCleared) {
        chats = [
          {
            id: "m-mock-1",
            channel: "whatsapp",
            senderId: "+255716543210",
            message: "Naomba taxi kwenda Posta kutoka Mwenge",
            reply: "🚖 *Papo Hapo Taxi Service Router*:\n\nNjia uliyochagua: *POSTA KUTOKA MWENGE*\nTumepata madereva 3 karibu nawe:\n\n*1. Ally Rajabu (Passo - White)*\nBeji: ⭐ 4.9 (Uber Partner)\n💰 Bei: *TSH 7,500*\n\n*2. Salum Juma (Bajaji - Yellow)*\nBeji: ⭐ 4.8 (Fastest)\n💰 Bei: *TSH 4,500*\n\nAndika namba ya Dereva unayetaka kumuita sasa hivi:",
            timestamp: new Date(Date.now() - 5 * 60000)
          },
          {
            id: "m-mock-2",
            channel: "instagram",
            senderId: "tz_fashion_star",
            message: "Mambo! Kuna chips kuku hapo?",
            reply: "🍔 *Papo Hapo Food Court Bot*:\n\nTulichopata kwa jina: *\"CHIPS KUKU\"*\n\n*1. Chips Kuku Choma (Nusu)*\n📍 Papo Hapo Kitchen\n💰 Bei: *TSH 8,500*\n\n*2. Chips Kuku Fry*\n📍 Burger Point\n💰 Bei: *TSH 9,000*\n\nAndika namba ya chakula unachotaka kuagiza sasa hivi:",
            timestamp: new Date(Date.now() - 15 * 60000)
          },
          {
            id: "m-mock-3",
            channel: "messenger",
            senderId: "John_Mrema",
            message: "Nataka kukata tiketi ya basi kwenda Mwanza",
            reply: "🚌 *Papo Hapo Bus Booking System*:\n\nRoute: *DAR - MWANZA*\nMabasi yanayotoka leo:\n\n*1. Shabiby Line (Luxury VIP)*\n💰 Bei: *TSH 45,000*\n\n*2. Katarama Express (Business)*\n💰 Bei: *TSH 42,000*\n\nAndika namba ya basi unayotaka kukata tiketi sasa:",
            timestamp: new Date(Date.now() - 25 * 60000)
          }
        ];
      }
      
      res.json({ chats });
    } catch (err: any) {
      console.warn("[Meta History API] Soft warning loading chat history:", err?.message || err);
      res.json({ chats: [] });
    }
  });

  // Unified customer order/booking/ride/parcel tracking endpoint (publicly searchable by phone, code, or uid)
  app.get("/api/orders/track", async (req, res) => {
    try {
      const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
      const uid = typeof req.query.uid === 'string' ? req.query.uid : '';
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const senderId = typeof req.query.senderId === 'string' ? req.query.senderId : '';

      if (!phone && !uid && !code && !senderId) {
        return res.json({ items: [] });
      }

      const items = await lookupCustomerAllTrackables(dbAdmin, { phone, uid, code, senderId });
      return res.json({ items });
    } catch (err: any) {
      console.error("[Orders Track API] Error:", err);
      return res.status(500).json({ error: "Failed to track orders", items: [] });
    }
  });

  // Save Meta Automation config locally (preserving welcomeSettings if already stored)
  app.post("/api/meta/save-config", (req, res) => {
    try {
      const config = req.body;
      if (!config) {
        return res.status(400).json({ error: "Missing config body" });
      }
      const localPath = path.join(process.cwd(), 'meta_config.json');
      let existing: Record<string, any> = {};
      if (fs.existsSync(localPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(localPath, 'utf8')) || {};
        } catch {
          existing = {};
        }
      }
      const merged = {
        ...existing,
        ...config,
        ...(existing.welcomeSettings && !config.welcomeSettings ? { welcomeSettings: existing.welcomeSettings } : {}),
      };
      fs.writeFileSync(localPath, JSON.stringify(merged, null, 2), 'utf8');
      console.log("[Meta Config Server] Config saved locally to:", localPath);
      res.json({ status: "success", message: "Config saved successfully" });
    } catch (error: any) {
      console.error("[Meta Config Server] Error saving:", error);
      res.status(500).json({ error: "Failed to save config", details: error.message });
    }
  });

  // Get WhatsApp Welcome Message & Ice Breakers config (+ Meta Conversational Automation status)
  app.get("/api/meta/welcome-config", async (req, res) => {
    try {
      const settings = await getMetaWelcomeSettings(dbAdmin);
      const phoneId = typeof req.query.phoneNumberId === 'string' ? req.query.phoneNumberId : settings.phoneNumberId;
      const metaStatus = await getMetaConversationalAutomationStatus(phoneId);
      return res.json({ status: "ok", settings, metaStatus });
    } catch (err: any) {
      console.error("[Meta Welcome Config GET] Error:", err);
      return res.status(500).json({ error: err?.message || "Failed to load welcome config" });
    }
  });

  // Save WhatsApp Welcome Message & Ice Breakers and optionally sync to Meta Cloud API
  app.post("/api/meta/welcome-config", async (req, res) => {
    try {
      const body = req.body || {};
      const syncToMeta = body.syncToMeta !== false;
      if (syncToMeta) {
        const result = await syncMetaConversationalAutomation(body, dbAdmin);
        const metaStatus = await getMetaConversationalAutomationStatus(result.phoneNumberId || result.settings.phoneNumberId);
        return res.json({ status: "ok", ...result, metaStatus });
      }
      const settings = await saveMetaWelcomeSettings(body, dbAdmin);
      const metaStatus = await getMetaConversationalAutomationStatus(settings.phoneNumberId);
      return res.json({
        status: "ok",
        settings,
        synced: false,
        syncState: "local_only",
        message: "Mipangilio ya ujumbe wa karibu imehifadhiwa kwenye mfumo.",
        metaStatus,
      });
    } catch (err: any) {
      console.error("[Meta Welcome Config POST] Error:", err);
      return res.status(500).json({ error: err?.message || "Failed to save welcome config" });
    }
  });

  // Clear Meta chat history logs
  app.post("/api/meta/clear-logs", async (req, res) => {
    try {
      clearHistory();
      console.log("[Meta Clear Logs Server] Chat history cleared locally.");
      res.json({ status: "success", message: "Logs cleared successfully" });
    } catch (error: any) {
      console.error("[Meta Clear Logs Server] Error:", error);
      res.status(500).json({ error: "Failed to clear logs", details: error.message });
    }
  });

  // List WhatsApp / Meta customers for Admin CRM (active & blocked)
  app.get("/api/meta/customers", async (req, res) => {
    try {
      const channel = typeof req.query.channel === 'string' ? req.query.channel : 'all';
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const customers = await listMetaCustomersForAdmin(dbAdmin, { channel, search });
      return res.json({ status: "ok", customers });
    } catch (error: any) {
      console.error("[Meta Customers GET] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to list customers" });
    }
  });

  // Block, Unblock, or Delete a WhatsApp / Meta customer
  app.post("/api/meta/customers", async (req, res) => {
    try {
      const { action, channel = 'whatsapp', senderId, blocked, reason } = req.body || {};
      const cleanSenderId = String(senderId || '').trim();
      const validChannel = (channel === 'messenger' || channel === 'instagram' ? channel : 'whatsapp') as
        | 'whatsapp'
        | 'messenger'
        | 'instagram';

      if (!cleanSenderId) {
        return res.status(400).json({ error: "senderId is required" });
      }

      if (action === 'delete') {
        const result = await deleteMetaCustomerCompletely(
          { channel: validChannel, senderId: cleanSenderId },
          dbAdmin
        );
        return res.json({ status: "ok", action: "delete", ...result });
      }

      if (action === 'block' || action === 'unblock' || typeof blocked === 'boolean') {
        const nextBlocked = action === 'block' ? true : action === 'unblock' ? false : Boolean(blocked);
        const customer = await setMetaCustomerBlockedState(
          {
            channel: validChannel,
            senderId: cleanSenderId,
            blocked: nextBlocked,
            reason,
          },
          dbAdmin
        );
        return res.json({
          status: "ok",
          action: nextBlocked ? "block" : "unblock",
          customer,
        });
      }

      return res.status(400).json({ error: "Unsupported action. Use block, unblock, or delete." });
    } catch (error: any) {
      console.error("[Meta Customers POST] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to update customer" });
    }
  });

  // Visual QR Code PNG receipt / tracking image endpoint for WhatsApp & web cards
  app.get("/api/meta/receipt-qr/:entityType/:id.png", async (req, res) => {
    try {
      const entityType = req.params.entityType === 'ride' ? 'ride' : 'order';
      const cleanId = String(req.params.id || '').trim();
      if (!cleanId) return res.status(400).send("Invalid ID");
      const baseUrl = (process.env.APP_PUBLIC_URL || 'https://dereva-tz.onrender.com').replace(/\/+$/, '');
      const targetUrl =
        entityType === 'ride'
          ? `${baseUrl}/track/${encodeURIComponent(cleanId)}`
          : `${baseUrl}/verify-receipt/${encodeURIComponent(cleanId)}`;
      const pngBuffer = await generateVisualReceiptQrBuffer(targetUrl);
      if (!pngBuffer) return res.status(500).send("Failed to render QR");
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(pngBuffer);
    } catch (err: any) {
      return res.status(500).send(err?.message || "QR generation error");
    }
  });

  // List Live Human Support Handover Tickets (Admin Live Support Desk)
  app.get("/api/meta/support-tickets", async (_req, res) => {
    try {
      if (!dbAdmin) return res.json({ status: "ok", tickets: [] });
      const snap = await dbAdmin.collection('support_tickets').limit(80).get();
      const tickets = (snap.docs || [])
        .map((d: any) => {
          const data = d.data() || {};
          const toMs = (v: any) =>
            typeof v === 'number'
              ? v
              : typeof v?.toMillis === 'function'
              ? v.toMillis()
              : typeof v?.seconds === 'number'
              ? v.seconds * 1000
              : Date.parse(String(v || '')) || 0;
          return {
            id: d.id,
            channel: data.channel || 'whatsapp',
            senderId: data.senderId || '',
            customerName: data.customerName || 'Mteja',
            customerPhone: data.customerPhone || '',
            status: data.status || 'open',
            lastMessage: data.lastMessage || '',
            messages: Array.isArray(data.messages) ? data.messages : [],
            createdAt: toMs(data.createdAt),
            updatedAt: toMs(data.updatedAt) || toMs(data.createdAt),
          };
        })
        .sort((a: any, b: any) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.updatedAt - a.updatedAt);
      return res.json({ status: "ok", tickets });
    } catch (error: any) {
      console.error("[Meta Support Tickets GET] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to list support tickets" });
    }
  });

  // Admin reply to a Live Support Handover ticket or resolve & hand control back to Bot
  app.post("/api/meta/support-reply", async (req, res) => {
    try {
      const { ticketId, action = 'reply', message } = req.body || {};
      const cleanTicketId = String(ticketId || '').trim();
      const cleanMessage = String(message || '').trim();
      if (!cleanTicketId) return res.status(400).json({ error: "ticketId is required" });
      if (!dbAdmin) return res.status(500).json({ error: "Database unavailable" });

      const tRef = dbAdmin.collection('support_tickets').doc(cleanTicketId);
      const tSnap = await tRef.get();
      if (!tSnap.exists) return res.status(404).json({ error: "Support ticket not found" });

      const tData = tSnap.data() || {};
      const senderId = String(tData.senderId || '').trim();
      const channel = (tData.channel === 'messenger' || tData.channel === 'instagram' ? tData.channel : 'whatsapp') as
        | 'whatsapp'
        | 'messenger'
        | 'instagram';
      const prevMsgs = Array.isArray(tData.messages) ? tData.messages : [];
      const nextMsgs = [...prevMsgs];

      let sentToMeta = false;
      if (cleanMessage && senderId) {
        const outboundText =
          action === 'resolve'
            ? `👨‍💼 *Mhudumu (Papo Hapo):*\n${cleanMessage}\n\n✅ _Mazungumzo ya msaada yamefungwa — sasa boti iko tayari kukuhudumia tena! Andika *Menu*._`
            : `👨‍💼 *Mhudumu (Papo Hapo):*\n${cleanMessage}\n\n_(Jibu hapa hapa kuendelea na mhudumu, au bonyeza *Rudi kwa Boti*.)_`;
        const sendRes = await sendMetaOutboundMessage({
          channel,
          recipientId: senderId,
          text: outboundText,
        }).catch(() => ({ sent: false }));
        sentToMeta = Boolean(sendRes?.sent);
        nextMsgs.push({
          sender: 'agent',
          text: cleanMessage,
          timestamp: new Date().toISOString(),
        });
      } else if (action === 'resolve' && senderId) {
        const sendRes = await sendMetaOutboundMessage({
          channel,
          recipientId: senderId,
          text: `✅ *Suala lako limetatuliwa!* Umerudishwa kwa *Papo Hapo Bot* 🤖. Andika *Menu* muda wowote kuchagua huduma zetu.`,
        }).catch(() => ({ sent: false }));
        sentToMeta = Boolean(sendRes?.sent);
      }

      const nextStatus = action === 'resolve' ? 'resolved' : 'open';
      await tRef.set(
        {
          status: nextStatus,
          messages: nextMsgs.slice(-40),
          ...(cleanMessage ? { lastMessage: `Admin: ${cleanMessage}` } : {}),
          ...(action === 'resolve' ? { resolvedBy: 'admin', resolvedAt: new Date() } : {}),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      if (action === 'resolve' && senderId) {
        await clearMetaHumanHandoverState(senderId, channel, dbAdmin).catch(() => {});
      }

      return res.json({ status: "ok", ticketId: cleanTicketId, ticketStatus: nextStatus, sentToMeta });
    } catch (error: any) {
      console.error("[Meta Support Reply POST] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to send support reply" });
    }
  });

  // Real Opt-In Promo Broadcast Sender across Meta Customers / Drivers / Vendors
  app.post("/api/meta/broadcast-promo", async (req, res) => {
    try {
      const { message, audience = 'all', couponCode, channel = 'whatsapp', dryRun = false } = req.body || {};
      const cleanMessage = String(message || '').trim();
      if (!cleanMessage) {
        return res.status(400).json({ error: "Broadcast message is required" });
      }
      const validChannel = (channel === 'messenger' || channel === 'instagram' ? channel : 'whatsapp') as
        | 'whatsapp'
        | 'messenger'
        | 'instagram';
      const validAudience = (
        ['all', 'customers', 'drivers', 'vendors'].includes(String(audience)) ? audience : 'all'
      ) as 'all' | 'customers' | 'drivers' | 'vendors';

      const result = await sendWhatsAppPromoBroadcast(dbAdmin, sendMetaOutboundMessage, {
        message: cleanMessage,
        audience: validAudience,
        couponCode: couponCode ? String(couponCode).trim().toUpperCase() : undefined,
        channel: validChannel,
        dryRun: Boolean(dryRun),
      });
      return res.json({ status: "ok", ...result });
    } catch (error: any) {
      console.error("[Meta Broadcast Promo POST] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to send promo broadcast" });
    }
  });

  // In-Ride Safety SOS Alerts Desk (List & Resolve)
  app.get("/api/meta/sos-alerts", async (_req, res) => {
    try {
      const alerts = await listSosAlerts(dbAdmin);
      return res.json({ status: "ok", alerts });
    } catch (error: any) {
      console.error("[Meta SOS Alerts GET] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to load SOS alerts" });
    }
  });

  app.post("/api/meta/sos-alerts/:id/resolve", async (req, res) => {
    try {
      const alertId = String(req.params.id || '').trim();
      const note = req.body?.note ? String(req.body.note).trim() : undefined;
      if (!alertId) return res.status(400).json({ error: "Alert ID is required" });
      const result = await resolveSosAlert(dbAdmin, alertId, sendMetaOutboundMessage, note);
      if (!result.resolved) return res.status(404).json({ error: "SOS alert not found" });
      return res.json({ status: "ok", ...result });
    } catch (error: any) {
      console.error("[Meta SOS Alert Resolve POST] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to resolve SOS alert" });
    }
  });

  // Abandoned Cart & Unfinished Booking Recovery Runner
  app.post("/api/meta/abandoned-recovery/run", async (req, res) => {
    try {
      const { minIdleMs, maxIdleMs, dryRun = false } = req.body || {};
      const result = await processAbandonedSessionsRecovery(dbAdmin, sendMetaOutboundMessage, {
        ...(minIdleMs !== undefined ? { minIdleMs: Number(minIdleMs) } : {}),
        ...(maxIdleMs !== undefined ? { maxIdleMs: Number(maxIdleMs) } : {}),
        dryRun: Boolean(dryRun),
      });
      return res.json({ status: "ok", ...result });
    } catch (error: any) {
      console.error("[Meta Abandoned Recovery POST] Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to run abandoned recovery" });
    }
  });

  // Meta Approved Template Fallback Config (Outside 24h Window)
  app.get("/api/meta/template-config", async (_req, res) => {
    try {
      const settings = await getMetaTemplateSettings(dbAdmin);
      return res.json({ status: "ok", settings });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to load Meta template settings" });
    }
  });

  app.post("/api/meta/template-config", async (req, res) => {
    try {
      const settings = await saveMetaTemplateSettings(req.body || {}, dbAdmin);
      return res.json({ status: "ok", settings });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to save Meta template settings" });
    }
  });

  // Resilient helper to call Gemini generateContent with retries and fallback models
  async function generateContentWithRetry(client: any, params: any, maxRetries = 2) {
    let attempt = 0;
    let delay = 1000;
    const modelsToTry = [params.model, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-3.5-flash"];
    const models = Array.from(new Set(modelsToTry.filter(Boolean)));

    for (const model of models) {
      for (attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[Gemini API] Calling model ${model}, attempt ${attempt + 1}...`);
          const response = await client.models.generateContent({
            ...params,
            model: model,
          });
          return response;
        } catch (err: any) {
          const status = err?.status || err?.code || 500;
          const message = err?.message || String(err);
          
          const isQuotaExceeded = status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota");
          const isUnavailable = status === 503 || message.includes("503") || message.includes("UNAVAILABLE") || message.includes("high demand") || message.includes("temporary");
          
          if (isQuotaExceeded || isUnavailable) {
            console.warn(`[Gemini API] Model ${model} failed with ${isQuotaExceeded ? 'Quota Exceeded (429)' : 'Unavailable (503)'}: ${message}. Switching to next fallback model immediately...`);
            break; // Break the retry loop for this model, proceed to the next model in the outer loop
          }

          const isTransient = status === 500 || status === 502 || status === 504 || message.includes("502") || message.includes("504") || message.includes("timeout");
          if (isTransient && attempt < maxRetries - 1) {
            console.warn(`[Gemini API] Transient error (status: ${status}) on model ${model}: ${message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5;
          } else {
            console.error(`[Gemini API] Error or out of retries for model ${model}: ${message}`);
            break; // Break current retry loop to try the next fallback model
          }
        }
      }
    }
    throw new Error("Gemini API failed on all models and retries. Please try again later.");
  }

  // AI Copilot Flow Generator using Gemini-3.5-flash
  app.post("/api/meta/generate-flow", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required to generate workflow." });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not set." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `You are an expert conversational flowchart engineer. Generate a list of interconnected nodes representing a WhatsApp/Messenger/Instagram Chatbot automation flow based on the user's request.
The request is: "${prompt}"

Return ONLY a valid JSON array of nodes. Do not wrap it in \`\`\`json markdown blocks, and do not add any explanation or greeting.

Supported node types are:
1. "start" - The beginning of the flow. Should have a single starting node with id "n_start" and nextNodeId pointing to the first interactive node.
2. "message" - Sends a text message. Properties in "data": "label", "text" (Swahili/English friendly text), and "nextNodeId" (optional).
3. "question" - Asks the user a question and captures their text input into a variable. Properties in "data": "label", "text", "variableName" (the name of the variable to store the response, e.g. "pickup", "destination", "quantity", "food_name"), and "nextNodeId".
4. "ai_decision" - Real-time NLP classifier using keywords or AI. Properties in "data": "label", "nextNodeId" (default path), and "intentMappings" (an array of objects, e.g. { keywords: "taxi, gari, safari", nextNodeId: "n_taxi_welcome" }).
5. "payment" - Request/process mobile payment. Properties in "data": "label", "paymentAmount" (number), "nextNodeId".
6. "create_order" - Creates a database record for Papo Hapo Super App. Properties in "data": "label", "serviceType" (one of "taxi", "food", "parcel", "salon", "bus"), "nextNodeId".
7. "end" - Goodbye or summary screen. Properties in "data": "label", "text". "nextNodeId" should be empty/null or omitted for "end" nodes.

Every node must have:
- "id": a unique string (e.g. "n_start", "n_welcome", "n_ask_location", "n_create_ride", "n_end")
- "type": one of the types above
- "position": an object with x and y coordinates (e.g. { x: 100, y: 150 }) arranged horizontally/vertically in a clean 2D layout (spacing nodes approx 200px apart so they don't overlap)
- "data": the object containing specific keys for that node type.

Arrange the nodes in a complete, highly realistic, logical flow to satisfy the user's intent. Ensure all path linkages (nextNodeId/intentMappings) refer to valid node ids in the same array! Keep language professional and in Swahili combined with easy English accents as typical of Dar es Salaam (e.g., "Karibu Papo Hapo", "Tafadhali chagua...").`;

      const response = await generateContentWithRetry(client, {
        model: "gemini-3.5-flash",
        contents: systemInstruction,
      });

      let responseText = response.text || "[]";
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const nodes = JSON.parse(responseText);
      res.json({ nodes, status: "success" });
    } catch (err: any) {
      console.error("[Flow Generator Error]", err);
      res.status(500).json({ error: "Failed to generate workflow nodes via AI: " + err.message });
    }
  });

  // AI Website Builder & Canvas Architect Copilot (Gemini API)
  app.post("/api/website-builder/ai-assist", async (req, res) => {
    const { prompt, currentWidgets, channel, action } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `You are the Lead Website & E-commerce Layout Architect for "Papo Hapo Super App" Website Builder.
The administrator wants assistance building or modifying the drag-and-drop website layout.
Active Channel/Theme: "${channel || 'Grocery'}"
Administrator Prompt: "${prompt}"
Action requested: "${action || 'generate'}"
Existing widgets count: ${(currentWidgets || []).length}

Output valid JSON matching this schema:
{
  "reply": "Conversational friendly Swahili & English response explaining what layout was crafted and actionable e-commerce conversion advice",
  "recommendations": ["Tip 1", "Tip 2", "Tip 3"],
  "widgets": [
    {
      "id": "widget_unique_id",
      "order": 1,
      "type": "PRODUCT",
      "title": "Widget Title",
      "subtitle": "Subtitle description",
      "showTitleInApp": true,
      "active": true,
      "displayStyle": "grid",
      "contentSource": "featured",
      "selectedItemIds": ["item-1", "item-2"],
      "deviceTarget": "all",
      "mobileVisible": true,
      "desktopVisible": true,
      "mobileItemsPerRow": 2,
      "desktopItemsPerRow": 6,
      "rowsCount": 2,
      "autoScrollAnimation": false,
      "customBackgroundEnabled": false,
      "backgroundType": "solid",
      "backgroundColor": "#f8fafc",
      "showViewAllButton": true,
      "tagLabel": "PRODUCT",
      "tagLayout": "Grid"
    }
  ]
}

Allowed types: "PRODUCT", "CATEGORY", "BRAND", "MEDIA_BANNER", "STORE".
Allowed displayStyle: "grid", "horizontal", "item_list", "circle", "card_grid", "tabs_products", "banner", "u_shape_grid".
Allowed mobileItemsPerRow: 1, 2, or 3.
Allowed desktopItemsPerRow: 2, 3, 4, 5, 6, or 7.

Ensure the widget layout is modern, clean, responsive, and specifically tailored to the user's prompt (e.g. Ramadan Kareem specials, Electronics flash sale, Pharmacy wellness, Fresh groceries, etc.).
Return ONLY pure JSON without markdown code fences.`;

      const response = await generateContentWithRetry(client, {
        model: "gemini-3.5-flash",
        contents: systemInstruction,
      });

      let responseText = response.text || "{}";
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const result = JSON.parse(responseText);
      res.json({ status: "success", ...result });
    } catch (err: any) {
      console.error("[Website Builder AI Error]", err);
      res.status(500).json({ error: "Failed to process AI layout: " + err.message });
    }
  });

  // AI Sales & Operations Insights Endpoint with Multi-Service Intelligence (Gemini-3.7-flash)
  app.post("/api/ai/sales-insights", async (req, res) => {
    const { vendorName, category, products, orders, expenses, customQuestion } = req.body;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Prepare condensed summary for AI
      const productsSummary = (products || []).slice(0, 30).map((p: any) => ({
        name: p.name,
        price: p.price,
        cost: p.costPrice || p.cost || Math.round((p.price || 1000) * 0.45),
        category: p.category || 'general',
        inStock: p.inStock !== false,
        stock: p.stock ?? 20,
        departureTime: p.departureTime,
        origin: p.origin,
        destination: p.destination
      }));

      const ordersSummary = (orders || []).slice(0, 50).map((o: any) => ({
        total: o.totalAmount,
        items: (o.items || []).map((i: any) => ({ name: i.name || i.productName, qty: i.quantity || 1 })),
        status: o.status,
        date: o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString() : (o.createdAt || 'recent'),
        selectedSeats: o.selectedSeats,
        busRoute: o.busRoute
      }));

      const catStr = (category || '').toLowerCase();
      const nameStr = (vendorName || '').toLowerCase();
      const isBus = catStr === 'bus_ticket' || catStr.includes('bus') || nameStr.includes('bus') || nameStr.includes('coach') || nameStr.includes('safari') || nameStr.includes('trans');
      const isHotel = catStr === 'hotel' || catStr.includes('stay') || catStr.includes('lodge') || nameStr.includes('hotel') || nameStr.includes('lodge');
      const isPharmacy = catStr === 'pharmacy' || catStr.includes('pharma') || catStr.includes('dawa') || nameStr.includes('pharmacy') || nameStr.includes('dawa');
      const isSalon = catStr === 'salon' || catStr.includes('style') || nameStr.includes('salon') || nameStr.includes('kinyozi');
      const isCarRental = catStr === 'car_rental' || nameStr.includes('rental') || nameStr.includes('rent a car');
      const isGrocery = catStr === 'grocery' || catStr.includes('mart') || catStr.includes('soko') || nameStr.includes('mart');
      const isRestaurant = catStr === 'restaurant' || catStr.includes('food') || catStr.includes('chakula') || nameStr.includes('restaurant') || nameStr.includes('cafe') || nameStr.includes('kitchen') || (!isBus && !isHotel && !isPharmacy && !isSalon && !isCarRental && !isGrocery);

      let systemRole = "";
      let itemTypeLabel = "Bidhaa / Huduma";
      let cogsDescription = "Gharama za uendeshaji (COGS)";
      let forecastExample = "Bidhaa au rasilimali inayohitaji kuongezwa";
      let peakHoursExample = "Muda wa foleni kubwa au safari nyingi";
      let profitTipContext = "Ushauri wa kupunguza gharama na kuongeza mapato";

      if (isBus) {
        systemRole = `You are an elite Bus Fleet & Intercity Transit Operations Consultant and Revenue Management AI Analyst for "PapoBus" in East Africa (Tanzania, Kenya, Uganda).
You specialize in bus ticketing, passenger seat occupancy (load factor), route profitability (e.g. Dar es Salaam, Arusha, Dodoma, Mwanza, Mbeya, Morogoro), bus departure schedules, diesel fuel efficiency, and fleet operational costs.
CRITICAL: Do NOT give restaurant or food advice. Treat all products as bus routes/trips, and orders as passenger ticket bookings.`;
        itemTypeLabel = "Njia ya Basi / Tiketi (Bus Route)";
        cogsDescription = "Gharama za mafuta ya dizeli, madereva, posho za wafanyakazi na vituo vya mabasi";
        forecastExample = "Idadi ya viti vya ziada au basi la nyongeza kwenye njia maarufu";
        peakHoursExample = "Masaa ya kuondoka asubuhi na siku za wiki zenye abiria wengi (Ijumaa, Jumapili na msimu wa sikukuu)";
        profitTipContext = "Ushauri wa viwango vya nauli (VIP vs Standard), kuongeza viti vilivyolipiwa (load factor), na kudhibiti mafuta";
      } else if (isHotel) {
        systemRole = `You are a world-class Hospitality & Hotel Operations Consultant for "PapoStay" in East Africa.
You specialize in room booking management, occupancy rate optimization, RevPAR, guest satisfaction, housekeeping, and accommodation pricing.
CRITICAL: Treat products as hotel room types (Single, Double, VIP Suites) and orders as room reservations.`;
        itemTypeLabel = "Aina ya Chumba (Room Type)";
        cogsDescription = "Gharama za umeme, usafi wa vyumba, sabuni, mashuka na huduma za wageni";
        forecastExample = "Vyumba vinavyotakiwa kuwa tayari kwa wageni wa wikendi";
        peakHoursExample = "Masaa ya Check-in/Check-out na vipindi vya wageni wengi";
        profitTipContext = "Ushauri wa bei za vyumba kulingana na misimu ya utalii au mikutano";
      } else if (isPharmacy) {
        systemRole = `You are a certified Clinical Pharmacist & Pharmacy Retail Consultant for "PapoPharmacy" in East Africa.
You specialize in essential medicines, prescription dispensation (Rx), OTC medications, expiry monitoring, and clinical inventory management.
CRITICAL: Treat products as medications and pharmaceutical products, NOT restaurant food.`;
        itemTypeLabel = "Dawa / Bidhaa ya Afya (Medication)";
        cogsDescription = "Gharama za kuagiza dawa kutoka kwa wasambazaji (Wholesalers & MSD)";
        forecastExample = "Dawa muhimu zinazotakiwa kuagizwa kabla hazijaisha stoo";
        peakHoursExample = "Muda wa maagizo mengi ya wagonjwa (asubuhi na jioni)";
        profitTipContext = "Ushauri wa ununuzi wa jumla na kuzuia dawa kuisha muda wake (expiry)";
      } else if (isSalon) {
        systemRole = `You are an expert Salon & Beauty Studio Business Consultant for "PapoStyle" in East Africa.
You specialize in hair styling, barbering, beauty treatments, stylist appointment scheduling, and cosmetic retail.
CRITICAL: Treat products as salon services/beauty products and orders as client appointments.`;
        itemTypeLabel = "Huduma ya Saluni / Urembo";
        cogsDescription = "Gharama za bidhaa za urembo, mafuta, dawa za nywele na vifaa";
        forecastExample = "Nafasi za wateja na bidhaa za saluni";
        peakHoursExample = "Muda wa wateja wengi wa kinyozi na nywele (Ijumaa jioni na Jumamosi)";
        profitTipContext = "Ushauri wa ratiba za wateja na ofa za pamoja za huduma";
      } else if (isCarRental) {
        systemRole = `You are a Fleet Rental & Automotive Operations Consultant for "PapoRent" in East Africa.
You specialize in vehicle rental utilization, fleet servicing, car booking schedules, and rental pricing.`;
        itemTypeLabel = "Gari la Kukodi (Rental Vehicle)";
        cogsDescription = "Gharama za bima, matengenezo ya magari na ufuatiliaji wa GPS";
        forecastExample = "Magari yanayohitaji matengenezo au maandalizi ya safari";
        peakHoursExample = "Vipindi vya safari za wikendi, mikutano na uwanja wa ndege";
        profitTipContext = "Ushauri wa viwango vya kodi kwa siku na ulinzi wa vyombo vya usafiri";
      } else if (isGrocery) {
        systemRole = `You are a Supermarket & Fresh Produce Retail Consultant for "PapoMart" in East Africa.
You specialize in grocery sales, fast-moving consumer goods (FMCG), fresh produce turnover, shelf management, and retail shrinkage reduction.`;
        itemTypeLabel = "Bidhaa ya Sokoni / Grocery Item";
        cogsDescription = "Gharama za ununuzi wa bidhaa sokoni au kwa mawakala";
        forecastExample = "Bidhaa zinazotakiwa kuagizwa sokoni kabla ya wikendi";
        peakHoursExample = "Masaa ya ununuzi wa jioni ya familia na siku za sokoni";
        profitTipContext = "Ushauri wa kuzuia kuharibika kwa vyakula vibichi na ofa za bidhaa za haraka";
      } else {
        systemRole = `You are an Executive Chef & Restaurant Business Consultant for "PapoFood" in East Africa (Tanzania, Kenya, Uganda).
You specialize in dining floor management, menu engineering, kitchen food costs (COGS), recipes, portioning, and culinary inventory.`;
        itemTypeLabel = "Chakula / Kinywaji (Dish / Beverage)";
        cogsDescription = "Gharama ya viungo vya jikoni (nyama, mchele, mafuta, mboga)";
        forecastExample = "Viungo vya chakula vinavyohitajika kuagizwa sokoni";
        peakHoursExample = "Masaa ya mchana (Lunch: 12:30 PM - 2:30 PM) na jioni (Dinner: 7:00 PM - 10:00 PM)";
        profitTipContext = "Ushauri wa ununuzi wa viungo na kuzuia upotevu wa jikoni";
      }

      const prompt = `${systemRole}
Analyze the business performance and provide high-value, actionable insights and inventory forecasts.

Business: "${vendorName || 'Biashara'}" (${category || (isBus ? 'bus_ticket' : 'biashara')})
Offerings / Inventory Sample: ${JSON.stringify(productsSummary)}
Recent Bookings / Orders Sample: ${JSON.stringify(ordersSummary)}
Expenses Sample: ${JSON.stringify((expenses || []).slice(0, 10))}
${customQuestion ? `Specific Question from Business Owner: "${customQuestion}"` : ''}

Provide your response in JSON format matching this schema:
{
  "executiveSummary": "Concise overview in fluent, encouraging Swahili with key English business terms directly addressing this specific business type (${isBus ? 'Mabasi & Tiketi' : isHotel ? 'Hoteli & Vyumba' : isPharmacy ? 'Dawa & Afya' : isRestaurant ? 'Mgahawa & Chakula' : 'Biashara ya Rejareja'}, approx 2-3 sentences)",
  "salesHealthScore": 88, // integer 0-100
  "topPerformers": [
    { "name": "${itemTypeLabel} Name", "salesCount": 14, "revenue": 140000, "insight": "High demand, strong profit contribution" }
  ],
  "slowMovers": [
    { "name": "${itemTypeLabel} Name", "suggestion": "Actionable suggestion tailored to this business type" }
  ],
  "cogsAndProfitAnalysis": {
    "estimatedRevenue": 850000,
    "estimatedCogs": 380000,
    "grossProfitMarginPercent": 55.3,
    "profitAdvice": "${profitTipContext}"
  },
  "inventoryForecast": [
    {
      "ingredientOrItem": "${forecastExample}",
      "action": "increase_stock", // "increase_stock" | "reduce_stock" | "maintain"
      "quantityRecommendation": "Specific recommendation in Swahili",
      "reasoning": "Clear business reasoning based on sales pattern"
    }
  ],
  "peakHoursAdvice": "${peakHoursExample}",
  "marketingActionTips": [
    "Tip 1: Practical recommendation in Swahili for this specific business",
    "Tip 2: Practical recommendation in Swahili for this specific business",
    "Tip 3: Practical recommendation in Swahili for this specific business"
  ],
  "generatedAt": "${new Date().toISOString()}"
}

Return ONLY clean valid JSON. Do not include markdown code block syntax.`;

      const response = await generateContentWithRetry(client, {
        model: "gemini-3.7-flash",
        contents: prompt
      });

      let responseText = response.text || "{}";
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const report = JSON.parse(responseText);
      res.json({ report, status: "success" });
    } catch (err: any) {
      console.error("[AI Sales Insights Error]", err);
      res.status(500).json({ error: "Failed to generate AI insights: " + err.message });
    }
  });

  // Twilio SMS Simulation endpoint for vendor dashboard
  app.post("/api/twilio/simulate", async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "phone and message parameters are required" });
    }
    
    console.log(`[Twilio Simulator] Message from ${phone}: "${message}"`);
    
    try {
      const reply = await handleSMSInput(phone, message, dbAdmin);
      res.json({ reply });
    } catch (error: any) {
      console.error("[Twilio Simulator] Failed to process:", error);
      res.status(500).json({ error: "Failed to simulate SMS response", details: error.message });
    }
  });

  // Unified Payment Gateway Status (DaliPay + Mongike + Lipa Namba 5656565 — no secrets exposed)
  app.get("/api/payments/status", async (_req, res) => {
    try {
      const mongikeConfigured = isMongikeLiveConfigured();
      const dalipayCfg = getDaliPayConfig();
      const activeProvider = dalipayCfg.configured
        ? "dalipay"
        : mongikeConfigured
        ? "mongike"
        : "sandbox";
      let recentCallbacks: any[] = [];
      if (dbAdmin) {
        try {
          const snap = await dbAdmin.collection("payment_callbacks").limit(15).get();
          recentCallbacks = (snap.docs || [])
            .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
            .sort((a: any, b: any) => {
              const ta = Date.parse(String(a.updated_at || 0)) || 0;
              const tb = Date.parse(String(b.updated_at || 0)) || 0;
              return tb - ta;
            })
            .slice(0, 8);
        } catch {}
      }
      return res.json({
        provider: activeProvider,
        configured: dalipayCfg.configured || mongikeConfigured,
        mode: dalipayCfg.configured
          ? dalipayCfg.mode === "test"
            ? "sandbox"
            : "live"
          : mongikeConfigured
          ? "live"
          : "sandbox",
        endpoint: dalipayCfg.configured
          ? `${dalipayCfg.baseUrl}${dalipayCfg.collectionsPath}`
          : MONGIKE_TANZANIA_MOMO_ENDPOINT,
        webhookPath: dalipayCfg.configured ? "/webhooks/gateway" : "/api/payments/webhook",
        gatewayWebhookPath: "/webhooks/gateway",
        gatewayWebhookUrl: getPublicWebhookCallbackUrl(),
        lipaNamba: PAPO_LIPA_NAMBA,
        dalipay: {
          configured: dalipayCfg.configured,
          mode: dalipayCfg.mode,
          hasCallbackSecret: dalipayCfg.hasCallbackSecret,
          collectionsEndpoint: `${dalipayCfg.baseUrl}${dalipayCfg.collectionsPath}`,
          disbursementsEndpoint: `${dalipayCfg.baseUrl}${dalipayCfg.disbursementsPath}`,
        },
        mongike: {
          configured: mongikeConfigured,
          mode: mongikeConfigured ? "live" : "sandbox",
        },
        recentCallbacks,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to read gateway status" });
    }
  });

  // Mongike Payment Initiation Proxy
  app.post("/api/payments/initiate", async (req, res) => {
    const { order_id, amount, buyer_phone, fee_payer, collection } = req.body || {};
    const result = await initiateMongikePayment(
      {
        orderId: String(order_id || ""),
        amount: Number(amount) || 0,
        buyerPhone: String(buyer_phone || ""),
        feePayer: fee_payer === "CUSTOMER" ? "CUSTOMER" : "MERCHANT",
        collection: collection === "rides" ? "rides" : "orders",
      },
      dbAdmin,
      {
        autoSimulateWebhook: true,
        onSimulatedPaid: (info) => notifyMongikePaymentPaidToWhatsApp(info, dbAdmin),
      }
    );

    if (result.status === "error") {
      return res.status(result.httpStatus || 500).json(result.error || { status: "error", message: result.message });
    }

    return res.status(result.httpStatus || 201).json({
      status: result.status,
      message: result.message,
      sandbox: result.sandbox,
      data: result.data,
    });
  });

  // PapoPay WhatsApp Express Checkout (PapoWallet PIN, Card, Lipa Namba 5656565, or Mongike Mobile Money)
  app.post("/api/payments/papopay-whatsapp-checkout", async (req, res) => {
    try {
      const { statusCode, payload } = await processPapoPayWhatsAppCheckout(dbAdmin, req.body || {});
      return res.status(statusCode).json(payload);
    } catch (err: any) {
      console.error("[PapoPay WhatsApp Checkout] Error:", err);
      return res.status(500).json({ ok: false, error: "Hitilafu ya mfumo wakati wa kuchakata malipo." });
    }
  });

  // Admin Manual Confirmation for Lipa Namba 5656565 / Pending Payments
  app.post("/api/payments/confirm-manual", async (req, res) => {
    try {
      const authRes = await verifyAdminRequest(req.headers.authorization, dbAdmin);
      if ('error' in authRes) {
        return res.status(authRes.status).json({ ok: false, error: authRes.error });
      }
      const { orderId, collection, transactionRef, note } = req.body || {};
      const cleanOrderId = String(orderId || "").trim();
      if (!cleanOrderId || cleanOrderId.length > 128) {
        return res.status(400).json({ ok: false, error: "Kitambulisho cha oda hakipo au si sahihi." });
      }
      const colName: "orders" | "rides" = collection === "rides" ? "rides" : "orders";
      const result = await confirmManualOrderPayment(dbAdmin, {
        orderId: cleanOrderId,
        collection: colName,
        adminUid: authRes.admin.uid,
        adminEmail: authRes.admin.email,
        transactionRef: typeof transactionRef === "string" ? transactionRef.trim().slice(0, 80) : undefined,
        note: typeof note === "string" ? note.trim().slice(0, 200) : undefined,
        onConfirmedPaid: (info) => notifyMongikePaymentPaidToWhatsApp(info, dbAdmin),
      });
      if (!result.ok) {
        return res.status(result.statusCode || 400).json({ ok: false, error: result.error });
      }
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Confirm Manual Payment] Error:", err);
      return res.status(500).json({ ok: false, error: "Hitilafu ya seva wakati wa kuthibitisha malipo." });
    }
  });

  // PapoPay Wallet Balance Summary for In-Chat Checkout Sheet
  app.get("/api/payments/papopay-wallet-balance", async (req, res) => {
    try {
      const phone = String(req.query.phone || "").trim();
      if (phone.replace(/\D/g, "").length < 9) {
        return res.json({ found: false, walletBalance: 0, points: 0, isCardFrozen: false });
      }
      const summary = await getPapoWalletSummaryAndStatement(dbAdmin, phone);
      return res.json({
        found: summary.found,
        walletBalance: summary.walletBalance,
        points: summary.points,
        isCardFrozen: summary.isCardFrozen,
      });
    } catch {
      return res.json({ found: false, walletBalance: 0, points: 0, isCardFrozen: false });
    }
  });

  const handleDaliPayWebhookRequest = async (req: any, res: any) => {
    try {
      const rawBody =
        req.rawBody ||
        (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
      const sigCheck = verifyDaliPaySignature(rawBody, req.headers["x-signature"]);
      if (!sigCheck.valid) {
        return res.status(401).json({ ok: false, error: sigCheck.reason || "Invalid X-Signature" });
      }
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const outcome = await processDaliPayWebhook(payload, dbAdmin);
      if (
        outcome.kind === "collection" &&
        outcome.isPaid &&
        outcome.realOrderId &&
        outcome.targetType !== "disbursements" &&
        dbAdmin
      ) {
        await notifyMongikePaymentPaidToWhatsApp(
          {
            targetId: outcome.realOrderId,
            targetType: outcome.targetType,
            amount: outcome.amount,
            gatewayRef: outcome.gatewayRef,
          },
          dbAdmin
        ).catch((notifyErr) => {
          console.warn("[DaliPay Webhook] WhatsApp payment notify warning:", notifyErr);
        });
      } else if (
        outcome.kind === "disbursement" &&
        outcome.disbursementInfo?.recipientPhone &&
        dbAdmin
      ) {
        const dInfo = outcome.disbursementInfo;
        if (outcome.isPaid) {
          await sendMetaOutboundMessage({
            channel: "whatsapp",
            recipientId: dInfo.recipientPhone,
            text: `✅ *PESA IMETUMWA KWENYE SIMU YAKO (#${outcome.realOrderId})*\n\n• Kiasi: *TZS ${Number(dInfo.amount || outcome.amount || 0).toLocaleString()}/=*\n• Mtandao: *${dInfo.network || "Mobile Money"}*\n• Rejea ya DaliPay: *${outcome.gatewayRef}*\n\nAsante kwa kutumia PapoPay!`,
          }).catch(() => {});
        } else if (outcome.isFailed && dInfo.refundedAmount) {
          await sendMetaOutboundMessage({
            channel: "whatsapp",
            recipientId: dInfo.recipientPhone,
            text: `⚠️ *KUTUMA PESA HAKUKUKAMILIKA (#${outcome.realOrderId})*\n\nMuamala wa kutuma pesa kwenda ${dInfo.network || "simu"} umeshindikana.\n💰 *Salio lako la TZS ${Number(dInfo.refundedAmount).toLocaleString()}/= limerudishwa PapoWallet yako kiotomatiki.*`,
          }).catch(() => {});
        }
      }
      dispatchOpsWebhookEvent(`dalipay.${outcome.kind}.${outcome.normalizedStatus.toLowerCase()}`, {
        ...outcome,
      }).catch(() => {});
      return res.status(200).json({ ok: true, status: "SUCCESS", provider: "dalipay", ...outcome });
    } catch (err: any) {
      console.error("[DaliPay Webhook] Error:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Webhook failed" });
    }
  };

  // DaliPay Webhook Endpoints (matches https://<domain>/webhooks/gateway & /api/webhooks/gateway)
  app.post("/webhooks/gateway", handleDaliPayWebhookRequest);
  app.post("/api/webhooks/gateway", handleDaliPayWebhookRequest);

  // Operations Daily Briefing & Nod/n8n Automation Bridge
  app.get("/api/ops/briefing", async (req, res) => {
    try {
      const auth = await verifyOpsOrAdminRequest(req, dbAdmin);
      if (!auth.authorized) {
        return res.status(401).json({ ok: false, error: auth.error || "Unauthorized" });
      }
      const briefing = await buildAdminOpsBriefing(dbAdmin);
      return res.json({ ok: true, actor: auth.actor, ...briefing });
    } catch (err: any) {
      console.error("[Ops Briefing API] Error:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Failed to build ops briefing" });
    }
  });

  app.post("/api/ops/send-whatsapp-briefing", async (req, res) => {
    try {
      const auth = await verifyOpsOrAdminRequest(req, dbAdmin);
      if (!auth.authorized) {
        return res.status(401).json({ ok: false, error: auth.error || "Unauthorized" });
      }
      const briefing = await buildAdminOpsBriefing(dbAdmin);
      const rawPhone = String(req.body?.phone || process.env.ADMIN_WHATSAPP_PHONE || "").trim();
      const normalizedPhone = normalizeAdminPhoneForWhatsApp(rawPhone);

      let whatsappSent = false;
      let whatsappReason = "";
      if (normalizedPhone.length >= 11) {
        const phoneNumberId = await resolveWhatsAppPhoneNumberId(dbAdmin, normalizedPhone);
        const sendRes = await sendMetaOutboundMessage({
          channel: "whatsapp",
          recipientId: normalizedPhone,
          phoneNumberId,
          text: briefing.whatsappSummaryText,
          templateFallback: {
            category: "utility",
            bodyParams: [
              `Lipa Namba: ${briefing.lipaNambaPendingCount} pending (TZS ${briefing.lipaNambaPendingTotalTzs.toLocaleString()}) • DaliPay OK: ${briefing.dalipay.completedCount}`,
            ],
          },
        });
        whatsappSent = Boolean(sendRes?.sent);
        whatsappReason = String(sendRes?.reason || "");
      } else {
        whatsappReason = "MISSING_PHONE";
      }
      const webhookDispatched = await dispatchOpsWebhookEvent("ops.daily_briefing", briefing);
      return res.json({
        ok: true,
        whatsappSent,
        whatsappReason: whatsappReason || undefined,
        recipientPhone: normalizedPhone || undefined,
        webhookDispatched,
        briefing,
      });
    } catch (err: any) {
      console.error("[Ops Send Briefing API] Error:", err);
      return res.status(500).json({ ok: false, error: err?.message || "Failed to send ops briefing" });
    }
  });

  // Mobile Money / Unified Gateway Webhook Callback Endpoint
  app.post("/api/payments/webhook", async (req: any, res) => {
    const payload = req.body || {};
    const hasDaliSig = Boolean(req.headers["x-signature"]);
    const isDaliPayload =
      hasDaliSig ||
      Boolean(payload?.event) ||
      Boolean(payload?.data?.external_reference) ||
      Boolean(payload?.external_reference);
    if (isDaliPayload) {
      return await handleDaliPayWebhookRequest(req, res);
    }

    console.log("[Payment Webhook] Received payment callback notification:", JSON.stringify(payload));

    try {
      const outcome = await processMongikeWebhook(payload, dbAdmin);
      if (outcome.isPaid && outcome.realOrderId && dbAdmin) {
        await notifyMongikePaymentPaidToWhatsApp(
          {
            targetId: outcome.realOrderId,
            targetType: outcome.targetType,
            amount: outcome.amount,
            gatewayRef: outcome.gatewayRef,
          },
          dbAdmin
        ).catch((notifyErr) => {
          console.warn("[Payment Webhook] WhatsApp payment notify warning:", notifyErr);
        });
      }

      res.status(200).json({ status: "SUCCESS", message: "Webhook received successfully", ...outcome });
    } catch (err: any) {
      console.error("[Payment Webhook] Error processing payment callback:", err);
      res.status(500).json({ status: "ERROR", message: err.message });
    }
  });

  // In-Memory Geocoding and Reverse Caches
  const geoSearchCache = new Map<string, { data: any; timestamp: number }>();
  const geoReverseCache = new Map<string, { data: any; timestamp: number }>();
  const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

  // Tanzania Spatial POI and Suburb Index
  interface TanzaniaPlace {
    name: string;
    nameSwahili?: string;
    category: string;
    suburb: string;
    district: string;
    city: string;
    region: string;
    lat: number;
    lon: number;
    road?: string;
  }

  const TANZANIA_LOCATIONS: TanzaniaPlace[] = [
    { name: "Posta Mpya / Kivukoni", nameSwahili: "Posta Mpya, Kivukoni", category: "Commercial", suburb: "Kivukoni", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8160, lon: 39.2890, road: "Samora Avenue" },
    { name: "Kivukoni Ferry Terminal", nameSwahili: "Kivukoni Ferry", category: "Transport", suburb: "Kivukoni", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8202, lon: 39.2965, road: "Ocean Road" },
    { name: "Kariakoo Market", nameSwahili: "Soko Kuu la Kariakoo", category: "Market", suburb: "Kariakoo", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8210, lon: 39.2749, road: "Msimbazi Street" },
    { name: "Masaki Peninsula", nameSwahili: "Masaki, Dar es Salaam", category: "Residential/Commercial", suburb: "Masaki", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7490, lon: 39.2760, road: "Haile Selassie Road" },
    { name: "Slipway Shopping Center", nameSwahili: "The Slipway Masaki", category: "Shopping", suburb: "Masaki", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7533, lon: 39.2638, road: "Slipway Road" },
    { name: "Oysterbay (Coco Beach)", nameSwahili: "Coco Beach, Oysterbay", category: "Beach/Leisure", suburb: "Oysterbay", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7725, lon: 39.2683, road: "Toure Drive" },
    { name: "Mikocheni A & B", nameSwahili: "Mikocheni, Dar es Salaam", category: "Commercial/Residential", suburb: "Mikocheni", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7645, lon: 39.2450, road: "Ali Hassan Mwinyi Road" },
    { name: "Mlimani City Mall", nameSwahili: "Mlimani City Mall, Mwenge", category: "Shopping/Mall", suburb: "Mwenge", district: "Ubungo", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7719, lon: 39.2198, road: "Sam Nujoma Road" },
    { name: "Mwenge Bus Stand & Kinyago", nameSwahili: "Mwenge Kinyago", category: "Market/Transport", suburb: "Mwenge", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7715, lon: 39.2295, road: "Bagamoyo Road" },
    { name: "Sinza (Kumekucha / Mori / Afrika Sana)", nameSwahili: "Sinza, Dar es Salaam", category: "Entertainment/Residential", suburb: "Sinza", district: "Ubungo", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7820, lon: 39.2250, road: "Shekilango Road" },
    { name: "Kinondoni (Manyanya / Biafra)", nameSwahili: "Kinondoni Manyanya", category: "Commercial", suburb: "Kinondoni", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7905, lon: 39.2610, road: "Kawawa Road" },
    { name: "Kijitonyama (Sayansi / Al-Hassan)", nameSwahili: "Kijitonyama Sayansi", category: "Tech/Residential", suburb: "Kijitonyama", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7780, lon: 39.2420, road: "Ali Hassan Mwinyi Road" },
    { name: "Tegeta (Nyuki / Namanga / Kibaoni)", nameSwahili: "Tegeta, Dar es Salaam", category: "Commercial", suburb: "Tegeta", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.6780, lon: 39.1980, road: "Bagamoyo Road" },
    { name: "Mbezi Beach (Africana / Rainbow)", nameSwahili: "Mbezi Beach", category: "Residential/Beach", suburb: "Mbezi Beach", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7150, lon: 39.2280, road: "Bagamoyo Road" },
    { name: "Ubungo Inter-City Bus Terminal", nameSwahili: "Ubungo Maji / Simu 2000", category: "Transport", suburb: "Ubungo", district: "Ubungo", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7980, lon: 39.2130, road: "Morogoro Road" },
    { name: "Kimara (Mwisho / Korogwe / Stop Over)", nameSwahili: "Kimara Mwisho", category: "Residential", suburb: "Kimara", district: "Ubungo", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7990, lon: 39.1760, road: "Morogoro Road" },
    { name: "Julius Nyerere International Airport (JNIA)", nameSwahili: "Uwanja wa Ndege wa Kimataifa wa JNIA (Terminal 3)", category: "Airport", suburb: "Kipawa", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8770, lon: 39.2026, road: "Julius Nyerere Road" },
    { name: "Kigamboni (Ferry & Bridge)", nameSwahili: "Kigamboni (Darajani / Ferry)", category: "Residential/Beach", suburb: "Kigamboni", district: "Kigamboni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8350, lon: 39.3100, road: "Kigamboni Bridge" },
    { name: "Tabata (Bima / Dampo / Segerea)", nameSwahili: "Tabata Bima", category: "Residential/Commercial", suburb: "Tabata", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8320, lon: 39.2310, road: "Mandela Road" },
    { name: "Magomeni (Mikumi / Mapipa / Morocco)", nameSwahili: "Magomeni Mapipa", category: "Commercial", suburb: "Magomeni", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8040, lon: 39.2560, road: "Morogoro Road" },
    { name: "Upanga (Mashariki & Magharibi)", nameSwahili: "Upanga, Dar es Salaam", category: "Residential", suburb: "Upanga", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8080, lon: 39.2780, road: "United Nations Road" },
    { name: "Gerezani & Clock Tower", nameSwahili: "Gerezani / Mnara wa Saa", category: "Commercial", suburb: "Gerezani", district: "Ilala", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8240, lon: 39.2840, road: "Nyerere Road" },
    { name: "Temeke (Stereo / Hospital / Chang'ombe)", nameSwahili: "Temeke Stereo", category: "Commercial", suburb: "Temeke", district: "Temeke", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.8550, lon: 39.2630, road: "Mandela Road" },
    { name: "Mbagala (Rangi Tatu / Zakhem / Kuu)", nameSwahili: "Mbagala Rangi Tatu", category: "Commercial/Transport", suburb: "Mbagala", district: "Temeke", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.9020, lon: 39.2650, road: "Kilwa Road" },
    { name: "Kawe (Mzimuni / Tanganyika Packers)", nameSwahili: "Kawe, Dar es Salaam", category: "Residential", suburb: "Kawe", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.7350, lon: 39.2340, road: "Old Bagamoyo Road" },
    { name: "Boko & Bunju", nameSwahili: "Boko / Bunju", category: "Residential", suburb: "Boko", district: "Kinondoni", city: "Dar es Salaam", region: "Dar es Salaam", lat: -6.6350, lon: 39.1550, road: "Bagamoyo Road" },
    { name: "Bagamoyo Town", nameSwahili: "Mji Mkongwe wa Bagamoyo", category: "Historic/Coastal", suburb: "Bagamoyo", district: "Bagamoyo", city: "Bagamoyo", region: "Pwani", lat: -6.4420, lon: 38.9040, road: "Boma Road" },
    { name: "Dodoma City Center (Bunge / Chimwaga)", nameSwahili: "Mji Mkuu wa Dodoma (Bunge)", category: "Capital City", suburb: "Mjini", district: "Dodoma Urban", city: "Dodoma", region: "Dodoma", lat: -6.1730, lon: 35.7480, road: "Nyerere Road" },
    { name: "Arusha Clock Tower", nameSwahili: "Mnara wa Saa Arusha", category: "Tourism/City", suburb: "Kati", district: "Arusha Urban", city: "Arusha", region: "Arusha", lat: -3.3723, lon: 36.6944, road: "Sokoine Road" },
    { name: "Mwanza Rock City (Capri Point)", nameSwahili: "Mwanza Rock City", category: "Lake City", suburb: "Capri Point", district: "Nyamagana", city: "Mwanza", region: "Mwanza", lat: -2.5164, lon: 32.9000, road: "Kenyatta Road" },
    { name: "Zanzibar Stone Town & Forodhani", nameSwahili: "Mji Mkongwe wa Zanzibar (Stone Town)", category: "Historic/Island", suburb: "Stone Town", district: "Mjini", city: "Zanzibar", region: "Mjini Magharibi", lat: -6.1620, lon: 39.1890, road: "Mizingani Road" },
  ];

  function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function resolveNearestTanzaniaPlace(lat: number, lon: number) {
    let nearest = TANZANIA_LOCATIONS[0];
    let minDistance = Infinity;

    for (const place of TANZANIA_LOCATIONS) {
      const dist = calculateDistanceKm(lat, lon, place.lat, place.lon);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = place;
      }
    }

    const isVeryClose = minDistance < 0.8;
    const prefix = isVeryClose ? "" : minDistance < 2.5 ? "Karibu na " : "Eneo la ";
    const displayName = `${prefix}${nearest.nameSwahili || nearest.name}, ${nearest.suburb}, ${nearest.city}, Tanzania`;

    return {
      place_id: Math.abs(Math.floor(lat * 10000 + lon * 10000)),
      licence: "Papo Hapo Spatial Service",
      osm_type: "node",
      osm_id: 100000 + Math.abs(Math.floor(lat * 1000)),
      lat: lat.toString(),
      lon: lon.toString(),
      display_name: displayName,
      address: {
        amenity: nearest.category,
        road: nearest.road || "Barabara Kuu",
        suburb: nearest.suburb,
        city_district: nearest.district,
        city: nearest.city,
        state: nearest.region,
        country: "Tanzania",
        country_code: "tz"
      }
    };
  }

  function searchLocalTanzaniaPlaces(query: string, limit = 5) {
    const qLower = query.toLowerCase().trim();
    if (!qLower) return [];

    const matches = TANZANIA_LOCATIONS.filter(p => 
      p.name.toLowerCase().includes(qLower) ||
      (p.nameSwahili && p.nameSwahili.toLowerCase().includes(qLower)) ||
      p.suburb.toLowerCase().includes(qLower) ||
      p.district.toLowerCase().includes(qLower) ||
      p.city.toLowerCase().includes(qLower)
    ).slice(0, limit);

    return matches.map(p => ({
      place_id: Math.abs(Math.floor(p.lat * 10000 + p.lon * 10000)),
      licence: "Papo Hapo Spatial Service",
      osm_type: "node",
      osm_id: 200000 + Math.abs(Math.floor(p.lat * 1000)),
      lat: p.lat.toString(),
      lon: p.lon.toString(),
      display_name: `${p.nameSwahili || p.name}, ${p.suburb}, ${p.city}, Tanzania`,
      address: {
        amenity: p.category,
        road: p.road || "Barabara Kuu",
        suburb: p.suburb,
        city_district: p.district,
        city: p.city,
        state: p.region,
        country: "Tanzania",
        country_code: "tz"
      }
    }));
  }

  // Resilient Proxy for Nominatim Geocoding with Local Fallback & In-Memory Cache
  app.get("/api/geo/search", async (req, res) => {
    const { q, limit, addressdetails } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query" });

    const queryStr = (q as string).trim();
    const cacheKey = `search:${queryStr.toLowerCase()}:${limit || 5}`;

    const cached = geoSearchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < GEO_CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=${limit || 5}&addressdetails=${addressdetails || 1}&countrycodes=tz&email=aicodtznation@gmail.com`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 
          'Accept-Language': 'sw,en', 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType?.includes("application/json")) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          geoSearchCache.set(cacheKey, { data, timestamp: Date.now() });
          return res.json(data);
        }
      }
      
      // If Nominatim returned empty, rate-limited (429), or error, seamlessly use local spatial index
      const localMatches = searchLocalTanzaniaPlaces(queryStr, parseInt(limit as string, 10) || 5);
      if (localMatches.length > 0) {
        geoSearchCache.set(cacheKey, { data: localMatches, timestamp: Date.now() });
        return res.json(localMatches);
      }

      // If no direct local matches, return generic matching place or cached empty list
      return res.json([]);
    } catch (error: any) {
      // Graceful local fallback on timeout / network / 429
      const localMatches = searchLocalTanzaniaPlaces(queryStr, parseInt(limit as string, 10) || 5);
      return res.json(localMatches);
    }
  });

  // Resilient Proxy for Reverse Geocoding with Spatial Resolver & In-Memory Cache
  app.get("/api/geo/reverse", async (req, res) => {
    const { lat, lon, zoom } = req.query;

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lon as string);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates provided" });
    }

    // Cache key rounded to 4 decimals (~11 meters precision)
    const cacheKey = `rev:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = geoReverseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < GEO_CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=${zoom || 18}&addressdetails=1&email=aicodtznation@gmail.com`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 
          'Accept-Language': 'sw,en', 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType?.includes("application/json")) {
        const data = await response.json();
        if (data && data.display_name) {
          geoReverseCache.set(cacheKey, { data, timestamp: Date.now() });
          return res.json(data);
        }
      }

      // If rate limited or not found, resolve with high precision spatial index
      const localResult = resolveNearestTanzaniaPlace(latitude, longitude);
      geoReverseCache.set(cacheKey, { data: localResult, timestamp: Date.now() });
      return res.json(localResult);
    } catch (error) {
      // Return spatial resolution without throwing 500/429
      const localResult = resolveNearestTanzaniaPlace(latitude, longitude);
      return res.json(localResult);
    }
  });

  // Image proxy to bypass CORS issues for QR stand and print exporting
  app.get("/api/proxy-image", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("url parameter is required");
    
    const imageUrl = url as string;
    
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      } else {
        res.setHeader("Content-Type", "image/png");
      }
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("Image proxy error:", error);
      res.status(500).send("Error proxying image");
    }
  });

  // Helper functions for straight-line georouting fallback
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  function estimateDistanceMultiple(pairs: number[][]): number {
    let total = 0;
    for (let i = 0; i < pairs.length - 1; i++) {
      total += calculateDistance(pairs[i][1], pairs[i][0], pairs[i + 1][1], pairs[i + 1][0]);
    }
    return total;
  }

  function generateStraightLineRoute(pairs: number[][]) {
    if (pairs.length < 2) {
      return {
        code: "Ok",
        isFallback: true,
        routes: [{
          geometry: { coordinates: pairs, type: "LineString" },
          legs: [{ summary: "Kituo kimoja", duration: 0, distance: 0, steps: [] }]
        }],
        waypoints: []
      };
    }

    const polylinePoints: number[][] = [];
    const customSteps: any[] = [];
    let totalDist = 0;

    // Process each consecutive segment and add simulated block-by-block street turns
    for (let segmentIdx = 0; segmentIdx < pairs.length - 1; segmentIdx++) {
      const start = pairs[segmentIdx];
      const end = pairs[segmentIdx + 1];

      const lng1 = start[0];
      const lat1 = start[1];
      const lng2 = end[0];
      const lat2 = end[1];

      const dLng = lng2 - lng1;
      const dLat = lat2 - lat1;

      // Define segment corners directly from start to end without artificial 90-degree box turns
      const segmentCorners: number[][] = [start, end];
      const dist = calculateDistance(lat1, lng1, lat2, lng2);

      // Interpolate points along these street corners to make the line perfectly smooth and detailed
      const segmentInterp: number[][] = [];
      for (let i = 0; i < segmentCorners.length - 1; i++) {
        const c1 = segmentCorners[i];
        const c2 = segmentCorners[i + 1];

        if (segmentInterp.length === 0 || 
            segmentInterp[segmentInterp.length - 1][0] !== c1[0] || 
            segmentInterp[segmentInterp.length - 1][1] !== c1[1]) {
          segmentInterp.push(c1);
        }

        const subDist = calculateDistance(c1[1], c1[0], c2[1], c2[0]);
        // Interpolate every ~15-20 meters for a smooth animation sequence
        const numSteps = Math.max(1, Math.floor(subDist / 18));
        for (let k = 1; k < numSteps; k++) {
          const ratio = k / numSteps;
          segmentInterp.push([
            c1[0] + (c2[0] - c1[0]) * ratio,
            c1[1] + (c2[1] - c1[1]) * ratio
          ]);
        }
      }
      segmentInterp.push(end);

      // Append coordinates
      segmentInterp.forEach(pt => {
        if (polylinePoints.length === 0 || 
            polylinePoints[polylinePoints.length - 1][0] !== pt[0] || 
            polylinePoints[polylinePoints.length - 1][1] !== pt[1]) {
          polylinePoints.push(pt);
        }
      });

      // Calculate distance for this segment
      const segmentDistance = estimateDistanceMultiple(segmentInterp);
      totalDist += segmentDistance;

      // Construct steps with Swahili directions
      const stepDuration = segmentDistance / 8.3; // ~30 km/h in city traffic
      for (let idx = 0; idx < segmentCorners.length; idx++) {
        const p = segmentCorners[idx];
        let info = "Endelea mbele barabarani";
        let type = "turn";

        if (segmentIdx === 0 && idx === 0) {
          info = "Anza safari, nenda mbele kuelekea barabara kuu";
          type = "depart";
        } else if (segmentIdx === pairs.length - 2 && idx === segmentCorners.length - 1) {
          info = "Umekaribia kufika kituo cha mteja, nenda mbele polepole";
          type = "arrive";
        } else if (idx > 0 && idx < segmentCorners.length - 1) {
          const prev = segmentCorners[idx - 1];
          const next = segmentCorners[idx + 1] || end;
          // Determine cross product sign to detect turn direction (left or right)
          const v1 = [prev[0] - p[0], prev[1] - p[1]];
          const v2 = [next[0] - p[0], next[1] - p[1]];
          const cross = v1[0] * v2[1] - v1[1] * v2[0];
          info = Math.abs(cross) > 1e-10 
            ? (cross > 0 ? "Kunja kulia barabarani" : "Kunja kushoto barabarani")
            : "Nenda moja kwa moja kufuata barabara";
        }

        customSteps.push({
          distance: segmentDistance / segmentCorners.length,
          duration: stepDuration / segmentCorners.length,
          geometry: {
            coordinates: [p],
            type: "Point"
          },
          name: info,
          mode: "driving",
          maneuver: {
            location: p,
            bearing_before: 0,
            bearing_after: 0,
            type: type
          }
        });
      }
    }

    const estDuration = totalDist / 8.3; // ~30 km/h in urban streets

    return {
      code: "Ok",
      isFallback: true,
      routes: [
        {
          geometry: {
            coordinates: polylinePoints,
            type: "LineString"
          },
          legs: [
            {
              summary: "Barabara ya mjini (Dar es Salaam Street Route)",
              weight: estDuration,
              duration: estDuration,
              distance: totalDist,
              steps: customSteps
            }
          ],
          weight_name: "routability",
          weight: estDuration,
          duration: estDuration,
          distance: totalDist
        }
      ],
      waypoints: pairs.map(p => ({
        hint: "",
        distance: 0,
        name: "",
        location: p
      }))
    };
  }

  // Simple in-memory cache to prevent spamming the routing endpoints and getting rate-limited
  const routeCache = new Map<string, any>();

  // Proxy for OSRM Routing
  app.get("/api/geo/route", async (req, res) => {
    const { coords } = req.query; // format: lng,lat;lng,lat
    
    console.log(`[Proxy] OSRM Route requested: ${coords}`);

    if (!coords || typeof coords !== "string" || !coords.includes(",")) {
      return res.status(400).json({ error: "Invalid coordinates format. Expected lng,lat;lng,lat" });
    }

    // Parse pairs beforehand in case we need straight-line fallback
    let coordsPairs: number[][] = [];
    try {
      coordsPairs = coords.split(";").map(pair => {
         const parts = pair.split(",");
         return [parseFloat(parts[0]), parseFloat(parts[1])]; // [lng, lat]
      });
    } catch (e: any) {
      console.log("[Proxy] Info: Parsing coords pair skipped:", e?.message || e);
    }

    if (coordsPairs.length < 2) {
      return res.status(400).json({ error: "Missing source or destination coordinates" });
    }

    // Direct cache key using 4 decimal precision (approx 11m accuracy) for grid resilience
    const cacheKey = coordsPairs.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(";");
    if (routeCache.has(cacheKey)) {
      console.log(`[Proxy] Routing cache HIT for coordinates!`);
      return res.json(routeCache.get(cacheKey));
    }

    const encodedCoords = coordsPairs.map(p => `${p[0]},${p[1]}`).join(";");

    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const raceServices = async (urls: string[], timeoutMs = 3500): Promise<{ data: any, source: string }> => {
      const fetchOne = async (url: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            headers,
            signal: controller.signal
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Invalid Content-Type");
          }
          const json = await res.json();
          if (json && json.code === "Ok") {
            return { data: json, source: url };
          }
          throw new Error(`JSON code non-Ok: ${json?.code}`);
        } catch (e: any) {
          throw new Error(`Failed url ${url}: ${e.message}`);
        } finally {
          clearTimeout(timeoutId);
        }
      };

      try {
        // Promise.any registers success as soon as any promise resolves.
        return await Promise.any(urls.map(url => fetchOne(url)));
      } catch {
        return null;
      }
    };

    // 1. Primary: BRouter API with lonlats (Super fast ~250ms, accurate African/Tanzanian road network)
    try {
      const brouterLonLats = coordsPairs.map(p => `${p[0]},${p[1]}`).join('|');
      const brouterUrl = `https://brouter.de/brouter?lonlats=${brouterLonLats}&profile=car-fast&alternativeidx=0&format=geojson`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const bRes = await fetch(brouterUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData && bData.features && bData.features.length > 0) {
          const feat = bData.features[0];
          const coordinates = feat.geometry?.coordinates || [];
          const totalDistance = parseFloat(feat.properties?.["track-length"] || "0");
          const totalDuration = parseFloat(feat.properties?.["total-time"] || "0");
          
          if (coordinates.length >= 2) {
            const brouterData = {
              code: "Ok",
              routes: [
                {
                  geometry: {
                    coordinates: coordinates,
                    type: "LineString"
                  },
                  legs: [
                    {
                      summary: "Barabara kuu",
                      weight: totalDuration,
                      duration: totalDuration,
                      distance: totalDistance,
                      steps: []
                    }
                  ],
                  weight_name: "routability",
                  weight: totalDuration,
                  duration: totalDuration,
                  distance: totalDistance
                }
              ],
              waypoints: [
                { hint: "", distance: 0, name: "Mwanzo", location: coordsPairs[0] },
                { hint: "", distance: 0, name: "Mwisho", location: coordsPairs[coordsPairs.length - 1] }
              ]
            };
            routeCache.set(cacheKey, brouterData);
            return res.json(brouterData);
          }
        }
      }
    } catch {
      // Continue to OSRM race
    }

    // 2. Secondary: Race public OSRM endpoints with 3000ms timeout
    const carUrls = [
      `https://router.project-osrm.org/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`
    ];

    try {
      const winner = await raceServices(carUrls, 3000);
      if (winner && winner.data) {
        routeCache.set(cacheKey, winner.data);
        return res.json(winner.data);
      }
    } catch {
      // Fallback cleanly
    }

    // 3. Guaranteed instant local road grid simulation fallback:
    if (coordsPairs.length >= 2) {
      const fallbackData = generateStraightLineRoute(coordsPairs);
      routeCache.set(cacheKey, fallbackData);
      return res.json(fallbackData);
    } else {
      return res.status(502).json({ error: "Could not fetch or generate routing data." });
    }
  });

  // Proxy for BigDataCloud Reverse Geocoding (Fallback)
  app.get("/api/geo/bdc-reverse", async (req, res) => {
    const { lat, lon } = req.query;
    
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lon as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Missing or invalid coordinates" });
    }

    const cacheKey = `bdc:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = geoReverseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < GEO_CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=sw`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType?.includes("application/json")) {
        const data = await response.json();
        geoReverseCache.set(cacheKey, { data, timestamp: Date.now() });
        return res.json(data);
      }

      // If BDC rate limits or fails, resolve using local spatial POI index
      const localPlace = resolveNearestTanzaniaPlace(latitude, longitude);
      const bdcFormatted = {
        locality: localPlace.address.suburb,
        city: localPlace.address.city,
        principalSubdivision: localPlace.address.state,
        countryName: "Tanzania",
        localityInfo: {
          administrative: [
            { name: localPlace.address.suburb, description: "suburb" },
            { name: localPlace.address.city, description: "city" }
          ]
        }
      };
      geoReverseCache.set(cacheKey, { data: bdcFormatted, timestamp: Date.now() });
      return res.json(bdcFormatted);
    } catch (error) {
      const localPlace = resolveNearestTanzaniaPlace(latitude, longitude);
      const bdcFormatted = {
        locality: localPlace.address.suburb,
        city: localPlace.address.city,
        principalSubdivision: localPlace.address.state,
        countryName: "Tanzania"
      };
      return res.json(bdcFormatted);
    }
  });

  // MAYA AI Master System Endpoint for Papo Hapo Super App
  app.post("/api/maya/chat", async (req, res) => {
    const { message, history, userContext, userRole } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!message) {
      return res.status(400).json({ error: "Message parameter is required." });
    }

    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY is missing.",
        reply: "Pole sana! Mfumo wa MAYA AI haujaunganishwa na Funguo ya API. Tafadhali weka GEMINI_API_KEY kwenye mipangilio."
      });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const roleMode = userRole || userContext?.userRole || 'mteja';
      
      let roleSpecificPrompt = "";
      if (roleMode === 'dereva' || roleMode === 'rider' || roleMode === 'driver') {
        roleSpecificPrompt = `
UTAMBULISHO WAKO: DEREVA ASSISTANT (SAFARI DEREVA AI 🚖)
- Wewe ni Assistant maalum wa Madereva na Waendesha Boda/Bajaji wa Papo Hapo Super App.
- Msaidie dereva kupata maeneo yenye maombi mengi ya abiria (hotspots: Kariakoo, Posta, Airport JNIA, Mwenge, Mbezi Magufuli, Kimara).
- Mpe ushauri wa kuokoa mafuta, mahesabu ya mapato ya siku na malengo, usalama barabarani, ukaguzi wa chombo cha moto, na mbinu za kupata nyota 5 kutoka kwa abiria.
- Jibu kwa lugha ya staha, udugu wa madereva, na muongozo wa haraka wa kibiashara.
`;
      } else if (roleMode === 'vendor' || roleMode === 'merchant' || roleMode === 'seller') {
        roleSpecificPrompt = `
UTAMBULISHO WAKO: VENDOR ASSISTANT (BIASHARA VENDOR AI 🏪)
- Wewe ni Assistant maalum wa Wafanyabiashara, Wamiliki wa Migahawa, na Maduka wa Papo Hapo Super App.
- Msaidie muuzaji kuchanganua mauzo ya siku, kutambua vyakula/bidhaa zinazopendwa zaidi na wateja, kuweka ofa za punguzo (promotions/discounts), kusimamia stoki na inventory, na kuboresha rating ya duka.
- Mpe mbinu za masoko ya kidijitali za kuongeza wateja na kasi ya kuandaa oda.
`;
      } else {
        roleSpecificPrompt = `
UTAMBULISHO WAKO: MTEJA ASSISTANT (MAYA MTEJA AI 🛍️)
- Wewe ni Assistant maalum wa Wateja na Waagizaji wa Papo Hapo Super App.
- Msaidie mteja kuitisha usafiri wa Boda, Bajaji, Taxi, Ambulansi, Zimamoto, kuagiza chakula kitamu kutoka migahawa iliyosajiliwa, kukagua salio la Papo Wallet, na kutafuta nyumba/hoteli kupitia PapoStay.
`;
      }

      const mayaSystemInstruction = `
Wewe ni MAYA — akili ya bandia (AI) ya Papo Hapo, super app namba moja ya huduma za kila siku Tanzania.

${roleSpecificPrompt}

UTAMBULISHO WA KUTEKELEZA
Wewe si "generic assistant" — wewe ni Mtanzania kidijitali. Unaongea Kiswahili sanifu na cha mtaani (bila kupitiliza), unaelewa maeneo, foleni, bei za usafiri, na tabia za Watanzania. Ukiulizwa kwa Kiingereza, jibu kwa Kiingereza; default ni Kiswahili.

CATALOG ZA MIGAHAWA NA HUDUMA HALISI ZILIZOPO PAPO HAPO (USITATUZE/USIBASHIRI AMBAZO HAZIPO):
1. MIGAHAWA ILIYOSAJILIWA NA MENU ZAOHALISI:
   - "Mgahawa wa Papo Fast Food" (Chips Kuku, Wali Maharage, Mishkaki, Burger, Biryani ya Ng'ombe)
   - "Swahili Cuisine House" (Ugali Samaki wa Kupaka, Mishkaki ya Kuku, Makange ya Samaki, Supu ya Ng'ombe, Wali Njegere)
   - "Kariakoo Fresh Juice & Drinks" (Juice ya Parachichi, Pasheni, Ukwaju, Soda, Maji ya Kilimanjaro)
   - "Kuku Kuku Joint" (Kuku Choma, Kuku Paka, Chipsi Mayai / Zege, Kuku Fry)
   - "Samaki Samaki Spot" (Sangara Choma, Sato Fry, Dagaa wa Kigoma)
   - "Papo Mart" (Duka la grocery, Mkate, Maziwa, Vinywaji, Bidhaa za nyumbani)

KANUNI YA MIGAHAWA NA VITAJI:
- Mtumiaji akiagiza kutoka mgahawa usiopo kwenye mfumo (mfano: McDonald's, KFC, Mlimani City, n.k.), MWELEZE UKWELI WAZI kwa upendo:
  "Kwa sasa kwenye Papo Hapo Super App tuna migahawa iliyosajiliwa kama Mgahawa wa Papo Fast Food, Swahili Cuisine House, Kuku Kuku Joint, na Samaki Samaki Spot. Ungependa nikuagizie [chakula walichoomba] kutoka [mgahawa mmojawapo uliopo]?"

2. HUDUMA ZOTE ZA USAFIRI NA DHARURA:
   - "gari" / "car": Gari la abiria (Taxi)
   - "bajaji": Bajaji ya abiria 3
   - "boda": Pikipiki ya abiria 1
   - "ambulance": Ambulansi ya Dharura ya Afya na Hospitali
   - "fire": Zimamoto / Faya ya Dharura
   - "bus": Mabasi ya Mikoani (Dar -> Dodoma, Arusha, Mwanza, Mbeya, Tanga n.k.)
   - "car_rental": Kukodisha Magari

3. MIZIGO NA MALIPO:
   - "parcel": Papo Express Delivery / Delivery Robot
   - "payment": M-Pesa, Mixx by Yas (Tigo Pesa), Airtel Money, Papo Wallet & Pointi

4. MADALALI WA NYUMBA & PAPOSTAY (REAL ESTATE & NYUMBA ZA KUPANGA SCHEMA & FLOW):
   - Papo Hapo ina mtandao wa Mawakala na Madalali wa Nyumba waliohakikiwa (Verified Real Estate Brokers / Madalali wa Nyumba na Viwanja) na mfumo wa "PapoStay".
   - Wewe (MAYA) unawajua madalali na mawakala wa nyumba Tanzania (Dar es Salaam - Kinondoni, Sinza, Kijitonyama, Mikocheni, Mbezi, Tabata, Tegeta, Kigamboni, Dodoma, Arusha, Mwanza n.k.).
   - MTINDO NA SCHEMA YA DATABASE YA PAPOSTAY (SCHEMA-LEVEL ARCHITECTURE):
     1. **Uhusiano wa Broker–Landlord–Listing (Many-to-Many Architecture)**:
        - 'landlords' (Wamiliki wa Nyumba) -> Wana-own majengo na vyumba.
        - 'brokers' (Madalali/Mawakala) -> Wana-manage au kutafuta wapangaji.
        - 'listings' (Nyumba/Vyumba/Fremu) -> Property records.
        - 'listing_broker_assignments' (Junction Table):
          * Dalali 1 anaweza kuhudumia nyumba za wamiliki wengi (One broker -> Many landlords).
          * Nyumba 1 inaweza kupewa madalali wengi (Non-exclusive listing) ili kuongeza kasi ya kupata mpangaji, au dalali 1 wa kipekee (Exclusive broker).
     2. **Escrow Payout & Commission Split (Mgawanyo wa Malipo)**:
        - Mteja akilipia, pesa inakwenda kwenye **PapoStay Escrow Vault** (status: 'held_in_escrow').
        - Baada ya Check-in/Handover confirmation:
          * **Landlord Share (e.g. 90%)**: Kodi kuu ya pango inakwenda kwa Mwenye Nyumba.
          * **Broker Commission (e.g. 10% au Kodi ya Mwezi 1)**: Ada ya ubonge/dalali aliyefanikisha viewing & checkin.
          * **Platform Service Fee (2% - 5%)**: Ada ya PapoHapo ya ulinzi wa Escrow & Mkataba wa Kidijitali.
     3. **Booking Fee vs Full Rent Escrow (Holding Deposit vs Kodi Yote)**:
        - **Booking Fee / Holding Deposit (e.g. 50k / 10%)**: Inashikilia nyumba kwa siku 3-7 ili isichukuliwe na mtu mwingine; ina hatari ndogo zaidi ya kifedha kwa wallet system.
        - **Full Rent Escrow**: Inashikilia kodi ya miezi 3-12 mpaka mpangaji anapokea funguo na kutosheka na hali ya nyumba.
     4. **Dispute Resolution & Admin Authority (Mgogoro na Uamuzi)**:
        - Endapo mpangaji atakuta nyumba haina maji/umeme au picha zilikuwa za uongo, anaweka 'Dispute Hold'.
        - **Super Admin Dashboard** ndiyo yenye mamlaka kamili ya ku-review ushahidi, kuamuru **Full Refund** kwa mpangaji, **Partial Release**, au **Release to Landlord/Broker** endapo mteja alighairi bila msingi.

KANUNI ZA UTENDAJI (fuata kwa mpangilio kila ombi)
1. Elewa nia (intent) ya mtumiaji.
2. Kama taarifa haitoshi kutekeleza (mfano: eneo halijulikani), ULIZA swali FUPI moja — usibashiri (usi-hallucinate) maelezo ya bei, dereva, au eneo.
3. Chagua function sahihi kutoka Tool Registry.
4. Kama function ni ya AINA YA MALIPO au ya KUFUTA/KUBADILISHA kitu (delete, cancel, refund), lazima:
   a. Onyesha muhtasari wazi (nini, kiasi gani, kwa nani/wapi).
   b. Subiri uthibitisho wa moja kwa moja wa mtumiaji (ndiyo/hapana au PIN) KABLA ya kuita function.
   c. Kamwe usiite payment function bila uthibitisho huu.
5. Baada ya function kurudisha matokeo, eleza kwa lugha ya kawaida ya kibinadamu.

HISIA NA MTINDO
Wewe ni wa kirafiki, mwepesi, na wa kitaalamu — kama rafiki anayejua mambo. Tumia sentensi fupi na lugha nyepesi.
`;

      const mayaTools = [
        {
          functionDeclarations: [
            {
              name: "bookTaxi",
              description: "Book a ride in Papo Hapo: car (gari), boda (pikipiki), bajaji, ambulance (ambulansi ya dharura), or fire (zimamoto/faya).",
              parameters: {
                type: "OBJECT",
                properties: {
                  pickup_location: { type: "STRING", description: "Eneo la kuchukulia mtumiaji (pickup location)" },
                  destination: { type: "STRING", description: "Eneo la kufikisha mtumiaji (destination)" },
                  vehicle_type: { 
                    type: "STRING", 
                    enum: ["car", "boda", "bajaji", "ambulance", "fire"],
                    description: "Aina ya usafiri: car, boda, bajaji, ambulance (ambulansi), fire (zimamoto)" 
                  },
                  city: { 
                    type: "STRING", 
                    enum: ["Dar es Salaam", "Arusha", "Dodoma", "Mwanza"],
                    description: "Mji wa safari nchini Tanzania" 
                  }
                },
                required: ["pickup_location", "destination", "vehicle_type"]
              }
            },
            {
              name: "orderFood",
              description: "Order food or drinks from restaurants in Papo Hapo Super App.",
              parameters: {
                type: "OBJECT",
                properties: {
                  restaurant_name: { type: "STRING", description: "Jina au aina ya mgahawa" },
                  items: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        item_name: { type: "STRING", description: "Jina la chakula (mfano: Chips Kuku, Wali Maharage, Soda)" },
                        quantity: { type: "NUMBER", description: "Idadi ya sahani/vitu" }
                      },
                      required: ["item_name"]
                    },
                    description: "Orodha ya vyakula vya kuagiza"
                  },
                  delivery_location: { type: "STRING", description: "Eneo la kuletewa chakula" }
                },
                required: ["items", "delivery_location"]
              }
            },
            {
              name: "confirmPayment",
              description: "Process mobile money payment (M-Pesa, Mixx, Airtel Money, Papo Wallet). Requires user explicit confirmation.",
              parameters: {
                type: "OBJECT",
                properties: {
                  amount: { type: "NUMBER", description: "Kiasi cha TSH cha kulipa" },
                  method: { 
                    type: "STRING", 
                    enum: ["mpesa", "mixx", "airtel_money", "papo_wallet"],
                    description: "Njia ya malipo ya simu" 
                  },
                  reference_id: { type: "STRING", description: "Kumbukumbu au aina ya huduma inayolipiwa" },
                  user_confirmed: { type: "BOOLEAN", description: "Must be true if user explicitly confirmed" }
                },
                required: ["amount", "method", "user_confirmed"]
              }
            },
            {
              name: "checkBalance",
              description: "Check user wallet balance or Papo Hapo points.",
              parameters: {
                type: "OBJECT",
                properties: {
                  account_type: { type: "STRING", enum: ["papo_wallet", "points"], description: "Aina ya akanti au pointi" }
                }
              }
            },
            {
              name: "trackOrder",
              description: "Track live status of active ride, food order, or parcel delivery.",
              parameters: {
                type: "OBJECT",
                properties: {
                  order_id: { type: "STRING", description: "Namba ya oda au safari" }
                }
              }
            },
            {
              name: "sendParcel",
              description: "Request parcel delivery service.",
              parameters: {
                type: "OBJECT",
                properties: {
                  pickup: { type: "STRING", description: "Eneo la kuchukulia mzigo" },
                  destination: { type: "STRING", description: "Eneo la kupeleka mzigo" },
                  item_description: { type: "STRING", description: "Maelezo ya mzigo" }
                },
                required: ["pickup", "destination"]
              }
            }
          ]
        }
      ];

      // Build context string if provided
      let fullPrompt = message;
      if (userContext) {
        fullPrompt = `[Taarifa za Mtumiaji Hivi Sasa: Jina la Mtumiaji: ${userContext.userName || 'Mpendwa'}, Mji: ${userContext.city || 'Dar es Salaam'}, Eneo alipo HALISI HAPA NA SASA (Current Exact Location): ${userContext.location || 'Haijulikani'}, Namba: ${userContext.phone || 'Haipatikani'}]\n\nKUMBUKA MUHIMU:\n- Mtumiaji akiuliza yuko wapi au eneo lake la sasa (mfano: "mim nikowapi saiv", "niko wapi", "location yangu", "wapi nilipo"), mtaje jina lake (${userContext.userName || 'Mpendwa'}) na mweleze ENEO LAKE HALISI LA SASA lililopo hapo juu: "${userContext.location || 'Dar es Salaam'}". Usitaje eneo lolote la zamani au la kubuni.\n\nSwali/Ombi la Mtumiaji: ${message}`;
      }

      // Format input contents
      let contentsPayload: any = fullPrompt;
      if (Array.isArray(history) && history.length > 0) {
        contentsPayload = [
          ...history,
          { role: 'user', parts: [{ text: fullPrompt }] }
        ];
      }

      const response = await generateContentWithRetry(client, {
        model: "gemini-3.5-flash",
        contents: contentsPayload,
        config: {
          systemInstruction: mayaSystemInstruction,
          tools: mayaTools
        }
      });

      const replyText = response.text || "";
      const functionCalls = response.functionCalls || [];

      res.json({
        reply: replyText,
        functionCalls: functionCalls.map((fc: any) => ({
          name: fc.name,
          args: fc.args
        })),
        status: "success"
      });
    } catch (err: any) {
      console.error("[MAYA AI Chat Error]", err);
      res.status(500).json({ 
        error: "Failed to communicate with MAYA AI",
        reply: "Pole sana, muunganisho wa mtandao au mfumo wa MAYA una changamoto kidogo. Unaweza pia kutumia USSD yetu ya *149*00# au utupigie simu ya dharura.",
        details: err.message 
      });
    }
  });

  // Gemini AI Asset Analysis Proxy
  app.post("/api/asset/analyze", async (req, res) => {
    const { image } = req.body; // base64 image data
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `You are an expert 3D Asset Analyzer and Generative AI Assistant for an e-commerce platform. Your job is to analyze the uploaded product images from a vendor and generate a highly precise 3D/AR asset blueprint.

Analyze the images from multiple angles (front, side, back) and provide the output strictly in a valid JSON format. Do not include any conversational text, markdown formatting (like \`\`\`json), or explanations outside the JSON block.

The JSON output must contain the following keys:
1. "product_name": A clean, generic name for the product based on the image.
2. "primary_color": The dominant hex color code of the product.
3. "material_texture": The detected material type (e.g., "matte_plastic", "leather", "polished_wood", "fabric", "metal").
4. "estimated_dimensions": An object containing "width", "height", and "depth" in meters, estimating real-world scale for accurate AR placement.
5. "ar_suitability": A boolean (true/false) indicating if the image quality and product type are sufficient to be rendered in AR.
6. "generation_prompt": A highly detailed prompt to be passed to a 3D Mesh Generation pipeline to create the final .glb/.usdz file. Describe the geometry, lighting, textures, and exact shapes.`;

      const response = await generateContentWithRetry(client, {
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: image } },
            { text: "Analyze this image according to your instructions." }
          ]
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      const analysis = JSON.parse(response.text || "{}");
      res.json(analysis);
    } catch (error: any) {
      console.error("Asset analysis failed:", error);
      res.status(500).json({ error: "Failed to analyze asset", details: error.message });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", port: PORT });
  });

  // Vite middleware for development (ensure Vite is ready before binding port 3000)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: { ignored: ["**/*"] },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Defer background Firestore watchers slightly so initial HTTP/pre-warm requests return immediately
    setTimeout(() => {
    // Real-time Firestore backup watcher for WhatsApp/Meta rides (fires even if client HTTP fails)
    subscribeCollectionChanges(
      'rides',
      [{ field: 'status', op: 'in', value: ['accepted', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'arrived', 'on_trip', 'started', 'completed'] }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added' && change.type !== 'modified') continue;
          const ride = change.data || {};
          const ch = String(ride.metaChannel || ride.channel || '').toLowerCase();
          const cid = String(ride.customerId || '');
          const isMetaRide = Boolean(
            ride.metaSenderId ||
            ch === 'whatsapp' || ch === 'messenger' || ch === 'instagram' ||
            cid.startsWith('meta-client-') || cid.startsWith('whatsapp-client-')
          );
          if (!isMetaRide) continue;
          notifyRideStatusToMeta(
            {
              rideId: change.id,
              status: ride.status,
              driverInfo: ride.driverInfo,
              driverLocation: ride.driverLocation,
              rideData: ride,
            },
            dbAdmin
          ).catch((err) => {
            console.warn('[Meta Ride Watcher] Notification warning:', err?.message || err);
          });
        }
      }
    );

    // Real-time Firestore watcher for new pending orders -> notify vendor & Fundi on WhatsApp with quick action buttons
    subscribeCollectionChanges(
      'orders',
      [{ field: 'status', op: '==', value: 'pending' }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added') continue;
          const order = change.data || {};
          if (order.vendorWaNotified !== true) {
            notifyVendorNewOrderToWhatsApp(
              { orderId: change.id, orderData: order },
              dbAdmin
            ).catch((err) => {
              console.warn('[Meta Vendor Order Watcher] Notification warning:', err?.message || err);
            });
          }
          const orderTypeLower = String(order.type || order.vendorCategory || '').toLowerCase();
          if ((orderTypeLower === 'handyman' || orderTypeLower === 'fundi') && order.fundiWaDispatched !== true) {
            notifyFundisNewJobToWhatsApp(
              { orderId: change.id, orderData: order },
              dbAdmin,
              sendMetaOutboundMessage
            ).catch((err) => {
              console.warn('[Meta Fundi Job Watcher] Notification warning:', err?.message || err);
            });
          }
        }
      }
    );

    // Real-time Firestore watcher for vendor order status updates -> notify WhatsApp/Meta customer
    subscribeCollectionChanges(
      'orders',
      [{ field: 'status', op: 'in', value: ['accepted', 'preparing', 'prepared', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'rejected'] }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added' && change.type !== 'modified') continue;
          const order = change.data || {};
          const src = String(order.metaChannel || order.orderSource || order.channel || '').toLowerCase();
          const cid = String(order.customerId || '');
          const isMetaOrder = Boolean(
            order.metaSenderId ||
            src === 'whatsapp' || src === 'messenger' || src === 'instagram' ||
            cid.startsWith('meta-client-') || cid.startsWith('whatsapp-client-')
          );
          if (!isMetaOrder) continue;
          notifyCustomerOrderStatusToMeta(
            { orderId: change.id, status: order.status, orderData: order },
            dbAdmin
          ).catch((err) => {
            console.warn('[Meta Customer Order Watcher] Notification warning:', err?.message || err);
          });
        }
      }
    );

    // Backup watcher: approved WhatsApp-registered vendors -> congratulatory WhatsApp Hub buttons
    subscribeCollectionChanges(
      'vendors',
      [{ field: 'status', op: '==', value: 'active' }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added' && change.type !== 'modified') continue;
          const vendor = change.data || {};
          if (vendor.source !== 'whatsapp_self_reg' || vendor.approvalWaNotified === true) continue;
          notifyPartnerApprovedToWhatsApp(
            { partnerType: 'vendor', partnerId: change.id, partnerData: vendor },
            dbAdmin,
            sendMetaOutboundMessage
          ).catch((err) => {
            console.warn('[Meta Vendor Approval Watcher] Warning:', err?.message || err);
          });
        }
      }
    );

    // Backup watcher: approved WhatsApp-registered drivers -> congratulatory WhatsApp Dispatch buttons
    subscribeCollectionChanges(
      'users',
      [{ field: 'approvalStatus', op: '==', value: 'approved' }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added' && change.type !== 'modified') continue;
          const user = change.data || {};
          if (
            user.source !== 'whatsapp_self_reg' ||
            user.approvalWaNotified === true ||
            (user.role !== 'rider' && user.role !== 'driver')
          ) continue;
          notifyPartnerApprovedToWhatsApp(
            { partnerType: 'driver', partnerId: change.id, partnerData: user },
            dbAdmin,
            sendMetaOutboundMessage
          ).catch((err) => {
            console.warn('[Meta Driver Approval Watcher] Warning:', err?.message || err);
          });
        }
      }
    );

    // Real-time watcher: new pending rides -> dispatch WhatsApp job cards to online approved drivers
    subscribeCollectionChanges(
      'rides',
      [{ field: 'status', op: '==', value: 'pending' }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added') continue;
          const ride = change.data || {};
          if (ride.driverId || ride.driverWaDispatched === true) continue;
          notifyDriversNewJobToWhatsApp(
            { jobType: 'ride', jobId: change.id, jobData: ride },
            dbAdmin,
            sendMetaOutboundMessage
          ).catch((err) => {
            console.warn('[Meta Ride Driver Dispatch Watcher] Warning:', err?.message || err);
          });
        }
      }
    );

    // Real-time watcher: delivery orders marked 'ready' -> dispatch WhatsApp delivery job cards to online approved drivers
    subscribeCollectionChanges(
      'orders',
      [{ field: 'status', op: '==', value: 'ready' }],
      (changes, isInitialSnapshot) => {
        if (isInitialSnapshot) return;
        for (const change of changes) {
          if (change.type !== 'added' && change.type !== 'modified') continue;
          const order = change.data || {};
          if (
            order.driverId ||
            order.driverWaDispatched === true ||
            order.orderType === 'pickup' ||
            order.isTableBooking
          ) continue;
          notifyDriversNewJobToWhatsApp(
            { jobType: 'order', jobId: change.id, jobData: order },
            dbAdmin,
            sendMetaOutboundMessage
          ).catch((err) => {
            console.warn('[Meta Order Driver Dispatch Watcher] Warning:', err?.message || err);
          });
        }
      }
    );

    // Warm Meta template config cache on boot
    getMetaTemplateSettings(dbAdmin).catch(() => {});

    // Scheduled rides background processor (every 60s): send customer reminders & dispatch nearby drivers when within 30 min window
    setInterval(() => {
      processDueScheduledBookings(dbAdmin, sendMetaOutboundMessage).catch((err) => {
        console.warn('[Scheduled Rides Processor] Warning:', err?.message || err);
      });
    }, 60_000);

    // Abandoned cart & unfinished booking recovery scheduler (every 5 minutes)
    setInterval(() => {
      processAbandonedSessionsRecovery(dbAdmin, sendMetaOutboundMessage).catch((err) => {
        console.warn('[Abandoned Recovery Processor] Warning:', err?.message || err);
      });
    }, 5 * 60_000);
    }, 2500);
  });

  // Prevent Node's default 5s keepAliveTimeout from causing "connection reset by peer" behind Go/Nginx proxies
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
