import math
from datetime import datetime, timezone

import numpy as np

from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
    SituationAssessment,
)
from services.gis.astar import cost_field
from services.gis.cost_surface import MAX_CARRY_SLOPE_DEGREES, CarryCostSurface
from services.gis.terrain import TerrainGrid, build_corridor_grid
from services.gis.y_trail_router import YTrailGisRouter
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog


def _scenario():
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


def _straight_line_cells(grid: TerrainGrid, start, goal):
    steps = max(abs(goal[0] - start[0]), abs(goal[1] - start[1]))
    return [
        (
            round(start[0] + (goal[0] - start[0]) * i / steps),
            round(start[1] + (goal[1] - start[1]) * i / steps),
        )
        for i in range(steps + 1)
    ]


def test_loaded_descent_costs_more_than_the_same_climb() -> None:
    grid = TerrainGrid(
        lats=np.linspace(40.0, 40.001, 3),
        lngs=np.linspace(-111.0, -110.999, 3),
        elevation=np.array([[0.0, 0.0, 0.0], [50.0, 50.0, 50.0], [0.0, 0.0, 0.0]]),
        slope=np.zeros((3, 3)),
        cell_meters=10.0,
    )
    surface = CarryCostSurface(grid)
    climbing = surface.step_cost((0, 1), (1, 1))
    descending = surface.step_cost((1, 1), (2, 1))
    assert descending > climbing, "a litter carry is punished on the way down"


def test_route_never_crosses_ground_too_steep_to_carry() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    grid = build_corridor_grid(trail, situation.ground_point)
    off_trail = [
        leg for leg in route.legs if leg.kind.value in {"subject_link", "off_trail"}
    ]
    for leg in off_trail:
        for waypoint in route.waypoints[leg.start_index + 1 : leg.end_index + 1]:
            point = GeoPoint(lat=waypoint.lat, lng=waypoint.lng)
            assert grid.slope_at(point) <= MAX_CARRY_SLOPE_DEGREES


def test_the_route_is_not_the_straight_line_and_the_straight_line_is_illegal() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    grid = build_corridor_grid(trail, situation.ground_point)
    surface = CarryCostSurface(grid)

    subject_cell = grid.index_of(situation.ground_point)
    lz_cell = grid.index_of(zones[0].centroid)
    straight = _straight_line_cells(grid, subject_cell, lz_cell)

    worst_direct = max(float(grid.slope[cell]) for cell in straight)
    assert worst_direct > MAX_CARRY_SLOPE_DEGREES, (
        "fixture no longer forces a detour, so this test cannot prove routing happened"
    )

    subject_leg = route.legs[0]
    routed = route.waypoints[subject_leg.start_index : subject_leg.end_index + 1]
    assert len(routed) > len(straight)


def test_the_landing_zone_is_reachable_under_load() -> None:
    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    grid = build_corridor_grid(trail, situation.ground_point)
    surface = CarryCostSurface(grid)
    reachable, _ = cost_field(grid, grid.index_of(situation.ground_point), surface.step_cost)
    assert grid.index_of(zones[0].centroid) in reachable


def test_carrying_out_takes_longer_than_walking_in() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    assert route.estimated_minutes > route.inbound_minutes > 0


def test_route_states_which_pace_profile_produced_its_numbers() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    assert "carry" in route.notes.lower()


def test_total_cost_is_the_search_cost_not_the_ground_distance() -> None:
    job, telemetry, situation, trail = _scenario()
    _, route = YTrailGisRouter().route(job, telemetry, situation, trail)
    assert route is not None
    assert route.total_cost > route.distance_meters
    assert math.isfinite(route.total_cost)


def test_every_criterion_is_declared_assessed_or_not() -> None:
    from models.domain import LandingZoneCriterion

    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    zone = zones[0]
    assessed = set(zone.assessed_criteria)
    unassessed = set(zone.unassessed_criteria)

    assert not assessed & unassessed, "a criterion cannot be both"
    assert assessed | unassessed == set(LandingZoneCriterion), (
        "a new criterion must be classified, not silently omitted"
    )


def test_approach_clearance_is_never_claimed_as_assessed() -> None:
    from models.domain import LandingZoneCriterion

    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    zone = zones[0]
    assert LandingZoneCriterion.APPROACH_CLEARANCE in zone.unassessed_criteria
    assert LandingZoneCriterion.CANOPY in zone.unassessed_criteria


def test_unassessed_canopy_stays_null_and_is_declared() -> None:
    from models.domain import LandingZoneCriterion

    job, telemetry, situation, trail = _scenario()
    zones, _ = YTrailGisRouter().route(job, telemetry, situation, trail)
    zone = zones[0]
    assert zone.canopy_fraction is None
    assert LandingZoneCriterion.CANOPY not in zone.assessed_criteria
