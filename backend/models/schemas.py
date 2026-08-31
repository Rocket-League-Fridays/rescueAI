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
    Job,
    JobStatus,
    LandingZone,
    Route,
    RouteWaypoint,
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

    @classmethod
    def from_domain(cls, detection: Detection) -> Self:
        return cls(
            id=detection.id,
            job_id=detection.job_id,
            class_name=detection.class_name,
            bbox=BoundingBoxSchema.from_domain(detection.bbox),
            confidence=detection.confidence,
            frame_id=detection.frame_id,
        )


class LandingZoneOut(CamelModel):
    id: str
    job_id: str
    centroid: GeoPointSchema
    bounds: GeoBoundsSchema
    slope_degrees: float
    area_sq_ft: float

    @classmethod
    def from_domain(cls, landing_zone: LandingZone) -> Self:
        return cls(
            id=landing_zone.id,
            job_id=landing_zone.job_id,
            centroid=GeoPointSchema.from_domain(landing_zone.centroid),
            bounds=GeoBoundsSchema.from_domain(landing_zone.bounds),
            slope_degrees=landing_zone.slope_degrees,
            area_sq_ft=landing_zone.area_sq_ft,
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


class RouteOut(CamelModel):
    id: str
    job_id: str
    waypoints: list[RouteWaypointSchema]
    total_cost: float
    landing_zone_id: str | None = None

    @classmethod
    def from_domain(cls, route: Route) -> Self:
        return cls(
            id=route.id,
            job_id=route.job_id,
            waypoints=[RouteWaypointSchema.from_domain(w) for w in route.waypoints],
            total_cost=route.total_cost,
            landing_zone_id=route.landing_zone_id,
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
        )


class JobDetailOut(JobOut):
    telemetry: DroneTelemetryOut | None = None
    detections: list[DetectionOut] = Field(default_factory=list)
    landing_zones: list[LandingZoneOut] = Field(default_factory=list)
    route: RouteOut | None = None


class ErrorOut(CamelModel):
    detail: str
