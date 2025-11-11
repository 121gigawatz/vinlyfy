#!/bin/bash
set -e

# Vinylfy Version Update Script
# This script updates the version across all files from the centralized version.json
# Run from project root: ./build/update-version.sh

# Get the directory where this script lives (build/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔄 Updating Vinylfy version from build/version.json..."

# Check if version.json exists in build directory
if [ ! -f "$SCRIPT_DIR/version.json" ]; then
    echo "❌ Error: version.json not found in build/ directory!"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Read version information from version.json
VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$SCRIPT_DIR/version.json")
SHORT_VERSION=$(grep -oP '"shortVersion":\s*"\K[^"]+' "$SCRIPT_DIR/version.json")
DOCKER_TAG=$(grep -oP '"dockerTag":\s*"\K[^"]+' "$SCRIPT_DIR/version.json")

echo "📦 Version: $VERSION"
echo "📦 Short Version: $SHORT_VERSION"
echo "📦 Docker Tag: $DOCKER_TAG"

# Update frontend JavaScript files
echo ""
echo "📝 Updating frontend files..."

# Update app.js - APP_VERSION constant
sed -i.bak "s/const APP_VERSION = '.*';/const APP_VERSION = '$VERSION';/" needle/js/app.js
echo "  ✅ Updated needle/js/app.js APP_VERSION"

# Update all import statements in app.js
sed -i.bak "s/\\.js?v=[^'\"]*'/.js?v=$SHORT_VERSION'/g" needle/js/app.js
echo "  ✅ Updated needle/js/app.js import versions"

# Update index.html - CSS and JS version query params
sed -i.bak "s/\\.css?v=[^\"]*\"/\\.css?v=$SHORT_VERSION\"/g" needle/index.html
sed -i.bak "s/\\.js?v=[^\"]*\"/\\.js?v=$SHORT_VERSION\"/g" needle/index.html
echo "  ✅ Updated needle/index.html cache-busting versions"

# Update service-worker.js - cache names
sed -i.bak "s/const CACHE_NAME = 'vinylfy-.*';/const CACHE_NAME = 'vinylfy-$SHORT_VERSION';/" needle/service-worker.js
sed -i.bak "s/const RUNTIME_CACHE = 'vinylfy-runtime-.*';/const RUNTIME_CACHE = 'vinylfy-runtime-$SHORT_VERSION';/" needle/service-worker.js
echo "  ✅ Updated needle/service-worker.js cache names"

# Update backend __init__.py
echo ""
echo "📝 Updating backend files..."
sed -i.bak "s/__version__ = '.*'/__version__ = '$VERSION'/" table/app/__init__.py
echo "  ✅ Updated table/app/__init__.py version"

# Update docker-compose.yml - image tag
echo ""
echo "📝 Updating Docker configuration..."
sed -i.bak "s/image: vinylfy:.*/image: vinylfy:$DOCKER_TAG/" docker-compose.yml
echo "  ✅ Updated docker-compose.yml image tag"

# Update version check in app.js (the currentVersion variable used in cache clearing)
sed -i.bak "s/const currentVersion = '.*';/const currentVersion = '$SHORT_VERSION';/" needle/js/app.js
echo "  ✅ Updated needle/js/app.js currentVersion for cache clearing"

# Clean up backup files
find . -name "*.bak" -type f -delete
echo ""
echo "🧹 Cleaned up backup files"

echo ""
echo "✅ Version update complete!"
echo ""
echo "📋 Summary:"
echo "  • Version: $VERSION"
echo "  • Short Version: $SHORT_VERSION"
echo "  • Docker Tag: $DOCKER_TAG"
echo ""
echo "💡 Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Test the application"
echo "  3. Rebuild Docker image: docker-compose build"
echo "  4. Commit changes: git add . && git commit -m 'Update version to $VERSION'"
echo ""
