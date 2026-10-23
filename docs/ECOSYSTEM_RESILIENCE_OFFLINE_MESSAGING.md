# Otya ecosystem resilience and offline messaging architecture

## Objective

Use Cloudflare as the shared platform for the Otya ecosystem—not only for backups—while making services degrade gracefully during internet, Worker, provider, database, or deployment outages. Supabase remains a secondary recovery option for OmniPoint during and after its database migration.

This is an architecture and implementation plan. It does not claim that all queues, failover routes, offline stores, or alerts described here are already deployed.

## Existing Cloudflare foundation (read-only inventory)

The account currently has Workers named `otya-auth`, `otya-core`, and `otya-next`; D1 databases `otya-auth-db` and `otya-store-db`; and R2 buckets `otya-assets` and `otya-player-releases`. The existing Core database has Otya product, notification, security, and operational tables. Keep Auth and Core data boundaries intact. Do not treat the existing Otya Store database as an OmniPoint database.

## Target platform map

| Platform capability | Intended use |
| --- | --- |
| Cloudflare Workers | Shared API edge, webhooks, service endpoints, health checks and lightweight orchestration |
| Cloudflare D1 | Relational data where SQLite compatibility, transactions, workload limits and migration gates pass |
| Cloudflare R2 | Durable files, release artifacts, attachments, exports and backup artifacts; apply access controls and retention |
| Cloudflare Queues | Store-and-forward work: outbound messages, notification delivery, webhook processing, retries and dead-letter handling |
| Cloudflare Workflows | Durable multi-step operations such as release notification, reconciliation orchestration and recovery checklists where appropriate |
| Durable Objects | Per-conversation/session coordination, deduplication windows, rate limiting or strongly coordinated state when needed |
| KV | Cache, feature/config values and short-lived lookup state; not the source of truth for financial ledgers |
| Analytics/observability | Health, queue lag, provider outcomes, errors and SLO tracking without logging secrets or message contents |
| Existing Otya Auth Worker | Shared identity. Each product still owns its own resource permissions and business roles |
| Supabase PostgreSQL | OmniPoint recovery copy during migration; not an independent second writer |

Cloudflare components should be shared as platform capabilities, not as one giant shared database. Each product should own its data, schema, permissions, and migration lifecycle.

## Offline and degraded-mode behavior

### 1. Client offline mode

Apps such as Otya Player and the Next owner app should distinguish local functionality from server-backed functionality.

- Keep local media playback, local library, local settings and already-downloaded content usable without a network.
- Queue user-initiated sync operations locally with a stable operation ID, creation time, payload version and retry state.
- On reconnection, send queued operations in order where ordering matters; use idempotency keys so retrying does not duplicate a transfer, message, or account action.
- Show clear states: Saved on this device, Waiting to sync, Syncing, Synced, Needs attention. Never show a server action as successful until the server confirms it.
- Apply bounded retry/backoff and allow safe cancellation for unsent work. Do not queue sensitive vault contents or credentials in an unprotected outbox.
- Define conflict rules per data type; never resolve financial/stock conflicts by last-write-wins.

### 2. Outbound messages while services or providers are down

Use a durable outbox pattern:

1. The producer writes an event/outbox record with a unique event ID and idempotency key.
2. A dispatcher publishes the record to Cloudflare Queues.
3. A queue consumer calls the correct adapter (Telegram, email provider, push provider or another explicitly configured channel).
4. Record provider response ID, delivery attempt, result category, and timestamps without storing secrets or unnecessary message content.
5. Retry transient failures with exponential backoff and jitter. Respect provider rate limits and Retry-After.
6. After the retry budget, move the event to a dead-letter queue and raise an operational alert. Keep it inspectable and replayable by an authorized operator.
7. Deduplicate by event ID and provider idempotency capability. Where the provider does not support idempotency, use a delivery ledger and acknowledge that a timeout after provider acceptance can leave an ambiguous outcome; do not blindly resend high-impact messages.

A queued message is **accepted for delivery**, not delivered. Only provider-confirmed outcomes should be labeled sent/delivered. The system must distinguish queued, retrying, sent/accepted, delivered (only where the provider reports it), permanently failed, and needs operator review.

### 3. Inbound webhooks during outages

- Verify signatures and authentication before accepting events.
- Persist a compact receipt/idempotency key before acknowledging the webhook when the provider retry contract allows it.
- Return a retryable failure when durable persistence is unavailable; do not acknowledge an event that has not been stored.
- Process events asynchronously through a queue, with per-provider deduplication and ordering rules.
- Monitor oldest unprocessed event, queue depth, retries, dead letters and provider rate-limit errors.

### 4. System-wide outage and recovery

- Maintain independent health checks for UI/API, Auth, Core D1, queue consumers, R2 access and external providers.
- Use a circuit breaker for unhealthy external providers. Continue accepting durable work only if the queue/storage is healthy and the caller can be given a truthful queued status.
- When the primary service is unavailable, show a static/status page and provide the last known service status; never display stale financial data as live.
- On recovery, drain queues at a controlled rate, preserve per-conversation ordering, and avoid a thundering herd.
- Record incident start/recovery transitions and provide operator notifications through an independent channel where possible.
- Do not automatically restore a database because an application health check failed. Diagnose code, configuration, provider, queue and database separately.

## OmniPoint financial integrity requirements

OmniPoint is not allowed to use a general-purpose offline message queue as a substitute for a financial ledger.

- Offline retail sales may be recorded as local pending drafts only if the product explicitly supports that mode and enforces a bounded risk policy.
- Do not confirm a mobile-money cash-in/cash-out transaction while the provider is unreachable or its result is unknown.
- Every financial command must have an idempotency key and a state machine for pending, provider-confirmed success, failure, unknown and reversal.
- Reconciliation must resolve unknown outcomes before retrying an operation that could move money.
- Stock changes and sale posting must use one authoritative database transaction; offline edits require conflict detection and a deliberate merge/review process.
- Audit events must be append-only; corrections to posted ledger entries use compensating entries.
- Supabase backup restoration is a controlled recovery process, never a second active writer or live cross-database dual-write.

## Security boundaries

- Otya Auth establishes identity; each app maps the verified subject to its own approved roles and permissions.
- Verify token issuer, signature, expiry, revocation/session policy and application audience/client boundary before accepting a token.
- Do not put passwords, JWTs, refresh tokens, OTPs, provider API keys, full payment credentials or private vault content in queues, logs, audit events or backup manifests.
- Encrypt restricted backup exports, minimize retained personal data and enforce least-privilege access.
- Restrict dead-letter replay and admin actions to authorized operators; record who performed each action.
- Add rate limits and abuse controls per channel and account.

## Recovery and backup design

- Use D1 Time Travel as a recovery layer for supported D1 workloads, plus independent exports for recovery from account-wide or operator mistakes.
- Export approved database snapshots to a separately protected R2 location only after reviewing access, retention, encryption and account-level blast radius. For critical recovery, maintain an additional independent copy outside the same failure domain.
- Keep backup manifests with source, schema/migration version, timestamp, row/count summaries where safe, and checksum. Never include secrets in the manifest.
- Back up configuration as reviewed infrastructure-as-code, but keep secret values in secret-management systems.
- Run scheduled backup verification and periodic restore drills in an isolated environment. A backup is not proven until it has been restored and checked.
- Define and test per-service RPO/RTO. Auth, product media, messaging, and financial records have different recovery requirements.
- Keep Supabase OmniPoint PostgreSQL as a recovery target until the Cloudflare primary design, migration parity, backup export, and restore drills pass acceptance criteria.

## Delivery and acceptance roadmap

### Phase A — Inventory and contracts
- [ ] Inventory deployed Worker routes, bindings, queue subscriptions, cron triggers, D1 migrations, R2 buckets and current alert destinations.
- [ ] Document event schemas, retry policies, idempotency keys, retention and owner for each queue.
- [ ] Confirm the Otya Auth token contract and per-app authorization mapping.
- [ ] Define per-service outage states and user-facing status language.

### Phase B — Shared messaging foundation
- [ ] Define a versioned notification event envelope with event ID, tenant/product, recipient reference, channel, template ID, locale, creation time, expiry, idempotency key and safe metadata.
- [ ] Implement an outbox and queue consumer with provider adapters, retries, dead-letter queue, deduplication and delivery receipts.
- [ ] Add operational dashboard/alerts for queue lag, retry rates, dead letters, provider health and oldest pending item.
- [ ] Test duplicate, timeout-after-provider-acceptance, rate-limit, provider outage, database outage and consumer crash scenarios.

### Phase C — Client offline sync
- [ ] Add a local durable outbox to each client that needs offline account sync.
- [ ] Implement reconnection, retry/backoff, idempotency, conflict rules and visible sync status.
- [ ] Keep local-only features independent from server availability.
- [ ] Test airplane mode, app termination, low storage, clock changes, duplicate replay and interrupted uploads.

### Phase D — OmniPoint data and recovery
- [ ] Select PostgreSQL-through-Cloudflare or D1 only after compatibility and transaction tests.
- [ ] Build a dedicated OmniPoint data boundary; do not reuse Otya Auth or Store tables for financial records.
- [ ] Migrate a disposable copy and compare stock totals, ledger balances, audit history, foreign keys and reconciliation invariants.
- [ ] Automate restricted Supabase recovery exports and restore verification.
- [ ] Perform a rehearsed cutover and rollback before moving any production traffic.

### Phase E — Production readiness
- [ ] Deploy one service at a time with health checks and rollback versions.
- [ ] Verify real provider delivery and device behavior; a passing build is not proof of production delivery.
- [ ] Test regional/provider outages and restore drills.
- [ ] Publish a status page and operator runbook with clear incident ownership.
- [ ] Close each readiness item only with observable evidence.

## Non-goals and safety

- No unreviewed production migration, destructive database restore, project deletion, secret rotation or traffic cutover is authorized by this document.
- Do not promise that messages can be delivered when the internet, provider, and every alternate channel are all unavailable. The goal is to preserve accepted work durably and deliver it after recovery, while accurately reporting status.
- Do not route one customer's private message to a public channel as a fallback.
- Do not send duplicate payment instructions or financial confirmations on ambiguous provider outcomes.
