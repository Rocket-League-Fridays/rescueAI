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
    LandingZoneCriterion,
    Route,
    RouteLegKind,
    RouteWaypoint,
    SituationAssessment,
)
from services.gis.approach import clear_approach_bearings, has_opposing_pair
from services.gis.astar import Cell, cost_field, trace_path
from services.gis.cost_surface import CarryCostSurface
from services.gis.route_metrics import (
    CARRY_PACE_FACTOR,
    TERRAIN_PACE_FACTOR,
    build_leg,
    haversine_m,
    leg_minutes,
    summarize,
)
from services.gis.terrain import (
    DEFAULT_CELL_METERS,
    ELEVATION_SOURCE_CACHED,
    ELEVATION_SOURCE_SYNTHETIC,
    TerrainGrid,
    build_corridor_grid,
)
from services.interface.gis_router import GisRouter

_MAX_LZ_SLOPE_DEG = 8.0
_LZ_HALF_M = 15.0
_SQ_FT_PER_SQ_M = 10.763910416709722
_LZ_REACH_COST_WEIGHT = 0.02
_APPROACH_CHECK_LIMIT = 40
_ONE_SIDED_APPROACH_FACTOR = 0.7

_LZ_ASSESSED = [
    LandingZoneCriterion.SLOPE,
    LandingZoneCriterion.FOOTPRINT,
    LandingZoneCriterion.REACHABILITY,
    LandingZoneCriterion.APPROACH_CLEARANCE,
]
_LZ_UNASSESSED = [
    LandingZoneCriterion.CANOPY,
]
_DEM_LABEL = {
    ELEVATION_SOURCE_CACHED: "cached USGS 3DEP elevation (10 m)",
    ELEVATION_SOURCE_SYNTHETIC: "a synthetic fallback surface, not real elevation",
}


def _lz_notes(source: str) -> str:
    dem = _DEM_LABEL.get(source, source)
    return (
        f"Suitability from pad-footprint slope and approach clearance, on {dem}. "
        "The pad is reachable under the carry slope ceiling, and approach "
        "bearings are clear of TERRAIN only — trees, wires, and towers are not "
        "modelled, and canopy over the pad is NOT assessed. This site is not "
        "cleared for a helicopter on these numbers alone."
    )
_ROUTE_NOTES = (
    "Least-cost carry route from the subject to the landing zone, where the "
    "helicopter extracts. Loaded descent is weighted above ascent and ground "
    "steeper than the carry ceiling is refused. estimatedMinutes is the loaded "
    "carry; inboundMinutes is the same path walked unloaded on the way in."
)


class YTrailGisRouter(GisRouter):
    """Carry-optimised routing over the Y Mountain corridor.

    The route is chosen for the leg that binds — carrying a subject out — not
    for the walk in, so it will trade distance for ground a litter team can
    actually cross. Elevation comes from a committed USGS 3DEP tile; corridors
    outside it fall back to a synthetic surface, which each site reports.
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
        selection = _select_landing_zone(grid, reach_cost)
        if selection is None:
            return [], None
        lz_cell, approach_bearings = selection

        carry_path = trace_path(came_from, subject_cell, lz_cell)
        if carry_path is None:
            return [], None

        landing_zone = _to_landing_zone(job.id, grid, lz_cell, approach_bearings)
        route = _build_route(job.id, grid, carry_path, landing_zone.id, reach_cost[lz_cell])
        return [landing_zone], route


def _footprint_max_slope(slope: np.ndarray, radius: int) -> np.ndarray:
    rows, cols = slope.shape
    padded = np.pad(slope, radius, mode="edge")
    worst = np.full_like(slope, -np.inf)
    for row_offset in range(2 * radius + 1):
        for col_offset in range(2 * radius + 1):
            worst = np.maximum(worst, padded[row_offset : row_offset + rows, col_offset : col_offset + cols])
    return worst


def _select_landing_zone(
    grid: TerrainGrid, reach_cost: dict[Cell, float]
) -> tuple[Cell, list[int]] | None:
    radius = max(1, round(_LZ_HALF_M / grid.cell_meters))
    worst = _footprint_max_slope(grid.slope, radius)
    candidates = [
        (cell, cost) for cell, cost in reach_cost.items() if worst[cell] <= _MAX_LZ_SLOPE_DEG
    ]
    if not candidates:
        candidates = sorted(reach_cost.items(), key=lambda item: (worst[item[0]], item[1]))[:8]
    if not candidates:
        return None

    ranked = sorted(candidates, key=lambda item: worst[item[0]] + item[1] * _LZ_REACH_COST_WEIGHT)
    approachable = []
    for cell, cost in ranked[:_APPROACH_CHECK_LIMIT]:
        bearings = clear_approach_bearings(grid, cell)
        if bearings:
            approachable.append((cell, cost, bearings))
    if not approachable:
        return None

    best = min(
        approachable,
        key=lambda item: (
            0 if has_opposing_pair(item[2]) else 1,
            worst[item[0]] + item[1] * _LZ_REACH_COST_WEIGHT,
        ),
    )
    return best[0], best[2]


def _to_landing_zone(
    job_id: str, grid: TerrainGrid, cell: Cell, approach_bearings: list[int]
) -> LandingZone:
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
        approach_bearings_degrees=approach_bearings,
        suitability_score=_suitability(max_slope, approach_bearings),
        assessed_criteria=list(_LZ_ASSESSED),
        unassessed_criteria=list(_LZ_UNASSESSED),
        notes=_lz_notes(grid.source),
    )


def _build_route(
    job_id: str,
    grid: TerrainGrid,
    carry_path: list[Cell],
    landing_zone_id: str,
    carry_cost: float,
) -> Route:
    waypoints = [
        RouteWaypoint(
            lat=grid.point_at(*cell).lat,
            lng=grid.point_at(*cell).lng,
            elevation_meters=float(grid.elevation[cell]),
        )
        for cell in carry_path
    ]
    legs = [
        build_leg(
            RouteLegKind.SUBJECT_LINK,
            "Subject to LZ",
            waypoints,
            0,
            len(waypoints) - 1,
        )
    ]
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


def _suitability(max_slope_degrees: float, approach_bearings: list[int]) -> float:
    """Slope headroom, discounted when a crew has no choice of approach.

    A pad reachable from one side only forces whatever line exists regardless of
    wind, so it scores below an otherwise identical pad with an opposing pair.
    """
    if not approach_bearings:
        return 0.0
    approach = 1.0 if has_opposing_pair(approach_bearings) else _ONE_SIDED_APPROACH_FACTOR
    return _slope_suitability(max_slope_degrees) * approach
