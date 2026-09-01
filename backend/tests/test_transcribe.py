from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.config import Settings
from main import create_app
from services.interface.speech_to_text import SpeechToText, SpeechToTextProviderError


class _FixedSpeechToText(SpeechToText):
    def __init__(self) -> None:
        self.calls: list[tuple[int, str, str]] = []

    def transcribe(self, audio_bytes: bytes, mime_type: str, filename: str) -> str:
        self.calls.append((len(audio_bytes), mime_type, filename))
        return "Hiker named Josh wearing red."


class _ProviderFailingSpeechToText(SpeechToText):
    def transcribe(self, audio_bytes: bytes, mime_type: str, filename: str) -> str:
        raise SpeechToTextProviderError("Failed to transcribe audio: provider timeout")


def _app(tmp_path: Path, **overrides: object) -> FastAPI:
    settings = Settings(
        database_path=str(tmp_path / "sar.db"),
        artifacts_dir=str(tmp_path / "artifacts"),
        ingest_dir=str(tmp_path / "inbox"),
        ingest_watch_enabled=False,
        yolo_enabled=False,
        **overrides,
    )
    return create_app(settings)


def test_transcribe_returns_transcript(tmp_path: Path) -> None:
    app = _app(tmp_path)
    stt = _FixedSpeechToText()
    app.state.speech_to_text = stt
    client = TestClient(app)

    payload = b"RIFF....fake-wav"
    response = client.post(
        "/incidents/transcribe",
        files={"audio": ("call.wav", payload, "audio/wav")},
    )

    assert response.status_code == 200
    assert response.json()["transcript"] == "Hiker named Josh wearing red."
    assert stt.calls == [(len(payload), "audio/wav", "call.wav")]


def test_transcribe_rejects_bad_mime_without_calling_stt(tmp_path: Path) -> None:
    app = _app(tmp_path)
    stt = _FixedSpeechToText()
    app.state.speech_to_text = stt
    client = TestClient(app)

    response = client.post(
        "/incidents/transcribe",
        files={"audio": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 422
    assert stt.calls == []


def test_transcribe_rejects_oversize_without_calling_stt(tmp_path: Path) -> None:
    app = _app(tmp_path, max_audio_upload_bytes=16)
    stt = _FixedSpeechToText()
    app.state.speech_to_text = stt
    client = TestClient(app)

    response = client.post(
        "/incidents/transcribe",
        files={"audio": ("call.wav", b"x" * 32, "audio/wav")},
    )

    assert response.status_code == 413
    assert stt.calls == []


def test_transcribe_unavailable_without_api_key(client: TestClient) -> None:
    response = client.post(
        "/incidents/transcribe",
        files={"audio": ("call.wav", b"data", "audio/wav")},
    )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_transcribe_maps_provider_error_to_502(tmp_path: Path) -> None:
    app = _app(tmp_path)
    app.state.speech_to_text = _ProviderFailingSpeechToText()
    client = TestClient(app)

    response = client.post(
        "/incidents/transcribe",
        files={"audio": ("call.mp3", b"id3", "audio/mpeg")},
    )
    assert response.status_code == 502
    assert "provider timeout" in response.json()["detail"]
