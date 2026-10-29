# Otya Ecosystem Master Audit and Upgrade Plan

**Audit date:** 2026-10-29  
**Status:** Initial read-only discovery completed; this plan is proposed work, not a certification of production readiness.

## Canonical product identity

- Parent company: **Otya Hold Ltd**
- Business application: **OtyaPoint**
- Unified platform: **Otya OS**
- Shared services and integration foundation: **Otya Server**
- Media application: **Otya Media**
- Public developer community: **OtyaHub**

The existing GitHub repository is still named `PeterSmartLink/OmniPoint`. This is a legacy repository slug, not the current product name. Do not rename repositories or change public domains without a separate impact review and approval.

## Scope and safety

This plan coordinates the following currently accessible repositories:

- `PeterSmartLink/Otya-Server`
- `PeterSmartLink/OmniPoint` (OtyaPoint business application; legacy repository slug)
- `PeterSmartLink/OtyaPlayer` (Otya Media)
- `PeterSmartLink/Next` (owner companion application)
- `PeterSmartLink/OtyaHub`

Preferred foundation: GitHub and Cloudflare. Do not introduce Supabase, Appwrite or Vercel into OtyaPoint without explicit owner approval. Preserve existing code and data. Do not delete resources, alter DNS or secrets, migrate production data, merge pull requests, deploy production, or initiate live financial transactions without explicit approval. Use sandbox integrations for payment testing.

## Initial verified Cloudflare inventory

The connected Cloudflare account returned these resources through read-only API calls:

- Workers: `otya-auth`, `otya-core`, `otya-next`
- D1: `otya-auth-db`, `otya-store-db`, `omnipoint-dev`
- R2: `otya-assets`, `otya-player-releases`, `omnipoint-dev-private`, `omnipoint-dev-backups`
- Queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`, `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`
- Pages: `omnipoint-relay-lab`
- Durable Objects namespaces: none returned by the inventory query
- Zone: `petersmartlink.com` (reported active)

The business Worker `omnipoint-dev-api` documented in the OtyaPoint repository was not found in the live Workers list; a direct lookup returned HTTP 404. Do not assume its API is deployed.

These results establish resource visibility, not service health, correct configuration, or production readiness. Re-run the inventory before any deployment or migration.

## Initial findings requiring follow-up

### OtyaPoint
The repository's `docs/BUILD_STATUS.md` says the legacy Next.js dashboard still contains Supabase/Prisma code and is not connected to the Cloudflare API. The repository documents a separate Cloudflare D1 development foundation and release gates for authentication, authorization, atomic sales, idempotency, ledger correctness, backups and recovery.

The repository's `docs/CLOUDFLARE_RESOURCE_INVENTORY.md` describes `omnipoint-dev` as a development database with an empty core business schema at its last documented verification. It also says no verified independent backup is stored yet. Re-check live state before relying on these historical observations. Do not store important or real business records until backup export, checksum and isolated restore have been proven.

### Otya Server
The repository has substantial shared authentication, core, AI/support, notification and operations code. Its handoff documentation describes Worker names including `otya-store` and `otya-ai`, while the live inventory returned `otya-core`, `otya-auth` and `otya-next`. Reconcile current source/configuration and live bindings before making any topology changes.

### Otya Media
The existing Android application and release workflows should be preserved. Review recent CI results and verify actual device behavior for startup, playback, background audio, media controls, permissions, vault protection and update/recovery paths before claiming release readiness.

### Otya OS and OtyaHub
Treat Otya OS as the ecosystem control plane and consistent application experience, reusing Otya Server rather than creating duplicate services. Keep OtyaHub public-facing; never publish secrets, private infrastructure details or sensitive operational records.

## Prioritized execution plan

### P0 — Establish trustworthy foundations
1. Reconcile source repositories, default branches, active workflows and live Cloudflare resources.
2. Map each Worker to its repository, routes, service bindings, D1/KV/R2/Queue bindings, schedules and owner.
3. Validate OtyaPoint's D1 migrations, schema constraints, tenant/company scoping and server-enforced authorization.
4. Verify backup export, checksum, retrieval and restore to an isolated database.
5. Implement/test atomic sale posting, stock movement, balanced ledger entries, idempotency, concurrency, rollback, reversals and append-only audit events.
6. Verify Otya Auth token validation and OtyaPoint's separate staff-role authorization.
7. Ensure secrets and sensitive business data are absent from code, CI logs and public documentation.

**P0 acceptance:** A repeatable test suite passes for schema, authorization, financial invariants and recovery; no live payment processing is enabled.

### P1 — Connect the existing applications safely
1. Connect the existing OtyaPoint UI to the documented Cloudflare API using a reviewed server-side auth bridge.
2. Remove legacy Supabase/Prisma/Vercel dependencies only after code searches, tests and build prove no required path still depends on them.
3. Establish CI gates for migration validation, type-check, lint, unit/contract tests, build and Wrangler configuration validation.
4. Reconcile Otya Server topology and document stable internal service contracts.
5. Verify private preview access, privacy-safe logs, monitoring, error reporting and rollback steps.

**P1 acceptance:** The private preview uses only the approved API/data path, authorization fails closed, and CI provides reproducible evidence.

### P2 — Integrations and product verification
1. Add/standardize connector contracts: auth, scopes, versioning, mapping, webhook signatures, event IDs, retries, idempotency, dead-letter handling, monitoring and disconnect/revocation.
2. Build provider adapters for Airtel/MTN/Interswitch only against approved contracts and sandbox credentials.
3. Test callback verification, replay protection, timeouts, duplicate requests, status polling, reversals, settlement and reconciliation.
4. Verify Otya Media builds, tests, device behavior, signing and update/rollback.
5. Review Otya Server notifications, queues, AI/support and release flows against live delivery evidence.

**P2 acceptance:** Sandbox workflows are tested end to end; no real-money operation occurs without a separate approval.

### P3 — Unified platform experience
1. Define Otya OS app/service registry and ecosystem health view using existing services.
2. Standardize identity handoff, role/scope contracts, audit correlation IDs and operational event schemas.
3. Align OtyaHub documentation and examples with verified current behavior and canonical product names.
4. Add Durable Objects only when a measured coordination or real-time use case justifies them.
5. Publish a resource ownership/dependency register and recovery runbooks.

## Target architecture

- **GitHub:** canonical source, reviews, CI and versioned operational documentation.
- **Otya Server:** shared identity integration, reusable connector contracts, internal service APIs, audit/operations capabilities.
- **OtyaPoint:** business-specific data, staff permissions, inventory, sales, expenses, cash/agency workflows, ledger and reconciliation.
- **Otya Media:** local-first media playback and media-specific account/release features.
- **Otya OS:** unified access, app/service discovery and ecosystem operations, reusing shared services.
- **OtyaHub:** public developer documentation and approved examples.
- **Cloudflare Workers:** API/runtime; **D1:** relational records; **R2:** private objects and verified backup artifacts; **KV:** reconstructable cache only; **Queues:** asynchronous work with bounded retries and DLQs.

Do not use KV as the authoritative financial ledger. Do not add Durable Objects, extra databases or duplicate Workers without a documented need.

## Change workflow and evidence

For each work item:

1. Inspect current source and live state.
2. Record baseline and dependencies.
3. Implement on a dedicated branch.
4. Run tests and static checks.
5. Open a pull request with risk, rollback and verification notes.
6. Obtain required review/approval.
7. Deploy only to the approved environment.
8. Verify live behavior and record evidence.

Never equate a source change, successful build, health response or provider-accepted request with end-to-end production readiness.

## First work items

- [ ] Inventory GitHub Actions runs and checks across all five repositories.
- [ ] Map live Worker settings, routes, bindings and deployed versions.
- [ ] Inspect D1 schemas/migration histories and permissions without exposing records.
- [ ] Verify OtyaPoint backup export/restore in isolation.
- [ ] Identify current API routes and auth contracts, then connect the existing UI.
- [ ] Create a release-gate matrix for Otya Media.
- [ ] Reconcile Otya Server's documented and live topology.
- [ ] Produce an ecosystem dependency map and a verified-versus-unverified status report.
