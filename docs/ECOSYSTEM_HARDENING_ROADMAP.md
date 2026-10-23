# Otya ecosystem hardening roadmap

This roadmap complements ECOSYSTEM_READINESS.md, the recovery runbook, and ECOSYSTEM_WIDE_SUPABASE_RECOVERY.md. It defines hardening work across the ecosystem. It is not a claim that each control is already enabled in production.

## 1. Identity and access boundaries

- Treat Otya Auth as identity only; every product must authorize its own roles, tenant/store scope and actions.
- Validate token signature, issuer, expiry, revocation/session policy and audience/client boundary at each service boundary.
- Use least-privilege service bindings and narrowly scoped deployment/API tokens. Separate development, preview and production credentials.
- Require step-up verification for privileged owner/admin actions, financial adjustments, credential changes and destructive operations.
- Add rate limits and abuse detection for login, OTP, password recovery, message sending, webhook ingress and expensive AI routes.
- Record privacy-safe security events; do not log passwords, OTPs, bearer tokens, private keys, payment credentials or message bodies by default.
- Add periodic dependency and secret scanning, and define a documented credential rotation procedure for confirmed exposure.

## 2. Resilience and offline behavior

- Use durable outbox + queue processing for outbound notifications, with event IDs, idempotency, bounded retries, jitter, dead-letter handling and operator-controlled replay.
- Persist webhook receipts before acknowledging them where the provider's retry contract allows it; deduplicate inbound event IDs.
- Clients should expose honest states: local-only, queued, syncing, confirmed, failed or needs review.
- Keep offline queues encrypted and bounded, expire obsolete low-value actions, and provide a visible retry/cancel path where safe.
- Do not replay non-idempotent operations automatically when provider acceptance is ambiguous.
- For OmniPoint, offline retail drafts may be allowed under an explicit risk policy; mobile-money actions must not be reported successful until the provider outcome is verified.

## 3. Recovery and backup quality

- Register every Worker, D1 database, R2 bucket, KV namespace, Queue, Workflow, Durable Object, scheduled job and external provider in a resource inventory with an owner and purpose.
- Produce per-service backup manifests, schema versions, checksums and freshness indicators.
- Keep database snapshots, object bytes, queue/outbox state, configuration and secrets as distinct recovery categories.
- Store critical independent copies outside the same account/failure domain where practical.
- Run automated backup-integrity checks and scheduled isolated restore drills. Alert on stale or missing backups and failed restores.
- Establish service-specific RPO/RTO targets after measuring realistic snapshot and restore durations.
- Never trigger destructive restore automatically from a health check. Failover must have a single-writer fence and a tested return-to-primary reconciliation.

## 4. Performance and cost controls

- Cache only safe public or explicitly scoped data; never expose private user or financial data through shared cache keys.
- Add pagination and bounded payload sizes to list endpoints; use indexes based on observed query plans.
- Set per-provider timeouts, concurrency limits, retry budgets and circuit breakers to prevent cascades.
- Use background queues for slow work, not long synchronous requests. Apply backpressure when a queue approaches configured limits.
- Use regional placement and data locality only after measuring latency and compatibility; do not move critical financial writes to eventually consistent stores for speed.
- Track p50/p95/p99 latency, error rates, queue age/depth, database failures, storage failures and cost/quota headroom.
- Define budgets and alert thresholds before enabling high-volume schedules or new paid products.

## 5. Delivery and change safety

- Keep pull requests and CI gates for source changes, schema changes and infrastructure changes.
- Use pinned action versions, read-only CI permissions, dependency audits and secret-exposure checks.
- Use preview/staging resources for integration tests and isolated restore drills; never point tests at production financial data.
- Use backward-compatible expand/migrate/contract schema changes, and require explicit approval for destructive migrations.
- Deploy incrementally with smoke tests and a documented rollback path; keep database rollback separate from code rollback.
- Treat successful builds as source evidence only. Live health checks, device tests and restore drills are separate acceptance gates.

## 6. Suggested service-level objectives

Set numeric targets only after measuring baseline behavior. Start by measuring:
- API availability and p95/p99 latency by service.
- Auth success/failure and rate-limit events.
- Oldest queue message, retry count, dead-letter count and delivery confirmation rates.
- Backup age, checksum verification, last successful restore drill and recovery duration.
- Offline outbox size, age, sync success rate and conflict rate.
- OmniPoint unresolved provider outcomes, reconciliation age and inventory/ledger invariant failures.

## 7. Rollout order

1. Complete the live resource inventory and establish a no-secrets export/backup manifest.
2. Add source-level security gates to OmniPoint and verify existing Otya security workflows.
3. Test one low-risk Cloudflare-to-Supabase backup and isolated restore end-to-end.
4. Validate Otya Auth token audience/role boundaries and per-product authorization.
5. Exercise queue retry, deduplication, dead-letter and ambiguous provider-timeout cases in non-production.
6. Implement local outbox contracts in clients and preserve offline-only features.
7. Add dashboards/alerts and record measured SLO, RPO and RTO baselines.
8. Only then evaluate controlled failover and higher-volume production rollout.

## Status discipline

Every checklist item must carry evidence: source test, CI result, deployed commit, live smoke test, or restore drill. Do not label a feature "active" based only on documentation or a merged commit.
