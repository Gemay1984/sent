import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedNews {
  headline: string;
  lead: string;
  body: string;
  hashtags: string[];
  category: "Cultura" | "Turismo" | "Tránsito" | "Política" | "Judicial";
}

export async function generateNews(facts: string): Promise<GeneratedNews> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: facts,
    config: {
      systemInstruction: `Eres un publicista y periodista experto del Quindío, Colombia. 
      Tu marca es RECREA. Genera una noticia impactante, profesional y lista para redes sociales basada en los hechos proporcionados.
      Incluye recomendaciones de hashtags virales de la región.
      La respuesta DEBE ser un objeto JSON válido.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING, description: "Un titular llamativo y periodístico." },
          lead: { type: Type.STRING, description: "Un párrafo introductorio fuerte." },
          body: { type: Type.STRING, description: "El cuerpo de la noticia detallado." },
          hashtags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Hashtags recomendados (incluye #Quindio, #RECREA, y específicos de la categoría)."
          },
          category: { 
            type: Type.STRING, 
            enum: ["Cultura", "Turismo", "Tránsito", "Política", "Judicial"],
            description: "Categoría de la noticia."
          },
        },
        required: ["headline", "lead", "body", "hashtags", "category"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateNewsImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        { text: `Fotografía profesional periodística de alta calidad sobre: ${prompt}. Estilo Quindío, paisajes verdes cafeteros o entorno urbano local según corresponda. Sin texto.` },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  
  return "https://picsum.photos/seed/quindio/1200/675";
}
