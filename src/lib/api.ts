import type {
  CameraFeed,
  CorrelatedTrack,
  IndexProgress,
  LearnedLocation,
  ParsedQuery,
  SearchResponse,
  SearchResultItem,
  TimeRange,
} from "@/types/sentinel";
import gateCrop from "@/assets/cameras/main-gate.jpg";
import parkingCrop from "@/assets/cameras/parking-area.jpg";
import warehouseCrop from "@/assets/cameras/warehouse-entry.jpg";
import campusCrop from "@/assets/cameras/campus-road.jpg";

export const API_BASE_URL = "http://localhost:8000";
export const USE_MOCK = true;
const SAMPLE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";

export const INITIAL_CAMERAS: CameraFeed[] = [
  { camera_id: "CAM_01", name: "Main Gate", location_desc: "North entrance, barrier and perimeter road", video_url: SAMPLE_VIDEO, crop_url: gateCrop, width: 1920, height: 1080, fps: 25, duration: 75, is_indexed: true, track_count: 45, status: "online" },
  { camera_id: "CAM_02", name: "Parking Area", location_desc: "East lot, employee parking bays A–D", video_url: SAMPLE_VIDEO, crop_url: parkingCrop, width: 1920, height: 1080, fps: 25, duration: 68, is_indexed: true, track_count: 62, status: "online" },
  { camera_id: "CAM_03", name: "Warehouse Entry", location_desc: "South service access and loading area", video_url: SAMPLE_VIDEO, crop_url: warehouseCrop, width: 1920, height: 1080, fps: 25, duration: 82, is_indexed: true, track_count: 47, status: "online" },
  { camera_id: "CAM_04", name: "West Perimeter", location_desc: "West fence and campus access road", video_url: SAMPLE_VIDEO, crop_url: campusCrop, width: 1920, height: 1080, fps: 25, duration: 60, is_indexed: true, track_count: 38, status: "online" },
];

export const EXAMPLE_QUERIES = [
  "Red car at main gate",
  "Person in red shirt",
  "White car on Cam 2",
  "Bicycle",
  "Truck near loading dock",
];

const SEED_RESULTS: SearchResultItem[] = [
  { track_db_id: "TRK-8831", camera_id: "CAM_01", camera_name: "Main Gate", video_url: SAMPLE_VIDEO, crop_url: gateCrop, timestamp: 9.6, object_class: "Car", dominant_color: "Red", confidence: 94, semantic_score: 91, rerank_score: 97, explanation: "A red compact car crosses the north entrance barrier; its color and vehicle silhouette closely match the query.", description: "Red hatchback approaching the entry barrier", current: true },
  { track_db_id: "TRK-8814", camera_id: "CAM_02", camera_name: "Parking Area", video_url: SAMPLE_VIDEO, crop_url: parkingCrop, timestamp: 21.2, object_class: "Person", dominant_color: "Red", confidence: 88, semantic_score: 93, rerank_score: 92, explanation: "A person wearing a red jacket walks between parked vehicles. The garment color is the strongest visual match.", description: "Person in red jacket walking between rows", current: true },
  { track_db_id: "TRK-8792", camera_id: "CAM_03", camera_name: "Warehouse Entry", video_url: SAMPLE_VIDEO, crop_url: warehouseCrop, timestamp: 34.4, object_class: "Truck", dominant_color: "White", confidence: 86, semantic_score: 84, rerank_score: 86, explanation: "A white delivery truck is tracked at the south receiving entrance, beside the loading bays.", description: "White truck by receiving dock", current: true },
  { track_db_id: "TRK-8751", camera_id: "CAM_04", camera_name: "West Perimeter", video_url: SAMPLE_VIDEO, crop_url: campusCrop, timestamp: 48.1, object_class: "Bicycle", dominant_color: "Black", confidence: 78, semantic_score: 82, rerank_score: 79, explanation: "A bicycle is detected travelling along the perimeter access road toward the west entrance.", description: "Cyclist along the perimeter road", current: true },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseQuery(query: string, cameras: CameraFeed[], learned: LearnedLocation[]): ParsedQuery {
  const q = query.toLowerCase();
  const object_class = q.includes("bike") || q.includes("bicycle") ? "Bicycle" : q.includes("truck") ? "Truck" : q.includes("person") || q.includes("man") || q.includes("woman") ? "Person" : q.includes("car") || q.includes("vehicle") ? "Car" : undefined;
  const attributes = ["red", "white", "black", "blue", "silver", "gray", "grey"].filter((colour) => q.includes(colour));
  const explicitCam = q.match(/cam(?:era)?\s*[_-]?(\d{1,2})/i);
  let target = cameras.find((camera) => explicitCam && Number(camera.camera_id.slice(-2)) === Number(explicitCam[1]));
  let location: string | undefined;
  const orderedLocations = [...learned].sort((a, b) => [...b.term, ...b.aliases].join("").length - [...a.term, ...a.aliases].join("").length);
  for (const item of orderedLocations) {
    if ([item.term, ...item.aliases].some((alias) => alias && q.includes(alias.toLowerCase()))) {
      target = cameras.find((camera) => camera.camera_id === item.camera_id);
      location = item.term;
      break;
    }
  }
  if (!location && !target) {
    target = cameras.find((camera) => q.includes(camera.name.toLowerCase()));
    if (target) location = target.name;
  }
  if (!location) {
    if (q.includes("main gate") || q.includes("front gate")) { location = "Main Gate"; target = cameras.find((camera) => camera.camera_id === "CAM_01"); }
    else if (q.includes("parking")) { location = "Parking Area"; target = cameras.find((camera) => camera.camera_id === "CAM_02"); }
    else if (q.includes("warehouse") || q.includes("loading dock") || q.includes("loading bay")) location = "Loading Dock";
    else if (/\bgate\s*4\b/.test(q)) location = "Gate 4";
  }
  const time_range: TimeRange = q.includes("15 minute") || q.includes("15m") ? "15m" : q.includes("24 hour") || q.includes("24h") || q.includes("today") ? "24h" : q.includes("all time") ? "all" : "1h";
  return { object_class, attributes, location, cameras: target ? [target.camera_id] : [], time_range };
}

export async function search(query: string, top_k: number, cameras: CameraFeed[], learned: LearnedLocation[]): Promise<SearchResponse> {
  await sleep(310);
  const parsed_query = parseQuery(query, cameras, learned);
  const q = query.toLowerCase();
  const unknown = parsed_query.location && parsed_query.location !== "Main Gate" && parsed_query.location !== "Parking Area" && !cameras.some((camera) => camera.name === parsed_query.location) && !learned.some((item) => item.term === parsed_query.location) && (q.includes("loading dock") || q.includes("loading bay") || q.includes("gate 4"));
  let results = SEED_RESULTS.filter((item) => {
    const cameraMatch = !parsed_query.cameras.length || parsed_query.cameras.includes(item.camera_id);
    const classMatch = !parsed_query.object_class || parsed_query.object_class === item.object_class;
    const colourMatch = !parsed_query.attributes.length || parsed_query.attributes.some((colour) => item.dominant_color.toLowerCase().startsWith(colour));
    const generalSemanticMatch = !parsed_query.object_class && !parsed_query.attributes.length ? item.track_db_id !== "TRK-8814" : true;
    return cameraMatch && classMatch && colourMatch && generalSemanticMatch;
  });
  if (q.includes("white car")) results = [ { ...SEED_RESULTS[2]!, object_class: "Car", camera_id: "CAM_02", camera_name: "Parking Area", crop_url: parkingCrop, description: "White car in the employee parking area" }, ...results.slice(1) ];
  if (unknown) results = [];
  results = results.slice(0, Math.max(1, top_k));
  return { results, parsed_query, clarification_needed: unknown ? { term: parsed_query.location! } : null, latency: 0.38 };
}

export async function learnMemory(term: string, camera_id: string, aliases: string[]): Promise<{ success: boolean }> {
  await sleep(220);
  return { success: Boolean(term.trim() && camera_id && aliases.every((alias) => typeof alias === "string")) };
}

export async function getCameras(): Promise<CameraFeed[]> {
  await sleep(110);
  return [...INITIAL_CAMERAS];
}

export async function uploadCamera(camera: CameraFeed): Promise<{ status: "registered"; info: CameraFeed }> {
  await sleep(190);
  return { status: "registered", info: camera };
}

export async function streamIndexing(camera_id: string, onProgress: (event: IndexProgress) => void): Promise<void> {
  const phases = [
    { phase: "Frame sampling", start: 0, end: 60, samples: ["Sampling 1,840 frames across the camera stream…", "YOLO detection pass complete · 196 candidates", "Applying confidence threshold 0.62 · 152 detections retained"] },
    { phase: "Entity tracking", start: 60, end: 70, samples: ["ByteTrack association pass · 12 persistent entities", "Cross-frame identities resolved"] },
    { phase: "Feature embeddings", start: 70, end: 95, samples: ["OpenCLIP feature extraction · 512-dimensional vectors", "Visual embeddings queued for indexing", "FAISS nearest-neighbor index warmed"] },
    { phase: "Persistence", start: 95, end: 100, samples: [`Camera ${camera_id} metadata persisted`, "SQLite tracks and FAISS vectors committed", "Index ready · camera stream online"] },
  ];
  for (const phase of phases) {
    const chunks = phase.samples.length;
    for (let i = 0; i < chunks; i += 1) {
      await sleep(440);
      const progress = Math.round(phase.start + ((i + 1) / chunks) * (phase.end - phase.start));
      onProgress({ progress, message: phase.samples[i]!, phase: phase.phase });
    }
  }
}

export async function getReid(track_id: string): Promise<CorrelatedTrack[]> {
  await sleep(260);
  const result = SEED_RESULTS.find((item) => item.track_db_id === track_id) ?? SEED_RESULTS[0]!;
  return [
    { track_id: `${track_id}-A`, camera_id: "CAM_01", camera_name: "Main Gate", timestamp: 9.6, similarity: 94, transition: "North entrance", crop_url: gateCrop },
    { track_id: `${track_id}-B`, camera_id: "CAM_02", camera_name: "Parking Area", timestamp: 205.3, similarity: 89, transition: "East parking · 3m 16s", crop_url: parkingCrop },
    { track_id: `${track_id}-C`, camera_id: "CAM_03", camera_name: "Warehouse Entry", timestamp: 506.8, similarity: 86, transition: "South service road · 5m 02s", crop_url: warehouseCrop },
    { track_id: `${track_id}-D`, camera_id: "CAM_04", camera_name: "West Perimeter", timestamp: 748.1, similarity: 81, transition: "West perimeter · 4m 02s", crop_url: campusCrop },
    ...(result ? [{ track_id: `${track_id}-E`, camera_id: "CAM_02", camera_name: "Parking Area · upper", timestamp: 813.6, similarity: 76, transition: "Upper lot · 1m 05s", crop_url: parkingCrop }] : []),
  ];
}

export const DEMO_RESULTS = SEED_RESULTS;