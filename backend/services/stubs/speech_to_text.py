from services.interface.speech_to_text import SpeechToText, SpeechToTextUnavailableError


class StubSpeechToText(SpeechToText):
    def transcribe(self, audio_bytes: bytes, mime_type: str, filename: str) -> str:
        raise SpeechToTextUnavailableError(
            "Failed to transcribe audio: OpenAI API key is not configured"
        )
