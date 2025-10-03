# agent.py

import logging
from dotenv import load_dotenv
import os
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
from pathlib import Path

# import your custom plugins
from plugins.stt_faster_whisper import create as create_stt
from plugins.tts_piper import create as create_tts

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
    # Logging setup
    ctx.log_context_fields = {"room": ctx.room.name}

    # Build session using your custom plugins
    session = AgentSession(
        stt=create_stt(),
        llm=openai.LLM.with_ollama(model="qwen2.5:7b-instruct"),
        tts=create_tts(),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Collect metrics
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    # Start the session
    await session.start(
        agent=Assistant()
    )
    '''async def entrypoint(ctx: JobContext):
    await ctx.connect()
    agent = SalesAgent()
    session = AgentSession()
    await session.start(room=ctx.room, agent=agent)'''

    # Connect agent to the room
    await ctx.connect()
    session = AgentSession()
    await session.start(room=ctx.room, agent=agent)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
