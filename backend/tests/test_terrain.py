import numpy as np

from models.domain import GeoBounds, GeoPoint
from services.gis.terrain import build_corridor_grid
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog


def _trail() -> list[GeoPoint]:
    return TrailCatalog(resolve_demo_dir("demo")).load_line("Y Mountain Trail")


def test_grid_resolves_a_landing_pad_across_several_cells() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    assert grid.cell_meters <= 15.0


def test_terrain_has_crest_and_drainage_lines_to_route_around() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    cross_slope = np.gradient(grid.elevation, axis=1)
    reversals = (np.diff(np.sign(cross_slope), axis=1) != 0).sum(axis=1)
    assert (reversals > 0).all(), "a monotonic face gives a router nothing to avoid"


def test_benching_the_trail_makes_it_walkable() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    along_trail = [grid.slope_at(point) for point in trail]
    assert max(along_trail) < 30.0
    assert float(np.median(along_trail)) < float(np.median(grid.slope))


def test_trail_climbs_the_way_the_real_y_trail_does() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    gain = grid.elevation_at(trail[-1]) - grid.elevation_at(trail[0])
    assert 250 < gain < 450


def test_index_round_trips_within_one_cell() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    for point in (trail[0], trail[8], trail[-1]):
        row, col = grid.index_of(point)
        back = grid.point_at(row, col)
        assert abs(back.lat - point.lat) < 0.001
        assert abs(back.lng - point.lng) < 0.001


def test_max_slope_in_bounds_reports_the_worst_cell_not_the_centre() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    centre = trail[8]
    bounds = GeoBounds(
        south_west=GeoPoint(lat=centre.lat - 0.001, lng=centre.lng - 0.001),
        north_east=GeoPoint(lat=centre.lat + 0.001, lng=centre.lng + 0.001),
    )
    assert grid.max_slope_in(bounds) >= grid.slope_at(centre)


def test_bounds_outside_the_grid_report_no_slope() -> None:
    trail = _trail()
    grid = build_corridor_grid(trail, trail[8])
    far = GeoBounds(
        south_west=GeoPoint(lat=10.0, lng=10.0),
        north_east=GeoPoint(lat=10.1, lng=10.1),
    )
    assert grid.max_slope_in(far) is None
