# Otya Server

**Otya Server** is the shared private control plane for the Otya ecosystem, operated by **Otya Hold Ltd**. It provides shared identity, core APIs, approved service integrations, releases, notifications and centralized transactional email.

**Official service:** https://petersmartlink.com

This repository contains production infrastructure for the shared OTYA account, OTYA Player APIs, OTYA AI, secure recovery, release delivery, notifications, support and future OTYA products.

## Production principles

- One shared Otya identity across products
- Product-specific data remains separately scoped
- Real server-side authentication and session management
- Server-side Google identity verification
- Optional verified phone and linked identity support
- Explicit opt-in recovery backup support
- Centralized transactional email through Resend; product apps call Otya Server rather than keeping separate Resend API keys
- Signed application release delivery
- Cloudflare Workers-based production infrastructure
- Security scanning and dependency review through GitHub Actions
- Secrets stored in protected platform/GitHub secret stores, never in client code
- AI remains optional for OTYA Player and cannot block local playback

## Public product information

Customer-facing product information, Docs, downloads, support and release notices are published through the official OTYA website rather than this private source repository.

- Otya public website: https://petersmartlink.com
- Docs: https://petersmartlink.com/docs
- Otya Workspace / assistant entry: https://petersmartlink.com/ai
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

**Otya Server · Otya Hold Ltd**
