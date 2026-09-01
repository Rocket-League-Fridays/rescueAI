from __future__ import annotations

import math

from services.gis.terrain import TerrainGrid

DEFAULT_GLIDE_RATIO = 8.0
DEFAULT_APPROACH_RANGE_M = 300.0
BEARING_STEP_DEGREES = 30

Cell = tuple[int, int]


def clear_approach_bearings(
    grid: TerrainGrid,
    cell: Cell,
    glide_ratio: float = DEFAULT_GLIDE_RATIO,
    range_meters: float = DEFAULT_APPROACH_RANGE_M,
    step_degrees: int = BEARING_STEP_DEGREES,
) -> list[int]:
    """Compass bearings a helicopter can approach along without terrain rising
    through the glide surface.

    Terrain only — trees, wires, and towers are not modelled, so a bearing
    reported clear here is clear of *ground*, not certified for an aircraft.
    Running out of tile is treated as open air; the cached corridor extends well
    past the pads it is used for.
    """
    base = float(grid.elevation[cell])
    return [
        bearing
        for bearing in range(0, 360, step_degrees)
        if _bearing_is_clear(grid, cell, base, bearing, glide_ratio, range_meters)
    ]


def has_opposing_pair(bearings: list[int]) -> bool:
    """True when two roughly opposite approaches are open, so a crew can pick
    the into-wind one instead of taking whatever single line exists."""
    available = set(bearings)
    return any((bearing + 180) % 360 in available for bearing in available)


def _bearing_is_clear(
    grid: TerrainGrid,
    cell: Cell,
    base_elevation: float,
    bearing: int,
    glide_ratio: float,
    range_meters: float,
) -> bool:
    radians = math.radians(bearing)
    north_step = math.cos(radians)
    east_step = math.sin(radians)
    for step in range(1, int(range_meters / grid.cell_meters) + 1):
        row = cell[0] + round(north_step * step)
        col = cell[1] + round(east_step * step)
        if not grid.in_bounds(row, col):
            return True
        surface = base_elevation + (step * grid.cell_meters) / glide_ratio
        if float(grid.elevation[row, col]) > surface:
            return False
    return True
