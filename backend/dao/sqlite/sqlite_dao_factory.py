from __future__ import annotations

from dao.interface.artifact_dao import ArtifactDao
from dao.interface.dao_factory import DaoFactory
from dao.interface.detection_dao import DetectionDao
from dao.interface.incident_dao import IncidentDao
from dao.interface.ingest_ledger import IngestLedger
from dao.interface.job_dao import JobDao
from dao.interface.landing_zone_dao import LandingZoneDao
from dao.interface.route_dao import RouteDao
from dao.interface.situation_dao import SituationDao
from dao.interface.telemetry_dao import TelemetryDao
from dao.sqlite.artifact_dao import SqliteArtifactDao
from dao.sqlite.connection import SqliteConnectionProvider
from dao.sqlite.detection_dao import SqliteDetectionDao
from dao.sqlite.incident_dao import SqliteIncidentDao
from dao.sqlite.ingest_ledger import SqliteIngestLedger
from dao.sqlite.job_dao import SqliteJobDao
from dao.sqlite.landing_zone_dao import SqliteLandingZoneDao
from dao.sqlite.route_dao import SqliteRouteDao
from dao.sqlite.situation_dao import SqliteSituationDao
from dao.sqlite.telemetry_dao import SqliteTelemetryDao


class SqliteDaoFactory(DaoFactory):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    @classmethod
    def initialize(cls, db_path: str) -> SqliteDaoFactory:
        connections = SqliteConnectionProvider.initialize(db_path)
        return cls(connections)

    def create_job_dao(self) -> JobDao:
        return SqliteJobDao(self._connections)

    def create_telemetry_dao(self) -> TelemetryDao:
        return SqliteTelemetryDao(self._connections)

    def create_artifact_dao(self) -> ArtifactDao:
        return SqliteArtifactDao(self._connections)

    def create_detection_dao(self) -> DetectionDao:
        return SqliteDetectionDao(self._connections)

    def create_landing_zone_dao(self) -> LandingZoneDao:
        return SqliteLandingZoneDao(self._connections)

    def create_route_dao(self) -> RouteDao:
        return SqliteRouteDao(self._connections)

    def create_ingest_ledger(self) -> IngestLedger:
        return SqliteIngestLedger(self._connections)

    def create_incident_dao(self) -> IncidentDao:
        return SqliteIncidentDao(self._connections)

    def create_situation_dao(self) -> SituationDao:
        return SqliteSituationDao(self._connections)
