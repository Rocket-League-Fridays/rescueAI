from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass

from models.domain import GeoPoint, SubjectProfile


@dataclass(frozen=True)
class TranscriptExtract:
    subject: SubjectProfile
    trail_name: str
    last_known: GeoPoint | None = None
    missing_minutes: int | None = None
    started_from_trailhead: bool = False


class TranscriptExtractor(ABC):
    @abstractmethod
    def extract(self, transcript: str) -> TranscriptExtract:
        raise NotImplementedError

_COLOR_WORDS = (
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "black",
    "white",
    "gray",
    "grey",
    "brown",
    "pink",
)


_COORD_RE = re.compile(
    r"(-?\d{1,3}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})"
)


class KeywordTranscriptExtractor(TranscriptExtractor):
    def extract(self, transcript: str) -> TranscriptExtract:
        lowered = transcript.lower()
        colors = [color for color in _COLOR_WORDS if re.search(rf"\b{color}\b", lowered)]
        if "grey" in colors and "gray" not in colors:
            colors.append("gray")
        name = _extract_name(transcript)
        trail = _extract_trail(lowered)
        notes = "Keyword extract from distress transcript (no LLM required)."
        return TranscriptExtract(
            subject=SubjectProfile(
                display_name=name,
                clothing_colors=colors or ["red"],
                notes=notes,
            ),
            trail_name=trail,
            last_known=_extract_last_known(transcript),
            missing_minutes=_extract_missing_minutes(lowered),
            started_from_trailhead=_started_from_trailhead(lowered),
        )


def _extract_name(transcript: str) -> str:
    match = re.search(r"\b(?:name is|named)\s+([A-Z][a-z]+)\b", transcript)
    if match:
        return match.group(1)
    match = re.search(r"\bJosh\b", transcript, re.IGNORECASE)
    if match:
        return "Josh"
    match = re.search(r"\bCalvin\b", transcript, re.IGNORECASE)
    if match:
        return "Calvin"
    return "Unknown subject"


def _extract_last_known(transcript: str) -> GeoPoint | None:
    match = _COORD_RE.search(transcript)
    if match is None:
        return None
    lat = float(match.group(1))
    lng = float(match.group(2))
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return None
    return GeoPoint(lat=lat, lng=lng)


_HOUR_LATER_RE = re.compile(
    r"\b(?:an|one|about an|about one)\s+hour(?:s)?(?:\s+later)?\b"
)
_N_HOURS_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*hours?\b")
_WORD_HOURS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
_WORD_HOURS_RE = re.compile(r"\b(one|two|three|four|five|six)\s+hours?\b")
_N_MINUTES_RE = re.compile(r"\b(\d+)\s*minutes?\b")
_CLOCK_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b")
_TRAILHEAD_START_RE = re.compile(
    r"\b(?:started|start(?:ed)?|dropped|left)\b.{0,48}\btrailhead\b"
    r"|\bfrom (?:the )?(?:y )?trailhead\b"
)


def _started_from_trailhead(lowered: str) -> bool:
    return "trailhead" in lowered and _TRAILHEAD_START_RE.search(lowered) is not None


def _extract_missing_minutes(lowered: str) -> int | None:
    if _HOUR_LATER_RE.search(lowered):
        return 60
    hours = _N_HOURS_RE.search(lowered)
    if hours:
        return max(1, int(round(float(hours.group(1)) * 60)))
    word_hours = _WORD_HOURS_RE.search(lowered)
    if word_hours:
        return _WORD_HOURS[word_hours.group(1)] * 60
    minutes = _N_MINUTES_RE.search(lowered)
    if minutes:
        return max(1, int(minutes.group(1)))
    clocks = _CLOCK_RE.findall(lowered)
    if len(clocks) >= 2:
        start = _clock_to_minutes(clocks[0])
        end = _clock_to_minutes(clocks[1])
        delta = end - start
        if delta <= 0:
            delta += 12 * 60
        return delta
    return None


def _clock_to_minutes(parts: tuple[str, str, str]) -> int:
    hour = int(parts[0]) % 12
    minute = int(parts[1] or 0)
    if parts[2] == "p":
        hour += 12
    return hour * 60 + minute


def _extract_trail(lowered: str) -> str:
    if "y mountain" in lowered or "y trail" in lowered or "y trailhead" in lowered:
        return "Y Mountain Trail"
    return "Unknown trail"
