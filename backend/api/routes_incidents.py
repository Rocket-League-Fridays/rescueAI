from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_incident_service, require_api_key
from models.schemas import CreateIncidentRequest, FixtureTranscriptOut, IncidentDetailOut, IncidentOut
from services.intake.incident_service import IncidentService

router = APIRouter(prefix="/incidents", tags=["incidents"])


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
