from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import logging
from collections import defaultdict, deque
from time import monotonic
from contextlib import asynccontextmanager

from app.api.router import api_router
from app.config import get_settings
from app.database.mongo import ensure_indexes
from app.services.product_service import InventoryError

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Keep startup resilient: the health endpoint stays available if Atlas is down."""
    if not settings.mongodb_uri:
        logging.getLogger(__name__).warning("MONGODB_URI is not configured; database APIs will return a clear error")
    else:
        try:
            ensure_indexes()
        except Exception:
            logging.getLogger(__name__).exception("MongoDB indexes could not be initialized")
    yield

app = FastAPI(title=settings.app_name, version="1.0.0", description="Voice-first bookkeeping APIs for small businesses.", lifespan=lifespan)
_request_windows: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def request_log(request: Request, call_next):
    """Log request completion without recording credentials or request bodies."""
    try:
        path = request.url.path
        is_exempt = request.method == "OPTIONS" or path in ("/", "/health", "/favicon.ico", "/docs", "/openapi.json") or path.startswith("/health")
        
        if not is_exempt:
            forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
            real_ip = request.headers.get("x-real-ip") or request.headers.get("cf-connecting-ip")
            client_ip = (forwarded.split(",")[0].strip() if forwarded else None) or real_ip or (request.client.host if request.client else "unknown")

            now = monotonic()
            window = _request_windows[client_ip]
            while window and window[0] <= now - 60:
                window.popleft()
            if len(window) >= settings.rate_limit_per_minute:
                origin = request.headers.get("origin", "*")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please retry in a minute."},
                    headers={
                        "Retry-After": "60",
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Credentials": "true",
                    },
                )
            window.append(now)

        response = await call_next(request)
    except Exception:
        logging.getLogger(__name__).exception("Unhandled request error: %s %s", request.method, request.url.path)
        raise
    logging.getLogger(__name__).info("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.exception_handler(InventoryError)
async def inventory_error_handler(_: Request, exc: InventoryError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message, "details": []}})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
