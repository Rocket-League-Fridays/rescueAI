from datetime import datetime, timezone

from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
    RouteLegKind,
    SituationAssessment,
)
from services.gis.route_metrics import summarize
from services.gis.y_trail_router import YTrailGisRouter
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog


def _scenario() -> tuple[Job, DroneTelemetry, SituationAssessment, list[GeoPoint]]:
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
    return job, telemetry, situation, trail


def test_y_router_returns_lz_and_walk_back() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert len(zones) == 1
    assert route is not None
    assert len(route.waypoints) >= 2
    assert route.landing_zone_id == zones[0].id


def test_y_router_populates_operator_readouts() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    assert route.distance_meters > 0
    assert route.estimated_minutes > 0
    assert {waypoint.elevation_meters for waypoint in route.waypoints} != {1500.0}


def test_y_router_legs_tile_the_waypoints_and_sum_to_the_totals() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    assert [leg.kind for leg in route.legs] == [
        RouteLegKind.SUBJECT_LINK,
        RouteLegKind.OFF_TRAIL,
        RouteLegKind.ON_TRAIL,
    ]

    assert route.legs[0].start_index == 0
    assert route.legs[-1].end_index == len(route.waypoints) - 1
    for previous, current in zip(route.legs, route.legs[1:]):
        assert previous.end_index == current.start_index

    distance, gain, minutes = summarize(route.legs)
    assert route.distance_meters == distance
    assert route.elevation_gain_meters == gain
    assert route.estimated_minutes == minutes


def test_y_router_does_not_emit_duplicate_consecutive_waypoints() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    for previous, current in zip(route.waypoints, route.waypoints[1:]):
        assert (previous.lat, previous.lng) != (current.lat, current.lng)
