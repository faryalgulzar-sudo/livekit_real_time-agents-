"""
Custom audio input that accepts tracks from ANY source (including SOURCE_UNKNOWN).

This is a workaround for the LiveKit JS SDK issue where tracks published via
publishTrack() may not have their source properly set to SOURCE_MICROPHONE.
"""
import logging
from livekit import rtc
from livekit.agents.voice.room_io._input import _ParticipantInputStream, AudioInput

logger = logging.getLogger(__name__)


class CustomAudioInput(_ParticipantInputStream, AudioInput):
    """
    Custom audio input that accepts audio from ANY track source.

    This overrides the default RoomIO behavior which only accepts SOURCE_MICROPHONE.
    """

    def __init__(
        self,
        room: rtc.Room,
        *,
        sample_rate: int = 24000,
        num_channels: int = 1,
        frame_size_ms: int = 50,
        noise_cancellation: rtc.FrameProcessor[rtc.AudioFrame] | None = None,
        pre_connect_audio_handler=None,
    ):
        audio_processor = noise_cancellation

        # Initialize with SOURCE_UNKNOWN to accept ANY audio source
        _ParticipantInputStream.__init__(
            self,
            room=room,
            track_source=[
                rtc.TrackSource.SOURCE_MICROPHONE,
                rtc.TrackSource.SOURCE_UNKNOWN,  # Accept unknown sources too!
            ],
            processor=audio_processor,
        )
        AudioInput.__init__(self, label="CustomAudioInput")

        if frame_size_ms <= 0:
            raise ValueError("frame_size_ms must be greater than 0")

        self._sample_rate = sample_rate
        self._num_channels = num_channels
        self._frame_size_ms = frame_size_ms
        self._noise_cancellation = noise_cancellation
        self._pre_connect_audio_handler = pre_connect_audio_handler

        logger.info("✅ CustomAudioInput initialized - accepts MICROPHONE and UNKNOWN sources")

    def _create_stream(self, track: rtc.Track, participant: rtc.Participant) -> rtc.AudioStream:
        # Create noise cancellation if configured
        noise_cancellation = (
            self._noise_cancellation
            if isinstance(self._noise_cancellation, rtc.FrameProcessor)
            else None
        )

        return rtc.AudioStream(
            track=track,
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
            processor=noise_cancellation,
        )
