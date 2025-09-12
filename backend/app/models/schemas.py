from pydantic import BaseModel
from typing import Any, Dict, Optional, Literal


class EvaluateRequest(BaseModel):
    expression: str
    data: Dict[str, Any]  # Backend only accepts JSON dict format
    query_type: Optional[Literal["yaql", "jinja2", "orquesta"]] = None


class EvaluateResponse(BaseModel):
    result: Any
    query_type: str


class ErrorResponse(BaseModel):
    error: str
    query_type: str


# Session Authentication Models
class AuthRequest(BaseModel):
    passphrase: str


class AuthResponse(BaseModel):
    success: bool
    message: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    last_activity: Optional[str] = None


class SessionDataRequest(BaseModel):
    data: Dict[str, Any]


class SessionDataResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
