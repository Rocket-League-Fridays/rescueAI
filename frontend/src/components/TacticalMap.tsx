"use client";

import dynamic from "next/dynamic";

import type { MapFocus } from "@/components/TacticalMapCanvas";
import type { IncidentDetail } from "@/types/incident";
import type { LastKnownPosition, SearchRoute } from "@/types/search";
import type { GeoPoint, JobDetail } from "@/types/telemetry";
import type { ReactNode } from "react";

// Leaflet touches `window` at import time, so the canvas can never server-render.
const TacticalMapCanvas = dynamic(() => import("./TacticalMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs text-ink-400">
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
  headerAction?: ReactNode;
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
  headerAction,
}: TacticalMapProps) {
  return (
    <section
      className={`flex h-full ${minHeightClass} flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-panel`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-100">{title}</h3>
          <p className="font-mono text-[11px] text-ink-500">
            {incident?.trailName ?? "NO CORRIDOR"}
          </p>
        </div>
        {headerAction}
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
