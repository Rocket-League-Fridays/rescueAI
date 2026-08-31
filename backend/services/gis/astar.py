from __future__ import annotations

import heapq
import math
from collections.abc import Callable

from services.gis.terrain import TerrainGrid

_NEIGHBOR_OFFSETS = (
    (-1, -1), (-1, 0), (-1, 1),
    (0, -1), (0, 1),
    (1, -1), (1, 0), (1, 1),
)

Cell = tuple[int, int]


def find_path(
    grid: TerrainGrid,
    start: Cell,
    goal: Cell,
    step_cost: Callable[[Cell, Cell], float],
    min_cost_per_meter: float = 1.0,
) -> list[Cell] | None:
    """Least-cost 8-connected path from `start` to `goal`, or None if unreachable.

    The heuristic is straight-line distance scaled by the cheapest possible cost
    per metre, which never overestimates, so the result is optimal for the cost
    function it was given.
    """
    if start == goal:
        return [start]

    open_heap: list[tuple[float, Cell]] = [(0.0, start)]
    came_from: dict[Cell, Cell] = {}
    best: dict[Cell, float] = {start: 0.0}
    closed: set[Cell] = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current == goal:
            return _reconstruct(came_from, current)
        if current in closed:
            continue
        closed.add(current)

        for drow, dcol in _NEIGHBOR_OFFSETS:
            neighbor = (current[0] + drow, current[1] + dcol)
            if not grid.in_bounds(*neighbor) or neighbor in closed:
                continue
            step = step_cost(current, neighbor)
            if not math.isfinite(step):
                continue
            tentative = best[current] + step
            if tentative >= best.get(neighbor, math.inf):
                continue
            came_from[neighbor] = current
            best[neighbor] = tentative
            heapq.heappush(
                open_heap,
                (tentative + _heuristic(grid, neighbor, goal, min_cost_per_meter), neighbor),
            )
    return None


def path_cost(path: list[Cell], step_cost: Callable[[Cell, Cell], float]) -> float:
    return sum(step_cost(path[i], path[i + 1]) for i in range(len(path) - 1))


def _heuristic(grid: TerrainGrid, cell: Cell, goal: Cell, min_cost_per_meter: float) -> float:
    drow = (cell[0] - goal[0]) * grid.cell_meters
    dcol = (cell[1] - goal[1]) * grid.cell_meters
    return math.hypot(drow, dcol) * min_cost_per_meter


def _reconstruct(came_from: dict[Cell, Cell], current: Cell) -> list[Cell]:
    path = [current]
    while current in came_from:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return path


def cost_field(
    grid: TerrainGrid,
    source: Cell,
    step_cost: Callable[[Cell, Cell], float],
) -> tuple[dict[Cell, float], dict[Cell, Cell]]:
    """Least cost from `source` to every reachable cell, plus predecessors.

    One sweep answers "which sites can a carry team actually reach, and at what
    cost" for the whole corridor, instead of one search per candidate site.
    """
    best: dict[Cell, float] = {source: 0.0}
    came_from: dict[Cell, Cell] = {}
    closed: set[Cell] = set()
    heap: list[tuple[float, Cell]] = [(0.0, source)]

    while heap:
        cost, current = heapq.heappop(heap)
        if current in closed:
            continue
        closed.add(current)
        for drow, dcol in _NEIGHBOR_OFFSETS:
            neighbor = (current[0] + drow, current[1] + dcol)
            if not grid.in_bounds(*neighbor) or neighbor in closed:
                continue
            step = step_cost(current, neighbor)
            if not math.isfinite(step):
                continue
            tentative = cost + step
            if tentative >= best.get(neighbor, math.inf):
                continue
            best[neighbor] = tentative
            came_from[neighbor] = current
            heapq.heappush(heap, (tentative, neighbor))
    return best, came_from


def trace_path(came_from: dict[Cell, Cell], source: Cell, target: Cell) -> list[Cell] | None:
    if target != source and target not in came_from:
        return None
    return _reconstruct(came_from, target)
