"use client";

import { labelClass, StatusChip } from "@/components/ui";
import type { IncidentDetail } from "@/types/incident";
import type { Detection } from "@/types/telemetry";

interface SubjectAlertProps {
  detections: Detection[];
  incident: IncidentDetail;
}

/** Raised when a person box overlaps the clothing colors from the transcript. */
export function SubjectAlert({ detections, incident }: SubjectAlertProps) {
  const best = detections.reduce((winner, current) =>
    (current.clothingMatchScore ?? 0) > (winner.clothingMatchScore ?? 0) ? current : winner,
  );

  return (
    <div className="corners text-target rounded-sm border border-target/45 bg-target/[0.08] px-3.5 py-3 shadow-glow-red">
      <span className="corners-bl" aria-hidden />
      <span className="corners-br" aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className={labelClass}>Subject match</p>
        <StatusChip tone="probable" pulse>
          Alert
        </StatusChip>
      </div>
      <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-ink-50">
        {incident.subject.displayName || "Person"} ·{" "}
        <span className="font-mono text-caution">
          {Math.round((best.clothingMatchScore ?? 0) * 100)}%
        </span>{" "}
        clothing
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-400">
        {detections.length} candidate{detections.length === 1 ? "" : "s"} over threshold ·{" "}
        {incident.subject.clothingColors.join(", ") || "no colors on file"}
      </p>
    </div>
  );
}
