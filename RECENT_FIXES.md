# Recent Fixes - January 14, 2026

## Issue #1: No Greeting ✅ FIXED

**Problem**: Agent not sending initial greeting when user connects

**Solution**: Added explicit greeting message after agent session starts

**Changes**: 
- [backend/agent/agent.py:293-302](backend/agent/agent.py#L293-L302) - Added `session.say()` with greeting

**Test**: 
```bash
# Connect to https://agent007.drap.ai
# You should hear: "Hello! Welcome to our dental clinic. I'm your AI assistant..."
```

---

## Issue #2: SOURCE_UNKNOWN Audio Rejection ⚙️ IN PROGRESS

**Problem**: Agent rejecting microphone audio with error:
```
"SOURCE_UNKNOWN", "accepted_sources": ["SOURCE_MICROPHONE"]
```

**Root Cause**: LiveKit Agents SDK 1.3.10 only accepts audio from `SOURCE_MICROPHONE` but browser is publishing as `SOURCE_UNKNOWN`

**Solution Implemented**:
1. **Monkey patch** - Modified agent to accept SOURCE_UNKNOWN audio sources
2. **Frontend logging** - Added debug logs to see what source browser is using

**Changes**:
- [backend/agent/agent.py:22-37](backend/agent/agent.py#L22-L37) - Added RoomInput patch to accept SOURCE_UNKNOWN
- [frontend/hooks/useLiveKit.ts:317-327](frontend/hooks/useLiveKit.ts#L317-L327) - Added source logging

**Test**:
```bash
# Watch agent logs while connecting:
docker logs agent786-agent -f

# Connect from browser, click microphone, say something
# Should see:
# - "Patched RoomInput to accept sources: {...}"
# - "✅ [STT] Transcript: <your speech>"
```

---

## Issue #3: TTS Delay (Zonos too heavy?) ⚙️ INVESTIGATING

**Current Setup**:
- **Primary TTS**: Zonos-v0.1-hybrid (GPU-accelerated)
- **Fallback**: Edge TTS (cloud)
- **Final**: Flite (local)

**Performance**:
- **First synthesis**: ~2-3 seconds (model loading)
- **Subsequent**: ~300-500ms per synthesis
- **Model size**: ~1.2GB (cached in Docker volume)
- **GPU memory**: ~1-2GB VRAM

**Options to Speed Up**:

### Option A: Switch to Edge TTS as Primary (Recommended for Speed)
```yaml
# Edit docker-compose.yml, change environment:
PRIMARY_TTS: edge  # Instead of zonos
```
- **Pros**: Very fast (~100-200ms), no GPU needed, good quality
- **Cons**: Requires internet, Microsoft cloud dependency

### Option B: Use Smaller Zonos Model
```yaml
ZONOS_MODEL: Zyphra/Zonos-v0.1-transformer  # Instead of hybrid
```
- **Pros**: Faster than hybrid, still GPU-accelerated, good quality
- **Cons**: Still ~500MB model, still requires GPU

### Option C: Edge for Greeting, Zonos for Conversation
- Keep current setup
- Modify greeting to use Edge TTS (fast)
- Use Zonos for conversation (better quality, warm model)

**Current Status**: Waiting for user preference

---

## Issue #4: No Audio Level Indicator / Frontend Not Showing Agent

**Status**: Likely related to SOURCE_UNKNOWN issue - once microphone audio is accepted, this should work

**What Frontend Shows**:
- ✅ Connection status (green/yellow/red dot)
- ✅ User ID
- ✅ Speaking status
- ✅ Audio level meter (but only works if audio is flowing)
- ✅ Transcripts panel

**What Frontend Does NOT Show**:
- ❌ Separate "agent status" field (by design - not implemented)
- ❌ Agent latency metrics (logged backend only)

**To See Latency**:
```bash
docker logs agent786-agent 2>&1 | grep -i latency
```

At end of session:
```
=== Latency Summary ===
Total turns: X
Average STT: Xms
Average LLM: Xms
Average TTS: Xms
```

---

## Next Steps

1. **Test microphone audio fix**:
   - Restart agent: `docker compose restart agent`
   - Connect from browser
   - Click microphone button
   - Speak and check if agent responds

2. **Choose TTS speed optimization**:
   - Keep Zonos (current) - Good quality, ~500ms delay
   - Switch to Edge TTS - Fastest, ~100ms delay
   - Hybrid approach - Fast greeting + quality conversation

3. **Monitor and tune**:
   - Check GPU usage: `docker exec agent786-agent nvidia-smi`
   - Check latency: `docker logs agent786-agent | grep latency`
   - Adjust based on quality vs speed preference

---

## Files Modified

1. [backend/agent/agent.py](backend/agent/agent.py)
   - Lines 22-37: SOURCE_UNKNOWN patch
   - Lines 293-302: Initial greeting

2. [frontend/hooks/useLiveKit.ts](frontend/hooks/useLiveKit.ts)
   - Lines 317-327: Microphone source logging

3. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - New comprehensive guide

---

## Testing Commands

```bash
# Check all services
docker compose ps

# Restart agent
docker compose restart agent

# Watch logs in real-time
docker logs agent786-agent -f

# Check for errors
docker logs agent786-agent 2>&1 | grep -i error

# Check GPU usage
docker exec agent786-agent nvidia-smi

# Test token generation
curl -X POST http://localhost:8000/api/generate-token \
  -H "Content-Type: application/json" \
  -d '{"room_name":"test","participant_name":"test","metadata":"{}"}'
```

---

**Last Updated**: January 14, 2026, 11:20 PKT
**Status**: Greeting working ✅, Audio patch applied ⚙️, TTS optimization pending
