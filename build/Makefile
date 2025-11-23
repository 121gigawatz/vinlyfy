.PHONY: help version build up down restart logs clean dev-setup dev-run dev-stop

# Default target
help:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║                  Vinylfy - Makefile Commands                  ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📋 Getting Started:"
	@echo "  make help             Show this help message"
	@echo ""
	@echo "🔧 Version Management:"
	@echo "  make version          Update version strings from build/version.json"
	@echo ""
	@echo "🐳 Docker Deployment (Production/Testing):"
	@echo "  make build            Build the Docker image"
	@echo "  make up               Start the application"
	@echo "  make down             Stop the application"
	@echo "  make restart          Restart the application"
	@echo "  make logs             View application logs"
	@echo ""
	@echo "💻 Local Development (No Docker):"
	@echo "  make dev-setup        Set up Python virtual environment"
	@echo "  make dev-run          Run backend locally (Flask development server)"
	@echo "  make dev-stop         Stop local development servers"
	@echo ""
	@echo "🧹 Maintenance:"
	@echo "  make clean            Remove Docker containers and volumes"
	@echo "  make clean-cache      Remove all caches and build artifacts"
	@echo "  make clean-all        Remove everything (Docker + venv + caches)"
	@echo ""
	@echo "📚 Documentation:"
	@echo "  docs/DOCKER.md        Docker deployment guide"
	@echo "  docs/DEVELOPMENT.md   Local development setup"
	@echo "  docs/TROUBLESHOOTING.md  Common issues and fixes"
	@echo ""
	@echo "🚀 Quick Start Workflows:"
	@echo ""
	@echo "  Docker Deployment:"
	@echo "    1. make build && make up"
	@echo "    2. Open http://localhost:8888"
	@echo ""
	@echo "  Local Development:"
	@echo "    1. make dev-setup"
	@echo "    2. make dev-run"
	@echo "    3. Open http://localhost:5000 (backend)"
	@echo "    4. Serve needle/ folder with your preferred server"
	@echo ""
	@echo "  Version Update:"
	@echo "    1. Edit build/version.json"
	@echo "    2. make version"
	@echo "    3. make build (for Docker) or restart dev server"
	@echo ""

# Update version strings across all files
version:
	@echo "Updating version strings..."
	@python3 ../scripts/update_version.py
	@echo ""
	@echo "✅ Version update complete!"
	@echo "   Review changes with: git diff"
	@echo ""

# Build Docker image (for development)
build:
	@echo "Building Docker image from source..."
	@cd .. && docker-compose -f docker-compose.dev.yml build
	@echo ""
	@echo "✅ Build complete!"
	@echo ""

# Start application (development with volume mounts)
up:
	@echo "Starting Vinylfy (development mode)..."
	@cd .. && docker-compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "✅ Vinylfy is running!"
	@echo "   Access at: http://localhost:8888"
	@echo "   View logs: make logs"
	@echo ""

# Stop application
down:
	@echo "Stopping Vinylfy..."
	@cd .. && docker-compose -f docker-compose.dev.yml down
	@echo ""
	@echo "✅ Vinylfy stopped"
	@echo ""

# Restart application
restart: down up

# View logs
logs:
	@cd .. && docker-compose -f docker-compose.dev.yml logs -f

# Clean up Docker resources
clean:
	@echo "Cleaning up Docker resources..."
	@cd .. && docker-compose -f docker-compose.dev.yml down -v
	@echo ""
	@echo "✅ Cleanup complete"
	@echo ""

# Clean all caches and build artifacts
clean-cache:
	@echo "Cleaning caches and build artifacts..."
	@cd .. && find . -name "*.bak" -type f -delete 2>/dev/null || true
	@cd .. && find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	@cd .. && find . -name "*.pyc" -delete 2>/dev/null || true
	@echo ""
	@echo "✅ Cache cleanup complete"
	@echo ""

# Clean everything including virtual environment
clean-all: clean clean-cache
	@echo "Removing virtual environment..."
	@cd .. && rm -rf venv
	@echo ""
	@echo "✅ Complete cleanup done"
	@echo ""

# ============================================================================
# Local Development Commands (No Docker)
# ============================================================================

# Set up Python virtual environment
dev-setup:
	@echo "Setting up Python virtual environment..."
	@cd .. && python3 -m venv venv
	@echo ""
	@echo "Installing dependencies..."
	@cd .. && ./venv/bin/pip install -r table/requirements.txt
	@echo ""
	@echo "✅ Development environment setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Activate venv: source ../venv/bin/activate"
	@echo "  2. Run backend: make dev-run"
	@echo "  3. Serve frontend: cd ../needle && python3 -m http.server 8888"
	@echo ""
	@echo "See docs/DEVELOPMENT.md for full setup guide"
	@echo ""

# Run Flask development server
dev-run:
	@echo "Starting Flask development server..."
	@echo ""
	@echo "Backend will run at: http://localhost:5000"
	@echo "Frontend needs separate server (see docs/DEVELOPMENT.md)"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@echo ""
	@cd ../table && ../venv/bin/python3 -m flask --app app.main:app run --debug --port 5000

# Stop development servers (placeholder - requires manual Ctrl+C)
dev-stop:
	@echo "To stop development servers:"
	@echo "  - Press Ctrl+C in the terminal running Flask"
	@echo "  - Press Ctrl+C in the terminal serving frontend"
	@echo ""
	@echo "To kill all Python processes (use with caution):"
	@echo "  pkill -f 'flask.*app.main'"
	@echo ""
