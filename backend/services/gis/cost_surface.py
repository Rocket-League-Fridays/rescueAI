from __future__ import annotations

import math

from services.gis.terrain import TerrainGrid

MAX_CARRY_SLOPE_DEGREES = 30.0

ASCENT_COST_PER_METER = 8.0
DESCENT_COST_PER_METER = 11.5
SLOPE_COST_WEIGHT = 2.4

_DIAGONAL = math.sqrt(2.0)


class CarryCostSurface:
    """Traversal cost for carrying a subject out, in effective metres.

    Loaded descent is weighted above ascent on purpose: a slope a team happily
    scrambles up is the slope that hurts coming down with a litter. Optimising
    the leg that binds is why the returned path is not simply the shortest one.
    """

    def __init__(
        self,
        grid: TerrainGrid,
        max_slope_degrees: float = MAX_CARRY_SLOPE_DEGREES,
        ascent_cost_per_meter: float = ASCENT_COST_PER_METER,
        descent_cost_per_meter: float = DESCENT_COST_PER_METER,
        slope_cost_weight: float = SLOPE_COST_WEIGHT,
    ) -> None:
        self._grid = grid
        self._max_slope = max_slope_degrees
        self._ascent = ascent_cost_per_meter
        self._descent = descent_cost_per_meter
        self._slope_weight = slope_cost_weight

    def is_traversable(self, row: int, col: int) -> bool:
        return bool(self._grid.slope[row, col] <= self._max_slope)

    def step_cost(self, origin: tuple[int, int], destination: tuple[int, int]) -> float:
        row, col = destination
        if not self.is_traversable(row, col):
            return math.inf
        horizontal = self._grid.cell_meters
        if origin[0] != row and origin[1] != col:
            horizontal *= _DIAGONAL
        rise = float(self._grid.elevation[row, col] - self._grid.elevation[origin])
        vertical = rise * self._ascent if rise > 0 else -rise * self._descent
        steepness = float(self._grid.slope[row, col]) / self._max_slope
        return horizontal + vertical + horizontal * self._slope_weight * steepness**2

    def min_cost_per_meter(self) -> float:
        return 1.0
