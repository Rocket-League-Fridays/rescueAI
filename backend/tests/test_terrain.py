import numpy as np

from models.domain import GeoBounds, GeoPoint
from services.gis.terrain import (
    ELEVATION_SOURCE_CACHED,
    ELEVATION_SOURCE_SYNTHETIC,
    build_corridor_grid,
)
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog


def _trail() -> list[GeoPoint]:
    return TrailCatalog(resolve_demo_dir("demo")).load_line("Y Mountain Trail")


def _grid():
    trail = _trail()
    return trail, build_corridor_grid(trail, trail[8])


def test_the_corridor_uses_the_cached_usgs_tile() -> None:
    _, grid = _grid()
    assert grid.source == ELEVATION_SOURCE_CACHED


def test_a_corridor_outside_the_cached_tile_falls_back_rather_than_extrapolating() -> None:
    elsewhere = [GeoPoint(lat=45.0, lng=-120.0), GeoPoint(lat=45.002, lng=-119.998)]
    grid = build_corridor_grid(elsewhere, elsewhere[0])
    assert grid.source == ELEVATION_SOURCE_SYNTHETIC


def test_grid_resolves_a_landing_pad_across_several_cells() -> None:
    _, grid = _grid()
    assert grid.cell_meters <= 15.0


def test_terrain_has_relief_to_route_around() -> None:
    _, grid = _grid()
    elevation = grid.elevation
    interior = elevation[1:-1, 1:-1]
    peaks = int(
        (
            (interior > elevation[:-2, 1:-1])
            & (interior > elevation[2:, 1:-1])
            & (interior > elevation[1:-1, :-2])
            & (interior > elevation[1:-1, 2:])
        ).sum()
    )
    assert peaks > 0, "a monotonic face gives a router nothing to avoid"
    for axis in (0, 1):
        gradient = np.gradient(elevation, axis=axis)
        reversals = (np.diff(np.sign(gradient), axis=axis) != 0).sum(axis=axis)
        assert (reversals > 0).any(), f"no crest or drainage lines along axis {axis}"


def test_the_trail_climbs_what_the_real_y_trail_climbs() -> None:
    trail, grid = _grid()
    gain = grid.elevation_at(trail[-1]) - grid.elevation_at(trail[0])
    # Lot to the block Y is ~1,074 ft / 327 m; the old straight-line fixture overstated this.
    assert 280 < gain < 400


def test_elevation_covers_the_bench_to_the_ridge() -> None:
    _, grid = _grid()
    assert 1_400 < grid.elevation.min() < 1_600
    assert 1_900 < grid.elevation.max() < 2_400


def test_index_round_trips_within_one_cell() -> None:
    trail, grid = _grid()
    for point in (trail[0], trail[8], trail[-1]):
        row, col = grid.index_of(point)
        back = grid.point_at(row, col)
        assert abs(back.lat - point.lat) < 0.001
        assert abs(back.lng - point.lng) < 0.001


def test_max_slope_in_bounds_reports_the_worst_cell_not_the_centre() -> None:
    trail, grid = _grid()
    centre = trail[8]
    bounds = GeoBounds(
        south_west=GeoPoint(lat=centre.lat - 0.001, lng=centre.lng - 0.001),
        north_east=GeoPoint(lat=centre.lat + 0.001, lng=centre.lng + 0.001),
    )
    assert grid.max_slope_in(bounds) >= grid.slope_at(centre)


def test_bounds_outside_the_grid_report_no_slope() -> None:
    _, grid = _grid()
    far = GeoBounds(
        south_west=GeoPoint(lat=10.0, lng=10.0),
        north_east=GeoPoint(lat=10.1, lng=10.1),
    )
    assert grid.max_slope_in(far) is None


def test_the_synthetic_fallback_still_benches_its_trail() -> None:
    """The fallback carves a walkable trail; without it a bare face seals the subject in."""
    elsewhere = [
        GeoPoint(lat=45.0 + 0.0004 * i, lng=-120.0 + 0.0006 * i) for i in range(12)
    ]
    grid = build_corridor_grid(elsewhere, elsewhere[6])
    assert grid.source == ELEVATION_SOURCE_SYNTHETIC
    along_trail = [grid.slope_at(point) for point in elsewhere]
    assert float(np.median(along_trail)) < float(np.median(grid.slope))
