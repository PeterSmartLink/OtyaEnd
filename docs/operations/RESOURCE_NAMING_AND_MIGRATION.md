# Otya Ecosystem Resource Naming & Migration

**Status:** operational standard; resource changes must be recorded here and verified against live bindings.
**Last audited:** 2026-10-30 UTC.

## Canonical product names

- Legal parent: **Otya Hold Ltd**.
- Unified ecosystem: **Otya OS**.
- Shared backend/control plane: **Otya End** (repository: `PeterSmartLink/OtyaEnd`).
- Business operations app: **OtyaPoint** (repository: `PeterSmartLink/OtyaPoint`).
- Authentication service: **Otya Auth**.
- Media player: **Otya Media** (existing repository identifiers remain until compatibility checks pass).
- Private owner assistant: **Otya Next**.
- Public developer and partner hub: **OtyaHub**.
- Transactional email provider: **Resend**, a shared ecosystem service.

## Naming rules

Use lowercase kebab-case for Cloudflare resource names. Prefix shared services with `otya-`; prefix OtyaPoint-only resources with `otyapoint-`. Include environment suffixes only when the resource is genuinely environment-specific (`-dev`, `-staging`, `-prod`). Never include secrets, customer identifiers, or sensitive business data in resource names.

| Resource type | Canonical target | Current observed state | Migration rule |
| --- | --- | --- | --- |
| Worker | `otya-core` | `otya-core` | Keep as shared core; do not rename without checking service bindings/routes. |
| Worker | `otya-auth` | `otya-auth` | Keep; shared identity boundary. |
| Worker | `otya-next` | `otya-next` | Keep; owner assistant workload. |
| Worker | `otyapoint-api` | Repo config currently says `omnipoint-dev-api`; not deployed by that config | Change source config and validate before any deployment. |
| D1 | `otyapoint-db` | `omnipoint-dev` (EU jurisdiction, currently reports zero tables) | Cloudflare D1 API does not expose an in-place database-name update. Create the target database, export/import or recreate schema, verify row counts and constraints, then update bindings. Retain the old database as rollback until verification and explicit cleanup approval. |
| D1 | `otya-auth-db` | `otya-auth-db` | Keep; never combine product business records with identity data. |
| D1 | `otya-core-db` | `otya-store-db` | Proposed target only; inspect schema and Worker bindings before replacement. Do not rename by assumption. |
| R2 | `otyapoint-private` | `omnipoint-dev-private` | R2 bucket names are not changed in place. Create target bucket, copy and verify objects/metadata, update bindings and event rules, retain old bucket until validated. |
| R2 | `otyapoint-backups` | `omnipoint-dev-backups` | Create target bucket and verify a real export/restore before treating backups as operational. Do not claim backup readiness from an empty bucket. |
| R2 | `otya-assets` | `otya-assets` | Keep shared assets. |
| R2 | `otya-media-releases` | `otya-player-releases` | Target name; migrate only after checking release/event notification consumers and object references. |
| KV namespace | `otyapoint-dev-cache` | `omnipoint-dev-cache` | Namespace title can be renamed in place; namespace ID and data remain the same. Update human-readable inventory/config labels and verify bindings. |
| KV namespace | `otya-core-kv` | `otya-core-kv` | Keep. |
| KV namespace | `otya-auth-kv` | `otya-auth-kv` | Keep. |
| Queue | `otyapoint-dev-jobs` | `omnipoint-dev-jobs` | Check producers/consumers and dead-letter references before changing the name. |
| Queue | `otyapoint-dev-jobs-dlq` | `omnipoint-dev-jobs-dlq` | Rename/create only together with the primary queue and matching dead-letter configuration. |
| Queue | `otya-next-jobs` and `otya-next-jobs-dlq` | Existing queues with Worker consumers | Preserve until consumer configuration and producer references are migrated atomically. |
| Queue | `otya-push`, `otya-push-dlq` | Existing shared notification queues | Keep; update only through a separately validated migration. |
| Queue | `otya-release-events`, `otya-release-events-dlq` | Existing media release event queues | Keep until R2 event notifications and consumers are verified. |

## Current account inventory snapshot

Cloudflare account inventory observed on 2026-10-30:

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `omnipoint-dev` (EU), `otya-auth-db`, `otya-store-db`.
- R2: `omnipoint-dev-private`, `omnipoint-dev-backups`, `otya-assets`, `otya-player-releases`.
- KV titles: `otya-core-kv`, `omnipoint-dev-cache`, `otya-auth-kv`.
- Queues: `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`, `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.
- Resend: `petersmartlink.com` is verified for sending and receiving. Keep it as the verified mail domain; use a consistent Otya sender display name and role-based addresses only after checking existing inboxes and DNS dependencies.

## Migration safety and release gates

1. Inspect every Worker binding, queue producer/consumer, R2 event notification, D1 migration, workflow, and Wrangler configuration referencing a resource.
2. Record source and target IDs, region/jurisdiction, object counts, D1 table/row counts, and queue consumer configuration before changes.
3. Create target resources only when a name cannot be changed in place. Never delete the source as part of the first migration.
4. Copy/export/import data; verify checksums, object metadata, schema, constraints, row counts, and application invariants.
5. Update source configuration and CI checks in a branch and pull request. Do not commit API tokens, secrets, personal data, provider credentials, or production records.
6. Deploy only after automated tests and rollback steps are documented. Keep public routes and payment-provider execution disabled until authentication, authorization, idempotency, reconciliation, backup/restore, and partner approval gates pass.
7. Delete legacy resources only after a separate dependency scan, verified recovery point, successful cutover, and explicit cleanup decision.

## Important technical limitation

Cloudflare's D1 database update API does not include a database `name` field, and R2 bucket names are identifiers rather than editable display labels. These resources require a create/copy/verify/switch migration—not a dashboard-style rename. KV namespace titles can be updated without changing the namespace ID. Queue changes must preserve queue IDs and consumer/dead-letter references where possible.
