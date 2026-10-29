# Otya Ecosystem — Execution Status and Build Order

**Last reviewed:** 2026-10-29  
**Status:** Live inventory and source review are in progress. This document is not a production-readiness certification.

## Canonical structure

- **Otya Hold Ltd** — parent company.
- **Otya OS** — the unified experience and control plane, built by reusing existing services.
- **Otya End** — shared backend, identity, integration contracts, notifications and operations.
- **OtyaPoint** — the owner's shop and agency operations.
- **Otya Media** — separate Flutter/Android media product and release lifecycle.
- **OtyaHub** — public developer/partner channel only while it has a distinct audience and purpose.
- **Resend** — first-class Otya End email provider; not a separate product or standalone platform.

Legacy GitHub repository names remain unchanged until compatibility, redirects, workflows, integrations and approval are reviewed.

## Repository and branch findings

A read-only GitHub audit on 2026-10-29 found many open PRs and long-lived topic branches across Otya End, OtyaPoint and Otya Media. Some changes are duplicated by newer PRs; others are stacked on earlier branches, so closing them blindly would lose or strand work.

Working policy:
1. Keep `main` as the only permanent integration branch unless a demonstrated release need justifies `staging`.
2. Use temporary branches for grouped changes; one PR should cover one coherent deliverable, not one tiny edit.
3. Keep dependency/security changes separate when their test/release risk differs from feature work.
4. Before closing a PR, identify its unique commits/files and either transfer the needed change to the canonical PR or explicitly retain it as an independent task.
5. Do not delete topic branches until their work is merged, safely transferred, or proven obsolete. No branch deletion is performed by this audit.

## Verified Cloudflare inventory (resource presence only)

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1 databases: `otya-auth-db`, `otya-store-db`, `omnipoint-dev`.
- R2 buckets: `otya-assets`, `otya-player-releases`, `omnipoint-dev-private`, `omnipoint-dev-backups`.
- Queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`, `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`.
- Pages lab: `omnipoint-relay-lab`.
- Zone: `petersmartlink.com`, reported active.

Presence is not proof of correct configuration, traffic, health, backup freshness or restore capability. Do not delete or merge any resource based on its name alone.

## Highest-priority blockers

### 1. Otya End security
A recent repository security workflow reported critical/high dependency findings. Resolve patched compatible versions and regenerate lockfiles using the repository's package manager; run audit, type-check, tests and build. Do not use force-upgrades blindly and do not deploy as part of dependency remediation.

### 2. OtyaPoint's actual Cloudflare API path
The live inventory did not find a deployed `omnipoint-dev-api` Worker, while the repository's Wrangler config describes one. The config also disables `workers_dev` and has no verified route/custom domain. Establish a private preview endpoint and validate bindings before any deployment. The UI must fail closed and never fall back to Supabase/Postgres.

### 3. OtyaPoint D1 and financial integrity
`omnipoint-dev` has migrations `0001`–`0003`; sale idempotency migration `0004` is not applied. Validate the migration and add route-level tests for repeated requests, changed-payload conflicts, concurrency, rollback, stock movement and audit events. Apply migrations only to the explicitly approved isolated environment after backup/restore evidence. Do not process live money.

### 4. Data ownership and recovery
`otya-store-db` is shared by `otya-core` and `otya-next`; do not split or consolidate it until table ownership and service dependencies are mapped. `otya-auth-db` has auth tables but no recorded `d1_migrations` rows; reconcile provenance before applying migrations. Verify backup export, checksum, retrieval and isolated restore before treating backup buckets as reliable.

### 5. Resend
Keep Resend as a shared integration behind Otya End. Verify sender-domain readiness, server-only credentials, webhook signature validation if webhooks are enabled, idempotent event handling, delivery tracking, bounded retries and a dead-letter path. Email failure must not roll back a sale or other financial transaction. Treat inbound email content as untrusted.

### 6. Otya Media
Keep the Android app/release pipeline separate from backend/shop deployments. The startup crash remains unresolved until verified on a device; CI success alone is insufficient. Fix maintenance-only CI guards so documentation/workflow changes do not require an app build-number bump, while app/release changes still do.

## Target operating model

- **Workers:** retain current services while mapping routes, bindings and consumers; reduce to the smallest justified set only after evidence. Do not assume that two Workers can be merged safely.
- **D1:** authoritative relational state with clear ownership. Never use KV as a financial ledger.
- **R2:** private business objects/backups and media release artifacts with explicit access policies and tested recovery.
- **Queues:** preserve dead-letter queues and financial job isolation until retries, consumers, and replay behavior are proven.
- **Resend:** shared email adapter; no additional email provider unless explicitly approved.
- **Payments:** provider-neutral contracts for Interswitch/Quickteller and Airtel/MTN; sandbox only until separately approved.
- **Identity:** shared Otya identity integration plus application-specific authorization; a valid login must not imply shop permissions.
- **Observability:** privacy-safe structured logs, correlation IDs, health/readiness checks and actionable alerts.

## Delivery sequence

1. Patch and verify critical dependency vulnerabilities.
2. Reconcile repository source, CI, deployed Worker scripts, routes and bindings.
3. Establish a private OtyaPoint API preview endpoint without production routing.
4. Validate D1 migrations and financial invariants in an isolated environment.
5. Prove backup restore; document rollback.
6. Finish the Cloudflare-only UI/API path and remove unused external runtime code only after search/tests/build prove it is unused.
7. Verify Resend end to end without exposing secrets.
8. Verify Otya Media startup/playback and release gates.
9. Consolidate duplicate PRs and temporary branches after preserving unique work.
10. Revisit repository/resource renames only after compatibility review.

## Explicit no-go gates

No production deploy, DNS/route changes, secret changes, production migration, deletion, live provider activation or live financial transaction without explicit approval. Never claim a feature is ready from code presence or a green build alone.

## Fresh read-only recheck — 2026-10-29

### Cloudflare runtime and data
- The account's live Worker script list contains only `otya-auth`, `otya-core`, and `otya-next`; there is no deployed `omnipoint-dev-api` Worker.
- The configured Worker Domains currently point at production services under `petersmartlink.com` (`otya-core`). No OtyaPoint preview hostname/domain was observed. Do not attach an OtyaPoint route to these production domains.
- `omnipoint-dev` records only `0001_core.sql`, `0002_company_scope.sql`, and `0003_staff_profile.sql`. A read-only `PRAGMA table_info(omni_retail_sales)` confirms the live database does not yet contain `request_fingerprint`; the additive migration `0004_sale_request_fingerprint.sql` is still pending.
- Separate count queries returned zero rows for `omni_products`, `omni_retail_sales`, `omni_retail_sale_lines`, `omni_stock_movements`, `omni_agency_transactions`, `omni_ledger_entries`, `omni_staff_memberships`, and `omni_audit_events`. These checks did not inspect customer data and performed no writes.
- `otya-store-db` still has 12 named migration records (`0002`–`0013`) and remains shared by Otya Core/Next. `otya-auth-db` has auth tables but its `d1_migrations` table has no migration records. Do not infer a safe migration sequence until its schema provenance is reconciled.

### OtyaPoint integration blockers
- The current website still imports Supabase Auth and Prisma for login, staff mapping, product actions and staff invitations; this is not yet a Cloudflare-only UI/API path.
- The existing same-origin products bridge creates an HMAC JWT with its own issuer/audience. The Cloudflare API Worker instead forwards bearer tokens to Otya Auth's `/auth/verify` service binding and expects a verified Otya Auth identity. Those are different trust contracts. The bridge must not mint an Otya-looking token and treat it as an Otya Auth session.
- Existing PR #45's updated isolated test suite passed its recorded GitHub Actions checks (schema/migration tests, Worker type-check, Wrangler dry-run, lint, and dashboard build) on the current PR head. That is code validation only: the live D1 migration remains pending and no route-level replay/concurrency/rollback tests have yet proven the financial behavior.
- Existing PR #46 now fails closed before deployment unless an explicit route and a verified isolated HTTPS preview endpoint are configured. It has not been dispatched. No Worker, route, DNS record, D1 migration, or secret was changed during this recheck.

### Recovery boundary
The presence of `omnipoint-dev-backups` does not prove an export is current or restorable. D1 export can temporarily make a database unavailable during export; do not run an export against a live database without scheduling/approval. Before any migration, create a verified export, checksum it, restore into a separate isolated database, and run integrity/schema checks. Do not apply migration `0004` or deploy the Worker until the endpoint and Otya Auth trust contract are resolved.
