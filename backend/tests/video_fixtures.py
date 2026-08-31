from pathlib import Path

import cv2
import numpy as np


def write_synthetic_mp4(
    path: Path,
    frame_count: int = 5,
    width: int = 64,
    height: int = 64,
    fps: int = 10,
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        raise RuntimeError(f"Failed to write synthetic video: {path}")
    try:
        for index in range(frame_count):
            pixel = np.uint8((index * 40) % 255)
            frame = np.full((height, width, 3), pixel, dtype=np.uint8)
            writer.write(frame)
    finally:
        writer.release()
    return path


DJI_SRT_FIXTURE = """1
00:00:00,000 --> 00:00:00,033
<font size="28">FrameCnt: 1
[iso: 100] [latitude: 40.233800] [longitude: -111.658500] [rel_alt: 120.000] [gb_yaw: 10.0] [gb_pitch: -45.0] [gb_roll: 0.0]</font>

2
00:00:00,033 --> 00:00:00,066
<font size="28">FrameCnt: 2
[iso: 100] [latitude: 40.234000] [longitude: -111.658000] [rel_alt: 125.500] [gb_yaw: 12.5] [gb_pitch: -60.0] [gb_roll: 1.0]</font>
"""
