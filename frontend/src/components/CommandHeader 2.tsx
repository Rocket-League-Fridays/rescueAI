"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shared chrome for both beats. Deliberately stateless: it reads the route, never page state,
 * so neither presenter has to reach across the page boundary to keep it in sync.
 */
export function CommandHeader() {
  const pathname = usePathname() ?? "/";
  const isIncidentPage = pathname.startsWith("/locate/") || pathname.startsWith("/rescue/");

  return (
    <header className="border-b border-olive-800 bg-tactical-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-olive-400">
            RescueAI · SAR
          </p>
          <h1 className="truncate text-lg font-semibold text-olive-50">Command dashboard</h1>
        </Link>
        {isIncidentPage ? (
          <Link
            href="/"
            className="shrink-0 rounded border border-olive-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-olive-300 hover:border-olive-500 hover:text-olive-100"
          >
            New incident
          </Link>
        ) : null}
      </div>
    </header>
  );
}
