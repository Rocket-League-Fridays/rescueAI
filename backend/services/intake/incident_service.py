from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dao.interface.dao_factory import DaoFactory
from models.domain import Incident, IncidentStatus
from models.schemas import (
    IncidentDetailOut,
    IncidentOut,
    JobOut,
    LikelyLocationOut,
    SituationAssessmentOut,
)
from services.intake.trail_catalog import TrailCatalog
from services.intake.transcript_extractor import TranscriptExtractor
from services.locate.likely_locations import DEFAULT_MISSING_MINUTES, score_likely_locations


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
        trail_line = self._catalog.load_line(extracted.trail_name)
        last_known = extracted.last_known
        if last_known is None and extracted.started_from_trailhead and trail_line:
            last_known = trail_line[0]
        incident = Incident(
            id=str(uuid4()),
            transcript=transcript.strip(),
            subject=extracted.subject,
            trail_name=extracted.trail_name,
            trail_line=trail_line,
            status=IncidentStatus.OPEN,
            created_at=now,
            updated_at=now,
            last_known_point=last_known,
            missing_minutes=extracted.missing_minutes,
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
        assumed = incident.missing_minutes is None
        minutes = DEFAULT_MISSING_MINUTES if assumed else incident.missing_minutes
        pls = incident.last_known_point or (incident.trail_line[0] if incident.trail_line else None)
        likely = score_likely_locations(
            incident.trail_line, pls, minutes, incident.transcript
        )
        base = self.to_out(incident)
        payload = base.model_dump()
        payload["missing_minutes"] = minutes
        return IncidentDetailOut(
            **payload,
            jobs=[JobOut.from_domain(job) for job in jobs],
            situation=None if situation is None else SituationAssessmentOut.from_domain(situation),
            likely_locations=[LikelyLocationOut.from_domain(location) for location in likely],
            missing_minutes_assumed=assumed,
        )


def resolve_demo_dir(configured: str) -> str:
    path = Path(configured)
    if path.is_dir():
        return str(path)
    backend_relative = Path(__file__).resolve().parents[2] / "demo"
    return str(backend_relative)
