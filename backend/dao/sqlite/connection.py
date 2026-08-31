from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS telemetry (
    id TEXT PRIMARY KEY,
    position_lat REAL NOT NULL,
    position_lng REAL NOT NULL,
    bounds_sw_lat REAL NOT NULL,
    bounds_sw_lng REAL NOT NULL,
    bounds_ne_lat REAL NOT NULL,
    bounds_ne_lng REAL NOT NULL,
    altitude_meters REAL NOT NULL,
    heading_degrees REAL NOT NULL,
    gimbal_pitch REAL NOT NULL,
    gimbal_yaw REAL NOT NULL,
    gimbal_roll REAL NOT NULL,
    timestamp_utc TEXT NOT NULL,
    speed_mps REAL,
    battery_percent REAL
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    failure_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    telemetry_id TEXT NOT NULL,
    video_artifact_id TEXT,
    detection_ids_json TEXT NOT NULL DEFAULT '[]',
    landing_zone_ids_json TEXT NOT NULL DEFAULT '[]',
    route_id TEXT,
    FOREIGN KEY (telemetry_id) REFERENCES telemetry(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    frame_index INTEGER,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS detections (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    class_name TEXT NOT NULL,
    bbox_x REAL NOT NULL,
    bbox_y REAL NOT NULL,
    bbox_width REAL NOT NULL,
    bbox_height REAL NOT NULL,
    confidence REAL NOT NULL,
    frame_id TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS landing_zones (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    centroid_lat REAL NOT NULL,
    centroid_lng REAL NOT NULL,
    bounds_sw_lat REAL NOT NULL,
    bounds_sw_lng REAL NOT NULL,
    bounds_ne_lat REAL NOT NULL,
    bounds_ne_lng REAL NOT NULL,
    slope_degrees REAL NOT NULL,
    area_sq_ft REAL NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL UNIQUE,
    waypoints_json TEXT NOT NULL,
    total_cost REAL NOT NULL,
    landing_zone_id TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);
"""


class SqliteConnectionProvider:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path

    @classmethod
    def initialize(cls, db_path: str) -> SqliteConnectionProvider:
        provider = cls(db_path)
        provider._ensure_parent_dir()
        provider._initialize_schema()
        return provider

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _ensure_parent_dir(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)

    def _initialize_schema(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA_SQL)
