"""Isolated FastAPI entrypoint for the Otya Server Python Worker preview.

This scaffold has no production bindings and must not perform business or payment
operations. Keep shared contracts versioned and avoid exposing internal errors.
"""

import re
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from workers import asgi

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

app = FastAPI(
    title="Otya Python Foundation",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def baseline_security_headers(request: Request, call_next):
    # Accept only a short, log-safe caller correlation ID; otherwise generate one.
    supplied_id = request.headers.get("X-Request-ID", "")
    request_id = supplied_id if _REQUEST_ID_PATTERN.fullmatch(supplied_id) else uuid4().hex
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers.setdefault("X-Request-ID", request_id)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/health/live")
async def live():
    """Liveness only; this does not claim database or provider readiness."""
    return {"status": "alive", "service": "otya-python-foundation", "scope": "preview-only"}


@app.get("/health/ready")
async def ready():
    """Readiness for this scaffold only; no external dependencies are configured."""
    return {"status": "ready", "scope": "scaffold-only", "dependencies": []}


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    # Never expose exception text, request bodies, credentials, or stack traces to clients.
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred.",
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )


Default = asgi.entrypoint(app)
