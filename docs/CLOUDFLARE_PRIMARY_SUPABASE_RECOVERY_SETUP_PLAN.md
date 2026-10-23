# Cloudflare Primary / Supabase Recovery Setup — Implementation Plan

Date: 2026-10-23
Status: Design and inventory phase; no live failover or automatic data replication enabled.

## Objective

Keep Cloudflare as the only production writer for the Otya ecosystem and establish a separately secured Supabase recovery environment. Automate backup creation, integrity checks, alerts, and scheduled restore drills. Permit automatic service recovery only after a tested promotion/fencing protocol exists.

Products in scope: Otya Auth, Otya Core/Server, Next, OmniPoint, OtyaPlayer, OtyaHub, and future products. Each product must have its own data classification, backup policy, access boundary, and restore checklist.

## Important platform boundary

Supabase PostgreSQL is not a native replica target for Cloudflare D1, KV, R2, Queues, or Workflows. A backup system must export and transform each type separately. Do not claim that a PostgreSQL schema copy is a full backup of these services.

- D1: scheduled SQL export, protected artifact, import/transform into a dedicated recovery schema, compare schema and data checksums.
- KV: paginated key inventory plus value/metadata export. Protect authentication/security-related entries; avoid exposing values in logs.
- R2: paginated object manifest, copy object bodies to separately protected storage, record key/size/metadata/ETag and calculate a cryptographic checksum on the downloaded bytes.
- Queues: queue configuration and consumer/DLQ settings are configuration backups; messages are transient and require a documented replay/reconstruction strategy. Preserve idempotency and delivery state. Never replay financial side effects blindly.
- Workers/Workflows: source code and infrastructure configuration should be versioned in Git; capture bindings/configuration metadata. Secrets are provisioned separately from a secret manager and must never be placed in backup files or logs.
- DNS, routes, custom domains, account-level settings and access policies: maintain a reviewed infrastructure inventory and recovery runbook.

## Required environments

1. Production Cloudflare account: existing live services; remain unchanged until approved and tested.
2. Supabase project `Otya-Recovery-Lab` (`iqajvbqdhnlwpsiofwcv`): isolated schema/restore testing only.
3. Supabase project `OmniPoint` (`iptzfakfeiyjnvepfqcg`): existing application project; do not repurpose as a general cross-product backup database.
4. A dedicated backup destination and retention policy. A recovery database in the same organization is not by itself an independent backup against organization/account compromise. Consider a separately controlled destination and offline/exported encrypted copy.

## Proposed automation stages

### Stage A — non-disruptive baseline
- Daily read-only inventory of Cloudflare resources and configuration drift.
- Queue backlog/DLQ metrics and backup-job health alerts.
- No queue payloads in logs; redact identifiers and secrets.
- Record resource IDs, code commit, schema/migration version and backup policy per product.

### Stage B — scheduled backup
- Choose low-traffic windows for D1 exports after reviewing current export impact and limits.
- Run per-resource backup jobs with bounded concurrency and retries.
- Encrypt artifacts before upload; store encryption keys outside the backup destination.
- Write an append-only manifest containing timestamp, source resource, product, format/schema version, object count/bytes, checksum, completion state, retention expiry, and code version.
- Never mark a backup successful until the artifact is readable and checksums validate.
- Apply retention and deletion only after the restore path and retention policy are approved.

### Stage C — restore verification
- Restore into isolated recovery targets, not production.
- Validate D1 schema objects and row counts; compare table-level checksums where practical.
- Validate KV key/value counts and metadata without exposing secret-bearing values.
- Validate R2 object counts, byte totals, metadata and SHA-256 hashes.
- Validate queue topology, DLQ routing, idempotency and replay-safe test behavior.
- Run application smoke tests and business-ledger reconciliation on synthetic/test data.
- Publish measured RPO/RTO only after repeatable drills.

### Stage D — controlled failover/failback
- Detect outage using independent health probes.
- Require a recovery point within policy, successful integrity checks, and operator approval until promotion is proven.
- Fence the old writer before enabling writes on a promoted recovery target.
- Avoid dual writers and split-brain.
- For financial operations, keep unknown outcomes pending until provider status is reconciled; do not infer success from a local queue.
- Fail back only after replication/reconciliation is complete and a reviewed switch plan is executed.

## Default policy proposal (must be validated against cost and impact)

- Inventory/health checks: daily.
- D1 exports: daily off-peak initially, more frequently only if supported and affordable.
- KV/R2 manifests: daily; object/value copies according to data classification and change rate.
- Integrity checks: after every backup.
- Isolated restore drill: monthly at first, then increase cadence after stable evidence.
- Alerts: backup failure, stale backup, checksum mismatch, DLQ growth, missing consumers, storage quota/cost threshold, and recovery job failure.
- Suggested initial objectives for discussion only: RPO 24 hours and RTO 8 hours. These are targets, not achieved guarantees.

## Decisions and blockers before production automation

1. Approve the D1 export window and acceptable operational impact.
2. Decide whether to use a dedicated Supabase recovery project/schema for each data domain; do not mix authentication, retail, financial and media data indiscriminately.
3. Confirm data retention, privacy, encryption-key ownership, geographic/legal requirements and acceptable costs.
4. Provision least-privilege credentials securely in the relevant runtime; do not paste secrets into chat, Git, issues or manifests.
5. Decide how backup alerts should be delivered and who owns recovery approval.
6. Implement and test idempotent backup/restore code in a non-production branch and isolated environment before enabling scheduled production jobs.

## Current evidence

- Cloudflare inventory checked read-only on 2026-10-23.
- Existing D1 databases, KV namespaces, R2 buckets, queues and Worker scripts were identified.
- One message exists in `otya-push-dlq`; investigate through a controlled redacted review, do not purge/replay automatically.
- Schema-only restore to isolated Supabase `Otya-Recovery-Lab` succeeded for the checked-in OmniPoint migrations.
- No full Cloudflare data backup artifacts or end-to-end recovery drill have been completed yet.
- Cloudflare remains primary; no production writes, deployments, routes, secrets or traffic were changed.

## Go-live acceptance criteria

Do not call the system fully backed up or enable automatic failover until:
- at least two consecutive scheduled backup runs complete and verify;
- a complete isolated restore passes integrity checks;
- an application smoke test and domain-specific reconciliation pass;
- restore duration and data-loss window are measured;
- secret recovery is tested without placing secrets in artifacts;
- failover/failback fencing and rollback are reviewed;
- alerting and on-call ownership are confirmed.
