# Otya Server — Tunnel Necessity Assessment (2026-10-27)

## Executive decision

**Do not create a Cloudflare Tunnel yet.** The owner has not bought a physical shop server, and read-only Cloudflare inventory found no existing managed Tunnel or Access application. No private origin requiring a tunnel has been identified.

Cloudflare Tunnel is not a required building block for a Cloudflare Workers + D1 application. It connects Cloudflare to a service running on an origin device or private network. The normal OmniPoint application should use native Worker service bindings and native D1/R2/KV/Queue bindings instead.

## Evidence inspected (read-only)

- Cloudflare managed Tunnel list: zero results.
- Cloudflare Access applications list: zero results.
- Workers present: `otya-auth`, `otya-core`, `otya-next`.
- Existing custom domains attached to `otya-core`: `petersmartlink.com`, `www.petersmartlink.com`, `docs.petersmartlink.com`, `status.petersmartlink.com`, `space.petersmartlink.com`.
- `otya-core` has native Worker service bindings to `otya-auth` and `otya-next`, plus D1, R2, KV, Queues, a rate limiter, Analytics Engine and Workflow bindings.
- `otya-auth` has D1 and KV bindings. Live Worker settings contain secret bindings named `OTYA_STORE_INTERNAL_URL` and `INTERNAL_SECRET`; secret values were not read or disclosed.
- `otya-next` has D1 and Cloudflare AI-related bindings.
- Pages project `omnipoint-relay-lab` has production branch `never-production`.
- Existing repository handoff documentation refers to logical workers `otya-store` and `otya-ai`, whereas the current live account inventory shows `otya-core` and `otya-next`. Treat this as documentation drift until code/config mapping is verified; do not rename production resources based only on stale docs.

## What may need improvement instead of Tunnel

The `otya-auth` account-deletion path uses a configured internal URL to call a product-data cleanup endpoint with an internal secret and timeout. This is an application-level inter-Worker integration, not a private physical server. A future change may be able to use a direct Cloudflare Worker service binding, which would remove URL/DNS coupling. Before changing it, confirm the deployed cleanup endpoint and preserve:
- server-to-server authorization;
- the existing internal-secret check until a safe replacement is designed;
- timeout and error handling;
- the fail-safe behavior that preserves the auth identity if product-data cleanup fails;
- tests that do not delete real production user data.

No such code or live binding change was made in this assessment.

## Architecture now

Web / Android -> Cloudflare edge -> `otya-core` Worker -> native Worker service bindings (`otya-auth`, `otya-next`) -> Cloudflare services (D1/R2/KV/Queues/Workflows as appropriate).

Tunnel is deferred until a concrete private origin exists. When the shop server is purchased, reassess whether it needs to host anything at all. Prefer keeping business logic and authoritative records in Cloudflare; use a shop computer only for genuinely local peripherals or offline/local operations.

## Separate Airtel question

If Airtel requires static outbound source-IP allowlisting, that is an egress problem, not a Tunnel problem. Confirm the exact sandbox hostname, static-IP requirement and accepted region before evaluating a small restricted relay. No AWS resources have been created.

## Safety and scope

This was a read-only assessment plus a documentation-only update on branch `infra/cloudflare-domain-continuity`. No production deployment, DNS change, tunnel creation, Access policy change, secret rotation, data migration, account deletion, or live payment was performed.
