
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, Project } from "../types.ts";

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'category';
  description: string;
  scholarlyPurpose: string;
  isGisRelated: boolean;
  sampleValue: string;
}

export interface ArchitectOutput {
  projectName: string;
  schema: SchemaField[];
  dataEntryProtocol: string;
  cleaningRules: string[];
}

export const architectDatabaseSchema = async (description: string): Promise<ArchitectOutput> => {
  const ai = getAI();
  if (!ai) throw new Error("API Key required");

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Acting as a Digital Humanities Database Architect, design a precise bibliographic data schema for this research project: "${description}". Focus on Translation Studies specificities.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectName: { type: Type.STRING },
          schema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                scholarlyPurpose: { type: Type.STRING },
                isGisRelated: { type: Type.BOOLEAN },
                sampleValue: { type: Type.STRING }
              },
              required: ['name', 'type', 'description', 'scholarlyPurpose', 'isGisRelated', 'sampleValue']
            }
          },
          dataEntryProtocol: { type: Type.STRING },
          cleaningRules: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['projectName', 'schema', 'dataEntryProtocol', 'cleaningRules']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  const ai = getAI();
  if (!ai || !locationName) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the precise WGS84 Geographic Coordinates (Longitude and Latitude) for the following location: "${locationName}".`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { lng: { type: Type.NUMBER }, lat: { type: Type.NUMBER } },
          required: ["lng", "lat"]
        }
      }
    });
    const result = JSON.parse(response.text || "null");
    return result && typeof result.lng === 'number' ? [result.lng, result.lat] : null;
  } catch (e) { return null; }
};

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  if (!ai) return { projectScope: prompt } as any; 
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `As a Professor of Translation Studies, develop a structured TAD research blueprint for: "${prompt}".`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectScope: { type: Type.STRING },
          dimensions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { dimension: { type: Type.STRING }, coreQuestion: { type: Type.STRING }, dataSources: { type: Type.ARRAY, items: { type: Type.STRING } }, dhMethods: { type: Type.ARRAY, items: { type: Type.STRING } }, relevance: { type: Type.NUMBER } }, required: ['dimension', 'coreQuestion', 'dataSources', 'dhMethods', 'relevance'] } },
          suggestedSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { fieldName: { type: Type.STRING }, description: { type: Type.STRING }, analyticalUtility: { type: Type.STRING }, importance: { type: Type.STRING } }, required: ['fieldName', 'description', 'analyticalUtility', 'importance'] } },
          dataCleaningStrategy: { type: Type.STRING },
          storageAdvice: { type: Type.STRING },
          methodology: { type: Type.STRING },
          visualizationStrategy: { type: Type.STRING },
          collectionTips: { type: Type.STRING }
        },
        required: ['projectScope', 'dimensions', 'suggestedSchema', 'dataCleaningStrategy', 'storageAdvice', 'methodology', 'visualizationStrategy', 'collectionTips']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    if (!ai) return "Static synthesis.";
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Insight for: ${JSON.stringify(entries.slice(0, 10))}`,
    });
    return response.text || "";
}

export const extractMetadataFromEntries = async (entries: {id: string, text: string}[]): Promise<Record<string, {city?: string, originalCity?: string}>> => {
  const ai = getAI();
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract cities for IDs: ${JSON.stringify(entries)}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
}

// Generates a structured tutorial script for a specific research project.
export const generateTutorialScript = async (project: Project): Promise<{ title: string; content: string }[]> => {
  const ai = getAI();
  if (!ai) return [];
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a 3-part pedagogical tutorial script for the research project "${project.name}". 
    The project contains these entries: ${JSON.stringify(project.entries.slice(0, 10))}. 
    Focus on explaining the significance of the data and how to use the lab.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["title", "content"],
        },
      },
    },
  });
  return JSON.parse(response.text || "[]");
};

// Converts text to spoken audio buffer using Gemini TTS.
export const speakTutorialPart = async (text: string): Promise<AudioBuffer | null> => {
  const ai = getAI();
  if (!ai) return null;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return null;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  return await decodeAudioData(
    decodeBase64(base64Audio),
    audioContext,
    24000,
    1
  );
};

// Generates an atmospheric background video for the tutorial using Veo.
export const generateAtmosphericVideo = async (prompt: string): Promise<string | null> => {
  // Check for API key selection for Veo models as per guidelines
  if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      if (typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
      }
    }
  }

  // Create new instance right before making the API call as per Veo guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return null;
    
    // Append the API key when fetching from the download link as required by the API
    return `${downloadLink}&key=${process.env.API_KEY}`;
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found.")) {
      if (typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
      }
    }
    console.error("Video generation failed:", error);
    return null;
  }
};
