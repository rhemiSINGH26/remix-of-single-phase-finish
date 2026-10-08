import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Crosshair, Radar, Search } from "lucide-react";
import { useSentinel } from "@/store";
import type { ViewName } from "@/types/sentinel";
import IngestionView from "./IngestionView";
import MatrixView from "./MatrixView";
import ReidView from "./ReidView";
import SearchView from "./SearchView";
import { StatusDot, useUtcClock } from "./shared";

const NAV: { view: ViewName; label: string; icon: typeof Search }[] = [
  { view: "search", label: "Search", icon: Search },
  { view: "matrix", label: "CCTV Matrix", icon: Clapperboard },
  { view: "ingestion", label: "Camera Ingestion", icon: Radar },
  { view: "reid", label: "Re-ID Analytics", icon: Crosshair },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
        <rect width="48" height="48" rx="12" fill="#101c2c" />
        <path d="M24 7 38 12v11c0 9-5.8 14.7-14 18-8.2-3.3-14-9-14-18V12z" fill="none" stroke="#93b8ff" strokeWidth="2.5" />
        <path d="M15.5 24s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" fill="none" stroke="#49ced3" strokeWidth="2" />
        <circle cx="24" cy="24" r="2.7" fill="#49ced3" />
      </svg>
      <div>
        <div className="font-display text-[15px] font-bold leading-none tracking-wide text-ice">SENTINEL</div>
        <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-telem-muted">video intelligence</div>
      </div>
    </div>
  );
}

function TelemetryFooter() {
  const cameras = useSentinel((state) => state.cameras);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 2000);
    return () => window.clearInterval(id);
  }, []);
  const online = cameras.filter((camera) => camera.status === "online").length;
  const gpu = 32 + ((tick * 7) % 26);
  const tracks = 320 + ((tick * 13) % 40);
  const vectors = 128400 + tick * 37;
  return (
    <footer className="flex h-9 shrink-0 items-center gap-4 overflow-x-auto border-t border-white/10 bg-black/40 px-4 font-mono text-[10px] tracking-wider text-telem-muted backdrop-blur">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="pulse-rec inline-block h-1.5 w-1.5 rounded-full bg-teal" /> NOMINAL
      </span>
      <span className="whitespace-nowrap">GPU <span className="text-cyan">{gpu}%</span></span>
      <span className="whitespace-nowrap">CAMERAS <span className="text-cyan">{online}/{cameras.length}</span></span>
      <span className="whitespace-nowrap">TRACKS <span className="text-cyan">{tracks}</span></span>
      <span className="whitespace-nowrap">VECTORS <span className="text-cyan">{vectors.toLocaleString()}</span></span>
      <span className="whitespace-nowrap">EMBED <span className="text-teal">OpenCLIP·512d</span></span>
      <span className="ml-auto whitespace-nowrap text-telem-muted">SENTINEL v2.4 · mock pipeline</span>
    </footer>
  );
}

export default function Workspace() {
  const view = useSentinel((state) => state.view);
  const set = useSentinel((state) => state.set);
  const hydrate = useSentinel((state) => state.hydrate);
  const clock = useUtcClock();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    hydrate();
    const id = window.setTimeout(() => setBooting(false), 700);
    return () => window.clearTimeout(id);
  }, [hydrate]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-white/10 bg-black/45 px-4 backdrop-blur-xl">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => set({ view: item.view })}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-[12.5px] font-medium transition-colors ${
                  active ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden items-center gap-1.5 font-mono text-[10px] tracking-wider text-teal md:flex">
            <StatusDot status="online" /> ALL SYSTEMS NOMINAL
          </span>
          <span className="font-mono text-[11px] text-ice">{clock}</span>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 sentinel-grid">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="h-full"
          >
            {view === "search" && <SearchView />}
            {view === "matrix" && <MatrixView />}
            {view === "ingestion" && <IngestionView />}
            {view === "reid" && <ReidView />}
          </motion.div>
        </AnimatePresence>
        {booting && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[var(--background)]">
            <Logo />
            <p className="font-mono text-[11px] tracking-[0.2em] text-cyan">INITIALISING FEEDS…</p>
          </div>
        )}
      </main>

      <TelemetryFooter />
    </div>
  );
}
