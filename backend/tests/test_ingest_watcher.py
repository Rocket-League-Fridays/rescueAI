from pathlib import Path

from core.config import Settings
from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from models.domain import ArtifactKind
from services.ingest.folder_watcher import IngestWatcher
from services.ingest.opencv_frame_extractor import OpenCvFrameExtractor
from services.ingest.pinhole_georeferencer import PinholeGeoreferencer
from services.job_service import JobService
from services.stubs.cv_pipeline import StubCvPipeline
from services.stubs.gis_routing import StubGisRouter
from storage.local.local_artifact_store import LocalArtifactStore
from tasks.async_workers import JobProcessor
from tests.video_fixtures import DJI_SRT_FIXTURE, write_synthetic_mp4


def test_watcher_ingests_mp4_and_completes_job(tmp_path: Path) -> None:
    settings, watcher, factory = _build_watcher(tmp_path)
    write_synthetic_mp4(Path(settings.ingest_dir) / "DJI_0001.MP4", frame_count=3)

    job_ids = watcher.poll_once()
    assert len(job_ids) == 1

    job = factory.create_job_dao().get_by_id(job_ids[0])
    assert job is not None
    assert job.status.value == "completed"
    assert job.video_artifact_id is not None
    artifacts = factory.create_artifact_dao().list_by_job_id(job.id)
    assert any(artifact.kind == ArtifactKind.RAW_VIDEO for artifact in artifacts)
    assert any(artifact.kind == ArtifactKind.FRAME for artifact in artifacts)

    assert watcher.poll_once() == []


def test_watcher_uses_sibling_srt_for_telemetry(tmp_path: Path) -> None:
    settings, watcher, factory = _build_watcher(tmp_path)
    inbox = Path(settings.ingest_dir)
    write_synthetic_mp4(inbox / "DJI_0002.MP4", frame_count=2)
    (inbox / "DJI_0002.SRT").write_text(DJI_SRT_FIXTURE, encoding="utf-8")

    [job_id] = watcher.poll_once()
    job = factory.create_job_dao().get_by_id(job_id)
    assert job is not None
    telemetry = factory.create_telemetry_dao().get_by_id(job.telemetry_id)
    assert telemetry is not None
    assert telemetry.position.lat == 40.234
    assert telemetry.altitude_meters == 125.5


def _build_watcher(tmp_path: Path) -> tuple[Settings, IngestWatcher, SqliteDaoFactory]:
    settings = Settings(
        database_path=str(tmp_path / "sar.db"),
        artifacts_dir=str(tmp_path / "artifacts"),
        ingest_dir=str(tmp_path / "inbox"),
        ingest_watch_enabled=False,
        ingest_settle_seconds=0,
        frame_stride=1,
        max_frames=10,
    )
    factory = SqliteDaoFactory.initialize(settings.database_path)
    store = LocalArtifactStore.initialize(settings.artifacts_dir)
    extractor = OpenCvFrameExtractor(
        artifact_store=store,
        artifact_dao=factory.create_artifact_dao(),
        frame_stride=settings.frame_stride,
        max_frames=settings.max_frames,
        jpeg_quality=settings.jpeg_quality,
    )
    processor = JobProcessor(
        dao_factory=factory,
        frame_extractor=extractor,
        cv_pipeline=StubCvPipeline(),
        gis_router=StubGisRouter(),
        georeferencer=PinholeGeoreferencer(settings.camera_hfov_degrees),
    )
    watcher = IngestWatcher(
        settings=settings,
        job_service=JobService(dao_factory=factory, artifact_store=store),
        job_processor=processor,
        ledger=factory.create_ingest_ledger(),
    )
    return settings, watcher, factory
