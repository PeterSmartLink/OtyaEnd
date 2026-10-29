# Otya End — Shared Otya Ecosystem Backend

**Otya End** is the shared backend, identity integration and orchestration layer for the Otya ecosystem, operated by **Otya Hold Ltd**.

The GitHub repository slug `Otya-Server` is intentionally preserved for compatibility until a coordinated rename is approved. The current service name is Otya End.

**Official service:** https://petersmartlink.com

## Product family

- **Otya OS** — unified ecosystem and shared standards.
- **Otya End** — shared backend, integration contracts and orchestration.
- **Otya Auth** — identity, sessions and access control.
- **OtyaPoint** — the owner's shop and agency operations application.
- **Otya Media** — offline-first media player and release lifecycle.
- **OtyaHub** — developer and partner community.
- **Resend** — first-class shared transactional email provider.

Products share identity and integration contracts where appropriate, but do not gain direct access to one another's business databases. OtyaPoint remains the source of truth for its shop operations and financial records.

## Modernization principles

- Cloudflare Workers and D1 remain the preferred runtime and application data foundation.
- Authentication and authorization fail closed; internal services use explicit bindings and narrow scopes.
- Remote D1 migrations require explicit approval tied to the reviewed database target.
- Provider adapters remain disabled until the exact product, account eligibility and environment are verified.
- Email delivery is a side effect and must not roll back a committed business operation.
- Secrets stay in protected secret stores, never in client code or committed configuration.
- Backups must be restored and verified before high-risk schema changes.
- CI, dependency audits and JavaScript/TypeScript analysis gate changes; deployment jobs remain skipped unless explicitly authorized.
- Existing repository slugs, Worker names, database IDs, app IDs and public links remain unchanged until compatibility is verified.

## Architecture and operations

- [Backend foundation blueprint](docs/OTYA_BACKEND_FOUNDATION_BLUEPRINT.md)
- [Master architecture and service register](docs/OTYA_OS_MASTER_ARCHITECTURE_V1.md)
- [Shared identity contract](docs/SHARED_IDENTITY_CONTRACT_V1.md)
- [Ecosystem integration contract](docs/OTYA_END_ECOSYSTEM_INTEGRATION_CONTRACT.md)
- [Verified Cloudflare infrastructure registry](docs/OTYA_END_VERIFIED_INFRASTRUCTURE_REGISTRY.md)
- [Ecosystem execution status and blockers](docs/OTYA_ECOSYSTEM_EXECUTION_STATUS.md)
- [Consolidation and cleanup plan](docs/OTYA_ECOSYSTEM_CONSOLIDATION_AND_CLEANUP_PLAN.md)
- [Versioned API catalog template](docs/API_CATALOG_TEMPLATE_V1.md)
- [Secure MCP platform standard](docs/MCP_SERVER_PLATFORM_STANDARD_V1.md)
- [Shared Resend email contract](docs/ECOSYSTEM_EMAIL.md)
- [Staged ecosystem upgrade roadmap](docs/OTYA_ECOSYSTEM_UPGRADE_ROADMAP.md)

The infrastructure registry is read-only evidence of observed resources and bindings, not a certification of production readiness. Older documents are proposed standards unless explicitly marked as verified.

## Public product information

Customer-facing product information, documentation, downloads, support and release notices are published through the official OTYA website rather than this private source repository.

- OTYA: https://petersmartlink.com
- Docs: https://petersmartlink.com/docs
- OTYA AI: https://petersmartlink.com/ai
- OTYA Account: https://petersmartlink.com/my-account
- OTYA Media: https://petersmartlink.com/otya-player
- OTYA Media download: https://petersmartlink.com/download/otya-player

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) for the private reporting process.

## Source and licensing

The Otya backend is proprietary software and production infrastructure. Source code, deployment configuration, schemas, internal routes, operational documentation and platform integration logic may not be copied, redistributed, modified or commercially reused without prior written permission from Otya Hold Ltd, except for third-party components governed by their own licenses.

See [LICENSE](LICENSE).

---

**Otya End · Otya Hold Ltd**
