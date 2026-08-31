from models.domain import Artifact
from services.interface.frame_extractor import FrameExtractor


class StubFrameExtractor(FrameExtractor):
    def extract(self, video_artifact: Artifact) -> list[Artifact]:
        return []
