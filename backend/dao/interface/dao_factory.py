from abc import ABC, abstractmethod

from dao.interface.artifact_dao import ArtifactDao
from dao.interface.detection_dao import DetectionDao
from dao.interface.ingest_ledger import IngestLedger
from dao.interface.job_dao import JobDao
from dao.interface.landing_zone_dao import LandingZoneDao
from dao.interface.route_dao import RouteDao
from dao.interface.telemetry_dao import TelemetryDao


class DaoFactory(ABC):
    @abstractmethod
    def create_job_dao(self) -> JobDao:
        raise NotImplementedError

    @abstractmethod
    def create_telemetry_dao(self) -> TelemetryDao:
        raise NotImplementedError

    @abstractmethod
    def create_artifact_dao(self) -> ArtifactDao:
        raise NotImplementedError

    @abstractmethod
    def create_detection_dao(self) -> DetectionDao:
        raise NotImplementedError

    @abstractmethod
    def create_landing_zone_dao(self) -> LandingZoneDao:
        raise NotImplementedError

    @abstractmethod
    def create_route_dao(self) -> RouteDao:
        raise NotImplementedError

    @abstractmethod
    def create_ingest_ledger(self) -> IngestLedger:
        raise NotImplementedError
