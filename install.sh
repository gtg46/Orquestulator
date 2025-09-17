#!/bin/bash
set -euo pipefail

# Simple installation script for Orquestulator Backend Service

echo "=== Orquestulator Backend Installation ==="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Create orquestulator user if it doesn't exist
if ! id "orquestulator" &>/dev/null; then
    echo "Creating orquestulator user..."
    useradd --system --home-dir /opt/orquestulator --create-home --shell /usr/sbin/nologin orquestulator
else
    echo "User 'orquestulator' already exists"
fi

# Create installation directory
echo "Setting up installation directory..."
mkdir -p /opt/orquestulator
cp -r . /opt/orquestulator/
chown -R orquestulator:orquestulator /opt/orquestulator

# Create Python virtual environment
echo "Creating Python virtual environment..."
sudo -u orquestulator python3 -m venv /opt/orquestulator/backend/.venv

# Install Python dependencies
echo "Installing Python dependencies..."
sudo -u orquestulator /opt/orquestulator/backend/.venv/bin/pip install -r /opt/orquestulator/backend/requirements.txt

# Install systemd service
echo "Installing systemd service..."
cp orquestulator-backend.service /etc/systemd/system/
systemctl daemon-reload

echo "=== Installation Complete ==="
