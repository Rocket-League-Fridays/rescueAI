from abc import ABC, abstractmethod

from services.interface.cv_pipeline import CvPipeline
from services.interface.frame_extractor import FrameExtractor
from services.interface.gis_router import GisRouter
from services.job_service import JobService


class ServiceFactory(ABC):
    @abstractmethod
    def create_frame_extractor(self) -> FrameExtractor:
        raise NotImplementedError

    @abstractmethod
    def create_cv_pipeline(self) -> CvPipeline:
        raise NotImplementedError

    @abstractmethod
    def create_gis_router(self) -> GisRouter:
        raise NotImplementedError

    @abstractmethod
    def create_job_service(self) -> JobService:
        raise NotImplementedError
