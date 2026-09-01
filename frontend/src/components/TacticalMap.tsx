"use client";

import dynamic from "next/dynamic";

import type { MapFocus } from "@/components/TacticalMapCanvas";
import { labelClass } from "@/components/ui";
import type { IncidentDetail } from "@/types/incident";
import type { LastKnownPosition, SearchRoute } from "@/types/search";
import type { GeoPoint, JobDetail } from "@/types/telemetry";
import type { ReactNode } from "react";

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
  bleed?: boolean;
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
  bleed = false,
}: TacticalMapProps) {
  const canvas = (
    <TacticalMapCanvas
      incident={incident}
      job={job}
      focus={focus}
      lastKnown={lastKnown}
      searchRoute={searchRoute}
      onLastKnownDragged={onLastKnownDragged}
    />
  );

  if (bleed) {
    return (
      <section className="relative h-full min-h-[280px] w-full">
        <div className="absolute inset-0">{canvas}</div>
        <div className="pointer-events-none absolute left-3 top-3 z-[700] hidden max-w-[calc(100%-24px)] items-start justify-between gap-3 lg:flex lg:left-[404px] lg:right-[404px] lg:max-w-none">
          <div className="pointer-events-none hud-glass rounded-sm border border-line px-3 py-1.5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-50">{title}</h3>
            <p className={labelClass}>{incident?.trailName ?? "NO CORRIDOR"}</p>
          </div>
          {headerAction ? <div className="pointer-events-auto">{headerAction}</div> : null}
        </div>
        <div className="pointer-events-auto absolute right-3 top-3 z-[700] lg:hidden">
          {headerAction}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`flex h-full ${minHeightClass} flex-col overflow-hidden rounded-sm border border-line hud-glass shadow-panel`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-50">{title}</h3>
          <p className={labelClass}>{incident?.trailName ?? "NO CORRIDOR"}</p>
        </div>
        {headerAction}
      </header>
      <div className="relative min-h-[280px] flex-1">{canvas}</div>
    </section>
  );
}
