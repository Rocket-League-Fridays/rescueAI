from __future__ import annotations

import cv2
import numpy as np

_HSV_RANGES: dict[str, list[tuple[tuple[int, int, int], tuple[int, int, int]]]] = {
    "red": [((0, 80, 70), (10, 255, 255)), ((170, 80, 70), (180, 255, 255))],
    "orange": [((10, 80, 70), (22, 255, 255))],
    "yellow": [((22, 80, 70), (38, 255, 255))],
    "green": [((38, 40, 40), (85, 255, 255))],
    "blue": [((90, 60, 50), (130, 255, 255))],
    "purple": [((130, 40, 40), (160, 255, 255))],
    "pink": [((160, 40, 80), (175, 255, 255))],
    "black": [((0, 0, 0), (180, 255, 50))],
    "white": [((0, 0, 180), (180, 40, 255))],
    "gray": [((0, 0, 50), (180, 40, 180))],
    "grey": [((0, 0, 50), (180, 40, 180))],
    "brown": [((8, 60, 30), (22, 255, 160))],
}


def clothing_match_score(bgr_image: np.ndarray, colors: list[str]) -> float:
    if bgr_image.size == 0 or not colors:
        return 0.0
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
    for color in colors:
        for low, high in _HSV_RANGES.get(color.lower(), []):
            mask = cv2.bitwise_or(mask, cv2.inRange(hsv, np.array(low), np.array(high)))
    return float(np.count_nonzero(mask)) / float(mask.size)


def canopy_fraction(bgr_image: np.ndarray) -> float:
    return clothing_match_score(bgr_image, ["green"])
