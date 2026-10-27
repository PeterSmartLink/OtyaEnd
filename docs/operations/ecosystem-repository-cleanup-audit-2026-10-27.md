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
