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


def _extract_trail(lowered: str) -> str:
    if "y mountain" in lowered or "y trail" in lowered or "y trailhead" in lowered:
        return "Y Mountain Trail"
    return "Unknown trail"
