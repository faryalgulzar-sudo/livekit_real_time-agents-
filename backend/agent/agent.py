import logging
import os
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
from livekit.plugins import silero, openai

# import your custom plugins
from plugins.stt_faster_whisper import create as create_stt  # Using local Faster Whisper
from plugins.tts_edge import create as create_tts  # Edge TTS (multilingual)
from latency_monitor import LatencyMonitor  # Latency tracking

# ✅ DB API client (your new file)
from app.core.agent_api_client import AgentAPIClient

# ✅ Intake flow engine
from app.core.intake_flow import load_schema, get_next_question


logger = logging.getLogger("agent")


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
        tts=create_tts(),  # Edge TTS
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

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")
        latency_monitor.print_summary()

    ctx.add_shutdown_callback(log_usage)

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
        room=ctx.room
    )
    logger.info("✅ Agent session started!")

    # ✅ ADD CHAT MESSAGE HANDLER (parallel to voice)
    @ctx.room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket):
        """Handle text chat messages from users"""
        logger.info(f"📩 [DEBUG] Data packet received! Kind: {data_packet.kind}")

        if data_packet.kind == rtc.DataPacketKind.KIND_RELIABLE:
            try:
                message_text = data_packet.data.decode("utf-8")
                logger.info(f"💬 [CHAT] Received message: {message_text}")

                # ✅ Save chat as transcript too
                try:
                    api_client.append_transcript(f"CHAT_USER: {message_text}")
                except Exception as e:
                    logger.error(f"❌ [DB] Failed to append CHAT_USER: {e}")

                import asyncio
                asyncio.create_task(handle_chat_message(message_text, ctx.room, api_client))
            except Exception as e:
                logger.error(f"❌ Error decoding chat message: {e}")
        else:
            logger.info("⚠️ [DEBUG] Ignoring unreliable data packet")


async def handle_chat_message(message: str, room: rtc.Room, api_client: AgentAPIClient):
    """Process chat message through LLM and send response"""
    logger.info(f"🔄 [CHAT] Starting to process message: {message}")

    try:
        ollama_model = os.getenv("OLLAMA_MODEL", "gemma3:1b")
        logger.info(f"💬 [CHAT] Processing with model: {ollama_model}")

        import ollama
        logger.info("📦 [CHAT] Ollama imported successfully")

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
        logger.info(f"✅ [CHAT] Agent reply: {reply}")

        # ✅ Save agent chat reply to transcript
        try:
            api_client.append_transcript(f"CHAT_AGENT: {reply}")
        except Exception as e:
            logger.error(f"❌ [DB] Failed to append CHAT_AGENT: {e}")

        await room.local_participant.publish_data(reply.encode("utf-8"), reliable=True)
        logger.info("✅ [CHAT] Response sent to room successfully")

    except Exception as e:
        import traceback
        logger.error(f"❌ Error handling chat message: {e}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")

        try:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            await room.local_participant.publish_data(error_msg.encode("utf-8"), reliable=True)
        except Exception as send_error:
            logger.error(f"❌ Failed to send error message: {send_error}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)  # Show INFO logs in console
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
