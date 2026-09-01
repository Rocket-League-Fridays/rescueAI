import numpy as np

from services.gis.approach import clear_approach_bearings, has_opposing_pair
from services.gis.terrain import TerrainGrid


def _grid(elevation: np.ndarray) -> TerrainGrid:
    rows, cols = elevation.shape
    return TerrainGrid(
        lats=np.linspace(40.0, 40.0 + 0.0001 * rows, rows),
        lngs=np.linspace(-111.0, -111.0 + 0.0001 * cols, cols),
        elevation=elevation,
        slope=np.zeros_like(elevation),
        cell_meters=10.0,
    )


def test_open_ground_is_clear_from_every_bearing() -> None:
    grid = _grid(np.zeros((81, 81)))
    bearings = clear_approach_bearings(grid, (40, 40))
    assert len(bearings) == 12
    assert has_opposing_pair(bearings)


def test_a_wall_on_one_side_blocks_only_that_side() -> None:
    elevation = np.zeros((81, 81))
    elevation[:, 55:] = 500.0
    bearings = clear_approach_bearings(_grid(elevation), (40, 40))
    assert 90 not in bearings, "east is walled off"
    assert 270 in bearings, "west is still open"


def test_a_bowl_has_no_usable_approach() -> None:
    elevation = np.zeros((81, 81))
    elevation[:] = 500.0
    elevation[35:46, 35:46] = 0.0
    assert clear_approach_bearings(_grid(elevation), (40, 40)) == []


def test_terrain_below_the_glide_surface_does_not_block() -> None:
    """A rise that stays under the 8:1 surface is flyable, not an obstacle."""
    elevation = np.zeros((81, 81))
    for col in range(41, 81):
        elevation[:, col] = (col - 40) * 10.0 / 16.0
    assert 90 in clear_approach_bearings(_grid(elevation), (40, 40))


def test_the_same_rise_blocks_at_a_shallower_glide_ratio() -> None:
    elevation = np.zeros((81, 81))
    for col in range(41, 81):
        elevation[:, col] = (col - 40) * 10.0 / 16.0
    assert 90 not in clear_approach_bearings(_grid(elevation), (40, 40), glide_ratio=32.0)


def test_opposing_pair_needs_two_opposite_bearings() -> None:
    assert has_opposing_pair([0, 180])
    assert has_opposing_pair([90, 270])
    assert not has_opposing_pair([0, 30, 60])
    assert not has_opposing_pair([])


def test_running_out_of_tile_counts_as_open_air() -> None:
    grid = _grid(np.zeros((11, 11)))
    assert clear_approach_bearings(grid, (5, 5)) != []
