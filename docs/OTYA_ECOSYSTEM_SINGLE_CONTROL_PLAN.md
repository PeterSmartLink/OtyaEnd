# Otya ecosystem: one control plane, multiple safe products

**Status:** implementation contract and rollout guide. This document is not proof that a listed capability is deployed or production-ready.

## Outcome

Operate the ecosystem from one private owner experience, one service registry, one release/incident process and one recovery dashboard. Keep product-specific data and privileges isolated so that an issue in one application cannot corrupt another product.

## Source of truth

- Machine-readable product/service inventory: `config/ecosystem-registry.json`.
- Shared identity, API governance, service registry and notification orchestration: Otya Server.
- Shared transactional email: Resend, owned centrally by Otya Server; products emit narrow, versioned events rather than keeping separate provider keys.
- Business records: the product that creates them is their only authoritative writer.
- Infrastructure: Cloudflare-first. A recovery copy is not a second active writer and must not be called failover-ready until restore, routing and failback are tested.
- Code and release source of truth: each product's Git repository; changes land through reviewed pull requests and CI.

## One management experience

The private owner console should eventually show, in one place:

1. **Overview:** service health, last successful backup/restore drill, current release, active incidents and pending approvals.
2. **Products:** Otya Server, OmniPoint, OtyaHub, Otya Player and Otya Next, with owner, runtime, data boundary, environment and readiness gate.
3. **Identity & access:** users, product membership, roles, sessions, privileged actions and security events. A global sign-in does not grant global product access.
4. **Operations:** Worker/API health, error rate, latency, queue depth, dead-letter queue, database migration status and scheduled jobs.
5. **Data safety:** backup age, integrity verification, restore evidence, recovery-point objective, recovery-time objective, and failback status.
6. **Releases:** CI results, commit, preview, migration impact, approval, deployment status, smoke test and rollback reference.
7. **Business module:** OmniPoint sales, inventory, cash and agency reconciliation behind OmniPoint permissions only.
8. **Audit:** append-only actor/action/resource/result records with secrets and unnecessary personal data redacted.

The existing Otya browser `/admin` surface is intentionally retired. Do not reopen it as a shortcut. Extend the existing protected private owner-console pattern only after verifying the mobile/private client, owner step-up authentication and API authorization end to end.

## Product boundaries

| Product | Owns | Must not do |
| --- | --- | --- |
| Otya Server | Identity verification contracts, shared APIs, service registry, approved cross-product coordination and shared Resend email | Become the database for all products, hold OmniPoint ledgers, or grant blanket access |
| OmniPoint | Otya Hold Ltd T/A OmniPoint shop operations: retail stock/sales, agency transactions, cash/float, staff scope and separate ledgers | Become a public multi-tenant SaaS, treat provider requests as confirmed payments, or expose records to other products |
| OtyaHub | Public content, docs, developer/support surfaces | Expose private operational metadata or customer records |
| Otya Player | Local media, playback, vault, local transfer and release metadata | Require cloud access for local playback or upload private libraries by default |
| Otya Next | Private assistant and approved automation records | Bypass normal product authorization or directly write OmniPoint tables |

## Standard request path

1. Authenticate through Otya Auth where shared identity is appropriate.
2. The owning product API verifies the token using a reviewed server-to-server contract.
3. The product API maps the stable identity subject to an active local membership and loads product, company, branch and permission scope from server-side records.
4. The product API performs the operation against its own database in an atomic transaction.
5. It records an audit event and emits a minimal, versioned event only after commit.
6. Other products consume the event as a notification and retrieve authoritative details through the owning API. Queue delivery is never proof of payment.

## Standard development and release process

Every product follows the same path:

1. Local checks and isolated tests.
2. Pull request checks: typecheck, lint, unit/invariant tests, dependency/security audit, migration validation and build.
3. Human review of authorization, data changes, migration plan and rollback.
4. Verify backup integrity and successful restore for any data/schema risk.
5. Explicit approval for a specific component, commit and environment.
6. Deploy one component at a time; no implicit multi-product rollout.
7. Run smoke checks, inspect logs and queues, verify data invariants.
8. Record outcome and rollback pointer. Fail closed if any check is inconclusive.

Pull requests and previews must not write to production D1 or change production secrets. Production migrations must be a separate, explicit operation with an exact database identity.

## Data and recovery rules

- Cloudflare is the primary runtime/data platform.
- Keep separate D1 databases and resource namespaces for each product and environment.
- Never use Otya Server's existing store DB as OmniPoint's operational database.
- Create encrypted, independently retained backups, verify their integrity, and periodically restore into an isolated environment.
- Define and measure RPO/RTO. For recovery, fence the old writer, verify the restored data and schema, route traffic only after health checks, and test safe failback. Avoid simultaneous active writers.
- The approved operational direction is GitHub + Cloudflare; do not add Supabase, Appwrite or Vercel as runtime/data dependencies. Recovery must use a documented, independently retained backup format and a tested restore path compatible with the chosen Cloudflare resources.
- Offline-first applications retain local capability during service outages.

## Current blockers to close before calling the ecosystem production-ready

- Otya Server runtime dependency/security findings and complete CI.
- Token issuer/audience and identity-subject contract verification across services.
- OmniPoint production/test schema lineage reconciliation; do not infer from table counts alone.
- Company/branch isolation on every business record and every query.
- Database-enforced or transaction-enforced balanced journal posting, idempotency and reversal rules.
- Authenticated provider status inquiry, timeout/unknown reconciliation and duplicate prevention.
- A verified backup and restore drill; recovery routing and failback must remain marked unproven until tested.
- Actual deployed binding, route, domain and authorization checks for the dedicated OmniPoint API.
- Repository ownership/location and release workflow verification for Otya Player.
- Central Resend notification path: verify existing secret presence without exposing its value, deploy the Otya Server handler first, then the OmniPoint caller, then test only to an explicitly approved operator address.
- Consolidation of overlapping draft PRs into a small number of reviewed, testable change sets.

## Definition of done

The ecosystem is easier to manage when an owner can answer, without opening five separate consoles: what is running, which commit is live, where each product's data lives, who can access it, whether backups can restore, what failed, and how to safely roll back. Until those facts are measured and visible, mark the capability as planned or unverified.
