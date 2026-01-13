#!/bin/bash

# Restart all services for GPU mode
echo "Stopping all agent-786 services..."
docker compose -f docker/docker-compose.yml down

echo "Cleaning up old containers..."
docker rm -f agent786-fastapi agent786-database-api agent786-agent 2>/dev/null || true

echo "Starting services with GPU support..."
docker compose -f docker/docker-compose.yml up -d --build

echo "Waiting for services to start..."
sleep 10

echo "Checking service status..."
docker compose -f docker/docker-compose.yml ps

echo ""
echo "Checking logs for errors..."
echo "=== Database API logs ==="
docker logs agent786-database-api --tail 20 2>&1 | tail -20

echo ""
echo "=== Agent logs ==="
docker logs agent786-agent --tail 20 2>&1 | tail -20

echo ""
echo "Service restart complete!"
