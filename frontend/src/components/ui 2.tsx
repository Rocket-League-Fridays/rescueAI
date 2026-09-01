"use client";

import type { ReactNode } from "react";

import type { FieldOrigin } from "@/lib/incident-overrides";

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
    <section className="overflow-hidden rounded-lg border border-olive-700 bg-tactical-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-olive-800 px-3 py-2">
        <div className="min-w-0">
          <h2 className="font-mono text-xs uppercase tracking-widest text-olive-200">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 font-mono text-[10px] text-olive-500">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-widest text-olive-400">{children}</p>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-olive-800 bg-tactical-950 px-2 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-olive-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-olive-100">{value}</p>
    </div>
  );
}

/** Says whether a value came from the transcript extractor or from the operator's hand. */
export function ProvenanceChip({ origin }: { origin: FieldOrigin | "assumed" }) {
  const style =
    origin === "edited"
      ? "border-amber-500 text-amber-300"
      : origin === "assumed"
        ? "border-olive-700 text-olive-500"
        : "border-olive-600 text-olive-400";
  const label = origin === "edited" ? "Edited" : origin === "assumed" ? "Assumed" : "Auto";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${style}`}
    >
      {label}
    </span>
  );
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
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] uppercase tracking-widest text-olive-400">
          {label}
        </label>
        <ProvenanceChip origin={origin} />
        {origin === "edited" && onRevert ? (
          <button
            type="button"
            onClick={onRevert}
            className="ml-auto font-mono text-[9px] uppercase tracking-widest text-olive-500 underline hover:text-olive-300"
          >
            Revert
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded border border-olive-700 bg-tactical-800 px-2 py-1.5 text-sm text-olive-100 outline-none focus:border-olive-500";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded border border-dashed border-olive-800 p-6">
      <p className="text-center font-mono text-xs text-olive-500">{children}</p>
    </div>
  );
}
