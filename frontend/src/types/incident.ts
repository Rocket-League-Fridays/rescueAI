import type { GeoPoint, Job, SituationAssessment } from "@/types/telemetry";

export type IncidentStatus = "open" | "closed";

export interface SubjectProfile {
  displayName: string;
  clothingColors: string[];
  notes: string;
}

export interface Incident {
  id: string;
  transcript: string;
  subject: SubjectProfile;
  trailName: string;
  trailLine: GeoPoint[];
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  situationId?: string | null;
  corridorBufferMeters: number;
  /**
   * Operator's approximate last-known position for the subject. Optional because the backend
   * does not persist it yet (see `docs/context/07-frontend-seams.md`); until it does, the
   * frontend keeps it in the override layer.
   */
  lastKnownPoint?: GeoPoint | null;
  lastKnownRadiusMeters?: number | null;
  /** Set once a search route has been planned for this incident. */
  searchRouteId?: string | null;
}

export interface IncidentDetail extends Incident {
  jobs: Job[];
  situation?: SituationAssessment | null;
}

export interface CreateIncidentRequest {
  transcript: string;
}

export interface FixtureTranscript {
  transcript: string;
}
