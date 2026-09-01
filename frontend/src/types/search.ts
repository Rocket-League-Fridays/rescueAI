import type { GeoPoint } from "@/types/telemetry";

/**
 * Drone search-route contract. Not yet implemented by the backend — see
 * `docs/context/07-frontend-seams.md`. Field names and the `legs[]` partition rule mirror
 * `Route` / `RouteLeg` so `backend/services/gis/route_metrics.py` can be reused.
 */

export type SearchPatternKind = "corridor_sweep" | "expanding_box" | "parallel_track";

export type SearchLegKind = "transit" | "transect" | "turn";

/** Where the subject was last believed to be, and how wide that belief is. */
export interface LastKnownPosition {
  point: GeoPoint;
  radiusMeters: number;
}

export interface SearchPlanRequest {
  incidentId: string;
  lastKnown: LastKnownPosition;
  patternKind: SearchPatternKind;
  altitudeAglMeters: number;
  /** Sidelap between adjacent transects, 0..100. */
  overlapPercent: number;
  /** Committed corridor. When present, corridor/parallel patterns follow this line. */
  trailLine?: GeoPoint[];
  corridorBufferMeters?: number;
  /** Center of the uncertainty circle (likely #1). Box is flown here. */
  boxCenter?: GeoPoint;
}

export interface SearchWaypoint {
  lat: number;
  lng: number;
  /** Height above ground, not MSL — this is a flight plan, not a walk-back. */
  altitudeAglMeters: number;
}

export interface SearchLeg {
  kind: SearchLegKind;
  label: string;
  startIndex: number;
  endIndex: number;
  distanceMeters: number;
  estimatedMinutes: number;
}

export interface SearchRoute {
  id: string;
  incidentId: string;
  jobId?: string | null;
  patternKind: SearchPatternKind;
  altitudeAglMeters: number;
  overlapPercent: number;
  waypoints: SearchWaypoint[];
  /** Contiguous and endpoint-sharing, exactly like `Route.legs`. */
  legs: SearchLeg[];
  distanceMeters: number;
  estimatedMinutes: number;
  coverageAreaSqMeters: number;
  notes: string;
}

export const SEARCH_PATTERN_LABELS: Record<SearchPatternKind, string> = {
  corridor_sweep: "Corridor sweep",
  expanding_box: "Expanding box",
  parallel_track: "Parallel track",
};
