import type { IncidentDetail } from "@/types/incident";
import type {
  Detection,
  DroneTelemetry,
  GeoPoint,
  Job,
  JobDetail,
  LandingZone,
  Route,
  RouteLeg,
  RouteWaypoint,
  SituationAssessment,
} from "@/types/telemetry";

const INCIDENT_ID = "6f2a1c34-9b07-4e51-8d2a-0c7f4b19ae23";
const JOB_ID = "b41d7e08-3c66-4a92-9f10-5d8e2a7c4b31";
const TELEMETRY_ID = "1d90c5a7-42fb-4c8e-b3d6-7e015af92c48";
const ROUTE_ID = "8ac3f512-6d94-4b70-a1e8-92c5d3407f6b";
const VIDEO_ARTIFACT_ID = "c58b2d61-70a4-4f39-8e2c-b6417d905ea2";

const DETECTION_SUBJECT_ID = "2e7f8b40-15c9-4d63-ae82-3f04c71b9d55";
const DETECTION_SECOND_PERSON_ID = "9c04a6f2-8e31-4b57-92d0-6a5f8c31e740";
const DETECTION_OTHER_ID = "47b1e9c5-2a68-4f04-b19d-8c73e0562af1";

const LZ_BENCH_ID = "5a8d31f6-0e42-4c97-b6a1-27d94f83c015";
const LZ_SADDLE_ID = "d3f70a18-64b2-49e5-8c03-1b5e7a9246df";
const LZ_SWITCHBACK_ID = "0b62c94e-8fa1-4d36-a750-e34c81f6207b";

const SUBJECT_POINT: GeoPoint = { lat: 40.25215, lng: -111.61845 };

const trailLine: GeoPoint[] = [
  { lat: 40.24555, lng: -111.62815 },
  { lat: 40.2459, lng: -111.6274 },
  { lat: 40.24625, lng: -111.6268 },
  { lat: 40.24665, lng: -111.6262 },
  { lat: 40.24705, lng: -111.62555 },
  { lat: 40.2474, lng: -111.6249 },
  { lat: 40.2478, lng: -111.6243 },
  { lat: 40.24815, lng: -111.6237 },
  { lat: 40.24855, lng: -111.6231 },
  { lat: 40.24895, lng: -111.6225 },
  { lat: 40.24935, lng: -111.6219 },
  { lat: 40.24975, lng: -111.6214 },
  { lat: 40.25015, lng: -111.6209 },
  { lat: 40.25055, lng: -111.6205 },
  { lat: 40.25095, lng: -111.6201 },
  { lat: 40.25125, lng: -111.6197 },
  { lat: 40.25145, lng: -111.61945 },
];

const waypoints: RouteWaypoint[] = [
  { lat: 40.25215, lng: -111.61845, elevationMeters: 2068 },
  { lat: 40.252, lng: -111.6188, elevationMeters: 2061 },
  { lat: 40.25182, lng: -111.61915, elevationMeters: 2072 },
  { lat: 40.2516, lng: -111.6195, elevationMeters: 2079 },
  { lat: 40.2514, lng: -111.61962, elevationMeters: 2070 },
  { lat: 40.2512, lng: -111.61975, elevationMeters: 2058 },
  { lat: 40.25105, lng: -111.61988, elevationMeters: 2049 },
  { lat: 40.25095, lng: -111.6201, elevationMeters: 2041 },
  { lat: 40.25055, lng: -111.6205, elevationMeters: 2018 },
  { lat: 40.25015, lng: -111.6209, elevationMeters: 2023 },
  { lat: 40.24975, lng: -111.6214, elevationMeters: 1998 },
  { lat: 40.24935, lng: -111.6219, elevationMeters: 1974 },
];

// Distance/gain/minutes below were computed from these waypoints with the
// backend route_metrics math (haversine at R=6371000, positive-delta gain only,
// Naismith 12 min/km + 10 min/100 m, pace 1.6 off-trail/subject-link, 1.0 on-trail).
const legs: RouteLeg[] = [
  {
    kind: "subject_link",
    label: "Subject to bench landing zone",
    startIndex: 0,
    endIndex: 3,
    distanceMeters: 108.36,
    elevationGainMeters: 18,
    estimatedMinutes: 4.96,
  },
  {
    kind: "off_trail",
    label: "Bench descent to trail junction",
    startIndex: 3,
    endIndex: 7,
    distanceMeters: 91.01,
    elevationGainMeters: 0,
    estimatedMinutes: 1.75,
  },
  {
    kind: "on_trail",
    label: "Y Mountain Trail walk-back toward trailhead",
    startIndex: 7,
    endIndex: 11,
    distanceMeters: 234.85,
    elevationGainMeters: 5,
    estimatedMinutes: 3.32,
  },
];

const route: Route = {
  id: ROUTE_ID,
  jobId: JOB_ID,
  waypoints,
  totalCost: 712.4,
  landingZoneId: LZ_BENCH_ID,
  distanceMeters: 434.22,
  elevationGainMeters: 23,
  estimatedMinutes: 10.03,
  legs,
};

const landingZones: LandingZone[] = [
  {
    id: LZ_BENCH_ID,
    jobId: JOB_ID,
    centroid: { lat: 40.2516, lng: -111.6195 },
    bounds: {
      southWest: { lat: 40.251463, lng: -111.619679 },
      northEast: { lat: 40.251737, lng: -111.619321 },
    },
    maxSlopeDegrees: 4.2,
    areaSqFt: 9977.5,
    canopyFraction: 0.08,
    suitabilityScore: 0.87,
    notes:
      "Scored on slope only: 4.2 deg max across the pad is the flattest bench in the corridor. Canopy 8% is reported for context and does not feed the score.",
  },
  {
    id: LZ_SADDLE_ID,
    jobId: JOB_ID,
    centroid: { lat: 40.25085, lng: -111.62025 },
    bounds: {
      southWest: { lat: 40.250713, lng: -111.620429 },
      northEast: { lat: 40.250987, lng: -111.620071 },
    },
    maxSlopeDegrees: 9.6,
    areaSqFt: 9977.5,
    canopyFraction: null,
    suitabilityScore: 0.61,
    notes:
      "Scored on slope only: 9.6 deg max, usable but tilted. Canopy is unknown here (no overhead-cover estimate covers this site), so cover was not assessed either way.",
  },
  {
    id: LZ_SWITCHBACK_ID,
    jobId: JOB_ID,
    centroid: { lat: 40.24995, lng: -111.6211 },
    bounds: {
      southWest: { lat: 40.249813, lng: -111.621279 },
      northEast: { lat: 40.250087, lng: -111.620921 },
    },
    maxSlopeDegrees: 15.1,
    areaSqFt: 9977.5,
    canopyFraction: 0.34,
    suitabilityScore: 0.34,
    notes:
      "Scored on slope only: 15.1 deg max across the switchback shelf, marginal for a wheeled litter. Canopy 34% is informational and is not part of the score.",
  },
];

const detections: Detection[] = [
  {
    id: DETECTION_SUBJECT_ID,
    jobId: JOB_ID,
    className: "person",
    bbox: { x: 1884, y: 1042, width: 96, height: 214 },
    confidence: 0.91,
    frameId: "frame_000412",
    groundPoint: SUBJECT_POINT,
    clothingMatchScore: 0.61,
  },
  {
    id: DETECTION_SECOND_PERSON_ID,
    jobId: JOB_ID,
    className: "person",
    bbox: { x: 2640, y: 1508, width: 72, height: 168 },
    confidence: 0.74,
    frameId: "frame_000412",
    groundPoint: { lat: 40.25102, lng: -111.62002 },
    clothingMatchScore: 0.12,
  },
  {
    id: DETECTION_OTHER_ID,
    jobId: JOB_ID,
    className: "other",
    bbox: { x: 1502, y: 2210, width: 148, height: 96 },
    confidence: 0.55,
    frameId: "frame_000418",
    groundPoint: { lat: 40.25188, lng: -111.6191 },
    clothingMatchScore: 0,
  },
];

const situation: SituationAssessment = {
  id: "e91c4b27-5d38-4a06-8f72-c3b0146ed85a",
  jobId: JOB_ID,
  incidentId: INCIDENT_ID,
  detectionId: DETECTION_SUBJECT_ID,
  groundPoint: SUBJECT_POINT,
  canopyFraction: 0.42,
  notes:
    "Subject located ~110 m off-trail above the upper switchbacks, seated on scree at the head of a shallow gully. Red jacket over black pants matches the caller description. Partial canopy overhead, so hoist is not advised; nearest flat bench is 108 m downslope.",
};

const telemetry: DroneTelemetry = {
  id: TELEMETRY_ID,
  position: { lat: 40.25148, lng: -111.61932 },
  bounds: {
    southWest: { lat: 40.24902, lng: -111.62241 },
    northEast: { lat: 40.25394, lng: -111.61623 },
  },
  altitudeMeters: 118.5,
  headingDegrees: 214.7,
  gimbal: { pitchDegrees: -62.5, yawDegrees: 214.7, rollDegrees: 0 },
  timestampUtc: "2026-08-30T18:42:11Z",
  speedMps: 3.4,
  batteryPercent: 68,
};

const job: Job = {
  id: JOB_ID,
  status: "completed",
  failureReason: null,
  createdAt: "2026-08-30T18:41:52Z",
  updatedAt: "2026-08-30T18:43:07Z",
  telemetryId: TELEMETRY_ID,
  videoArtifactId: VIDEO_ARTIFACT_ID,
  detectionIds: [DETECTION_SUBJECT_ID, DETECTION_SECOND_PERSON_ID, DETECTION_OTHER_ID],
  landingZoneIds: [LZ_BENCH_ID, LZ_SADDLE_ID, LZ_SWITCHBACK_ID],
  routeId: ROUTE_ID,
  incidentId: INCIDENT_ID,
};

export const mockJobDetail: JobDetail = {
  ...job,
  telemetry,
  detections,
  landingZones,
  route,
  situation,
};

export const mockIncidentDetail: IncidentDetail = {
  id: INCIDENT_ID,
  transcript:
    "Dispatch, this is Provo Canyon SAR intake. Caller reports her hiking partner Josh did not come down from the Y Mountain Trail. They started up from the Y Trailhead around 4 p.m., separated near the top of the switchbacks about an hour later. Josh was wearing a red rain jacket and black hiking pants, carrying a small gray daypack. He has a turned ankle from a fall last month. Last phone contact was a dropped call around 5:50 p.m.; she believes he went uphill past the Y itself and off the main trail. No overnight gear.",
  subject: {
    displayName: "Josh",
    clothingColors: ["red", "black"],
    notes:
      "Male, approx. 20s, red rain jacket and black hiking pants with a gray daypack. Recent ankle injury, likely slow or immobile. No overnight gear, no working phone.",
  },
  trailName: "Y Mountain Trail",
  trailLine,
  status: "open",
  createdAt: "2026-08-30T18:20:34Z",
  updatedAt: "2026-08-30T18:43:07Z",
  situationId: situation.id,
  corridorBufferMeters: 80,
  jobs: [job],
  situation,
};
