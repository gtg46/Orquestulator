from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import require_valid_session
import httpx
import asyncio
import json

router = APIRouter()


class StackStormConfig(BaseModel):
    url: str
    api_key: Optional[str] = None


class ExecutionResponse(BaseModel):
    execution_data: dict
    message: str


@router.post("/execution/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: str,
    config: StackStormConfig,
    session_id: str = Depends(require_valid_session),
):
    """
    Fetch execution data from StackStorm API using httpx
    """
    try:
        # Clean up URL and handle Docker networking
        base_url = config.url.rstrip("/")
        if "localhost" in base_url or "127.0.0.1" in base_url:
            base_url = base_url.replace("localhost", "host.docker.internal").replace(
                "127.0.0.1", "host.docker.internal"
            )

        execution_url = f"{base_url}/v1/executions/{execution_id}"

        # Prepare headers
        headers = {"Content-Type": "application/json", "Accept": "application/json"}

        # Add authentication if provided
        if config.api_key:
            # Check if this looks like an auth token (short hex) vs API key (long base64)
            if len(config.api_key) <= 32 and all(
                c in "0123456789abcdef" for c in config.api_key
            ):
                # This looks like an auth token (short hex string)
                headers["X-Auth-Token"] = config.api_key
            else:
                # This looks like an API key (long base64 string)
                headers["St2-Api-Key"] = config.api_key

        # Make the request using httpx with proper timeout and error handling
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
            response = await client.get(execution_url, headers=headers)

        # Handle successful response
        if response.status_code == status.HTTP_200_OK:
            execution_data = response.json()

            # Validate that we received execution data
            if not execution_data or not execution_data.get("id"):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid execution data received from StackStorm",
                )

            return ExecutionResponse(
                execution_data=execution_data,
                message=f"StackStorm execution data loaded successfully! Status: {execution_data.get('status', 'unknown')}",
            )

        # Handle specific HTTP error codes
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed: Invalid or missing API key",
            )
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found. Check the execution ID.",
            )
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Insufficient permissions for this execution",
            )
        else:
            # Try to get error details from response
            try:
                error_data = response.json()
                error_detail = error_data.get(
                    "faultstring", error_data.get("detail", response.text)
                )
            except:
                error_detail = response.text

            raise HTTPException(
                status_code=response.status_code,
                detail=f"StackStorm API Error ({response.status_code}): {error_detail}",
            )

    except httpx.ConnectError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Connection Error: Could not connect to StackStorm at {config.url}. Check that the URL is correct and StackStorm is running and accessible. Error: {str(e)}",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request timed out. The StackStorm server may be slow to respond.",
        )
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}",
        )
