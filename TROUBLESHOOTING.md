# Troubleshooting Guide - LiveKit Voice Agent

## Issue: "I don't get any greeting or anything"

### Quick Fix Checklist:

1. **Ensure you clicked the microphone button**
   - The agent greeting plays automatically when you connect
   - BUT you need to click the microphone icon to enable YOUR microphone to speak back
   - Check browser permissions - allow microphone access

2. **Check agent is running and registered:**
   ```bash
   docker logs agent786-agent 2>&1 | grep "registered worker" | tail -1
   ```
   
   Should see something like:
   ```
   INFO livekit.agents registered worker {"agent_name": "", "id": "AW_..."}
   ```

3. **Connect to the frontend and check logs:**
   ```bash
   # In one terminal, watch agent logs:
   docker logs agent786-agent -f

   # Then open browser to: https://agent007.drap.ai
   # Click "Connect"
   ```

   You should see in logs:
   ```
   received job request {"job_id": "AJ_...", "room": "room-user_..."}
   initializing process
   Agent session started!
   Sending initial greeting: Hello! Welcome...
   ```

4. **If agent is stuck in old session, restart it:**
   ```bash
   cd /home/saif/Desktop/Workspace/TheCloudOps/livekit-realtime/docker
   docker compose restart agent
   sleep 5
   docker logs agent786-agent --tail 20
   ```

5. **Check browser console for errors:**
   - Press F12 to open developer console
   - Look for errors in red
   - Common issues:
     - "Failed to generate token" → FastAPI not running
     - "WebSocket connection failed" → LiveKit server not running
     - "Microphone permission denied" → Grant permissions

### Detailed Diagnostics:

**Step 1: Verify all services running**
```bash
docker compose ps
```

Expected output - all should show "running" or "healthy":
```
agent786-postgres    healthy
agent786-fastapi     running
agent786-agent       running
agent786-frontend    running
```

**Step 2: Test token generation**
```bash
curl -X POST http://localhost:8000/api/generate-token \
  -H "Content-Type: application/json" \
  -d '{"room_name":"test-room","participant_name":"test-user","metadata":"{}"}'
```

Should return JSON with `token`, `url`, `room_name`.

**Step 3: Check LiveKit server**
```bash
systemctl status livekit-server
```

Should show: `Active: active (running)`

If not running:
```bash
sudo systemctl start livekit-server
```

**Step 4: Check agent worker registration**
```bash
docker logs agent786-agent 2>&1 | tail -50 | grep -E "(registered worker|received job|greeting)"
```

**Step 5: Test from browser**
1. Open https://agent007.drap.ai
2. Open browser console (F12)
3. Click "Connect"
4. Watch for:
   - "Connecting to LiveKit..."
   - "Token received"
   - "Connected successfully"
   - "Track subscribed: audio"

**Step 6: Check audio playback**
- Verify browser audio is not muted
- Check system volume
- Try headphones
- Check audio output device in browser settings

---

## Issue: Frontend shows connection status but no agent voice

**Possible Causes:**

1. **Audio element not attached**
   - Check browser console for: `Track subscribed: audio from agent-...`
   - Audio should auto-play when agent speaks

2. **TTS synthesis failing**
   Check agent logs:
   ```bash
   docker logs agent786-agent 2>&1 | grep -i "tts\|zonos\|synthesis"
   ```

   If you see errors like:
   - "CUDA out of memory" → GPU issue
   - "Model not found" → Zonos not cached
   - "Failed to synthesize" → TTS fallback issue

3. **Agent greeting not sent**
   ```bash
   docker logs agent786-agent 2>&1 | grep greeting
   ```

   Should see:
   ```
   Sending initial greeting: Hello! Welcome to our dental clinic...
   ```

---

## Issue: "Agent status" not showing in frontend

The frontend shows:
- Connection status indicator (green/yellow/red dot)
- User ID
- Speaking status
- Audio level meter

It does NOT show:
- Separate "agent status" indicator
- Agent participant name (by design)

If you want to see agent in participants list, check browser console for:
```
Participant connected: agent-...
```

---

## Issue: No latency metrics visible

Latency metrics are logged on the backend, not shown in frontend UI.

To see latency:
```bash
docker logs agent786-agent 2>&1 | grep -i latency
```

At end of session, you'll see:
```
=== Latency Summary ===
Total turns: X
Average user speech time: Xms
Average transcription time: Xms
Average LLM response time: Xms
Average TTS synthesis time: Xms
```

---

## Common Errors and Solutions

### Error: "Failed to generate access token"

**Cause**: FastAPI not running or not accessible

**Solution**:
```bash
docker compose ps fastapi
curl http://localhost:8000/health
```

If not running:
```bash
docker compose restart fastapi
```

### Error: "WebSocket connection failed"

**Cause**: LiveKit server not running

**Solution**:
```bash
systemctl status livekit-server
sudo systemctl start livekit-server
```

### Error: "Microphone permission denied"

**Cause**: Browser blocked microphone access

**Solution**:
- Click lock icon in address bar
- Allow microphone permissions
- Refresh page
- Try again

### Error: "No audio output"

**Checklist**:
- Browser audio not muted
- System volume not muted
- Correct audio output device selected
- Try headphones
- Check other tabs aren't blocking audio

### Error: Agent stuck in old session

**Symptom**: Agent doesn't join new rooms

**Solution**:
```bash
docker compose restart agent
```

### Error: High memory usage warning

**Symptom**: Logs show "process memory usage is high"

**Explanation**: This is normal. Zonos TTS + ML models use ~1-2GB RAM.

**If memory is critical**:
- Set `ZONOS_DEVICE=cpu` in docker-compose.yml (slower but less memory)
- Or use smaller model: `ZONOS_MODEL=Zyphra/Zonos-v0.1-transformer`

---

## Performance Expectations

### First Connection
- Token generation: <100ms
- Room connection: ~500ms
- Agent dispatch: ~1-2s
- Model loading: ~2-3s (first time only)
- **Total: ~4-6 seconds** for first greeting

### Subsequent Connections
- Everything cached: ~1-2 seconds total

### During Conversation
- Speech-to-text: ~200-500ms
- LLM response: ~500-1000ms (depends on Ollama)
- TTS synthesis: ~200-500ms (Zonos on GPU)
- **Total latency: ~1-2 seconds** per turn

---

## Debug Commands

```bash
# Watch all logs
docker compose logs -f

# Watch agent only
docker logs agent786-agent -f

# Search for errors
docker logs agent786-agent 2>&1 | grep -i error

# Check last 100 lines
docker logs agent786-agent --tail 100

# Check GPU usage
docker exec agent786-agent nvidia-smi

# Check model cache
docker volume inspect docker_zonos-models

# Restart everything
docker compose restart

# Clean restart (loses in-memory state)
docker compose down && docker compose up -d
```

---

## Still Not Working?

1. **Capture full logs**:
   ```bash
   docker logs agent786-agent > agent-logs.txt 2>&1
   docker logs agent786-fastapi > fastapi-logs.txt 2>&1
   ```

2. **Check browser console**:
   - Press F12
   - Go to Console tab
   - Copy all messages (especially errors in red)

3. **Test each component individually**:
   - API: `curl http://localhost:8000/health`
   - DB: `curl http://localhost:8000/health/db`
   - Frontend: `curl http://localhost:3001`
   - LiveKit: `curl http://localhost:7880`

4. **Check system resources**:
   ```bash
   docker stats
   nvidia-smi  # GPU usage
   free -h     # RAM usage
   df -h       # Disk usage
   ```
