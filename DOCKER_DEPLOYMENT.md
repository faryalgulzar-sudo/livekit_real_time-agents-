# Docker Deployment Guide - LiveKit Realtime Agent

This guide explains how to deploy the entire LiveKit Realtime Agent system using Docker Compose.

## Overview

The system runs 3 services via Docker Compose:
1. **FastAPI Backend** - Token generation and session management (port 8000)
2. **Agent Worker** - LiveKit agent with Zonos TTS (GPU-accelerated)
3. **Frontend** - Next.js web application (port 3000)

## Prerequisites

### Required Software
- Docker Engine 24.0+ (not Docker Desktop on Linux)
- Docker Compose V2
- NVIDIA Container Toolkit (for GPU support)
- NVIDIA GPU with CUDA support (RTX 4070 Ti or similar)

### Installation Steps

#### 1. Install Docker Engine
```bash
# Remove Docker Desktop if installed
sudo apt remove docker-desktop

# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

#### 2. Install NVIDIA Container Toolkit
```bash
# Add NVIDIA Container Toolkit repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Configure Docker to use NVIDIA runtime
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

---

## Configuration

### 1. Create `.env` file

Create `.env` file in the `docker/` directory:

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://livekit.drap.ai
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here

# Database Configuration
DATABASE_URL=postgresql://dentist:dentist_pass@localhost:5432/dentist_ai
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=3600
DB_POOL_PRE_PING=true
DEBUG_SQL=false

# Agent Configuration
OLLAMA_MODEL=gemma3:1b
AGENT_API_BASE_URL=http://localhost:8000
AGENT_API_TIMEOUT=5
AGENT_API_RETRIES=3
TENANT_ID=demo_clinic

# Zonos TTS Configuration
ZONOS_MODEL=Zyphra/Zonos-v0.1-hybrid
ZONOS_DEVICE=cuda
ZONOS_LANGUAGE=en
# Optional: ZONOS_SPEAKER_AUDIO=/path/to/speaker/reference.wav

# CORS Configuration
ENV=development
CORS_ALLOWED_ORIGINS=https://agent007.drap.ai,https://www.drap.ai

# Logging
LOG_LEVEL=INFO
```

### 2. Optional: Configure Speaker Voice

For voice cloning, place a reference audio file and update the path:

```bash
# Create audio directory
mkdir -p audio/speakers

# Place your reference audio file (3-10 seconds of clear speech)
cp /path/to/speaker.wav audio/speakers/speaker.wav

# Update .env
ZONOS_SPEAKER_AUDIO=/app/audio/speakers/speaker.wav
```

Then add volume mount to docker-compose.yml:
```yaml
volumes:
  - ./audio:/app/audio
```

---

## Deployment

### Build and Start All Services

```bash
cd docker/
docker-compose up --build
```

### Production Deployment (Detached Mode)

```bash
cd docker/
docker-compose up --build -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f agent
docker-compose logs -f fastapi
docker-compose logs -f frontend
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
docker-compose down -v
```

---

## Service Details

### 1. FastAPI Backend (agent786-fastapi)

**Purpose**: Token generation, room management, session API

**Port**: 8000

**Endpoints**:
- `GET /` - Health check
- `GET /health` - API health
- `GET /health/db` - Database health
- `POST /api/generate-token` - Generate LiveKit JWT token
- `POST /v1/sessions` - Create session
- `GET /v1/sessions/{id}` - Get session
- `PATCH /v1/sessions/{id}/finalize` - Finalize session

**Environment Variables**:
- All CORS, database, and LiveKit variables

**Volume Mounts**:
- `../backend:/app/backend` - Hot reload during development
- `../config/.env.local:/app/config/.env.local` - Configuration

---

### 2. Agent Worker (agent786-agent)

**Purpose**: LiveKit voice agent with Zonos TTS

**GPU**: Requires NVIDIA GPU with CUDA support

**Key Features**:
- Zyphra Zonos TTS (primary)
- Edge TTS (fallback)
- Flite TTS (final fallback)
- GPU-accelerated inference
- Voice cloning support
- Session cleanup on disconnect

**Environment Variables**:
- All Zonos TTS, database, and agent variables
- NVIDIA GPU environment variables

**Volume Mounts**:
- `../backend:/app/backend` - Hot reload
- `../config/.env.local:/app/config/.env.local` - Configuration
- `zonos-models:/root/.cache/huggingface` - Model cache (persistent)

**Resource Requirements**:
- GPU: ~1-2GB VRAM
- RAM: ~4-6GB
- Disk: ~2GB (models)

---

### 3. Frontend (agent786-frontend)

**Purpose**: Next.js web interface

**Port**: 3000

**Environment Variables**:
- `NEXT_PUBLIC_API_URL` - API base URL

**Volume Mounts**:
- `../frontend:/app` - Source code
- `/app/node_modules` - Dependencies (excluded)
- `/app/.next` - Build cache (excluded)

---

## Volumes

### zonos-models

**Purpose**: Persistent storage for Zonos TTS model weights

**Location**: `/root/.cache/huggingface` inside container

**Size**: ~1.2GB (hybrid model) or ~800MB (transformer model)

**Benefits**:
- Faster startup (no re-download)
- Consistent across container restarts
- Shared between agent restarts

**Management**:
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect docker_zonos-models

# Remove volume (forces re-download)
docker volume rm docker_zonos-models
```

---

## Troubleshooting

### GPU Not Detected

**Symptom**: Agent falls back to CPU

**Solutions**:
1. Verify GPU access:
   ```bash
   docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
   ```

2. Check NVIDIA Container Toolkit:
   ```bash
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

3. Verify docker-compose GPU configuration:
   ```yaml
   runtime: nvidia
   environment:
     - NVIDIA_VISIBLE_DEVICES=all
   ```

### Model Download Fails

**Symptom**: HuggingFace download errors

**Solutions**:
1. Check internet connection
2. Verify HuggingFace Hub access:
   ```bash
   pip install huggingface-hub
   huggingface-cli login
   ```

3. Manual download:
   ```bash
   from huggingface_hub import snapshot_download
   snapshot_download("Zyphra/Zonos-v0.1-hybrid")
   ```

### Database Connection Fails

**Symptom**: 503 error on `/health/db`

**Solutions**:
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format:
   ```
   postgresql://user:pass@host:port/dbname
   ```

3. Test connection:
   ```bash
   psql postgresql://dentist:dentist_pass@localhost:5432/dentist_ai
   ```

### CORS Errors

**Symptom**: Browser blocks requests

**Solutions**:
1. Update `CORS_ALLOWED_ORIGINS`:
   ```bash
   CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
   ```

2. For development, set:
   ```bash
   ENV=development
   ```

### Out of Memory

**Symptom**: Container killed or GPU OOM

**Solutions**:
1. Use transformer model (smaller):
   ```bash
   ZONOS_MODEL=Zyphra/Zonos-v0.1-transformer
   ```

2. Fallback to CPU:
   ```bash
   ZONOS_DEVICE=cpu
   ```

3. Increase Docker memory limits

---

## Performance Optimization

### 1. Model Cache

Pre-download models before deployment:

```bash
# Create cache volume first
docker volume create zonos-models

# Download models
docker run --rm -v zonos-models:/root/.cache/huggingface \
  python:3.11-slim bash -c \
  "pip install huggingface-hub && \
   python -c 'from huggingface_hub import snapshot_download; \
   snapshot_download(\"Zyphra/Zonos-v0.1-hybrid\")'"
```

### 2. Build Cache

Use Docker BuildKit for faster builds:

```bash
DOCKER_BUILDKIT=1 docker-compose build
```

### 3. Multi-Stage Builds

Consider splitting Dockerfile into build and runtime stages for smaller images.

---

## Monitoring

### Resource Usage

```bash
# Real-time stats
docker stats agent786-agent agent786-fastapi

# GPU usage
nvidia-smi -l 1

# Logs with timestamps
docker-compose logs -f --timestamps
```

### Health Checks

```bash
# API health
curl http://localhost:8000/health

# Database health
curl http://localhost:8000/health/db

# Agent metrics (if exposed)
curl http://localhost:8000/metrics
```

---

## Production Recommendations

### 1. Security

- [ ] Remove default credentials from `.env`
- [ ] Use secrets management (Docker secrets, Vault)
- [ ] Enable HTTPS/TLS
- [ ] Restrict CORS to specific origins
- [ ] Use non-root user in containers
- [ ] Scan images for vulnerabilities

### 2. Reliability

- [ ] Enable health checks in docker-compose
- [ ] Configure restart policies
- [ ] Set resource limits (CPU, memory)
- [ ] Use external database (not localhost)
- [ ] Implement logging aggregation
- [ ] Add monitoring (Prometheus, Grafana)

### 3. Scalability

- [ ] Use external volume for models
- [ ] Load balance multiple agent instances
- [ ] Separate services into different hosts
- [ ] Use Redis for session storage
- [ ] Implement rate limiting

---

## Backup and Recovery

### Backup Model Cache

```bash
docker run --rm -v zonos-models:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/zonos-models-backup.tar.gz /data
```

### Restore Model Cache

```bash
docker run --rm -v zonos-models:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/zonos-models-backup.tar.gz -C /
```

---

## Quick Reference

### Common Commands

```bash
# Start all services
docker-compose up -d

# Restart agent only
docker-compose restart agent

# View agent logs
docker-compose logs -f agent

# Rebuild agent
docker-compose up -d --build agent

# Stop all services
docker-compose down

# Clean everything
docker-compose down -v --rmi all
```

### Environment Variables

See [config/.env.example](../config/.env.example) for complete list.

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify configuration: `docker-compose config`
3. Test GPU: `nvidia-smi`
4. Check network: `docker network ls`
5. Inspect volumes: `docker volume ls`

---

**Last Updated**: January 14, 2026
**Version**: Phase 1 Complete
