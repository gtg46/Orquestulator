# syntax=docker/dockerfile:1

ARG PYTHON_VERSION="3.11"
ARG DISTRO="-slim"
ARG HASH=""
FROM python:${PYTHON_VERSION}${DISTRO}${HASH}

# Set working directory
WORKDIR /orquestulator

# Install Python dependencies
RUN --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create dir for expected location of StackStorm connection config
RUN mkdir -p config

# Create non-root user and set ownership
ARG APP_USER="orquestulator"
ARG APP_UID="1000"
RUN useradd -m -u ${APP_UID} ${APP_USER} && chown -R ${APP_USER}:${APP_USER} /orquestulator
USER ${APP_USER}

# Set default host and port
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=7618

# Expose default port 7618
EXPOSE 7618

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${UVICORN_PORT}/health').read()" || exit 1

# Run the application
CMD ["uvicorn", "app.main:app"]
