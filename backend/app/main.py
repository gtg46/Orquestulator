from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.lib.config import config
from app.routes import evaluation_router
from app.routes import stackstorm_router
from app.routes import session_router

app = FastAPI(title="Orquestulator")

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session_router.router, prefix="/api/session", tags=["Session"])
app.include_router(evaluation_router.router, prefix="/api", tags=["Evaluate"])
app.include_router(
    stackstorm_router.router, prefix="/api/stackstorm", tags=["StackStorm"]
)


@app.get("/")
async def read_root():
    return {"message": "Orquestulator API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
