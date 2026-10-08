import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, GitBranch, MapPin } from "lucide-react";
import { getReid } from "@/lib/api";
import { DEMO_RESULTS, useSentinel } from "@/store";
import type { CorrelatedTrack } from "@/types/sentinel";
import { Chip, SectionLabel, StatBlock, formatStamp } from "./shared";

function similarityColor(value: number) {
  if (value >= 90) return "bg-teal";
  if (value >= 80) return "bg-cyan";
  return "bg-amber";
}

export default function ReidView() {
  const tracedTrackId = useSentinel((state) => state.tracedTrackId);
  const bookmarks = useSentinel((state) => state.bookmarks);
  const [chains, setChains] = useState<CorrelatedTrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getReid(tracedTrackId).then((data) => {
      if (!active) return;
      setChains(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tracedTrackId]);

  const source = useMemo(() => DEMO_RESULTS.find((item) => item.track_db_id === tracedTrackId) ?? DEMO_RESULTS[0]!, [tracedTrackId]);
  const average = chains.length ? Math.round(chains.reduce((sum, item) => sum + item.similarity, 0) / chains.length) : 0;
  const span = chains.length ? formatStamp(chains[chains.length - 1]!.timestamp) : "—";

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(280px,0.34fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="glass-surface target-panel rounded-xl p-4">
          <SectionLabel>Source track</SectionLabel>
          <div className="feed-sheen relative mt-3 aspect-video overflow-hidden rounded-md border border-white/10">
            <img src={source.crop_url} alt={source.description} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-cyan">
              {source.camera_id} · t+{source.timestamp.toFixed(1)}s
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[12px] font-semibold text-ice">{source.track_db_id}</div>
              <div className="text-[12px] text-muted-foreground">{source.description}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold text-cyan">{source.confidence}%</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-telem-muted">match</div>
            </div>
          </div>
        </section>

        <section className="glass-surface rounded-xl p-4">
          <SectionLabel>Query tracks</SectionLabel>
          <div className="mt-2 flex flex-col gap-1.5">
            {DEMO_RESULTS.map((item) => (
              <button
                key={item.track_db_id}
                type="button"
                onClick={() => useSentinel.setState({ tracedTrackId: item.track_db_id })}
                className={`flex items-center justify-between rounded-md border px-2.5 py-2 text-left transition-colors ${
                  item.track_db_id === tracedTrackId ? "border-cyan/60 bg-cyan/10" : "border-white/8 bg-white/[0.02] hover:border-cyan/40"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[11px] text-ice">{item.track_db_id}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{item.object_class} · {item.camera_name}</span>
                </span>
                {bookmarks.includes(item.track_db_id) && <span className="font-mono text-[9px] uppercase text-cyan">saved</span>}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <section className="glass-inset grid grid-cols-2 gap-2 rounded-lg p-3 sm:grid-cols-4">
          <StatBlock label="Sightings" value={chains.length} accent />
          <StatBlock label="Cameras" value={new Set(chains.map((item) => item.camera_id)).size} />
          <StatBlock label="Avg similarity" value={`${average}%`} accent />
          <StatBlock label="Time span" value={span} />
        </section>

        <section className="glass-surface target-panel rounded-xl p-4">
          <SectionLabel aside={<span className="font-mono text-[10px] text-telem-muted">timeline · first → last sighting</span>}>
            Cross-camera correlation
          </SectionLabel>
          <div className="mt-3 flex items-center gap-1">
            {chains.map((item, index) => (
              <div
                key={item.track_id}
                title={`${item.camera_name} · ${item.similarity}%`}
                className={`h-2.5 flex-1 rounded-sm ${similarityColor(item.similarity)} ${index === 0 ? "opacity-40" : ""}`}
                style={{ opacity: index === 0 ? 0.4 : 0.35 + (item.similarity / 100) * 0.65 }}
              />
            ))}
            {loading && <div className="shimmer h-2.5 flex-1 rounded-sm" />}
          </div>
          <ol className="relative mt-4 space-y-0">
            {chains.map((item, index) => (
              <motion.li
                key={item.track_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.07 }}
                className="relative flex gap-3 pb-4 pl-6 last:pb-0"
              >
                <span className="absolute left-[7px] top-1 h-full w-px bg-white/10 last:hidden" aria-hidden />
                <span className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--background)] ${similarityColor(item.similarity)}`} aria-hidden />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-ice">{item.camera_id}</span>
                      <span className="truncate text-[12px] text-foreground">{item.camera_name}</span>
                    </div>
                    <div className="font-mono text-[10px] text-telem-muted">
                      t+{formatStamp(item.timestamp)} · {item.transition}
                    </div>
                  </div>
                  <div className="w-28 shrink-0">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${similarityColor(item.similarity)}`} style={{ width: `${item.similarity}%` }} />
                    </div>
                    <div className="mt-1 text-right font-mono text-[10px] text-cyan">{item.similarity}%</div>
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>

        <section className="glass-surface rounded-xl p-4">
          <SectionLabel>Analyst summary</SectionLabel>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="glass-inset flex items-center gap-2 rounded-md px-3 py-2.5">
              <GitBranch className="h-4 w-4 text-cyan" />
              <span className="text-[12px] text-muted-foreground">
                {chains.length} sightings linked by appearance embedding
              </span>
            </div>
            <div className="glass-inset flex items-center gap-2 rounded-md px-3 py-2.5">
              <Activity className="h-4 w-4 text-teal" />
              <span className="text-[12px] text-muted-foreground">Path confidence {average}% across the route</span>
            </div>
            <div className="glass-inset flex items-center gap-2 rounded-md px-3 py-2.5">
              <MapPin className="h-4 w-4 text-amber" />
              <span className="text-[12px] text-muted-foreground">Last seen {chains.length ? chains[chains.length - 1]!.camera_name : "—"}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Route A · gate → lot", "Dwell 3m 16s", "No 1h recurrences"].map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
