# Otya Server — D1 Backup and Restore Runbook (Staged)

**Status:** design and operator runbook only. Not scheduled, not activated, and not tested against production yet.

## Objective

Create repeatable, dated SQL exports for all four existing D1 databases, place copies in the private `omnipoint-backups` R2 bucket, verify checksums, and prove restore into a separately named non-production database. Keep an additional encrypted copy outside the Cloudflare account for account-loss recovery.

## Safety rules

- Never run restore/import commands against `omnipoint-prod`, `otya-auth-db`, or `otya-store-db`.
- Never store SQL exports, credentials, tokens, auth rows, or customer data in GitHub commits, workflow logs, or public artifacts.
- Do not enable an automatic schedule until 2FA is enabled, secrets are configured with least privilege, retention is agreed, and a restore test succeeds.
- A backup stored only in the same Cloudflare account is not sufficient for loss of account access. Keep a separate encrypted offline/off-account copy.
- D1 export may temporarily block requests. Schedule exports in a quiet period and monitor impact.
- Treat exports of `otya-auth-db` and `otya-store-db` as sensitive because they contain identity/security-related and product/device records.

## Databases in scope

| Database | Purpose / current observation |
| --- | --- |
| `omnipoint-prod` | OmniPoint shop/agency schema; core tables checked during audit currently had zero rows, but schema is present. |
| `omnipoint-migration-test` | Migration/testing schema with test records and legacy/ORM-style tables; keep separate from production. |
| `otya-auth-db` | Existing user, linked identity, user-product and security-event records. |
| `otya-store-db` | Existing Otya store/player data, including release/device records and migration history. |

Do not rely on D1 list metadata alone for schema/table counts: audit SQL found existing schema despite inconsistent `num_tables` metadata.

## Proposed backup procedure

Use a secured operator workstation or a dedicated private automation runner. Pin Wrangler to the version approved by this repository; do not use an unreviewed floating version. Configure each database name and ID explicitly in a dedicated backup-only Wrangler configuration file that is not used for deployment. Confirm the configured IDs against the Cloudflare dashboard before every first run.

For each database:

1. Create a UTC timestamp and a unique backup directory.
2. Run the documented Wrangler D1 export command with `--remote --output=<file>` for schema and data.
3. Check the command exit status, non-zero file size, and that the export ends cleanly. Never upload a partial file.
4. Generate a SHA-256 checksum and a manifest containing database logical name, database ID, timestamp, Wrangler version, file size, checksum, and success/failure status. Do not include row values or secrets in the manifest.
5. Upload the SQL and manifest to `omnipoint-backups` under a date-partitioned prefix, for example `d1/YYYY/MM/DD/<database>/<timestamp>.sql`. Use a private bucket only; do not configure a public custom domain.
6. Download each uploaded object back to a separate directory and verify its checksum against the local manifest.
7. Encrypt the off-account copy before storing it outside Cloudflare. Do not commit backups to Git.

### Guarded operator script (new, not yet executed)

The repository now includes `scripts/backup-wrangler.toml` and `scripts/backup-d1-to-r2.mjs`. The Wrangler file is backup-only and pins the four audited database IDs. The script defaults to a dry run and does not access remote databases or R2 unless both `--execute` and the exact `OTYA_BACKUP_CONFIRM` environment value are supplied, plus a second interactive confirmation. After those gates, it uses Wrangler's `--skip-confirmation` option for D1 export so the non-interactive child process cannot stall on a second CLI prompt; R2 upload/download commands explicitly use `--remote`. It exports each database, checks for a non-empty SQL-looking dump, computes SHA-256, uploads to the private backup bucket, downloads the object for checksum verification, and writes a manifest. It does not restore, delete objects, schedule jobs, or create off-account copies.

First, review the configured database IDs and run the dry-run from the repository root:

```bash
node scripts/backup-d1-to-r2.mjs
```

Do not execute the remote mode until the account owner has enabled and verified 2FA, confirmed the database IDs and current Cloudflare account, created a least-privilege API token with only the necessary D1 export/read and R2 object read/write permissions, selected a quiet window, and arranged secure off-account encryption. Never paste the token into command history or commit it. Remote export is a sensitive production operation and may affect database availability. The command flags were checked against the current official Wrangler D1 and R2 command references, but the script itself has not yet been run locally or against the live account; its presence does not mean backups exist.

Cloudflare's official D1 export command is documented at:
https://developers.cloudflare.com/d1/best-practices/import-export-data/

Wrangler's R2 object upload/download commands are documented at:
https://developers.cloudflare.com/r2/reference/wrangler-commands/

## Retention and alerting proposal

Do not configure automatic deletion until the owner approves the retention policy. Suggested starting policy for review: daily backups for 14 days, weekly backups for 8 weeks, and monthly backups for 12 months. Keep one encrypted off-account copy on a separate schedule. Alert on export failure, missing daily backup, checksum mismatch, or an overdue restore test. Never log tokens or export contents.

## Restore drill (non-production only)

1. Create a new isolated D1 database with a clearly labelled name such as `otya-restore-drill-YYYYMMDD`.
2. Download one backup to a secured operator workstation and verify SHA-256 before importing.
3. Import using the official Wrangler D1 execute/import procedure into the isolated database only.
4. Compare table/index/trigger inventory, row counts for selected tables, foreign-key checks where applicable, and application-level read-only smoke checks.
5. Record elapsed restore time, discrepancies, and the tested backup timestamp.
6. Delete the drill database only after evidence is recorded and only with explicit approval; default is to leave it isolated until the owner reviews the result.

Official import/export guidance:
https://developers.cloudflare.com/d1/best-practices/import-export-data/

## Automation gate

Before scheduling any job, review:
- 2FA enabled on the Cloudflare account and recovery codes stored safely.
- Dedicated least-privilege Cloudflare API token for required D1 read/export and R2 object write/read operations; no DNS, Worker deploy, secret-management, or destructive permissions.
- GitHub Actions environment approval and secret masking; no untrusted pull-request workflow may access backup credentials.
- R2 object download-and-checksum verification works.
- Off-account encrypted backup path is chosen.
- A restore drill has succeeded.
- Owner explicitly approves schedule, frequency, retention, and expected cost.

## Current audit correction

The `otya-core` Wrangler configuration explicitly comments that `otya-release-events` must not yet have a consumer until an idempotent release intake handler is implemented and tested. Its lack of a consumer is therefore documented as intentional at this time, not an unexplained configuration defect.

## Current status

No export has been run by this runbook, no R2 objects have been written, no new D1 database has been created, no scheduled job has been enabled, and no production setting has changed.
