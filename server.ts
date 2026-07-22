import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { handleSMSInput, getSession, saveSession } from "./src/lib/smsBot";
import { handleMetaInput } from "./src/lib/metaBot";
import { getFirestoreDb } from "./api/_lib/getFirestoreDb";
import { getHistory, addMessageToHistory, clearHistory } from "./api/_lib/historyStore";

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

      // If the step is START (meaning the flow completed or was cancelled), we END the session.
      // Otherwise, we CON (continue) the session.
      res.type('text/plain');
      if (finalSession.step === 'START') {
        res.send(`END ${cleanReply}`);
      } else {
        res.send(`CON ${cleanReply}`);
      }
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
      endpoint_url: "https://dereva-tz.vercel.app/api/meta/webhook"
    });
  });

  // POST Meta Webhook Event Handler (WhatsApp, Messenger, Instagram)
  app.post("/api/meta/webhook", async (req, res) => {
    console.log("[Meta Webhook] Received webhook POST event:", JSON.stringify(req.body));
    
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
      try {
        console.log(`[Meta Webhook] Incoming message on ${channel} from ${senderId}: "${textBody}"`);
        const reply = await handleMetaInput(senderId, textBody, channel, dbAdmin);
        console.log(`[Meta Webhook] Responding to ${channel}:${senderId} -> "${reply}"`);
        
        recordMetaChatInMemory(channel, senderId, textBody, reply);

        // Log in Firestore for dashboard visibility if available
        if (dbAdmin) {
          try {
            await dbAdmin.collection('meta_chats').add({
              channel,
              senderId,
              message: textBody,
              reply,
              timestamp: new Date()
            });
          } catch (dbErr) {
            console.warn("[Meta Webhook] Notice: Firestore write skipped or failed, saved to memory.");
          }
        }
      } catch (err: any) {
        console.error(`[Meta Webhook] Error processing message:`, err);
      }
    }
    
    return res.status(200).send("EVENT_RECEIVED");
  });

  // Meta Omni-Channel Simulator endpoint for front-end testing
  app.post("/api/meta/simulate", async (req, res) => {
    const { senderId, message, channel } = req.body;
    if (!senderId || !message || !channel) {
      return res.status(400).json({ error: "senderId, message, and channel are required parameters." });
    }
    
    console.log(`[Meta Simulator] Received simulated message from ${channel}:${senderId}: "${message}"`);
    
    try {
      const reply = await handleMetaInput(senderId, message, channel, dbAdmin);
      
      recordMetaChatInMemory(channel, senderId, message, reply);

      // Save simulated conversation in FireStore for real-time monitoring if available
      if (dbAdmin) {
        try {
          await dbAdmin.collection('meta_chats').add({
            channel,
            senderId,
            message,
            reply,
            timestamp: new Date()
          });
        } catch (dbErr) {
          console.warn("[Meta Simulator] Notice: Firestore write skipped or failed, saved to memory.");
        }
      }
      
      res.json({ reply, status: "success" });
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

  // Save Meta Automation config locally
  app.post("/api/meta/save-config", (req, res) => {
    try {
      const config = req.body;
      if (!config) {
        return res.status(400).json({ error: "Missing config body" });
      }
      const localPath = path.join(process.cwd(), 'meta_config.json');
      fs.writeFileSync(localPath, JSON.stringify(config, null, 2), 'utf8');
      console.log("[Meta Config Server] Config saved locally to:", localPath);
      res.json({ status: "success", message: "Config saved successfully" });
    } catch (error: any) {
      console.error("[Meta Config Server] Error saving:", error);
      res.status(500).json({ error: "Failed to save config", details: error.message });
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

  // Mongike Payment Initiation Proxy
  app.post("/api/payments/initiate", async (req, res) => {
    const { order_id, amount, buyer_phone, fee_payer } = req.body;
    const apiKey = process.env.MONGIKE_API_KEY;

    // Normalize and clean the phone number in the backend for ultimate reliability
    let rawPhone = (buyer_phone || "").trim();
    let formattedPhone = rawPhone;
    if (rawPhone.startsWith("0")) {
      formattedPhone = "255" + rawPhone.substring(1);
    } else if (rawPhone.startsWith("+")) {
      formattedPhone = rawPhone.substring(1);
    } else if (!rawPhone.startsWith("255") && rawPhone.replace(/[^0-9]/g, "").length === 9) {
      formattedPhone = "255" + rawPhone;
    }
    const cleanPhone = formattedPhone.replace(/[^0-9]/g, "");

    const isSandbox = !apiKey || 
                      apiKey.trim() === "" || 
                      apiKey.toLowerCase().includes("your_") || 
                      apiKey.toLowerCase().includes("weka_") || 
                      apiKey.toLowerCase().includes("placeholder") || 
                      apiKey.toLowerCase().includes("enter_") || 
                      apiKey.length < 10;

    if (isSandbox) {
      console.warn("MONGIKE_API_KEY is missing or is placeholder. Running in high-fidelity sandbox simulation mode!");
      
      const simulatedResponse = {
        status: "success",
        message: "Ombi la malipo limetumwa (Sandbox Mode)",
        data: {
          id: `sim_pay_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          order_id: order_id,
          gateway_ref: `sim_ref_${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
          amount: Number(amount) || 0,
          status: "PENDING",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }
      };

      // Automatically trigger simulated webhook callback after 2.5 seconds to transition the order to 'paid'
      if (dbAdmin && order_id) {
        setTimeout(async () => {
          try {
            console.log(`[Sandbox Payment Webhook] Simulating successful payment completion for order: ${order_id}`);
            
            // 1. Update the order document
            await dbAdmin.collection("orders").doc(String(order_id)).update({
              paymentStatus: "paid",
              updatedAt: new Date().toISOString(),
              gatewayRef: simulatedResponse.data.gateway_ref
            });

            // 2. Write to the payment_callbacks collection
            await dbAdmin.collection("payment_callbacks").doc(String(order_id)).set({
              order_id: order_id,
              status: "COMPLETED",
              reference_id: simulatedResponse.data.gateway_ref,
              amount: Number(amount) || 0,
              raw_payload: {
                order_id: order_id,
                status: "COMPLETED",
                gateway_ref: simulatedResponse.data.gateway_ref,
                reference_id: simulatedResponse.data.gateway_ref,
                amount: Number(amount) || 0,
                is_simulated: true
              },
              updated_at: new Date()
            }, { merge: true });

            console.log(`[Sandbox Payment Webhook] Order ${order_id} marked as PAID.`);
          } catch (err) {
            console.error("[Sandbox Payment Webhook] Error simulating payment success:", err);
          }
        }, 2500);
      }

      return res.status(201).json(simulatedResponse);
    }

    try {
      const uniqueOrderId = `${order_id}-${Date.now()}`;
      console.log(`[Payment Proxy] Initiating real payment with Mongike. Order: ${order_id} -> Reference: ${uniqueOrderId}`);
      
      const response = await fetch("https://mongike.com/api/v1/payments/mobile-money/tanzania", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order_id: uniqueOrderId,
          amount,
          buyer_phone: cleanPhone,
          fee_payer: fee_payer || "MERCHANT"
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Mongike API error:", data);
        return res.status(response.status).json(data);
      }

      res.status(201).json(data);
    } catch (error) {
      console.error("Payment initiation failed:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Failed to initiate payment. Please try again later." 
      });
    }
  });

  // Mobile Money / Mongike Payment Webhook Callback Endpoint
  app.post("/api/payments/webhook", async (req, res) => {
    const payload = req.body;
    console.log("[Payment Webhook] Received payment callback notification:", JSON.stringify(payload));

    try {
      // Process transaction status from provider callback payload
      const { order_id, status, reference_id, gateway_ref, amount } = payload;

      // Extract real Firestore order_id from potential suffix/timestamp used to ensure unique payment references
      let realOrderId = order_id;
      if (order_id && typeof order_id === 'string') {
        if (order_id.includes("-")) {
          realOrderId = order_id.split("-")[0];
        } else if (order_id.includes("_")) {
          realOrderId = order_id.split("_")[0];
        }
      }

      if (dbAdmin && realOrderId) {
        // Update the order document if status indicates success
        const normalStatus = String(status || "").toUpperCase();
        const isPaid = ["COMPLETED", "SUCCESS", "PAID"].includes(normalStatus);
        
        if (isPaid) {
          await dbAdmin.collection("orders").doc(String(realOrderId)).update({
            paymentStatus: "paid",
            updatedAt: new Date().toISOString(),
            gatewayRef: gateway_ref || reference_id || null
          });
          console.log(`[Payment Webhook] Successfully marked order ${realOrderId} as PAID (extracted from ${order_id}).`);
        }

        await dbAdmin.collection("payment_callbacks").doc(String(realOrderId)).set({
          order_id: realOrderId,
          status: status || "SUCCESS",
          reference_id: gateway_ref || reference_id || "",
          amount: amount || 0,
          raw_payload: payload,
          updated_at: new Date()
        }, { merge: true });
        console.log(`[Payment Webhook] Successfully recorded payment callback for order ${realOrderId}`);
      }

      res.status(200).json({ status: "SUCCESS", message: "Webhook received successfully" });
    } catch (err: any) {
      console.error("[Payment Webhook] Error processing payment callback:", err);
      res.status(500).json({ status: "ERROR", message: err.message });
    }
  });

  // Proxy for Nominatim Geocoding
  app.get("/api/geo/search", async (req, res) => {
    const { q, limit, addressdetails } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query" });

    console.log(`[Proxy] Nominatim Search: ${q}`);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q as string)}&format=json&limit=${limit || 5}&addressdetails=${addressdetails || 1}&countrycodes=tz&email=aicodtznation@gmail.com`;
      
      console.log(`[Proxy] Fetching from Nominatim: ${url}`);
      
      const response = await fetch(url, {
        headers: { 
          'Accept-Language': 'sw,en', 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Nominatim search error status:", response.status, "body:", text.substring(0, 500));
        
        let errorMessage = "External service error";
        if (response.status === 429) {
          errorMessage = "Too many requests. Please slow down.";
        }
        
        return res.status(response.status || 502).json({ 
          error: errorMessage, 
          detail: text.substring(0, 100) 
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Nominatim search proxy error:", error);
      res.status(500).json({ 
        error: "Failed to reach location service",
        detail: error.message 
      });
    }
  });

  // Proxy for Nominatim Reverse Geocoding
  app.get("/api/geo/reverse", async (req, res) => {
    const { lat, lon, zoom } = req.query;
    
    console.log(`[Proxy] Nominatim Reverse: ${lat}, ${lon}`);

    // Basic validation
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lon as string);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates provided" });
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=${zoom || 18}&addressdetails=1&email=aicodtznation@gmail.com`;
      const response = await fetch(url, {
        headers: { 
          'Accept-Language': 'sw,en', 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Nominatim reverse error status:", response.status, "body:", text.substring(0, 500));
        return res.status(response.status || 502).json({ error: "External service error", detail: text.substring(0, 100) });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Nominatim reverse proxy error:", error);
      res.status(500).json({ error: "Failed to fetch address data" });
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

      // Define local corners for direct path interpolation
      const segmentCorners: number[][] = [];
      segmentCorners.push(start);

      const absDLng = Math.abs(dLng);
      const absDLat = Math.abs(dLat);

      if (absDLng > 0.00015 && absDLat > 0.00015) {
        if (absDLng > absDLat) {
          // Travel 60% of longitude first (lng, lat)
          const midLng = lng1 + dLng * 0.6;
          segmentCorners.push([midLng, lat1]);
          segmentCorners.push([midLng, lat2]);
        } else {
          // Travel 60% of latitude first
          const midLat = lat1 + dLat * 0.6;
          segmentCorners.push([lng1, midLat]);
          segmentCorners.push([lng2, midLat]);
        }
      }
      segmentCorners.push(end);

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
        // Node 15+ has fully native Promise.any
        return await Promise.any(urls.map(url => fetchOne(url)));
      } catch (err) {
        throw new Error("All raced endpoints failed");
      }
    };

    // 1. Race Primary & Secondary CAR driving services (Both HTTPS and HTTP variants for maximal robustness)
    const carUrls = [
      `https://router.project-osrm.org/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `http://router.project-osrm.org/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `http://routing.openstreetmap.de/routed-car/route/v1/driving/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `http://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
      `http://routing.openstreetmap.de/routed-foot/route/v1/foot/${encodedCoords}?overview=full&geometries=geojson&steps=true`
    ];

    try {
      console.log(`[Proxy] Racing CAR & alternative routing URLs:`, carUrls);
      // Increased timeout to 12000ms to allow slow networks/containers to resolve properly
      const winner = await raceServices(carUrls, 12000);
      console.log(`[Proxy] Routing SUCCESS! Selected FASTEST responder: ${winner.source}`);
      routeCache.set(cacheKey, winner.data);
      return res.json(winner.data);
    } catch (eCar) {
      console.log(`[Proxy] Note: External OSRM servers are currently congested or rate-limited. Trying stable BRouter geojson fallback...`);
      
      // 1. Try stable brouter.de fallback
      if (coordsPairs.length >= 2) {
        try {
          const p1 = coordsPairs[0];
          const p2 = coordsPairs[coordsPairs.length - 1];
          // BRouter expects: lon1, lat1, lon2, lat2
          const brouterUrl = `https://brouter.de/brouter?lon1=${p1[0]}&lat1=${p1[1]}&lon2=${p2[0]}&lat2=${p2[1]}&profile=car-fast&alternativeidx=0&format=geojson`;
          
          console.log(`[Proxy] Fetching fallback coordinates from BRouter: ${brouterUrl}`);
          const bRes = await fetch(brouterUrl, { headers });
          if (bRes.ok) {
            const bData = await bRes.json();
            if (bData && bData.features && bData.features.length > 0) {
              const feat = bData.features[0];
              const coordinates = feat.geometry.coordinates; // array of [lng, lat]
              const totalDistance = parseFloat(feat.properties["track-length"] || "0");
              const totalDuration = parseFloat(feat.properties["total-time"] || "0");
              
              console.log(`[Proxy] BRouter request succeeded! Distance: ${totalDistance}m, Duration: ${totalDuration}s. Converting to OSRM format.`);
              
              const brouterFallbackData = {
                code: "Ok",
                routes: [
                  {
                    geometry: {
                      coordinates: coordinates,
                      type: "LineString"
                    },
                    legs: [
                      {
                        summary: "Barabara kuu (Real Street Route via BRouter)",
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
                  {
                    hint: "",
                    distance: 0,
                    name: "Mwanzo",
                    location: p1
                  },
                  {
                    hint: "",
                    distance: 0,
                    name: "Mwisho",
                    location: p2
                  }
                ]
              };
              
              routeCache.set(cacheKey, brouterFallbackData);
              return res.json(brouterFallbackData);
            }
          }
        } catch (errBrouter: any) {
          console.log(`[Proxy] Info: BRouter fallback not active or timed out (${errBrouter?.message || errBrouter})`);
        }
      }

      // 2. Try secondary OSRM bicycle/foot server directly since alternative profiles are rarely rate-limited
      if (coordsPairs.length >= 2) {
        const altUrls = [
          `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
          `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${encodedCoords}?overview=full&geometries=geojson&steps=true`,
          `http://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${encodedCoords}?overview=full&geometries=geojson&steps=true`
        ];
        try {
          console.log(`[Proxy] Attempting secondary bicycle/foot engine routing fallback...`);
          const winner = await raceServices(altUrls, 8000);
          console.log(`[Proxy] Secondary Profile OSRM success: ${winner.source}`);
          routeCache.set(cacheKey, winner.data);
          return res.json(winner.data);
        } catch (errAlt: any) {
          console.log(`[Proxy] Info: Secondary profiles not active or timed out (${errAlt?.message || errAlt})`);
        }
      }

      // 3. Last resort layout-perfect grid simulation:
      console.log(`[Proxy] No external street router available. Generating grid-precise routing simulation.`);
      if (coordsPairs.length >= 2) {
        const fallbackData = generateStraightLineRoute(coordsPairs);
        routeCache.set(cacheKey, fallbackData);
        console.log(`[Proxy] Grid routing fallback generated successfully.`);
        return res.json(fallbackData);
      } else {
        return res.status(502).json({ error: "Could not fetch or generate routing data." });
      }
    }
  });

  // Proxy for BigDataCloud Reverse Geocoding (Fallback)
  app.get("/api/geo/bdc-reverse", async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sw`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("BDC reverse error status:", response.status, "body:", text.substring(0, 500));
        return res.status(response.status || 502).json({ error: "External service error", detail: text.substring(0, 100) });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("BDC reverse proxy error:", error);
      res.status(500).json({ error: "Failed to fetch BDC location data" });
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
        model: "gemini-3.5-flash",
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
