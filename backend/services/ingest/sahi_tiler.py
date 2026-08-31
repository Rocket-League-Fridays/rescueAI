from __future__ import annotations

import numpy as np

from services.interface.sahi_tiler import SahiTile, SahiTiler


class SlidingWindowSahiTiler(SahiTiler):
    def __init__(self, tile_size: int = 640, overlap: float = 0.2) -> None:
        if tile_size < 1:
            raise ValueError("Failed to configure SAHI tiler: tile_size must be >= 1")
        if not 0 <= overlap < 1:
            raise ValueError("Failed to configure SAHI tiler: overlap must be in [0, 1)")
        self._tile_size = tile_size
        self._overlap = overlap

    def tile(self, image: np.ndarray) -> list[SahiTile]:
        if image.ndim < 2:
            raise ValueError("Failed to tile frame: image must have at least 2 dimensions")
        height, width = image.shape[:2]
        padded = self._pad_to_tile(image)
        padded_h, padded_w = padded.shape[:2]
        step = max(1, int(self._tile_size * (1.0 - self._overlap)))
        tiles: list[SahiTile] = []
        for y in _origins(padded_h, self._tile_size, step):
            for x in _origins(padded_w, self._tile_size, step):
                crop = padded[y : y + self._tile_size, x : x + self._tile_size]
                tiles.append(
                    SahiTile(
                        x=x,
                        y=y,
                        width=self._tile_size,
                        height=self._tile_size,
                        image=crop,
                    )
                )
        return tiles

    def _pad_to_tile(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        pad_h = max(0, self._tile_size - height)
        pad_w = max(0, self._tile_size - width)
        if pad_h == 0 and pad_w == 0:
            return image
        pad_width = ((0, pad_h), (0, pad_w)) + ((0, 0),) * (image.ndim - 2)
        return np.pad(image, pad_width, mode="constant")


def _origins(length: int, tile_size: int, step: int) -> list[int]:
    if length <= tile_size:
        return [0]
    values = list(range(0, length - tile_size + 1, step))
    last = length - tile_size
    if values[-1] != last:
        values.append(last)
    return values
