from abc import ABC, abstractmethod

from models.domain import Artifact, Detection, Job


class DetectionEvidenceRenderer(ABC):
    @abstractmethod
    def render(
        self,
        job: Job,
        subject_name: str,
        detections: list[Detection],
        frames: list[Artifact],
    ) -> Artifact | None:
        raise NotImplementedError
