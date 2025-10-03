from faster_whisper import WhisperModel
from livekit.agents.stt import STT, STTCapabilities, SpeechEvent, SpeechEventType
from livekit import rtc
from typing import AsyncIterator
import asyncio
import numpy as np
import io
import wave
import soundfile as sf


class FasterWhisperSTT(STT):
    def __init__(self, model_size: str = "base", device: str = "cpu"):
        super().__init__(
            capabilities=STTCapabilities(
                streaming=False,  # Changed to False - buffer and process at end
                interim_results=False
            )
        )
        # use _whisper instead of self.model (conflicts with STT base class)
        compute_type = "float16" if device == "cuda" else "int8"
        self._whisper = WhisperModel(model_size, device=device, compute_type=compute_type)

    def stream(self) -> "FasterWhisperStream":
        return FasterWhisperStream(self._whisper)

    async def _recognize_impl(self, audio_file, *, language: str = None, conn_options=None) -> SpeechEvent:
        """
        Fallback non-streaming recognition.
        """
        # Handle different input types
        if isinstance(audio_file, rtc.AudioFrame):
            # It's an AudioFrame object - extract raw audio data
            audio_array = np.frombuffer(audio_file.data, dtype=np.int16)
            # Convert to float32 and normalize
            audio_data = audio_array.astype(np.float32) / 32768.0
        elif hasattr(audio_file, 'read'):
            # It's a file-like object, read the audio data
            audio_data, sample_rate = sf.read(audio_file)
            # Convert to float32 if needed
            if audio_data.dtype != np.float32:
                audio_data = audio_data.astype(np.float32)
        elif isinstance(audio_file, str):
            # It's a file path
            audio_data, sample_rate = sf.read(audio_file)
            if audio_data.dtype != np.float32:
                audio_data = audio_data.astype(np.float32)
        else:
            raise ValueError(f"Unsupported audio_file type: {type(audio_file)}")

        # Run transcription in executor to avoid blocking
        loop = asyncio.get_event_loop()
        kwargs = {}
        if language:
            kwargs['language'] = language

        segments, _ = await loop.run_in_executor(
            None,
            lambda: self._whisper.transcribe(audio_data, **kwargs)
        )

        # Combine all segments into final text
        final_text = " ".join([seg.text for seg in segments]).strip()

        # Create a proper alternative object with required attributes
        class Alternative:
            def __init__(self, text, language):
                self.text = text
                self.language = language
                self.confidence = 1.0  # Faster Whisper doesn't provide confidence
                self.speaker_id = None  # No speaker diarization

        # Return a SpeechEvent object
        return SpeechEvent(
            type=SpeechEventType.FINAL_TRANSCRIPT,
            alternatives=[Alternative(final_text, language or 'en')]
        )


class FasterWhisperStream:
    """
    Buffers audio frames and transcribes on end of speech.
    """
    def __init__(self, whisper: WhisperModel):
        self._whisper = whisper
        self._queue = asyncio.Queue()
        self._closed = False
        self._sample_rate = 16000
        self._num_channels = 1
        self._audio_frames = []

    def __aiter__(self):
        return self

    async def __anext__(self) -> SpeechEvent:
        if self._closed and self._queue.empty():
            raise StopAsyncIteration

        try:
            event = await asyncio.wait_for(self._queue.get(), timeout=0.1)
            return event
        except asyncio.TimeoutError:
            if self._closed:
                raise StopAsyncIteration
            # Return to waiting
            return await self.__anext__()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.aclose()

    def push_frame(self, frame: rtc.AudioFrame):
        """Push audio frame to buffer."""
        # Convert frame data to numpy array
        audio_data = np.frombuffer(frame.data, dtype=np.int16)
        self._audio_frames.append(audio_data)
        self._sample_rate = frame.sample_rate
        self._num_channels = frame.num_channels

    async def flush(self):
        """Process accumulated audio and return transcription."""
        if not self._audio_frames:
            return

        # Concatenate all audio frames
        audio_array = np.concatenate(self._audio_frames)

        # Convert to float32 and normalize
        audio_float = audio_array.astype(np.float32) / 32768.0

        # Run transcription in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        segments, _ = await loop.run_in_executor(
            None,
            self._whisper.transcribe,
            audio_float
        )

        # Collect all text
        text_parts = [seg.text for seg in segments]
        if text_parts:
            final_text = " ".join(text_parts).strip()
            if final_text:
                # Send final transcription event
                event = SpeechEvent(
                    type=SpeechEventType.FINAL_TRANSCRIPT,
                    alternatives=[type('obj', (), {'text': final_text})]
                )
                await self._queue.put(event)

        # Clear buffer
        self._audio_frames.clear()

    async def aclose(self):
        """Close the stream and process any remaining audio."""
        await self.flush()
        self._closed = True


# Entry point for LiveKit Agent
def create():
    # Using CPU - change to "cuda" only if you have CUDA properly installed
    return FasterWhisperSTT(model_size="base", device="cpu")
