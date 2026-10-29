# Otya Ecosystem — Coordinated Branding and Rename Runbook
Status: owner-requested migration plan; implementation must be staged and reviewed. Updated 2026-10-29.

## Goal
Use the current major backend upgrade to align customer-facing names, repositories, applications, services, email, Cloudflare resources and documentation under one Otya family—without breaking existing users, data, authentication, app installs, links or financial records.

## Canonical brand system
- **Otya Hold Ltd** — legal parent company.
- **Otya OS** — unified platform and ecosystem shell.
- **Otya End** — shared backend, identity integration, API contracts, service registry, event orchestration and operations. Existing repository slug `Otya-Server` is a legacy technical identifier until migration is approved.
- **OtyaPoint** — the owner's shop/retail/mobile-money agency application. Existing repository slug `OmniPoint` and `omnipoint-` resource names are compatibility identifiers until migration is approved.
- **Otya Media** — media player. Existing repository slug `OtyaPlayer` and Android application ID `com.otyaplayer.app` stay unchanged until compatibility/release migration is designed.
- **OtyaHub** — public developer and partner community.
- **Resend** — first-class shared email provider/integration within Otya End, not a separate product to forget or remove. It supports approved account/security notifications, recovery communications, operational notices, and product messaging under controlled templates and sender identities.

## Naming policy
Use canonical names in new documentation, UI, logs, service catalog entries, release notes and newly created resources. Preserve old names where they are required for historical records, legal context, package identifiers, API compatibility, DNS, OAuth callbacks, release signing, migrations, repository redirects or existing links. Add an alias map rather than performing blind global replacements.

## Migration phases and gates
### 0. Inventory and ownership (read-only)
Record each GitHub repository, workflow, package ID, domain, Cloudflare Worker, D1, R2 bucket, KV namespace, Queue, Pages project, service binding, Resend domain/API key scope/webhook/template and connected app. Record canonical name, legacy name, owner, environment, consumers, data class, health check, rollback and migration status. Do not expose secret values.

### 1. Brand source of truth
Keep this runbook and the Otya End service registry as the source of truth. Add aliases to API documentation and service metadata. Decide the still-unclear customer-facing name for the existing `Next`/owner-intelligence product before renaming it; do not invent a final public name.

### 2. Customer-facing surfaces
Update website headers, application titles, app icons, metadata, help/support copy, docs, release notes, error pages and Resend templates in reviewed changes. Keep legal company identity correct. Do not change Android package IDs or signed release identity as a cosmetic edit.

### 3. Repository slugs
Proposed targets:
| Current repository | Target name | Gate |
|---|---|---|
| `PeterSmartLink/Otya-Server` | `PeterSmartLink/Otya-End` | Audit links, workflow checkout URLs, badges, secrets, webhooks, deployments and clones |
| `PeterSmartLink/OmniPoint` | `PeterSmartLink/OtyaPoint` | First establish the Cloudflare-only runtime and isolated API deployment path |
| `PeterSmartLink/OtyaPlayer` | `PeterSmartLink/OtyaMedia` | Preserve package ID, signing, release URLs and update mechanism |
| `PeterSmartLink/OtyaHub` | Keep `OtyaHub` | Already aligned |
| `PeterSmartLink/Next` | Undecided | Owner must approve a product name |

Repository renames are a separate explicit operation after dependency inventory. Do not create replacement repositories and strand existing code or issue history.

### 4. Cloudflare resources
Map old resource names to canonical service names first. Proposed future names such as `otya-end-auth`, `otya-end-core`, and `otyapoint-dev-api` are targets only, not current facts. Before changing a Worker or resource name, validate every service binding, custom route, environment, D1/R2/KV/Queue binding, Pages integration, OAuth callback, CI workflow and rollback. Resource renames/deployments and DNS changes require explicit approval.

### 5. Resend integration and branding
- Keep Resend in the official service registry and architecture diagrams.
- Inventory sender domains, templates, webhook endpoints, event subscriptions, API-key scope and delivery metrics read-only first.
- Use shared branded templates with product-specific sender/reply-to identities only where the domain is verified and owner-approved.
- Keep API keys and webhook secrets in protected Worker/GitHub environment secrets; never put them in client code or logs. Prefer domain-scoped keys.
- Verify inbound webhook signatures using the raw request body; treat email content as untrusted input. Do not allow an email alone to approve payments, change roles or perform other privileged actions.
- Route non-urgent mail through durable queues with retry/idempotency; business transactions must not depend on synchronous email delivery.
- Do not change MX, SPF, DKIM, DMARC, sender domains or live webhook registrations during the inventory phase.

### 6. Runtime and data migration
Move active OtyaPoint paths to the approved Cloudflare Workers/D1 design through tested compatibility layers. Do not remove Supabase/Prisma dependencies until source scans and runtime tests prove no active path needs them and any data that must be retained has been exported and verified. No customer/financial rows should be copied into documentation or tests.

### 7. Verification and release
Every change requires build/lint/type checks, unit and integration tests, broken-link/reference scans, authorization and tenant-isolation tests, migration rehearsal, backup/restore evidence, monitoring and rollback instructions. Deploy to an isolated preview only after its actual route/bindings are verified. Production deployment, DNS changes, live payment capability, destructive data actions and repository/resource renames require explicit owner approval.

## Current known blockers
- OtyaPoint's active Supabase/Prisma paths need safe migration, not blind package deletion.
- `omnipoint-dev` records migrations 0001–0003; migration 0004 is not applied, and the inspected live Worker inventory did not show a deployed Worker bound to it.
- `otya-store-db` is shared by `otya-core` and `otya-next`; ownership and least-privilege need review.
- `otya-auth-db` contains auth tables but its migration tracking table had no applied rows.
- A dependency audit reported critical/high advisories requiring a patched, tested dependency update.
- Resend is configured in observed Worker integration surfaces, but end-to-end delivery, webhook verification and sender-domain readiness are not yet proven.

## Definition of done
The canonical branding is consistent; legacy aliases and links remain functional; repository/resource ownership is explicit; Resend is documented and tested as a first-class integration; Cloudflare-only OtyaPoint data paths are verified; security and financial invariants pass; restore and rollback are demonstrated; and no production change occurs without approval.
