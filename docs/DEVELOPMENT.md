# Development Guide

This guide is for **developers** who want to:
- Build Vinylfy from source
- Make code changes
- Contribute to the project
- Run without Docker for faster iteration

**Regular users**: You don't need this! See the main [README.md](../README.md) to run the pre-built image.

## 📋 Prerequisites

### System Requirements
- Python 3.11+
- Node.js 18+ (optional, for frontend development)
- FFmpeg
- nginx (or any web server)

### macOS
```bash
brew install python@3.11 ffmpeg nginx
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install python3.11 python3.11-venv ffmpeg nginx libsndfile1
```

### Windows
```powershell
# Install Python from python.org
# Install FFmpeg: https://ffmpeg.org/download.html
# Install nginx: http://nginx.org/en/download.html
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/121gigawatz/vinylfy.git
cd vinylfy
```

### 2. Choose Your Path

**Option A: Use Makefile (Easiest)**
```bash
# All development commands are in build/Makefile
cd build && make help

# Common commands:
make dev-setup     # Set up Python environment
make dev-run       # Run Flask backend
make version       # Update version strings
make build         # Build Docker image
```

**Option B: Manual Setup**

Set up Python virtual environment:
```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate     # Windows
```

### 3. Install Python Dependencies
```bash
cd table
pip install -r requirements.txt
cd ..
```

### 4. Configure Environment
```bash
# Create .env file
cat > .env <<EOF
FLASK_ENV=development
DEBUG_MODE=true
SECRET_KEY=dev-secret-key-change-in-production
MAX_UPLOAD_MB=25
FILE_TTL_HOURS=1
CORS_ORIGINS=http://localhost:8888,http://localhost:5000,http://127.0.0.1:8888
EOF
```

### 5. Run Backend (Flask)
```bash
# Terminal 1: Run Flask backend
cd table
python3 -m flask --app app.main:app run --debug --port 5000

# Backend now running at http://localhost:5000
```

### 6. Serve Frontend (nginx or Python)

**Option A: Using nginx (recommended)**
```bash
# Terminal 2: Configure and start nginx
# Edit nginx.conf to point to your local paths
nginx -c $(pwd)/nginx.conf -p $(pwd)

# Frontend now running at http://localhost:80
```

**Option B: Using Python's HTTP server (quick)**
```bash
# Terminal 2: Serve frontend with Python
cd needle
python3 -m http.server 8888

# Frontend now running at http://localhost:8888
# NOTE: API calls to /api/ won't work without nginx proxy
```

**Option C: Using Node.js (if you have it)**
```bash
# Terminal 2: Serve with npx
cd needle
npx serve -p 8888

# Frontend now running at http://localhost:8888
```

### 7. Access Application
Open browser to:
- Frontend: http://localhost:8888 (or :80 with nginx)
- Backend API: http://localhost:5000/api/health

## 📁 Project Structure

```
vinylfy/
├── build/              # Build-time tools (version management)
│   ├── version.json    # Single source of truth
│   ├── update-version.py
│   └── VERSION_MANAGEMENT.md
│
├── docs/               # Documentation
│   ├── DEVELOPMENT.md  # This file
│   ├── DOCKER.md       # Docker deployment
│   └── TROUBLESHOOTING.md
│
├── needle/             # Frontend (static files)
│   ├── index.html
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   └── audio-player.js
│   ├── css/
│   └── service-worker.js
│
├── table/              # Backend (Flask API)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── routes.py
│   │   ├── config.py
│   │   └── processors/
│   └── requirements.txt
│
├── Makefile            # Build commands
├── nginx.conf          # Nginx configuration
└── .env               # Environment variables
```

## 🔧 Development Workflow

### Making Code Changes

**Frontend Changes:**
```bash
# Edit files in needle/
vim needle/js/app.js

# Changes are live - just refresh browser
# Service worker may cache - use Ctrl+Shift+R to hard refresh
```

**Backend Changes:**
```bash
# Edit files in table/app/
vim table/app/routes.py

# Flask auto-reloads in debug mode
# Just refresh browser to see changes
```

### Version Management

When you need to update the version:
```bash
# 1. Edit version
vim build/version.json

# 2. Update all files
make version
# OR: python3 build/update-version.py

# 3. Restart backend to load new version
# (Flask auto-reloads in debug mode)
```

## 🧪 Testing

### Run Backend Tests
```bash
cd table
pytest
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Get presets
curl http://localhost:5000/api/presets

# Get formats
curl http://localhost:5000/api/formats
```

### Frontend Testing
```bash
# Open DevTools (F12)
# Check Console for errors
# Test file upload and processing
```

## 📝 Environment Variables

Create a `.env` file in the project root:

```bash
# Backend Configuration
FLASK_ENV=development           # development or production
DEBUG_MODE=true                 # Enable debug logging
SECRET_KEY=your-secret-key      # Change in production!

# File Upload
MAX_UPLOAD_MB=25               # Max file size in MB

# File Storage
FILE_TTL_HOURS=1               # How long to keep processed files

# CORS (for development)
CORS_ORIGINS=http://localhost:8888,http://localhost:5000
```

## 🔍 Debugging

### Backend Debugging

**Enable verbose logging:**
```bash
export FLASK_ENV=development
export DEBUG_MODE=true
python3 -m flask --app app.main:app run --debug
```

**Use Python debugger:**
```python
# Add to your code
import pdb; pdb.set_trace()
```

### Frontend Debugging

**Browser DevTools:**
- F12 to open DevTools
- Console tab for JavaScript errors
- Network tab for API calls
- Application tab for Service Worker

**Disable Service Worker:**
```javascript
// In DevTools Console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
```

**Check Version:**
```javascript
// In DevTools Console
vinylDiagnostics()
```

## 🚨 Common Issues

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>
```

### FFmpeg Not Found
```bash
# Verify FFmpeg is installed
ffmpeg -version

# Add to PATH if needed
export PATH="/usr/local/bin:$PATH"
```

### CORS Errors
Make sure CORS_ORIGINS includes your frontend URL:
```bash
export CORS_ORIGINS="http://localhost:8888,http://localhost:5000"
```

### Module Not Found
```bash
# Make sure you're in virtual environment
source venv/bin/activate

# Reinstall dependencies
cd table
pip install -r requirements.txt
```

## 📦 Building for Production

When you're ready to deploy:

```bash
# 1. Update version
vim build/version.json
make version

# 2. Set production environment
export FLASK_ENV=production
export DEBUG_MODE=false
export SECRET_KEY="$(openssl rand -hex 32)"

# 3. Use production server (gunicorn)
cd table
gunicorn --bind 0.0.0.0:5000 \
  --workers 4 \
  --timeout 120 \
  app.main:app

# 4. Configure nginx for production
# See docs/DOCKER.md for production nginx config
```

## 🐳 Switching to Docker

If you want to switch from development to Docker:

```bash
# Stop local services (Ctrl+C)

# Build Docker image
make build

# Run with Docker
make up

# See docs/DOCKER.md for full Docker guide
```

## 💡 Development Tips

### Hot Reload
- Flask auto-reloads in debug mode
- Frontend changes are instant (just refresh)
- Service worker caching can interfere - use hard refresh

### Virtual Environment
Always activate before working:
```bash
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

### IDE Setup

**VS Code:**
```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black"
}
```

**PyCharm:**
- File → Settings → Project → Python Interpreter
- Select the venv/bin/python

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test

# Update version if needed
vim build/version.json
make version

# Commit
git add .
git commit -m "Add your feature"

# Push
git push origin feature/your-feature
```

## 📚 Additional Resources

- [DOCKER.md](DOCKER.md) - Docker deployment guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
- [build/VERSION_MANAGEMENT.md](../build/VERSION_MANAGEMENT.md) - Version system docs
- [build/WORKFLOW.md](../build/WORKFLOW.md) - Complete build workflow

## 🆘 Getting Help

If you run into issues:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Run diagnostics: Open browser console → `vinylDiagnostics()`
3. Check logs: Flask debug output and browser console
4. GitHub Issues: https://github.com/121gigawatz/vinylfy/issues
