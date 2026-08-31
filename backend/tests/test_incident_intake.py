from pathlib import Path

from core.config import Settings
from main import create_app
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog
from services.intake.transcript_extractor import KeywordTranscriptExtractor
from fastapi.testclient import TestClient


def test_extractor_reads_josh_and_red_and_y_trail() -> None:
    subject, trail = KeywordTranscriptExtractor().extract(
        Path(__file__).resolve().parents[1].joinpath("demo/josh_y_trail_transcript.txt").read_text()
    )
    assert subject.display_name == "Josh"
    assert "red" in subject.clothing_colors
    assert trail == "Y Mountain Trail"


def test_trail_catalog_loads_y_line() -> None:
    catalog = TrailCatalog(resolve_demo_dir("demo"))
    line = catalog.load_line("Y Mountain Trail")
    assert len(line) > 5
    assert line[0].lat == 40.24555


def test_create_demo_incident_api(tmp_path: Path) -> None:
    settings = Settings(
        database_path=str(tmp_path / "sar.db"),
        artifacts_dir=str(tmp_path / "artifacts"),
        ingest_dir=str(tmp_path / "inbox"),
        ingest_watch_enabled=False,
        yolo_enabled=False,
        demo_dir=resolve_demo_dir("demo"),
    )
    client = TestClient(create_app(settings))
    response = client.post("/incidents/demo")
    assert response.status_code == 201
    body = response.json()
    assert body["subject"]["displayName"] == "Josh"
    assert body["trailName"] == "Y Mountain Trail"
    assert len(body["trailLine"]) > 5

    active = client.get("/incidents/active")
    assert active.status_code == 200
    assert active.json()["id"] == body["id"]

    fixture = client.get("/incidents/fixture")
    assert fixture.status_code == 200
    assert "Josh" in fixture.json()["transcript"]

    job = client.post(
        "/telemetry",
        json={
            "telemetry": {
                "position": {"lat": 40.24555, "lng": -111.62815},
                "bounds": {
                    "southWest": {"lat": 40.24, "lng": -111.64},
                    "northEast": {"lat": 40.26, "lng": -111.61},
                },
                "altitudeMeters": 120,
                "headingDegrees": 45,
                "gimbal": {"pitchDegrees": -45, "yawDegrees": 0, "rollDegrees": 0},
                "timestampUtc": "2026-08-31T20:00:00Z",
            }
        },
    )
    assert job.status_code == 201
    assert job.json()["incidentId"] == body["id"]
