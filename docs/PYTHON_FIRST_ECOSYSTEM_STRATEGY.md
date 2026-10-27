# Python-First Otya Ecosystem Strategy

Status: proposal and implementation plan only. This document does not authorize production deployment, DNS changes, secret changes, data migration, PR merging, or live payment execution.

## Goal

Make Otya Server the central control plane and API foundation for Otya products. Prefer Python for new backend business logic, automation, tests, migration validation, and integrations. Keep GitHub and Cloudflare as the approved infrastructure. Do not introduce Supabase, Appwrite, or Vercel as new dependencies.

## Verified repository starting point

- `PeterSmartLink/Otya-Server`: shared Otya backend and Cloudflare Worker-based infrastructure; contains identity, account, recovery, notifications, release delivery, and future product APIs.
- `PeterSmartLink/OmniPoint`: existing Next.js dashboard plus a separate Cloudflare Worker/D1 migration path. Its README says the D1 schema has been applied only to an isolated migration-test database and the new API is not yet connected to the dashboard.
- `PeterSmartLink/OtyaHub`: public developer and documentation hub.
- `PeterSmartLink/OtyaPlayer`: existing Flutter/Dart player; preserve its native/mobile architecture rather than rewriting it in Python.
- `PeterSmartLink/Next`: inspect before deciding its relationship to Otya Server; do not assume it should be merged.

## Runtime strategy

Cloudflare now supports Python Workers, including FastAPI and Pydantic, with bindings to D1, R2, KV, Queues, Workflows, secrets, and service bindings. Start with a small Python Worker proof of compatibility before moving business routes. Check package compatibility and CPU/memory/request constraints before adopting dependencies.

Prefer Python for:
- new backend route handlers and domain services where supported by Python Workers;
- retail, inventory, cash-operation, reconciliation, and reporting rules;
- validation, test fixtures, migration comparison, backup verification, and safe developer tools;
- provider adapters and webhook validation, initially in disabled/sandbox-only mode.

Keep existing JavaScript/TypeScript Workers where already stable, or where a required runtime feature/library is not yet suitable in Python. Connect services through versioned internal APIs/service bindings rather than forcing a risky rewrite. Do not deploy either runtime as part of this plan.

## System boundaries

- **Otya Server:** shared identity integration, API gateway/control plane, service registry, audit/security conventions, notifications and shared platform APIs.
- **OmniPoint:** isolated business data and permissions for the owner's shop. D1 is the intended operational relational store; R2 for private receipts/documents/exports; KV only for reconstructable short-lived state; Queues/Workflows for retryable background work.
- **Otya OS:** unified admin/product experience consuming versioned Otya APIs; not a second backend or database.
- **Otya Media:** Flutter/Dart product using shared identity only for features that need it; core local playback must continue to work without account access.
- **OtyaHub:** public docs, safe examples, SDK contracts, release notes and security-reporting guidance only.

Shared identity does not mean shared business tables. OmniPoint staff roles and permissions must be checked server-side against an active OmniPoint membership. Browser-supplied role claims are never authoritative.

## OmniPoint financial safety

Keep separate ledgers for retail sales/cost of goods and agency cash/float/provider settlement/commissions. Use idempotency keys, audit records, balanced ledger checks, concurrency tests, and explicit transaction states. Never label a mobile-money, airtime, or bill-payment transaction successful until a verified provider status confirms it. Keep provider execution disabled until partner approval, credentials, callback verification, reconciliation, and end-to-end sandbox tests pass.

Do not dual-write financial records to two databases. Treat any legacy PostgreSQL/Supabase records as a legacy/recovery source during transition, not a second live writer. Do not delete that source or migrate production records without a separately approved, verified cutover plan.

## Required delivery gates

1. Inventory repositories, branches, CI, Cloudflare bindings, D1 databases, R2 buckets, KV namespaces, queues, routes, and current auth dependencies; redact secrets from all reports.
2. Run a minimal Python Worker + FastAPI + D1 binding proof in an isolated environment and verify tests, logs, and package compatibility.
3. Define API contracts and shared error/auth/audit conventions before connecting products.
4. Implement and test domain services with synthetic fixtures; no production data is needed for unit tests.
5. Connect OmniPoint UI to the isolated API and prove server-side staff membership/role enforcement.
6. Test POS posting, stock guards, ledger balance, idempotency, concurrent requests, failure rollback, audit logging, and offline/uncertain transaction states.
7. Prove encrypted/private backup and an isolated restore; current backup objects must not be assumed valid until restore is demonstrated.
8. Verify 2FA, least-privilege access, secret rotation procedures, alerting, rate limits, dependency scanning, and incident/recovery runbooks.
9. Obtain explicit approval for any production migration, secret change, DNS change, deployment, PR merge, or live payment operation.

## Immediate implementation sequence

- First: repository and Cloudflare inventory plus a dependency map.
- Second: Python Worker proof-of-compatibility in a new isolated branch/environment.
- Third: agree on versioned API contracts between Otya Server and OmniPoint.
- Fourth: build and test Python domain modules, starting with inventory and retail POS before financial-provider execution.
- Fifth: connect the dashboard to the isolated API; retain current production routes unchanged.
- Sixth: run backup/restore and release-gate tests; present evidence before asking for production approval.

## Definition of done

The ecosystem is not considered fixed merely because a build passes. Each product must have an identified owner, API contract, authoritative data store, auth boundary, tests, backup/restore evidence, observability, documented recovery path, and a clear release gate. No production readiness claim is made until the relevant checks have passed.
