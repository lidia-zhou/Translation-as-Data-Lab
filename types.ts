
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  NON_BINARY = 'Non-Binary',
  UNKNOWN = 'Unknown'
}

export type LayoutType = 'forceAtlas2' | 'fruchterman' | 'circular';
export type NodeMetric = 'degree' | 'inDegree' | 'outDegree' | 'betweenness' | 'closeness' | 'eigenvector' | 'pageRank' | 'clustering' | 'modularity';
export type NodeSizeMetric = NodeMetric | 'uniform';
export type ColorMode = 'category' | 'community';

export interface NetworkConfig {
  selectedNodeAttrs: string[];
  isDirected: boolean;
  edgeWeightBy: 'frequency' | 'none';
  colorMode: ColorMode;
}

export interface ResearchBlueprint {
  projectScope: string;
  suggestedSchema: {
    fieldName: string;
    description: string;
    analyticalUtility: string;
    importance: 'Critical' | 'Optional';
  }[];
  dataCleaningStrategy: string;
  storageAdvice: string;
  methodology: string;
  visualizationStrategy: string;
  collectionTips: string;
}

export interface Project {
  id: string;
  name: string;
  lastModified: number;
  entries: BibEntry[];
  blueprint: ResearchBlueprint | null;
  customColumns: string[];
}

export interface Person {
  name: string;
  gender: Gender;
  nationality?: string;
  birthYear?: number;
  deathYear?: number;
}

export interface BibEntry {
  id: string;
  title: string;
  publicationYear: number;
  author: Person;
  translator: Person;
  publisher: string;
  city?: string;
  sourceLanguage: string;
  targetLanguage: string;
  customMetadata?: Record<string, any>;
  originalTitle?: string;
  originalPublicationYear?: number;
  originalCity?: string;
  tags?: string[];
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  group: string;
  name: string;
  val: number;
  degree: number;
  inDegree: number;
  outDegree: number;
  betweenness: number;
  closeness: number;
  eigenvector: number;
  pageRank: number;
  clustering: number;
  modularity: number;
  community: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  label?: string;
}

export interface AdvancedGraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  avgPathLength: number;
  diameter: number;
  avgClustering: number;
  modularityScore: number;
  topNodes: Record<string, { name: string, score: number, type: string }[]>;
  communities: { id: number, count: number, members: string[] }[];
}

export type ViewMode = 'list' | 'stats' | 'network' | 'blueprint' | 'map' | 'projects';
