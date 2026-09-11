# Otya production recovery runbook

This runbook covers Otya Core (`otya-store-db`) and Otya Auth (`otya-auth-db`). It is an operator procedure, not an automatic recovery workflow.

## Principles

- Prefer diagnosis and rollback of application code before restoring data.
- A D1 Time Travel restore overwrites the selected production database in place and is destructive.
- Never restore both databases merely because one service is unhealthy.
- Never restore R2, KV, queues, secrets, DNS, Firebase, Resend or Telegram as part of a D1 recovery unless separate evidence shows those resources are affected.
- Preserve the Otya architecture boundary: Core data and Auth data are separate recovery domains.
- Record the incident time, affected service, last known-good time and operator before any destructive action.
- Do not put credentials, OTPs, JWTs, API tokens or private keys into incident notes.

## Routine readiness check

The `Otya Operations Readiness` GitHub workflow is intentionally read-only. It checks:

1. repository migration discipline;
2. whether Core has unapplied D1 migrations;
3. Auth migration visibility without applying Auth migrations;
4. whether Time Travel information can be retrieved for both production databases.

It never performs `d1 time-travel restore`.

## Before a production deployment

1. Confirm the target commit passed Core/Web, Auth and Next validation.
2. Confirm Security passed.
3. Review the migration diff. Destructive SQL requires explicit review and the repository approval marker.
4. Confirm the deployment is an explicit `workflow_dispatch` on `main` with the intended component and exact `DEPLOY` confirmation.
5. For Core deployments, the deploy path applies pending Core migrations before Worker promotion. A migration failure must stop the deployment.
6. Do not automatically apply Auth migrations while the preserved-schema repair path remains in service.

## Incident triage

Before considering a database restore, determine which class of failure is present:

- **Worker/code regression:** roll back the Worker/version; do not restore D1.
- **Bad configuration/secret:** repair the binding/secret; do not restore D1.
- **Queue backlog/provider outage:** stop or drain the affected producer; do not restore D1.
- **R2 release artifact issue:** repair/re-publish the release object; do not restore D1.
- **D1 schema/data corruption or accidental destructive write:** Time Travel may be appropriate.

Capture evidence from Admin operational stats, Cloudflare logs/metrics, workflow runs and the affected endpoint before changing state.

## Inspect current recovery points

Core:

```bash
npx wrangler d1 time-travel info otya-store-db --json
```

Auth:

```bash
npx wrangler d1 time-travel info otya-auth-db --config auth-worker/wrangler.toml --json
```

To inspect a past timestamp, use an explicit UTC/RFC3339 timestamp with `--timestamp`.

## Restore decision gate

A production D1 restore should happen only when all of these are true:

- the incident is confirmed to be data/schema corruption rather than application/configuration failure;
- the affected database is identified;
- a last known-good timestamp/bookmark is identified;
- the expected data loss window is understood;
- the current application version is compatible with the restored schema;
- the operator has captured the current incident evidence;
- a post-restore validation plan is ready.

If any item is unknown, stop and investigate rather than guessing.

## Destructive restore commands

These commands are examples only. Replace the placeholder with the reviewed bookmark or timestamp.

Core:

```bash
npx wrangler d1 time-travel restore otya-store-db --bookmark=<REVIEWED_BOOKMARK>
```

Auth:

```bash
npx wrangler d1 time-travel restore otya-auth-db --config auth-worker/wrangler.toml --bookmark=<REVIEWED_BOOKMARK>
```

Never put either command in an unattended scheduled workflow.

## Post-restore checks

After a restore, validate only the affected recovery domain first, then the ecosystem:

1. D1 responds and expected migration/schema objects exist.
2. Core public read endpoints respond if Core was restored.
3. Auth verification/sign-in boundaries respond if Auth was restored.
4. Core → Auth and Core → Next private service checks pass.
5. Admin stats load without schema errors.
6. Telegram webhook/Next readiness remains healthy.
7. Push, email and release metadata are inspected for duplicate/replayed work before producers are resumed.
8. Run the normal live Otya smoke checks.
9. Record the restore bookmark/timestamp, reason and verification result in the incident record.

## Long-retention recovery

D1 Time Travel is the first-line point-in-time recovery system. If Otya later requires recovery beyond the plan's Time Travel window, introduce a separately reviewed D1 export-to-R2 retention policy. Do not mix long-retention database exports with the public APK/release namespace, and encrypt/restrict any export that can contain user or authentication data.

## Things this runbook never authorizes

- deleting a D1 database or KV namespace;
- resetting all users;
- deleting R2 release artifacts;
- rotating production secrets without a specific incident reason;
- restoring both Core and Auth merely for convenience;
- bypassing the explicit production deployment gate;
- publishing incident details containing user/private operational data.
