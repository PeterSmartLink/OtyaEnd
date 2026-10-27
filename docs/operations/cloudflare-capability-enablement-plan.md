# Otya Cloudflare Capability Enablement Plan

**Owner:** Otya Hold Ltd  
**Platform foundation:** Otya Server  
**Scope:** OmniPoint, Otya OS, Otya Media and shared Otya services  
**Status:** staged plan; no production settings changed by this document

## Operating rule

Enable capabilities when their purpose, data owner, access boundary, cost, failure mode and rollback are understood. A feature is not considered enabled merely because a resource exists. Never expose an internal endpoint, enable a consumer, change DNS, rotate or create production secrets, migrate data, deploy, or activate real payments as part of an unreviewed bulk enablement.

## Current inventory observed in the read-only audit

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1 databases: `omnipoint-prod`, `omnipoint-migration-test`, `otya-auth-db`, `otya-store-db`.
- R2 buckets: `omnipoint-backups`, `omnipoint-private`, `otya-assets`, `otya-player-releases`.
- KV namespaces: `otya-core-kv`, `otya-auth-kv`, `omnipoint-cache`.
- Queues, a Workflow, and Pages project `omnipoint-relay-lab` also exist.
- The existing `otya-core` Wrangler configuration already enables Worker observability/logs/traces, redacts query strings, and has D1, R2, KV, Analytics Engine, rate-limit, queue producer/consumer, service and Workflow bindings.
- Existing config intentionally has no consumer for `otya-release-events` until a safe idempotent release-intake handler has been implemented and tested. Keep that gate.
- The backup bucket had no listed objects at audit time. No successful restore drill has been demonstrated.
- Account 2FA was reported disabled at audit time. This is a manual account-owner action and must be verified in the dashboard.

Inventory is a snapshot, not a claim that every binding is currently healthy or every feature has been fully tested.

## Capability matrix

| Capability | Intended use | State / next action | Safety gate |
|---|---|---|---|
| Workers | API, routing, business logic, webhooks | Existing workers; review routes, service bindings and error rates before changes | No production deploy without review |
| D1 | Authoritative structured application records | Four databases exist; document ownership and reconcile schema differences before any migration | Never combine financial ledger, authentication and media data indiscriminately |
| R2 | Private backups, documents, assets and releases | Buckets exist; implement verified backups and test restore into an isolated destination | Do not overwrite production objects or store unencrypted off-account copies |
| KV | Cache and non-authoritative configuration | Namespaces exist; confirm TTL, invalidation and sensitivity | Never use as the authoritative ledger or store long-lived secrets |
| Queues | Retryable background work | Queues exist; audit each producer, consumer, retry policy and dead-letter queue | Idempotency and duplicate-delivery tests before business-critical jobs |
| Workflows | Durable multi-step jobs | Workflow binding exists; test cancellation, retries, timeouts and replay | No payment side effects until idempotency/reconciliation are proven |
| Analytics Engine | Operational metrics without sensitive payloads | Bindings exist; verify dataset ingestion and useful dashboards | Do not send secrets, payment credentials, or unnecessary personal data |
| Rate limiting | Abuse and cost protection | Rate-limit binding exists; test legitimate shop/agent traffic and abusive bursts | Avoid locking out all staff; document emergency bypass/recovery |
| Observability | Logs, traces, incident diagnosis | Existing configuration enables it; verify telemetry and redact sensitive fields | Keep query-string redaction; do not log tokens, OTPs, PINs or payment payloads |
| Cloudflare Access | Protect admin and internal tools | Review current policies and identity options; enable only after a recovery admin path is verified | Do not lock the owner out; protect admin routes before making them public |
| WAF / security rules | Block common attacks and abusive traffic | Audit current zone rules and managed protections, then propose a least-risk baseline | Test on a non-production hostname before broad blocking rules |
| DNS / custom domains | Stable routing and domain continuity | Preserve current records and email routing; document replacement-domain checklist | No DNS edits or domain cutover without explicit approval |
| Workers.dev | Alternate service URL | Currently disabled on key workers | Do not enable publicly until authentication, routing and data exposure are reviewed |
| Secrets Store | Worker secret access | Existing bindings reference Secrets Store | Never commit values; audit least privilege and rotation readiness |
| D1 Time Travel / snapshots | Point-in-time recovery | Availability observed during audit; verify retention and recovery options in dashboard/API | Time Travel alone is not an independent backup |
| Backups / restore drills | Recover from accidental deletion or account/domain loss | Runbook exists; next build is a manual export, checksum, encrypted off-account copy and isolated restore | No scheduled production exports until a successful manual drill |
| Pages | Preview/review environment | Existing `omnipoint-relay-lab` project | Keep isolated from production data and secrets |
| CI checks | Catch regressions before deploy | Inspect workflows and run safe checks in branch/CI | Do not add automatic production deploys as part of enablement |
| AI Gateway / Workers AI | Optional AI support, summarization or classification | Evaluate only for a defined use case and budget | No sensitive financial/identity payloads without explicit data handling review |
| R2 event notifications | Asset/release automation | Keep release-events consumer disabled for now | Enable only after idempotent handler and duplicate/out-of-order event tests |
| Payment partner integrations | Airtel, MTN and Interswitch | Sandbox readiness, credential separation and reconciliation design | No live transactions, live credentials or settlement changes without approval |

## Required order of work

### Stage 1 — Account security and continuity
1. Owner enables and verifies Cloudflare account 2FA and stores recovery codes safely.
2. Review account members, API tokens and service credentials; use least privilege and avoid sharing the global API key.
3. Record current Worker bindings, DNS records, email records, database identifiers, bucket names and secret names in the private operations runbook (never secret values).
4. Verify budget/usage limits and alerts where available.
5. Create an incident recovery contact and document how to retain control if the primary domain expires.

### Stage 2 — Data protection
1. Confirm which database owns each data domain and map overlapping schemas before any migration.
2. Implement a manual backup operator flow for all four D1 databases using explicit database IDs/names and a clearly separated backup destination.
3. Generate timestamps, SHA-256 checksums and a manifest; exclude credentials and redact sensitive logs.
4. Upload to the private backup bucket using least-privilege credentials, then copy an encrypted backup outside the Cloudflare account.
5. Restore to an isolated database/environment, verify schema and representative row counts, and document recovery time.
6. Only after a successful drill, review a scheduled backup workflow, retention, alerting and cost.

### Stage 3 — Application reliability
1. Inventory every queue and Workflow and assign an owner, retry policy, dead-letter destination and replay procedure.
2. Add idempotency keys and audit events to inventory movements, sales, agency cash-in/cash-out and reconciliation.
3. Verify queue redrive and Workflow retries in a non-production environment.
4. Keep the release event consumer disabled until its handler passes duplicate, ordering, malformed-event and failure-retry tests.

### Stage 4 — Access and edge security
1. Map public, staff-only and owner-only routes.
2. Test Cloudflare Access policies against an owner recovery route before restricting administrative endpoints.
3. Review WAF/rate-limit settings in report/test mode where available before enforcing disruptive rules.
4. Confirm CORS allowlists, webhook signature verification, request-size limits, abuse controls and secret redaction.
5. Review custom-domain and workers.dev exposure; do not enable alternate public endpoints by default.

### Stage 5 — OmniPoint operational readiness
1. Keep retail stock, sales, cash movements, agency transactions, commissions and reconciliation auditable.
2. Use append-only ledger entries and reversal/correction records rather than silently editing completed financial transactions.
3. Require staff roles and least privilege; separate customer, agent, cashier, supervisor and owner permissions as appropriate.
4. Implement daily cash/float reconciliation and exception reports before live payment processing.
5. Use sandbox credentials and test idempotency, timeouts, callbacks, duplicate notifications and partner downtime.
6. Require explicit owner approval before live payment credentials or real-money flows are activated.

### Stage 6 — Shared Otya services
1. Define stable internal API contracts and versioning in Otya Server.
2. Share authentication only where each product needs it; use product-specific authorization and data boundaries.
3. Keep Otya Media release assets separate from OmniPoint financial data.
4. Use a common health/status/incident model and documented domain replacement procedure.
5. Evaluate optional Cloudflare features against a concrete workload, expected traffic and cost rather than enabling everything indiscriminately.

## Domain continuity checklist

A future domain replacement requires: control of the new domain; DNS and TLS validation; Worker custom-domain setup; CORS and allowed-origin updates; canonical website URL changes; OAuth/Firebase/Telegram/payment-provider callback review; email MX/SPF/DKIM/DMARC preservation or reconfiguration; webhook allowlists; redirect and SEO review; and a staged smoke test. Do not assume a DNS change alone is sufficient.

## Completion criteria

A capability is marked **enabled and verified** only after configuration is observed, an end-to-end test passes, access and cost are reviewed, monitoring is present, and a rollback/recovery path is documented. Until then it remains **present**, **planned**, or **blocked by an owner/security gate**.
