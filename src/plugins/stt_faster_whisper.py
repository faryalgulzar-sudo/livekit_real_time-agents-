from faster_whisper import WhisperModel
from livekit.agents.stt import STT, STTCapabilities
from typing import AsyncIterator
from contextlib import asynccontextmanager
import tempfile


class FasterWhisperSTT(STT):
    def __init__(self, model_size: str = "base", device: str = "cpu"):
        super().__init__(
            capabilities=STTCapabilities(
                streaming=True,
                interim_results=False
            )
        )
        # use _whisper instead of self.model (conflicts with STT base class)
        compute_type = "float16" if device == "cuda" else "int8"
        self._whisper = WhisperModel(model_size, device=device, compute_type=compute_type)

    @asynccontextmanager
    async def stream(self, conn_options=None):
        stream = FasterWhisperStream(self._whisper)
        try:
            yield stream
        finally:
            pass  # cleanup if needed

    async def _recognize_impl(self, audio_file: str) -> str:
        """
        Fallback non-streaming recognition.
        """
        segments, _ = self._whisper.transcribe(audio_file)
        return " ".join([seg.text for seg in segments])


class FasterWhisperStream:
    """
    Buffers audio during streaming and finalizes transcription on finish().
    """
    def __init__(self, whisper: WhisperModel):
        self._whisper = whisper
        self._buffer = bytearray()

    async def __aenter__(self):
        """Enter the async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit the async context manager."""
        pass

    async def push_audio(self, data: bytes):
        self._buffer.extend(data)

    async def finish(self) -> AsyncIterator[str]:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as f:
            f.write(self._buffer)
            f.flush()
            segments, _ = self._whisper.transcribe(f.name)
            text = " ".join([seg.text for seg in segments])
            yield text


# Entry point for LiveKit Agent
def create():
    # Change device to "cuda" if you have GPU
    return FasterWhisperSTT(model_size="base", device="cuda")
