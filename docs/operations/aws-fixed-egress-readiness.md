# AWS account readiness and fixed-egress plan

**Owner:** Otya Hold Ltd  
**Purpose:** Keep Cloudflare as the primary platform and use AWS only for a specific provider integration if it requires a fixed public source IP.  
**Status:** Read-only discovery refreshed 2026-10-27. No AWS infrastructure has been created or changed.

## Architecture decision

- Cloudflare Workers remain the primary application/API runtime.
- Cloudflare D1 remains the primary operational database; R2/KV/Queues are used where appropriate.
- AWS is an auxiliary outbound integration relay only if Airtel confirms that a stable AWS public IPv4 is required and accepts the chosen region/IP.
- Do not move OmniPoint's main database, website hosting, authentication or general backend to AWS.
- No physical shop server is required for this plan. A Cloudflare Tunnel is not a substitute for a fixed outbound public IP and is not currently needed.

## Read-only account discovery

Latest read-only account-level checks on 2026-10-27 found:

- AWS API access is available to connected tooling. The returned caller identity ARN is the account root ARN; verify the console/root access arrangement and avoid using root credentials for ongoing automation. Prefer short-lived role credentials and least privilege.
- Account IAM summary reports account-level MFA disabled (`AccountMFAEnabled: 0`), no IAM users, no account access keys, no customer-managed IAM policies, and two IAM roles.
- No AWS Budgets are configured.
- Cost Explorer access has not been available in prior checks, so actual current spend remains unverified.
- The account has no S3 buckets or CloudFormation stacks from prior read-only inventory.
- Across all 17 enabled/listed regions, prior read-only checks found no EC2 instances, Elastic IP addresses, Lambda functions, or API Gateway REST APIs.
- Checks for NAT gateways, ECS clusters, and EKS clusters were completed across all 17 regions in the follow-up audit; none were found.
- No resources, policies, keys, networking, or billing settings were modified.

These are point-in-time observations; recheck immediately before any provisioning.

## Recommended AWS use

### First choice: do not create anything until Airtel confirms the requirement

Ask Airtel developer support to confirm in writing:
1. Whether the Server IP Allow List requires a stable public **source** IPv4 for outbound API requests.
2. Whether this applies to the sandbox as well as production.
3. Accepted regions, API hostnames, ports, and callback/webhook requirements.
4. Whether a Cloudflare Worker can call a provider-approved relay and whether there are restrictions on intermediary IPs.

If a fixed source IP is not required, keep the integration on Cloudflare Workers and spend nothing on AWS infrastructure.

### If a fixed IP is confirmed: minimal relay pilot

Evaluate one small, supported Linux EC2 instance with one Elastic IP in a provider-accepted region. This instance should be a narrow outbound relay, not an open proxy and not the OmniPoint backend.

Security requirements:
- Inbound access limited to the minimum required sources; no generic public proxy endpoint.
- HTTPS, strong service-to-service authentication, short-lived credentials or signed requests, replay protection, request-size/time limits, and rate limiting.
- Strict allowlisting of Airtel API hostnames, paths and methods; reject arbitrary destinations to prevent SSRF/open-proxy abuse.
- Secrets stored in a protected secret store, never in GitHub or frontend/mobile code.
- Least-privilege IAM, IMDSv2, security updates, CloudTrail, bounded log retention, and cost/security alarms.
- Redact sensitive payloads; never log PINs, OTPs, passwords, payment credentials or full sensitive request bodies.
- Sandbox-only testing until tests pass and the owner explicitly approves production payment activation.

A Lambda-in-VPC plus NAT Gateway design is a possible managed alternative, but a NAT Gateway's recurring hourly and data-processing charges may be excessive for the first low-volume integration. Compare current regional pricing before selecting it.

## Cost controls

- AWS charges for public IPv4 addresses; the prior planning estimate was approximately USD $0.005 per address-hour (about $3.65 per 730-hour month for one address), before compute, storage, transfer, logs and tax. Confirm current AWS pricing before provisioning.
- No AWS Budget exists yet. Create a low monthly budget with email alerts before deploying billable resources.
- Cost Explorer has not provided a verified current-spend figure. Do not claim that the account currently costs $0.
- Use service quotas and cost alerts; stop the pilot if actual costs exceed the approved cap.

## Required gates before creation

1. Owner enables MFA for the account/root identity and securely stores recovery codes.
2. Confirm root access keys are absent and do not use root for routine automation; use an approved least-privilege role.
3. Enable Cost Explorer if available and create a small monthly AWS Budget with alerts.
4. Obtain Airtel's written fixed-source-IP requirement and accepted region.
5. Compare regional pricing for EC2, public IPv4, storage, logs and transfer.
6. Review infrastructure-as-code, network exposure, IAM, request authentication, allowlists, logging and rollback.
7. Get explicit owner approval for the region, architecture, monthly spending cap and resource creation before allocating an Elastic IP or creating billable resources.
8. Test against Airtel sandbox only. Production payment traffic requires separate explicit approval.

## Domain continuity and secret boundaries

The relay must not depend on the current petersmartlink.com domain for its own internal authentication. Keep the relay origin configurable and protect credentials with rotation. Do not place AWS credentials or payment secrets in browser/mobile bundles or GitHub files. Keep Cloudflare domain continuity and AWS relay deployment as separate change plans.

## Not done

- No EC2 instance, Elastic IP, VPC, security group, NAT gateway, Lambda, API Gateway, IAM user/role, S3 bucket, budget, alarm, or secret was created by this work.
- Cost Explorer has not supplied a verified spend report.
- No Airtel endpoint was called and no real payment was attempted.
- No infrastructure-as-code template has been deployed.
- Airtel's static-IP requirement, accepted region, and monthly cost cap still need confirmation/approval.
