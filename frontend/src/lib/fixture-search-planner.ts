import { haversineMeters, offsetMeters } from "@/lib/geo";
import type {
  SearchLeg,
  SearchPlanRequest,
  SearchRoute,
  SearchWaypoint,
} from "@/types/search";
import type { GeoPoint } from "@/types/telemetry";

/**
 * PLACEHOLDER, NOT A PLANNER.
 *
 * Corridor sweep: trail to the uncertainty circle, expanding box inside it, then the rest of
 * the trail. Parallel track: three smoothed side passes. Expanding box: lawnmower only.
 */

const SWATH_PER_ALTITUDE = 1.4;
const CRUISE_MPS = 8;
const TURN_SECONDS = 6;
const MAX_TRANSECTS = 14;
const PARALLEL_SIMPLIFY_M = 80;

export function planFixtureSearchRoute(request: SearchPlanRequest): SearchRoute {
  const trail = request.trailLine ?? [];
  if (trail.length >= 2 && request.patternKind === "corridor_sweep") {
    return planCorridorThenBox(request, trail);
  }
  if (trail.length >= 2 && request.patternKind === "parallel_track") {
    return planSmoothedParallels(request, trail);
  }
  return planLawnmowerBox(request);
}

function planCorridorThenBox(request: SearchPlanRequest, trail: GeoPoint[]): SearchRoute {
  const { lastKnown, altitudeAglMeters, overlapPercent } = request;
  const buffer = request.corridorBufferMeters ?? 80;
  const center = request.boxCenter ?? lastKnown.point;
  const radius = Math.max(lastKnown.radiusMeters, 40);
  const snap = nearestIndex(trail, lastKnown.point);
  const line = trail.slice(snap);
  if (line.length < 2) {
    return planLawnmowerBox({ ...request, lastKnown: { point: center, radiusMeters: radius } });
  }

  const window = circleWindow(line, center, radius);
  const entry = window?.entry ?? nearestIndex(line, center);
  const exit = window?.exit ?? entry;
  const waypoints: SearchWaypoint[] = [];
  const legs: SearchLeg[] = [];

  const approach = line.slice(0, entry + 1);
  appendTrack(waypoints, legs, atAltitude(approach, altitudeAglMeters), "Corridor to search circle", "transit");

  const boxHalf = radius / Math.SQRT2;
  lawnmowerPairs(center, boxHalf, altitudeAglMeters, overlapPercent).forEach((pair, index, all) => {
    appendTrack(waypoints, legs, pair, `Box transect ${index + 1} of ${all.length}`, "transect");
  });

  const finish = line.slice(exit);
  appendTrack(waypoints, legs, atAltitude(finish, altitudeAglMeters), "Corridor past search circle", "transit");

  const distanceMeters = legs.reduce((total, leg) => total + leg.distanceMeters, 0);
  const estimatedMinutes = legs.reduce((total, leg) => total + leg.estimatedMinutes, 0);

  return {
    id: `fixture-corridor-box-${Math.round(radius)}`,
    incidentId: request.incidentId,
    jobId: null,
    patternKind: request.patternKind,
    altitudeAglMeters,
    overlapPercent,
    waypoints,
    legs,
    distanceMeters,
    estimatedMinutes,
    coverageAreaSqMeters: alongMeters(line) * buffer * 2 + (boxHalf * 2) ** 2,
    notes:
      `Placeholder: corridor along the trail to the uncertainty circle, expanding box inside ` +
      `the circle (${Math.round(radius)} m), then the remaining trail. Geometry only.`,
  };
}

function planSmoothedParallels(request: SearchPlanRequest, trail: GeoPoint[]): SearchRoute {
  const { lastKnown, altitudeAglMeters, overlapPercent } = request;
  const buffer = request.corridorBufferMeters ?? 80;
  const snap = nearestIndex(trail, lastKnown.point);
  const reachable = trail.slice(snap);
  const spine = simplifyMeters(reachable, PARALLEL_SIMPLIFY_M);
  if (spine.length < 2) {
    return planCorridorThenBox(request, trail);
  }

  const swath = Math.max(altitudeAglMeters * SWATH_PER_ALTITUDE, 20);
  const spacing = Math.min(
    buffer,
    Math.max(swath * (1 - clamp(overlapPercent, 0, 95) / 100), 25),
  );
  const offsets = [-spacing, 0, spacing];
  const waypoints: SearchWaypoint[] = [];
  const legs: SearchLeg[] = [];

  offsets.forEach((offset, track) => {
    const line = spine.map((_, index) => ({
      ...offsetPerpendicular(spine, index, offset),
      altitudeAglMeters,
    }));
    const ordered = track % 2 === 1 ? [...line].reverse() : line;
    appendTrack(waypoints, legs, ordered, `Pass ${track + 1} of 3`, "transect");
  });

  const distanceMeters = legs.reduce((total, leg) => total + leg.distanceMeters, 0);
  const estimatedMinutes = legs.reduce((total, leg) => total + leg.estimatedMinutes, 0);

  return {
    id: `fixture-parallel-3x${Math.round(spacing)}`,
    incidentId: request.incidentId,
    jobId: null,
    patternKind: request.patternKind,
    altitudeAglMeters,
    overlapPercent,
    waypoints,
    legs,
    distanceMeters,
    estimatedMinutes,
    coverageAreaSqMeters: alongMeters(spine) * spacing * 3,
    notes:
      `Placeholder parallel track: three passes beside a simplified trail spine ` +
      `(${Math.round(spacing)} m offset). Switchbacks are smoothed so the path stays readable. ` +
      `Geometry only. Replaced by POST /incidents/{id}/search-route.`,
  };
}

function planLawnmowerBox(request: SearchPlanRequest): SearchRoute {
  const { lastKnown, altitudeAglMeters, overlapPercent } = request;
  const half = Math.max(lastKnown.radiusMeters, 40);
  const waypoints: SearchWaypoint[] = [];
  const legs: SearchLeg[] = [];
  const pairs = lawnmowerPairs(lastKnown.point, half, altitudeAglMeters, overlapPercent);
  pairs.forEach((pair, index) => {
    appendTrack(waypoints, legs, pair, `Transect ${index + 1} of ${pairs.length}`, "transect");
  });

  const distanceMeters = legs.reduce((total, leg) => total + leg.distanceMeters, 0);
  const estimatedMinutes = legs.reduce((total, leg) => total + leg.estimatedMinutes, 0);

  return {
    id: `fixture-search-${pairs.length}x${Math.round(half)}`,
    incidentId: request.incidentId,
    jobId: null,
    patternKind: request.patternKind,
    altitudeAglMeters,
    overlapPercent,
    waypoints,
    legs,
    distanceMeters,
    estimatedMinutes,
    coverageAreaSqMeters: (half * 2) ** 2,
    notes:
      `Placeholder expanding box: ${pairs.length} transects over a ` +
      `${Math.round(half * 2)} m square around last-known. Geometry only.`,
  };
}

function lawnmowerPairs(
  center: GeoPoint,
  half: number,
  altitudeAglMeters: number,
  overlapPercent: number,
): SearchWaypoint[][] {
  const swath = Math.max(altitudeAglMeters * SWATH_PER_ALTITUDE, 20);
  const spacing = Math.max(swath * (1 - clamp(overlapPercent, 0, 95) / 100), 15);
  const transects = Math.min(Math.max(Math.ceil((half * 2) / spacing), 2), MAX_TRANSECTS);
  const step = (half * 2) / (transects - 1);
  const pairs: SearchWaypoint[][] = [];
  for (let index = 0; index < transects; index += 1) {
    const north = half - index * step;
    const eastward = index % 2 === 0;
    const start = offsetMeters(center, north, eastward ? -half : half);
    const end = offsetMeters(center, north, eastward ? half : -half);
    pairs.push([
      { ...start, altitudeAglMeters },
      { ...end, altitudeAglMeters },
    ]);
  }
  return pairs;
}

function atAltitude(points: GeoPoint[], altitudeAglMeters: number): SearchWaypoint[] {
  return points.map((point) => ({ ...point, altitudeAglMeters }));
}

function circleWindow(
  line: GeoPoint[],
  center: GeoPoint,
  radius: number,
): { entry: number; exit: number } | null {
  let entry = -1;
  let exit = -1;
  line.forEach((point, index) => {
    if (haversineMeters(point, center) <= radius) {
      if (entry < 0) {
        entry = index;
      }
      exit = index;
    }
  });
  if (entry < 0 || exit < 0) {
    return null;
  }
  return { entry, exit };
}

function appendTrack(
  waypoints: SearchWaypoint[],
  legs: SearchLeg[],
  points: SearchWaypoint[],
  label: string,
  kind: SearchLeg["kind"] = "transect",
): void {
  if (points.length === 0) {
    return;
  }
  if (waypoints.length === 0) {
    if (points.length < 2) {
      waypoints.push(points[0]);
      return;
    }
    waypoints.push(...points);
    legs.push(buildLeg(kind, label, 0, waypoints.length - 1, waypoints));
    return;
  }
  const turnStart = waypoints.length - 1;
  waypoints.push(points[0]);
  legs.push(buildLeg("turn", `Turn onto ${label}`, turnStart, waypoints.length - 1, waypoints));
  if (points.length < 2) {
    return;
  }
  const runStart = waypoints.length - 1;
  for (let index = 1; index < points.length; index += 1) {
    waypoints.push(points[index]);
  }
  legs.push(buildLeg(kind, label, runStart, waypoints.length - 1, waypoints));
}

function buildLeg(
  kind: SearchLeg["kind"],
  label: string,
  startIndex: number,
  endIndex: number,
  waypoints: SearchWaypoint[],
): SearchLeg {
  let distanceMeters = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    distanceMeters += haversineMeters(waypoints[index], waypoints[index + 1]);
  }
  const seconds = distanceMeters / CRUISE_MPS + (kind === "turn" ? TURN_SECONDS : 0);
  return { kind, label, startIndex, endIndex, distanceMeters, estimatedMinutes: seconds / 60 };
}

function nearestIndex(trail: GeoPoint[], point: GeoPoint): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  trail.forEach((candidate, index) => {
    const distance = haversineMeters(candidate, point);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function offsetPerpendicular(trail: GeoPoint[], index: number, meters: number): GeoPoint {
  if (meters === 0) {
    return trail[index];
  }
  const start = index <= 0 ? trail[0] : trail[index - 1];
  const end = index <= 0 ? trail[1] : trail[index];
  const bearing = bearingDegrees(start, end) + 90;
  const rad = (bearing * Math.PI) / 180;
  return offsetMeters(trail[index], meters * Math.cos(rad), meters * Math.sin(rad));
}

function bearingDegrees(start: GeoPoint, end: GeoPoint): number {
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const dlng = ((end.lng - start.lng) * Math.PI) / 180;
  const x = Math.sin(dlng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlng);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function alongMeters(line: GeoPoint[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    total += haversineMeters(line[index - 1], line[index]);
  }
  return total;
}

function simplifyMeters(points: GeoPoint[], epsilon: number): GeoPoint[] {
  if (points.length < 3) {
    return points;
  }
  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularMeters(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance > epsilon) {
    const left = simplifyMeters(points.slice(0, index + 1), epsilon);
    const right = simplifyMeters(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function perpendicularMeters(point: GeoPoint, start: GeoPoint, end: GeoPoint): number {
  const lat0 = (start.lat * Math.PI) / 180;
  const toEnu = (candidate: GeoPoint) => ({
    east: (candidate.lng - start.lng) * 111_320 * Math.cos(lat0),
    north: (candidate.lat - start.lat) * 111_320,
  });
  const p = toEnu(point);
  const e = toEnu(end);
  const denom = e.east * e.east + e.north * e.north;
  if (denom < 1e-6) {
    return Math.hypot(p.east, p.north);
  }
  const t = Math.max(0, Math.min(1, (p.east * e.east + p.north * e.north) / denom));
  return Math.hypot(p.east - t * e.east, p.north - t * e.north);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
