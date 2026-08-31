from __future__ import annotations

import re
from dataclasses import dataclass

_LAT = re.compile(r"latitude\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_LNG = re.compile(r"longitude\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_REL_ALT = re.compile(r"rel_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_ABS_ALT = re.compile(r"abs_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_PITCH = re.compile(r"gb_pitch\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_YAW = re.compile(r"gb_yaw\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
_ROLL = re.compile(r"gb_roll\s*[:=]\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)


@dataclass(frozen=True)
class SrtSample:
    lat: float
    lng: float
    altitude_meters: float
    heading_degrees: float
    pitch_degrees: float
    yaw_degrees: float
    roll_degrees: float


def parse_dji_srt(text: str) -> list[SrtSample]:
    blocks = re.split(r"\n\s*\n", text.strip())
    samples: list[SrtSample] = []
    for block in blocks:
        lat_match = _LAT.search(block)
        lng_match = _LNG.search(block)
        if lat_match is None or lng_match is None:
            continue
        rel = _REL_ALT.search(block)
        abs_alt = _ABS_ALT.search(block)
        if rel is not None:
            altitude = float(rel.group(1))
        elif abs_alt is not None:
            altitude = float(abs_alt.group(1))
        else:
            continue
        yaw = float(_YAW.search(block).group(1)) if _YAW.search(block) else 0.0
        samples.append(
            SrtSample(
                lat=float(lat_match.group(1)),
                lng=float(lng_match.group(1)),
                altitude_meters=altitude,
                heading_degrees=_wrap_heading(yaw),
                pitch_degrees=float(_PITCH.search(block).group(1)) if _PITCH.search(block) else -90.0,
                yaw_degrees=yaw,
                roll_degrees=float(_ROLL.search(block).group(1)) if _ROLL.search(block) else 0.0,
            )
        )
    return samples


def mid_sample(samples: list[SrtSample]) -> SrtSample | None:
    if not samples:
        return None
    return samples[len(samples) // 2]


def _wrap_heading(degrees: float) -> float:
    wrapped = degrees % 360.0
    return wrapped if wrapped >= 0 else wrapped + 360.0
