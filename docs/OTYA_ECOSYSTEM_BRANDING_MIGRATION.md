# Otya Ecosystem — Branding Migration Plan
Status: migration plan for review; no GitHub repository slug, package identifier, domain, Cloudflare resource or production route is renamed by this document.

## Canonical brand map
- Legal parent: **Otya Hold Ltd**
- Operating business and shop app: **OtyaPoint**
- Unified platform and ecosystem shell: **Otya OS**
- Shared backend and integration plane: **Otya End**
- Media player: **Otya Media**
- Public developer/partner hub: **OtyaHub**
- Owner intelligence app currently in repository `Next`: retain its internal product name until the owner confirms whether it should be branded as Otya OS Console, Otya Owner, or another product. Do not invent a final consumer-facing name.
- Legacy company/brand references such as PeterSmart Link, PeterSmartLink, OmniPoint and Otya Server should be replaced in customer-facing surfaces only after checking legal/business context, URLs, integrations and historical records. Retain them where required for legal history, package IDs, repository slugs, API compatibility, migrations, audit trails or existing links.

## Rename sequence
### Phase 1 — safe brand surfaces (this migration)
- Update repository descriptions and README/product documentation through reviewed PRs.
- Add an ecosystem brand map and naming rules.
- Do not change runtime identifiers or URLs yet.
- Keep all PRs unmerged until CI and link checks pass.

### Phase 2 — source and UI branding
- Search all source, Android labels, icons, web metadata, app manifests, email templates, error pages, API docs, package names and support/help content.
- Replace customer-facing OmniPoint with OtyaPoint and Otya Player/Otya with Otya Media where appropriate.
- Keep Android package `com.otyaplayer.app`, signing identity, database table names and API routes unchanged until an explicit compatibility migration is designed.
- Preserve internal legacy names in migration history and comments where useful.

### Phase 3 — GitHub repository names
Proposed destination slugs:
| Current repository | Proposed repository name | Reason |
|---|---|---|
| `Otya-Server` | `Otya-End` | Shared backend |
| `OmniPoint` | `OtyaPoint` | Shop/agency application |
| `OtyaPlayer` | `OtyaMedia` | Media player |
| `Next` | **Undecided** | Owner intelligence product; avoid an arbitrary public-facing rename |
| `OtyaHub` | Keep `OtyaHub` | Correct public community identity |

Before renaming each repo, inventory GitHub Actions, badges, workflow checkout references, Dependabot, release automation, package links, webhooks, app integrations, clones/remotes, deployment configuration and any documentation that hard-codes the old URL. GitHub redirects old repository URLs, but scripts, secrets, deployment hooks and external integrations still need verification.

### Phase 4 — Cloudflare naming and domains
- Map each Worker, D1 database, R2 bucket, KV namespace, Queue, Pages project, custom domain and service binding to its owning product and environment.
- Keep current Worker/service names until dependent bindings, routes, environment variables, CI workflows and rollback plans are tested.
- Prefer clear names for newly created resources, e.g. `otya-end-auth`, `otya-end-core`, `otyapoint-dev-api`, but do not rename a live Worker or D1 resource as a cosmetic-only change.
- Domain migration is a separate project. Preserve `petersmartlink.com` routes while branded domains, TLS, redirects, cookies, OAuth callbacks, email DNS and provider allow-lists are validated.

## Required checks for each change
- Build/lint/type checks and unit/integration tests pass.
- No secrets, customer data or financial records are copied into docs.
- Existing URLs, app IDs, release signatures and provider callbacks remain valid or have a tested compatibility plan.
- Cloudflare resource bindings, queues, D1 migrations and backups have a rollback/recovery plan.
- Production deploy, DNS, payment provider and data migration changes require explicit release approval.

## Current blockers discovered
- OtyaPoint has Supabase client/package paths and a separate Cloudflare Worker/D1 path; complete the runtime migration before removing legacy services.
- The OtyaPoint D1 database exists with migrations 0001–0003 but the proposed sale fingerprint migration 0004 is not applied.
- The inspected Cloudflare Worker list did not include a deployed `omnipoint-dev-api` Worker.
- `otya-store-db` is shared by `otya-core` and `otya-next`; data ownership needs review.
- `otya-auth-db` has auth tables but no rows in its migration tracking table.
- A dependency security workflow reported critical/high findings; fix and verify before production release.

## Decision record
The owner explicitly requested a coordinated rebrand during major upgrades. This document records the intended naming, but does not authorize destructive data removal, DNS changes, production deployment, live payments or any migration that could break existing users.
