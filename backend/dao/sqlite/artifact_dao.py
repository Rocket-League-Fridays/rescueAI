from __future__ import annotations

from dao.interface.artifact_dao import ArtifactDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import Artifact, ArtifactKind


class SqliteArtifactDao(ArtifactDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, artifact: Artifact) -> None:
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT INTO artifacts (
                    id, job_id, kind, storage_key, mime_type, width, height, frame_index
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    artifact.id,
                    artifact.job_id,
                    artifact.kind.value,
                    artifact.storage_key,
                    artifact.mime_type,
                    artifact.width,
                    artifact.height,
                    artifact.frame_index,
                ),
            )

    def get_by_id(self, artifact_id: str) -> Artifact | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM artifacts WHERE id = ?",
                (artifact_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def list_by_job_id(self, job_id: str) -> list[Artifact]:
        with self._connections.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM artifacts WHERE job_id = ? ORDER BY rowid ASC",
                (job_id,),
            ).fetchall()
        return [self._to_domain(row) for row in rows]

    def _to_domain(self, row: object) -> Artifact:
        return Artifact(
            id=row["id"],
            job_id=row["job_id"],
            kind=ArtifactKind(row["kind"]),
            storage_key=row["storage_key"],
            mime_type=row["mime_type"],
            width=row["width"],
            height=row["height"],
            frame_index=row["frame_index"],
        )
