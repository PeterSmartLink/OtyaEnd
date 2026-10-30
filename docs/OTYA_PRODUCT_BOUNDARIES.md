# Otya ecosystem product boundaries

**Company:** Otya Hold Ltd.  
**Architecture:** one connected Otya family, shared services, separately owned product data.  
**Status:** target contract; this document does not claim that all listed connections are deployed.

## Product map

| Component | Responsibility | Data and permission boundary |
| --- | --- | --- |
| **Otya Server** | Shared identity, API governance, service registry, central integrations, notifications, operational coordination and audit contracts | Does not become the database for all products. A shared login is not blanket authorization. |
| **Otya OS** | Unified product experience and operating model for connected Otya services | Coordinates through authenticated APIs/events; does not bypass product authorization or write another product's tables directly. |
| **Otya Next** | Private owner assistant/intelligence interface: conversation, voice, system health, incidents, releases, approvals and approved actions | Owner-only scopes, step-up verification and explicit approval for high-impact operations. No secrets in the app. |
| **OmniPoint** | Otya Hold Ltd T/A OmniPoint: the owner's physical shop in Uganda; retail, inventory, POS, cashbook, mobile-money agency, float, commissions and reconciliation | Cloudflare D1 is the intended operational source of truth. Separate retail and agency ledgers. Not a multi-tenant public SaaS. Provider status—not a button click—determines payment state. |
| **Otya Media** | Offline-first local audio/video playback, local transfer, private media and releases | Local playback and library access must work without cloud/auth/AI. Media stays on-device by default. |
| **OtyaHub** | Public developer and partner hub, public documentation, safe examples and integration guidance | Public content only; no customer records, secrets, private infrastructure inventories or owner controls. |
| **Cloudflare** | Workers, D1, R2, KV, Queues, Workflows, scheduling and supporting security/routing | Primary runtime/data platform. Separate products and environments; use KV only for reconstructable or short-lived state. |
| **GitHub** | Source control, code review, CI, release evidence and change history | Each repository retains its source of truth. Changes flow through reviewed PRs and checks. |
| **Resend** | Shared transactional email and delivery status | Central server-side credentials and reviewed event-specific templates. Product callers must not expose API keys or submit arbitrary recipients/messages. |

## Shared integration contracts

1. **Identity:** authenticate through Otya Auth where appropriate; each product resolves the stable subject to its own active membership and permissions.
2. **Authorization:** the owning product API authorizes every request using product, company, branch and role scope. Global sign-in does not imply access to every product.
3. **Data ownership:** each product is the authoritative writer for its records. Cross-product callers use authenticated APIs or versioned events, never direct database writes.
4. **Events:** emit minimal, versioned events after a successful commit. Queue delivery is not proof of a financial transaction.
5. **Email:** Otya Server owns the Resend integration. OmniPoint sends narrowly scoped events, such as low-stock notices, over a private Cloudflare Service Binding. Recipients are configured centrally; never accept caller-supplied recipients for operational alerts.
6. **Payments:** financial actions require idempotency, verified provider status, durable transaction references, callback authentication, reconciliation and explicit go-live approval.
7. **Recovery:** backup/restore and failback must be tested. Do not claim high availability or recovery readiness based only on configured buckets or scheduled jobs.
8. **Offline:** Otya Media local playback and local library access must not depend on the cloud. OmniPoint may capture drafts offline, but money movement must never be reported successful without authoritative confirmation.
9. **Public/private:** OtyaHub and public product surfaces must not inherit Otya Next owner permissions.
10. **Secrets:** keep API keys, signing material, refresh tokens and provider credentials in protected server-side secret stores, never in repositories, app bundles or public collections.

## Approved platform direction

- GitHub + Cloudflare for code, runtime and operational data.
- Resend as the central email provider.
- No new runtime or data dependency on Supabase, Appwrite or Vercel for OmniPoint.
- Keep existing production services, data, DNS and secrets unchanged until a reviewed, explicitly approved migration or release is ready.

## Readiness rule

A capability is **implemented** only when code and tests exist; **configured** only when the real binding/secret/setting is verified without exposing secrets; **deployed** only when the exact production version is confirmed; and **operational** only after end-to-end tests and recovery/reconciliation evidence. Never use these terms interchangeably.
