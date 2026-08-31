"use client";

import dynamic from "next/dynamic";

import type { IncidentDetail } from "@/types/incident";
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
  incident: IncidentDetail | null;
  job: JobDetail | null;
}

export function TacticalMap({ incident, job }: TacticalMapProps) {
  return (
    <section className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-olive-700 bg-tactical-800">
      <header className="flex items-center justify-between border-b border-olive-800 px-3 py-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-olive-200">
          Tactical map
        </h3>
        <span className="font-mono text-[10px] text-olive-500">
          {incident?.trailName ?? "NO CORRIDOR"}
        </span>
      </header>
      <div className="relative min-h-[280px] flex-1">
        <TacticalMapCanvas incident={incident} job={job} />
      </div>
    </section>
  );
}
