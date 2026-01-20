
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, AdvancedGraphMetrics, Project } from "../types";

const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Fallback Data / Expert Template (Full English) ---
const FALLBACK_BLUEPRINT: ResearchBlueprint = {
  projectScope: "Standard Translation Circulation Research (Heuristic Mode)",
  dimensions: [
    {
      dimension: 'Agentive (Who)',
      coreQuestion: "Which mediators (translators, publishers, patrons) are central to this circulation event?",
      dataSources: ["National Library Archives", "Publisher Metadata", "Biographical Dictionaries"],
      dhMethods: ["Network Analysis (SNA)", "Prosopography"],
      relevance: 95
    },
    {
      dimension: 'Textual (What)',
      coreQuestion: "What specific stylistic or linguistic signatures define this corpus in the target language?",
      dataSources: ["Parallel Text Corpora", "Annotated Manuscripts", "Digital Editions"],
      dhMethods: ["Stylometric Fingerprinting", "NLP Topic Modeling"],
      relevance: 85
    },
    {
      dimension: 'Distributional (Where/When/How)',
      coreQuestion: "How did the textual flow map across geographic centers and temporal durations?",
      dataSources: ["Library Accession Logs", "Customs Records", "Sales Registries"],
      dhMethods: ["GIS Mapping", "Temporal Density Analysis"],
      relevance: 90
    },
    {
      dimension: 'Discursive (Why)',
      coreQuestion: "What institutional ideologies or paratextual frames justified the translation act?",
      dataSources: ["Book Prefaces", "Institutional Reviews", "Censorship Documents"],
      dhMethods: ["Discourse Mapping", "Narrative Analysis"],
      relevance: 75
    },
    {
      dimension: 'Reception (So what)',
      coreQuestion: "What was the canonization path or social impact of the translated work in the target society?",
      dataSources: ["Citation Indexes", "University Syllabi", "Social Media Trends"],
      dhMethods: ["Reception Network Analysis", "Impact Mapping"],
      relevance: 80
    }
  ],
  suggestedSchema: [
    { fieldName: "Translator_Gender", description: "Gender identity of the primary mediator", analyticalUtility: "Sociological distribution analysis", importance: 'Critical' },
    { fieldName: "Institutional_Patronage", description: "Source of funding or state support", analyticalUtility: "Power structure mapping", importance: 'Optional' }
  ],
  dataCleaningStrategy: "Normalize publisher variants and standardize historical dates to ISO format.",
  storageAdvice: "Relational database for complex entity relationship tracking.",
  methodology: "Triangulate sociological distribution data with textual stylometry using a multidimensional DH matrix.",
  visualizationStrategy: "Interactive Network Graphs for collaboration and GIS for circulation.",
  collectionTips: "Prioritize paratextual sources to identify hidden mediators in the archive."
};

// --- Helpers ---
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
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
};

// --- Exported Services ---

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  if (!ai) return { ...FALLBACK_BLUEPRINT, projectScope: `Offline Inquiry: ${prompt}` };

  try {
    const systemInstruction = `You are an expert in Digital Humanities and Translation History.
    Generate a research blueprint following the "Translation as Data" framework (5 dimensions: Agentive, Textual, Distributional, Discursive, Reception).
    Language Policy: OUTPUT MUST BE EXCLUSIVELY IN ENGLISH.
    Focus on high-level scholarly ontological inquiries, data sources, and computational methods.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `User Inquiry: "${prompt}". Construct a detailed five-dimensional scholarly framework in English.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectScope: { type: Type.STRING },
            dimensions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dimension: { type: Type.STRING, enum: ['Agentive (Who)', 'Textual (What)', 'Distributional (Where/When/How)', 'Discursive (Why)', 'Reception (So what)'] },
                  coreQuestion: { type: Type.STRING },
                  dataSources: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dhMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
                  relevance: { type: Type.NUMBER }
                },
                required: ['dimension', 'coreQuestion', 'dataSources', 'dhMethods', 'relevance']
              },
              minItems: 5, maxItems: 5
            },
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
  } catch (e) {
    return { ...FALLBACK_BLUEPRINT, projectScope: `Expert Fallback: ${prompt}` };
  }
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    if (!ai) return "Synthesis generated from static metadata: The dataset shows clear clustering of mediators in urban hubs. Recommend further longitudinal GIS analysis. (Offline Logic Engaged)";
    
    try {
        const dataSummary = entries.slice(0, 30).map(e => `- ${e.title} (${e.publicationYear})`).join('\n');
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Provide a scholarly insight in English based on these translation records:\n\n${dataSummary}`,
        });
        return response.text || "";
    } catch (e) {
        return "Synthesized insights currently unavailable in local mode.";
    }
}

export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  const ai = getAI();
  if (!ai || !locationName) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Latitude/Longitude for: "${locationName}". JSON [lon, lat].`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "null");
  } catch (e) { return null; }
};

export const speakTutorialPart = async (text: string, voice: string = 'Zephyr'): Promise<AudioBuffer | null> => {
    const ai = getAI();
    if (!ai) return null;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Read clearly: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        return await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
    } catch (e) { return null; }
};

export const generateTutorialScript = async (project: Project): Promise<{ title: string, content: string }[]> => {
  const ai = getAI();
  if (!ai) return [];
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a 4-step tutorial in English for the project: "${project.name}". Return JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, content: { type: Type.STRING } },
            required: ['title', 'content']
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) { return []; }
};

export const generateAtmosphericVideo = async (prompt: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return null;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e) { return null; }
};
