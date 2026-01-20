
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, AdvancedGraphMetrics, Project } from "../types";

const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Fallback Data / 专家预设模板 (Tailored for Portuguese-Chinese Context) ---
const FALLBACK_BLUEPRINT: ResearchBlueprint = {
  projectScope: "Portuguese Literature in China: A Sociological Perspective",
  dimensions: [
    {
      dimension: 'Agentive (Who)',
      coreQuestion: "Who are the key 'patrons' and 'translators' (e.g. Fan Weixin, Gu Fu) shaping the Portuguese canon in China?",
      dataSources: ["Archives of Macao", "Chinese Publisher Catalogues", "Translator Biographies"],
      dhMethods: ["SNA (Network Clusters)", "Prosopographical Mapping"],
      relevance: 98
    },
    {
      dimension: 'Textual (What)',
      coreQuestion: "What genres dominate the translation flow (Poetry vs. Realist Novels)?",
      dataSources: ["National Library of China", "Parallel Text Corpora"],
      dhMethods: ["Genre Distribution Analysis", "Topic Modeling"],
      relevance: 80
    },
    {
      dimension: 'Distributional (Where/When/How)',
      coreQuestion: "How did the translation centers shift from regional hubs (Macao/Lanzhou) to cultural capitals (Beijing/Shanghai)?",
      dataSources: ["Publisher Location Data", "Publication Years"],
      dhMethods: ["GIS Spatial Analysis", "Spatiotemporal Heatmaps"],
      relevance: 95
    },
    {
      dimension: 'Discursive (Why)',
      coreQuestion: "How do paratexts (prefaces by Fan Weixin) construct the image of Saramago for Chinese readers?",
      dataSources: ["Book Prefaces", "Book Reviews", "Academic Critiques"],
      dhMethods: ["Sentiment Analysis", "Discourse Mapping"],
      relevance: 70
    },
    {
      dimension: 'Reception (So what)',
      coreQuestion: "Which authors achieve 'Canon' status in Chinese literary textbooks?",
      dataSources: ["Citation Indexes", "University Syllabi"],
      dhMethods: ["Impact Factor Mapping", "Reception Networks"],
      relevance: 85
    }
  ],
  suggestedSchema: [
    { fieldName: "Translator_Affiliation", description: "Institution of the translator", analyticalUtility: "Institutional influence mapping", importance: 'Critical' },
    { fieldName: "Funding_Source", description: "External funding (e.g., Camões Institute)", analyticalUtility: "Cultural diplomacy analysis", importance: 'Critical' }
  ],
  dataCleaningStrategy: "Normalize Portuguese names (e.g., 'Jose' to 'José') and unify Chinese publisher aliases.",
  storageAdvice: "Use relational database tags to link translators with specific literary movements.",
  methodology: "Triangulate GIS flow maps with SNA mediator graphs to identify translation bottlenecks.",
  visualizationStrategy: "GIS Lab for circulation; Network Graph for mediator collaboration; Stats for temporal production.",
  collectionTips: "Search for specific funding tags to identify the role of Macao as a cultural gateway."
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
  if (!ai) return { ...FALLBACK_BLUEPRINT, projectScope: `Template: ${prompt}` };

  try {
    const systemInstruction = `你是一位世界级的翻译史与数字人文（DH）专家。
    你的任务是根据用户的研究课题，严格基于 "Translation as Data" 理论框架进行蓝图规划。
    该框架包含五个维度：Agentive, Textual, Distributional, Discursive, Reception。
    请使用中文回复。`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `研究课题: "${prompt}"。请提供遵循 "Translation as Data" 五维框架的深度科研蓝图。`,
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
              minItems: 5,
              maxItems: 5
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
    console.warn("AI Architect failed, using template fallback.");
    return { ...FALLBACK_BLUEPRINT, projectScope: `Template: ${prompt}` };
  }
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    if (!ai) return "本报告基于静态数据分析：当前档案呈现出明显的译者聚集效应（如范维信、顾复）。建议重点关注这些核心枢纽节点在1990年代后期（萨拉马戈获诺奖前后）的出版跨度。 (Template Mode)";
    
    try {
        const dataSummary = entries.slice(0, 30).map(e => `- ${e.title}`).join('\n');
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze these translation records:\n\n${dataSummary}`,
        });
        return response.text || "";
    } catch (e) {
        return "数据分析模块目前处于本地模式，无法生成实时洞察。";
    }
}

// Geocode, Video, and TTS logic remains the same but with null checks
export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  const ai = getAI();
  if (!ai || !locationName) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the latitude and longitude for: "${locationName}". Output as JSON [lon, lat].`,
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
            contents: [{ parts: [{ text: `Read: ${text}` }] }],
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
      contents: `为研究项目 "${project.name}" 生成一个 4 步的学术导览脚本。这个项目是关于翻译史研究的。
      请包含标题和内容。回复为 JSON 数组。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ['title', 'content']
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to generate tutorial script", e);
    return [];
  }
};

export const generateAtmosphericVideo = async (prompt: string): Promise<string | null> => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const aistudio = (window as any).aistudio;
    if (!(await aistudio.hasSelectedApiKey())) {
      await aistudio.openSelectKey();
    }
  }
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
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e: any) {
    console.error("Video generation failed", e);
    return null;
  }
};
