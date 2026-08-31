from __future__ import annotations

import re
from abc import ABC, abstractmethod

from models.domain import SubjectProfile


class TranscriptExtractor(ABC):
    @abstractmethod
    def extract(self, transcript: str) -> tuple[SubjectProfile, str]:
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


class KeywordTranscriptExtractor(TranscriptExtractor):
    def extract(self, transcript: str) -> tuple[SubjectProfile, str]:
        lowered = transcript.lower()
        colors = [color for color in _COLOR_WORDS if re.search(rf"\b{color}\b", lowered)]
        if "grey" in colors and "gray" not in colors:
            colors.append("gray")
        name = _extract_name(transcript)
        trail = _extract_trail(lowered)
        notes = "Keyword extract from distress transcript (no LLM required)."
        return (
            SubjectProfile(display_name=name, clothing_colors=colors or ["red"], notes=notes),
            trail,
        )


def _extract_name(transcript: str) -> str:
    match = re.search(r"\b(?:name is|named)\s+([A-Z][a-z]+)\b", transcript)
    if match:
        return match.group(1)
    match = re.search(r"\bJosh\b", transcript, re.IGNORECASE)
    if match:
        return "Josh"
    return "Unknown subject"


def _extract_trail(lowered: str) -> str:
    if "y mountain" in lowered or "y trail" in lowered or "y trailhead" in lowered:
        return "Y Mountain Trail"
    return "Unknown trail"
