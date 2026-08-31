from abc import ABC, abstractmethod

from models.domain import Detection


class DetectionDao(ABC):
    @abstractmethod
    def save(self, detection: Detection) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, detection_id: str) -> Detection | None:
        raise NotImplementedError

    @abstractmethod
    def list_by_job_id(self, job_id: str) -> list[Detection]:
        raise NotImplementedError

    @abstractmethod
    def save_all(self, detections: list[Detection]) -> None:
        raise NotImplementedError
