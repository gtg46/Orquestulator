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

async def test_string_replacement():
    """Test the string replacement logic specifically"""
    
    print("=== Testing String Replacement for succeeded()/failed() ===")
    
    # Test 1: YAQL with explicit override
    print("\n1. YAQL Expression with explicit override:")
    test_data = {
        '__task_result': {'output': 'success'},
        '__task_id': 'test_task', 
        '__task_status': 'failed',  # This says task failed
        '__task_route': 0,
        '__succeeded': True  # But we override to say it succeeded
    }
    
    request = EvaluateRequest(expression='<% succeeded() %>', data=test_data)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Task Status: {test_data['__task_status']}")
        print(f"   Override: {test_data['__succeeded']}")
        print(f"   Result: {result.result}")
        print(f"   Expected: True (due to override)")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test 2: Complex YAQL expression
    print("\n2. Complex YAQL Expression:")
    request = EvaluateRequest(expression='<% succeeded() or failed() %>', data=test_data)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Result: {result.result}")
        print(f"   Expected: True (true or false)")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test 3: Jinja2 expression
    print("\n3. Jinja2 Expression:")
    test_data_jinja = test_data.copy()
    request = EvaluateRequest(expression='{{ succeeded() }}', data=test_data_jinja)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Result: {result.result}")
        print(f"   Expected: True")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test 4: Test without override
    print("\n4. Without override (should use actual task status):")
    test_data_no_override = {
        '__task_result': {'output': 'success'},
        '__task_id': 'test_task', 
        '__task_status': 'succeeded',  # Task actually succeeded
        '__task_route': 0
        # No __succeeded override
    }
    
    request = EvaluateRequest(expression='<% succeeded() %>', data=test_data_no_override)
    
    try:
        result = await evaluate_expression(request, 'orquesta')
        print(f"   Expression: {request.expression}")
        print(f"   Task Status: {test_data_no_override['__task_status']}")
        print(f"   Override: None")
        print(f"   Result: {result.result}")
        print(f"   Expected: True (task actually succeeded)")
    except Exception as e:
        print(f"   ERROR: {e}")

    # Test 5: Look at what the expression becomes after replacement
    print("\n5. String replacement internals:")
    
    # Simulate the replacement logic
    expression = '<% succeeded() and failed() %>'
    succeeded_value = True
    
    # Detect if this is a YAQL expression
    if '<% ' in expression and ' %>' in expression:
        succeeded_str = 'true' if succeeded_value else 'false'
        failed_str = 'false' if succeeded_value else 'true'
    else:
        succeeded_str = 'True' if succeeded_value else 'False'
        failed_str = 'False' if succeeded_value else 'True'

    modified_expression = expression.replace('succeeded()', succeeded_str)
    modified_expression = modified_expression.replace('failed()', failed_str)
    
    print(f"   Original: {expression}")
    print(f"   Modified: {modified_expression}")
    print(f"   succeeded_str: {succeeded_str}")
    print(f"   failed_str: {failed_str}")

if __name__ == "__main__":
    asyncio.run(test_string_replacement())
