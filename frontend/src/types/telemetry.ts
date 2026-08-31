export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type ArtifactKind = "raw_video" | "frame" | "annotated_frame";

export type DetectionClassName = "person" | "vehicle" | "other";

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
}

export interface LandingZone {
  id: string;
  jobId: string;
  centroid: GeoPoint;
  bounds: GeoBounds;
  slopeDegrees: number;
  areaSqFt: number;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  elevationMeters: number;
}

export interface Route {
  id: string;
  jobId: string;
  waypoints: RouteWaypoint[];
  totalCost: number;
  landingZoneId?: string | null;
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
}

export interface JobDetail extends Job {
  telemetry?: DroneTelemetry | null;
  detections: Detection[];
  landingZones: LandingZone[];
  route?: Route | null;
}

export interface ApiError {
  detail: string;
}
