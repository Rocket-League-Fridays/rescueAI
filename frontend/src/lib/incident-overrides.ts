import { createJsonStore, type JsonStore } from "@/lib/session-store";
import type { IncidentDetail } from "@/types/incident";
import type { LastKnownPosition } from "@/types/search";
import type { GeoPoint } from "@/types/telemetry";

/**
 * Operator review layer over what `KeywordTranscriptExtractor` returned.
 *
 * Last-known from a lat/lng pair in the transcript is persisted on the incident. Operator pin
 * drags and corridor-buffer edits still live here until PATCH exists
 * (see `docs/context/07-frontend-data-map.md`).
 */
export interface IncidentOverrides {
  displayName?: string;
  clothingColors?: string[];
  notes?: string;
  corridorBufferMeters?: number;
  lastKnownPoint?: GeoPoint;
  lastKnownRadiusMeters?: number;
}

export type FieldOrigin = "extracted" | "edited";

export type OverridableField =
  | "displayName"
  | "clothingColors"
  | "notes"
  | "corridorBufferMeters";

/** `assumed` means nobody supplied one and the corridor midpoint is standing in. */
export type LastKnownSource = "extracted" | "edited" | "assumed";

export const DEFAULT_LAST_KNOWN_RADIUS_M = 250;

export interface OverrideStore {
  read(incidentId: string): IncidentOverrides;
  write(incidentId: string, overrides: IncidentOverrides): void;
  clear(incidentId: string): void;
}

class StoredOverrideStore implements OverrideStore {
  constructor(private readonly store: JsonStore<IncidentOverrides>) {}

  read(incidentId: string): IncidentOverrides {
    return this.store.read(incidentId) ?? {};
  }

  write(incidentId: string, overrides: IncidentOverrides): void {
    this.store.write(incidentId, overrides);
  }

  clear(incidentId: string): void {
    this.store.clear(incidentId);
  }
}

export function createOverrideStore(): OverrideStore {
  return new StoredOverrideStore(createJsonStore<IncidentOverrides>("rescueai.overrides"));
}

export function applyOverrides(
  incident: IncidentDetail,
  overrides: IncidentOverrides,
): IncidentDetail {
  return {
    ...incident,
    subject: {
      displayName: overrides.displayName ?? incident.subject.displayName,
      clothingColors: overrides.clothingColors ?? incident.subject.clothingColors,
      notes: overrides.notes ?? incident.subject.notes,
    },
    corridorBufferMeters: overrides.corridorBufferMeters ?? incident.corridorBufferMeters,
    lastKnownPoint: overrides.lastKnownPoint ?? incident.lastKnownPoint ?? null,
    lastKnownRadiusMeters:
      overrides.lastKnownRadiusMeters ?? incident.lastKnownRadiusMeters ?? null,
  };
}

export function fieldOrigin(
  overrides: IncidentOverrides,
  field: OverridableField,
): FieldOrigin {
  return overrides[field] === undefined ? "extracted" : "edited";
}

export function withoutField(
  overrides: IncidentOverrides,
  field: OverridableField,
): IncidentOverrides {
  const next = { ...overrides };
  delete next[field];
  return next;
}

export interface ResolvedLastKnown {
  position: LastKnownPosition;
  source: LastKnownSource;
}

/**
 * The pin the operator drags. Falls back to the middle of the trail corridor so there is always
 * something to grab — reported as `assumed` so the UI never implies the caller gave a position.
 */
export function resolveLastKnown(
  incident: IncidentDetail,
  overrides: IncidentOverrides,
): ResolvedLastKnown {
  const radius =
    overrides.lastKnownRadiusMeters ??
    incident.lastKnownRadiusMeters ??
    DEFAULT_LAST_KNOWN_RADIUS_M;

  if (overrides.lastKnownPoint) {
    return { position: { point: overrides.lastKnownPoint, radiusMeters: radius }, source: "edited" };
  }
  if (incident.lastKnownPoint) {
    return {
      position: { point: incident.lastKnownPoint, radiusMeters: radius },
      source: "extracted",
    };
  }
  const fromTranscript = extractLastKnownFromTranscript(incident.transcript);
  if (fromTranscript) {
    return { position: { point: fromTranscript, radiusMeters: radius }, source: "extracted" };
  }
  return {
    position: { point: corridorMidpoint(incident.trailLine), radiusMeters: radius },
    source: "assumed",
  };
}

const COORD_RE = /(-?\d{1,3}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/;

/** Pull the first plausible lat/lng pair out of a distress call. */
export function extractLastKnownFromTranscript(transcript: string): GeoPoint | null {
  const match = COORD_RE.exec(transcript);
  if (match === null) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

function corridorMidpoint(trailLine: GeoPoint[]): GeoPoint {
  if (trailLine.length === 0) {
    return { lat: 40.24555, lng: -111.62815 };
  }
  return trailLine[Math.floor(trailLine.length / 2)];
}
