# Zyphra Zonos TTS Setup Guide

This guide explains how to set up and use Zyphra Zonos TTS in the LiveKit Realtime Agent.

## Overview

Zonos-v0.1 is a high-quality, open-weight text-to-speech model trained on 200k+ hours of multilingual speech. It provides:
- **High-quality voice synthesis** comparable to commercial TTS providers
- **Multilingual support** (English, Spanish, Urdu, and more)
- **Voice cloning** from reference audio samples
- **GPU acceleration** for fast inference
- **Local deployment** (no external API calls)

## Installation

### Step 1: Install PyTorch

```bash
# For CUDA 11.8
pip install torch>=2.0.0 torchaudio>=2.0.0 --index-url https://download.pytorch.org/whl/cu118

# For CUDA 12.1
pip install torch>=2.0.0 torchaudio>=2.0.0 --index-url https://download.pytorch.org/whl/cu121

# For CPU only (not recommended for production)
pip install torch>=2.0.0 torchaudio>=2.0.0
```

### Step 2: Install Zonos

```bash
# Clone the repository
git clone https://github.com/Zyphra/Zonos.git
cd Zonos

# Install in development mode
pip install -e .

# Or wait for PyPI release and install via:
# pip install zonos
```

### Step 3: Download Model Weights

The model will automatically download on first use from HuggingFace:
- **Hybrid Model** (recommended): `Zyphra/Zonos-v0.1-hybrid` (~1.2GB)
- **Transformer Model**: `Zyphra/Zonos-v0.1-transformer` (~800MB)

## Configuration

### Environment Variables

Add to your `.env.local` file:

```bash
# Zonos TTS Configuration
ZONOS_MODEL=Zyphra/Zonos-v0.1-hybrid
ZONOS_DEVICE=cuda                    # or 'cpu'
ZONOS_LANGUAGE=en                     # Language code: en, es, ur, etc.

# Optional: Voice cloning
ZONOS_SPEAKER_AUDIO=/path/to/reference.wav
```

### Model Options

- **`Zyphra/Zonos-v0.1-hybrid`** (Default): Best quality, slightly larger
- **`Zyphra/Zonos-v0.1-transformer`**: Faster, smaller footprint

### Device Options

- **`cuda`** (Recommended): Uses GPU for fast inference
- **`cpu`**: Falls back to CPU (slower but works without GPU)

### Language Support

Zonos supports multiple languages:
- `en` - English
- `es` - Spanish
- `ur` - Urdu
- `fr` - French
- `de` - German
- And more...

## Voice Cloning (Optional)

To use a custom voice, provide a reference audio file (3-10 seconds recommended):

1. **Prepare reference audio**:
   - Format: WAV, MP3, or FLAC
   - Duration: 3-10 seconds of clean speech
   - Quality: Clear, no background noise

2. **Configure path**:
   ```bash
   ZONOS_SPEAKER_AUDIO=/path/to/reference.wav
   ```

3. **Restart agent** - The reference will be loaded on initialization

## Fallback System

The agent uses a 3-tier fallback system:

1. **Primary**: Zonos TTS (high quality, local GPU)
2. **Fallback**: Edge TTS (cloud-based, reliable)
3. **Final**: Flite TTS (local, lightweight)

If Zonos fails 3 times, the system automatically switches to Edge TTS.

## Troubleshooting

### GPU Out of Memory

If you encounter GPU memory errors:

1. **Use CPU mode**:
   ```bash
   ZONOS_DEVICE=cpu
   ```

2. **Use transformer model** (smaller):
   ```bash
   ZONOS_MODEL=Zyphra/Zonos-v0.1-transformer
   ```

3. **Clear GPU cache**:
   ```python
   import torch
   torch.cuda.empty_cache()
   ```

### Model Download Issues

If model download fails:

1. **Check HuggingFace access**:
   ```bash
   huggingface-cli login
   ```

2. **Manual download**:
   ```bash
   from huggingface_hub import snapshot_download
   snapshot_download("Zyphra/Zonos-v0.1-hybrid")
   ```

### Import Errors

If you get import errors:

```bash
# Reinstall Zonos
cd Zonos
pip uninstall zonos -y
pip install -e .

# Verify installation
python -c "import zonos; print(zonos.__version__)"
```

## Performance

### Expected Latency (RTX 4070 Ti)

- **First synthesis**: ~2-3 seconds (model loading)
- **Subsequent synthesis**: ~200-500ms (depends on text length)
- **GPU memory**: ~1-2GB VRAM

### Optimization Tips

1. **Keep model loaded** - Lazy initialization prevents reloading
2. **Use GPU** - 5-10x faster than CPU
3. **Shorter texts** - Break long texts into chunks
4. **Batch processing** - Process multiple requests together (future enhancement)

## Resources

- **GitHub**: https://github.com/Zyphra/Zonos
- **HuggingFace**: https://huggingface.co/Zyphra/Zonos-v0.1-hybrid
- **Blog Post**: https://www.zyphra.com/post/beta-release-of-zonos-v0-1
- **Tutorial**: https://www.hyperstack.cloud/technical-resources/tutorials/how-to-deploy-zyphra-zonos-a-quick-tutorial

## Support

For Zonos-specific issues:
- GitHub Issues: https://github.com/Zyphra/Zonos/issues
- Zyphra Discord: Check their website for invite link

For integration issues:
- Check agent logs: `docker-compose logs -f agent786-agent`
- Enable debug logging: `LOG_LEVEL=DEBUG`
