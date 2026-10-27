# Otya Ecosystem — Website, App and Service Map

**Review date:** 2026-10-27  
**Status:** Architecture alignment document on an isolated branch. No domain, DNS, routing, production or application changes are authorized by this document.

## Direct answer: do we need two websites?

**No, we should not create two competing public Otya websites.** Keep one canonical public Otya website and make the other products/apps connected destinations within the same ecosystem. A public website and a private authenticated application are different surfaces, not necessarily two independent websites or brands.

The current source documents identify `petersmartlink.com` as the existing Otya public website and list public routes/surfaces such as `/docs`, `/ai`, `/my-account`, `/otya-player` and product downloads. They also identify separate existing subdomains for docs, status and space. The exact live routing and ownership must be verified against the current Cloudflare configuration before any changes.

The recommended target is:
- One canonical public marketing/product website for **Otya**.
- One authenticated **Otya Workspace** experience, which can expose the owner's Next interface and approved product operations.
- OmniPoint as a business application/workspace within that ecosystem, not a second public marketing brand/site.
- OtyaHub as the public developer/partner/docs entry point; it can remain a separate public GitHub project and may link into the canonical public website. It should not duplicate the full marketing website.
- Otya Media as a separate Android product, supported by Otya website product/download pages and its own app release lifecycle.
- Existing support/status/docs/account routes remain distinct functions, even if they share the canonical domain and design system.

A separate app subdomain or route is a deployment decision, not a requirement to launch a second website. Do not alter DNS, custom domains, Worker routes or existing links until the live route inventory and rollback plan are reviewed.

## Product map and ownership boundaries

| Product/surface | Purpose | User audience | Data / authority |
|---|---|---|---|
| Otya public website | Product information, onboarding, support entry points, policies, downloads | Public | Public-safe content only |
| OtyaHub | Public developer/partner docs, public API examples and community-facing materials | Developers/partners | Public-safe documentation; never secrets/private infra |
| Otya Workspace | Authenticated account, settings, approved product entry points and management | Signed-in user/owner as authorized | Otya Auth for identity; product-scoped APIs for data |
| Next | Owner's private assistant on Android, voice/conversation, status, approvals and operational activity | Owner only | Otya control plane; step-up authorization for sensitive actions |
| Otya Server | Shared control plane: Auth, core APIs, email transport via Resend, releases, notifications and approved service integrations | Internal service-to-service; public API surfaces as designed | Shared identity/control plane; not a catch-all product database |
| OmniPoint | The owner's shop operations: inventory, POS, retail ledger, agency workflow, float and reconciliation | Authorized shop staff/owner | Dedicated OmniPoint Worker and its own D1/R2/queue namespace; separate retail and agency ledgers |
| Otya Media | Offline-first media playback, local library, local transfer/private media | End users | Local media stays on device by default; optional Otya services remain optional |

## Core architecture rules

1. **One ecosystem does not mean one giant application or database.** Share identity, design conventions, observability and approved API contracts; keep product data and permissions scoped to the owning service.
2. **Otya Server is the shared control plane, not the owner of all business records.** OmniPoint's inventory, sales and agency records stay in OmniPoint's dedicated data domain.
3. **Next is the owner experience, not a second backend.** It requests scoped operations through APIs and never bypasses server-side authorization.
4. **OtyaHub is public.** It must not expose private source, internal endpoints, account data, secrets or admin workflows.
5. **Resend remains centralized.** Otya Server owns transactional email transport and templates. OmniPoint must not require its own Resend API key.
6. **Cloudflare is the target runtime for the ecosystem.** GitHub is source control and CI. Do not introduce new Supabase, Appwrite or Vercel dependencies into the target OmniPoint architecture. Legacy dependencies are retained temporarily only as a controlled recovery/migration path until a tested cutover is approved.
7. **No dual writers.** Each data domain has one authoritative writer per release. Do not write the same OmniPoint financial event to legacy PostgreSQL and D1 concurrently.
8. **No fake-live UI.** Sample records and demo metrics must be unmistakably labelled. If the real API is unavailable, show an error or empty state rather than quietly replacing real data with sample figures.
9. **Web and Android share the same OmniPoint API contract.** The browser and APK are untrusted clients; server-side role, branch, company and transaction checks remain authoritative.
10. **Payments remain disabled until verified.** Provider-confirmed status, idempotency, reconciliation, reversals, audit and sandbox tests are mandatory before live execution.

## Website/app navigation recommendation

The public Otya website should explain Otya and link to its products. After sign-in, users should see only destinations they are authorized to access. For the owner, Next is the primary owner-assistant surface; OmniPoint should be an explicitly separate business workspace. Staff users should enter OmniPoint directly and should not receive owner-level Next/Admin access by default.

Use shared components and visual tokens where practical, but keep each product's navigation focused. Do not put all product functions into one overloaded dashboard.

## Migration and release sequence

### Phase A — map before editing
- Verify the actual Cloudflare routes, custom domains, Worker entry points and public pages.
- Map every GitHub repository and branch to its deployed product/surface.
- Inventory existing login, email, support, downloads and account flows.
- Identify overlapping dashboards and mark which is canonical, transitional, recovery-only or public.

### Phase B — consolidate experience without deleting assets
- Keep the current public Otya website as the canonical public entry point.
- Design one shared navigation/brand system with links to authorized product surfaces.
- Make OmniPoint a connected business workspace, not a duplicate Otya marketing site.
- Preserve OtyaHub as the public developer/partner channel.
- Preserve Next as the owner's private Android-first interface.
- Keep old links working until route replacements and redirects have been tested.

### Phase C — consolidate services and data safely
- Keep Otya Auth as shared identity; use product-specific membership/authorization.
- Keep Resend behind Otya Server.
- Keep OmniPoint's D1, R2 and queue resources isolated.
- Finish schema parity, backup/restore, API contract and integration tests before changing runtime data paths.
- Keep legacy recovery paths until data and rollback are verified; never delete them just to make the architecture look cleaner.

### Phase D — validate and release
- Preview all public and authenticated navigation.
- Test web and Android against the same isolated OmniPoint API.
- Test signed-out, unauthorized, inactive staff, cross-branch and expired-session cases.
- Test low-bandwidth mobile layout, accessibility, errors, backup restore and rollback.
- Request explicit approval before any production route, DNS, secret, migration, deployment, deletion or payment activation.

## Current evidence limits

This document consolidates the current repository architecture and known product decisions. It does not prove that all listed domains currently point to the intended Workers, that all public routes are live, or that web/Android integrations are complete. Those require a fresh live Cloudflare route/domain inventory and test results. No production change is made by this document.
