from pathlib import Path

import cv2
import numpy as np

from models.domain import (
    Artifact,
    ArtifactKind,
    BoundingBox,
    Detection,
    DetectionClassName,
    GeoPoint,
)
from services.situation.assessor import SituationAssessor
from storage.local.local_artifact_store import LocalArtifactStore


def test_assessor_uses_clothing_winner_and_green_canopy(tmp_path: Path) -> None:
    store = LocalArtifactStore.initialize(str(tmp_path / "artifacts"))
    image = np.zeros((80, 80, 3), dtype=np.uint8)
    image[:, :] = (0, 180, 0)
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
    winner = Detection(
        id="det-best",
        job_id="job-1",
        class_name=DetectionClassName.PERSON,
        bbox=BoundingBox(x=10, y=10, width=20, height=20),
        confidence=0.5,
        frame_id="frame-1",
        ground_point=GeoPoint(lat=40.248, lng=-111.623),
        clothing_match_score=0.8,
    )
    loser = Detection(
        id="det-other",
        job_id="job-1",
        class_name=DetectionClassName.PERSON,
        bbox=BoundingBox(x=40, y=40, width=10, height=10),
        confidence=0.9,
        frame_id="frame-1",
        ground_point=GeoPoint(lat=40.24, lng=-111.62),
        clothing_match_score=0.1,
    )
    situation = SituationAssessor(store).assess("job-1", "inc-1", [loser, winner], [frame])
    assert situation is not None
    assert situation.detection_id == "det-best"
    assert situation.ground_point.lat == 40.248
    assert situation.canopy_fraction > 0.4
