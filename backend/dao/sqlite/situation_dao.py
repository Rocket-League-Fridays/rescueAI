from __future__ import annotations

from dao.interface.situation_dao import SituationDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import GeoPoint, SituationAssessment


class SqliteSituationDao(SituationDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, situation: SituationAssessment) -> None:
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT INTO situations (
                    id, job_id, incident_id, detection_id,
                    ground_lat, ground_lng, canopy_fraction, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    situation.id,
                    situation.job_id,
                    situation.incident_id,
                    situation.detection_id,
                    situation.ground_point.lat,
                    situation.ground_point.lng,
                    situation.canopy_fraction,
                    situation.notes,
                ),
            )

    def get_by_id(self, situation_id: str) -> SituationAssessment | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM situations WHERE id = ?",
                (situation_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def get_by_job_id(self, job_id: str) -> SituationAssessment | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM situations WHERE job_id = ? ORDER BY rowid DESC LIMIT 1",
                (job_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def _to_domain(self, row: object) -> SituationAssessment:
        return SituationAssessment(
            id=row["id"],
            job_id=row["job_id"],
            incident_id=row["incident_id"],
            detection_id=row["detection_id"],
            ground_point=GeoPoint(lat=row["ground_lat"], lng=row["ground_lng"]),
            canopy_fraction=row["canopy_fraction"],
            notes=row["notes"],
        )
