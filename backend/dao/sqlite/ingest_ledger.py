from __future__ import annotations

from datetime import datetime, timezone

from dao.interface.ingest_ledger import IngestLedger
from dao.sqlite.connection import SqliteConnectionProvider


class SqliteIngestLedger(IngestLedger):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def has_processed(self, sha256: str) -> bool:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT 1 FROM ingest_ledger WHERE sha256 = ?",
                (sha256,),
            ).fetchone()
        return row is not None

    def record(self, sha256: str, source_path: str, job_id: str) -> None:
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO ingest_ledger (sha256, source_path, job_id, ingested_at)
                VALUES (?, ?, ?, ?)
                """,
                (sha256, source_path, job_id, datetime.now(timezone.utc).isoformat()),
            )
