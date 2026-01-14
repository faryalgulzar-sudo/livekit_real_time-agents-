#!/bin/bash
# Download and cache Zonos TTS models to Docker volume
# This pre-caches models so the first synthesis doesn't have to download them

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Zonos TTS Model Pre-Cache${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if volume exists
if ! docker volume inspect docker_zonos-models >/dev/null 2>&1; then
    echo -e "${YELLOW}Creating Zonos models volume...${NC}"
    docker volume create docker_zonos-models
    echo -e "${GREEN}✓ Volume created${NC}"
fi

echo -e "${YELLOW}Downloading Zonos models to Docker volume...${NC}"
echo "This may take 5-10 minutes depending on your internet speed (~1.2GB)"
echo ""

# Run a temporary container to download the models
docker run --rm \
    -v docker_zonos-models:/root/.cache/huggingface \
    python:3.11-slim \
    bash -c "
        pip install -q huggingface-hub && \
        python -c \"
from huggingface_hub import snapshot_download
import sys

print('Downloading Zonos-v0.1-hybrid model...')
snapshot_download(
    'Zyphra/Zonos-v0.1-hybrid',
    local_files_only=False,
    resume_download=True
)
print('✓ Model downloaded successfully!')
\"
    "

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Zonos models cached successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Models are now cached in: docker_zonos-models volume"
echo "The agent will use cached models on first synthesis."
echo ""
echo "To verify the cache:"
echo "  docker run --rm -v docker_zonos-models:/cache alpine ls -lh /cache/huggingface/hub"
