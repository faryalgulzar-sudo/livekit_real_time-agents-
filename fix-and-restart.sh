#!/bin/bash

# ============================================================================
# Agent-786 Complete Fix and Restart Script
# Fixes all configuration issues and restarts services with GPU support
# ============================================================================

set -e
cd /home/faryal/agent-786

echo "=========================================="
echo "🔧 Agent-786 Complete Fix & Restart"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# ============================================================================
# Step 1: Stop Everything
# ============================================================================
echo "Step 1: Stopping all services..."
echo "-------------------------------------------"

print_status "Killing all related processes..."
sudo pkill -9 -f "python.*agent\.py" 2>/dev/null || true
sudo pkill -9 -f "uvicorn" 2>/dev/null || true
sleep 2

print_status "Stopping and removing old Docker containers..."
sudo docker stop agent786-frontend agent786-fastapi agent786-agent agent786-database-api 2>/dev/null || true
sudo docker rm -f agent786-frontend agent786-fastapi agent786-agent agent786-database-api 2>/dev/null || true
sleep 2

print_status "All services stopped"
echo ""

# ============================================================================
# Step 2: Start Core Services
# ============================================================================
echo "Step 2: Starting core services..."
echo "-------------------------------------------"

# PostgreSQL
if sudo docker ps | grep -q dentist_postgres; then
    print_status "PostgreSQL already running"
else
    if sudo docker ps -a | grep -q dentist_postgres; then
        sudo docker start dentist_postgres
    else
        sudo docker run -d \
            --name dentist_postgres \
            -e POSTGRES_USER=dentist \
            -e POSTGRES_PASSWORD=dentist_pass \
            -e POSTGRES_DB=dentist_ai \
            -p 5432:5432 \
            --restart unless-stopped \
            postgres:16
    fi
    sleep 3
fi

# LiveKit
if sudo docker ps | grep -q livekit-server; then
    print_status "LiveKit already running"
else
    sudo docker rm -f livekit-server 2>/dev/null || true
    sudo docker run -d \
        --name livekit-server \
        -p 7880:7880 \
        -p 7881:7881 \
        -p 7882:7882/udp \
        -e "LIVEKIT_KEYS=devkey: secret" \
        --restart unless-stopped \
        livekit/livekit-server \
        --dev
    sleep 2
fi

print_status "Core services ready"
echo ""

# ============================================================================
# Step 3: Start LiveKit Token API (Port 8000)
# ============================================================================
echo "Step 3: Starting LiveKit Token API (Port 8000)..."
echo "-------------------------------------------"

cd docker
sudo docker-compose up -d fastapi 2>&1 | grep -v "Warning" || true
cd ..

sleep 3

if sudo docker ps | grep -q agent786-fastapi.*Up; then
    print_status "LiveKit Token API started on port 8000"
else
    print_error "Failed to start LiveKit Token API"
fi

echo ""

# ============================================================================
# Step 4: Start Database API (Port 8001)
# ============================================================================
echo "Step 4: Starting Database API (Port 8001)..."
echo "-------------------------------------------"

cd docker
sudo docker-compose up -d database-api 2>&1 | grep -v "Warning" || true
cd ..

sleep 3

if sudo docker ps | grep -q agent786-database-api.*Up; then
    print_status "Database API started on port 8001"
else
    print_warning "Database API may not be running - check logs"
fi

echo ""

# ============================================================================
# Step 5: Start Frontend (Port 3000)
# ============================================================================
echo "Step 5: Starting Frontend (Port 3000)..."
echo "-------------------------------------------"

cd docker
sudo docker-compose up -d frontend 2>&1 | grep -v "Warning" || true
cd ..

sleep 3

if sudo docker ps | grep -q agent786-frontend.*Up; then
    print_status "Frontend started on port 3000"
else
    print_error "Failed to start frontend"
fi

echo ""

# ============================================================================
# Step 6: Start Agent with GPU
# ============================================================================
echo "Step 6: Starting LiveKit Agent with GPU support..."
echo "-------------------------------------------"

cd docker
sudo docker-compose up -d agent 2>&1 | grep -v "Warning" || true
cd ..

sleep 5

if sudo docker ps | grep -q agent786-agent.*Up; then
    print_status "Agent container started"

    # Check GPU access
    if nvidia-smi > /dev/null 2>&1; then
        if sudo docker exec agent786-agent nvidia-smi > /dev/null 2>&1; then
            print_status "GPU access confirmed in agent container!"
        else
            print_warning "Agent started but GPU access not confirmed"
        fi
    fi
else
    print_error "Agent container failed to start"
fi

echo ""

# ============================================================================
# Step 7: Verify All Services
# ============================================================================
echo "=========================================="
echo "📊 Service Status"
echo "=========================================="

# Check each service
echo ""
echo "Container Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "agent786|livekit|postgres|NAME"

echo ""
echo "API Health Checks:"

# Check LiveKit Token API
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    print_status "LiveKit Token API (8000): Healthy"
else
    print_error "LiveKit Token API (8000): Not responding"
fi

# Check Database API
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    print_status "Database API (8001): Healthy"
else
    print_warning "Database API (8001): Not responding"
fi

# Check Frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_status "Frontend (3000): Accessible"
else
    print_error "Frontend (3000): Not responding"
fi

# Check LiveKit
if curl -s http://localhost:7880 > /dev/null 2>&1; then
    print_status "LiveKit Server (7880): Running"
else
    print_error "LiveKit Server (7880): Not responding"
fi

echo ""
echo "=========================================="
echo "🎉 Setup Complete!"
echo "=========================================="
echo ""
echo "Access Points:"
echo "  Frontend:          http://localhost:3000"
echo "  Token API:         http://localhost:8000/health"
echo "  Database API:      http://localhost:8001/health"
echo "  LiveKit Server:    ws://localhost:7880"
echo "  PostgreSQL:        localhost:5432"
echo ""
echo "View Logs:"
echo "  All services:      sudo docker-compose -f docker/docker-compose.yml logs -f"
echo "  Agent logs:        sudo docker logs -f agent786-agent"
echo "  Token API logs:    sudo docker logs -f agent786-fastapi"
echo "  Database API logs: sudo docker logs -f agent786-database-api"
echo "  Frontend logs:     sudo docker logs -f agent786-frontend"
echo ""
echo "Troubleshooting:"
echo "  Check agent:       sudo docker exec -it agent786-agent bash"
echo "  Check GPU:         sudo docker exec agent786-agent nvidia-smi"
echo "  Restart all:       ./fix-and-restart.sh"
echo ""
echo "=========================================="
