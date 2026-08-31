from __future__ import annotations

from pathlib import Path

from storage.interface.artifact_store import ArtifactStore


class LocalArtifactStore(ArtifactStore):
    def __init__(self, root_dir: str) -> None:
        self._root_dir = Path(root_dir)

    @classmethod
    def initialize(cls, root_dir: str) -> LocalArtifactStore:
        store = cls(root_dir)
        store._root_dir.mkdir(parents=True, exist_ok=True)
        return store

    def put(self, storage_key: str, data: bytes) -> None:
        path = self._resolve(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, storage_key: str) -> bytes:
        path = self._resolve(storage_key)
        if not path.is_file():
            raise FileNotFoundError(
                f"Failed to read artifact: storage key {storage_key} does not exist"
            )
        return path.read_bytes()

    def delete(self, storage_key: str) -> None:
        path = self._resolve(storage_key)
        if path.is_file():
            path.unlink()

    def _resolve(self, storage_key: str) -> Path:
        if not storage_key or storage_key.startswith("/") or ".." in Path(storage_key).parts:
            raise ValueError(f"Failed to resolve artifact path: invalid storage key {storage_key}")
        return self._root_dir / storage_key
