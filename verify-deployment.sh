#!/bin/bash
# Verify all files needed for deployment are present

echo "🔍 Verifying Vinylfy deployment requirements..."

# Required files
REQUIRED_FILES=(
    "Dockerfile"
    "docker-compose.yml"
    "docker-compose.prod.yml"
    "start.sh"
    "nginx.conf"
    ".env.example"
    "README.md"
    "DEPLOY.md"
)

# Required directories
REQUIRED_DIRS=(
    "table/app"
    "needle"
)

MISSING_FILES=()
MISSING_DIRS=()

# Check files
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

# Check directories
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

# Report results
if [ ${#MISSING_FILES[@]} -eq 0 ] && [ ${#MISSING_DIRS[@]} -eq 0 ]; then
    echo "✅ All required files and directories are present"
    echo ""
    echo "You can now run:"
    echo "  docker-compose up -d"
    echo ""
    echo "Or for production:"
    echo "  docker-compose -f docker-compose.prod.yml up -d"
    exit 0
else
    echo "❌ Missing required files or directories:"

    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        echo ""
        echo "Missing files:"
        for file in "${MISSING_FILES[@]}"; do
            echo "  - $file"
        done
    fi

    if [ ${#MISSING_DIRS[@]} -gt 0 ]; then
        echo ""
        echo "Missing directories:"
        for dir in "${MISSING_DIRS[@]}"; do
            echo "  - $dir"
        done
    fi

    echo ""
    echo "Please ensure you've extracted the complete release tarball."
    exit 1
fi
