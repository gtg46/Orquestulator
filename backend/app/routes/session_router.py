from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
import os
from app.auth.session_manager import session_manager
from app.middleware.auth import get_session_id_from_request, require_valid_session
from app.models.schemas import (
    AuthRequest,
    AuthResponse,
    AuthStatusResponse,
    SessionDataRequest,
    SessionDataResponse,
)

router = APIRouter()

# Configuration
PASSPHRASE = os.getenv("ORQ_PASSPHRASE", "orquesta2025")  # Default for development
COOKIE_NAME = "orq_session"
COOKIE_SETTINGS = {
    "httponly": True,
    "secure": False,  # Set to True in production with HTTPS
    "samesite": "lax",  # Allow cross-site requests for development
}


# Endpoints
@router.post("/auth", response_model=AuthResponse)
async def authenticate(request: AuthRequest, response: Response):
    """
    Authenticate user with passphrase and create session
    """
    if request.passphrase != PASSPHRASE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passphrase"
        )

    # Create new session
    session_id = session_manager.create_session({"authenticated": True})

    # Set session cookie
    response.set_cookie(key=COOKIE_NAME, value=session_id, **COOKIE_SETTINGS)

    return AuthResponse(success=True, message="Successfully authenticated")


@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status(request: Request):
    """
    Check if user is authenticated
    """
    session_id = get_session_id_from_request(request)
    if not session_id:
        return AuthStatusResponse(authenticated=False)

    session = session_manager.get_session(session_id)
    if not session:
        return AuthStatusResponse(authenticated=False)

    return AuthStatusResponse(
        authenticated=True,
        last_activity=session["last_activity"].isoformat(),
    )


@router.post("/data", response_model=SessionDataResponse)
async def store_session_data(
    request: SessionDataRequest, session_id: str = Depends(require_valid_session)
):
    """
    Store sensitive data in server-side session (e.g., API keys)
    """
    success = session_manager.set_session_data(session_id, request.data)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store session data",
        )

    return SessionDataResponse(
        success=True, message="Successfully stored data in session"
    )


@router.get("/data", response_model=SessionDataResponse)
async def get_session_data(session_id: str = Depends(require_valid_session)):
    """
    Retrieve all data from server-side session
    """
    data = session_manager.get_session_data(session_id)

    if data is None:
        # This shouldn't happen if require_valid_session works correctly
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session not found",
        )

    return SessionDataResponse(success=True, data=data)
