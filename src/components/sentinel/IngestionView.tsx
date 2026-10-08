import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Cpu, HardDriveUpload, Link2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { streamIndexing, uploadCamera } from "@/lib/api";
import { persistCameraList, persistCameraSetting, useSentinel } from "@/store";
import type { CameraFeed } from "@/types/sentinel";
import { Chip, SectionLabel, StatusDot } from "./shared";

export default function IngestionView() {
  const cameras = useSentinel((state) => state.cameras);
  const backendUrl = useSentinel((state) => state.backendUrl);
  const cpuFallback = useSentinel((state) => state.cpuFallback);
  const topK = useSentinel((state) => state.topK);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [resolution, setResolution] = useState("1920x1080");
  const [fps, setFps] = useState("25");
  const [file, setFile] = useState<File | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; location?: string; file?: string }>({});
  const [pending, setPending] = useState<CameraFeed | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const appendLog = (line: string) => {
    setLog((lines) => [...lines.slice(-40), line]);
    requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Camera name is required";
    if (!location.trim()) next.location = "Location is required";
    if (!file) next.file = "Attach a video file or use the sample stream";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const register = async () => {
    if (!validate()) return;
    const cameraId = `CAM_${String(cameras.length + 1).padStart(2, "0")}`;
    const camera: CameraFeed = {
      camera_id: cameraId,
      name: name.trim(),
      location_desc: location.trim(),
      video_url: file?.type.startsWith("video") ? URL.createObjectURL(file) : cameras[0]!.video_url,
      crop_url: cameras[0]!.crop_url,
      width: Number(resolution.split("x")[0]) || 1920,
      height: Number(resolution.split("x")[1]) || 1080,
      fps: Number(fps) || 25,
      duration: 60,
      is_indexed: false,
      track_count: 0,
      status: "degraded",
    };
    await uploadCamera(camera);
    const nextCameras = [...cameras, camera];
    useSentinel.setState({ cameras: nextCameras });
    persistCameraList(nextCameras);
    setPending(camera);
    appendLog(`[00%] ${cameraId} registered · ${camera.width}×${camera.height} @ ${camera.fps}fps`);
    toast.success(`${cameraId} registered · ready to index`);
    setName("");
    setLocation("");
    setFile(null);
    setErrors({});
  };

  const startIndexing = async () => {
    if (!pending || running) return;
    setRunning(true);
    appendLog("[00%] Ingestion pipeline started");
    await streamIndexing(pending.camera_id, (event) => {
      setProgress(event.progress);
      setPhase(event.phase);
      appendLog(`[${String(event.progress).padStart(2, "0")}%] ${event.message}`);
    });
    const state = useSentinel.getState();
    const updated = state.cameras.map((camera) =>
      camera.camera_id === pending.camera_id ? { ...camera, is_indexed: true, status: "online" as const, track_count: 152 } : camera,
    );
    useSentinel.setState({ cameras: updated });
    persistCameraList(updated);
    setRunning(false);
    toast.success(`${pending.camera_id} indexed · 152 tracks committed`);
  };

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.44fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="glass-surface target-panel rounded-xl p-4">
          <SectionLabel>Register camera</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-telem-muted">Camera name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Loading Dock West" aria-label="Camera name" className="mt-1 border-white/15 bg-black/30" />
              {errors.name && <span className="mt-1 block text-[11px] text-rec">{errors.name}</span>}
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-telem-muted">Location</span>
              <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. South service area" aria-label="Camera location" className="mt-1 border-white/15 bg-black/30" />
              {errors.location && <span className="mt-1 block text-[11px] text-rec">{errors.location}</span>}
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-telem-muted">Resolution</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["1920x1080", "1280x720", "3840x2160"].map((option) => (
                  <Chip key={option} active={resolution === option} onClick={() => setResolution(option)}>
                    {option}
                  </Chip>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-telem-muted">Frame rate</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["15", "25", "30"].map((option) => (
                  <Chip key={option} active={fps === option} onClick={() => setFps(option)}>
                    {option} fps
                  </Chip>
                ))}
              </div>
            </label>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDropActive(false);
              setFile(event.dataTransfer.files?.[0] ?? null);
              setErrors(({ file: _dropped, ...rest }) => rest);
            }}
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-7 text-center transition-colors ${
              dropActive ? "border-cyan bg-cyan/10" : "border-white/15 bg-black/20 hover:border-cyan/50"
            }`}
          >
            <input
              type="file"
              accept="video/*,image/*"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors(({ file: _dropped, ...rest }) => rest);
              }}
            />
            <UploadCloud className={`h-6 w-6 ${dropActive ? "text-cyan" : "text-telem-muted"}`} />
            <span className="text-[13px] text-foreground">{file ? file.name : "Drop a video file or click to browse"}</span>
            <span className="font-mono text-[10px] text-telem-muted">sample stream is used if no file is attached</span>
          </label>
          {errors.file && <span className="mt-1 block text-[11px] text-rec">{errors.file}</span>}
          <Button onClick={() => void register()} className="mt-3 gap-2 bg-cyan/90 font-display font-semibold text-[#07131c] hover:bg-cyan">
            <HardDriveUpload className="h-4 w-4" /> Register camera
          </Button>
        </section>

        {pending && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-surface target-panel rounded-xl p-4">
            <SectionLabel aside={<span className="font-mono text-[10px] text-cyan">{pending.camera_id}</span>}>
              Indexing pipeline
            </SectionLabel>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-telem-muted">
              <span>{phase || "awaiting start"}</span>
              <span className="text-cyan">{progress}%</span>
            </div>
            {!running && progress === 0 && (
              <Button onClick={() => void startIndexing()} className="mt-3 gap-2" variant="secondary">
                Start indexing
              </Button>
            )}
            <div ref={logRef} className="glass-inset mt-3 max-h-44 overflow-y-auto rounded-md p-2.5 font-mono text-[11px] leading-relaxed text-teal/90">
              {log.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
            {progress === 100 && !running && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-teal">
                <CheckCircle2 className="h-3.5 w-3.5" /> Camera online · searchable across all views
              </p>
            )}
          </motion.section>
        )}

        <section className="glass-surface rounded-xl p-4">
          <SectionLabel>Registry</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {cameras.map((camera) => (
              <span key={camera.camera_id} className="glass-inset flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]">
                <StatusDot status={camera.status} />
                <span className="font-mono text-[11px] text-cyan">{camera.camera_id}</span>
                <span className="text-foreground">{camera.name}</span>
                <span className={`font-mono text-[9px] uppercase ${camera.is_indexed ? "text-teal" : "text-amber"}`}>
                  {camera.is_indexed ? "indexed" : "pending"}
                </span>
              </span>
            ))}
          </div>
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
        <section className="glass-surface target-panel rounded-xl p-4">
          <SectionLabel>Backend settings</SectionLabel>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-telem-muted">Backend URL</span>
              <div className="relative mt-1">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-telem-muted" />
                <Input
                  defaultValue={backendUrl}
                  onBlur={(event) => {
                    useSentinel.setState({ backendUrl: event.target.value });
                    persistCameraSetting("backend-url", event.target.value);
                  }}
                  aria-label="Backend URL"
                  className="border-white/15 bg-black/30 pl-8 font-mono text-[12px]"
                />
              </div>
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[12px] text-foreground">
                <Cpu className="h-3.5 w-3.5 text-amber" /> CPU fallback embeddings
              </span>
              <Switch
                checked={cpuFallback}
                onCheckedChange={(checked) => {
                  useSentinel.setState({ cpuFallback: checked });
                  persistCameraSetting("cpu-fallback", checked);
                  toast.info(checked ? "CPU fallback enabled · slower, still works" : "GPU pipeline restored");
                }}
                aria-label="CPU fallback embeddings"
              />
            </div>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-wider text-telem-muted">Top-k results</span>
              <Input
                type="number"
                min={1}
                max={50}
                defaultValue={topK}
                onBlur={(event) => {
                  const value = Math.max(1, Math.min(50, Number(event.target.value) || 10));
                  useSentinel.setState({ topK: value });
                  persistCameraSetting("top-k", value);
                }}
                aria-label="Top-k results"
                className="mt-1 border-white/15 bg-black/30 font-mono text-[12px]"
              />
            </label>
          </div>
        </section>
      </aside>
    </div>
  );
}
