# Text-to-Speech using pyttsx3
import pyttsx3
import asyncio
from livekit.agents.tts import TTS, SynthesizeStream, TTSCapabilities
from livekit import rtc
import numpy as np
import tempfile
import wave


class Pyttsx3TTS(TTS):
    def __init__(self, rate: int = 150, volume: float = 1.0, voice_id: int = 0):
        super().__init__(
            capabilities=TTSCapabilities(
                streaming=False,
            ),
            sample_rate=22050,
            num_channels=1,
        )
        self._rate = rate
        self._volume = volume
        self._voice_id = voice_id

    def synthesize(self, text: str, *, conn_options=None) -> "Pyttsx3SynthesizeStream":
        print(f"[Pyttsx3 TTS] synthesize() called with text: '{text[:100]}'")
        return Pyttsx3SynthesizeStream(
            text,
            self._sample_rate,
            self._rate,
            self._volume,
            self._voice_id,
            tts_instance=self,
            conn_options=conn_options
        )


class Pyttsx3SynthesizeStream(SynthesizeStream):
    def __init__(self, text: str, sample_rate: int, rate: int, volume: float, voice_id: int, tts_instance, conn_options=None):
        super().__init__(tts=tts_instance, conn_options=conn_options)
        self._text = text
        self._sample_rate = sample_rate
        self._rate = rate
        self._volume = volume
        self._voice_id = voice_id
        self._queue = asyncio.Queue()
        self._task = None

    async def _run(self) -> None:
        """Required abstract method - runs the synthesis."""
        await self._run_synthesis()

    async def __anext__(self) -> rtc.AudioFrame:
        if self._task is None:
            self._task = asyncio.create_task(self._run_synthesis())

        frame = await self._queue.get()
        if frame is None:
            raise StopAsyncIteration
        return frame

    async def _run_synthesis(self):
        try:
            # Run pyttsx3 in subprocess
            loop = asyncio.get_event_loop()
            audio_data = await loop.run_in_executor(
                None,
                self._synthesize_sync
            )

            # Convert to audio frames
            if audio_data is not None and len(audio_data) > 0:
                # Split into chunks and create frames
                chunk_size = self._sample_rate // 10  # 100ms chunks
                for i in range(0, len(audio_data), chunk_size):
                    chunk = audio_data[i:i + chunk_size]
                    frame = rtc.AudioFrame(
                        data=chunk.tobytes(),
                        sample_rate=self._sample_rate,
                        num_channels=1,
                        samples_per_channel=len(chunk),
                    )
                    await self._queue.put(frame)
        except Exception as e:
            print(f"[Pyttsx3 TTS ERROR] {e}")
            import traceback
            traceback.print_exc()
        finally:
            await self._queue.put(None)  # Signal end

    def _synthesize_sync(self) -> np.ndarray:
        """Run pyttsx3 synchronously and return audio data."""
        try:
            print(f"[Pyttsx3 TTS] Synthesizing: {self._text[:50]}...")

            # Create temp file for audio output
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                temp_path = tmp_file.name

            # Initialize pyttsx3 engine
            engine = pyttsx3.init()

            # Set properties
            engine.setProperty('rate', self._rate)
            engine.setProperty('volume', self._volume)

            # Set voice
            voices = engine.getProperty('voices')
            if voices and self._voice_id < len(voices):
                engine.setProperty('voice', voices[self._voice_id].id)

            # Save to file
            engine.save_to_file(self._text, temp_path)
            engine.runAndWait()

            # Read the WAV file
            with wave.open(temp_path, 'rb') as wav_file:
                sample_rate = wav_file.getframerate()
                n_frames = wav_file.getnframes()
                audio_bytes = wav_file.readframes(n_frames)

                # Convert to numpy array
                audio_data = np.frombuffer(audio_bytes, dtype=np.int16)

            print(f"[Pyttsx3 TTS] Generated {len(audio_data)} audio samples")

            # Clean up temp file
            import os
            os.unlink(temp_path)

            return audio_data

        except Exception as e:
            print(f"[Pyttsx3 TTS ERROR] Exception: {e}")
            import traceback
            traceback.print_exc()
            return np.zeros(self._sample_rate, dtype=np.int16)

    async def aclose(self):
        """Close the stream."""
        await self._queue.put(None)


def create():
    """Create pyttsx3 TTS instance."""
    return Pyttsx3TTS(rate=150, volume=1.0, voice_id=0)
