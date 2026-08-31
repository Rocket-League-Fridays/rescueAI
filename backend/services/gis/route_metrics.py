from __future__ import annotations

import math
from collections.abc import Sequence

from models.domain import GeoPoint, RouteLeg, RouteLegKind, RouteWaypoint

EARTH_RADIUS_M = 6_371_000.0

NAISMITH_FLAT_MINUTES_PER_KM = 12.0
NAISMITH_ASCENT_MINUTES_PER_100M = 10.0

TERRAIN_PACE_FACTOR = {
    RouteLegKind.ON_TRAIL: 1.0,
    RouteLegKind.OFF_TRAIL: 1.6,
    RouteLegKind.SUBJECT_LINK: 1.6,
}


def haversine_m(a: GeoPoint, b: GeoPoint) -> float:
    dlat = math.radians(b.lat - a.lat)
    dlng = math.radians(b.lng - a.lng)
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def path_distance_meters(waypoints: Sequence[RouteWaypoint]) -> float:
    return sum(
        haversine_m(_as_point(waypoints[index]), _as_point(waypoints[index + 1]))
        for index in range(len(waypoints) - 1)
    )


def path_elevation_gain_meters(waypoints: Sequence[RouteWaypoint]) -> float:
    return sum(
        max(0.0, waypoints[index + 1].elevation_meters - waypoints[index].elevation_meters)
        for index in range(len(waypoints) - 1)
    )


def naismith_minutes(
    distance_meters: float,
    elevation_gain_meters: float,
    pace_factor: float = 1.0,
) -> float:
    flat = (distance_meters / 1000.0) * NAISMITH_FLAT_MINUTES_PER_KM
    climb = (elevation_gain_meters / 100.0) * NAISMITH_ASCENT_MINUTES_PER_100M
    return (flat + climb) * pace_factor


def build_leg(
    kind: RouteLegKind,
    label: str,
    waypoints: Sequence[RouteWaypoint],
    start_index: int,
    end_index: int,
) -> RouteLeg:
    span = waypoints[start_index : end_index + 1]
    distance = path_distance_meters(span)
    gain = path_elevation_gain_meters(span)
    return RouteLeg(
        kind=kind,
        label=label,
        start_index=start_index,
        end_index=end_index,
        distance_meters=distance,
        elevation_gain_meters=gain,
        estimated_minutes=naismith_minutes(distance, gain, TERRAIN_PACE_FACTOR[kind]),
    )


def summarize(legs: Sequence[RouteLeg]) -> tuple[float, float, float]:
    return (
        sum(leg.distance_meters for leg in legs),
        sum(leg.elevation_gain_meters for leg in legs),
        sum(leg.estimated_minutes for leg in legs),
    )


def _as_point(waypoint: RouteWaypoint) -> GeoPoint:
    return GeoPoint(lat=waypoint.lat, lng=waypoint.lng)
