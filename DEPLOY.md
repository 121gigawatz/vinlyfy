# Vinylfy Beta - Deployment Guide

## Quick Start with Docker

### Prerequisites
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

### Option 1: Deploy from GitHub Release (Recommended)

1. **Download the beta release:**
   ```bash
   # Download the release tarball
   curl -L https://github.com/121gigawatz/vinlyfy/archive/refs/tags/beta.tar.gz -o vinylfy-beta.tar.gz

   # Extract it
   tar -xzf vinylfy-beta.tar.gz
   cd vinlyfy-beta
   ```

2. **Build and run:**
   ```bash
   # Build the Docker image
   docker-compose -f docker-compose.prod.yml up -d

   # Or use the standard docker-compose.yml if you want to modify code
   docker-compose up -d
   ```

3. **Access the application:**
   - Open your browser to: http://localhost:8888
   - The API health endpoint: http://localhost:8888/api/health

### Option 2: Clone from GitHub

1. **Clone the repository:**
   ```bash
   git clone https://github.com/121gigawatz/vinlyfy.git
   cd vinlyfy
   git checkout beta
   ```

2. **Build and run:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Open your browser to: http://localhost:8888

## Configuration

### Environment Variables

Create a `.env` file in the project root to customize settings:

```env
# Port to run on (default: 8888)
PORT=8888

# Flask environment (default: production)
FLASK_ENV=production

# Debug mode (default: false)
DEBUG_MODE=false

# Secret key for Flask (CHANGE THIS IN PRODUCTION!)
SECRET_KEY=your-secret-key-here

# Maximum upload file size in MB (default: 25)
MAX_UPLOAD_MB=25

# How long to keep processed files in hours (default: 1)
FILE_TTL_HOURS=1
```

### Custom Port

To run on a different port, either:
- Set `PORT=3000` in your `.env` file, or
- Run: `PORT=3000 docker-compose up -d`

## Troubleshooting

### Port Already in Use
If port 8888 is already in use:
```bash
# Stop the container
docker-compose down

# Change the port
PORT=9000 docker-compose up -d
```

### View Logs
```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View only recent logs
docker-compose logs --tail=50
```

### Restart the Application
```bash
docker-compose restart
```

### Rebuild from Scratch
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up Everything
```bash
# Stop and remove containers, networks
docker-compose down

# Also remove volumes (this deletes processed files)
docker-compose down -v
```

## Updating to a New Version

```bash
# Stop the current version
docker-compose down

# Pull the new release
curl -L https://github.com/121gigawatz/vinlyfy/archive/refs/tags/[NEW_VERSION].tar.gz -o vinylfy-new.tar.gz
tar -xzf vinylfy-new.tar.gz
cd vinylfy-[NEW_VERSION]

# Build and start
docker-compose up -d
```

## Health Check

Verify the application is running correctly:

```bash
curl http://localhost:8888/api/health
```

Expected response:
```json
{"service":"vinylfy-table","status":"healthy","version":"beta"}
```

## System Requirements

- **CPU:** 2 cores recommended (minimum 0.5)
- **RAM:** 1GB recommended (minimum 256MB)
- **Disk:** ~500MB for Docker image + space for uploaded/processed audio files
- **OS:** Any OS that supports Docker (Linux, macOS, Windows)

## Security Notes

1. **Change the SECRET_KEY** if deploying to production
2. The application runs on a non-root user inside the container
3. File uploads are limited to 25MB by default
4. Processed files are automatically cleaned up after 1 hour
5. CORS is restricted to localhost by default

## Support

- Issues: https://github.com/121gigawatz/vinlyfy/issues
- Documentation: See README.md
