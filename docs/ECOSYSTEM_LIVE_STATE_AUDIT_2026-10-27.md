# Ecosystem Live-State Audit — 2026-10-27

**Purpose:** distinguish deployed/active infrastructure from provisioned-but-idle resources, isolated migration work, and unverified integrations. This is a read-only audit snapshot of the connected Cloudflare account, GitHub repositories/workflows, public website surfaces, and Resend configuration. It is not a claim that every external partner or device has been tested.

## Executive result

The Otya ecosystem is **partly live, but not yet one fully integrated and production-verified system**.

- The public website, Otya account Worker, Otya core Worker, and Next Worker are deployed in Cloudflare.
- The public domains currently present the **PeterSmart Link / Otya Player** brand. They do not yet reflect the requested company/platform identity of **Otya Hold Ltd / Otya OS**.
- Otya Core is the public website host and shared API/control-plane Worker. Its current D1 binding points to `otya-store-db`, not OmniPoint's dedicated business database.
- The dedicated `omnipoint-prod` D1 database has the expected `omni_*` tables but **zero business rows** in those tables. The isolated migration-test database contains legacy sample/test records and both old and new table families.
- OmniPoint's Cloudflare API migration work is still in unmerged pull requests and is not connected as the production dashboard's verified business-data source. The older main-branch README still describes a PostgreSQL/Supabase legacy path and incorrectly describes the legal operator; newer branch changes correct that.
- Resend is configured and its main webhook is enabled. A legacy Appwrite webhook remains configured but disabled. Email is centralized in the deployed Otya Core/Auth/Next ecosystem at the configuration level, but product-by-product use and least-privilege key ownership still need review.
- Android release artifacts exist in R2 and GitHub Releases, but automated release-event processing is incomplete.
- No OmniPoint payment-provider flow is proven ready for real-money transactions.

## Live Cloudflare resources observed

### Workers and public domains

| Resource | Observed state | What that means |
| --- | --- | --- |
| `otya-core` | Deployed; production custom-domain service | Hosts `petersmartlink.com`, `www`, `docs`, `status`, and `space` custom domains. |
| `otya-auth` | Deployed | Used by Otya Core and has its own D1/KV bindings. |
| `otya-next` | Deployed | AI/support and background processing Worker; has D1, AI, search and queue bindings. |
| Classic Worker routes | No routes returned for the zone | The five observed hostnames are attached as Workers Custom Domains, not classic route entries. |
| Worker previews | Disabled on the inspected Workers/domains | No preview hostname should be assumed available. |

The public website and docs/status pages are reachable to the browser checker. The signed-in Space hostname was not confirmed healthy: the browser checker reported a redirect loop while opening `space.petersmartlink.com`. This may be checker-specific, but it is a concrete symptom that needs a real browser/session check before claiming sign-in works. The public site still identifies the organization as PeterSmart Link and features Otya Player. This is a live branding mismatch against the requested company name and platform family, not just a README issue.

### D1 databases

| Database | Schema / safe row-count observations | Assessment |
| --- | --- | --- |
| `omnipoint-prod` | Has `omni_products`, retail sales/lines, stock movements, agency transactions, ledger, reconciliation, audit events and staff memberships. All inspected `omni_*` business tables have 0 rows. | Provisioned schema, **not populated with real OmniPoint business records**. |
| `omnipoint-migration-test` | Contains the new `omni_*` schema plus legacy `Product`, `RetailSale`, `User`, and other old tables. Sample counts include one row in `Product`, `RetailSale`, and `User`. | Isolated test/migration workspace; mixed schemas require a deliberate mapping plan. Do not promote or merge blindly. |
| `otya-auth-db` | Identity/security schema present; 3 users, 3 linked identities, 22 security events; 0 rows in `account_two_factor`. | Live account data exists. Investigate 2FA enrollment/policy; do not expose account records in this report. |
| `otya-store-db` | Product/support/release/event schema present; 5 releases, 20 downloads, 17 devices, 6 Telegram update receipts, 212 Resend webhook event records and 2 operational events. | This is the populated Otya product/control-plane data store, not OmniPoint's business database. |

Cloudflare's D1 list metadata reports zero tables for all databases, but direct read-only `sqlite_master` queries confirmed tables exist. Use the SQL schema, not the list's `num_tables` field, as the table-existence check.

**Critical wiring issue:** the deployed `otya-core` Worker currently binds `DB` to `otya-store-db`. OmniPoint's production D1 is a separate database and is empty. Do not point the shared Core Worker at OmniPoint's business tables; the correct next step is a dedicated OmniPoint Worker with reviewed, least-privilege bindings and a verified identity contract.

### Object storage, KV and queues

- R2 buckets observed: `omnipoint-backups`, `omnipoint-private`, `otya-assets`, `otya-player-releases`.
- The `omnipoint-backups` and `omnipoint-private` buckets returned no objects. Backup storage exists, but the observed backup bucket has **no backup artifacts**. Recovery is not proven until backup creation and restore are tested.
- `otya-assets` contains canonical brand icons and asset/feature manifests.
- `otya-player-releases` contains 25 objects, including ARM32 and ARM64 APKs and version metadata. Latest observed APK/version artifacts were updated 2026-09-28.
- KV namespaces observed: `otya-core-kv`, `otya-auth-kv`, `omnipoint-cache`. Existence alone does not prove the relevant application uses them correctly.
- `otya-next-jobs`: Core is producer and Next is consumer, with a DLQ.
- `otya-push`: Core is producer and consumer, with a DLQ.
- `otya-release-events`: R2 release bucket is the producer, but **no consumer is configured**. Its DLQ also has no consumer.
- `omnipoint-jobs` and `omnipoint-jobs-dlq`: no producers or consumers configured.

These queue findings are concrete integration gaps: release-event processing and OmniPoint asynchronous jobs are not wired end to end.

## Resend audit

- `petersmartlink.com` is verified in Resend, with sending and receiving enabled.
- Three API keys exist: `Auth Send Email`, `Deployment`, and `otya-store-worker`. Their presence does not prove they are all still needed or scoped minimally. Do not print or copy key values into application code.
- The webhook `https://petersmartlink.com/webhooks/` is enabled for transactional delivery events. Its handler in Otya Server verifies Svix signatures, limits payload size, uses an event ID for idempotency, records event metadata in D1, and writes analytics.
- A webhook pointing to an Appwrite endpoint remains configured but **disabled**. It is a legacy configuration, not an active delivery path.
- The deployed Core Worker has Resend bindings and the store database has 212 webhook-event records, so this is more than documentation-only. However, a fresh signed delivery and successful end-to-end delivery were not executed during this read-only audit.

## GitHub source and release state

- Repositories observed: private `Otya-Server`, `OmniPoint`, `Next`, `OtyaPlayer`; public `OtyaHub`.
- Recent work has been pushed to feature/docs branches, but those branch commits are not automatically the default-branch production source.
- Otya Server's deployment workflow is configured to validate pull requests and pushes to main, and to require an explicit `workflow_dispatch`, the `main` ref, and the exact `DEPLOY` confirmation for production deployment. A recent green run on a feature branch was a pull-request validation run, **not proof of a production deployment**.
- OmniPoint has many open, overlapping proposals (including Cloudflare D1, bridge, test, savings-group, and provider-boundary branches). They must be consolidated and sequenced rather than merged indiscriminately.
- OmniPoint's latest inspected main-branch README still describes the legacy PostgreSQL/Supabase implementation and an isolated Cloudflare migration path. The current target remains Cloudflare + GitHub; do not treat legacy Supabase code as the target primary database.
- OtyaPlayer has published GitHub releases through `v1.1.0+6`; matching ARM32/ARM64 artifacts are present in R2. Latest observed published release is dated 2026-09-11, with R2 artifacts updated 2026-09-28. This proves artifacts exist, not that the latest APK installs, opens, or updates correctly on a real device.
- The Otya release event queue has no consumer, so end-to-end automatic release notification/version synchronization remains unverified.

## What is live vs not live

### Live / configured in production
- Public website, documentation and status surfaces on Cloudflare.
- Otya Core, Auth and Next Workers.
- Otya identity and product databases with records.
- Resend domain and enabled main webhook.
- Otya asset manifests and Android release files in R2.
- Otya Next and push queues with producers/consumers.

### Provisioned but empty, idle, or incomplete
- OmniPoint production D1 business tables: schema exists, no business rows.
- OmniPoint backup/private R2 buckets: no objects observed.
- OmniPoint job queues: no producers/consumers.
- Otya release-event queue: producer exists but no consumer.
- Two-factor enrollment table: no enrollment rows observed.
- Canonical Otya Hold Ltd / Otya OS live-site branding: not yet reflected on public website.

### Not yet proven / do not call production-ready
- OmniPoint dashboard reading/writing the dedicated Cloudflare D1 database end to end.
- A dedicated OmniPoint Worker deployed with reviewed production bindings and Otya Auth integration.
- Data migration completeness, row/invariant reconciliation, backup restoration and rollback.
- Real OmniPoint staff provisioning and authorization in the target system.
- POS sale atomicity, shift close, cashbook/ledger invariants and concurrency tests against the target schema.
- Airtel, MTN or Interswitch/Quickteller sandbox-to-production provider flows, callbacks, reversals, settlement and reconciliation.
- Live financial transactions.
- End-to-end Android installation, startup/crash-free launch, upgrade and release delivery on physical devices.
- Automated Otya release-event consumption and OmniPoint asynchronous job processing.

## Priority remediation order

1. **Protect and verify identity/security:** review Cloudflare account MFA, access policies, worker secret ownership, account recovery and 2FA enrollment; do not rotate secrets without a coordinated deployment plan.
2. **Make source-of-truth explicit:** document every Worker binding and database owner; keep Otya Core's product store separate from OmniPoint business data.
3. **Finish OmniPoint API isolation:** dedicate the OmniPoint Worker, use the approved Otya Auth token contract, resolve active staff/role server-side, and remove the Supabase-specific token assumption from the target API.
4. **Prove data readiness:** map legacy data, create approved exports, reconcile counts and business invariants, test isolated restore, and only then plan a controlled production cutover. No dual-writes.
5. **Close reliability gaps:** configure/validate backup automation and restore, wire or explicitly retire idle queues, and add dead-letter monitoring.
6. **Centralize Resend safely:** retain one owned email service contract in Otya Server, map each application to the intended service API, review key scope/usage, and verify signed webhook delivery without re-enabling legacy Appwrite.
7. **Release readiness:** consolidate OmniPoint's stacked PRs; run current CI on the final intended branch; test Android startup/update on a physical device; wire release event consumer before claiming automated delivery.
8. **Align public identity:** update the public website and linked product surfaces to the approved Otya Hold Ltd / Otya OS family only after a reviewed, staged release.

## Audit boundaries

This audit used read-only API/configuration inspection and safe aggregate row counts. It did not inspect or export customer/business row contents, change DNS, modify secrets, deploy Workers, apply migrations, merge PRs, alter provider accounts, or initiate financial transactions. Public HTTP checks are reachability evidence only; they are not full functional, security, or payment tests.
