# Three-Platform Resilience Architecture

Status: design proposal; implementation and production activation are not complete.
Last reviewed: 2026-10-23.

## Decision

- Cloudflare is the primary production platform and the only authoritative writer during normal operation.
- Supabase is the protected backup and recovery target.
- Appwrite is the planned standby application platform for selected compatible services during a Cloudflare outage.
- Traffic control must be independent of the Cloudflare service being monitored. Do not assume Cloudflare DNS or Workers can redirect traffic if the relevant Cloudflare control plane or network is unavailable.

This document does not authorize production data exports, paid upgrades, resuming paused Appwrite projects, deployment, secret migration, DNS changes, or live traffic switching.

## Critical design constraint

Appwrite is not a transparent replacement for Cloudflare Workers, D1, KV, R2, Queues, or Cloudflare Access. Standby endpoints and data models must be implemented and tested. Supabase database recovery does not by itself restore D1, KV, R2, queue state, Worker bindings, secrets, or third-party provider state.

## Platform responsibilities

### Cloudflare primary
- Run current Workers, D1, KV, R2 and Queues.
- Remain the only authoritative writer under normal operation.
- Emit health signals and resource inventory to an independent monitor where feasible.
- Keep application-specific authorization boundaries.

### Supabase recovery
- Store protected, versioned recovery artifacts and/or compatible restored database schemas and data.
- Keep backups isolated from the production project; use least-privilege credentials.
- Validate integrity, age, encryption, retention, and restore success.
- The existing OmniPoint Supabase production project must not be overwritten or repurposed.
- The existing Otya-Recovery-Lab currently validates OmniPoint schema reconstruction only; it is not proof of full Cloudflare recovery.

### Appwrite standby
- Host explicitly implemented standby APIs/functions for services selected by a recovery matrix.
- Maintain compatible schemas, authorization, file metadata, and application contracts.
- Be provisioned and operational before it is needed. A paused project is not a ready standby.
- Do not accept financial writes until a fencing/authority mechanism proves Cloudflare is no longer an active writer and the required data is consistent.
- Avoid assuming Appwrite's own database backups are backups of Cloudflare data.

## Failover state machine

1. NORMAL: Cloudflare serves traffic and is the only authoritative writer.
2. SUSPECTED_OUTAGE: independent probes test critical read/write paths; a single failed probe is insufficient.
3. FAILOVER_APPROVAL_GATE: verify outage threshold, standby health, backup freshness, restore integrity, routing availability, secret availability, and authority fencing.
4. READ_ONLY_RECOVERY: optionally serve safe reads from Appwrite while write authority is being established.
5. STANDBY_ACTIVE: route selected traffic to Appwrite only after required smoke tests pass and one-writer fencing is confirmed. Financial writes remain disabled if consistency or provider outcomes are uncertain.
6. PRIMARY_RECOVERY: verify Cloudflare, compare records, reconcile queued and in-flight operations, and establish a write freeze or replication barrier.
7. CONTROLLED_FAILBACK: return traffic gradually only after data reconciliation and smoke tests pass.
8. NORMAL: Cloudflare resumes sole write authority; record the incident and verify backups.

Any failed gate should leave the system in a safe read-only/degraded state or require operator intervention; it must not automatically promote a stale standby to accept financial writes.

## Routing requirements

- Use an independent health monitor and routing mechanism capable of functioning when Cloudflare is unavailable. Evaluate an external DNS provider/health-checked DNS, a separate CDN/load-balancer, or a provider-neutral front door.
- DNS failover is not instant: resolver caching, TTLs, client caches, and existing connections can delay switching. Define and test actual RTO rather than promising zero downtime.
- Keep certificates, domains, origins, secrets, and access policies ready at the standby.
- Do not route every product at once by default; use per-service routing where possible.
- Test Cloudflare control-plane outage and Cloudflare data-plane outage as separate failure scenarios.

## Data and service recovery matrix

Every production resource must have an owner, export method, encryption method, schedule, retention policy, integrity check, restore procedure, measured RPO/RTO, and Appwrite standby compatibility status.

- D1: export through an approved low-impact process; test schema/data import and indexes/triggers. Some export operations may affect availability; never run a production export until its impact is approved.
- KV: export keys and values, preserve metadata/TTL semantics where required, and verify import.
- R2: inventory objects, copy approved objects, and verify cryptographic hashes and metadata.
- Queues: preserve message semantics and idempotency; inspect dead-letter items before replay. Do not blindly replay or purge queues.
- Workers: version code/configuration in Git; store secrets separately in an approved secret manager and test recovery without committing secrets.
- Identity: plan user/session/token recovery explicitly. Never copy password hashes or signing secrets casually; test revocation, rotation, and reauthentication.
- External financial/mobile-money providers: maintain idempotency keys and reconcile provider outcomes before retries.
- OtyaPlayer: preserve offline playback; server outage must not block local media.
- OmniPoint: inventory, sales, ledgers, float, commissions, and financial audit history require strict consistency and append-only reconciliation.

## Go-live gates

Do not enable automatic failover until all are true:
1. Two consecutive scheduled backups pass integrity checks.
2. An isolated full restore of each in-scope resource succeeds.
3. Appwrite standby APIs pass contract and authorization tests.
4. Independent routing has been tested during a simulated Cloudflare outage.
5. Single-writer fencing and safe read-only fallback are reviewed.
6. Financial transaction idempotency and provider reconciliation are tested.
7. Failback/reconciliation drill succeeds.
8. RPO/RTO are measured and agreed; alerts have an accountable owner.
9. Cost, retention, data residency, privacy, and credential ownership are approved.
10. The paused Appwrite projects are assessed; do not resume or upgrade them without an explicit cost/impact check.

Illustrative targets such as RPO 24 hours or RTO 8 hours are not guarantees and must not be represented as achieved.

## Safe next implementation steps

1. Inspect existing Appwrite projects and their current plans/configuration in read-only mode.
2. Build a resource-by-resource recovery matrix and select a non-production pilot.
3. Add export/manifest integrity tooling and tests without reading or exporting customer data.
4. Test the recovery pipeline with synthetic data in isolated environments.
5. Provision/activate standby capacity only after cost approval.
6. Conduct a controlled game day before enabling any live traffic automation.

## Current known status

- Cloudflare resources have been inventoried read-only.
- No Cloudflare production export or traffic switch has been performed.
- Supabase Otya-Recovery-Lab contains an OmniPoint schema-only restore; production rows and secrets were not copied.
- Appwrite workspace projects `PeterSmart Technologies` and `PLAYED server` were observed paused on 2026-10-23. No resume or mutation was performed.
- Existing recovery tooling in Otya-Server is in a draft pull request; test success and live recovery have not been confirmed.
