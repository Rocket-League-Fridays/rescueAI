"use client";

import { EmptyState, SectionLabel, Stat } from "@/components/ui";
import type { IncidentDetail } from "@/types/incident";
import type { Detection, JobDetail, JobStatus } from "@/types/telemetry";

/** Above this HSV clothing overlap a person box is worth waking the operator for. */
export const CLOTHING_ALERT_THRESHOLD = 0.12;

interface ScanMonitorProps {
  job: JobDetail | null;
  incident: IncidentDetail;
  onGoToRescue(): void;
}

/**
 * What the scan found. This is results and status, not video — frame rendering is deliberately
 * out of scope for this build.
 */
export function ScanMonitor({ job, incident, onGoToRescue }: ScanMonitorProps) {
  if (job === null) {
    return (
      <section className="overflow-hidden rounded-lg border border-olive-700 bg-tactical-800">
        <Header status={null} />
        <div className="p-4">
          <EmptyState>No sortie attached yet — the scan runs on uploaded or inbox footage</EmptyState>
        </div>
      </section>
    );
  }

  const people = job.detections.filter((detection) => detection.className === "person");
  const best = bestMatch(people);
  const fix = job.situation?.groundPoint ?? best?.groundPoint ?? null;

  return (
    <section className="overflow-hidden rounded-lg border border-olive-700 bg-tactical-800">
      <Header status={job.status} />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Detections" value={String(job.detections.length)} />
          <Stat label="People" value={String(people.length)} />
          <Stat
            label="Best match"
            value={best ? `${Math.round((best.clothingMatchScore ?? 0) * 100)}%` : "—"}
          />
          <Stat label="Landing zones" value={String(job.landingZones.length)} />
        </div>

        {job.status === "failed" ? (
          <p className="rounded border border-red-800 bg-red-950/60 px-3 py-2 text-xs text-red-200">
            Scan failed: {job.failureReason ?? "no reason recorded"}
          </p>
        ) : null}

        {fix ? (
          <div className="rounded border border-amber-600 bg-amber-950/50 px-3 py-3">
            <SectionLabel>Subject fix</SectionLabel>
            <p className="mt-1 font-mono text-sm text-amber-100">
              {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
            </p>
            <p className="mt-1 text-xs text-amber-200/80">
              {incident.subject.displayName || "Subject"} ·{" "}
              {best ? `${Math.round((best.clothingMatchScore ?? 0) * 100)}% clothing match` : "no clothing score"}
              {" · approximate pinhole projection, not DEM-accurate"}
            </p>
            <button
              type="button"
              onClick={onGoToRescue}
              className="mt-3 w-full rounded bg-amber-400 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-tactical-950"
            >
              Go to rescue →
            </button>
          </div>
        ) : (
          <EmptyState>
            {job.status === "completed"
              ? "Scan finished without a subject fix"
              : "Scan running — a position appears here when a match is found"}
          </EmptyState>
        )}
      </div>
    </section>
  );
}

function Header({ status }: { status: JobStatus | null }) {
  return (
    <header className="flex items-center justify-between border-b border-olive-800 px-3 py-2">
      <h3 className="font-mono text-xs uppercase tracking-widest text-olive-200">Scan results</h3>
      <span
        className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${statusStyle(status)}`}
      >
        {status ?? "standby"}
      </span>
    </header>
  );
}

function statusStyle(status: JobStatus | null): string {
  switch (status) {
    case "completed":
      return "border-olive-500 text-olive-200";
    case "processing":
    case "queued":
      return "border-amber-500 text-amber-300";
    case "failed":
      return "border-red-700 text-red-300";
    default:
      return "border-olive-800 text-olive-500";
  }
}

export function bestMatch(people: Detection[]): Detection | null {
  if (people.length === 0) {
    return null;
  }
  return people.reduce((best, current) =>
    (current.clothingMatchScore ?? 0) > (best.clothingMatchScore ?? 0) ? current : best,
  );
}
