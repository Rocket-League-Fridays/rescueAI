"use client";

import { StatusChip } from "@/components/ui";
import type { DataOrigin, Staleness } from "@/lib/incident-snapshot";

interface DataOriginBannerProps {
  origin: DataOrigin;
  staleness: Staleness | null;
}

/**
 * Two honesty signals that must never be suppressed: this is fixture data, and this is older
 * than the last attempt to refresh it.
 */
export function DataOriginBanner({ origin, staleness }: DataOriginBannerProps) {
  if (origin === "live" && staleness === null) {
    return null;
  }

  return (
    <div className="space-y-2">
      {origin === "fixture" ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-accent-400/40 bg-accent-400/[0.07] px-3 py-2.5">
          <StatusChip tone="probable">Fixture</StatusChip>
          <p className="text-[13px] text-accent-200">
            Committed demo data — not a live incident. Nothing here came from a backend.
          </p>
        </div>
      ) : null}

      {staleness ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-status-stale/35 bg-status-stale/[0.07] px-3 py-2.5">
          <StatusChip tone="stale">Stale</StatusChip>
          <p className="text-[13px] text-ink-300">
            {staleness.reason}
            {staleness.status === null ? "" : ` (${staleness.status})`}. Showing the last good data
            from{" "}
            <span className="font-mono text-ink-200">{formatTimestamp(staleness.fetchedAt)}</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
