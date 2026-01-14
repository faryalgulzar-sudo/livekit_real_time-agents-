# Edge TTS Voice Selection Guide

## Current Configuration

**Default Voice**: `en-US-GuyNeural` (Male, Casual)

**Speed**: Much faster than Zonos TTS (~100-200ms vs ~500ms per synthesis)

---

## How to Change Voice

Edit [docker-compose.yml](docker/docker-compose.yml) or set environment variable:

```yaml
environment:
  - EDGE_TTS_VOICE=en-US-JennyNeural  # Change to any voice below
  - EDGE_TTS_RATE=+0%     # Speed: -50% to +100%
  - EDGE_TTS_PITCH=+0Hz   # Pitch: -50Hz to +50Hz
```

Then restart:
```bash
docker compose restart agent
```

---

## 🎤 Popular English Voices

### United States (en-US)

**Female Voices:**
- `en-US-AriaNeural` - Friendly, warm (Microsoft's default)
- `en-US-JennyNeural` - Professional, clear
- `en-US-MichelleNeural` - Bright, energetic
- `en-US-AnaNeural` - Mature, calm
- `en-US-SaraNeural` - Young, friendly

**Male Voices:**
- `en-US-GuyNeural` - Casual, conversational (CURRENT DEFAULT)
- `en-US-AndrewNeural` - Warm, professional
- `en-US-BrianNeural` - Confident, deep
- `en-US-ChristopherNeural` - Clear, neutral
- `en-US-EricNeural` - Mature, authoritative

**Multilingual:**
- `en-US-AvaMultilingualNeural` - Female, supports multiple languages
- `en-US-AndrewMultilingualNeural` - Male, supports multiple languages

### United Kingdom (en-GB)

**Female:**
- `en-GB-SoniaNeural` - British, professional
- `en-GB-LibbyNeural` - Young British, friendly
- `en-GB-MiaNeural` - British, warm

**Male:**
- `en-GB-RyanNeural` - British, confident
- `en-GB-ThomasNeural` - British, mature

### Australia (en-AU)

**Female:**
- `en-AU-NatashaNeural` - Australian, friendly
- `en-AU-AnnetteNeural` - Australian, professional

**Male:**
- `en-AU-WilliamNeural` - Australian, casual

### Canada (en-CA)

**Female:**
- `en-CA-ClaraNeural` - Canadian, clear

**Male:**
- `en-CA-LiamNeural` - Canadian, warm

### India (en-IN)

**Female:**
- `en-IN-NeerjaNeural` - Indian English, professional

**Male:**
- `en-IN-PrabhatNeural` - Indian English, confident

---

## ⚡ Speed and Pitch Adjustment

### Rate (Speed)
```yaml
EDGE_TTS_RATE: "+0%"    # Normal speed (default)
EDGE_TTS_RATE: "+20%"   # 20% faster
EDGE_TTS_RATE: "-20%"   # 20% slower
```

Range: `-50%` to `+100%`

### Pitch
```yaml
EDGE_TTS_PITCH: "+0Hz"   # Normal pitch (default)
EDGE_TTS_PITCH: "+10Hz"  # Higher pitch
EDGE_TTS_PITCH: "-10Hz"  # Lower pitch
```

Range: `-50Hz` to `+50Hz`

---

## 💡 Recommended Combinations

### Professional Medical Assistant
```yaml
EDGE_TTS_VOICE: en-US-JennyNeural
EDGE_TTS_RATE: "+0%"
EDGE_TTS_PITCH: "+0Hz"
```

### Friendly Conversational
```yaml
EDGE_TTS_VOICE: en-US-AriaNeural
EDGE_TTS_RATE: "+5%"
EDGE_TTS_PITCH: "+0Hz"
```

### Authoritative Male
```yaml
EDGE_TTS_VOICE: en-US-BrianNeural
EDGE_TTS_RATE: "-5%"
EDGE_TTS_PITCH: "-5Hz"
```

### Fast and Energetic
```yaml
EDGE_TTS_VOICE: en-US-MichelleNeural
EDGE_TTS_RATE: "+15%"
EDGE_TTS_PITCH: "+5Hz"
```

---

## 🌍 All Available Voices

To see ALL voices (200+ in 100+ languages):

```bash
docker exec agent786-agent python -c "
import edge_tts
import asyncio
voices = asyncio.run(edge_tts.list_voices())
for v in voices:
    print(f\"{v['ShortName']:50} {v['Gender']:8} {v['Locale']}\")"
```

Languages include: Arabic, Chinese, French, German, Hindi, Japanese, Korean, Portuguese, Russian, Spanish, and many more!

---

## 🎯 Current Setup

**TTS Stack**:
1. **Primary**: Microsoft Edge TTS (cloud-based, 100-200ms)
2. **Fallback**: Flite TTS (local, lightweight)

**Zonos TTS Removed**: Too slow for real-time conversation (2-3 seconds first synthesis, ~500ms subsequent)

**Benefits of Edge TTS**:
- ✅ 5x faster than Zonos
- ✅ 200+ professional voices
- ✅ Multiple languages
- ✅ No GPU required
- ✅ Reliable Microsoft cloud service

**Drawback**:
- ❌ Requires internet connection
- ❌ Depends on Microsoft service

---

## 🔧 Testing Different Voices

1. **Edit docker-compose.yml**:
   ```yaml
   - EDGE_TTS_VOICE=en-US-JennyNeural  # Try different voice
   ```

2. **Restart agent**:
   ```bash
   docker compose restart agent
   ```

3. **Connect and test**:
   - Go to https://agent007.drap.ai
   - Click "Connect"
   - Listen to the greeting with new voice

4. **Try different voices** until you find one you like!

---

## 📋 Quick Reference

**Most Popular Voices:**
- Female Professional: `en-US-JennyNeural`
- Male Professional: `en-US-GuyNeural` ← CURRENT
- Female Friendly: `en-US-AriaNeural`
- Male Warm: `en-US-AndrewNeural`
- British Female: `en-GB-SoniaNeural`

**Environment Variables:**
```bash
EDGE_TTS_VOICE=en-US-GuyNeural
EDGE_TTS_RATE=+0%
EDGE_TTS_PITCH=+0Hz
```

---

**Last Updated**: January 14, 2026
**Current Voice**: en-US-GuyNeural (Male, Casual)
