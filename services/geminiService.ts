
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, AdvancedGraphMetrics, LayoutType } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Audio decoding helper
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

export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  if (!locationName) return null;
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the latitude and longitude for: "${locationName}". Output as JSON [lon, lat].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          minItems: 2,
          maxItems: 2
        }
      }
    });
    return JSON.parse(response.text || "null");
  } catch (e) {
    return null;
  }
};

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  const systemInstruction = `你是一位世界级的数字人文专家，专精于翻译史研究。
  你的任务是根据用户的研究课题，设计一套完整的科研工作流方案。
  请使用中文回复。`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `研究课题: "${prompt}"。请提供深度科研蓝图。`,
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
          dataCleaningStrategy: { type: Type.STRING },
          storageAdvice: { type: Type.STRING },
          methodology: { type: Type.STRING },
          visualizationStrategy: { type: Type.STRING },
          collectionTips: { type: Type.STRING }
        },
        required: ['projectScope', 'suggestedSchema', 'dataCleaningStrategy', 'storageAdvice', 'methodology', 'visualizationStrategy', 'collectionTips']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const generateTutorialScript = async (project: any): Promise<{ title: string, content: string }[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `针对以下翻译研究项目生成一段4个章节的教程脚本。
        项目名: ${project.name}。
        第一章：欢迎与蓝图定义。
        第二章：著录数据管理。
        第三章：社会网络分析 (SNA) 实验室。
        第四章：全球流转可视化。
        请用学术且亲切的口吻。`,
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
                    required: ["title", "content"]
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const speakTutorialPart = async (text: string, voice: string = 'Zephyr'): Promise<AudioBuffer | null> => {
    const ai = getAI();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `用稳重且富有洞察力的声音朗读: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        return await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
    } catch (e) {
        console.error("TTS generation failed", e);
        return null;
    }
};

export const generateAtmosphericVideo = async (prompt: string): Promise<string | null> => {
    const ai = getAI();
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
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        return downloadLink ? `${downloadLink}&key=${process.env.API_KEY}` : null;
    } catch (e) {
        console.error("Video generation failed", e);
        return null;
    }
};

export const parseBibliographicData = async (rawText: string): Promise<Partial<BibEntry>> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract data: "${rawText}"`,
    config: {
      systemInstruction: "Extract bibliographic metadata from messy academic notes. Output JSON.",
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text || "{}");
};

export const suggestNetworkConfig = async (metrics: AdvancedGraphMetrics, blueprint: ResearchBlueprint | null): Promise<any> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Suggest visualization settings in JSON for: ${JSON.stringify(metrics)}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};

export const interpretNetworkMetrics = async (metrics: AdvancedGraphMetrics): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Interpret results for a scholar: ${JSON.stringify(metrics)}`,
  });
  return response.text || "";
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    const dataSummary = entries.slice(0, 30).map(e => `- ${e.title}`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze these translation records:\n\n${dataSummary}`,
    });
    return response.text || "";
}
