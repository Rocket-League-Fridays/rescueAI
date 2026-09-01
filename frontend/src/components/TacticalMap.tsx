"use client";

import dynamic from "next/dynamic";

import type { MapFocus } from "@/components/TacticalMapCanvas";
import type { IncidentDetail } from "@/types/incident";
import type { LastKnownPosition, SearchRoute } from "@/types/search";
import type { GeoPoint, JobDetail } from "@/types/telemetry";

// Leaflet touches `window` at import time, so the canvas can never server-render.
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
  focus?: MapFocus;
  lastKnown?: LastKnownPosition | null;
  searchRoute?: SearchRoute | null;
  onLastKnownDragged?: (point: GeoPoint) => void;
  title?: string;
  minHeightClass?: string;
}

export function TacticalMap({
  incident,
  job,
  focus = "rescue",
  lastKnown = null,
  searchRoute = null,
  onLastKnownDragged,
  title = "Tactical map",
  minHeightClass = "min-h-[320px]",
}: TacticalMapProps) {
  return (
    <section
      className={`flex h-full ${minHeightClass} flex-col overflow-hidden rounded-lg border border-olive-700 bg-tactical-800`}
    >
      <header className="flex items-center justify-between border-b border-olive-800 px-3 py-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-olive-200">{title}</h3>
        <span className="font-mono text-[10px] text-olive-500">
          {incident?.trailName ?? "NO CORRIDOR"}
        </span>
      </header>
      <div className="relative min-h-[280px] flex-1">
        <TacticalMapCanvas
          incident={incident}
          job={job}
          focus={focus}
          lastKnown={lastKnown}
          searchRoute={searchRoute}
          onLastKnownDragged={onLastKnownDragged}
        />
      </div>
    </section>
  );
}
