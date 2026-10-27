# Cloudflare Tunnel — Otya Server

Status: assessment only. No tunnel token, tunnel, DNS record, production route, or private origin has been created or changed.

## Finding (2026-10-27): no Tunnel is needed yet

The owner has not purchased or installed a physical shop server. The read-only inventory found no remotely managed Cloudflare Tunnels and no Cloudflare Access applications in this account query. The current live system is already based on Cloudflare Workers and native service bindings. There is no identified private origin for a Tunnel to connect to today.

**Decision: defer Tunnel creation.** Do not create an idle tunnel, reserve a hostname, change DNS, or add a server bill just to say Tunnel is enabled. Reassess when a real private origin exists or an approved use case is identified.

## Current live topology observed

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- `otya-core` has native Worker service bindings to `otya-auth` and `otya-next`, plus D1, R2, KV, Queues, Analytics Engine, a rate limiter, and a Workflow.
- `otya-auth` uses D1 and KV. Its live settings include a secret binding named `OTYA_STORE_INTERNAL_URL` and an `INTERNAL_SECRET` binding. The secret values were not read or exposed.
- `otya-next` has a D1 binding and Cloudflare AI-related bindings.
- Existing production hostnames `petersmartlink.com`, `www`, `docs`, `status`, and `space` are attached to the existing `otya-core` Worker.
- The `omnipoint-relay-lab` Pages project has production branch `never-production`.
- Repository documentation has some older logical service names (`otya-store` / `otya-ai`) while current account inventory uses `otya-core` / `otya-next`. Reconcile names in documentation before future deployment work; do not rename live Workers merely to match stale docs.

## Recommended architecture now

Normal customer and staff traffic:
web / Android -> Cloudflare edge -> `otya-core` Worker -> native `otya-auth` / `otya-next` service bindings -> Cloudflare D1 / R2 / KV / Queues / Workflows as needed.

Do not tunnel Worker-to-Worker or Worker-to-D1 calls. Use native Worker service bindings and native Cloudflare storage bindings.

### Internal auth-to-product cleanup channel

The `otya-auth` settings include a secret URL binding for an internal product-data cleanup endpoint. This is an internal Worker-to-Worker concern, not a reason to create a Tunnel. Before changing it, inspect the matching deployed endpoint and test its authorization/error behavior. A future reviewed code change may replace URL-based Worker-to-Worker fetch with an explicit service binding, provided it preserves the authenticated `X-Internal-Secret` check, timeout, and account-deletion fail-safe behavior. Do not alter the live binding or run account deletion tests against production as part of this assessment.

## When to add Tunnel later

A named Cloudflare Tunnel becomes useful only when a specific private service exists, for example:
- a shop computer or local server running an approved inventory/back-office service;
- a dedicated private admin or monitoring service that should not be publicly reachable;
- a separate relay's private management/health endpoint.

When that day comes:
1. Identify the host, service, port, data sensitivity, owner, and recovery plan.
2. Start on a non-production hostname.
3. Create a named tunnel only after the destination is verified.
4. Put Cloudflare Access identity policy in front of administrative applications.
5. Install `cloudflared` on the host; keep the token outside GitHub and logs.
6. Do not expose inbound ports, SSH, RDP, database admin, or an unrestricted dashboard.
7. Verify allowed and denied access, monitoring, connector restart, token rotation, and rollback.
8. Leave existing production Worker hostnames untouched unless a separate migration is reviewed and explicitly approved.

## Airtel fixed-egress distinction

Cloudflare Tunnel does not give Worker-originated outbound requests a static public source IP. If Airtel confirms that a static IP allowlist is required, evaluate a separate restricted relay only after the sandbox hostname, allowlist requirements, accepted AWS region, and costs are known. Do not use the tunnel as a generic proxy. No AWS infrastructure is provisioned.

## Safety gates

- No production DNS, Worker, binding, secret, or database changes in this assessment.
- No account data deletion or live payment.
- No tunnel or AWS resources created.
- Keep Cloudflare MFA and AWS root MFA as owner-controlled prerequisites before provisioning.
