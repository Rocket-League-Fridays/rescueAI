import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from dao.sqlite.connection import SqliteConnectionProvider
from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
    LandingZone,
    LandingZoneCriterion,
)


def _seed_job(factory: SqliteDaoFactory) -> None:
    now = datetime.now(timezone.utc)
    factory.create_telemetry_dao().save(
        DroneTelemetry(
            id="tel-1",
            position=GeoPoint(lat=40.23, lng=-111.65),
            bounds=GeoBounds(
                south_west=GeoPoint(lat=40.22, lng=-111.68),
                north_east=GeoPoint(lat=40.25, lng=-111.63),
            ),
            altitude_meters=400,
            heading_degrees=90,
            gimbal=GimbalOrientation(pitch_degrees=-30, yaw_degrees=0, roll_degrees=0),
            timestamp_utc=now,
        )
    )
    factory.create_job_dao().save(
        Job(
            id="job-1",
            status=JobStatus.PROCESSING,
            created_at=now,
            updated_at=now,
            telemetry_id="tel-1",
        )
    )


def _landing_zone(**overrides: object) -> LandingZone:
    defaults = dict(
        id="lz-1",
        job_id="job-1",
        centroid=GeoPoint(lat=40.24, lng=-111.64),
        bounds=GeoBounds(
            south_west=GeoPoint(lat=40.2395, lng=-111.6405),
            north_east=GeoPoint(lat=40.2405, lng=-111.6395),
        ),
        max_slope_degrees=6.5,
        area_sq_ft=9687.5,
        canopy_fraction=None,
        suitability_score=0.19,
        assessed_criteria=[LandingZoneCriterion.SLOPE],
        unassessed_criteria=[LandingZoneCriterion.APPROACH_CLEARANCE],
        notes="slope only",
    )
    defaults.update(overrides)
    return LandingZone(**defaults)


def test_landing_zone_round_trip_preserves_every_field(tmp_path: Path) -> None:
    factory = SqliteDaoFactory.initialize(str(tmp_path / "sar.db"))
    _seed_job(factory)
    dao = factory.create_landing_zone_dao()
    dao.save(_landing_zone(canopy_fraction=0.42))

    loaded = dao.get_by_id("lz-1")
    assert loaded == _landing_zone(canopy_fraction=0.42)


def test_unknown_canopy_round_trips_as_none_not_zero(tmp_path: Path) -> None:
    factory = SqliteDaoFactory.initialize(str(tmp_path / "sar.db"))
    _seed_job(factory)
    dao = factory.create_landing_zone_dao()
    dao.save(_landing_zone(canopy_fraction=None))

    loaded = dao.get_by_id("lz-1")
    assert loaded is not None
    assert loaded.canopy_fraction is None


def test_migration_renames_slope_column_on_an_existing_database(tmp_path: Path) -> None:
    db_path = str(tmp_path / "legacy.db")
    legacy = sqlite3.connect(db_path)
    legacy.executescript(
        """
        CREATE TABLE landing_zones (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            centroid_lat REAL NOT NULL,
            centroid_lng REAL NOT NULL,
            bounds_sw_lat REAL NOT NULL,
            bounds_sw_lng REAL NOT NULL,
            bounds_ne_lat REAL NOT NULL,
            bounds_ne_lng REAL NOT NULL,
            slope_degrees REAL NOT NULL,
            area_sq_ft REAL NOT NULL
        );
        INSERT INTO landing_zones VALUES
            ('lz-old', 'job-old', 40.24, -111.64, 40.239, -111.641, 40.241, -111.639, 6.5, 10000);
        """
    )
    legacy.commit()
    legacy.close()

    SqliteConnectionProvider.initialize(db_path)

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    columns = {row[1] for row in connection.execute("PRAGMA table_info(landing_zones)")}
    row = connection.execute("SELECT * FROM landing_zones WHERE id = 'lz-old'").fetchone()
    connection.close()

    assert "max_slope_degrees" in columns
    assert "slope_degrees" not in columns
    assert {"canopy_fraction", "suitability_score", "notes"} <= columns
    assert row["max_slope_degrees"] == 6.5
    assert row["canopy_fraction"] is None
