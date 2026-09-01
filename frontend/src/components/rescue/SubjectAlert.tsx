"use client";

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
    <div className="rounded-lg border border-amber-600 bg-amber-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
        Subject match
      </p>
      <p className="text-sm text-amber-100">
        {incident.subject.displayName || "Person"} · clothing{" "}
        {Math.round((best.clothingMatchScore ?? 0) * 100)}%
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-amber-200/70">
        {detections.length} candidate{detections.length === 1 ? "" : "s"} over threshold ·
        {" "}
        {incident.subject.clothingColors.join(", ") || "no colors on file"}
      </p>
    </div>
  );
}
