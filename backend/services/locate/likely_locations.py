from __future__ import annotations

import math
from collections.abc import Sequence

from models.domain import GeoPoint, LikelyLocation
from services.gis.route_metrics import haversine_m

DEFAULT_MISSING_MINUTES = 60
ON_TRAIL_PACE_MPS = 1.1
INJURED_PACE_MPS = 0.7
MEDIAN_DISTANCE_M = 700.0
SPREAD_M = 500.0
OFF_TRAIL_STEP_M = 40.0
MIN_SEPARATION_M = 80.0
TOP_N = 5
TURN_DEGREES = 35.0

_INJURY_CUES = ("ankle", "injur", "immobile", "sprain")
_LEFT_TRAIL_CUES = ("left the trail", "off the trail", "off the main trail", "left the path")
_SWITCHBACK_CUES = ("switchback",)
_VIEWPOINT_CUES = ("viewpoint", "lookout", "overlook")
_Y_CUES = (" the y", "past the y", "below the y", "the y itself", "y mountain")
_UPHILL_CUES = ("uphill", "up the", "went up")


def score_likely_locations(
    trail: Sequence[GeoPoint],
    pls: GeoPoint | None,
    missing_minutes: int,
    transcript: str,
) -> list[LikelyLocation]:
    if len(trail) < 2:
        return []

    minutes = max(1, missing_minutes)
    lowered = transcript.lower()
    pace = INJURED_PACE_MPS if any(cue in lowered for cue in _INJURY_CUES) else ON_TRAIL_PACE_MPS
    max_meters = minutes * 60 * pace
    along = _along_trail_meters(trail)
    snap = _nearest_index(trail, pls) if pls is not None else 0
    pls_along = along[snap]
    left_trail = any(cue in lowered for cue in _LEFT_TRAIL_CUES)

    candidates: list[LikelyLocation] = []
    for index, point in enumerate(trail):
        distance = abs(along[index] - pls_along)
        if distance > max_meters:
            continue
        extras: list[str] = []
        bonus = 0.0
        if _is_junction(trail, index):
            bonus += 0.15
            extras.append("switchback / decision point")
        if index in (0, len(trail) - 1):
            bonus += 0.08
            extras.append("trail end")
        if any(cue in lowered for cue in _SWITCHBACK_CUES) and _is_junction(trail, index):
            bonus += 0.2
            extras.append("switchback mentioned")
        if any(cue in lowered for cue in _VIEWPOINT_CUES) and index >= int(len(trail) * 0.55):
            bonus += 0.2
            extras.append("viewpoint cue")
        if any(cue in lowered for cue in _Y_CUES) and index >= int(len(trail) * 0.7):
            bonus += 0.2
            extras.append("Y landmark")
        if any(cue in lowered for cue in _UPHILL_CUES) and along[index] > pls_along:
            bonus += 0.1
            extras.append("uphill of PLS")
        decay = math.exp(-0.5 * ((distance - MEDIAN_DISTANCE_M) / SPREAD_M) ** 2)
        raw = decay + bonus
        reason = _reason(distance, extras)
        candidates.append(
            LikelyLocation(
                point=point,
                score=raw,
                reason=reason,
                distance_from_pls_meters=distance,
            )
        )
        if _is_junction(trail, index):
            offset = _offset_perpendicular(trail, index, OFF_TRAIL_STEP_M)
            leave_bonus = 0.12 if left_trail else 0.06
            candidates.append(
                LikelyLocation(
                    point=offset,
                    score=raw + leave_bonus,
                    reason=f"{reason}; possible leave at decision point",
                    distance_from_pls_meters=distance,
                )
            )

    kept = _suppress_near_duplicates(candidates)
    if not kept:
        return []
    peak = max(location.score for location in kept)
    if peak <= 0:
        return []
    ranked = [
        LikelyLocation(
            point=location.point,
            score=round(location.score / peak, 3),
            reason=location.reason,
            distance_from_pls_meters=round(location.distance_from_pls_meters, 1),
        )
        for location in kept
    ]
    ranked.sort(key=lambda location: location.score, reverse=True)
    return ranked[:TOP_N]


def _reason(distance: float, extras: list[str]) -> str:
    base = f"Along-trail, {distance / 1000:.1f} km from PLS"
    if extras:
        return f"{base} — {', '.join(extras)}"
    return f"{base} — time-reachable"


def _along_trail_meters(trail: Sequence[GeoPoint]) -> list[float]:
    distances = [0.0]
    for index in range(1, len(trail)):
        distances.append(distances[-1] + haversine_m(trail[index - 1], trail[index]))
    return distances


def _nearest_index(trail: Sequence[GeoPoint], point: GeoPoint) -> int:
    return min(range(len(trail)), key=lambda index: haversine_m(trail[index], point))


def _is_junction(trail: Sequence[GeoPoint], index: int) -> bool:
    if index <= 0 or index >= len(trail) - 1:
        return False
    incoming = _bearing_degrees(trail[index - 1], trail[index])
    outgoing = _bearing_degrees(trail[index], trail[index + 1])
    delta = abs((outgoing - incoming + 180) % 360 - 180)
    return delta >= TURN_DEGREES


def _bearing_degrees(start: GeoPoint, end: GeoPoint) -> float:
    lat1 = math.radians(start.lat)
    lat2 = math.radians(end.lat)
    dlng = math.radians(end.lng - start.lng)
    x = math.sin(dlng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlng)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _offset_perpendicular(trail: Sequence[GeoPoint], index: int, meters: float) -> GeoPoint:
    if index <= 0:
        start, end = trail[0], trail[1]
    else:
        start, end = trail[index - 1], trail[index]
    bearing = math.radians((_bearing_degrees(start, end) + 90) % 360)
    north = meters * math.cos(bearing)
    east = meters * math.sin(bearing)
    return GeoPoint(
        lat=trail[index].lat + north / 111_320.0,
        lng=trail[index].lng + east / (111_320.0 * math.cos(math.radians(trail[index].lat))),
    )


def _suppress_near_duplicates(candidates: Sequence[LikelyLocation]) -> list[LikelyLocation]:
    ordered = sorted(candidates, key=lambda location: location.score, reverse=True)
    kept: list[LikelyLocation] = []
    for location in ordered:
        if all(haversine_m(location.point, other.point) >= MIN_SEPARATION_M for other in kept):
            kept.append(location)
    return kept
