import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  NON_BINARY = 'Non-Binary',
  UNKNOWN = 'Unknown'
}

export type LayoutType = 'force' | 'circular' | 'concentric' | 'grid';

export interface Person {
  name: string;
  gender: Gender;
  birthYear?: number;
  deathYear?: number;
  nationality?: string;
  affiliation?: string;
}

export interface ResearchBlueprint {
  projectScope: string;
  suggestedSchema: {
    fieldName: string;
    description: string;
    analyticalUtility: string; // Why this field is needed for data analysis
    importance: 'Critical' | 'Optional';
  }[];
  dataCleaningStrategy: string; // How to ensure consistency for this specific project
}

export interface AnalysisReport {
  id: string;
  timestamp: string;
  title: string;
  content: string;
}

export interface BibEntry {
  id: string;
  title: string;
  originalTitle?: string;
  publicationYear: number;
  originalPublicationYear?: number;
  author: Person;
  translator: Person;
  publisher: string;
  originalCity?: string;
  city?: string;
  sourceLanguage: string;
  targetLanguage: string;
  tags: string[];
  journalName?: string;
  volumeIssue?: string;
  archivalSource?: string;
  customMetadata?: Record<string, string>;
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  group: 'author' | 'translator' | 'publisher' | 'journal';
  name: string;
  val: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  inDegree?: number;
  outDegree?: number;
  pageRank?: number;
  betweenness?: number;
  community?: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  weight?: number;
}

export interface AdvancedGraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  diameterEstimate: number;
  clusteringCoefficient: number;
  communityCount?: number;
  topPageRank: GraphNode[];
  topBetweenness: GraphNode[];
  mostProductiveTranslators: GraphNode[];
  mostTranslatedAuthors: GraphNode[];
}

export type ViewMode = 'list' | 'stats' | 'network' | 'map' | 'blueprint' | 'reports';