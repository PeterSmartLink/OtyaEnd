"""Basic source-contract checks that can run outside the Workers runtime."""

from pathlib import Path

SOURCE = Path(__file__).parents[1] / "src" / "main.py"


def test_scaffold_has_liveness_and_readiness_routes():
    source = SOURCE.read_text(encoding="utf-8")
    assert '@app.get("/health/live")' in source
    assert '@app.get("/health/ready")' in source


def test_scaffold_does_not_configure_business_or_payment_routes():
    source = SOURCE.read_text(encoding="utf-8").lower()
    assert "/payments" not in source
    assert "/transactions" not in source
    assert "database_url" not in source


def test_unexpected_errors_are_not_returned_to_clients():
    source = SOURCE.read_text(encoding="utf-8")
    assert '"An unexpected error occurred."' in source
    assert "str(exc)" not in source



def test_request_id_is_validated_and_returned():
    source = SOURCE.read_text(encoding="utf-8")
    assert '_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")' in source
    assert 'request.headers.get("X-Request-ID", "")' in source
    assert 'response.headers.setdefault("X-Request-ID", request_id)' in source
    assert "request_id = supplied_id if _REQUEST_ID_PATTERN.fullmatch(supplied_id) else uuid4().hex" in source


def test_health_endpoints_are_explicitly_preview_scoped():
    source = SOURCE.read_text(encoding="utf-8")
    assert '"scope": "preview-only"' in source
    assert '"scope": "scaffold-only"' in source


def test_internal_error_response_includes_correlation_id_without_exception_text():
    source = SOURCE.read_text(encoding="utf-8")
    assert '"request_id": getattr(request.state, "request_id", None)' in source
    assert "str(exc)" not in source
    assert "traceback" not in source.lower()
