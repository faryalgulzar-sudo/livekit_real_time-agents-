"""
Latency Monitor for Voice Agent
Tracks STT, LLM, and TTS latency in real-time conversations
"""

import time
from typing import Optional, Dict, List
from dataclasses import dataclass, field


@dataclass
class ConversationTurn:
    """Single conversation turn with timing data"""
    turn_number: int
    user_started_at: Optional[float] = None
    user_stopped_at: Optional[float] = None
    stt_completed_at: Optional[float] = None
    llm_completed_at: Optional[float] = None
    tts_started_at: Optional[float] = None
    tts_completed_at: Optional[float] = None
    user_text: str = ""
    agent_text: str = ""

    @property
    def stt_latency_ms(self) -> Optional[float]:
        """Time from user stopped speaking to STT completion"""
        if self.user_stopped_at and self.stt_completed_at:
            return (self.stt_completed_at - self.user_stopped_at) * 1000
        return None

    @property
    def llm_latency_ms(self) -> Optional[float]:
        """Time from STT completion to LLM response"""
        if self.stt_completed_at and self.llm_completed_at:
            return (self.llm_completed_at - self.stt_completed_at) * 1000
        return None

    @property
    def tts_latency_ms(self) -> Optional[float]:
        """Time from LLM completion to TTS completion"""
        if self.llm_completed_at and self.tts_completed_at:
            return (self.tts_completed_at - self.llm_completed_at) * 1000
        return None

    @property
    def total_latency_ms(self) -> Optional[float]:
        """Total time from user stopped speaking to TTS completion"""
        if self.user_stopped_at and self.tts_completed_at:
            return (self.tts_completed_at - self.user_stopped_at) * 1000
        return None

    @property
    def user_speaking_duration_ms(self) -> Optional[float]:
        """How long user spoke"""
        if self.user_started_at and self.user_stopped_at:
            return (self.user_stopped_at - self.user_started_at) * 1000
        return None


class LatencyMonitor:
    """Monitor and track latency for voice agent conversations"""

    def __init__(self, verbose: bool = True, on_turn_complete=None):
        self.verbose = verbose
        self.turns: List[ConversationTurn] = []
        self.current_turn: Optional[ConversationTurn] = None
        self.turn_counter = 0
        self.on_turn_complete = on_turn_complete  # Callback for when turn completes

    def _start_new_turn(self):
        """Start a new conversation turn"""
        self.turn_counter += 1
        self.current_turn = ConversationTurn(turn_number=self.turn_counter)
        if self.verbose:
            print(f"\n{'='*70}")
            print(f"🎙️  Turn #{self.turn_counter} Started")
            print(f"{'='*70}")

    def on_user_started_speaking(self):
        """User started speaking"""
        if self.current_turn is None:
            self._start_new_turn()
        self.current_turn.user_started_at = time.time()
        if self.verbose:
            print(f"👤 User started speaking...")

    def on_user_stopped_speaking(self):
        """User stopped speaking"""
        if self.current_turn:
            self.current_turn.user_stopped_at = time.time()
            if self.verbose and self.current_turn.user_speaking_duration_ms:
                print(f"🛑 User stopped speaking (spoke for {self.current_turn.user_speaking_duration_ms:.0f}ms)")

    def on_transcript_received(self, text: str):
        """STT completed"""
        if self.current_turn is None:
            self._start_new_turn()

        self.current_turn.stt_completed_at = time.time()
        self.current_turn.user_text = text

        if self.verbose:
            latency = self.current_turn.stt_latency_ms or 0
            print(f"📝 [STT] '{text}' | Latency: {latency:.0f}ms")

    def on_llm_response_received(self, text: str):
        """LLM response received"""
        if self.current_turn:
            self.current_turn.llm_completed_at = time.time()
            self.current_turn.agent_text = text

            if self.verbose:
                latency = self.current_turn.llm_latency_ms or 0
                print(f"🤖 [LLM] '{text[:80]}...' | Latency: {latency:.0f}ms")

    def on_tts_started(self):
        """TTS synthesis started"""
        if self.current_turn:
            self.current_turn.tts_started_at = time.time()

    def on_tts_completed(self):
        """TTS completed - end of turn"""
        if self.current_turn:
            self.current_turn.tts_completed_at = time.time()

            if self.verbose:
                tts_lat = self.current_turn.tts_latency_ms or 0
                total_lat = self.current_turn.total_latency_ms or 0
                print(f"🔊 [TTS] Audio generated | Latency: {tts_lat:.0f}ms")
                print(f"⏱️  **TOTAL RESPONSE TIME: {total_lat:.0f}ms**")

                # Breakdown
                stt = self.current_turn.stt_latency_ms or 0
                llm = self.current_turn.llm_latency_ms or 0
                tts = self.current_turn.tts_latency_ms or 0
                print(f"   ├─ STT: {stt:.0f}ms ({stt/total_lat*100:.1f}%)")
                print(f"   ├─ LLM: {llm:.0f}ms ({llm/total_lat*100:.1f}%)")
                print(f"   └─ TTS: {tts:.0f}ms ({tts/total_lat*100:.1f}%)")

            # Save completed turn
            completed_turn = self.current_turn
            self.turns.append(completed_turn)
            self.current_turn = None

            # Call callback with turn data
            if self.on_turn_complete and completed_turn:
                try:
                    self.on_turn_complete(completed_turn)
                except Exception as e:
                    print(f"⚠️ [LATENCY] Callback error: {e}")

    def on_agent_started_speaking(self):
        """Agent started speaking (audio playback)"""
        if self.verbose:
            print(f"🔊 Agent started speaking...")

    def on_agent_stopped_speaking(self):
        """Agent stopped speaking (audio playback complete)"""
        if self.verbose:
            print(f"✅ Agent finished speaking")

    def get_statistics(self) -> Dict:
        """Get summary statistics"""
        if not self.turns:
            return {
                "total_turns": 0,
                "avg_total_latency_ms": 0,
                "avg_stt_latency_ms": 0,
                "avg_llm_latency_ms": 0,
                "avg_tts_latency_ms": 0,
            }

        stt_latencies = [t.stt_latency_ms for t in self.turns if t.stt_latency_ms]
        llm_latencies = [t.llm_latency_ms for t in self.turns if t.llm_latency_ms]
        tts_latencies = [t.tts_latency_ms for t in self.turns if t.tts_latency_ms]
        total_latencies = [t.total_latency_ms for t in self.turns if t.total_latency_ms]

        return {
            "total_turns": len(self.turns),
            "avg_total_latency_ms": sum(total_latencies) / len(total_latencies) if total_latencies else 0,
            "avg_stt_latency_ms": sum(stt_latencies) / len(stt_latencies) if stt_latencies else 0,
            "avg_llm_latency_ms": sum(llm_latencies) / len(llm_latencies) if llm_latencies else 0,
            "avg_tts_latency_ms": sum(tts_latencies) / len(tts_latencies) if tts_latencies else 0,
            "min_total_latency_ms": min(total_latencies) if total_latencies else 0,
            "max_total_latency_ms": max(total_latencies) if total_latencies else 0,
        }

    def print_summary(self):
        """Print summary of all turns"""
        stats = self.get_statistics()

        print(f"\n{'='*70}")
        print(f"📊 LATENCY SUMMARY ({stats['total_turns']} turns)")
        print(f"{'='*70}")

        if stats['total_turns'] > 0:
            print(f"Average Total Response Time: {stats['avg_total_latency_ms']:.0f}ms")
            print(f"  ├─ STT Average: {stats['avg_stt_latency_ms']:.0f}ms")
            print(f"  ├─ LLM Average: {stats['avg_llm_latency_ms']:.0f}ms")
            print(f"  └─ TTS Average: {stats['avg_tts_latency_ms']:.0f}ms")
            print(f"\nFastest Response: {stats['min_total_latency_ms']:.0f}ms")
            print(f"Slowest Response: {stats['max_total_latency_ms']:.0f}ms")
        else:
            print("No completed turns to analyze")

        print(f"{'='*70}\n")
