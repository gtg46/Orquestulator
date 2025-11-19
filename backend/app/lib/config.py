"""
Configuration management for Orquestulator backend.
Handles environment variables and configuration file loading.
"""

import os
import json
from typing import Dict, Optional, Any
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Configuration management class for Orquestulator backend."""

    def __init__(self):
        """Initialize configuration from environment variables."""

        # Authentication
        self.PASSPHRASE_AUTH = os.getenv("PASSPHRASE_AUTH", "true").lower() == "true"
        self.PASSPHRASE = os.getenv("PASSPHRASE", "Ch@ngeMe")

        # Session Management
        self.SESSION_TIMEOUT_HOURS = int(os.getenv("SESSION_TIMEOUT_HOURS", "4"))
        self.SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "session_id")
        self.SESSION_COOKIE_SECURE = (
            os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
        )
        self.SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax")
        self.PROACTIVE_SESSION_CLEANUP = (
            os.getenv("PROACTIVE_SESSION_CLEANUP", "true").lower() == "true"
        )

        # Rate Limiting
        self.AUTH_RATE_LIMIT = os.getenv("AUTH_RATE_LIMIT", "5/minute")

        # API Documentation - Swagger UI provides interactive API documentation
        self.SWAGGER_UI = os.getenv("SWAGGER_UI", "true").lower() == "true"

        # StackStorm Configuration
        self.STACKSTORM_CONNECTIONS_CONFIG = os.getenv(
            "STACKSTORM_CONNECTIONS_CONFIG", "./config/stackstorm-connections.json"
        )

        # Load StackStorm connections
        self._stackstorm_connections = None
        self._load_stackstorm_connections()

    def _load_stackstorm_connections(self) -> None:
        """Load StackStorm connections from configuration file."""
        try:
            config_path = Path(self.STACKSTORM_CONNECTIONS_CONFIG)
            if config_path.exists():
                with open(config_path, "r") as f:
                    self._stackstorm_connections = json.load(f)
            else:
                print(
                    f"Warning: StackStorm connections config not found at {config_path}"
                )
                self._stackstorm_connections = {"default": None, "connections": []}
        except Exception as e:
            print(f"Error loading StackStorm connections config: {e}")
            self._stackstorm_connections = {"default": None, "connections": []}

    def get_stackstorm_connections(self) -> Dict[str, Any]:
        """Get all StackStorm connections."""
        return self._stackstorm_connections or {"default": None, "connections": []}

    def get_default_stackstorm_connection(self) -> Optional[Dict[str, Any]]:
        """Get the default StackStorm connection."""
        if not self._stackstorm_connections:
            return None

        default_id = self._stackstorm_connections.get("default")
        if not default_id:
            return None

        for connection in self._stackstorm_connections.get("connections", []):
            if connection.get("id") == default_id:
                return connection

        return None

    def get_stackstorm_connection_by_id(
        self, connection_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific StackStorm connection by ID."""
        if not self._stackstorm_connections:
            return None

        for connection in self._stackstorm_connections.get("connections", []):
            if connection.get("id") == connection_id:
                return connection

        return None

    def get_cookie_settings(self) -> Dict[str, Any]:
        """Get session cookie settings based on environment."""
        return {
            "httponly": True,
            "secure": self.SESSION_COOKIE_SECURE,
            "samesite": self.SESSION_COOKIE_SAMESITE,
        }


# Global configuration instance
config = Config()
