from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from api.dependencies import get_incident_service, get_settings, get_speech_to_text, require_api_key
from core.config import Settings
from models.schemas import CreateIncidentRequest, FixtureTranscriptOut, IncidentDetailOut, IncidentOut
from services.intake.incident_service import IncidentService
from services.interface.speech_to_text import (
    SpeechToText,
    SpeechToTextProviderError,
    SpeechToTextUnavailableError,
)

router = APIRouter(prefix="/incidents", tags=["incidents"])

_ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "audio/m4a",
    "audio/x-m4a",
}
_ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg", ".mp4"}


@router.post(
    "",
    response_model=IncidentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
def create_incident(
    request: CreateIncidentRequest,
    incident_service: IncidentService = Depends(get_incident_service),
) -> IncidentOut:
    incident = incident_service.create_from_transcript(request.transcript)
    return incident_service.to_out(incident)


@router.post(
    "/demo",
    response_model=IncidentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
def create_demo_incident(
    incident_service: IncidentService = Depends(get_incident_service),
) -> IncidentOut:
    incident = incident_service.create_demo_incident()
    return incident_service.to_out(incident)


@router.get(
    "/fixture",
    response_model=FixtureTranscriptOut,
    dependencies=[Depends(require_api_key)],
)
def get_fixture_transcript(
    incident_service: IncidentService = Depends(get_incident_service),
) -> FixtureTranscriptOut:
    return FixtureTranscriptOut(transcript=incident_service.fixture_transcript())


@router.post(
    "/transcribe",
    response_model=FixtureTranscriptOut,
    dependencies=[Depends(require_api_key)],
)
def transcribe_audio(
    audio: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    speech_to_text: SpeechToText = Depends(get_speech_to_text),
) -> FixtureTranscriptOut:
    filename = audio.filename or "audio.bin"
    mime_type = audio.content_type or ""
    if not _is_allowed_audio(filename, mime_type):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Failed to transcribe audio: unsupported type "
                f"{mime_type or 'unknown'} ({filename})"
            ),
        )

    payload = audio.file.read()
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to transcribe audio: empty file",
        )
    if len(payload) > settings.max_audio_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "Failed to transcribe audio: file exceeds "
                f"{settings.max_audio_upload_bytes} bytes"
            ),
        )

    try:
        transcript = speech_to_text.transcribe(payload, mime_type or "application/octet-stream", filename)
    except SpeechToTextUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except SpeechToTextProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return FixtureTranscriptOut(transcript=transcript)


def _is_allowed_audio(filename: str, mime_type: str) -> bool:
    if mime_type in _ALLOWED_MIME_TYPES:
        return True
    return Path(filename).suffix.lower() in _ALLOWED_EXTENSIONS


@router.get(
    "/active",
    response_model=IncidentDetailOut,
    dependencies=[Depends(require_api_key)],
)
def get_active_incident(
    incident_service: IncidentService = Depends(get_incident_service),
) -> IncidentDetailOut:
    incident = incident_service.get_open()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Failed to load incident: no open incident",
        )
    return incident_service.to_detail(incident)


@router.get(
    "/{incident_id}",
    response_model=IncidentDetailOut,
    dependencies=[Depends(require_api_key)],
)
def get_incident(
    incident_id: str,
    incident_service: IncidentService = Depends(get_incident_service),
) -> IncidentDetailOut:
    incident = incident_service.get_by_id(incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to load incident: incident {incident_id} does not exist",
        )
    return incident_service.to_detail(incident)
