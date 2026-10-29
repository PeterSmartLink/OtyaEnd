# Otya Ecosystem Backend Foundation
Status: proposed architecture, review required. Date: 2026-10-29.

## Purpose
Prepare the shared backend before adding more product features. One connected ecosystem means shared identity, security, service contracts, data boundaries, operations and recovery—not one giant application or one shared database.

## Canonical identity
- Otya Hold Ltd: parent company.
- Otya OS: unified platform.
- Otya Server: shared backend/infrastructure.
- OtyaPoint: shop and retail/agency application.
- Otya Media: media player.
- OtyaHub: public developer/partner community.
Legacy repository/resource names may remain during migration. Do not rename or delete resources as a cleanup shortcut.

## Architecture rules
1. GitHub + Cloudflare is the default foundation: Workers for APIs, D1 for relational application data, R2 for private objects/backups, Queues for asynchronous jobs, KV for suitable cache/configuration, and Durable Objects only when coordination needs justify them.
2. Do not introduce Supabase, Appwrite or Vercel into OtyaPoint runtime without explicit owner approval.
3. Each product owns its business data. Share identity and versioned contracts, not all tables.
4. Otya Auth owns identity. Each application separately checks active membership, role, tenant/company and resource scope. A valid global login does not grant universal access.
5. Fail closed on missing/invalid identity, ambiguous authorization or unknown financial outcomes.
6. Financial writes must be atomic and auditable. Sales, stock movements, ledger postings, idempotency records and audit events must commit together or fail together. Corrections use explicit reversals.
7. Backups are not proven until restored into an isolated target and checked.
8. Preview environments use separate data, credentials, queues and provider configuration. No live financial side effects in tests.
9. Use reviewed GitHub pull requests, automated checks and explicit approval for production changes.

## Logical topology
Clients (Otya OS, OtyaPoint, Otya Media)
→ Cloudflare edge / API Workers
→ Otya Auth verification + service-specific authorization
→ bounded product services and product-owned D1 data
→ R2 private files/backups and Queues for durable asynchronous jobs
→ structured logs, health checks, security audit and restore verification.

This is a target diagram in words, not a claim that all services are deployed or correctly bound today.

## Existing inventory to verify
A prior read-only snapshot observed Workers `otya-auth`, `otya-core`, `otya-next`; D1 databases `otya-auth-db`, `otya-store-db`, `omnipoint-dev`; R2 buckets `otya-assets`, `otya-player-releases`, `omnipoint-dev-private`, `omnipoint-dev-backups`; queues for Otya Next, push, release events and OmniPoint development; Pages project `omnipoint-relay-lab`; and zone `petersmartlink.com`. This snapshot does not prove current health, ownership, bindings, data contents or recoverability. Re-query live resources before changes.

## Shared capabilities
- Identity contract: issuer, audience, expiry, subject and required claims are validated; local membership and roles are checked by each service.
- Service registry: canonical name, legacy names, owner, API version, authentication/scopes, data owner, environment, bindings, health checks, dependencies and recovery instructions.
- API conventions: versioned contracts, consistent errors, request IDs, validation, pagination, rate limits and idempotency for retryable writes.
- Async jobs: retries/backoff, idempotent consumers, dead-letter queues, authorized replay and durable event handoff.
- Data boundaries: tenant/company scoping, ordered migrations, append-only audit events, retention and export/restore path.
- Recovery: define recovery point/time objectives with the owner; protect backups; verify checksum and isolated restore; record evidence.
- Observability: structured logs, correlation IDs, service health, errors and queue depth without exposing secrets or sensitive payloads.
- Integrations: provider-neutral interfaces and separate adapters; sandbox by default; timeouts, reconciliation, idempotency and reversal semantics before any live enablement.

## Phased implementation and exit gates
### Phase 0 — Inventory
Recheck repositories, workflows, live Workers/D1/R2/Queues and bindings read-only. Assign owners and status to every resource. Exit: no unexplained production binding or ambiguous data ownership.
### Phase 1 — Contracts and security
Specify token verification, service contracts, permissions, tenant scoping and negative authorization tests. Exit: invalid identity cannot access business data.
### Phase 2 — Data integrity and recovery
Complete OtyaPoint idempotency/concurrency/rollback tests, D1-compatible migration tests and isolated backup restore. Exit: financial invariants, tenant isolation and restore are demonstrated.
### Phase 3 — Operations
Standardize logs, health, rate limits, queue retry/DLQ, drift checks, incident and rollback procedures. Exit: failures are observable and recovery is tested.
### Phase 4 — Product integration
Connect existing clients to reviewed APIs while preserving functionality. Add integrations in sandbox only. Exit: end-to-end private preview passes security, correctness and recovery checks.
### Phase 5 — Production review
Review exact diff, bindings, access, migration, backup evidence, monitoring and rollback; obtain explicit approval before production deployment or any live financial capability.

## Known gaps to recheck
Earlier OtyaPoint documentation said the dashboard still has legacy Supabase/Prisma paths and is not connected to the Cloudflare API, while backup restore, staff provisioning, token contract tests and financial route-level tests remain incomplete. Recheck current source and live state before treating those statements as current.

## Definition of done
The registry matches verified resources; auth and authorization tests pass; data ownership and tenant boundaries are enforced; financial operations are atomic and idempotent; isolated restore succeeds; monitoring and rollback are tested; and production changes receive explicit approval.

Current status: proposed blueprint only. Implementation and evidence gates remain open.
