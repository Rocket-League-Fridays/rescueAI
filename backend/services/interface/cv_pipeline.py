from abc import ABC, abstractmethod

from models.domain import Artifact, Detection, Job


class CvPipeline(ABC):
    @abstractmethod
    def process(self, job: Job, frames: list[Artifact]) -> list[Detection]:
        raise NotImplementedError
