from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from dao.interface.dao_factory import DaoFactory
from models.domain import Artifact, ArtifactKind, Job, JobStatus
from models.schemas import (
    CreateJobRequest,
    ArtifactOut,
    DetectionOut,
    DroneTelemetryOut,
    JobDetailOut,
    JobOut,
    LandingZoneOut,
    RouteOut,
    SituationAssessmentOut,
)
from storage.interface.artifact_store import ArtifactStore


class JobService:
    def __init__(
        self,
        dao_factory: DaoFactory,
        artifact_store: ArtifactStore,
    ) -> None:
        self._dao_factory = dao_factory
        self._artifact_store = artifact_store

    def create_job(
        self,
        request: CreateJobRequest,
        video_bytes: bytes | None = None,
        video_filename: str | None = None,
        video_content_type: str | None = None,
    ) -> Job:
        now = datetime.now(timezone.utc)
        telemetry_id = str(uuid4())
        job_id = str(uuid4())

        telemetry = request.telemetry.to_domain(telemetry_id)
        self._dao_factory.create_telemetry_dao().save(telemetry)

        job = Job(
            id=job_id,
            status=JobStatus.QUEUED,
            created_at=now,
            updated_at=now,
            telemetry_id=telemetry_id,
            incident_id=self._resolve_incident_id(request.incident_id),
        )
        self._dao_factory.create_job_dao().save(job)

        if video_bytes is not None:
            artifact = self._store_video(
                job_id=job_id,
                video_bytes=video_bytes,
                video_filename=video_filename,
                video_content_type=video_content_type,
            )
            job.video_artifact_id = artifact.id
            job.updated_at = datetime.now(timezone.utc)
            self._dao_factory.create_job_dao().update(job)

        return job

    def _resolve_incident_id(self, requested: str | None) -> str | None:
        if requested:
            return requested
        open_incident = self._dao_factory.create_incident_dao().get_open()
        return None if open_incident is None else open_incident.id

    def get_job(self, job_id: str) -> Job | None:
        return self._dao_factory.create_job_dao().get_by_id(job_id)

    def get_job_detail(self, job_id: str) -> JobDetailOut | None:
        job = self.get_job(job_id)
        if job is None:
            return None

        telemetry = self._dao_factory.create_telemetry_dao().get_by_id(job.telemetry_id)
        artifacts = self._dao_factory.create_artifact_dao().list_by_job_id(job_id)
        detections = self._dao_factory.create_detection_dao().list_by_job_id(job_id)
        landing_zones = self._dao_factory.create_landing_zone_dao().list_by_job_id(job_id)
        route = self._dao_factory.create_route_dao().get_by_job_id(job_id)
        situation = self._dao_factory.create_situation_dao().get_by_job_id(job_id)

        detail = JobOut.from_domain(job)
        return JobDetailOut(
            **detail.model_dump(),
            telemetry=None if telemetry is None else DroneTelemetryOut.from_domain(telemetry),
            artifacts=[ArtifactOut.from_domain(artifact) for artifact in artifacts],
            detections=[DetectionOut.from_domain(detection) for detection in detections],
            landing_zones=[
                LandingZoneOut.from_domain(landing_zone) for landing_zone in landing_zones
            ],
            route=None if route is None else RouteOut.from_domain(route),
            situation=None if situation is None else SituationAssessmentOut.from_domain(situation),
        )

    def get_artifact_content(self, artifact_id: str) -> tuple[bytes, str] | None:
        artifact = self._dao_factory.create_artifact_dao().get_by_id(artifact_id)
        if artifact is None:
            return None
        return self._artifact_store.get(artifact.storage_key), artifact.mime_type

    def _store_video(
        self,
        job_id: str,
        video_bytes: bytes,
        video_filename: str | None,
        video_content_type: str | None,
    ) -> Artifact:
        artifact_id = str(uuid4())
        extension = _extension_from_filename(video_filename)
        storage_key = f"{job_id}/{artifact_id}{extension}"
        self._artifact_store.put(storage_key, video_bytes)

        artifact = Artifact(
            id=artifact_id,
            job_id=job_id,
            kind=ArtifactKind.RAW_VIDEO,
            storage_key=storage_key,
            mime_type=video_content_type or "application/octet-stream",
        )
        self._dao_factory.create_artifact_dao().save(artifact)
        return artifact


def _extension_from_filename(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ".bin"
    return "." + filename.rsplit(".", 1)[-1].lower()
