import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required to generate workflow." });
    }

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

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
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
    return res.status(500).json({ error: "Failed to generate workflow nodes via AI: " + err?.message || String(err) });
  }
}
