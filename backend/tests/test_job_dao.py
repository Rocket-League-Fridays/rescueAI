from datetime import datetime, timezone
from pathlib import Path

from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from models.domain import (
    DroneTelemetry,
    GeoBounds,
    GeoPoint,
    GimbalOrientation,
    Job,
    JobStatus,
)


def test_job_dao_save_and_get_round_trip(tmp_path: Path) -> None:
    factory = SqliteDaoFactory.initialize(str(tmp_path / "sar.db"))
    telemetry_dao = factory.create_telemetry_dao()
    job_dao = factory.create_job_dao()

    now = datetime.now(timezone.utc)
    telemetry = DroneTelemetry(
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
    telemetry_dao.save(telemetry)

    job = Job(
        id="job-1",
        status=JobStatus.QUEUED,
        created_at=now,
        updated_at=now,
        telemetry_id="tel-1",
    )
    job_dao.save(job)

    loaded = job_dao.get_by_id("job-1")
    assert loaded is not None
    assert loaded.id == "job-1"
    assert loaded.status == JobStatus.QUEUED
    assert loaded.telemetry_id == "tel-1"
    assert loaded.failure_reason is None
    assert loaded.detection_ids == []
