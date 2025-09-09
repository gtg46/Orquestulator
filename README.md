# Orquestulator

A simple query evaluation tool for YAQL expressions and Jinja2 templates with StackStorm integration.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
uvicorn app.main:app --reload
```

3. Open your browser to `http://localhost:8000/docs` to see the API documentation.

## Features

- YAQL expression evaluation
- Jinja2 template rendering
- StackStorm action data integration
- Simple web interface for testing queries
