from __future__ import annotations

import logging

import numpy as np

from services.interface.person_detector import PersonDetector, RawDetection

logger = logging.getLogger(__name__)

_COCO_PERSON = 0


class UltralyticsPersonDetector(PersonDetector):
    def __init__(self, model_name: str = "yolo11n.pt", confidence: float = 0.25) -> None:
        self._model_name = model_name
        self._confidence = confidence
        self._model = None

    def detect(self, image: np.ndarray) -> list[RawDetection]:
        model = self._load()
        results = model.predict(image, conf=self._confidence, verbose=False)
        boxes: list[RawDetection] = []
        if not results:
            return boxes
        result = results[0]
        if result.boxes is None:
            return boxes
        for box in result.boxes:
            cls_id = int(box.cls[0]) if box.cls is not None else -1
            if cls_id != _COCO_PERSON:
                continue
            xyxy = box.xyxy[0].tolist()
            x1, y1, x2, y2 = xyxy
            boxes.append(
                RawDetection(
                    x=float(x1),
                    y=float(y1),
                    width=float(max(1.0, x2 - x1)),
                    height=float(max(1.0, y2 - y1)),
                    confidence=float(box.conf[0]) if box.conf is not None else 0.0,
                )
            )
        return boxes

    def _load(self):
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(self._model_name)
            logger.info(
                "yolo_loaded",
                extra={"event": "yolo_loaded", "model": self._model_name},
            )
        return self._model


def try_create_ultralytics_detector(model_name: str) -> PersonDetector | None:
    try:
        import ultralytics  # noqa: F401

        return UltralyticsPersonDetector(model_name)
    except Exception:
        logger.warning(
            "yolo_unavailable",
            extra={"event": "yolo_unavailable", "model": model_name},
            exc_info=True,
        )
        return None
