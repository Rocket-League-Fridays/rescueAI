from abc import ABC, abstractmethod

from models.domain import DroneTelemetry


class TelemetryDao(ABC):
    @abstractmethod
    def save(self, telemetry: DroneTelemetry) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, telemetry_id: str) -> DroneTelemetry | None:
        raise NotImplementedError
