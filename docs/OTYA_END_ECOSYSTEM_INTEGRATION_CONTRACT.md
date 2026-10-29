# Otya End — Ecosystem Integration Contract
Status: proposed contract for review. It does not change deployed routes, tokens, database schemas, or production bindings.

## 1. Canonical naming
- Legal parent: Otya Hold Ltd.
- Shared backend and integration layer: Otya End (legacy repository slug `Otya-Server` and existing Worker names remain unchanged until separately migrated).
- Unified platform: Otya OS.
- Shop/agency application: OtyaPoint (legacy repository slug `OmniPoint`; existing Cloudflare resources with `omnipoint-` names remain unchanged for compatibility).
- Media player: Otya Media (legacy repository slug `OtyaPlayer`; Android package `com.otyaplayer.app` remains unchanged until a safe app migration is approved).
- Public developer and partner community: OtyaHub.

## 2. Ownership boundaries
- `otya-auth`: identity, login/session validation, token issuance/verification, authentication security events. It must not decide which shop records an identity may access.
- `otya-core`: shared platform APIs and cross-product orchestration. It must call product-owned services for domain mutations rather than directly bypassing product authorization.
- `otya-next`: AI/support capabilities and asynchronous job processing. It must not receive broader financial database access than required for a named job.
- OtyaPoint API: owns retail catalog, inventory, sales, agency transactions, commissions, ledger, reconciliation and shop audit events. Its own D1 database is intended to be isolated from general platform data.
- Otya Media: owns app release metadata and media-specific service state. Release artifact storage may be shared as a delivery mechanism, but release authorization and signing remain scoped.
- OtyaHub: public developer content and contribution workflows; no direct access to private customer/financial data.

These are target boundaries. Current Worker bindings show `otya-core` and `otya-next` share `otya-store-db`; current OtyaPoint `omnipoint-dev` is not bound in inspected live Worker settings. Do not infer that the target separation is already implemented.

## 3. Authentication and authorization contract
1. Authenticate the caller at the trusted edge using Otya Auth or a documented service-to-service identity.
2. Validate issuer, audience, expiry, not-before, signature/algorithm and key ID; reject missing/invalid claims closed.
3. Derive the subject from the verified token, never from an arbitrary request field.
4. Authorize the action against product, company/tenant, staff membership, role and resource scope on every request.
5. Use separate scopes for read, create, update, reversal, reconciliation, staff administration and platform administration.
6. Require MFA or step-up verification for staff administration, payout/float-sensitive actions, reversals and other high-risk operations when supported.
7. Never accept a client-supplied role, company ID, actor ID, balance or authorization decision as authoritative.
8. Do not log bearer tokens, passwords, OTPs, provider secrets, or complete financial payloads.

## 4. HTTP API conventions
- Prefix new public APIs with `/api/v1/<product>/<resource>`; preserve existing paths through compatibility adapters until consumers are migrated.
- JSON success and error responses use stable machine-readable codes. Do not expose stack traces or secret/configuration values.
- Use `Authorization: Bearer <token>` for user identity; use separate, short-lived service credentials for Worker-to-Worker calls.
- Require idempotency keys for retryable financial mutations. Bind the key to actor/company, operation and a canonical request fingerprint. A replay with a different payload returns HTTP 409.
- Use correlation IDs across request logs and asynchronous jobs. Treat caller-provided IDs as untrusted values and validate/replace as needed.
- Apply per-route rate limits, request size limits, timeouts and input schema validation.
- Paginate list endpoints and avoid returning sensitive fields by default.

## 5. Asynchronous event envelope
Proposed JSON envelope for new events:
```json
{
  "eventId": "globally-unique-id",
  "eventType": "product.resource.action.v1",
  "occurredAt": "RFC3339 timestamp",
  "producer": "service-name",
  "schemaVersion": 1,
  "correlationId": "request-or-workflow-id",
  "idempotencyKey": "optional-operation-key",
  "tenantRef": "opaque-tenant-reference",
  "payload": {}
}
```
Consumers must validate schema/version, deduplicate by event ID or operation key, acknowledge only after durable handling, retry transient errors with bounded backoff, and send exhausted messages to a configured DLQ. Do not put credentials or unnecessary personal/financial data in queue messages. This envelope is a proposal; do not change existing queues until compatibility tests exist.

## 6. Financial mutation invariants (OtyaPoint)
- Use integer minor units for currency and store explicit currency codes; do not use binary floating-point for money.
- Validate product availability and company ownership within the same atomic database operation as sale creation and stock decrement.
- Keep sale, sale lines, stock movements, ledger postings, idempotency record and audit event atomic where they represent one business action.
- Use append-only ledger entries; corrections are reversals/adjustments with references, not edits to posted history.
- Reject negative stock unless an explicit reviewed policy permits it.
- Track provider requests and callbacks with idempotency and signature verification; sandbox by default.
- Reconcile internal transactions against provider settlement/report data; never equate an API HTTP success with final settlement.
- Prevent live money movement until credentials, limits, callback validation, reversals, reconciliation and incident procedures have passed review.

## 7. Data and backup policy
- Every database must have a named owner, environment, migration directory, retention policy and recovery objective.
- Keep production, preview and local-development data separate. Never use customer or financial production data in test fixtures.
- Encrypt sensitive data in transit and at rest using platform controls; scope access by service and environment.
- Backups require documented cadence/retention, integrity checks and a successful restore into an isolated target. Bucket existence alone is not backup evidence.
- Record migration checksums and test forward migration and rollback/recovery procedures; do not automatically roll back a financial database migration if that could lose committed data.
- Never write secrets into the registry or GitHub source. Use Cloudflare secrets and protected GitHub environment secrets.

## 8. Operational requirements
- Every service needs health/readiness checks, structured redacted logs, request/job correlation, error-rate and latency monitoring, rate-limit and queue/DLQ alerts, and an owner.
- Deploy through reviewed GitHub workflows with pinned actions, least-privilege permissions, environment separation and protected production approvals.
- Preview checks must not point at production D1 or live payment-provider credentials.
- Every deployment must have a known artifact/commit, migration status, rollback plan and post-deploy verification.
- Cost controls must include usage alerts/limits where available, queue retry caps and protection from unbounded loops.

## 9. Adoption sequence
1. Review this contract and the verified resource registry.
2. Add contract tests to Otya Auth and the OtyaPoint Worker before changing routes or bindings.
3. Isolate OtyaPoint data and verify company/staff authorization, transaction atomicity and idempotency.
4. Prove backup/restore and queue DLQ behavior.
5. Migrate existing clients with compatibility adapters and telemetry.
6. Rename repository slugs and public endpoints only in a separate approved migration with redirects and rollback plan.
7. Enable production integrations only after explicit approval and provider certification.

## 10. Acceptance criteria
- All live resources are mapped to one owner, environment and data classification.
- All service-to-service and user API routes have documented authz tests.
- D1 migrations pass from empty database and supported upgrade states.
- Financial invariant tests cover duplicate, conflicting, concurrent, insufficient-funds/stock, rollback, reversal and reconciliation scenarios.
- Backup restore evidence is recorded with a timestamp and isolated target.
- Security audit has no unresolved critical/high runtime vulnerabilities without a time-limited, documented exception.
- No production change occurs as a side effect of a documentation or preview PR.
