import { GoogleGenAI, Type } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, AdvancedGraphMetrics, LayoutType } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  const systemInstruction = `You are a Digital Humanities expert for Translation Studies. Design a data schema based on the research topic. Output JSON in English.`;
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Architect a project structure for the following research inquiry: "${prompt}". Suggest specific fields that would be valuable for statistical or network analysis.`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectScope: { type: Type.STRING },
          suggestedSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fieldName: { type: Type.STRING },
                description: { type: Type.STRING },
                analyticalUtility: { type: Type.STRING },
                importance: { type: Type.STRING, enum: ['Critical', 'Optional'] }
              },
              required: ['fieldName', 'description', 'analyticalUtility', 'importance']
            }
          },
          dataCleaningStrategy: { type: Type.STRING }
        },
        required: ['projectScope', 'suggestedSchema', 'dataCleaningStrategy']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const parseBibliographicData = async (rawText: string, blueprint?: ResearchBlueprint): Promise<Partial<BibEntry>> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract data from: "${rawText}"`,
    config: {
      systemInstruction: "Extract bibliographic data from archival source text. Output JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          publicationYear: { type: Type.INTEGER },
          author: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } },
          translator: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } },
          city: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    const dataSummary = entries.slice(0, 50).map(e => `- ${e.title} (${e.publicationYear}): ${e.author.name} translated by ${e.translator.name}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this translation corpus and provide 3 deep academic observations for a translation studies scholar:\n\n${dataSummary}`,
        config: {
            systemInstruction: "You are a senior professor in translation history. Be academic, concise, and professional."
        }
    });
    return response.text || "";
}

export const suggestNetworkLayout = async (nodeCount: number, edgeCount: number, density: number): Promise<{ layout: LayoutType, reason: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Nodes: ${nodeCount}, Edges: ${edgeCount}. Density: ${density}.`,
    config: {
      systemInstruction: "Recommend a network layout strategy.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          layout: { type: Type.STRING, enum: ['force', 'circular', 'concentric', 'grid'] },
          reason: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const interpretNetworkMetrics = async (metrics: AdvancedGraphMetrics): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Metrics: ${JSON.stringify(metrics)}`,
    config: {
      systemInstruction: "Explain these network metrics for a social science researcher."
    }
  });
  return response.text || "";
};