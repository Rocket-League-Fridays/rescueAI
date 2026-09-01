import type { LikelyLocation } from "@/types/incident";
import type { GeoPoint } from "@/types/telemetry";

const DEFAULT_MISSING_MINUTES = 60;
const ON_TRAIL_PACE_MPS = 1.1;
const INJURED_PACE_MPS = 0.7;
const MEDIAN_DISTANCE_M = 700;
const SPREAD_M = 500;
const OFF_TRAIL_STEP_M = 40;
const MIN_SEPARATION_M = 80;
const TOP_N = 5;
const TURN_DEGREES = 35;
const EARTH_M = 6_371_000;

export function scoreLikelyLocations(
  trail: GeoPoint[],
  pls: GeoPoint | null,
  missingMinutes: number,
  transcript: string,
): LikelyLocation[] {
  if (trail.length < 2) {
    return [];
  }
  const minutes = Math.max(1, missingMinutes);
  const lowered = transcript.toLowerCase();
  const injured = ["ankle", "injur", "immobile", "sprain"].some((cue) => lowered.includes(cue));
  const pace = injured ? INJURED_PACE_MPS : ON_TRAIL_PACE_MPS;
  const maxMeters = minutes * 60 * pace;
  const along = alongTrailMeters(trail);
  const snap = pls ? nearestIndex(trail, pls) : 0;
  const plsAlong = along[snap] ?? 0;
  const leftTrail = ["left the trail", "off the trail", "off the main trail", "left the path"].some(
    (cue) => lowered.includes(cue),
  );

  const candidates: LikelyLocation[] = [];
  trail.forEach((point, index) => {
    const distance = Math.abs((along[index] ?? 0) - plsAlong);
    if (distance > maxMeters) {
      return;
    }
    const extras: string[] = [];
    let bonus = 0;
    if (isJunction(trail, index)) {
      bonus += 0.15;
      extras.push("switchback / decision point");
    }
    if (index === 0 || index === trail.length - 1) {
      bonus += 0.08;
      extras.push("trail end");
    }
    if (["switchback"].some((cue) => lowered.includes(cue)) && isJunction(trail, index)) {
      bonus += 0.2;
      extras.push("switchback mentioned");
    }
    if (
      ["viewpoint", "lookout", "overlook"].some((cue) => lowered.includes(cue)) &&
      index >= Math.floor(trail.length * 0.55)
    ) {
      bonus += 0.2;
      extras.push("viewpoint cue");
    }
    if (
      [" the y", "past the y", "below the y", "the y itself", "y mountain"].some((cue) =>
        lowered.includes(cue),
      ) &&
      index >= Math.floor(trail.length * 0.7)
    ) {
      bonus += 0.2;
      extras.push("Y landmark");
    }
    if (["uphill", "up the", "went up"].some((cue) => lowered.includes(cue)) && (along[index] ?? 0) > plsAlong) {
      bonus += 0.1;
      extras.push("uphill of PLS");
    }
    const decay = Math.exp(-0.5 * ((distance - MEDIAN_DISTANCE_M) / SPREAD_M) ** 2);
    const raw = decay + bonus;
    const reason = reasonFor(distance, extras);
    candidates.push({
      point,
      score: raw,
      reason,
      distanceFromPlsMeters: distance,
    });
    if (isJunction(trail, index)) {
      candidates.push({
        point: offsetPerpendicular(trail, index, OFF_TRAIL_STEP_M),
        score: raw + (leftTrail ? 0.12 : 0.06),
        reason: `${reason}; possible leave at decision point`,
        distanceFromPlsMeters: distance,
      });
    }
  });

  const kept = suppressNearDuplicates(candidates);
  const peak = Math.max(...kept.map((location) => location.score), 0);
  if (peak <= 0) {
    return [];
  }
  return kept
    .map((location) => ({
      ...location,
      score: Number((location.score / peak).toFixed(3)),
      distanceFromPlsMeters: Number(location.distanceFromPlsMeters.toFixed(1)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
}

export function resolvedMissingMinutes(stored: number | null | undefined): {
  minutes: number;
  assumed: boolean;
} {
  if (stored == null) {
    return { minutes: DEFAULT_MISSING_MINUTES, assumed: true };
  }
  return { minutes: stored, assumed: false };
}

function reasonFor(distance: number, extras: string[]): string {
  const base = `Along-trail, ${(distance / 1000).toFixed(1)} km from PLS`;
  return extras.length > 0 ? `${base} — ${extras.join(", ")}` : `${base} — time-reachable`;
}

function alongTrailMeters(trail: GeoPoint[]): number[] {
  const distances = [0];
  for (let index = 1; index < trail.length; index += 1) {
    distances.push(distances[index - 1] + haversineMeters(trail[index - 1], trail[index]));
  }
  return distances;
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

function isJunction(trail: GeoPoint[], index: number): boolean {
  if (index <= 0 || index >= trail.length - 1) {
    return false;
  }
  const incoming = bearingDegrees(trail[index - 1], trail[index]);
  const outgoing = bearingDegrees(trail[index], trail[index + 1]);
  const delta = Math.abs(((outgoing - incoming + 180) % 360) - 180);
  return delta >= TURN_DEGREES;
}

function bearingDegrees(start: GeoPoint, end: GeoPoint): number {
  const lat1 = toRad(start.lat);
  const lat2 = toRad(end.lat);
  const dlng = toRad(end.lng - start.lng);
  const x = Math.sin(dlng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlng);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function offsetPerpendicular(trail: GeoPoint[], index: number, meters: number): GeoPoint {
  const start = index <= 0 ? trail[0] : trail[index - 1];
  const end = index <= 0 ? trail[1] : trail[index];
  const bearing = toRad((bearingDegrees(start, end) + 90) % 360);
  const north = meters * Math.cos(bearing);
  const east = meters * Math.sin(bearing);
  const origin = trail[index];
  return {
    lat: origin.lat + north / 111_320,
    lng: origin.lng + east / (111_320 * Math.cos(toRad(origin.lat))),
  };
}

function suppressNearDuplicates(candidates: LikelyLocation[]): LikelyLocation[] {
  const kept: LikelyLocation[] = [];
  [...candidates]
    .sort((a, b) => b.score - a.score)
    .forEach((location) => {
      if (kept.every((other) => haversineMeters(location.point, other.point) >= MIN_SEPARATION_M)) {
        kept.push(location);
      }
    });
  return kept;
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dlat = toRad(b.lat - a.lat);
  const dlng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
