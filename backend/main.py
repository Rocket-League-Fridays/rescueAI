from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes_jobs import router as jobs_router
from api.routes_telemetry import router as telemetry_router
from core.config import Settings
from core.logging import configure_logging
from dao.sqlite.sqlite_dao_factory import SqliteDaoFactory
from services.ingest.folder_watcher import IngestWatcher
from services.ingest.opencv_frame_extractor import OpenCvFrameExtractor
from services.ingest.pinhole_georeferencer import PinholeGeoreferencer
from services.service_factory import DefaultServiceFactory
from services.stubs.cv_pipeline import StubCvPipeline
from services.stubs.gis_routing import StubGisRouter
from storage.local.local_artifact_store import LocalArtifactStore
from tasks.async_workers import JobProcessor


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging()

    dao_factory = SqliteDaoFactory.initialize(settings.database_path)
    artifact_store = LocalArtifactStore.initialize(settings.artifacts_dir)
    frame_extractor = OpenCvFrameExtractor(
        artifact_store=artifact_store,
        artifact_dao=dao_factory.create_artifact_dao(),
        frame_stride=settings.frame_stride,
        max_frames=settings.max_frames,
        jpeg_quality=settings.jpeg_quality,
    )
    cv_pipeline = StubCvPipeline()
    gis_router = StubGisRouter()
    georeferencer = PinholeGeoreferencer(settings.camera_hfov_degrees)
    service_factory = DefaultServiceFactory(
        dao_factory=dao_factory,
        artifact_store=artifact_store,
        frame_extractor=frame_extractor,
        cv_pipeline=cv_pipeline,
        gis_router=gis_router,
    )
    job_processor = JobProcessor(
        dao_factory=dao_factory,
        frame_extractor=frame_extractor,
        cv_pipeline=cv_pipeline,
        gis_router=gis_router,
        georeferencer=georeferencer,
    )
    ingest_watcher = IngestWatcher(
        settings=settings,
        job_service=service_factory.create_job_service(),
        job_processor=job_processor,
        ledger=dao_factory.create_ingest_ledger(),
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.ingest_watch_enabled:
            ingest_watcher.start()
        yield
        ingest_watcher.stop()

    app = FastAPI(
        title="SAR Routing Engine",
        version="0.1.0",
        description="Search and Rescue telemetry, CV, and GIS routing API",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(telemetry_router)
    app.include_router(jobs_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.state.settings = settings
    app.state.service_factory = service_factory
    app.state.job_processor = job_processor
    app.state.ingest_watcher = ingest_watcher
    return app


app = create_app()
