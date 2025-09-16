from fastapi import APIRouter, HTTPException, Depends, status
from app.lib.auth_middleware import require_valid_session
from app.lib.config import config
from app.lib.session_manager import session_manager
from app.models.stackstorm_schemas import (
    ExecutionResponse,
    ExecutionsListResponse,
    ConnectionInfo,
    ConnectionResponse,
    ConnectionRequest,
    ConnectionUpdateResponse,
    ConnectionTestResponse,
)
import httpx

router = APIRouter()


def _get_stackstorm_config_from_session(session_id: str) -> dict:
    """
    Helper function to get StackStorm configuration from user session.
    Falls back to default connection if no connection is configured.
    Returns the connection config as a dictionary with 'url' and 'api_key'.
    """
    session_data = session_manager.get_session_data(session_id)
    current_connection = None

    # Try to get user's configured connection
    if session_data and session_data.get("stackstorm_connection"):
        stackstorm_connection = session_data["stackstorm_connection"]
        current_connection = stackstorm_connection.get("current")

        # If user has a custom connection configured
        if current_connection == "custom":
            custom_connection = stackstorm_connection.get("custom_connection")
            if not custom_connection:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom connection selected but no custom connection data found.",
                )
            return {
                "url": custom_connection.get("url"),
                "api_key": custom_connection.get("api_key"),
            }

    # If no connection configured, fall back to default
    if not current_connection:
        connections_config = config.get_stackstorm_connections()
        default_connection_id = connections_config.get("default")
        if default_connection_id:
            current_connection = default_connection_id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No StackStorm connection configured and no default connection available.",
            )

    # Get the preconfigured connection (either user-selected or default)
    connection_config = config.get_stackstorm_connection_by_id(current_connection)
    if not connection_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection '{current_connection}' not found in preconfigured connections.",
        )

    return {
        "url": connection_config.get("url"),
        "api_key": connection_config.get("api_key"),
    }


@router.get("/connection", response_model=ConnectionResponse)
async def get_connection(session_id: str = Depends(require_valid_session)):
    """
    Get available preconfigured connections and user's current connection configuration
    """
    try:
        # Get preconfigured connections
        connections_config = config.get_stackstorm_connections()
        connection_list = []
        for conn in connections_config.get("connections", []):
            connection_list.append(
                ConnectionInfo(
                    id=conn.get("id", ""),
                    alias=conn.get("alias", conn.get("id", "Unknown")),
                )
            )

        # Get user's current connection config from session
        session_data = session_manager.get_session_data(session_id)
        current_connection = None
        custom_connection = None

        if session_data and session_data.get("stackstorm_connection"):
            stackstorm_connection = session_data["stackstorm_connection"]
            current_connection = stackstorm_connection.get("current")
            custom_connection = stackstorm_connection.get("custom_connection")

        return ConnectionResponse(
            connections=connection_list,
            default=connections_config.get("default"),
            current=current_connection,
            custom_connection=custom_connection,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load connection configuration: {str(e)}",
        )


@router.put("/connection", response_model=ConnectionUpdateResponse)
async def set_connection(
    connection_request: ConnectionRequest,
    session_id: str = Depends(require_valid_session),
):
    """
    Set the user's StackStorm connection configuration
    """
    try:
        # Validate the connection request
        if connection_request.current == "custom":
            if not connection_request.custom_connection:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom connection data required when current is 'custom'",
                )
            if not connection_request.custom_connection.url:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL is required for custom connection",
                )
        else:
            # Validate that the connection ID exists in preconfigured connections
            connection_config = config.get_stackstorm_connection_by_id(
                connection_request.current
            )
            if not connection_config:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Connection '{connection_request.current}' not found in preconfigured connections",
                )

        # Build session data
        stackstorm_connection_data = {
            "current": connection_request.current,
            "custom_connection": None,
        }

        if connection_request.custom_connection:
            stackstorm_connection_data["custom_connection"] = {
                "url": connection_request.custom_connection.url,
                "api_key": connection_request.custom_connection.api_key,
            }

        # Update session
        session_data = {"stackstorm_connection": stackstorm_connection_data}
        success = session_manager.set_session_data(session_id, session_data)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save connection configuration",
            )

        return ConnectionUpdateResponse(
            success=True,
            message=f"Connection configuration updated to '{connection_request.current}'",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update connection configuration: {str(e)}",
        )


@router.post("/connection/test", response_model=ConnectionTestResponse)
async def test_connection(session_id: str = Depends(require_valid_session)):
    """
    Test the StackStorm connection configuration stored in the user's session
    """
    try:
        stackstorm_config = _get_stackstorm_config_from_session(session_id)

        # Test the connection
        base_url = stackstorm_config["url"].rstrip("/")
        test_url = f"{base_url}/v1/executions"

        headers = {"Content-Type": "application/json"}
        if stackstorm_config.get("api_key"):
            headers["St2-Api-Key"] = stackstorm_config["api_key"]

        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            response = await client.get(test_url, headers=headers)

        if response.status_code == httpx.codes.OK:
            return ConnectionTestResponse(success=True, message="Connection successful")
        elif response.status_code == httpx.codes.UNAUTHORIZED:
            return ConnectionTestResponse(
                success=False, message="Authentication failed: Invalid API key"
            )
        else:
            return ConnectionTestResponse(
                success=False,
                message=f"Connection failed: HTTP {response.status_code}",
            )

    except HTTPException as e:
        # Convert HTTPException to ConnectionTestResponse for consistency
        return ConnectionTestResponse(success=False, message=e.detail)
    except httpx.RequestError:
        return ConnectionTestResponse(
            success=False, message="Failed to connect to StackStorm server"
        )
    except Exception as e:
        return ConnectionTestResponse(
            success=False, message=f"Connection test failed: {str(e)}"
        )


@router.get("/executions", response_model=ExecutionsListResponse)
async def get_executions(session_id: str = Depends(require_valid_session)):
    """
    Get a list of recent StackStorm executions
    """
    try:
        stackstorm_config = _get_stackstorm_config_from_session(session_id)

        # Make API request to list executions
        base_url = stackstorm_config["url"].rstrip("/")
        executions_url = f"{base_url}/v1/executions?limit=50&show_secrets=false"  # Get last 50 executions, no secrets

        headers = {"Content-Type": "application/json"}
        if stackstorm_config["api_key"]:
            headers["St2-Api-Key"] = stackstorm_config["api_key"]

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(executions_url, headers=headers)

        if response.status_code == httpx.codes.OK:
            executions_data = response.json()
            return ExecutionsListResponse(executions=executions_data)
        elif response.status_code == httpx.codes.UNAUTHORIZED:
            raise HTTPException(
                httpx.codes.UNAUTHORIZED, "Authentication failed: Invalid API key"
            )
        else:
            raise HTTPException(
                response.status_code, f"StackStorm API error: {response.text}"
            )

    except httpx.RequestError as e:
        raise HTTPException(
            httpx.codes.SERVICE_UNAVAILABLE,
            f"Failed to connect to StackStorm: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            httpx.codes.INTERNAL_SERVER_ERROR, f"Unexpected error: {str(e)}"
        )


@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: str,
    session_id: str = Depends(require_valid_session),
):
    """
    Fetch specific execution data from StackStorm API
    """
    try:
        stackstorm_config = _get_stackstorm_config_from_session(session_id)

        # Make the API request
        base_url = stackstorm_config["url"].rstrip("/")
        execution_url = f"{base_url}/v1/executions/{execution_id}?show_secrets=false"

        headers = {"Content-Type": "application/json"}
        if stackstorm_config["api_key"]:
            headers["St2-Api-Key"] = stackstorm_config["api_key"]

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(execution_url, headers=headers)

        if response.status_code == httpx.codes.OK:
            execution_data = response.json()
            return ExecutionResponse(
                execution_data=execution_data,
                message=f"Execution loaded successfully! Status: {execution_data.get('status', 'unknown')}",
            )

        # Handle common error cases
        if response.status_code == httpx.codes.UNAUTHORIZED:
            raise HTTPException(
                httpx.codes.UNAUTHORIZED, "Authentication failed: Invalid API key"
            )
        elif response.status_code == httpx.codes.NOT_FOUND:
            raise HTTPException(
                httpx.codes.NOT_FOUND, f"Execution {execution_id} not found"
            )
        else:
            raise HTTPException(
                response.status_code, f"StackStorm API error: {response.text}"
            )

    except httpx.RequestError as e:
        raise HTTPException(
            httpx.codes.SERVICE_UNAVAILABLE,
            f"Failed to connect to StackStorm: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            httpx.codes.INTERNAL_SERVER_ERROR, f"Unexpected error: {str(e)}"
        )
