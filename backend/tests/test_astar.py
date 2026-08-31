import math

import numpy as np
import pytest

from services.gis.astar import cost_field, find_path, path_cost, trace_path
from services.gis.terrain import TerrainGrid


def _flat_grid(rows: int = 12, cols: int = 12) -> TerrainGrid:
    return TerrainGrid(
        lats=np.linspace(40.0, 40.001, rows),
        lngs=np.linspace(-111.0, -110.999, cols),
        elevation=np.zeros((rows, cols)),
        slope=np.zeros((rows, cols)),
        cell_meters=10.0,
    )


def _wall_grid() -> TerrainGrid:
    """A flat field split by an impassable wall with a single gap in the south."""
    grid = _flat_grid()
    grid.slope[:, 6] = 80.0
    grid.slope[0, 6] = 0.0
    return grid


def _step(grid: TerrainGrid, limit: float = 30.0):
    def step_cost(origin, destination):
        if grid.slope[destination] > limit:
            return math.inf
        diagonal = origin[0] != destination[0] and origin[1] != destination[1]
        return grid.cell_meters * (math.sqrt(2) if diagonal else 1.0)

    return step_cost


def test_path_between_neighbours_is_the_two_cells() -> None:
    grid = _flat_grid()
    assert find_path(grid, (0, 0), (0, 0), _step(grid)) == [(0, 0)]


def test_open_ground_gives_a_direct_diagonal_run() -> None:
    grid = _flat_grid()
    path = find_path(grid, (0, 0), (5, 5), _step(grid))
    assert path is not None
    assert len(path) == 6


def test_a_wall_forces_a_detour_through_its_only_gap() -> None:
    grid = _wall_grid()
    path = find_path(grid, (5, 2), (5, 9), _step(grid))
    assert path is not None
    assert (0, 6) in path, "the gap is the only legal crossing"
    assert all(grid.slope[cell] <= 30.0 for cell in path)


def test_a_sealed_wall_makes_the_far_side_unreachable() -> None:
    grid = _flat_grid()
    grid.slope[:, 6] = 80.0
    assert find_path(grid, (5, 2), (5, 9), _step(grid)) is None


def test_cost_field_agrees_with_a_direct_search() -> None:
    grid = _wall_grid()
    step = _step(grid)
    best, came_from = cost_field(grid, (5, 2), step)
    target = (5, 9)
    direct = find_path(grid, (5, 2), target, step)
    assert direct is not None
    assert best[target] == pytest.approx(path_cost(direct, step), rel=1e-9)
    assert trace_path(came_from, (5, 2), target)[-1] == target


def test_cost_field_omits_cells_behind_a_sealed_wall() -> None:
    grid = _flat_grid()
    grid.slope[:, 6] = 80.0
    best, came_from = cost_field(grid, (5, 2), _step(grid))
    assert (5, 9) not in best
    assert trace_path(came_from, (5, 2), (5, 9)) is None


def test_climbing_is_avoided_when_a_level_way_round_exists() -> None:
    grid = _flat_grid()
    grid.elevation[:, 5] = 100.0

    def step_cost(origin, destination):
        diagonal = origin[0] != destination[0] and origin[1] != destination[1]
        horizontal = grid.cell_meters * (math.sqrt(2) if diagonal else 1.0)
        rise = float(grid.elevation[destination] - grid.elevation[origin])
        return horizontal + max(0.0, rise) * 8.0

    grid.elevation[0, 5] = 0.0
    path = find_path(grid, (5, 2), (5, 8), step_cost)
    assert path is not None
    assert (0, 5) in path, "the level notch should beat climbing the ridge"
