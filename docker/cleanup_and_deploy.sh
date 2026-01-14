#!/bin/bash
# Cleanup and deployment script for LiveKit Realtime Agent
# This script requires sudo privileges to stop conflicting processes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}LiveKit Agent - Cleanup and Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root or with sudo${NC}"
    echo "Usage: sudo ./cleanup_and_deploy.sh"
    exit 1
fi

# Step 1: Stop conflicting uvicorn processes
echo -e "${YELLOW}Step 1: Stopping conflicting uvicorn processes...${NC}"
UVICORN_PIDS=$(pgrep -f "uvicorn main:app" || echo "")
if [ -n "$UVICORN_PIDS" ]; then
    echo "Found uvicorn processes: $UVICORN_PIDS"
    kill -9 $UVICORN_PIDS 2>/dev/null || true
    echo -e "${GREEN}✓ Uvicorn processes stopped${NC}"
else
    echo "No uvicorn processes found"
fi

# Step 2: Stop Docker containers
echo ""
echo -e "${YELLOW}Step 2: Stopping Docker containers...${NC}"
docker stop agent786-agent agent786-fastapi agent786-frontend 2>/dev/null || true
docker rm -f agent786-agent agent786-fastapi agent786-frontend 2>/dev/null || true
echo -e "${GREEN}✓ Docker containers stopped and removed${NC}"

# Step 3: Clean up Docker Compose
echo ""
echo -e "${YELLOW}Step 3: Cleaning up Docker Compose stack...${NC}"
cd /home/saif/Desktop/Workspace/TheCloudOps/livekit-realtime/docker
docker compose down -v 2>/dev/null || true
echo -e "${GREEN}✓ Docker Compose stack cleaned up${NC}"

# Step 4: Verify ports are free
echo ""
echo -e "${YELLOW}Step 4: Verifying ports 8000 and 3000 are free...${NC}"
PORT_8000=$(lsof -ti:8000 || echo "")
PORT_3000=$(lsof -ti:3000 || echo "")

if [ -n "$PORT_8000" ]; then
    echo -e "${RED}Warning: Port 8000 still in use by PID: $PORT_8000${NC}"
    kill -9 $PORT_8000 2>/dev/null || true
fi

if [ -n "$PORT_3000" ]; then
    echo -e "${RED}Warning: Port 3000 still in use by PID: $PORT_3000${NC}"
    echo -e "${YELLOW}Note: This might be user 'noor's Next.js server${NC}"
    echo -e "${YELLOW}You may need to manually stop it or change the frontend port${NC}"
fi

echo -e "${GREEN}✓ Ports checked${NC}"

# Step 5: Build and start Docker Compose
echo ""
echo -e "${YELLOW}Step 5: Building and starting Docker Compose stack...${NC}"
docker compose up --build -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Status${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Wait for containers to start
sleep 5

# Show container status
echo -e "${YELLOW}Running containers:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}Service URLs:${NC}"
echo "  FastAPI Backend: http://localhost:8000"
echo "  Frontend:        http://localhost:3000"
echo "  Health Check:    http://localhost:8000/health"
echo "  DB Health:       http://localhost:8000/health/db"

echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  All services:    docker compose logs -f"
echo "  Agent only:      docker compose logs -f agent"
echo "  FastAPI only:    docker compose logs -f fastapi"

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
