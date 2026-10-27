# Otya Hybrid Ecosystem Operating Model

**Status:** proposed operating contract; not a deployment record  
**Last reviewed:** 2026-10-27  
**Owner:** Otya Hold Ltd  
**Safety:** this document does not authorize production deployment, DNS or secret changes, data migration/deletion, billable infrastructure creation, outbound email, or live financial transactions.

## 1. Canonical product and company identity

- **Legal parent:** Otya Hold Ltd.
- **Operating business:** Otya Hold Ltd T/A OmniPoint. OmniPoint is the owner's shop and retail/mobile-money agency operation, not a separate legal company name.
- **Otya OS:** the connected platform family and shared operating model.
- **Otya Server:** central backend/control plane for shared identity, approved APIs, audit, notifications, releases and cross-product coordination.
- **Next:** the owner-facing AI assistant and in-house AI workforce interface. It may inspect and recommend broadly; it may execute only through scoped, audited tools and the approval policy.
- **OmniPoint:** the business operations product for stock, retail POS, receipts, cash controls, agency transactions, float, commissions and reconciliation.
- **Otya Media:** the offline-first Flutter media product. Local playback must not depend on cloud services.
- **OtyaHub:** public developer/partner and public documentation hub. Never publish private infrastructure inventories, credentials, user data or internal runbooks there.
- **Resend:** the centralized transactional email provider, integrated through Otya Server. Product code should call the approved Otya Server email interface rather than each product independently managing provider credentials.

## 2. Hybrid architecture: one system, specialist providers

| Layer | System of record / responsibility | Rules |
|---|---|---|
| Source and delivery workflow | GitHub repositories, branches, PRs, CI | Reviewable changes; protected secrets; no implicit production deploys. |
| Primary runtime | Cloudflare Workers | Keep existing Otya Workers intact; deploy OmniPoint as a dedicated Worker when its release gates pass. |
| Relational data | Cloudflare D1 | One authoritative writer per product/domain. OmniPoint business data belongs in its dedicated D1 database; do not use Otya Core/Auth databases for shop records. |
| Files and exports | Cloudflare R2 | Private by default for receipts, exports and operational documents; signed short-lived access; explicit retention. |
| Short-lived cache/config | Cloudflare KV | Only reconstructable, non-authoritative values. Never store the financial ledger or the only copy of a record here. |
| Async processing | Cloudflare Queues and Workflows | Use idempotent consumers, bounded retries, DLQs and observable failure recovery. Emit events after committed writes. |
| Identity | Otya Auth | Authentication proves identity only; each product must map the identity to its own active membership and permissions. |
| Cross-product control | Otya Server | Versioned APIs and events; explicit ownership; audit actor, purpose, scope, approval and request ID. No direct cross-product database reads/writes. |
| Email | Resend through Otya Server | Server-side credentials only; verified webhook signatures and idempotent processing; no unsolicited or test email to real recipients without approval. |
| Optional specialist cloud | AWS | Add only when a demonstrated need cannot be met safely by Cloudflare. First candidate is a restricted static-egress relay for Airtel if the provider confirms an IP allow-list requirement. AWS is not a second OmniPoint database. |
| Public developer surface | OtyaHub | Publish only approved public docs, examples and release information. |
| Owner AI interface | Next | No secrets in the app; read-only diagnostics by default; high-impact operations require fresh owner verification and explicit approval. |

### Provider boundaries

- **OmniPoint operational dependencies:** GitHub + Cloudflare. Do not add Supabase, Appwrite or Vercel as runtime dependencies.
- Legacy PostgreSQL/Supabase code or data, if present, is a legacy/recovery source only during the controlled transition. Do not dual-write, delete, pause or migrate it without a separate verified plan and explicit approval.
- AWS is an exception only for a specific, documented requirement; do not create resources just because the account is connected.
- Cloudflare D1 Time Travel is useful point-in-time recovery, but it is not a substitute for an independent export and a proven restore drill.

## 3. OmniPoint business-data and money-safety rules

1. OmniPoint's dedicated D1 database is the sole authoritative store for OmniPoint business records once its schema and release gates are approved.
2. A product, stock movement, sale, sale line, retail-ledger entry and audit record must post atomically. Returns/refunds use compensating entries; historical ledger rows are not silently rewritten.
3. Retail accounting and agency accounting remain separate. Cash, provider float, commission and settlement must not be silently netted against retail sales or cost of goods.
4. Every retryable financial request has a server-generated or validated idempotency key and a traceable request ID.
5. A provider transaction is not successful merely because the UI or a network request returned. Success requires verified provider truth; timeouts remain pending/unknown until reconciled.
6. Verify provider callbacks cryptographically and/or query provider status server-side. Never trust browser-submitted provider status, amount, actor, role or approval.
7. No live payment execution until partner contracts, sandbox tests, credentials, callback verification, reconciliation, settlement, failure recovery and operational approval pass.
8. Keep national IDs and identity documents out of the system unless a documented legal/business need and retention policy are approved.

## 4. AWS static-egress decision gate

The current read-only AWS inventory found no EC2 instances, Elastic IPs, NAT Gateways, Lambda functions, S3 buckets, CloudTrail trails, CloudWatch alarms, Secrets Manager secrets, or Systems Manager managed instances in the inspected account/regions. Cost Explorer access was unavailable, so current spend has not been verified.

Before any AWS provisioning:
1. Confirm in the registered Airtel Uganda developer application whether the allow-list applies to outbound requests, inbound callbacks, sandbox, production, or some combination.
2. Check current account billing and establish cost alerts/limits. Do not infer that a resource is free.
3. Compare the smallest maintainable relay design with alternatives, documenting monthly fixed and variable charges.
4. Restrict the relay to approved Airtel HTTPS destinations and methods, authenticate Cloudflare-to-relay requests, enforce request size/time limits and rate limits, redact secrets from logs, and reject arbitrary proxy URLs.
5. Store credentials only in approved secret stores and never in source, client apps, logs or this document.
6. Create a reviewed infrastructure-as-code change and run security checks. Provisioning, allocating an Elastic IP, and activating provider traffic require explicit owner approval.
7. Start with provider sandbox; live transaction enablement remains a separate approval.

## 5. Current observed gaps to close

### Cloudflare inventory (read-only, 2026-10-27)
- Workers: otya-auth, otya-core, otya-next.
- D1: otya-auth-db, otya-store-db, omnipoint-prod, omnipoint-migration-test.
- R2: otya-assets, otya-player-releases, omnipoint-private, omnipoint-backups.
- KV: otya-auth-kv, otya-core-kv, omnipoint-cache.
- Queues: eight existing queues. Otya Next jobs and push have attached consumers; OmniPoint jobs/DLQ currently have no attached producer/consumer; release events has a producer but no confirmed consumer.
- Cloudflare's D1 list endpoint reported zero tables in its metadata, but a read-only sqlite_master query confirmed the OmniPoint production schema objects exist. Counts checked for nine core OmniPoint production tables were all zero. The migration-test database contains one row each in legacy Product, User, RetailSale and AgencyTransaction tables, while the checked new omni_* tables were empty. Treat the legacy rows as test/migration fixtures, not production business data; do not promote or merge them automatically.
- Existing Otya resources are serving separate workloads. Do not rename, delete or change their bindings as part of OmniPoint setup.

### GitHub / application readiness
- The Otya Server Next technical-team foundation PR is open and draft; it is not merged and does not yet prove runtime integration.
- OmniPoint has an isolated Cloudflare API/schema path, but its README states that it is not connected to the production dashboard and is not ready to execute mobile-money or bill-payment operations.
- Several ecosystem/product PRs remain open. Inspect dependencies and conflicts before opening duplicate work; do not mass-merge.
- The OmniPoint README contains legacy company/provider wording that should be reconciled with the canonical identity and Cloudflare-only operational decision in a separate reviewable change.

## 6. Phased implementation plan and acceptance gates

### Phase A — Establish control and inventory
- Keep a single, versioned resource inventory covering owner, environment, region/jurisdiction, data classification, cost owner, dependencies, backup and rollback.
- Verify GitHub branch protections, CI status, deployment workflow permissions and secret scopes without printing secret values.
- Verify Cloudflare bindings, routes, D1 schemas/migrations, R2 access controls, queue consumers/DLQs, scheduled jobs and observability.
- Enable/verify billing visibility and alerts before provisioning paid infrastructure.
- Deliverable: reviewed inventory, risk register, ownership map and a list of safe, reversible changes.

### Phase B — Complete the OmniPoint isolated foundation
- Reconcile D1 metadata with actual schema/migration state.
- Finalize dedicated Worker configuration and explicit bindings to only OmniPoint resources.
- Complete identity issuer/audience/signature/revocation verification and local staff/branch/role mapping.
- Run schema, auth, authorization, input-validation, atomicity, concurrency, idempotency and rollback tests in the isolated environment.
- Keep dashboard integration, custom domain and provider execution disabled until the API contract and tests pass.

### Phase C — Protect business data and recovery
- Establish private R2 access controls, size/type validation, lifecycle and retention.
- Build encrypted, versioned backup exports with manifests/checksums, access controls and alerts.
- Run a restore into an isolated target and compare row counts plus financial invariants.
- Document incident response, recovery point/time objectives and rollback procedure.
- Do not promote the migration-test database or sample data into production.

### Phase D — Integrate the connected family
- Use Otya Auth for identity only; product APIs enforce local authorization.
- Publish versioned service contracts/events through Otya Server. Avoid direct database coupling.
- Route email through the central Otya Server/Resend interface with webhook idempotency and delivery monitoring.
- Wire Next to read-only diagnostics first, then explicitly approved low-risk actions. Reuse the existing action approval and audit system.
- Keep Otya Media independent for local playback; OtyaHub receives only public-safe documentation.

### Phase E — Provider readiness and optional AWS
- Validate Airtel, MTN and Interswitch/Quickteller requirements independently.
- Implement provider adapters behind a disabled-by-default feature flag and contract tests.
- If Airtel confirms static egress is required, review and approve the smallest AWS relay design; test sandbox end-to-end and test replay, timeout, duplicate callback and reconciliation cases.
- No live money movement until each provider and operational flow passes its own release gate.

### Phase F — Release and operations
A production activation requires all of the following:
- CI, type/lint/security checks and contract tests pass on the exact commit.
- A second review confirms tenant isolation, permissions and financial invariants.
- Backup/restore and rollback have been tested.
- Logs, alerts and cost limits are active without exposing personal data or secrets.
- Exact affected Worker, D1, bindings, routes, secrets and provider environment are documented.
- Owner explicitly approves the named production action. A preview or green build is not a production release.

## 7. Operating principles for Next and the AI workforce

- Next may inspect and summarize resource health using read-only tools.
- Each tool has a declared scope, allowed arguments, timeout, audit record and error-recovery path.
- Unknown actions are denied. Do not give the AI broad administrator credentials or arbitrary shell/API execution.
- Low-risk changes can be proposed as patches or pull requests. Merge, deployment, DNS, secrets, data migration/deletion, billable resource creation, outbound email and live financial operations remain explicit approval gates.
- Next must report what it actually checked, changed, tested and could not verify. Never claim a setup is complete based only on a plan, a successful build or resource creation.

## 8. Definition of “one manageable system”

The ecosystem is considered operationally unified when it has:
- one canonical ownership and naming model;
- clear per-product data ownership and no accidental dual writes;
- shared identity with product-local authorization;
- versioned APIs/events instead of cross-database coupling;
- central email and audit conventions;
- one inventory, deployment/recovery runbooks and cost view;
- consistent CI and staged release gates;
- a Next owner console that reports verified status and requires approval for high-impact work;
- tested recovery and a clear boundary between preview, sandbox and production.

This is a target contract, not a claim that these items are already implemented.
