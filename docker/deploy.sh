#!/bin/bash
# Quick deployment script for LiveKit Realtime Agent
# This script builds and starts all services via Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}LiveKit Realtime Agent - Docker Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running in docker directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found${NC}"
    echo "Please run this script from the docker/ directory"
    exit 1
fi

# Check Docker
echo -e "${YELLOW}Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/engine/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Check Docker Compose
echo -e "${YELLOW}Checking Docker Compose...${NC}"
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose V2 is not installed${NC}"
    echo "Please install Docker Compose V2"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose V2 installed${NC}"

# Check NVIDIA GPU
echo -e "${YELLOW}Checking NVIDIA GPU...${NC}"
if command -v nvidia-smi &> /dev/null; then
    echo -e "${GREEN}✓ NVIDIA GPU detected${NC}"
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader

    # Check NVIDIA Container Toolkit
    if docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
        echo -e "${GREEN}✓ NVIDIA Container Toolkit configured${NC}"
    else
        echo -e "${YELLOW}⚠ NVIDIA Container Toolkit may not be configured${NC}"
        echo "Run: sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker"
    fi
else
    echo -e "${YELLOW}⚠ No NVIDIA GPU detected, will use CPU for TTS${NC}"
fi

# Check .env file
echo -e "${YELLOW}Checking environment configuration...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file found${NC}"
elif [ -f "../config/.env.local" ]; then
    echo -e "${GREEN}✓ config/.env.local file found${NC}"
else
    echo -e "${YELLOW}⚠ No .env file found${NC}"
    echo "Using default environment variables from docker-compose.yml"
    echo "For production, create .env file with your configuration"
fi

# Build option
echo ""
echo -e "${YELLOW}Build Docker images?${NC}"
select BUILD_OPT in "Yes (recommended)" "No (use existing images)" "Skip"; do
    case $BUILD_OPT in
        "Yes (recommended)")
            echo -e "${YELLOW}Building Docker images...${NC}"
            docker compose build
            echo -e "${GREEN}✓ Images built successfully${NC}"
            break
            ;;
        "No (use existing images)")
            echo "Using existing images"
            break
            ;;
        "Skip")
            echo "Skipping build"
            break
            ;;
    esac
done

# Start services
echo ""
echo -e "${YELLOW}Starting services...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Services started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Show running containers
echo -e "${YELLOW}Running containers:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}Service URLs:${NC}"
echo "  FastAPI Backend: http://localhost:8000"
echo "  Frontend:        http://localhost:3000"
echo "  Health Check:    http://localhost:8000/health"
echo "  DB Health:       http://localhost:8000/health/db"

echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:       docker compose logs -f"
echo "  Agent logs:      docker compose logs -f agent"
echo "  Stop services:   docker compose down"
echo "  Restart agent:   docker compose restart agent"

echo ""
echo -e "${GREEN}First-time setup:${NC}"
echo "  - Zonos TTS will download models on first synthesis (~1.2GB)"
echo "  - First synthesis may take 2-3 seconds (model loading)"
echo "  - Subsequent syntheses are fast (~200-500ms)"

echo ""
echo -e "${YELLOW}Monitoring:${NC}"
echo "  GPU usage:       nvidia-smi -l 1"
echo "  Container stats: docker stats"
echo "  Follow logs:     docker compose logs -f"

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
