# Otya Python Foundation (Isolated Preview Scaffold)

This directory is a non-production proof-of-compatibility scaffold for Python Workers + FastAPI. It is intentionally isolated from the existing `otya-core` production Worker configuration.

## Scope

- Python-first backend starting point using FastAPI.
- Minimal health endpoints and baseline security headers.
- No database bindings, custom domains, production routes, credentials, payment operations, or production data.
- No deployment is implied or authorized by these files.

## Local development

Install Python 3.13+ and uv, then from this directory run:

```sh
uv sync --dev
uv run pywrangler dev
```

The Cloudflare Python runtime executes through Pyodide, so validate package compatibility before adding dependencies. Do not copy production secrets into local files.

## Checks

```sh
uv run ruff check src
uv run pytest
```

The Python Worker runtime and Cloudflare bindings must additionally be exercised in a local Worker runtime before this scaffold is considered validated.

## Before any deployment

1. Review this scaffold and dependency compatibility.
2. Add isolated test-only bindings through an approved configuration.
3. Test authentication, authorization, error handling, observability, and resource limits.
4. Do not add production routes or bind production resources without explicit approval.
