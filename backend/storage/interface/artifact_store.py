from abc import ABC, abstractmethod


class ArtifactStore(ABC):
    @abstractmethod
    def put(self, storage_key: str, data: bytes) -> None:
        raise NotImplementedError

    @abstractmethod
    def get(self, storage_key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        raise NotImplementedError
