# Otya Evolution — Upgrade and Service Selection Roadmap

**Date:** 2026-10-27  
**Status:** Proposed roadmap based on the initial repository/resource inventory  
**Change policy:** Planning only. No production deployment, DNS, secrets, destructive migration, or live payment changes are authorized by this document.

## Mission

Continuously improve every part of the Otya ecosystem where measurable benefits justify the change. Prefer secure, maintainable, fast, interoperable, affordable services. Avoid migrations that add complexity without a clear advantage.

## Decision rules for every component

Score candidate changes against:
1. Security and privacy.
2. Reliability, recovery, and data integrity.
3. Performance and user experience on low-bandwidth/mobile connections.
4. Total cost, including usage limits and operational effort.
5. Ease of maintenance and availability of skills.
6. Interoperability and avoidance of vendor lock-in.
7. Migration risk and ability to roll back.
8. Actual fit for the workload.

Do not switch solely because a service is new, fashionable, or offers more features. Prefer an incremental proof-of-concept and measured comparison before replacement.

## Recommended target architecture

### Otya Server — control plane and shared services
- Keep the existing production Worker and its routes until replacements are proven.
- Define versioned API contracts, service ownership, request IDs, consistent errors, rate limits, and observability.
- Reuse Cloudflare service bindings for Worker-to-Worker calls where appropriate rather than adding unnecessary public network hops.
- Keep shared identity separate from each product's local authorization and business data.

### OmniPoint — business operations
- Keep its own dedicated database and company/branch data boundaries.
- Use D1 for operational relational data where its limits, consistency, query patterns, and transaction behavior meet requirements.
- Use R2 for private receipts, documents, exports, and backup artifacts with access controls and retention rules.
- Use Queues for retryable asynchronous jobs; use Workflows for durable multi-step jobs; use Durable Objects only for coordination/stateful workloads that need them.
- Use KV only for reconstructable cache/configuration, never as the authoritative financial ledger.
- Keep retail and agency ledgers separate, with database-enforced invariants, idempotency, immutable audit history, reconciliation, and explicit reversal flows.
- Keep payment-provider execution disabled until contracts, credentials, signatures/callback verification, idempotency, reconciliation, compliance, and end-to-end tests are approved.

### Language and application strategy
- Python/FastAPI: preferred for new backend modules where Cloudflare Python Worker compatibility and measured performance are satisfactory.
- Existing JavaScript/TypeScript Workers: keep where stable; use TypeScript for Cloudflare-specific edge logic when it is simpler or better supported.
- Next.js/frontend: preserve the current dashboard until the Cloudflare-hosted alternative has feature parity and passes accessibility, mobile, security, and performance tests.
- Flutter/Dart: retain for Otya Media and native mobile capabilities.
- Do not rewrite a component merely to make all source code use one language.

### Data and migration
- Identify the canonical data source per domain and environment.
- Never dual-write financial records across old and new databases.
- Before cutover, compare schemas, row counts, totals, constraints, and business invariants; run an isolated restore test; define rollback; then obtain explicit production approval.
- Never delete a legacy database or provider project just because a new database exists.

## Service improvement matrix

| Area | Preferred direction | What may be better than today | Gate before adoption |
|---|---|---|---|
| Compute/API | Existing Cloudflare Workers; Python Workers for suitable new modules | Consolidated edge runtime, bindings, simpler operations | Runtime compatibility, tests, latency/load tests |
| Database | Dedicated D1 per product/data boundary where suitable | Fewer vendors, native Worker bindings, simpler billing | Schema parity, transaction/concurrency tests, capacity review, restore drill |
| Files/backups | R2 with private access and retention | Cost-effective object storage and no egress fee | Access policy, encryption posture, retention and restore proof |
| Background work | Queues + Workflows based on job shape | Retryable jobs without blocking user requests | Idempotent consumers, retry/dead-letter behavior, observability |
| Stateful coordination | Durable Objects only when required | Consistent per-entity coordination/realtime | Demonstrate need; load and recovery test |
| Authentication | Existing Otya Auth only after contract/security verification | Shared sign-in without duplicating credentials | Token issuer/audience/expiry verification, session lifecycle, recovery, rate limits, local role mapping |
| Email | Existing approved email provider integration only if it fits | Transactional mail, verification and alerts | Delivery logs, bounce/complaint handling, domain authentication, secrets review |
| CI/CD | GitHub Actions with least privilege and protected environments | Repeatable tests and releases | Branch protections, pinned action SHAs, OIDC where supported, no production deploy on untrusted PRs |
| Security | Automated dependency checks, static analysis, secret scanning, authorization tests | Earlier detection of regressions | Findings triaged; no exposed secrets; high-risk failures block release |
| Observability | Cloudflare Workers observability + structured app logs/metrics | Easier incident diagnosis | Redaction of secrets/PII, useful alerts, retention/cost controls |
| Frontend hosting | Prefer Cloudflare for the target when feature parity is proven | Reduce provider sprawl | Verify Next.js/SSR, image, caching, preview, rollback and runtime compatibility |
| Mobile apps | Flutter/Dart for Otya Media; native wrappers only when needed | Preserve native media/offline features | Regression, crash, performance and release tests |
| Payments | Provider adapters behind a disabled-by-default interface | Easier partner replacement and fault isolation | Partner approval, signed callbacks, idempotency, reconciliation, sandbox and explicit live approval |
| AI/automation | Add only for a defined user task; Cloudflare AI or external model evaluated case by case | Useful support, search, document automation | Privacy, cost, evaluation, abuse controls and human override |
| Documentation | Versioned ecosystem contract and architecture records in GitHub | Easier onboarding and fewer conflicting instructions | Owner and review date per contract |

## What should be investigated first

1. **OmniPoint source of truth and legacy dependencies:** the dashboard still has PostgreSQL/Prisma/Supabase paths while Cloudflare D1 and a migration API also exist. Map all reads/writes and identify the canonical store before removing anything.
2. **Authentication and staff provisioning:** ensure Otya identity tokens are verified server-side and mapped to active company/branch-scoped staff records.
3. **D1 schema parity and business invariants:** verify migrations, unique constraints, foreign keys, stock concurrency, ledger balancing, audit logging, idempotency, and reconciliation.
4. **Backups and recovery:** prove that backups can be restored into an isolated environment and that the recovered data passes invariants.
5. **Dashboard/API integration:** define contracts and connect a read-only view first, then controlled writes after tests.
6. **Python foundation:** run tests and lint, validate runtime compatibility, and add integration tests before any data binding is introduced.
7. **Otya Server shared architecture:** inventory service bindings, ownership, health contracts, failure modes, route ownership, and release process.
8. **CI/CD and supply-chain security:** test all repositories, pin actions to immutable commit SHAs, minimize workflow permissions, use protected environments and OIDC for cloud access where supported.
9. **Performance and cost baselines:** measure cold-start/latency, database queries, bundle size, error rates, request volumes, storage and usage before choosing upgrades.
10. **Otya Media and OtyaHub:** review crash reports, build/release pipeline, dependency health, documentation freshness, public information exposure, and consistency with Otya naming.

## Phased execution

### Phase A — Discover and measure
- Inventory all repositories, branches, workflows, Worker scripts, bindings, schemas, routes, domains, providers and external dependencies.
- Classify resources as production, preview, test, legacy, or unknown.
- Establish performance, reliability, cost and security baselines.
- Produce a dependency map and a keep/upgrade/replace/retire decision for every component.

### Phase B — Fix critical foundations
- Close critical security gaps and eliminate accidental public access.
- Verify identity and authorization.
- Add automated tests and release gates.
- Prove backup/restore and rollback.
- Fix data integrity risks before feature expansion.

### Phase C — Improve one vertical slice at a time
- Complete one OmniPoint read-only dashboard/API flow.
- Complete a controlled product/inventory workflow.
- Complete sales and ledger invariants in an isolated environment.
- Add reporting and reconciliation.
- Keep live payment execution disabled until its independent readiness gate passes.

### Phase D — Migrate or replace where evidence supports it
- Move suitable backend modules to Python only after comparison.
- Move frontend hosting only after parity and rollback are proven.
- Remove obsolete providers/dependencies only after traffic, data, and rollback are verified.
- Consolidate duplicate services and retire unused resources only with explicit approval.

### Phase E — Operate and improve
- Monitor service-level indicators, errors, security findings, cost and user experience.
- Schedule dependency updates and recovery drills.
- Reassess architecture when measured usage or requirements change.

## Release gates

A change is not ready merely because it builds. Require:
- Automated unit, integration, contract, authorization, and migration tests appropriate to the change.
- Security review and secret/PII-safe logging.
- Load/concurrency tests for critical business operations.
- Backup and restore evidence for data-affecting changes.
- Staging/preview verification and a rollback plan.
- Explicit approval before production deploy, DNS change, secrets change, destructive migration, or live payment activation.

## Out of scope without approval

- Production deployments or route/DNS changes.
- Secret rotation or modification.
- Destructive data changes, legacy project deletion, or production schema migrations.
- Enabling payment provider execution or processing live transactions.
- Paid service upgrades or new paid vendors.

## Success criteria

The ecosystem should have one clear owner for each capability and data domain; fewer duplicate implementations; tested security and recovery; consistent APIs; observable failures; lower avoidable complexity/cost; and documented, reversible releases. Every service replacement must show a measurable improvement over the existing implementation.
