from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from models.domain import (
    Artifact,
    ArtifactKind,
    BoundingBox,
    Detection,
    DetectionClassName,
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
)
from services.cv.evidence_renderer import OpenCvDetectionEvidenceRenderer
from storage.local.local_artifact_store import LocalArtifactStore


def test_renderer_persists_boxed_subject_evidence(tmp_path: Path) -> None:
    factory = SqliteDaoFactory.initialize(str(tmp_path / "sar.db"))
    store = LocalArtifactStore.initialize(str(tmp_path / "artifacts"))
    now = datetime.now(timezone.utc)
    telemetry = DroneTelemetry(
        id="tel-1",
        position=GeoPoint(lat=40.38, lng=-111.54),
        bounds=GeoBounds(
            south_west=GeoPoint(lat=40.37, lng=-111.55),
            north_east=GeoPoint(lat=40.39, lng=-111.53),
        ),
        altitude_meters=40,
        heading_degrees=0,
        gimbal=GimbalOrientation(pitch_degrees=-60, yaw_degrees=0, roll_degrees=0),
        timestamp_utc=now,
    )
    factory.create_telemetry_dao().save(telemetry)
    job = Job(
        id="job-1",
        status=JobStatus.PROCESSING,
        created_at=now,
        updated_at=now,
        telemetry_id=telemetry.id,
    )
    factory.create_job_dao().save(job)

    image = np.zeros((180, 320, 3), dtype=np.uint8)
    image[40:160, 120:200] = (20, 100, 20)
    encoded, buffer = cv2.imencode(".jpg", image)
    assert encoded
    frame = Artifact(
        id="frame-1",
        job_id=job.id,
        kind=ArtifactKind.FRAME,
        storage_key="job-1/frames/frame-1.jpg",
        mime_type="image/jpeg",
        width=320,
        height=180,
        frame_index=15,
    )
    store.put(frame.storage_key, buffer.tobytes())
    factory.create_artifact_dao().save(frame)
    detection = Detection(
        id="det-1",
        job_id=job.id,
        class_name=DetectionClassName.PERSON,
        bbox=BoundingBox(x=120, y=40, width=80, height=120),
        confidence=0.91,
        frame_id=frame.id,
        clothing_match_score=0.74,
    )

    artifact = OpenCvDetectionEvidenceRenderer(
        artifact_store=store,
        artifact_dao=factory.create_artifact_dao(),
    ).render(job, "Calvin", [detection], [frame])

    assert artifact is not None
    assert artifact.kind == ArtifactKind.ANNOTATED_FRAME
    assert artifact.frame_index == frame.frame_index
    assert factory.create_artifact_dao().get_by_id(artifact.id) is not None
    rendered = cv2.imdecode(
        np.frombuffer(store.get(artifact.storage_key), dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    assert rendered is not None
    assert np.any(rendered != image)
