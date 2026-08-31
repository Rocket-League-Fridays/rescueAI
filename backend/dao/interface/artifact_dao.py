from abc import ABC, abstractmethod

from models.domain import Artifact


class ArtifactDao(ABC):
    @abstractmethod
    def save(self, artifact: Artifact) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, artifact_id: str) -> Artifact | None:
        raise NotImplementedError

    @abstractmethod
    def list_by_job_id(self, job_id: str) -> list[Artifact]:
        raise NotImplementedError
