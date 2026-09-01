"use client";

import { useState } from "react";

import { StatusChip } from "@/components/ui";
import { SubjectReviewFields } from "@/components/locate/SubjectReviewForm";
import { isExtractorPlaceholder, summarizeTranscript } from "@/lib/event-summary";
import type { IncidentOverrides } from "@/lib/incident-overrides";
import type { IncidentDetail } from "@/types/incident";
import type { LastKnownPosition } from "@/types/search";

interface IncidentReportProps {
  incident: IncidentDetail;
  overrides: IncidentOverrides;
  lastKnown: LastKnownPosition;
  onChange(next: IncidentOverrides): void;
}

function formatOpened(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IncidentReport({ incident, overrides, lastKnown, onChange }: IncidentReportProps) {
  const summary = summarizeTranscript(incident.transcript);
  const notes = incident.subject.notes.trim();
  const showNotes = notes.length > 0 && !isExtractorPlaceholder(notes);
  const lastKnownLabel = `${lastKnown.point.lat.toFixed(5)}, ${lastKnown.point.lng.toFixed(5)}`;
  const [open, setOpen] = useState(true);

  return (
    <section className="hud-glass overflow-hidden rounded-sm border border-line shadow-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="font-mono text-[11px] text-ink-500" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink-100">
              Incident report
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink-500">
              {incident.subject.displayName || "Unknown subject"} ·{" "}
              {incident.trailName || "Unknown corridor"} · last known {lastKnownLabel}
            </p>
          </div>
        </button>
        <StatusChip tone={incident.status === "open" ? "searching" : "stale"}>{incident.status}</StatusChip>
      </header>
      {open ? (
      <div className="space-y-5 p-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-label text-ink-500">Event summary</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-100">{summary}</p>
        </div>

        {showNotes ? (
          <div className="rounded-md border border-line-soft bg-surface-sunken px-3 py-2.5">
            <p className="font-mono text-[11px] uppercase tracking-label text-ink-500">
              Subject description
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-200">{notes}</p>
          </div>
        ) : null}

        <div className="border-t border-line-soft pt-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-label text-ink-500">
            Extracted details
          </p>
          <dl className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-label text-ink-500">Trail</dt>
              <dd className="mt-1 text-[13px] text-ink-100">{incident.trailName || "Unknown"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-label text-ink-500">
                Opened
              </dt>
              <dd className="mt-1 font-mono text-[13px] text-ink-100">
                {formatOpened(incident.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-label text-ink-500">
                Time missing
              </dt>
              <dd className="mt-1 font-mono text-[13px] text-ink-100">
                {incident.missingMinutes ?? 60} min
                {incident.missingMinutesAssumed ? " · assumed" : ""}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-label text-ink-500">
                Last known
              </dt>
              <dd className="mt-1 font-mono text-[13px] text-ink-100">{lastKnownLabel}</dd>
            </div>
          </dl>
          <SubjectReviewFields incident={incident} overrides={overrides} onChange={onChange} />
        </div>
      </div>
      ) : null}
    </section>
  );
}
