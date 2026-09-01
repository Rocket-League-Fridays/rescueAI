from abc import ABC, abstractmethod


class SpeechToTextError(Exception):
    """Base for transcription failures the route can classify."""


class SpeechToTextUnavailableError(SpeechToTextError):
    """No provider configured (missing API key)."""


class SpeechToTextProviderError(SpeechToTextError):
    """The remote transcription provider failed."""


class SpeechToText(ABC):
    @abstractmethod
    def transcribe(self, audio_bytes: bytes, mime_type: str, filename: str) -> str:
        raise NotImplementedError
