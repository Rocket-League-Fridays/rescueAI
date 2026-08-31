from abc import ABC, abstractmethod

from models.domain import Artifact


class FrameExtractor(ABC):
    @abstractmethod
    def extract(self, video_artifact: Artifact) -> list[Artifact]:
        raise NotImplementedError
