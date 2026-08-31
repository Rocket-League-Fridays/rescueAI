from models.domain import DroneTelemetry, Job, LandingZone, Route
from services.interface.gis_router import GisRouter


class StubGisRouter(GisRouter):
    def route(
        self, job: Job, telemetry: DroneTelemetry
    ) -> tuple[list[LandingZone], Route | None]:
        return [], None
