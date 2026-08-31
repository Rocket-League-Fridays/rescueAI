from abc import ABC, abstractmethod

from models.domain import Artifact, Detection, DroneTelemetry


class DetectionGeoreferencer(ABC):
    @abstractmethod
    def apply(
        self,
        detections: list[Detection],
        telemetry: DroneTelemetry,
        frames: list[Artifact],
        frame_poses: dict[int, DroneTelemetry] | None = None,
    ) -> list[Detection]:
        raise NotImplementedError
