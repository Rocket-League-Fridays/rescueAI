"use client";

import type { ReactNode } from "react";

import { DataOriginBanner } from "@/components/DataOriginBanner";
import { ErrorBanner } from "@/components/ui";
import type { DataOrigin, Staleness } from "@/lib/incident-snapshot";

/** Shared full-bleed map + dual-rail HUD used by Locate and Rescue. */
export function CommandSurface({
  map,
  left,
  right,
  dock,
  origin,
  staleness,
  errorMessage,
}: {
  map: ReactNode;
  left: ReactNode;
  right: ReactNode;
  dock?: ReactNode;
  origin: DataOrigin;
  staleness: Staleness | null;
  errorMessage: string | null;
}) {
  return (
    <div className="relative lg:h-[calc(100vh-44px)]">
      <div className="h-[55vh] lg:absolute lg:inset-0 lg:h-auto">{map}</div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[800]">
        <DataOriginBanner origin={origin} staleness={staleness} />
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      </div>

      <aside className="pointer-events-none relative z-[850] flex flex-col gap-2 p-3 lg:absolute lg:bottom-3 lg:left-3 lg:top-10 lg:w-[420px] lg:overflow-y-auto">
        <div className="pointer-events-auto space-y-2">
          {left}
          {dock}
        </div>
      </aside>

      <aside className="pointer-events-none relative z-[850] flex flex-col gap-2 p-3 lg:absolute lg:bottom-3 lg:right-3 lg:top-10 lg:w-[380px] lg:overflow-y-auto">
        <div className="pointer-events-auto space-y-2">{right}</div>
      </aside>
    </div>
  );
}

