from __future__ import annotations

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from models.domain import (
    Artifact,
    ArtifactKind,
    BoundingBox,
    Detection,
    DetectionClassName,
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Incident,
    IncidentStatus,
    Job,
    JobStatus,
    LandingZone,
    Route,
    RouteLeg,
    RouteLegKind,
    RouteWaypoint,
    SituationAssessment,
    SubjectProfile,
)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class GeoPointSchema(CamelModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

    def to_domain(self) -> GeoPoint:
        return GeoPoint(lat=self.lat, lng=self.lng)

    @classmethod
    def from_domain(cls, point: GeoPoint) -> Self:
        return cls(lat=point.lat, lng=point.lng)


class GeoBoundsSchema(CamelModel):
    south_west: GeoPointSchema
    north_east: GeoPointSchema

    def to_domain(self) -> GeoBounds:
        return GeoBounds(
            south_west=self.south_west.to_domain(),
            north_east=self.north_east.to_domain(),
        )

    @classmethod
    def from_domain(cls, bounds: GeoBounds) -> Self:
        return cls(
            south_west=GeoPointSchema.from_domain(bounds.south_west),
            north_east=GeoPointSchema.from_domain(bounds.north_east),
        )


class GimbalOrientationSchema(CamelModel):
    pitch_degrees: float = Field(ge=-180, le=180)
    yaw_degrees: float = Field(ge=-180, le=180)
    roll_degrees: float = Field(ge=-180, le=180)

    def to_domain(self) -> GimbalOrientation:
        return GimbalOrientation(
            pitch_degrees=self.pitch_degrees,
            yaw_degrees=self.yaw_degrees,
            roll_degrees=self.roll_degrees,
        )

    @classmethod
    def from_domain(cls, gimbal: GimbalOrientation) -> Self:
        return cls(
            pitch_degrees=gimbal.pitch_degrees,
            yaw_degrees=gimbal.yaw_degrees,
            roll_degrees=gimbal.roll_degrees,
        )


class BoundingBoxSchema(CamelModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)

    def to_domain(self) -> BoundingBox:
        return BoundingBox(x=self.x, y=self.y, width=self.width, height=self.height)

    @classmethod
    def from_domain(cls, bbox: BoundingBox) -> Self:
        return cls(x=bbox.x, y=bbox.y, width=bbox.width, height=bbox.height)


class DroneTelemetryIn(CamelModel):
    position: GeoPointSchema
    bounds: GeoBoundsSchema
    altitude_meters: float = Field(ge=-500, le=40000)
    heading_degrees: float = Field(ge=0, le=360)
    gimbal: GimbalOrientationSchema
    timestamp_utc: datetime
    speed_mps: float | None = Field(default=None, ge=0)
    battery_percent: float | None = Field(default=None, ge=0, le=100)

    def to_domain(self, telemetry_id: str) -> DroneTelemetry:
        return DroneTelemetry(
            id=telemetry_id,
            position=self.position.to_domain(),
            bounds=self.bounds.to_domain(),
            altitude_meters=self.altitude_meters,
            heading_degrees=self.heading_degrees,
            gimbal=self.gimbal.to_domain(),
            timestamp_utc=self.timestamp_utc,
            speed_mps=self.speed_mps,
            battery_percent=self.battery_percent,
        )


class DroneTelemetryOut(DroneTelemetryIn):
    id: str

    @classmethod
    def from_domain(cls, telemetry: DroneTelemetry) -> Self:
        return cls(
            id=telemetry.id,
            position=GeoPointSchema.from_domain(telemetry.position),
            bounds=GeoBoundsSchema.from_domain(telemetry.bounds),
            altitude_meters=telemetry.altitude_meters,
            heading_degrees=telemetry.heading_degrees,
            gimbal=GimbalOrientationSchema.from_domain(telemetry.gimbal),
            timestamp_utc=telemetry.timestamp_utc,
            speed_mps=telemetry.speed_mps,
            battery_percent=telemetry.battery_percent,
        )


class CreateJobRequest(CamelModel):
    telemetry: DroneTelemetryIn
    incident_id: str | None = None


class ArtifactOut(CamelModel):
    id: str
    job_id: str
    kind: ArtifactKind
    storage_key: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    frame_index: int | None = None

    @classmethod
    def from_domain(cls, artifact: Artifact) -> Self:
        return cls(
            id=artifact.id,
            job_id=artifact.job_id,
            kind=artifact.kind,
            storage_key=artifact.storage_key,
            mime_type=artifact.mime_type,
            width=artifact.width,
            height=artifact.height,
            frame_index=artifact.frame_index,
        )


class DetectionOut(CamelModel):
    id: str
    job_id: str
    class_name: DetectionClassName
    bbox: BoundingBoxSchema
    confidence: float = Field(ge=0, le=1)
    frame_id: str | None = None
    ground_point: GeoPointSchema | None = None
    clothing_match_score: float = Field(default=0.0, ge=0, le=1)

    @classmethod
    def from_domain(cls, detection: Detection) -> Self:
        return cls(
            id=detection.id,
            job_id=detection.job_id,
            class_name=detection.class_name,
            bbox=BoundingBoxSchema.from_domain(detection.bbox),
            confidence=detection.confidence,
            frame_id=detection.frame_id,
            ground_point=(
                None
                if detection.ground_point is None
                else GeoPointSchema.from_domain(detection.ground_point)
            ),
            clothing_match_score=detection.clothing_match_score,
        )


class LandingZoneOut(CamelModel):
    id: str
    job_id: str
    centroid: GeoPointSchema
    bounds: GeoBoundsSchema
    max_slope_degrees: float
    area_sq_ft: float = Field(ge=0)
    canopy_fraction: float | None = Field(default=None, ge=0, le=1)
    suitability_score: float = Field(default=0.0, ge=0, le=1)
    notes: str = ""

    @classmethod
    def from_domain(cls, landing_zone: LandingZone) -> Self:
        return cls(
            id=landing_zone.id,
            job_id=landing_zone.job_id,
            centroid=GeoPointSchema.from_domain(landing_zone.centroid),
            bounds=GeoBoundsSchema.from_domain(landing_zone.bounds),
            max_slope_degrees=landing_zone.max_slope_degrees,
            area_sq_ft=landing_zone.area_sq_ft,
            canopy_fraction=landing_zone.canopy_fraction,
            suitability_score=landing_zone.suitability_score,
            notes=landing_zone.notes,
        )


class RouteWaypointSchema(CamelModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    elevation_meters: float

    def to_domain(self) -> RouteWaypoint:
        return RouteWaypoint(
            lat=self.lat,
            lng=self.lng,
            elevation_meters=self.elevation_meters,
        )

    @classmethod
    def from_domain(cls, waypoint: RouteWaypoint) -> Self:
        return cls(
            lat=waypoint.lat,
            lng=waypoint.lng,
            elevation_meters=waypoint.elevation_meters,
        )


class RouteLegSchema(CamelModel):
    kind: RouteLegKind
    label: str
    start_index: int = Field(ge=0)
    end_index: int = Field(ge=0)
    distance_meters: float = Field(ge=0)
    elevation_gain_meters: float = Field(ge=0)
    estimated_minutes: float = Field(ge=0)

    def to_domain(self) -> RouteLeg:
        return RouteLeg(
            kind=self.kind,
            label=self.label,
            start_index=self.start_index,
            end_index=self.end_index,
            distance_meters=self.distance_meters,
            elevation_gain_meters=self.elevation_gain_meters,
            estimated_minutes=self.estimated_minutes,
        )

    @classmethod
    def from_domain(cls, leg: RouteLeg) -> Self:
        return cls(
            kind=leg.kind,
            label=leg.label,
            start_index=leg.start_index,
            end_index=leg.end_index,
            distance_meters=leg.distance_meters,
            elevation_gain_meters=leg.elevation_gain_meters,
            estimated_minutes=leg.estimated_minutes,
        )


class RouteOut(CamelModel):
    id: str
    job_id: str
    waypoints: list[RouteWaypointSchema]
    total_cost: float
    landing_zone_id: str | None = None
    distance_meters: float = Field(default=0.0, ge=0)
    elevation_gain_meters: float = Field(default=0.0, ge=0)
    estimated_minutes: float = Field(default=0.0, ge=0)
    legs: list[RouteLegSchema] = Field(default_factory=list)

    @classmethod
    def from_domain(cls, route: Route) -> Self:
        return cls(
            id=route.id,
            job_id=route.job_id,
            waypoints=[RouteWaypointSchema.from_domain(w) for w in route.waypoints],
            total_cost=route.total_cost,
            landing_zone_id=route.landing_zone_id,
            distance_meters=route.distance_meters,
            elevation_gain_meters=route.elevation_gain_meters,
            estimated_minutes=route.estimated_minutes,
            legs=[RouteLegSchema.from_domain(leg) for leg in route.legs],
        )


class JobOut(CamelModel):
    id: str
    status: JobStatus
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    telemetry_id: str
    video_artifact_id: str | None = None
    detection_ids: list[str]
    landing_zone_ids: list[str]
    route_id: str | None = None
    incident_id: str | None = None

    @classmethod
    def from_domain(cls, job: Job) -> Self:
        return cls(
            id=job.id,
            status=job.status,
            failure_reason=job.failure_reason,
            created_at=job.created_at,
            updated_at=job.updated_at,
            telemetry_id=job.telemetry_id,
            video_artifact_id=job.video_artifact_id,
            detection_ids=list(job.detection_ids),
            landing_zone_ids=list(job.landing_zone_ids),
            route_id=job.route_id,
            incident_id=job.incident_id,
        )


class SituationAssessmentOut(CamelModel):
    id: str
    job_id: str
    incident_id: str | None = None
    detection_id: str
    ground_point: GeoPointSchema
    canopy_fraction: float
    notes: str = ""

    @classmethod
    def from_domain(cls, situation: SituationAssessment) -> Self:
        return cls(
            id=situation.id,
            job_id=situation.job_id,
            incident_id=situation.incident_id,
            detection_id=situation.detection_id,
            ground_point=GeoPointSchema.from_domain(situation.ground_point),
            canopy_fraction=situation.canopy_fraction,
            notes=situation.notes,
        )


class JobDetailOut(JobOut):
    telemetry: DroneTelemetryOut | None = None
    artifacts: list[ArtifactOut] = Field(default_factory=list)
    detections: list[DetectionOut] = Field(default_factory=list)
    landing_zones: list[LandingZoneOut] = Field(default_factory=list)
    route: RouteOut | None = None
    situation: SituationAssessmentOut | None = None


class SubjectProfileSchema(CamelModel):
    display_name: str
    clothing_colors: list[str] = Field(default_factory=list)
    notes: str = ""

    def to_domain(self) -> SubjectProfile:
        return SubjectProfile(
            display_name=self.display_name,
            clothing_colors=list(self.clothing_colors),
            notes=self.notes,
        )

    @classmethod
    def from_domain(cls, subject: SubjectProfile) -> Self:
        return cls(
            display_name=subject.display_name,
            clothing_colors=list(subject.clothing_colors),
            notes=subject.notes,
        )


class CreateIncidentRequest(CamelModel):
    transcript: str = Field(min_length=1)


class IncidentOut(CamelModel):
    id: str
    transcript: str
    subject: SubjectProfileSchema
    trail_name: str
    trail_line: list[GeoPointSchema]
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    situation_id: str | None = None
    corridor_buffer_meters: float = 80

    @classmethod
    def from_domain(cls, incident: Incident, corridor_buffer_meters: float = 80) -> Self:
        return cls(
            id=incident.id,
            transcript=incident.transcript,
            subject=SubjectProfileSchema.from_domain(incident.subject),
            trail_name=incident.trail_name,
            trail_line=[GeoPointSchema.from_domain(point) for point in incident.trail_line],
            status=incident.status,
            created_at=incident.created_at,
            updated_at=incident.updated_at,
            situation_id=incident.situation_id,
            corridor_buffer_meters=corridor_buffer_meters,
        )


class IncidentDetailOut(IncidentOut):
    jobs: list[JobOut] = Field(default_factory=list)
    situation: SituationAssessmentOut | None = None


class FixtureTranscriptOut(CamelModel):
    transcript: str


class ErrorOut(CamelModel):
    detail: str
