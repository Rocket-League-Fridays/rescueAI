"use client";

import {
  buttonConfirm,
  Corners,
  EmptyState,
  hudPanelClass,
  PanelHeader,
  SectionLabel,
  Stat,
  StatusChip,
  type StatusTone,
} from "@/components/ui";
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
      <section className={hudPanelClass}>
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
    <section className={hudPanelClass}>
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
          <p className="rounded-md border border-status-critical/50 bg-status-critical/10 px-3 py-2 text-[13px] text-status-critical">
            Scan failed: {job.failureReason ?? "no reason recorded"}
          </p>
        ) : null}

        {fix ? (
          /* A position we would actually send a team to — the one moment this screen goes green. */
          <Corners colorClass="text-confirm">
            <div className="border border-status-confirmed/45 bg-status-confirmed/[0.08] px-3.5 py-3.5 shadow-glow-green">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>Subject fix</SectionLabel>
                <StatusChip tone="confirmed">Located</StatusChip>
              </div>
              <p className="mt-1.5 font-mono text-xl tracking-tight text-status-confirmed">
                {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">
                {incident.subject.displayName || "Subject"} ·{" "}
                {best
                  ? `${Math.round((best.clothingMatchScore ?? 0) * 100)}% clothing match`
                  : "no clothing score"}
                {" · approximate pinhole projection, not DEM-accurate"}
              </p>
              <button type="button" onClick={onGoToRescue} className={`${buttonConfirm} mt-3.5 w-full`}>
                Go to rescue →
              </button>
            </div>
          </Corners>
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
  const [tone, pulse] = statusTone(status);
  return (
    <PanelHeader
      title="Scan results"
      actions={
        <StatusChip tone={tone} pulse={pulse}>
          {status ?? "standby"}
        </StatusChip>
      }
    />
  );
}

function statusTone(status: JobStatus | null): [StatusTone, boolean] {
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

export function bestMatch(people: Detection[]): Detection | null {
  if (people.length === 0) {
    return null;
  }
  return people.reduce((best, current) =>
    (current.clothingMatchScore ?? 0) > (best.clothingMatchScore ?? 0) ? current : best,
  );
}
