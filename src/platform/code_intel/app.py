from __future__ import annotations

import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from code_intel.logging_utils import get_logger
from code_intel.routers import (
    repos,
    git,
    analyzers,
    deps,
    semantic,
    intelligence,
    risk,
    graph,
    tree,
    analysis,
    analysis_stream,
)

logger = get_logger(__name__)

app = FastAPI(title="Code Intelligence Platform", version="2.0")

# CORS configuration from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",")
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registry wiring
from code_intel.registry import registry

def register_analyzers():
    """Import and register all analyzer plugins."""
    # Git analyzer
    try:
        from git_analyzer.plugin import plugin as git_plugin, api as git_api
        registry.register(git_plugin, git_api)
        logger.info("Registered Git analyzer")
    except ImportError as e:
        logger.warning(f"Could not register Git analyzer: {e}")

    # Dep analyzer
    try:
        from dep_analyzer.plugin import plugin as dep_plugin, api as dep_api
        registry.register(dep_plugin, dep_api)
        logger.info("Registered Dependency analyzer")
    except ImportError as e:
        logger.warning(f"Could not register Dependency analyzer: {e}")

    # Semantic analyzer
    try:
        from semantic_analyzer.plugin import plugin as semantic_plugin, api as semantic_api
        registry.register(semantic_plugin, semantic_api)
        logger.info("Registered Semantic analyzer")
    except ImportError as e:
        logger.warning(f"Could not register Semantic analyzer: {e}")

    # Project intelligence
    try:
        from project_intel.plugin import plugin as intel_plugin, api as intel_api
        registry.register(intel_plugin, intel_api)
        logger.info("Registered Project Intelligence")
    except ImportError as e:
        logger.warning(f"Could not register Project Intelligence: {e}")

register_analyzers()

# Routers
app.include_router(repos.router)
app.include_router(git.router)
app.include_router(analyzers.router)
app.include_router(tree.router)
app.include_router(analysis.router)
app.include_router(analysis_stream.router)
app.include_router(deps.router)
app.include_router(semantic.router)
app.include_router(intelligence.router)
app.include_router(risk.router)
app.include_router(graph.router)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "details": None
            }
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation error",
                "details": exc.errors()
            }
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error occurred")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": str(exc) if app.debug else None
            }
        },
    )

@app.get("/health")
def health():
    return {"status": "ok", "analyzers": list(registry._analyzers.keys())}

# Static files for the frontend application
# Use environment variable for flexibility, fallback to relative path
_STATIC_DIR_ENV = os.getenv("STATIC_DIR")
if _STATIC_DIR_ENV:
    _STATIC_DIR = Path(_STATIC_DIR_ENV)
else:
    # Default: src/platform/../../frontend/dist
    _STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if _STATIC_DIR.exists():
    logger.info(f"Serving static files from: {_STATIC_DIR}")
    # Mount at /assets for frontend assets (vite uses /assets)
    assets_dir = _STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    # Catch-all for SPA: serve index.html for non-API routes
    from fastapi.responses import FileResponse
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API routes
        api_prefixes = ("repos/", "health", "docs", "openapi", "redoc")
        if any(full_path.startswith(p) for p in api_prefixes):
            raise HTTPException(status_code=404, detail="Not found")
        
        index_file = _STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Static files not found")
else:
    logger.warning(f"Static directory not found: {_STATIC_DIR}")
