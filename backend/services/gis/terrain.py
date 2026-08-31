from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from models.domain import GeoBounds, GeoPoint

METERS_PER_DEG_LAT = 111_320.0
DEFAULT_CELL_METERS = 10.0
_CORRIDOR_PAD_DEG = 0.002


@dataclass(frozen=True)
class TerrainGrid:
    """A sampled elevation and slope surface over the search corridor.

    Row 0 is the southern edge and column 0 the western edge, so `elevation`
    and `slope` are indexed `[row, col]` by increasing latitude and longitude.
    """

    lats: np.ndarray
    lngs: np.ndarray
    elevation: np.ndarray
    slope: np.ndarray
    cell_meters: float

    @property
    def shape(self) -> tuple[int, int]:
        return self.elevation.shape

    def in_bounds(self, row: int, col: int) -> bool:
        rows, cols = self.shape
        return 0 <= row < rows and 0 <= col < cols

    def point_at(self, row: int, col: int) -> GeoPoint:
        return GeoPoint(lat=float(self.lats[row]), lng=float(self.lngs[col]))

    def index_of(self, point: GeoPoint) -> tuple[int, int]:
        row = int(np.clip(np.abs(self.lats - point.lat).argmin(), 0, len(self.lats) - 1))
        col = int(np.clip(np.abs(self.lngs - point.lng).argmin(), 0, len(self.lngs) - 1))
        return row, col

    def elevation_at(self, point: GeoPoint) -> float:
        row, col = self.index_of(point)
        return float(self.elevation[row, col])

    def slope_at(self, point: GeoPoint) -> float:
        row, col = self.index_of(point)
        return float(self.slope[row, col])

    def max_slope_in(self, bounds: GeoBounds) -> float | None:
        rows = np.where(
            (self.lats >= bounds.south_west.lat) & (self.lats <= bounds.north_east.lat)
        )[0]
        cols = np.where(
            (self.lngs >= bounds.south_west.lng) & (self.lngs <= bounds.north_east.lng)
        )[0]
        if rows.size == 0 or cols.size == 0:
            return None
        return float(self.slope[np.ix_(rows, cols)].max())


def build_corridor_grid(
    trail: list[GeoPoint],
    subject: GeoPoint,
    cell_meters: float = DEFAULT_CELL_METERS,
) -> TerrainGrid:
    lats = [subject.lat] + [point.lat for point in trail]
    lngs = [subject.lng] + [point.lng for point in trail]
    lat0, lat1 = min(lats) - _CORRIDOR_PAD_DEG, max(lats) + _CORRIDOR_PAD_DEG
    lng0, lng1 = min(lngs) - _CORRIDOR_PAD_DEG, max(lngs) + _CORRIDOR_PAD_DEG

    lat_step = cell_meters / METERS_PER_DEG_LAT
    lng_step = cell_meters / (METERS_PER_DEG_LAT * math.cos(math.radians(subject.lat)))
    lat_axis = np.arange(lat0, lat1 + lat_step, lat_step)
    lng_axis = np.arange(lng0, lng1 + lng_step, lng_step)

    elevation = _synthetic_y_face(lat_axis, lng_axis)
    if trail:
        elevation = _bench_the_trail(elevation, lat_axis, lng_axis, trail)
    dnorth = (lat_axis[1] - lat_axis[0]) * METERS_PER_DEG_LAT
    deast = (lng_axis[1] - lng_axis[0]) * METERS_PER_DEG_LAT * math.cos(
        math.radians(subject.lat)
    )
    grad_north, grad_east = np.gradient(elevation, dnorth, deast)
    slope = np.degrees(np.arctan(np.sqrt(grad_east**2 + grad_north**2)))
    return TerrainGrid(
        lats=lat_axis,
        lngs=lng_axis,
        elevation=elevation,
        slope=slope,
        cell_meters=cell_meters,
    )


def _synthetic_y_face(lat_axis: np.ndarray, lng_axis: np.ndarray) -> np.ndarray:
    """Deterministic stand-in for a cached 3DEP tile of the Y Mountain face.

    Not a survey. It exists so a router has real landform to work against: a
    steep west-facing wall off the Provo bench, a spur ridge, and two drainages
    cutting across it. Replace with a cached raster behind `build_corridor_grid`
    and nothing downstream changes.
    """
    lat0 = float(lat_axis.mean())
    north = (lat_axis - lat_axis[0]) * METERS_PER_DEG_LAT
    east = (lng_axis - lng_axis[0]) * METERS_PER_DEG_LAT * math.cos(math.radians(lat0))
    north_grid, east_grid = np.meshgrid(north, east, indexing="ij")

    bench = 1_420.0 + 0.30 * east_grid
    spur_ridge = 96.0 * np.exp(-(((east_grid - 640.0 - 0.28 * north_grid) ** 2) / (2 * 150.0**2)))
    north_gully = -74.0 * np.exp(-(((east_grid - 355.0 + 0.34 * north_grid) ** 2) / (2 * 52.0**2)))
    south_gully = -58.0 * np.exp(-(((east_grid - 905.0 - 0.18 * north_grid) ** 2) / (2 * 46.0**2)))
    undulation = 14.0 * np.sin(east_grid / 205.0) * np.cos(north_grid / 255.0)
    return bench + spur_ridge + north_gully + south_gully + undulation


TRAIL_BENCH_WIDTH_M = 20.0
_TRAIL_GRADE_WINDOW = 3


def _bench_the_trail(
    elevation: np.ndarray,
    lat_axis: np.ndarray,
    lng_axis: np.ndarray,
    trail: list[GeoPoint],
) -> np.ndarray:
    """Cut a graded bench along the trail, the way a real trail is built.

    Without this the trail inherits the raw hillside and comes out steeper than
    anything can walk. Benching also makes the trail the cheap corridor it
    should be, so a router prefers it without being told to.
    """
    lat0 = float(lat_axis.mean())
    lng_scale = METERS_PER_DEG_LAT * math.cos(math.radians(lat0))
    north = (lat_axis - lat_axis[0]) * METERS_PER_DEG_LAT
    east = (lng_axis - lng_axis[0]) * lng_scale
    north_grid, east_grid = np.meshgrid(north, east, indexing="ij")

    trail_north = np.array([(p.lat - lat_axis[0]) * METERS_PER_DEG_LAT for p in trail])
    trail_east = np.array([(p.lng - lng_axis[0]) * lng_scale for p in trail])
    trail_elevation = _smoothed_grade(
        np.array(
            [
                elevation[
                    int(np.abs(lat_axis - p.lat).argmin()),
                    int(np.abs(lng_axis - p.lng).argmin()),
                ]
                for p in trail
            ]
        )
    )

    best_distance = np.full(elevation.shape, np.inf)
    bench_elevation = np.zeros_like(elevation)
    for index in range(len(trail) - 1):
        ax, ay = trail_east[index], trail_north[index]
        bx, by = trail_east[index + 1], trail_north[index + 1]
        segment_x, segment_y = bx - ax, by - ay
        length_sq = segment_x**2 + segment_y**2
        if length_sq == 0:
            continue
        t = np.clip(
            ((east_grid - ax) * segment_x + (north_grid - ay) * segment_y) / length_sq, 0.0, 1.0
        )
        distance = np.hypot(east_grid - (ax + t * segment_x), north_grid - (ay + t * segment_y))
        closer = distance < best_distance
        best_distance = np.where(closer, distance, best_distance)
        along = trail_elevation[index] + t * (trail_elevation[index + 1] - trail_elevation[index])
        bench_elevation = np.where(closer, along, bench_elevation)

    weight = np.exp(-((best_distance / TRAIL_BENCH_WIDTH_M) ** 2))
    return elevation * (1.0 - weight) + bench_elevation * weight


def _smoothed_grade(raw: np.ndarray) -> np.ndarray:
    if raw.size <= _TRAIL_GRADE_WINDOW:
        return raw
    kernel = np.ones(_TRAIL_GRADE_WINDOW) / _TRAIL_GRADE_WINDOW
    padded = np.pad(raw, (_TRAIL_GRADE_WINDOW // 2,), mode="edge")
    return np.convolve(padded, kernel, mode="valid")[: raw.size]
