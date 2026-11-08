
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.errors import AppError
from app.limiter import limiter
from app.mongo import close_mongodb, connect_to_mongodb

logger = logging.getLogger("studyflow")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    mongodb_connected = False

    try:
        # Connect to MongoDB outside test environments.
        if not settings.TESTING and settings.ENVIRONMENT != "test":
            database = connect_to_mongodb()
            app.state.database = database
            mongodb_connected = True
            logger.info("Successfully connected to MongoDB.")

        # Validate application configuration.
        if not settings.TESTING and settings.ENVIRONMENT != "test":
            try:
                settings.check_required_keys()
            except ValueError as e:
                logger.warning("Configuration warning on startup: %s", e)

        yield

    finally:
        if mongodb_connected:
            close_mongodb()
            logger.info("MongoDB connection closed.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="StudyFlow API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter

    # Request ID and structured logging middleware.
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response

    # CORS configuration.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["*"],
    )

    # Application error handler.
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )

    # Request validation error handler.
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request,
        exc: RequestValidationError,
    ):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed for request parameters or body.",
                    "details": {"errors": exc.errors()},
                }
            },
        )

    # Rate limit error handler.
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please slow down.",
                    "details": {},
                }
            },
        )

    # Unexpected error handler.
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server error: %s", exc)

        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal server error occurred.",
                    "details": {},
                }
            },
        )

    # Health check.
    @app.get("/api/health")
    async def health_check():
        if settings.TESTING or settings.ENVIRONMENT == "test":
            return {"status": "ok"}

        try:
            database = getattr(app.state, "database", None)

            if database is None:
                raise RuntimeError("MongoDB is not connected.")

            database.command("ping")

            return {
                "status": "ok",
                "database": "connected",
            }

        except Exception:
            logger.exception("MongoDB health check failed.")

            return JSONResponse(
                status_code=503,
                content={
                    "status": "degraded",
                    "database": "unavailable",
                },
            )

    # API routes.
    from app.api.analyze import router as analyze_router
    from app.api.plans import router as plans_router
    from app.api.playlists import router as playlists_router

    app.include_router(playlists_router)
    app.include_router(analyze_router)
    app.include_router(plans_router)

    return app


app = create_app()
