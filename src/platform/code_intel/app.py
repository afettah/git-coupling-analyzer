from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from code_intel.logging_utils import get_logger
from code_intel.routers import repos, git, analyzers, deps, semantic, intelligence

logger = get_logger(__name__)

app = FastAPI(title="Code Intelligence Platform", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(deps.router)
app.include_router(semantic.router)
app.include_router(intelligence.router)

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

@app.get("/health")
def health():
    return {"status": "ok", "analyzers": list(registry._analyzers.keys())}

# Static files if needed
_STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="frontend")
