from abc import ABC, abstractmethod

from models.domain import DroneTelemetry, Job, LandingZone, Route


class GisRouter(ABC):
    @abstractmethod
    def route(
        self, job: Job, telemetry: DroneTelemetry
    ) -> tuple[list[LandingZone], Route | None]:
        raise NotImplementedError
