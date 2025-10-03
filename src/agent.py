# agent.py

import logging
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    RoomInputOptions,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.plugins import silero, openai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# import your custom plugins
from plugins.stt_faster_whisper import create as create_stt  # Using local Faster Whisper
# from plugins.tts_piper import create as create_tts  # Piper TTS option
from plugins.tts_pyttsx3 import create as create_tts  # Pyttsx3 TTS option (offline, cross-platform)

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

    # Build session with custom plugins
    tts_instance = create_tts()
    logger.info(f"TTS created: {type(tts_instance)}")

    session = AgentSession(
        stt=create_stt(),  # Local Faster Whisper
        llm=openai.LLM.with_ollama(model="qwen2.5:7b-instruct"),
        tts=tts_instance,
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )
    logger.info("AgentSession created successfully")

    # ✅ HOOKS FOR STT + LLM OUTPUT
    @session.on("transcript_received")
    def _on_transcript(transcript):
        if transcript.text.strip():
            print(f"[STT] {transcript.speaker or 'User'}: {transcript.text}")

    @session.on("response_received")
    def _on_response(response):
        if response.text.strip():
            print(f"[LLM] {response.text}")

    # Metrics collector
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    @session.on("agent_started_speaking")
    def _on_agent_started_speaking():
        logger.info("Agent started speaking")

    @session.on("agent_stopped_speaking")
    def _on_agent_stopped_speaking():
        logger.info("Agent stopped speaking")

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    await ctx.connect()
    await session.start(agent=Assistant())


# ✅ THIS PART WAS MISSING BEFORE
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)  # Show INFO logs in console
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
