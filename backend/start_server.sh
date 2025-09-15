#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Change to the directory where this script is located
cd "$(dirname "${BASH_SOURCE[0]}")"

# Load environment variables from .env file
set -a  # automatically export all variables
source .env 2>/dev/null || echo "Warning: .env file not found, using defaults"
set +a

# Use environment variables or defaults
BACKEND_HOST=${BACKEND_HOST:-localhost}
BACKEND_PORT=${BACKEND_PORT:-8000}

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found. Please install Python."
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)

if [[ "$PYTHON_VERSION" != "3.12."* ]]; then
    echo "Warning: Python $PYTHON_VERSION detected. Python 3.12 is recommended."
fi

# Check if running in a virtual environment (recommended)
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
    echo "Warning: Not running in a virtual environment."
    echo "Consider creating one and installing dependencies with:"
    echo "    python3 -m venv .venv"
    echo "    source .venv/bin/activate"
    echo "    pip install -r requirements.txt"
    echo
fi

# Display configuration
    echo "=== Orquestulator Backend Configuration ==="
    echo "Python: $PYTHON_VERSION"
    echo "Host: $BACKEND_HOST"
    echo "Port: $BACKEND_PORT"
    echo "==========================================="
    echo

echo "Starting Orquestulator backend server..."

uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT"
