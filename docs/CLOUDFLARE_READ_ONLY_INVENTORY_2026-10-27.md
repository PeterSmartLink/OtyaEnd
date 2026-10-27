# Cloudflare Live Configuration — Read-only Inventory

**Checked:** 2026-10-27  
**Scope:** Read-only Cloudflare API inspection. No routes, DNS, Worker code, bindings, secrets, databases, or production records were changed.

## Verified account and zone

- Cloudflare account name: `Petersmartlink@gmail.com's Account`.
- Zone returned by the account API: `petersmartlink.com` (active, not paused).
- The current Cloudflare API inventory returned one zone for this account.
- Classic zone Worker routes for this zone returned an empty list. This does **not** mean no Worker serves the site: the account has Worker Custom Domains attached to `otya-core`.

## Worker Custom Domains

All five returned custom-domain entries are enabled and point to Worker service `otya-core` in the production environment:

| Hostname | Worker | State |
|---|---|---|
| `petersmartlink.com` | `otya-core` | Enabled |
| `www.petersmartlink.com` | `otya-core` | Enabled |
| `docs.petersmartlink.com` | `otya-core` | Enabled |
| `status.petersmartlink.com` | `otya-core` | Enabled |
| `space.petersmartlink.com` | `otya-core` | Enabled |

**Implication:** the current configuration does not show separate Worker Custom Domains for an OmniPoint site. Do not create or repoint domains as part of this inventory. Inspect the existing `otya-core` application routes and UI before choosing a path-based OmniPoint workspace or a future subdomain.

## Worker inventory

The Workers API returned these scripts:

- `otya-auth`
- `otya-core`
- `otya-next`

This is only an inventory of script names and metadata; it does not prove that every service is healthy or that every app surface is fully integrated.

## D1 inventory and important schema finding

The D1 database listing returned:

- `omnipoint-prod` — UUID `65868e64-ff39-4ed3-91de-59c237cd9cb0`
- `omnipoint-migration-test` — UUID `43d274ce-d46e-462f-bcef-59b93caefc21`
- `otya-auth-db` — UUID `b05595f6-260a-4720-acca-4f8b13f5c43e`
- `otya-store-db` — UUID `ab157fc6-2cbb-4d46-9789-2e4392e16aea`

The database-list response reported `num_tables: 0` for these databases, but a separate read-only query against `sqlite_master` returned tables. Therefore, the list metadata's table count is not reliable for schema verification; use read-only schema queries and migration history instead.

### OmniPoint production database

Read-only `sqlite_master` inspection returned these application tables in `omnipoint-prod`:

- `omni_products`
- `omni_retail_sales`
- `omni_retail_sale_lines`
- `omni_stock_movements`
- `omni_agency_transactions`
- `omni_ledger_entries`
- `omni_reconciliation_sessions`
- `omni_audit_events`
- `omni_staff_memberships`

It also returned Cloudflare's internal `_cf_KV` table. No row-level business data was queried.

### OmniPoint migration-test database

The test database contains the `omni_*` schema above **and** a legacy-style schema (`Product`, `RetailSale`, `User`, and related tables), plus `d1_migrations`. This is a schema-overlap risk: before another migration, determine which schema the current test API uses and whether both sets are intentional. Do not delete or merge tables until migration history, code references, backups and rollback are verified.

### Otya databases

Read-only schema inspection confirmed separate identity/security tables in `otya-auth-db` and Otya product/support/release/email-related tables in `otya-store-db`. Keep OmniPoint financial/business records in the OmniPoint data domain; shared identity and centralized email should be service integrations, not a reason to combine product ledgers.

## Decisions and next checks

1. Keep the current live public hosts unchanged until the `otya-core` request router and page map are inspected.
2. Confirm which repository/commit currently deploys `otya-core`, and map each public path to its implementation.
3. Inspect OmniPoint Worker source and bindings without printing secret values; confirm whether any dedicated OmniPoint Worker is deployed or only provisioned in source.
4. Reconcile the migration-test schema overlap with the checked-in migration files and Worker queries.
5. Verify backup/restore and access control before any production data migration.
6. Do not enable provider execution, live payments, or agency transactions during this phase.

## Safety

This document records configuration metadata and schema names only. No DNS, route, Worker deployment, secret, data migration, production business row, or payment action was modified.
