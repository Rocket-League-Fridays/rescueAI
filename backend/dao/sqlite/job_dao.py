from __future__ import annotations

import json
from datetime import datetime

from dao.interface.job_dao import JobDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import Job, JobStatus


class SqliteJobDao(JobDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, job: Job) -> None:
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT INTO jobs (
                    id, status, failure_reason, created_at, updated_at,
                    telemetry_id, video_artifact_id, detection_ids_json,
                    landing_zone_ids_json, route_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job.id,
                    job.status.value,
                    job.failure_reason,
                    job.created_at.isoformat(),
                    job.updated_at.isoformat(),
                    job.telemetry_id,
                    job.video_artifact_id,
                    json.dumps(job.detection_ids),
                    json.dumps(job.landing_zone_ids),
                    job.route_id,
                ),
            )

    def get_by_id(self, job_id: str) -> Job | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def update(self, job: Job) -> None:
        with self._connections.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE jobs SET
                    status = ?,
                    failure_reason = ?,
                    updated_at = ?,
                    telemetry_id = ?,
                    video_artifact_id = ?,
                    detection_ids_json = ?,
                    landing_zone_ids_json = ?,
                    route_id = ?
                WHERE id = ?
                """,
                (
                    job.status.value,
                    job.failure_reason,
                    job.updated_at.isoformat(),
                    job.telemetry_id,
                    job.video_artifact_id,
                    json.dumps(job.detection_ids),
                    json.dumps(job.landing_zone_ids),
                    job.route_id,
                    job.id,
                ),
            )
            if cursor.rowcount == 0:
                raise ValueError(f"Failed to update job: job {job.id} does not exist")

    def _to_domain(self, row: object) -> Job:
        return Job(
            id=row["id"],
            status=JobStatus(row["status"]),
            failure_reason=row["failure_reason"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            telemetry_id=row["telemetry_id"],
            video_artifact_id=row["video_artifact_id"],
            detection_ids=json.loads(row["detection_ids_json"]),
            landing_zone_ids=json.loads(row["landing_zone_ids_json"]),
            route_id=row["route_id"],
        )
