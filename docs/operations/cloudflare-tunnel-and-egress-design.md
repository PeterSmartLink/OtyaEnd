# Otya Server — Cloudflare Tunnel and AWS Egress Design

Status: planning / read-only discovery. No tunnel, AWS resource, DNS record, secret, route, or production configuration was created or changed by this work.

## Architecture decision

- Cloudflare is the primary platform for Otya Server and OmniPoint.
- Cloudflare Workers remain the public application/API runtime.
- Cloudflare D1 remains the operational relational database; R2 stores objects and verified backups; KV is for appropriate low-latency configuration/session use; Queues and Workflows handle asynchronous jobs where justified.
- Cloudflare Tunnel is for securely reaching private origins/services without exposing inbound ports. It is not a replacement for Workers or D1 and does not itself provide a fixed public source IP for outbound Airtel requests.
- AWS is optional auxiliary infrastructure only if Airtel confirms that a static IPv4 source address is required and accepts the chosen region. It must not become the primary app host or database.

## Current discovery

On 2026-10-27, the Cloudflare account's Cloudflare Tunnel API returned an empty tunnel list. Therefore, no existing Cloudflare Tunnel was visible in this account at discovery time. This is a read-only finding, not evidence that a local `cloudflared` process does not exist elsewhere.

The existing account has Workers, D1 databases, R2 buckets, KV namespaces, Queues, a Workflow, a Pages project, and existing custom-domain routes. Preserve them. In particular, do not modify the live `petersmartlink.com` routes or email-related DNS records as part of tunnel preparation.

## Recommended traffic paths

### Normal OmniPoint application traffic

Customer/staff web or Android client -> Cloudflare edge/security -> Otya Server Worker API -> D1 / R2 / KV / Queues as appropriate.

Do not route Worker-to-D1 traffic through a Tunnel. Use native Worker bindings for Cloudflare services.

### Private origin or administration service (only if a real need is identified)

Cloudflare Access policy -> named Cloudflare Tunnel -> private origin/service.

Prefer a private hostname and explicit Access identity policy for administration. Do not publish an unrestricted dashboard, database admin port, SSH, or internal API. Tunnel connectivity alone is not authorization. Keep the origin bound to loopback/private interfaces and block inbound access where possible.

Before creating a tunnel, specify the exact origin service, hostname, Access policy, owner, health checks, logging, recovery plan, and rollback. Do not point a new tunnel at existing production hostnames without a reviewed migration and explicit approval.

### Airtel outbound fixed-IP integration (conditional)

Otya Server Worker -> authenticated, narrowly scoped relay -> Airtel approved API hostname over HTTPS -> response back to Worker.

A tunnel may optionally be used to protect a private relay management/health endpoint, but it does not provide the relay's outbound fixed IP. A relay would need a stable public IPv4 (for example, an AWS Elastic IP) and strict outbound allowlisting. Never operate it as a general-purpose proxy.

## Security controls

- Enable Cloudflare account MFA and AWS root MFA manually before provisioning.
- Do not put tunnel tokens, API keys, private keys, Airtel credentials, or database exports in GitHub.
- Store secrets in the appropriate encrypted Cloudflare/AWS secret store; do not expose secrets to browser or Android bundles.
- Use least privilege, Access identity policies, HTTPS, narrow hostname/path/method allowlists, request size/time limits, rate limiting, replay protection, redacted logs, and alerts.
- Do not log PINs, OTPs, full payment credentials, or unnecessary customer data.
- Keep production payment calls disabled until provider sandbox tests and explicit authorization.
- Make changes first in an isolated preview/lab; do not change production DNS, secrets, Workers routes, or data without approval.

## Safe implementation sequence

1. Confirm the private service that actually needs Tunnel connectivity. If no private origin exists, do not create a tunnel just to add complexity.
2. Check current account Tunnel inventory and exact route/configuration needs; inventory is currently empty.
3. Prepare a named tunnel configuration in version control without credentials, using placeholders only.
4. Apply a dedicated Cloudflare Access policy before exposing any private service.
5. Test with a non-production hostname and harmless health endpoint; verify no public origin IP or open inbound port is required.
6. Add monitoring, documented token rotation, outage recovery, and rollback instructions.
7. Separately confirm Airtel's static-IP requirement, sandbox hostname, allowlist process, and approved AWS region before designing or provisioning any egress relay.
8. Estimate costs and set billing alerts before any billable AWS resource is created.
9. Only after review and explicit approval: provision the minimum required infrastructure, validate it in sandbox, and separately approve any production cutover.

## Non-goals

- No Cloudflare Tunnel created yet.
- No AWS EC2 instance, Elastic IP, VPC, security group, Lambda, API Gateway, budget, alarm, or secret created.
- No production deploy, DNS change, database migration, backup export, live payment, or provider API call performed.
- No replacement of Cloudflare Workers/D1 with AWS or third-party databases.
