import logging
import os
import asyncio
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
    RoomInputOptions,
)
from livekit.plugins import silero, openai

# import your custom plugins
from plugins.stt_faster_whisper import create as create_stt  # Using local Faster Whisper
from plugins.tts_edge import create as create_tts  # Edge TTS (multilingual)
from latency_monitor import LatencyMonitor  # Latency tracking

# ✅ DB API client (your new file)
from app.core.agent_api_client import AgentAPIClient

# ✅ Intake flow engine
from app.core.intake_flow import load_schema


logger = logging.getLogger("agent")


# ==========================================
# HYBRID VALIDATION HELPERS
# ==========================================

def validate_name_basic(name: str) -> tuple[bool, str]:
    """
    Basic rule-based name validation.
    Returns (is_valid, reason)
    """
    name = name.strip()

    # Too short
    if len(name) < 2:
        return False, "too_short"

    # Only numbers
    if name.replace(" ", "").isdigit():
        return False, "only_numbers"

    # Has at least some letters
    has_letters = any(c.isalpha() for c in name)
    if not has_letters:
        return False, "no_letters"

    # Too many numbers (more than 50% digits)
    digit_count = sum(1 for c in name if c.isdigit())
    if digit_count > len(name) * 0.5:
        return False, "too_many_numbers"

    return True, "ok"


def validate_phone_basic(phone: str) -> tuple[bool, str]:
    """
    Basic rule-based phone validation.
    Returns (is_valid, reason)
    """
    # Extract only digits
    digits = ''.join(c for c in phone if c.isdigit())

    # Pakistani numbers: 10-11 digits (03001234567 or 3001234567)
    # International: 7+ digits minimum
    if len(digits) < 7:
        return False, "too_short"

    if len(digits) > 15:
        return False, "too_long"

    return True, "ok"


async def validate_with_llm(value: str, field_type: str, ollama_model: str) -> tuple[bool, str]:
    """
    Use LLM to validate suspicious inputs.
    field_type: "name" or "phone"
    Returns (is_valid, suggestion)
    """
    import ollama

    if field_type == "name":
        prompt = f"""Is "{value}" a valid human name? Answer only YES or NO.
Consider: Names can be in any language (English, Urdu, Arabic, etc).
Single word names like "Ali", "Sara" are valid.
Random letters like "asdf" or "xyz123" are NOT valid names."""
    else:  # phone
        prompt = f"""Does "{value}" look like a phone number? Answer only YES or NO.
It should have 7-15 digits. Words like "two three four" should be converted to numbers.
"{value}" - is this a valid phone number attempt?"""

    try:
        response = ollama.chat(
            model=ollama_model,
            messages=[
                {"role": "system", "content": "You validate user inputs. Answer only YES or NO."},
                {"role": "user", "content": prompt},
            ],
        )
        answer = response["message"]["content"].strip().upper()
        is_valid = "YES" in answer
        return is_valid, answer
    except Exception as e:
        logger.error(f"❌ [VALIDATION] LLM validation failed: {e}")
        # On error, accept the input (don't block user)
        return True, "error_fallback"


# ==========================================
# TONE PACK - Voice Conversation Rules
# ==========================================
TONE_PACK = """
VOICE CONVERSATION RULES:
1. SHORT REPLIES: Maximum 2-3 sentences. Keep it conversational.
2. ENGLISH ONLY: Always respond in clear, simple English.
3. BE HELPFUL: If user asks a question, answer it naturally - don't ignore them.
4. WARM & FRIENDLY: Sound like a helpful human receptionist, not a robot.
5. NATURAL FLOW: Have a real conversation, don't be too strict or scripted.
"""

# ==========================================
# STRUCTURED OUTPUT - JSON Response Format
# ==========================================
STRUCTURED_OUTPUT_PROMPT = """
You MUST respond in this exact JSON format (no other text):
{
  "action": "rag" | "confirm" | "smalltalk" | "schedule" | "unclear",
  "say": "The exact text to speak to the user (1-2 sentences max)",
  "intent": "brief description of what user wants",
  "needs_followup": true | false
}

ACTION TYPES:
- "rag": Answering a question using clinic knowledge
- "confirm": Confirming information back to user
- "smalltalk": Casual greeting or thanks
- "schedule": User wants to schedule/book something
- "unclear": Didn't understand, need to ask again

IMPORTANT: Output ONLY valid JSON, nothing else.
"""


def parse_structured_response(llm_output: str) -> dict:
    """
    Parse LLM's structured JSON response.
    Falls back to free text if JSON parsing fails.
    """
    import json

    # Try to extract JSON from response
    try:
        # Clean up response - remove markdown code blocks if present
        cleaned = llm_output.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # Parse JSON
        parsed = json.loads(cleaned)

        # Validate required fields
        if "say" in parsed and "action" in parsed:
            return {
                "success": True,
                "action": parsed.get("action", "rag"),
                "say": parsed.get("say", ""),
                "intent": parsed.get("intent", ""),
                "needs_followup": parsed.get("needs_followup", False)
            }
    except json.JSONDecodeError:
        pass
    except Exception as e:
        logger.warning(f"⚠️ [STRUCTURED] Parse error: {e}")

    # Fallback: use raw output as "say" text
    return {
        "success": False,
        "action": "rag",
        "say": llm_output.strip(),
        "intent": "unknown",
        "needs_followup": False
    }


# ==========================================
# BACKCHANNELING - Voice Call Feel
# ==========================================
import random

BACKCHANNELS = [
    "Okay.",
    "Sure.",
    "Right.",
    "Got it.",
    "I see.",
    "Understood.",
]

# Track backchannel usage globally
_backchannel_counter = {"count": 0, "last_used": 0}


def should_backchannel(user_text: str, turn_number: int) -> bool:
    """
    Decide if we should add a backchannel before response.
    Rules:
    - Only if user said a long sentence (>30 chars)
    - Not every turn - every 2-3 turns max
    - Not on first turn
    """
    global _backchannel_counter

    # Don't backchannel on first few turns
    if turn_number < 2:
        return False

    # Only if user said something substantial
    if len(user_text.strip()) < 30:
        return False

    # Check if enough turns have passed since last backchannel
    turns_since_last = turn_number - _backchannel_counter["last_used"]
    if turns_since_last < 2:
        return False

    # Random chance (50%) to add variety
    if random.random() < 0.5:
        return False

    return True


def get_backchannel() -> str:
    """Get a random backchannel phrase."""
    global _backchannel_counter
    _backchannel_counter["count"] += 1
    return random.choice(BACKCHANNELS)


def mark_backchannel_used(turn_number: int):
    """Mark that backchannel was used on this turn."""
    global _backchannel_counter
    _backchannel_counter["last_used"] = turn_number


# ==========================================
# REPAIR STRATEGY - Handle unclear STT
# ==========================================

# Track repair attempts per field
_repair_counter = {"count": 0, "field": None}

# Common STT noise/garbage patterns
STT_GARBAGE_PATTERNS = [
    "",  # Empty
    " ",  # Just space
    ".",  # Just punctuation
    "...",
    "hmm",
    "uh",
    "um",
    "ah",
    "[inaudible]",
    "[music]",
    "[noise]",
    "thank you for watching",  # Common STT hallucination
    "please subscribe",  # Common STT hallucination
]


def is_stt_unclear(text: str, field_type: str = None) -> tuple[bool, str]:
    """
    Check if STT result is unclear/garbage and needs repair.
    Returns (is_unclear, reason)
    """
    text = text.strip().lower()

    # Empty or too short
    if len(text) < 1:
        return True, "empty"

    # Just punctuation
    if all(c in ".,!?;:-'" for c in text.replace(" ", "")):
        return True, "only_punctuation"

    # Known garbage patterns
    for pattern in STT_GARBAGE_PATTERNS:
        if text == pattern.lower() or text.startswith(pattern.lower()):
            return True, "garbage_pattern"

    # Too short for name field
    if field_type == "name" and len(text) < 2:
        return True, "too_short_for_name"

    # Only single character repeated
    if len(set(text.replace(" ", ""))) == 1 and len(text) > 2:
        return True, "repeated_char"

    # Mostly non-alphanumeric
    alnum_count = sum(1 for c in text if c.isalnum())
    if len(text) > 3 and alnum_count < len(text) * 0.3:
        return True, "mostly_symbols"

    return False, "ok"


def get_repair_message(field_type: str, reason: str, attempt: int) -> str:
    """
    Get appropriate repair message based on field and attempt number.
    """
    # reason parameter used for future logging/analytics
    _ = reason
    if attempt == 1:
        # First attempt - polite request
        if field_type == "name":
            return "Sorry, I didn't catch that. Could you please say your name again?"
        elif field_type == "phone":
            return "Sorry, I didn't hear that clearly. Could you repeat your phone number slowly?"
        else:
            return "Sorry, could you please repeat that?"

    elif attempt == 2:
        # Second attempt - ask to spell/speak slowly
        if field_type == "name":
            return "I'm having trouble hearing. Could you spell your name for me?"
        elif field_type == "phone":
            return "Please say each digit separately. For example: zero, three, zero, zero..."
        else:
            return "Could you speak a bit louder and slower please?"

    else:
        # Third attempt - apologize and ask one more time
        return "I apologize for the trouble. Let's try one more time. Please speak clearly."


# ==========================================
# RAG RESPONSE CLAMPING - Concise + Grounded
# ==========================================

def clamp_rag_response(response: str, max_sentences: int = 3) -> str:
    """
    Clamp RAG response to max_sentences and add follow-up offer.
    Makes responses concise and human-like.
    """
    # Split into sentences
    import re
    sentences = re.split(r'(?<=[.!?])\s+', response.strip())

    # Take only first max_sentences
    clamped = sentences[:max_sentences]
    result = ' '.join(clamped)

    # Clean up any trailing incomplete sentences
    if result and not result[-1] in '.!?':
        result = result.rstrip(',;:') + '.'

    return result


# RAG grounding prompt - natural English responses
RAG_GROUNDING_RULES = """
RESPONSE RULES:
1. Use clinic information when available, but be naturally helpful
2. If you don't know something, say: "I'll check on that for you" or "Let me confirm that"
3. Keep responses short - 2-3 sentences max
4. End with: "Is there anything else I can help you with?"
5. ENGLISH ONLY - always respond in clear English
6. Be warm and conversational like a real receptionist
"""


# ==========================================
# CONVERSATION MEMORY - Personal Touch
# ==========================================

def get_session_memory(ctx_userdata: dict, api_client=None) -> dict:
    """
    Get collected data from current session for personalization.
    Returns dict with name, phone, reason, etc.
    """
    memory = {
        "name": None,
        "first_name": None,
        "phone": None,
        "reason": None,
        "has_medical_history": None
    }

    # Try to get from API client first (most accurate)
    if api_client:
        try:
            collected = api_client.get_collected_data()
            memory["name"] = collected.get("full_name")
            memory["phone"] = collected.get("phone")
            memory["reason"] = collected.get("reason") or collected.get("visit_reason")
            memory["has_medical_history"] = collected.get("has_medical_history")

            # Extract first name
            if memory["name"]:
                memory["first_name"] = memory["name"].split()[0]
        except Exception:
            pass

    # Fallback to userdata
    if not memory["name"]:
        memory["name"] = ctx_userdata.get("collected_name")
        if memory["name"]:
            memory["first_name"] = memory["name"].split()[0]

    if not memory["phone"]:
        memory["phone"] = ctx_userdata.get("collected_phone")

    return memory


def personalize_response(response: str, memory: dict) -> str:
    """
    Add personal touch to response using session memory.
    E.g., "Sure, Sarah..." or adding name to greetings
    """
    first_name = memory.get("first_name")

    # Don't personalize if no name
    if not first_name:
        return response

    # Check if response starts with a greeting word
    has_greeting = any(word in response.lower()[:20] for word in ["okay", "sure", "right", "got it", "i see"])

    if has_greeting and first_name:
        # Insert name after greeting: "Okay" -> "Okay Sarah,"
        import re
        response = re.sub(
            r'^(Okay|Sure|Right|Got it|I see)([.,]?\s*)',
            rf'\1 {first_name}, ',
            response,
            count=1,
            flags=re.IGNORECASE
        )

    return response


def get_personalized_greeting(memory: dict) -> str:
    """Get a personalized follow-up offer using patient's name."""
    first_name = memory.get("first_name")
    if first_name:
        return f"Is there anything else I can help you with, {first_name}?"
    return "Is there anything else I can help you with?"


class Assistant(Agent):
    def __init__(self, intake_schema=None, api_client=None, ctx_proc_userdata=None) -> None:
        # Build dynamic instructions based on intake mode
        base_instructions = (
            "You are a voice AI assistant. Keep responses very short for voice."
            + TONE_PACK
        )

        super().__init__(instructions=base_instructions)
        self.intake_schema = intake_schema
        self.api_client = api_client
        self.ctx_proc_userdata = ctx_proc_userdata
        self.collected_data = {}
        self._session = None  # Will be set after session starts

    @property
    def instructions(self) -> str:
        """
        Dynamic instructions property - LiveKit SDK reads this for each LLM call.
        PART 1 (INTAKE): Greeting -> Name -> Phone -> Purpose (STRICT - no other questions)
        PART 2 (MEDICAL): Medical history -> Document upload -> Document questions
        PART 3 (RAG): Answer ONLY from admin panel knowledge_chunks data
        """
        if not self.ctx_proc_userdata:
            return self._instructions

        current_state = self.ctx_proc_userdata.get("intake_state", "greeting")
        current_mode = self.ctx_proc_userdata.get("intake_mode", "ask")

        # PART 3: RAG MODE - Natural conversation with clinic knowledge
        if current_mode == "rag" or current_state == "rag":
            rag_context = self.ctx_proc_userdata.get("rag_context", "")
            if rag_context:
                logger.info(f"✅ [RAG] Using admin panel knowledge ({len(rag_context)} chars)")
                return f"""You are a friendly dental clinic receptionist. Help the patient with their questions.

=== CLINIC INFORMATION ===
{rag_context}
=== END ===

{RAG_GROUNDING_RULES}
{TONE_PACK}"""
            else:
                return f"""You are a friendly dental clinic receptionist.
Be helpful and conversational. If you don't have specific information, offer to help in other ways.
{TONE_PACK}"""

        # INTAKE MODE - Natural but still collecting info
        elif current_state in ["greeting", "collecting", "medical_history", "waiting_upload", "document_questions", "confirm_info", "ask_correction"]:
            return f"""You are a friendly dental clinic receptionist having a natural conversation.

Your goal is to collect patient information (name, phone) but in a natural way.
- If user asks questions, answer them briefly and then continue with intake
- Be warm and helpful, not robotic
- Keep responses short (2-3 sentences)
- Always respond in English only

{TONE_PACK}"""
        else:
            return self._instructions

    @instructions.setter
    def instructions(self, value: str):
        """Allow setting instructions"""
        self._instructions = value


def build_rag_prompt(user_query: str, context: str) -> str:
    """
    Build a RAG-augmented prompt that reduces hallucination.
    Context contains relevant knowledge chunks from the clinic's KB.
    """
    if not context or not context.strip():
        # No context found - use general prompt
        return user_query

    return f"""You are a helpful dental clinic assistant. Answer the user's question using ONLY the clinic knowledge provided below.

=== CLINIC KNOWLEDGE ===
{context}
=== END OF KNOWLEDGE ===

IMPORTANT RULES:
1. ONLY use information from the clinic knowledge above
2. If the information is not in the knowledge, say "I don't have that information, please ask the receptionist"
3. Keep your answer short, clear, and conversational (2-3 sentences max)
4. Do NOT make up information or guess

User Question: {user_query}

Answer:"""


def prewarm(proc: JobProcess):
    import time

    logger.info("=" * 60)
    logger.info("🔥 [PREWARM] Starting model preloading...")
    logger.info("=" * 60)

    # Load VAD on GPU (force_cpu=False)
    logger.info("🔥 [PREWARM] Loading VAD (Silero) model...")
    vad_start = time.time()
    try:
        proc.userdata["vad"] = silero.VAD.load(force_cpu=False)
        vad_time = time.time() - vad_start
        logger.info(f"✅ [PREWARM] VAD loaded in {vad_time:.2f}s")
    except Exception as e:
        logger.error(f"❌ [PREWARM] VAD loading FAILED: {e}")
        raise

    # NOTE: STT is loaded lazily in entrypoint to avoid timeout
    # The first room join will be slower, but subsequent ones will reuse the model
    logger.info("ℹ️ [PREWARM] STT will be loaded on first room join (lazy loading)")

    logger.info("=" * 60)
    logger.info(f"✅ [PREWARM] Prewarm complete! VAD loaded in {vad_time:.2f}s")
    logger.info("=" * 60)


async def send_status(ctx: JobContext, status: str, message: str = ""):
    """Send agent status to frontend via data channel"""
    import json
    try:
        data = json.dumps({"type": "agent_status", "status": status, "message": message})
        await ctx.room.local_participant.publish_data(data.encode(), reliable=True)
        logger.info(f"📡 [STATUS] Sent: {status} - {message}")
    except Exception as e:
        logger.warning(f"⚠️ [STATUS] Failed to send status: {e}")


async def send_latency_metrics(ctx: JobContext, turn_data):
    """Send latency metrics to frontend via data channel"""
    import json
    try:
        data = json.dumps({
            "type": "latency",
            "stt_ms": turn_data.stt_latency_ms,
            "llm_ms": turn_data.llm_latency_ms,
            "tts_ms": turn_data.tts_latency_ms,
            "total_ms": turn_data.total_latency_ms,
        })
        await ctx.room.local_participant.publish_data(data.encode(), reliable=True)
        logger.debug(f"📊 [LATENCY] Sent metrics: STT={turn_data.stt_latency_ms:.0f}ms, LLM={turn_data.llm_latency_ms:.0f}ms, TTS={turn_data.tts_latency_ms:.0f}ms")
    except Exception as e:
        logger.warning(f"⚠️ [LATENCY] Failed to send metrics: {e}")


async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    # Callback to send latency metrics to frontend
    def on_latency_turn_complete(turn_data):
        """Send latency data to frontend when turn completes"""
        asyncio.create_task(send_latency_metrics(ctx, turn_data))

    # Initialize latency monitor with callback
    latency_monitor = LatencyMonitor(verbose=True, on_turn_complete=on_latency_turn_complete)

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
        ctx.proc.userdata["intake_current_key"] = None  # Will be set after greeting
        ctx.proc.userdata["intake_mode"] = "ask"  # Start in intake mode
        ctx.proc.userdata["intake_state"] = "greeting"  # Start with greeting
        ctx.proc.userdata["intake_next_prompt"] = None

    except Exception as e:
        logger.error(f"❌ [DB] Failed to create session: {e}")
        # Do not crash the voice agent if DB is down.

    # Get Ollama model from environment or use default
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    logger.info(f"Using Ollama model: {ollama_model}")

    # Build session with STT, LLM, TTS
    # Load STT lazily if not preloaded (first room join will be slower)
    import time
    stt_instance = ctx.proc.userdata.get("stt")
    if not stt_instance:
        logger.info("🔊 [STT] Loading STT model (first room join)...")
        stt_start = time.time()
        stt_instance = create_stt()
        stt_time = time.time() - stt_start
        logger.info(f"✅ [STT] STT loaded in {stt_time:.2f}s")
        # Cache for future rooms (if same process handles multiple rooms)
        ctx.proc.userdata["stt"] = stt_instance

    session = AgentSession(
        stt=stt_instance,
        llm=openai.LLM.with_ollama(model=ollama_model),
        tts=create_tts(),  # Edge TTS
        vad=ctx.proc.userdata["vad"],
    )
    logger.info("AgentSession created successfully - auto turn detection enabled")

    # ✅ HOOKS FOR STT + LLM OUTPUT + LATENCY TRACKING

    @session.on("user_started_speaking")
    def _on_user_started_speaking():
        logger.info("🎤 [VAD] User started speaking - voice activity detected")
        latency_monitor.on_user_started_speaking()

    @session.on("user_stopped_speaking")
    def _on_user_stopped_speaking():
        logger.info("🎤 [VAD] User stopped speaking")
        latency_monitor.on_user_stopped_speaking()

    # Note: transcript handler moved after session.start() for proper registration

    async def _say_with_latency_tracking(text: str, session, is_llm_response: bool = False):
        """Helper to track latency when speaking"""
        if is_llm_response:
            # Track as LLM response for latency monitoring
            latency_monitor.on_llm_response_received(text)
        await session.say(text, allow_interruptions=True)

    async def _process_and_speak_intake(user_text, ctx, api_client, intake_schema, session):
        """
        STRICT 3-PART INTAKE FLOW:
        PART 1: Greeting -> Name -> Phone (3 basic questions, NO other questions allowed)
        PART 2: Medical history -> Document upload -> Document questions
        PART 3: RAG mode (admin panel data only)
        """
        try:
            logger.info(f"🔄 [INTAKE] Processing: {user_text[:50]}...")

            current_key = ctx.proc.userdata.get("intake_current_key")
            current_state = ctx.proc.userdata.get("intake_state", "greeting")

            logger.info(f"📍 [STATE] current_state={current_state}, current_key={current_key}")

            # ==========================================
            # PART 1: BASIC INFO (Greeting -> Name -> Phone)
            # ==========================================

            # Step 1: After greeting response -> Ask for NAME
            if current_state == "greeting":
                ctx.proc.userdata["intake_state"] = "collecting"
                ctx.proc.userdata["intake_current_key"] = "full_name"

                # Friendly acknowledgment + question
                name_msg = "Great to hear! This basic information is required to proceed. May I have your full name please?"
                logger.info(f"🎤 [PART1] Asking for name: {name_msg}")
                await _say_with_latency_tracking(name_msg, session, is_llm_response=True)
                return

            # Step 2: After NAME -> Validate and Ask for PHONE
            if current_state == "collecting" and current_key == "full_name":
                name_value = user_text.strip()

                # ✅ REPAIR STRATEGY: Check if STT result is unclear/garbage
                unclear, unclear_reason = is_stt_unclear(name_value, "name")
                repair_attempts = ctx.proc.userdata.get("name_repair_attempts", 0)

                if unclear and repair_attempts < 3:
                    ctx.proc.userdata["name_repair_attempts"] = repair_attempts + 1
                    repair_msg = get_repair_message("name", unclear_reason, repair_attempts + 1)
                    logger.info(f"🔧 [REPAIR] Name unclear ({unclear_reason}), attempt {repair_attempts + 1}/3: {repair_msg}")
                    await _say_with_latency_tracking(repair_msg, session, is_llm_response=True)
                    return

                # Reset repair counter on successful STT
                ctx.proc.userdata["name_repair_attempts"] = 0

                # Track retry attempts
                name_retries = ctx.proc.userdata.get("name_retries", 0)

                # Basic validation first
                is_valid, reason = validate_name_basic(name_value)

                if not is_valid and name_retries < 2:
                    # Try LLM validation for edge cases
                    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
                    llm_valid, llm_reason = await validate_with_llm(name_value, "name", ollama_model)
                    logger.info(f"🔍 [VALIDATION] Name LLM check: {llm_valid}, reason: {llm_reason}")

                    if not llm_valid:
                        ctx.proc.userdata["name_retries"] = name_retries + 1
                        retry_msg = "I didn't catch that properly. Could you please tell me your full name again?"
                        if reason == "only_numbers":
                            retry_msg = "That seems like a number. Please tell me your name."
                        elif reason == "too_short":
                            retry_msg = "Could you please tell me your complete name?"
                        logger.info(f"⚠️ [VALIDATION] Name invalid ({reason}), retry {name_retries + 1}/2")
                        await _say_with_latency_tracking(retry_msg, session, is_llm_response=True)
                        return

                # Valid name or max retries reached - save and proceed
                api_client.save_answer("full_name", name_value)
                logger.info(f"✅ [PART1] Saved full_name: {name_value}")
                ctx.proc.userdata["name_retries"] = 0  # Reset for next field

                ctx.proc.userdata["intake_current_key"] = "phone"

                # Friendly + question
                phone_msg = f"Thank you {name_value}. What is your contact number?"
                logger.info(f"🎤 [PART1] Asking for phone: {phone_msg}")
                await _say_with_latency_tracking(phone_msg, session, is_llm_response=True)
                return

            # Step 3: After PHONE -> Validate and Go to PART 2 (Medical History)
            if current_state == "collecting" and current_key == "phone":
                phone_value = user_text.strip()

                # ✅ REPAIR STRATEGY: Check if STT result is unclear/garbage
                unclear, unclear_reason = is_stt_unclear(phone_value, "phone")
                repair_attempts = ctx.proc.userdata.get("phone_repair_attempts", 0)

                if unclear and repair_attempts < 3:
                    ctx.proc.userdata["phone_repair_attempts"] = repair_attempts + 1
                    repair_msg = get_repair_message("phone", unclear_reason, repair_attempts + 1)
                    logger.info(f"🔧 [REPAIR] Phone unclear ({unclear_reason}), attempt {repair_attempts + 1}/3: {repair_msg}")
                    await _say_with_latency_tracking(repair_msg, session, is_llm_response=True)
                    return

                # Reset repair counter on successful STT
                ctx.proc.userdata["phone_repair_attempts"] = 0

                # Track retry attempts
                phone_retries = ctx.proc.userdata.get("phone_retries", 0)

                # Basic validation first
                is_valid, reason = validate_phone_basic(phone_value)

                if not is_valid and phone_retries < 2:
                    # Try LLM validation (maybe user said "zero three zero zero...")
                    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
                    llm_valid, llm_reason = await validate_with_llm(phone_value, "phone", ollama_model)
                    logger.info(f"🔍 [VALIDATION] Phone LLM check: {llm_valid}, reason: {llm_reason}")

                    if not llm_valid:
                        ctx.proc.userdata["phone_retries"] = phone_retries + 1
                        retry_msg = "I need your complete phone number with all digits. Please say it again slowly."
                        if reason == "too_short":
                            retry_msg = "That phone number seems incomplete. Please tell me your full 10 or 11 digit number."
                        logger.info(f"⚠️ [VALIDATION] Phone invalid ({reason}), retry {phone_retries + 1}/2")
                        await _say_with_latency_tracking(retry_msg, session, is_llm_response=True)
                        return

                # Valid phone or max retries reached - save and proceed
                api_client.save_answer("phone", phone_value)
                logger.info(f"✅ [PART1] Saved phone: {phone_value}")
                ctx.proc.userdata["phone_retries"] = 0  # Reset

                # Store collected data for confirmation
                ctx.proc.userdata["collected_name"] = ctx.proc.userdata.get("temp_name", "")
                ctx.proc.userdata["collected_phone"] = phone_value

                # ✅ CONFIRM STEP - Read back info before proceeding
                ctx.proc.userdata["intake_state"] = "confirm_info"
                ctx.proc.userdata["intake_current_key"] = "confirm_info"

                # Get saved name from API
                try:
                    collected_data = api_client.get_collected_data()
                    saved_name = collected_data.get("full_name", "your name")
                except:
                    saved_name = "your name"

                confirm_msg = f"Let me confirm: Your name is {saved_name} and phone number is {phone_value}. Is that correct? Please say yes or no."
                logger.info(f"🎤 [CONFIRM] Asking confirmation: {confirm_msg}")
                await _say_with_latency_tracking(confirm_msg, session, is_llm_response=True)
                return

            # ==========================================
            # CONFIRM INFO - Human receptionist behavior
            # ==========================================

            if current_state == "confirm_info":
                user_lower = user_text.lower().strip()
                is_confirmed = any(word in user_lower for word in ["yes", "yeah", "yep", "haan", "han", "hai", "correct", "sahi", "theek", "right"])
                is_denied = any(word in user_lower for word in ["no", "nahi", "nope", "wrong", "galat", "incorrect"])

                if is_confirmed:
                    # User confirmed - proceed to medical history
                    logger.info(f"✅ [CONFIRM] User confirmed info - proceeding")
                    ctx.proc.userdata["intake_state"] = "medical_history"
                    ctx.proc.userdata["intake_current_key"] = "medical_history"

                    proceed_msg = "Perfect! Do you have any medical history or previous reports to share? Please say yes or no."
                    logger.info(f"🎤 [PART2] Asking medical history: {proceed_msg}")
                    await _say_with_latency_tracking(proceed_msg, session, is_llm_response=True)
                    return

                elif is_denied:
                    # User says info is wrong - ask what to correct
                    logger.info(f"⚠️ [CONFIRM] User denied - asking what to correct")
                    ctx.proc.userdata["intake_state"] = "ask_correction"
                    ctx.proc.userdata["intake_current_key"] = "ask_correction"

                    correction_msg = "No problem. What would you like to correct - your name or phone number?"
                    logger.info(f"🎤 [CONFIRM] Asking what to correct: {correction_msg}")
                    await _say_with_latency_tracking(correction_msg, session, is_llm_response=True)
                    return

                else:
                    # Unclear response - ask again
                    logger.info(f"⚠️ [CONFIRM] Unclear response - asking again")
                    await session.say("Sorry, I didn't catch that. Is the information correct? Please say yes or no.", allow_interruptions=True)
                    return

            # Handle correction request
            if current_state == "ask_correction":
                user_lower = user_text.lower().strip()
                wants_name = any(word in user_lower for word in ["name", "naam", "my name"])
                wants_phone = any(word in user_lower for word in ["phone", "number", "contact", "fone", "no", "mobile"])
                wants_both = any(word in user_lower for word in ["both", "dono", "sab"])

                if wants_name or wants_both:
                    # Re-collect name
                    logger.info(f"🔄 [CONFIRM] Re-collecting name")
                    ctx.proc.userdata["intake_state"] = "collecting"
                    ctx.proc.userdata["intake_current_key"] = "full_name"
                    ctx.proc.userdata["recollecting"] = "name" if not wants_both else "both"

                    await session.say("Okay, please tell me your correct name.", allow_interruptions=True)
                    return

                elif wants_phone:
                    # Re-collect phone
                    logger.info(f"🔄 [CONFIRM] Re-collecting phone")
                    ctx.proc.userdata["intake_state"] = "collecting"
                    ctx.proc.userdata["intake_current_key"] = "phone"

                    await session.say("Okay, please tell me your correct phone number.", allow_interruptions=True)
                    return

                else:
                    # Unclear - ask again
                    await _say_with_latency_tracking("Please tell me what to correct - say 'name' or 'phone number'.", session, is_llm_response=True)
                    return

            # ==========================================
            # PART 2: MEDICAL HISTORY & DOCUMENT UPLOAD
            # ==========================================

            # Medical history response
            if current_state == "medical_history":
                user_lower = user_text.lower().strip()
                has_history = any(word in user_lower for word in ["yes", "yeah", "yep", "haan", "han", "hai", "hein"])

                api_client.save_answer("has_medical_history", has_history)
                logger.info(f"✅ [PART2] Medical history: {has_history}")

                if has_history:
                    # Has medical history -> Ask for document upload
                    ctx.proc.userdata["intake_state"] = "waiting_upload"
                    ctx.proc.userdata["intake_current_key"] = "waiting_upload"

                    upload_msg = intake_schema.get("upload_prompt", {}).get("prompt_en",
                        "Please upload your medical document using the upload button on your screen. I'll wait for you.")
                    logger.info(f"🎤 [PART2] Asking for upload: {upload_msg}")
                    await _say_with_latency_tracking(upload_msg, session, is_llm_response=True)
                else:
                    # No medical history -> Go to PART 3 (RAG mode)
                    ctx.proc.userdata["intake_state"] = "rag"
                    ctx.proc.userdata["intake_mode"] = "rag"
                    ctx.proc.userdata["intake_current_key"] = None

                    # Load RAG context from admin panel
                    try:
                        kb_result = api_client.query_knowledge("clinic services", top_k=10)
                        ctx.proc.userdata["rag_context"] = kb_result.get("context", "")
                        logger.info(f"✅ [RAG] Loaded {kb_result.get('count', 0)} knowledge chunks")
                    except Exception as e:
                        logger.error(f"❌ [RAG] Failed to load knowledge: {e}")
                        ctx.proc.userdata["rag_context"] = ""

                    no_history_msg = intake_schema.get("no_medical_history_response", {}).get("prompt_en", "Okay, no problem.")
                    rag_msg = intake_schema.get("rag_mode_prompt", {}).get("prompt_en",
                        "Thank you! Your information has been saved. Now you can ask me any questions about our clinic services.")
                    logger.info(f"✅ [PART2->PART3] No medical history - switching to RAG mode")
                    await _say_with_latency_tracking(f"{no_history_msg} {rag_msg}", session, is_llm_response=True)
                return

            # Waiting for document upload - user says something after upload
            if current_state == "waiting_upload":
                user_lower = user_text.lower().strip()

                # Check if user says they don't have document or want to skip
                skip_words = ["no", "nahi", "nope", "skip", "don't have", "nothing", "later", "baad mein", "koi nahi"]
                if any(word in user_lower for word in skip_words):
                    # User doesn't want to upload - go to Part 3
                    logger.info(f"🎤 [PART2] User skipped document upload - moving to RAG mode")
                    ctx.proc.userdata["intake_state"] = "rag"
                    ctx.proc.userdata["intake_mode"] = "rag"
                    ctx.proc.userdata["intake_current_key"] = None

                    # Load RAG context
                    try:
                        kb_result = api_client.query_knowledge("clinic services", top_k=10)
                        ctx.proc.userdata["rag_context"] = kb_result.get("context", "")
                        logger.info(f"✅ [RAG] Loaded {kb_result.get('count', 0)} knowledge chunks")
                    except Exception as e:
                        logger.error(f"❌ [RAG] Failed to load knowledge: {e}")
                        ctx.proc.userdata["rag_context"] = ""

                    skip_msg = "No problem! Your information has been saved. Now you can ask me any questions about our clinic services."
                    await _say_with_latency_tracking(skip_msg, session, is_llm_response=True)
                    return

                # Check if user uploaded and confirmed
                confirm_words = ["done", "uploaded", "ready", "yes", "okay", "ok", "ho gaya", "kar diya", "upload"]
                if any(word in user_lower for word in confirm_words):
                    # Start document questions
                    ctx.proc.userdata["intake_state"] = "document_questions"
                    ctx.proc.userdata["intake_current_key"] = "document_type"

                    doc_type_msg = "Thank you for uploading. Is this document an X-ray, a lab report, or a medical prescription?"
                    logger.info(f"🎤 [PART2] Asking document type: {doc_type_msg}")
                    await _say_with_latency_tracking(doc_type_msg, session, is_llm_response=True)
                else:
                    # Remind user
                    await _say_with_latency_tracking("Please upload your document and say 'done' when ready. Or say 'skip' if you don't have any.", session, is_llm_response=True)
                return

            # Document questions flow
            if current_state == "document_questions":
                if current_key == "document_type":
                    api_client.save_answer("document_type", user_text.strip())
                    ctx.proc.userdata["intake_current_key"] = "document_date"

                    date_msg = "When was this document created? You can give an approximate date."
                    logger.info(f"🎤 [PART2] Asking document date: {date_msg}")
                    await _say_with_latency_tracking(date_msg, session, is_llm_response=True)
                    return

                elif current_key == "document_date":
                    api_client.save_answer("document_date", user_text.strip())
                    ctx.proc.userdata["intake_current_key"] = "document_findings"

                    findings_msg = "In a few words, what did the doctor say about this document or what were the findings?"
                    logger.info(f"🎤 [PART2] Asking document findings: {findings_msg}")
                    await _say_with_latency_tracking(findings_msg, session, is_llm_response=True)
                    return

                elif current_key == "document_findings":
                    api_client.save_answer("document_findings", user_text.strip())

                    # Document questions complete -> Go to PART 3 (RAG mode)
                    ctx.proc.userdata["intake_state"] = "rag"
                    ctx.proc.userdata["intake_mode"] = "rag"
                    ctx.proc.userdata["intake_current_key"] = None

                    # Load RAG context from admin panel
                    try:
                        kb_result = api_client.query_knowledge("clinic services", top_k=10)
                        ctx.proc.userdata["rag_context"] = kb_result.get("context", "")
                        logger.info(f"✅ [RAG] Loaded {kb_result.get('count', 0)} knowledge chunks")
                    except Exception as e:
                        logger.error(f"❌ [RAG] Failed to load knowledge: {e}")
                        ctx.proc.userdata["rag_context"] = ""

                    rag_msg = intake_schema.get("rag_mode_prompt", {}).get("prompt_en",
                        "Thank you! Your information has been saved. Now you can ask me any questions about our clinic services.")
                    logger.info(f"✅ [PART2->PART3] Document questions complete - switching to RAG mode")
                    await _say_with_latency_tracking(rag_msg, session, is_llm_response=True)
                    return

            # ==========================================
            # FALLBACK: Unknown state - redirect to current flow
            # ==========================================
            logger.warning(f"⚠️ [INTAKE] Unknown state/key combination: state={current_state}, key={current_key}")

        except Exception as e:
            logger.error(f"❌ [INTAKE] Error: {e}")
            import traceback
            logger.error(traceback.format_exc())

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

    async def create_followup_on_call_end():
        """Auto-create follow-up entry when call ends (for CRM dashboard)"""
        try:
            session_id = ctx.proc.userdata.get("db_session_id")
            if not session_id:
                logger.warning("⚠️ [CRM] No session_id found, skipping follow-up creation")
                return

            # Get collected data from the session
            collected_data = api_client.get_collected_data()
            user_name = collected_data.get("full_name", "Unknown")
            user_phone = collected_data.get("phone", "")

            # Only create follow-up if we have contact info
            if not user_phone:
                logger.info("ℹ️ [CRM] No phone number collected, skipping follow-up creation")
                return

            # Create follow-up via API
            import httpx
            fastapi_url = os.getenv("FASTAPI_URL", "http://localhost:8000")

            followup_data = {
                "session_id": str(session_id),
                "user_name": user_name,
                "user_phone": user_phone,
                "reason": "Auto-created after call",
                "notes": f"Call ended. Review transcript for details."
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{fastapi_url}/api/crm/follow-ups",
                    json=followup_data,
                    timeout=10.0
                )
                if response.status_code == 200:
                    logger.info(f"✅ [CRM] Auto-created follow-up for {user_name} ({user_phone})")
                else:
                    logger.error(f"❌ [CRM] Failed to create follow-up: {response.text}")

        except Exception as e:
            logger.error(f"❌ [CRM] Error creating follow-up: {e}")

    ctx.add_shutdown_callback(log_usage)
    ctx.add_shutdown_callback(create_followup_on_call_end)

    logger.info("🔌 Attempting to connect to room...")
    try:
        await ctx.connect(auto_subscribe=True)
        logger.info("✅ Successfully connected to room!")

        # Add event handlers AFTER connecting (ctx.room is now available)
        @ctx.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            logger.info(f"✅ [EVENT] Participant joined: {participant.identity}")
            for track_pub in participant.track_publications.values():
                if track_pub.kind == rtc.TrackKind.KIND_AUDIO:
                    track_pub.set_subscribed(True)
                    logger.info(f"✅ [EVENT] Subscribed to audio track: {track_pub.sid}")

        @ctx.room.on("track_published")
        def on_track_published(
            publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant
        ):
            logger.info(f"✅ [EVENT] Track published by {participant.identity}: {publication.sid}")
            if publication.kind == rtc.TrackKind.KIND_AUDIO:
                publication.set_subscribed(True)
                logger.info("✅ [EVENT] Subscribed to newly published audio track")

        @ctx.room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ):
            logger.info(f"✅ [EVENT] Track subscribed: {track.sid} from {participant.identity}")
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info("✅ [EVENT] Audio track ready for processing")

        logger.info("✅ [EVENT] Room event handlers registered")

        # Debug: List current participants
        logger.info(f"📋 [DEBUG] Room participants after connect:")
        for p_id, p in ctx.room.remote_participants.items():
            logger.info(f"   - Participant: {p.identity} (sid: {p_id})")
            for t_sid, t_pub in p.track_publications.items():
                logger.info(f"     - Track: {t_pub.kind}, subscribed: {t_pub.subscribed}, sid: {t_sid}")

        # ✅ Explicitly subscribe to ALL existing audio tracks
        has_audio_participant = False
        for p in ctx.room.remote_participants.values():
            for pub in p.track_publications.values():
                if pub.kind == rtc.TrackKind.KIND_AUDIO:
                    has_audio_participant = True
                    logger.info(f"✅ [AUDIO] Found audio track from {p.identity}")
                    # Force subscribe to the audio track
                    if not pub.subscribed:
                        logger.info(f"🔊 [AUDIO] Subscribing to audio track: {pub.sid}")
                        pub.set_subscribed(True)
                    else:
                        logger.info(f"✅ [AUDIO] Track already subscribed: {pub.sid}")
                    break
            if has_audio_participant:
                break

        if not has_audio_participant:
            logger.info("⏳ [WAIT] No audio track found, waiting for user to publish audio...")
            audio_track_event = asyncio.Event()

            def _on_track_published(publication, participant):
                logger.info(f"✅ [WAIT] Track published: {publication.kind} from {participant.identity}")
                if publication.kind == rtc.TrackKind.KIND_AUDIO:
                    audio_track_event.set()

            def _on_participant_join(participant):
                logger.info(f"✅ [WAIT] Participant joined: {participant.identity}")
                # Check if they already have audio
                for pub in participant.track_publications.values():
                    if pub.kind == rtc.TrackKind.KIND_AUDIO:
                        audio_track_event.set()
                        return

            ctx.room.on("track_published", _on_track_published)
            ctx.room.on("participant_connected", _on_participant_join)

            try:
                await asyncio.wait_for(audio_track_event.wait(), timeout=30.0)
                logger.info("✅ [WAIT] Audio track available, proceeding...")
                # Small delay to ensure track is fully set up
                await asyncio.sleep(0.5)
            except asyncio.TimeoutError:
                logger.warning("⚠️ [WAIT] Timeout waiting for audio track, proceeding anyway...")

        # Send loading status to frontend
        await send_status(ctx, "loading", "Loading AI models...")
    except Exception as e:
        logger.error(f"❌ Failed to connect to room: {e}")
        raise

    # ✅ Track if we're handling intake (to skip LLM)
    ctx.proc.userdata["intake_handled"] = False

    # Find the first remote participant to link to
    target_participant_identity = None
    for p in ctx.room.remote_participants.values():
        target_participant_identity = p.identity
        logger.info(f"🎯 [LINK] Found participant to link: {p.identity}")
        break

    logger.info("🚀 Starting agent session...")

    # Configure room input with participant identity
    room_input_opts = RoomInputOptions(
        participant_identity=target_participant_identity,
    ) if target_participant_identity else RoomInputOptions()

    logger.info(f"📡 [ROOM_INPUT] Configured with participant_identity: {target_participant_identity}")

    # Start session with room_input_options to properly link participant
    await session.start(
        agent=Assistant(
            intake_schema=intake_schema,
            api_client=api_client,
            ctx_proc_userdata=ctx.proc.userdata
        ),
        room=ctx.room,
        room_input_options=room_input_opts,
    )
    logger.info("✅ Agent session started!")
    # Send ready status to frontend
    await send_status(ctx, "ready", "Agent ready!")

    # ✅ RAG mode handler - uses LLM with admin panel knowledge
    async def _handle_rag_query(user_query, ctx, api_client, session):
        """Handle user query in RAG mode using admin panel knowledge"""
        try:
            logger.info(f"🔄 [RAG] Processing query: {user_query[:50]}...")

            # Always try to query knowledge base with user's specific query
            rag_context = ""
            try:
                kb_result = api_client.query_knowledge(user_query, top_k=5)
                rag_context = kb_result.get("context", "")
                logger.info(f"✅ [RAG] Found {kb_result.get('count', 0)} relevant chunks")
            except Exception as e:
                logger.error(f"❌ [RAG] Failed to query knowledge: {e}")

            # If no specific match, try loading general clinic info
            if not rag_context:
                try:
                    kb_result = api_client.query_knowledge("clinic services appointments", top_k=10)
                    rag_context = kb_result.get("context", "")
                    logger.info(f"✅ [RAG] Loaded {kb_result.get('count', 0)} general chunks")
                except Exception as e:
                    logger.error(f"❌ [RAG] Failed to load general knowledge: {e}")

            # Build prompt with RAG context - GROUNDED + CONCISE
            if rag_context:
                system_prompt = f"""You are a friendly dental clinic voice assistant. Answer ONLY from the clinic information below.

=== CLINIC INFORMATION (ONLY USE THIS) ===
{rag_context}
=== END ===

{RAG_GROUNDING_RULES}
{TONE_PACK}
{STRUCTURED_OUTPUT_PROMPT}"""
            else:
                # No knowledge base data - be helpful in English
                system_prompt = f"""You are a friendly dental clinic receptionist.

Be helpful and conversational:
1. If you don't have specific info, say: "I'll check on that for you" or "Let me find out"
2. For appointments: "I'd be happy to help schedule an appointment. What day works for you?"
3. For prices/services: "I can help you with that. Would you like to schedule a consultation?"
4. End with: "Is there anything else I can help with?"
5. Keep responses to 2-3 sentences max
6. ENGLISH ONLY - always respond in clear English
{TONE_PACK}
{STRUCTURED_OUTPUT_PROMPT}"""

            # Call LLM
            import ollama
            ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

            response = ollama.chat(
                model=ollama_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query},
                ],
            )

            raw_reply = response["message"]["content"]
            logger.info(f"🔄 [RAG] Raw LLM output: {raw_reply[:150]}...")

            # Parse structured response
            structured = parse_structured_response(raw_reply)
            reply = structured["say"]
            action = structured["action"]

            logger.info(f"✅ [RAG] Structured: action={action}, say={reply[:80]}...")

            # ✅ CLAMP RESPONSE - Max 3 sentences for voice
            reply = clamp_rag_response(reply, max_sentences=3)

            # Handle different actions
            if action == "unclear":
                reply = "Sorry, I didn't catch that. Could you please repeat?"
            elif action == "schedule":
                # User wants to schedule - note this for follow-up
                logger.info(f"📅 [RAG] User wants to schedule something")
                # Could trigger CRM follow-up here in future

            # ✅ CONVERSATION MEMORY - Get session data for personalization
            memory = get_session_memory(ctx.proc.userdata, api_client)
            logger.info(f"🧠 [MEMORY] Session data: name={memory.get('first_name')}, reason={memory.get('reason')}")

            # ✅ Personalize response with patient's name
            reply = personalize_response(reply, memory)

            # ✅ Add follow-up offer if not already present
            follow_up_phrases = ["anything else", "help you", "assist", "?"]
            has_followup = any(phrase in reply.lower() for phrase in follow_up_phrases)
            if not has_followup and action not in ["unclear", "schedule"]:
                personalized_followup = get_personalized_greeting(memory)
                reply = reply.rstrip('.!') + ". " + personalized_followup

            # Save to transcript
            try:
                api_client.append_transcript(f"AGENT: {reply}")
            except Exception as e:
                logger.error(f"❌ [DB] Failed to save agent reply: {e}")

            # ✅ BACKCHANNELING - Add "Ji" or "Theek hai" before long responses
            turn_number = ctx.proc.userdata.get("rag_turn_count", 0)
            ctx.proc.userdata["rag_turn_count"] = turn_number + 1

            if should_backchannel(user_query, turn_number):
                backchannel = get_backchannel()
                # ✅ Personalize backchannel with name (e.g., "Ji Faryal,")
                first_name = memory.get("first_name")
                if first_name and random.random() < 0.5:  # 50% chance to add name
                    backchannel = backchannel.rstrip('.') + f" {first_name}."
                mark_backchannel_used(turn_number)
                logger.info(f"🗣️ [BACKCHANNEL] Adding: {backchannel}")
                await _say_with_latency_tracking(backchannel, session, is_llm_response=True)
                await asyncio.sleep(0.3)  # Small pause after backchannel

            # Speak the response
            await _say_with_latency_tracking(reply, session, is_llm_response=True)

        except Exception as e:
            logger.error(f"❌ [RAG] Error: {e}")
            await session.say("Sorry, I had trouble processing that. Could you please repeat?", allow_interruptions=True)

    # ✅ Register transcript handler AFTER session starts
    @session.on("user_input_transcribed")
    def _on_user_transcript(ev):
        logger.info(f"🎯 [EVENT] user_input_transcribed: '{ev.transcript}', is_final={ev.is_final}")
        if ev.is_final and ev.transcript.strip():
            transcript_text = ev.transcript.strip()
            logger.info(f"✅ [STT] Final Transcript: {transcript_text}")

            # Track STT completion for latency
            latency_monitor.on_transcript_received(transcript_text)

            # Save to DB
            try:
                api_client.append_transcript(f"USER: {transcript_text}")
            except Exception as e:
                logger.error(f"❌ [DB] Failed to append transcript: {e}")

            # Check current mode
            current_mode = ctx.proc.userdata.get("intake_mode", "ask")
            current_state = ctx.proc.userdata.get("intake_state", "greeting")

            # INTAKE MODE: Manual flow control
            if current_state in ["greeting", "collecting", "medical_history", "waiting_upload", "document_questions"]:
                logger.info(f"🎯 [INTAKE] Handling intake flow")
                asyncio.create_task(_process_and_speak_intake(transcript_text, ctx, api_client, intake_schema, session))

            # RAG MODE: Use LLM with admin panel knowledge
            elif current_mode == "rag" or current_state == "rag":
                logger.info(f"🎯 [RAG] Handling RAG query")
                asyncio.create_task(_handle_rag_query(transcript_text, ctx, api_client, session))

    logger.info("✅ Transcript handler registered")

    # ✅ GREETING: Agent speaks first when session starts
    greeting_message = intake_schema.get("greeting", {}).get("prompt_en", "Hello! Welcome to our clinic. How are you doing today?")
    logger.info(f"🎤 [GREETING] Saying: {greeting_message}")
    await _say_with_latency_tracking(greeting_message, session, is_llm_response=True)

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
    """Process chat message through LLM with RAG-augmented context"""
    logger.info(f"🔄 [CHAT] Starting to process message: {message}")

    try:
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
        logger.info(f"💬 [CHAT] Processing with model: {ollama_model}")

        import ollama
        logger.info("📦 [CHAT] Ollama imported successfully")

        # ✅ RAG: Query knowledge base for relevant context
        context = ""
        try:
            kb_result = api_client.query_knowledge(message, top_k=3)
            context = kb_result.get("context", "")
            if context:
                logger.info(f"✅ [RAG] Found {kb_result.get('count', 0)} relevant chunks")
            else:
                logger.info("⚠️ [RAG] No relevant knowledge found")
        except Exception as e:
            logger.error(f"❌ [RAG] Failed to query knowledge base: {e}")

        # ✅ Build RAG-augmented prompt (reduces hallucination)
        if context:
            user_prompt = build_rag_prompt(message, context)
            system_prompt = "You are a dental clinic assistant. Answer based ONLY on the provided clinic knowledge."
        else:
            user_prompt = message
            system_prompt = "You are a helpful dental clinic assistant. Keep responses clear and concise."

        response = ollama.chat(
            model=ollama_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
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
    # Enable verbose logging for debugging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Set specific loggers
    logging.getLogger("agent").setLevel(logging.DEBUG)
    logging.getLogger("stt_whisper").setLevel(logging.DEBUG)
    logging.getLogger("livekit.agents").setLevel(logging.INFO)
    logging.getLogger("livekit").setLevel(logging.INFO)

    logger.info("🚀 [STARTUP] Agent starting with verbose logging enabled...")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
