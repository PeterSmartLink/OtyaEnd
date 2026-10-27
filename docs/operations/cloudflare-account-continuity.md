# Cloudflare Account Organization and Domain Continuity

Status: infrastructure audit and implementation plan  
Scope: Otya Hold Ltd, Otya Server, OmniPoint, and Otya Media  
Safety: this document does not authorize production deployments, DNS changes, secret rotation, data migrations, payment activation, or deletion of existing resources.

## Objectives

- Keep the Cloudflare account, source code, databases, object storage, and recovery materials independent of any one custom domain.
- Preserve existing applications and data while clarifying ownership and dependencies.
- Make adding a replacement domain a documented, repeatable process.
- Keep production payment flows disabled until explicitly approved and provider credentials/callbacks are verified.

## Audit snapshot

Read-only inspection found the following account resources:

### Zone
- `petersmartlink.com` — active Cloudflare zone.
- Current DNS includes mail routing, email-provider records, an R2-backed assets hostname, and other records. Export and review all DNS records before any change.
- No Worker routes were returned for this zone by the routes API at audit time. The website may use other routing mechanisms; verify before making any routing changes.

### Workers
- `otya-auth` — authentication service; binds to `otya-auth-db` and `otya-auth-kv`. It has a configured CORS origin and Telegram callback referencing the current domain.
- `otya-core` — shared Otya backend and asset-serving Worker; binds to `otya-store-db`, `otya-core-kv`, `otya-player-releases`, queues, analytics, workflows, and service bindings.
- `otya-next` — AI/support service; also binds to `otya-store-db` and `otya-core-kv`, and has a configured website URL referencing the current domain.
- All three Workers reported their `workers.dev` subdomain disabled at audit time. Do not enable public subdomains until each Worker is reviewed for authentication, CORS, rate limits, admin routes, and intended public exposure.

### D1 databases
- `omnipoint-prod` — existing OmniPoint schema with inventory, retail sales, agency transactions, ledger, audit, staff and reconciliation structures.
- `omnipoint-migration-test` — existing schema with inventory, agency transactions, ledger and reconciliation structures.
- `otya-auth-db` — existing user, linked-identity and authentication-security structures.
- `otya-store-db` — substantial existing Otya application schema, including media/player and related product features.
- A schema listing returned no writes. Table counts, record counts, migrations, foreign-key relationships and backup/restore status still require a structured follow-up audit. Never assume these databases are empty.

### R2 buckets
- `omnipoint-backups`
- `omnipoint-private`
- `otya-assets`
- `otya-player-releases`

Bucket existence does not prove that backups are complete or restorable. Review bucket policies, object inventory, retention, and restoration tests.

### KV namespaces
- `otya-core-kv`
- `otya-auth-kv`
- `omnipoint-cache`

Document purpose, TTL/retention, and whether values are authoritative or reconstructable. Do not store authoritative financial ledger data in KV.

### Pages
- `omnipoint-relay-lab` — isolated lab project with a non-production branch setting. Keep it isolated and do not promote it to production without a separate approval.

### Account security
- The account audit reported two-factor authentication disabled.
- The account currently returned one member with Super Administrator privileges.
- Enable 2FA from the Cloudflare dashboard, save recovery codes offline, secure the associated email account, and establish a trusted emergency access procedure. Do not share passwords or recovery codes.

## Target ownership model

- **Otya Server:** shared platform conventions, service integrations, observability, release procedures, and infrastructure documentation.
- **Otya Auth:** identity and access services.
- **OmniPoint:** business/shop records, stock, sales, expenses, agency operations, payment references, reconciliation and audit trails.
- **Otya Media / Otya Player:** media assets, release distribution and product-specific data.
- **D1:** relational, authoritative records for the relevant application.
- **R2:** files, exports and backup artifacts, with private/public access separated.
- **KV:** cache and suitable non-authoritative configuration only.
- **Queues / Workflows / Durable Objects:** use only where asynchronous jobs, durable coordination or stateful workflows require them.

This is a logical ownership model, not a direction to create duplicate resources. Verify current bindings and migrations before moving or renaming anything.

## Domain independence rules

1. Keep source code and deployment configuration in GitHub; do not rely on the domain to access the source repository.
2. Keep domain names, public base URLs, CORS allowlists, OAuth redirect URIs, webhook URLs, email domains, and provider callback URLs in explicit environment-specific configuration.
3. Avoid hard-coded references to `petersmartlink.com` in application logic. Replace them only through reviewed code changes and staged testing.
4. Treat a `workers.dev` address as a continuity/testing option, not automatically as the production endpoint for financial services. Public exposure must be reviewed first.
5. Maintain an inventory of DNS records and the purpose/owner of each record. Include email authentication/routing, R2 custom domains, provider callbacks, and verification records.
6. Keep domain registration and account recovery independent where possible. Maintain a secure registrar recovery method and a renewal calendar.
7. A replacement domain requires revalidation of DNS, TLS, CORS, OAuth, email, mobile app configuration where relevant, payment-provider allowlists, webhook/callback registrations, and security rules.

## Replacement-domain runbook

1. Confirm ownership and access to the new domain and registrar.
2. Add the new domain/zone to the existing Cloudflare account; preserve the existing zone until migration is verified.
3. Export the old zone's DNS records and map only the records that are still required. Recreate email/provider verification records accurately.
4. Review the Workers' current route and custom-domain configuration; do not blindly copy all records.
5. Configure the new domain for the intended public Worker or frontend after security review.
6. Update application base URLs, CORS allowlists, OAuth redirect URIs, email links, webhook endpoints and provider callback/allowlist settings as required.
7. Test login, authorization, API health, business workflows, email delivery, mobile app behavior and provider sandbox callbacks.
8. Verify logs and monitoring, then switch traffic in a controlled manner.
9. Keep the old domain and records until the new domain is stable and all critical dependencies are verified.
10. Record the migration and rollback steps. Never change DNS or activate live payments without explicit authorization.

## Backup and recovery requirements

- Keep code and infrastructure configuration in GitHub, with no credentials committed.
- Establish scheduled D1 exports/backups and verify recovery into a separate recovery database.
- Back up important R2 objects and configuration records; document retention and access controls.
- Record Worker names, bindings, compatibility dates, routes, secrets *names* (never values), queues, workflows, custom domains, and required external integrations.
- Perform periodic restore drills and record measured recovery time.
- Keep a copy of this runbook and recovery instructions outside the Cloudflare account.

## Follow-up checklist

- [ ] Enable Cloudflare 2FA and securely store recovery codes.
- [ ] Export complete zone DNS and Worker route/custom-domain inventory.
- [ ] Review Worker code for domain hard-coding, CORS, admin routes and public exposure.
- [ ] Inspect D1 migrations, schema, table counts and data classification without exposing personal/financial records.
- [ ] Verify backups exist and successfully restore.
- [ ] Inspect R2 access policies and backup contents.
- [ ] Build an environment/configuration inventory without secret values.
- [ ] Prepare a replacement-domain test plan.
- [ ] Run sandbox-only checks for payment providers; no live transactions.
- [ ] Obtain explicit approval before production DNS, deployment, secret, migration, or payment changes.

## Change log

- Initial read-only Cloudflare audit completed.
- Documentation staged on branch `infra/cloudflare-domain-continuity`.
- No Cloudflare configuration or production data was changed by this document.
