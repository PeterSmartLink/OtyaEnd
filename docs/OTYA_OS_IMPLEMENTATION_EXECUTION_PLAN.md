# Otya OS — Implementation Execution Plan

**Date:** 2026-10-27  
**Status:** Execution plan based on the live-state audit. This document authorizes repository planning and isolated branch work only; it does not authorize production changes.

## 1. Outcome

Operate one connected ecosystem under Otya Hold Ltd with clear ownership:

- **Otya Server:** shared control plane, service registry, approved internal APIs, operational status, releases, approvals and centralized email integration.
- **Otya Auth:** shared identity and session authority; each product still performs its own resource/role authorization.
- **OmniPoint:** the owner's physical shop and agency operations, with its own business database, audit trail, inventory, sales, cashbook and agency records.
- **Otya Media:** separate Flutter/Dart media application with its own offline/media-specific lifecycle.
- **Next:** private owner assistant connected to approved Otya Server APIs, not a second public website/backend.
- **OtyaHub:** public developer/partner channel and documentation.
- **GitHub:** versioned source, review, automated checks and release provenance.
- **Cloudflare:** target runtime, D1, R2, Queues/Workflows, KV for cache only, and observability where workload-appropriate.
- **Resend:** one centrally governed transactional email service contract through Otya Server; no product-specific duplicate email infrastructure.

“One ecosystem” means shared contracts and controlled integrations, not one giant application or one database containing every product's data.

## 2. Non-negotiable safety rules

1. No production deployment, DNS/custom-domain change, secret rotation, production migration, data deletion, PR merge, or live financial transaction without explicit approval.
2. No new Supabase, Appwrite or Vercel dependency for the target OmniPoint architecture. Existing legacy references can be removed only after each call path is migrated and verified.
3. Do not label a sample/fallback value as live data. Every screen must show source, freshness and an honest unavailable/error state.
4. No dual-writing financial data to legacy and target stores.
5. Never trust a client-supplied role. Validate token issuer/audience/expiry/signature, then resolve active user, product membership, company/branch scope and role server-side.
6. Keep secrets out of source, logs, docs and tool outputs. Use least privilege and coordinated rotations only when necessary.
7. Every data-changing operation must have authorization, validation, idempotency where retries are possible, audit history, and tests for partial failure/concurrency.
8. External payment calls stay disabled until provider contracts, credentials, callbacks, reversals, reconciliation, sandbox evidence and a separate live-operation approval are all complete.

## 3. Implementation phases and exit gates

### Phase 0 — Freeze the inventory and select canonical sources

**Work**
- Record each repository's default branch, deployment source, workflow, open PRs, environment, and Cloudflare resource bindings.
- Assign one owner and one canonical data store per data domain.
- Trace the current OmniPoint dashboard fetch paths and all legacy Supabase/Prisma references.
- Map all Worker-to-Worker bindings and queue producers/consumers.
- Reconcile public domain identity, authentication behavior and actual deployment source.
- Maintain a list of live, preview, test, idle, and unknown resources.

**Exit gate**
- Each production hostname maps to a repository, branch/commit, Worker/service, environment and rollback method.
- Each OmniPoint screen/API has an explicit data source and no silent sample fallback.
- No unknown write path remains for inventory, sales, ledger or agency records.

### Phase 1 — Protect the foundation

**Work**
- Review account access, MFA/recovery, GitHub branch protections and deployment approvals without changing settings.
- Define structured logs, request IDs, secret/PII redaction and alert thresholds.
- Implement backup creation, retention, restore verification and an isolated recovery drill for D1 and private R2 artifacts.
- Add CI checks for dependency vulnerabilities, type/lint/build/tests, migrations and Worker configuration.
- Review dependency/lockfile integrity before changing CI from npm install to npm ci.
- Fix only confirmed high-severity dependency issues in isolated branches.

**Exit gate**
- A documented restore drill succeeds in an isolated environment.
- CI proves the candidate build and migration set are reproducible.
- Production credentials cannot be exposed to untrusted pull-request workflows.

### Phase 2 — Establish identity and service boundaries

**Work**
- Document and test the Otya Auth token/session contract: issuer, audience, expiry, key rotation, revocation/session invalidation, error handling and service identity.
- Create a server-side adapter for OmniPoint to call Otya Auth through a Cloudflare Service Binding where appropriate.
- Resolve staff status, role, company and branch access from authoritative server-side records on each protected request or a securely bounded session model.
- Keep Otya Core's `otya-store-db` binding separate from OmniPoint's business D1.
- Define versioned API schemas, common error shapes, idempotency keys and correlation/request IDs.

**Exit gate**
- Automated tests reject expired, wrong-audience, wrong-issuer, tampered and revoked tokens.
- Cross-company/branch access is denied by tests.
- No product accepts a Supabase-specific token as the final identity contract.
- No secrets are embedded in client bundles.

### Phase 3 — Make OmniPoint's Cloudflare data path real

**Work**
- Treat `omnipoint-prod` as the intended production business store, but do not assume it is populated or ready.
- Use `omnipoint-migration-test` only for isolated migration and integration work.
- Compare the legacy schema, current `omni_*` schema, migration files and all callers. Resolve the mismatch between legacy `Product/RetailSale/User` tables and the new `omni_*` tables explicitly.
- Create a dedicated OmniPoint Worker/API with only the bindings it needs; do not rebind Otya Core's shared DB to OmniPoint.
- Replace dashboard fetches and writes one screen at a time with typed API clients. Remove silent sample fallback; show loading, empty, stale and error states.
- Add source/freshness indicators so staff can tell whether displayed records are authoritative.
- Preserve legacy systems read-only until approved migration/cutover; never dual-write.

**Exit gate**
- The same authenticated user sees consistent data through API and UI.
- Creating/editing a product in isolated integration tests persists to the intended D1 and writes its audit event atomically.
- No production writes occur during the test.
- Counts, schema mappings and rollback are reviewed before any cutover request.

### Phase 4 — Implement shop operations in business-safe order

**Sequence**
1. Staff/roles, company/branch scope and audit trail.
2. Product catalogue and suppliers.
3. Stock receiving/adjustments and immutable stock movements.
4. Retail sales, sale lines, receipt numbering, atomic stock decrement and balanced ledger posting.
5. Cash drawer/shifts, cash-in/out, end-of-day close and variance review.
6. Mobile-money agency float, commissions, cash-in/cash-out and transaction status records.
7. Reconciliation, reversals, refunds, corrections and reporting.

**Required safeguards**
- Use database transactions/batches where supported; enforce constraints at the database layer where possible.
- Use idempotency for retryable writes and provider callbacks.
- Never edit posted ledger entries in place; use explicit reversal/correction entries.
- Require supervisor approval for defined high-risk adjustments and cash variances.
- Store timestamps in UTC and render local time appropriately.
- Avoid storing unnecessary customer personal data.
- Test duplicate requests, concurrent sales, insufficient stock, mid-write failures, permission changes and replayed callbacks.

**Exit gate**
- Business invariants pass automated tests, including stock never becoming negative unless a deliberately approved policy permits it, and ledger debits/credits balancing per currency and transaction.
- Receipts, stock movement, audit and ledger are consistent after success or rollback.
- A staff user cannot read or mutate another unauthorized scope.

### Phase 5 — Provider readiness, still sandbox-only

**Work**
- Implement provider adapters for Airtel, MTN and Interswitch/Quickteller only behind a disabled-by-default interface.
- Confirm each partner's actual approved product/API, environment, IP allowlist rules, credentials and callback signature/status mechanism.
- Keep provider credentials server-side; test retry and timeout behavior, idempotency, pending/unknown status, reversals, reconciliation and provider downtime.
- Never assume an HTTP timeout means the payment failed; query authoritative status before retrying a financial operation.
- Use sandbox/synthetic data and explicit provider test accounts only.

**Exit gate**
- All sandbox scenarios and reconciliation tests pass.
- No duplicate debit/credit on retries or repeated callbacks.
- Operational runbook covers pending transactions, reversals, provider outages and end-of-day balancing.
- A separate, explicit approval is obtained before enabling any live-money path.

### Phase 6 — Central operations, Resend and queues

**Work**
- Keep Resend under the Otya Server-owned email contract. Inventory key usage and scopes without exposing values.
- Verify a signed Resend test event in a controlled test and confirm idempotent event recording, bounce/complaint handling and alerting.
- Wire the Otya release-event queue consumer or explicitly decommission the unused queue after dependency review.
- Add consumers, retries, dead-letter handling, alarms and idempotency for required OmniPoint jobs.
- Ensure operational dashboards show real health checks, queue age/depth, failed jobs, releases, backup freshness and recent security events—not placeholder counters.

**Exit gate**
- Test events can be traced from producer to consumer and final persisted state.
- Duplicate delivery is safe.
- Failed jobs are visible and recoverable without silent loss.
- Email delivery, bounce and complaint outcomes are observable.

### Phase 7 — Cross-platform product delivery

**OmniPoint Web / Android**
- Keep one versioned API contract and shared business rules.
- Confirm whether an Android-specific OmniPoint source project exists before creating a new app. Do not repurpose Otya Media.
- If the Android app is not yet implemented, first deliver a mobile-first responsive/PWA interface against the same API; use a native shell only if required by the business workflow.
- Test low bandwidth, intermittent connection, accessibility, session expiry and safe retry behavior.

**Otya Media**
- Keep its Flutter/Dart app and offline media architecture independent.
- Trace the reported startup crash on a real device, run tests/build checks, and verify the upgrade/release manifest before claiming a fixed release.
- Keep media release artifacts in R2 and complete the release event consumer path.

**Next / OtyaHub**
- Next consumes approved Otya Server APIs and remains private.
- OtyaHub publishes developer documentation, versioned contracts and onboarding, not secrets or private operational data.

**Exit gate**
- Each product has its own tested release, clear owner and rollback plan.
- Shared authentication and service contracts are verified, while product data remains isolated.

### Phase 8 — Controlled cutover and operations

**Work**
- Run a read-only production comparison before cutover.
- Prepare a migration manifest with source counts, transformed counts, totals, exceptions and reconciliation evidence.
- Restore a copy into an isolated target and test actual recovery.
- Schedule an approved maintenance/cutover window only after all gates pass.
- Keep the legacy source read-only and available for rollback for a defined retention window; do not delete it during cutover.
- Monitor error rate, latency, failed writes, queue lag, inventory/ledger discrepancies, payment status and backup freshness.

**Exit gate**
- Owner explicitly approves the precise migration/deployment scope.
- Reconciliation passes and rollback is rehearsed.
- A post-release smoke test verifies auth, inventory, sales, reports, email and mobile client behavior.
- No unexplained discrepancy remains in financial records.

## 4. PR consolidation policy

The current OmniPoint pull requests overlap. Do not merge all open PRs together. Consolidate them in this order:

1. Security exposure and schema/blocker audits.
2. Shared API/auth contract and isolated security tests.
3. One canonical D1 migration/schema path with repeatable migrations.
4. One inventory API implementation (avoid parallel competing inventory PRs).
5. Dashboard data-source cutover and explicit error/empty states.
6. Atomic stock/sales/ledger operations and integrity tests.
7. Provider adapter boundary, sandbox-only.
8. Optional features (savings groups and broader customer workflows) after core shop operations are stable.

Before merge, rebase or recreate dependent branches on the chosen base, run all checks, inspect the combined diff, and confirm that no secrets, production settings or unintended schema writes are included.

## 5. Cost and complexity policy

- Prefer Cloudflare features already provisioned, but use a feature only when a workload needs it.
- D1 is for relational operational data; R2 is for files/backups; Queues for retryable asynchronous jobs; Workflows for durable multi-step processes; KV only for cache/configuration; Durable Objects only when strict stateful coordination is justified.
- Do not add services merely because they are available.
- Keep existing stable TypeScript/Workers where appropriate. Use Python for suitable new services only after a small compatibility and operational proof; do not rewrite stable code just to standardize language.
- Do not create another website, duplicate login system, separate email platform or second OmniPoint backend.

## 6. Immediate next execution batch

The next safe batch is deliberately narrow and testable:

1. Audit every OmniPoint data fetch/write path and label it as live D1, legacy, sample/mock, or unknown.
2. Trace the deployed Worker and production workflow source/commit; keep this read-only.
3. Reconcile the two OmniPoint D1 schema families and produce a migration map without writing to production.
4. Specify and test the Otya Auth-to-OmniPoint identity contract in isolated tests.
5. Add tests that fail if the dashboard silently substitutes sample data after an API error.
6. Select one canonical inventory PR and close/retire duplicate proposals only after explicit approval; until then, leave them open and document dependencies.
7. Run the relevant branch checks and report exact pass/fail results.

## 7. Reporting standard

Every work batch reports:
- What was inspected/changed and exact repository/branch/commit.
- Which checks ran and their actual result.
- What is deployed versus only in a branch.
- What remains blocked and why.
- Whether any live data, secrets, DNS, provider configuration or production behavior was touched.

No claim of “complete” or “live” is made without evidence from the running system.
