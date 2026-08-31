from __future__ import annotations

import tempfile
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np

from dao.interface.artifact_dao import ArtifactDao
from models.domain import Artifact, ArtifactKind
from services.interface.frame_extractor import FrameExtractor
from storage.interface.artifact_store import ArtifactStore


class UnreadableVideoError(ValueError):
    def __init__(self, video_id: str) -> None:
        super().__init__(f"Failed to extract frames: unreadable video {video_id}")


class OpenCvFrameExtractor(FrameExtractor):
    def __init__(
        self,
        artifact_store: ArtifactStore,
        artifact_dao: ArtifactDao,
        frame_stride: int,
        max_frames: int,
        jpeg_quality: int,
    ) -> None:
        self._artifact_store = artifact_store
        self._artifact_dao = artifact_dao
        self._frame_stride = frame_stride
        self._max_frames = max_frames
        self._jpeg_quality = jpeg_quality

    def extract(self, video_artifact: Artifact) -> list[Artifact]:
        payload = self._artifact_store.get(video_artifact.storage_key)
        suffix = Path(video_artifact.storage_key).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(payload)
            tmp_path = Path(tmp.name)

        capture = cv2.VideoCapture(str(tmp_path))
        try:
            if not capture.isOpened():
                raise UnreadableVideoError(video_artifact.id)
            return self._sample_frames(capture, video_artifact)
        finally:
            capture.release()
            tmp_path.unlink(missing_ok=True)

    def _sample_frames(
        self, capture: cv2.VideoCapture, video_artifact: Artifact
    ) -> list[Artifact]:
        frames: list[Artifact] = []
        index = 0
        while len(frames) < self._max_frames:
            ok, image = capture.read()
            if not ok:
                break
            if index % self._frame_stride == 0:
                frames.append(self._persist_frame(video_artifact, image, index))
            index += 1
        if not frames:
            raise UnreadableVideoError(video_artifact.id)
        return frames

    def _persist_frame(
        self, video_artifact: Artifact, image: np.ndarray, frame_index: int
    ) -> Artifact:
        encoded, buffer = cv2.imencode(
            ".jpg",
            image,
            [int(cv2.IMWRITE_JPEG_QUALITY), self._jpeg_quality],
        )
        if not encoded:
            raise ValueError(
                f"Failed to extract frames: could not encode frame {frame_index} of {video_artifact.id}"
            )
        artifact_id = str(uuid4())
        storage_key = f"{video_artifact.job_id}/frames/{artifact_id}.jpg"
        self._artifact_store.put(storage_key, buffer.tobytes())
        height, width = image.shape[:2]
        artifact = Artifact(
            id=artifact_id,
            job_id=video_artifact.job_id,
            kind=ArtifactKind.FRAME,
            storage_key=storage_key,
            mime_type="image/jpeg",
            width=int(width),
            height=int(height),
            frame_index=frame_index,
        )
        self._artifact_dao.save(artifact)
        return artifact
