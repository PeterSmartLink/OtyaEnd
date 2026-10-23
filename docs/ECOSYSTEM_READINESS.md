# Otya Ecosystem Readiness

Last reviewed: 2026-10-23

## Purpose

This is the cross-product readiness register for Otya OS. It coordinates the existing products and infrastructure; it does not replace them or authorize a production cutover. The target is one connected Otya ecosystem with shared identity and platform services, product-specific data boundaries, observable operations, tested recovery, and safe releases.

## Product and service map

| Product / service | Repository or runtime | Intended responsibility | Readiness position |
|---|---|---|---|
| Otya OS | Ecosystem architecture | Shared standards, identity integration, service contracts, release/recovery governance | Architecture coordination needed; do not imply a single deployed OS runtime |
| Otya Auth | Cloudflare Worker `otya-auth`; `Otya-Server` contains backend source | Authentication, sessions, recovery, identity verification and authorization | Runtime exists; end-to-end contract and security verification required |
| Otya Core | Cloudflare Worker `otya-core`; `Otya-Server` | Shared APIs and product-facing services | Runtime exists; route, binding, schema ownership and integration verification required |
| Otya Next | Cloudflare Worker `otya-next`; Android app repository `Next` | Owner assistant and operational intelligence; approval-gated actions | Runtime and app source exist; end-to-end auth, tool authorization and failure-mode tests required |
| Otya Media | GitHub repository `OtyaPlayer` | Offline-first Android audio/video, local transfers and private media | App source exists; release/device acceptance and account integration must be verified |
| OmniPoint | GitHub repository `OmniPoint` | Retail, inventory and Uganda agency operations | Frontend and test-only D1 bridge exist; not approved for live financial operations |
| Public product hub | `OtyaHub` | Public docs, product information, release notices and safe public automation | Public surface exists; keep private operational data and credentials out of it |

Legal/product naming: Otya Hold Ltd is the operator; OmniPoint is the trading name. Otya Auth, Otya Core, Otya Next and Otya Media are members of the Otya product family.

## Infrastructure policy

- Cloudflare is the primary runtime and infrastructure platform for the Otya ecosystem.
- Supabase is an ecosystem backup/recovery resource. It is not the live OmniPoint business database and must not be connected as such without a separately reviewed architecture decision.
- Appwrite is a contingency/failover option, not an automatically active second source of truth. Do not resume or switch traffic to it until restore, data consistency, credentials and cutover procedures are tested.
- Existing Cloudflare resources must be audited before changing bindings or ownership. In particular, `otya-store-db` has shared bindings and needs an explicit schema/data owner map.
- `omnipoint-migration-test` is isolated test/migration infrastructure. It must not be promoted to production merely because its schema tests pass.
- Do not assume PostgreSQL/Prisma code is compatible with Cloudflare D1's SQLite dialect. Verify query, transaction, migration, constraint and concurrency behavior in an isolated test environment.
- Existing Supabase Auth configuration is an identity dependency in the current OmniPoint prototype; it does not make Supabase the OmniPoint business database.

## Cross-ecosystem acceptance gates

### 1. Inventory and ownership
- Map each public hostname, Worker route, Pages/Vercel project, repository, workflow, D1 database, KV namespace, R2 bucket, queue, consumer, Durable Object and secret *binding name* to an owner and environment.
- Record which service is the authoritative writer for every table and object namespace.
- Identify orphaned resources, unused routes, unconsumed queues, unverified custom domains and bindings with ambiguous ownership.
- Keep secret values out of reports; record names, consumers, rotation status and last verification only.

### 2. Shared identity and authorization
- Define the canonical account, session, recovery and permission contracts for Otya Auth.
- Verify issuer/audience, expiry, revocation, refresh/replay handling, rate limits, account recovery and server-side identity verification.
- Require product and tenant scoping on every protected data request; never trust role or owner claims supplied by the browser.
- Require step-up approval for destructive operations, release actions, secret changes and high-impact owner actions.
- Test Otya Media and Next against the same Auth contract without making offline playback depend on cloud availability.

### 3. API and data integrity
- Define versioned service contracts for Otya Core and product APIs.
- Test authentication, authorization, schema validation, bounded request size, CORS, CSRF where applicable, error redaction, rate limiting and audit events.
- Ensure each write that requires an audit record is atomic with that audit record.
- Add automated tests for every route and malformed/unauthorized input before promoting API scaffolds.
- Separate retail stock/sales accounting from agency cash/float/commission ledgers while allowing approved reporting across them.
- Require idempotency, immutable transaction references, reversal workflows, reconciliation and provider callback verification before any live financial workflow is enabled.

### 4. AI and owner operations
- Otya Next must use the same Auth boundary and explicit tool-level authorization as other services.
- Treat model output, retrieved documents, Telegram messages and external content as untrusted input.
- Read-only inspection is the default. Actions that change infrastructure, users, releases, money or customer records need explicit approval and an auditable result.
- Ensure AI/provider failures degrade safely and never block Otya Media's core offline playback.
- Verify AI Gateway observability and redact secrets, tokens, personal data and sensitive query strings from logs.

### 5. Mobile apps and release integrity
- Build and test Otya Media and Next on clean CI runners with pinned toolchains and dependency checks.
- Verify Android package identity, signing, artifact checksums, update metadata, minimum supported versions, rollback and release-channel permissions.
- Test cold start, background/foreground, offline mode, denied permissions, storage pressure, crashes, account expiry and server outage.
- Do not expose server credentials, owner-only routes or administrative controls in APKs.
- Release automation must be idempotent, authenticated, traceable and recoverable; verify queue consumers and workflow bindings before relying on them.

### 6. Backup, restore and failover
- Define RPO/RTO targets for identity, product data, audit history, media artifacts and financial records.
- Produce encrypted backups and prove restore into an isolated environment, including row counts, constraints, indexes, object metadata and integrity checks.
- Test Supabase recovery as backup only and Appwrite as contingency only; no automatic promotion or traffic switch until reconciliation and rollback are proven.
- Document recovery owner, required approvals, restore evidence, last successful drill and rollback steps.
- Do not run destructive restores or database migrations against production as a test.

### 7. Privacy, legal and support
- Maintain current privacy, terms, account deletion, support and security-reporting paths across the website, Otya Media and account surfaces.
- Minimize collected data; separate public analytics from private account, device and financial data.
- Verify access logging, retention/deletion, incident response, customer support escalation and least-privilege staff access.
- Review Uganda-specific financial, tax/EFRIS, consumer and data-protection obligations with appropriate local professionals before launch of regulated or financial functions.

## Current known risks / open verification items

1. Cloudflare resources exist, but existence is not evidence of correct access policies, route coverage, queue consumption or production readiness.
2. The queue `otya-release-events` was previously identified as having an R2 event producer; confirm its intended consumer and delivery/retry behavior before relying on it.
3. Shared `otya-store-db` bindings require schema ownership and migration coordination across `otya-core` and `otya-next`.
4. Cloudflare D1 API metadata and direct schema inspection previously disagreed about table visibility; reconcile the discrepancy before migration decisions.
5. OmniPoint's D1 API bridge is test-only and intentionally returns not-implemented for sales, agency transactions and reconciliation. Do not enable live money workflows through it.
6. OmniPoint's Prisma/PostgreSQL expectations and D1 SQLite behavior need a tested compatibility decision; avoid silent provider switching.
7. Vercel preview readiness verifies a preview deployment, not Worker API behavior, production configuration, auth provisioning or data connectivity.
8. Automated PR review availability has been limited on some changes; require substantive human review for auth, financial, migration, secret and release changes.

## Work sequence

1. **Read-only inventory and ownership map** — finish the service/route/binding/secret-name/queue-consumer map and mark verified versus unknown.
2. **Shared Auth contract** — document and test the actual token/session lifecycle and service-to-service authorization.
3. **Core API safety tests** — add route-level automated tests and negative cases; keep test database isolated.
4. **Mobile integration** — verify Next and Otya Media auth/account flows, offline behavior, update integrity and failure handling.
5. **OmniPoint retail path** — finish a sandbox-only product-to-stock-to-sale-to-audit workflow with atomicity and permission tests.
6. **Financial workflow readiness** — implement ledger, idempotency, reversal, provider verification and reconciliation in a simulator; no live provider or cash operations until separately approved.
7. **Recovery drills and observability** — prove backup restore, queue retry/dead-letter handling, alerts, rollback and incident runbooks.
8. **Release gate** — require passing CI, reviewed changes, tested preview, verified migrations, rollback plan and explicit production approval.

## Change control

- Preserve existing repositories, resources, data, settings and integrations unless a specific reviewed change requires otherwise.
- Work in branches and pull requests. Prefer additive, reversible changes and isolated test resources.
- Do not change production DNS/routes, production database bindings/data, secrets, identity policy or financial-provider configuration without explicit approval and a tested plan.
- Never claim a service is production-ready solely because a build passes or a preview is deployed.
- Keep this document current with evidence links and test results; mark items `verified`, `blocked` or `not yet verified`, not simply “done”.
