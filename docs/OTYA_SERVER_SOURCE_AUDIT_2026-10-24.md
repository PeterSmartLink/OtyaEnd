# Otya Server source readiness review

Audit date: 2026-10-24  
Repository: PeterSmartLink/Otya-Server  
Scope: Source review plus a read-only Cloudflare account, Worker binding, hostname, and D1 schema inventory. This is not a penetration test, data-quality audit, or certification.

## Assessment

Otya Server is already a substantial platform. The repository contains a Cloudflare core Worker, a separate authentication Worker, an Otya Next service binding, D1/KV/R2/Queues/Analytics bindings, release workflows, security documentation, migration checks, and automated tests. The right path is to extend this system rather than build a parallel backend.

## Verified source-level strengths

- The core Worker is configured as `otya-core`; `workers.dev` is disabled in source configuration, official hostnames are declared, and observability redacts query strings.
- Separate service bindings exist for Otya Auth and Otya Next.
- The router applies browser security headers to HTML responses and calls Otya Auth through a service binding for Together identity checks.
- JWT verification pins the algorithm to HS256, verifies the signature, and checks expiry and time claims.
- Google sign-in validation checks configured audience, issuer, expiry and verified email.
- The repository has configuration, migration-layout, operations-readiness and security-related tests.

Source-level findings do not prove the deployed resources or configuration match the repository.

## Live Cloudflare inventory (read-only, 2026-10-24)

The authenticated Cloudflare connection exposed one account: `Petersmartlink@gmail.com's Account`. Only resource metadata and schema names were queried; secret values and business/customer row contents were not retrieved.

### Deployed Workers and hostnames

- Deployed Worker scripts found: `otya-core`, `otya-auth`, and `otya-next`.
- Five enabled production hostnames were returned for `otya-core`: `petersmartlink.com`, `www.petersmartlink.com`, `docs.petersmartlink.com`, `status.petersmartlink.com`, and `space.petersmartlink.com`. Preview routing was disabled for these returned hostname records.
- No Worker script named `omnipoint` appeared in the account's Worker script inventory.
- The `otya-core` Worker has service bindings to `otya-auth` and `otya-next`; both `otya-core` and `otya-next` point their D1 `DB` binding to `otya-store-db`. `otya-auth` points `AUTH_DB` to `otya-auth-db`.
- Secret values were not requested or printed. The inventory shows secret bindings exist, but not whether every provider credential is valid or functioning.

### D1 database inventory and schema evidence

Four D1 databases were listed:

| Database | Observed schema objects | Read-only observation |
|---|---:|---|
| `omnipoint-prod` | 44 | Contains OmniPoint-prefixed products, sales, sale lines, stock movements, agency transactions, ledger entries, reconciliation sessions, staff memberships and audit events. |
| `omnipoint-migration-test` | 109 | Contains both Prisma-style tables (such as `Product`, `RetailSale`, `User`) and OmniPoint-prefixed tables, plus a `d1_migrations` table. |
| `otya-auth-db` | 24 | Contains users, linked identities, product memberships, two-factor and auth-security-event tables. |
| `otya-store-db` | 96 | Contains OTYA store/media, release, device, notification, Telegram receipt, operational and AI-support tables. |

The D1 list endpoint reported `num_tables: 0` for these databases even though a read-only `sqlite_master` query returned schema objects. Therefore, do not use the list endpoint's table count as proof that a database is empty; the metadata field appears stale or inaccurate.

### Immediate OmniPoint integration risks

1. The live account contains an `omnipoint-prod` database with a real schema, but no `omnipoint` Worker was found in the Worker script inventory and no OmniPoint hostname appeared in the returned production hostnames. This inventory alone cannot rule out a Vercel application or another runtime, but it does mean a Cloudflare-hosted OmniPoint API has not been verified.
2. The migration-test database has two overlapping schema families: Prisma-style names and OmniPoint-prefixed names. That is a schema-drift risk until the intended authoritative schema and migration lineage are confirmed.
3. The `omnipoint-prod` schema query did not return a `d1_migrations` table, while the migration-test database did. This is not proof that production is unmigrated; it means the migration history needs to be reconciled against the actual migration files before any schema change.
4. The current core Worker source binds `DB` to `otya-store-db`, not `omnipoint-prod`. Keep OmniPoint's financial and retail data isolated; do not repurpose the OTYA store database as OmniPoint's system of record.

These checks only inspected schema metadata. They did not read business/customer rows, write data, apply migrations, or execute financial operations.

## Findings to address before connecting more products

### 1. Cross-product identity contract

The current JWT payload contains `sub`, `email`, `iat` and `exp`. The verifier validates the signature and time claims but does not validate issuer or audience claims. That may work within a narrowly controlled boundary, but it is not a complete cross-service identity contract by itself.

The OmniPoint integration has an identified mismatch between Otya Auth tokens and OmniPoint's isolated token-verification scaffold. Do not work around it in the browser, broadly share signing secrets, or weaken verification.

**Next:** define issuer, audience, product scope, organization membership, permission checks, revocation and key rotation. Add negative tests for wrong audience/scope, expired tokens, missing membership and cross-tenant access. Implement a reviewed server-side adapter before enabling financial routes.

### 2. Rate limiting under concurrency

Some authentication rate-limit helpers read a KV counter and then write an incremented value. That sequence is not atomic, so concurrent requests can exceed the intended threshold. The Together control module also permits requests when its optional limiter throws.

**Next:** decide fail-open versus fail-closed behavior by endpoint risk; use an appropriate centralized/atomic limiter for login, OTP, recovery and sensitive mutations; test concurrency and limiter outages. Do not change live behavior without tests and review.

### 3. Deployment can apply remote migrations

The package scripts include a `predeploy` lifecycle hook that runs `wrangler d1 migrations apply DB --remote`. Running the ordinary deploy script can therefore change the remote core D1 schema.

**Next:** preserve deployment gates, require a reviewed migration plan and recovery evidence, confirm the exact target environment before applying, and do not run the deploy script as a routine test.

### 4. Configuration is not proof of live readiness

Live resource metadata now confirms that Workers and D1 databases exist, but it does not prove every binding is healthy, secrets are valid, or service-to-service requests succeed. The mismatch between D1 metadata counts and actual schema objects also shows why independent verification is needed.

**Next:** keep timestamped, read-only inventory; verify bindings against intended product ownership; compare actual schema with checked-in migration history; never print secret values.

### 5. Static tests need service-boundary integration tests

Source-level tests are useful but cannot fully prove deployed authentication, tenant isolation or retry safety.

**Next:** add isolated tests for cross-product token acceptance/rejection, revoked sessions, tenant isolation, duplicate webhooks/idempotency, queue retries, service timeouts, clean D1 migration and restore validation.

### 6. Keep product data separately owned

Otya Server should provide shared identity, policy, API patterns, events and observability. OmniPoint must remain authoritative for its inventory, sales, agency transactions and accounting ledgers. Shared identity must not grant unrestricted access to every product's data.

**Next:** define the data owner, authoritative database, tenant key, permitted operations, event schema, retention and recovery owner for each integration. OmniPoint's D1 database should be accessed only through a deliberately designed, authenticated server-side API with explicit permissions and audit logging.

## Safe order of work

1. Keep production resources unchanged during the review.
2. Reconcile the actual OmniPoint schema and migration lineage without writing to either database.
3. Reconcile identity contracts and test authorization failures.
4. Harden rate limiting with tests.
5. Add read-only environment/schema verification and explicit migration approval.
6. Test service-to-service boundaries using disposable resources.
7. Connect OmniPoint only through a versioned API and idempotent events after its schema is reconciled.
8. Deploy through the reviewed release workflow only after explicit approval and recovery checks.

## Evidence limits

This review inspected checked-in source/configuration on `main` and performed read-only Cloudflare resource and schema-metadata queries on 2026-10-24. It did not retrieve business/customer row contents, inspect secret values, execute the repository's automated test suite, change bindings, apply migrations, deploy Workers, modify secrets, or perform financial operations. Live application health, data quality, migration compatibility, and end-to-end readiness remain unverified.
