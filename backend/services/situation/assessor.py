from __future__ import annotations

from uuid import uuid4

import cv2
import numpy as np

from models.domain import Artifact, Detection, DetectionClassName, SituationAssessment
from services.cv.clothing_score import canopy_fraction
from storage.interface.artifact_store import ArtifactStore


class SituationAssessor:
    def __init__(self, artifact_store: ArtifactStore) -> None:
        self._artifact_store = artifact_store

    def assess(
        self,
        job_id: str,
        incident_id: str | None,
        detections: list[Detection],
        frames: list[Artifact],
    ) -> SituationAssessment | None:
        subject = _best_person(detections)
        if subject is None or subject.ground_point is None:
            return None
        frames_by_id = {frame.id: frame for frame in frames}
        frame = frames_by_id.get(subject.frame_id) if subject.frame_id else None
        canopy = 0.0
        if frame is not None:
            image = _decode(self._artifact_store.get(frame.storage_key))
            if image is not None:
                canopy = canopy_fraction(_expanded_crop(image, subject))
        return SituationAssessment(
            id=str(uuid4()),
            job_id=job_id,
            incident_id=incident_id,
            detection_id=subject.id,
            ground_point=subject.ground_point,
            canopy_fraction=canopy,
            notes="Approximate canopy from HSV green around the subject box.",
        )


def _best_person(detections: list[Detection]) -> Detection | None:
    people = [item for item in detections if item.class_name == DetectionClassName.PERSON]
    if not people:
        return None
    return max(people, key=lambda item: (item.clothing_match_score, item.confidence))


def _decode(payload: bytes) -> np.ndarray | None:
    return cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)


def _expanded_crop(image: np.ndarray, detection: Detection) -> np.ndarray:
    height, width = image.shape[:2]
    pad_x = detection.bbox.width
    pad_y = detection.bbox.height
    x1 = int(max(0, detection.bbox.x - pad_x * 0.5))
    y1 = int(max(0, detection.bbox.y - pad_y * 0.5))
    x2 = int(min(width, detection.bbox.x + detection.bbox.width + pad_x * 0.5))
    y2 = int(min(height, detection.bbox.y + detection.bbox.height + pad_y * 0.5))
    return image[y1:y2, x1:x2]
