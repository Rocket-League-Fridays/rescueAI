import pytest

from models.domain import GeoPoint, RouteLegKind, RouteWaypoint
from services.gis.route_metrics import (
    build_leg,
    haversine_m,
    naismith_minutes,
    path_distance_meters,
    path_elevation_gain_meters,
    summarize,
)


def _waypoint(lat: float, elevation: float) -> RouteWaypoint:
    return RouteWaypoint(lat=lat, lng=-111.0, elevation_meters=elevation)


def test_haversine_matches_one_milli_degree_of_latitude() -> None:
    meters = haversine_m(GeoPoint(lat=40.0, lng=-111.0), GeoPoint(lat=40.001, lng=-111.0))
    assert 110.0 < meters < 113.0


def test_path_distance_sums_consecutive_segments() -> None:
    waypoints = [_waypoint(40.000, 1500), _waypoint(40.001, 1500), _waypoint(40.002, 1500)]
    single = path_distance_meters(waypoints[:2])
    assert path_distance_meters(waypoints) == pytest.approx(single * 2, abs=0.01)


def test_elevation_gain_counts_ascent_only() -> None:
    waypoints = [_waypoint(40.000, 1500), _waypoint(40.001, 1520), _waypoint(40.002, 1490)]
    assert path_elevation_gain_meters(waypoints) == 20.0


def test_naismith_charges_an_hour_per_five_km_and_per_600m_climb() -> None:
    assert naismith_minutes(5000, 0) == 60.0
    assert naismith_minutes(0, 600) == 60.0


def test_off_trail_legs_are_slower_than_on_trail_legs() -> None:
    waypoints = [_waypoint(40.000, 1500), _waypoint(40.005, 1520)]
    on_trail = build_leg(RouteLegKind.ON_TRAIL, "trail", waypoints, 0, 1)
    off_trail = build_leg(RouteLegKind.OFF_TRAIL, "bushwhack", waypoints, 0, 1)
    assert off_trail.distance_meters == on_trail.distance_meters
    assert off_trail.estimated_minutes > on_trail.estimated_minutes


def test_build_leg_records_its_waypoint_span() -> None:
    waypoints = [_waypoint(40.000, 1500), _waypoint(40.001, 1510), _waypoint(40.002, 1520)]
    leg = build_leg(RouteLegKind.ON_TRAIL, "trail", waypoints, 1, 2)
    assert (leg.start_index, leg.end_index) == (1, 2)
    assert leg.elevation_gain_meters == 10.0


def test_summarize_totals_every_leg() -> None:
    waypoints = [_waypoint(40.000, 1500), _waypoint(40.001, 1510), _waypoint(40.002, 1520)]
    legs = [
        build_leg(RouteLegKind.SUBJECT_LINK, "a", waypoints, 0, 1),
        build_leg(RouteLegKind.ON_TRAIL, "b", waypoints, 1, 2),
    ]
    distance, gain, minutes = summarize(legs)
    assert distance == sum(leg.distance_meters for leg in legs)
    assert gain == 20.0
    assert minutes == sum(leg.estimated_minutes for leg in legs)
