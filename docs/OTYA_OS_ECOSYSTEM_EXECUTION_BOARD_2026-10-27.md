# Otya OS — Ecosystem Execution Board

**Owner:** Otya Hold Ltd  
**Operating business:** Otya Hold Ltd T/A OmniPoint  
**Updated:** 2026-10-27  
**Status:** Review-branch execution board; not production authorization.

## Mission

Evolve existing repositories and deployed services into one maintainable Otya ecosystem. Reuse existing systems, preserve product data boundaries, remove duplicated infrastructure only after a verified cutover, and never mistake a plan, branch change, test fixture, or preview for production readiness.

## Canonical product map

| Component | Responsibility | Data authority | Integration rule |
|---|---|---|---|
| Otya Server / Otya Core | Shared service control plane, service registry, release/status APIs, internal integrations and central Resend gateway | Otya operational metadata in its own D1; not OmniPoint sales records | Versioned internal APIs, service bindings where supported, request IDs, audited writes |
| Otya Auth | Identity/session authority | Auth identity database | Product authorization remains server-side and scoped to product, company and branch |
| Next | Private owner assistant and orchestration UI | Its conversations/tasks through approved server APIs | AI proposes; server-side policy authorizes; high-impact actions need fresh owner step-up and explicit action-bound approval |
| OmniPoint | Owner's physical retail/mobile-money agency business | Dedicated OmniPoint D1/business schema | Inventory, sales, cashbook, float, commissions, reconciliation and audit trail stay within OmniPoint's data boundary |
| Otya Media | Offline-first Flutter/Dart media player | Local device media for core playback; release metadata in Otya services | Local playback must work without account, AI or network; don't duplicate Next/OmniPoint features in the player |
| OtyaHub | Public developer/partner hub and documentation | Public project documentation | Public content only; never publish private operational data or secrets |
| Python foundation | Suitable service/tooling layer, automation, validation, reconciliation, AI evaluations | No production business authority until explicitly integrated | Typed contracts, tests, least privilege; do not rewrite stable Workers without measured reason |
| GitHub | Source of truth, reviews, CI and provenance | Git history and checks | Review branches first; no automatic merges or production deployment from this board |
| Cloudflare | Target runtime and platform services | D1 per data domain; R2 for object/blob storage; Queues for async work; KV for cache/rate-limit/config only where suitable | Least-privilege bindings, explicit environment separation, backups and restore drills |
| Resend | Central transactional email provider | Provider delivery state plus Otya event/audit records | One central integration and webhook verification; product services must not create independent email-key sprawl |

## Confirmed risks and constraints

1. Cloudflare inventory previously showed `otya-core` bound to `otya-store-db`, not to OmniPoint's business database. Do not repoint it to OmniPoint.
2. The intended `omnipoint-prod` D1 had the newer `omni_*` schema but the inspected tables were empty. `omnipoint-migration-test` contained legacy tables and sample rows. Do not promote the migration test DB or label empty results as live shop data.
3. OmniPoint needs a complete schema/caller reconciliation for legacy `Product`, `RetailSale`, `User` and new `omni_*` tables before choosing a cutover.
4. Otya Server's Resend webhook handler has signature/idempotency protections, but a fresh delivery test was not confirmed in the audit. Never print API key values.
5. The Otya Server push validation run `40488530700` reported 308/309 core tests passing and failed the assertion named `future explicit core deploys provision the existing Resend API key without weakening deploy authority`. All deploy jobs were skipped on the push event. The deployment workflow also contains malformed status regexes in its production smoke checks. This must be corrected and validated on an isolated review branch; do not dispatch production deployment as a way to test it.
6. The Python AI policy module is tested but is not wired into the live AI Worker. The Next AI execution/evaluation contract is documentation until connected to actual runtime paths.
7. Existing owner-action handlers already have prepare/approve/execute and idempotency controls for certain actions. Preserve and extend these protections rather than introducing a parallel approval mechanism.
8. Queue audit found a release-events queue without a confirmed consumer and OmniPoint job/DLQ queues without confirmed producers/consumers. Map actual use before wiring them up or deleting them.
9. Resend is an ecosystem service through Otya Server, not a separate product. Keep provider credentials server-side and centrally governed.
10. The user has explicitly excluded new Supabase, Appwrite and Vercel dependencies from the target OmniPoint architecture. Legacy paths may be removed only after replacement behavior and data integrity are proven.

## Execution tracks and gates

### Track A — Repository and deployment provenance
- Maintain a matrix of repository, default/review branch, deployment workflow, deployed commit, environment, Worker name, domain, bindings and rollback method.
- Trace actual source for each public hostname and each app's API base URL.
- Group overlapping PRs by dependency order; do not merge automatically.
- Fix the malformed smoke-check expressions and the failing Resend-related assertion in a review branch. Test workflow syntax and relevant unit tests. Keep production deploy jobs gated behind the existing explicit owner-confirmed workflow dispatch.

**Done when:** every production surface maps to a verified commit/resource, CI passes, and rollback is documented.

### Track B — Cloudflare/data truth
- Build a data-domain inventory for Otya Auth, Otya Server, OmniPoint and releases.
- For OmniPoint, compare old and new schemas, migration history, constraints, indexes, API callers, and financial invariants.
- Add non-production migration tests and reconciliation reports before any migration.
- Add a restore test for D1 and R2; record last backup, retention, integrity result and recovery time.
- Every UI/API reports authoritative source, freshness and explicit unavailable/empty/error states.
- No dual-writing for sales, cashbook, float, commissions or payments.

**Done when:** a tested single-writer data path exists for each business entity and an isolated restore succeeds.

### Track C — Identity and access
- Standardize token issuer/audience/expiry/signature/revocation checks.
- Resolve product membership, company and branch scope on the server; never trust client-provided role claims alone.
- Test cross-product and cross-branch denial, session revocation and service-to-service authentication.
- Require stronger authentication and action-bound approval for production deploys, secrets/DNS, privileges, destructive data actions and financial execution.

**Done when:** negative authorization tests prove forbidden access fails closed.

### Track D — Next / AI runtime
- Start with read-only approved tools: repository metadata, service health, task status, and explicitly scoped operational summaries.
- Define a server-owned tool registry with schema, risk tier, required scopes, data boundary, idempotency behavior and audit fields.
- Treat retrieved documents, email, issue text, websites and tool outputs as untrusted data—not instructions.
- Use structured model output only as a proposal; validate schema and policy independently before any tool call.
- Preserve the existing prepare → exact approval → execute path for supported owner actions; don't let model text itself count as approval.
- Add evaluations for prompt injection, source grounding, tool scope, stale/expired approval, duplicate execution, provider timeout, misleading success claims, cost/latency and English/Luganda handling.
- Store typed memories with source, timestamp, confidence, expiry/correction history; never store secrets or unnecessary sensitive personal data.
- Report outcomes truthfully: `verified`, `changed_on_branch`, `planned`, `blocked`, or `unknown`.

**Done when:** policy checks run in the actual server path, all evaluations pass, and high-impact operations remain blocked without fresh approval. Until then, the Python policy is reference-only.

### Track E — OmniPoint business readiness
- Build shop operations first: products/stock movements, sales/returns, cashbook, mobile-money agent float, deposits/withdrawals, commissions, expenses and reconciliation.
- Keep customer-facing checkout, staff/agent operations, owner reporting and permissions as separate role views over one versioned API.
- Add immutable financial event/audit records, transaction idempotency, reversal workflows, daily close and reconciliation reports.
- Keep Airtel, MTN and Interswitch integrations sandbox-only until provider callback signatures, IP allow-listing, retries, reversals, reconciliation and provider approval are demonstrated.
- Do not execute live transfers, accept live payment instructions or mark a provider integration ready based solely on credentials or a successful HTTP response.

**Done when:** sandbox evidence and reconciliation tests pass, followed by a separate explicit live-operation approval.

### Track F — Otya Media / Android
- Preserve the existing Flutter/Dart app and package identifiers until a tested migration says otherwise.
- Trace startup crash from device logs, CI artifacts and reproducible steps before changing media architecture.
- Add offline regression tests for local scan, audio/video playback, search, vault, permissions and network-disabled behavior.
- Reuse shared Otya APIs only for optional cloud/account/release features; local media must remain independent.
- Validate Android build and artifact provenance before release; no release upload without approval.

**Done when:** a reproducible build and startup/playback smoke test pass on supported Android versions.

### Track G — OtyaHub and ecosystem operations
- Keep public developer docs, API contracts, onboarding and status information aligned with actual shipped behavior.
- Publish integration examples only from versioned, tested contracts; remove stale provider/deployment instructions after verifying replacements.
- Map queue ownership and add consumers/producers only when a concrete use case and idempotency contract exist.
- Centralize Resend, operational notifications and delivery diagnostics through Otya Server.

**Done when:** docs match live capabilities, queues have explicit ownership, and email delivery is verified without leaking recipient or secret data.

### Track H — Python, automation and evaluation
- Keep the Python foundation as an isolated, tested foundation until a service has a concrete owner and deployment contract.
- Use Python for repository/data audits, schema comparison, reconciliation, CI quality gates, test data generation, offline evaluation and suitable API services.
- Do not duplicate D1 as a shadow production database; Python tools should call approved APIs or operate on explicit export/preview datasets.
- Include timeouts, retries with idempotency, typed inputs/outputs, request IDs, redaction and measurable tests.

**Done when:** each Python component has a defined purpose, contract, test suite, runtime/cost budget and owner.

## Immediate execution order

1. Fix and validate the deployment smoke-check syntax and Resend-related test on a review branch.
2. Produce a repository/Worker/hostname/binding matrix and reconcile overlapping PRs.
3. Trace Next and AI Worker routes; connect the existing policy to the actual tool-execution path in a branch with tests.
4. Complete OmniPoint schema/caller mapping and a no-write reconciliation report.
5. Add identity scope and cross-branch authorization tests.
6. Build an isolated backup/restore drill.
7. Complete Otya Media startup/crash diagnostics.
8. Close the queue and Resend delivery verification gaps.
9. Only after these gates, request approval for any production migration or deployment.

## Explicitly out of scope without fresh approval

- Production deploys, production Worker bindings, DNS/domain changes, production secret writes/rotation, live data migration/deletion, PR merges, enabling payment execution, sending real customer messages, or financial transfers.
- Any claim that the system is production-ready without evidence from the exact environment.
