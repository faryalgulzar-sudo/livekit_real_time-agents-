from faster_whisper import WhisperModel
from livekit.agents.stt import STT, STTCapabilities, SpeechEvent, SpeechEventType, SpeechData
from livekit import rtc
import asyncio
import numpy as np
import soundfile as sf
import logging
import os

logger = logging.getLogger("stt_whisper")

# Ensure CUDA libraries are found
_cuda_paths = [
    "/usr/local/cuda/lib64",
    "/usr/local/cuda-12/lib64",
    "/usr/lib/x86_64-linux-gnu",
]
for path in _cuda_paths:
    if os.path.exists(path):
        current_ld = os.environ.get("LD_LIBRARY_PATH", "")
        if path not in current_ld:
            os.environ["LD_LIBRARY_PATH"] = f"{path}:{current_ld}" if current_ld else path


class FasterWhisperSTT(STT):
    """
    Faster Whisper STT for LiveKit agents.
    Uses streaming=False - the SDK's StreamAdapter will handle VAD segmentation.
    When VAD detects end of speech, it will call _recognize_impl with the audio buffer.
    """
    def __init__(self, model_size: str = "large-v3", device: str = "cuda"):
        super().__init__(
            capabilities=STTCapabilities(
                streaming=False,  # Non-streaming - SDK will use StreamAdapter with VAD
                interim_results=False  # Whisper doesn't support interim results
            )
        )
        import time
        self._device = device
        self._model_size = model_size

        # Try CUDA first, fall back to CPU if it fails
        compute_type = "float16" if device == "cuda" else "int8"
        logger.info("=" * 50)
        logger.info(f"🔊 [STT] Loading Whisper model: {model_size}")
        logger.info(f"🔊 [STT] Device: {device}, Compute type: {compute_type}")
        logger.info("=" * 50)

        start_time = time.time()
        try:
            self._whisper = WhisperModel(model_size, device=device, compute_type=compute_type)
            load_time = time.time() - start_time
            logger.info(f"✅ [STT] Whisper model loaded successfully!")
            logger.info(f"✅ [STT] Device: {device.upper()}, Load time: {load_time:.2f}s")
        except Exception as e:
            logger.warning(f"⚠️ [STT] CUDA load failed: {e}, falling back to CPU")
            self._device = "cpu"
            try:
                self._whisper = WhisperModel(model_size, device="cpu", compute_type="int8")
                load_time = time.time() - start_time
                logger.info(f"✅ [STT] Whisper model loaded on CPU! Load time: {load_time:.2f}s")
            except Exception as e2:
                logger.error(f"❌ [STT] Failed to load Whisper model: {e2}")
                raise

    async def _recognize_impl(self, buffer, *, language: str = None, conn_options=None) -> SpeechEvent:
        """
        Non-streaming recognition called by StreamAdapter when VAD detects end of speech.
        The buffer contains the audio frames collected during the speech segment.
        """
        logger.info(f"🔊 [STT] _recognize_impl called - processing audio buffer")

        try:
            # Handle different input types
            if hasattr(buffer, 'data'):
                # It's an AudioFrame object - extract raw audio data
                audio_array = np.frombuffer(buffer.data, dtype=np.int16)
                audio_data = audio_array.astype(np.float32) / 32768.0
                sample_rate = getattr(buffer, 'sample_rate', 16000)
                logger.info(f"🔊 [STT] Processing AudioFrame: {len(audio_array)} samples at {sample_rate}Hz")
            elif hasattr(buffer, 'read'):
                # It's a file-like object
                audio_data, sample_rate = sf.read(buffer)
                if audio_data.dtype != np.float32:
                    audio_data = audio_data.astype(np.float32)
                logger.info(f"🔊 [STT] Processing file-like object: {len(audio_data)} samples")
            elif isinstance(buffer, np.ndarray):
                # Already a numpy array
                if buffer.dtype == np.int16:
                    audio_data = buffer.astype(np.float32) / 32768.0
                else:
                    audio_data = buffer.astype(np.float32)
                logger.info(f"🔊 [STT] Processing numpy array: {len(audio_data)} samples")
            elif isinstance(buffer, bytes):
                # Raw bytes
                audio_array = np.frombuffer(buffer, dtype=np.int16)
                audio_data = audio_array.astype(np.float32) / 32768.0
                logger.info(f"🔊 [STT] Processing bytes: {len(audio_array)} samples")
            elif isinstance(buffer, str):
                # It's a file path
                audio_data, sample_rate = sf.read(buffer)
                if audio_data.dtype != np.float32:
                    audio_data = audio_data.astype(np.float32)
                logger.info(f"🔊 [STT] Processing file path: {len(audio_data)} samples")
            else:
                logger.error(f"❌ [STT] Unsupported buffer type: {type(buffer)}")
                raise ValueError(f"Unsupported buffer type: {type(buffer)}")

            # Run transcription in executor to avoid blocking
            loop = asyncio.get_event_loop()
            kwargs = {
                'language': language or 'en',  # Default to English
                'task': 'transcribe',
            }

            logger.info(f"🔊 [STT] Starting Whisper transcription on {len(audio_data)} samples (lang={kwargs['language']})...")

            segments, info = await loop.run_in_executor(
                None,
                lambda: self._whisper.transcribe(audio_data, **kwargs)
            )

            # Collect all text from segments
            text_parts = []
            for seg in segments:
                text_parts.append(seg.text)
                logger.debug(f"🔊 [STT] Segment: '{seg.text}'")

            final_text = " ".join(text_parts).strip()

            if final_text:
                logger.info(f"✅ [STT] Transcription result: '{final_text}'")
            else:
                logger.warning(f"⚠️ [STT] Empty transcription result")
                final_text = ""

            # Create SpeechData for the event
            detected_language = language or (info.language if info else 'en')
            speech_data = SpeechData(
                language=detected_language,
                text=final_text,
            )

            # Return SpeechEvent
            return SpeechEvent(
                type=SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[speech_data]
            )

        except Exception as e:
            logger.error(f"❌ [STT] Recognition error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Return empty result on error
            return SpeechEvent(
                type=SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[SpeechData(language=language or 'en', text='')]
            )


# Entry point for LiveKit Agent
def create():
    # Using GPU (CUDA) with base model for fast transcription
    # Requires NVIDIA CUDA base image in Docker
    return FasterWhisperSTT(model_size="base", device="cuda")
