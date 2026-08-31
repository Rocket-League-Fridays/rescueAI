"use client";

import dynamic from "next/dynamic";

import type { JobDetail } from "@/types/telemetry";

const TacticalMapCanvas = dynamic(() => import("./TacticalMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs text-olive-400">
      Initializing map…
    </div>
  ),
});

interface TacticalMapProps {
  job: JobDetail | null;
}

export function TacticalMap({ job }: TacticalMapProps) {
  return (
    <section className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-olive-700 bg-tactical-800">
      <header className="flex items-center justify-between border-b border-olive-800 px-3 py-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-olive-200">
          Tactical map
        </h3>
        <span className="font-mono text-[10px] text-olive-500">
          {job?.route ? "ROUTE READY" : "NO ROUTE"}
        </span>
      </header>
      <div className="relative min-h-[280px] flex-1">
        <TacticalMapCanvas job={job} />
      </div>
    </section>
  );
}
