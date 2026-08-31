import json
from pathlib import Path

from fastapi.testclient import TestClient

from tests.video_fixtures import write_synthetic_mp4


def test_create_job_rejects_invalid_telemetry(client: TestClient) -> None:
    response = client.post(
        "/telemetry",
        json={
            "telemetry": {
                "position": {"lat": 200, "lng": -111.6585},
                "bounds": {
                    "southWest": {"lat": 40.22, "lng": -111.68},
                    "northEast": {"lat": 40.25, "lng": -111.63},
                },
                "altitudeMeters": 420,
                "headingDegrees": 135,
                "gimbal": {"pitchDegrees": -45, "yawDegrees": 0, "rollDegrees": 0},
                "timestampUtc": "2026-08-31T20:00:00Z",
            }
        },
    )
    assert response.status_code == 422


def test_create_job_returns_queued_job(
    client: TestClient, valid_telemetry_payload: dict
) -> None:
    response = client.post("/telemetry", json=valid_telemetry_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "queued"
    assert body["failureReason"] is None
    assert body["telemetryId"]
    assert body["id"]


def test_get_job_returns_detail_after_create(
    client: TestClient, valid_telemetry_payload: dict
) -> None:
    created = client.post("/telemetry", json=valid_telemetry_payload)
    job_id = created.json()["id"]

    response = client.get(f"/jobs/{job_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == job_id
    assert body["status"] in {"queued", "processing", "completed"}
    assert body["telemetry"]["id"] == body["telemetryId"]
    assert body["detections"] == []
    if body["status"] == "completed":
        assert len(body["landingZones"]) == 1
        assert body["route"] is not None


def test_get_missing_job_returns_404(client: TestClient) -> None:
    response = client.get("/jobs/does-not-exist")
    assert response.status_code == 404


def test_job_detail_lists_frames_and_serves_artifact_content(
    client: TestClient,
    valid_telemetry_payload: dict,
    tmp_path: Path,
) -> None:
    video_path = write_synthetic_mp4(tmp_path / "sortie.mp4", frame_count=3)
    telemetry = valid_telemetry_payload["telemetry"]
    response = client.post(
        "/telemetry/upload",
        data={"telemetry": json.dumps(telemetry)},
        files={"video": ("sortie.mp4", video_path.read_bytes(), "video/mp4")},
    )
    assert response.status_code == 201
    detail = client.get(f"/jobs/{response.json()['id']}")
    assert detail.status_code == 200
    frames = [
        artifact
        for artifact in detail.json()["artifacts"]
        if artifact["kind"] == "frame"
    ]
    assert frames

    content = client.get(f"/artifacts/{frames[0]['id']}/content")
    assert content.status_code == 200
    assert content.headers["content-type"] == "image/jpeg"
    assert content.content
