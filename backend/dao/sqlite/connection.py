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

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    transcript TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    clothing_colors_json TEXT NOT NULL DEFAULT '[]',
    subject_notes TEXT NOT NULL DEFAULT '',
    trail_name TEXT NOT NULL,
    trail_line_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    situation_id TEXT
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
    incident_id TEXT,
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
    ground_lat REAL,
    ground_lng REAL,
    clothing_match_score REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS situations (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    incident_id TEXT,
    detection_id TEXT NOT NULL,
    ground_lat REAL NOT NULL,
    ground_lng REAL NOT NULL,
    canopy_fraction REAL NOT NULL,
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ingest_ledger (
    sha256 TEXT PRIMARY KEY,
    source_path TEXT NOT NULL,
    job_id TEXT NOT NULL,
    ingested_at TEXT NOT NULL
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
    max_slope_degrees REAL NOT NULL,
    area_sq_ft REAL NOT NULL,
    canopy_fraction REAL,
    suitability_score REAL NOT NULL DEFAULT 0,
    assessed_criteria_json TEXT NOT NULL DEFAULT '[]',
    unassessed_criteria_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL UNIQUE,
    waypoints_json TEXT NOT NULL,
    total_cost REAL NOT NULL,
    landing_zone_id TEXT,
    distance_meters REAL NOT NULL DEFAULT 0,
    elevation_gain_meters REAL NOT NULL DEFAULT 0,
    estimated_minutes REAL NOT NULL DEFAULT 0,
    inbound_minutes REAL NOT NULL DEFAULT 0,
    legs_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
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
            self._migrate_columns(connection)

    def _migrate_columns(self, connection: sqlite3.Connection) -> None:
        detection_cols = {row[1] for row in connection.execute("PRAGMA table_info(detections)")}
        if "ground_lat" not in detection_cols:
            connection.execute("ALTER TABLE detections ADD COLUMN ground_lat REAL")
        if "ground_lng" not in detection_cols:
            connection.execute("ALTER TABLE detections ADD COLUMN ground_lng REAL")
        if "clothing_match_score" not in detection_cols:
            connection.execute(
                "ALTER TABLE detections ADD COLUMN clothing_match_score REAL NOT NULL DEFAULT 0"
            )
        job_cols = {row[1] for row in connection.execute("PRAGMA table_info(jobs)")}
        if "incident_id" not in job_cols:
            connection.execute("ALTER TABLE jobs ADD COLUMN incident_id TEXT")
        lz_cols = {row[1] for row in connection.execute("PRAGMA table_info(landing_zones)")}
        if "max_slope_degrees" not in lz_cols and "slope_degrees" in lz_cols:
            connection.execute(
                "ALTER TABLE landing_zones RENAME COLUMN slope_degrees TO max_slope_degrees"
            )
        for column, ddl in (
            ("canopy_fraction", "REAL"),
            ("suitability_score", "REAL NOT NULL DEFAULT 0"),
            ("assessed_criteria_json", "TEXT NOT NULL DEFAULT '[]'"),
            ("unassessed_criteria_json", "TEXT NOT NULL DEFAULT '[]'"),
            ("notes", "TEXT NOT NULL DEFAULT ''"),
        ):
            if column not in lz_cols:
                connection.execute(f"ALTER TABLE landing_zones ADD COLUMN {column} {ddl}")
        route_cols = {row[1] for row in connection.execute("PRAGMA table_info(routes)")}
        for column, ddl in (
            ("distance_meters", "REAL NOT NULL DEFAULT 0"),
            ("elevation_gain_meters", "REAL NOT NULL DEFAULT 0"),
            ("estimated_minutes", "REAL NOT NULL DEFAULT 0"),
            ("inbound_minutes", "REAL NOT NULL DEFAULT 0"),
            ("legs_json", "TEXT NOT NULL DEFAULT '[]'"),
            ("notes", "TEXT NOT NULL DEFAULT ''"),
        ):
            if column not in route_cols:
                connection.execute(f"ALTER TABLE routes ADD COLUMN {column} {ddl}")
