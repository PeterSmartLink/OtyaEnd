# Otya ecosystem consolidation and gap-closure plan

**Owner:** Otya Hold Ltd  
**Status:** implementation plan; not production authorization  
**Last reviewed:** 2026-10-27

## Executive decision

Build one governed ecosystem, not one monolithic application. Otya Server is the shared control plane; Otya OS is the unified owner/user experience; Cloudflare is the approved runtime and data platform; each product remains the authoritative owner of its own records.

This plan does not authorize merging PRs, deploying Workers, changing DNS/secrets, migrating production data, sending live email, or enabling money movement.

## What belongs together

| Capability | One shared implementation | Product-specific responsibility |
|---|---|---|
| Owner management | One protected Otya OS / Next owner experience | Product panels must call the owning product API and respect its permissions |
| Identity | Otya Auth, one documented token/session contract, shared MFA and revocation rules | Each product maps the authenticated subject to its own active membership and roles |
| Service inventory | One Otya Server registry and versioned API/event contracts | Each repo owns its code and product-specific release tests |
| Infrastructure policy | Cloudflare account, environment conventions, secrets policy, health/alerts, recovery procedures | Separate Workers and environments per workload; no broad cross-product credentials |
| Email | One Otya Server-managed Resend transport and event contract | Products emit narrowly scoped events; no product-supplied arbitrary recipients or provider secrets |
| Audit/operations | Common event fields, correlation IDs, incident/release view | Product APIs record business-specific actions and authoritative outcomes |
| Testing/release | Shared release gates, dependency/security checks, contract tests and approval record | Independent CI, versioning and rollback for each app |
| Support/documentation | One OtyaHub public entry point for approved public material | Private runbooks, secrets, owner details and shop/customer records remain private |

## What must NOT be merged

- Do not move OmniPoint inventory, sales, cash, float, provider transactions or ledgers into Otya Server's database.
- Do not make Next an alternate writer to OmniPoint D1. Next can summarize or propose actions, but must call the same authorized OmniPoint APIs as the UI.
- Do not require Cloudflare, an account, or a network connection for Otya Media's core local playback, library or vault features.
- Do not expose private operations, staff/customer data, service internals or incident details through OtyaHub.
- Do not combine authentication and authorization: a shared login must not automatically grant access to every product.
- Do not create dual-active writers or dual-write financial records to a recovery database.
- Do not retain Supabase, Appwrite or Vercel as runtime dependencies for OmniPoint. Remove legacy code only after replacements and tests are complete.
- Do not use AWS as a general platform dependency. Consider a tightly scoped fixed-egress relay only if a payment provider explicitly requires an allow-listed IP and Cloudflare alone cannot meet that contract.

## Critical gaps identified from repository documentation

1. **OmniPoint production schema and real-data readiness:** the production D1 resource exists, but checked-in resource inventory reports no production tables; the new schema is applied to the isolated migration-test database only. Confirm actual current state with read-only checks before making any production change.
2. **Authentication migration is incomplete:** OmniPoint's legacy dashboard still has Supabase Auth/Prisma coupling, while the Worker scaffold and Otya Auth contract require end-to-end alignment. Do not call the app Cloudflare-native until all protected reads and writes use the approved identity path.
3. **Business workflows are incomplete:** sale posting, agency transactions and reconciliation return 501; savings/contribution/repayment records are not ledger-posted and loan disbursement is disabled. These are deliberately safe stubs, not usable money-moving features.
4. **Accounting controls are not yet proven:** no release until atomic stock/cash/float updates, balanced journals, reversals, idempotency, duplicate callback handling, provider reference matching, settlement reconciliation and immutable audit trails have passing tests.
5. **Backups and disaster recovery are unverified:** R2 buckets exist, but scheduled backup, encryption/access controls, retention, integrity checks, isolated restore and failback are not proven.
6. **Shared email is not fully rolled out:** the central Resend helper/notification contract exists in review; low-stock notifications are not deployed. An earlier security run failed at the backend runtime audit and needs diagnosis on the current PR head.
7. **Private owner experience is not yet proven end-to-end:** one screen is not enough; verify step-up authentication, session revocation, product-level scopes, audit trails, approval flows and mobile usability.
8. **Observability and operations need closure:** service health, structured/redacted logs, correlation IDs, queue retries/dead-letter handling, alert routing, migration status, backup age and incident/rollback procedures need verified tests.
9. **Legacy cleanup remains:** inspect all imports and CI paths before removing Supabase/Prisma packages, obsolete Vercel setup, and unrelated savings-group routes. Preserve immutable migration history and existing data.
10. **External payment-provider readiness is separate from internal readiness:** provider sandbox tests, signed callbacks, idempotency, settlement/reconciliation and explicit production approval are required before live payments.

## Recommended implementation order

### Gate 0 — Preserve and reconcile
- Freeze production-impacting changes.
- List all open PRs, changed files, branch bases, checks and overlapping edits.
- Keep unique work; do not close or delete a branch until its changes are accounted for.
- Re-run checks against each current PR head, not an older commit.
- Resolve the Otya Server security audit failure and finish the Otya Media release-mode build.

### Gate 1 — Establish one identity contract
- Document issuer, audience, subject, expiry, session/cookie rules, logout/revocation, MFA/step-up and key rotation.
- Validate identity at the API boundary; resolve active staff and role from OmniPoint D1 for every sensitive operation.
- Fail closed on missing binding, invalid/expired token, inactive staff, auth outage or database error.
- Provision owner access through a reviewed, protected, one-time process; never through public signup or email matching.

### Gate 2 — Make OmniPoint data-ready without touching live data
- Compare the complete migration chain against the current production schema using read-only inspection.
- Apply and test migrations only in isolated D1 first.
- Validate inventory CRUD, stock movements, audit records, concurrency, access control and rollback.
- Define a production migration plan with pre-migration backup, checksums/counts, rollback/restore steps and explicit approval. Do not execute it under this plan.

### Gate 3 — Recovery proof
- Design scheduled D1 exports/backups into private R2 with least-privilege access, encryption where appropriate, retention, integrity manifests and alerts.
- Restore into an isolated database and verify schema version, representative records, foreign-key/business invariants and balanced ledgers.
- Record measured recovery-point and recovery-time objectives. Do not label the system recoverable until a restore drill passes.

### Gate 4 — Complete shop operations
- Product catalogue, suppliers/purchases, inventory and stock adjustments.
- Sales/POS, receipts, returns/refunds and cash drawer.
- Separate cash, mobile-money float and agency transaction ledgers.
- Expenses, commissions, reconciliation, daily closing and owner reports.
- Implement transactional/atomic writes, idempotency, audit events, permissions and negative/duplicate/concurrency tests.
- Keep payment provider calls disabled until sandbox and financial invariants pass.

### Gate 5 — Shared services and owner console
- Integrate Resend through the private service-binding contract, then test with an explicitly approved operator recipient.
- Add queues/retries only with idempotency, bounded retry and dead-letter/replay behavior.
- Build one protected owner view for health, backups, releases, incidents, approvals, audit and OmniPoint summaries.
- Keep product-specific authorization and records behind the owning APIs.

### Gate 6 — Simplify and release
- Remove Supabase/Prisma/Vercel/Appwrite runtime references only after replacement imports, tests and builds pass.
- Keep GitHub as source of truth and Cloudflare as the approved OmniPoint runtime.
- Review and merge PRs in dependency order only after CI is green and changes are approved.
- Deploy one component at a time only after explicit owner approval; smoke-test, observe and keep a rollback reference.
- Enable live payment operations only after explicit approval and provider certification.

## Pull-request consolidation strategy

The open PRs should not all be merged blindly or collapsed into one mega-PR. First reconcile overlapping paths and dependencies.

1. **Otya Server PR #213:** shared registry, boundaries and safe release controls. Review as the architecture baseline.
2. **OmniPoint PR #22:** Cloudflare-only app/API migration and single-shop boundary. Must pass auth, route, financial-invariant and isolated D1 migration tests before production consideration.
3. **Otya Server PR #218:** central OmniPoint low-stock email integration. Confirm its base includes the needed shared transport/registry changes, diagnose security audit, then validate service binding and rate/abuse controls.
4. **Next PR #8 and OtyaHub PR #3:** product boundary/documentation changes; keep independent because they affect different products.
5. **Otya Media PR #164:** independent local-media boundary and CI guard; do not block core OmniPoint operations on this unrelated app build, but do not publish a release until its own gates pass.

If branches overlap or were created from incompatible bases, rebase or port the minimal reviewed changes through separate PRs; never merge just to clear the queue.

## Definition of done

The ecosystem is ready for a controlled production release only when:
- One protected owner experience works on mobile and web.
- Shared sign-in works, but product permissions remain isolated and are tested.
- OmniPoint's real operational D1 schema is deliberately reviewed and deployed with a verified recovery path.
- Inventory, sale, cash/float and ledger operations are atomic, idempotent, auditable and reconciled.
- Provider sandbox callbacks and settlement matching are tested; live payments remain disabled until explicit approval.
- R2 backup and isolated restore drills pass.
- Resend tests pass and approved test email is verified without exposing secrets.
- CI/security checks pass on current commits; no unexplained high-severity runtime audit failure remains.
- Logs/alerts are redacted, incident and rollback procedures are documented, and owner approval is recorded for every production-impacting change.

**Current state:** implementation and validation in progress; not yet production-ready. This plan is not evidence that any production migration, backup, email rollout or payment flow has occurred.

## Current PR queue reconciliation — 2026-10-27

This section supersedes the earlier simplified OmniPoint PR order above where the newer PRs overlap. It is a review queue, **not merge authorization**.

### Newly verified blockers and relationships

- **OmniPoint PR #31** is the current production-boundary audit. Its source-only change disables automatic `workers.dev` exposure for the dedicated production config. Its report identifies production/test D1 schema divergence and missing company/branch scope in parts of the production schema. It passed its security and verification workflows at the inspected head, but does not migrate production or prove the live schema is ready.
- **OmniPoint PR #29** changes company scoping and staff-profile schema. Review it against the migration lineage and PR #31 findings before any schema release. A company-scope migration must be proven safe for existing production records before execution.
- **OmniPoint PR #22** is the Cloudflare-only/single-shop migration foundation. It still documents unfinished identity migration and legacy dashboard coupling; do not claim the runtime is fully Cloudflare-only until that path is replaced and built.
- **OmniPoint PR #27 and PR #28 overlap on inventory-to-D1 work. Do not merge both blindly.** PR #28 adds the broader cash POS path and server-session bridge; reconcile the shared files and port only the needed, tested changes into the chosen foundation.
- **OmniPoint PR #28 conflicts with the user's Cloudflare-only runtime direction as currently described:** its PR text requires a Vercel server-side environment variable for the temporary HMAC bridge. Treat that as a temporary migration artifact, not the target architecture. Before production, host the UI/server action layer on the approved Cloudflare path or formally review any exception; do not add Vercel as a new dependency.
- **OmniPoint PR #28's earlier Verify workflow failed at TypeScript checking of Web Crypto signature bytes.** A narrow normalization fix was committed to its branch as `933723886d79e6da06612a67a4273537992b37f7`; the security baseline passed for that commit, while its full Verify workflow was still running at the time of this update. Recheck the current head and CI before treating the fix as verified.
- **Otya Server PR #218's inspected head** had a failed security workflow at commit `f245c8186e414f1a3cc718b195248ca8874bad7b`, specifically the web/backend runtime audit step. Its separate validation workflow passed, while all deploy jobs were skipped. Diagnose the security failure on the current head before merge; no email rollout is authorized.
- **Otya Server PR #213's current inspected head** passed its security and backend validation workflows; production deployment jobs were skipped. Keep it as the architecture baseline, not proof that product migrations or recovery drills have completed.

### Updated safe review order

1. **Review OmniPoint #31** for the production exposure guard and ensure the audit is accurate; merge only after normal review and CI requirements. This is a source safety guard, not production readiness.
2. **Reconcile OmniPoint #29 with #31** and validate the company-scope migration against isolated fixtures and a read-only production schema comparison. Do not execute production migrations here.
3. **Review Otya Server #213** as the ecosystem policy/registry baseline; preserve separate product databases and explicit production gates.
4. **Choose one OmniPoint inventory/POS implementation path:** use #22 as the Cloudflare-only foundation, then port/reconcile the unique POS work from #28. Treat #27 as an overlapping predecessor unless a file-level review proves it contains unique work. Keep the Vercel bridge temporary and non-production.
5. **Recheck current CI for #28** after the HMAC type fix. Confirm worker typecheck, lint, build, authorization tests, company isolation, idempotent sale retries, and atomic stock/journal invariants.
6. **Resolve Otya Server #218's security audit failure** and confirm its private service binding/recipient restrictions before considering low-stock email. No live email until explicit approval.
7. Keep **Next #8, OtyaHub #3 and Otya Media #164** as independent product-specific changes. Their recent inspected CI passed, but each remains unmerged and its own product boundary must remain intact.

### Merge safety rule

Before merging any PR, compare the exact current head SHA, base branch, changed paths, CI conclusions, migration prerequisites and any overlapping PR. Never treat a successful CI run on an older SHA as evidence for a newer commit. No PR in this queue authorizes production deployment, D1 migration, DNS/secrets changes, live email or live payments.

