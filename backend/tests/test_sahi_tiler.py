import numpy as np

from services.ingest.sahi_tiler import SlidingWindowSahiTiler


def test_tiler_covers_1280x720_with_640_overlap() -> None:
    image = np.zeros((720, 1280, 3), dtype=np.uint8)
    tiles = SlidingWindowSahiTiler(tile_size=640, overlap=0.2).tile(image)

    assert tiles
    assert all(tile.width == 640 and tile.height == 640 for tile in tiles)
    assert all(tile.image.shape[0] == 640 and tile.image.shape[1] == 640 for tile in tiles)

    xs = {tile.x for tile in tiles}
    ys = {tile.y for tile in tiles}
    assert 0 in xs
    assert 1280 - 640 in xs
    assert 0 in ys
    assert 720 - 640 in ys
