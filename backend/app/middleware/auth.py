from fastapi import HTTPException, Request, status
from typing import Optional
import os
from app.auth.session_manager import session_manager

# Configuration
COOKIE_NAME = "orq_session"


def get_session_id_from_request(request: Request) -> Optional[str]:
    """Extract session ID from request cookies"""
    return request.cookies.get(COOKIE_NAME)


def require_valid_session(request: Request) -> str:
    """Dependency to require a valid session. Returns session ID or raises HTTPException."""
    session_id = get_session_id_from_request(request)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No session found. Please authenticate.",
        )

    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please authenticate again.",
        )

    return session_id
