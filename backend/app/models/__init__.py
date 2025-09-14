# Organized model exports
from .evaluation_schemas import (
    EvaluateRequest,
    EvaluateResponse,
    ErrorResponse,
)
from .session_schemas import (
    AuthRequest,
    AuthResponse,
    AuthStatusResponse,
    SessionDataRequest,
    SessionDataResponse,
    SessionCountResponse,
)

# For backward compatibility, re-export all schemas
__all__ = [
    # Evaluation schemas
    "EvaluateRequest",
    "EvaluateResponse",
    "ErrorResponse",
    # Session schemas
    "AuthRequest",
    "AuthResponse",
    "AuthStatusResponse",
    "SessionDataRequest",
    "SessionDataResponse",
    "SessionCountResponse",
]
