# Dockerfile for LiveKit Agent with custom plugins and Zonos TTS
FROM python:3.11-slim

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    flite \
    curl \
    wget \
    git \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Zonos TTS from GitHub
RUN git clone https://github.com/Zyphra/Zonos.git /tmp/Zonos && \
    cd /tmp/Zonos && \
    pip install --no-cache-dir -e . && \
    cd / && \
    rm -rf /tmp/Zonos

# Copy source code
COPY backend/ ./backend/

# Expose ports
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["python", "backend/agent/agent.py", "dev"]
