"use client";

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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-600 bg-amber-950/60 px-3 py-2">
          <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-tactical-950">
            Fixture
          </span>
          <p className="text-xs text-amber-100">
            Committed demo data — not a live incident. Nothing here came from a backend.
          </p>
        </div>
      ) : null}

      {staleness ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-700 bg-orange-950/50 px-3 py-2">
          <span className="rounded border border-orange-500 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-orange-200">
            Stale
          </span>
          <p className="text-xs text-orange-100">
            {staleness.reason}
            {staleness.status === null ? "" : ` (${staleness.status})`}. Showing the last good data
            from {formatTimestamp(staleness.fetchedAt)}.
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
