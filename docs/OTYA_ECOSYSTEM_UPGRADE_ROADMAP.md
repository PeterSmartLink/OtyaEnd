# Otya Ecosystem Upgrade Roadmap

**Owner:** Otya Hold Ltd  
**Status:** staged implementation plan; not production authorization  
**Last reviewed:** 2026-10-29  
**North star:** one connected Otya ecosystem, governed by Otya Server, with Otya OS as the unified experience and separate product ownership, data and permissions.

## 1. Upgrade outcome

The ecosystem should feel like one family to the owner and users, while remaining a set of secure, maintainable products. Otya Server provides shared identity contracts, connector registry, policy, audit, service discovery and operational coordination. Otya OS is the unified owner-facing experience. It must not become a monolithic backend or a bypass around product APIs.

- **Otya Server:** central control plane and connector governance.
- **Otya OS:** unified experience, navigation and owner operations.
- **OmniPoint:** the owner's physical shop system; authoritative shop, inventory, sales, cash, float and accounting data stay with OmniPoint.
- **Otya Next:** private assistant that may propose or invoke only authorized, scoped actions through product APIs.
- **Otya Media:** offline-first media player; core local playback and vault behavior must not depend on Otya Server availability.
- **OtyaHub:** public developer/partner entry point; publish approved docs and integration guidance only, never private operational details.
- **Shared communications:** Resend can provide the shared email transport under narrowly scoped service contracts, with each product retaining event ownership and recipient policy.

## 2. Non-negotiable architecture

1. One reviewed ecosystem registry, one documented identity/session contract, consistent correlation IDs and normalized error categories.
2. Product-specific authorization remains separate. A shared login does not grant access to every product.
3. No cross-product direct database access. Otya Server and Next call the owning product API; they do not read/write OmniPoint D1 directly.
4. Cloudflare Workers-first for the approved runtime, with GitHub as the reviewed source of truth. Do not add Supabase, Appwrite or Vercel as new runtime dependencies.
5. Separate Workers, resource bindings, secrets, release gates and rollback plans by product/environment.
6. Any connector capability is explicit and narrow; no generic shell, arbitrary SQL, open proxy or unrestricted AI tool execution.
7. High-risk actions require current authorization, approval bound to exact parameters, idempotency where applicable, auditable outcomes and revocation.
8. Core Otya Media playback stays local/offline-first.
9. Public OtyaHub material must not expose secrets, customer/staff records, private service internals or incident details.
10. Production deployment, DNS/secrets changes, migrations, live email and financial operations require separate explicit approval.

## 3. Current PR inventory observed on 2026-10-29

This is a snapshot of inspected pull requests and CI results, not a complete repository inventory and not merge authorization.

| Project | PR | Purpose | Inspected checks | Required next action |
|---|---:|---|---|---|
| Otya Server | #213 | Ecosystem registry, boundaries, release controls and dependency updates | Security and validation were reported passing at inspected head; production deploy jobs skipped | Review as governance/security baseline; reconcile with current main and other PRs before merge |
| Otya Server | #227 | Shared backend branding | Security workflow failed at inspected head | Resolve runtime dependency audit; do not use branding readiness as release readiness |
| Otya Server | #228 | Connector foundation proposal | Security workflow failed against current main dependency tree | Align/rebase only after dependency baseline is reconciled; connector document is proposal, not runtime |
| OmniPoint | #42 | Cloudflare-first foundation | Security baseline and Verify passed at inspected head | Continue isolated contract/schema validation; no production migration |
| OmniPoint | #41 | Otya family branding | Security baseline and Verify passed at inspected head | Keep branding independent of data/auth readiness |
| Otya Next | #9 | Rebrand assistant | CI passed at inspected head | Verify shared auth, scopes, approval and product API boundaries before automation |
| Otya Media | #165 | Rebrand media player | Release-mode validation passed; test and release-candidate guard failed | Fix 5 failing tests and use a new immutable build number; no release until green |
| OtyaHub | #4 | Canonical Otya family branding | Public-surface check passed at inspected head | Keep publication allow-list and private-information checks intact |

### Security details observed

The Otya Server security workflow failed during the web/backend runtime audit. Its log reports a critical Next.js advisory affecting versions through 15.5.27, a high-severity sharp issue below 0.35.5, and a high-severity source-map-js issue through 1.2.1. PR #213 already proposes updates to Next.js 15.5.28, sharp 0.35.5 and source-map-js 1.2.2, and its inspected security run passed. Recheck current PR heads and dependency ranges before deciding how to consolidate; do not blindly apply npm audit --force.

Otya Media's inspected tests reported 326 passing and 5 failing, including the visual-polish contract. Its release-candidate guard also reported that version v1.1.0+6 already exists. Fix the failing assertions and increment the immutable build number before a new candidate.

CI status is commit-specific. A green workflow on an older SHA does not prove a newer SHA is green. This snapshot does not verify any production deployment.

## 4. Implementation order

### Gate 0 — Reconcile and protect
- Compare open PR bases, exact head SHAs, changed paths and current checks.
- Consolidate overlapping dependency fixes and avoid duplicate or incompatible changes.
- Keep production-impacting changes closed.
- Do not merge a PR solely because it is small or its branding looks correct.

### Gate 1 — Establish the shared contracts in Otya Server
- Review and establish the canonical ecosystem registry.
- Align identity issuer, audience, subject, expiry, revocation, step-up authentication and product membership claims with the actual current code.
- Define connector manifests, scopes, risk classes, versioning and stable error categories.
- Define audit/correlation conventions and a private service-to-service contract.
- Add a read-only connector registry endpoint only after the contract and auth tests pass.

### Gate 2 — Prove OmniPoint readiness in isolation
- Keep OmniPoint's own API and database authoritative.
- Compare migration history and schema without writing to production.
- Rehearse the canonical migration chain in a fresh isolated D1 database.
- Verify staff/company scoping, inventory, stock movements, atomic sale posting, balanced journals, idempotency, duplicate callbacks and audit trails.
- Prove backup and isolated restore, including integrity checks and recovery timing.
- Keep payment providers disabled until sandbox callbacks, settlement reconciliation and explicit release gates pass.

### Gate 3 — Integrate product connectors
- Start with read-only health/status capabilities.
- Add product APIs one at a time with owner, scopes, schema validation, rate limits, timeouts, audit and emergency disablement.
- OmniPoint connector calls OmniPoint API only.
- Next can propose actions but cannot bypass policy or call privileged databases.
- Resend/email requires explicit recipient rules, scoped secrets, idempotency and approved test recipient before any live sending.

### Gate 4 — Unify the owner experience
- Build one protected Otya OS owner experience for product navigation, health, approvals, releases, incidents and recovery evidence.
- Use shared sign-in without collapsing product authorization.
- Require step-up auth for privileged operations and support session/connector revocation.
- Keep private control panels and operational telemetry out of OtyaHub.

### Gate 5 — Finish product-specific quality gates
- Otya Next: test permission boundaries and approval-required actions.
- Otya Media: resolve the failing tests and immutable build version guard; preserve offline-first playback.
- OtyaHub: validate public publication boundaries and link targets.
- OmniPoint: complete shop workflows, financial invariants, backups and auth migration before enabling live business writes.

### Gate 6 — Release one component at a time
- Require current CI/security success and reviewer approval.
- Verify recovery and rollback before any production change.
- Obtain explicit owner approval for each deployment, migration, DNS/secrets change, live email activation or payment activation.
- Smoke-test, monitor, and record the deployed SHA and rollback target.

## 5. Universal connector acceptance requirements

Every connector must have:
- an owner and supported-version policy;
- explicit capabilities and input/output schemas;
- minimum scopes and target-resource authorization;
- risk classification and approval defaults;
- safe credential storage and redaction;
- strict timeout, payload and rate limits;
- SSRF protection for HTTP integrations;
- idempotency/retry rules and authoritative outcome verification;
- audit records and correlation IDs;
- contract/security tests, emergency suspension and credential revocation;
- a data-retention statement and documented failure mode.

A connector only supports products with a compatible API/protocol or a deliberately enrolled agent. “Universal” means one consistent way to integrate supported systems—not unrestricted access to every device or account.

## 6. Definition of done for the ecosystem upgrade

The ecosystem upgrade is not complete until:
- shared identity and product-level authorization are tested end-to-end;
- the connector registry and first read-only connector pass security tests;
- Otya OS owner experience uses the owning APIs and approval service;
- OmniPoint has a rehearsed migration path, verified restore and passing financial invariants;
- Otya Next cannot bypass authorization;
- Otya Media passes its tests and preserves offline-first behavior;
- OtyaHub exposes only approved public content;
- all active PR heads have current green checks or explicitly documented, accepted exceptions;
- no unexplained critical/high runtime audit finding remains;
- every production action has a recorded approval, recovery plan and rollback reference.

**Current state:** staged planning and validation. The existence of this roadmap, a connector contract or passing documentation checks is not proof that the runtime, production data, recovery or financial workflows are ready.
