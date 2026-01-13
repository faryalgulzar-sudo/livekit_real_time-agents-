"""
Text-to-Speech using Zyphra Zonos
High-quality open-source TTS with voice cloning support
"""
import torch
import torchaudio
import io
import logging
from livekit.agents.tts import TTS, ChunkedStream, TTSCapabilities
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS

# Don't import Zonos at module level - it downloads models from HuggingFace
# Import only when needed to avoid startup delays
# from zonos.model import Zonos
# from zonos.conditioning import make_cond_dict

logger = logging.getLogger("tts_zonos")


class ZonosTTS(TTS):
    """Zyphra Zonos TTS implementation for LiveKit"""

    def __init__(
        self,
        model_name: str = "Zyphra/Zonos-v0.1-transformer",
        language: str = "en-us",
        voice: str = "default",
        device: str = None,
    ):
        super().__init__(
            capabilities=TTSCapabilities(
                streaming=False,  # Zonos generates full audio
            ),
            sample_rate=44100,  # Zonos native sample rate
            num_channels=1,
        )

        self._model_name = model_name
        self._language = language
        self._voice = voice
        self._device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._model = None
        self._speaker_embedding = None

        logger.info(f"🔊 [Zonos] Initialized with model: {model_name}, device: {self._device}")

    def _load_model(self):
        """Lazy load the model on first use"""
        if self._model is None:
            # Import Zonos only when actually needed (lazy import)
            from zonos.model import Zonos

            logger.info(f"🔥 [Zonos] Loading model {self._model_name}...")
            self._model = Zonos.from_pretrained(self._model_name, device=self._device)
            logger.info("✅ [Zonos] Model loaded successfully")

            # Create default speaker embedding (neutral voice)
            # In production, you could load a reference audio file here
            self._speaker_embedding = None  # Will use model default

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS) -> "ZonosChunkedStream":
        """Synthesize speech from text"""
        logger.info(f"🔊 [Zonos] Synthesizing: {text[:50]}...")

        # Load model if not already loaded
        self._load_model()

        return ZonosChunkedStream(
            tts=self,
            input_text=text,
            conn_options=conn_options,
            model=self._model,
            language=self._language,
            speaker_embedding=self._speaker_embedding,
        )


class ZonosChunkedStream(ChunkedStream):
    """Stream implementation for Zonos TTS"""

    def __init__(
        self,
        *,
        tts: TTS,
        input_text: str,
        conn_options,
        model,
        language: str,
        speaker_embedding,
    ):
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._model = model
        self._language = language
        self._speaker_embedding = speaker_embedding

    async def _run(self, output_emitter) -> None:
        """Generate speech and emit audio frames"""
        try:
            import uuid
            from zonos.conditioning import make_cond_dict

            logger.info(f"🎵 [Zonos] Generating speech for: {self._input_text[:50]}...")

            # Initialize the output emitter
            request_id = str(uuid.uuid4())
            output_emitter.initialize(
                request_id=request_id,
                sample_rate=self._tts.sample_rate,
                num_channels=self._tts.num_channels,
            )

            # Create conditioning dictionary
            cond_dict = make_cond_dict(
                text=self._input_text,
                speaker=self._speaker_embedding,  # Will use default if None
                language=self._language,
            )

            # Prepare conditioning
            conditioning = self._model.prepare_conditioning(cond_dict)

            # Generate codes
            codes = self._model.generate(conditioning)

            # Decode to waveform
            wavs = self._model.autoencoder.decode(codes).cpu()

            # Convert to bytes
            audio_data = io.BytesIO()
            torchaudio.save(audio_data, wavs[0], self._tts.sample_rate, format="wav")
            audio_bytes = audio_data.getvalue()

            # Create audio frame
            from livekit import rtc

            # Skip WAV header (44 bytes) and get raw PCM data
            pcm_data = audio_bytes[44:]

            # Convert to int16 PCM if needed
            import numpy as np
            audio_array = np.frombuffer(pcm_data, dtype=np.int16)

            # Create frame
            frame = rtc.AudioFrame(
                data=audio_array.tobytes(),
                sample_rate=self._tts.sample_rate,
                num_channels=self._tts.num_channels,
                samples_per_channel=len(audio_array) // self._tts.num_channels,
            )

            # Push frame
            output_emitter.push_frame(frame)

            # Mark as complete
            output_emitter.mark_complete()

            logger.info(f"✅ [Zonos] Speech generation complete ({len(audio_array)} samples)")

        except Exception as e:
            logger.error(f"❌ [Zonos] Synthesis error: {e}")
            output_emitter.mark_error(str(e))
            raise


def create(
    model_name: str = "Zyphra/Zonos-v0.1-transformer",
    language: str = "en-us",
    voice: str = "default",
) -> ZonosTTS:
    """Factory function to create Zonos TTS instance"""
    return ZonosTTS(
        model_name=model_name,
        language=language,
        voice=voice,
    )
