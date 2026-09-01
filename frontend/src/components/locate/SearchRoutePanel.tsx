"use client";

import { ExportMenu } from "@/components/ExportMenu";
import { EmptyState, SectionLabel, Stat } from "@/components/ui";
import { SEARCH_LEG_COLORS, SEARCH_LEG_LABELS } from "@/lib/route-colors";
import { searchRouteToExportable } from "@/lib/route-export";
import { SEARCH_PATTERN_LABELS, type SearchRoute } from "@/types/search";

interface SearchRoutePanelProps {
  route: SearchRoute | null;
  incidentLabel: string;
  plannerMessage: string | null;
}

export function SearchRoutePanel({ route, incidentLabel, plannerMessage }: SearchRoutePanelProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface-raised shadow-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-100">
            Drone search route
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-ink-500">
            {route ? SEARCH_PATTERN_LABELS[route.patternKind] : "NOT PLANNED"}
          </p>
        </div>
        <ExportMenu
          route={route ? searchRouteToExportable(route, incidentLabel) : null}
          label="Export for operator"
        />
      </header>

      {route === null ? (
        <div className="p-4">
          <EmptyState>
            {plannerMessage ?? "No search route yet — set the pin and plan a scan"}
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Track" value={formatMeters(route.distanceMeters)} />
            <Stat label="Flight time" value={`${Math.round(route.estimatedMinutes)} min`} />
            <Stat label="Altitude" value={`${Math.round(route.altitudeAglMeters)} m AGL`} />
            <Stat label="Coverage" value={formatArea(route.coverageAreaSqMeters)} />
          </div>

          <div>
            <SectionLabel>Legs ({route.legs.length})</SectionLabel>
            <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
              {route.legs.map((leg, index) => (
                <li
                  key={`${leg.kind}-${leg.startIndex}-${index}`}
                  className="flex items-center gap-2 rounded border border-line-soft bg-surface-sunken px-2 py-1.5"
                >
                  <span
                    className="h-3 w-1.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: SEARCH_LEG_COLORS[leg.kind] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-100">
                    {leg.label || SEARCH_LEG_LABELS[leg.kind]}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-400">
                    {Math.round(leg.distanceMeters)} m · {leg.estimatedMinutes.toFixed(1)} min
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionLabel>Waypoints ({route.waypoints.length})</SectionLabel>
            <div className="mt-2 max-h-52 overflow-y-auto rounded border border-line-soft">
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead className="sticky top-0 bg-surface-sunken">
                  <tr className="text-ink-500">
                    <th className="px-2 py-1 text-left font-normal uppercase tracking-label">#</th>
                    <th className="px-2 py-1 text-right font-normal uppercase tracking-label">
                      Lat
                    </th>
                    <th className="px-2 py-1 text-right font-normal uppercase tracking-label">
                      Lng
                    </th>
                    <th className="px-2 py-1 text-right font-normal uppercase tracking-label">
                      AGL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {route.waypoints.map((waypoint, index) => (
                    <tr key={index} className="border-t border-line-soft/60 text-ink-200">
                      <td className="px-2 py-1">{index}</td>
                      <td className="px-2 py-1 text-right">{waypoint.lat.toFixed(5)}</td>
                      <td className="px-2 py-1 text-right">{waypoint.lng.toFixed(5)}</td>
                      <td className="px-2 py-1 text-right text-ink-400">
                        {Math.round(waypoint.altitudeAglMeters)} m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {route.notes ? <p className="text-xs text-ink-400">{route.notes}</p> : null}
        </div>
      )}
    </section>
  );
}

function formatMeters(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

function formatArea(squareMeters: number): string {
  const hectares = squareMeters / 10_000;
  return hectares >= 1 ? `${hectares.toFixed(1)} ha` : `${Math.round(squareMeters)} m²`;
}
