from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ExecutionResponse(BaseModel):
    execution_data: dict
    message: str


class ExecutionsListResponse(BaseModel):
    executions: List[dict]


class ConnectionInfo(BaseModel):
    id: str
    alias: str


class CustomConnection(BaseModel):
    url: str
    api_key: Optional[str] = None


class ConnectionRequest(BaseModel):
    current: str  # connection_id or "custom"
    custom_connection: Optional[CustomConnection] = None


class ConnectionResponse(BaseModel):
    connections: List[ConnectionInfo]
    default: Optional[str] = None
    current: Optional[str] = None
    custom_connection: Optional[Dict[str, Any]] = None


class ConnectionUpdateResponse(BaseModel):
    success: bool
    message: str


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
