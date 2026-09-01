"use client";

import { useState } from "react";

import { buttonSecondary } from "@/components/ui";
import {
  downloadRoute,
  EXPORT_FORMAT_LABELS,
  type ExportFormat,
  type ExportableRoute,
} from "@/lib/route-export";

const FORMATS: ExportFormat[] = ["geojson", "csv", "kml"];

interface ExportMenuProps {
  route: ExportableRoute | null;
  label?: string;
}

/** Hands the route to whoever flies or walks it. Files are written in the browser. */
export function ExportMenu({ route, label = "Export route" }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const disabled = route === null || route.waypoints.length === 0;

  function handleExport(format: ExportFormat) {
    if (route) {
      downloadRoute(route, format);
    }
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={buttonSecondary}
      >
        {label} ▾
      </button>
      {isOpen && !disabled ? (
        <ul className="absolute right-0 z-[1000] mt-1 w-48 overflow-hidden rounded border border-line bg-surface-raised shadow-lg">
          {FORMATS.map((format) => (
            <li key={format}>
              <button
                type="button"
                onClick={() => handleExport(format)}
                className="block w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-label text-ink-200 transition-colors hover:bg-surface-hover hover:text-accent-300"
              >
                {EXPORT_FORMAT_LABELS[format]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
