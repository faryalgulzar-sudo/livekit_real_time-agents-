"""
TTS Fallback Wrapper - Automatically falls back to alternative TTS on failure

This wrapper provides a robust TTS system with multiple fallback levels:
1. Primary: Zyphra Zonos TTS (high quality, GPU-accelerated)
2. Fallback: Edge TTS (cloud-based, reliable)
3. Final fallback: Flite TTS (local, lightweight)
"""
import logging
from livekit.agents.tts import TTS, SynthesizeStream
from typing import List, Optional

logger = logging.getLogger(__name__)


class FallbackTTS(TTS):
    """TTS wrapper that falls back to alternative providers on failure"""

    def __init__(self, primary: TTS, fallback: TTS, final_fallback: Optional[TTS] = None):
        """
        Initialize fallback TTS system.

        Args:
            primary: Primary TTS provider (e.g., Zonos)
            fallback: Secondary TTS provider (e.g., Edge TTS)
            final_fallback: Tertiary TTS provider (e.g., Flite) - optional
        """
        # Inherit capabilities from primary
        super().__init__(
            capabilities=primary._capabilities,
            sample_rate=primary._sample_rate,
            num_channels=primary._num_channels,
        )
        self.primary = primary
        self.fallback = fallback
        self.final_fallback = final_fallback

        self._primary_failure_count = 0
        self._fallback_failure_count = 0
        self._max_failures_before_switch = 3
        self._permanently_switched = False

        logger.info(
            f"Fallback TTS initialized: "
            f"primary={self.primary.__class__.__name__}, "
            f"fallback={self.fallback.__class__.__name__}"
            + (f", final={self.final_fallback.__class__.__name__}" if self.final_fallback else "")
        )

    def synthesize(self, text: str, *, conn_options=None) -> SynthesizeStream:
        """
        Try primary TTS, fall back on failure.

        Args:
            text: Text to synthesize
            conn_options: Connection options

        Returns:
            SynthesizeStream from successful provider
        """
        # If permanently switched, use fallback as primary
        if self._permanently_switched:
            return self._try_fallback_chain(text, conn_options, skip_primary=True)

        # Try primary first
        try:
            logger.debug(f"Using primary TTS: {self.primary.__class__.__name__}")
            stream = self.primary.synthesize(text, conn_options=conn_options)
            # Reset failure count on success
            self._primary_failure_count = 0
            return stream

        except Exception as e:
            self._primary_failure_count += 1
            logger.warning(
                f"Primary TTS failed ({self._primary_failure_count}/{self._max_failures_before_switch}): {e}"
            )

            # Check if we should permanently switch
            if self._primary_failure_count >= self._max_failures_before_switch:
                logger.error(
                    f"Primary TTS has failed {self._primary_failure_count} times, "
                    f"permanently switching to fallback"
                )
                self._permanently_switched = True

            # Try fallback chain
            return self._try_fallback_chain(text, conn_options, skip_primary=True)

    def _try_fallback_chain(self, text: str, conn_options, skip_primary: bool = False) -> SynthesizeStream:
        """
        Try fallback providers in sequence.

        Args:
            text: Text to synthesize
            conn_options: Connection options
            skip_primary: Whether to skip primary (already failed)

        Returns:
            SynthesizeStream from successful provider

        Raises:
            RuntimeError: If all providers fail
        """
        last_error = None

        # Try secondary fallback
        try:
            logger.info(f"Falling back to {self.fallback.__class__.__name__}")
            stream = self.fallback.synthesize(text, conn_options=conn_options)
            self._fallback_failure_count = 0
            return stream

        except Exception as e:
            self._fallback_failure_count += 1
            last_error = e
            logger.error(
                f"Fallback TTS failed ({self._fallback_failure_count}): {e}"
            )

        # Try final fallback if available
        if self.final_fallback:
            try:
                logger.warning(f"Using final fallback: {self.final_fallback.__class__.__name__}")
                return self.final_fallback.synthesize(text, conn_options=conn_options)
            except Exception as e:
                logger.error(f"Final fallback TTS also failed: {e}")
                last_error = e

        # All providers failed
        raise RuntimeError(
            f"All TTS providers failed. Last error: {last_error}"
        ) from last_error

    def reset_failure_counts(self):
        """Reset failure counts (useful for testing or recovery)"""
        self._primary_failure_count = 0
        self._fallback_failure_count = 0
        self._permanently_switched = False
        logger.info("TTS failure counts reset")


def create() -> FallbackTTS:
    """
    Create TTS with automatic fallback chain:
    Edge TTS (primary, fast) → Flite (fallback, local)

    Zonos TTS removed for speed - Edge TTS is ~5x faster

    Returns:
        Configured FallbackTTS instance
    """
    try:
        # Import TTS providers
        from plugins.tts_edge import create as create_edge
        from plugins.tts_flite import create as create_flite

        # Create primary (Edge TTS) - fast cloud-based TTS
        try:
            primary = create_edge()
            logger.info("✅ Primary TTS: Microsoft Edge TTS (cloud, fast)")
        except Exception as e:
            logger.error(f"Failed to initialize Edge TTS: {e}")
            # If Edge fails, use Flite as primary (shouldn't happen)
            try:
                primary = create_flite()
                logger.warning("Using Flite as primary (Edge TTS unavailable)")
            except Exception as flite_error:
                raise RuntimeError(f"No TTS available: Edge failed ({e}), Flite failed ({flite_error})")

        # Create fallback (Flite) - local lightweight TTS
        try:
            fallback = create_flite()
            logger.info("✅ Fallback TTS: Flite (local, lightweight)")
        except Exception as e:
            logger.warning(f"Failed to initialize Flite TTS: {e}")
            fallback = None

        # Return fallback TTS if we have both providers
        if fallback:
            return FallbackTTS(
                primary=primary,
                fallback=fallback,
                final_fallback=None  # Only 2-tier now: Edge → Flite
            )
        else:
            # Only Edge available, return it directly
            logger.warning("Only Edge TTS available, no fallback configured")
            return primary

    except Exception as e:
        logger.error(f"Failed to create fallback TTS: {e}", exc_info=True)
        raise RuntimeError(f"TTS initialization failed: {e}") from e
