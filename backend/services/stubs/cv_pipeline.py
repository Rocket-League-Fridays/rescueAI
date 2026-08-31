from models.domain import Artifact, Detection, Job
from services.interface.cv_pipeline import CvPipeline


class StubCvPipeline(CvPipeline):
    def process(self, job: Job, frames: list[Artifact]) -> list[Detection]:
        return []
