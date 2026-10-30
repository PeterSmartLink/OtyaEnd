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
| D1 | `otyapoint-db` | Newly created, zero tables so far | Apply migrations and verify before use. |
| D1 | `otya-auth-db` | `otya-auth-db` | Identity store. Never combine with product business records; inspect actual tables/rows before changes. |
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
- D1: `otyapoint-db` (new; zero tables), `omnipoint-dev` (legacy; keep for rollback), `otya-auth-db`, `otya-store-db`.
- R2: `otyapoint-private`, `otyapoint-backups`, `omnipoint-dev-private`, `omnipoint-dev-backups`, `otya-assets`, `otya-player-releases`.
- KV titles: `otya-core-kv`, `otyapoint-dev-cache`, `otya-auth-kv`.
- Queues: `otyapoint-dev-jobs`, `otyapoint-dev-jobs-dlq`, `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`, `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.

Cloudflare's account-level D1 list reports `num_tables: 0` for multiple existing databases, but reported file sizes differ materially. Treat that metadata as insufficient to prove a database is empty. Query actual schema and data safely before any copy, rename migration, or deletion.

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
