from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dao.interface.dao_factory import DaoFactory
from models.domain import Incident, IncidentStatus
from models.schemas import IncidentDetailOut, IncidentOut, JobOut, SituationAssessmentOut
from services.intake.trail_catalog import TrailCatalog
from services.intake.transcript_extractor import TranscriptExtractor


class IncidentService:
    def __init__(
        self,
        dao_factory: DaoFactory,
        catalog: TrailCatalog,
        extractor: TranscriptExtractor,
        corridor_buffer_meters: float = 80,
    ) -> None:
        self._dao_factory = dao_factory
        self._catalog = catalog
        self._extractor = extractor
        self._corridor_buffer_meters = corridor_buffer_meters

    def create_from_transcript(self, transcript: str) -> Incident:
        extracted = self._extractor.extract(transcript)
        now = datetime.now(timezone.utc)
        incident = Incident(
            id=str(uuid4()),
            transcript=transcript.strip(),
            subject=extracted.subject,
            trail_name=extracted.trail_name,
            trail_line=self._catalog.load_line(extracted.trail_name),
            status=IncidentStatus.OPEN,
            created_at=now,
            updated_at=now,
            last_known_point=extracted.last_known,
        )
        self._dao_factory.create_incident_dao().save(incident)
        return incident

    def create_demo_incident(self) -> Incident:
        return self.create_from_transcript(self._catalog.fixture_transcript())

    def get_open(self) -> Incident | None:
        return self._dao_factory.create_incident_dao().get_open()

    def get_by_id(self, incident_id: str) -> Incident | None:
        return self._dao_factory.create_incident_dao().get_by_id(incident_id)

    def fixture_transcript(self) -> str:
        return self._catalog.fixture_transcript()

    def to_out(self, incident: Incident) -> IncidentOut:
        return IncidentOut.from_domain(incident, self._corridor_buffer_meters)

    def to_detail(self, incident: Incident) -> IncidentDetailOut:
        jobs = self._dao_factory.create_job_dao().list_by_incident_id(incident.id)
        situation = None
        if incident.situation_id:
            situation = self._dao_factory.create_situation_dao().get_by_id(incident.situation_id)
        base = self.to_out(incident)
        return IncidentDetailOut(
            **base.model_dump(),
            jobs=[JobOut.from_domain(job) for job in jobs],
            situation=None if situation is None else SituationAssessmentOut.from_domain(situation),
        )


def resolve_demo_dir(configured: str) -> str:
    path = Path(configured)
    if path.is_dir():
        return str(path)
    backend_relative = Path(__file__).resolve().parents[2] / "demo"
    return str(backend_relative)
