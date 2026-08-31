from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    settings = Settings(
        database_path=str(tmp_path / "sar.db"),
        artifacts_dir=str(tmp_path / "artifacts"),
        api_key=None,
    )
    app = create_app(settings)
    return TestClient(app)


@pytest.fixture
def valid_telemetry_payload() -> dict:
    return {
        "telemetry": {
            "position": {"lat": 40.2338, "lng": -111.6585},
            "bounds": {
                "southWest": {"lat": 40.22, "lng": -111.68},
                "northEast": {"lat": 40.25, "lng": -111.63},
            },
            "altitudeMeters": 420,
            "headingDegrees": 135,
            "gimbal": {"pitchDegrees": -45, "yawDegrees": 0, "rollDegrees": 0},
            "timestampUtc": "2026-08-31T20:00:00Z",
            "speedMps": 12,
            "batteryPercent": 78,
        }
    }
