#!/bin/bash

# Restart Docker containers for agent-786 project
# This script stops and restarts all services with GPU support

set -e

echo "🔄 Restarting agent-786 Docker containers..."
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stop all services
echo -e "${YELLOW}📦 Stopping all services...${NC}"
docker compose -f docker/docker-compose.yml down

# Remove old containers (optional - comment out if you want to keep them)
echo -e "${YELLOW}🗑️  Removing old containers...${NC}"
docker compose -f docker/docker-compose.yml rm -f

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose -f docker/docker-compose.yml up -d --build

# Wait for services to start
echo -e "${YELLOW}⏳ Waiting for services to start (30 seconds)...${NC}"
sleep 30

# Check status
echo ""
echo -e "${GREEN}✅ Service Status:${NC}"
docker compose -f docker/docker-compose.yml ps

echo ""
echo -e "${GREEN}🎉 Restart complete!${NC}"
echo ""
echo "📋 To view logs:"
echo "  - All services: docker compose -f docker/docker-compose.yml logs -f"
echo "  - Agent only: docker logs agent786-agent -f"
echo "  - Database API: docker logs agent786-database-api -f"
echo ""
echo "🧪 To test GPU:"
echo "  docker exec agent786-agent nvidia-smi"
