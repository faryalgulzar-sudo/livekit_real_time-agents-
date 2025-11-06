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

    # ✅ ADD CHAT MESSAGE HANDLER (parallel to voice)
    @ctx.room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket):
        """Handle text chat messages from users"""
        logger.info(f"📩 [DEBUG] Data packet received! Kind: {data_packet.kind}")
        if data_packet.kind == rtc.DataPacketKind.KIND_RELIABLE:
            try:
                message_text = data_packet.data.decode('utf-8')
                logger.info(f"💬 [CHAT] Received message: {message_text}")

                # Process chat message asynchronously
                import asyncio
                asyncio.create_task(handle_chat_message(message_text, ctx.room))
            except Exception as e:
                logger.error(f"❌ Error decoding chat message: {e}")
        else:
            logger.info(f"⚠️ [DEBUG] Ignoring unreliable data packet")


async def handle_chat_message(message: str, room: rtc.Room):
    """Process chat message through LLM and send response"""
    logger.info(f"🔄 [CHAT] Starting to process message: {message}")
    try:
        # Get Ollama model from environment
        ollama_model = os.getenv("OLLAMA_MODEL", "gemma3:1b")
        logger.info(f"💬 [CHAT] Processing with model: {ollama_model}")

        # Import ollama
        import ollama
        logger.info("📦 [CHAT] Ollama imported successfully")

        # Get LLM response
        logger.info("🤖 [CHAT] Calling ollama.chat()...")
        response = ollama.chat(
            model=ollama_model,
            messages=[{
                "role": "system",
                "content": "You are a helpful AI assistant. Keep responses clear and concise."
            }, {
                "role": "user",
                "content": message
            }]
        )

        reply = response['message']['content']
        logger.info(f"✅ [CHAT] Agent reply: {reply}")

        # Send response back as data message
        logger.info("📤 [CHAT] Publishing response to room...")
        await room.local_participant.publish_data(
            reply.encode('utf-8'),
            reliable=True
        )
        logger.info("✅ [CHAT] Response sent to room successfully")

    except Exception as e:
        import traceback
        logger.error(f"❌ Error handling chat message: {e}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        # Send error message back
        try:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            await room.local_participant.publish_data(
                error_msg.encode('utf-8'),
                reliable=True
            )
        except Exception as send_error:
            logger.error(f"❌ Failed to send error message: {send_error}")


# ✅ THIS PART WAS MISSING BEFORE
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)  # Show INFO logs in console
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
