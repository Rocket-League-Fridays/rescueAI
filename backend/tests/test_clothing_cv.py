from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from models.domain import Artifact, ArtifactKind, Job, JobStatus
from services.cv.clothing_cv_pipeline import ClothingScoringCvPipeline
from services.ingest.sahi_tiler import SlidingWindowSahiTiler
from services.interface.person_detector import PersonDetector, RawDetection
from storage.local.local_artifact_store import LocalArtifactStore


class _FixedDetector(PersonDetector):
    def detect(self, image: np.ndarray) -> list[RawDetection]:
        return [RawDetection(x=10, y=10, width=20, height=20, confidence=0.8)]


def test_pipeline_restitches_and_scores_clothing(tmp_path: Path) -> None:
    factory = SqliteDaoFactory.initialize(str(tmp_path / "sar.db"))
    store = LocalArtifactStore.initialize(str(tmp_path / "artifacts"))
    image = np.zeros((80, 80, 3), dtype=np.uint8)
    image[10:30, 10:30] = (0, 0, 220)
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    store.put("job-1/frames/f.jpg", buffer.tobytes())

    frame = Artifact(
        id="frame-1",
        job_id="job-1",
        kind=ArtifactKind.FRAME,
        storage_key="job-1/frames/f.jpg",
        mime_type="image/jpeg",
        width=80,
        height=80,
        frame_index=0,
    )
    now = datetime.now(timezone.utc)
    job = Job(
        id="job-1",
        status=JobStatus.PROCESSING,
        created_at=now,
        updated_at=now,
        telemetry_id="tel-1",
    )
    pipeline = ClothingScoringCvPipeline(
        detector=_FixedDetector(),
        artifact_store=store,
        dao_factory=factory,
        tiler=SlidingWindowSahiTiler(tile_size=64, overlap=0.2),
    )
    detections = pipeline.process(job, [frame])
    assert detections
    assert all(item.bbox.width > 0 for item in detections)
    assert max(item.clothing_match_score for item in detections) > 0.2
