from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.routes import evaluation_router
from app.routes import stackstorm_router
from app.routes import session_router
from app.lib.config import config

# Conditionally enable/disable Swagger UI and API documentation
docs_url = "/docs" if config.SWAGGER_UI else None
redoc_url = "/redoc" if config.SWAGGER_UI else None
openapi_url = "/openapi.json" if config.SWAGGER_UI else None

app = FastAPI(
    title="Orquestulator",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url
)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
