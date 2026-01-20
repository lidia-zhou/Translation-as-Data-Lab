
import { BibEntry, Gender } from "./types";

export const SAMPLE_TUTORIAL_SCRIPT = [
    {
        title: "Welcome to the Portuguese-Chinese Translation Lab",
        content: "This sample set is based on actual archival records, documenting the flow of Portuguese literature into the Chinese market since 2000. This is more than a list; it is a map of cross-cultural power."
    },
    {
        title: "Mediator Networks: Collaborative Action",
        content: "In the 'Network' view, observe how core translators like Fan Weixin or Yao Jingming circulate across multiple publishing nodes. They are not just linguistic conduits, but holders of cultural capital."
    },
    {
        title: "Spatial Shifts: Publishing Frontiers",
        content: "Open 'GIS Lab' and toggle 'Focus Mode'. You will notice that between 2014-2016, Guangxi emerged as an unexpected node for the introduction of juvenile and popular literature."
    }
];

/** 
 * COMPREHENSIVE LOCAL GIS CACHE 
 * Covers major global hubs and an exhaustive list of Chinese provinces/cities.
 * Supports both English and common Chinese names for robust offline matching.
 * Keys are strictly lowercase for normalized lookup.
 */
export const COORDS: Record<string, [number, number]> = {
    // Global Hubs
    "lisbon": [-9.1393, 38.7223], "porto": [-8.6291, 41.1579], "coimbra": [-8.4116, 40.2033],
    "london": [-0.1276, 51.5074], "paris": [2.3522, 48.8566], "tokyo": [139.6503, 35.6762],
    
    // Greater China - Special Administrative Regions & Taiwan
    "macau": [113.5439, 22.1987], "macao": [113.5439, 22.1987], "澳门": [113.5439, 22.1987],
    "hong kong": [114.1733, 22.3193], "hongkong": [114.1733, 22.3193], "香港": [114.1733, 22.3193],
    "taipei": [121.5654, 25.0330], "taiwan": [121.5654, 25.0330], "台北": [121.5654, 25.0330], "台湾": [121.5654, 25.0330],

    // Chinese Provinces & Capitals
    "beijing": [116.4074, 39.9042], "北京": [116.4074, 39.9042],
    "shanghai": [121.4737, 31.2304], "上海": [121.4737, 31.2304],
    "tianjin": [117.2008, 39.1257], "天津": [117.2008, 39.1257],
    "chongqing": [106.5507, 29.5630], "重庆": [106.5507, 29.5630],
    "hebei": [114.5025, 38.0455], "河北": [114.5025, 38.0455], "shijiazhuang": [114.5025, 38.0455], "石家庄": [114.5025, 38.0455],
    "shanxi": [112.5492, 37.8570], "山西": [112.5492, 37.8570], "taiyuan": [112.5492, 37.8570], "太原": [112.5492, 37.8570],
    "内蒙古": [111.6708, 40.8183], "hohhot": [111.6708, 40.8183], "呼和浩特": [111.6708, 40.8183],
    "liaoning": [123.4290, 41.7967], "辽宁": [123.4290, 41.7967], "shenyang": [123.4290, 41.7967], "沈阳": [123.4290, 41.7967],
    "jilin": [125.3245, 43.8868], "吉林": [125.3245, 43.8868], "changchun": [125.3245, 43.8868], "长春": [125.3245, 43.8868],
    "heilongjiang": [126.6424, 45.7569], "黑龙江": [126.6424, 45.7569], "harbin": [126.6424, 45.7569], "哈尔滨": [126.6424, 45.7569],
    "jiangsu": [118.7969, 32.0603], "江苏": [118.7969, 32.0603], "nanjing": [118.7969, 32.0603], "南京": [118.7969, 32.0603],
    "zhejiang": [120.1535, 30.2874], "浙江": [120.1535, 30.2874], "hangzhou": [120.1535, 30.2874], "杭州": [120.1535, 30.2874],
    "anhui": [117.2830, 31.8611], "安徽": [117.2830, 31.8611], "hefei": [117.2830, 31.8611], "合肥": [117.2830, 31.8611],
    "fujian": [119.2965, 26.0745], "福建": [119.2965, 26.0745], "fuzhou": [119.2965, 26.0745], "福州": [119.2965, 26.0745],
    "jiangxi": [115.8921, 28.6764], "江西": [115.8921, 28.6764], "nanchang": [115.8921, 28.6764], "南昌": [115.8921, 28.6764],
    "shandong": [117.0009, 36.6758], "山东": [117.0009, 36.6758], "jinan": [117.0009, 36.6758], "济南": [117.0009, 36.6758],
    "henan": [113.6654, 34.7579], "河南": [113.6654, 34.7579], "zhengzhou": [113.6654, 34.7579], "郑州": [113.6654, 34.7579],
    "hubei": [114.3054, 30.5931], "湖北": [114.3054, 30.5931], "wuhan": [114.3054, 30.5931], "武汉": [114.3054, 30.5931],
    "hunan": [112.9388, 28.2280], "湖南": [112.9388, 28.2280], "changsha": [112.9388, 28.2280], "长沙": [112.9388, 28.2280],
    "guangdong": [113.2644, 23.1291], "广东": [113.2644, 23.1291], "guangzhou": [113.2644, 23.1291], "广州": [113.2644, 23.1291], "shenzhen": [114.0579, 22.5431], "深圳": [114.0579, 22.5431],
    "guangxi": [108.3200, 22.8240], "广西": [108.3200, 22.8240], "nanning": [108.3200, 22.8240], "南宁": [108.3200, 22.8240],
    "hainan": [110.3312, 20.0319], "海南": [110.3312, 20.0319], "haikou": [110.3312, 20.0319], "海口": [110.3312, 20.0319],
    "sichuan": [104.0665, 30.5723], "四川": [104.0665, 30.5723], "chengdu": [104.0665, 30.5723], "成都": [104.0665, 30.5723],
    "guizhou": [106.7139, 26.5783], "贵州": [106.7139, 26.5783], "guiyang": [106.7139, 26.5783], "贵阳": [106.7139, 26.5783],
    "yunnan": [102.7123, 25.0406], "云南": [102.7123, 25.0406], "kunming": [102.7123, 25.0406], "昆明": [102.7123, 25.0406],
    "西藏": [91.1322, 29.6603], "lhasa": [91.1322, 29.6603], "拉萨": [91.1322, 29.6603],
    "shaanxi": [108.9401, 34.3415], "陕西": [108.9401, 34.3415], "xian": [108.9401, 34.3415], "西安": [108.9401, 34.3415],
    "gansu": [103.8373, 36.0611], "甘肃": [103.8373, 36.0611], "lanzhou": [103.8373, 36.0611], "兰州": [103.8373, 36.0611],
    "qinghai": [101.7789, 36.6231], "青海": [101.7789, 36.6231], "xining": [101.7789, 36.6231], "西宁": [101.7789, 36.6231],
    "ningxia": [106.2781, 38.4663], "宁夏": [106.2781, 38.4663], "yinchuan": [106.2781, 38.4663], "银川": [106.2781, 38.4663],
    "xinjiang": [87.6177, 43.7928], "新疆": [87.6177, 43.7928], "urumqi": [87.6177, 43.7928], "乌鲁木齐": [87.6177, 43.7928]
};

export const SAMPLE_ENTRIES: BibEntry[] = [
    { id: "row-1", title: "A Capital (大都)", publicationYear: 2000, author: { name: "Eça de Queirós", gender: Gender.MALE }, translator: { name: "Chen Yongyi", gender: Gender.MALE }, publisher: "Hainan Publishing House", city: "Haikou", provinceState: "Hainan", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["haikou"] } },
    { id: "row-2", title: "Barranco de Cegos (盲人之谷)", publicationYear: 2000, author: { name: "António Alves Redol", gender: Gender.MALE }, translator: { name: "Sun Chengao", gender: Gender.MALE }, publisher: "Hainan Publishing House", city: "Haikou", provinceState: "Hainan", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["haikou"] } },
    { id: "row-3", title: "Fronteira e outros Contos", publicationYear: 2000, author: { name: "Miguel Torga", gender: Gender.MALE }, translator: { name: "Fan Weixin, Wei Ling", gender: Gender.MALE }, publisher: "Hainan Publishing House", city: "Haikou", provinceState: "Hainan", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["coimbra"], "targetCoord": COORDS["haikou"] } },
    { id: "row-4", title: "Amor de Perdição (败德之爱)", publicationYear: 2001, author: { name: "Camilo Castelo Branco", gender: Gender.MALE }, translator: { name: "Wang Suoying", gender: Gender.FEMALE }, publisher: "Hainan Publishing House", city: "Haikou", provinceState: "Hainan", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["porto"], "targetCoord": COORDS["haikou"] } },
    { id: "row-5", title: "os Maias (玛雅一家)", publicationYear: 2001, author: { name: "Eça de Queirós", gender: Gender.MALE }, translator: { name: "Zhang Baosheng, Ren Jisheng", gender: Gender.MALE }, publisher: "People's Literature Publishing House", city: "Beijing", provinceState: "Beijing", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["beijing"] } },
    { id: "row-6", title: "Pequeno Caderno do oriente", publicationYear: 2002, author: { name: "Eugénio de Andrade", gender: Gender.MALE }, translator: { name: "Yao Jingming", gender: Gender.MALE }, publisher: "Instituto Cultural de Macau", city: "Macau", provinceState: "Macau", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["macau"] } },
    { id: "row-7", title: "Ensaio sobre a Cegueira (失明症漫记)", publicationYear: 2002, author: { name: "José Saramago", gender: Gender.MALE }, translator: { name: "Fan Weixin", gender: Gender.MALE }, publisher: "Hainan Publishing House", city: "Haikou", provinceState: "Hainan", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["haikou"] } },
    { id: "row-8", title: "Ensaio sobre a Cegueira", publicationYear: 2002, author: { name: "José Saramago", gender: Gender.MALE }, translator: { name: "Peng Lingxian", gender: Gender.MALE }, publisher: "Reading Times", city: "Taipei", provinceState: "Taiwan", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["taipei"] } },
    { id: "row-9", title: "Nam van - Contos de Macau", publicationYear: 2002, author: { name: "Henrique de senna Fernandes", gender: Gender.MALE }, translator: { name: "Li Changsen, Cui Weixiao", gender: Gender.MALE }, publisher: "Associação Promotora da Instrução dos Macaenses", city: "Macau", provinceState: "Macau", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["macau"] } },
    { id: "row-10", title: "A lua de Joana", publicationYear: 2003, author: { name: "Maria Gonzalez", gender: Gender.FEMALE }, translator: { name: "Wu Jun", gender: Gender.MALE }, publisher: "Zhonghua Book Company", city: "Beijing", provinceState: "Beijing", sourceLanguage: "Portuguese", targetLanguage: "Chinese", customMetadata: { "sourceCoord": COORDS["lisbon"], "targetCoord": COORDS["beijing"] } }
];
