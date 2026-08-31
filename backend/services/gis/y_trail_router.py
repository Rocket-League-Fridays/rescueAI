from __future__ import annotations

import math
from uuid import uuid4

import numpy as np

from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    Job,
    LandingZone,
    Route,
    RouteWaypoint,
    SituationAssessment,
)
from services.interface.gis_router import GisRouter

_METERS_PER_DEG_LAT = 111_320.0
_MAX_SLOPE_DEG = 8.0
_MAX_CANOPY = 0.55
_LZ_HALF_M = 15.0


class YTrailGisRouter(GisRouter):
    """Demo GIS using a cached synthetic DEM around the Y trail — not live 3DEP."""

    def route(
        self,
        job: Job,
        telemetry: DroneTelemetry,
        situation: SituationAssessment | None = None,
        trail_line: list[GeoPoint] | None = None,
    ) -> tuple[list[LandingZone], Route | None]:
        trail = trail_line or []
        subject = situation.ground_point if situation is not None else telemetry.position
        canopy = situation.canopy_fraction if situation is not None else 0.35
        grid = _build_dem(trail, subject)
        lz_cell = _best_lz(grid, subject, canopy)
        if lz_cell is None:
            return [], None
        landing_zone = _to_landing_zone(job.id, lz_cell, canopy)
        route = _walk_back(job.id, subject, lz_cell.centroid, trail, landing_zone.id)
        return [landing_zone], route


class _Cell:
    def __init__(self, lat: float, lng: float, slope: float, elevation: float) -> None:
        self.centroid = GeoPoint(lat=lat, lng=lng)
        self.slope = slope
        self.elevation = elevation


def _build_dem(trail: list[GeoPoint], subject: GeoPoint) -> list[_Cell]:
    lats = [subject.lat] + [point.lat for point in trail]
    lngs = [subject.lng] + [point.lng for point in trail]
    lat0, lat1 = min(lats) - 0.002, max(lats) + 0.002
    lng0, lng1 = min(lngs) - 0.002, max(lngs) + 0.002
    lats_axis = np.linspace(lat0, lat1, 28)
    lngs_axis = np.linspace(lng0, lng1, 28)
    elev = np.zeros((len(lats_axis), len(lngs_axis)))
    for i, lat in enumerate(lats_axis):
        for j, lng in enumerate(lngs_axis):
            progress = _trail_progress(GeoPoint(lat=lat, lng=lng), trail)
            dist = _min_trail_distance_m(GeoPoint(lat=lat, lng=lng), trail)
            elev[i, j] = 1450 + 90 * progress + 0.35 * dist
    dlat_m = (lats_axis[1] - lats_axis[0]) * _METERS_PER_DEG_LAT
    dlng_m = (lngs_axis[1] - lngs_axis[0]) * _METERS_PER_DEG_LAT * math.cos(
        math.radians(subject.lat)
    )
    gy, gx = np.gradient(elev, dlat_m, dlng_m)
    slope = np.degrees(np.arctan(np.sqrt(gx**2 + gy**2)))
    cells: list[_Cell] = []
    for i, lat in enumerate(lats_axis):
        for j, lng in enumerate(lngs_axis):
            cells.append(_Cell(float(lat), float(lng), float(slope[i, j]), float(elev[i, j])))
    return cells


def _best_lz(cells: list[_Cell], subject: GeoPoint, canopy: float) -> _Cell | None:
    eligible = [
        cell
        for cell in cells
        if cell.slope <= _MAX_SLOPE_DEG and canopy <= _MAX_CANOPY
    ]
    if not eligible:
        eligible = sorted(cells, key=lambda cell: cell.slope)[:8]
    return min(eligible, key=lambda cell: _haversine_m(cell.centroid, subject) + cell.slope * 8)


def _to_landing_zone(job_id: str, cell: _Cell, canopy: float) -> LandingZone:
    dlat = _LZ_HALF_M / _METERS_PER_DEG_LAT
    dlng = _LZ_HALF_M / (_METERS_PER_DEG_LAT * max(0.2, math.cos(math.radians(cell.centroid.lat))))
    return LandingZone(
        id=str(uuid4()),
        job_id=job_id,
        centroid=cell.centroid,
        bounds=GeoBounds(
            south_west=GeoPoint(lat=cell.centroid.lat - dlat, lng=cell.centroid.lng - dlng),
            north_east=GeoPoint(lat=cell.centroid.lat + dlat, lng=cell.centroid.lng + dlng),
        ),
        slope_degrees=cell.slope,
        area_sq_ft=100.0 * 100.0,
    )


def _walk_back(
    job_id: str,
    subject: GeoPoint,
    lz: GeoPoint,
    trail: list[GeoPoint],
    landing_zone_id: str,
) -> Route:
    waypoints = [subject, lz]
    if trail:
        nearest = min(trail, key=lambda point: _haversine_m(lz, point))
        waypoints.append(nearest)
        nearest_index = trail.index(nearest)
        waypoints.extend(reversed(trail[: nearest_index + 1][-4:]))
    route_points = [
        RouteWaypoint(lat=point.lat, lng=point.lng, elevation_meters=1500)
        for point in waypoints
    ]
    cost = sum(
        _haversine_m(waypoints[i], waypoints[i + 1]) for i in range(len(waypoints) - 1)
    )
    return Route(
        id=str(uuid4()),
        job_id=job_id,
        waypoints=route_points,
        total_cost=cost,
        landing_zone_id=landing_zone_id,
    )


def _trail_progress(point: GeoPoint, trail: list[GeoPoint]) -> float:
    if not trail:
        return 0.5
    nearest_index = min(range(len(trail)), key=lambda i: _haversine_m(point, trail[i]))
    return nearest_index / max(1, len(trail) - 1)


def _min_trail_distance_m(point: GeoPoint, trail: list[GeoPoint]) -> float:
    if not trail:
        return 0.0
    return min(_haversine_m(point, vertex) for vertex in trail)


def _haversine_m(a: GeoPoint, b: GeoPoint) -> float:
    r = 6_371_000.0
    dlat = math.radians(b.lat - a.lat)
    dlng = math.radians(b.lng - a.lng)
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))
