"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cumulativeDistances, legForWaypointIndex } from "@/lib/geo";
import { ROUTE_LEG_COLORS, ROUTE_LEG_LABELS } from "@/lib/route-colors";
import type { Route } from "@/types/telemetry";

interface ElevationProfileProps {
  route: Route;
}

interface ElevationDatum {
  distanceMeters: number;
  elevationMeters: number;
  legLabel: string;
  legColor: string;
}

interface ElevationTooltipProps {
  active?: boolean;
  payload?: { payload?: ElevationDatum }[];
}

const MONO_FONT = "var(--font-mono), ui-monospace, monospace";
const AXIS_TICK = { fill: "#5C6E80", fontSize: 10, fontFamily: MONO_FONT };
const AXIS_LINE = { stroke: "rgba(148,163,184,0.14)" };

export function ElevationProfile({ route }: ElevationProfileProps) {
  const waypoints = route.waypoints;

  if (waypoints.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-sm border border-line-soft bg-inset">
        <p className="font-mono text-[11px] uppercase tracking-label text-ink-500">
          Not enough waypoints for a profile
        </p>
      </div>
    );
  }

  const distances = cumulativeDistances(waypoints);
  const data: ElevationDatum[] = waypoints.map((waypoint, index) => {
    const leg = legForWaypointIndex(route.legs, index);
    return {
      distanceMeters: distances[index],
      elevationMeters: waypoint.elevationMeters,
      legLabel: leg ? leg.label || ROUTE_LEG_LABELS[leg.kind] : "—",
      legColor: leg ? ROUTE_LEG_COLORS[leg.kind] : "#5C6E80",
    };
  });

  const elevations = waypoints.map((waypoint) => waypoint.elevationMeters);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  // Real terrain spans tens of metres over kilometres; a zero-based axis flattens it to a line.
  const pad = Math.max(5, (maxElevation - minElevation) * 0.2);
  const yDomain: [number, number] = [
    Math.floor(minElevation - pad),
    Math.ceil(maxElevation + pad),
  ];
  const totalDistance = distances[distances.length - 1];

  function distanceAt(index: number): number {
    const clamped = Math.min(Math.max(index, 0), distances.length - 1);
    return distances[clamped];
  }

  return (
    <div className="rounded-sm border border-line-soft bg-inset py-2 pr-3">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3DD6F5" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3DD6F5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="2 4" vertical={false} />
          {route.legs.map((leg, index) => (
            <ReferenceArea
              key={`${leg.kind}-${leg.startIndex}-${index}`}
              x1={distanceAt(leg.startIndex)}
              x2={distanceAt(leg.endIndex)}
              y1={yDomain[0]}
              y2={yDomain[1]}
              fill={ROUTE_LEG_COLORS[leg.kind]}
              fillOpacity={0.12}
              strokeOpacity={0}
              ifOverflow="extendDomain"
            />
          ))}
          <XAxis
            dataKey="distanceMeters"
            type="number"
            domain={[0, totalDistance]}
            tick={AXIS_TICK}
            tickLine={AXIS_LINE}
            axisLine={AXIS_LINE}
            tickFormatter={formatAxisDistance}
            minTickGap={24}
          />
          <YAxis
            type="number"
            domain={yDomain}
            width={44}
            tick={AXIS_TICK}
            tickLine={AXIS_LINE}
            axisLine={AXIS_LINE}
            tickFormatter={(value: number) => `${Math.round(value)}`}
          />
          <Tooltip
            content={<ElevationTooltip />}
            cursor={{ stroke: "#3DD6F5", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="elevationMeters"
            stroke="#3DD6F5"
            strokeWidth={1.5}
            fill="url(#elevation-fill)"
            dot={false}
            activeDot={{ r: 3, fill: "#3DD6F5", stroke: "#030608" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ElevationTooltip({ active, payload }: ElevationTooltipProps) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) {
    return null;
  }
  return (
    <div className="rounded-sm border border-line hud-glass px-2 py-1.5 font-mono text-[11px] text-ink-100 shadow-panel">
      <p className="flex items-center gap-1.5 uppercase tracking-label text-ink-300">
        <span
          className="inline-block h-2 w-2 rounded-sm"
          style={{ backgroundColor: datum.legColor }}
        />
        {datum.legLabel}
      </p>
      <p className="mt-1">{formatAxisDistance(datum.distanceMeters)} along route</p>
      <p className="text-ink-300">{Math.round(datum.elevationMeters)} m elevation</p>
    </div>
  );
}

function formatAxisDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}
