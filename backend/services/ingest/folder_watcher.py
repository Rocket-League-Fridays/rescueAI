from __future__ import annotations

import hashlib
import logging
import threading
import time
from pathlib import Path

from core.config import Settings
from dao.interface.ingest_ledger import IngestLedger
from services.ingest.default_telemetry import request_from_settings, request_from_srt
from services.ingest.srt_parser import mid_sample, parse_dji_srt
from services.job_service import JobService
from tasks.async_workers import JobProcessor

logger = logging.getLogger(__name__)

_VIDEO_SUFFIXES = {".mp4", ".mov", ".MP4", ".MOV"}


class IngestWatcher:
    def __init__(
        self,
        settings: Settings,
        job_service: JobService,
        job_processor: JobProcessor,
        ledger: IngestLedger,
    ) -> None:
        self._settings = settings
        self._job_service = job_service
        self._job_processor = job_processor
        self._ledger = ledger
        self._inbox = Path(settings.ingest_dir)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._seen_sizes: dict[str, tuple[int, float]] = {}

    def start(self) -> None:
        self._inbox.mkdir(parents=True, exist_ok=True)
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="ingest-watcher", daemon=True)
        self._thread.start()
        logger.info(
            "ingest_watcher_started",
            extra={"event": "ingest_watcher_started", "ingest_dir": str(self._inbox)},
        )

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    def poll_once(self) -> list[str]:
        self._inbox.mkdir(parents=True, exist_ok=True)
        job_ids: list[str] = []
        for path in sorted(self._inbox.iterdir()):
            if not path.is_file() or path.suffix not in _VIDEO_SUFFIXES:
                continue
            if not self._is_settled(path):
                continue
            job_id = self._ingest_if_new(path)
            if job_id is not None:
                job_ids.append(job_id)
        return job_ids

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.poll_once()
            except Exception:
                logger.error(
                    "ingest_poll_failed",
                    extra={"event": "ingest_poll_failed"},
                    exc_info=True,
                )
            self._stop.wait(self._settings.ingest_poll_seconds)

    def _is_settled(self, path: Path) -> bool:
        stat = path.stat()
        key = str(path)
        now = time.time()
        previous = self._seen_sizes.get(key)
        if previous is None or previous[0] != stat.st_size:
            self._seen_sizes[key] = (stat.st_size, now)
            return self._settings.ingest_settle_seconds <= 0
        return (now - previous[1]) >= self._settings.ingest_settle_seconds

    def _ingest_if_new(self, path: Path) -> str | None:
        digest = _sha256(path)
        if self._ledger.has_processed(digest):
            return None
        request = self._telemetry_for(path)
        job = self._job_service.create_job(
            request,
            video_bytes=path.read_bytes(),
            video_filename=path.name,
            video_content_type="video/mp4",
        )
        self._ledger.record(digest, str(path), job.id)
        logger.info(
            "ingest_file_accepted",
            extra={
                "event": "ingest_file_accepted",
                "job_id": job.id,
                "source_name": path.name,
                "bytes": path.stat().st_size,
            },
        )
        self._job_processor.process_job(job.id)
        return job.id

    def _telemetry_for(self, video_path: Path):
        srt_path = video_path.with_suffix(".SRT")
        if not srt_path.is_file():
            srt_path = video_path.with_suffix(".srt")
        if srt_path.is_file():
            samples = parse_dji_srt(srt_path.read_text(encoding="utf-8", errors="replace"))
            sample = mid_sample(samples)
            if sample is not None:
                return request_from_srt(sample)
        return request_from_settings(self._settings)


def _sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()
