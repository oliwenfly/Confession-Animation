
import { GoogleGenAI, Type } from "@google/genai";
import { FireflyConfig } from "../types";

export const updateFireflyConfigWithAI = async (prompt: string, currentConfig: FireflyConfig): Promise<FireflyConfig> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The user wants to change the environment. Prompt: "${prompt}". 
    Current state: ${JSON.stringify(currentConfig)}.
    Return the new configuration parameters for the fireflies.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          count: { type: Type.NUMBER, description: "Number of fireflies (1-50)" },
          color: { type: Type.STRING, description: "CSS color string (e.g. '#ffff00', 'cyan')" },
          speed: { type: Type.NUMBER, description: "Flight speed multiplier (0.5-5)" },
          flickerRate: { type: Type.NUMBER, description: "How fast the tail flickers (1-10)" },
          wingSpeed: { type: Type.NUMBER, description: "How fast the wings flap (1-15)" },
        },
        required: ["count", "color", "speed", "flickerRate", "wingSpeed"]
      },
    },
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return currentConfig;
  }
};
