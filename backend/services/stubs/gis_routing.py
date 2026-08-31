from models.domain import (
    DroneTelemetry,
    GeoPoint,
    Job,
    LandingZone,
    Route,
    SituationAssessment,
)
from services.interface.gis_router import GisRouter


class StubGisRouter(GisRouter):
    def route(
        self,
        job: Job,
        telemetry: DroneTelemetry,
        situation: SituationAssessment | None = None,
        trail_line: list[GeoPoint] | None = None,
    ) -> tuple[list[LandingZone], Route | None]:
        return [], None
