"""Unit tests for fail-closed Otya AI tool policy decisions."""

from otya_ai_policy import (
    AuthorizationContext,
    Risk,
    ToolPolicy,
    evaluate_tool_policy,
)


def test_read_tool_allows_only_authenticated_scoped_caller():
    policy = ToolPolicy("health.read", frozenset({"health:read"}), Risk.READ)
    assert evaluate_tool_policy(
        policy,
        AuthorizationContext(authenticated=True, scopes=frozenset({"health:read"})),
    ).allowed
    assert evaluate_tool_policy(
        policy, AuthorizationContext(authenticated=False, scopes=frozenset({"health:read"}))
    ).code == "AUTH_REQUIRED"


def test_missing_scope_denies_even_if_model_requests_action():
    policy = ToolPolicy("inventory.read", frozenset({"inventory:read"}), Risk.READ)
    decision = evaluate_tool_policy(
        policy, AuthorizationContext(authenticated=True, scopes=frozenset({"health:read"}))
    )
    assert not decision.allowed
    assert decision.code == "SCOPE_REQUIRED"


def test_high_impact_action_fails_closed_without_owner_step_up_and_approval():
    policy = ToolPolicy(
        "production.deploy",
        frozenset({"deploy:production"}),
        Risk.HIGH_IMPACT,
    )
    context = AuthorizationContext(
        authenticated=True,
        scopes=frozenset({"deploy:production"}),
        is_owner=True,
        step_up_valid=True,
        approval_valid=False,
    )
    decision = evaluate_tool_policy(policy, context)
    assert not decision.allowed
    assert decision.code == "APPROVAL_REQUIRED"


def test_high_impact_action_requires_all_server_authorization_gates():
    policy = ToolPolicy(
        "financial.execute",
        frozenset({"finance:execute"}),
        Risk.HIGH_IMPACT,
    )
    context = AuthorizationContext(
        authenticated=True,
        scopes=frozenset({"finance:execute"}),
        is_owner=True,
        step_up_valid=True,
        approval_valid=True,
    )
    assert evaluate_tool_policy(policy, context).allowed


def test_model_cannot_replace_missing_step_up_with_approval_claim():
    policy = ToolPolicy(
        "account.privilege_change",
        frozenset({"account:write"}),
        Risk.HIGH_IMPACT,
    )
    context = AuthorizationContext(
        authenticated=True,
        scopes=frozenset({"account:write"}),
        is_owner=True,
        step_up_valid=False,
        approval_valid=True,
    )
    decision = evaluate_tool_policy(policy, context)
    assert not decision.allowed
    assert decision.code == "STEP_UP_REQUIRED"


def test_denials_do_not_disclose_missing_scope_names():
    policy = ToolPolicy("secret.read", frozenset({"secrets:read"}), Risk.READ)
    decision = evaluate_tool_policy(
        policy, AuthorizationContext(authenticated=True, scopes=frozenset())
    )
    assert "secrets:read" not in decision.reason
    assert decision.code == "SCOPE_REQUIRED"
