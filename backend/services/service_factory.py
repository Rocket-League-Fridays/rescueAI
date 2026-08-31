from dao.interface.dao_factory import DaoFactory
from services.interface.cv_pipeline import CvPipeline
from services.interface.frame_extractor import FrameExtractor
from services.interface.gis_router import GisRouter
from services.interface.service_factory import ServiceFactory
from services.job_service import JobService
from storage.interface.artifact_store import ArtifactStore


class DefaultServiceFactory(ServiceFactory):
    def __init__(
        self,
        dao_factory: DaoFactory,
        artifact_store: ArtifactStore,
        frame_extractor: FrameExtractor,
        cv_pipeline: CvPipeline,
        gis_router: GisRouter,
    ) -> None:
        self._dao_factory = dao_factory
        self._artifact_store = artifact_store
        self._frame_extractor = frame_extractor
        self._cv_pipeline = cv_pipeline
        self._gis_router = gis_router

    def create_frame_extractor(self) -> FrameExtractor:
        return self._frame_extractor

    def create_cv_pipeline(self) -> CvPipeline:
        return self._cv_pipeline

    def create_gis_router(self) -> GisRouter:
        return self._gis_router

    def create_job_service(self) -> JobService:
        return JobService(
            dao_factory=self._dao_factory,
            artifact_store=self._artifact_store,
        )
