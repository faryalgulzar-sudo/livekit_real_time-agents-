#!/bin/bash

# Colors for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}   AGENT 786 - LIVE PIPELINE MONITOR${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

# Check service status
echo -e "${CYAN}[1] Checking Service Status...${NC}"
echo "----------------------------------------"

check_service() {
    local name=$1
    local container=$2
    if sudo docker ps --format '{{.Names}}' | grep -q "$container"; then
        echo -e "  ${GREEN}✅ $name: RUNNING${NC}"
        return 0
    else
        echo -e "  ${RED}❌ $name: NOT RUNNING${NC}"
        return 1
    fi
}

check_service "Agent" "agent786-agent"
check_service "FastAPI" "agent786-fastapi"
check_service "Frontend" "agent786-frontend"

echo ""
echo -e "${CYAN}[2] Checking Endpoints...${NC}"
echo "----------------------------------------"

# Check FastAPI health
if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo -e "  ${GREEN}✅ FastAPI /health: OK${NC}"
else
    echo -e "  ${RED}❌ FastAPI /health: FAILED${NC}"
fi

# Check Frontend
if curl -s http://localhost:3000 | grep -q "Agent 007"; then
    echo -e "  ${GREEN}✅ Frontend: OK${NC}"
else
    echo -e "  ${RED}❌ Frontend: FAILED${NC}"
fi

# Check RAG endpoint
RAG_TEST=$(curl -s -X POST http://localhost:8000/v1/kb/query \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"demo_clinic","query":"timing","top_k":1}' 2>/dev/null)
if echo "$RAG_TEST" | grep -q "chunks"; then
    echo -e "  ${GREEN}✅ RAG /v1/kb/query: OK${NC}"
else
    echo -e "  ${YELLOW}⚠️  RAG /v1/kb/query: No data or error${NC}"
fi

echo ""
echo -e "${CYAN}[3] LiveKit Agent Status...${NC}"
echo "----------------------------------------"
AGENT_STATUS=$(sudo docker logs agent786-agent --tail 20 2>&1 | grep -E "registered worker" | tail -1)
if [ -n "$AGENT_STATUS" ]; then
    echo -e "  ${GREEN}✅ Agent registered with LiveKit${NC}"
else
    echo -e "  ${RED}❌ Agent not registered${NC}"
fi

echo ""
echo -e "${PURPLE}============================================${NC}"
echo -e "${YELLOW}[4] LIVE LOGS - Press Ctrl+C to stop${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""
echo -e "${BLUE}Legend:${NC}"
echo -e "  ${GREEN}[AGENT]${NC} = Voice Agent logs"
echo -e "  ${CYAN}[API]${NC} = FastAPI backend logs"
echo ""
echo "Waiting for activity... Connect from browser at http://localhost:3000"
echo "----------------------------------------"

# Stream logs from both agent and fastapi
sudo docker logs -f agent786-agent 2>&1 | while read line; do
    # Color code based on content
    if echo "$line" | grep -qE "(ERROR|❌|Failed|Exception)"; then
        echo -e "${RED}[AGENT] $line${NC}"
    elif echo "$line" | grep -qE "(✅|SUCCESS|connected|GREETING|INTAKE|RAG)"; then
        echo -e "${GREEN}[AGENT] $line${NC}"
    elif echo "$line" | grep -qE "(STT|TTS|Transcript|speaking|audio)"; then
        echo -e "${YELLOW}[AGENT] $line${NC}"
    elif echo "$line" | grep -qE "(LLM|Ollama|gemma)"; then
        echo -e "${PURPLE}[AGENT] $line${NC}"
    elif echo "$line" | grep -qE "(participant|room|job)"; then
        echo -e "${CYAN}[AGENT] $line${NC}"
    else
        echo "[AGENT] $line"
    fi
done &

AGENT_PID=$!

# Cleanup on exit
trap "kill $AGENT_PID 2>/dev/null; echo ''; echo 'Monitor stopped.'; exit 0" SIGINT SIGTERM

# Keep running
wait
