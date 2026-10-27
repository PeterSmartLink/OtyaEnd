# Otya Tunnel — open-source implementation shortlist

**Status:** Engineering proposal for review; not a deployment.  
**Product owner:** Otya Hold Ltd  
**Control plane:** Otya Server / Cloudflare  
**Data plane:** AWS-hosted gateway  
**Scope:** Owner-only proof of concept first. No resources, secrets, DNS, or production services are changed by this document.

## 1. Reuse maintained components; do not build cryptography

| Area | Candidate | Intended use | Adoption gate |
|---|---|---|---|
| VPN protocol and Linux implementation | [WireGuard](https://www.wireguard.com/) and its official [quick start](https://www.wireguard.com/quickstart/) | Tunnel protocol and Linux interface | Pin OS/package versions; review firewall, routing, key lifecycle, and license obligations |
| Linux client tooling | `wireguard-tools` (`wg`, `wg-quick`) | Configure and inspect interfaces | Prefer distribution packages; do not put private keys in Git or CI logs |
| Android VPN client | Official [WireGuard Android repository](https://github.com/WireGuard/wireguard-android) and Android [VpnService documentation](https://developer.android.com/develop/connectivity/vpn) | Use a vetted client/backend or study integration options | Review license compatibility, app packaging, API compatibility, and upstream update cadence before embedding or forking |
| Infrastructure definitions | [OpenTofu](https://opentofu.org/) with the maintained AWS provider | Reproducible, reviewable infrastructure definitions after cost/security gates | State must be encrypted and access-controlled; never commit state or credentials; plan output is not deployment approval |
| Configuration management | [Ansible](https://www.ansible.com/) | Repeatable host hardening and service configuration | Pin collections/roles, review all tasks, and keep secrets in an approved secret store |
| Private management connectivity | [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/) | Outbound-initiated access to selected management/control endpoints only | Create only after a gateway exists and the owner approves; this does **not** carry arbitrary WireGuard UDP client traffic by itself |
| Cloudflare control plane | Existing Otya Server Workers + D1; Cloudflare documentation for [Workers](https://developers.cloudflare.com/workers/) and [D1](https://developers.cloudflare.com/d1/) | Enrollment, device status, entitlement metadata, audit events | Reuse existing identity boundaries; inspect current bindings and schema before code changes |
| Email notices | Existing Resend integration through Otya Server | Future account/security notices only | Verify existing integration first; do not create a second mail system or send test emails |

Links are upstream project/documentation entry points, not an endorsement of every third-party deployment script or container image. Avoid copying an unknown “one-click VPN” installer into a privileged host. Review source, releases, maintenance activity, license, supply-chain risks, and upgrade path before adoption.

## 2. Minimal first build

1. **Repository-only preparation:** keep architecture, threat model, runbook, and tests in GitHub. No secrets, generated client configs, private keys, or Terraform/OpenTofu state.
2. **Local validation:** validate configuration templates and firewall/routing rules offline. Use synthetic identities and keys; never connect a test to production users or payment traffic.
3. **AWS preflight:** verify the current caller is a restricted role (not root), MFA posture, region, actual spend, billing data availability, budget alerts, and complete estimated cost. The existing $1 monthly alert budget is not a hard spending cap and is not evidence that a gateway will fit within budget.
4. **Owner approval:** document one region, instance class, expected traffic/data-transfer allowance, public IPv4 decision, storage, monitoring, and maximum monthly spend. Provision nothing before explicit approval of this exact estimate.
5. **Isolated gateway:** only after gates 3–4, deploy one disposable gateway. Keep administration private; expose only the chosen VPN transport port. Do not enable public signup.
6. **Leak and recovery tests:** verify IPv4, IPv6, DNS, routing, reconnect, device revocation, key rotation, backup/rebuild, and teardown.
7. **Control-plane integration:** only after the standalone tunnel passes. Use server-authoritative entitlement checks and idempotent revocation; store metadata, not private keys or browsing history, in D1.
8. **Android integration:** prototype against the isolated gateway using a reviewed WireGuard Android integration. Confirm license compatibility before redistribution.
9. **Closed beta gate:** independent security review, privacy notice, acceptable-use policy, abuse handling, incident process, monitoring, and cost-per-active-user review.

## 3. Threat model and hard requirements

- Treat VPN gateway root compromise as a full gateway compromise; isolate it from OmniPoint and unrelated Otya services.
- Never expose SSH or an admin panel to the whole internet. Prefer AWS Systems Manager Session Manager where supported, or narrowly scoped temporary administration.
- Generate a unique key pair per device. Private keys stay on the client or an approved secret store; server-side metadata stores public-key fingerprints only where possible.
- Authenticate and authorize every control-plane action. Never trust a client-provided user ID, plan, gateway ID, or device ownership claim.
- Apply enrollment rate limits, replay-resistant requests, device limits, abuse safeguards, and an auditable revocation path.
- Configure firewall, forwarding, NAT, DNS, and IPv6 behavior deliberately. If IPv6 is not carried safely end-to-end, block it through the tunnel rather than allow a leak.
- Minimize telemetry. Do not collect browsing URLs, payloads, or DNS history by default. Do not promise “zero logs” or anonymity without an independently verified technical and operational basis.
- Keep control-plane endpoints and admin access separate from the public VPN data-plane listener.
- Pin dependencies and review upstream advisories. Document licenses and attribution before distributing binaries or source.

## 4. Required automated / manual checks

- [ ] Source and dependency/license review recorded.
- [ ] No secrets, private keys, generated VPN profiles, state files, or customer data in repository history.
- [ ] Firewall exposes only approved VPN transport; management access is restricted.
- [ ] Invalid, expired, replayed, and unauthorized enrollment requests fail closed.
- [ ] Repeated revocation requests are safe and idempotent.
- [ ] Revoked devices cannot reconnect after the documented propagation interval.
- [ ] DNS, IPv4, and IPv6 leak tests pass on supported Android versions.
- [ ] Network switching, sleep/wake, captive portal, and reconnect tests pass.
- [ ] Gateway failure and clean rebuild/recovery are demonstrated.
- [ ] Operational logs exclude browsing contents, DNS queries, private keys, and access tokens.
- [ ] Cost estimate includes compute, storage/snapshots, public IPv4, egress, logs/monitoring, backups, and taxes where applicable.
- [ ] Teardown procedure is rehearsed and verifies that billable resources are removed.
- [ ] Public signup and paid plans remain disabled until formal beta/public-launch approval.

## 5. Explicitly deferred

- Public signup, billing/subscriptions, paid users, multi-region routing, autoscaling, custom protocol/cryptography, and claims of anonymity.
- Routing OmniPoint payment or retail traffic through the VPN.
- Creating Cloudflare Tunnel credentials, changing DNS, creating AWS resources, or deploying any service without a verified identity/cost gate and explicit approval.

## 6. Upstream references

- WireGuard: https://www.wireguard.com/quickstart/
- WireGuard Android: https://github.com/WireGuard/wireguard-android
- Android VpnService: https://developer.android.com/develop/connectivity/vpn
- OpenTofu: https://opentofu.org/
- Ansible: https://www.ansible.com/
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- AWS Systems Manager Session Manager: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html
- AWS EC2 pricing: https://aws.amazon.com/ec2/pricing/
- AWS public IPv4 pricing: https://aws.amazon.com/vpc/pricing/
