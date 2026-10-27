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
