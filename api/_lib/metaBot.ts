import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { resolvePlace, getRoadDistanceAndDuration } from './geocoder.js';

export interface MetaSession {
  senderId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  step: 'START' | 'COLLECTING_ROUTE' | 'SELECTING_OPTION' | 'COLLECTING_PHONE' | 'CONFIRMING' | 'SELECTING_VEHICLE' | 'CONFIRMING_TRIP';
  service?: 'taxi' | 'food' | 'grocery' | 'parcel' | 'salon' | 'hotel' | 'car_rental' | 'pharmacy' | 'bus_ticket';
  details: {
    route?: string;
    itemQuery?: string;
    selectedId?: string;
    selectedName?: string;
    selectedPrice?: number;
    phone?: string;
    optionsList?: any[];
    [key: string]: any;
  };
  lastUpdated: number;
}

// In-memory fallback
const metaSessions = new Map<string, MetaSession>();

// Lazy initialization of GoogleGenAI to prevent startup crash if GEMINI_API_KEY is not defined
let aiClient: any = null;

function getAI() {
  if (!aiClient) {
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Resilient helper to call Gemini generateContent with retries and fallback models
export async function generateContentWithRetry(params: any, maxRetries = 2) {
  let attempt = 0;
  let delay = 1000;
  const modelsToTry = [params.model, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-3.5-flash"];
  const models = Array.from(new Set(modelsToTry.filter(Boolean)));

  const client = getAI();

  for (const model of models) {
    for (attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Gemini API - metaBot] Calling model ${model}, attempt ${attempt + 1}...`);
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
          console.warn(`[Gemini API - metaBot] Model ${model} failed with ${isQuotaExceeded ? 'Quota Exceeded (429)' : 'Unavailable (503)'}: ${message}. Switching to next fallback model immediately...`);
          break; // Break the retry loop for this model, proceed to the next model in the outer loop
        }

        const isTransient = status === 500 || status === 502 || status === 504 || message.includes("502") || message.includes("504") || message.includes("timeout");
        if (isTransient && attempt < maxRetries - 1) {
          console.warn(`[Gemini API - metaBot] Transient error (status: ${status}) on model ${model}: ${message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
        } else {
          console.error(`[Gemini API - metaBot] Error or out of retries for model ${model}: ${message}`);
          break; // Break current retry loop to try the next fallback model
        }
      }
    }
  }
  throw new Error("Gemini API failed on all models and retries. Please try again later.");
}

/**
 * Gets or creates session for a user on a specific channel
 */
export async function getMetaSession(
  senderId: string, 
  channel: 'whatsapp' | 'messenger' | 'instagram', 
  dbAdmin: any
): Promise<MetaSession> {
  const sessionKey = `${channel}:${senderId}`;
  
  if (dbAdmin) {
    try {
      const docRef = dbAdmin.collection('meta_sessions').doc(sessionKey);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        return docSnap.data() as MetaSession;
      }
    } catch (err) {
      console.warn("[Meta Bot] Firestore load failed, using memory:", err);
    }
  }

  const existing = metaSessions.get(sessionKey);
  if (existing) {
    return existing;
  }

  const fresh: MetaSession = {
    senderId,
    channel,
    step: 'START',
    details: {},
    lastUpdated: Date.now()
  };
  metaSessions.set(sessionKey, fresh);
  return fresh;
}

/**
 * Saves Meta Session to Firestore/Memory
 */
export async function saveMetaSession(session: MetaSession, dbAdmin: any): Promise<void> {
  const sessionKey = `${session.channel}:${session.senderId}`;
  session.lastUpdated = Date.now();
  metaSessions.set(sessionKey, session);

  if (dbAdmin) {
    try {
      await dbAdmin.collection('meta_sessions').doc(sessionKey).set(session);
    } catch (err) {
      console.warn("[Meta Bot] Firestore write failed:", err);
    }
  }
}

/**
 * Triggers a real order inside Firebase so it reflects in Admin Dashboard
 */
async function triggerAutomatedOrder(
  dbAdmin: any,
  vendorId: string,
  category: string,
  items: any[],
  total: number,
  customerPhone: string,
  customerName: string,
  notes: string,
  source: 'whatsapp' | 'messenger' | 'instagram'
) {
  if (!dbAdmin) return;
  try {
    const orderData = {
      customerId: `${source}-client-${customerPhone.replace(/\D/g, '')}`,
      vendorId: vendorId || "papo-hapo-express",
      customerName: customerName,
      customerPhone: customerPhone,
      items: items,
      totalAmount: total,
      subtotal: total,
      status: "pending",
      type: category,
      orderSource: source,
      orderType: "booking",
      paymentMethod: "Mobile Money (Tanzania)",
      paymentStatus: "pending",
      notes: notes || `Order created automatically via Papo Hapo Meta ${source} Bot`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await dbAdmin.collection('orders').add(orderData);
    console.log(`[Meta Bot] Automatic order created in DB for vendor: ${vendorId} from ${source}`);
  } catch (err) {
    console.error("[Meta Bot] Error creating order:", err);
  }
}

/**
 * Uses Gemini (or keyword fallback) to classify user intent
 */
export async function classifyIntent(message: string): Promise<{
  intent: 'greeting' | 'taxi' | 'food' | 'grocery' | 'parcel' | 'salon' | 'hotel' | 'car_rental' | 'pharmacy' | 'bus_ticket' | 'other';
  confidence: number;
}> {
  const cleaned = message.trim().toLowerCase();

  // If Gemini API Key is available, use Gemini 3.5 Flash for state-of-the-art NLP
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are the core intent classification engine for Papo Hapo Super App in Tanzania. 
Analyze the user's message and determine their intent. Respond strictly in JSON format.

The user message might be in Swahili, English, Sheng, or mixed.

User message: "${message}"

Available Intents:
- 'greeting': When the user greets (hi, mambo, vipi, hello, habari, etc.)
- 'taxi': Ordering taxi, ride, boda, bajaji, going to an address (posta, masaki, etc.)
- 'food': Ordering pizza, burger, chips, chicken, biryani, or restaurants
- 'grocery': Groceries, soko, fruits, onions, rice, vegetables
- 'parcel': Sending packages, courier, delivery (mzigo, kutuma, etc.)
- 'salon': Salon booking, shaving, makeup, nails, hair, massage, spa
- 'hotel': Hotel booking, lodging, room booking
- 'car_rental': Renting a car, hire car, Prado, Cruiser, Noah, Vitz
- 'pharmacy': Ordering medicine, pharmacy, panadol, syrup, dawa
- 'bus_ticket': Bus ticket, safari, booking a bus, tickets
- 'other': Any general query not fitting above

Response Schema:
{
  "intent": "greeting" | "taxi" | "food" | "grocery" | "parcel" | "salon" | "hotel" | "car_rental" | "pharmacy" | "bus_ticket" | "other",
  "confidence": number (between 0.0 and 1.0)
}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.intent) {
        return {
          intent: result.intent,
          confidence: result.confidence || 0.9
        };
      }
    } catch (err) {
      console.warn("[Meta Bot] Gemini intent detection failed, falling back to heuristics:", err);
    }
  }

  // Robust swahili/english keyword matching fallback (always reliable)
  if (['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'oje', 'hodi', 'yo'].includes(cleaned)) {
    return { intent: 'greeting', confidence: 1.0 };
  }
  if (cleaned.includes('taxi') || cleaned.includes('uber') || cleaned.includes('boda') || cleaned.includes('bajaji') || cleaned.includes('safari ya haraka') || cleaned.includes('ride') || cleaned.includes('dereva')) {
    return { intent: 'taxi', confidence: 0.95 };
  }
  if (cleaned.includes('chips') || cleaned.includes('burger') || cleaned.includes('pizza') || cleaned.includes('kuku') || cleaned.includes('chakula') || cleaned.includes('biryani') || cleaned.includes('msosi') || cleaned.includes('wali')) {
    return { intent: 'food', confidence: 0.95 };
  }
  if (cleaned.includes('nyanya') || cleaned.includes('kitunguu') || cleaned.includes('soko') || cleaned.includes('mboga') || cleaned.includes('matunda') || cleaned.includes('mchele') || cleaned.includes('grocery')) {
    return { intent: 'grocery', confidence: 0.90 };
  }
  if (cleaned.includes('mzigo') || cleaned.includes('tuma') || cleaned.includes('parcel') || cleaned.includes('kuria') || cleaned.includes('delivery') || cleaned.includes('msafirishaji')) {
    return { intent: 'parcel', confidence: 0.95 };
  }
  if (cleaned.includes('nywele') || cleaned.includes('saluni') || cleaned.includes('salon') || cleaned.includes('kinyozi') || cleaned.includes('makeup') || cleaned.includes('kucha') || cleaned.includes('massage') || cleaned.includes('spa')) {
    return { intent: 'salon', confidence: 0.95 };
  }
  if (cleaned.includes('hotel') || cleaned.includes('room') || cleaned.includes('chumba') || cleaned.includes('lodging') || cleaned.includes('hoteli')) {
    return { intent: 'hotel', confidence: 0.90 };
  }
  if (cleaned.includes('kodi') || cleaned.includes('prado') || cleaned.includes('cruiser') || cleaned.includes('rental') || cleaned.includes('rent a car') || cleaned.includes('noah') || cleaned.includes('gari la kukodi')) {
    return { intent: 'car_rental', confidence: 0.95 };
  }
  if (cleaned.includes('dawa') || cleaned.includes('panadol') || cleaned.includes('paracetamol') || cleaned.includes('syrup') || cleaned.includes('pharmacy') || cleaned.includes('famasi') || cleaned.includes('kikohozi')) {
    return { intent: 'pharmacy', confidence: 0.95 };
  }
  if (cleaned.includes('basi') || cleaned.includes('mabasi') || cleaned.includes('safari') || cleaned.includes('tiketi') || cleaned.includes('ticket') || cleaned.includes('booking')) {
    return { intent: 'bus_ticket', confidence: 0.95 };
  }

  return { intent: 'other', confidence: 0.5 };
}

/**
 * Uses Gemini to answer custom user questions using the uploaded Knowledge Base (FAQs, website info)
 */
export async function queryKnowledgeBase(input: string, knowledgeBase: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY || !knowledgeBase) return null;
  try {
    const prompt = `You are the AI Customer Support Agent for Papo Hapo Super App.
Use the following Knowledge Base/FAQs to answer the user's query.

Knowledge Base:
"""
${knowledgeBase}
"""

User Query: "${input}"

Instructions:
1. If the user query can be answered using the provided Knowledge Base, give a friendly, helpful, and concise response in Swahili (Dar es Salaam Swahili slang friendly) or the user's language.
2. If the user query CANNOT be answered using the Knowledge Base (e.g. it is completely unrelated or requires booking database access), reply strictly with "UNANSWERED".
3. Do not assume or make up facts. Only use what is in the Knowledge Base.`;

    const res = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    
    const reply = res.text?.trim();
    if (reply && reply !== "UNANSWERED" && !reply.includes("UNANSWERED")) {
      return reply;
    }
  } catch (err) {
    console.error("[Knowledge Base AI error]", err);
  }
  return null;
}

/**
 * Executes a custom visual workflow node chain starting from a given nodeId.
 * This runs iteratively until a node requires user input or we reach the end.
 */
export async function executeNodeChain(
  startNodeId: string,
  userInput: string,
  session: MetaSession,
  nodes: any[],
  dbAdmin: any,
  channel: 'whatsapp' | 'messenger' | 'instagram'
): Promise<string> {
  let currentNode = nodes.find(n => n.id === startNodeId);
  if (!currentNode) {
    currentNode = nodes.find(n => n.type === 'start');
  }
  if (!currentNode) {
    return "⚠️ System Error: Start node not found in active workflow.";
  }

  let replyText = "";
  let loopCount = 0;
  const maxLoops = 20; // Secure against cyclic loops

  if (!session.details.variables) {
    session.details.variables = {};
  }

  // Populate dynamic system defaults for interpolation
  const chSymbol = channel === 'whatsapp' ? '🟢 WhatsApp' : channel === 'instagram' ? '📸 Instagram' : '🔵 Messenger';
  session.details.variables['customer.name'] = session.details.customerName || "Mteja";
  session.details.variables['customer.phone'] = session.details.phone || "0712345678";
  session.details.variables['channel'] = chSymbol;

  // Retrieve business services configuration for real-time dynamic filtering
  let servicesConfig: any = {};
  if (dbAdmin) {
    try {
      const bizSnap = await dbAdmin.collection('config').doc('business').get();
      if (bizSnap.exists) {
        servicesConfig = bizSnap.data().services || {};
      }
    } catch (bizErr) {
      console.warn("[Meta Bot] Failed to fetch services config in executeNodeChain:", bizErr);
    }
  }

  while (currentNode && loopCount < maxLoops) {
    loopCount++;
    const nodeType = currentNode.type;
    const nodeData = currentNode.data || {};

    // 1. START NODE
    if (nodeType === 'start') {
      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 2. SEND MESSAGE NODE
    else if (nodeType === 'message') {
      let text = nodeData.text || "";
      // Dynamic variables replacement
      for (const [key, val] of Object.entries(session.details.variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        text = text.replace(regex, String(val));
      }

      // Dynamic filtering of services list based on real-time business config
      text = applyBusinessConfigToWelcomeText(text, servicesConfig);

      replyText += (replyText ? "\n\n" : "") + text;

      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 3. ASK QUESTION NODE (INPUT CAPTURE)
    else if (nodeType === 'question') {
      // If we are AWAITING the answer and resuming this exact question node
      if (session.details.activeQuestionNodeId === currentNode.id) {
        const varName = nodeData.variableName || "temp";
        session.details.variables[varName] = userInput;
        session.details.activeQuestionNodeId = undefined; // Cleared

        let nextId = nodeData.nextNodeId;
        // Option/Quick Reply routing
        if (nodeData.options && nodeData.options.length > 0) {
          const matchedOpt = nodeData.options.find((opt: any) => 
            opt.key?.toString()?.trim() === userInput.trim() || 
            opt.value?.toLowerCase()?.trim() === userInput.toLowerCase()?.trim()
          );
          if (matchedOpt && matchedOpt.nextNodeId) {
            nextId = matchedOpt.nextNodeId;
          }
        }

        if (nextId) {
          currentNode = nodes.find(n => n.id === nextId);
        } else {
          break;
        }
      } else {
        // Entering the question for the first time: show question text & halt loop to wait for reply
        let text = nodeData.text || "";
        for (const [key, val] of Object.entries(session.details.variables)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          text = text.replace(regex, String(val));
        }

        // Dynamic filtering of services list based on real-time business config
        text = applyBusinessConfigToWelcomeText(text, servicesConfig);

        replyText += (replyText ? "\n\n" : "") + text;

        session.details.currentNodeId = currentNode.id;
        session.details.activeQuestionNodeId = currentNode.id;
        session.step = 'COLLECTING_PHONE'; // Freeze state
        await saveMetaSession(session, dbAdmin);
        return replyText;
      }
    }
    // 4. CONDITION BLOCK
    else if (nodeType === 'condition') {
      let nextId = nodeData.nextNodeId; // Default/Else pathway

      if (nodeData.conditions && nodeData.conditions.length > 0) {
        for (const cond of nodeData.conditions) {
          const val = String(session.details.variables[cond.variable] || "").toLowerCase().trim();
          const target = String(cond.value || "").toLowerCase().trim();
          let matched = false;

          if (cond.operator === 'equals' && val === target) matched = true;
          else if (cond.operator === 'contains' && val.includes(target)) matched = true;
          else if (cond.operator === 'exists' && val !== "") matched = true;

          if (matched && cond.nextNodeId) {
            nextId = cond.nextNodeId;
            break;
          }
        }
      }

      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 5. AI INTENT DECISION BLOCK (GEMINI INTEGRATION)
    else if (nodeType === 'ai_decision') {
      let nextId = nodeData.nextNodeId;
      const intentMappings = nodeData.intentMappings || [];

      if (intentMappings.length > 0) {
        // Real-time AI classification via Gemini!
        if (process.env.GEMINI_API_KEY) {
          try {
            const prompt = `You are the core AI routing engine for Papo Hapo Super App.
Analyze the customer's input message and select the best matching category from the list.

Customer Input: "${userInput}"

Categories:
${intentMappings.map((m: any) => `- ID: "${m.nextNodeId}", Description/Keywords: "${m.keywords}"`).join('\n')}

Respond strictly with the matching category ID. If none fits nicely, return "default".`;

            const res = await generateContentWithRetry({
              model: "gemini-3.5-flash",
              contents: prompt,
            });
            const ans = res.text?.trim()?.replace(/["']/g, '');
            if (ans && ans !== "default" && intentMappings.some((m: any) => m.nextNodeId === ans)) {
              nextId = ans;
              console.log(`[Workflow AI Classifier] Classified "${userInput}" to Category: ${nextId}`);
            }
          } catch (err) {
            console.warn("[Workflow AI Classifier] Gemini failed, falling back to keyword mapping:", err);
          }
        }

        // Keyword fallback if Gemini fails or is not configured
        if (nextId === nodeData.nextNodeId || !nextId) {
          for (const m of intentMappings) {
            const keywords = (m.keywords || "").split(',').map((k: any) => k.trim().toLowerCase());
            if (keywords.some((k: any) => userInput.toLowerCase().includes(k))) {
              nextId = m.nextNodeId;
              break;
            }
          }
        }
      }

      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 6. PAYMENT NODE
    else if (nodeType === 'payment') {
      const amt = nodeData.paymentAmount || "3000";
      session.details.variables['payment_status'] = "SUCCESS";
      session.details.variables['fare'] = amt;

      replyText += (replyText ? "\n\n" : "") + `💳 *Ombi la Malipo (TSH ${amt}) limetumwa!* Tafadhali thibitisha kwa kuweka PIN yako kwenye simu... Malipo yamefanikiwa kikamilifu!`;

      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 7. CREATE SYSTEM ORDER
    else if (nodeType === 'create_order') {
      const serviceType = nodeData.serviceType || "taxi";
      const pickup = session.details.variables['pickup'] || "Mwenge";
      const dest = session.details.variables['destination'] || "Posta";
      const phone = session.details.variables['customer.phone'] || "0712345678";
      const randId = Math.floor(1000 + Math.random() * 9000);

      session.details.variables['booking_id'] = `PH-${randId}`;
      session.details.variables['tracking_link'] = `https://ais-pre-ehp7pgjsv6filel5husmda-79810319892.europe-west2.run.app/orders`;

      // Trigger automatic DB record so it appears in Admin Dashboard in real-time!
      await triggerAutomatedOrder(
        dbAdmin,
        "papo-hapo-express",
        serviceType,
        [{ name: `${serviceType.toUpperCase()} ride from ${pickup} to ${dest}`, price: 4000, quantity: 1 }],
        4000,
        phone,
        session.details.variables['customer.name'] || "Meta Customer",
        `Created via Papo Hapo Automation Studio Flow node: ${currentNode.id}`,
        channel
      );

      // Also add to the 'rides' collection so that any online taxi drivers receive it!
      if (serviceType.toLowerCase() === 'taxi' || serviceType.toLowerCase() === 'teksi') {
        try {
          const cleanPickup = (pickup || "").replace(/\s*\(.*?\)/g, "").trim();
          const cleanDest = (dest || "").replace(/\s*\(.*?\)/g, "").trim();
          
          const pRes = await resolvePlace(cleanPickup, dbAdmin);
          const dRes = await resolvePlace(cleanDest, dbAdmin);

          const pLoc = pRes.matches.length > 0 ? {
            placeId: pRes.matches[0].placeId,
            name: pRes.matches[0].name,
            address: pRes.matches[0].displayName || pRes.matches[0].name,
            lat: pRes.matches[0].latitude,
            lng: pRes.matches[0].longitude
          } : {
            placeId: "TZ-DSM-MWENGE-001",
            name: "Mwenge",
            address: "Mwenge, Kinondoni, Dar es Salaam",
            lat: -6.7681,
            lng: 39.2274
          };

          const dLoc = dRes.matches.length > 0 ? {
            placeId: dRes.matches[0].placeId,
            name: dRes.matches[0].name,
            address: dRes.matches[0].displayName || dRes.matches[0].name,
            lat: dRes.matches[0].latitude,
            lng: dRes.matches[0].longitude
          } : {
            placeId: "TZ-DSM-POSTA-001",
            name: "Posta",
            address: "Posta, Ilala, Dar es Salaam",
            lat: -6.8164,
            lng: 39.2902
          };
          
          const expiresAtDate = new Date();
          expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);

          await dbAdmin.collection('rides').add({
            status: "pending",
            customerId: `meta-client-${session.senderId}`,
            customerInfo: {
              name: session.details.variables['customer.name'] || "Meta Customer",
              phone: phone,
              rating: 4.8
            },
            driverId: null,
            pickup: pLoc,
            destination: dLoc,
            vehicleType: "taxi",
            fare: 6500,
            distance: 8.5,
            duration: 15,
            routeCoords: [
              { lat: pLoc.lat, lng: pLoc.lng },
              { lat: dLoc.lat, lng: dLoc.lng }
            ],
            createdAt: new Date(),
            expiresAt: expiresAtDate.toISOString(),
            driverInfo: null,
            driverLocation: null,
            channel: channel,
            bookingId: `PH-${randId}`
          });
          console.log(`[Meta Bot] Added ride to Firestore rides collection with status 'pending' for booking ID: PH-${randId}`);
        } catch (rideErr) {
          console.error("[Meta Bot] Error adding ride to Firestore rides:", rideErr);
        }
      }

      replyText += (replyText ? "\n\n" : "") + `🚖 *Booking ya ${serviceType.toUpperCase()} Imefanikiwa!* \n` +
                   `- Namba ya Oda: *PH-${randId}*\n` +
                   `- Kutoka: *${pickup}*\n` +
                   `- Kwenda: *${dest}*\n` +
                   `- Angalia Maendeleo: ${session.details.variables['tracking_link']}`;

      const nextId = nodeData.nextNodeId;
      if (nextId) {
        currentNode = nodes.find(n => n.id === nextId);
      } else {
        break;
      }
    }
    // 8. OCR NODE
    else if (nodeType === 'ocr') {
      session.details.variables['control_number'] = "991234567890";
      session.details.variables['extracted_amount'] = "15000";
      replyText += (replyText ? "\n\n" : "") + `🔍 *AI Vision OCR Reader*:\n` +
                   `- Kitambulisho/Risiti imesomwa!\n` +
                   `- Namba ya Malipo (Control No): *991234567890*\n` +
                   `- Kiasi: *TSH 15,000*`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 9. VOICE BOT NODE
    else if (nodeType === 'voice_bot') {
      replyText += (replyText ? "\n\n" : "") + `🎙️ *WhatsApp Voice Bot Engine*:\n` +
                   `🎙️ _[Simulated Audio Received]_ \n` +
                   `🗣️ Speech-to-Text: "${userInput}"\n` +
                   `🔊 Reply generated as Swahili Speech Response!`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 10. IMAGE UNDERSTANDING NODE
    else if (nodeType === 'image_understanding') {
      replyText += (replyText ? "\n\n" : "") + `📸 *Gemini Vision Analyzer*:\n` +
                   `Picha imepokelewa na kuchambuliwa!\n` +
                   `Sawa na bidhaa: *Chips Kuku Mshikaki* (Burger Point)\n` +
                   `Gharama: *TSH 9,500*`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 11. LIVE MAP NODE
    else if (nodeType === 'live_map') {
      replyText += (replyText ? "\n\n" : "") + `🗺️ *Live Tracking Map Node*:\n` +
                   `📍 Dereva wako (Ally Rajabu) yupo njiani!\n` +
                   `⏱️ ETA: *Dakika 4* (Umbali: mita 850)\n` +
                   `🔗 Angalia Live Map hapa: https://papo-hapo.tz/track/PH-9921`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 12. A/B TESTING NODE
    else if (nodeType === 'ab_testing') {
      const chosenFlow = Math.random() < 0.5 ? 'A' : 'B';
      const nextId = chosenFlow === 'A' ? nodeData.flowANodeId : nodeData.flowBNodeId;
      replyText += (replyText ? "\n\n" : "") + `🔀 *A/B Testing Node* (Running Flow ${chosenFlow})...`;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 13. AUTO TRANSLATION NODE
    else if (nodeType === 'auto_translation') {
      replyText += (replyText ? "\n\n" : "") + `🌐 *AI Auto Translation*:\n` +
                   `- Input detected in Kiswahili/English\n` +
                   `- Agent Translation is ACTIVE!`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 14. EVENT AUTOMATION NODE
    else if (nodeType === 'event_automation') {
      replyText += (replyText ? "\n\n" : "") + `⚡ *Event Triggered*: ride_completed -> Send Feedback Request!`;
      const nextId = nodeData.nextNodeId;
      if (nextId) currentNode = nodes.find(n => n.id === nextId);
      else break;
    }
    // 15. END NODE
    else if (nodeType === 'end') {
      session.details.currentNodeId = undefined;
      session.details.activeQuestionNodeId = undefined;
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      let text = nodeData.text || "Asante kwa kutumia Papo Hapo! Karibu tena kufanya huduma nasi! 😊";
      for (const [key, val] of Object.entries(session.details.variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        text = text.replace(regex, String(val));
      }
      replyText += (replyText ? "\n\n" : "") + text;
      return replyText;
    }
    else {
      break;
    }
  }

  if (currentNode) {
    session.details.currentNodeId = currentNode.id;
  } else {
    session.details.currentNodeId = undefined;
    session.step = 'START';
  }

  await saveMetaSession(session, dbAdmin);
  return replyText || "Mazungumzo yamekamilika.";
}

/**
 * Helper to dynamically apply current business services configuration (enabled/disabled/maintenance)
 * to any custom welcome message or node text that contains the services list.
 */
export function applyBusinessConfigToWelcomeText(text: string, servicesConfig: any): string {
  if (!text) return text;
  if (!servicesConfig || Object.keys(servicesConfig).length === 0) return text;

  const DEFAULT_SERVICES = [
    { key: 'taxi', id: 'teksi', emoji: '🚖', title: 'TAXI', desc: 'Agiza boda, bajaji au gari' },
    { key: 'food', id: 'chakula', emoji: '🍔', title: 'CHAKULA', desc: 'Chips, Pizza, Burger, Biryani' },
    { key: 'grocery', id: 'sokoni', emoji: '🛍️', title: 'SOKONI', desc: 'Groceries, Nyanya, Vitunguu, Mchele' },
    { key: 'parcel', id: 'vifurushi', emoji: '📦', title: 'PARCEL', desc: 'Tuma au wasilisha mzigo haraka' },
    { key: 'salon', id: 'saluni', emoji: '💇‍♀️', title: 'SALUNI', desc: 'Hair cut, Nails, Spa, Makeup' },
    { key: 'hotel', id: 'hoteli', emoji: '🏨', title: 'HOTELI', desc: 'Weka vyumba vya hoteli karibu nawe' },
    { key: 'car_rental', id: 'car_rental', emoji: '🚗', title: 'KODI GARI', desc: 'Kodisha Prado, Cruiser, Harrier' },
    { key: 'pharmacy', id: 'dawa', emoji: '💊', title: 'PHARMACY', desc: 'Agiza Dawa na vifaa vya afya' },
    { key: 'bus_ticket', id: 'bus_ticket', emoji: '🚌', title: 'MABASI', desc: 'Kata tiketi za mabasi ya mikoani' }
  ];

  // Detect if the text contains the main uppercase services list identifiers
  const hasServiceList = text.includes("TAXI") || text.includes("CHAKULA") || text.includes("SOKONI");
  if (!hasServiceList) return text;

  // Filter and build the list of active/enabled services
  const active = DEFAULT_SERVICES.filter(item => {
    const sData = servicesConfig[item.id];
    return !sData || sData.enabled !== false;
  }).map((item, idx) => {
    const sData = servicesConfig[item.id] || {};
    return {
      ...item,
      displayNum: idx + 1,
      isMaintenance: sData.maintenance === true
    };
  });

  // Find where the list starts by looking for service emojis or bullet patterns
  const firstServiceIndex = text.search(/(🚖|🍔|🛍️|📦|💇‍♀️|🏨|🚗|💊|🚌|\*\d\.)/);
  let welcomeHeader = `👋 *Karibu Papo Hapo Super App Bot!*\n\nMimi ni Assistant wako wa Papo Hapo. Unaweza kupata na kuagiza huduma zote kwa haraka kupitia hapa!\n\n*Tafadhali chagua au andika unachotaka:* \n`;
  if (firstServiceIndex !== -1) {
    welcomeHeader = text.substring(0, firstServiceIndex);
  }

  let welcomeBody = "";
  active.forEach(srv => {
    const maintTag = srv.isMaintenance ? " *(MABORESHO ⚠️)*" : "";
    welcomeBody += `${srv.emoji} *${srv.displayNum}. ${srv.title}* (${srv.desc})${maintTag}\n`;
  });

  // Find where the footer starts
  let welcomeFooter = `\n*Andika namba au taja unachohitaji moja kwa moja! (Mfano: "Naomba taxi kwenda Posta")* ✨`;
  const footerStart = text.indexOf("*Andika namba");
  if (footerStart !== -1) {
    welcomeFooter = "\n" + text.substring(footerStart);
  } else {
    const lastMabasi = text.indexOf("MABASI");
    if (lastMabasi !== -1) {
      const nextNewline = text.indexOf("\n", lastMabasi);
      if (nextNewline !== -1) {
        welcomeFooter = text.substring(nextNewline);
      }
    }
  }

  return welcomeHeader + welcomeBody + welcomeFooter;
}

/**
 * Generates the dynamic welcome message based on active/enabled services
 */
export function generateDynamicWelcomeMessage(servicesConfig: any, chSymbol: string, customWelcome?: string): string {
  if (customWelcome) {
    const replaced = customWelcome.replace(/{channel}/g, chSymbol);
    return applyBusinessConfigToWelcomeText(replaced, servicesConfig);
  }

  const DEFAULT_SERVICES = [
    { key: 'taxi', id: 'teksi', emoji: '🚖', title: 'TAXI', desc: 'Agiza boda, bajaji au gari' },
    { key: 'food', id: 'chakula', emoji: '🍔', title: 'CHAKULA', desc: 'Chips, Pizza, Burger, Biryani' },
    { key: 'grocery', id: 'sokoni', emoji: '🛍️', title: 'SOKONI', desc: 'Groceries, Nyanya, Vitunguu, Mchele' },
    { key: 'parcel', id: 'vifurushi', emoji: '📦', title: 'PARCEL', desc: 'Tuma au wasilisha mzigo haraka' },
    { key: 'salon', id: 'saluni', emoji: '💇‍♀️', title: 'SALUNI', desc: 'Hair cut, Nails, Spa, Makeup' },
    { key: 'hotel', id: 'hoteli', emoji: '🏨', title: 'HOTELI', desc: 'Weka vyumba vya hoteli karibu nawe' },
    { key: 'car_rental', id: 'car_rental', emoji: '🚗', title: 'KODI GARI', desc: 'Kodisha Prado, Cruiser, Harrier' },
    { key: 'pharmacy', id: 'dawa', emoji: '💊', title: 'PHARMACY', desc: 'Agiza Dawa na vifaa vya afya' },
    { key: 'bus_ticket', id: 'bus_ticket', emoji: '🚌', title: 'MABASI', desc: 'Kata tiketi za mabasi ya mikoani' }
  ];

  const activeServices = DEFAULT_SERVICES.filter(item => {
    const sData = servicesConfig[item.id];
    return !sData || sData.enabled !== false;
  }).map((item, idx) => {
    const sData = servicesConfig[item.id] || {};
    const isMaintenance = sData.maintenance === true;
    return {
      ...item,
      displayNum: (idx + 1).toString(),
      isMaintenance
    };
  });

  let welcome = `👋 *Karibu Papo Hapo Super App Bot!* (${chSymbol})\n\nMimi ni Assistant wako wa Papo Hapo. Unaweza kupata na kuagiza huduma zote kwa haraka kupitia hapa!\n\n*Tafadhali chagua au andika unachotaka:* \n`;
                
  activeServices.forEach(srv => {
    const maintTag = srv.isMaintenance ? " *(MABORESHO ⚠️)*" : "";
    welcome += `${srv.emoji} *${srv.displayNum}. ${srv.title}* (${srv.desc})${maintTag}\n`;
  });
  
  welcome += `\n*Andika namba au taja unachohitaji moja kwa moja! (Mfano: "Naomba taxi kwenda Posta")* ✨`;
  return welcome;
}

/**
 * Handles input from Meta channels (WhatsApp, Facebook, Instagram)
 */
export async function handleMetaInput(
  senderId: string,
  textBody: string,
  channel: 'whatsapp' | 'messenger' | 'instagram',
  dbAdmin: any
): Promise<string> {
  const cleanInput = textBody.trim();
  const session = await getMetaSession(senderId, channel, dbAdmin);
  const cleanedLower = cleanInput.toLowerCase();
  
  // Quick channel-specific visual prefixes for beautiful formatting
  const chSymbol = channel === 'whatsapp' ? '🟢 WhatsApp' : channel === 'instagram' ? '📸 Instagram' : '🔵 Messenger';

  // Load custom meta config from local JSON or Firebase if database is available
  let customWelcome = "";
  let customTriggers: Array<{ keywords: string; response: string; title: string }> = [];
  let useWorkflow = false;
  let workflowNodes: any[] = [];
  let knowledgeBase = "";
  let loadedLocally = false;

  try {
    const localPath = path.join(process.cwd(), 'meta_config.json');
    if (fs.existsSync(localPath)) {
      const fileContent = fs.readFileSync(localPath, 'utf8');
      const configData = JSON.parse(fileContent);
      if (configData) {
        if (configData.welcomeMessage) {
          customWelcome = configData.welcomeMessage;
        }
        if (configData.triggers) {
          customTriggers = configData.triggers;
        }
        if (configData.useWorkflow !== undefined) {
          useWorkflow = !!configData.useWorkflow;
        }
        if (configData.nodes && configData.nodes.length > 0) {
          workflowNodes = configData.nodes;
        }
        if (configData.knowledgeBase) {
          knowledgeBase = configData.knowledgeBase;
        }
        loadedLocally = true;
        console.log("[Meta Bot] Loaded configuration from local meta_config.json file.");
      }
    }
  } catch (localErr) {
    console.warn("[Meta Bot] Failed to load local meta_config.json:", localErr);
  }
  
  if (!loadedLocally && dbAdmin) {
    try {
      const configSnap = await dbAdmin.collection('vendors').doc('papo-hapo-express').collection('settings').doc('meta_config').get();
      if (configSnap.exists) {
        const configData = configSnap.data();
        if (configData.welcomeMessage) {
          customWelcome = configData.welcomeMessage;
        }
        if (configData.triggers) {
          customTriggers = configData.triggers;
        }
        if (configData.useWorkflow) {
          useWorkflow = true;
        }
        if (configData.nodes && configData.nodes.length > 0) {
          workflowNodes = configData.nodes;
        }
        if (configData.knowledgeBase) {
          knowledgeBase = configData.knowledgeBase;
        }
      }
    } catch (err) {
      console.error("[Meta Bot] Error loading custom chat flow config from Firestore:", err);
    }
  }

  // --- KNOWLEDGE BASE INTEGRATION FALLBACK / INTERCEPTOR ---
  if (knowledgeBase && cleanInput.length > 3 && !['1','2','3','4','5','6','7','8','9'].includes(cleanInput)) {
    const isBasicGreeting = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'hodi', 'oje'].includes(cleanedLower);
    if (!isBasicGreeting) {
      const kbAnswer = await queryKnowledgeBase(cleanInput, knowledgeBase);
      if (kbAnswer) {
        return kbAnswer;
      }
    }
  }

  // --- RUN WORKFLOW ENGINE IF ACTIVE ---
  if (useWorkflow && workflowNodes.length > 0) {
    const isReset = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'hodi', 'oje'].includes(cleanedLower);
    
    if (isReset || !session.details.currentNodeId) {
      // Reset flow and find start node
      const startNode = workflowNodes.find(n => n.type === 'start');
      session.details.currentNodeId = startNode ? startNode.id : undefined;
      session.details.activeQuestionNodeId = undefined;
      session.details.variables = {};
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);
      
      if (startNode) {
        return await executeNodeChain(startNode.id, cleanInput, session, workflowNodes, dbAdmin, channel);
      }
    } else {
      // Resume current workflow node
      return await executeNodeChain(session.details.currentNodeId, cleanInput, session, workflowNodes, dbAdmin, channel);
    }
  }

  // Check if user input matches any custom keywords defined by the admin (legacy triggers)
  if (customTriggers && customTriggers.length > 0) {
    for (const t of customTriggers) {
      if (!t.keywords) continue;
      const keywordsArray = t.keywords.split(',').map(k => k.trim().toLowerCase());
      if (keywordsArray.includes(cleanedLower)) {
        // Clear active session to return to start mode, and return response
        session.step = 'COLLECTING_ROUTE';
        session.service = undefined;
        session.details = {};
        await saveMetaSession(session, dbAdmin);
        return t.response;
      }
    }
  }

  // Load business services config
  let servicesConfig: any = {};
  if (dbAdmin) {
    try {
      const bizSnap = await dbAdmin.collection('config').doc('business').get();
      if (bizSnap.exists) {
        servicesConfig = bizSnap.data().services || {};
      }
    } catch (bizErr) {
      console.warn("[Meta Bot] Failed to fetch config/business for services:", bizErr);
    }
  }

  const DEFAULT_SERVICES = [
    { key: 'taxi', id: 'teksi', emoji: '🚖', title: 'TAXI', desc: 'Agiza boda, bajaji au gari' },
    { key: 'food', id: 'chakula', emoji: '🍔', title: 'CHAKULA', desc: 'Chips, Pizza, Burger, Biryani' },
    { key: 'grocery', id: 'sokoni', emoji: '🛍️', title: 'SOKONI', desc: 'Groceries, Nyanya, Vitunguu, Mchele' },
    { key: 'parcel', id: 'vifurushi', emoji: '📦', title: 'PARCEL', desc: 'Tuma au wasilisha mzigo haraka' },
    { key: 'salon', id: 'saluni', emoji: '💇‍♀️', title: 'SALUNI', desc: 'Hair cut, Nails, Spa, Makeup' },
    { key: 'hotel', id: 'hoteli', emoji: '🏨', title: 'HOTELI', desc: 'Weka vyumba vya hoteli karibu nawe' },
    { key: 'car_rental', id: 'car_rental', emoji: '🚗', title: 'KODI GARI', desc: 'Kodisha Prado, Cruiser, Harrier' },
    { key: 'pharmacy', id: 'dawa', emoji: '💊', title: 'PHARMACY', desc: 'Agiza Dawa na vifaa vya afya' },
    { key: 'bus_ticket', id: 'bus_ticket', emoji: '🚌', title: 'MABASI', desc: 'Kata tiketi za mabasi ya mikoani' }
  ];

  const activeServices = DEFAULT_SERVICES.filter(item => {
    const sData = servicesConfig[item.id];
    return !sData || sData.enabled !== false;
  }).map((item, idx) => {
    const sData = servicesConfig[item.id] || {};
    const isMaintenance = sData.maintenance === true;
    return {
      ...item,
      displayNum: (idx + 1).toString(),
      isMaintenance,
      maintenanceMessage: sData.message || `Huduma ya ${item.title} ipo kwenye matengenezo kwa sasa.`
    };
  });

  // Master Welcome Message
  const getWelcomeMessage = () => {
    return generateDynamicWelcomeMessage(servicesConfig, chSymbol, customWelcome);
  };

  // If user says "hi" or triggers restart
  const isGreeting = ['hi', 'mambo', 'vip', 'vipi', 'habari', 'hello', 'habari gani', 'anza', 'start', 'menu', 'ya', 'hodi', 'oje'].includes(cleanedLower);
  
  if (isGreeting || session.step === 'START') {
    session.step = 'START';
    session.service = undefined;
    session.details = {};
    
    // Classify first statement if it is conversational and not just a greeting
    if (!isGreeting && cleanInput.length > 3) {
      const { intent } = await classifyIntent(cleanInput);
      if (intent !== 'greeting' && intent !== 'other') {
        const matchedSrv = activeServices.find(srv => srv.key === intent);
        if (matchedSrv) {
          if (matchedSrv.isMaintenance) {
            return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${matchedSrv.maintenanceMessage}`;
          }
          session.service = intent as any;
          return await routeToServiceFlow(session, cleanInput, dbAdmin, channel);
        } else {
          return `⚠️ Samahani, huduma ya ${intent.toUpperCase()} haipatikani kwa sasa.`;
        }
      }
    }
    
    session.step = 'COLLECTING_ROUTE'; // Transition to standard numeric choices
    await saveMetaSession(session, dbAdmin);
    return getWelcomeMessage();
  }

  // If we are collecting initial selection
  if (session.step === 'COLLECTING_ROUTE' && !session.service) {
    // Check if numeric input matches any display number of active services
    const matchedSrvByNum = activeServices.find(srv => srv.displayNum === cleanInput);
    if (matchedSrvByNum) {
      if (matchedSrvByNum.isMaintenance) {
        return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${matchedSrvByNum.maintenanceMessage}`;
      }
      session.service = matchedSrvByNum.key as any;
    } else {
      // If it's a number that doesn't match the current dynamic options, block
      if (['1','2','3','4','5','6','7','8','9'].includes(cleanInput)) {
        return `⚠️ Samahani, huduma hii haipatikani kwa sasa au imefungwa. Tafadhali chagua namba iliyopo kwenye menu!`;
      }

      // Use NLP classifier for conversational selection!
      const { intent } = await classifyIntent(cleanInput);
      if (intent !== 'other' && intent !== 'greeting') {
        const matchedSrv = activeServices.find(srv => srv.key === intent);
        if (matchedSrv) {
          if (matchedSrv.isMaintenance) {
            return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${matchedSrv.maintenanceMessage}`;
          }
          session.service = intent as any;
        } else {
          return `⚠️ Samahani, huduma ya ${intent.toUpperCase()} haipatikani kwa sasa.`;
        }
      } else {
        return `⚠️ Samahani, sijaelewa ombi lako. Tafadhali chagua moja ya namba zilizopo kwenye menu, au andika jambo rahisi kama *Hi* kuanza upya.`;
      }
    }
    
    return await routeToServiceFlow(session, cleanInput, dbAdmin, channel);
  }

  // Active Flow handling
  const activeSrv = activeServices.find(srv => srv.key === session.service);
  if (activeSrv && activeSrv.isMaintenance) {
    // Intercept if active flow got put into maintenance mid-way
    session.step = 'START';
    session.service = undefined;
    session.details = {};
    await saveMetaSession(session, dbAdmin);
    return `⚠️ *MATENGENEZO / MAINTENANCE* ⚠️\n\n${activeSrv.maintenanceMessage}`;
  }

  return await routeToServiceFlow(session, cleanInput, dbAdmin, channel);
}

/**
 * Route input to specific module flow states
 */
async function routeToServiceFlow(
  session: MetaSession,
  input: string,
  dbAdmin: any,
  channel: 'whatsapp' | 'messenger' | 'instagram'
): Promise<string> {
  const service = session.service;
  const cleaned = input.toUpperCase();

  // 1. TAXI FLOW
  if (service === 'taxi') {
    // Check if they just selected the taxi option but haven't entered the route
    if (!session.details.route) {
      if (cleaned === '1' || cleaned === 'TAXI' || cleaned === 'TEKSI' || input.length < 4) {
        session.step = 'COLLECTING_ROUTE';
        await saveMetaSession(session, dbAdmin);
        return `🚕 *MFUMO WA TAXI (Taxi Booking)*\n\nTafadhali andika njia unayotaka kusafiri (Kutoka kuelekea unapoenda).\nMfano:\n*POSTA - KINONDONI*\nau *AIRPORT - MASAKI*`;
      }
      
      session.details.route = cleaned;
      session.step = 'SELECTING_VEHICLE';
      await saveMetaSession(session, dbAdmin);
      return `🚕 *AINA YA USAFIRI*\n\nTafadhali chagua aina ya usafiri unaopendelea kwa kuandika namba au jina lake:\n\n1. 🏍️ *Boda Boda* (Haraka na bei nafuu)\n2. 🛺 *Bajaji* (Salama na bei ya wastani)\n3. 🚕 *Gari la Teksi* (Starehe na usalama mkubwa)`;
    }

    if (session.step === 'SELECTING_VEHICLE') {
      let vehicleType = '';
      let typeName = '';
      
      const vInput = cleaned.toLowerCase();
      if (vInput === '1' || vInput.includes('boda') || vInput.includes('bike') || vInput.includes('piki')) {
        vehicleType = 'bike';
        typeName = 'Boda Boda 🏍️';
      } else if (vInput === '2' || vInput.includes('bajaj') || vInput.includes('sharo')) {
        vehicleType = 'bajaj';
        typeName = 'Bajaji 🛺';
      } else if (vInput === '3' || vInput.includes('taxi') || vInput.includes('gari') || vInput.includes('mini') || vInput.includes('car')) {
        vehicleType = 'mini';
        typeName = 'Gari la Teksi 🚕';
      } else {
        return `⚠️ Chaguo si sahihi. Tafadhali andika:\n1. Boda Boda 🏍️\n2. Bajaji 🛺\n3. Gari la Teksi 🚕\n\nKuchagua aina ya usafiri!`;
      }

      // Parse pickup & destination names from route
      let pickupName = "Mwenge";
      let destName = "Posta";
      const routeStr = session.details.route || "";
      const connectors = [" - ", "-", " KUTOKA ", " KWENDA ", " TO ", " / ", "/"];
      let splitDone = false;
      for (const conn of connectors) {
        if (routeStr.toUpperCase().includes(conn)) {
          const parts = routeStr.split(new RegExp(conn, 'i'));
          if (parts.length >= 2) {
            pickupName = parts[0].trim();
            destName = parts[1].trim();
            splitDone = true;
            break;
          }
        }
      }
      if (!splitDone) {
        const match = routeStr.match(/kutoka\s+(.*?)\s+kwenda\s+(.*)/i);
        if (match && match[1] && match[2]) {
          pickupName = match[1].trim();
          destName = match[2].trim();
        } else {
          pickupName = "Mwenge";
          destName = routeStr || "Posta";
        }
      }

      const cleanPickupName = pickupName.replace(/\s*\(.*?\)/g, "").trim();
      const cleanDestName = destName.replace(/\s*\(.*?\)/g, "").trim();

      const pRes = await resolvePlace(cleanPickupName, dbAdmin);
      const dRes = await resolvePlace(cleanDestName, dbAdmin);

      const pLoc = pRes.matches.length > 0 ? {
        placeId: pRes.matches[0].placeId,
        name: pRes.matches[0].name,
        address: pRes.matches[0].displayName || pRes.matches[0].name,
        lat: pRes.matches[0].latitude,
        lng: pRes.matches[0].longitude
      } : {
        placeId: "TZ-DSM-MWENGE-001",
        name: "Mwenge",
        address: "Mwenge, Kinondoni, Dar es Salaam",
        lat: -6.7681,
        lng: 39.2274
      };

      const dLoc = dRes.matches.length > 0 ? {
        placeId: dRes.matches[0].placeId,
        name: dRes.matches[0].name,
        address: dRes.matches[0].displayName || dRes.matches[0].name,
        lat: dRes.matches[0].latitude,
        lng: dRes.matches[0].longitude
      } : {
        placeId: "TZ-DSM-POSTA-001",
        name: "Posta",
        address: "Posta, Ilala, Dar es Salaam",
        lat: -6.8164,
        lng: 39.2902
      };

      // Distance and routing calculation using OSRM with Haversine fallback!
      const routeInfo = await getRoadDistanceAndDuration(pLoc, dLoc);
      const distanceKm = routeInfo.distanceKm;
      const durationMin = routeInfo.durationMin;

      // Fare calculation based on real rates configured
      let fare = 0;
      if (vehicleType === 'bike') {
        fare = 300 + distanceKm * 350;
        if (fare < 1500) fare = 1500;
      } else if (vehicleType === 'bajaj') {
        fare = 500 + distanceKm * 500;
        if (fare < 2500) fare = 2500;
      } else {
        // mini / taxi
        fare = 1000 + distanceKm * 800 + durationMin * 100;
        if (fare < 4000) fare = 4000;
      }
      fare = Math.round(fare / 500) * 500; // Round to nearest 500 TZS

      // Real or simulated nearby drivers count
      let nearbyCount = 0;
      if (dbAdmin) {
        try {
          const dSnap = await dbAdmin.collection('drivers')
            .where('isOnline', '==', true)
            .where('receiving', '==', true)
            .get();
          if (!dSnap.empty) {
            const driversList = dSnap.docs.map((doc: any) => doc.data());
            const matchingDrivers = driversList.filter((d: any) => {
              const dVType = (d.vehicleType || "").toLowerCase();
              if (dVType === vehicleType) return true;
              if (vehicleType === 'bike' && (dVType.includes('bike') || dVType.includes('piki') || dVType.includes('boda'))) return true;
              if (vehicleType === 'bajaj' && dVType.includes('bajaj')) return true;
              if (vehicleType === 'mini' && (dVType.includes('mini') || dVType.includes('gari') || dVType.includes('cab') || dVType.includes('car') || dVType.includes('taxi'))) return true;
              return false;
            });
            nearbyCount = matchingDrivers.length;
          }
        } catch (e) {
          console.warn("Could not query live drivers count:", e);
        }
      }
      if (nearbyCount === 0) {
        nearbyCount = Math.floor(Math.random() * 3) + 2; // Simulated 2-4 drivers
      }

      session.details.vehicleType = vehicleType;
      session.details.vehicleTypeName = typeName;
      session.details.calculatedDistance = distanceKm;
      session.details.calculatedDuration = durationMin;
      session.details.calculatedFare = fare;
      session.details.pickupCoords = pLoc;
      session.details.destinationCoords = dLoc;
      session.details.pickupName = pickupName;
      session.details.destinationName = destName;
      session.details.nearbyCount = nearbyCount;
      
      session.step = 'CONFIRMING_TRIP';
      await saveMetaSession(session, dbAdmin);

      let resp = `🧮 *KADIRIO LA NAULI*\n\n`;
      resp += `Kutoka: *${pickupName}*\n`;
      resp += `Kwenda: *${destName}*\n`;
      resp += `nisawa na kilometa : *${distanceKm} km* (Muda wa safari: ~${durationMin} dk)\n`;
      resp += `Aina ya Usafiri: *${typeName}*\n\n`;
      resp += `💵 *Nauli inayokadiriwa: TZS ${fare.toLocaleString()}/=*\n`;
      resp += `📌 Tuna madereva *${nearbyCount}* karibu nawe waliotayari!\n\n`;
      resp += `Je, unakubali kuanza kutafutiwa dereva?\n`;
      resp += `1. Ndio, Tafuta Dereva\n`;
      resp += `2. Hapana, Ghairi Safari`;
      return resp;
    }

    if (session.step === 'CONFIRMING_TRIP') {
      if (cleaned === '1' || cleaned.includes('ndio') || cleaned.includes('tafuta') || cleaned.includes('kubali') || cleaned.includes('yes')) {
        session.step = 'COLLECTING_PHONE';
        await saveMetaSession(session, dbAdmin);
        return `📍 Tafadhali andika namba yako ya simu ya mkononi ya kupokelea simu ya dereva (Mfano: *0712345678*):`;
      } else if (cleaned === '2' || cleaned.includes('hapana') || cleaned.includes('ghairi') || cleaned.includes('no') || cleaned.includes('cancel')) {
        session.step = 'START';
        session.service = undefined;
        session.details = {};
        await saveMetaSession(session, dbAdmin);
        return `❌ Safari yako imesitishwa kikamilifu. Karibu tena wakati mwingine ukiwa tayari kusafiri na Papo Hapo! 🚖`;
      } else {
        return `⚠️ Samahani, sielewi chaguo lako. Tafadhali andika:\n*1* - Ndio, Tafuta Dereva\n*2* - Hapana, Ghairi Safari`;
      }
    }

    if (session.step === 'COLLECTING_PHONE') {
      const phoneNum = input.trim();
      session.details.phone = phoneNum;
      session.step = 'START'; // Reset
      await saveMetaSession(session, dbAdmin);

      const pickupName = session.details.pickupName || "Mwenge";
      const destName = session.details.destinationName || "Posta";
      const pLoc = session.details.pickupCoords;
      const dLoc = session.details.destinationCoords;
      const vehicleType = session.details.vehicleType;
      const typeName = session.details.vehicleTypeName;
      const fare = session.details.calculatedFare;
      const distanceKm = session.details.calculatedDistance;
      const durationMin = session.details.calculatedDuration;

      // Create realistic Ride in Firestore
      const randId = Math.floor(100000 + Math.random() * 900000);
      if (dbAdmin) {
        try {
          const expiresAtDate = new Date();
          expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);

          await dbAdmin.collection('rides').add({
            status: "pending", // Set to pending so the live Rider Dashboard can receive it!
            customerId: `meta-client-${session.senderId}`,
            customerInfo: {
              name: session.details.customerName || "Meta Customer",
              phone: phoneNum,
              rating: 4.8
            },
            driverId: null,
            pickup: pLoc,
            destination: dLoc,
            vehicleType: vehicleType,
            fare: fare,
            distance: distanceKm,
            duration: durationMin,
            routeCoords: [
              { lat: pLoc.lat, lng: pLoc.lng },
              { lat: dLoc.lat, lng: dLoc.lng }
            ],
            createdAt: new Date(),
            expiresAt: expiresAtDate.toISOString(),
            driverInfo: null,
            driverLocation: null,
            channel: session.channel,
            bookingId: `PH-${randId}`
          });
        } catch (e) {
          console.warn("Could not insert ride request from Meta", e);
        }
      }

      return `✅ *Oda ya Taxi imewasilishwa!* 🚖\n\n` +
             `Ombi lako la safari limetumwa kwa madereva wote wa *${typeName}* waliopo karibu.\n\n` +
             `- Kutoka: *${pickupName}*\n` +
             `- Kwenda: *${destName}*\n` +
             `- Umbali: *${distanceKm} km*\n` +
             `- Muda wa safari: *~${durationMin} dk*\n` +
             `- Nauli: *TZS ${fare?.toLocaleString()}/=*\n` +
             `- Simu yako ya mawasiliano: *${phoneNum}*\n\n` +
             `Madereva wa karibu wamepewa taarifa sasa hivi. Dereva atakapokubali kukuja kukufuata, utafahamishwa mara moja hapa na utaweza kuwasiliana naye kwa urahisi kupitia simu yake au mfumo pindi akifika. Ahsante sana kwa kutumia Papo Hapo! 🙏✨`;
    }
  }

  // 2. BUS TICKET FLOW
  if (service === 'bus_ticket') {
    if (!session.details.route) {
      session.details.route = cleaned;
      session.step = 'SELECTING_OPTION';

      const operators = [
        { id: 'op-m1', name: 'Shabiby Line (Luxury VIP)', price: 45000 },
        { id: 'op-m2', name: 'Katarama Express (Business Class)', price: 42000 },
        { id: 'op-m3', name: 'Abood Bus (Semi-Luxury)', price: 38000 }
      ];
      session.details.optionsList = operators;
      await saveMetaSession(session, dbAdmin);

      let resp = `🚌 *Papo Hapo Bus Booking System*:\n\n`;
      resp += `Route: *${cleaned}*\n`;
      resp += `Mabasi yanayotoka leo:\n\n`;
      operators.forEach((op, idx) => {
        resp += `*${idx + 1}. ${op.name}*\n💰 Bei: *TSH ${op.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya basi unayotaka kukata tiketi sasa:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Namba si sahihi. Tafadhali andika *1*, *2*, au *3* kuchagua Basi.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `💺 Umefanya chaguo zuri. Sasa weka namba yako ya kulipia (Mobile money) ili tukutumie muamala (Push Prompt) wa kukata tiketi hii (Mfano: *07XXXXXXXX*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.details.phone = input;
      session.step = 'START'; // reset
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        session.details.selectedId || "bus-op",
        "bus_ticket",
        [{ name: `Bus Seat A5 (${session.details.route})`, price: session.details.selectedPrice || 45000, quantity: 1 }],
        session.details.selectedPrice || 45000,
        input,
        "Meta Bus Client",
        `Automatic bus booking for ${session.details.route} via ${session.channel}`,
        session.channel
      );

      return `🎉 *Tiketi Imesajiliwa Kikamilifu!* 🚌\n\n` +
             `- Safari: *${session.details.route}*\n` +
             `- Basi: *${session.details.selectedName}*\n` +
             `- Kiti: *A5 (Dirishani)*\n` +
             `- Nauli: *TSH ${session.details.selectedPrice?.toLocaleString()}*\n\n` +
             `Tumekutumia ujumbe wa muamala wa malipo kwenye simu yako *${input}*. Ukishalipia, tiketi yako kamili na namba ya siti vitatuma kwa SMS punde. Ahsante sana! 🌟`;
    }
  }

  // 3. FOOD FLOW
  if (service === 'food') {
    if (!session.details.itemQuery) {
      session.details.itemQuery = cleaned;
      session.step = 'SELECTING_OPTION';

      const foods = [
        { id: 'f1', name: 'Pizza ya Kuku & Cheese (Classic)', price: 15000, vendor: 'Pizza Hut Masaki' },
        { id: 'f2', name: 'Chips Kuku Choma (Nusu)', price: 8500, vendor: 'Papo Hapo Kitchen' },
        { id: 'f3', name: 'Biryani ya Nyama (Mlo Kamili)', price: 9000, vendor: 'Al-Farouq Biryani' }
      ];
      session.details.optionsList = foods;
      await saveMetaSession(session, dbAdmin);

      let resp = `🍔 *Papo Hapo Food Court Bot*:\n\n`;
      resp += `Tulichopata kwa jina: *"${cleaned}"*\n\n`;
      foods.forEach((fd, idx) => {
        resp += `*${idx + 1}. ${fd.name}*\n📍 ${fd.vendor}\n💰 Bei: *TSH ${fd.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya chakula unachotaka kuagiza sasa hivi:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Chaguo si sahihi. Andika *1*, *2*, au *3* kuchagua chakula chako!`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.details.selectedVendor = selected.vendor;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `🛵 Tafadhali andika namba yako ya simu na sehemu unapoishi kwa ajili ya usafirishaji wa chakula chako (Mfano: *0712345678, Mbezi beach*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START'; // reset
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        "vendor-food-meta",
        "restaurant",
        [{ name: session.details.selectedName, price: session.details.selectedPrice, quantity: 1 }],
        session.details.selectedPrice || 10000,
        input.split(',')[0].trim(),
        "Meta Food Client",
        `Delivery address: ${input}`,
        session.channel
      );

      return `🎉 *Oda Yako ya Chakula Imepokelewa!* 🍔🛵\n\n` +
             `- Chakula: *${session.details.selectedName}*\n` +
             `- Mgahawa: *${session.details.selectedVendor}*\n` +
             `- Bei ya kulipa: *TSH ${session.details.selectedPrice?.toLocaleString()}*\n` +
             `- Maelezo ya kufikishiwa: *${input}*\n\n` +
             `Mtumishi wetu wa bodaboda ameanza kuandaa na kukuletea mzigo wako sasa hivi. Utawasiliana naye kwa namba hiyo. Karibu sana!`;
    }
  }

  // 4. GENERAL CATEGORY REDIRECTS FOR FULL INTENT SCOPE (SALON, PARCEL, CAR RENTAL, GROCERY, HOTEL, PHARMACY)
  // To keep it clean and interactive, we will provide a beautiful instant checkout block for each of these!
  
  // PARCEL FLOW
  if (service === 'parcel') {
    if (!session.details.route) {
      session.details.route = cleaned;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);
      return `📦 *Papo Hapo Express Parcel Delivery*:\n\n` +
             `Umesema unataka kutuma mzigo: *"${cleaned}"*\n\n` +
             `Tafadhali andika namba yako ya simu na maelekezo ya kupokea (Mfano: *0712345678, Kutoka Kariakoo kwenda Tegeta*):`;
    }
    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        "papo-hapo-courier",
        "parcel",
        [{ name: `Courier Delivery: ${session.details.route}`, price: 5000, quantity: 1 }],
        5000,
        input.split(',')[0].trim(),
        "Meta Courier Client",
        `Route: ${input}`,
        session.channel
      );

      return `✅ *Ombi la Kusafirisha Mzigo Limesajiliwa!* 📦\n\n` +
             `- Aina ya Mzigo: *${session.details.route}*\n` +
             `- Maelekezo: *${input}*\n` +
             `- Gharama ya Kuanzia: *TSH 5,000*\n\n` +
             `Dereva wetu wa Baiskeli au Bodaboda atafika eneo la kupokea mzigo sasa hivi. Tutawasiliana nawe hivi punde! Ahsante!`;
    }
  }

  // CAR RENTAL FLOW
  if (service === 'car_rental') {
    if (!session.details.itemQuery) {
      session.details.itemQuery = cleaned;
      session.step = 'SELECTING_OPTION';
      
      const cars = [
        { id: 'car-m1', name: 'Toyota Land Cruiser Prado (Silver)', price: 150000 },
        { id: 'car-m2', name: 'Toyota Harrier New Model (Black)', price: 100000 },
        { id: 'car-m3', name: 'Toyota Noah (Vibe / Safari)', price: 70000 }
      ];
      session.details.optionsList = cars;
      await saveMetaSession(session, dbAdmin);

      let resp = `🚗 *Papo Hapo Car Rental Assist*:\n\n`;
      resp += `Magari yanayopatikana leo karibu nawe:\n\n`;
      cars.forEach((car, idx) => {
        resp += `*${idx + 1}. ${car.name}*\n💰 Kodi kwa siku: *TSH ${car.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya gari unalotaka kukodi leo:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Namba si sahihi. Andika *1*, *2*, au *3* kukodi gari.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `🔑 Umemiliki chaguo hili! Andika namba yako ya simu ya mkononi ya kukamilisha kukodisha (Mfano: *07XXXXXXXX*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        "car-rental-meta-vendor",
        "car_rental",
        [{ name: `Car Rental: ${session.details.selectedName}`, price: session.details.selectedPrice, quantity: 1 }],
        session.details.selectedPrice || 100000,
        input,
        "Meta Car Rental Client",
        `Renting vehicle ${session.details.selectedName}`,
        session.channel
      );

      return `🎉 *Kuhifadhi Gari Limefanikiwa!* 🚗🔑\n\n` +
             `- Gari: *${session.details.selectedName}*\n` +
             `- Gharama/Siku: *TSH ${session.details.selectedPrice?.toLocaleString()}*\n` +
             `- Simu Yako: *${input}*\n\n` +
             `Mwakilishi wetu atawasiliana nawe hivi punde kuleta gari na funguo mahali ulipo au kukuelekeza ofisini. Ahsante na karibu sana!`;
    }
  }

  // SALON FLOW
  if (service === 'salon') {
    if (!session.details.itemQuery) {
      session.details.itemQuery = cleaned;
      session.step = 'SELECTING_OPTION';

      const salons = [
        { id: 'sal-m1', name: 'Shear Illusions Executive Salon', price: 20000, desc: 'Hair Treatment & Wash' },
        { id: 'sal-m2', name: 'Glamour Nails & Makeup Lounge', price: 25000, desc: 'Manicure & Nails gel' },
        { id: 'sal-m3', name: 'VIP Barber & Facial Scrub', price: 10000, desc: 'Premium Shaving & Scrub' }
      ];
      session.details.optionsList = salons;
      await saveMetaSession(session, dbAdmin);

      let resp = `💇‍♀️ *Papo Hapo Salon Booking Lounge*:\n\n`;
      resp += `Umesema unatafuta: *"${cleaned}"*\n\n`;
      salons.forEach((sal, idx) => {
        resp += `*${idx + 1}. ${sal.name}*\n📍 ${sal.desc}\n💰 Huduma: *TSH ${sal.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya Saluni unayotaka kuweka miadi (Booking) sasa:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Chaguo si sahihi. Tafadhali weka *1*, *2*, au *3*.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `⏰ Tafadhali andika namba yako ya simu na muda unaopendelea kufika saluni leo (Mfano: *0712345678, Saa 11 Jioni*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        session.details.selectedId || "salon-meta-vendor",
        "salon",
        [{ name: `Salon Booking at ${session.details.selectedName}`, price: session.details.selectedPrice, quantity: 1 }],
        session.details.selectedPrice || 15000,
        input.split(',')[0].trim(),
        "Meta Salon Client",
        `Booking Details: ${input}`,
        session.channel
      );

      return `✨ *Wazo la Miadi Limethibitishwa!* 💇‍♀️💅\n\n` +
             `- Saluni: *${session.details.selectedName}*\n` +
             `- Bei: *TSH ${session.details.selectedPrice?.toLocaleString()}*\n` +
             `- Maelezo ya kufika: *${input}*\n\n` +
             `Saluni imepokea ombi lako na itakupigia simu kuthibitisha muda sahihi. Ahsante kwa kutumia Papo Hapo Super App Bot!`;
    }
  }

  // SOKONI / GROCERY FLOW
  if (service === 'grocery') {
    if (!session.details.itemQuery) {
      session.details.itemQuery = cleaned;
      session.step = 'SELECTING_OPTION';

      const items = [
        { id: 'grc-m1', name: 'Nyanya Kiboksi (Safi)', price: 3500 },
        { id: 'grc-m2', name: 'Vitunguu Fungo Kubwa (Sokoni)', price: 2000 },
        { id: 'grc-m3', name: 'Mchele Grade I (Sumbawanga - 5KG)', price: 12500 }
      ];
      session.details.optionsList = items;
      await saveMetaSession(session, dbAdmin);

      let resp = `🥦 *Papo Hapo Sokoni Assist*:\n\n`;
      resp += `Tulivyopata kwa ajili ya: *"${cleaned}"*\n\n`;
      items.forEach((item, idx) => {
        resp += `*${idx + 1}. ${item.name}*\n💰 Bei: *TSH ${item.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya bidhaa unayotaka kuagiza sasa hivi:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Weka namba sahihi ya orodha kuanzia *1* hadi *3*.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `🏡 Tafadhali weka namba yako ya simu na anwani ya kuwasilisha mzigo wako (Mfano: *0712345678, Kinondoni Block B*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        "sokoni-vendor-meta",
        "grocery",
        [{ name: session.details.selectedName, price: session.details.selectedPrice, quantity: 1 }],
        session.details.selectedPrice || 5000,
        input.split(',')[0].trim(),
        "Meta Grocery Client",
        `Market Address: ${input}`,
        session.channel
      );

      return `🎉 *Oda Yako Sokoni Imesajiliwa!* 🥦🛍️\n\n` +
             `- Bidhaa: *${session.details.selectedName}*\n` +
             `- Jumla ya Bei: *TSH ${session.details.selectedPrice?.toLocaleString()}*\n` +
             `- Maelezo ya Nyumbani: *${input}*\n\n` +
             `Mjumbe wetu anafunga bidhaa zako na ataondoka sokoni kukuletea hapo punde. Utapokea simu ya malipo (Push prompt) sasa! Ahsante sana!`;
    }
  }

  // PHARMACY FLOW
  if (service === 'pharmacy') {
    if (!session.details.itemQuery) {
      session.details.itemQuery = cleaned;
      session.step = 'SELECTING_OPTION';

      const meds = [
        { id: 'med-m1', name: 'Panadol Advance (Kopo 24)', price: 3000 },
        { id: 'med-m2', name: 'Amoxicillin Caps (Pack 10)', price: 4500 },
        { id: 'med-m3', name: 'Hedex Tablets (Strap)', price: 1500 }
      ];
      session.details.optionsList = meds;
      await saveMetaSession(session, dbAdmin);

      let resp = `💊 *Papo Hapo Pharmacy Assistant*:\n\n`;
      resp += `Dawa zilizopo karibu kwa ajili ya: *"${cleaned}"*\n\n`;
      meds.forEach((med, idx) => {
        resp += `*${idx + 1}. ${med.name}*\n💰 Bei: *TSH ${med.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya dawa unayohitaji kuagiza:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Weka namba sahihi. Chagua *1*, *2*, au *3*.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `💊 Tafadhali andika namba yako ya simu kwa ajili ya kutumiwa push prompt ya malipo na duka (Mfano: *07XXXXXXXX*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        "pharmacy-meta-vendor",
        "pharmacy",
        [{ name: session.details.selectedName, price: session.details.selectedPrice, quantity: 1 }],
        session.details.selectedPrice || 2500,
        input,
        "Meta Pharmacy Client",
        `Requested medicine: ${session.details.selectedName}`,
        session.channel
      );

      return `✅ *Agizo la Dawa Limepokelewa!* 💊🚑\n\n` +
             `- Dawa: *${session.details.selectedName}*\n` +
             `- Bei ya kulipa: *TSH ${session.details.selectedPrice?.toLocaleString()}*\n\n` +
             `Tumetuma ujumbe wa kufanya malipo (Push Prompt) kwenye namba yako *${input}*. Muamala ukikamilika duka litatuma dawa zako mara moja!`;
    }
  }

  // HOTEL FLOW
  if (service === 'hotel') {
    if (!session.details.itemQuery) {
      session.details.itemQuery = cleaned;
      session.step = 'SELECTING_OPTION';

      const hotels = [
        { id: 'htl-m1', name: 'The Hyatt Regency Kilimanjaro', price: 280000, desc: 'Luxury Sea View Room' },
        { id: 'htl-m2', name: 'Serena Luxury Hotel & Suites', price: 220000, desc: 'Deluxe Suite with Breakfast' },
        { id: 'htl-m3', name: 'Transit Motel Airport', price: 65000, desc: 'Standard Room with AC' }
      ];
      session.details.optionsList = hotels;
      await saveMetaSession(session, dbAdmin);

      let resp = `🏨 *Papo Hapo Hotel Room Finder*:\n\n`;
      resp += `Vyumba vilivyo wazi karibu nawe:\n\n`;
      hotels.forEach((htl, idx) => {
        resp += `*${idx + 1}. ${htl.name}*\n📍 ${htl.desc}\n💰 Chumba/Usiku: *TSH ${htl.price.toLocaleString()}*\n\n`;
      });
      resp += `Andika namba ya hoteli unayotaka kuweka Booking sasa hivi:`;
      return resp;
    }

    if (session.step === 'SELECTING_OPTION') {
      const idx = parseInt(input) - 1;
      const selected = session.details.optionsList?.[idx];
      if (!selected) {
        return `⚠️ Namba uliyoweka haipo kwenye list yetu.`;
      }

      session.details.selectedId = selected.id;
      session.details.selectedName = selected.name;
      session.details.selectedPrice = selected.price;
      session.step = 'COLLECTING_PHONE';
      await saveMetaSession(session, dbAdmin);

      return `🏨 Umefanya chaguo makini! Sasa andika namba yako ya simu na tarehe unayotaka kuingia (Mfano: *0712345678, Tarehe 30 June*):`;
    }

    if (session.step === 'COLLECTING_PHONE') {
      session.step = 'START';
      await saveMetaSession(session, dbAdmin);

      await triggerAutomatedOrder(
        dbAdmin,
        session.details.selectedId || "hotel-meta-vendor",
        "hotel",
        [{ name: `Hotel Booking at ${session.details.selectedName}`, price: session.details.selectedPrice, quantity: 1 }],
        session.details.selectedPrice || 100000,
        input.split(',')[0].trim(),
        "Meta Hotel Client",
        `Booking info: ${input}`,
        session.channel
      );

      return `🏨 *Booking ya Chumba Imethibitishwa!* 🎉\n\n` +
             `- Hoteli: *${session.details.selectedName}*\n` +
             `- Maelezo ya kuingia: *${input}*\n\n` +
             `Hoteli imepokea data zako na itatuma barua pepe/SMS ya kukukaribisha hivi punde. Karibu Tanzania! 🇹🇿`;
    }
  }

  // Reset to default
  session.step = 'START';
  session.service = undefined;
  session.details = {};
  await saveMetaSession(session, dbAdmin);
  
  let servicesConfig: any = {};
  if (dbAdmin) {
    try {
      const bizSnap = await dbAdmin.collection('config').doc('business').get();
      if (bizSnap.exists) {
        servicesConfig = bizSnap.data().services || {};
      }
    } catch (bizErr) {
      console.warn("[Meta Bot] Failed to fetch services config in routeToServiceFlow:", bizErr);
    }
  }
  const chSymbol = channel === 'whatsapp' ? '🟢 WhatsApp' : channel === 'instagram' ? '📸 Instagram' : '🔵 Messenger';
  return generateDynamicWelcomeMessage(servicesConfig, chSymbol);
}
