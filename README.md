
# Translation as Data (TAD) Lab 
### 翻译即数据：专为翻译研究学者设计的计算建模与可视化实验室

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gemini API](https://img.shields.io/badge/AI-Gemini%203%20Pro-blueviolet)](https://ai.google.dev/)
[![D3.js](https://img.shields.io/badge/Visualization-D3.js-orange)](https://d3js.org/)

**[在线预览项目](https://translation-data-manager.vercel.app)**

</div>

---

## 📖 项目简介

**TAD Lab** 是一款专门为翻译史、翻译社会学及比较文学学者打造的集成式书目数据处理平台。它旨在弥合传统档案研究与计算分析之间的鸿沟，将琐碎的出版记录转化为动态的、可解释的学术证据。

本项目深度集成了 **Google Gemini 3 Pro/Flash** 模型，实现了从研究假设到数据库建模、从地理编码到复杂社会网络分析的全流程自动化。

## ✨ 核心功能

### 1. Network Lab (关系网络实验室)
针对翻译中介者（译者、作者、出版社）之间错综复杂的关系进行深度建模：
- **双布局引擎**：
    - **Fruchterman-Reingold (FR)**：模拟有机物理平衡，呈现高度均匀且结构对称的节点分布，适合观察整体网络形态。
    - **ForceAtlas2**：强化社区聚类效应，显著拉开不同学派与翻译圈子的空间距离。
- **智能标签系统**：
    - **标签防重叠 (Collision Detection)**：引入动态碰撞检测算法，确保在节点密集区域标签依然清晰、互不遮挡。
    - **可见性切换**：支持一键开关标签，适应从宏观拓扑到微观审视的视角切换。

### 2. AI Architect (AI 架构师)
- **从课题到架构**：只需输入研究方向（如“海德格尔在中国”），AI 即可自动生成定制化的数据字段（如：副文本类型、赞助制度、政治倾向等）。
- **自动化清洗**：基于大模型的语义理解，自动识别并规范化历史地名、多重笔名及异质的出版信息。

### 3. GIS Lab (地理空间矩阵)
- **空间流转可视化**：通过 Arc-Flow 模型追踪文本从“源语中心”到“目标语边缘”的流转路径。
- **动态地理编码**：自动将档案中的城市名转换为经纬度坐标，并支持本地字典与 AI 识别的双重校对。

### 4. Stats Dashboard (统计合成报告)
- **时序产出模型**：可视化翻译产量的历史波动与累积增长。
- **学术洞察生成**：一键生成基于当前语料库的学术综述初稿，识别 PageRank 中心性最高的关键译者。

---

## 🛠️ 技术栈

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Visualization**: D3.js (Force Simulation, Geo Projection), Recharts
- **Intelligence**: Google GenAI SDK (Gemini 3 Pro-Preview / 2.5 Flash)
- **Data Handling**: SheetJS (XLSX/CSV Processing)

---

## 🚀 快速开始

### 环境要求
- [Node.js](https://nodejs.org/) (建议 v18+)

### 安装与运行
1. **克隆仓库**:
   ```bash
   git clone https://github.com/your-username/tad-lab.git
   cd tad-lab
