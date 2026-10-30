# Otya Ecosystem Resource Naming & Migration

**Status:** operational standard; resource changes must be recorded here and verified against live bindings.
**Last audited:** 2026-10-30 UTC.

## Canonical product and account architecture

- Legal parent: **Otya Hold Ltd**.
- Unified ecosystem/platform: **Otya OS**.
- Shared backend/control plane and integration layer: **Otya End** (repository: `PeterSmartLink/OtyaEnd`).
- **Otya Account**: the shared user-facing account/profile/security experience—registration, sign-in, recovery, verified identities, sessions, profile, connected apps, and account security. It is a product capability and shared entry point, not a second identity database or a second backend.
- **Otya Auth**: the identity/authentication service that powers Otya Account—credentials/identity verification, sessions/tokens, MFA/OTP, authorization primitives and security events. Existing Worker: `otya-auth`; existing D1: `otya-auth-db`; existing KV: `otya-auth-kv`. Preserve these until schema and bindings are verified.
- **OtyaPoint**: business operations/shop application (repository: `PeterSmartLink/OtyaPoint`).
- **Otya Media**: offline-first media player (repository: `PeterSmartLink/OtyaMedia`).
- **Otya Next**: private owner assistant (repository currently `PeterSmartLink/Leo`; preserve history and identifiers while the canonical product naming is aligned).
- **OtyaHub**: public developer and partner hub (repository: `PeterSmartLink/OtyaHub`).
- **Resend**: shared transactional email delivery for verification codes, password recovery, security alerts, service notices and notifications.
- **GitHub**: source of truth, reviews, automation and release history.
- **Cloudflare**: shared runtime, data, storage, queue, security and observability platform.

### Account architecture rule

Otya Account is the consistent account experience across Otya OS products. Otya Auth is the service behind it; Otya End coordinates trusted service integrations. Each product uses shared identity but retains product-scoped authorization and data boundaries. Otya Next additionally requires owner-only authorization and step-up approval for sensitive operations. Do not duplicate account databases in each product, expose private owner privileges to OtyaPoint/Otya Media, or treat email delivery as proof of authorization. Use Resend for OTP/recovery messages only through server-side flows with rate limits, expiry, one-time use, abuse protection, and audit events.

## Naming rules

Use lowercase kebab-case for Cloudflare resource names. Prefix shared services with `otya-`; prefix OtyaPoint-only resources with `otyapoint-`. Include environment suffixes only when the resource is genuinely environment-specific (`-dev`, `-staging`, `-prod`). Never include secrets, customer identifiers, or sensitive business data in resource names.

| Resource type | Canonical target | Current observed state | Migration rule |
| --- | --- | --- | --- |
| Worker | `otya-core` | `otya-core` | Keep as shared core; do not rename without checking service bindings/routes. |
| Worker | `otya-auth` | `otya-auth` | Keep; powers Otya Account shared identity. |
| Worker | `otya-next` | `otya-next` | Keep; owner assistant workload. |
| Worker | `otyapoint-api` | Proposed in OtyaPoint branch; not deployed | Validate source config before any deployment. |
| D1 | `otyapoint-db` | Newly created; only internal `_cf_KV` table observed | Apply application migrations and verify before use. |
| D1 | `otya-auth-db` | `otya-auth-db`; read-only query confirms users, linked identities, two-factor and security-event tables | Identity store has application schema/data; preserve and verify row counts/backup before changes. Never combine with product business records. |
| D1 | `otya-core-db` | `otya-store-db` | Proposed target only; inspect schema and Worker bindings before replacement. |
| R2 | `otyapoint-private` | Newly created | Verify private access; migrate data only after object inventory. |
| R2 | `otyapoint-backups` | Newly created | Prove export and restore; an empty bucket is not a verified backup. |
| R2 | `otya-assets` | `otya-assets` | Keep shared assets. |
| R2 | `otya-media-releases` | `otya-player-releases` | Target name; migrate only after checking release/event consumers and object references. |
| KV namespace | `otyapoint-dev-cache` | Renamed in place from `omnipoint-dev-cache` | Same namespace ID retained. |
| KV namespace | `otya-core-kv` | `otya-core-kv` | Keep. |
| KV namespace | `otya-auth-kv` | `otya-auth-kv` | Keep; shared auth state/rate limits only as designed. |
| Queue | `otyapoint-dev-jobs`, `otyapoint-dev-jobs-dlq` | Newly created | No producers/consumers connected yet; wire only after retry/idempotency validation. |
| Queue | `otya-next-jobs`, `otya-next-jobs-dlq` | Existing active producer/consumer relationship | Preserve; check worker consumer and DLQ links before any migration. |
| Queue | `otya-push`, `otya-push-dlq` | Existing active producer/consumer relationship | Preserve; shared notifications. |
| Queue | `otya-release-events`, `otya-release-events-dlq` | Release bucket producer exists | Preserve until R2 event rules and consumers are verified. |

## Current Cloudflare inventory snapshot

Observed on 2026-10-30:
- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `otyapoint-db` (new; only internal `_cf_KV` table), `omnipoint-dev` (10 application tables plus migration metadata), `otya-auth-db` (users/identity/2FA/security tables), `otya-store-db` (release/device/notification/audit/owner tables).
- R2: `otyapoint-private`, `otyapoint-backups`, `omnipoint-dev-private`, `omnipoint-dev-backups`, `otya-assets`, `otya-player-releases`.
- KV titles: `otya-core-kv`, `otyapoint-dev-cache`, `otya-auth-kv`.
- Queues: `otyapoint-dev-jobs`, `otyapoint-dev-jobs-dlq`, `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`, `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.

Direct read-only SQL queries of `sqlite_master` showed that Cloudflare's account-level D1 list `num_tables: 0` metadata was insufficient and misleading for existing databases. Application tables exist in `omnipoint-dev`, `otya-auth-db`, and `otya-store-db`. Treat these databases as containing valuable data; do not delete, replace, or rename them until row counts, export integrity, restore tests, and bindings are verified.

## Resend inventory and rules

- Verified domain: `petersmartlink.com`; sending and receiving are enabled. Preserve DNS and domain verification.
- Existing API key labels: `Auth Send Email`, `Deployment`, `otya-store-worker`. Inventory names and scopes; never expose key values. Do not rotate/revoke a key until its consumers are identified and replacement credentials are safely installed.
- Existing published templates include Otya Welcome, Otya Verification Code, Otya Password Reset, Otya Security Alert, Otya Service Notice, and Otya Updates. Preserve template IDs/aliases; standardize sender branding and variables after reviewing their callers.
- Existing webhook `https://petersmartlink.com/webhooks/` is enabled for email delivery events. Preserve and test its endpoint before changes.
- A legacy Appwrite webhook endpoint is disabled. Keep disabled pending a dependency check; do not re-enable it.
- Resend remains a shared ecosystem service, not a product-specific duplicate. Keep email sending behind Otya End/Otya Auth server-side flows.

## Migration safety and release gates

1. Inspect every Worker binding, D1 schema and row count, queue producer/consumer, R2 event notification, workflow, and Wrangler config that references a resource.
2. Record source/target IDs, region/jurisdiction, object counts, table/row counts, and queue consumer configuration.
3. Create replacement resources only where names cannot be changed in place. Never delete the source during initial migration.
4. Copy/export/import data only after a verified recovery point; verify checksums, object metadata, schema, constraints, row counts, and application invariants.
5. Update source configuration and CI checks in a branch and pull request. Never commit API tokens, credentials, personal data, or provider secrets.
6. Validate Otya Account sign-in, recovery, sessions, access controls, MFA/OTP rate limits, audit events and product-level authorization before cutover.
7. Deploy only after automated tests and rollback steps are documented. Keep public routes and live payment execution disabled until auth, authorization, idempotency, reconciliation, backup/restore, and partner gates pass.
8. Delete legacy resources only after dependency scan, verified recovery, successful cutover, and explicit cleanup decision.

## Technical limitations

Cloudflare's D1 database update API does not expose a database-name field, and R2 bucket names are identifiers rather than editable labels. These require create/copy/verify/switch migrations. KV namespace titles can be updated while retaining their IDs. Queue migrations must preserve producer/consumer and dead-letter relationships.


## Ecosystem consolidation decisions (approved target architecture)

The goal is one connected Otya ecosystem, not one unsafe monolith. Merge duplicated product concepts and shared capabilities; keep separate runtime/data boundaries where they protect security, ownership, reliability, or product-specific data.

### Merge these into one logical system

| Components | Decision | Implementation boundary |
| --- | --- | --- |
| **Otya Account + Otya Auth** | **One account system** | Otya Account is the user-facing product/module; Otya Auth is the identity engine and security API behind it. One canonical identity model, one session/token policy, one account-recovery flow, one verification/MFA policy and one audit trail. Do not create a second account database. Keep the existing `otya-auth` Worker and `otya-auth-db` as the implementation boundary until contracts and bindings prove a safe consolidation; “merge” means one service/product contract, not automatically putting auth code into the general core Worker. |
| **Otya Server + Otya End** | **One shared backend identity** | Otya End is the canonical name for the shared backend/control plane. Preserve the existing repository history and migrate all docs, CI, service bindings, API clients and deployment settings from legacy Server naming only after repository/slug dependencies are checked. Do not create a second backend that competes with Otya End. |
| **Otya OS + shared navigation/account/admin shell** | **One ecosystem experience** | A shared shell can link to products and expose common account, notifications, connected apps and administration. Product modules retain distinct authorization scopes. Otya OS is the umbrella experience, not a replacement for every product's codebase. |
| **Resend integrations across products** | **One shared email capability** | Centralize server-side email sending behind a shared adapter/service contract in Otya End, with Otya Auth owning security-sensitive verification/recovery workflows. Reuse the existing verified domain/templates; do not duplicate API keys across clients or expose secrets in mobile/web apps. |
| **GitHub release and dependency routines** | **One common delivery standard** | Reusable workflow patterns, pinned actions, dependency update automation, security checks, test gates, changelog/release conventions and rollback instructions. Each repository still has its own tests and deploy target. |
| **Cloudflare resource naming and inventory** | **One authoritative registry** | Maintain one registry for Worker, D1, R2, KV, Queue, service-binding, route, environment and owner relationships. Do not treat similar names as proof that resources are interchangeable. |

### Keep these separate, connected through contracts

| Components | Decision | Reason |
| --- | --- | --- |
| **Otya End vs Otya Auth** | Connected services; do not collapse security boundary by default | A dedicated auth boundary reduces the impact of compromise and makes identity changes safer. Otya End orchestrates trusted services; Otya Auth owns identity primitives and security-sensitive flows. |
| **OtyaPoint vs Otya Media** | Separate products | Shop, stock, sales, cash/agency ledger and payments have different data and regulatory risks from local media playback and release distribution. |
| **Otya Next vs ordinary user apps** | Separate privileged boundary | Otya Next is a private owner assistant. Owner actions require explicit authorization, step-up confirmation for sensitive operations and auditable actions. No owner privilege should leak into normal Otya Account sessions. |
| **OtyaHub vs internal control plane** | Separate public developer/partner surface | Public docs, integration onboarding and partner access must not expose private operations, credentials, customer records or administrative APIs. |
| **Product databases vs identity database** | Separate data ownership | Shared sign-in does not mean every product writes to the same database. Otya Auth owns identity records; OtyaPoint owns shop/business records; Otya End's data store is only for shared service/control-plane records that truly belong there. |
| **D1 vs R2 vs KV vs Queues** | Keep distinct storage roles | D1 is relational state, R2 is object/file storage, KV is fast key-value state/cache, and Queues are asynchronous work. Do not combine unlike storage into one bucket/database just to reduce resource count. |
| **Cloudflare vs GitHub vs Resend** | One operating model, not one vendor/service | Cloudflare runs the app/data edge, GitHub owns source and release history, and Resend delivers email. Keep vendor responsibilities explicit and credentials least-privileged. |

### Account-system contract

1. Otya Account is the only canonical account experience across Otya OS.
2. Otya Auth is the authority for identity, authentication, sessions, verification, recovery, MFA/OTP and security events.
3. Otya End supplies the shared API/integration layer and does not create a parallel identity store.
4. Each product uses the shared identity identifier but enforces its own role and resource authorization server-side.
5. Email verification or possession of an email address is not, by itself, authorization to perform a business or owner operation.
6. Secrets remain server-side. OTP/recovery flows require expiry, one-time use, rate limits, abuse controls and audit events.
7. Account schema changes must be backward-compatible where possible, tested against existing account data, and have a verified backup/rollback plan.

### Execution order for consolidation

1. Freeze the naming/ownership map and inventory every repository, Worker, D1 database, R2 bucket, KV namespace, Queue, route, binding, workflow, Resend key/template/webhook and external provider callback.
2. Add shared contracts and reusable CI checks in pull requests; do not merge multiple unrelated PRs blindly.
3. Validate existing account schemas and application tables, record counts, export backups and test restoration before any database consolidation.
4. Wire Otya Account's front-end contract to the existing Otya Auth service; do not create a second identity database or migrate account records without schema/backup verification.
5. Move product email calls behind the shared server-side Resend adapter, retaining existing template IDs, domain verification and webhook behavior until consumers are verified.
6. Update Wrangler bindings and environment variables through reviewed changes; validate in isolated resources first, then perform a staged cutover with a rollback path.
7. Enable production routes only after CI, authz, migration, observability, backup/restore and rollback checks pass. Keep live payment execution disabled until provider credentials, callbacks, idempotency and reconciliation are separately verified.
8. Retire duplicate or legacy resources only after cutover evidence, a dependency scan and a separate cleanup decision.

### Non-goals

- Do not merge all code into one repository solely for fewer names.
- Do not merge identity, shop ledgers, owner-only data and media metadata into one database.
- Do not rename/delete resources just because a canonical target name exists.
- Do not rotate/revoke Resend credentials until consumers are identified and replacement credentials are safely deployed.
- Do not deploy unverified changes directly to a public route or enable live payments as a side effect of renaming.
