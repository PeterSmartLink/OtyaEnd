# Otya Ecosystem — Verified Resource Registry

**Inventory date:** 2026-10-29  
**Method:** Read-only GitHub repository inspection and Cloudflare account API inventory.  
**Status:** Partial inventory; not a production-readiness certification.

## Canonical service map

- **Otya Hold Ltd:** parent company.
- **Otya OS:** unified platform and ecosystem management.
- **Otya End:** shared backend, integration contracts, identity coordination, operational controls.
- **OtyaPoint:** own-shop retail and financial-agency application (legacy repository slug: `OmniPoint`).
- **Otya Media:** media player (repository: `OtyaPlayer`).
- **OtyaHub:** public developer/partner community.

Keep existing repository slugs and deployed resource names until a separately reviewed compatibility migration is approved. Names alone do not establish resource ownership.

## GitHub repositories observed

The authenticated GitHub connection listed these repositories under `PeterSmartLink`:

| Repository | Default branch | Intended role |
|---|---|---|
| `Otya-Server` | `main` | Shared Otya backend and infrastructure |
| `OmniPoint` | `main` | OtyaPoint shop and agency application |
| `OtyaPlayer` | `main` | Otya Media application |
| `OtyaHub` | `main` | Public developer community |
| `Next` | `main` | Role/ownership not established in this inventory; investigate before consolidation |

Repository access does not prove current deployment or health.

## Cloudflare account inventory

The read-only account inventory returned these Worker scripts:

- `otya-core`
- `otya-auth`
- `otya-next`

D1 databases returned:

| Database | ID | Configured role observed |
|---|---|---|
| `otya-store-db` | `ab157fc6-2cbb-4d46-9789-2e4392e16aea` | Otya core configuration binds this as `DB`; verify actual schema ownership and cross-service access. |
| `otya-auth-db` | `b05595f6-260a-4720-acca-4f8b13f5c43e` | Otya Auth identity data; keep distinct from product/shop records. |
| `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5` | Isolated OtyaPoint development D1 according to repository configuration and README. |

R2 buckets returned by the account inventory:

- `otya-player-releases`
- `otya-assets`
- `omnipoint-dev-private`
- `omnipoint-dev-backups`

Queues returned:

- `otya-push`, `otya-push-dlq`
- `otya-next-jobs`, `otya-next-jobs-dlq`
- `otya-release-events`, `otya-release-events-dlq`
- `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`

These are existence findings only. Queue consumers, access policies, lifecycle settings, backup contents, and runtime health require separate checks.

## Configuration comparisons

### Otya End / `Otya-Server`

The root `wrangler.toml` configures Worker `otya-core`, binds D1 `otya-store-db`, R2 `otya-player-releases`, KV, queues and service bindings to `otya-auth` and `otya-next`. Its routes include `petersmartlink.com` and subdomains. Treat this as production-sensitive.

Live Worker settings confirmed bindings named `DB`, `AUTH`, `AI_SUPPORT`, `PUSH_QUEUE`, `R2`, `KV`, analytics, and several secret binding names. Secret values were not read or recorded.

### OtyaPoint / legacy repository `OmniPoint`

Root `wrangler.toml` defines `omnipoint-dev-api`, D1 `omnipoint-dev`, R2 `omnipoint-dev-private` and `omnipoint-dev-backups`, KV namespace `69ca8a463e60410d907749d4e863faf4`, producer queue `omnipoint-dev-jobs`, and service binding `AUTH` to `otya-auth`. It sets `workers_dev = false` and has no route in the file.

The Worker script `omnipoint-dev-api` was **not** present in the live Worker script list during this inventory. Therefore its configuration is not proof of a deployed endpoint. Do not deploy or apply remote migrations until preview routing, Access protection, auth contracts, and environment bindings are verified.

The repository README states that the development stack was created and core/company/staff migrations applied to the isolated D1 database; it also states that the Worker is undeployed and payment operations are not active. This statement is repository documentation, not an independent database migration-history query in this inventory.

## Known blockers / follow-up

1. **P0 — OtyaPoint dev runtime:** Reconcile the missing live `omnipoint-dev-api` script with its Wrangler config and verify exact live D1/R2/KV/queue IDs, migration state, and auth service binding before any deployment.
2. **P0 — Supabase removal:** `OmniPoint/package.json` still declares `@supabase/ssr`, `@supabase/supabase-js`, Prisma, and PostgreSQL-era scripts. Map every active import/data path before removing dependencies; do not delete any external database or data as part of code cleanup.
3. **P0 — Otya End security:** The existing GitHub issue #233 documents high/critical runtime dependency findings. Patch compatible versions and run the repository's complete checks before production deployment.
4. **P1 — Payment integration:** Provider-neutral payment/reconciliation schema work exists in open PR #49; provider scaffolds are described as not yet wired to application routes. Keep provider traffic disabled until reviewed tests, idempotency, reconciliation, and explicit production authorization.
5. **P1 — Recovery:** The backup verification workflow in PR #46 has not yet completed a remote export/restore according to its description. Run only against the isolated development database and verify the result before treating recovery as proven.
6. **P1 — Ecosystem inventory:** Investigate repository `Next`, all service bindings, queue consumers, D1 migration tracks, Access policies, and account/domain ownership before consolidation or deletion.

## Safety rules

- No secret values, tokens, customer data, or financial rows belong in this registry.
- No automatic deletion, repository renaming, remote migration, DNS/secret change, production deployment, or live payment operation.
- Use synthetic data for tests; isolate development and production resources.
- Treat provider requests as untrusted and require server-side authentication, staff membership, least-privilege roles, idempotency, audit trails, and reconciliation.
- Update this registry only with dated evidence and distinguish **verified**, **documented**, **unverified**, and **unknown** states.

## Verification scope and limitations

Verified by read-only calls on 2026-10-29: repository listing, root Wrangler configuration files, package manifests, Worker script listing, Worker settings/binding names, D1 database listing, R2 bucket listing, and queue listing. No secret values, customer rows, financial rows, or payment credentials were read. No resource was changed by the inventory calls.
