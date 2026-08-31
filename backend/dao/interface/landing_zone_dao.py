from abc import ABC, abstractmethod

from models.domain import LandingZone


class LandingZoneDao(ABC):
    @abstractmethod
    def save(self, landing_zone: LandingZone) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, landing_zone_id: str) -> LandingZone | None:
        raise NotImplementedError

    @abstractmethod
    def list_by_job_id(self, job_id: str) -> list[LandingZone]:
        raise NotImplementedError

    @abstractmethod
    def save_all(self, landing_zones: list[LandingZone]) -> None:
        raise NotImplementedError
