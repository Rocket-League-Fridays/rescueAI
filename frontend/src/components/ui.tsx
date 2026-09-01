"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { FieldOrigin } from "@/lib/incident-overrides";

/**
 * HUD type rule: mono carries data — coordinates, distances, ids, timestamps, status.
 * Sans (Space Grotesk) carries language — headings, prose, button labels.
 */

export const labelClass = "font-mono text-[10px] uppercase tracking-label text-ink-400";

export const hudPanelClass =
  "hud-glass overflow-hidden rounded-sm border border-line shadow-panel";

const chamfer =
  "btn-chamfer px-3 py-2 text-xs font-semibold uppercase tracking-label transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-40";

/** High-emphasis action. Cyan chamfer — reserved for the one next step. */
export const buttonPrimary =
  `${chamfer} bg-signal text-void hover:bg-accent-300`;

/** Confirmed next step (subject fix → rescue). */
export const buttonConfirm =
  `${chamfer} bg-confirm text-void hover:brightness-110`;

export const buttonSecondary =
  "rounded-sm border border-line-strong px-3 py-2 text-xs font-semibold uppercase tracking-label " +
  "text-ink-200 transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-40";

export const buttonGhost =
  "rounded-sm border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-label " +
  "text-ink-300 transition-colors hover:border-line-strong hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40";

export const inputClass =
  "w-full rounded-sm border border-line bg-inset px-2.5 py-2 font-mono text-sm text-ink-50 " +
  "outline-none transition-colors placeholder:text-ink-600 caret-signal focus:border-signal";

export function Corners({
  children,
  className = "",
  colorClass = "text-signal",
}: {
  children?: ReactNode;
  className?: string;
  colorClass?: string;
}) {
  return (
    <div className={`corners ${colorClass} ${className}`}>
      {children}
      <span className="corners-bl" aria-hidden />
      <span className="corners-br" aria-hidden />
    </div>
  );
}

export function HudPanel({
  title,
  subtitle,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  corners = false,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  corners?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const body = (
    <section className={hudPanelClass}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        collapsible={collapsible}
        open={open}
        onToggle={collapsible ? () => setOpen((current) => !current) : undefined}
      />
      {open ? <div className="p-3">{children}</div> : null}
    </section>
  );
  if (!corners) {
    return body;
  }
  return (
    <Corners className="block" colorClass="text-signal">
      {body}
    </Corners>
  );
}

/** Back-compat alias — existing panels keep compiling while they migrate to HudPanel. */
export const Panel = HudPanel;

export function PanelHeader({
  title,
  subtitle,
  actions,
  collapsible,
  open,
  onToggle,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const heading = (
    <div className="min-w-0">
      <h2 className="truncate text-[13px] font-semibold uppercase tracking-wide text-ink-50">
        {title}
      </h2>
      {subtitle ? <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-ink-500">{subtitle}</p> : null}
    </div>
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="font-mono text-[10px] text-ink-500" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          {heading}
        </button>
      ) : (
        heading
      )}
      {actions}
      {collapsible && !onToggle ? (
        <span className="font-mono text-[10px] text-ink-500" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      ) : null}
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className={labelClass}>{children}</p>;
}

function parseStatValue(value: string): { n: number; suffix: string } | null {
  const match = value.match(/^(-?[\d.]+)(.*)$/);
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  if (!Number.isFinite(n)) {
    return null;
  }
  return { n, suffix: match[2] };
}

export function useCountUp(value: number, durationMs = 500): number {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(from + (value - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return shown;
}

export function Stat({ label, value }: { label: string; value: string }) {
  const parsed = parseStatValue(value);
  const counted = useCountUp(parsed?.n ?? 0);
  const display =
    parsed === null
      ? value
      : Number.isInteger(parsed.n)
        ? `${Math.round(counted)}${parsed.suffix}`
        : `${counted.toFixed(2)}${parsed.suffix}`;

  return (
    <div className="rounded-sm border border-line-soft bg-inset px-2.5 py-2">
      <p className={labelClass}>{label}</p>
      <p className="mt-1 font-mono text-base text-ink-50">{display}</p>
    </div>
  );
}

export type StatusTone = "confirmed" | "probable" | "searching" | "stale" | "critical" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  confirmed: "border-status-confirmed/50 bg-status-confirmed/10 text-status-confirmed",
  probable: "border-status-probable/50 bg-status-probable/10 text-status-probable",
  searching: "border-status-searching/50 bg-status-searching/10 text-status-searching",
  stale: "border-status-stale/40 bg-status-stale/10 text-status-stale",
  critical: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  neutral: "border-line text-ink-500",
};

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
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-label ${TONE_CLASS[tone]}`}
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
            className="ml-auto text-[10px] font-semibold uppercase tracking-label text-ink-500 underline underline-offset-2 transition-colors hover:text-signal"
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
    <div className="flex min-h-[120px] items-center justify-center rounded-sm border border-dashed border-line p-6">
      <p className="max-w-sm text-center text-[13px] leading-relaxed text-ink-500">{children}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 border-y border-status-critical/50 bg-status-critical/10 px-3 py-2 text-[13px] text-status-critical">
      {message}
    </div>
  );
}
