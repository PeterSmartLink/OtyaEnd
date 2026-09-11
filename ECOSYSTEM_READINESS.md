# Otya ecosystem readiness

Updated 2026-09-10. This is a coverage register, not certification or a claim of complete testing. Source checks, builds, live configuration, and device behavior are different evidence levels. Every area below remains open until its acceptance checks have evidence.

| Area | Evidence / known gap | Acceptance needed |
| --- | --- | --- |
| Brand, navigation, mobile readability | Shared brand assets; cross-host navigation corrected; small labels remain on other screens | Review every reachable screen in light/dark themes, small phones and enlarged text |
| Onboarding and permissions | Notification initialization and permission handling changed in source | Fresh install, upgrade, denied permission, later permission grant |
| Music and video | Playback and media-session implementations exist; reported notification failure unresolved on a device | Playback, lock screen, background, interruptions, Bluetooth, queue, seek, resume |
| Library and search | Local-first code exists | Scan, rescan, missing files, large library, offline search, playlists and history |
| Transfer and Together | Both flows exist in app | Two-device connection, disconnect/rejoin, cancellation, session end, authorization |
| Tools, downloads and private media | Existing app areas inventoried | Completion/error alerts, storage denial, low storage, interrupted operations, private-file access |
| Account and admin | Source/type checks; sign-out error handling repaired | Google/Telegram/email sign-in, MFA, refresh, revoke, logout, deletion, cross-subdomain cookies |
| Preferences and activity | Loading/error states corrected; preferences disabled before load | Slow network, failed load, save, re-open, simultaneous sessions |
| Recovery | New app sends Drive credential in header; server accepts header and legacy query | Deploy server first; backup/restore/delete with real consent; expired token and missing media |
| Notifications | Live release and current-session notices implemented; persistent inbox/read state absent; FCM configuration present | Signed email webhook delivery, push foreground/background/terminated, taps and media controls |
| Next and support | Core Telegram credentials present; direct AI Telegram actions incomplete | Response latency, fallback, identity boundary, approved actions, confirmed human handoff |
| Cloudflare | Latest audited deployments September 7; TLS checks passed | Deploy current validated source, verify routes and migrations, inspect live errors |
| Resend | Recent 10 emails delivered; webhook enabled and redirect removed | Verify a real signed webhook event reaches storage |
| Firebase and Telegram | Bindings inspected; no end-to-end delivery verification | Device token lifecycle, invalid tokens, Telegram webhook and private conversation |
| Releases and updates | New changes local; no new release published | CI build, signatures, APK install/upgrade, R2 integrity, release metadata, rollback |
| Performance | No current device measurements | Startup, frame timing, memory, battery, network usage, large-library workloads |
| Security and privacy | Targeted fixes only; no comprehensive assurance | Session isolation, authorization boundaries, rate limits, vault, restore, retention and account deletion |
| Operations and recovery | Logging and queue consumers configured | Queue backlog/quota, alerts, restore rehearsal, incident handling and rollback |
| Documentation and public claims | Multiple public/account surfaces exist | Match every feature claim to working behavior; remove internal implementation narration |

## Latest implementation changes

- Release workflow now attempts a Telegram channel announcement after artifact checks and metadata publication. D1 reserves each release tag before sending; uncertain attempts remain pending review and are not automatically repeated. Result is included in the owner report. No live announcement has been sent during implementation.
- Announcement behavior is covered by SQLite-backed concurrency, duplicate, uncertain delivery, configuration and message-length tests. Production bot posting rights still need verification.
- Android remote settings refresh now coalesces concurrent requests, distinguishes cached from fresh settings after failure, and keeps fresh values if writing the local cache fails. Device execution remains unverified.

## Current delivery boundary

Local commits are not proof of production deployment. No category is marked universally complete. Android SDK/Flutter/device execution is unavailable in this workspace, so app behavior must not be described as tested here. The notices surface reads current sessions and release data. A durable account-event inbox, read/unread state and historical security-event producers still require implementation.
