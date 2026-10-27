# Cloudflare Tunnel — Otya Server

This directory intentionally contains no tunnel token or production route. It is a safe implementation plan, not an active tunnel configuration.

## Discovery (2026-10-27)

- Cloudflare API inventory returned zero remotely managed Cloudflare Tunnels.
- Cloudflare account currently exposes OTYA through Workers `otya-auth`, `otya-core`, and `otya-next`; custom domains are already attached to the existing `otya-core` deployment.
- A Pages project named `omnipoint-relay-lab` exists on the `never-production` branch.
- No Cloudflare Access applications were returned by the account API query.
- The Otya Server `wrangler.toml` routes `petersmartlink.com`, `www`, `docs`, `status`, and `space` to the existing Worker. Those routes must not be repointed to a Tunnel as part of this work.
- The current configuration uses native Cloudflare service bindings (including D1 and Worker-to-Worker services). These should remain direct bindings; do not tunnel traffic between Workers and D1.

## Decision

Do not create an idle tunnel until the exact private origin is known. Tunnel needs a running `cloudflared` connector with network access to a real origin service. Creating only a tunnel record would not connect an application and could create misleading expectations.

Candidate use cases, only if they actually exist:
- A private shop/back-office service running on a shop computer or dedicated server.
- A private health/diagnostics endpoint on an auxiliary relay.
- A restricted internal operations dashboard.

Do not use Tunnel to replace Workers, D1, R2, KV, Queues, or Workflows.

## Required origin details before activation

Fill this section after read-only discovery of the actual host:
- Service owner and purpose: TBD
- Host/device and operating system: TBD
- Service address and port reachable from the connector: TBD
- Environment: non-production first
- Proposed hostname: TBD (must not overlap existing production hostnames)
- Access policy / permitted identities: TBD
- Health endpoint: TBD
- Data sensitivity and logging rules: TBD
- Rollback: disable the tunnel route and connector; preserve existing Worker routes and DNS

## Safe implementation sequence

1. Identify the actual host and service; verify that it should be reachable remotely.
2. Start with a non-production hostname and a harmless health endpoint.
3. Create a remotely managed tunnel only after the origin and hostname are approved.
4. Configure Cloudflare Access identity policy before publishing any administrative UI. Tunnel connectivity is not authorization.
5. Install `cloudflared` on the origin host using a token obtained directly from Cloudflare. Never commit the token, certificate, or generated credentials.
6. Keep the origin bound to loopback/private interfaces where possible; no inbound port forwarding should be needed.
7. Verify access from an allowed identity and confirm denied identities cannot reach it.
8. Add health monitoring, connector restart behavior, token rotation instructions, and rollback steps.
9. Only consider production hostnames after a separate reviewed change and explicit approval.

## Airtel static-egress note

Cloudflare Tunnel does not provide a fixed outbound source IPv4 for Airtel API calls. If Airtel requires a source-IP allowlist, evaluate a separate narrowly scoped outbound relay only after confirming Airtel's sandbox hostname, region acceptance, and exact requirement. Never expose the relay as a general-purpose proxy. No AWS resources are provisioned.

## Do not do

- Do not edit production DNS or existing Worker routes.
- Do not create a public route for SSH, RDP, database admin, or an unrestricted dashboard.
- Do not store secrets or tokens in this repository.
- Do not route payment traffic through a tunnel as a substitute for provider-approved authentication.
- Do not activate live payments or change production without explicit approval.
