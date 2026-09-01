from __future__ import annotations

from uuid import uuid4

import cv2
import numpy as np

from dao.interface.artifact_dao import ArtifactDao
from models.domain import Artifact, ArtifactKind, Detection, DetectionClassName, Job
from services.interface.detection_evidence_renderer import DetectionEvidenceRenderer
from storage.interface.artifact_store import ArtifactStore


class OpenCvDetectionEvidenceRenderer(DetectionEvidenceRenderer):
    def __init__(
        self,
        artifact_store: ArtifactStore,
        artifact_dao: ArtifactDao,
        jpeg_quality: int = 92,
    ) -> None:
        self._artifact_store = artifact_store
        self._artifact_dao = artifact_dao
        self._jpeg_quality = jpeg_quality

    def render(
        self,
        job: Job,
        subject_name: str,
        detections: list[Detection],
        frames: list[Artifact],
    ) -> Artifact | None:
        people = [
            detection
            for detection in detections
            if detection.class_name == DetectionClassName.PERSON and detection.frame_id
        ]
        if not people:
            return None
        winner = max(
            people,
            key=lambda detection: (detection.clothing_match_score, detection.confidence),
        )
        frame = next((item for item in frames if item.id == winner.frame_id), None)
        if frame is None:
            return None
        image = _decode(self._artifact_store.get(frame.storage_key))
        if image is None:
            return None
        source_image = image.copy()

        frame_detections = [item for item in people if item.frame_id == frame.id]
        for detection in frame_detections:
            _draw_detection(
                image,
                detection,
                subject_name=subject_name,
                is_winner=detection.id == winner.id,
            )
        _draw_summary(image, subject_name, winner, len(people))
        _draw_zoom_inset(image, source_image, subject_name, winner)

        encoded, buffer = cv2.imencode(
            ".jpg",
            image,
            [int(cv2.IMWRITE_JPEG_QUALITY), self._jpeg_quality],
        )
        if not encoded:
            raise ValueError(f"Failed to render detection evidence for job {job.id}")

        artifact_id = str(uuid4())
        artifact = Artifact(
            id=artifact_id,
            job_id=job.id,
            kind=ArtifactKind.ANNOTATED_FRAME,
            storage_key=f"{job.id}/evidence/{artifact_id}.jpg",
            mime_type="image/jpeg",
            width=int(image.shape[1]),
            height=int(image.shape[0]),
            frame_index=frame.frame_index,
        )
        self._artifact_store.put(artifact.storage_key, buffer.tobytes())
        self._artifact_dao.save(artifact)
        return artifact


def _decode(payload: bytes) -> np.ndarray | None:
    return cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)


def _draw_detection(
    image: np.ndarray,
    detection: Detection,
    subject_name: str,
    is_winner: bool,
) -> None:
    height, width = image.shape[:2]
    x1 = max(0, min(width - 1, round(detection.bbox.x)))
    y1 = max(0, min(height - 1, round(detection.bbox.y)))
    x2 = max(x1 + 1, min(width, round(detection.bbox.x + detection.bbox.width)))
    y2 = max(y1 + 1, min(height, round(detection.bbox.y + detection.bbox.height)))
    color = (45, 196, 255) if is_winner else (120, 155, 80)
    thickness = max(2, width // 500) if is_winner else max(1, width // 900)
    cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)

    if is_winner:
        label = (
            f"{subject_name.upper()} // FOUND // "
            f"P {detection.confidence:.0%} // C {detection.clothing_match_score:.0%}"
        )
    else:
        label = f"PERSON {detection.confidence:.0%}"
    _draw_label(image, label, x1, y1, color)


def _draw_label(
    image: np.ndarray,
    text: str,
    x: int,
    y: int,
    color: tuple[int, int, int],
) -> None:
    scale = max(0.45, image.shape[1] / 1800)
    thickness = max(1, round(scale * 2))
    (text_width, text_height), baseline = cv2.getTextSize(
        text, cv2.FONT_HERSHEY_DUPLEX, scale, thickness
    )
    top = max(0, y - text_height - baseline - 10)
    right = min(image.shape[1], x + text_width + 12)
    cv2.rectangle(image, (x, top), (right, y), (10, 17, 12), -1)
    cv2.putText(
        image,
        text,
        (x + 6, max(text_height + 2, y - baseline - 5)),
        cv2.FONT_HERSHEY_DUPLEX,
        scale,
        color,
        thickness,
        cv2.LINE_AA,
    )


def _draw_summary(
    image: np.ndarray,
    subject_name: str,
    winner: Detection,
    candidate_count: int,
) -> None:
    text = (
        f"RESCUEAI // {candidate_count} PERSON SIGHTINGS // "
        f"BEST MATCH {subject_name.upper()} {winner.clothing_match_score:.0%}"
    )
    scale = max(0.5, image.shape[1] / 1600)
    thickness = max(1, round(scale * 2))
    (_, text_height), baseline = cv2.getTextSize(
        text, cv2.FONT_HERSHEY_DUPLEX, scale, thickness
    )
    banner_height = text_height + baseline + 22
    overlay = image.copy()
    cv2.rectangle(overlay, (0, 0), (image.shape[1], banner_height), (7, 15, 10), -1)
    cv2.addWeighted(overlay, 0.88, image, 0.12, 0, image)
    cv2.putText(
        image,
        text,
        (14, text_height + 10),
        cv2.FONT_HERSHEY_DUPLEX,
        scale,
        (45, 196, 255),
        thickness,
        cv2.LINE_AA,
    )


def _draw_zoom_inset(
    image: np.ndarray,
    source_image: np.ndarray,
    subject_name: str,
    winner: Detection,
) -> None:
    height, width = source_image.shape[:2]
    box = winner.bbox
    pad_x = max(40.0, box.width * 4.0)
    pad_y = max(40.0, box.height * 2.0)
    crop_x1 = max(0, round(box.x - pad_x))
    crop_y1 = max(0, round(box.y - pad_y))
    crop_x2 = min(width, round(box.x + box.width + pad_x))
    crop_y2 = min(height, round(box.y + box.height + pad_y))
    crop = source_image[crop_y1:crop_y2, crop_x1:crop_x2]
    if crop.size == 0:
        return

    inset_width = min(width - 32, max(180, round(width * 0.32)))
    inset_height = min(height - 70, min(220, max(100, round(inset_width * 0.58))))
    if inset_width < 80 or inset_height < 60:
        return
    inset = cv2.resize(crop, (inset_width, inset_height), interpolation=cv2.INTER_CUBIC)
    scale_x = inset_width / max(1, crop_x2 - crop_x1)
    scale_y = inset_height / max(1, crop_y2 - crop_y1)
    subject_x1 = round((box.x - crop_x1) * scale_x)
    subject_y1 = round((box.y - crop_y1) * scale_y)
    subject_x2 = round((box.x + box.width - crop_x1) * scale_x)
    subject_y2 = round((box.y + box.height - crop_y1) * scale_y)
    cv2.rectangle(
        inset,
        (subject_x1, subject_y1),
        (subject_x2, subject_y2),
        (45, 196, 255),
        max(2, inset_width // 350),
    )
    label_scale = max(0.5, inset_width / 750)
    label_height = max(30, round(label_scale * 42))
    cv2.rectangle(inset, (0, 0), (inset_width, label_height), (7, 15, 10), -1)
    cv2.putText(
        inset,
        f"SUBJECT ZOOM // {subject_name.upper()}",
        (max(8, inset_width // 100), label_height - max(7, label_height // 5)),
        cv2.FONT_HERSHEY_DUPLEX,
        label_scale,
        (45, 196, 255),
        max(1, round(label_scale * 1.5)),
        cv2.LINE_AA,
    )

    left = 16
    top = image.shape[0] - inset_height - 16
    image[top : top + inset_height, left : left + inset_width] = inset
    cv2.rectangle(
        image,
        (left, top),
        (left + inset_width, top + inset_height),
        (45, 196, 255),
        max(3, inset_width // 300),
    )
