from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from dao.interface.dao_factory import DaoFactory
from models.domain import Artifact, JobStatus
from services.interface.cv_pipeline import CvPipeline
from services.interface.frame_extractor import FrameExtractor
from services.interface.georeferencer import DetectionGeoreferencer
from services.interface.gis_router import GisRouter

logger = logging.getLogger(__name__)


class JobProcessor:
    def __init__(
        self,
        dao_factory: DaoFactory,
        frame_extractor: FrameExtractor,
        cv_pipeline: CvPipeline,
        gis_router: GisRouter,
        georeferencer: DetectionGeoreferencer,
    ) -> None:
        self._dao_factory = dao_factory
        self._frame_extractor = frame_extractor
        self._cv_pipeline = cv_pipeline
        self._gis_router = gis_router
        self._georeferencer = georeferencer

    def process_job(self, job_id: str) -> None:
        started = time.perf_counter()
        job_dao = self._dao_factory.create_job_dao()
        job = job_dao.get_by_id(job_id)
        if job is None:
            logger.error(
                "job_not_found",
                extra={"event": "job_not_found", "job_id": job_id},
            )
            return

        job.status = JobStatus.PROCESSING
        job.updated_at = datetime.now(timezone.utc)
        job_dao.update(job)

        try:
            frames = self._extract_frames(job.video_artifact_id)
            detections = self._cv_pipeline.process(job, frames)

            telemetry = self._dao_factory.create_telemetry_dao().get_by_id(job.telemetry_id)
            if telemetry is None:
                raise ValueError(
                    f"Failed to process job {job_id}: telemetry {job.telemetry_id} not found"
                )

            if detections:
                detections = self._georeferencer.apply(detections, telemetry, frames)
                self._dao_factory.create_detection_dao().save_all(detections)
                job.detection_ids = [detection.id for detection in detections]

            landing_zones, route = self._gis_router.route(job, telemetry)
            if landing_zones:
                self._dao_factory.create_landing_zone_dao().save_all(landing_zones)
                job.landing_zone_ids = [landing_zone.id for landing_zone in landing_zones]
            if route is not None:
                self._dao_factory.create_route_dao().save(route)
                job.route_id = route.id

            job.status = JobStatus.COMPLETED
            job.failure_reason = None
            job.updated_at = datetime.now(timezone.utc)
            job_dao.update(job)
            logger.info(
                "job_completed",
                extra={
                    "event": "job_completed",
                    "job_id": job_id,
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                    "detection_count": len(job.detection_ids),
                    "landing_zone_count": len(job.landing_zone_ids),
                },
            )
        except Exception as exc:
            job.status = JobStatus.FAILED
            job.failure_reason = _classify_failure(exc)
            job.updated_at = datetime.now(timezone.utc)
            job_dao.update(job)
            logger.error(
                "job_failed",
                extra={
                    "event": "job_failed",
                    "job_id": job_id,
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                    "failure_reason": job.failure_reason,
                },
                exc_info=True,
            )

    def _extract_frames(self, video_artifact_id: str | None) -> list[Artifact]:
        if video_artifact_id is None:
            return []
        video = self._dao_factory.create_artifact_dao().get_by_id(video_artifact_id)
        if video is None:
            raise ValueError(
                f"Failed to extract frames: video artifact {video_artifact_id} not found"
            )
        return self._frame_extractor.extract(video)


def _classify_failure(exc: Exception) -> str:
    message = str(exc)
    lowered = message.lower()
    if "unreadable" in lowered:
        return f"unreadable_video: {message}"
    if "telemetry" in lowered:
        return f"missing_telemetry: {message}"
    if "artifact" in lowered or "video" in lowered:
        return f"missing_artifact: {message}"
    return f"processing_error: {type(exc).__name__}: {message}"
