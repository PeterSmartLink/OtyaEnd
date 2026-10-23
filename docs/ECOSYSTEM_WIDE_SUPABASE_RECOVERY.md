# Ecosystem-wide Cloudflare primary and Supabase recovery strategy

## Decision

Cloudflare is the primary production platform for the entire Otya ecosystem. Supabase is the secondary recovery platform for the ecosystem, not merely an OmniPoint backup. This includes supported data and recovery artifacts for Otya Auth, Otya Core/Server, Next, OmniPoint, OtyaPlayer, OtyaHub, and future products.

This document records the target architecture and rollout requirements. It does not assert that backups, failover, replication, or offline synchronization are currently active.

## Platform roles

- **Cloudflare is primary:** Workers and service bindings; D1 where the workload fits SQLite and D1 constraints; R2 for primary object storage and release assets; Queues/Workflows for asynchronous work; Durable Objects for coordination; KV for cache and suitable short-lived state.
- **Supabase is secondary:** a separate recovery environment for supported relational data, recovery manifests, selected object/file copies where supported and cost-approved, and restore validation. Supabase must not become an accidental second live writer.
- **GitHub is the source-history layer:** code, migrations, infrastructure definitions and runbooks are version controlled. GitHub is not a substitute for runtime-data backups.
- **Independent encrypted export storage:** critical snapshots should also have a copy outside the same Cloudflare account/failure domain where practical. Supabase alone does not protect against every account compromise or credential compromise if the same operator credentials control both systems.

## Ecosystem coverage matrix

| Service / data area | Cloudflare primary | Supabase recovery approach | Important limitation |
| --- | --- | --- | --- |
| Otya Auth | Auth Worker and otya-auth-db; existing KV session/token state where configured | Back up durable identity-related database records and migration history only after reviewing schema and privacy requirements. Keep a separate protected recovery plan for revocation/session state; do not export live tokens casually. | Restoring Auth data alone does not restore signing secrets, email/Telegram provider credentials, or safe session validity. Rotate/revoke sessions when required after recovery. |
| Otya Core / Otya-Server | Core Worker and otya-store-db; queues, operational records and notifications | Copy supported durable relational tables and required migration metadata to a separate Supabase recovery project/schema. Include notification/outbox delivery state and operational records when appropriate. | D1 SQLite schemas are not PostgreSQL schemas; use explicit transformations and reconciliation, not blind SQL dumps. Queue contents may need their own export/replay process. |
| Next | Cloudflare-backed API/auth/core services | Its server-owned state is covered through Auth/Core backups; any Next-specific durable tables must be identified and included in the manifest. | Do not create a second copy of transient UI/cache data or private message content without a retention need. |
| OmniPoint | Cloudflare-hosted application/backend and its designated primary data store once compatibility and transaction tests pass | Existing Supabase project iptzfakfeiyjnvepfqcg is a candidate recovery target during migration, but its schema, migration drift and restore tests must be reconciled before treating it as a validated backup. | Current OmniPoint schema uses Prisma/PostgreSQL. D1 is not a drop-in replacement. Financial records require transaction-safe snapshots, idempotency and tested restore/reconciliation. |
| OtyaPlayer | R2 for releases/assets and local-first playback on devices | Back up release metadata, signed build artifacts where policy permits, and selected durable metadata. Maintain a second protected artifact copy; do not assume Supabase database backups cover R2 objects. | Local media stays on the user's device. A server outage must not disable already-downloaded media. Never back up a user's private vault contents by default. |
| OtyaHub and future products | Cloudflare services and R2 as appropriate | Each product registers its tables, files, secrets references, retention rules and restore tests in the shared backup manifest. | No product is considered covered until it has an owner, data inventory, successful snapshot and restore evidence. |
| Messaging and asynchronous work | Cloudflare Queues, Workers, provider webhooks and durable outbox records | Back up durable outbox/event state and delivery evidence where useful; export queue backlog through supported mechanisms when needed. Store replayable event identifiers and state, not credentials. | A database copy does not automatically back up queue messages. Provider timeouts can create ambiguous delivery; do not blindly replay high-impact messages. |
| Files, images, exports and releases | R2 primary object storage | Copy approved objects or encrypted archives to a separately controlled recovery store; Supabase Storage is an option only after access, size, retention, egress and cost checks. | Database rows and object bytes must be reconciled by key, checksum, size and version. A manifest alone is not a file backup. |
| Configuration and secrets | Reviewed IaC/config in Git; secret values held in the relevant secret manager | Back up non-secret configuration and references. Keep secrets in a separate restricted recovery mechanism with access logs and rotation procedures. | Never put secrets, refresh tokens, OTPs or private keys in ordinary Supabase tables or exported manifests. |

## Backup contract for every product

Each product must declare:

1. Its authoritative Cloudflare resources and data owner.
2. Tables/objects/events to include and exclude, including personal-data and retention classification.
3. Schema/migration version and compatibility mapping to the recovery representation.
4. Snapshot frequency, recovery point objective (RPO), recovery time objective (RTO), retention and restore approver.
5. Encryption, access controls, integrity checksums and independent-copy location.
6. Handling for queues, KV, Durable Objects, provider configuration, object storage and secrets that are not included in a relational database dump.
7. A tested restore and post-restore validation procedure.

Backup jobs should produce a manifest with source service, snapshot timestamp, schema version, object/table counts where safe, checksums, status and verification result. Never put secrets or unnecessary message bodies into manifests.

## Restore and outage rules

- Do not automatically restore Supabase just because a Worker or application health check fails. First distinguish application, configuration, database, queue, provider and deployment failures.
- During a Cloudflare outage, clients should preserve safe local work in an encrypted, bounded outbox and show Saved on this device, Waiting to sync, or Needs attention truthfully.
- Supabase is a recovery target, not a transparent hot standby unless a separately designed and tested failover mechanism exists. Avoid uncontrolled dual writes and split-brain.
- If recovery requires serving from Supabase, use an explicit incident decision, a single-writer/fencing procedure, compatibility checks and a planned return-to-primary reconciliation. Do not switch writes back to Cloudflare until data is reconciled.
- Offline messaging means safely queuing a message for later delivery when local or server-side durable storage is available. It does not mean the recipient has received it. Distinguish queued, retrying, provider-accepted, delivered (when confirmed), failed and needs-review.
- Financial transactions must never be reported successful from a local queue alone. OmniPoint must reconcile unknown provider outcomes before retrying any operation that could move money.

## Rollout sequence

1. **Inventory and classify:** enumerate all Workers, D1 databases, KV namespaces, R2 buckets, Queues, Workflows, Durable Objects, product repositories, scheduled jobs and external providers. Map every durable data set to an owner.
2. **Prove a small vertical slice:** select one low-risk service/table, produce an encrypted snapshot, verify checksums, restore into an isolated Supabase target and run application-level assertions.
3. **Build adapters:** create explicit D1-to-PostgreSQL transformations and schema-versioned export/import jobs. Never point a live application at an unvalidated recovery schema.
4. **Cover critical services:** Auth/Core/notifications and OmniPoint data first, with privacy review and stricter financial reconciliation for OmniPoint.
5. **Cover object and queue state:** define R2 object copies and queue/outbox export/replay separately from relational backups.
6. **Automate evidence:** report last successful backup, age, integrity, restore-test date, missing datasets and backlog. Alert through an independent channel.
7. **Rehearse:** conduct isolated restore drills, then a controlled failover exercise only after explicit approval and a written rollback/reconciliation plan.

## Current status and safety boundary

This is the target design, not proof of implementation. The existing Supabase OmniPoint project is not automatically a verified ecosystem backup. No live database migration, queue creation, secret movement, production deploy, traffic switch, or destructive restore is authorized by this document. Do not create a paid Supabase branch. Validate available plan limits and costs before adding resources.

Acceptance means a recent snapshot exists for every in-scope dataset, its integrity is verified, and a restore drill demonstrates that the recovered service can read and validate the restored state. A green backup job without a successful restore is insufficient.
