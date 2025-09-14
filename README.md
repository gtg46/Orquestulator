# Orquestulator

A modern web-based expression evaluation tool designed for testing and debugging YAQL expressions, Jinja2 templates, and Orquesta workflows with integrated StackStorm support.

## 🎯 Overview

Orquestulator provides a user-friendly interface for developers and automation engineers to test expressions and templates used in workflow automation, particularly with StackStorm and Orquesta workflows. The application supports multiple expression languages.

## 🖼️ Screenshot

![Orquestulator UI](screenshots/orquestulator.png)

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd orquestulator
   ```

2. **Start the application**
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Development Setup

#### Using Docker Compose for Development

**Build and start all services:**
```bash
# Build images and start containers in detached mode
docker-compose up -d --build

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Managing the Docker environment:**
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (complete cleanup)
docker-compose down -v

# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Restart specific service
docker-compose restart backend

**Development workflow:**
```bash
# Start with build (recommended for development)
docker-compose up --build

# Make code changes (files are volume-mounted for live reload)
# Backend: Changes auto-reload via uvicorn --reload
# Frontend: Changes trigger Vite hot reload

# View application
# Frontend: http://localhost
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

#### Local Development (without Docker)

**Quick Start:**
```bash
# Backend (Terminal 1)
cd backend
python3 -m venv .venv && source .venv/bin/activate  # First time setup
pip install -r requirements.txt                     # Install dependencies
./start_server.sh                                   # Start backend server

# Frontend (Terminal 2)  
cd frontend
npm install           # Install dependencies
npm run dev          # Start development server
```

#### Manual Development Setup

#### Backend Development
```bash
cd backend

# Set up Python environment (required before first run)
python3 -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt

# Start the server (use this for subsequent runs)
./start_server.sh
```

**Note**: The startup script assumes you have a virtual environment activated and dependencies installed. It focuses on starting the server and will warn if no virtual environment is detected.

#### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

**Note:** When running locally, ensure the backend is running on port 8000 before starting the frontend, as the frontend expects the API to be available at `http://localhost:8000`.

## 🚀 Production Deployment

### Backend Deployment
Ensure you have a virtual environment set up and dependencies installed before running in production:
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate  # Set up environment
pip install -r requirements.txt                     # Install dependencies
./start_server.sh                                   # Uses production settings if .env configured
```

### Frontend Deployment
Build static files and serve with your web server:
```bash
cd frontend
npm install
npm run build        # Creates dist/ directory with static files
```

Copy the contents of `dist/` to your web server root. Configure your web server to:
- Serve static files from the build directory
- Handle SPA routing (redirect all routes to index.html)
- Proxy API calls to the backend server

**Example nginx configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/orquestulator/frontend/dist;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📋 Usage Guide

### Basic Expression Testing

1. **Select Expression Type**: Choose between YAQL, Jinja2, or Orquesta
2. **Enter Context Data**: Provide JSON or YAML data in the context panel
3. **Write Expression**: Enter your expression in the expression panel
4. **Evaluate**: Press Ctrl+Enter or click evaluate to see results

### StackStorm Integration

1. **Configure Connection**: Enter your StackStorm URL and API key
2. **Set Execution ID**: Provide the StackStorm execution ID to fetch
3. **Fetch Results**: Click "fetch result" to retrieve execution data
4. **Use in Expressions**: The fetched data populates the task result field

## ⚙️ Configuration

### Backend Configuration

Create backend environment files from the provided examples:

```bash
cd backend
# Copy the appropriate example for your environment
cp .env.development.example .env    # For development
cp .env.production.example .env     # For production
```

Key backend configuration options:
- **Authentication**: `PASSPHRASE` - Required passphrase for access
- **Session Management**: `SESSION_TIMEOUT_HOURS` - Session expiration time
- **Rate Limiting**: `AUTH_RATE_LIMIT` - Authentication attempt limits
- **CORS**: `CORS_ORIGINS` - Allowed frontend origins
- **SSL**: `SSL_CERT_PATH`, `SSL_KEY_PATH` - For HTTPS in production

### Frontend Configuration

The frontend uses environment variables from the root `.env` file. Key configuration options:
- **Backend URL**: `BACKEND_URL` - URL where backend API is accessible (automatically mapped to `VITE_BACKEND_URL`)

The Vite build process automatically loads environment variables from the root `.env` file.

### StackStorm Connections

Configure StackStorm environments in `backend/config/stackstorm-connections.json`:

```json
{
  "default": "st2-prod",
  "connections": [
    {
      "id": "st2-prod",
      "alias": "Production StackStorm",
      "url": "https://stackstorm.example.com:9101",
      "api_key": "your_api_key_here"
    }
  ]
}
```

### Using Startup Scripts

The backend includes an intelligent startup script that automatically handles environment setup:

**Backend:**
```bash
cd backend
./start_server.sh           # Auto-detects environment and starts server
./start_server.sh --help    # View available options
```

The startup script will:
- Automatically detect development vs production environment
- Create `.env` files from examples if they don't exist
- Install dependencies if needed
- Display configuration summary before starting
- Handle SSL configuration and Python version validation

## 🚀 Deployment Considerations

### Session Management & Workers

⚠️ **Important**: Orquestulator uses in-memory session storage and **must run with a single worker** for session consistency. The application is designed for small teams.

**Why single worker?**
- Sessions are stored in memory within each worker process
- Multiple workers would create separate session stores
- Users could randomly lose authentication between requests
- No external session store (Redis/database) dependency needed

**Production deployment:**
```bash
# Correct: Single worker (handled automatically by start_server.sh)
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Incorrect: Multiple workers will break sessions
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4  # DON'T DO THIS
```

### Security Recommendations

- Use HTTPS in production (`SSL_CERT_PATH`, `SSL_KEY_PATH`)
- Set secure session cookies (`SESSION_COOKIE_SECURE=true`)
- Use strong passphrases
- Restrict CORS origins to known domains
- Keep StackStorm API keys secure in config files (chmod 600)

## ✨ Features

### Core Expression Evaluation
- **YAQL Expressions**: Test YAQL queries with full context support
- **Jinja2 Templates**: Render Jinja2 templates with variable substitution
- **Orquesta Workflows**: Test Orquesta workflow expressions with task context simulation

### User Interface
- **Monaco Editor**: Professional code editor with syntax highlighting
- **Format Support**: Toggle between JSON and YAML for both input and output
- **Split-pane Layout**: Separate panels for context data, expressions, results, and task results
- **Keyboard Shortcuts**: Ctrl+Enter for quick evaluation

### StackStorm Integration
- **Execution Data Fetching**: Retrieve execution results directly from StackStorm API
- **Authentication Support**: API key and auth token authentication
- **Task Result Integration**: Fetched data populates task result fields automatically
- **Format-aware Display**: Results shown in user's preferred format (JSON/YAML)

## 🏗️ Architecture

```
orquestulator/
├── backend/                 # FastAPI Python backend
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── models/         # Pydantic schemas and data models
│   │   ├── routes/         # API route handlers
│   │   └── routers/        # Modular route organization
│   ├── Dockerfile          # Backend container configuration
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   ├── App.css         # Application styling
│   │   └── main.jsx        # React application entry point
│   ├── Dockerfile          # Frontend container configuration
│   ├── nginx.conf          # Production web server configuration
│   └── package.json        # Node.js dependencies
└── docker-compose.yml      # Multi-service orchestration
```

### Example Usage

**YAQL Expression:**
```yaml
# Context Data
user:
  name: "John Doe"
  age: 30
  active: true

# Expression
$.user.name + " is " + string($.user.age) + " years old"

# Result
"John Doe is 30 years old"
```

**Jinja2 Template:**
```yaml
# Context Data
items:
  - name: "Item 1"
    price: 10.99
  - name: "Item 2"
    price: 15.50

# Expression
{% for item in items %}
- {{ item.name }}: ${{ item.price }}
{% endfor %}
```

**Orquesta Expression:**
```yaml
# Context Data (with task simulation)
__task_result:
  stdout: "Hello World"
  return_code: 0
__task_status: "succeeded"

# Expression
<% result().stdout %>

# Result
"Hello World"
```

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Pydantic**: Data validation and serialization
- **YAQL**: Query language for structured data
- **Jinja2**: Template engine
- **Orquesta**: Workflow engine
- **HTTPX**: HTTP client for StackStorm integration

### Frontend
- **React 19**: Modern UI framework
- **Vite**: Fast build tool and development server
- **Monaco Editor**: VS Code-like code editor
- **js-yaml**: YAML parsing and serialization

### Infrastructure
- **Docker**: Containerization
- **Docker Compose**: Multi-service orchestration
- **Nginx**: Production web server
- **Python 3.12**: Runtime environment
- **Node.js 22**: Frontend build environment
