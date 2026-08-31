from datetime import datetime, timezone

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
)
from services.ingest.pinhole_georeferencer import PinholeGeoreferencer


def test_center_bbox_at_nadir_matches_aircraft() -> None:
    telemetry = _nadir_telemetry()
    frame = _frame(width=1000, height=1000)
    detection = _detection(x=450, y=450, width=100, height=100, frame_id=frame.id)

    [result] = PinholeGeoreferencer(82.0).apply([detection], telemetry, [frame])

    assert result.ground_point is not None
    assert abs(result.ground_point.lat - telemetry.position.lat) < 1e-5
    assert abs(result.ground_point.lng - telemetry.position.lng) < 1e-5


def test_east_offset_bbox_increases_longitude() -> None:
    telemetry = _nadir_telemetry()
    frame = _frame(width=1000, height=1000)
    detection = _detection(x=800, y=450, width=100, height=100, frame_id=frame.id)

    [result] = PinholeGeoreferencer(82.0).apply([detection], telemetry, [frame])

    assert result.ground_point is not None
    assert result.ground_point.lng > telemetry.position.lng


def _nadir_telemetry() -> DroneTelemetry:
    return DroneTelemetry(
        id="tel-1",
        position=GeoPoint(lat=40.2338, lng=-111.6585),
        bounds=GeoBounds(
            south_west=GeoPoint(lat=40.22, lng=-111.68),
            north_east=GeoPoint(lat=40.25, lng=-111.63),
        ),
        altitude_meters=120,
        heading_degrees=0,
        gimbal=GimbalOrientation(pitch_degrees=-90, yaw_degrees=0, roll_degrees=0),
        timestamp_utc=datetime.now(timezone.utc),
    )


def _frame(width: int, height: int) -> Artifact:
    return Artifact(
        id="frame-1",
        job_id="job-1",
        kind=ArtifactKind.FRAME,
        storage_key="job-1/frames/1.jpg",
        mime_type="image/jpeg",
        width=width,
        height=height,
        frame_index=0,
    )


def _detection(x: float, y: float, width: float, height: float, frame_id: str) -> Detection:
    return Detection(
        id="det-1",
        job_id="job-1",
        class_name=DetectionClassName.PERSON,
        bbox=BoundingBox(x=x, y=y, width=width, height=height),
        confidence=0.9,
        frame_id=frame_id,
    )
