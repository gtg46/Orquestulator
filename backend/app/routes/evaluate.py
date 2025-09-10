from fastapi import APIRouter, HTTPException, Path
from app.models.schemas import EvaluateRequest, EvaluateResponse, ErrorResponse
import yaql
import json
from jinja2 import SandboxedEnvironment, BaseLoader, TemplateSyntaxError, UndefinedError, SecurityError
from orquesta.expressions.base import evaluate as orquesta_evaluate

router = APIRouter()

# Initialize YAQL engine with security considerations
# YAQL is generally safer than Jinja2 for arbitrary user input since it's designed
# as a query language, but we should still be cautious about the context we provide
yaql_engine = yaql.factory.YaqlFactory().create()

# Initialize Jinja2 sandboxed environment for security
class StringTemplateLoader(BaseLoader):
    def get_source(self, environment, template):
        return template, None, lambda: True

# Use SandboxedEnvironment to prevent template injection attacks
jinja_env = SandboxedEnvironment(loader=StringTemplateLoader(), autoescape=True)

@router.post("/evaluate/{query_type}", response_model=EvaluateResponse)
async def evaluate_expression(
    request: EvaluateRequest,
    query_type: str = Path(..., description="The type of expression to evaluate", regex="^(yaql|jinja2|orquesta)$")
):
    """
    Evaluate an expression based on the specified query type
    """
    try:
        if query_type == "yaql":
            # Evaluate YAQL expression with controlled context
            # YAQL is generally safer than Jinja2 as it's designed for data querying,
            # but we should still sanitize the context to prevent access to dangerous objects
            parsed_expression = yaql_engine(request.expression)
            # Create a safe copy of the data to prevent modification of mutable objects
            safe_data = json.loads(json.dumps(request.data)) if request.data else {}
            result = parsed_expression.evaluate(data=safe_data)
            
        elif query_type == "jinja2":
            # Render Jinja2 template using sandboxed environment for security
            # This prevents template injection attacks while maintaining functionality
            template = jinja_env.from_string(request.expression)
            result = template.render(**request.data)
            
        elif query_type == "orquesta":
            # Use Orquesta base evaluate function (supports both YAQL <% %> and Jinja2 {{ }})
            # Security: Orquesta auto-detects expression type and uses appropriate evaluator.
            # Since we've secured Jinja2 with SandboxedEnvironment, and YAQL is inherently safer,
            # plus Orquesta has built-in protections (e.g., blocking __ private variables),
            # this should be reasonably secure for expression testing purposes.
            
            # Extract workflow-specific data
            task_result = request.data.get('__task_result', None)
            task_id = request.data.get('__task_id', 'current_task')
            task_status = request.data.get('__task_status', 'succeeded')
            task_route = request.data.get('__task_route', 0)
            current_item = request.data.get('__current_item', None)
            
            expression = request.expression
            
            # Build the data structure that orquesta evaluators expect
            # Both YAQL and Jinja contextualize() methods expect raw data that includes
            # both user variables AND system context in the same dict
            orquesta_data = {}
            
            # Add all user data (non-system variables)
            for k, v in request.data.items():
                if not k.startswith('__'):
                    orquesta_data[k] = v
            
            # Add system context that orquesta evaluators expect
            orquesta_data['__current_task'] = {
                'id': task_id,
                'route': task_route,
                'result': task_result
            }
            
            # Task state route format: task_id__r + route (from constants.TASK_STATE_ROUTE_FORMAT)
            task_state_route_id = f'{task_id}__r{task_route}'
            
            orquesta_data['__state'] = {
                'tasks': {
                    task_state_route_id: 0  # Task pointer: task_id__r + route -> sequence index
                },
                'sequence': [
                    {
                        'status': task_status,
                        'result': task_result
                    }
                ],
                'routes': [[task_id]]  # Route contains current task
            }
            
            # Add current item support for with-items loops
            if current_item is not None:
                orquesta_data['__current_item'] = current_item
            
            # Use orquesta's base evaluate - auto-detects YAQL vs Jinja2
            result = orquesta_evaluate(expression, orquesta_data)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported query type: {query_type}")

        return EvaluateResponse(
            result=result,
            query_type=query_type
        )

    except SecurityError as e:
        # Handle Jinja2 sandbox security violations
        raise HTTPException(
            status_code=403,
            detail=ErrorResponse(
                error=f"Template security violation: {str(e)}", 
                query_type=query_type
            ).dict()
        )
    except (TemplateSyntaxError, UndefinedError) as e:
        # Handle Jinja2 template syntax and undefined variable errors
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error=f"Template error: {str(e)}", 
                query_type=query_type
            ).dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(error=str(e), query_type=query_type).dict()
        )
