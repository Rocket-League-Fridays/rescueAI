from __future__ import annotations

import json
from datetime import datetime

from dao.interface.incident_dao import IncidentDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import GeoPoint, Incident, IncidentStatus, SubjectProfile


class SqliteIncidentDao(IncidentDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, incident: Incident) -> None:
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT INTO incidents (
                    id, transcript, subject_name, clothing_colors_json, subject_notes,
                    trail_name, trail_line_json, status, created_at, updated_at, situation_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                self._to_row(incident),
            )

    def get_by_id(self, incident_id: str) -> Incident | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM incidents WHERE id = ?",
                (incident_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def get_open(self) -> Incident | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM incidents
                WHERE status = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (IncidentStatus.OPEN.value,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def update(self, incident: Incident) -> None:
        with self._connections.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE incidents SET
                    transcript = ?,
                    subject_name = ?,
                    clothing_colors_json = ?,
                    subject_notes = ?,
                    trail_name = ?,
                    trail_line_json = ?,
                    status = ?,
                    updated_at = ?,
                    situation_id = ?
                WHERE id = ?
                """,
                (
                    incident.transcript,
                    incident.subject.display_name,
                    json.dumps(incident.subject.clothing_colors),
                    incident.subject.notes,
                    incident.trail_name,
                    json.dumps(
                        [{"lat": point.lat, "lng": point.lng} for point in incident.trail_line]
                    ),
                    incident.status.value,
                    incident.updated_at.isoformat(),
                    incident.situation_id,
                    incident.id,
                ),
            )
            if cursor.rowcount == 0:
                raise ValueError(f"Failed to update incident: {incident.id} does not exist")

    def _to_row(self, incident: Incident) -> tuple:
        return (
            incident.id,
            incident.transcript,
            incident.subject.display_name,
            json.dumps(incident.subject.clothing_colors),
            incident.subject.notes,
            incident.trail_name,
            json.dumps([{"lat": point.lat, "lng": point.lng} for point in incident.trail_line]),
            incident.status.value,
            incident.created_at.isoformat(),
            incident.updated_at.isoformat(),
            incident.situation_id,
        )

    def _to_domain(self, row: object) -> Incident:
        raw_line = json.loads(row["trail_line_json"])
        return Incident(
            id=row["id"],
            transcript=row["transcript"],
            subject=SubjectProfile(
                display_name=row["subject_name"],
                clothing_colors=json.loads(row["clothing_colors_json"]),
                notes=row["subject_notes"],
            ),
            trail_name=row["trail_name"],
            trail_line=[GeoPoint(lat=point["lat"], lng=point["lng"]) for point in raw_line],
            status=IncidentStatus(row["status"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            situation_id=row["situation_id"],
        )
