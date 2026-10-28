# Otya Server

The shared backend and integration layer for the Otya family, operated by **Otya Hold Ltd**.

**Official website (legacy domain):** https://petersmartlink.com

This repository contains production infrastructure for the shared Otya account, Otya Player APIs, Otya AI, secure recovery, release delivery, notifications, support and future Otya products.

## Production principles

- One shared Otya identity across products
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
- AI remains optional for Otya Player and cannot block local playback

## Public product information

Customer-facing product information, Docs, downloads, support and release notices are published through the official Otya website rather than this private source repository.

- Otya OS: https://petersmartlink.com
- Docs: https://petersmartlink.com/docs
- Otya AI: https://petersmartlink.com/ai
- Otya Account: https://petersmartlink.com/my-account
- Otya Media: https://petersmartlink.com/otya-player
- Otya Media download: https://petersmartlink.com/download/otya-player

## Public GitHub

Otya production source remains private. A separate public Otya repository should be used for public Docs links, release/checksum information, public issue templates, security reporting guidance and future public examples/SDKs. Starter files are maintained under `public-github-template/` until that public repository is created.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) for the private reporting process.

## Source and licensing

The Otya backend is proprietary software and production infrastructure. Source code, deployment configuration, schemas, internal routes, operational documentation and platform integration logic may not be copied, redistributed, modified or commercially reused without prior written permission from PeterSmart Link, except for third-party components governed by their own licenses.

See [LICENSE](LICENSE).

---

**Otya Server · Part of Otya OS**
