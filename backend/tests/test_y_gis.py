from datetime import datetime, timezone

from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
    SituationAssessment,
)
from services.gis.y_trail_router import YTrailGisRouter
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog


def test_y_router_returns_lz_and_walk_back() -> None:
    trail = TrailCatalog(resolve_demo_dir("demo")).load_line("Y Mountain Trail")
    subject = trail[8]
    now = datetime.now(timezone.utc)
    job = Job(
        id="job-1",
        status=JobStatus.PROCESSING,
        created_at=now,
        updated_at=now,
        telemetry_id="tel-1",
    )
    telemetry = DroneTelemetry(
        id="tel-1",
        position=subject,
        bounds=GeoBounds(
            south_west=GeoPoint(lat=subject.lat - 0.01, lng=subject.lng - 0.01),
            north_east=GeoPoint(lat=subject.lat + 0.01, lng=subject.lng + 0.01),
        ),
        altitude_meters=80,
        heading_degrees=40,
        gimbal=GimbalOrientation(pitch_degrees=-60, yaw_degrees=0, roll_degrees=0),
        timestamp_utc=now,
    )
    situation = SituationAssessment(
        id="sit-1",
        job_id="job-1",
        incident_id="inc-1",
        detection_id="det-1",
        ground_point=subject,
        canopy_fraction=0.2,
    )
    zones, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert len(zones) == 1
    assert route is not None
    assert len(route.waypoints) >= 2
    assert route.landing_zone_id == zones[0].id
