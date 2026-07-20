"""FastAPI application factory for the Unified Neuro Platform backend.

Wires the layered architecture together: config → logging → job service →
pipeline registry → API routers. Nothing modality-specific lives here.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import httpx
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import analysis as analysis_routes
from app.api.v1 import health as health_routes
from app.api.v1 import hospital_admin as hospital_admin_routes
from app.api.v1 import platform_admin as platform_admin_routes
from app.api.v1 import settings as settings_routes
from app.api.v1 import users as users_routes
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.pipelines import register_default_pipelines
from app.services.jobs import JobService, set_job_service
from app.workers.local_executor import LocalJobService

logger = get_logger(__name__)

API_V1_PREFIX = "/api/v1"


def _build_job_service() -> JobService:
    settings = get_settings()
    # Only the local backend exists today; the interface lets us add Celery later
    # without touching any route (doc 4.2 / Decision 2).
    return LocalJobService(max_workers=settings.local_job_max_workers)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging()
    register_default_pipelines()
    job_service = _build_job_service()
    set_job_service(job_service)
    logger.info(
        "Backend started (env=%s, job_backend=%s, workers=%s)",
        settings.app_env, settings.job_backend, settings.local_job_max_workers,
    )
    try:
        yield
    finally:
        job_service.shutdown()
        logger.info("Backend shut down.")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title="Unified Neuro Platform API",
        version="1.0.0",
        description="One API for EEG and MRI neuro-analysis.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    v1 = APIRouter(prefix=API_V1_PREFIX)
    v1.include_router(health_routes.router)
    v1.include_router(analysis_routes.router)
    v1.include_router(users_routes.router)
    v1.include_router(platform_admin_routes.router)
    v1.include_router(hospital_admin_routes.router)
    v1.include_router(settings_routes.router)
    app.include_router(v1)

    _install_error_handlers(app)

    @app.get("/")
    def index() -> dict:
        return {
            "name": "Unified Neuro Platform API",
            "version": "1.0.0",
            "status": "running",
            "docs": "/docs",
            "api": API_V1_PREFIX,
        }

    return app


def _install_error_handlers(app: FastAPI) -> None:
    """Return the doc's structured error shape; never leak tracebacks (doc 14.7)."""

    from app.services.supabase_client import SupabaseNotConfiguredError

    @app.exception_handler(SupabaseNotConfiguredError)
    async def supabase_not_configured(request: Request, exc: SupabaseNotConfiguredError):
        # Configuration gap, not a bug: respond 503 instead of a noisy 500.
        logger.warning("Supabase-backed request on %s but Supabase is not configured.", request.url.path)
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "service_unavailable",
                    "message": "Backend storage/database is not configured.",
                    "request_id": None,
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exc(request: Request, exc: StarletteHTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail:
            payload = {"error": {**detail, "request_id": None}}
        else:
            payload = {"error": {"code": "http_error", "message": str(detail), "request_id": None}}
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(RequestValidationError)
    async def validation_exc(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed.",
                    "request_id": None,
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(httpx.HTTPError)
    async def upstream_http_exc(request: Request, exc: httpx.HTTPError):
        logger.warning("Upstream Supabase/network error on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "upstream_unavailable",
                    "message": "Supabase is temporarily unavailable. Please retry.",
                    "request_id": None,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exc(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred.",
                    "request_id": None,
                }
            },
        )


app = create_app()
