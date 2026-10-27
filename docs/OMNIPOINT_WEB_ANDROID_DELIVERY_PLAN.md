# OmniPoint Cross-Platform Delivery Plan: Web + Android

**Date:** 2026-10-27  
**Status:** Active planning and read-only inventory; implementation/deployment not yet authorized.  
**Product owner:** Otya Hold Ltd T/A OmniPoint.

## Non-negotiable product requirement

OmniPoint must work as one business system across:
1. **Web workspace** for management, inventory, reporting, reconciliation and administrative tasks.
2. **Android app** for the shop counter and agent workflows, optimized for touch, small screens, intermittent connectivity and safe retry behavior.
3. **One shared API and business data authority** so web and Android see the same authorized stock, sales, staff permissions, audit history and reconciled balances. The clients must never maintain separate financial truths.

This is OmniPoint for the owner's own business/shop. Do not expand scope into a general public marketplace unless explicitly requested.

## What the current repository inventory confirms

- The OmniPoint repository contains a responsive Next.js web dashboard and a separate Cloudflare Worker/D1 API implementation.
- The repository README says the Cloudflare API is not yet connected to the production dashboard and must not be treated as ready for mobile-money or bill-payment execution.
- Existing web app dependencies still include Prisma/PostgreSQL/Supabase paths. These are legacy/recovery dependencies during transition, not permission to create a second live writer. Target direction remains GitHub + Cloudflare; do not add Supabase, Appwrite or Vercel to the target architecture.
- Repository search did not confirm an OmniPoint-specific Android application source. Before building another app, inspect all available repositories/branches and locate any existing Android work. If no existing OmniPoint client exists, propose an Android client reusing the shared API rather than duplicating backend/business logic.
- Otya Media is a separate Flutter/Dart product and must not be repurposed as the OmniPoint app.

## Target architecture

- **Web client:** preserve the existing Next.js dashboard initially; connect it only to versioned, authenticated OmniPoint API routes after contract and authorization tests pass.
- **Android client:** native Android or Flutter only after locating existing code and comparing delivery/maintenance costs. Prefer reusing an existing compatible client. It must use the same API contracts and authorization rules as web.
- **Backend:** the dedicated OmniPoint Cloudflare Worker/API is the business boundary; Otya Auth may verify identity, but OmniPoint must independently check active staff membership, company/branch scope and role on every protected operation.
- **Data:** D1 is the intended operational relational store only after schema parity, constraints, concurrency and restore tests pass. R2 holds private files/receipts/exports/backups; KV is cache-only; Queues/Workflows handle retryable background jobs. Never store authoritative financial ledger state in cache.
- **Offline mode:** clients may cache safe reference data and queue eligible non-financial drafts. They must not claim a sale, cash-in, cash-out, bill payment or provider transaction succeeded until the server/provider confirms it. Financial actions require idempotency keys, explicit pending/unknown states and reconciliation.
- **Provider integrations:** Airtel, MTN and Interswitch/Quickteller adapters remain disabled until provider contracts, credential storage, signatures/callbacks, idempotency, status polling, reconciliation, sandbox tests and explicit approval are complete.

## Shared capability map

| Capability | Web | Android | Shared backend requirement |
|---|---|---|---|
| Sign-in and staff access | Yes | Yes | Otya Auth verification + OmniPoint local membership/role check |
| Products and stock | Full management | Fast search/view; authorized adjustments | Company/branch scope, stock invariants, audit |
| Retail POS | Full workflow | Counter-optimized workflow | Atomic sale/lines/stock/ledger/audit and idempotency |
| Receipts | View/export/print | Display/share/print where supported | Stable receipt record; private document storage if needed |
| Mobile-money agency | Management/reconciliation | Agent cash-in/out workflow | Provider-confirmed states, float ledger, idempotency, reversal and reconciliation |
| Airtime/data/bills | Management and status | Customer-facing counter workflow | Provider adapter contract; no success until verified |
| Reports | Rich management reports | Key summaries and shift status | Same authorized source and time/currency definitions |
| Audit and approvals | Review/approve where role permits | Show required confirmations | Server-generated audit events and role checks |
| Connectivity recovery | Retry-safe UI | Offline-aware, low-bandwidth UI | Request IDs, idempotency, explicit pending/unknown outcomes |

## Build and verification gates

1. **Inventory:** identify the canonical web app, any existing OmniPoint Android repository, active branches, package IDs, CI workflows and release artifacts. Read-only only.
2. **API contract:** document endpoints, schemas, error envelope, auth flow, pagination, request IDs and idempotency behavior; use contract tests shared by both clients.
3. **Security:** test expired/invalid tokens, inactive staff, role escalation, cross-company and cross-branch access, request size limits, rate limits and audit coverage.
4. **Business invariants:** test stock underflow prevention, atomic sale posting, balanced retail ledger, separate agency ledger, duplicate request handling, reversal and reconciliation behavior.
5. **Web integration:** wire the web client to the API in a non-production preview only after contracts pass; remove any assumption that browser role claims are authoritative.
6. **Android integration:** connect the existing or approved Android client to the same API; test session expiry, network loss, retry behavior, app background/resume, small-screen accessibility and device compatibility.
7. **End-to-end parity:** run the same scenarios from web and Android and verify one consistent result in the isolated environment.
8. **Recovery:** prove backup integrity and restore, migration reconciliation and rollback before any data cutover.
9. **Release:** build artifacts, dependency/security checks, smoke tests, staged rollout and monitored rollback plan. Production deployment, DNS/secrets changes, destructive migrations and live payments require explicit approval.

## First implementation sequence

- Complete a read-only repository/branch inventory and locate any OmniPoint Android source.
- Inspect the existing web app's authentication/data-access paths and map each screen to API endpoints.
- Inspect the Worker routes and D1 schemas, then define a versioned API contract and a shared contract-test suite.
- Fix authorization, idempotency, stock/ledger atomicity, observability and recovery gaps before connecting both clients.
- Connect web and Android incrementally to the same API in an isolated preview.
- Do not remove legacy dependencies/data until ownership, exports, restore, business invariants and rollback have been verified and approved.

## Change safety

No production deployment, production data reads/writes, DNS or secret changes, database migration, deletion of legacy resources, provider activation, live transaction, paid plan or PR merge is authorized by this plan. Preserve existing source, data and resources until the replacement is verified and an explicit cutover is approved.
