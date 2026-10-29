# Otya End — Shared Otya Ecosystem Backend

**Otya End** is the shared backend and infrastructure layer for Otya Hold Ltd's connected ecosystem.

This is the canonical service name replacing “Otya Server” in current project documentation. The GitHub repository slug `Otya-Server` is intentionally preserved for now so existing links, workflows, integrations and clones are not broken by an unreviewed rename.

**Official service:** https://petersmartlink.com

This repository contains the shared identity and API infrastructure, Otya Media release delivery, AI services, secure recovery, notifications, support and future Otya products. It coordinates shared capabilities while keeping each product’s business data separately scoped.

See [the proposed backend foundation](docs/OTYA_BACKEND_FOUNDATION_BLUEPRINT.md) and [the verified infrastructure registry](docs/OTYA_END_VERIFIED_INFRASTRUCTURE_REGISTRY.md) for the current architecture and read-only Cloudflare inventory. The registry is evidence of resource existence/configuration, not certification of production readiness.

## Production principles

- One shared OTYA identity across products
- Product-specific data remains separately scoped
- Real server-side authentication and session management
- Server-side Google identity verification
- Optional verified phone and linked identity support
- Explicit opt-in recovery backup support
- Transactional email through Resend
- Signed application release delivery
- Cloudflare Workers-based production infrastructure
- Security scanning and dependency review through GitHub Actions
- Secrets stored in protected platform/GitHub secret stores, never in client code
- AI remains optional for OTYA Player and cannot block local playback

## Public product information

Customer-facing product information, Docs, downloads, support and release notices are published through the official OTYA website rather than this private source repository.

- OTYA: https://petersmartlink.com
- Docs: https://petersmartlink.com/docs
- OTYA AI: https://petersmartlink.com/ai
- OTYA Account: https://petersmartlink.com/my-account
- OTYA Player: https://petersmartlink.com/otya-player
- OTYA Player download: https://petersmartlink.com/download/otya-player

## Public GitHub

OTYA production source remains private. A separate public OTYA repository should be used for public Docs links, release/checksum information, public issue templates, security reporting guidance and future public examples/SDKs. Starter files are maintained under `public-github-template/` until that public repository is created.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) for the private reporting process.

## Source and licensing

The OTYA backend is proprietary software and production infrastructure. Source code, deployment configuration, schemas, internal routes, operational documentation and platform integration logic may not be copied, redistributed, modified or commercially reused without prior written permission from PeterSmart Link, except for third-party components governed by their own licenses.

See [LICENSE](LICENSE).

---

**OTYA · PeterSmart Link**
