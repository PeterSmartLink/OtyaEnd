"""Framework-independent policy primitives for Otya AI tool execution.

This module is a tested reference contract, not yet wired into a production Worker.
The model proposes tool calls; trusted server code must evaluate this policy and
must never accept model-generated claims of authorization or approval.
"""

from dataclasses import dataclass
from enum import StrEnum


class Risk(StrEnum):
    READ = "read"
    LOW_WRITE = "low_write"
    HIGH_IMPACT = "high_impact"


@dataclass(frozen=True)
class ToolPolicy:
    name: str
    required_scopes: frozenset[str]
    risk: Risk
    requires_owner: bool = False
    requires_step_up: bool = False
    requires_explicit_approval: bool = False


@dataclass(frozen=True)
class AuthorizationContext:
    authenticated: bool
    scopes: frozenset[str] = frozenset()
    is_owner: bool = False
    step_up_valid: bool = False
    approval_valid: bool = False


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    code: str
    reason: str


def evaluate_tool_policy(
    policy: ToolPolicy, context: AuthorizationContext
) -> PolicyDecision:
    """Fail closed when identity, scope, owner grant, step-up, or approval is missing."""
    if not context.authenticated:
        return PolicyDecision(False, "AUTH_REQUIRED", "A verified identity is required.")

    missing_scopes = policy.required_scopes - context.scopes
    if missing_scopes:
        return PolicyDecision(
            False,
            "SCOPE_REQUIRED",
            "The caller lacks one or more required permissions.",
        )

    if policy.requires_owner and not context.is_owner:
        return PolicyDecision(False, "OWNER_REQUIRED", "This action is owner-only.")

    if policy.requires_step_up and not context.step_up_valid:
        return PolicyDecision(
            False, "STEP_UP_REQUIRED", "Fresh step-up verification is required."
        )

    if policy.requires_explicit_approval and not context.approval_valid:
        return PolicyDecision(
            False, "APPROVAL_REQUIRED", "A valid explicit approval is required."
        )

    if policy.risk is Risk.HIGH_IMPACT:
        if not context.is_owner:
            return PolicyDecision(
                False, "OWNER_REQUIRED", "High-impact actions require the owner."
            )
        if not context.step_up_valid:
            return PolicyDecision(
                False, "STEP_UP_REQUIRED", "High-impact actions require fresh step-up."
            )
        if not context.approval_valid:
            return PolicyDecision(
                False,
                "APPROVAL_REQUIRED",
                "High-impact actions require explicit approval.",
            )

    return PolicyDecision(True, "ALLOW", "All server-side policy checks passed.")
