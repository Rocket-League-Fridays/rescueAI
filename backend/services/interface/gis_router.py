from abc import ABC, abstractmethod

from models.domain import (
    DroneTelemetry,
    GeoPoint,
    Job,
    LandingZone,
    Route,
    SituationAssessment,
)


class GisRouter(ABC):
    @abstractmethod
    def route(
        self,
        job: Job,
        telemetry: DroneTelemetry,
        situation: SituationAssessment | None = None,
        trail_line: list[GeoPoint] | None = None,
    ) -> tuple[list[LandingZone], Route | None]:
        raise NotImplementedError
