# Otya OS — Ecosystem Naming and Repository Standard

**Owner:** Otya Hold Ltd  
**Status:** Proposed canonical standard, committed to an isolated planning branch on 2026-10-27. This is not authorization to rename GitHub repositories, Android package IDs, domains, DNS records, Worker names, database names, or production services.

## Canonical identity

- **Legal company:** Otya Hold Ltd
- **Operating business:** Otya Hold Ltd T/A OmniPoint
- **Ecosystem / unified operating model:** Otya OS
- **Shared backend and control plane:** Otya Server
- **Private owner assistant:** Next
- **Shop operations application:** OmniPoint
- **Offline-first media application:** Otya Media
- **Public developer and partner hub:** OtyaHub
- **Transactional email:** Resend, centrally managed through Otya Server
- **Source control and review:** GitHub
- **Runtime, data and delivery target:** Cloudflare

## Public website and application model

Maintain one canonical public Otya marketing/product website. Product workspaces may have separate authenticated routes or app experiences, but should not create competing marketing websites.

The existing public hostname is `petersmartlink.com`. Existing subdomains for docs, status and space must remain unchanged until their live routes and replacement/retention plan have been reviewed. This standard does not authorize DNS or route changes.

OtyaHub is the public developer/partner repository and documentation entry point. It complements the canonical website rather than duplicating the whole marketing site.

## Product boundaries

- **Otya Server** owns shared identity integration, service contracts, centralized email transport, approved notifications and control-plane APIs. It is not a catch-all database for product business records.
- **OmniPoint** owns its shop data: products, stock, sales, staff membership, agency workflows, ledgers, reconciliation and business audit records. These stay in OmniPoint's own Cloudflare data domain.
- **Next** is owner-only. Its client cannot contain server secrets or bypass server-side authorization. Sensitive actions require scoped authorization and approval.
- **Otya Media** remains offline-first. Local playback must not depend on the cloud, and its release/package migration must not be mixed with OmniPoint work.
- **OtyaHub** contains only public-safe documentation, examples and release information.

## Resend and shared integrations

Resend is a centralized ecosystem service. Otya Server owns email credentials, sending policy, templates and provider-facing integration. Product applications call an authenticated Otya Server API or approved event workflow; they must not introduce independent Resend keys or duplicate email-delivery logic.

Other shared providers must follow the same rule: shared capability is exposed through a documented service contract, with each product retaining its own authorization and business-data boundaries.

## Naming rules

1. Use **Otya** in public product copy, not all-caps **OTYA**, unless a legacy identifier or protocol requires it.
2. Use **Otya OS** for the connected ecosystem, not as a substitute name for every app.
3. Use **Otya Server** for the shared control plane; do not call it a generic database or claim it contains all product data.
4. Use **Otya Media** in user-facing product text. Existing repository names, application IDs, signing identities, download paths and API identifiers may remain temporarily for compatibility.
5. Use **Otya Hold Ltd** for the company. Use **Otya Hold Ltd T/A OmniPoint** when describing the physical business. Do not invent a different legal entity name.
6. Use **Next** for the private owner assistant. Never imply that it is a public customer chatbot or give it default access to shop staff.
7. Keep product repository names stable during the first naming pass. Repository renames can break CI, remotes, package references, OAuth callbacks, release workflows, badges, integrations and links; only rename after a dependency/reference inventory and rollback plan.

## Repository organization

Every repository should have:
- a README that states its single responsibility, owner, boundaries and status;
- a link to the ecosystem naming standard or product contract;
- an explicit current/release status (not just “build passed”);
- setup and validation instructions that match the actual scripts;
- no committed secrets, customer data, production exports or private endpoints in public repositories;
- no claim of live provider functionality unless end-to-end verification proves it.

Suggested responsibilities:
- `Otya-Server`: shared control plane and service contracts.
- `OmniPoint`: shop/agency application and dedicated business API.
- `Next`: private owner assistant.
- `OtyaPlayer`: current source repository for the user-facing product **Otya Media** until a compatibility-reviewed rename is completed.
- `OtyaHub`: public developer/partner materials.

## Safe migration sequence

### Stage 1 — documentation and naming
Align READMEs and docs with this standard. Do not change production identifiers.

### Stage 2 — source and dependency inventory
Search all repositories and workflows for old names, repository URLs, package IDs, Worker names, domains, API paths, secrets references, release assets, badges and OAuth callback URLs.

### Stage 3 — compatibility plan
Classify each identifier as public copy, internal code name, stable API/route, release/package identity, infrastructure resource, or legacy alias. Choose explicit redirects/aliases where supported and document rollback.

### Stage 4 — isolated implementation and verification
Change one boundary at a time on branches. Run the repository's real tests, build, security checks, and compatibility tests. Review diffs before merge.

### Stage 5 — explicitly approved release
Only after owner approval, schedule repository/domain/package/Worker renames or deployment changes. Keep rollback and recovery available. Never perform a broad rename and production cutover as one unreviewed operation.

## Data and release invariants

- Cloudflare is the target runtime and primary data platform for OmniPoint; do not add new Supabase, Appwrite or Vercel dependencies to the target design.
- Existing legacy data/services may be retained temporarily for recovery and migration validation; they are not a second writable primary.
- One authoritative writer per data domain; never dual-write financial events to separate stores.
- Sample/demo data must be explicitly labelled. API failures must not silently display sample values as live business figures.
- Provider execution remains disabled until partner approval, credentials, idempotency, verified callbacks/status, reversals, reconciliation, audit controls and sandbox tests pass.
- No production data migration, DNS/route change, secret modification, deployment, repository rename or live payment action is authorized by this document.
