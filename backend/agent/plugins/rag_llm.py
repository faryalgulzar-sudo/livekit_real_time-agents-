"""
RAG-Augmented LLM Plugin for LiveKit Voice Agent
-------------------------------------------------
This wraps the Ollama LLM and injects knowledge base context
before each query to reduce hallucination.
"""

import logging
from typing import Optional, Dict, Any
from livekit.plugins import openai

logger = logging.getLogger("rag_llm")


class RAGAugmentedLLM:
    """
    Wrapper around Ollama LLM that injects RAG context into prompts.
    Used when agent is in RAG mode (after intake complete).
    """

    def __init__(self, api_client, model: str = "qwen2.5:3b"):
        self.api_client = api_client
        self.model = model
        self._base_llm = openai.LLM.with_ollama(model=model)

    def query_with_rag(self, user_query: str) -> str:
        """
        Query LLM with RAG-augmented context.
        1. Search knowledge base for relevant chunks
        2. Inject context into system prompt
        3. Get response from LLM
        """
        import ollama

        # Step 1: Query knowledge base
        context = ""
        try:
            kb_result = self.api_client.query_knowledge(user_query, top_k=3)
            context = kb_result.get("context", "")
            if context:
                logger.info(f"✅ [RAG] Found {kb_result.get('count', 0)} relevant chunks")
            else:
                logger.info("⚠️ [RAG] No relevant knowledge found")
        except Exception as e:
            logger.error(f"❌ [RAG] Failed to query KB: {e}")

        # Step 2: Build prompt with context
        if context:
            system_prompt = f"""You are a helpful dental clinic voice assistant.

=== CLINIC KNOWLEDGE ===
{context}
=== END OF KNOWLEDGE ===

IMPORTANT RULES:
1. Answer ONLY using the clinic knowledge above
2. If info not found, say "I don't have that information, please ask the receptionist"
3. Keep responses short (2-3 sentences), clear, conversational
4. Do NOT make up information or guess prices/timings
5. No emojis - this is voice output"""
        else:
            system_prompt = """You are a helpful dental clinic voice assistant.
Keep responses short, clear, and friendly. No emojis.
If you don't know clinic information, say "I don't have that information, please ask the receptionist"."""

        # Step 3: Call Ollama
        try:
            response = ollama.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query},
                ],
            )
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"❌ [RAG] LLM call failed: {e}")
            return "Sorry, I'm having trouble right now. Please try again."

    @property
    def base_llm(self):
        """Return base LLM for AgentSession (intake mode)"""
        return self._base_llm


def build_rag_system_prompt(context: str) -> str:
    """Build system prompt with RAG context for voice agent"""
    if not context or not context.strip():
        return """You are a helpful dental clinic voice assistant.
Keep responses short, clear, and friendly. No emojis.
If you don't know clinic information, say "I don't have that information, please ask the receptionist"."""

    return f"""You are a helpful dental clinic voice assistant.

=== CLINIC KNOWLEDGE ===
{context}
=== END OF KNOWLEDGE ===

IMPORTANT RULES:
1. Answer ONLY using the clinic knowledge above
2. If info not found, say "I don't have that information, please ask the receptionist"
3. Keep responses short (2-3 sentences), clear, conversational
4. Do NOT make up information or guess prices/timings
5. No emojis - this is voice output"""
