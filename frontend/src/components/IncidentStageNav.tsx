"use client";

import Link from "next/link";

export type IncidentStage = "locate" | "rescue";

interface IncidentStageNavProps {
  incidentId: string;
  stage: IncidentStage;
  /**
   * Rescue is always reachable; this only flags whether the scan has produced a fix yet. Omit it
   * where readiness is genuinely unknown — the intake landing has not loaded an incident — so the
   * nav reports nothing rather than claiming "no fix yet".
   */
  rescueReady?: boolean;
  /** The intake landing is the Locate beat but lives at `/`, with no incident in the URL. */
  locateHref?: string;
}

/**
 * Both beats are always navigable — an operator can look ahead to the rescue view before the scan
 * lands. Readiness is reported, never enforced.
 */
export function IncidentStageNav({
  incidentId,
  stage,
  rescueReady,
  locateHref,
}: IncidentStageNavProps) {
  return (
    <nav aria-label="Incident stage" className="inline-flex items-stretch border border-line">
      <StageLink
        href={locateHref ?? `/locate/${incidentId}`}
        step="01"
        label="Locate"
        active={stage === "locate"}
      />
      <StageLink
        href={`/rescue/${incidentId}`}
        step="02"
        label="Rescue"
        active={stage === "rescue"}
        state={rescueReady === undefined ? undefined : rescueReady ? "ready" : "waiting"}
        hint={
          rescueReady === undefined
            ? "Open the rescue beat for the last incident in this tab"
            : rescueReady
              ? "Subject fix available"
              : "No subject fix from the scan yet"
        }
      />
    </nav>
  );
}

function StageLink({
  href,
  step,
  label,
  active,
  state,
  hint,
}: {
  href: string;
  step: string;
  label: string;
  active: boolean;
  state?: "ready" | "waiting";
  hint?: string;
}) {
  const dotClass =
    state === "ready"
      ? "bg-status-confirmed"
      : state === "waiting"
        ? "bg-status-stale/60"
        : "hidden";

  return (
    <Link
      href={href}
      title={hint}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "bg-signal/15 text-signal shadow-[inset_0_0_0_1px_rgb(61_214_245_/_0.40)]"
          : "text-ink-400 hover:bg-surface-hover hover:text-ink-50"
      }`}
    >
      <span
        className={`font-mono text-[10px] tracking-label ${active ? "text-signal" : "text-ink-600"}`}
        aria-hidden
      >
        {step}
      </span>
      {label}
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
    </Link>
  );
}
