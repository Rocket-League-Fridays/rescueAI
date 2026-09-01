import type { IncidentDetail } from "@/types/incident";
import type { CreateJobRequest } from "@/types/telemetry";
import type { LastKnownPosition } from "@/types/search";

const Y_TRAILHEAD = { lat: 40.24555, lng: -111.62815 };

/**
 * Telemetry stub for a sortie the operator attaches by hand. The real values arrive from the
 * DJI `.SRT` sidecar when a file is dropped in the inbox; this only has to be valid enough for
 * `POST /telemetry` to accept and for the job to attach to the incident.
 */
export function sortieRequest(
  incident: IncidentDetail | null,
  lastKnown: LastKnownPosition | null,
  altitudeAglMeters = 120,
): CreateJobRequest {
  const start = lastKnown?.point ?? incident?.trailLine[0] ?? Y_TRAILHEAD;
  const spread = Math.max((lastKnown?.radiusMeters ?? 250) / 111_000, 0.005);
  return {
    incidentId: incident?.id,
    telemetry: {
      position: start,
      bounds: {
        southWest: { lat: start.lat - spread, lng: start.lng - spread },
        northEast: { lat: start.lat + spread, lng: start.lng + spread },
      },
      altitudeMeters: altitudeAglMeters,
      headingDegrees: 45,
      gimbal: { pitchDegrees: -45, yawDegrees: 0, rollDegrees: 0 },
      timestampUtc: new Date().toISOString(),
    },
  };
}
