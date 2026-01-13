# Text-to-Speech using edge-tts (Microsoft Edge TTS)
import edge_tts
from livekit.agents.tts import TTS, ChunkedStream, TTSCapabilities
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
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

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS) -> "EdgeChunkedStream":
        print(f"[Edge TTS] synthesize() called with text: '{text[:100]}'")
        return EdgeChunkedStream(
            tts=self,
            input_text=text,
            conn_options=conn_options,
            voice=self._voice,
            rate=self._rate,
            pitch=self._pitch,
        )


class EdgeChunkedStream(ChunkedStream):
    def __init__(self, *, tts: TTS, input_text: str, conn_options, voice: str, rate: str, pitch: str):
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._voice = voice
        self._rate = rate
        self._pitch = pitch

    async def _run(self, output_emitter) -> None:
        """Required abstract method - runs the synthesis."""
        try:
            print(f"[Edge TTS] Synthesizing: {self._input_text[:50]}...")

            # Initialize the emitter first - REQUIRED before pushing data
            request_id = str(uuid.uuid4())
            output_emitter.initialize(
                request_id=request_id,
                sample_rate=self._tts.sample_rate,
                num_channels=self._tts.num_channels,
                mime_type="audio/pcm",  # We'll convert to raw PCM
            )

            # Create Edge TTS communicate instance
            communicate = edge_tts.Communicate(
                text=self._input_text,
                voice=self._voice,
                rate=self._rate,
                pitch=self._pitch
            )

            # Collect audio chunks from edge-tts (returns MP3)
            audio_chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])

            # Combine all audio data
            if audio_chunks:
                audio_data = b"".join(audio_chunks)

                # Convert MP3 to raw PCM using pydub
                try:
                    from pydub import AudioSegment

                    audio_segment = AudioSegment.from_mp3(io.BytesIO(audio_data))

                    # Convert to raw PCM matching our TTS settings
                    audio_segment = audio_segment.set_frame_rate(self._tts.sample_rate)
                    audio_segment = audio_segment.set_channels(self._tts.num_channels)
                    audio_segment = audio_segment.set_sample_width(2)  # 16-bit

                    raw_data = audio_segment.raw_data

                    print(f"[Edge TTS] Generated {len(raw_data)} bytes of PCM audio")

                    # Push raw PCM bytes in chunks
                    chunk_size = self._tts.sample_rate * 2 // 4  # 250ms chunks (16-bit = 2 bytes per sample)
                    for i in range(0, len(raw_data), chunk_size):
                        audio_chunk = raw_data[i:i + chunk_size]
                        output_emitter.push(audio_chunk)

                    print(f"[Edge TTS] Successfully pushed audio to emitter")

                except ImportError as e:
                    print(f"[Edge TTS ERROR] Missing dependency: {e}")
                    print("[Edge TTS ERROR] Install with: pip install pydub")
                    print("[Edge TTS ERROR] Also need ffmpeg: sudo apt install ffmpeg")
                    raise
            else:
                print("[Edge TTS WARNING] No audio chunks received from edge-tts")

        except Exception as e:
            print(f"[Edge TTS ERROR] {e}")
            import traceback
            traceback.print_exc()
            raise


def create():
    """Create Edge TTS instance for English."""
    return EdgeTTS(
        voice="en-US-AriaNeural",
        rate="+0%",
        pitch="+0Hz"
    )
