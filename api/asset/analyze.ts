import type { VercelRequest, VercelResponse } from '@vercel/node';

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

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
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
