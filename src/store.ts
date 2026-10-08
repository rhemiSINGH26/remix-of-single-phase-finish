import { create } from "zustand";
import { INITIAL_CAMERAS } from "@/lib/api";
import type { CameraFeed, LearnedLocation, SearchResultItem, SortMode, TimeRange, ViewName } from "@/types/sentinel";

interface SentinelState {
  view: ViewName;
  query: string;
  cameras: CameraFeed[];
  results: SearchResultItem[];
  bookmarks: string[];
  falsePositives: string[];
  learnedLocations: LearnedLocation[];
  recentQueries: string[];
  selectedCameraIds: string[];
  activeObjectClasses: string[];
  timeRange: TimeRange;
  minConfidence: number;
  sortMode: SortMode;
  tracedTrackId: string;
  layout: "2x2" | "3x3" | "focus";
  bootComplete: boolean;
  backendUrl: string;
  cpuFallback: boolean;
  topK: number;
  telemetryCollapsed: boolean;
  hydrated: boolean;
  set: (patch: Partial<SentinelState>) => void;
  hydrate: () => void;
  saveLearnedLocation: (location: LearnedLocation) => void;
  saveRecent: (query: string) => void;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`sentinel:${key}`);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown) {
  try { window.localStorage.setItem(`sentinel:${key}`, JSON.stringify(value)); } catch { /* Storage may be restricted. */ }
}

export const useSentinel = create<SentinelState>()((set, get) => ({
  view: "search",
  query: "Red car at main gate",
  cameras: INITIAL_CAMERAS,
  results: [],
  bookmarks: [],
  falsePositives: [],
  learnedLocations: [],
  recentQueries: [],
  selectedCameraIds: [],
  activeObjectClasses: ["Car", "Person", "Truck", "Bicycle"],
  timeRange: "1h",
  minConfidence: 60,
  sortMode: "rerank",
  tracedTrackId: "TRK-8831",
  layout: "2x2",
  bootComplete: false,
  backendUrl: "http://localhost:8000",
  cpuFallback: false,
  topK: 10,
  telemetryCollapsed: false,
  hydrated: false,
  set: (patch) => set(patch),
  hydrate: () => {
    if (typeof window === "undefined" || get().hydrated) return;
    const learnedLocations = read<LearnedLocation[]>("learned-locations", []);
    const bookmarkedIds = read<string[]>("bookmarks", []);
    const falsePositives = read<string[]>("false-positives", []);
    const recentQueries = read<string[]>("recent-queries", []);
    const savedCameras = read<CameraFeed[]>("cameras", INITIAL_CAMERAS);
    const { set } = get();
    set({ learnedLocations, bookmarks: bookmarkedIds, falsePositives, recentQueries, cameras: savedCameras.length ? savedCameras : INITIAL_CAMERAS, backendUrl: read("backend-url", "http://localhost:8000"), cpuFallback: read("cpu-fallback", false), topK: read("top-k", 10), hydrated: true });
  },
  saveLearnedLocation: (location) => {
    const learnedLocations = [...get().learnedLocations.filter((existing) => existing.term.toLowerCase() !== location.term.toLowerCase()), location];
    persist("learned-locations", learnedLocations);
    set({ learnedLocations });
  },
  saveRecent: (query) => {
    const recentQueries = [query, ...get().recentQueries.filter((existing) => existing !== query)].slice(0, 7);
    persist("recent-queries", recentQueries);
    set({ recentQueries });
  },
}));

export function persistCameraList(cameras: CameraFeed[]) { persist("cameras", cameras); }
export function persistCameraSetting(key: "backend-url" | "cpu-fallback" | "top-k", value: unknown) { persist(key, value); }
export function persistResultFlags(bookmarks: string[], flags: string[]) { persist("bookmarks", bookmarks); persist("false-positives", flags); }