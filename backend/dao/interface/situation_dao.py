from abc import ABC, abstractmethod

from models.domain import SituationAssessment


class SituationDao(ABC):
    @abstractmethod
    def save(self, situation: SituationAssessment) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, situation_id: str) -> SituationAssessment | None:
        raise NotImplementedError

    @abstractmethod
    def get_by_job_id(self, job_id: str) -> SituationAssessment | None:
        raise NotImplementedError
