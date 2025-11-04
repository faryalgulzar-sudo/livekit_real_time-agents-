import logging
import os
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.plugins import silero, openai
# from livekit.plugins.turn_detector.multilingual import MultilingualModel  # Disabled - requires model download

# import your custom plugins
from plugins.stt_faster_whisper import create as create_stt  # Using local Faster Whisper
from plugins.tts_edge import create as create_tts  # Edge TTS (multilingual)
from latency_monitor import LatencyMonitor  # Latency tracking

logger = logging.getLogger("agent")
load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant. The user is interacting with you via voice.
            Keep responses short, clear, and friendly. No emojis or special formatting."""
        )


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    # Initialize latency monitor
    latency_monitor = LatencyMonitor(verbose=True)

    # Get Ollama model from environment or use default
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
    logger.info(f"Using Ollama model: {ollama_model}")

    # Build session with STT, LLM, TTS
    session = AgentSession(
        stt=create_stt(),  # Local Faster Whisper
        llm=openai.LLM.with_ollama(model=ollama_model),
        tts=create_tts(),  # Edge TTS
        # turn_detection=MultilingualModel(),  # Disabled - use VAD only for turn detection
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )
    logger.info("AgentSession created successfully")

    # ✅ HOOKS FOR STT + LLM OUTPUT + LATENCY TRACKING
    @session.on("user_started_speaking")
    def _on_user_started_speaking():
        latency_monitor.on_user_started_speaking()

    @session.on("user_stopped_speaking")
    def _on_user_stopped_speaking():
        latency_monitor.on_user_stopped_speaking()

    @session.on("transcript_received")
    def _on_transcript(transcript):
        if transcript.text.strip():
            logger.info(f"✅ [STT] Transcript: {transcript.text}")
            latency_monitor.on_transcript_received(transcript.text)

    @session.on("response_received")
    def _on_response(response):
        if response.text.strip():
            logger.info(f"✅ [LLM] Response: {response.text}")
            latency_monitor.on_llm_response_received(response.text)

    # Metrics collector
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    @session.on("agent_started_speaking")
    def _on_agent_started_speaking():
        logger.info("✅ [TTS] Agent started speaking")
        latency_monitor.on_tts_started()
        latency_monitor.on_agent_started_speaking()

    @session.on("agent_stopped_speaking")
    def _on_agent_stopped_speaking():
        latency_monitor.on_tts_completed()
        latency_monitor.on_agent_stopped_speaking()

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")
        # Print latency summary
        latency_monitor.print_summary()

    ctx.add_shutdown_callback(log_usage)

    # Add participant event handler
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"✅ Participant joined: {participant.identity}")
        # Subscribe to all audio tracks from this participant
        for track_pub in participant.track_publications.values():
            if track_pub.kind == rtc.TrackKind.KIND_AUDIO:
                track_pub.set_subscribed(True)
                logger.info(f"✅ Subscribed to audio track: {track_pub.sid}")

    @ctx.room.on("track_published")
    def on_track_published(publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        logger.info(f"✅ Track published by {participant.identity}: {publication.sid}")
        if publication.kind == rtc.TrackKind.KIND_AUDIO:
            publication.set_subscribed(True)
            logger.info(f"✅ Subscribed to newly published audio track")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        logger.info(f"✅ Track subscribed: {track.sid} from {participant.identity}")
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"✅ Audio track ready for processing")

    logger.info("🔌 Attempting to connect to room...")
    try:
        await ctx.connect(auto_subscribe=True)
        logger.info("✅ Successfully connected to room!")
    except Exception as e:
        logger.error(f"❌ Failed to connect to room: {e}")
        raise

    logger.info("🚀 Starting agent session...")
    await session.start(agent=Assistant(), room=ctx.room)
    logger.info("✅ Agent session started!")


# ✅ THIS PART WAS MISSING BEFORE
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)  # Show INFO logs in console
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
