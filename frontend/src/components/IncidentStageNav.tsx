"use client";

import Link from "next/link";

export type IncidentStage = "locate" | "rescue";

interface IncidentStageNavProps {
  incidentId: string;
  stage: IncidentStage;
  /** Rescue stays locked until the scan has actually produced a position to walk to. */
  rescueReady: boolean;
}

export function IncidentStageNav({ incidentId, stage, rescueReady }: IncidentStageNavProps) {
  return (
    <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
      <StageLink
        href={`/locate/${incidentId}`}
        label="1 · Locate"
        active={stage === "locate"}
        enabled
      />
      <span className="text-olive-700">›</span>
      <StageLink
        href={`/rescue/${incidentId}`}
        label="2 · Rescue"
        active={stage === "rescue"}
        enabled={rescueReady || stage === "rescue"}
        disabledHint="Waiting on a subject fix from the scan"
      />
    </nav>
  );
}

function StageLink({
  href,
  label,
  active,
  enabled,
  disabledHint,
}: {
  href: string;
  label: string;
  active: boolean;
  enabled: boolean;
  disabledHint?: string;
}) {
  const base = "rounded border px-2.5 py-1.5";
  if (active) {
    return (
      <span className={`${base} border-olive-500 bg-olive-800/50 text-olive-100`}>{label}</span>
    );
  }
  if (!enabled) {
    return (
      <span
        title={disabledHint}
        className={`${base} cursor-not-allowed border-olive-800 text-olive-600`}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-olive-700 text-olive-300 hover:border-olive-500 hover:text-olive-100`}
    >
      {label}
    </Link>
  );
}
