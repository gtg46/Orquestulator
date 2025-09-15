from pydantic import BaseModel
from typing import Any, Dict, Optional


class AuthRequest(BaseModel):
    passphrase: Optional[str] = None


class AuthResponse(BaseModel):
    success: bool
    message: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    passphrase_required: bool
    last_activity: Optional[str] = None


class SessionDataRequest(BaseModel):
    data: Dict[str, Any]


class SessionDataResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


class SessionCountResponse(BaseModel):
    total_sessions: int
    active_sessions: int
