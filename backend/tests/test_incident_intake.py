from pathlib import Path

from core.config import Settings
from main import create_app
from services.intake.incident_service import resolve_demo_dir
from services.intake.trail_catalog import TrailCatalog
from services.intake.transcript_extractor import KeywordTranscriptExtractor
from fastapi.testclient import TestClient


def test_extractor_reads_josh_and_red_and_y_trail() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        Path(__file__).resolve().parents[1].joinpath("demo/josh_y_trail_transcript.txt").read_text()
    )
    assert extracted.subject.display_name == "Josh"
    assert "red" in extracted.subject.clothing_colors
    assert extracted.trail_name == "Y Mountain Trail"
    assert extracted.last_known is None


def test_extractor_reads_calvin_and_river_coords() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        "Dispatch, riverside hiker near 40.3884811, -111.5447873. "
        "His name is Calvin. Green waders and a black hoodie."
    )
    assert extracted.subject.display_name == "Calvin"
    assert "green" in extracted.subject.clothing_colors
    assert "black" in extracted.subject.clothing_colors
    assert extracted.trail_name == "Unknown trail"
    assert extracted.last_known is not None
    assert extracted.last_known.lat == 40.3884811
    assert extracted.last_known.lng == -111.5447873


def test_trail_catalog_loads_y_line() -> None:
    catalog = TrailCatalog(resolve_demo_dir("demo"))
    line = catalog.load_line("Y Mountain Trail")
    assert len(line) > 20
    assert abs(line[0].lat - 40.244852) < 1e-5
    assert abs(line[0].lng - (-111.627277)) < 1e-5


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
    assert body["lastKnownPoint"] is None
    assert len(body["trailLine"]) > 5

    active = client.get("/incidents/active")
    assert active.status_code == 200
    assert active.json()["id"] == body["id"]
    assert active.json()["missingMinutes"] == 60
    assert active.json()["missingMinutesAssumed"] is True
    locations = active.json()["likelyLocations"]
    assert 1 <= len(locations) <= 5
    assert 0 <= locations[0]["score"] <= 1
    assert "reason" in locations[0]
    assert "lat" in locations[0]["point"]

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


def test_create_incident_persists_transcript_coords(tmp_path: Path) -> None:
    settings = Settings(
        database_path=str(tmp_path / "sar.db"),
        artifacts_dir=str(tmp_path / "artifacts"),
        ingest_dir=str(tmp_path / "inbox"),
        ingest_watch_enabled=False,
        yolo_enabled=False,
        demo_dir=resolve_demo_dir("demo"),
    )
    client = TestClient(create_app(settings))
    river = client.post(
        "/incidents",
        json={
            "transcript": (
                "Dispatch, riverside hiker near 40.3884811, -111.5447873. "
                "His name is Calvin. Green waders and a black hoodie."
            )
        },
    )
    assert river.status_code == 201
    body = river.json()
    assert body["subject"]["displayName"] == "Calvin"
    assert body["lastKnownPoint"] == {"lat": 40.3884811, "lng": -111.5447873}


def test_create_incident_uses_trailhead_when_call_says_he_started_there(tmp_path: Path) -> None:
    settings = Settings(
        database_path=str(tmp_path / "sar.db"),
        artifacts_dir=str(tmp_path / "artifacts"),
        ingest_dir=str(tmp_path / "inbox"),
        ingest_watch_enabled=False,
        yolo_enabled=False,
        demo_dir=resolve_demo_dir("demo"),
    )
    client = TestClient(create_app(settings))
    response = client.post(
        "/incidents",
        json={
            "transcript": (
                "His name is Josh. Red rain jacket and black hiking pants. "
                "He started the hike two hours ago from the Y trailhead."
            )
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["lastKnownPoint"] == {"lat": 40.244852, "lng": -111.627277}
    assert body["missingMinutes"] == 120
    detail = client.get(f"/incidents/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["missingMinutesAssumed"] is False
    assert 1 <= len(detail.json()["likelyLocations"]) <= 5
