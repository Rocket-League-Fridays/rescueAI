from pathlib import Path

from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from models.domain import Artifact, ArtifactKind
from services.ingest.opencv_frame_extractor import OpenCvFrameExtractor
from storage.local.local_artifact_store import LocalArtifactStore
from tests.video_fixtures import write_synthetic_mp4


def test_extractor_writes_strided_jpeg_frames(tmp_path: Path) -> None:
    factory = SqliteDaoFactory.initialize(str(tmp_path / "sar.db"))
    store = LocalArtifactStore.initialize(str(tmp_path / "artifacts"))
    video_path = write_synthetic_mp4(tmp_path / "clip.mp4", frame_count=5)
    store.put("job-1/video.mp4", video_path.read_bytes())

    factory.create_telemetry_dao().save(_telemetry())
    _save_job(factory, "job-1", "tel-1")
    video = Artifact(
        id="vid-1",
        job_id="job-1",
        kind=ArtifactKind.RAW_VIDEO,
        storage_key="job-1/video.mp4",
        mime_type="video/mp4",
    )
    factory.create_artifact_dao().save(video)

    extractor = OpenCvFrameExtractor(
        artifact_store=store,
        artifact_dao=factory.create_artifact_dao(),
        frame_stride=2,
        max_frames=40,
        jpeg_quality=80,
    )
    frames = extractor.extract(video)

    assert [frame.frame_index for frame in frames] == [0, 2, 4]
    assert all(frame.kind == ArtifactKind.FRAME for frame in frames)
    assert all(frame.mime_type == "image/jpeg" for frame in frames)
    assert all(store.get(frame.storage_key) for frame in frames)
    assert factory.create_artifact_dao().list_by_job_id("job-1")


def _telemetry():
    from datetime import datetime, timezone

    from models.domain import DroneTelemetry, GeoBounds, GeoPoint, GimbalOrientation

    return DroneTelemetry(
        id="tel-1",
        position=GeoPoint(lat=40.23, lng=-111.65),
        bounds=GeoBounds(
            south_west=GeoPoint(lat=40.22, lng=-111.68),
            north_east=GeoPoint(lat=40.25, lng=-111.63),
        ),
        altitude_meters=100,
        heading_degrees=0,
        gimbal=GimbalOrientation(pitch_degrees=-90, yaw_degrees=0, roll_degrees=0),
        timestamp_utc=datetime.now(timezone.utc),
    )


def _save_job(factory, job_id: str, telemetry_id: str) -> None:
    from datetime import datetime, timezone

    from models.domain import Job, JobStatus

    now = datetime.now(timezone.utc)
    factory.create_job_dao().save(
        Job(
            id=job_id,
            status=JobStatus.QUEUED,
            created_at=now,
            updated_at=now,
            telemetry_id=telemetry_id,
        )
    )
