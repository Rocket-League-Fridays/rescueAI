from datetime import datetime, timezone

from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
)
from services.stubs.gis_routing import StubGisRouter


def test_stub_gis_router_returns_empty_results() -> None:
    router = StubGisRouter()
    job = Job(
        id="job-1",
        status=JobStatus.PROCESSING,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        telemetry_id="tel-1",
    )
    telemetry = DroneTelemetry(
        id="tel-1",
        position=GeoPoint(lat=40.23, lng=-111.65),
        bounds=GeoBounds(
            south_west=GeoPoint(lat=40.22, lng=-111.68),
            north_east=GeoPoint(lat=40.25, lng=-111.63),
        ),
        altitude_meters=400,
        heading_degrees=90,
        gimbal=GimbalOrientation(pitch_degrees=-30, yaw_degrees=0, roll_degrees=0),
        timestamp_utc=datetime.now(timezone.utc),
    )

    landing_zones, route = router.route(job, telemetry)

    assert landing_zones == []
    assert route is None
