from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.lib.config import config
from app.lib.session_manager import session_manager
from app.lib.auth_middleware import (
    get_session_id_from_request,
    require_valid_session,
)
from app.models.session_schemas import (
    AuthRequest,
    AuthResponse,
    AuthStatusResponse,
    SessionDataRequest,
    SessionDataResponse,
    SessionCountResponse,
)

router = APIRouter()

# Get limiter from app state (set in main.py)
limiter = Limiter(key_func=get_remote_address)


# Endpoints
@router.post("/auth", response_model=AuthResponse)
@limiter.limit(config.AUTH_RATE_LIMIT)  # Use configurable rate limit
async def authenticate(request: Request, auth_request: AuthRequest, response: Response):
    """
    Authenticate user with passphrase and create session
    """
    # If passphrase authentication is enabled, check passphrase
    if config.PASSPHRASE_AUTH:
        if not auth_request.passphrase or auth_request.passphrase != config.PASSPHRASE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passphrase"
            )

    # Create new session
    session_id = session_manager.create_session()

    # Set session cookie
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME, value=session_id, **config.get_cookie_settings()
    )

    return AuthResponse(success=True, message="Successfully authenticated")


@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status(request: Request):
    """
    Check if user is authenticated and return auth configuration
    """
    session_id = get_session_id_from_request(request)
    if not session_id:
        return AuthStatusResponse(
            authenticated=False, passphrase_required=config.PASSPHRASE_AUTH
        )

    session = session_manager.get_session(session_id)
    if not session:
        return AuthStatusResponse(
            authenticated=False, passphrase_required=config.PASSPHRASE_AUTH
        )

    return AuthStatusResponse(
        authenticated=True,
        passphrase_required=config.PASSPHRASE_AUTH,
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


@router.get("/count", response_model=SessionCountResponse)
async def get_session_count(session_id: str = Depends(require_valid_session)):
    """
    Get session count information for monitoring (auth required)
    """
    count_info = session_manager.get_session_count_info()
    return SessionCountResponse(**count_info)
