#!/usr/bin/env python3

import sys
import os

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

# Add orquesta to the path
orquesta_path = os.path.join(os.path.dirname(__file__), 'orquesta')
sys.path.insert(0, orquesta_path)

import asyncio
from app.routes.evaluate import evaluate_expression
from app.models.schemas import EvaluateRequest

async def test_succeeded_function():
    """Test the succeeded() function with different scenarios"""
    
    print("=== Testing succeeded() function ===")
    
    # Test 1: Basic succeeded case
    print("\n1. Testing basic succeeded case:")
    test_data = {
        '__task_result': {'output': 'success'},
        '__task_id': 'test_task', 
        '__task_status': 'succeeded',
        '__task_route': 0
    }
    
    request = EvaluateRequest(expression='<% succeeded() %>', data=test_data)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Result: {result.result}")
        print(f"   Type: {type(result.result)}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test 2: Basic failed case
    print("\n2. Testing basic failed case:")
    test_data['__task_status'] = 'failed'
    
    request = EvaluateRequest(expression='<% succeeded() %>', data=test_data)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Result: {result.result}")
        print(f"   Type: {type(result.result)}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test 3: Using explicit override
    print("\n3. Testing with explicit override (succeeded=True):")
    test_data['__succeeded'] = True
    
    request = EvaluateRequest(expression='<% succeeded() %>', data=test_data)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Result: {result.result}")
        print(f"   Type: {type(result.result)}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test 4: Test string replacement in YAQL
    print("\n4. Testing string replacement logic:")
    test_data['__succeeded'] = True
    
    request = EvaluateRequest(expression='<% succeeded() and failed() %>', data=test_data)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Result: {result.result}")
        print(f"   Type: {type(result.result)}")
    except Exception as e:
        print(f"   ERROR: {e}")

    # Test 5: Test the context structure being built
    print("\n5. Testing context structure:")
    from app.routes.evaluate import router
    
    # Rebuild context like the function does
    task_result = test_data.get('__task_result', None)
    task_id = test_data.get('__task_id', 'current_task')
    task_status = test_data.get('__task_status', 'succeeded')
    task_route = test_data.get('__task_route', 0)
    
    orquesta_data = {}
    for k, v in test_data.items():
        if not k.startswith('__'):
            orquesta_data[k] = v
    
    orquesta_data['__current_task'] = {
        'id': task_id,
        'route': task_route,
        'result': task_result
    }
    
    task_state_route_id = f'{task_id}__r{task_route}'
    
    orquesta_data['__state'] = {
        'tasks': {
            task_state_route_id: 0
        },
        'sequence': [
            {
                'status': task_status,
                'result': task_result
            }
        ],
        'routes': [[task_id]]
    }
    
    print(f"   Current task: {orquesta_data['__current_task']}")
    print(f"   State tasks: {orquesta_data['__state']['tasks']}")
    print(f"   State sequence: {orquesta_data['__state']['sequence']}")
    print(f"   Task state route ID: {task_state_route_id}")
    
    # Test the workflow function directly
    try:
        from orquesta.expressions.functions.workflow import succeeded_, task_status_
        
        print(f"   Direct task_status_ call: {task_status_(orquesta_data, task_id, task_route)}")
        print(f"   Direct succeeded_ call: {succeeded_(orquesta_data)}")
    except Exception as e:
        print(f"   ERROR in direct function call: {e}")

if __name__ == "__main__":
    asyncio.run(test_succeeded_function())
