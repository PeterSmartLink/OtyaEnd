# Otya OS — API Catalog and Contract Template v1

Status: template; not an endpoint inventory or deployment claim.
Owner: Otya Hold Ltd / Otya OS architecture.
Companion: `docs/OTYA_OS_MASTER_ARCHITECTURE_V1.md`.

## Purpose

Use this file (or one copy per service) to register every externally or internally consumed HTTP endpoint, webhook, and queue event. Populate entries only after inspecting the owning repository and deployed configuration. **Do not infer that an endpoint exists from this template.** Never put secrets, bearer tokens, private keys, customer records, or sensitive production URLs in a public copy.

## 1. Service record

| Field | Value |
|---|---|
| Service / product | TODO |
| Repository and source ref | TODO |
| Accountable owner / escalation | TODO |
| Environments | local / test / staging / production (record actual availability) |
| Runtime and deployment owner | TODO |
| Data domains owned | TODO |
| Dependencies and upstream providers | TODO |
| Health / readiness checks | TODO |
| Security reporting route | TODO |
| Last verified date and verifier | TODO |

## 2. Endpoint inventory

Create one row per route and method. Use `UNKNOWN` rather than guessing. Do not copy secret-bearing environment values.

| ID | Method + route | Environment | Contract version | Auth issuer/audience | Permission / scope | Data owner | Side effects | Idempotency | Rate limit | Timeout/retry | Readiness |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-TODO-001 | TODO | TODO | TODO | TODO | TODO | TODO | read-only / write / financial / admin | required / not applicable / unknown | TODO | TODO | Discovered / Inspected / Designed / Implemented / Tested / Staging verified / Production verified / Retired |

Readiness values must be evidence-backed. A route present in source is not proof that it is deployed, reachable, or production-ready.

## 3. Contract card (copy per endpoint)

### `API-TODO-001` — `METHOD /path`

- **Purpose:** TODO
- **Owner:** TODO
- **Contract version:** `v1` (verify)
- **Allowed environments:** TODO
- **Authentication:** exact issuer, audience, signing/key policy and session/revocation check; never record tokens
- **Authorization:** server-side permission and organization/resource scope
- **Request content type and size limit:** TODO
- **Request schema:** fields, types, bounds, required/optional fields; reject unknown or invalid values where appropriate
- **Response schema:** success shape, pagination and cache policy
- **Error contract:** stable `code`, safe `message`, `requestId`; no stack traces or secrets
- **Data ownership:** authoritative service and tables/collections affected
- **Side effects:** TODO
- **Idempotency:** key format, uniqueness scope, retention, duplicate response and conflict behavior; required for retryable writes with harmful duplicate effects
- **Concurrency/atomicity:** transaction or conditional-write behavior
- **Rate limiting:** limits and behavior if limiter is unavailable
- **Timeout and retries:** bounded policy; do not blindly retry non-idempotent requests
- **Audit/observability:** actor, organization, action, result, request/correlation ID; redact personal data and secrets
- **Dependencies/outage behavior:** fail-closed requirements and user-safe error
- **Tests:** unauthenticated, invalid/expired token, wrong issuer/audience, missing permission, cross-organization access, malformed input, dependency outage, duplicate request, concurrency and audit failure as applicable
- **Deprecation/migration:** compatibility window, consumer list, replacement contract and rollback
- **Evidence:** source file/line, CI run, staging test and last verification date

## 4. Standard response shapes

These are illustrative contract patterns, not implemented code. Keep exact schemas consistent with each service's language and existing API.

Success:
```json
{
  "data": {},
  "requestId": "server-generated-correlation-id"
}
```

Error:
```json
{
  "error": {
    "code": "STABLE_MACHINE_READABLE_CODE",
    "message": "A safe explanation for the caller"
  },
  "requestId": "server-generated-correlation-id"
}
```

Never return stack traces, SQL errors, tokens, provider credentials, private configuration, or raw sensitive records in an error response.

## 5. Event and queue catalog

| Event ID | Event name | Schema version | Producer owner | Consumer owner | Event ID / idempotency | Retry / DLQ | Replay authorization | Financial authority? | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| EVT-TODO-001 | TODO | TODO | TODO | TODO | TODO | TODO | TODO | No unless independently verified | TODO |

Each event schema should define required fields, timestamp semantics, event ID, correlation ID, data classification, compatibility rules and duplicate-delivery behavior. Consumers must be idempotent. Dead-letter replay needs operator authorization, audit history and a documented safe procedure. An event alone must not be treated as proof of payment settlement.

## 6. Authentication and authorization verification matrix

For each protected endpoint, record test evidence for applicable cases:

- [ ] Missing credentials returns 401 without disclosing sensitive detail.
- [ ] Invalid signature, wrong issuer, wrong audience, expired token and unsupported algorithm are rejected.
- [ ] Suspended/revoked session or removed membership is rejected according to the approved policy.
- [ ] Authenticated user lacking the required product permission receives 403.
- [ ] Cross-organization/resource access is denied.
- [ ] Client-supplied role, tenant, price, commission or ledger state is not trusted as authority.
- [ ] Rate-limit or policy dependency failure follows an explicitly approved fail-closed policy for sensitive actions.
- [ ] Logs and error bodies do not contain tokens, OTPs, keys or unnecessary personal data.

## 7. Change and release checklist

- [ ] Owning service and all consumers identified.
- [ ] Request, response, error and event schemas reviewed.
- [ ] Backward compatibility assessed; breaking change gets a new version or migration plan.
- [ ] Authentication, authorization and organization isolation tests pass.
- [ ] Idempotency, concurrency, audit and recovery tests pass for mutations.
- [ ] Dependency/security checks pass; exceptions are documented and time-bounded.
- [ ] Staging contract tests pass against the actual candidate build.
- [ ] Rollback and deprecation plan is documented.
- [ ] Human owner approval recorded before production deployment.
- [ ] Catalog updated after the approved release and production verification.

## 8. Known integration blocker — do not bypass

The ecosystem inventory has identified a mismatch between the inspected Otya Auth JWT claim set and OmniPoint's isolated custom-HMAC test scaffold. They are not interchangeable. Do not translate roles in the browser or connect production clients until the deployed issuer, audience, signature/key policy, expiry/revocation behavior and server-side product membership mapping are verified and tested. The test scaffold is not a production identity integration.

## 9. First inventory pass

Start with read-only routes and health/metadata endpoints, then catalog mutations. For every discovered route, distinguish:
1. **Source discovered** — found in code.
2. **Configuration inspected** — bindings/routes/environment confirmed.
3. **Contract tested** — automated tests pass.
4. **Staging verified** — end-to-end call validated in non-production.
5. **Production verified** — approved release, monitoring and rollback evidence reviewed.

Do not mark unknowns as complete. Do not enable financial operations as part of cataloging.
