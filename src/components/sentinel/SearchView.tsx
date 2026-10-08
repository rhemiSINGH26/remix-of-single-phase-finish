import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Crosshair, Flag, Search, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { search } from "@/lib/api";
import { persistResultFlags, useSentinel } from "@/store";
import type { ParsedQuery, SearchResultItem, TimeRange } from "@/types/sentinel";
import { CameraTile, Chip, SectionLabel } from "./shared";

const OBJECT_CLASSES = ["Car", "Person", "Truck", "Bicycle"];
const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "15m", label: "15 min" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "all", label: "All time" },
];

function ParsedTokens({ parsed }: { parsed: ParsedQuery | null }) {
  if (!parsed) return null;
  const tokens: string[] = [];
  if (parsed.attributes.length) tokens.push(`color: ${parsed.attributes.join(", ")}`);
  if (parsed.object_class) tokens.push(`object: ${parsed.object_class}`);
  if (parsed.location) tokens.push(`location: ${parsed.location}`);
  if (parsed.cameras.length) tokens.push(parsed.cameras.join(" · "));
  tokens.push(`window: ${parsed.time_range}`);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Sparkles className="h-3 w-3 text-cyan" aria-hidden />
      {tokens.map((token) => (
        <span key={token} className="glass-inset rounded-sm px-1.5 py-0.5 font-mono text-[10px] text-cyan/90">
          {token}
        </span>
      ))}
    </div>
  );
}

function ResultCard({
  item,
  index,
  bookmarked,
  flagged,
  onBookmark,
  onFlag,
  onTrace,
}: {
  item: SearchResultItem;
  index: number;
  bookmarked: boolean;
  flagged: boolean;
  onBookmark: () => void;
  onFlag: () => void;
  onTrace: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05 }}
      className="glass-surface target-panel rounded-lg p-3"
    >
      <div className="flex gap-3">
        <div className="feed-sheen relative h-[74px] w-[116px] shrink-0 overflow-hidden rounded-md border border-white/10">
          <img src={item.crop_url} alt={item.description} className="h-full w-full object-cover" />
          <span className="absolute bottom-1 left-1 rounded-sm bg-black/70 px-1 font-mono text-[9px] text-cyan">
            {item.camera_id}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-ice">{item.track_db_id}</span>
                <span className="rounded-sm bg-teal/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-teal">
                  {item.object_class}
                </span>
                <span className="font-mono text-[10px] text-telem-muted">
                  {item.camera_name} · t+{item.timestamp.toFixed(1)}s
                </span>
              </div>
              <p className="mt-1 truncate text-[13px] font-medium text-foreground">{item.description}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-base font-semibold text-cyan">{item.confidence}%</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-telem-muted">confidence</div>
            </div>
          </div>
          <p className="mt-1.5 line-clamp-2 border-l-2 border-cyan/40 pl-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-wider text-cyan/80">grounding </span>
            {item.explanation}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" className="h-7 gap-1.5 px-2.5 text-[11px]" onClick={onTrace}>
              <Crosshair className="h-3 w-3" /> Trace
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 gap-1.5 px-2.5 text-[11px] ${bookmarked ? "text-cyan" : "text-muted-foreground"}`}
              onClick={onBookmark}
            >
              {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
              {bookmarked ? "Saved" : "Bookmark"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 gap-1.5 px-2.5 text-[11px] ${flagged ? "text-rec" : "text-muted-foreground"}`}
              onClick={onFlag}
            >
              <Flag className="h-3.5 w-3.5" />
              {flagged ? "Flagged" : "False positive"}
            </Button>
            <span className="ml-auto font-mono text-[9px] text-telem-muted">
              semantic {item.semantic_score} · rerank {item.rerank_score}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function SearchView() {
  const store = useSentinel();
  const {
    query,
    results,
    bookmarks,
    falsePositives,
    learnedLocations,
    cameras,
    topK,
    sortMode,
    minConfidence,
    selectedCameraIds,
    activeObjectClasses,
    timeRange,
    recentQueries,
  } = store;
  const [input, setInput] = useState(query);
  const [searching, setSearching] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [learnCameraId, setLearnCameraId] = useState("");
  const [learnAlias, setLearnAlias] = useState("");

  const runSearch = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setSearching(true);
      const response = await search(trimmed, useSentinel.getState().topK, useSentinel.getState().cameras, useSentinel.getState().learnedLocations);
      useSentinel.setState({ results: response.results, query: trimmed });
      useSentinel.getState().saveRecent(trimmed);
      setParsed(response.parsed_query);
      setSearching(false);
      if (response.clarification_needed) {
        setClarification(response.clarification_needed.term);
        setLearnCameraId("");
        setLearnAlias("");
      }
    },
    [],
  );

  useEffect(() => {
    if (!useSentinel.getState().results.length) void runSearch("Red car at main gate");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const list = results.filter(
      (item) =>
        item.confidence >= minConfidence &&
        (!selectedCameraIds.length || selectedCameraIds.includes(item.camera_id)) &&
        (!activeObjectClasses.length || activeObjectClasses.includes(item.object_class)),
    );
    if (sortMode === "confidence") list.sort((a, b) => b.confidence - a.confidence);
    else if (sortMode === "newest") list.sort((a, b) => b.timestamp - a.timestamp);
    else list.sort((a, b) => b.rerank_score - a.rerank_score);
    return list;
  }, [results, minConfidence, selectedCameraIds, activeObjectClasses, sortMode]);

  const toggleBookmark = (id: string) => {
    const next = bookmarks.includes(id) ? bookmarks.filter((value) => value !== id) : [...bookmarks, id];
    useSentinel.setState({ bookmarks: next });
    persistResultFlags(next, falsePositives);
    toast.success(bookmarks.includes(id) ? "Bookmark removed" : "Track bookmarked");
  };

  const toggleFlag = (id: string) => {
    const next = falsePositives.includes(id) ? falsePositives.filter((value) => value !== id) : [...falsePositives, id];
    useSentinel.setState({ falsePositives: next });
    persistResultFlags(bookmarks, next);
    toast.info(falsePositives.includes(id) ? "Flag removed" : "Marked as false positive · rerank weights nudged");
  };

  const trace = (id: string) => {
    useSentinel.setState({ tracedTrackId: id, view: "reid" });
    toast(`Tracing ${id} across cameras`);
  };

  const saveLearning = () => {
    if (!clarification || !learnCameraId) return;
    const aliases = [clarification.toLowerCase(), ...learnAlias.split(",").map((alias) => alias.trim().toLowerCase()).filter(Boolean)];
    useSentinel.getState().saveLearnedLocation({ term: clarification, camera_id: learnCameraId, aliases });
    setClarification(null);
    toast.success(`Learned "${clarification}" → ${learnCameraId}. Re-running search…`);
    void runSearch(query);
  };

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.52fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="glass-surface target-panel rounded-xl p-4">
          <SectionLabel>Conversational search</SectionLabel>
          <form
            className="mt-3 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch(input);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-telem-muted" />
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Describe what you saw — e.g. red car at main gate"
                aria-label="Search query"
                className="h-11 border-white/15 bg-black/30 pl-9 text-sm text-foreground placeholder:text-telem-muted"
              />
            </div>
            <Button type="submit" disabled={searching} className="h-11 gap-2 bg-cyan/90 px-5 font-display text-sm font-semibold text-[#07131c] hover:bg-cyan">
              <Search className="h-4 w-4" />
              {searching ? "Scanning…" : "Search"}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {["Red car at main gate", "Person in red shirt", "White car on Cam 2", "Bicycle", "Truck near loading dock"].map((example) => (
              <Chip
                key={example}
                active={input === example}
                onClick={() => {
                  setInput(example);
                  void runSearch(example);
                }}
              >
                {example}
              </Chip>
            ))}
          </div>
          <div className="mt-3 border-t border-white/5 pt-3">
            <ParsedTokens parsed={parsed} />
          </div>
        </section>

        <section className="glass-inset flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-telem-muted">Cameras</span>
          {cameras.map((camera) => (
            <Chip
              key={camera.camera_id}
              active={selectedCameraIds.includes(camera.camera_id)}
              onClick={() =>
                useSentinel.setState({
                  selectedCameraIds: selectedCameraIds.includes(camera.camera_id)
                    ? selectedCameraIds.filter((value) => value !== camera.camera_id)
                    : [...selectedCameraIds, camera.camera_id],
                })
              }
            >
              {camera.camera_id}
            </Chip>
          ))}
          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-telem-muted">Objects</span>
          {OBJECT_CLASSES.map((objectClass) => (
            <Chip
              key={objectClass}
              active={activeObjectClasses.includes(objectClass)}
              onClick={() =>
                useSentinel.setState({
                  activeObjectClasses: activeObjectClasses.includes(objectClass)
                    ? activeObjectClasses.filter((value) => value !== objectClass)
                    : [...activeObjectClasses, objectClass],
                })
              }
            >
              {objectClass}
            </Chip>
          ))}
          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-telem-muted">Window</span>
          {TIME_RANGES.map((range) => (
            <Chip key={range.value} active={timeRange === range.value} onClick={() => useSentinel.setState({ timeRange: range.value })}>
              {range.label}
            </Chip>
          ))}
          <label className="ml-auto flex items-center gap-2 font-mono text-[10px] text-telem-muted">
            min conf
            <input
              type="range"
              min={40}
              max={95}
              value={minConfidence}
              onChange={(event) => useSentinel.setState({ minConfidence: Number(event.target.value) })}
              className="w-24 accent-[var(--cyan)]"
              aria-label="Minimum confidence"
            />
            <span className="text-cyan">{minConfidence}%</span>
          </label>
          <Select value={sortMode} onValueChange={(value) => useSentinel.setState({ sortMode: value as typeof sortMode })}>
            <SelectTrigger className="h-7 w-[128px] border-white/10 bg-black/30 font-mono text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rerank">Sort: rerank</SelectItem>
              <SelectItem value="confidence">Sort: confidence</SelectItem>
              <SelectItem value="newest">Sort: newest</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="flex min-w-0 flex-col gap-2.5">
          <SectionLabel aside={<span className="font-mono text-[10px] text-telem-muted">{filtered.length} matches · top-k {topK}</span>}>
            Evidence results
          </SectionLabel>
          {searching && <div className="shimmer h-20 rounded-lg" />}
          {!searching && filtered.length === 0 && (
            <div className="glass-inset rounded-lg p-6 text-center text-sm text-muted-foreground">
              No tracks matched this query. Try widening the confidence threshold or clearing camera filters.
            </div>
          )}
          {filtered.map((item, index) => (
            <ResultCard
              key={item.track_db_id}
              item={item}
              index={index}
              bookmarked={bookmarks.includes(item.track_db_id)}
              flagged={falsePositives.includes(item.track_db_id)}
              onBookmark={() => toggleBookmark(item.track_db_id)}
              onFlag={() => toggleFlag(item.track_db_id)}
              onTrace={() => trace(item.track_db_id)}
            />
          ))}
          {recentQueries.length > 0 && (
            <p className="mt-1 font-mono text-[10px] text-telem-muted">
              recent: {recentQueries.slice(0, 4).join(" · ")}
            </p>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
        <section className="glass-surface target-panel rounded-xl p-3">
          <SectionLabel aside={<span className="font-mono text-[10px] text-teal">4 feeds live</span>}>Live camera wall</SectionLabel>
          <div className="mt-3 grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-2">
            {cameras.slice(0, 4).map((camera) => (
              <CameraTile
                key={camera.camera_id}
                camera={camera}
                compact
                onFocus={() => useSentinel.setState({ view: "matrix" })}
                className="cursor-pointer"
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-telem-muted">Click a tile to open the full CCTV matrix</p>
        </section>
        {learnedLocations.length > 0 && (
          <section className="glass-surface rounded-xl p-3">
            <SectionLabel>Learned locations</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {learnedLocations.map((location) => (
                <li key={location.term} className="glass-inset flex items-center justify-between rounded-md px-2.5 py-1.5">
                  <span className="text-[12px] text-foreground">“{location.term}”</span>
                  <span className="font-mono text-[10px] text-cyan">{location.camera_id}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <Dialog open={Boolean(clarification)} onOpenChange={(open) => !open && setClarification(null)}>
        <DialogContent className="border-white/10 bg-[var(--popover)] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <TriangleAlert className="h-4 w-4 text-amber" /> Where is “{clarification}”?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              I couldn’t resolve this location to a camera. Point it at one camera and I’ll remember it for future searches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={learnCameraId} onValueChange={setLearnCameraId}>
              <SelectTrigger className="w-full border-white/15 bg-black/30" aria-label="Camera for this location">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.camera_id} value={camera.camera_id}>
                    {camera.camera_id} · {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={learnAlias}
              onChange={(event) => setLearnAlias(event.target.value)}
              placeholder="Aliases, comma separated — e.g. dock, south entrance"
              aria-label="Location aliases"
              className="border-white/15 bg-black/30"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClarification(null)}>
              Skip
            </Button>
            <Button className="bg-cyan/90 text-[#07131c] hover:bg-cyan" onClick={saveLearning} disabled={!learnCameraId}>
              Teach location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
