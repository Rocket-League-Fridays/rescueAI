"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { IncidentStageNav } from "@/components/IncidentStageNav";
import { useMissionExtras } from "@/components/MissionContext";
import { buttonGhost, StatusChip, type StatusTone } from "@/components/ui";
import type { JobStatus } from "@/types/telemetry";

/**
 * 44px mission chrome. Route-driven — no presenter state — so Locate and Rescue stay in sync.
 */
export function MissionBar() {
  const pathname = usePathname() ?? "/";
  const extras = useMissionExtras();
  const isIncidentPage = pathname.startsWith("/locate/") || pathname.startsWith("/rescue/");
  const incidentId = parseIncidentId(pathname);
  const stage = pathname.startsWith("/rescue/") ? "rescue" : "locate";

  return (
    <header className="sticky top-0 z-50 h-11 border-b border-line bg-void/80 backdrop-blur-md">
      <div className="flex h-full items-center gap-3 px-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center border border-signal/40 bg-signal/10 font-mono text-[11px] font-semibold text-signal"
            aria-hidden
          >
            ◆
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-50">
            RescueAI
          </span>
        </Link>

        {incidentId ? (
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-label text-ink-500 sm:block">
            OP {incidentId.slice(0, 8)}
          </span>
        ) : (
          <span className="hidden font-mono text-[10px] uppercase tracking-label text-ink-500 sm:block">
            Standby
          </span>
        )}

        <div className="flex-1" />

        {isIncidentPage && incidentId ? (
          <IncidentStageNav
            incidentId={incidentId}
            stage={stage}
            rescueReady={extras.rescueReady}
          />
        ) : null}

        <UtcClock />
        <LinkDot />
        <JobChip status={extras.jobStatus} />

        {extras.onRefresh ? (
          <button
            type="button"
            onClick={extras.onRefresh}
            disabled={extras.isRefreshing}
            className={buttonGhost}
          >
            {extras.isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}

        {isIncidentPage ? (
          <Link href="/" className={`${buttonGhost} shrink-0`}>
            New incident
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function parseIncidentId(pathname: string): string | null {
  const match = pathname.match(/^\/(?:locate|rescue)\/([^/]+)/);
  return match?.[1] ?? null;
}

function UtcClock() {
  const [now, setNow] = useState<string>("--:--:--Z");

  useEffect(() => {
    const tick = () => {
      const date = new Date();
      const hh = String(date.getUTCHours()).padStart(2, "0");
      const mm = String(date.getUTCMinutes()).padStart(2, "0");
      const ss = String(date.getUTCSeconds()).padStart(2, "0");
      setNow(`${hh}:${mm}:${ss}Z`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="font-mono text-[11px] tabular-nums tracking-label text-ink-300" dateTime={now}>
      {now}
    </time>
  );
}

function LinkDot() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-confirm">
      <span className="h-1.5 w-1.5 rounded-full bg-confirm" aria-hidden />
      Link
    </span>
  );
}

function JobChip({ status }: { status?: JobStatus | null }) {
  if (status === undefined) {
    return null;
  }
  const [tone] = jobTone(status);
  return <StatusChip tone={tone}>{status ?? "standby"}</StatusChip>;
}

function jobTone(status: JobStatus | null): [StatusTone, boolean] {
  switch (status) {
    case "completed":
      return ["confirmed", false];
    case "processing":
    case "queued":
      return ["searching", true];
    case "failed":
      return ["critical", false];
    default:
      return ["neutral", false];
  }
}
