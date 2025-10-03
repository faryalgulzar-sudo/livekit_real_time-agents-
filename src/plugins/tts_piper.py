# Text-to-Speech using Piper
import subprocess
import asyncio
from livekit.agents.tts import TTS, SynthesizeStream, TTSCapabilities
from livekit import rtc
import numpy as np


class PiperTTS(TTS):
    def __init__(self, model: str = "/home/faryal/agent-786/en_US-lessac-medium.onnx"):
        super().__init__(
            capabilities=TTSCapabilities(
                streaming=False,
            ),
            sample_rate=22050,
            num_channels=1,
        )
        self._model_name = model

    def synthesize(self, text: str, *, conn_options=None) -> "PiperSynthesizeStream":
        print(f"[Piper TTS] synthesize() called with text: '{text[:100]}'")
        return PiperSynthesizeStream(text, self._model_name, self._sample_rate, tts_instance=self, conn_options=conn_options)


class PiperSynthesizeStream(SynthesizeStream):
    def __init__(self, text: str, model: str, sample_rate: int, tts_instance, conn_options=None):
        super().__init__(tts=tts_instance, conn_options=conn_options)
        self._text = text
        self._model = model
        self._sample_rate = sample_rate
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
            # Run piper in subprocess
            loop = asyncio.get_event_loop()
            audio_data = await loop.run_in_executor(
                None,
                self._synthesize_sync
            )

            # Convert to audio frames
            # Piper outputs 16-bit PCM
            if audio_data is not None:
                # Convert to int16 if needed
                if audio_data.dtype == np.float32 or audio_data.dtype == np.float64:
                    audio_data = (audio_data * 32767).astype(np.int16)

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
            print(f"Piper TTS error: {e}")
        finally:
            await self._queue.put(None)  # Signal end

    def _synthesize_sync(self) -> np.ndarray:
        """Run piper synchronously and return audio data."""
        try:
            print(f"[Piper TTS] Synthesizing: {self._text[:50]}...")
            # Use piper to generate audio to stdout
            result = subprocess.run(
                ["piper", "--model", self._model, "--output-raw"],
                input=self._text.encode("utf-8"),
                capture_output=True,
                check=True
            )

            # Parse raw PCM output
            audio_data = np.frombuffer(result.stdout, dtype=np.int16)
            print(f"[Piper TTS] Generated {len(audio_data)} audio samples")
            return audio_data
        except subprocess.CalledProcessError as e:
            print(f"[Piper TTS ERROR] Command failed: {e}")
            print(f"[Piper TTS ERROR] stderr: {e.stderr.decode() if e.stderr else 'none'}")
            # Return silence as fallback
            return np.zeros(self._sample_rate, dtype=np.int16)
        except Exception as e:
            print(f"[Piper TTS ERROR] Exception: {e}")
            import traceback
            traceback.print_exc()
            return np.zeros(self._sample_rate, dtype=np.int16)

    async def aclose(self):
        """Close the stream."""
        await self._queue.put(None)


def create():
    return PiperTTS()
