from abc import ABC, abstractmethod

from models.domain import Incident


class IncidentDao(ABC):
    @abstractmethod
    def save(self, incident: Incident) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, incident_id: str) -> Incident | None:
        raise NotImplementedError

    @abstractmethod
    def get_open(self) -> Incident | None:
        raise NotImplementedError

    @abstractmethod
    def update(self, incident: Incident) -> None:
        raise NotImplementedError
