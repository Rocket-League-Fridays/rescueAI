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
