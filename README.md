# Orquestulator

A modern web-based expression evaluation tool designed for testing and debugging YAQL expressions, Jinja2 templates, and Orquesta workflows with integrated StackStorm support.

## 🎯 Overview

Orquestulator provides a user-friendly interface for developers and automation engineers to test expressions and templates used in workflow automation, particularly with StackStorm and Orquesta workflows. The application features a split-pane interface with real-time evaluation and supports multiple expression languages.

## ✨ Features

### Core Expression Evaluation
- **YAQL Expressions**: Test YAQL queries with full context support
- **Jinja2 Templates**: Render Jinja2 templates with variable substitution
- **Orquesta Workflows**: Test Orquesta workflow expressions with task context simulation

### User Interface
- **Monaco Editor**: Professional code editor with syntax highlighting
- **Real-time Evaluation**: Live expression evaluation as you type
- **Format Support**: Toggle between JSON and YAML for both input and output
- **Split-pane Layout**: Separate panels for context data, expressions, results, and task results
- **Keyboard Shortcuts**: Ctrl+Enter for quick evaluation

### StackStorm Integration
- **Execution Data Fetching**: Retrieve execution results directly from StackStorm API
- **Authentication Support**: API key and auth token authentication
- **Task Result Integration**: Fetched data populates task result fields automatically
- **Format-aware Display**: Results shown in user's preferred format (JSON/YAML)

### Development Features
- **Docker Support**: Full containerization with docker-compose
- **Hot Reload**: Development mode with automatic reloading
- **CORS Configuration**: Proper cross-origin handling for development and production
- **Error Handling**: Comprehensive error reporting and validation

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
├── orquesta/               # Orquesta workflow engine (submodule)
├── st2-docker/             # StackStorm Docker setup (for testing)
└── docker-compose.yml      # Multi-service orchestration
```

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
```

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

#### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

**Note:** When running locally, ensure the backend is running on port 8000 before starting the frontend, as the frontend expects the API to be available at `http://localhost:8000`.

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
- **Python 3.11**: Runtime environment
- **Node.js 22**: Frontend build environment

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# StackStorm Configuration (optional)
STACKSTORM_API_URL=http://localhost:9101
STACKSTORM_AUTH_TOKEN=your_token_here

# Development Configuration
VITE_API_URL=http://localhost:8000
```

### Docker Configuration

The application uses multi-stage Docker builds for optimization:
- **Backend**: Python 3.11 slim with FastAPI
- **Frontend**: Node.js build stage + Nginx serving stage

## 🧪 Testing

### Manual Testing
- Load the application and test basic expressions
- Verify format switching between JSON and YAML
- Test StackStorm integration with a running instance

### Development Testing
```bash
# Backend API testing
curl -X POST "http://localhost:8000/api/evaluate/yaql" \
  -H "Content-Type: application/json" \
  -d '{"expression": "$.test", "data": {"test": "hello"}}'
```

## 🔒 Security Considerations

⚠️ **Development Stage**: This application is currently in development and not production-ready.

**Current Limitations:**
- No authentication system
- API keys handled client-side
- No input sanitization
- Permissive CORS policy
- No rate limiting

**Planned Security Enhancements:**
- Server-side API key handling
- Input validation and sanitization
- Authentication and authorization
- Rate limiting and DDoS protection
- HTTPS/TLS configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Add appropriate license information]

## 🆘 Support & Issues

For questions, issues, or feature requests, please:
1. Check existing issues
2. Create a new issue with detailed information
3. Include steps to reproduce for bugs

## 🔮 Roadmap

- [ ] Input validation and sanitization
- [ ] Authentication system
- [ ] Production deployment guide
- [ ] Automated testing suite
- [ ] Performance optimizations
- [ ] Additional expression language support
