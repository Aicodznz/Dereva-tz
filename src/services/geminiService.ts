import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getMarketplaceInsights(query: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        tools: [
          { googleSearch: {} }
        ],
        systemInstruction: "You are a helpful assistant for OmniServe, a super app. Use Google Search to provide accurate information about local services, prices, and trends.",
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
    const response = await ai.models.generateContent({
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
