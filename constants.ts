
import { BibEntry, Gender } from "./types";

export const SAMPLE_TUTORIAL_SCRIPT = [
    {
        title: "欢迎来到 Translatio 实验室",
        content: "您正在查看的是基于 DGLAB 官方资助名录的样本项目。这个平台专为翻译研究学者设计，旨在将枯燥的著录数据转化为生动的学术洞察。让我们开始探索吧。"
    },
    {
        title: "研究蓝图：定义您的视野",
        content: "在‘Blueprint’选项卡中，AI 会根据您的研究课题建议数据架构。例如本项目关注的是‘社会翻译学’路径，建议您重点采集资助机构与书籍流派，以分析权力与制度的中介作用。"
    },
    {
        title: "网络实验室：寻找枢纽节点",
        content: "进入‘Network Lab’。通过‘社区检测’功能，您可以发现译者、作者与出版社之间形成的非正式‘文化圈’。那些在中心位置的节点，往往就是决定翻译流动方向的关键中介。"
    },
    {
        title: "全球流转：可视化地理脉络",
        content: "最后，‘Global Map’将为您揭示文本在地理空间上的跨国迁徙。您可以直观地看到葡萄牙文学是如何从里斯本出发，流向伦敦、纽约乃至东京的出版市场。"
    }
];

export const SAMPLE_ENTRIES: BibEntry[] = [
    // --- Michael Kegler (德语区核心枢纽) ---
    {
        id: "dglab-mk1",
        title: "Eine Allgemeine Theorie des Vergessens",
        publicationYear: 2017,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Michael Kegler", gender: Gender.MALE },
        publisher: "C.H. Beck",
        originalCity: "Luanda",
        city: "Munich",
        sourceLanguage: "Portuguese",
        targetLanguage: "German",
        customMetadata: { "Genre": "Modernism", "Apoios": "DGLAB", "sourceCoord": [13.2345, -8.8390], "targetCoord": [11.5761, 48.1374] }
    },
    {
        id: "dglab-mk2",
        title: "Das Lachen der Geckos",
        publicationYear: 2008,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Michael Kegler", gender: Gender.MALE },
        publisher: "A1 Verlag",
        originalCity: "Luanda",
        city: "Munich",
        sourceLanguage: "Portuguese",
        targetLanguage: "German",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "n.d.", "sourceCoord": [13.2345, -8.8390], "targetCoord": [11.5761, 48.1374] }
    },
    {
        id: "dglab-mk3",
        title: "Die Frauen meines Vaters",
        publicationYear: 2010,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Michael Kegler", gender: Gender.MALE },
        publisher: "A1 Verlag",
        originalCity: "Luanda",
        city: "Munich",
        sourceLanguage: "Portuguese",
        targetLanguage: "German",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "DGLAB", "sourceCoord": [13.2345, -8.8390], "targetCoord": [11.5761, 48.1374] }
    },
    {
        id: "dglab-mk4",
        title: "Herr Valéry und die Logik",
        publicationYear: 2020,
        author: { name: "Gonçalo M. Tavares", gender: Gender.MALE },
        translator: { name: "Michael Kegler", gender: Gender.MALE },
        publisher: "Korrespondenzen",
        originalCity: "Lisbon",
        city: "Vienna",
        sourceLanguage: "Portuguese",
        targetLanguage: "German",
        customMetadata: { "Genre": "Literary Fiction", "Apoios": "DGLAB; Camões IP", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [16.3738, 48.2082] }
    },
    {
        id: "dglab-mk5",
        title: "Ein Dasein aus Paper",
        publicationYear: 2021,
        author: { name: "Al Berto", gender: Gender.MALE },
        translator: { name: "Michael Kegler", gender: Gender.MALE },
        publisher: "Elfenbein",
        originalCity: "Coimbra",
        city: "Berlin",
        sourceLanguage: "Portuguese",
        targetLanguage: "German",
        customMetadata: { "Genre": "Poetry", "Apoios": "DGLAB; Camões IP", "sourceCoord": [-8.4115, 40.2033], "targetCoord": [13.4050, 52.5200] }
    },

    // --- Daniel Hahn (英语区核心枢纽) ---
    {
        id: "dglab-dh1",
        title: "A General Theory of Oblivion",
        publicationYear: 2015,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Daniel Hahn", gender: Gender.MALE },
        publisher: "Archipelago",
        originalCity: "Luanda",
        city: "New York",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Modernism", "Apoios": "DGLAB", "sourceCoord": [13.2345, -8.8390], "targetCoord": [-74.006, 40.7128] }
    },
    {
        id: "dglab-dh2",
        title: "The Book of Chameleons",
        publicationYear: 2006,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Daniel Hahn", gender: Gender.MALE },
        publisher: "Arcadia",
        originalCity: "Luanda",
        city: "London",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "n.d.", "sourceCoord": [13.2345, -8.8390], "targetCoord": [-0.1278, 51.5074] }
    },
    {
        id: "dglab-dh3",
        title: "The Living and the Rest",
        publicationYear: 2025,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Daniel Hahn", gender: Gender.MALE },
        publisher: "Archipelago",
        originalCity: "Luanda",
        city: "New York",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "n.d.", "sourceCoord": [13.2345, -8.8390], "targetCoord": [-74.006, 40.7128] }
    },
    {
        id: "dglab-dh4",
        title: "Nowhere People",
        publicationYear: 2014,
        author: { name: "Paulo Scott", gender: Gender.MALE },
        translator: { name: "Daniel Hahn", gender: Gender.MALE },
        publisher: "And Other Stories",
        originalCity: "Porto Alegre",
        city: "London",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Social Fiction", "Apoios": "n.d.", "sourceCoord": [-51.2177, -30.0346], "targetCoord": [-0.1278, 51.5074] }
    },

    // --- Maho Kinoshita (日语区枢纽) ---
    {
        id: "dglab-mkj1",
        title: "Dopo la morte mi sono successe molte cose",
        publicationYear: 2023,
        author: { name: "Ricardo Adolfo", gender: Gender.MALE },
        translator: { name: "Maho Kinoshita", gender: Gender.FEMALE },
        publisher: "Shoshikankanbou",
        originalCity: "Lisbon",
        city: "Tokyo",
        sourceLanguage: "Portuguese",
        targetLanguage: "Japanese / 日本語",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "DGLAB; Camões IP", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [139.6503, 35.6762] }
    },
    {
        id: "dglab-mkj2",
        title: "O vendedor de passados (*)",
        publicationYear: 2023,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Maho Kinoshita", gender: Gender.FEMALE },
        publisher: "Khakasuisha",
        originalCity: "Luanda",
        city: "Tokyo",
        sourceLanguage: "Portuguese",
        targetLanguage: "Japanese / 日本語",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "DGLAB; Camões IP", "sourceCoord": [13.2345, -8.8390], "targetCoord": [139.6503, 35.6762] }
    },

    // --- Archipelago Books (纽约枢纽出版商) ---
    {
        id: "dglab-arc1",
        title: "My Father's Wives",
        publicationYear: 2008,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Daniel Hahn", gender: Gender.MALE },
        publisher: "Archipelago",
        originalCity: "Luanda",
        city: "New York",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "DGLAB", "sourceCoord": [13.2345, -8.8390], "targetCoord": [-74.006, 40.7128] }
    },
    {
        id: "dglab-arc2",
        title: "Rainy Season",
        publicationYear: 2009,
        author: { name: "José Eduardo Agualusa", gender: Gender.MALE },
        translator: { name: "Daniel Hahn", gender: Gender.MALE },
        publisher: "Archipelago",
        originalCity: "Luanda",
        city: "New York",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Contemporary Fiction", "Apoios": "n.d.", "sourceCoord": [13.2345, -8.8390], "targetCoord": [-74.006, 40.7128] }
    },

    // --- Saramago (诺贝尔奖全球流通) ---
    {
        id: "dglab-s1",
        title: "Blindness",
        publicationYear: 1997,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Giovanni Pontiero", gender: Gender.MALE },
        publisher: "Harvill Press",
        originalCity: "Lisbon",
        city: "London",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Philosophical Fiction", "Apoios": "DGLAB", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [-0.1278, 51.5074] }
    },
    {
        id: "dglab-s2",
        title: "The Year of the Death of Ricardo Reis",
        publicationYear: 1991,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Giovanni Pontiero", gender: Gender.MALE },
        publisher: "Harcourt Brace",
        originalCity: "Lisbon",
        city: "New York",
        sourceLanguage: "Portuguese",
        targetLanguage: "English",
        customMetadata: { "Genre": "Literary Fiction", "Apoios": "n.d.", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [-74.006, 40.7128] }
    },
    {
        id: "dglab-s3",
        title: "L'An de la mort de Ricardo Reis",
        publicationYear: 1988,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Claude Fages", gender: Gender.MALE },
        publisher: "Seuil",
        originalCity: "Lisbon",
        city: "Paris",
        sourceLanguage: "Portuguese",
        targetLanguage: "French",
        customMetadata: { "Genre": "Literary Fiction", "Apoios": "n.d.", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [2.3522, 48.8566] }
    },

    // --- 童书视觉网络 (Catarina Sobral & João Gomes de Abreu) ---
    {
        id: "dglab-b1",
        title: "A ilha (The Island)",
        publicationYear: 2014,
        author: { name: "João Gomes de Abreu", gender: Gender.MALE },
        translator: { name: "n.d.", gender: Gender.UNKNOWN },
        publisher: "Xiaduo (霞朵)",
        originalCity: "Lisbon",
        city: "Beijing",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese / 中文",
        customMetadata: { "Genre": "Infantojuvenil", "Apoios": "n.d.", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [116.4074, 39.9042] }
    },
    {
        id: "dglab-b2",
        title: "Wispa (A ilha)",
        publicationYear: 2018,
        author: { name: "João Gomes de Abreu", gender: Gender.MALE },
        translator: { name: "n.d.", gender: Gender.UNKNOWN },
        publisher: "Kinderkulka",
        originalCity: "Lisbon",
        city: "Warsaw",
        sourceLanguage: "Portuguese",
        targetLanguage: "Polish",
        customMetadata: { "Genre": "Infantojuvenil", "Apoios": "DGLAB", "sourceCoord": [-9.1393, 38.7223], "targetCoord": [21.0122, 52.2297] }
    },
    {
        id: "dglab-b3",
        title: "Achimpa",
        publicationYear: 2018,
        author: { name: "Catarina Sobral", gender: Gender.FEMALE },
        translator: { name: "Zhang Xiaofei", gender: Gender.FEMALE },
        publisher: "World Book Publishing",
        originalCity: "Coimbra",
        city: "Beijing",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese / 中文",
        customMetadata: { "Genre": "Infantojuvenil", "Apoios": "n.d.", "sourceCoord": [-8.4115, 40.2033], "targetCoord": [116.4074, 39.9042] }
    },
    {
        id: "dglab-b4",
        title: "Impossível",
        publicationYear: 2019,
        author: { name: "Catarina Sobral", gender: Gender.FEMALE },
        translator: { name: "Joana Cabral", gender: Gender.FEMALE },
        publisher: "Hélium",
        originalCity: "Coimbra",
        city: "Paris",
        sourceLanguage: "Portuguese",
        targetLanguage: "French",
        customMetadata: { "Genre": "Infantojuvenil", "Apoios": "DGLAB", "sourceCoord": [-8.4115, 40.2033], "targetCoord": [2.3522, 48.8566] }
    }
];
