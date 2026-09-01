"use client";

import type { ReactNode } from "react";

import { ElevationProfile } from "@/components/ElevationProfile";
import { cumulativeDistances, legForWaypointIndex } from "@/lib/geo";
import { ROUTE_LEG_COLORS, ROUTE_LEG_LABELS } from "@/lib/route-colors";
import type { IncidentDetail } from "@/types/incident";
import type { JobDetail, LandingZone, Route } from "@/types/telemetry";

interface RoutePanelProps {
  job: JobDetail | null;
  incident: IncidentDetail | null;
  /** Rendered in the header — the rescue page puts its route export here. */
  actions?: ReactNode;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km / ${Math.round(meters)} m`;
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) {
    return `${total} min`;
  }
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return `${hours} h ${String(remainder).padStart(2, "0")} m`;
}

export function formatAscent(meters: number): string {
  return `${Math.round(meters)} m`;
}

/** `canopyFraction` is null when no overhead-cover estimate covers the pad — unknown, never a measured 0. */
export function formatCanopy(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) {
    return "unknown";
  }
  return `${Math.round(fraction * 100)}%`;
}

export function RoutePanel({ job, incident, actions }: RoutePanelProps) {
  const route = job?.route ?? null;
  const hasRoute = Boolean(route && route.waypoints.length > 0);
  const landingZones = [...(job?.landingZones ?? [])].sort(
    (a, b) => b.suitabilityScore - a.suitabilityScore,
  );

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-100">
          Route to subject
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-500">
            {incident?.subject.displayName.toUpperCase() || "NO SUBJECT"}
          </span>
          {actions}
        </div>
      </header>

      {hasRoute && route ? (
        <div className="space-y-4 p-4">
          <TotalsRow route={route} />
          <LandingZoneSummary zones={landingZones} selectedId={route.landingZoneId ?? null} />
          <LegBreakdown route={route} />
          <ElevationProfile route={route} />
          <WaypointTable route={route} />
        </div>
      ) : (
        <div className="flex min-h-[160px] items-center justify-center p-6">
          <p className="text-center font-mono text-xs text-ink-500">
            No route yet — process a sortie
          </p>
        </div>
      )}
    </section>
  );
}

function TotalsRow({ route }: { route: Route }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Distance" value={formatDistance(route.distanceMeters)} />
      <Stat label="Ascent" value={formatAscent(route.elevationGainMeters)} />
      <Stat label="On foot" value={formatMinutes(route.estimatedMinutes)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line-soft bg-surface-sunken px-2 py-2">
      <p className="font-mono text-[11px] uppercase tracking-label text-ink-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-ink-100">{value}</p>
    </div>
  );
}

function LandingZoneSummary({
  zones,
  selectedId,
}: {
  zones: LandingZone[];
  selectedId: string | null;
}) {
  const [top, ...rest] = zones;

  if (!top) {
    return (
      <div className="rounded border border-line-soft bg-surface-sunken px-3 py-2">
        <SectionLabel>Landing zone</SectionLabel>
        <p className="mt-1 font-mono text-xs text-ink-500">No candidate pads</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded border border-line bg-surface-sunken px-3 py-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>
            Landing zone {selectedId === top.id ? "· routed" : "· top pick"}
          </SectionLabel>
          <span className="font-mono text-[11px] text-accent-300">
            {(top.suitabilityScore * 100).toFixed(0)}% suitable
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-ink-100">
          {top.centroid.lat.toFixed(5)}, {top.centroid.lng.toFixed(5)}
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <Field label="Max slope" value={`${top.maxSlopeDegrees.toFixed(1)}°`} />
          <Field label="Area" value={`${Math.round(top.areaSqFt).toLocaleString()} ft²`} />
          <Field label="Canopy" value={formatCanopy(top.canopyFraction)} />
        </dl>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
          Steepest slope anywhere in the pad, not at the centroid
        </p>
        {top.notes ? <p className="mt-2 text-xs text-ink-300">{top.notes}</p> : null}
      </div>

      {rest.length > 0 ? (
        <ul className="space-y-1">
          {rest.map((zone) => (
            <li
              key={zone.id}
              className="flex items-center justify-between rounded border border-line-soft px-2 py-1 font-mono text-[11px] text-ink-400"
            >
              <span>
                {zone.centroid.lat.toFixed(5)}, {zone.centroid.lng.toFixed(5)}
              </span>
              <span>
                {zone.maxSlopeDegrees.toFixed(1)}° · canopy {formatCanopy(zone.canopyFraction)} ·{" "}
                {(zone.suitabilityScore * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-label text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-100">{value}</dd>
    </div>
  );
}

function LegBreakdown({ route }: { route: Route }) {
  return (
    <div>
      <SectionLabel>Legs</SectionLabel>
      <ul className="mt-2 space-y-1">
        {route.legs.map((leg, index) => (
          <li
            key={`${leg.kind}-${leg.startIndex}-${index}`}
            className="flex items-center gap-2 rounded border border-line-soft bg-surface-sunken px-2 py-1.5"
          >
            <span
              className="h-3 w-1.5 shrink-0 rounded-sm"
              style={{ backgroundColor: ROUTE_LEG_COLORS[leg.kind] }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-ink-100">
              {leg.label || ROUTE_LEG_LABELS[leg.kind]}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-ink-400">
              {Math.round(leg.distanceMeters)} m · +{Math.round(leg.elevationGainMeters)} m ·{" "}
              {formatMinutes(leg.estimatedMinutes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WaypointTable({ route }: { route: Route }) {
  const distances = cumulativeDistances(route.waypoints);

  return (
    <div>
      <SectionLabel>Waypoints ({route.waypoints.length})</SectionLabel>
      <div className="mt-2 max-h-64 overflow-y-auto rounded border border-line-soft">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 bg-surface-sunken">
            <tr className="text-ink-500">
              <th className="px-2 py-1 text-left font-normal uppercase tracking-label">#</th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-label">Lat</th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-label">Lng</th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-label">Elev</th>
              <th className="px-2 py-1 text-right font-normal uppercase tracking-label">Dist</th>
            </tr>
          </thead>
          <tbody>
            {route.waypoints.map((waypoint, index) => {
              const leg = legForWaypointIndex(route.legs, index);
              return (
                <tr key={index} className="border-t border-line-soft/60 text-ink-200">
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-1 rounded-sm"
                        style={{
                          backgroundColor: leg ? ROUTE_LEG_COLORS[leg.kind] : "transparent",
                        }}
                        title={leg ? leg.label || ROUTE_LEG_LABELS[leg.kind] : "unassigned"}
                      />
                      {index}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right">{waypoint.lat.toFixed(5)}</td>
                  <td className="px-2 py-1 text-right">{waypoint.lng.toFixed(5)}</td>
                  <td className="px-2 py-1 text-right">
                    {Math.round(waypoint.elevationMeters)} m
                  </td>
                  <td className="px-2 py-1 text-right text-ink-400">
                    {Math.round(distances[index])} m
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-label text-ink-400">{children}</p>
  );
}
