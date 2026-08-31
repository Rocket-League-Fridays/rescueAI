from abc import ABC, abstractmethod


class IngestLedger(ABC):
    @abstractmethod
    def has_processed(self, sha256: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def record(self, sha256: str, source_path: str, job_id: str) -> None:
        raise NotImplementedError
