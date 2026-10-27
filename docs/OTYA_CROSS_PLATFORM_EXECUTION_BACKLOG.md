# Otya Ecosystem Evolution — Cross-Platform Execution Backlog

**Updated:** 2026-10-27  
**Branch:** chore/python-first-ecosystem-plan  
**Status:** implementation backlog and safety gates; no production cutover authorized.

## Product-wide objective

Evolve every existing Otya product and service where a measurable improvement in security, reliability, usability, performance, maintainability or cost is possible. Preserve working assets and data; do not rewrite components solely to standardize languages.

## Cross-platform rule: Next.js, mobile web, Android

- Next.js is the responsive web application and may also be made installable as a PWA when browser capabilities satisfy the use case.
- A Next.js app alone is not a native Android APK. If native device APIs, dependable background work, managed offline behavior, camera/scanner integration or device-specific workflows justify it, use an existing Android app or a dedicated Flutter/native Android client.
- Web and Android must call the same versioned backend API. They must not independently implement business authorization, ledger rules or provider success decisions.
- Reuse existing source before creating another app. Current read-only search did not confirm a dedicated OmniPoint Android repository; search the available organization/repositories and branches again before choosing a client.
- Otya Media remains its own product and must not be repurposed as OmniPoint.

## Initial evidence from read-only inspection

1. PeterSmartLink/OmniPoint has a Next.js dashboard and a separate Cloudflare Worker/D1 API path.
2. OmniPoint's README says the Worker API is not yet wired into the production dashboard and is not ready to execute live agency or bill-payment operations.
3. The API README documents inventory, stock adjustment, cash retail sale, summary and ledger endpoints. Agency transactions are deliberately disabled.
4. The Worker authenticates through Otya Auth and then checks local OmniPoint staff membership. Staff provisioning, dashboard integration and complete authorization/recovery testing remain gates.
5. The OmniPoint package still has legacy Prisma/Supabase dependencies. Target architecture is Cloudflare + GitHub; remove legacy runtime dependencies only after a tested API cutover and recovery verification.
6. PeterSmartLink/Otya-Server already uses Next.js, React, OpenNext/Cloudflare, TypeScript checks and Node tests. It has a deploy script that includes a D1 migration step; production deployment must not be triggered as part of this backlog.
7. No existing OmniPoint Android source was confirmed by the initial repository search. This is not proof that none exists; finish repository and branch inventory before creating a new client.

## Priority 0 — protect production and establish evidence

- Keep all work on isolated branches and use previews/test resources.
- Record repositories, branches, deployment targets, bindings, D1 schemas, R2 buckets, queues, API routes, CI workflows and ownership boundaries.
- Inspect existing changes before adding new overlapping migrations or apps.
- Never print secrets, provider credentials, session tokens or production business rows into logs or reports.
- Do not change production routes, DNS, secrets, databases, payment credentials, live providers or paid plans without explicit approval.
- Do not merge pull requests or deploy without explicit approval.

## Priority 1 — Otya Server foundation

- Audit auth issuer/audience/expiry/revocation, staff/session lifecycle, rate limits, CSRF/origin policy, security headers and secret handling.
- Publish versioned API contracts with consistent errors, request IDs, pagination and validation.
- Keep service bindings for internal Worker-to-Worker traffic where suitable.
- Add contract and integration tests for authentication failures, service unavailability and permission boundaries.
- Verify logging/alerts and backup/restore procedures without exposing private data.
- Keep the existing production entry point and routes until replacements pass parity and rollback checks.

## Priority 2 — OmniPoint shared business API

- Make the dedicated OmniPoint Worker the only proposed business API boundary.
- Verify every protected request uses verified identity plus active local staff membership, company/branch scope and server-side role authorization.
- Enforce idempotency for all retryable writes; make duplicate requests return a safe, deterministic outcome.
- Test stock underflow, cross-company access, sale atomicity, balanced retail ledger, immutable audit, duplicate receipt, reversal and concurrent requests.
- Keep agency transaction execution disabled until provider contracts, signed callbacks/status verification, idempotency, reconciliation, float/settlement ledgers, test credentials and explicit approval are complete.
- Keep the retail ledger separate from agency cash, float, provider settlement and commissions.
- Treat D1 as the candidate operational relational database only after schema parity, capacity, consistency, concurrency and restore gates pass.

## Priority 3 — Next.js web and installable mobile web

- Inventory existing routes and screens; map each business action to a backend contract.
- Preserve existing UI and branding where useful; improve navigation, touch targets, responsive layouts, accessibility, loading/error/empty states and low-bandwidth performance.
- Remove demo fixtures from any real-data path; demos must be clearly separated from authenticated business views.
- Replace direct legacy data-access calls with the approved API only after contract and authorization tests pass.
- Add PWA installation/offline shell only when it improves usability. Cache static assets and safe reference data, not authoritative financial records or private API responses.
- Test small-screen Android Chrome, desktop browsers, session expiry, network loss, duplicate submission and accessibility.

## Priority 4 — OmniPoint Android

- Search all accessible repositories/branches and existing build artifacts for an OmniPoint Android client before starting another.
- If a compatible client exists, extend it and keep package identity/signing continuity.
- If none exists, compare (a) responsive Next.js PWA, (b) Flutter Android app, and (c) native Android only against required device capabilities, support burden and delivery cost.
- For native/Flutter client: use secure platform storage for session credentials, minimal permissions, deep-link validation, clear session expiry, API timeouts, request IDs and retry-safe flows.
- Offline behavior may support cached read-only reference data and draft preparation. Never claim an unconfirmed sale, cash-in/out or bill payment succeeded.
- Test Android lifecycle/background-resume, intermittent network, duplicate taps, app updates, screen readers, small displays and supported OS/ABI matrix.

## Priority 5 — unified quality gates

Create reusable test scenarios that run against the shared API and are exercised from both web and Android:
- Login, logout, expired/revoked session and inactive staff.
- Role escalation attempts and cross-company/branch access.
- Product create/edit/deactivate and stock adjustment with reason.
- Sale with multiple lines, insufficient stock, concurrent sale and duplicate idempotency key.
- Receipt integrity and report totals.
- Provider timeout/unknown state, duplicate callback and reversal using a sandbox or deterministic mock only.
- Backup export/checksum, restore and reconciliation.
- Accessibility, low-bandwidth performance, API error recovery and mobile layout.

Require CI checks for formatting/lint, type-check, unit/contract/integration tests, schema validation, dependency/security scanning and build artifacts. Pin action dependencies and minimize workflow permissions. Never place production credentials in build-time client bundles.

## Priority 6 — service selection and modernization

- Prefer Cloudflare Workers, D1, R2, Queues, Workflows, KV and Durable Objects where their workload fit is demonstrated; don't enable every product without need.
- Python is a preferred option for new backend modules where Cloudflare compatibility, latency and maintainability test well. Keep stable TypeScript/JavaScript Workers where they are the safer choice.
- Keep Flutter/Dart for existing Otya Media and any approved native Android application.
- Evaluate observability, uptime/health checks, security scanning, backup automation and release artifact integrity.
- Do not add Supabase, Appwrite or Vercel to the target OmniPoint architecture. Legacy references may remain temporarily for recovery until cutover has been proven and approved.
- Every proposed replacement must state the current problem, alternatives, measurable acceptance criteria, cost impact, migration method and rollback path.

## Release criteria

A component is not complete because it compiles or a health endpoint returns 200. It must pass applicable security, authorization, business invariants, contract tests, browser/device tests, recovery tests, observability and rollback review.

Production data migration, DNS or secret changes, deployment, destructive deletion, live payment activation, paid plan changes and PR merge remain explicit-approval gates.
