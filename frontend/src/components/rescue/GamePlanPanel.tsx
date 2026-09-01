"use client";

import { useState, type ReactNode } from "react";

import { ElevationProfile } from "@/components/ElevationProfile";
import {
  buttonSecondary,
  Corners,
  hudPanelClass,
  labelClass,
  Stat,
  StatusChip,
} from "@/components/ui";
import { formatCanopy, formatDistance, formatMinutes } from "@/components/RoutePanel";
import { cumulativeDistances, legForWaypointIndex } from "@/lib/geo";
import { buildRadioBrief, buildRescuePlan, type RescuePlan } from "@/lib/rescue-plan";
import { ROUTE_LEG_COLORS, ROUTE_LEG_LABELS } from "@/lib/route-colors";
import type { IncidentDetail } from "@/types/incident";
import type { GeoPoint, JobDetail, LandingZone, Route } from "@/types/telemetry";

interface GamePlanPanelProps {
  job: JobDetail | null;
  incident: IncidentDetail | null;
  actions?: ReactNode;
}

export function GamePlanPanel({ job, incident, actions }: GamePlanPanelProps) {
  const plan = buildRescuePlan(job, incident);
  const [copied, setCopied] = useState<"brief" | "lz" | "subject" | null>(null);
  const [techOpen, setTechOpen] = useState(false);

  function copy(kind: "brief" | "lz" | "subject", text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
    });
  }

  return (
    <section className={`${hudPanelClass} flex flex-col`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-50">Game plan</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-label text-ink-500">
            {incident?.subject.displayName.toUpperCase() || "NO SUBJECT"}
          </span>
          {actions}
        </div>
      </header>

      {!plan ? (
        <div className="flex min-h-[160px] items-center justify-center p-6">
          <p className="text-center font-mono text-xs text-ink-500">
            No route yet — process a sortie
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Reach subject" value={`~${Math.round(plan.inboundMinutes)} min`} />
            <Stat label="Carry out" value={`~${Math.round(plan.outboundMinutes)} min`} />
            <Stat label="Total" value={`${Math.round(plan.totalMinutes)} min`} />
          </div>

          <ol className="relative ml-2 space-y-3 border-l border-line pl-4">
            <InsertStep
              plan={plan}
              copied={copied === "lz"}
              onCopy={() =>
                plan.insert.coords ? copy("lz", formatPoint(plan.insert.coords)) : undefined
              }
            />
            <MoveStep plan={plan} />
            <SubjectStep
              plan={plan}
              copied={copied === "subject"}
              onCopy={() =>
                plan.subject.coords ? copy("subject", formatPoint(plan.subject.coords)) : undefined
              }
            />
            <ExtractStep plan={plan} />
          </ol>

          {plan.warnings.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {plan.warnings.map((warning) => (
                <StatusChip key={warning} tone="probable">
                  {warning}
                </StatusChip>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => copy("brief", buildRadioBrief(plan))}
            className={`${buttonSecondary} w-full`}
          >
            {copied === "brief" ? "Copied" : "Copy radio brief"}
          </button>

          <div className="border-t border-line-soft pt-2">
            <button
              type="button"
              onClick={() => setTechOpen((open) => !open)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={techOpen}
            >
              <span className={labelClass}>Technical</span>
              <span className="font-mono text-[10px] text-ink-500" aria-hidden>
                {techOpen ? "▾" : "▸"}
              </span>
            </button>
            {techOpen ? (
              <div className="mt-3 space-y-3">
                <LandingZoneDetail
                  zones={plan.landingZones}
                  selectedId={plan.route.landingZoneId ?? null}
                />
                <ElevationProfile route={plan.route} />
                <WaypointTable route={plan.route} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function InsertStep({
  plan,
  copied,
  onCopy,
}: {
  plan: RescuePlan;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <StepCard step="01" phase="Insert" tone="confirm" headline="Land at the pad">
      {!plan.insert.hasPad || !plan.insert.coords ? (
        <p className="text-[13px] leading-relaxed text-ink-300">
          No candidate pads — insert on foot
        </p>
      ) : (
        <>
          <CopyCoords point={plan.insert.coords} copied={copied} onCopy={onCopy} />
          <p className="mt-1 font-mono text-[11px] text-ink-400">
            slope {plan.insert.slopeDegrees?.toFixed(1) ?? "—"}°
            {plan.insert.alternateCount > 0
              ? ` · ${plan.insert.alternateCount} alternate${
                  plan.insert.alternateCount === 1 ? "" : "s"
                }`
              : ""}
          </p>
          {plan.insert.approachBearings.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plan.insert.approachBearings.map((bearing) => (
                <StatusChip key={bearing} tone="confirmed">
                  Approach {Math.round(bearing)}°
                </StatusChip>
              ))}
            </div>
          ) : null}
        </>
      )}
    </StepCard>
  );
}

function MoveStep({ plan }: { plan: RescuePlan }) {
  return (
    <StepCard step="02" phase="Move" tone="signal" headline="Walk to the subject">
      <ul className="space-y-1">
        {plan.move.legs.map((leg, index) => (
          <li key={`${leg.label}-${index}`} className="font-mono text-[11px] text-ink-100">
            Head {leg.cardinal} · {Math.round(leg.distanceMeters)} m · ~
            {formatMinutes(leg.estimatedMinutes)}
            <span className="block text-ink-500">{leg.label}</span>
          </li>
        ))}
      </ul>
      {plan.move.totalAscentMeters > 0 ? (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-label text-ink-500">
          Ascent on the carry {Math.round(plan.move.totalAscentMeters)} m
        </p>
      ) : null}
    </StepCard>
  );
}

function SubjectStep({
  plan,
  copied,
  onCopy,
}: {
  plan: RescuePlan;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <Corners colorClass="text-target">
      <StepCard
        step="03"
        phase="Subject"
        tone="target"
        headline={`Reach ${plan.subjectName}`}
      >
        {plan.subject.coords ? (
          <CopyCoords point={plan.subject.coords} copied={copied} onCopy={onCopy} />
        ) : (
          <p className="text-[13px] text-ink-400">No subject fix</p>
        )}
        {plan.subject.clothingColors.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {plan.subject.clothingColors.map((color) => (
              <StatusChip key={color} tone="critical">
                {color}
              </StatusChip>
            ))}
          </div>
        ) : null}
        <p className="mt-1.5 font-mono text-[11px] text-ink-400">
          {plan.subject.canopyFraction === null
            ? "Canopy unknown"
            : `Canopy ${Math.round(plan.subject.canopyFraction * 100)}% overhead`}
          {plan.subject.clothingMatchPercent === null
            ? ""
            : ` · ${plan.subject.clothingMatchPercent}% clothing`}
        </p>
      </StepCard>
    </Corners>
  );
}

function ExtractStep({ plan }: { plan: RescuePlan }) {
  return (
    <StepCard step="04" phase="Extract" tone="caution" headline="Carry out to the pad">
      <p className="font-mono text-[13px] text-ink-50">
        {formatDistance(plan.extract.distanceMeters)} · ~
        {formatMinutes(plan.extract.estimatedMinutes)} loaded
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
        Route is optimized for the loaded carry, not the walk in.
      </p>
    </StepCard>
  );
}

function StepCard({
  step,
  phase,
  tone,
  headline,
  children,
}: {
  step: string;
  phase: string;
  tone: "confirm" | "signal" | "target" | "caution";
  headline: string;
  children: ReactNode;
}) {
  const marker = {
    confirm: "bg-confirm",
    signal: "bg-signal",
    target: "bg-target",
    caution: "bg-caution",
  }[tone];
  const phaseColor = {
    confirm: "text-confirm",
    signal: "text-signal",
    target: "text-target",
    caution: "text-caution",
  }[tone];

  return (
    <li className="relative">
      <span
        className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${marker}`}
        aria-hidden
      />
      <p className={`font-mono text-[10px] uppercase tracking-label ${phaseColor}`}>
        {step} {phase}
      </p>
      <h4 className="mt-0.5 text-[13px] font-semibold tracking-tight text-ink-50">{headline}</h4>
      <div className="mt-1.5">{children}</div>
    </li>
  );
}

function CopyCoords({
  point,
  copied,
  onCopy,
}: {
  point: GeoPoint;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="font-mono text-[13px] text-signal underline-offset-2 hover:underline"
    >
      {formatPoint(point)}
      <span className="ml-2 text-[10px] uppercase tracking-label text-ink-500">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function formatPoint(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function LandingZoneDetail({
  zones,
  selectedId,
}: {
  zones: LandingZone[];
  selectedId: string | null;
}) {
  const [top, ...rest] = zones;
  if (!top) {
    return (
      <div className="rounded-sm border border-line-soft bg-inset px-3 py-2">
        <p className={labelClass}>Landing zone</p>
        <p className="mt-1 font-mono text-xs text-ink-500">No candidate pads</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-sm border border-line bg-inset px-3 py-2">
        <div className="flex items-baseline justify-between">
          <p className={labelClass}>
            Landing zone {selectedId === top.id ? "· routed" : "· top pick"}
          </p>
          <span className="font-mono text-[11px] text-signal">
            {(top.suitabilityScore * 100).toFixed(0)}% suitable
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-ink-100">
          {top.centroid.lat.toFixed(5)}, {top.centroid.lng.toFixed(5)}
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div>
            <dt className="uppercase tracking-label text-ink-500">Max slope</dt>
            <dd className="mt-0.5 text-ink-100">{top.maxSlopeDegrees.toFixed(1)}°</dd>
          </div>
          <div>
            <dt className="uppercase tracking-label text-ink-500">Area</dt>
            <dd className="mt-0.5 text-ink-100">{Math.round(top.areaSqFt).toLocaleString()} ft²</dd>
          </div>
          <div>
            <dt className="uppercase tracking-label text-ink-500">Canopy</dt>
            <dd className="mt-0.5 text-ink-100">{formatCanopy(top.canopyFraction)}</dd>
          </div>
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
              className="flex items-center justify-between rounded-sm border border-line-soft px-2 py-1 font-mono text-[11px] text-ink-400"
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

function WaypointTable({ route }: { route: Route }) {
  const distances = cumulativeDistances(route.waypoints);

  return (
    <div>
      <p className={labelClass}>Waypoints ({route.waypoints.length})</p>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-sm border border-line-soft">
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
                  <td className="px-2 py-1 text-right">{Math.round(waypoint.elevationMeters)} m</td>
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
