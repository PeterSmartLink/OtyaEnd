# Otya Ecosystem Repository Cleanup Audit — 2026-10-27

## Purpose
Consolidate the Otya ecosystem without losing unique work, breaking integrations, deleting production evidence, or deploying changes. This is an inventory and review gate, not authorization to merge or deploy.

## Canonical product boundaries
- **Otya OS** — connected platform family and governance.
- **Otya Server** — shared Cloudflare backend, APIs, identity/security boundaries, shared services and ecosystem registry.
- **Next** — owner's personal AI assistant and intelligence/coordinator layer across the entire authorized Otya ecosystem. It is not a second backend and must use authorized APIs and approval gates.
- **OmniPoint** — Otya Hold Ltd T/A OmniPoint, the owner's own physical shop/agency operations. Cloudflare + GitHub are the intended operational foundation; no Supabase, Appwrite or Vercel operational dependency.
- **Otya Media** — offline media-player product (repository currently named OtyaPlayer).
- **OtyaHub** — public developer/partner resources; public resources must not require owner SSO.

## GitHub inventory snapshot
Open PR and branch results were retrieved on 2026-10-27. Counts are a snapshot and may change.

| Repository | Open PRs returned | Branches returned | Initial classification |
|---|---:|---:|---|
| PeterSmartLink/Otya-Server | 23 | 40 | Shared platform; many dependency updates and overlapping architecture docs need PR-aware review. |
| PeterSmartLink/OmniPoint | 20 | 37 | Shop operations; several competing Cloudflare/D1 implementations and legacy-provider references require review. |
| PeterSmartLink/OtyaPlayer | 6 | 7 | Media player; open dependency PRs should be tested before merge/closure. |
| PeterSmartLink/OtyaHub | 1 | 2 | Public resource project; inspect its sole PR before cleanup. |
| PeterSmartLink/Next | 0 | 1 | Main only; no branch cleanup identified in this snapshot. |

Note: search results may be capped or exclude results because of search indexing; do not treat counts as proof that no other refs exist.

## Highest-priority review clusters

### OmniPoint — production and Cloudflare-only alignment
- PR #31 is a production exposure/schema-blocker audit and source-only workers_dev hardening. It contains important safety evidence and should not be discarded as duplicate documentation.
- PR #30 is a draft schema audit. It overlaps some of #31's topic, but may contain unique migration, health-check, CI and route-readiness work. Compare file-by-file and commit-by-commit before deciding whether to consolidate.
- PRs #28 and #27 both describe the inventory/D1 bridge. Their approaches differ (notably auth boundary/service-binding choices), and #27 is marked non-mergeable. Do not close or delete either until all unique changes are compared and the intended authentication contract is selected.
- PR #29 adds company-scope/staff-profile migration work. Preserve until its schema changes and test coverage are verified against the authoritative migration lineage.
- PR #22 documents the desired Cloudflare-only single-shop direction but still notes Supabase authentication and legacy Prisma dependencies remain. Treat those references as migration blockers, not permission to retain them as operational dependencies.
- PR #21 proposes shop/agency schema and rollout planning. Keep the scope centered on the owner's shop; any savings-group work requires an explicit product-scope decision before removal.
- PRs #12, #30, #31 and related docs contain production schema/backup/recovery blockers. Preserve them until a single reviewed, evidence-backed canonical audit replaces duplicate material.

### Otya Server — ecosystem architecture/docs
- PR #213 contains the ecosystem registry, validator/tests and safe release controls; it is a strong candidate to become the central coordination baseline after normal review.
- PRs #206, #207 and #205 are related but not interchangeable: master architecture, API catalog/contracts and shared identity contract have separate purposes. Consolidate links and ownership, not content, unless all unique requirements are retained.
- PRs #211 and #204 may overlap in readiness/audit coverage. Compare their changed files and unique evidence before consolidating.
- Dependency PRs should be evaluated on current CI/security status and package compatibility; do not delete solely because there are many of them.

### Other repositories
- OtyaPlayer has six open dependency PRs. Do not bulk-close: Android Gradle/AGP upgrades may be incompatible and need CI review.
- OtyaHub has one open service blueprint/pricing PR. Review it for consistency with Otya OS and keep public developer resources separate from private owner permissions.
- Next has only main in the retrieved branch snapshot. Its README already defines Next as the private owner intelligence application; future edits should reinforce its ecosystem-wide scope without creating a second backend.

## Cleanup rules
1. No branch is safe to delete merely because its name looks old, duplicated or experimental.
2. Before branch deletion, check: open PR head, unique commits, files/patch, CI result, deployment/workflow references, release tags, and whether changes were preserved elsewhere.
3. Before file deletion, search all repositories for imports, paths, workflow references, Wrangler bindings, migration dependencies, and documentation links.
4. Keep the current production source/config and migration lineage until a reviewed replacement is proven equivalent.
5. Do not delete databases, R2 buckets, KV namespaces, Workers, DNS records, secrets, backups, or provider settings as part of repository cleanup.
6. Do not merge PRs, deploy, run migrations, modify production settings/secrets, or activate live payment providers as part of this audit.
7. Close stale PRs only after verifying their unique changes are merged/preserved or clearly obsolete and documenting why.

## Initial disposition
- **Delete now:** no repository branches/files have been proven safe to delete from the initial inventory alone.
- **Review for consolidation:** OmniPoint #27/#28 and #30/#31; Otya Server #204/#211; Otya Server architecture/API/identity documentation cluster.
- **Preserve pending validation:** production schema and recovery audits, migration changes, security hardening, and dependency updates with open CI status.
- **Next audit action:** compare every open PR's head/base, changed files, commit ancestry and CI state; produce an explicit per-branch KEEP / CONSOLIDATE / CLOSE / DELETE decision before any destructive cleanup.

## Evidence and limitations
This file records GitHub branch and open-PR search results plus selected PR metadata fetched on 2026-10-27. It is not a full local clone, exhaustive workflow/deployment reference scan, or proof that any branch is unused. Counts and states must be refreshed before a cleanup operation.

## Second-pass file-level review (2026-10-27)

### OmniPoint PRs #27, #28 and #31
- #27 and #28 both change the same core dashboard, inventory actions/pages, bridge product route, Cloudflare Worker API, tests, and Wrangler config. #28 adds the summary bridge route; #27 uniquely changes docs/BUILD_STATUS.md and does not include the summary route. They are not identical and neither should be deleted until those differences are preserved.
- Both #27 and #28 replace the Otya Auth service-binding verification approach with a locally shared HMAC JWT secret. This conflicts with the ecosystem's target of verified Otya Auth tokens and introduces a separate secret/configuration boundary. Do not select either approach just because it is mergeable.
- #31 changes the bridge to forward the HttpOnly Otya access token rather than minting a local JWT, adds a bridge contract test, adds migration 0004 ledger journals, and sets workers_dev=false in source config. This aligns more closely with the shared-identity direction and includes important financial-invariant/security work, but still requires code review, CI, schema-lineage validation, and an explicit release decision. It does not by itself replace all unique dashboard/sales/summary changes from #28.
- Recommendation: preserve #31 as a security/migration candidate; use it as the preferred authentication direction for review, then selectively port any still-needed #28 functionality only after the API contract and tests are reconciled. Keep #27/#28 open until unique changes are accounted for; do not merge or deploy automatically.

### OmniPoint PRs #30 and #31
- #30 contributes migration sequence validation, required-column health checks, production cutover gates, Cloudflare resource inventory, and a real-production runbook. #31 contributes bridge-token contract tests, ledger-journal schema/invariants, Worker exposure hardening, and a production boundary audit. They overlap on Worker/schema tests but neither is a safe replacement for the other.
- Recommendation: consolidate the canonical production facts/runbook with cross-links, while preserving the distinct implementation and ledger changes from #31. Keep production migration blocked until actual live migration history, backup/restore evidence, reviewed forward migration, and cutover approval are complete.

### Otya Server documentation PRs #204, #211, #205, #206 and #207
- #204 adds docs/ECOSYSTEM_READINESS.md, a cross-product readiness register. #211 adds docs/OTYA_SERVER_SOURCE_AUDIT_2026-10-24.md, a separate source/runtime audit. They serve different purposes and should be cross-linked rather than treated as duplicates.
- #206 adds docs/OTYA_OS_MASTER_ARCHITECTURE_V1.md. #207 adds API catalog/template docs and also modifies the same master architecture document, so these PRs have a real overlapping-file conflict risk. #205 adds the separate shared identity contract. Preserve all three contract purposes; consolidate ownership and links after reviewing #207's master-architecture edits against #206.

## Revised disposition after file-level review
- **No destructive cleanup approved yet.** Evidence shows overlapping paths but also unique functionality and security/migration content.
- **Preferred review direction:** #31's token-forwarding bridge over local HMAC token minting in #27/#28, subject to tests and API contract review; #30 remains useful as a release-gate/schema audit.
- **Documentation consolidation:** cross-link #204 and #211; reconcile #206 and #207's shared architecture file without discarding API contract requirements; keep #205 as a distinct identity contract.
- **Next required checks:** refresh all open PR metadata; inspect CI results and base/head ancestry; identify references to candidate branches in workflow/release files; then make a branch-by-branch KEEP / CONSOLIDATE / CLOSE / DELETE manifest.

## Refreshed inventory and full open-PR disposition (2026-10-27)

A fresh query returned 52 open pull requests and these branch counts. Counts are returned search results, not proof of exhaustive refs:
- Otya Server: 24 open PRs; 42 branches.
- OmniPoint: 21 open PRs; 37 branches.
- OtyaPlayer: 6 open PRs; 7 branches.
- OtyaHub: 1 open PR; 2 branches.
- Next: 0 open PRs; 1 branch.

### OmniPoint open PR queue: disposition
| PR | Topic | Disposition |
|---|---|---|
| #31 | Worker exposure/schema audit, Otya token-forwarding bridge, ledger journals | KEEP / security review first. Do not merge until CI, migration lineage and auth behavior are reviewed. |
| #30 | D1 schema/production cutover blockers | KEEP / consolidate docs with #31 while preserving unique CI migration validation, inventory and cutover runbook. |
| #29 | Company-scope/staff-profile migration | KEEP / migration review; validate migration order and actual production schema before execution. |
| #28 | Inventory + cash POS bridge | CONSOLIDATE candidate; preserve summary endpoint and UI functionality not covered elsewhere; do not use local HMAC-token model without a security decision. |
| #27 | Inventory bridge alternative | DO NOT DELETE yet; overlaps #28 but is non-mergeable and has distinct status docs/tests. Extract unique changes before any closure. |
| #23 | Interswitch/Quickteller/Airtel/MTN orchestration plan and optional AWS relay | KEEP as planning branch, not release-ready. AWS relay remains gated on provider confirmation, MFA and budget; no resource creation. |
| #22 | Cloudflare-only, single-shop scope | KEEP as policy baseline; remove stale Supabase/Vercel references only after implementation dependencies are safely migrated. |
| #21 | Owner's own shop focus | KEEP / consolidate into #22 if unique scope and acceptance criteria are retained. |
| #20 | Quickteller provider readiness | KEEP as provider-readiness document; no live payment activation. |
| #19 | D1 migration CI | KEEP / consolidate into canonical CI after verifying it validates the authoritative migration directory. |
| #18 and #17 | Savings groups D1 foundation, competing branches | SCOPE REVIEW / HOLD. Unique code and tests exist but may be outside current own-shop priority. Do not delete until scope is decided. |
| #16 | Interswitch sandbox boundary | KEEP as non-live provider boundary; review overlap with #23 before consolidating. |
| #15 | D1 primary database foundation | KEEP / architecture review; compare migrations/schema with #29-#31 before selecting one migration lineage. |
| #14 | Customer workflows/product value | KEEP / align to own-shop scope; preserve shop-specific workflows. |
| #13 | Cloudflare API security boundary tests | KEEP; based on #11, so preserve dependency chain and test coverage until tests are incorporated into canonical CI. |
| #12 | Live database and launch gates | KEEP / consolidate docs with #30/#31 while preserving facts and approval gates. |
| #11 | Atomic D1 product writes | KEEP until invariant/test changes are present in the chosen D1 API baseline. |
| #10 | Cloudflare platform map | CONSOLIDATE documentation into #22 and Otya Server architecture after preserving useful resource mapping. |
| #9 | Foundation and naming standards | KEEP / consolidate into root README/product language after useful standards are carried over. |
| #1 | Legacy foundation workflow; 45 commits including Supabase/Prisma migrations | DO NOT MERGE into Cloudflare-only direction. Port unique UI, staff-management and ledger-integrity improvements first; then close as superseded. Branch is not safe to delete yet. |

### Otya Server open PR queue: disposition
- #213 ecosystem registry and safe release controls — KEEP / candidate central baseline; review schema, validator/tests and release workflow before merge.
- #211 source readiness audit — KEEP / link to #204. Distinct evidence, currently draft.
- #208 secure MCP platform standard — KEEP / review security requirements.
- #207 API catalog/template — KEEP / reconcile shared architecture file with #206.
- #206 Otya OS master architecture — KEEP / consolidate with #207 without losing API standards.
- #205 shared identity contract — KEEP as distinct contract.
- #204 ecosystem readiness register — KEEP / link to #211.
- #203 resilience/offline messaging — KEEP / check against platform resilience plan.
- #202, #201, #200, #199, #198, #197, #196, #195, #194, #178, #177, #175, #174, #173, #172, #170 — DEPENDENCY REVIEW. Do not bulk-close; verify CI/security advisories and compatibility, especially major-version changes.

### OtyaPlayer and OtyaHub open PR queue: disposition
- OtyaPlayer #163 (grouped Android updates), #153 (AGP 9.4), #152 (Gradle 9.7.1), #150 (release action), #149 (artifact action), #147 (setup-java): DEPENDENCY REVIEW. Major Gradle/AGP changes need Flutter/Android CI and build validation; do not merge or close by title alone.
- OtyaHub #3 service blueprint/pricing: KEEP / align to Otya OS platform map; preserve public developer/partner scope and keep owner-only permissions private.
- Next: no open PR and only main branch returned. Preserve main; no branch deletion candidate identified.

### Branch overlap findings
- OmniPoint feat/omnipoint-cloudflare-dashboard-bridge and feat/omnipoint-cloudflare-dashboard-bridge-v2 overlap in dashboard/inventory/API files but differ in implementation and tests. Resolve only after porting unique functionality and choosing the auth contract.
- OmniPoint feat/savings-groups-core-foundation and feat/cloudflare-d1-savings-integration are on different migration bases and contain substantial overlapping code; neither is a simple duplicate.
- OmniPoint test/cloudflare-api-auth-boundaries is based on fix/d1-api-atomic-product-write, so deleting either parent/child branch without preserving tests would lose coverage.
- Otya Server docs/otya-api-catalog-template-v1 and docs/otya-os-master-architecture share architecture documentation; docs/shared-identity-contract-v1 is a separate contract.
- No file/branch/repository is marked DELETE NOW. Branch deletion requires closing/merging associated PRs and checking remaining references; GitHub guidance: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/deleting-and-restoring-branches-in-a-pull-request

## Explicit cleanup execution status
No pull requests were merged or closed, no branches/files/repositories were deleted, and no production settings, secrets, cloud resources, databases, migrations, or payment flows were changed. This pass establishes an actionable queue, not blanket authorization to destroy uncertain work.
## CI/status spot-check (2026-10-27)
- OmniPoint PR #31 head: GitHub Actions workflow runs reported Verify OmniPoint = success and Security Baseline = success; commit status contexts included CodeRabbit success and Vercel success. This is evidence for this exact head SHA only, not production readiness.
- OmniPoint PR #30 head: Verify OmniPoint and Security Baseline = success; CodeRabbit success; Vercel status = failure with the linked status indicating a build-rate-limit/plan restriction. Treat the Vercel failure as an external check limitation until verified, not proof that the code itself failed.
- OmniPoint PR #28 head: Security Baseline = success; Verify OmniPoint = failure; Vercel status indicated build-rate-limit/plan restriction. It is not merge-ready based on this snapshot; inspect failed workflow job details before deciding what to port.
- Otya Server PR #213 head: Security workflow = success. The workflow named 'Deploy OTYA to Cloudflare' completed with overall success, but its explicit production authorization and deployment jobs (plan/authorize/deploy otya-next/otya-auth/otya-core/live verification) were all skipped. This check did not deploy those Workers according to its job results.
- Otya Server PR #206 head: CodeRabbit status = success; this alone is not a substitute for required CI or architecture review.
- Statuses are commit-specific and can change as PR heads change. Before merge, refresh checks and review every failed, skipped, or pending required check.

## Operational alignment reminder
Vercel status checks may still appear as repository integration metadata even though the desired OmniPoint operational architecture is Cloudflare + GitHub only. Do not use Vercel as an operational hosting/runtime dependency for OmniPoint. A check status by itself does not establish that a Vercel deployment is used by the product.

## Follow-up execution log (2026-10-27)
The following review notes were posted directly to the four open PR conversations so maintainers have repository-local guidance:
- OmniPoint #27: retain its unique `docs/BUILD_STATUS.md`, but do not merge the competing dashboard bridge until its authentication approach, tests, and migration lineage are reconciled with the selected bridge.
- OmniPoint #28: retain the unique `app/api/bridge/summary/route.ts` functionality for porting/review; its local HMAC boundary must be reconciled with the shared Otya identity/auth contract. The recorded Verify OmniPoint failure must be diagnosed before any merge decision.
- Otya Server #206: treat the master Otya OS architecture document as the canonical ecosystem map and reconcile overlapping documentation edits.
- Otya Server #207: preserve the API catalog/template as a distinct artifact and reconcile its shared architecture-document edits against #206 rather than discarding either branch wholesale.

### Next safe cleanup order
1. Review exact current heads and required checks for OmniPoint #31, #30, #22, #21, #15, #11, and Otya Server #213; prioritize the Cloudflare-only single-shop baseline, D1 integrity/security, and registry validation.
2. Resolve the dashboard bridge choice by comparing #27 and #28 against the selected auth contract; port unique files/tests before closing either PR.
3. Review savings-group PRs #18/#17 as deferred scope, not current launch blockers for the own-shop workflow.
4. Review OtyaPlayer Android/Gradle/AGP update PRs independently; major toolchain updates require a reproducible Flutter/Android build.
5. Only after each PR is merged or its unique changes are demonstrably preserved should its head branch become a deletion candidate. Branch deletion is currently not available through the connected GitHub actions, so do not claim deletion has occurred.
6. Do not run live backup exports, D1 migrations, Worker deployments, DNS/secrets edits, payment activation, or cloud-resource creation as part of repository cleanup.

This follow-up adds review traceability only. It does not alter default-branch code, merge/close PRs, delete branches/files, or change production infrastructure.


## Current-head refresh (2026-10-27)
A fresh read of the selected pull requests confirmed the following exact heads and repository status snapshots:
- OmniPoint #31 `security/production-worker-exposure-and-d1-audit-2026-10-24`, head `e3b770c9439b5cd20cc5e457085c5cea4def616d`: CodeRabbit and Vercel statuses are green, but the roadmap still allows Supabase as a future recovery target. This conflicts with the owner's current Cloudflare + GitHub only decision; a review note now asks to remove that target and avoid implying Vercel is operational runtime. The `workers_dev = false` change remains source-only until separately approved deployment.
- OmniPoint #30 `audit/otya-hold-ownership-and-schema-status`, head `0fc1ceb5b6c1c72f510a6f97200aa6676bd3ed74`: Vercel status is failing due to a build-rate-limit/plan restriction; CodeRabbit is green. Do not treat this external check as application-test evidence.
- OmniPoint #22 `chore/cloudflare-only-own-business`, head `c283066ccf256bbb490ea923627750af1b4627e6`: CodeRabbit and Vercel statuses are green. It is stacked on #21, so preserve dependency ordering and validate the complete combined change before merge.
- OmniPoint #21 `feat/own-shop-agent-operations`, head `1ac03ec2ebe1ee304ac2f543af06852f722598b9`: base is `docs/quickteller-provider-readiness`, not `main`. It is part of a stacked branch chain; do not merge or rebase independently without reconciling its base and dependent PRs.
- OmniPoint #15 `feat/cloudflare-d1-primary-database`, head `651a4a9cded806f7ea4767e1d3baacd22fbd6f7e`, and #11 `fix/d1-api-atomic-product-write`, head `7c571d9699e920c67d95ba905449d6679117cd0a`: current visible CodeRabbit/Vercel statuses are green, but status labels alone do not prove D1 migration lineage, accounting invariants or required Actions checks have passed.
- Otya Server #213 `build/unified-ecosystem-control-plane-2026-10-24`, head `d79249891cfd77a1892993f78c9b58a9a3a27421`: backend validation and Security workflows passed in the inspected run. Production plan/authorization/deploy/live-verification jobs were skipped. A review note flags an apparently duplicated `Verify core trust surfaces` step in the workflow diff for deduplication before merge.

These are head-specific snapshots, not permanent CI conclusions. No merge, close, branch deletion, or production change was performed in this refresh.


## Owner-confirmed platform boundary (2026-10-27)
The owner explicitly confirms that **Supabase and Vercel are not part of the system**. For OmniPoint, the approved operational platform is **Cloudflare + GitHub only**. Appwrite is also excluded from the OmniPoint operational architecture.

- Cloudflare owns OmniPoint's operational runtime/data services: Workers, D1, R2, and other Cloudflare capabilities only where justified.
- GitHub is the source-control and CI/CD system.
- Supabase must not be proposed as OmniPoint primary storage, auth, backup/recovery, synchronization, failover, or operational dependency.
- Vercel must not be proposed as OmniPoint hosting, API runtime, production deployment or required build/release dependency. Vercel status checks may remain as historical repository integration metadata; they are not deployment evidence.
- Existing Supabase/Prisma/Vercel/Appwrite references are legacy inventory until safely replaced. Remove or retire them in reviewed changes after checking dependencies, routes, migrations, build config and tests; do not blindly delete code that may still be carrying required behavior.
- Shared identity should use Otya Auth only after the token verification and local staff-membership contract is tested. OmniPoint's D1 remains its authoritative business database, isolated from other Otya product data.
- Cloudflare-native recovery means private R2 backups/exports, integrity manifests and a demonstrated restore—not a second SaaS database.

### Changes made to reflect the decision
- Updated OmniPoint PR #31 branch file `docs/IMPLEMENTATION_ROADMAP.md` in commit `dc62012e3f86319180b1e30c48cfc98ad76b9d59` to replace the prior Supabase policy with an explicit Cloudflare + GitHub only policy.
- Posted alignment notes to OmniPoint #31, #22, #15 and Otya Server #206, #204.
- Required next: inventory and remove stale operational dependencies through reviewed changes; verify Cloudflare-only builds and tests; then reassess merge readiness. No PR was merged or closed and no production infrastructure was changed.
