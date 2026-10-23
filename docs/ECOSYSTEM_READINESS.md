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
- **Verified integration mismatch:** the current `auth-worker/src/crypto.ts` access-token payload contains `sub`, `email`, `iat`, and `exp`; OmniPoint's isolated D1 scaffold independently requires a custom HMAC token with `sub`, `role`, `exp`, `iss: "omnipoint"`, and `aud: "omnipoint-api"`. These are not interchangeable tokens. Do not pass Otya Auth access tokens directly to that scaffold or let a client mint its own OmniPoint role claims. A reviewed server-side verifier/authorization adapter and explicit audience/role provisioning contract must be designed and tested first.

### 3. API and data integrity
- Define versioned service contracts for Otya Core and product APIs.
- Test authentication, authorization, schema validation, bounded request size, CORS, CSRF where applicable, error redaction, rate limiting and audit events.
- For rate-limit dependencies, explicitly choose fail-open versus fail-closed per operation class, document the abuse impact, and alert/test the dependency outage path.
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
2. Cloudflare reports no consumer attached to `otya-release-events` or its DLQ. The current `wrangler.toml` explicitly documents that this is intentional until a dedicated idempotent release-intake handler lands and passes tests. Keep the queue dormant until that handler and its retry/idempotency tests are implemented; do not attach a consumer just to make the inventory look complete.
3. Shared `otya-store-db` bindings require schema ownership and migration coordination across `otya-core` and `otya-next`.
4. Cloudflare D1 API metadata and direct schema inspection previously disagreed about table visibility; reconcile the discrepancy before migration decisions.
5. OmniPoint's D1 API bridge is test-only and intentionally returns not-implemented for sales, agency transactions and reconciliation. Do not enable live money workflows through it.
6. OmniPoint's Prisma/PostgreSQL expectations and D1 SQLite behavior need a tested compatibility decision; avoid silent provider switching.
7. Vercel preview readiness verifies a preview deployment, not Worker API behavior, production configuration, auth provisioning or data connectivity.
8. The `otya-core` Worker settings still list `JAMENDO_CLIENT_ID` and `JAMENDO_CLIENT_SECRET` secret bindings, while the Otya Media README says the Jamendo online catalog integration has been retired. Audit all server routes and consumers for live use before deciding whether to remove those bindings; do not delete secrets blindly.
9. The Together control plane's `mutationAllowed()` helper intentionally fails open if its rate-limiter binding errors or is absent. Authentication, room membership, payload limits and TTLs still apply, but this means rate limiting is not a hard safety boundary during a limiter outage. Decide whether each mutation class should fail closed or use a separate durable fallback; test the chosen behavior and alert on limiter failures.
10. Automated PR review availability has been limited on some changes; require substantive human review for auth, financial, migration, secret and release changes.

11. **Security CI dependency blocker (verified 2026-10-23):** the `Security` workflow for ecosystem-readiness PR #204 failed in `Validate and audit web/backend runtime`. The runtime audit reported 3 vulnerabilities (2 high, 1 critical), including Next.js `15.5.25` and `sharp` `0.35.4`; the workflow output identifies `next@15.5.28` and `sharp@0.35.5` as available fixes. Do not bypass the audit or apply `npm audit fix --force` blindly. Update compatible direct/override versions and regenerate `package-lock.json` together, then rerun runtime audit, `npm run check`, and the Worker/mobile-specific checks before considering merge. The security workflow skipped later auth/AI-worker checks after this failure, so those results remain unverified for this commit.\n\n12. **Shared identity integration mismatch (verified 2026-10-23):** Otya Auth access tokens currently carry `sub`, `email`, `iat`, and `exp`; OmniPoint's isolated D1 API scaffold requires a different custom HMAC token with `role`, `iss`, and `aud`. The current scaffold is not an Otya Auth integration. Keep the frontend disconnected and do not reuse or translate claims client-side; design a server-side verifier and staff-role mapping contract, then test expiry, revocation, role changes and product audience isolation.\n\n## Work sequence

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
