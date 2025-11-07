# Main Dockerfile
# Build complete backend (table) and frontend (needle)

# 1 - Backend Dependencies
FROM python:3.11-slim as table-builder

WORKDIR /build

# Install sys dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    $$ rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY table/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 2 - Final Image

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Python packages from builder
COPY --from=table-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=table-builder /usr/local/bin /usr/local/bin

# Copy backend applicaton
COPY table/app /app/table/app

# Copy frontend application
COPY needle /app/needle

# Create non-root user
RUN useradd -m -u 1000 vinylfy && \
    chown -R vinylfy:vinylfy /app && \
    mkdir -p /tmp/vinylfy/uploads /tmp/vinylfy/processed && \
    chown -R vinylfy:vinylfy /tmp/vinylfy

# Configure nginx
COPY nginx.conf /etc/nginx/nginx.conf
RUN chown -R vinylfy:vinylfy /var/log/nginx /var/lib/nginx

# Expose ports
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh && chown vinylfy:vinylfy /app/start.sh

# Switch to non-root user
USER vinylfy

# Start both services
CMD ["/app/start.sh"]
