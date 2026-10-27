# Cloudflare Continuity Audit — 2026-10-27

## Scope and safety

This was a read-only audit of the connected Cloudflare account. No DNS, Worker configuration, secrets, database contents, payment settings, deployments, or production resources were changed. Findings are an operational snapshot and should be rechecked before any migration.

## Executive summary

Otya Server already has active Cloudflare infrastructure, but domain replacement is not yet proven as a recovery procedure. The existing Workers and services are tied to the current domain in configuration, and the private backup bucket currently has no listed objects.

## Findings

### Domain and routing
- The current zone is `petersmartlink.com`.
- Cloudflare lists custom domains `petersmartlink.com`, `www.petersmartlink.com`, `docs.petersmartlink.com`, `status.petersmartlink.com`, and `space.petersmartlink.com` attached to Worker `otya-core`.
- Zone Worker Routes API returned no routes; custom Worker Domains are configured separately and are present.
- The account Workers subdomain is `petersmartlink.workers.dev`, but subdomain access is disabled for `otya-auth`, `otya-core`, and `otya-next`. Do not enable it blindly: review access controls and endpoint exposure first.
- Worker settings include current-domain references: `CORS_ORIGIN=https://petersmartlink.com`, Telegram callback `https://petersmartlink.com/api/auth/telegram/callback`, and `WEBSITE_URL=https://petersmartlink.com`. A replacement domain therefore needs a reviewed configuration/callback update and provider-side verification; DNS alone is insufficient.
- DNS also contains email-routing MX records, DKIM/SPF/DMARC records, an R2-backed `assets.petersmartlink.com` record, and other verification records. Preserve mail and verification records during any future domain change.

### D1 databases and data safety
- The D1 database-list metadata reports `num_tables: 0`, but read-only SQL queries against `sqlite_master` confirmed tables, indexes, and triggers exist. Treat the list metadata as stale/inconsistent; do not infer that these databases are empty.
- `omnipoint-prod` has the core OmniPoint business schema (products, stock movements, sales, sale lines, agency transactions, ledger entries, staff memberships, reconciliation sessions, audit events). The nine checked core tables currently have zero rows.
- `omnipoint-migration-test` contains test records in legacy/ORM-style tables, while the parallel `omni_*` tables checked have zero rows. The two schema families differ; reconcile migrations and application bindings before any migration or traffic switch.
- `otya-auth-db` contains existing user, linked-identity, user-product, and security-event records. `otya-store-db` contains existing product data including release/device records and migration history. These are not empty databases; preserve them.
- Cloudflare D1 Time Travel bookmarks are available for all four databases at audit time. A bookmark is not proof of a separate export, independent backup, or tested restore.

### R2 backups and artifacts
- R2 buckets present: `omnipoint-backups`, `omnipoint-private`, `otya-assets`, and `otya-player-releases`.
- Object listing returned no objects in `omnipoint-backups` or `omnipoint-private` at audit time. The assets and player-release buckets do contain files.
- No custom lifecycle rules beyond the default incomplete-multipart-upload cleanup rule were returned. No CORS configuration exists on the two private/backup buckets.
- A named backup bucket by itself is not an operational backup system. Before calling recovery ready, implement a documented export/backup schedule, verify backup integrity, and perform a restore test into an isolated database.

### Identity and security
- Cloudflare account membership listing returned one accepted account member with Super Administrator privileges.
- The account API reports two-factor authentication disabled. The account owner should enable 2FA in the Cloudflare dashboard and store recovery codes securely before making infrastructure changes.
- Worker secrets were not read or exposed. Binding names and non-secret configuration were inspected only.

### Connected services
- Three Workers are present: `otya-auth`, `otya-core`, `otya-next`.
- Four D1 databases and three KV namespaces are present.
- Eight queues and one workflow are present. `otya-release-events` has an R2 producer but no consumer listed; confirm whether this is intentional before relying on event-driven release automation.
- Pages project `omnipoint-relay-lab` exists with production branch `never-production`; latest/canonical deployment fields were null at audit time.

## Safe next-step order

1. Owner enables Cloudflare account 2FA and secures recovery codes.
2. Export current DNS records and retain a dated copy outside the Cloudflare account. Preserve mail-routing and verification records.
3. Inventory and document Worker source, bindings, custom domains, queues, workflows, D1 schemas, and external callbacks without printing secrets.
4. Establish scheduled D1 exports to the private R2 backup bucket (or another independent destination), with retention and integrity checks. Test restoration to a separate, non-production database.
5. Reconcile the `omni_*` and legacy/ORM schema families in the migration-test database; no production migration until a reviewed plan and restore proof exist.
6. Replace hard-coded public-domain configuration with reviewed environment configuration where appropriate. Keep provider callback registrations and CORS allowlists explicit.
7. Prepare a replacement-domain runbook: add/verify the new zone, reproduce required DNS and mail records, attach the new hostname to the correct Worker, update CORS/website/callback configuration, validate auth and read-only health checks, and only then schedule any production cutover with explicit owner approval.
8. Do not use `workers.dev` as an assumed payment-service failover. Any alternate hostname requires security review and tested routing/authentication.

## Change control

This document records observations and recommendations only. It does not authorize DNS changes, enabling Workers subdomains, secret changes, database migrations, resource deletion, production deployments, payment-provider activation, or live transactions.
