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
    RouteLegKind,
    RouteWaypoint,
    SituationAssessment,
)
from services.gis.astar import Cell, cost_field, find_path, path_cost, trace_path
from services.gis.cost_surface import CarryCostSurface
from services.gis.route_metrics import (
    CARRY_PACE_FACTOR,
    TERRAIN_PACE_FACTOR,
    build_leg,
    haversine_m,
    leg_minutes,
    summarize,
)
from services.gis.terrain import DEFAULT_CELL_METERS, TerrainGrid, build_corridor_grid
from services.interface.gis_router import GisRouter

_MAX_LZ_SLOPE_DEG = 8.0
_LZ_HALF_M = 15.0
_SQ_FT_PER_SQ_M = 10.763910416709722
_TRAIL_TAIL_POINTS = 5
_LZ_REACH_COST_WEIGHT = 0.02

_LZ_NOTES = (
    "Slope-only suitability over the pad footprint, on a synthetic DEM. Pad is "
    "verified reachable under the carry slope ceiling. Canopy over the pad and "
    "approach/departure clearance are not yet assessed."
)
_ROUTE_NOTES = (
    "Least-cost carry route: loaded descent weighted above ascent, refusing "
    "ground steeper than the carry ceiling. estimatedMinutes is the loaded "
    "carry out; inboundMinutes is the same path walked unloaded."
)


class YTrailGisRouter(GisRouter):
    """Carry-optimised routing over the Y Mountain corridor.

    The route is chosen for the leg that binds — carrying a subject out — not
    for the walk in, so it will trade distance for ground a litter team can
    actually cross. Terrain is a synthetic stand-in for a cached 3DEP tile.
    """

    def __init__(self, cell_meters: float = DEFAULT_CELL_METERS) -> None:
        self._cell_meters = cell_meters

    def route(
        self,
        job: Job,
        telemetry: DroneTelemetry,
        situation: SituationAssessment | None = None,
        trail_line: list[GeoPoint] | None = None,
    ) -> tuple[list[LandingZone], Route | None]:
        trail = trail_line or []
        subject = situation.ground_point if situation is not None else telemetry.position
        grid = build_corridor_grid(trail, subject, self._cell_meters)
        surface = CarryCostSurface(grid)

        subject_cell = grid.index_of(subject)
        reach_cost, came_from = cost_field(grid, subject_cell, surface.step_cost)
        lz_cell = _select_landing_zone(grid, reach_cost)
        if lz_cell is None:
            return [], None

        carry_path = trace_path(came_from, subject_cell, lz_cell)
        if carry_path is None:
            return [], None

        landing_zone = _to_landing_zone(job.id, grid, lz_cell)
        route = _build_route(
            job.id, grid, surface, carry_path, trail, landing_zone.id, reach_cost[lz_cell]
        )
        return [landing_zone], route


def _footprint_max_slope(slope: np.ndarray, radius: int) -> np.ndarray:
    rows, cols = slope.shape
    padded = np.pad(slope, radius, mode="edge")
    worst = np.full_like(slope, -np.inf)
    for row_offset in range(2 * radius + 1):
        for col_offset in range(2 * radius + 1):
            worst = np.maximum(worst, padded[row_offset : row_offset + rows, col_offset : col_offset + cols])
    return worst


def _select_landing_zone(grid: TerrainGrid, reach_cost: dict[Cell, float]) -> Cell | None:
    radius = max(1, round(_LZ_HALF_M / grid.cell_meters))
    worst = _footprint_max_slope(grid.slope, radius)
    candidates = [
        (cell, cost)
        for cell, cost in reach_cost.items()
        if worst[cell] <= _MAX_LZ_SLOPE_DEG
    ]
    if not candidates:
        reachable = list(reach_cost.items())
        if not reachable:
            return None
        return min(reachable, key=lambda item: (worst[item[0]], item[1]))[0]
    return min(candidates, key=lambda item: worst[item[0]] + item[1] * _LZ_REACH_COST_WEIGHT)[0]


def _to_landing_zone(job_id: str, grid: TerrainGrid, cell: Cell) -> LandingZone:
    centroid = grid.point_at(*cell)
    dlat = _LZ_HALF_M / 111_320.0
    dlng = _LZ_HALF_M / (111_320.0 * max(0.2, math.cos(math.radians(centroid.lat))))
    bounds = GeoBounds(
        south_west=GeoPoint(lat=centroid.lat - dlat, lng=centroid.lng - dlng),
        north_east=GeoPoint(lat=centroid.lat + dlat, lng=centroid.lng + dlng),
    )
    max_slope = grid.max_slope_in(bounds)
    if max_slope is None:
        max_slope = grid.slope_at(centroid)
    return LandingZone(
        id=str(uuid4()),
        job_id=job_id,
        centroid=centroid,
        bounds=bounds,
        max_slope_degrees=max_slope,
        area_sq_ft=_bounds_area_sq_ft(bounds),
        canopy_fraction=None,
        suitability_score=_slope_suitability(max_slope),
        notes=_LZ_NOTES,
    )


def _build_route(
    job_id: str,
    grid: TerrainGrid,
    surface: CarryCostSurface,
    carry_path: list[Cell],
    trail: list[GeoPoint],
    landing_zone_id: str,
    carry_cost: float,
) -> Route:
    cells = list(carry_path)
    trail_entry_index: int | None = None
    trail_tail: list[GeoPoint] = []

    if trail:
        lz_cell = cells[-1]
        to_trail, entry_index = _route_to_trail(grid, surface, lz_cell, trail)
        if to_trail:
            trail_entry_index = len(cells) - 1
            cells.extend(to_trail[1:])
            trail_tail = list(reversed(trail[: entry_index + 1][-_TRAIL_TAIL_POINTS:]))[1:]

    waypoints = [
        RouteWaypoint(
            lat=grid.point_at(*cell).lat,
            lng=grid.point_at(*cell).lng,
            elevation_meters=float(grid.elevation[cell]),
        )
        for cell in cells
    ]
    off_trail_end = len(waypoints) - 1
    waypoints.extend(
        RouteWaypoint(lat=point.lat, lng=point.lng, elevation_meters=grid.elevation_at(point))
        for point in trail_tail
    )

    legs = [
        build_leg(
            RouteLegKind.SUBJECT_LINK,
            "Subject to LZ",
            waypoints,
            0,
            trail_entry_index if trail_entry_index is not None else len(carry_path) - 1,
        )
    ]
    if trail_entry_index is not None and off_trail_end > trail_entry_index:
        legs.append(
            build_leg(RouteLegKind.OFF_TRAIL, "LZ to trail", waypoints, trail_entry_index, off_trail_end)
        )
    if len(waypoints) - 1 > off_trail_end:
        legs.append(
            build_leg(
                RouteLegKind.ON_TRAIL, "Trail to trailhead", waypoints, off_trail_end, len(waypoints) - 1
            )
        )

    distance, elevation_gain, carry_minutes = summarize(legs)
    return Route(
        id=str(uuid4()),
        job_id=job_id,
        waypoints=waypoints,
        total_cost=carry_cost,
        landing_zone_id=landing_zone_id,
        distance_meters=distance,
        elevation_gain_meters=elevation_gain,
        estimated_minutes=carry_minutes,
        inbound_minutes=sum(leg_minutes(leg, TERRAIN_PACE_FACTOR) for leg in legs),
        legs=legs,
        notes=_ROUTE_NOTES,
    )


def _route_to_trail(
    grid: TerrainGrid,
    surface: CarryCostSurface,
    lz_cell: Cell,
    trail: list[GeoPoint],
) -> tuple[list[Cell], int]:
    reach, came_from = cost_field(grid, lz_cell, surface.step_cost)
    best_index = None
    best_cost = math.inf
    for index, point in enumerate(trail):
        cell = grid.index_of(point)
        cost = reach.get(cell)
        if cost is not None and cost < best_cost:
            best_cost, best_index = cost, index
    if best_index is None:
        return [], 0
    path = trace_path(came_from, lz_cell, grid.index_of(trail[best_index]))
    return (path or []), best_index


def _bounds_area_sq_ft(bounds: GeoBounds) -> float:
    height_m = haversine_m(
        bounds.south_west, GeoPoint(lat=bounds.north_east.lat, lng=bounds.south_west.lng)
    )
    width_m = haversine_m(
        bounds.south_west, GeoPoint(lat=bounds.south_west.lat, lng=bounds.north_east.lng)
    )
    return height_m * width_m * _SQ_FT_PER_SQ_M


def _slope_suitability(max_slope_degrees: float) -> float:
    return max(0.0, min(1.0, 1.0 - max_slope_degrees / _MAX_LZ_SLOPE_DEG))
