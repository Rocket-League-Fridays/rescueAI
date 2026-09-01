from __future__ import annotations

import io
import logging
import time

from services.interface.speech_to_text import (
    SpeechToText,
    SpeechToTextProviderError,
)

logger = logging.getLogger(__name__)


class OpenAIWhisperTranscriber(SpeechToText):
    def __init__(self, api_key: str, model: str = "whisper-1") -> None:
        self._api_key = api_key
        self._model = model
        self._client = None

    def transcribe(self, audio_bytes: bytes, mime_type: str, filename: str) -> str:
        started = time.perf_counter()
        client = self._load_client()
        try:
            result = client.audio.transcriptions.create(
                model=self._model,
                file=(filename, io.BytesIO(audio_bytes), mime_type),
            )
        except SpeechToTextProviderError:
            raise
        except Exception as exc:
            raise SpeechToTextProviderError(
                f"Failed to transcribe audio: {type(exc).__name__}: {exc}"
            ) from exc

        text = getattr(result, "text", None)
        transcript = text.strip() if isinstance(text, str) else str(result).strip()
        logger.info(
            "audio_transcribed",
            extra={
                "event": "audio_transcribed",
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "audio_bytes": len(audio_bytes),
                "mime_type": mime_type,
                "model": self._model,
            },
        )
        return transcript

    def _load_client(self):
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(api_key=self._api_key)
        return self._client
