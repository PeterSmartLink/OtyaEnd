# Otya ecosystem readiness

Updated 2026-09-11. This is a coverage register, not certification or a claim of complete testing. Source checks, builds, live configuration, and device behavior are different evidence levels. Every area below remains open until its acceptance checks have evidence.

| Area | Evidence / known gap | Acceptance needed |
| --- | --- | --- |
| Brand, navigation, mobile readability | Shared brand assets; cross-host navigation corrected; small labels remain on other screens | Review every reachable screen in light/dark themes, small phones and enlarged text |
| Onboarding and permissions | Notification initialization and permission handling changed in source | Fresh install, upgrade, denied permission, later permission grant |
| Music and video | Playback and media-session implementations exist; reported notification failure unresolved on a device | Playback, lock screen, background, interruptions, Bluetooth, queue, seek, resume |
| Library and search | Local-first code exists | Scan, rescan, missing files, large library, offline search, playlists and history |
| Transfer and Together | Both flows exist in app | Two-device connection, disconnect/rejoin, cancellation, session end, authorization |
| Tools, downloads and private media | Existing app areas inventoried | Completion/error alerts, storage denial, low storage, interrupted operations, private-file access |
| Account and admin | Source/type checks; sign-out error handling repaired; privileged admin session elevation/end now has privacy-safe Core audit producers in source | Google/Telegram/email sign-in, MFA, refresh, revoke, logout, deletion, cross-subdomain cookies; deploy and verify audit writes |
| Preferences and activity | Loading/error states corrected; preferences disabled before load | Slow network, failed load, save, re-open, simultaneous sessions |
| Recovery | App/Drive recovery path exists; D1 Time Travel readiness workflow and operator recovery runbook now exist in source | Deploy current server; verify daily readiness against live D1; rehearse a controlled non-production restore; backup/restore/delete with real consent |
| Notifications | Release/current-session notices exist; durable notification-event + per-user read-receipt schema/API now exists in source; FCM delivery evidence added to queue consumer | Apply Core migration, verify real account/global inbox behavior, signed email webhook delivery, push foreground/background/terminated, taps and media controls |
| Next and support | Core owns Telegram transport; private chat and linked-discussion Next routing plus loop guards exist in source | Deploy current Core/Next, verify bot private reply, channel publishing, linked discussion reply, response latency/fallback, approved actions, confirmed human handoff |
| Cloudflare | Explicit deploy authority and service bindings exist; Core migration integrity gate and read-only operations-readiness workflow added | Deploy current validated source, verify migration ledger/Time Travel, inspect live errors and scheduled readiness result |
| Resend | Recent delivery evidence exists; webhook enabled and redirect removed | Verify a real signed webhook event reaches storage |
| Firebase and Telegram | FCM/Telegram bindings inspected; server source now records FCM queue delivery outcomes | Device token lifecycle, invalid tokens, real FCM delivery, Telegram webhook/private/discussion end-to-end verification |
| Releases and updates | Release workflow and guarded Telegram announcement path exist; no new public app release asserted here | CI build, signatures, APK install/upgrade, R2 integrity, release metadata, rollback |
| Performance | No current device measurements | Startup, frame timing, memory, battery, network usage, large-library workloads |
| Security and privacy | Targeted boundaries, secret ownership, migration destructive-SQL guard and first security-event producers exist | Session isolation, authorization boundaries, rate limits, vault, restore, retention/account deletion, broader Auth security-event coverage |
| Operations and recovery | Request analytics, queue consumer, health email alerts, durable queue delivery evidence, incident/recovery transition records, migration checks and recovery runbook now exist in source | Deploy/apply migration, verify queue evidence and incident records live, add backlog/quota evidence, perform restore rehearsal, validate rollback procedure |
| Documentation and public claims | Multiple public/account surfaces exist; operations recovery runbook added | Match every feature claim to working behavior; remove internal implementation narration from public surfaces |

## Latest implementation changes

- Core migration `0007_operations_and_notifications.sql` adds durable notification events, per-user notification read receipts, privacy-safe security events, operational incidents and push-queue delivery evidence. It is additive and is not proof that production has been migrated.
- `/api/notifications` now has authenticated source support for account/global notification history and per-user read/unread state. Release availability and Pro-expiry producers can persist durable events after the Core migration is live.
- The Core push queue now records success, failure, transient failure, stale-token removal and retry outcomes while preserving the existing no-replay rule after partial broadcast success.
- Admin session elevation/end now produce privacy-safe Core security events without recording OTPs, passwords, raw IP addresses or message bodies. Admin stats can surface recent security/operational events and 24-hour push delivery aggregates after migration.
- Production health monitoring now records only incident/recovery transitions, while the existing KV incident signature prevents five-minute heartbeat spam.
- Repository migration discipline is checked in CI. Explicit Core production deploys validate and apply pending Core D1 migrations before Worker promotion. Auth migrations remain visibility-only while the preserved-schema repair path still exists.
- `Otya Operations Readiness` is a read-only scheduled/manual workflow checking migration drift and D1 Time Travel availability; it never restores a database.
- `docs/OPERATIONS_RECOVERY_RUNBOOK.md` documents the operator decision gate for code rollback vs configuration repair vs queue/provider issues vs a destructive D1 restore.
- Telegram Core/Next discussion routing and loop guards are implemented in source and covered by tests; live verification still requires an explicit production deployment and correct Telegram channel/discussion admin permissions.

## Current delivery boundary

Local commits are not proof of production deployment. No category is marked universally complete. The new Core operations migration, durable notification API, queue evidence, security/operational events and recovery checks must still pass the newest CI head and then be explicitly deployed before they can be described as live. Android/device behavior also remains a separate evidence level and must not be inferred from server-source validation.

## Server repository verification — 2026-09-12

This pass reconciled main at `792bf50` before editing. Core configuration and migration-layout checks, all 245 core tests, 11 auth-worker tests and 20 AI-worker tests passed. Auth typechecking and AI packaging dry-run passed. These are local checks, not proof of production deployment or device delivery.

Fixed account notification visibility: device-only records are excluded from listing, unread counts, bulk read updates and individual lookups. New device-targeted inbox writes require a user identity. SQLite regression fixtures exercise the actual route queries with own-account, other-account, global and device-only records.

Shared auth verification now supplies an eight-second abort signal and rejects malformed success responses. Oversized notification, security and operational JSON remains parseable within the storage limit instead of being cut mid-document. Runtime worker logging has the same behavior.

Remaining release acceptance evidence: deployed commit and production migrations; authenticated account/admin flows; Firebase delivery during playback/background use; Resend delivery and Telegram rendering; Android download/update installation; recovery drill and sustained-load measurements. This pass does not certify every feature or replace those live checks.
