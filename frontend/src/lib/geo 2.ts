import type { RouteLeg, RouteWaypoint } from "@/types/telemetry";

const EARTH_RADIUS_M = 6_371_000;

/** Mirrors `backend/services/gis/route_metrics.py:haversine_m` so readouts match backend totals. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Running along-path distance for each waypoint; index 0 is always 0. */
export function cumulativeDistances(waypoints: RouteWaypoint[]): number[] {
  const distances: number[] = [];
  let total = 0;
  waypoints.forEach((waypoint, index) => {
    if (index > 0) {
      total += haversineMeters(waypoints[index - 1], waypoint);
    }
    distances.push(total);
  });
  return distances;
}

export function legForWaypointIndex(legs: RouteLeg[], index: number): RouteLeg | null {
  return legs.find((leg) => index >= leg.startIndex && index <= leg.endIndex) ?? null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Offsets a point by a north/east distance in meters (flat-earth, fine at search-area scale). */
export function offsetMeters(
  point: { lat: number; lng: number },
  northMeters: number,
  eastMeters: number,
): { lat: number; lng: number } {
  const latDegrees = (northMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDegrees =
    (eastMeters / (EARTH_RADIUS_M * Math.cos(toRadians(point.lat)))) * (180 / Math.PI);
  return { lat: point.lat + latDegrees, lng: point.lng + lngDegrees };
}
