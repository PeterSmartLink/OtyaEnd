# Otya Ecosystem — Consolidation and Cleanup Plan
Status: proposed target architecture based on current read-only inventory. No resources or branches are deleted by this plan. Updated 2026-10-29.

## Objective
Reduce the number of services, repositories, branches, Cloudflare resources, duplicate workflows and competing documents that the owner must manage. Prefer a small set of clear components with explicit responsibilities. Do not create a new service or repository unless a concrete isolation, scaling, security or ownership requirement justifies it.

## 1. Operating rules
1. One canonical name per product/service; old names are aliases only where compatibility requires them.
2. One source of truth for architecture, service inventory, environment names and operating procedures.
3. Keep production and preview isolated, but do not create separate services solely to represent a stage.
4. Prefer modules inside an existing Worker/repository over a new Worker/repository when security, performance, deployment and ownership boundaries remain sound.
5. A component is removable only after code references, bindings, routes, secrets, scheduled jobs, webhooks, data ownership, traffic and recovery requirements are checked.
6. Archive/disable only after evidence and an owner-approved rollback window. Never delete data or backups as routine cleanup.
7. Do not add an AWS relay, extra database provider, extra frontend host or another email provider unless a specific requirement cannot be met by the existing approved stack.
8. Resend is a first-class integration of Otya End; do not remove or duplicate it. Keep one shared adapter/contract and product-specific templates/configuration.

## 2. Repository target: three active product repositories plus optional community repository
| Target | Keep/merge into it | Do not put here |
|---|---|---|
| **Otya End** (current repo slug `Otya-Server` until rename is separately approved) | Shared auth contracts, service registry, common API contracts, shared Cloudflare Worker services, Resend adapter, operational/security tooling and ecosystem documentation | OtyaPoint retail ledger tables or Android app source |
| **OtyaPoint** (current slug `OmniPoint`) | Shop web/mobile interface, product-owned Cloudflare API/Worker, D1 migrations, retail/stock/sales/agency ledger, payment-provider adapters and tests | Separate duplicate backend repository, Supabase runtime dependency, generic public-platform features not needed for the owner's shop |
| **Otya Media** (current slug `OtyaPlayer`) | Flutter/Android app, media playback and release/update workflows | Shared identity/backend implementation copied into the app |
| **OtyaHub** | Keep only if the public developer/partner community has active standalone content and workflows; otherwise migrate its useful content to Otya End docs and archive after link/history review | A second private backend or duplicate documentation portal |
| **Next** | First determine whether it is an independent product or merely AI/support/admin features. Prefer merging reusable features into Otya End as modules and the owner UI into the single Otya OS console if there is no independent product boundary. | A separate service/repository just because the code was started separately |

Do not turn this into a monorepo merely for the appearance of having one repository. OtyaPoint and Otya Media have different build, release, signing and security requirements; separate product repos are justified. The target is fewer duplicated responsibilities, not forced code co-location.

## 3. Branch policy: one permanent branch, at most two
- `main` is the canonical protected branch and the only permanent development/release source.
- Optional `staging` only if the owner needs a stable integration branch and it has a defined deployment purpose. If previews can be generated from pull requests, do not create it.
- All feature, fix, cleanup, security and branding branches are temporary pull-request branches. Merge only after required checks and review; delete the branch after merge.
- Group related changes into a small number of coherent PRs per repository (e.g. one branding/consolidation PR, one security/dependency PR, one application/runtime PR) instead of creating a new branch for every tiny update.
- Dependabot branches are automated temporary branches and should not be counted as permanent branches; configure grouped updates and merge only after tests.
- Never merge PRs solely to reduce counts. First compare diffs, tests, base branches, migration ordering and overlap. Superseded PRs should be marked superseded/closed only after useful commits have been preserved or cherry-picked into the chosen consolidation branch.
- Do not delete branches that contain unmerged work until the work is accounted for. Never force-push over unrelated changes.

## 4. Cloudflare target simplification
### Workers
Observed inventory includes `otya-auth`, `otya-core`, `otya-next`; OtyaPoint configuration names `omnipoint-dev-api`, but the inspected live Worker inventory did not show that Worker deployed.
- Keep a dedicated authentication boundary if it is truly the issuer/verifier and can be tested independently.
- Evaluate folding `otya-next` AI/support routes into `otya-core` as a module if they do not require independent credentials, scaling, data access or failure isolation. This is a candidate, not an instruction to delete the Worker.
- Prefer two shared Workers at most for the core ecosystem (auth + core) unless measured isolation requirements justify more.
- OtyaPoint's own API should remain product-owned; it may be deployed as a separate Worker or a clearly isolated module depending on routing, bindings and authorization. It must not share privileged retail data access with general AI/support endpoints.
- Do not create a new Worker until the existing Worker/route/binding mismatch is resolved.

### D1 databases
Observed: `otya-auth-db`, `otya-store-db`, `omnipoint-dev`.
- Preserve a dedicated identity database for auth, subject to schema-provenance and migration-ledger reconciliation.
- Keep OtyaPoint retail/agency records in a product-owned D1 database with ordered migrations and strict company/role scope.
- Audit `otya-store-db`: it is currently shared by `otya-core` and `otya-next`. Assign every table to an owner; migrate data only after proving source/target counts, constraints, IDs, permissions and rollback. If it only contains shared platform state, keep it; if it mixes unrelated product data, separate by ownership.
- Do not maintain both `omnipoint-dev` and another duplicate OtyaPoint database as active sources of truth. Pick a single canonical database per environment after live binding and data checks.
- Never delete a database because it looks like a test database; first establish whether it contains real operational data and prove a restore.

### R2
Observed: `otya-assets`, `otya-player-releases`, `omnipoint-dev-private`, `omnipoint-dev-backups`.
- Keep release artifacts separate from general assets to protect signed releases and update integrity.
- Keep private application files and backup storage private and access-controlled. Do not combine backups with ordinary assets.
- Evaluate whether `otya-assets` is genuinely used by multiple products; if yes, keep one shared bucket with prefixes and explicit access policy rather than creating per-product asset buckets. If not, assign it to its actual owner.
- Remove no bucket until object inventory, access logs/references, retention, lifecycle rules and restore evidence are checked.

### Queues
Observed eight queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`, `omnipoint-dev-jobs`, `omnipoint-dev-jobs-dlq`.
- Keep dead-letter queues paired with their producer queues.
- Consider one shared jobs queue plus one release-events queue and one notification/push queue only if message schemas, retention, consumers, retries, permissions and failure isolation can safely be shared.
- Do not combine financial jobs with generic AI/push jobs unless consumer idempotency, ordering, retry and access policies are proven compatible.
- Remove unused queues only after checking producers, consumers, scheduled triggers and backlog/DLQ contents.

### Pages and other services
- `omnipoint-relay-lab` is a lab project, not the main app. Keep it only if the isolated relay lab is still needed; otherwise archive after checking AWS relay references and access. Do not promote it to the production UI by accident.
- Cloudflare is the approved app/backend foundation. No Supabase, Appwrite or Vercel runtime dependency should be introduced to OtyaPoint without explicit approval.
- Do not add another email provider; keep Resend integrated via Otya End.

## 5. PR and documentation consolidation
Current read-only GitHub inventory shows many open PRs and topic branches in Otya End, OtyaPoint and Otya Media, including overlapping branding, architecture, audit and runtime-foundation PRs.
- Establish one canonical umbrella PR per repository for related safe branding/docs consolidation, but keep code/security fixes in separate PRs when they need independent testing or rollback.
- Compare and consolidate duplicate branding PRs across repositories into the shared canonical naming map.
- Consolidate repeated architecture, readiness, cloudflare migration and product-scope documents into a short index plus one authoritative document per topic.
- Keep issue/PR history for auditability; close superseded PRs with a link to the canonical replacement rather than deleting records.
- Do not create new branches for documentation-only changes when the active consolidation PR can safely contain them.

## 6. Cleanup sequence
1. **Read-only inventory:** enumerate open PRs, branches, workflow files, code references, Cloudflare bindings/routes, databases/migrations, bucket object counts, queue consumers/DLQs, Resend domains/templates/webhooks, and product ownership.
2. **Select canonical work:** choose the best existing active branch per repository; merge related changes into it and close only proven duplicates.
3. **Fix security and correctness:** dependency advisories, migration ledger, authz, idempotency and Worker health checks.
4. **Unify app/runtime:** establish one OtyaPoint runtime and D1 source of truth per environment; verify Resend adapter and shared auth.
5. **Brand surfaces:** update names in UI/docs/templates without breaking package IDs, domains, old links or signed releases.
6. **Preview and evidence:** run checks, tests, isolated integration tests and restore rehearsal.
7. **Resource cleanup:** after no-reference checks and an owner-approved change list, remove redundant non-production resources and branches; monitor a rollback window.
8. **Rename repository/resource slugs:** only after all references, workflows, bindings, callbacks and external consumers are ready.
9. **Production release:** separate approval with explicit diff, backup/restore evidence, rollback plan and no live payments unless separately approved.

## 7. Immediate decisions recommended
- Use `main` only as the permanent branch; do not add `staging` unless a real deployment workflow requires it.
- Treat all existing non-main branches as temporary work-in-progress; do not delete them until each open PR's useful changes are preserved or explicitly abandoned.
- Keep three active product repositories: Otya End, OtyaPoint and Otya Media. Decide OtyaHub and Next only after confirming active usage and dependencies.
- Target two shared Otya End Workers (auth + core) unless evidence justifies keeping a separate AI/support Worker.
- Keep separate identity and OtyaPoint product data; reconcile the shared store DB before any merge/removal.
- Keep Resend as the single shared email provider.
- Never delete a database, bucket, queue, secret, domain or production Worker based on name alone.

## Definition of done
A new maintainer can find the canonical repo, branch, database, Worker, email provider and runbook for each responsibility in one registry; there are no unexplained active resources; each product has one source of truth per environment; all old names are either intentional compatibility aliases or retired with evidence; and the owner no longer needs to manage dozens of permanent branches or duplicate services.
