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

export async function getMarketplaceInsights(query: string) {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
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
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
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
