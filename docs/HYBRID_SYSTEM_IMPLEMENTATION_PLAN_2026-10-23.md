# Otya Hybrid System — Coordinated Implementation Plan
Date: 2026-10-23
Repository: PeterSmartLink/Otya-Server
Working branch: build/ecosystem-resilience-offline-messaging
Draft PR: https://github.com/PeterSmartLink/Otya-Server/pull/203

## Objective
Deliver a tested hybrid Otya platform that can survive provider outages while preserving data integrity, security, and financial correctness. Implement work in one coordinated programme, but release in gated stages so an unfinished recovery path cannot endanger production.

## Target roles
- **Cloudflare — primary runtime and authoritative writer:** Workers (otya-auth, otya-core, otya-next), D1 (otya-auth-db, otya-store-db), KV, R2, Queues and Workflow.
- **Supabase — independent recovery store:** PostgreSQL restore target and recovery metadata for compatible relational data. It is not a transparent replacement for Workers, KV, R2, or queues.
- **Appwrite — standby application destination:** candidate for selected compatible endpoints and services only after its project state, cost, authentication model, data mapping, and restore/failover behavior are verified.
- **Independent monitor and recovery controller:** monitor from outside the Cloudflare failure domain; evaluate evidence and freshness; maintain a single-writer/fencing protocol; produce an auditable recommendation. It must not rely solely on Cloudflare DNS/Workers to detect or coordinate a Cloudflare-wide outage.

## Non-negotiable safety rules
1. No automatic production failover or failback until every relevant recovery gate passes and a separate explicit authorization is given.
2. Never allow Cloudflare and a standby to accept writes simultaneously. Use a tested writer lease/fencing token or an equivalent enforceable single-writer mechanism.
3. Do not replay financial or customer-facing events without stable idempotency keys, duplicate detection, ordering rules, and reconciliation.
4. Fail closed when backup age, integrity, schema compatibility, identity mapping, or writer ownership cannot be proved.
5. Keep existing Supabase OmniPoint project iptzfakfeiyjnvepfqcg untouched. Its purpose is not Otya recovery.
6. The isolated Supabase project Otya-Recovery-Lab (iqajvbqdhnlwpsiofwcv) currently has an OmniPoint schema-reconstruction validation. Do not reuse it as an Otya restore target without first reviewing and explicitly approving that change. Prefer a separately isolated Otya-only lab after cost confirmation.
7. Appwrite projects PeterSmart Technologies and PLAYED server are paused; do not resume, upgrade, or incur charges without explicit cost/impact approval.
8. No production D1 export, production data copy, secret migration, deployment, DNS/traffic change, queue mutation, or destructive action is part of this branch-only implementation.

## Implementation tracks (parallel where independent)

### A. Release and security gates
- Repair the malformed Resend webhook smoke-check pattern in .github/workflows/deploy.yml; the line was missing the end of the expected HTTP status pattern. The final verified text edit is commit cb53ebbf94a2010085dd2a62ad529770279bcbe0; wait for CI to verify it.
- Fix the stale webhook contract assertion only if a fresh test still fails after the workflow repair; preserve the intended HTTP 405 GET behavior.
- Resolve the failing contract test test/resend-webhook-contract.test.mjs and rerun full backend tests.
- Investigate and remediate the runtime dependency audit. The 2026-10-23 audit output reported 23 findings (2 moderate, 19 high, 2 critical) and identified Next.js-related critical advisories and a sharp/librsvg issue. Confirm exact lockfile paths and compatible patched versions; avoid blind npm audit fix --force or broad major upgrades.
- Require successful configuration validation, migration layout validation, all tests, typecheck/build, and security audit before release consideration.
- Keep deployment and live smoke tests skipped on PRs; never weaken production authorization to make CI green.

### B. Backup and restore integrity
- Produce versioned manifests for D1 schema/data exports, KV key/value metadata, R2 object manifests and checksums, queue/DLQ snapshots where supported, and deployment/configuration metadata without storing secrets in manifests.
- Store recovery copies outside the Cloudflare failure domain with restricted access, encryption, retention, and integrity verification.
- Verify that backup manifests identify source, capture time, schema/version, object/key counts, checksums, and recovery-point age.
- Restore synthetic fixtures first. Then restore an Otya-only sanitized/synthetic snapshot into a dedicated isolated target. Do not start a production export until impact and maintenance-window approval.
- Verify row counts, foreign keys, ledger balance, unique/idempotency constraints, object hashes, TTL semantics, and queue replay behavior after restore.

### C. Service/data compatibility matrix
For every service, document the source, target, transformations, consistency guarantee, recovery owner, and acceptance test:
- D1 relational data → PostgreSQL/Supabase mapping where compatible.
- KV → key/value recovery representation preserving namespace, TTL/expiration semantics, and security-sensitive handling.
- R2 → object store mapping preserving object keys, metadata, content hashes, and access controls.
- Queues and DLQs → durable event ledger with stable event IDs, retry limits, ordering requirements, and dead-letter review.
- Workers and workflows → independently deployable standby API implementation; do not assume Appwrite alone executes Cloudflare Worker code.
- Authentication/session state → explicit identity and session strategy; never copy live secrets or assume provider tokens are interchangeable.
- Scheduled/background jobs and webhooks → idempotent handlers, bounded retries, deduplication, and auditable outcomes.

### D. Traffic failover/failback control
- Use an independent monitoring provider/runner and an independently controlled routing mechanism that is not wholly dependent on Cloudflare during a Cloudflare-wide outage.
- Require multiple independent health signals and sustained failure windows; distinguish provider outage from application/data outage.
- Before failover, require: verified backup within RPO, standby health, schema/version compatibility, successful read/write canary against synthetic data, explicit writer fencing, and an audit event.
- Failback only after primary health is sustained, data has been reconciled, standby writes are fenced, and a controlled cutback rehearsal succeeds.
- Begin with a manual approval gate; only consider automation after repeatable game-day drills pass.

### E. Offline and degraded operation
- Client outboxes for safe, non-financial user actions with event IDs, timestamps, retry limits, and conflict resolution.
- Server-side store-and-forward for notifications and non-financial tasks.
- For mobile-money, cash, inventory, and ledger actions, never promise that an offline action is completed remotely until confirmed by the authoritative provider/ledger. Use pending/unknown states and reconciliation.
- Review the existing otya-push-dlq backlog (one message at inventory time) and the otya-release-events queue (zero backlog, no consumer at inventory time) in a separate read-only operational review; do not purge, replay, acknowledge, or alter consumers as part of this work.

## Current verified state (2026-10-23)
- Recovery tooling workflow passed for the synthetic manifest verifier.
- Synthetic multi-resource recovery contract tests are committed at test/recovery/synthetic-recovery-pilot.test.mjs.
- CI for commit bdf414d98de21b246dd33b721b6cb7ee6a463843 reported:
  - recovery integrity: success;
  - backend validation: failure in test/resend-webhook-contract.test.mjs, because the expected workflow pattern did not match a malformed webhook smoke-check line;
  - security baseline: failure because the runtime dependency audit found high/critical vulnerabilities;
  - production deployment/live smoke steps: skipped.
- The malformed workflow smoke-check line was repaired in commit cb53ebbf94a2010085dd2a62ad529770279bcbe0. The latest recovery workflow passed; backend and security workflows were still running at the last check.
- Existing Supabase recovery lab work reconstructed the OmniPoint schema only; it does not prove Otya data recovery.
- No production data exports, production deployments, DNS changes, traffic switches, secret moves, Appwrite resumes/upgrades, or live queue mutations have been performed.

## Definition of done
- CI green for relevant tests, typecheck/build, migrations, security audit, and recovery tooling.
- A dedicated Otya-only lab has a reproducible restore from a versioned backup manifest.
- Restore drills prove integrity for relational data, KV TTL, R2 objects, queue replay/idempotency, and financial ledger invariants.
- Standby endpoints and authentication have contract tests against the primary API.
- Writer fencing prevents split-brain under network partitions and monitor failure.
- Independently controlled routing and documented RTO/RPO have been tested in a game day.
- Failback reconciliation is rehearsed and audited.
- Production rollout, any data export, provider activation, paid upgrade, secret migration, and DNS/traffic change each receive explicit approval before execution.