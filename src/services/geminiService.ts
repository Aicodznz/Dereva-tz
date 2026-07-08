import { GoogleGenAI, Type } from "@google/genai";

let aiClient: any = null;

function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Resilient helper to call Gemini generateContent with retries and fallback models
async function generateContentWithRetry(params: any, maxRetries = 2) {
  let attempt = 0;
  let delay = 1000;
  const modelsToTry = [params.model, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-3.5-flash"];
  const models = Array.from(new Set(modelsToTry.filter(Boolean)));

  const client = getAI();

  for (const model of models) {
    for (attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Gemini API - geminiService] Calling model ${model}, attempt ${attempt + 1}...`);
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
          console.warn(`[Gemini API - geminiService] Model ${model} failed with ${isQuotaExceeded ? 'Quota Exceeded (429)' : 'Unavailable (503)'}: ${message}. Switching to next fallback model immediately...`);
          break; // Break the retry loop for this model, proceed to the next model in the outer loop
        }

        const isTransient = status === 500 || status === 502 || status === 504 || message.includes("502") || message.includes("504") || message.includes("timeout");
        if (isTransient && attempt < maxRetries - 1) {
          console.warn(`[Gemini API - geminiService] Transient error (status: ${status}) on model ${model}: ${message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
        } else {
          console.error(`[Gemini API - geminiService] Error or out of retries for model ${model}: ${message}`);
          break; // Break current retry loop to try the next fallback model
        }
      }
    }
  }
  throw new Error("Gemini API failed on all models and retries. Please try again later.");
}

export async function getMarketplaceInsights(query: string) {
  try {
    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: query,
      config: {
        tools: [
          { googleSearch: {} }
        ],
        systemInstruction: "You are a helpful assistant for Papo Hapo, a super app. Use Google Search to provide accurate information about local services, prices, and trends.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Search error:", error);
    return "I couldn't fetch real-time data at the moment.";
  }
}

export async function getNearbyServiceInfo(location: string, serviceType: string) {
  try {
    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `Find ${serviceType} in ${location} and provide details about their ratings and services.`,
      config: {
        tools: [
          { googleMaps: {} }
        ],
        systemInstruction: "You are a local service expert. Use Google Maps to find the best services for the user.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Maps error:", error);
    return "I couldn't find local map data at the moment.";
  }
}
