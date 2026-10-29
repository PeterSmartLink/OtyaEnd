# Otya Server Connector Foundation

**Status:** proposal for review; not deployed and not a claim of implemented connector runtime.  
**Owner:** Otya Hold Ltd  
**Target platform:** Cloudflare Workers-first, GitHub-reviewed source  
**Purpose:** give Otya Server one safe, extensible way to connect authorized software, APIs, local agents, and compatible devices without turning the control plane into a universal administrator.

## 1. Product promise and limits

Otya Server should provide one governed integration layer for Otya OS and approved products. A connector can only operate a system when that system exposes a supported API/protocol, an approved local agent, or a device integration, and the operator has granted the required permission. No architecture can guarantee control of every product, device, account, or closed ecosystem.

Build around **capability discovery, explicit authorization, typed actions, approvals, audit, and revocation**. Do not expose an arbitrary shell, unrestricted URL fetcher, generic SQL endpoint, or unrestricted browser to AI agents.

## 2. Core components

- **Connector Registry:** versioned metadata describing connector ID, owner, supported capabilities, required scopes, health-check method, data classification, risk level, and supported versions.
- **Connector Runtime:** dispatches only registered and enabled connectors; validates inputs and outputs against schemas; applies timeouts, size limits, rate limits, and retry policy.
- **Authorization Policy:** checks the authenticated subject, product membership, resource scope, requested capability, and action risk on every call. Authentication alone never grants product access.
- **Approval Gate:** records explicit owner/staff approval for high-impact actions before execution. Approval is bound to the exact action, normalized parameters, target, expiry, and requester; changing any parameter invalidates it.
- **Execution Ledger:** records request/correlation ID, actor, connector/version, capability, target, decision, approval reference, start/end time, result category, and redacted error details. Never log tokens, secrets, full payment credentials, or unnecessary personal data.
- **Event/Job Layer:** queues retryable asynchronous tasks; handlers must be idempotent because queue delivery can be repeated.
- **Local Agent (later phase):** an opt-in, outbound-only authenticated agent for a user's own computer or LAN. It receives narrowly scoped jobs and cannot become a public remote shell.
- **Connector SDK:** reusable interfaces, JSON Schema validation, fixtures, conformance tests, and examples for first-party and reviewed third-party connectors.

## 3. Connector contract

Every connector must declare:
- stable ID, semantic version, publisher/owner, lifecycle state (draft, enabled, suspended, retired);
- supported capability names and versioned input/output schemas;
- minimum scopes and target-resource rules;
- risk classification (read, write, sensitive, financial, destructive);
- timeout, request-size and rate limits, retry/idempotency behavior;
- health-check strategy and data-handling/retention notes.

A capability is a named operation such as inventory.product.read, email.message.send, or device.status.read; it is not an unrestricted pass-through. Every invocation returns a normalized result with a correlation ID and a stable error category. Never silently retry a non-idempotent external action.

Illustrative TypeScript contract only; not yet production code:

~~~ts
type Risk = "read" | "write" | "sensitive" | "financial" | "destructive";

interface ConnectorManifest {
  id: string;
  version: string;
  publisher: string;
  capabilities: Array<{
    name: string;
    inputSchema: string;
    outputSchema: string;
    risk: Risk;
    requiredScopes: string[];
    requiresApproval: boolean;
    idempotent: boolean;
  }>;
}

interface ConnectorContext {
  requestId: string;
  actorId: string;
  productId: string;
  grantedScopes: string[];
  signal: AbortSignal;
}

interface Connector {
  manifest: ConnectorManifest;
  execute(
    capability: string,
    input: unknown,
    context: ConnectorContext
  ): Promise<{ ok: true; data: unknown } | {
    ok: false;
    code: string;
    retryable: boolean;
  }>;
}
~~~

The runtime must validate the capability and schema before invoking a connector, re-check authorization immediately before execution, and validate the response before returning it.

## 4. Execution flow

1. Authenticate the caller and resolve the active product membership.
2. Parse the request; validate connector ID, version, capability, target and input schema.
3. Apply authorization, product boundaries, rate limits and risk policy.
4. For an approval-required action, create a pending approval bound to the exact normalized request and stop. Do not execute it yet.
5. On approval, re-check the approver's authority, request expiry, requester status, target and exact action hash; then execute using a stable idempotency key where supported.
6. Apply timeout and bounded retry rules. Treat external results as unconfirmed until the provider's authoritative response or status check confirms them.
7. Persist an audit outcome and return a normalized response with the correlation ID.
8. Support immediate connector disablement, credential revocation and subject/session revocation.

If authorization, policy, audit persistence, approval verification, or required configuration fails, sensitive execution must fail closed.

## 5. Cloudflare-first deployment boundaries

- Keep the registry and orchestration APIs in Otya Server, but keep each product's business data in its owning product database and API.
- Use Cloudflare service bindings for private Worker-to-Worker calls where appropriate, and native bindings for D1, KV, R2 and Queues. Do not route internal calls through public endpoints unnecessarily.
- Use Worker secrets/secret bindings for credentials; never commit secrets or put them in public configuration.
- Use D1 for durable registry, approval, idempotency and audit metadata only where the schema and access model are reviewed. KV may cache non-authoritative metadata, not be the only source for financial idempotency or durable approvals.
- Use Queues for retryable background work only after duplicate delivery, bounded retry, dead-letter and replay behavior are tested.
- Keep credentials per connector and environment, with the smallest possible scopes. Never share a product's privileged credentials across connectors.
- A local agent must initiate outbound connections, authenticate each session, pin allowed control-plane endpoints, and require local installation plus explicit device enrollment. No inbound open port or unrestricted command execution by default.

Cloudflare bindings are capabilities: adding a binding grants code access to a resource. Treat each binding as a permission boundary and review it as carefully as an API credential.

## 6. Risk and approval defaults

| Action class | Default policy |
| --- | --- |
| Read-only health/status | Allowed only with matching scope and target authorization |
| Ordinary reversible write | Explicit scope; idempotency and audit; approval according to product policy |
| Send email, publish content, modify access, or change configuration | Preview + approval unless a narrowly scoped policy explicitly permits automation |
| Financial movement, payment initiation, refund, cash/float posting, or provider activation | Disabled until provider sandbox, reconciliation, idempotency and owner release gates pass; explicit approval required |
| Destructive action, deletion, credential rotation, deployment, DNS or production migration | Deny by default; require a separate explicit approval and verified rollback/recovery plan |
| Shell, arbitrary code, arbitrary SQL, arbitrary network proxy | Not a general connector capability; require a separate reviewed, isolated product design if ever needed |

Approval never overrides authorization or product data ownership. An approved action must still pass current policy at execution time.

## 7. API surface proposal

These are design candidates, not routes asserted to exist:
- GET /v1/connectors — list connectors visible to the caller and their safe metadata.
- GET /v1/connectors/{id}/capabilities — list capabilities permitted for the caller.
- POST /v1/connector-runs — validate and run a permitted low-risk action or return a pending approval.
- GET /v1/connector-runs/{requestId} — inspect the caller-authorized execution status.
- POST /v1/approvals/{id}/decision — approve or reject a specific pending action.
- POST /v1/connectors/{id}/suspend — owner-only emergency suspension with step-up authentication and audit.

Before implementation, align route naming, auth claims, session revocation and API error conventions with the current Otya Server code rather than creating a parallel auth system.

## 8. Delivery phases and acceptance gates

### Phase A — Contract and threat model
- Confirm existing auth/session contract, owner role, product scope model, error format and audit conventions.
- Define connector manifest schema and stable error codes.
- Add threat model and negative test cases.
- **Gate:** no route or credential change; architecture review accepted.

### Phase B — Read-only registry and one safe connector
- Add registry schema, validator and read-only registry API.
- Implement one low-risk HTTP/API connector with destination allow-list, private-IP/loopback/link-local protections, redirect revalidation, strict timeout, response-size limits and no arbitrary headers.
- Block SSRF, open proxy behavior, untrusted URL schemes, and secret exfiltration.
- **Gate:** schema, auth, scope, URL policy, timeout, size and audit tests pass.

### Phase C — Approval and durable execution
- Add pending approval records, exact-action hashing, expiry, actor/approver separation where policy requires it, idempotency and execution audit.
- Test replay, duplicate queue delivery, revoked sessions, changed parameters, concurrent approval, and audit-storage failure.
- **Gate:** no sensitive action executes on a missing/invalid approval.

### Phase D — Product-owned connectors
- Add reviewed connectors through product APIs, starting with read-only health/status.
- OmniPoint connector must call OmniPoint's authorized API; it must never read or write OmniPoint D1 directly from Otya Server.
- Resend/email and payment providers require dedicated capability scopes, sandbox tests, rate controls and explicit activation gates.
- **Gate:** each connector has an owner, contract tests, rollback/disable procedure and data classification.

### Phase E — Local agent and device integrations
- Specify enrollment, local consent, signed job envelopes, narrow capabilities, revocation, offline behavior and upgrade security.
- Start with status/read-only capabilities; require local confirmation for sensitive device operations.
- **Gate:** no arbitrary remote shell or LAN-wide discovery by default.

### Phase F — Automation and AI orchestration
- AI can propose typed actions and explain consequences; policy engine authorizes them. AI output is untrusted input and never directly grants itself capabilities.
- Show target, exact action, data impact and reversibility before approval.
- Provide dry-run/preview, cancellation, audit review and per-connector kill switch.
- **Gate:** adversarial prompt-injection, cross-product authorization and approval-bypass tests pass.

## 9. Required test matrix

- Missing, malformed, expired, wrong-audience and revoked identity.
- User has login but no active membership or required scope.
- Cross-product and cross-company target access.
- Disabled/retired connector and unsupported connector version.
- Invalid input/output schema; oversized payload; timeout; redirect to a disallowed destination.
- Secret/token redaction and no credential leakage in errors/logs.
- Duplicate request, retry, queue redelivery, idempotency-key collision and uncertain provider outcome.
- Approval expiry, altered parameters, unauthorized approver, self-approval where prohibited, replay and race conditions.
- Audit/DB outage fails closed for high-risk actions.
- Connector suspension and credential revocation take effect promptly.
- Product-specific API remains authoritative; no cross-product database access.
- Production deployment, DNS/secrets, migrations and live financial operations remain gated independently.

## 10. Definition of done

The connector foundation is ready for limited release only when its schema and policy are implemented, the first read-only connector passes its security and contract tests, execution and audit are observable, disable/revoke works, and the owner can verify exactly what a connector may do. The existence of this document or a green documentation-only check is not evidence that the runtime is implemented or production-ready.

## 11. Explicit non-goals

- No claim that every external product supports integration.
- No automatic access to private accounts or devices without consent and authorization.
- No single shared database for all products.
- No arbitrary shell, generic SQL, open proxy, or unrestricted AI tool execution.
- No production deployment, DNS/secrets change, production migration, live email, payment activation, or money movement as part of this proposal.
