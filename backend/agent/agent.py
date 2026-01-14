import logging
import os
import signal
import sys
from dotenv import load_dotenv
load_dotenv()
load_dotenv(".env.local")

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
from livekit.agents.voice import room_io
from livekit.plugins import silero, openai

# import your custom plugins
from plugins.stt_faster_whisper import create as create_stt  # Using local Faster Whisper
from plugins.tts_fallback import create as create_tts  # TTS with fallback: Edge → Flite
from latency_monitor import LatencyMonitor  # Latency tracking
from custom_audio_input import CustomAudioInput  # Accept SOURCE_UNKNOWN tracks

# ✅ DB API client (your new file)
from app.core.agent_api_client import AgentAPIClient

# ✅ Intake flow engine
from app.core.intake_flow import load_schema, get_next_question


logger = logging.getLogger("agent")

# Global cleanup flag for graceful shutdown
_shutting_down = False


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global _shutting_down
    if _shutting_down:
        logger.warning("Force shutdown - second signal received")
        sys.exit(1)

    _shutting_down = True
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    # The shutdown callbacks will be called automatically by LiveKit agent framework


# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


class Assistant(Agent):
    def __init__(self, intake_schema=None, api_client=None, ctx_proc_userdata=None) -> None:
        # Build dynamic instructions based on intake mode
        base_instructions = (
            "You are a helpful voice AI assistant at a dental clinic. The user is interacting with you via voice.\n"
            "Keep responses short, clear, and friendly. No emojis or special formatting.\n"
        )

        super().__init__(instructions=base_instructions)
        self.intake_schema = intake_schema
        self.api_client = api_client
        self.ctx_proc_userdata = ctx_proc_userdata
        self.collected_data = {}


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    # Initialize latency monitor
    latency_monitor = LatencyMonitor(verbose=True)

    # ✅ Create DB session client (per room/job)
    tenant_id = os.getenv("TENANT_ID", "demo_clinic")
    api_client = AgentAPIClient(tenant_id=tenant_id)

    # ✅ Load intake schema
    schema_path = os.path.join(os.path.dirname(__file__), "app/core/intake_schema.json")
    intake_schema = load_schema(schema_path)
    logger.info(f"✅ [INTAKE] Loaded schema from {schema_path}")

    # ✅ Create a DB session as soon as we start (safe try/catch so agent never breaks)
    try:
        session_id = api_client.create_session()
        logger.info(f"✅ [DB] Created session_id: {session_id} (tenant: {tenant_id})")
        ctx.proc.userdata["db_session_id"] = session_id

        # Initialize intake flow state
        ctx.proc.userdata["intake_current_key"] = None
        ctx.proc.userdata["intake_mode"] = "ask"  # Start in intake mode
        ctx.proc.userdata["intake_next_prompt"] = None

    except Exception as e:
        logger.error(f"❌ [DB] Failed to create session: {e}")
        # Do not crash the voice agent if DB is down.

    # Get Ollama model from environment or use default
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
    logger.info(f"Using Ollama model: {ollama_model}")

    # Build session with STT, LLM, TTS
    session = AgentSession(
        stt=create_stt(),  # Local Faster Whisper
        llm=openai.LLM.with_ollama(model=ollama_model),
        tts=create_tts(),  # TTS with fallback: Zonos (primary) → Edge → Flite
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

            # ✅ Save user transcript to DB (safe)
            try:
                api_client.append_transcript(f"USER: {transcript.text}")
            except Exception as e:
                logger.error(f"❌ [DB] Failed to append USER transcript: {e}")

            # ✅ INTAKE FLOW: Parse answer and save, then get next question
            try:
                # Step 1: Save user's answer if we were expecting one
                current_key = ctx.proc.userdata.get("intake_current_key")
                if current_key and current_key != "confirm":
                    user_answer = transcript.text.strip()
                    logger.info(f"✅ [INTAKE] Saving answer for '{current_key}': {user_answer}")
                    api_client.save_answer(current_key, user_answer)

                # Step 2: Get current collected data from DB
                collected_data = api_client.get_collected_data()
                logger.info(f"✅ [INTAKE] Fetched collected_data: {list(collected_data.keys())}")

                # Step 3: Determine next action
                result = get_next_question(collected_data, intake_schema, language="en")

                if result["action"] == "ask":
                    logger.info(f"✅ [INTAKE] Next question: {result['key']} - {result['prompt']}")
                    # Store for next round
                    ctx.proc.userdata["intake_current_key"] = result["key"]
                    ctx.proc.userdata["intake_mode"] = "ask"
                    ctx.proc.userdata["intake_next_prompt"] = result["prompt"]
                elif result["action"] == "confirm":
                    logger.info(f"✅ [INTAKE] Ready to confirm: {result['prompt']}")
                    ctx.proc.userdata["intake_current_key"] = "confirm"
                    ctx.proc.userdata["intake_mode"] = "confirm"
                    ctx.proc.userdata["intake_next_prompt"] = result["prompt"]
                else:
                    logger.info(f"✅ [INTAKE] Intake complete, switching to RAG mode")
                    ctx.proc.userdata["intake_current_key"] = None
                    ctx.proc.userdata["intake_mode"] = "rag"
                    ctx.proc.userdata["intake_next_prompt"] = None

            except Exception as e:
                logger.error(f"❌ [INTAKE] Error in intake flow: {e}")

    @session.on("response_received")
    def _on_response(response):
        if response.text.strip():
            logger.info(f"✅ [LLM] Response: {response.text}")
            latency_monitor.on_llm_response_received(response.text)

            # ✅ Save agent response to DB (safe)
            try:
                api_client.append_transcript(f"AGENT: {response.text}")
            except Exception as e:
                logger.error(f"❌ [DB] Failed to append AGENT transcript: {e}")

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

    async def cleanup_session():
        """Clean up session resources on disconnect"""
        logger.info("Starting session cleanup...")

        # 1. Finalize database session
        try:
            if hasattr(ctx.proc.userdata, 'db_session_id'):
                session_id = ctx.proc.userdata.get('db_session_id')
                if session_id:
                    logger.info(f"Finalizing database session: {session_id}")
                    api_client.finalize_session()
        except Exception as e:
            logger.error(f"Error finalizing database session: {e}")

        # 2. Log usage summary
        try:
            summary = usage_collector.get_summary()
            logger.info(f"Usage: {summary}")
        except Exception as e:
            logger.error(f"Error logging usage: {e}")

        # 3. Print latency summary and clear memory
        try:
            latency_monitor.print_summary()
            # Clear latency monitor memory
            if hasattr(latency_monitor, 'turns'):
                latency_monitor.turns.clear()
            if hasattr(latency_monitor, 'current_turn'):
                latency_monitor.current_turn = None
            logger.info("Latency monitor cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up latency monitor: {e}")

        logger.info("Session cleanup completed")

    ctx.add_shutdown_callback(cleanup_session)

    # Add participant event handler
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"✅ Participant joined: {participant.identity}")
        for track_pub in participant.track_publications.values():
            if track_pub.kind == rtc.TrackKind.KIND_AUDIO:
                track_pub.set_subscribed(True)
                logger.info(f"✅ Subscribed to audio track: {track_pub.sid}")

    @ctx.room.on("track_published")
    def on_track_published(
        publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant
    ):
        logger.info(f"✅ Track published by {participant.identity}: {publication.sid}")
        if publication.kind == rtc.TrackKind.KIND_AUDIO:
            publication.set_subscribed(True)
            logger.info("✅ Subscribed to newly published audio track")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        logger.info(f"✅ Track subscribed: {track.sid} from {participant.identity}")
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info("✅ Audio track ready for processing")

    logger.info("🔌 Attempting to connect to room...")
    try:
        await ctx.connect(auto_subscribe=True)
        logger.info("✅ Successfully connected to room!")
    except Exception as e:
        logger.error(f"❌ Failed to connect to room: {e}")
        raise

    logger.info("🚀 Starting agent session...")
    await session.start(
        agent=Assistant(
            intake_schema=intake_schema,
            api_client=api_client,
            ctx_proc_userdata=ctx.proc.userdata
        ),
        room=ctx.room,
    )
    logger.info("✅ Agent session started!")

    # Replace the default audio input with our custom one that accepts SOURCE_UNKNOWN
    custom_audio_input = CustomAudioInput(
        room=ctx.room,
        sample_rate=24000,
        num_channels=1,
        frame_size_ms=50,
    )
    session.input.audio = custom_audio_input
    logger.info("✅ Custom audio input configured (accepts SOURCE_MICROPHONE and SOURCE_UNKNOWN)")

    # Send initial greeting
    initial_greeting = "Hello! Welcome to our dental clinic. I'm your AI assistant. How can I help you today?"
    logger.info(f"Sending initial greeting: {initial_greeting}")
    await session.say(initial_greeting, allow_interruptions=True)

    # Save greeting to transcript
    try:
        api_client.append_transcript(f"AGENT: {initial_greeting}")
    except Exception as e:
        logger.error(f"Failed to save greeting transcript: {e}")

    # Chat message handler
    @ctx.room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket):
        """Handle text chat messages from users"""
        logger.debug(f"Data packet received: kind={data_packet.kind}")

        if data_packet.kind == rtc.DataPacketKind.KIND_RELIABLE:
            try:
                message_text = data_packet.data.decode("utf-8")
                # Truncate message in logs for security
                message_preview = message_text[:100] + "..." if len(message_text) > 100 else message_text
                logger.info(f"Chat message received: {message_preview}")

                # Save chat as transcript
                try:
                    api_client.append_transcript(f"CHAT_USER: {message_text}")
                except Exception as e:
                    logger.error(f"Failed to save chat transcript: {e}")

                import asyncio
                asyncio.create_task(handle_chat_message(message_text, ctx.room, api_client))
            except Exception as e:
                logger.error(f"Error processing chat message: {e}")
        else:
            logger.debug("Ignoring unreliable data packet")


async def handle_chat_message(message: str, room: rtc.Room, api_client: AgentAPIClient):
    """Process chat message through LLM and send response"""
    message_preview = message[:50] + "..." if len(message) > 50 else message
    logger.debug(f"Processing chat message: {message_preview}")

    try:
        ollama_model = os.getenv("OLLAMA_MODEL", "gemma3:1b")
        logger.debug(f"Using model: {ollama_model}")

        import ollama

        response = ollama.chat(
            model=ollama_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant. Keep responses clear and concise.",
                },
                {"role": "user", "content": message},
            ],
        )

        reply = response["message"]["content"]
        reply_preview = reply[:100] + "..." if len(reply) > 100 else reply
        logger.info(f"Chat response generated: {reply_preview}")

        # Save agent chat reply to transcript
        try:
            api_client.append_transcript(f"CHAT_AGENT: {reply}")
        except Exception as e:
            logger.error(f"Failed to save chat response to transcript: {e}")

        await room.local_participant.publish_data(reply.encode("utf-8"), reliable=True)
        logger.debug("Chat response sent to room")

    except Exception as e:
        import traceback
        logger.error(f"Error handling chat message: {e}")
        logger.debug(f"Traceback: {traceback.format_exc()}")

        try:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            await room.local_participant.publish_data(error_msg.encode("utf-8"), reliable=True)
        except Exception as send_error:
            logger.error(f"Failed to send error message: {send_error}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)  # Show INFO logs in console
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
