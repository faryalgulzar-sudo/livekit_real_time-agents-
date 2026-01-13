#!/bin/bash

# ============================================================================
# Agent-786 Complete Restart Script
# This script restarts all services with GPU support
# ============================================================================

set -e  # Exit on error

PROJECT_ROOT="/home/faryal/agent-786"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "🚀 Agent-786 Complete Restart Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================================================
# 1. Stop all running services
# ============================================================================
echo "Step 1: Stopping all services..."
echo "-------------------------------------------"

# Kill Python agent processes
if pgrep -f "python.*agent\.py" > /dev/null; then
    print_status "Stopping Python agent processes..."
    sudo pkill -9 -f "python.*agent\.py" 2>/dev/null || true
    sleep 2
fi

# Stop Docker containers
print_status "Stopping Docker containers..."
cd docker
sudo docker-compose down 2>/dev/null || true
cd ..

# Remove old containers if they exist
print_status "Cleaning up old containers..."
sudo docker rm -f livekit-server 2>/dev/null || true
sudo docker rm -f dentist_postgres 2>/dev/null || true
sudo docker rm -f agent786-agent 2>/dev/null || true
sudo docker rm -f agent786-fastapi 2>/dev/null || true
sudo docker rm -f agent786-frontend 2>/dev/null || true

# Kill any processes using critical ports
print_status "Freeing up ports..."
sudo lsof -ti:7880 | xargs sudo kill -9 2>/dev/null || true
sudo lsof -ti:5432 | xargs sudo kill -9 2>/dev/null || true

sleep 2

print_status "All services stopped"
echo ""

# ============================================================================
# 2. Check GPU availability
# ============================================================================
echo "Step 2: Checking GPU availability..."
echo "-------------------------------------------"

if command -v nvidia-smi &> /dev/null; then
    print_status "GPU detected:"
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
    GPU_AVAILABLE=true
else
    print_warning "No GPU detected - will run in CPU mode"
    GPU_AVAILABLE=false
fi
echo ""

# ============================================================================
# 3. Start PostgreSQL Database
# ============================================================================
echo "Step 3: Starting PostgreSQL database..."
echo "-------------------------------------------"

# Check if postgres container exists
if sudo docker ps -a | grep -q dentist_postgres; then
    print_status "Starting existing PostgreSQL container..."
    sudo docker start dentist_postgres
else
    print_status "Creating new PostgreSQL container..."
    sudo docker run -d \
        --name dentist_postgres \
        -e POSTGRES_USER=dentist \
        -e POSTGRES_PASSWORD=dentist_pass \
        -e POSTGRES_DB=dentist_ai \
        -p 5432:5432 \
        -v postgres_data:/var/lib/postgresql/data \
        --restart unless-stopped \
        postgres:16
fi

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 5

if sudo docker exec dentist_postgres pg_isready -U dentist > /dev/null 2>&1; then
    print_status "PostgreSQL is ready"
else
    print_error "PostgreSQL failed to start"
    sudo docker logs --tail 20 dentist_postgres
    exit 1
fi
echo ""

# ============================================================================
# 4. Start LiveKit Server
# ============================================================================
echo "Step 4: Starting LiveKit server..."
echo "-------------------------------------------"

# Check if livekit container exists
if sudo docker ps -a | grep -q livekit-server; then
    print_status "Starting existing LiveKit container..."
    sudo docker start livekit-server
else
    print_status "Creating new LiveKit container..."
    sudo docker run -d \
        --name livekit-server \
        -p 7880:7880 \
        -p 7881:7881 \
        -p 7882:7882/udp \
        -e LIVEKIT_KEYS="devkey: secret" \
        --restart unless-stopped \
        livekit/livekit-server \
        --dev
fi

# Wait for LiveKit to be ready
print_status "Waiting for LiveKit to be ready..."
sleep 3
print_status "LiveKit server started"
echo ""

# ============================================================================
# 5. Rebuild and start Docker services
# ============================================================================
echo "Step 5: Building and starting Docker services..."
echo "-------------------------------------------"

cd docker

# Build images with GPU support
print_status "Building Docker images..."
if [ "$GPU_AVAILABLE" = true ]; then
    print_status "Building with GPU support (NVIDIA runtime)..."
    sudo docker-compose build --no-cache
else
    print_warning "Building in CPU mode..."
    sudo docker-compose build --no-cache
fi

# Start services
print_status "Starting Docker Compose services..."
if [ "$GPU_AVAILABLE" = true ]; then
    sudo docker-compose up -d
else
    print_warning "Starting in CPU mode (GPU runtime not available)..."
    sudo docker-compose up -d
fi

cd ..

# Wait for services to initialize
print_status "Waiting for services to initialize..."
sleep 5
echo ""

# ============================================================================
# 6. Verify all services are running
# ============================================================================
echo "Step 6: Verifying services..."
echo "-------------------------------------------"

# Check PostgreSQL
if sudo docker exec dentist_postgres pg_isready -U dentist > /dev/null 2>&1; then
    print_status "PostgreSQL: Running ✓"
else
    print_error "PostgreSQL: Not responding"
fi

# Check LiveKit
if sudo docker ps | grep -q livekit-server.*Up; then
    print_status "LiveKit Server: Running ✓"
else
    print_error "LiveKit Server: Not running"
fi

# Check FastAPI
if sudo docker ps | grep -q agent786-fastapi.*Up; then
    print_status "FastAPI (Database API): Running ✓"
else
    print_error "FastAPI: Not running"
fi

# Check Agent
if sudo docker ps | grep -q agent786-agent.*Up; then
    print_status "Agent Container: Running ✓"

    # Check if agent is using GPU
    if [ "$GPU_AVAILABLE" = true ]; then
        sleep 2
        if sudo docker exec agent786-agent nvidia-smi > /dev/null 2>&1; then
            print_status "Agent GPU Access: Enabled ✓"
        else
            print_warning "Agent GPU Access: Not available (check runtime configuration)"
        fi
    fi
else
    print_error "Agent: Not running"
fi

# Check Frontend
if sudo docker ps | grep -q agent786-frontend.*Up; then
    print_status "Frontend: Running ✓"
else
    print_error "Frontend: Not running"
fi

echo ""

# ============================================================================
# 7. Display service status and logs
# ============================================================================
echo "=========================================="
echo "📊 Service Status Summary"
echo "=========================================="
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "agent786|livekit|postgres"
echo ""

echo "=========================================="
echo "📝 Quick Log Check (Agent Container)"
echo "=========================================="
if sudo docker ps | grep -q agent786-agent.*Up; then
    sudo docker logs --tail 30 agent786-agent
else
    print_warning "Agent container not running - check logs with: sudo docker logs agent786-agent"
fi
echo ""

# ============================================================================
# 8. Display helpful information
# ============================================================================
echo "=========================================="
echo "🎉 Restart Complete!"
echo "=========================================="
echo ""
echo "Service URLs:"
echo "  Frontend:        http://localhost:3000"
echo "  FastAPI (DB):    http://localhost:8000"
echo "  LiveKit:         ws://localhost:7880"
echo "  PostgreSQL:      localhost:5432"
echo ""
echo "Useful commands:"
echo "  View all logs:        sudo docker-compose -f docker/docker-compose.yml logs -f"
echo "  View agent logs:      sudo docker logs -f agent786-agent"
echo "  View FastAPI logs:    sudo docker logs -f agent786-fastapi"
echo "  Restart services:     ./restart-all.sh"
echo "  Stop all services:    cd docker && sudo docker-compose down"
echo ""
if [ "$GPU_AVAILABLE" = true ]; then
    echo "🎮 GPU Mode: ENABLED"
    echo "   To verify GPU usage: sudo docker exec agent786-agent nvidia-smi"
else
    echo "💻 CPU Mode: ACTIVE"
    echo "   To enable GPU: Install nvidia-docker2 and restart"
fi
echo ""
echo "=========================================="
