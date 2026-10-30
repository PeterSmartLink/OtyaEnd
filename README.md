# Otya End

**Otya End** is the shared backend and integration layer for **Otya OS**, operated by **Otya Hold Ltd**. This repository's historical GitHub slug and existing deployment identifiers are compatibility references; do not rename repositories, Workers, routes, database resources, or public URLs without a separately reviewed compatibility plan.

## Responsibility

Otya End provides shared, server-side capabilities for the Otya ecosystem, including:

- shared Otya identity and session contracts;
- product-scoped APIs and service-to-service integration;
- Otya Media release delivery and supporting APIs;
- Otya AI / owner-intelligence backend capabilities;
- secure recovery and owner-approved account recovery flows;
- notifications and transactional email through Resend;
- service health, audit trails, and operational readiness;
- integration and connector policy boundaries.

Otya End is **one shared backend**, not a reason to merge every product's business data into one database. Each product must retain explicit data ownership, authorization boundaries, and migration/recovery controls.

## Canonical ecosystem names

- **Otya Hold Ltd** — parent company.
- **Otya OS** — unified platform and connected ecosystem.
- **Otya End** — shared backend and integration layer.
- **OtyaPoint** — owner's shop and financial-agency operations application.
- **Otya Media** — local-first media player; core playback must remain useful without the backend.
- **OtyaHub** — public developer and partner information surface.
- **Leo / Otya Next** — owner-facing AI coordinator and intelligence experience. Privileged execution stays server-side and approval-gated.

Legacy product names, repository slugs, Worker names, API paths, and database identifiers may remain where required for compatibility, migration, or historical records. Update visible product identity only through reviewed, compatibility-first changes.

## Production principles

- One shared Otya identity across products, with product-specific authorization and data scoping.
- Real server-side authentication and session management.
- Server-side Google identity verification and optional verified phone/linked identity support.
- Explicit opt-in recovery backup support with auditable, tested restore procedures.
- Transactional email through the existing Resend integration; do not introduce a second provider without approval.
- Signed application release delivery and checksums.
- Cloudflare Workers-based runtime and Cloudflare-managed data/storage services where appropriate.
- Security scanning, dependency review, and required GitHub Actions validation.
- Secrets stored only in protected platform/GitHub secret stores, never in client code or public documentation.
- AI is optional for Otya Media and must never block local playback.
- Production migrations, deployment, DNS changes, secret rotation, and payment-provider activation require explicit authorization and a reviewed rollback plan.

## Public product information

Customer-facing product information, documentation, downloads, support, and release notices belong on the approved public Otya surfaces, not in this private source repository. Keep public links and endpoint compatibility unchanged until their owners approve a migration.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) for the private reporting process. Never commit credentials, signing keys, private logs, user data, recovery material, or internal access tokens.

## Source and licensing

This repository contains proprietary Otya backend software and production infrastructure. Source code, deployment configuration, schemas, internal routes, operational documentation, and platform integration logic may not be copied, redistributed, modified, or commercially reused without prior written permission from Otya Hold Ltd, except for third-party components governed by their own licenses.

See [LICENSE](LICENSE).

---

**Otya End · Otya OS · Otya Hold Ltd**
