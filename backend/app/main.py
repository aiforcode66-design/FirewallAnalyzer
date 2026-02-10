"""FastAPI main application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth_router, device_router, vendor_router, dashboard_router, analyzer_router, change_router, rules_router, migration_router, reports_router, tuner_router, traffic_router

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Firewall Optimization Application",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(device_router)
app.include_router(vendor_router)
app.include_router(dashboard_router)
app.include_router(analyzer_router)
app.include_router(change_router)
app.include_router(rules_router)
app.include_router(migration_router)
app.include_router(reports_router)
app.include_router(tuner_router)
app.include_router(traffic_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Firewall Analyzer API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    origin = request.headers.get("origin")
    headers = dict(exc.headers) if exc.headers else {}
    
    # Manually inject CORS headers for 401/error responses
    if origin and origin in settings.CORS_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
        
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
