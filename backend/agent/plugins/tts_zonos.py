"""
Zyphra Zonos TTS Plugin for LiveKit Agents
https://github.com/Zyphra/Zonos

Zonos-v0.1 is a leading open-weight text-to-speech model trained on 200k+ hours
of multilingual speech, delivering high-quality expressiveness.
"""
import logging
import io
import os
import numpy as np
from typing import Optional

try:
    import torch
    import torchaudio
    from zonos.model import Zonos
    from zonos.conditioning import make_cond_dict
except ImportError as e:
    raise ImportError(
        f"Zonos TTS dependencies not installed: {e}. "
        f"Install with: pip install torch torchaudio zonos"
    ) from e

from livekit import rtc
from livekit.agents.tts import TTS, SynthesizeStream, TTSCapabilities, SynthesizedAudio

logger = logging.getLogger(__name__)


class ZonosTTS(TTS):
    """Zyphra Zonos TTS implementation for LiveKit"""

    def __init__(
        self,
        model_name: str = "Zyphra/Zonos-v0.1-hybrid",
        device: str = "cuda",
        language: str = "en",
        speaker_audio_path: Optional[str] = None,
        sample_rate: int = 24000,
    ):
        """
        Initialize Zonos TTS.

        Args:
            model_name: Model to use ('Zyphra/Zonos-v0.1-transformer' or 'Zyphra/Zonos-v0.1-hybrid')
            device: Device to run on ('cuda' or 'cpu')
            language: Language code (e.g., 'en', 'es', 'ur')
            speaker_audio_path: Path to reference audio for voice cloning (optional)
            sample_rate: Output sample rate (default: 24000 Hz)
        """
        super().__init__(
            capabilities=TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=1,
        )

        self._model_name = model_name
        self._device = device
        self._language = language
        self._speaker_audio_path = speaker_audio_path
        self._model = None
        self._speaker_embedding = None

        # Check if CUDA is available
        if device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA requested but not available, falling back to CPU")
            self._device = "cpu"

        logger.info(f"Initializing Zonos TTS: model={model_name}, device={self._device}, language={language}")

        # Lazy load model on first use
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy load the model on first use"""
        if self._initialized:
            return

        try:
            logger.info("Loading Zonos model (this may take a moment)...")
            self._model = Zonos.from_pretrained(self._model_name, device=self._device)
            logger.info("Zonos model loaded successfully")

            # Load speaker embedding if provided
            if self._speaker_audio_path and os.path.exists(self._speaker_audio_path):
                logger.info(f"Loading speaker reference from {self._speaker_audio_path}")
                audio, sr = torchaudio.load(self._speaker_audio_path)
                audio = audio.to(self._device)
                self._speaker_embedding = self._model.make_speaker_embedding(audio, sr)
                logger.info("Speaker embedding created")
            else:
                # Use default speaker (model will use internal default)
                self._speaker_embedding = None
                logger.debug("Using default speaker voice")

            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize Zonos TTS: {e}", exc_info=True)
            raise RuntimeError(f"Zonos TTS initialization failed: {e}") from e

    def synthesize(self, text: str, *, conn_options=None) -> SynthesizeStream:
        """
        Synthesize speech from text.

        Args:
            text: Text to synthesize
            conn_options: Connection options (unused)

        Returns:
            SynthesizeStream for audio output
        """
        self._ensure_initialized()
        return ZonosSynthesizeStream(
            text=text,
            model=self._model,
            speaker_embedding=self._speaker_embedding,
            language=self._language,
            device=self._device,
            sample_rate=self._sample_rate,
            tts_instance=self,
            conn_options=conn_options,
        )


class ZonosSynthesizeStream(SynthesizeStream):
    """Synthesis stream for Zonos TTS"""

    def __init__(
        self,
        text: str,
        model: Zonos,
        speaker_embedding: Optional[torch.Tensor],
        language: str,
        device: str,
        sample_rate: int,
        tts_instance,
        conn_options=None,
    ):
        super().__init__(tts=tts_instance, conn_options=conn_options)
        self._text = text
        self._model = model
        self._speaker_embedding = speaker_embedding
        self._language = language
        self._device = device
        self._sample_rate = sample_rate

    async def _run(self, output_emitter) -> None:
        """
        Run synthesis and emit audio frames.

        Args:
            output_emitter: Output emitter for audio frames
        """
        try:
            text_preview = self._text[:50] + "..." if len(self._text) > 50 else self._text
            logger.debug(f"Synthesizing with Zonos TTS: {text_preview}")

            # Prepare conditioning
            cond_dict = make_cond_dict(
                text=self._text,
                speaker=self._speaker_embedding,
                lang=self._language
            )

            # Generate audio codes
            with torch.no_grad():
                codes = self._model.generate(cond_dict)

                # Decode to audio waveform
                audio_tensor = self._model.autoencoder.decode(codes)

            # Convert to numpy array
            if audio_tensor.dim() > 1:
                audio_tensor = audio_tensor.squeeze()

            audio_array = audio_tensor.cpu().numpy()

            # Normalize to int16
            if audio_array.dtype == np.float32 or audio_array.dtype == np.float64:
                audio_array = (audio_array * 32767).astype(np.int16)
            elif audio_array.dtype != np.int16:
                audio_array = audio_array.astype(np.int16)

            logger.debug(f"Generated {len(audio_array)} audio samples")

            # Create audio frame and push to output_emitter
            frame = rtc.AudioFrame(
                data=audio_array.tobytes(),
                sample_rate=self._sample_rate,
                num_channels=1,
                samples_per_channel=len(audio_array),
            )
            output_emitter.push(frame)

        except Exception as e:
            logger.error(f"Zonos TTS synthesis failed: {e}", exc_info=True)
            raise RuntimeError(f"TTS synthesis failed: {str(e)}") from e
        finally:
            output_emitter.aclose()


def create(
    model_name: str = None,
    device: str = None,
    language: str = None,
    speaker_audio_path: str = None,
) -> ZonosTTS:
    """
    Create Zonos TTS instance with environment variable configuration.

    Environment variables:
        ZONOS_MODEL: Model name (default: Zyphra/Zonos-v0.1-hybrid)
        ZONOS_DEVICE: Device (default: cuda if available, else cpu)
        ZONOS_LANGUAGE: Language code (default: en)
        ZONOS_SPEAKER_AUDIO: Path to speaker reference audio (optional)

    Args:
        model_name: Override model name
        device: Override device
        language: Override language
        speaker_audio_path: Override speaker audio path

    Returns:
        Configured ZonosTTS instance
    """
    # Get configuration from environment or parameters
    model_name = model_name or os.getenv("ZONOS_MODEL", "Zyphra/Zonos-v0.1-hybrid")
    device = device or os.getenv("ZONOS_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
    language = language or os.getenv("ZONOS_LANGUAGE", "en")
    speaker_audio_path = speaker_audio_path or os.getenv("ZONOS_SPEAKER_AUDIO")

    return ZonosTTS(
        model_name=model_name,
        device=device,
        language=language,
        speaker_audio_path=speaker_audio_path,
    )
