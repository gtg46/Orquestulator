from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.routes import evaluate
from app.routers import stackstorm_router

app = FastAPI(title="Orquestulator")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default port (development)
        "http://localhost",       # Production frontend
        "http://localhost:80"     # Production frontend with explicit port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(evaluate.router, prefix="/api", tags=["Evaluate"])
app.include_router(stackstorm_router.router, prefix="/api/stackstorm", tags=["StackStorm"])

@app.get("/")
async def read_root():
    return {"message": "Orquestulator API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
