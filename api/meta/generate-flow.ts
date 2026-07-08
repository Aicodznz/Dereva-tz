import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { prompt, currentNodes } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required to generate workflow." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not set." });
    }

    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const hasExistingNodes = Array.isArray(currentNodes) && currentNodes.length > 0;

    const systemInstruction = hasExistingNodes ? `You are an expert conversational flowchart engineer for Papo Hapo Super App Automation Studio (V3.0).
The user ALREADY HAS an existing chatbot workflow with the following nodes:
${JSON.stringify(currentNodes, null, 2)}

The user wants to CONTINUE, MODIFY, EDIT, or EXTEND this existing workflow with the following instruction:
"${prompt}"

CRITICAL INSTRUCTIONS FOR CONTINUING/MODIFYING FLOWS:
1. Preserve existing valid nodes and node IDs where possible (e.g. "n_start", "n_menu", "n_router", "n_taxi_pickup", etc.).
2. Apply the user's requested modifications or extensions.
   - For example, if the user asks: "endelea au rekebisha kwamba akichagua TAXI au namba 1 basi aambiwe andike lokesheni anayo enda na abonyeze kitufe chakutuma location au aandike anapo kwenda na alipo":
     * Update the TAXI question node ("n_taxi_pickup") text to explicitly ask for location/GPS or pickup address:
       "🚖 Tafadhali andika mahali ulipo sasa (Pickup Address) au bonyeza kitufe cha Tuma Location / Shiriki Eneo Lako:"
     * Ensure the follow-up node ("n_taxi_dest") asks for the destination address:
       "📍 Asante! Sasa andika au chagua eneo unalokwenda (Destination):"
     * Keep the "n_taxi_order" (create_order node) and "n_taxi_done" confirmation message properly linked!
3. Ensure all nextNodeId, options nextNodeId, and intentMappings nextNodeId point to valid node IDs in the resulting array.
4. Arrange node positions neatly in 2D space without overlapping.
5. Return ONLY a valid JSON array of updated nodes. Do not wrap in markdown \`\`\`json blocks and do not add explanatory text.` : `You are an expert conversational flowchart engineer for Papo Hapo Super App Automation Studio (V3.0). Generate a list of interconnected nodes representing a WhatsApp/Messenger/Instagram/SMS Chatbot automation flow based on the user's request.
The user request is: "${prompt}"

Return ONLY a valid JSON array of nodes. Do not wrap it in \`\`\`json markdown blocks, and do not add any explanation or greeting text.

CRITICAL SPECIAL INSTRUCTION FOR MAIN PAPO HAPO MENU / GREETING / HABARI / SERVICE REQUESTS:
If the user's prompt mentions greetings ("habari", "hello", "hi", "mambo", "salama"), menu, main flow, or services (1. TAXI, 2. SALUNI, 3. MABASI, 4. CHAKULA, 5. SOKO, 6. PHARMACY):
You MUST generate a complete, beautifully structured multi-service chatbot flowchart with the following exact structure:
1. "n_start" (type: "start", position: {x: 50, y: 150}, nextNodeId: "n_menu")
2. "n_menu" (type: "question", position: {x: 280, y: 150}, data: {
     label: "Karibu & Main Menu",
     text: "Karibu kwenye Mfumo wa Huduma za Papo Hapo! 🌟\\n\\nTafadhali chagua huduma unayotaka kwa kutuma namba yake:\\n1. 🚕 TAXI\\n2. 💇‍♀️ SALUNI (Salons)\\n3. 🚌 MABASI (Bus Tickets)\\n4. 🥗 CHAKULA (Restaurants)\\n5. 🥦 SOKO (Groceries)\\n6. 💊 PHARMACY",
     variableName: "service_choice",
     options: [
       { key: "1", value: "TAXI", nextNodeId: "n_taxi_pickup" },
       { key: "2", value: "SALUNI", nextNodeId: "n_salon_service" },
       { key: "3", value: "MABASI", nextNodeId: "n_bus_route" },
       { key: "4", value: "CHAKULA", nextNodeId: "n_food_item" },
       { key: "5", value: "SOKO", nextNodeId: "n_grocery_items" },
       { key: "6", value: "PHARMACY", nextNodeId: "n_pharmacy_med" }
     ],
     nextNodeId: "n_router"
   })
3. "n_router" (type: "ai_decision", position: {x: 520, y: 150}, data: {
     label: "AI Intent Router",
     nextNodeId: "n_taxi_pickup",
     intentMappings: [
       { keywords: "1, taxi, gari, safari, uber, bolt", nextNodeId: "n_taxi_pickup" },
       { keywords: "2, saluni, kinyozi, kusuka, salon, nywele", nextNodeId: "n_salon_service" },
       { keywords: "3, mabasi, bus, tiketi, safari ya mkoani, kiti", nextNodeId: "n_bus_route" },
       { keywords: "4, chakula, msosi, kuku, biryani, chips, mgahawa", nextNodeId: "n_food_item" },
       { keywords: "5, soko, mboga, nyanya, matunda, sokoni, grocery", nextNodeId: "n_grocery_items" },
       { keywords: "6, pharmacy, dawa, duka la dawa, panadol", nextNodeId: "n_pharmacy_med" }
     ]
   })

And then create clean sub-branches for all 6 services:
- TAXI BRANCH:
  "n_taxi_pickup" (type: "question", position: {x: 800, y: 50}, data: { label: "Ulipo (Pickup & Location)", text: "🚖 Tafadhali andika mahali ulipo sasa (Pickup Location) au bonyeza kitufe cha Tuma Location:", variableName: "pickup", nextNodeId: "n_taxi_dest" })
  "n_taxi_dest" (type: "question", position: {x: 1040, y: 50}, data: { label: "Unapokwenda (Destination)", text: "📍 Unapokwenda wapi? (Destination):", variableName: "destination", nextNodeId: "n_taxi_order" })
  "n_taxi_order" (type: "create_order", position: {x: 1280, y: 50}, data: { label: "Ongeza Oda ya Taxi DB", serviceType: "taxi", nextNodeId: "n_taxi_done" })
  "n_taxi_done" (type: "message", position: {x: 1520, y: 50}, data: { label: "Thibitisha Taxi", text: "✅ Order ya Taxi imefanikiwa! Dereva aliye karibu anakuja kukufuata. Oda ID: {{booking_id}}" })

- SALUNI BRANCH:
  "n_salon_service" (type: "question", position: {x: 800, y: 220}, data: { label: "Huduma ya Saluni", text: "💇‍♀️ Unahitaji huduma gani ya Saluni? (k.m. Kusuka, Kinyozi, Nails, Facial):", variableName: "salon_service", nextNodeId: "n_salon_time" })
  "n_salon_time" (type: "question", position: {x: 1040, y: 220}, data: { label: "Muda wa Miadi", text: "🕒 Je ungependa miadi ya saa ngapi leo au kesho?", variableName: "salon_time", nextNodeId: "n_salon_done" })
  "n_salon_done" (type: "message", position: {x: 1280, y: 220}, data: { label: "Thibitisha Saluni", text: "✅ Booking yako ya Saluni imepokelewa! Saluni itawasiliana nawe kuthibitisha nafasi." })

- MABASI BRANCH:
  "n_bus_route" (type: "question", position: {x: 800, y: 390}, data: { label: "Njia ya Basi", text: "🚌 Unasafiri kutoka wapi kwenda wapi? (k.m. Dar es Salaam kwenda Arusha):", variableName: "bus_route", nextNodeId: "n_bus_date" })
  "n_bus_date" (type: "question", position: {x: 1040, y: 390}, data: { label: "Tarehe ya Safari", text: "📅 Andika tarehe ya safari yako:", variableName: "bus_date", nextNodeId: "n_bus_done" })
  "n_bus_done" (type: "message", position: {x: 1280, y: 390}, data: { label: "Thibitisha Basi", text: "✅ Tiketi yako ya Basi inaandaliwa! Utapokea SMS ya namba ya kiti na M-Pesa Control Number." })

- CHAKULA BRANCH:
  "n_food_item" (type: "question", position: {x: 800, y: 560}, data: { label: "Agiza Chakula", text: "🥗 Je ungependa kuagiza chakula gani? (k.m. Wali Samaki, Kuku Choma, Biryani):", variableName: "food_item", nextNodeId: "n_food_addr" })
  "n_food_addr" (type: "question", position: {x: 1040, y: 560}, data: { label: "Anwani ya Kuletewa", text: "🏠 Andika eneo la kuletewa chakula (Delivery Address):", variableName: "delivery_address", nextNodeId: "n_food_done" })
  "n_food_done" (type: "message", position: {x: 1280, y: 560}, data: { label: "Thibitisha Chakula", text: "✅ Oda yako ya Chakula imepokelewa! Mkahawa unaandaa chakula na Rider anakuletea hivi punde." })

- SOKO BRANCH:
  "n_grocery_items" (type: "question", position: {x: 800, y: 730}, data: { label: "Orodha ya Soko", text: "🥦 Andika orodha ya vitu vya soko unavyohitaji (k.m. Nyanya, Vitunguu, Hoho, Matunda):", variableName: "grocery_list", nextNodeId: "n_grocery_done" })
  "n_grocery_done" (type: "message", position: {x: 1040, y: 730}, data: { label: "Thibitisha Soko", text: "✅ Oda yako ya Soko imepokelewa! Muuzaji wa soko anaipack na kukuletea nyumbani." })

- PHARMACY BRANCH:
  "n_pharmacy_med" (type: "question", position: {x: 800, y: 900}, data: { label: "Maelezo ya Dawa", text: "💊 Andika jina la dawa au maelezo ya dawa unayohitaji:", variableName: "pharmacy_med", nextNodeId: "n_pharmacy_done" })
  "n_pharmacy_done" (type: "message", position: {x: 1040, y: 900}, data: { label: "Thibitisha Pharmacy", text: "✅ Ombi lako la Dawa limepokelewa na Pharmacy ya karibu! Tutawasiliana nawe kutoa maelekezo ya matumizi." })

GENERAL PROMPT INSTRUCTIONS FOR OTHER REQUESTS:
Supported node types are:
1. "start" - The beginning of the flow. Should have a single starting node with id "n_start" and nextNodeId pointing to the first interactive node.
2. "message" - Sends a text message. Properties in "data": "label", "text" (Swahili/English friendly text), and "nextNodeId" (optional).
3. "question" - Asks the user a question and captures their text input into a variable. Properties in "data": "label", "text", "variableName" (the name of the variable to store the response), "options" (array of {key, value, nextNodeId}), and "nextNodeId".
4. "ai_decision" - Real-time NLP classifier using keywords or AI. Properties in "data": "label", "nextNodeId" (default path), and "intentMappings" (an array of objects, e.g. { keywords: "taxi, gari", nextNodeId: "n_taxi" }).
5. "payment" - Request/process mobile payment. Properties in "data": "label", "paymentAmount" (number), "nextNodeId".
6. "create_order" - Creates a database record for Papo Hapo Super App. Properties in "data": "label", "serviceType" (one of "taxi", "food", "parcel", "salon", "bus"), "nextNodeId".
7. "end" - Goodbye or summary screen. Properties in "data": "label", "text". "nextNodeId" should be empty/null or omitted for "end" nodes.

Every node must have:
- "id": a unique string
- "type": one of the types above
- "position": object with x and y coordinates arranged neatly without overlapping
- "data": the object containing specific keys for that node type.

Ensure all nextNodeId and intentMappings point to existing valid node ids in the output JSON array! Keep language clear, engaging, professional, and in Swahili combined with easy English accents as typical of Tanzania.`;

    const response = await generateContentWithRetry(client, {
      model: "gemini-3.5-flash",
      contents: systemInstruction,
    });

    let responseText = response.text || "[]";
    if (responseText.includes("```")) {
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    const nodes = JSON.parse(responseText);
    return res.status(200).json({ nodes, status: "success" });
  } catch (err: any) {
    console.error("[Flow Generator Vercel Error]", err);
    return res.status(500).json({ error: "Failed to generate workflow nodes via AI: " + (err?.message || String(err)) });
  }
}
