# Recovery tooling implementation status

**Status: first local integrity-checking component added; production backup pipeline is not yet configured.**

## Added in this branch

- `scripts/recovery/verify-backup-manifest.mjs`: verifies SHA-256 and byte counts for files already present in a recovery bundle, checks manifest metadata, rejects duplicate entries and path traversal, and avoids following files outside the bundle.
- `test/recovery/verify-backup-manifest.test.mjs`: fixture tests for valid bundles, tampering, path traversal, duplicate paths, and future timestamps.
- `.github/workflows/recovery-integrity.yml`: runs the tests in GitHub Actions without production credentials or access to Cloudflare/Supabase.

## What this does not do

This is a local artifact verifier, not an exporter, encrypted backup store, database restore, or traffic controller. It cannot prove that a backup contains every required resource or that a database is logically consistent. It does not connect to production, export data, deploy services, or change routes.

## Next implementation gates

1. Run the new integrity tests in GitHub Actions and fix any failures.
2. Agree the backup destination, encryption/key ownership, retention, and expected storage/egress cost.
3. Create least-privilege credentials in GitHub environment secrets or an approved secret manager; never commit tokens.
4. Implement and test a non-production export path first. Do not run a remote D1 export against production until its availability impact and maintenance window are accepted.
5. Add resource-specific backup jobs for D1, KV values, R2 objects, and queue/DLQ metadata/messages with checksums and manifests.
6. Restore to the isolated recovery lab and verify schema, data invariants, and API smoke tests.
7. Implement traffic routing only after fencing, idempotency, reconciliation, and failback drills pass.

## Safety posture

Cloudflare remains the primary platform. The production OmniPoint Supabase project remains untouched. The isolated recovery lab currently has a schema-only restore and is not a complete recovery target. Automatic production failover and failback remain disabled.
