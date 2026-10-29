# Otya End — Verified Infrastructure Registry
Status: read-only Cloudflare snapshot; verified 2026-10-29 UTC. This registry records resource existence and observed configuration, not production readiness or data contents.

## Naming and ownership
- Parent company: Otya Hold Ltd.
- Shared backend/platform services: Otya End (previously called Otya Server in project documentation).
- Unified platform: Otya OS.
- Shop and retail/agency app: OtyaPoint.
- Media player: Otya Media.
- Public developer/partner community: OtyaHub.
- GitHub repositories remain under their current names until a separate migration plan is reviewed. No repository, Cloudflare resource, DNS record, secret, or production deployment was renamed by this inventory.

## First-class connected services

### Resend — transactional email and email-event provider
- Resend is a required member of the Otya ecosystem service registry, integrated through Otya End and consumed by products through an approved provider-neutral email interface.
- Existing observed evidence: the `otya-auth` and `otya-next` Worker configurations include Resend integration bindings/configuration. This confirms configured integration surfaces only; it does not prove delivery, domain verification, webhook correctness, or end-to-end health.
- Required follow-up: inspect the exact binding names and secret presence without exposing values; inventory sender domains, templates, sending limits, webhooks and event types in the Resend account; test sandbox delivery and failure/retry behavior; verify signature validation for any inbound webhook. Do not alter DNS or live webhooks during inventory.
- Keep all credentials server-side, prefer scoped API keys, redact recipient/body/secret data from logs, and route notifications through durable queues for retry. Email must never be the sole authorization mechanism for financial or administrative actions.

## Cloudflare resources verified read-only

### Workers
| Resource | Observed bindings / role | Status |
|---|---|---|
| `otya-auth` | D1 `otya-auth-db`; KV namespace; Analytics Engine; JWT/internal secret bindings; Google/Telegram login configuration; Resend integration binding | Exists; configuration observed; auth contract and production security still require tests |
| `otya-core` | D1 `otya-store-db`; service binding to `otya-auth` and `otya-next`; Queues `otya-next-jobs` and `otya-push`; R2 `otya-player-releases`; KV; Analytics Engine; Workflow; AI and notification bindings | Exists; configuration observed; service mixes web/product responsibilities and needs code-level ownership review |
| `otya-next` | D1 `otya-store-db`; KV; AI/AI Search/Browser bindings; Analytics Engine; Resend integration binding | Exists; configuration observed; exact data ownership and API contracts require review |

Only binding names and types are recorded. Secret values and user/customer payloads are intentionally excluded.

### D1 databases
| Name | ID | Observed relation |
|---|---|---|
| `otya-auth-db` | `b05595f6-260a-4720-acca-4f8b13f5c43e` | Bound to `otya-auth` as `AUTH_DB` |
| `otya-store-db` | `ab157fc6-2cbb-4d46-9789-2e4392e16aea` | Bound to `otya-core` and `otya-next` as `DB` |
| `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5` | Exists; not found in the three inspected Worker binding lists; do not assume it is the live OtyaPoint database |

### R2 buckets
| Name | Status / observed relation |
|---|---|
| `otya-assets` | Exists; binding not observed in inspected Worker settings |
| `otya-player-releases` | Exists; bound to `otya-core` as `R2`; configured as producer for release-events queue |
| `omnipoint-dev-private` | Exists; binding not observed in inspected Worker settings |
| `omnipoint-dev-backups` | Exists; binding not observed in inspected Worker settings; existence does not prove backups are current or restorable |

### Queues
| Queue | Observed producer / consumer | Status |
|---|---|---|
| `otya-next-jobs` | Producer `otya-core`; consumer `otya-next`; DLQ `otya-next-jobs-dlq` | Connected |
| `otya-next-jobs-dlq` | No producer/consumer observed | DLQ exists |
| `otya-push` | Producer and consumer `otya-core`; DLQ `otya-push-dlq` | Connected |
| `otya-push-dlq` | No producer/consumer observed | DLQ exists |
| `otya-release-events` | Producer `otya-player-releases` (R2) | Queue exists; no consumer observed |
| `otya-release-events-dlq` | No producer/consumer observed | DLQ exists |
| `omnipoint-dev-jobs` | No producer/consumer observed | Exists; isolated usage not established |
| `omnipoint-dev-jobs-dlq` | No producer/consumer observed | Exists; isolated usage not established |

### Pages and domain
- Pages project `omnipoint-relay-lab` exists at `omnipoint-relay-lab.pages.dev`.
- Its configured root/build output points at `infra/aws-egress-relay/preview`; production branch is `never-production`; latest/canonical deployment was not returned by the API snapshot. Treat as a lab/preview project, not as the main OtyaPoint frontend.
- Zone `petersmartlink.com` is reported active.
- No DNS records or routing were changed.

## GitHub repositories visible in the connected account
| Repository | Visibility | Purpose mapping (provisional) |
|---|---|---|
| `PeterSmartLink/Otya-Server` | Private | Existing backend repository; canonical project name changes to Otya End in documentation, repository slug remains unchanged pending separate approval |
| `PeterSmartLink/OmniPoint` | Private | Existing OtyaPoint application repository; preserve legacy slug |
| `PeterSmartLink/OtyaPlayer` | Private | Existing Otya Media application repository; preserve legacy slug |
| `PeterSmartLink/Next` | Private | Existing Otya Next repository; exact long-term product ownership requires review |
| `PeterSmartLink/OtyaHub` | Public | Public developer/partner community |

The connected GitHub listing confirms these repositories exist and are accessible. This snapshot does not establish workflow health, branch protection, deploy credentials, code security, or release status.

## Critical gaps before calling the backend ready
1. `omnipoint-dev` contains the OtyaPoint schema with migrations 0001–0003 recorded, but no inspected live Worker binds it. `request_fingerprint` is absent, so migration 0004 is not applied. Confirm intended environment/ownership and test migration order before deploying or applying anything.
2. `otya-store-db` is shared by `otya-core` and `otya-next`; read-only inspection found 13 applied migrations through `0013_publish_space_and_next_update.sql`. Table ownership and least-privilege boundaries need code/migration review.
3. `otya-auth-db` has auth tables but no rows in its `d1_migrations` tracking table; reconcile how this schema was created and how future upgrades are tracked before applying auth migrations. R2 backup bucket exists, but backup cadence, retention, encryption/access controls, checksum validation, and isolated restore evidence are unverified.
4. OtyaPoint API routes, auth contract, tenant/company scoping, D1 migrations, atomic sale/stock/ledger writes, idempotency, concurrency, rollback, and audit tests require verification.
5. No inspected Worker binding connected the `omnipoint-dev-jobs` queue or `omnipoint-dev-private` bucket; do not assume these are operational.
6. Pages relay lab has no reported latest/canonical deployment in the API response; do not treat it as deployed/healthy.
7. Provider integrations must remain sandbox-only; no live money movement or production payments are authorized by this registry.

## Next safe sequence
1. Inspect source/config and migrations in all relevant GitHub repositories.
2. Produce a binding/data-ownership map from code and Cloudflare configuration.
3. Implement OtyaPoint's API connection to its intended D1 database on an isolated preview only.
4. Add auth/authorization and financial invariant tests; prove backup restore into an isolated target.
5. Review cost limits, logs, rate limits, alerts, rollback and deployment gates.
6. Request explicit approval before production binding changes, database migrations, DNS changes, deployment, or live payment activation.

## Safety statement
This file was prepared from read-only resource-list, Worker-settings, and D1 schema/migration-metadata queries (only `sqlite_master`, `PRAGMA table_info`, and migration tracking metadata; no customer or financial rows were queried). No Cloudflare resource, binding, database, queue, bucket, DNS record, secret, or deployment was changed.