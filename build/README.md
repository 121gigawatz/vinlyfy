# Build Tools (For Developers Only)

This directory contains build-time tools for **developers and contributors**.

**Regular users**: You don't need anything in this directory! See the main [README.md](../README.md) to run the pre-built image.

## Contents

- **Makefile** - All development commands (version, build, dev-setup, etc.)
- **version.json** - Single source of truth for version numbers
- **update-version.py** - Python script to update version across all files
- **update-version.sh** - Bash script (alternative to Python)
- **VERSION_MANAGEMENT.md** - Detailed version system documentation
- **WORKFLOW.md** - Visual build process and deployment guide
- **README.md** - This file

## 🚀 Quick Start (Developers)

### View All Commands
```bash
cd build
make help
```

### Common Tasks

**Update Version:**
```bash
# 1. Edit version.json
vim version.json

# 2. Update all files
make version

# 3. Rebuild Docker image
make build
```

**Local Development:**
```bash
# Set up environment
make dev-setup

# Run Flask backend
make dev-run

# In another terminal, serve frontend
cd ../needle && python3 -m http.server 8888
```

**Docker Development:**
```bash
# Build from source
make build

# Run with hot-reload
make up

# View logs
make logs

# Stop
make down
```

## 🔒 Security

**These files are excluded from deployment:**
- ✅ Excluded from Docker images via `../.dockerignore`
- ✅ Not served by nginx
- ✅ Not accessible at runtime
- ✅ Only exist in source repository

This ensures version numbers cannot be tampered with after deployment.

## 📚 Documentation

- **[Makefile](Makefile)** - Run `make help` for all commands
- **[VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md)** - Complete version system docs
- **[WORKFLOW.md](WORKFLOW.md)** - Build process visualization
- **[../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)** - Full development guide

## 🎯 For Contributors

See [../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) for:
- Development setup
- Making code changes
- Running tests
- Contribution guidelines
