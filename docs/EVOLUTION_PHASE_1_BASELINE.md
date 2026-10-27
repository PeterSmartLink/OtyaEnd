# Otya Evolution — Phase 1 Baseline

**Status:** Initial read-only inventory completed on 2026-10-27  
**Scope:** Repository/configuration and Cloudflare resource metadata/schema inventory  
**Safety:** No production resources, DNS, secrets, deployments, payment providers, or business records were modified. Database inspection used read-only SQLite catalog queries only. This document is an engineering baseline, not a production-readiness certification.

## Executive decision

Evolve the existing Otya ecosystem in place. Do not replace Otya Server with a new Python-only server and do not rewrite the existing applications solely to standardize languages.

- Keep the current Otya Server production Worker and its existing routes intact.
- Use Python/FastAPI for new backend modules only after the isolated foundation passes runtime, security, compatibility, and performance checks.
- Keep existing JS/MJS and Next.js where they are already responsible for production surfaces.
- Keep Otya Media in Flutter/Dart.
- Keep GitHub as source of truth and Cloudflare as the preferred infrastructure.
- Do not use Supabase/Appwrite/Vercel as new target dependencies. Remove legacy runtime dependencies only after the replacement is proven and cutover is explicitly approved.
- Never dual-write financial records to old and new data stores.

## Confirmed repository inventory

### Otya Server

- Repository: `PeterSmartLink/Otya-Server`
- Default branch: `main`
- Production Worker configured as `otya-core`, entry point `src/production-router.mjs`.
- The existing Wrangler configuration includes custom-domain routes for the existing website, docs, status, and account/product space.
- Existing configuration references D1, R2, KV, Queues, Analytics Engine, a Workflow, and service bindings to `otya-auth` and `otya-next`.
- Existing frontend build uses Next.js/React and OpenNext for Cloudflare.
- **Decision:** Do not change the production entry point, routes, bindings, or deploy settings as part of the initial evolution work.

### OmniPoint

- Repository: `PeterSmartLink/OmniPoint`
- Existing dashboard uses Next.js/React.
- Existing application dependencies still include Supabase SSR/client packages and Prisma configured for PostgreSQL.
- Existing `wrangler.toml` defines a separate Worker, `omnipoint-migration-api`, bound to the isolated `omnipoint-migration-test` D1 database.
- Cloudflare also contains an `omnipoint-prod` D1 database. Its schema catalog includes retail products/sales/lines, stock movements, agency transactions, ledger entries, audit events, staff memberships, and reconciliation sessions.
- The migration-test D1 schema contains corresponding business tables and additional migration/auth-related tables.
- **Important:** Schema presence does not prove the app is connected to the intended database, that the data is complete, or that the system is production-ready. No business rows were read in this inventory.
- **Decision:** Treat the existing production database as protected. Confirm the canonical data source, schema parity, constraints, backups, and restoration before any cutover or dependency removal.

### Otya Media

- Repository: `PeterSmartLink/OtyaPlayer`
- Flutter/Dart application with native Android integration and local-first media capabilities.
- **Decision:** Continue with Flutter/Dart; backend language standardization must not trigger a media-player rewrite.

### OtyaHub

- Repository: `PeterSmartLink/OtyaHub`
- Public developer/product hub with documentation, security policy, release/status references, and public-safe automation.
- **Decision:** Keep public-safe documentation and developer guidance here; do not publish internal infrastructure details or secrets.

## Cloudflare resource inventory (metadata only)

The connected Cloudflare account was readable. Resource listing showed:
- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1 databases: `omnipoint-prod`, `omnipoint-migration-test`, `otya-auth-db`, `otya-store-db`.
- R2 buckets: `omnipoint-backups`, `omnipoint-private`, `otya-assets`, `otya-player-releases`.

This list is a point-in-time inventory, not a guarantee that each resource is correctly secured, used, backed up, or within a free allowance. Binding and access policies still need separate review. No secrets or business records were read.

## Priority risks and gaps

1. **Canonical data source and migration state:** the repository still contains PostgreSQL/Prisma/Supabase runtime paths while Cloudflare D1 resources and a migration Worker also exist. Document source-of-truth ownership before any migration or dependency removal.
2. **Production/test separation:** validate every Worker binding and deployment environment; ensure the migration API remains bound only to the intended test database until explicitly approved.
3. **Identity and authorization:** inspect existing shared identity and OmniPoint staff authorization; prove tenant/business scoping, least privilege, session protection, and sensitive-action approval.
4. **Financial correctness:** verify schema constraints and service logic for idempotency, ledger balancing, stock movements, reversals, reconciliation, audit history, and provider callback verification.
5. **Recovery:** verify backup contents, retention, access controls, and a tested restore process. The presence of a backup bucket alone is not proof of recoverability.
6. **Python runtime:** execute the isolated foundation's tests and lint, validate Cloudflare Python Workers/FastAPI compatibility, and add runtime/integration tests before connecting it to any real business data.
7. **Observability and delivery:** check automated tests, dependency/security scanning, deployment permissions, rollback procedure, error reporting, and release approvals.

## Next implementation sequence

1. Review the OmniPoint Worker source, D1 migrations, authentication and authorization, and the current dashboard/API contract.
2. Compare the production and migration-test schemas without reading business rows; produce a schema parity and migration status report.
3. Run the isolated Python foundation tests and runtime validation; fix failures in the isolated branch.
4. Define stable API contracts before connecting the dashboard to any replacement API.
5. Implement and test one low-risk read-only module first, then business operations with audit and transaction safeguards.
6. Plan legacy dependency retirement only after verified migration, backup/restore, cutover, and rollback gates.
7. Prepare a deployment plan for review. Production deployment, DNS/secrets changes, destructive migration, and live payment execution remain approval-gated.

## Definition of done for Phase 1

- [ ] Existing app entry points and production routes documented.
- [ ] Canonical source of truth identified for each data domain.
- [ ] Production and test bindings independently verified.
- [ ] Schema parity and migration status documented.
- [ ] Python foundation tests and runtime compatibility checks pass.
- [ ] Auth, financial invariants, backup/restore, monitoring, and rollback gaps have owners and acceptance tests.
- [ ] No production or live-payment changes made without explicit approval.
