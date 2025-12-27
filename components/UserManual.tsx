
import React from 'react';

interface UserManualProps {
  onClose: () => void;
}

const UserManual: React.FC<UserManualProps> = ({ onClose }) => {
  const sections = [
    {
      title: { en: "The Vision: Computational Translation Studies", zh: "研究愿景：计算翻译学实验室" },
      content: {
        en: "TransData bridges the gap between traditional archival research and computational analysis. It is designed to handle the 'messiness' of bibliographic data, transforming static lists into dynamic research environments where mediators, institutions, and texts become visible actors.",
        zh: "TransData 弥合了传统档案研究与计算分析之间的鸿沟。它专为处理“杂乱”的书目数据而设计，将静态列表转化为动态的研究环境，使中介者、机构和文本成为可见的行动主体。"
      }
    },
    {
      title: { en: "AI Architect: From Inquiry to Schema", zh: "AI 架构师：从翻译问题到数据建模" },
      content: {
        en: "The core service of TransData begins with the AI Architect. Instead of forcing your research into a rigid spreadsheet, you describe your research question (e.g., 'Retranslation of Joyce in East Asia'). The AI then generates:\n\n• Custom Data Schemas: Suggesting fields like 'Sponsorship', 'Paratextual Type', or 'Political Stance'.\n• Collection Protocols: Guidelines on what metadata to prioritize based on your theoretical lens (e.g., Sociology of Translation vs. Polysystem Theory).\n• Cleaning Strategies: Logic for normalizing heterogenous data (e.g., merging historical publisher names or handling multiple aliases).",
        zh: "TransData 的核心服务始于 AI 架构师。它不是将您的研究强加于僵化的表格，而是让您描述研究课题（如“乔伊斯在东亚的重译研究”）。AI 随后生成：\n\n• 定制化数据架构：建议诸如“赞助制度”、“副文本类型”或“政治立场”等字段。\n• 采集协议：根据您的理论视角（如翻译社会学与多元系统论对比）指导元数据采集优先级。\n• 清洗策略：处理异质数据的逻辑（如合并历史出版商名称或处理多个译名别称）。"
      }
    },
    {
      title: { en: "Data Curation & Refinement", zh: "数据整理与精准清洗" },
      content: {
        en: "Our platform provides an intelligent interface for data entry and batch refinement. It automatically extracts entities from raw academic notes and uses geocoding services to resolve historical place names into coordinates, enabling the bridge between archival text and spatial analysis.",
        zh: "我们的平台为数据输入和批量精炼提供了智能接口。它能从原始学术笔记中自动提取实体，并利用地理编码服务将历史地名解析为坐标，从而在档案文本与空间分析之间建立桥梁。"
      }
    },
    {
      title: { en: "Network Analysis: Mapping Mediators", zh: "网络分析：绘制中介者图谱" },
      content: {
        en: "Translation is a collective act. The Network Lab utilizes social network analysis (SNA) to identify 'Hubs' (prolific translators) and 'Gatekeepers' (influential publishers). Through Community Detection, users can identify cultural clusters and cliques that shaped the flow of ideas across borders.",
        zh: "翻译是一种集体行为。网络实验室利用社会网络分析 (SNA) 来识别“枢纽”（多产译者）和“守门人”（有影响力的出版商）。通过社区检测功能，用户可以识别出塑造跨国思想流动的文化集群和派系。"
      }
    },
    {
      title: { en: "Spatial Circulation & Analytics", zh: "全球流转与统计合成" },
      content: {
        en: "Visualize the 'worldliness' of a text. By mapping the movement from source cities to target markets, you can observe the geography of power and the peripheries of translation. Simultaneously, our analytics engine synthesizes production trends over time, providing quantitative evidence for qualitative hypotheses.",
        zh: "可视化文本的“世界性”。通过绘制从源语城市到目标市场的流动，您可以观察权力的地理分布和翻译的边缘地带。同时，我们的分析引擎会合成随时间变化的生产趋势，为定性假设提供定量证据。"
      }
    }
  ];

  return (
    <div className="fixed inset-0 bg-white/98 backdrop-blur-3xl z-[800] flex flex-col p-10 md:p-20 overflow-auto animate-fadeIn select-text">
      <div className="max-w-7xl w-full mx-auto space-y-16 pb-32">
        <div className="flex justify-between items-start border-b border-slate-100 pb-12">
          <div className="space-y-4">
             <div className="w-20 h-1.5 bg-slate-900 rounded-full mb-10"></div>
             <h1 className="text-7xl font-bold serif text-slate-900 tracking-tighter">User Handbook</h1>
             <p className="text-2xl text-slate-400 font-serif italic">Methodological Guide for TransData Lab / TransData 实验室方法论指南</p>
          </div>
          <button onClick={onClose} className="text-7xl font-light text-slate-200 hover:text-rose-500 transition-colors leading-none">&times;</button>
        </div>

        <div className="space-y-32">
          {sections.map((s, i) => (
            <div key={i} className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
              <div className="lg:col-span-5 space-y-8">
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">{i+1}</span>
                  <h2 className="text-4xl font-bold text-slate-800 serif">{s.title.en}</h2>
                </div>
                <p className="text-xl text-slate-600 leading-relaxed font-serif whitespace-pre-line">{s.content.en}</p>
              </div>
              <div className="lg:col-span-7 bg-slate-50/50 p-12 rounded-[3rem] border border-slate-100">
                <h2 className="text-3xl font-bold text-slate-800 serif mb-8">{s.title.zh}</h2>
                <p className="text-xl text-slate-500 leading-relaxed font-serif italic whitespace-pre-line">{s.content.zh}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-24 border-t border-slate-100 flex flex-col items-center space-y-8">
            <div className="text-center space-y-2">
                <p className="text-slate-400 font-serif italic text-lg">"Data is not found, it is made."</p>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">@Lidia Zhou Mengyuan 2026</p>
            </div>
            <button onClick={onClose} className="px-16 py-6 bg-slate-900 text-white rounded-[2rem] font-bold text-xs uppercase tracking-[0.4em] hover:bg-indigo-600 transition-all shadow-2xl hover:scale-105 active:scale-95">
                Start Research / 开始研究
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
