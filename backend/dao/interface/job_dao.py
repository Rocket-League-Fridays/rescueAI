from abc import ABC, abstractmethod

from models.domain import Job


class JobDao(ABC):
    @abstractmethod
    def save(self, job: Job) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, job_id: str) -> Job | None:
        raise NotImplementedError

    @abstractmethod
    def update(self, job: Job) -> None:
        raise NotImplementedError
