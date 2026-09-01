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
from services.gis.terrain import build_corridor_grid
from services.gis.y_trail_router import YTrailGisRouter, _slope_suitability
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog


def _scenario() -> tuple[Job, DroneTelemetry, SituationAssessment, list[GeoPoint]]:
    trail = TrailCatalog(resolve_demo_dir("demo")).load_line("Y Mountain Trail")
    anchor = trail[min(len(trail) - 4, max(12, (len(trail) * 2) // 3))]
    subject = GeoPoint(lat=anchor.lat + 0.0014, lng=anchor.lng + 0.0010)
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


def test_y_router_returns_an_lz_and_a_carry_route() -> None:
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
    assert [leg.kind for leg in route.legs] == [RouteLegKind.SUBJECT_LINK], (
        "the route ends at the LZ; a helicopter extracts from there"
    )

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


def test_landing_zone_reports_measured_area_not_a_constant() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    zone = zones[0]
    assert zone.area_sq_ft != 10_000.0
    assert 9_000 < zone.area_sq_ft < 10_500


def test_landing_zone_slope_is_the_worst_slope_in_the_footprint() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    zone = zones[0]
    grid = build_corridor_grid(trail, situation.ground_point)
    assert zone.max_slope_degrees == grid.max_slope_in(zone.bounds)
    assert zone.max_slope_degrees >= grid.slope_at(zone.centroid)


def test_landing_zone_leaves_canopy_unknown_rather_than_borrowing_the_subjects() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert zones[0].canopy_fraction is None
    assert situation.canopy_fraction == 0.2


def test_landing_zone_score_is_bounded_and_falls_as_slope_rises() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    zone = zones[0]
    assert 0.0 <= zone.suitability_score <= 1.0
    assert zone.suitability_score == _slope_suitability(zone.max_slope_degrees)
    assert _slope_suitability(2.0) > _slope_suitability(7.0)
    assert zone.notes != ""
