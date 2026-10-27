# AWS account readiness and fixed-egress plan

**Owner:** Otya Hold Ltd
**Purpose:** Keep Cloudflare as the primary platform and use AWS only for the specific provider integration that requires a fixed public source IP (currently the Airtel developer console Server IP Allow List).
**Status:** Read-only discovery completed in part; no AWS infrastructure has been created or changed.

## Architecture decision
- Cloudflare Workers remain the primary application/API runtime.
- Cloudflare D1 remains the primary operational database; R2/KV/Queues are used where appropriate.
- AWS is an auxiliary outbound integration relay only if Airtel confirms that a stable AWS public IPv4 is required and accepts the chosen region/IP.
- Do not move OmniPoint's main database or general website hosting to AWS.

## Read-only account discovery (2026-10-27)
- AWS API access is available to the connected tooling.
- The account has no S3 buckets, no IAM users, no CloudFormation stacks, and no configured AWS Budgets returned by the account-level checks.
- Only two AWS service-linked roles were returned by IAM role listing.
- Cost Explorer access is not enabled, so actual current spend could not be queried.
- In the regional scan, the first 14 of 17 listed/enabled regions were inspected before the tooling's API-call cap was reached. Across the checked regions, no EC2 instances, Elastic IP addresses, Lambda functions, API Gateway REST APIs, NAT gateways, ECS clusters, or EKS clusters were returned. The remaining regions were not verified in that run; do not interpret this as a complete global inventory.
- A separate initial check in eu-west-1 also found no EC2 instances, Elastic IPs, Lambda functions, or API Gateway REST APIs.
- This was a read-only scan. No resources, policies, keys, networking, or billing settings were modified.

## Proposed fixed-egress options

### Preferred low-cost pilot: one small EC2 relay with Elastic IP
Use one minimal, supported Linux EC2 instance in a region accepted by Airtel, with one Elastic IP, only if provider testing proves it is needed. It should be a narrow application relay—not an open proxy and not the OmniPoint backend.

Security requirements:
- Inbound access restricted to the minimum required source(s); do not expose a generic proxy endpoint.
- HTTPS only, strong service-to-service authentication between Cloudflare Worker and relay, request signing or short-lived credentials, replay protection, strict request-size/time limits, rate limiting, and redacted logs.
- Allowlist only the Airtel API hostnames and required HTTP methods/paths; reject arbitrary destinations to prevent SSRF/open-proxy abuse.
- Store secrets in AWS Secrets Manager or an equally protected secret store; never commit them to GitHub or embed them in frontend code.
- Use least-privilege IAM, IMDSv2, security updates, CloudTrail, bounded log retention, and alarms.
- Do not log payment credentials, PINs, OTPs, or full sensitive payment payloads.
- No real-money requests until sandbox tests pass and the user explicitly approves production payment activation.

### Alternative: Lambda in VPC plus NAT Gateway
This can be more managed, but a NAT Gateway has a recurring hourly charge plus data processing and is likely excessive for the initial low-volume integration. Compare current regional pricing before selecting it.

## Cost and safety gates
1. Enable account MFA and confirm root-user access keys are not being used.
2. Enable Cost Explorer and create a small monthly AWS Budget with alerts before provisioning billable resources.
3. Confirm Airtel's accepted region, exact API hostname(s), static-IP requirements, and whether its sandbox supports allowlisting.
4. Compare current region pricing for EC2, public IPv4/Elastic IP, storage, logs, and transfer; select the lowest-cost acceptable region.
5. Prepare infrastructure as code and a staged test; no public listener or EIP allocation before explicit approval of the proposed monthly cost and security design.
6. Test only against provider sandbox; document rollback and IP replacement procedure.
7. Request approval before creating resources, assigning a public IP, changing firewall rules, or enabling production traffic.

## Domain continuity and secret boundaries
The relay must not depend on the current petersmartlink.com domain for its own internal authentication. Use a configurable Worker secret/config value for the relay origin and rotateable credentials. Domain replacement must be tested separately. Do not place AWS credentials or payment secrets in browser/mobile bundles or GitHub files.

## Not done
- No EC2 instance, Elastic IP, VPC, security group, NAT gateway, Lambda, API Gateway, IAM user/role, S3 bucket, budget, alarm, or secret was created.
- Cost Explorer was not enabled.
- No Airtel endpoint was called and no real payment was attempted.
- The complete account-wide regional inventory remains unfinished because the discovery run reached a tool API-call cap.