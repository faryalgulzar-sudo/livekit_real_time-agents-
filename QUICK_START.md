# Quick Start - LiveKit Realtime Agent

**Everything runs via Docker Compose!**

## Start Services
```bash
cd /home/saif/Desktop/Workspace/TheCloudOps/livekit-realtime/docker
docker compose up -d
```

## Stop Services
```bash
docker compose down
```

## Check Status
```bash
docker compose ps
curl http://localhost:8000/health
curl http://localhost:8000/health/db
```

## Access Services
- **Frontend**: http://localhost:3001
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f agent
docker compose logs -f fastapi
docker compose logs -f postgres
```

## Restart Service
```bash
docker compose restart agent
```

## Full Documentation
See [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md) for complete details.

---

**Status**: ✅ All services running
**Date**: January 14, 2026
