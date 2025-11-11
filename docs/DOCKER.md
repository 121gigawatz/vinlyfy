# Docker Deployment Guide

This guide covers deploying Vinylfy using Docker and Docker Compose.

## 🐳 Prerequisites

### Install Docker
- **macOS**: [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)
- **Windows**: [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/)

### Verify Installation
```bash
docker --version
docker-compose --version
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/121gigawatz/vinylfy.git
cd vinylfy
```

### 2. Build and Run
```bash
# Using Makefile (recommended)
make build
make up

# OR using docker-compose directly
docker-compose up -d --build
```

### 3. Access Application
Open browser to: **http://localhost:8888**

## 📋 Makefile Commands

The Makefile provides convenient shortcuts:

```bash
make help          # Show all commands
make version       # Update version strings
make build         # Build Docker image
make up            # Start application
make down          # Stop application
make restart       # Restart application
make logs          # View application logs
make clean         # Remove containers and volumes
make clean-cache   # Remove build artifacts
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Port Configuration
PORT=8888                       # External port to expose

# Backend Config
FLASK_ENV=production            # production or development
DEBUG_MODE=false                # true for debug logging
SECRET_KEY=change-me-in-production  # IMPORTANT: Change this!

# File Upload
MAX_UPLOAD_MB=25               # Maximum file size in MB

# File Storage
FILE_TTL_HOURS=1               # How long to keep processed files

# CORS Settings
# Note: nginx proxies everything from same origin, so * is safe
CORS_ORIGINS=*
```

### Docker Compose Override

For custom configurations, create `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  vinylfy:
    ports:
      - "8080:80"  # Use different port
    environment:
      - MAX_UPLOAD_MB=50  # Larger uploads
      - FILE_TTL_HOURS=24  # Keep files longer
    volumes:
      - /path/to/persistent/storage:/tmp/vinylfy  # Custom storage
```

## 📦 Building the Image

### Standard Build
```bash
# Build with make
make build

# Or with docker-compose
docker-compose build

# Or with docker directly
docker build -t vinylfy:v1.0.0-beta-2.2.2 .
```

### Build with Specific Version

Before building, update the version:
```bash
# 1. Edit version
vim build/version.json

# 2. Update source files
make version

# 3. Build image
make build
```

### Build Arguments

The Dockerfile supports these build arguments:

```bash
docker build \
  --build-arg PYTHON_VERSION=3.11 \
  -t vinylfy:custom \
  .
```

## 🚀 Running the Container

### Using Docker Compose (Recommended)

**Start:**
```bash
docker-compose up -d
```

**Stop:**
```bash
docker-compose down
```

**View Logs:**
```bash
docker-compose logs -f
```

**Restart:**
```bash
docker-compose restart
```

### Using Plain Docker

```bash
# Run container
docker run -d \
  --name vinylfy \
  -p 8888:80 \
  -e FLASK_ENV=production \
  -e SECRET_KEY="your-secret-key" \
  -e CORS_ORIGINS="*" \
  -v vinylfy-data:/tmp/vinylfy \
  --restart unless-stopped \
  vinylfy:v1.0.0-beta-2.2.2

# View logs
docker logs -f vinylfy

# Stop container
docker stop vinylfy

# Remove container
docker rm vinylfy
```

## 📊 Monitoring

### Health Check

The container includes a health check:
```bash
# Check container health
docker ps

# Manual health check
curl http://localhost:8888/api/health
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Only errors
docker-compose logs -f | grep ERROR

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f vinylfy
```

### Container Stats

```bash
# Real-time stats
docker stats vinylfy

# All containers
docker stats
```

## 🔄 Updates and Upgrades

### Update to New Version

```bash
# 1. Pull latest code
git pull origin main

# 2. Update version (if needed)
vim build/version.json
make version

# 3. Rebuild and restart
make down
make build
make up

# OR combined:
docker-compose up -d --build
```

### Rolling Back

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout <previous-commit>

# Rebuild
make build
make up
```

## 💾 Data Persistence

### Volumes

By default, Docker Compose creates a named volume:
```yaml
volumes:
  vinylfy-data:
    driver: local
```

**View volumes:**
```bash
docker volume ls | grep vinylfy
```

**Backup volume:**
```bash
docker run --rm \
  -v vinylfy-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/vinylfy-$(date +%Y%m%d).tar.gz -C /data .
```

**Restore volume:**
```bash
docker run --rm \
  -v vinylfy-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/vinylfy-20241111.tar.gz -C /data
```

### Bind Mounts

For development, mount local directories:
```yaml
volumes:
  - ./table/app:/app/table/app  # Backend hot reload
  - ./needle:/app/needle         # Frontend hot reload
```

**Warning:** These are enabled by default in docker-compose.yml. Comment out for production!

## 🔐 Security

### Production Checklist

- [ ] Change `SECRET_KEY` to a random value
- [ ] Set `DEBUG_MODE=false`
- [ ] Set `FLASK_ENV=production`
- [ ] Remove development volume mounts
- [ ] Set appropriate `MAX_UPLOAD_MB`
- [ ] Configure firewall rules
- [ ] Use HTTPS (add reverse proxy)
- [ ] Set up log rotation
- [ ] Enable Docker security scanning

### Secrets Management

**Option 1: Environment file**
```bash
# Create .env file (don't commit to git!)
echo "SECRET_KEY=$(openssl rand -hex 32)" > .env
```

**Option 2: Docker secrets**
```yaml
secrets:
  secret_key:
    external: true

services:
  vinylfy:
    secrets:
      - secret_key
```

### Reverse Proxy (HTTPS)

Add Caddy or Traefik for automatic HTTPS:

**Using Caddy:**
```yaml
services:
  caddy:
    image: caddy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
```

**Caddyfile:**
```
vinylfy.yourdomain.com {
    reverse_proxy vinylfy:80
}
```

## 🌐 Production Deployment

### Cloud Platforms

**DigitalOcean:**
```bash
# Deploy to App Platform
doctl apps create --spec .do/app.yaml
```

**AWS ECS:**
```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin
docker tag vinylfy:latest <account>.dkr.ecr.us-east-1.amazonaws.com/vinylfy
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/vinylfy
```

**Google Cloud Run:**
```bash
# Push to GCR
docker tag vinylfy:latest gcr.io/<project>/vinylfy
docker push gcr.io/<project>/vinylfy
gcloud run deploy vinylfy --image gcr.io/<project>/vinylfy
```

### Docker Hub Distribution

```bash
# 1. Build image
make build

# 2. Tag for Docker Hub
docker tag vinylfy:v1.0.0-beta-2.2.2 yourusername/vinylfy:latest
docker tag vinylfy:v1.0.0-beta-2.2.2 yourusername/vinylfy:v1.0.0-beta-2.2.2

# 3. Push to Docker Hub
docker push yourusername/vinylfy:latest
docker push yourusername/vinylfy:v1.0.0-beta-2.2.2
```

**Users can then pull:**
```bash
docker pull yourusername/vinylfy:latest
docker run -d -p 8888:80 yourusername/vinylfy:latest
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs vinylfy

# Check if port is in use
lsof -i :8888
```

### Build Failures

```bash
# Clean build (no cache)
docker-compose build --no-cache

# Remove all images and rebuild
docker system prune -a
make build
```

### Performance Issues

```bash
# Check resource usage
docker stats vinylfy

# Increase resources in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 2G
```

### Permission Errors

The container runs as non-root user `vinylfy`. If you have permission issues:
```bash
# Check ownership
docker exec vinylfy ls -la /tmp/vinylfy

# Fix permissions
docker exec -u root vinylfy chown -R vinylfy:vinylfy /tmp/vinylfy
```

## 📚 Additional Resources

- [DEVELOPMENT.md](DEVELOPMENT.md) - Non-Docker development setup
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [build/WORKFLOW.md](../build/WORKFLOW.md) - Complete build workflow
- [build/VERSION_MANAGEMENT.md](../build/VERSION_MANAGEMENT.md) - Version system

## 🆘 Getting Help

- Run diagnostics: `docker-compose logs -f`
- Check health: `curl http://localhost:8888/api/health`
- GitHub Issues: https://github.com/121gigawatz/vinylfy/issues
