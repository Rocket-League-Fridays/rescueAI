"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonGhost } from "@/components/ui";

/**
 * Shared chrome for both beats. Deliberately stateless: it reads the route, never page state,
 * so neither presenter has to reach across the page boundary to keep it in sync.
 */
export function CommandHeader() {
  const pathname = usePathname() ?? "/";
  const isIncidentPage = pathname.startsWith("/locate/") || pathname.startsWith("/rescue/");

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface-raised/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-accent-400/40 bg-accent-400/10 font-mono text-sm font-semibold text-accent-400 transition-colors group-hover:border-accent-400"
            aria-hidden
          >
            R
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
              RescueAI · SAR
            </span>
            <span className="block truncate text-lg font-semibold tracking-tight text-ink-50">
              Command dashboard
            </span>
          </span>
        </Link>
        {isIncidentPage ? (
          <Link href="/" className={`${buttonGhost} shrink-0`}>
            New incident
          </Link>
        ) : null}
      </div>
    </header>
  );
}
