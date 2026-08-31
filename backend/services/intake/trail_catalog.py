from __future__ import annotations

import json
from pathlib import Path

from models.domain import GeoPoint


class TrailCatalog:
    def __init__(self, demo_dir: str) -> None:
        self._demo_dir = Path(demo_dir)

    def load_line(self, trail_name: str) -> list[GeoPoint]:
        if "y mountain" in trail_name.lower() or trail_name.lower().startswith("y trail"):
            return self._load_geojson(self._demo_dir / "y_mountain_trail.geojson")
        return []

    def fixture_transcript(self) -> str:
        path = self._demo_dir / "josh_y_trail_transcript.txt"
        return path.read_text(encoding="utf-8")

    def _load_geojson(self, path: Path) -> list[GeoPoint]:
        if not path.is_file():
            raise FileNotFoundError(f"Failed to load trail corridor: {path} does not exist")
        payload = json.loads(path.read_text(encoding="utf-8"))
        feature = payload["features"][0]
        coordinates = feature["geometry"]["coordinates"]
        return [GeoPoint(lat=lat, lng=lng) for lng, lat in coordinates]
