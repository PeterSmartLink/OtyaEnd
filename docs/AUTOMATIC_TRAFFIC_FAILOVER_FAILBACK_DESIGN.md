# Automatic Traffic Failover and Failback — Design and Safety Gates

**Status:** Design only. This document does not change traffic routing, DNS, Workers, Supabase, secrets, or production configuration.

## Objective

Keep Cloudflare as the normal primary platform and use Supabase-backed recovery services only when a verified outage makes that necessary. Automate detection, backup verification, recovery preparation, and—after controlled tests—traffic switching. Never send live traffic to an empty or stale recovery database.

## Platform boundary

Supabase is not a drop-in replacement for Cloudflare Workers, D1, KV, R2, Queues, or Workflows. The recovery environment needs tested compatible APIs and data mappings for each product. A PostgreSQL restore alone does not restore the full ecosystem. Assets/releases, authentication/session behavior, background jobs, secrets, and provider integrations each need their own recovery strategy.

## Target flow

1. **Observe:** independent probes check the public API, authentication, critical read paths, write-path readiness, and provider dependencies.
2. **Confirm:** require consecutive failures from independent probes; distinguish a single endpoint or downstream provider failure from a platform-wide outage.
3. **Freeze unsafe writes:** enter controlled degraded mode. Do not accept financial writes that cannot be durably recorded and reconciled.
4. **Prepare recovery:** restore the latest verified backup to the isolated Supabase recovery project; verify checksums, migration version, row/count invariants, critical API smoke tests, and backup age.
5. **Fence the old primary:** obtain a single-writer lease/epoch and ensure old writers cannot accept conflicting writes. If fencing cannot be proved, do not enable write traffic on recovery.
6. **Switch traffic:** change a stable routing layer only after readiness gates pass. Keep the change reversible and log each change.
7. **Operate in recovery:** use idempotency keys, an immutable operation journal, external payment/mobile-money reconciliation, and monitoring.
8. **Fail back:** replay/reconcile recovery-period writes into the chosen primary in a controlled window; verify ledger totals and invariants; fence recovery writers; then switch traffic back gradually. Never let both systems accept independent writes.
9. **Close incident:** retain audit logs, backup IDs, checksums, routing epochs, reconciliation outcomes, and an incident report.

## Failover state machine

- PRIMARY: Cloudflare is the only writer.
- SUSPECT: probe failures detected; no routing change.
- RECOVERY_PREPARING: restore and validate in isolation.
- RECOVERY_READY: recovery passes checks and fencing is verified.
- RECOVERY_ACTIVE: recovery accepts traffic under a single-writer epoch.
- FAILBACK_PREPARING: replay/reconcile and validate the return path.
- PRIMARY_RESTORED: primary is verified and traffic has moved back.
- MANUAL_HOLD: uncertainty in backup freshness, fencing, ledger reconciliation, identity/session compatibility, or provider state blocks automatic write failover.

Transitions must be auditable, idempotent, and protected against two controllers acting simultaneously. Use a durable lease with expiry and monotonically increasing epoch; do not rely on a process-local flag.

## Automatic vs approval-gated actions

### Safe to automate first
- Health probes and alert delivery.
- Scheduled exports to a separate encrypted backup destination, after D1 export impact and cost are approved.
- Backup checksums, manifests, retention enforcement, and age alerts.
- Restore drills into an isolated recovery environment.
- Recovery API smoke tests and readiness reports.
- Automatic failover recommendation and operator notification.

### Keep approval-gated until drills pass
- Changing production routes or DNS.
- Enabling write traffic on Supabase recovery.
- Promoting a database or changing writer ownership.
- Replaying queue/DLQ messages or financial operations.
- Rotating or copying production secrets.
- Failback and any operation that can overwrite newer data.

Automatic production traffic switching may be enabled only after repeated successful restore drills, tested fencing, a tested reverse path, alerts with an accountable owner, and measured RPO/RTO. A health-check success by itself is not sufficient.

## Data and product-specific rules

- **OmniPoint financial ledger:** preserve double-entry invariants and idempotency; reconcile uncertain provider outcomes before retrying. Never label a locally queued transaction as completed.
- **Otya Auth:** preserve identity mapping and token/session validation. Never bypass revocation or authorization during fallback.
- **D1:** test schema, indexes, triggers, foreign keys, and consistency after export/import. Measure export impact before scheduling; some paths may temporarily affect availability.
- **KV:** back up values as well as key metadata; protect security-sensitive keys with encryption and retention controls.
- **R2:** record object keys, versions/metadata, sizes, and cryptographic hashes; validate representative downloads after restore.
- **Queues and DLQs:** capture message bodies and metadata securely; define deduplication and replay policy. Inspect existing DLQ messages before any replay or purge.
- **Workers/configuration:** store reviewed source/configuration in version control; restore bindings and environment configuration deliberately. Keep secrets in a secure secret manager, not Git or backup manifests.
- **OtyaPlayer:** local/offline media playback should remain functional without server availability; online release/download features can degrade separately.

## Required test cases

1. One probe fails while others succeed: no failover.
2. A downstream mobile-money/provider outage occurs: isolate that dependency rather than switching the whole platform unnecessarily.
3. Primary is unavailable but backup is stale or restore fails: enter MANUAL_HOLD.
4. Recovery is ready but primary cannot be fenced: block write traffic.
5. A payment outcome is uncertain during failover: reconcile by provider reference/idempotency key before retry.
6. A stale controller attempts to switch routes: reject using lease/epoch checks.
7. Failback detects conflicting or missing ledger entries: keep recovery active or enter MANUAL_HOLD; never overwrite silently.
8. Recovery routing fails smoke tests: revert only if primary health and writer ownership are verified.

## Current known state and next implementation sequence

- Cloudflare remains primary; no live traffic switch has been configured.
- The isolated Supabase Otya-Recovery-Lab has a schema-only OmniPoint restore; it contains no copied production customer rows.
- The existing OmniPoint Supabase project must remain untouched.
- Inventory found a pre-existing message in the otya-push-dlq queue and an otya-release-events queue without a consumer in the inventory. Do not purge, acknowledge, or replay these automatically.
- Next: build backup/export tooling and manifest; configure least-privilege credentials outside source control; test one resource at a time in isolation; schedule backup runs; prove restore and integrity checks; then test routing in a non-production environment. Review D1 export impact before the first production export.
- Suggested initial objectives (not yet agreed or achieved): daily backup, monthly full restore drill, illustrative RPO 24 hours and RTO 8 hours. Tighten these only after cost and recovery measurements.

## Go-live checklist

- [ ] Backup destination, encryption, retention, and cost approved.
- [ ] Least-privilege credentials configured securely and rotation tested.
- [ ] Two consecutive scheduled backups complete and verify.
- [ ] Full isolated restore succeeds and is independently checked.
- [ ] Required data classes are covered: D1, KV values, R2 objects, queue/DLQ state, schema/config, and secrets recovery.
- [ ] Financial ledger and provider reconciliation tests pass.
- [ ] Single-writer fencing and stale-controller tests pass.
- [ ] Non-production failover and failback drills pass.
- [ ] Alerts, runbook, on-call owner, and measured RPO/RTO are confirmed.
- [ ] Explicit approval for production routing changes.

**Do not describe the ecosystem as automatically backed up or automatically failing over until these checks pass.**
