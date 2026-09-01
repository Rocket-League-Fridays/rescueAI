"use client";

import type { ReactNode } from "react";

import type { FieldOrigin } from "@/lib/incident-overrides";

/**
 * Type rule for the whole console: mono carries *data* — coordinates, distances, ids, timestamps,
 * status words. Sans carries everything a human reads as language — headings, prose, button labels.
 * Nothing meaningful renders below 11px, because this gets demoed on a projector.
 */

/** Micro-label above a value. Mono, because it labels data. */
export const labelClass = "font-mono text-[11px] uppercase tracking-label text-ink-400";

/** The one high-emphasis action on a panel. Amber is reserved for this and for caution. */
export const buttonPrimary =
  "rounded-md bg-accent-400 px-3 py-2 text-xs font-semibold uppercase tracking-label text-surface-base " +
  "transition-colors hover:bg-accent-300 disabled:cursor-not-allowed disabled:opacity-40";

/** Everything else. Outlined, lights up amber on hover so the affordance is unmistakable. */
export const buttonSecondary =
  "rounded-md border border-line-strong px-3 py-2 text-xs font-semibold uppercase tracking-label text-ink-200 " +
  "transition-colors hover:border-accent-400 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40";

/** Tertiary — quieter border, no amber. For refresh, back, dev affordances. */
export const buttonGhost =
  "rounded-md border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-label text-ink-300 " +
  "transition-colors hover:border-line-strong hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40";

export const inputClass =
  "w-full rounded-md border border-line bg-surface-input px-2.5 py-2 font-mono text-sm text-ink-100 " +
  "outline-none transition-colors placeholder:text-ink-600 focus:border-accent-400";

export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface-raised shadow-panel">
      <PanelHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Split out so panels that manage their own body (map, tables) still get identical chrome. */
export function PanelHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink-100">{title}</h2>
        {subtitle ? <p className="mt-0.5 font-mono text-[11px] text-ink-500">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className={labelClass}>{children}</p>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-surface-sunken px-2.5 py-2">
      <p className="font-mono text-[11px] uppercase tracking-label text-ink-500">{label}</p>
      <p className="mt-1 font-mono text-base text-ink-50">{value}</p>
    </div>
  );
}

export type StatusTone = "confirmed" | "probable" | "searching" | "stale" | "critical" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  confirmed: "border-status-confirmed/50 bg-status-confirmed/10 text-status-confirmed",
  probable: "border-accent-400/50 bg-accent-400/10 text-accent-300",
  searching: "border-status-searching/50 bg-status-searching/10 text-status-searching",
  stale: "border-status-stale/40 bg-status-stale/10 text-status-stale",
  critical: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  neutral: "border-line text-ink-500",
};

/**
 * The single status vocabulary. Everything that reports operational state — scan status, data
 * origin, provenance — renders through this, so one colour never means two things.
 */
export function StatusChip({
  tone,
  children,
  pulse = false,
}: {
  tone: StatusTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-label ${TONE_CLASS[tone]}`}
    >
      {tone === "neutral" ? null : (
        <span
          className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "animate-pulse-ring" : ""}`}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

/** Says whether a value came from the transcript extractor or from the operator's hand. */
export function ProvenanceChip({ origin }: { origin: FieldOrigin | "assumed" }) {
  const tone: StatusTone =
    origin === "edited" ? "probable" : origin === "assumed" ? "neutral" : "stale";
  const label = origin === "edited" ? "Edited" : origin === "assumed" ? "Assumed" : "Auto";
  return <StatusChip tone={tone}>{label}</StatusChip>;
}

export function FieldRow({
  label,
  origin,
  onRevert,
  children,
}: {
  label: string;
  origin: FieldOrigin | "assumed";
  onRevert?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className={labelClass}>{label}</label>
        <ProvenanceChip origin={origin} />
        {origin === "edited" && onRevert ? (
          <button
            type="button"
            onClick={onRevert}
            className="ml-auto text-[11px] font-semibold uppercase tracking-label text-ink-500 underline underline-offset-2 transition-colors hover:text-accent-300"
          >
            Revert
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-line p-6">
      <p className="max-w-sm text-center text-[13px] leading-relaxed text-ink-500">{children}</p>
    </div>
  );
}
