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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { image } = req.body; // base64 image data
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
  }

  try {
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
    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error("Asset analysis failed:", error);
    return res.status(500).json({ error: "Failed to analyze asset", details: error.message });
  }
}
