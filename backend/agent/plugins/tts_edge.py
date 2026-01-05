# Text-to-Speech using edge-tts (Microsoft Edge TTS)
import edge_tts
import asyncio
from livekit.agents.tts import TTS, SynthesizeStream, TTSCapabilities, SynthesizedAudio
from livekit import rtc
import numpy as np
import io
import uuid


class EdgeTTS(TTS):
    def __init__(self, voice: str = "en-US-AriaNeural", rate: str = "+0%", pitch: str = "+0Hz"):
        super().__init__(
            capabilities=TTSCapabilities(
                streaming=False,
            ),
            sample_rate=24000,
            num_channels=1,
        )
        self._voice = voice
        self._rate = rate
        self._pitch = pitch

    def synthesize(self, text: str, *, conn_options=None) -> "EdgeSynthesizeStream":
        print(f"[Edge TTS] synthesize() called with text: '{text[:100]}'")
        return EdgeSynthesizeStream(
            text,
            self._sample_rate,
            self._voice,
            self._rate,
            self._pitch,
            tts_instance=self,
            conn_options=conn_options
        )


class EdgeSynthesizeStream(SynthesizeStream):
    def __init__(self, text: str, sample_rate: int, voice: str, rate: str, pitch: str, tts_instance, conn_options=None):
        super().__init__(tts=tts_instance, conn_options=conn_options)
        self._text = text
        self._sample_rate = sample_rate
        self._voice = voice
        self._rate = rate
        self._pitch = pitch
        self._queue = asyncio.Queue()
        self._task = None

    async def _run(self, output_emitter) -> None:
        """Required abstract method - runs the synthesis."""
        try:
            print(f"[Edge TTS] Synthesizing: {self._text[:50]}...")

            # Create Edge TTS communicate instance
            communicate = edge_tts.Communicate(
                text=self._text,
                voice=self._voice,
                rate=self._rate,
                pitch=self._pitch
            )

            # Collect audio chunks
            audio_chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])

            # Combine all audio data
            if audio_chunks:
                audio_data = b"".join(audio_chunks)

                # Convert audio data to numpy array (edge-tts returns MP3, need to decode)
                try:
                    from pydub import AudioSegment

                    audio_segment = AudioSegment.from_mp3(io.BytesIO(audio_data))

                    # Convert to raw PCM
                    audio_segment = audio_segment.set_frame_rate(self._sample_rate)
                    audio_segment = audio_segment.set_channels(1)
                    audio_segment = audio_segment.set_sample_width(2)  # 16-bit

                    raw_data = audio_segment.raw_data
                    audio_array = np.frombuffer(raw_data, dtype=np.int16)

                    print(f"[Edge TTS] Generated {len(audio_array)} audio samples")

                    # Create audio frame and push to output_emitter
                    frame = rtc.AudioFrame(
                        data=audio_array.tobytes(),
                        sample_rate=self._sample_rate,
                        num_channels=1,
                        samples_per_channel=len(audio_array),
                    )
                    output_emitter.push(frame)

                except ImportError as e:
                    print(f"[Edge TTS ERROR] Missing dependency: {e}")
                    print("[Edge TTS ERROR] Install with: pip install pydub")
                    print("[Edge TTS ERROR] Also need ffmpeg: sudo apt install ffmpeg")

        except Exception as e:
            print(f"[Edge TTS ERROR] {e}")
            import traceback
            traceback.print_exc()
        finally:
            output_emitter.aclose()

    async def __anext__(self) -> SynthesizedAudio:
        if self._task is None:
            self._task = asyncio.create_task(self._run_synthesis())

        frame = await self._queue.get()
        if frame is None:
            raise StopAsyncIteration

        return SynthesizedAudio(
            frame=frame,
            request_id=str(uuid.uuid4()),
            is_final=True,
        )

    async def _run_synthesis(self):
        try:
            print(f"[Edge TTS] Synthesizing: {self._text[:50]}...")

            # Create Edge TTS communicate instance
            communicate = edge_tts.Communicate(
                text=self._text,
                voice=self._voice,
                rate=self._rate,
                pitch=self._pitch
            )

            # Collect audio chunks
            audio_chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])

            # Combine all audio data
            if audio_chunks:
                audio_data = b"".join(audio_chunks)

                # Convert audio data to numpy array (edge-tts returns MP3, need to decode)
                try:
                    from pydub import AudioSegment

                    audio_segment = AudioSegment.from_mp3(io.BytesIO(audio_data))

                    # Convert to raw PCM
                    audio_segment = audio_segment.set_frame_rate(self._sample_rate)
                    audio_segment = audio_segment.set_channels(1)
                    audio_segment = audio_segment.set_sample_width(2)  # 16-bit

                    raw_data = audio_segment.raw_data
                    audio_array = np.frombuffer(raw_data, dtype=np.int16)

                    print(f"[Edge TTS] Generated {len(audio_array)} audio samples")

                    # Split into chunks and put into queue
                    chunk_size = self._sample_rate // 10  # 100ms chunks
                    for i in range(0, len(audio_array), chunk_size):
                        chunk = audio_array[i:i + chunk_size]
                        frame = rtc.AudioFrame(
                            data=chunk.tobytes(),
                            sample_rate=self._sample_rate,
                            num_channels=1,
                            samples_per_channel=len(chunk),
                        )
                        await self._queue.put(frame)

                except ImportError as e:
                    print(f"[Edge TTS ERROR] Missing dependency: {e}")
                    print("[Edge TTS ERROR] Install with: pip install pydub")
                    print("[Edge TTS ERROR] Also need ffmpeg: sudo apt install ffmpeg")

        except Exception as e:
            print(f"[Edge TTS ERROR] {e}")
            import traceback
            traceback.print_exc()
        finally:
            await self._queue.put(None)  # Signal end

    async def aclose(self):
        """Close the stream."""
        await self._queue.put(None)


def create():
    """Create Edge TTS instance for English."""
    return EdgeTTS(
        voice="en-US-AriaNeural",
        rate="+0%",
        pitch="+0Hz"
    )
