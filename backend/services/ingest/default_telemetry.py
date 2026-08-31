from __future__ import annotations

from datetime import datetime, timezone

from core.config import Settings
from models.schemas import (
    CreateJobRequest,
    DroneTelemetryIn,
    GeoBoundsSchema,
    GeoPointSchema,
    GimbalOrientationSchema,
)
from services.ingest.srt_parser import SrtSample


def request_from_srt(sample: SrtSample) -> CreateJobRequest:
    return _build_request(
        lat=sample.lat,
        lng=sample.lng,
        altitude_meters=sample.altitude_meters,
        heading_degrees=sample.heading_degrees,
        pitch_degrees=sample.pitch_degrees,
        yaw_degrees=sample.yaw_degrees,
        roll_degrees=sample.roll_degrees,
    )


def request_from_settings(settings: Settings) -> CreateJobRequest:
    return _build_request(
        lat=settings.default_lat,
        lng=settings.default_lng,
        altitude_meters=settings.default_altitude_meters,
        heading_degrees=settings.default_heading_degrees,
        pitch_degrees=-90.0,
        yaw_degrees=0.0,
        roll_degrees=0.0,
    )


def _build_request(
    lat: float,
    lng: float,
    altitude_meters: float,
    heading_degrees: float,
    pitch_degrees: float,
    yaw_degrees: float,
    roll_degrees: float,
) -> CreateJobRequest:
    delta = 0.01
    return CreateJobRequest(
        telemetry=DroneTelemetryIn(
            position=GeoPointSchema(lat=lat, lng=lng),
            bounds=GeoBoundsSchema(
                south_west=GeoPointSchema(lat=lat - delta, lng=lng - delta),
                north_east=GeoPointSchema(lat=lat + delta, lng=lng + delta),
            ),
            altitude_meters=altitude_meters,
            heading_degrees=heading_degrees,
            gimbal=GimbalOrientationSchema(
                pitch_degrees=pitch_degrees,
                yaw_degrees=yaw_degrees,
                roll_degrees=roll_degrees,
            ),
            timestamp_utc=datetime.now(timezone.utc),
        )
    )
