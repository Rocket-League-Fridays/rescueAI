export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type ArtifactKind = "raw_video" | "frame" | "annotated_frame";

export type DetectionClassName = "person" | "vehicle" | "other";

export type RouteLegKind = "subject_link" | "off_trail" | "on_trail";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  southWest: GeoPoint;
  northEast: GeoPoint;
}

export interface GimbalOrientation {
  pitchDegrees: number;
  yawDegrees: number;
  rollDegrees: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DroneTelemetryIn {
  position: GeoPoint;
  bounds: GeoBounds;
  altitudeMeters: number;
  headingDegrees: number;
  gimbal: GimbalOrientation;
  timestampUtc: string;
  speedMps?: number | null;
  batteryPercent?: number | null;
}

export interface DroneTelemetry extends DroneTelemetryIn {
  id: string;
}

export interface CreateJobRequest {
  telemetry: DroneTelemetryIn;
  incidentId?: string | null;
}

export interface Artifact {
  id: string;
  jobId: string;
  kind: ArtifactKind;
  storageKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  frameIndex?: number | null;
}

export interface Detection {
  id: string;
  jobId: string;
  className: DetectionClassName;
  bbox: BoundingBox;
  confidence: number;
  frameId?: string | null;
  groundPoint?: GeoPoint | null;
  clothingMatchScore?: number;
}

export interface LandingZone {
  id: string;
  jobId: string;
  centroid: GeoPoint;
  bounds: GeoBounds;
  /** Steepest slope anywhere inside `bounds`, not the slope at `centroid`. */
  maxSlopeDegrees: number;
  areaSqFt: number;
  /** null when no overhead-cover estimate covers this site — not the same as a measured 0. */
  canopyFraction?: number | null;
  /** 0..1, higher is better. Read `notes` for which criteria it accounts for. */
  suitabilityScore: number;
  notes: string;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  elevationMeters: number;
}

export interface RouteLeg {
  kind: RouteLegKind;
  label: string;
  startIndex: number;
  endIndex: number;
  distanceMeters: number;
  elevationGainMeters: number;
  estimatedMinutes: number;
}

export interface Route {
  id: string;
  jobId: string;
  waypoints: RouteWaypoint[];
  /** Search cost the router minimized (distance plus terrain penalties), not a distance. */
  totalCost: number;
  landingZoneId?: string | null;
  distanceMeters: number;
  elevationGainMeters: number;
  estimatedMinutes: number;
  legs: RouteLeg[];
}

export interface Job {
  id: string;
  status: JobStatus;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  telemetryId: string;
  videoArtifactId?: string | null;
  detectionIds: string[];
  landingZoneIds: string[];
  routeId?: string | null;
  incidentId?: string | null;
}

export interface SituationAssessment {
  id: string;
  jobId: string;
  incidentId?: string | null;
  detectionId: string;
  groundPoint: GeoPoint;
  canopyFraction: number;
  notes: string;
}

export interface JobDetail extends Job {
  telemetry?: DroneTelemetry | null;
  detections: Detection[];
  landingZones: LandingZone[];
  route?: Route | null;
  situation?: SituationAssessment | null;
}

export interface ApiError {
  detail: string;
}
