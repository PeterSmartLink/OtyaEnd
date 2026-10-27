# Otya Server — Canonical Architecture and Ownership Map

**Status:** reviewed architecture baseline; documentation only. This document does not authorize deployment, configuration changes, data movement, or payment activation.
**Reviewed:** 2026-10-27
**Company:** Otya Hold Ltd
**Operating business:** Otya Hold Ltd T/A OmniPoint
**Platform family:** Otya OS · Otya Server · Otya Media

## Decision summary

Otya Server is the shared infrastructure/backend family, not a physical server that must be purchased. Cloudflare Workers run the application services; D1 is the SQL store; R2 stores objects and private backup artifacts; KV is for suitable low-latency key/value data; Queues and Workflows handle asynchronous work. GitHub is the code and review source of truth. A physical shop server and Cloudflare Tunnel are not prerequisites for the current architecture.

For OmniPoint, keep the existing Cloudflare + GitHub direction. Do not introduce Supabase, Appwrite, or Vercel as operational dependencies. AWS remains an optional, separate outbound fixed-egress relay only if Airtel confirms it requires a stable public source IP and confirms the chosen design is acceptable.

## Current live service names

Names below are based on the latest read-only Cloudflare account inspection. Do not rename live services to match older documents without an explicit migration plan.

| Live resource | Current responsibility / known relationships | Notes |
| --- | --- | --- |
| `otya-core` Worker | Canonical website/API gateway and current custom domains; calls `otya-auth` through `AUTH` and `otya-next` through `AI_SUPPORT` service bindings | Existing domain and routing configuration must be preserved. |
| `otya-auth` Worker | Authentication/account services; bound to `otya-auth-db` and auth KV | Contains existing identity/security data; never treat as empty. |
| `otya-next` Worker | AI-related runtime/services; bound to its existing D1 and Cloudflare AI-related resources | Keep AI optional to core shop operations. |
| `omnipoint-prod` D1 | Intended primary operational SQL database for OmniPoint shop/agency operations | Core schema exists; nine checked core tables had zero rows at audit time. Verify current state before any migration. |
| `omnipoint-migration-test` D1 | Isolated migration/testing data | Contains test records and legacy/ORM-style schema; not a source to merge blindly into production. |
| `otya-store-db` D1 | Existing Otya product/player/store data | Has existing records; preserve. |
| `otya-auth-db` D1 | Existing account, identity and security-related records | Has existing records; preserve. |
| R2 buckets | `omnipoint-backups`, `omnipoint-private`, `otya-assets`, `otya-player-releases` | Private backup bucket had no objects at the audit snapshot; this is not proof that backups now exist. |
| Pages project | `omnipoint-relay-lab` | Production branch is `never-production`; treat as a lab/preview, not a production backend. |
| Cloudflare Tunnel / Access | No remotely managed Tunnel or Access app was found during the audit | No tunnel is needed until an actual private origin/network service exists. |

## Data ownership boundaries

### OmniPoint business data
The authoritative operational database target is `omnipoint-prod`, subject to confirming schema ownership and application bindings before launch. Business domains should be separated by tables and service modules, not by creating another database for every feature:

- product catalogue, variants and stock movements
- sales, sale lines, returns and cost of goods
- cash drawer and daily close/reconciliation
- mobile-money agency transactions and float movements
- commissions, fees, expenses and ledger entries
- staff membership, roles and permissions
- payment intents, provider references, callback/event receipts and reconciliation
- audit events and operational reports

Use database constraints and transactions for stock, cash, ledger, and transaction state changes. Record external provider events idempotently. Never treat a payment callback alone as proof of final settlement; verify provider signatures/status and reconcile.

### Otya identity and product data
Keep `otya-auth-db` and `otya-store-db` in their existing domains. Shared identity does not mean every product shares every table. Cross-service access must go through documented APIs/service bindings with authorization, rather than direct cross-database assumptions.

### Storage responsibilities
- **D1:** structured operational records and transactions.
- **R2:** media/releases, attachments and encrypted/private backup artifacts; never expose sensitive backup objects publicly.
- **KV:** cache/configuration and short-lived non-authoritative values, not the only record of a sale, payment, balance or stock quantity.
- **Queues/Workflows:** retryable notifications, provider callback processing, reconciliation jobs and other asynchronous tasks; design idempotency and dead-letter handling.
- **Analytics Engine:** aggregates/observability, not the ledger or source of truth.

## Service-to-service calls

Prefer Cloudflare Worker service bindings for internal Worker-to-Worker calls. Existing bindings from `otya-core` to `otya-auth` and `otya-next` already demonstrate this model. Cloudflare documents that service bindings can call another Worker without a publicly accessible URL: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/

A targeted review candidate is the account-deletion cleanup path in `auth-worker/src/secure-account.ts`, which currently uses a configured internal URL plus an internal secret to call product cleanup. Before changing it, verify the actual target Worker, its route and handler, test authorization and failure behaviour, and add safe tests. Preserve the current fail-safe behaviour: if cleanup fails, do not silently report full deletion. Do not change production bindings/secrets as part of this documentation decision.

## Tunnel and physical-server decision

**Do not create a Cloudflare Tunnel now.** A Tunnel is appropriate when Otya needs private access to an actual origin such as an on-premises shop server, private LAN application, or other service not directly hosted on Workers. Since the shop has no purchased physical server and the core services are already on Cloudflare, a tunnel would add complexity without solving a current requirement. Reassess only when a real private origin is identified. See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

## Payments and external egress

Cloudflare Workers are the main application runtime. If Airtel requires a static public source IP, confirm that requirement with Airtel before building a fixed-egress relay. If required, evaluate the smallest secure AWS relay as an auxiliary outbound path only; do not move D1, website hosting, or core OmniPoint services to AWS. Use provider sandbox first, strict destination/path/method allowlists, authenticated service-to-service requests, replay protection, rate limits, redacted logs, and least-privilege permissions. Never log PINs, OTPs, full credentials, or payment secrets. No live money movement until sandbox verification and explicit owner approval.

## Required change gates

1. Enable Cloudflare account MFA and securely store recovery codes.
2. Establish and prove a D1 backup/export plus isolated restore procedure; the existing script/runbook is not proof that a backup has run.
3. Reconcile schema/migration history between `omnipoint-prod` and `omnipoint-migration-test`; do not copy test rows into production blindly.
4. Verify actual bindings and migration state against the checked-in source before changing database ownership.
5. Add safe, repeatable tests for internal service calls and critical shop ledger/stock/payment state transitions.
6. Use an isolated preview backed by non-production data and credentials; never point a public preview at live payment execution.
7. Require explicit approval for DNS changes, secrets, migrations, resource creation/deletion, production deployments, and live payments.

## Documentation precedence

This current-state map supersedes older handoff statements that call the live Workers `otya-store` and `otya-ai`. Those are legacy/logical names in older documentation, not the live Worker names observed in the 2026-10-27 account audit. Keep older documents for historical context until each is reviewed and corrected. Do not infer that old names are aliases for live services without checking the relevant config and runtime state.
