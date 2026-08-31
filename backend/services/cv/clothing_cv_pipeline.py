from __future__ import annotations

from uuid import uuid4

import cv2
import numpy as np

from dao.interface.dao_factory import DaoFactory
from models.domain import Artifact, BoundingBox, Detection, DetectionClassName, Job
from services.cv.clothing_score import clothing_match_score
from services.cv.nms import non_max_suppression
from services.ingest.sahi_tiler import SlidingWindowSahiTiler
from services.interface.cv_pipeline import CvPipeline
from services.interface.person_detector import PersonDetector, RawDetection
from services.interface.sahi_tiler import SahiTiler
from storage.interface.artifact_store import ArtifactStore


class ClothingScoringCvPipeline(CvPipeline):
    def __init__(
        self,
        detector: PersonDetector,
        artifact_store: ArtifactStore,
        dao_factory: DaoFactory,
        tiler: SahiTiler | None = None,
    ) -> None:
        self._detector = detector
        self._artifact_store = artifact_store
        self._dao_factory = dao_factory
        self._tiler = tiler or SlidingWindowSahiTiler()

    def process(self, job: Job, frames: list[Artifact]) -> list[Detection]:
        colors = self._clothing_colors(job)
        detections: list[Detection] = []
        for frame in frames:
            image = self._load_image(frame)
            if image is None:
                continue
            raw = self._detect_full_frame(image)
            for box in raw:
                crop = _crop(image, box)
                score = clothing_match_score(crop, colors)
                detections.append(
                    Detection(
                        id=str(uuid4()),
                        job_id=job.id,
                        class_name=DetectionClassName.PERSON,
                        bbox=BoundingBox(x=box.x, y=box.y, width=box.width, height=box.height),
                        confidence=box.confidence,
                        frame_id=frame.id,
                        clothing_match_score=score,
                    )
                )
        return detections

    def _detect_full_frame(self, image: np.ndarray) -> list[RawDetection]:
        restitched: list[RawDetection] = []
        for tile in self._tiler.tile(image):
            for box in self._detector.detect(tile.image):
                restitched.append(
                    RawDetection(
                        x=box.x + tile.x,
                        y=box.y + tile.y,
                        width=box.width,
                        height=box.height,
                        confidence=box.confidence,
                    )
                )
        return non_max_suppression(restitched)

    def _load_image(self, frame: Artifact) -> np.ndarray | None:
        payload = self._artifact_store.get(frame.storage_key)
        decoded = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
        return decoded

    def _clothing_colors(self, job: Job) -> list[str]:
        if not job.incident_id:
            return ["red"]
        incident = self._dao_factory.create_incident_dao().get_by_id(job.incident_id)
        if incident is None or not incident.subject.clothing_colors:
            return ["red"]
        return incident.subject.clothing_colors


def _crop(image: np.ndarray, box: RawDetection) -> np.ndarray:
    height, width = image.shape[:2]
    x1 = int(max(0, box.x))
    y1 = int(max(0, box.y))
    x2 = int(min(width, box.x + box.width))
    y2 = int(min(height, box.y + box.height))
    if x2 <= x1 or y2 <= y1:
        return image[0:1, 0:1]
    return image[y1:y2, x1:x2]
