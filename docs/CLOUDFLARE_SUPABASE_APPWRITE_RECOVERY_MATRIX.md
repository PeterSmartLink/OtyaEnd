# Cloudflare–Supabase–Appwrite Recovery Matrix

Status: planning artifact; no production recovery has been executed.
Reviewed: 2026-10-23.
Branch: `build/ecosystem-resilience-offline-messaging`.

## Safety boundary

This matrix is a plan, not a declaration that backups or standby services exist. Cloudflare remains the sole production writer. Supabase is the recovery/backup destination. Appwrite is a proposed standby for only those APIs that are explicitly ported and tested. Do not export production D1 data, copy KV values or R2 object bodies, inspect queue payloads, resume Appwrite projects, change DNS, deploy, rotate/move secrets, or switch traffic as part of this planning step.

The existing Supabase `OmniPoint` project (`iptzfakfeiyjnvepfqcg`) is not an Otya recovery target and must remain untouched. The isolated `Otya-Recovery-Lab` project (`iqajvbqdhnlwpsiofwcv`) currently proves only that the OmniPoint schema can be reconstructed from migrations; it does not contain a full Cloudflare recovery copy. Do not mix the OmniPoint schema or business data into an Otya backup.

## Resource inventory and intended recovery

| Cloudflare resource | Known inventory | Supabase recovery role | Appwrite standby role | Required validation / blocker |
|---|---|---|---|---|
| Worker `otya-auth` | Worker present | Store versioned deployment/configuration metadata; never secrets in ordinary tables | Port compatible auth endpoints only after token/session design review | Auth contract, abuse controls, revocation, secret rotation, and reauthentication tests |
| Worker `otya-core` | Worker present | Preserve versioned code/config references and data recovery manifests | Port selected API routes; do not assume runtime compatibility | Endpoint contract tests and authorization parity |
| Worker `otya-next` | Worker present | Preserve job definitions and recovery metadata | Standby job/API handlers only if idempotent | Duplicate delivery, retry, and DLQ behavior tests |
| D1 `otya-auth-db` | 8 tables including internal `_cf_KV`; 7 application tables; 16 indexes; 0 triggers; 106,496 bytes | Encrypted, versioned database backup or isolated restored schema/data in a dedicated Otya recovery project | Map application tables to reviewed Appwrite collections or a compatible data service; no direct automatic translation assumed | Low-impact export approval; schema/data counts, indexes/constraints, auth semantics, restore drill |
| D1 `otya-store-db` | 32 tables including internal `_cf_KV`; 31 application tables; 63 indexes; 1 trigger; 17,182,720 bytes | Encrypted, versioned backup and isolated restore | Port only the explicitly selected read/API surface; preserve relational integrity elsewhere if Appwrite cannot express it | Trigger behavior, FK/unique constraints, financial/data invariants, restore checks |
| KV `otya-core-kv` | 21 keys inventoried; values not read | Encrypted backup of key/value plus TTL/metadata where needed | Recreate required lookup/config values only after data model and TTL semantics are tested | Key counts, expiry behavior, value hashes, access controls |
| KV `otya-auth-kv` | 4 keys inventoried; values not read; key names include login-IP/resend-login-IP security metadata | Protected backup only if retention/privacy review permits; treat as security-sensitive | Rebuild only the minimum required security controls; do not blindly replay rate-limit state | Privacy review, TTL and rate-limit behavior, avoid exposing identifiers |
| R2 `otya-assets` | 17 objects, 26,512 bytes; bodies not downloaded | Versioned object backup or manifest pointing to encrypted object storage | Appwrite Storage only if object URLs, ACLs, metadata, and delivery paths are compatible | Object count, size, hashes, metadata, permissions, URL behavior |
| R2 `otya-player-releases` | 25 objects, 314,870,793 bytes; bodies not downloaded | Versioned artifact backup with immutable release manifest | Appwrite Storage or separate static artifact origin; keep download links/versioning compatible | Hash/signature verification, large-object transfer, release manifest and rollback tests |
| Queue `otya-next-jobs` | Backlog 0; consumer `otya-next`; DLQ `otya-next-jobs-dlq` | Persist approved recovery metadata and any required message snapshot under a defined replay policy | Reimplement workers only with idempotency and deduplication | Synthetic enqueue/consume/retry/replay tests |
| Queue `otya-next-jobs-dlq` | Backlog 0 | Keep DLQ audit/recovery procedure documented | No automatic replay by default | Confirm operator-reviewed replay and idempotency |
| Queue `otya-push` | Backlog 0; consumer `otya-core`; DLQ `otya-push-dlq` | Recovery metadata; protect push payloads and tokens | Rebuild notification dispatch only with provider-safe retry semantics | Synthetic delivery failure, duplicate suppression, token privacy |
| Queue `otya-push-dlq` | Backlog 1, 393 bytes; payload not inspected; no consumer | Preserve in place until reviewed; do not purge or replay automatically | No automatic replay | Manual payload review and approved disposition required before any action |
| Queue `otya-release-events` | Backlog 0; no consumer shown in inventory | Preserve schema/event contract and operational notes | Implement a consumer only if repository/config review confirms intended behavior | Determine whether no consumer is intentional or a missing configuration |
| Queue `otya-release-events-dlq` | Backlog 0 | Document retention/replay procedure | No automatic replay | Synthetic failure and replay test |
| Workflow `otya-release` | Workflow present | Version workflow and deployment metadata in Git | Standby release pipeline only after build provenance and signing are designed | Build reproducibility, artifact signing, credentials, rollback |
| Secrets / bindings | Not inventoried as values; values must remain undisclosed | Store references and rotation/recovery instructions, not plaintext secrets in docs/backups | Create separate least-privilege standby credentials after approval | Inventory names/scopes read-only; secret availability and rotation drill |
| Independent routing / monitoring | Not yet proven independent of Cloudflare | Store incident records and backup freshness evidence | Route only after independent health check and authority fencing exist | External control plane, DNS TTL behavior, certificates, synthetic outage drill |

## Recovery order

1. **Observe and protect:** independent monitoring; confirm primary outage across multiple probes; avoid treating a single failed request as an outage.
2. **Check data freshness:** verify signed/hashed backup manifest, age, and restore test result for every required resource.
3. **Fence writes:** prove the old primary cannot continue processing authoritative writes. If this cannot be proven, permit safe reads only or stop.
4. **Restore isolated data:** recover to a dedicated non-production Otya environment; never use the OmniPoint production project.
5. **Run compatibility checks:** API contract, authorization, object access, queue idempotency, and application-specific invariants.
6. **Switch a limited read-only service first:** only when an independent router and certificates are ready. Financial/mobile-money write paths remain disabled until consistency, idempotency, and provider reconciliation pass.
7. **Enable selected writes only after explicit go-live approval:** use one authoritative writer, deduplication keys, audit trails, and a tested reconciliation process.
8. **Fail back deliberately:** freeze writes or use a replication barrier, reconcile all in-flight operations, smoke-test the primary, then move traffic gradually.

## Synthetic-data pilot acceptance criteria

The first pilot should use a new isolated test dataset, fake identities, fake payment references, and non-sensitive sample files. It must not connect to live mobile-money providers or production customer records.

- [ ] A synthetic D1 fixture exports/imports to an isolated target with expected table/row counts and invariant checks.
- [ ] A synthetic KV fixture preserves key/value checksums and TTL semantics.
- [ ] A synthetic R2 fixture preserves object bytes, SHA-256 hashes, metadata, and access policy.
- [ ] A synthetic queue fixture demonstrates retry, duplicate delivery, DLQ handling, and operator-approved replay without double effects.
- [ ] Appwrite standby endpoints pass request/response contract and authorization tests.
- [ ] Independent health/routing behavior is tested without changing production DNS.
- [ ] A simulated split-brain test proves standby writes are rejected until primary authority is fenced.
- [ ] A recovery and failback exercise records measured RPO/RTO; targets are not claimed before measurement.
- [ ] Evidence is attached to the draft PR; no automatic production traffic switching is enabled.

## Known blockers / follow-up

- No production D1 export has been started because export impact needs approval.
- KV values and R2 bodies were not read or copied.
- The single message in `otya-push-dlq` remains uninspected and unchanged.
- `otya-release-events` has no consumer shown; determine intended behavior before altering it.
- Appwrite projects `PeterSmart Technologies` and `PLAYED server` were observed paused. Do not resume or upgrade without a cost/impact check and explicit approval.
- No Appwrite API parity, full data restore, independent routing drill, failover, or failback has been verified.
- No customer data, credentials, tokens, or secrets belong in this document.

## Go-live decision

Automatic failover remains **disabled** until the acceptance criteria, data-consistency controls, cost review, security review, and explicit production approval are complete.
