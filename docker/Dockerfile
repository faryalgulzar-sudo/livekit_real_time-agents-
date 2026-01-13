# Dockerfile for LiveKit Agent with custom plugins
# Using NVIDIA CUDA base image for GPU acceleration
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

WORKDIR /app

# Set timezone non-interactively
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install Python 3.11 and system dependencies
RUN apt-get update && apt-get install -y \
    software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    ffmpeg \
    curl \
    git \
    build-essential \
    libcublas-12-1 \
    espeak-ng \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

# Upgrade pip
RUN python3 -m pip install --upgrade pip

# Clone and install Zonos TTS from source (needs editable install)
RUN git clone https://github.com/Zyphra/Zonos.git /tmp/zonos && \
    cd /tmp/zonos && \
    pip install --no-cache-dir -e . && \
    cd / && \
    rm -rf /tmp/zonos/.git

# Pre-download Zonos models during build to avoid first-run delays
RUN python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Zyphra/Zonos-v0.1-transformer', cache_dir='/app/.cache/huggingface')" && \
    echo "✅ Zonos models pre-downloaded"

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/agent/ ./backend/agent/
COPY backend/api/ ./backend/api/

# Expose ports
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["python", "backend/agent/agent.py", "dev"]
