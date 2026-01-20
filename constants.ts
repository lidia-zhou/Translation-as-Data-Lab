
import { BibEntry, Gender } from "./types";

export const SAMPLE_TUTORIAL_SCRIPT = [
    {
        title: "欢迎来到葡萄牙文学在华译介实验室",
        content: "本数据集来源于真实的学术著录，记录了从1955年至今葡萄牙语文学作品在中国（包括内地及港澳台地区）的翻译与流通情况。无需AI介入，您即可通过可视化探索其中的权力格局。"
    },
    {
        title: "GIS 空间分布：观察“译介热区”",
        content: "在‘GIS Lab’中，您会发现译介活动并非均匀分布。北京、上海和广州是核心。通过‘Focus Mode’，您可以观察到如兰州、海口等内陆或沿海节点在特定时期的突起。"
    },
    {
        title: "关系网络：识别“中介者”",
        content: "切换到‘Network’。观察 Fan Weixin (范维信) 或 Gu Fu (顾复) 等核心译者如何连接起萨拉马戈与不同的出版社，构成文学流转的社会网络。"
    }
];

// Coordinate Map for key Chinese locations found in the data
const COORDS: Record<string, [number, number]> = {
    "Shanghai": [121.4737, 31.2304],
    "Beijing": [116.4074, 39.9042],
    "Lanzhou": [103.8235, 36.0581],
    "Nanjing": [118.7969, 32.0603],
    "Macau": [113.5439, 22.1987],
    "Haikou": [110.3312, 20.0319],
    "Hangzhou": [120.1551, 30.2741],
    "Guangzhou": [113.2644, 23.1291],
    "Shijiazhuang": [114.5025, 38.0455],
    "Hong Kong": [114.1694, 22.3193],
    "Taipei": [121.5654, 25.0330],
    "Lisbon": [-9.1393, 38.7223] // Source
};

export const SAMPLE_ENTRIES: BibEntry[] = [
    {
        id: "pt-001",
        title: "Esreiros (泥沼)",
        publicationYear: 1955,
        author: { name: "Soeiro Pereira Gomes", gender: Gender.MALE },
        translator: { name: "Da Kai, Xiao Lin", gender: Gender.UNKNOWN },
        publisher: "Shanghai Literature and Art Publishing House",
        city: "Shanghai",
        provinceState: "Shanghai (上海)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Shanghai"] }
    },
    {
        id: "pt-002",
        title: "Amor de Perdição (败德之爱)",
        publicationYear: 1981,
        author: { name: "Camilo Castelo Branco", gender: Gender.MALE },
        translator: { name: "Gu Fu, Xue Chuandong", gender: Gender.MALE },
        publisher: "Gansu People's Publishing House",
        city: "Lanzhou",
        provinceState: "Gansu (甘肃)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Lanzhou"] }
    },
    {
        id: "pt-003",
        title: "O Crime do Padre Amaro (阿马罗神父的罪恶)",
        publicationYear: 1985,
        author: { name: "Eça de Queirós", gender: Gender.MALE },
        translator: { name: "Gu Fu, Xue Chuandong", gender: Gender.MALE },
        publisher: "Huashan Literature and Art Publishing House",
        city: "Shijiazhuang",
        provinceState: "Hebei (河北)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Shijiazhuang"] }
    },
    {
        id: "pt-004",
        title: "Antologia de Poesia (佩索阿诗选)",
        publicationYear: 1986,
        author: { name: "Fernando Pessoa", gender: Gender.MALE },
        translator: { name: "Jin Guoping, Xavier Gonçalo", gender: Gender.MALE },
        publisher: "Instituto Cultural de Macau",
        city: "Macau",
        provinceState: "Macau (澳门)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Macau"] }
    },
    {
        id: "pt-005",
        title: "Memorial do Convento (修道院纪事)",
        publicationYear: 1996,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Fan Weixin", gender: Gender.MALE },
        publisher: "Huashan Literature and Art Publishing House",
        city: "Shijiazhuang",
        provinceState: "Hebei (河北)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Shijiazhuang"] }
    },
    {
        id: "pt-006",
        title: "Ensaio sobre a Cegueira (失明症漫记)",
        publicationYear: 2014,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Fan Weixin", gender: Gender.MALE },
        publisher: "Nanhai Publishing Company",
        city: "Haikou",
        provinceState: "Hainan (海南)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Haikou"] }
    },
    {
        id: "pt-007",
        title: "A Caverna (洞穴)",
        publicationYear: 2018,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Huang Qian", gender: Gender.FEMALE },
        publisher: "Writers Publishing House",
        city: "Beijing",
        provinceState: "Beijing (北京)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Beijing"] }
    },
    {
        id: "pt-008",
        title: "Os Maias (玛雅一家)",
        publicationYear: 1998,
        author: { name: "Eça de Queirós", gender: Gender.MALE },
        translator: { name: "Zhang Baosheng, Ren Jisheng", gender: Gender.MALE },
        publisher: "Guangfu Publishing",
        city: "Taipei",
        provinceState: "Taiwan (台湾)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Taipei"] }
    },
    {
        id: "pt-009",
        title: "Livro do Desassossego (不安之书)",
        publicationYear: 2015,
        author: { name: "Fernando Pessoa", gender: Gender.MALE },
        translator: { name: "Han Shaoqing", gender: Gender.MALE },
        publisher: "Shanghai Literature and Art Publishing House",
        city: "Shanghai",
        provinceState: "Shanghai (上海)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Shanghai"] }
    },
    {
        id: "pt-010",
        title: "O Homem Duplicado (双生)",
        publicationYear: 2014,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Fan Weixin", gender: Gender.MALE },
        publisher: "Nanhai Publishing Company",
        city: "Haikou",
        provinceState: "Hainan (海南)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Haikou"] }
    },
    {
        id: "pt-011",
        title: "Mensagem (使命)",
        publicationYear: 1988,
        author: { name: "Fernando Pessoa", gender: Gender.MALE },
        translator: { name: "Lu Ping", gender: Gender.UNKNOWN },
        publisher: "Instituto Cultural de Macau",
        city: "Macau",
        provinceState: "Macau (澳门)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Macau"] }
    },
    {
        id: "pt-012",
        title: "A Relíquia (遗物)",
        publicationYear: 1996,
        author: { name: "Eça de Queirós", gender: Gender.MALE },
        translator: { name: "Zhou Hanjun", gender: Gender.UNKNOWN },
        publisher: "Instituto Cultural de Macau",
        city: "Macau",
        provinceState: "Macau (澳门)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Macau"] }
    },
    {
        id: "pt-013",
        title: "O Evangelho segundo Jesus Cristo",
        publicationYear: 2014,
        author: { name: "José Saramago", gender: Gender.MALE },
        translator: { name: "Fan Weixin", gender: Gender.MALE },
        publisher: "Nanhai Publishing Company",
        city: "Haikou",
        provinceState: "Hainan (海南)",
        sourceLanguage: "Portuguese",
        targetLanguage: "Chinese",
        customMetadata: { "sourceCoord": COORDS["Lisbon"], "targetCoord": COORDS["Haikou"] }
    }
];
