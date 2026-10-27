# Otya Tunnel — AWS-hosted VPN implementation plan

**Status:** Proposal / review required. No infrastructure is provisioned by this document.  
**Owner:** Otya Hold Ltd  
**Product:** Otya Tunnel, within the Otya OS ecosystem  
**Control plane:** Otya Server on Cloudflare  
**Data plane:** AWS-hosted VPN gateway(s)

## 1. Decision and boundaries

Otya Tunnel is intended to be a VPN service in which AWS hosts the actual VPN gateway and carries client tunnel traffic. It is not merely an AWS fixed-egress relay for a payment provider.

- AWS EC2 Linux instance(s) host the VPN data plane using WireGuard or another established, reviewed VPN implementation.
- Otya Server remains the control plane for account eligibility, device registration, subscription/entitlement state, configuration issuance and revocation, support status, and auditable administrative actions.
- Cloudflare Workers and D1 hold control-plane metadata only. They must not proxy arbitrary VPN traffic or store browsing contents.
- An Android client may later use Android's `VpnService` API and a vetted WireGuard implementation. Do not implement custom cryptography.
- Keep this project separate from OmniPoint payments and retail operations. VPN availability must not become a dependency for shop sales, stock, or payment workflows.
- Resend is available through the existing Otya Server integration for transactional notices when that integration is verified; do not create a separate email system or send messages during testing.

## 2. Staged delivery

### Stage 0 — account and design safety gate

Read-only preparation only:

1. Confirm the AWS account is protected by root MFA and that root access keys are absent or disabled. Do not provision resources using root credentials.
2. Establish a least-privilege IAM role/user with short-lived credentials for infrastructure work; require MFA for human access. Do not create or change IAM identities without explicit approval.
3. Inspect the existing zero-spend budget and its alert thresholds; verify current spend and whether Cost Explorer data is available.
4. Select one AWS region only after comparing expected client latency, service availability, data-residency/legal needs, and full regional costs.
5. Estimate EC2, EBS, public IPv4, snapshots/backups, CloudWatch, data transfer out, and support costs. VPN egress can dominate cost; public IPv4 is not the whole bill.
6. Agree a hard monthly spend cap and alerts before creating billable resources.

**Exit gate:** account security and cost controls verified, region and instance size agreed, and the owner explicitly approves the proposed spend.

### Stage 1 — isolated owner-only proof of concept

After approval, deploy one small Linux gateway in one region, with no public signup and no paid users.

- Use a maintained OS image and a pinned, reviewed deployment procedure.
- Security group: expose only the selected VPN transport port from intended clients; restrict SSH to a temporary trusted source or use AWS Systems Manager where supported. Never expose admin interfaces to the world.
- Enable host firewall, automatic security updates where appropriate, time synchronization, and minimal service permissions.
- Generate unique client keys per device. Keep private keys on the client or in an approved secret store; never commit keys, configs, tokens, or credentials to GitHub.
- Disable IP forwarding until firewall/NAT rules are reviewed; configure forwarding and NAT deliberately.
- Define DNS resolver behavior and IPv4/IPv6 routing. If IPv6 is not supported end-to-end, block IPv6 through the tunnel rather than silently leaking it.
- Restrict egress and add abuse safeguards proportionate to the proof of concept.
- Configure health checks, logs that avoid browsing contents, instance alarms, disk monitoring, and an incident/rollback procedure.

### Stage 2 — control-plane integration

Implement only after the owner-only tunnel works independently.

- Add explicit device enrollment, device limits, entitlement checks, revocation, and configuration lifecycle.
- Authenticate service-to-service calls with scoped credentials or Cloudflare service bindings; do not trust client-supplied account IDs or plan names.
- Store only necessary metadata in D1: opaque user/device identifiers, public-key fingerprint, status, timestamps, gateway/region assignment, entitlement reference, and audit events.
- Do not store private keys, DNS query history, browsing URLs, payloads, or packet contents in D1.
- Make revocation idempotent and define how a disconnected gateway receives revocations.
- Apply rate limits and replay protection to enrollment and control-plane endpoints.
- Use the existing Otya Server identity boundary; do not invent a parallel account database or expose internal admin routes to the public internet.

### Stage 3 — Android client and closed beta

- Use Android `VpnService` with a vetted WireGuard implementation and clear Android permission/consent UX.
- Show connection state, selected region, data/usage policy, and a clear disconnect control.
- Provide a fail-closed option / kill switch where technically supported, and explain limitations accurately.
- Test DNS leaks, IPv4 and IPv6 leaks, reconnects, sleep/wake, network switching, captive portals, battery use, key rotation, revoked devices, and gateway outages.
- Run a small invited beta only after privacy notice, acceptable-use policy, support/incident process, and abuse handling are ready.

### Stage 4 — public service gate

Do not launch publicly until capacity/load tests, security review, recovery tests, abuse response, privacy/legal review, support procedures, and cost-per-active-user measurements are complete. Multi-region/high availability is a later decision, not a starting requirement.

## 3. Security and privacy requirements

- No custom cryptography; use established VPN protocols and reviewed implementations.
- No unrestricted inbound management access.
- Least privilege, MFA, short-lived credentials, key rotation, and auditable changes.
- No secrets in Git, issue comments, application logs, or client-visible responses.
- Minimize logs. Log operational events and aggregate byte counts only when necessary; do not log browsing contents or DNS history by default.
- Document what the service can technically observe, what is logged, retention periods, and legal/abuse-response obligations. Do not claim “no logs” unless verified end-to-end.
- Protect control-plane APIs with authentication, authorization, schema validation, rate limits, and replay protection.
- Test backup restoration and instance replacement from a clean state.
- Separate development and production credentials, accounts/resources where practical, and never copy real client secrets into test environments.

## 4. Cost-control requirements

Before provisioning, calculate the complete estimate for the selected region and expected traffic. Include:
- EC2 instance hours and any required public IPv4 address;
- EBS storage, snapshots, and backup retention;
- outbound internet data transfer (likely the largest variable at scale);
- monitoring/log retention and any paid security services;
- optional static IP, load balancing, multi-AZ/multi-region, and support charges.

Set AWS Budgets alerts at multiple thresholds and enable billing alerts where available. A budget alert is not a hard spending cap. Start with one gateway, a small test allowance, and a documented teardown path. Do not enable auto-scaling or multiple regions during the proof of concept.

## 5. Acceptance checklist

- [ ] Owner has approved region, instance size, traffic allowance, and monthly budget.
- [ ] Root MFA/access-key posture and least-privilege deployment identity verified.
- [ ] Budget thresholds and alert recipients verified.
- [ ] VPN gateway created only after approval; no public signup.
- [ ] Only required ports are open; admin access is restricted.
- [ ] Unique client key generated and revocation demonstrated.
- [ ] IPv4, IPv6, DNS, and reconnect/leak tests pass.
- [ ] Fail-closed behavior tested and documented.
- [ ] Logs contain no browsing contents or secrets.
- [ ] Gateway replacement/backup recovery and teardown tested.
- [ ] Control-plane authorization, rate limiting, replay protection, and audit tests pass.
- [ ] Privacy notice, acceptable-use policy, abuse process, and support path reviewed before beta.
- [ ] No changes to OmniPoint production, payment integrations, DNS, or unrelated Otya services.

## 6. Explicit non-goals for the first release

- No public signup, reselling, or paid subscriptions.
- No multi-region or auto-scaling deployment.
- No promise of anonymity or “zero logs.”
- No VPN routing for OmniPoint financial/payment transactions.
- No production deployment or billable AWS resource creation until the owner approves the concrete plan and cost ceiling.

## 7. Reference documentation

- AWS EC2 pricing: https://aws.amazon.com/ec2/pricing/
- AWS public IPv4 pricing: https://aws.amazon.com/vpc/pricing/
- WireGuard quick start: https://www.wireguard.com/quickstart/
- Android VPN guide: https://developer.android.com/develop/connectivity/vpn
