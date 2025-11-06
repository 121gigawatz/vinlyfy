# Python 3.11 slim for smaller size
FROM python:3.11-slim

# Set environment variales
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install sys dep for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 vinylfy && \
    chown -R vinylfy:vinylfy /app

# Copy requirements first 
COPY --chown=vinylfy:vinylfy requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=vinylfy:vinylfy ./app ./app

# Create temp upload directory
RUN mkdir -p /tmp/vinylfy/uploads && \
    chown -R vinylfy:vinylfy /tmp/vinylfy

# Switch to non-root user
USER vinylfy

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Run app with gunicorn in prod
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "app.main:app"]
