export type ViewName = "search" | "matrix" | "ingestion" | "reid";
export type TimeRange = "15m" | "1h" | "24h" | "all";
export type SortMode = "rerank" | "confidence" | "newest";

export interface CameraFeed {
  camera_id: string;
  name: string;
  location_desc: string;
  video_url: string;
  crop_url: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  is_indexed: boolean;
  track_count: number;
  status: "online" | "indexing" | "degraded";
}

export interface SearchResultItem {
  track_db_id: string;
  camera_id: string;
  camera_name: string;
  video_url: string;
  crop_url: string;
  timestamp: number;
  object_class: string;
  dominant_color: string;
  confidence: number;
  semantic_score: number;
  rerank_score: number;
  explanation: string;
  description: string;
  current: boolean;
}

export interface LearnedLocation {
  term: string;
  camera_id: string;
  aliases: string[];
}

export interface ParsedQuery {
  object_class?: string;
  attributes: string[];
  location?: string;
  cameras: string[];
  time_range: TimeRange;
}

export interface SearchResponse {
  results: SearchResultItem[];
  clarification_needed: { term: string } | null;
  parsed_query: ParsedQuery;
  latency: number;
}

export interface CorrelatedTrack {
  track_id: string;
  camera_id: string;
  camera_name: string;
  timestamp: number;
  similarity: number;
  transition: string;
  crop_url: string;
}

export type IndexProgress = { progress: number; message: string; phase: string };