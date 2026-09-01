import { haversineMeters, offsetMeters } from "@/lib/geo";
import type {
  SearchLeg,
  SearchPlanRequest,
  SearchRoute,
  SearchWaypoint,
} from "@/types/search";

/**
 * PLACEHOLDER, NOT A PLANNER.
 *
 * Draws a plain lawnmower box over the uncertainty circle so the Locate page has honest geometry
 * to render, export, and style against before the real search planner exists. It knows nothing
 * about terrain, airspace, wind, battery, or probability of detection. Every route it produces is
 * badged FIXTURE in the UI. Delete this file once `POST /incidents/{id}/search-route` answers —
 * see `docs/context/07-frontend-seams.md`.
 */

/** Rough horizontal ground swath of a Mini-class camera, as a multiple of altitude. */
const SWATH_PER_ALTITUDE = 1.4;
const CRUISE_MPS = 8;
const TURN_SECONDS = 6;
const MAX_TRANSECTS = 14;

export function planFixtureSearchRoute(request: SearchPlanRequest): SearchRoute {
  const { lastKnown, altitudeAglMeters, overlapPercent } = request;
  const half = Math.max(lastKnown.radiusMeters, 40);
  const swath = Math.max(altitudeAglMeters * SWATH_PER_ALTITUDE, 20);
  const spacing = Math.max(swath * (1 - clamp(overlapPercent, 0, 95) / 100), 15);
  const transects = Math.min(Math.max(Math.ceil((half * 2) / spacing), 2), MAX_TRANSECTS);
  const step = (half * 2) / (transects - 1);

  const waypoints: SearchWaypoint[] = [];
  const legs: SearchLeg[] = [];

  for (let index = 0; index < transects; index += 1) {
    const north = half - index * step;
    const eastward = index % 2 === 0;
    const start = offsetMeters(lastKnown.point, north, eastward ? -half : half);
    const end = offsetMeters(lastKnown.point, north, eastward ? half : -half);

    if (index > 0) {
      const turnStart = waypoints.length - 1;
      waypoints.push({ ...start, altitudeAglMeters });
      legs.push(
        buildLeg("turn", `Turn onto transect ${index + 1}`, turnStart, waypoints.length - 1, waypoints),
      );
    } else {
      waypoints.push({ ...start, altitudeAglMeters });
    }

    const transectStart = waypoints.length - 1;
    waypoints.push({ ...end, altitudeAglMeters });
    legs.push(
      buildLeg("transect", `Transect ${index + 1} of ${transects}`, transectStart, waypoints.length - 1, waypoints),
    );
  }

  const distanceMeters = legs.reduce((total, leg) => total + leg.distanceMeters, 0);
  const estimatedMinutes = legs.reduce((total, leg) => total + leg.estimatedMinutes, 0);

  return {
    id: `fixture-search-${transects}x${Math.round(spacing)}`,
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
      `Placeholder lawnmower box: ${transects} transects at ${Math.round(spacing)} m spacing over a ` +
      `${Math.round(half * 2)} m square. Geometry only — no terrain, airspace, wind, or battery ` +
      `modelling. Replaced by the real planner at POST /incidents/{id}/search-route.`,
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
