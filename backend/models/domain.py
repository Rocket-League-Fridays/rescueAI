from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ArtifactKind(str, Enum):
    RAW_VIDEO = "raw_video"
    FRAME = "frame"
    ANNOTATED_FRAME = "annotated_frame"


class DetectionClassName(str, Enum):
    PERSON = "person"
    VEHICLE = "vehicle"
    OTHER = "other"


class IncidentStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


@dataclass(frozen=True)
class GeoPoint:
    lat: float
    lng: float


@dataclass(frozen=True)
class GeoBounds:
    south_west: GeoPoint
    north_east: GeoPoint


@dataclass(frozen=True)
class GimbalOrientation:
    pitch_degrees: float
    yaw_degrees: float
    roll_degrees: float


@dataclass(frozen=True)
class BoundingBox:
    x: float
    y: float
    width: float
    height: float


@dataclass
class DroneTelemetry:
    id: str
    position: GeoPoint
    bounds: GeoBounds
    altitude_meters: float
    heading_degrees: float
    gimbal: GimbalOrientation
    timestamp_utc: datetime
    speed_mps: float | None = None
    battery_percent: float | None = None


@dataclass
class Artifact:
    id: str
    job_id: str
    kind: ArtifactKind
    storage_key: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    frame_index: int | None = None


@dataclass
class Detection:
    id: str
    job_id: str
    class_name: DetectionClassName
    bbox: BoundingBox
    confidence: float
    frame_id: str | None = None
    ground_point: GeoPoint | None = None
    clothing_match_score: float = 0.0


@dataclass
class LandingZone:
    id: str
    job_id: str
    centroid: GeoPoint
    bounds: GeoBounds
    slope_degrees: float
    area_sq_ft: float


@dataclass(frozen=True)
class RouteWaypoint:
    lat: float
    lng: float
    elevation_meters: float


@dataclass
class Route:
    id: str
    job_id: str
    waypoints: list[RouteWaypoint]
    total_cost: float
    landing_zone_id: str | None = None


@dataclass
class Job:
    id: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    telemetry_id: str
    failure_reason: str | None = None
    video_artifact_id: str | None = None
    detection_ids: list[str] = field(default_factory=list)
    landing_zone_ids: list[str] = field(default_factory=list)
    route_id: str | None = None
    incident_id: str | None = None


@dataclass
class SubjectProfile:
    display_name: str
    clothing_colors: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class Incident:
    id: str
    transcript: str
    subject: SubjectProfile
    trail_name: str
    trail_line: list[GeoPoint]
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    situation_id: str | None = None


@dataclass
class SituationAssessment:
    id: str
    job_id: str
    incident_id: str | None
    detection_id: str
    ground_point: GeoPoint
    canopy_fraction: float
    notes: str = ""
