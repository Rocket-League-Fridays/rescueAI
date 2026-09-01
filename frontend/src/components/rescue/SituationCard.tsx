"use client";

import { SectionLabel } from "@/components/ui";
import type { SituationAssessment } from "@/types/telemetry";

/** Where the subject is and what the ground around them looks like from above. */
export function SituationCard({ situation }: { situation: SituationAssessment }) {
  return (
    <section className="hud-glass rounded-sm border border-line p-3">
      <SectionLabel>Situation</SectionLabel>
      <p className="mt-1 font-mono text-sm text-ink-100">
        {situation.groundPoint.lat.toFixed(5)}, {situation.groundPoint.lng.toFixed(5)}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-500">
        Canopy over the subject {Math.round(situation.canopyFraction * 100)}%
      </p>
      {situation.notes ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-300">{situation.notes}</p>
      ) : null}
    </section>
  );
}
