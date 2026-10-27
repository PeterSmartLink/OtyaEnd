"""Minimal isolated FastAPI entrypoint for a Cloudflare Python Worker."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from workers import asgi

app = FastAPI(
    title="Otya Python Foundation",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def baseline_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/health/live")
async def live():
    """Liveness only; this does not claim database or provider readiness."""
    return {"status": "alive", "service": "otya-python-foundation"}


@app.get("/health/ready")
async def ready():
    """Readiness for this scaffold only; no external dependencies are configured."""
    return {"status": "ready", "dependencies": []}


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    # Never expose exception text, request bodies, credentials, or stack traces to clients.
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
    )


Default = asgi.entrypoint(app)
