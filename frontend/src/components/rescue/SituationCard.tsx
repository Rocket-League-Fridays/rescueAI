"use client";

import { SectionLabel } from "@/components/ui";
import type { SituationAssessment } from "@/types/telemetry";

/** Where the subject is and what the ground around them looks like from above. */
export function SituationCard({ situation }: { situation: SituationAssessment }) {
  return (
    <section className="rounded-lg border border-olive-700 bg-tactical-900 p-4">
      <SectionLabel>Situation</SectionLabel>
      <p className="mt-1 font-mono text-sm text-olive-100">
        {situation.groundPoint.lat.toFixed(5)}, {situation.groundPoint.lng.toFixed(5)}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-olive-500">
        Canopy over the subject {Math.round(situation.canopyFraction * 100)}%
      </p>
      {situation.notes ? (
        <p className="mt-2 text-xs leading-relaxed text-olive-300">{situation.notes}</p>
      ) : null}
    </section>
  );
}
