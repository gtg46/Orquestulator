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
