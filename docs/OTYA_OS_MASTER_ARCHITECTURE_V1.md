# Otya OS — Master Architecture and Service Register v1

Status: proposed architecture and inventory baseline; not deployment authorization.
Owner: Otya Hold Ltd
Review date: 2026-10-23

## 1. Purpose

Otya OS is the shared ecosystem and operating model for Otya products and services. It should help customers, developers, partners, operators and maintainers discover, use, integrate, support and improve products. It is not one giant application and does not mean every service shares every database or permission.

This register is the starting source of truth for service ownership, API boundaries, data ownership, readiness and integration decisions. Actual deployed state must be verified before any service is marked production-ready.

## 2. Principles

1. One documented purpose and accountable owner per service.
2. One identity authority where accounts are required; product authorization remains local to each product and organization.
3. Public resources stay public. OtyaHub's public GitHub channel must not require Otya SSO.
4. Each data domain has an explicit system of record. Other services use documented APIs/events, not unreviewed direct table writes.
5. API contracts are versioned, validated, observable and tested; breaking changes require migration plans.
6. Fail closed for privileged, destructive, financial and release actions when required authorization or integrity dependencies are unavailable.
7. No secret in source, browser bundles, logs, issue trackers or public documentation.
8. Cloudflare is the intended primary runtime. Supabase is backup/recovery only under the ecosystem policy; Appwrite is contingency only after restore/failover tests. Existing repositories/configuration may contradict this target and must be reconciled explicitly before any cutover.
9. Do not imply a provider transaction succeeded until the provider confirms it.
10. Offline capability is product-specific: local media playback should work offline; financial writes must never be replayed without idempotency, authorization and reconciliation safeguards.
11. Changes are delivered via branch, pull request, CI and human review. No automatic production deployment, destructive operation or live financial enablement is authorized by this document.

## 3. Logical ecosystem

- **Otya Hold Ltd** — company governance, product stewardship, legal/commercial accountability and security policy.
- **Otya OS** — shared platform architecture, standards, developer experience, service discovery and cross-product integration.
- **Otya Auth** — account identity, authentication, OTP/recovery and session lifecycle.
- **Otya Core** — shared backend capabilities and approved service integrations; must not become an unbounded monolith.
- **Otya Next** — AI assistant, tool execution and automation, with least privilege and human approval for sensitive actions.
- **Otya Media / Otya Player** — media discovery and playback; local playback remains independent of login/network.
- **OtyaHub** — public GitHub-facing developer and partner channel: public docs, examples, contribution guidance, issues/discussions and release information as appropriate. GitHub repository permissions remain GitHub-managed and separate from Otya accounts.
- **OmniPoint** — independent retail, inventory, POS and fintech-agency operations product, operated under Otya Hold; separate data domain and role model.
- **Cloudflare** — intended primary hosting/runtime and edge platform for approved Workers, D1, KV, R2, Queues and observability use.
- **Supabase** — backup/recovery role in the target ecosystem policy. OmniPoint's current README references Supabase Auth/Postgres; that conflicts with the target Cloudflare-first policy and must be resolved with a reviewed migration decision, not silently changed.
- **Appwrite** — contingency/failover candidate only after compatibility, backup/restore and failover drills.
- **Vercel** — current application build/preview/deployment platform for projects where explicitly retained; deployment ownership and environment bindings must be recorded per project. A platform may build/serve a frontend without becoming the system of record for its data.

## 4. Verified GitHub repository inventory (initial)

The following facts were checked against the connected GitHub repository listing and repository READMEs on 2026-10-23. This is not yet a complete code/deployment audit.

| Repository | Visibility observed | Verified purpose from README | Important boundary / follow-up |
|---|---|---|---|
| PeterSmartLink/OtyaHub | Public | Public Otya product/developer hub with public docs links, Postman collection, news, security reporting and public-safe automation | Keep public-safe content only; review API examples and workflows before publishing additional material |
| PeterSmartLink/Otya-Server | Private | Production backend for shared Otya account, Player APIs, AI, recovery, release delivery and notifications | Keep source, infrastructure inventory and secrets private; CI security audit currently needs investigation |
| PeterSmartLink/OtyaPlayer | Private | Otya offline-first media/player application | Local playback must remain independent of backend availability; confirm release signing and artifact verification |
| PeterSmartLink/Next | Private | Android-first owner intelligence/operations app connected to the existing Otya Cloudflare backend | Owner permissions and high-impact actions stay server-side with step-up/approval; do not expose privileged tools to public users |
| PeterSmartLink/OmniPoint | Private | Independent Uganda retail/POS and fintech-agency platform prototype | README currently references Supabase Auth/Postgres/Prisma while the ecosystem target prefers Cloudflare-first; resolve the conflict before integration |

Repository visibility is not a user or partner access policy by itself. Public OtyaHub participation must not grant write access to private repositories or production services. Conversely, an Otya account must not be required to read public OtyaHub resources.

## 5. Service register

| Service | Primary job | Data / authority boundary | Integrations allowed | Not allowed by default | Readiness evidence required |
|---|---|---|---|---|---|
| Otya Auth | Authenticate accounts and manage sessions/recovery | Canonical account identity; does not own every product role | OIDC/OAuth flow and documented verification/exchange APIs | Granting product roles automatically; trusting client role claims | Issuer/audience/key profile, rotation, OTP limits, revocation, recovery and negative tests |
| Otya Core | Shared backend capabilities | Owns only explicitly assigned shared records | Versioned APIs/events and least-privilege service credentials | Direct unreviewed writes to product databases | Service catalog, contracts, rate limits, idempotency, audit and outage behavior |
| Otya Next | AI tools and automations | Tool credentials and task state scoped by capability | Approved Core/product APIs; queues with idempotent consumers | Unrestricted SQL, account-wide admin, unreviewed financial actions | Tool allowlist, per-tool auth, approval gates, rate limiting, audit, replay tests |
| Otya Media / Player | Media experience and offline playback | Local media/library data; optional account-linked sync | Auth only for features that require an account; signed release delivery | Blocking local playback on Auth/API outage | Offline, permissions, release-signing, update integrity and recovery tests |
| OtyaHub | Public developer/partner collaboration | Public GitHub content governed by repo visibility/license | GitHub links, public docs, examples, optional separately authenticated partner services | Mandatory Otya login for public content; automatic GitHub write/admin from Otya SSO | Public access check, license/secret scan, contribution and vulnerability-reporting guidance |
| OmniPoint | Retail POS, stock, retail ledger, agency operations | Owns its retail and agency records; strict ledger separation | Auth via reviewed server-side adapter; approved payment/provider adapters | Direct browser DB admin, cross-org access, live transaction execution before safeguards | Database decision, role provisioning, atomic sale/ledger tests, idempotency, reconciliation and audit |
| Cloudflare platform | Run edge services and platform resources | Resource-level bindings and service-owned data | Approved Workers bindings, D1/R2/KV/Queues, observability | Shared unrestricted credentials; undocumented cross-worker table ownership | Resource inventory, binding ownership, secret policy, backups, alarms and restore evidence |
| Supabase | Backup/recovery per target policy | Backup copies only unless a separately approved architecture decision changes | Tested export/restore procedures | Unapproved live OmniPoint database or competing identity authority | Restore drill, integrity checks, RPO/RTO and explicit architecture decision |
| Appwrite | Contingency candidate | No production authority until approved | Test-only failover validation | Automatic active-active writes without conflict strategy | Compatibility, restore/failover drills, conflict handling and rollback |
| Vercel | Build/preview/deploy selected apps | Not automatically the data authority | CI builds and approved environment-specific deployments | Implicit permission to deploy production or change database/provider settings | Project map, environment inventory, deployment protection and rollback test |

## 6. API standards

### 5.1 API ownership and discovery

Maintain an API catalog with one entry per endpoint or event: owning service and maintainer; environment/base URL and route; HTTP method or event name; contract/schema version; authentication audience and required permission; request/response schema and error codes; idempotency behavior and rate limit; data owner and side effects; timeout/retry policy and retry safety; logs/metrics and correlation ID; deprecation date and migration plan.

Do not publish secret-bearing environment values, internal-only routes or private operational details in the public OtyaHub channel.

### 5.2 HTTP conventions

- Use HTTPS outside local development.
- Use /api/v1/... for public/stable APIs; version internal interfaces when compatibility needs it.
- Validate method, content type, request size, JSON schema, identifiers, bounds and pagination on the server.
- Return consistent JSON errors with stable code, safe message and requestId; do not expose stack traces, tokens or secret values.
- Use 401 for missing/invalid authentication, 403 for authenticated but unauthorized, 404 for unknown resources, 409 for state/idempotency conflicts, 422 for semantically invalid input, 429 for rate limits, and 5xx for server/dependency failures.
- Set no-store headers for sensitive responses; use restrictive CORS allowlists where browser access is required.
- Enforce timeouts and bounded retries. Do not blindly retry non-idempotent writes.
- Mutations require server-side authorization, audit trails and idempotency where duplicate requests could cause harm.
- Do not treat a successful HTTP response as proof that an external provider completed a financial transaction unless the contract explicitly says so.

### 5.3 Identity and authorization

- Use Otya Auth as the intended shared identity authority, but do not integrate products until the deployed issuer, signing algorithm/key discovery, audience, session/revocation behavior and token lifetime are verified.
- Browser/native public clients should use a reviewed OIDC/OAuth authorization flow with PKCE and exact redirect allowlists where supported by the implementation.
- API services validate signatures, exact issuer/audience, expiry and account/session state. Never accept a browser-supplied role or organization as authority.
- Resolve current membership and product roles server-side. Scope every data access to the active organization and resource.
- Otya Auth's inspected JWT (sub, email, iat, exp) is not interchangeable with OmniPoint's isolated custom-HMAC token (sub, role, exp, iss, aud). Do not connect them by client-side translation.
- Cloudflare Access is an extra control for internal/admin surfaces, not the public customer identity service.
- Missing auth, rate limiting or membership services must not silently bypass controls. Define fail-closed behavior for sensitive operations.

### 5.4 Events and queues

- Every event has a versioned schema, producer/consumer owner, unique event ID, timestamp, correlation ID and idempotency key where relevant.
- Consumers must be idempotent; retries use bounded backoff; poison messages go to a monitored dead-letter queue with a documented replay procedure.
- Do not attach consumers to dormant queues until handler ownership, schema, duplicate delivery, retry and replay tests are complete.
- Never use an asynchronous event alone as proof of payment settlement; reconcile with the authoritative provider.

## 7. Data ownership and database policy

Create a separate data ownership map with table/collection, owning service, classification, retention, backup, migration path and allowed access.

- A product service is the only writer for its authoritative domain unless a documented API explicitly permits a command.
- Cross-product reads should use published APIs or approved read models; avoid direct cross-service database coupling.
- Retail inventory/sales and fintech-agency float/cash-in/cash-out/commission ledgers remain distinct.
- Financial mutations need atomic state transitions, unique idempotency keys, balanced ledger entries, immutable audit history and reconciliation.
- Before migrations, identify the actual production database, dialect, schema, bindings, migration history and restore point. Do not infer production state from an isolated test database.
- Current OmniPoint materials conflict: its README describes PostgreSQL/Prisma and Supabase Auth, while the ecosystem target calls for Cloudflare-first and a D1 migration scaffold exists separately. This is an unresolved architecture decision. No provider cutover or data migration should occur until the team selects one authoritative design and tests data integrity and rollback.
- Existing Cloudflare D1 inventory has reported metadata/schema discrepancies and shared otya-store-db bindings; verify table ownership and actual schema before migrations.
- Supabase backup/recovery must be independently restorable and verified; Appwrite contingency must not be enabled without a tested conflict/rollback plan.

## 8. Security, privacy and operations baseline

- Store secrets only in approved encrypted secret stores. Never expose service credentials to client bundles.
- Separate development, preview/staging and production credentials/resources.
- Use least privilege and short-lived credentials where possible; rotate keys with a tested overlap and rollback process.
- Redact tokens, OTPs, private keys, provider secrets and unnecessary personal data from logs.
- Define data minimization, retention, deletion, export and incident-response procedures.
- Use dependency/security scanning and pin or lock dependencies. Investigate failed audits rather than bypassing them.
- Monitor error rate, latency, dependency failures, queue age/dead letters, auth abuse, provider discrepancies and backup health.
- Document on-call/owner, severity, escalation, status communication and recovery steps.
- Verify backups by restoration, not merely by confirming that a backup job ran.
- For sensitive financial and destructive actions, fail closed when required policy, rate limiting, ledger integrity or provider state is unavailable.

## 9. Developer and partner experience

Otya OS should help people participate at the right level:
- Public visitors: discover products, public docs, release notes and examples without mandatory login.
- Developers: use clear API docs, SDK examples, test environments, contribution guides, changelogs and reproducible tests.
- Partners: request access to explicitly scoped integration sandboxes; credentials are issued and revoked separately from public GitHub participation.
- Customers: use consistent sign-in only where accounts are needed; understand privacy and recovery options.
- Operators: use monitored dashboards, audit trails, documented runbooks and role-scoped admin tools.
- Maintainers: find owners, contracts, dependency maps, CI results and rollback instructions quickly.

Public repositories must contain only intentionally public material. Keep production source, secrets, customer data, internal routes and private incident details private. Public GitHub permissions are granted through GitHub's own review process, not inherited from Otya Auth.

## 10. Repository and change governance

For each repository, record: purpose, visibility, owning team, languages/frameworks, CI checks, branch protection, release process, production relationship, security reporting route, license and dependency consumers.

Required workflow:
1. Create a focused branch.
2. Make a small change with tests/docs.
3. Open a PR describing scope, risk, tests and rollback.
4. Run CI, security and dependency checks.
5. Review API/schema/permission changes with the owning service.
6. Obtain required human approval.
7. Deploy only through the approved release path.
8. Verify health and logs; retain rollback path.
9. Update the register after merge/deployment.

Do not merge or deploy automatically. Documentation PRs do not imply that their proposed design is implemented.

## 11. Readiness states

Use only these states, with evidence:
- Discovered — repository/resource located.
- Inspected — source/config reviewed.
- Designed — contract and ownership approved.
- Implemented — code/config exists on a branch or release.
- Tested — relevant automated and manual tests passed.
- Staging verified — end-to-end checks passed in a non-production environment.
- Production verified — deployment, monitoring, security and rollback evidence reviewed.
- Retired — traffic/data/dependencies safely removed and owner signed off.

A resource existing in Cloudflare/GitHub/Vercel is not evidence of production readiness.

## 12. Initial blockers to resolve

1. Review the shared identity contract PR and define the actual token/issuer/audience/key/revocation profile.
2. Fix and verify the failing Otya Server security workflow; do not bypass dependency audits.
3. Resolve OmniPoint's PostgreSQL/Prisma/Supabase versus Cloudflare/D1 architecture conflict.
4. Audit Cloudflare D1 metadata vs schema and shared otya-store-db ownership.
5. Verify every Worker binding, queue consumer, secret reference and production route before changing it.
6. Implement and test server-side membership/role mapping; do not trust client role claims.
7. Keep OmniPoint sales, agency transactions and reconciliation disabled until atomicity, idempotency, provider confirmation, ledger balance and recovery tests pass.
8. Audit retired/unused external integrations before removing any bindings.
9. Establish actual repository visibility and public OtyaHub repository strategy; do not expose the private production source repository.
10. Create a verified service/API/data/dependency inventory with owner and readiness evidence.

## 13. Proposed implementation phases

### Phase A — Inventory and design
- Complete repository/resource/service inventory.
- Approve service owners, API standards and data ownership.
- Reconcile architecture conflicts and mark unknowns honestly.
- Review security baseline failures.

### Phase B — Safe foundations
- Establish common request IDs, structured redacted logs, error formats, schema validation and contract tests.
- Create identity verifier/policy adapter in an isolated test branch only after issuer/audience/key facts are verified.
- Add API contract and authorization tests to CI.

### Phase C — Product integration
- Integrate one service at a time in non-production environments.
- Start with low-risk read-only operations; then carefully reviewed writes.
- Test account suspension, membership removal, cross-organization isolation, rate limits, dependency outage and rollback.

### Phase D — Operational readiness
- Verify backup restoration, alerting, queue replay, incident response and deployment rollback.
- Review privacy, licensing, public documentation and partner onboarding.
- Obtain explicit approval for production deployment or live financial enablement.

## 14. Decisions and approvals log

Record each decision with date, owner, alternatives, rationale, affected services, migration/rollback, tests and approval. Unknown or conflicting configuration is an open decision, not an invitation to guess.

This document establishes governance and target architecture only. It does not claim that integrations, controls, database migrations or production readiness gates are already complete.
