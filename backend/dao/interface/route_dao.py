from abc import ABC, abstractmethod

from models.domain import Route


class RouteDao(ABC):
    @abstractmethod
    def save(self, route: Route) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, route_id: str) -> Route | None:
        raise NotImplementedError

    @abstractmethod
    def get_by_job_id(self, job_id: str) -> Route | None:
        raise NotImplementedError
